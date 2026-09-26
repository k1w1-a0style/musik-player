package expo.modules.systemaudio

import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import java.nio.ByteOrder
import java.util.concurrent.CancellationException
import java.util.concurrent.atomic.AtomicBoolean

/** Test-only reference: unchanged polling loop from commit 74fe7da. */
internal object LegacyPcmWaveformDecoder {
  fun decode(
    extractor: MediaExtractor,
    inputFormat: MediaFormat,
    mime: String,
    pointCount: Int,
    durationUs: Long,
    cancellation: AtomicBoolean,
  ): List<Double> {
    val codec = MediaCodec.createDecoderByType(mime)
    var started = false
    return try {
      codec.configure(inputFormat, null, null, 0)
      codec.start()
      started = true
      val envelope = PcmWaveformEnvelope(pointCount, durationUs)
      val bufferInfo = MediaCodec.BufferInfo()
      var inputEnded = false
      var outputEnded = false
      var sampleRate = inputFormat.intValue(MediaFormat.KEY_SAMPLE_RATE, 0)
      var channelCount = inputFormat.intValue(MediaFormat.KEY_CHANNEL_COUNT, 0)
      var pcmEncoding = AudioFormat.ENCODING_PCM_16BIT
      var idleDequeues = 0

      // Feed without blocking while output is available. The old loop waited
      // on both sides; the sampled path additionally flushed 480 times/track.
      while (!outputEnded) {
        throwIfCancelled(cancellation)
        var madeProgress = false
        if (!inputEnded) {
          val inputIndex = codec.dequeueInputBuffer(0L)
          if (inputIndex >= 0) {
            val inputBuffer = codec.getInputBuffer(inputIndex)
              ?: throw IllegalStateException("Decoder input buffer unavailable")
            inputBuffer.clear()
            val size = extractor.readSampleData(inputBuffer, 0)
            if (size < 0) {
              codec.queueInputBuffer(inputIndex, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputEnded = true
            } else {
              codec.queueInputBuffer(inputIndex, 0, size, extractor.sampleTime.coerceAtLeast(0L), 0)
              extractor.advance()
            }
            madeProgress = true
          }
        }

        when (val outputIndex = codec.dequeueOutputBuffer(bufferInfo, if (madeProgress) 0L else CODEC_DEQUEUE_TIMEOUT_US)) {
          MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            val outputFormat = codec.outputFormat
            sampleRate = outputFormat.intValue(MediaFormat.KEY_SAMPLE_RATE, sampleRate)
            channelCount = outputFormat.intValue(MediaFormat.KEY_CHANNEL_COUNT, channelCount)
            pcmEncoding = outputFormat.intValue(MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
            madeProgress = true
          }
          MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
          else -> if (outputIndex >= 0) {
            try {
              if (bufferInfo.size > 0 && pcmEncoding == AudioFormat.ENCODING_PCM_16BIT
                && sampleRate > 0 && channelCount > 0) {
                val outputBuffer = codec.getOutputBuffer(outputIndex)
                  ?: throw IllegalStateException("Decoder output buffer unavailable")
                val pcm = outputBuffer.duplicate().order(ByteOrder.nativeOrder())
                pcm.position(bufferInfo.offset)
                pcm.limit(bufferInfo.offset + bufferInfo.size)
                envelope.addPcm16(pcm.slice().order(ByteOrder.nativeOrder()), bufferInfo.presentationTimeUs,
                  sampleRate, channelCount)
              }
              outputEnded = bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
            } finally {
              codec.releaseOutputBuffer(outputIndex, false)
            }
            madeProgress = true
          }
        }

        idleDequeues = if (madeProgress) 0 else idleDequeues + 1
        if (idleDequeues >= MAX_IDLE_DEQUEUES) throw IllegalStateException("Decoder stopped producing PCM")
      }
      if (pcmEncoding != AudioFormat.ENCODING_PCM_16BIT) emptyList() else envelope.normalizedPoints()
    } finally {
      if (started) try { codec.stop() } catch (_: Throwable) {}
      try { codec.release() } catch (_: Throwable) {}
    }
  }

  private fun MediaFormat.intValue(key: String, fallback: Int): Int =
    if (containsKey(key)) try { getInteger(key) } catch (_: Throwable) { fallback } else fallback
  private fun throwIfCancelled(cancellation: AtomicBoolean) {
    if (cancellation.get()) throw CancellationException("Waveform extraction cancelled")
  }
  private const val CODEC_DEQUEUE_TIMEOUT_US = 1_000L
  private const val MAX_IDLE_DEQUEUES = 5_000
}
