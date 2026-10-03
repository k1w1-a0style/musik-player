package expo.modules.systemaudio

import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.os.Handler
import android.os.HandlerThread
import android.os.Process
import android.os.SystemClock
import java.nio.ByteOrder
import java.util.concurrent.CancellationException
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** Full-file PCM analysis without a synchronous codec dequeue for every packet. */
internal object CallbackPcmWaveformDecoder {
  private sealed class Event {
    data class Input(val index: Int) : Event()
    data class Output(val index: Int, val offset: Int, val size: Int, val timeUs: Long, val flags: Int) : Event()
    data class Format(val value: MediaFormat) : Event()
    data class Failure(val error: MediaCodec.CodecException) : Event()
  }

  fun decode(
    extractor: MediaExtractor,
    inputFormat: MediaFormat,
    mime: String,
    pointCount: Int,
    durationUs: Long,
    cancellation: AtomicBoolean,
    onProgress: (Long) -> Unit = {},
  ): List<Double> {
    checkCancellation(cancellation)
    val envelope = PcmWaveformEnvelope(pointCount, durationUs)
    val codec = MediaCodec.createDecoderByType(mime)
    val events = LinkedBlockingQueue<Event>()
    // Callbacks only transfer ownership notifications. Extractor, codec calls
    // and envelope mutations remain serialized on the existing analysis worker.
    val callbackThread = HandlerThread("waveform-codec-events", Process.THREAD_PRIORITY_BACKGROUND)
    var started = false
    return try {
      callbackThread.start()
      codec.setCallback(object : MediaCodec.Callback() {
        override fun onInputBufferAvailable(codec: MediaCodec, index: Int) {
          events.offer(Event.Input(index))
        }
        override fun onOutputBufferAvailable(codec: MediaCodec, index: Int, info: MediaCodec.BufferInfo) {
          // BufferInfo belongs to Android and may be reused after this callback.
          events.offer(Event.Output(index, info.offset, info.size, info.presentationTimeUs, info.flags))
        }
        override fun onOutputFormatChanged(codec: MediaCodec, format: MediaFormat) {
          events.offer(Event.Format(format))
        }
        override fun onError(codec: MediaCodec, error: MediaCodec.CodecException) {
          events.offer(Event.Failure(error))
        }
      }, Handler(callbackThread.looper))
      codec.configure(inputFormat, null, null, 0)
      codec.start()
      started = true
      var inputEnded = false
      var outputEnded = false
      var sampleRate = inputFormat.intValue(MediaFormat.KEY_SAMPLE_RATE, 0)
      var channels = inputFormat.intValue(MediaFormat.KEY_CHANNEL_COUNT, 0)
      var encoding = AudioFormat.ENCODING_PCM_16BIT
      var lastProgress = SystemClock.elapsedRealtime()

      while (!outputEnded) {
        checkCancellation(cancellation)
        val event = events.poll(CANCELLATION_POLL_MS, TimeUnit.MILLISECONDS)
        if (event == null) {
          check(SystemClock.elapsedRealtime() - lastProgress < STALL_TIMEOUT_MS) {
            "Decoder stopped producing PCM"
          }
          continue
        }
        lastProgress = SystemClock.elapsedRealtime()
        when (event) {
          is Event.Input -> if (!inputEnded) {
            val buffer = codec.getInputBuffer(event.index)
              ?: error("Decoder input buffer unavailable")
            buffer.clear()
            val size = extractor.readSampleData(buffer, 0)
            if (size < 0) {
              codec.queueInputBuffer(event.index, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputEnded = true
            } else {
              codec.queueInputBuffer(event.index, 0, size, extractor.sampleTime.coerceAtLeast(0L), 0)
              extractor.advance()
            }
          }
          is Event.Format -> {
            sampleRate = event.value.intValue(MediaFormat.KEY_SAMPLE_RATE, sampleRate)
            channels = event.value.intValue(MediaFormat.KEY_CHANNEL_COUNT, channels)
            encoding = event.value.intValue(MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
          }
          is Event.Output -> {
            try {
              if (event.size > 0 && encoding == AudioFormat.ENCODING_PCM_16BIT && sampleRate > 0 && channels > 0) {
                val source = codec.getOutputBuffer(event.index) ?: error("Decoder output buffer unavailable")
                val pcm = source.duplicate().order(ByteOrder.nativeOrder())
                pcm.position(event.offset)
                pcm.limit(event.offset + event.size)
                envelope.addPcm16(pcm.slice().order(ByteOrder.nativeOrder()), event.timeUs, sampleRate, channels)
                onProgress(event.timeUs)
              }
              outputEnded = event.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
            } finally {
              codec.releaseOutputBuffer(event.index, false)
            }
          }
          is Event.Failure -> throw event.error
        }
      }
      checkCancellation(cancellation)
      if (encoding == AudioFormat.ENCODING_PCM_16BIT) envelope.normalizedPoints() else emptyList()
    } finally {
      if (started) try { codec.stop() } catch (_: Throwable) {}
      try { codec.release() } catch (_: Throwable) {}
      callbackThread.quitSafely()
      callbackThread.join(CALLBACK_JOIN_MS)
      events.clear()
    }
  }

  private fun MediaFormat.intValue(key: String, fallback: Int): Int =
    if (containsKey(key)) try { getInteger(key) } catch (_: Throwable) { fallback } else fallback

  private fun checkCancellation(cancellation: AtomicBoolean) {
    if (cancellation.get()) throw CancellationException("Waveform extraction cancelled")
  }

  private const val CANCELLATION_POLL_MS = 25L
  private const val STALL_TIMEOUT_MS = 5_000L
  private const val CALLBACK_JOIN_MS = 1_000L
}
