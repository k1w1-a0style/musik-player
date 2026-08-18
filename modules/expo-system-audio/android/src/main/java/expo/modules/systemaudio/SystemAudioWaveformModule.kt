package expo.modules.systemaudio

import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.CancellationException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

internal class WaveformCancellationRegistry {
  private val requests = ConcurrentHashMap<String, AtomicBoolean>()

  fun register(requestId: String?): AtomicBoolean {
    val token = AtomicBoolean(false)
    if (!requestId.isNullOrBlank()) {
      requests.put(requestId, token)?.set(true)
    }
    return token
  }

  fun cancel(requestId: String): Boolean {
    val token = requests[requestId] ?: return false
    token.set(true)
    return true
  }

  fun complete(requestId: String?, token: AtomicBoolean) {
    if (!requestId.isNullOrBlank()) requests.remove(requestId, token)
  }

  fun activeCount(): Int = requests.size
}

/** Decodes the selected audio track to PCM before calculating its envelope. */
class SystemAudioWaveformModule : Module() {
  private val cancellationRegistry = WaveformCancellationRegistry()

  override fun definition() = ModuleDefinition {
    Name("ExpoSystemAudioWaveform")

    AsyncFunction("extractWaveformPeaks") { uri: String, requestedPoints: Int?, requestId: String? ->
      val cancellation = cancellationRegistry.register(requestId)
      try {
        extractWaveformPeaks(uri, requestedPoints ?: DEFAULT_WAVEFORM_POINTS, cancellation)
      } finally {
        cancellationRegistry.complete(requestId, cancellation)
      }
    }

    Function("cancelWaveformExtraction") { requestId: String ->
      cancellationRegistry.cancel(requestId)
    }
  }

  private fun extractWaveformPeaks(
    uri: String,
    requestedPoints: Int,
    cancellation: AtomicBoolean,
  ): Map<String, Any?>? {
    val pointCount = requestedPoints.coerceIn(MIN_WAVEFORM_POINTS, MAX_WAVEFORM_POINTS)
    val extractor = MediaExtractor()
    return try {
      throwIfCancelled(cancellation)
      if (!configureDataSource(extractor, uri)) return null
      throwIfCancelled(cancellation)
      val audioTrackIndex = selectAudioTrack(extractor, cancellation) ?: return null
      extractor.selectTrack(audioTrackIndex)
      val format = extractor.getTrackFormat(audioTrackIndex)
      val durationMs = readDurationMs(uri, format, cancellation)
        ?.takeIf { it > 0 }
        ?: return null
      val peaks = readDecodedPcmEnvelope(extractor, format, pointCount, durationMs, cancellation)
      throwIfCancelled(cancellation)
      if (peaks.isEmpty()) return null
      mapOf(
        "points" to peaks,
        "durationMs" to durationMs,
        "analysis" to ANALYSIS_VERSION,
      )
    } catch (_: CancellationException) {
      null
    } catch (e: Throwable) {
      Log.d(TAG, "waveform extraction failed ${e.safeLogType()} uri=${uri.safeLogReference()}")
      null
    } finally {
      try { extractor.release() } catch (_: Throwable) {}
    }
  }

  private fun configureDataSource(extractor: MediaExtractor, uri: String): Boolean {
    val ctx = appContext.reactContext ?: return false
    val parsed = Uri.parse(uri)
    return try {
      when {
        parsed.scheme == "content" -> extractor.setDataSource(ctx, parsed, null)
        parsed.scheme == "file" -> extractor.setDataSource(parsed.path ?: return false)
        uri.startsWith("http://") || uri.startsWith("https://") -> return false
        else -> extractor.setDataSource(uri)
      }
      true
    } catch (e: Throwable) {
      Log.d(TAG, "waveform data source unavailable ${e.safeLogType()} uri=${uri.safeLogReference()}")
      false
    }
  }

  private fun selectAudioTrack(extractor: MediaExtractor, cancellation: AtomicBoolean): Int? {
    for (index in 0 until extractor.trackCount) {
      throwIfCancelled(cancellation)
      val format = extractor.getTrackFormat(index)
      val mime = if (format.containsKey(MediaFormat.KEY_MIME)) format.getString(MediaFormat.KEY_MIME) else null
      if (mime?.startsWith("audio/") == true) return index
    }
    return null
  }

  private fun readDurationMs(uri: String, format: MediaFormat, cancellation: AtomicBoolean): Long? {
    throwIfCancelled(cancellation)
    if (format.containsKey(MediaFormat.KEY_DURATION)) {
      val durationUs = format.getLong(MediaFormat.KEY_DURATION).takeIf { it > 0 }
      if (durationUs != null) return durationUs / 1000L
    }
    val ctx = appContext.reactContext ?: return null
    val retriever = MediaMetadataRetriever()
    return try {
      val parsed = Uri.parse(uri)
      when {
        parsed.scheme == "content" -> retriever.setDataSource(ctx, parsed)
        parsed.scheme == "file" -> retriever.setDataSource(parsed.path ?: return null)
        uri.startsWith("http://") || uri.startsWith("https://") -> return null
        else -> retriever.setDataSource(uri)
      }
      throwIfCancelled(cancellation)
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
        ?.toLongOrNull()
        ?.takeIf { it > 0 }
    } catch (cancelled: CancellationException) {
      throw cancelled
    } catch (_: Throwable) {
      null
    } finally {
      try { retriever.release() } catch (_: Throwable) {}
    }
  }

  private fun readDecodedPcmEnvelope(
    extractor: MediaExtractor,
    inputFormat: MediaFormat,
    pointCount: Int,
    durationMs: Long,
    cancellation: AtomicBoolean,
  ): List<Double> {
    if (durationMs > Long.MAX_VALUE / 1000L) return emptyList()
    val durationUs = durationMs * 1000L
    val mime = inputFormat.stringValue(MediaFormat.KEY_MIME) ?: return emptyList()
    return if (mime == MediaFormat.MIMETYPE_AUDIO_RAW) {
      readRawPcmEnvelope(extractor, inputFormat, pointCount, durationUs, cancellation)
    } else {
      decodeCompressedPcmEnvelope(extractor, inputFormat, mime, pointCount, durationUs, cancellation)
    }
  }

  private fun readRawPcmEnvelope(
    extractor: MediaExtractor,
    format: MediaFormat,
    pointCount: Int,
    durationUs: Long,
    cancellation: AtomicBoolean,
  ): List<Double> {
    if (format.intValue(MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
      != AudioFormat.ENCODING_PCM_16BIT) return emptyList()
    val sampleRate = format.intValue(MediaFormat.KEY_SAMPLE_RATE, 0)
    val channelCount = format.intValue(MediaFormat.KEY_CHANNEL_COUNT, 0)
    if (sampleRate <= 0 || channelCount <= 0) return emptyList()
    val envelope = PcmWaveformEnvelope(pointCount, durationUs)
    val buffer = ByteBuffer.allocateDirect(SAMPLE_BUFFER_BYTES).order(ByteOrder.nativeOrder())
    while (true) {
      throwIfCancelled(cancellation)
      val presentationTimeUs = extractor.sampleTime
      if (presentationTimeUs < 0) break
      buffer.clear()
      val size = extractor.readSampleData(buffer, 0)
      if (size <= 0) break
      buffer.position(0)
      buffer.limit(size)
      envelope.addPcm16(buffer, presentationTimeUs, sampleRate, channelCount)
      if (!extractor.advance()) break
    }
    return envelope.normalizedPoints()
  }

  private fun decodeCompressedPcmEnvelope(
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

      while (!outputEnded) {
        throwIfCancelled(cancellation)
        var madeProgress = false
        if (!inputEnded) {
          val inputIndex = codec.dequeueInputBuffer(CODEC_DEQUEUE_TIMEOUT_US)
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

        when (val outputIndex = codec.dequeueOutputBuffer(bufferInfo, CODEC_DEQUEUE_TIMEOUT_US)) {
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

  private fun MediaFormat.stringValue(key: String): String? =
    if (containsKey(key)) getString(key) else null

  private fun MediaFormat.intValue(key: String, fallback: Int): Int =
    if (containsKey(key)) try { getInteger(key) } catch (_: Throwable) { fallback } else fallback

  private fun throwIfCancelled(cancellation: AtomicBoolean) {
    if (cancellation.get()) throw CancellationException("Waveform extraction cancelled")
  }


  private companion object {
    private const val TAG = "SystemAudioWaveform"
    private const val DEFAULT_WAVEFORM_POINTS = 72
    private const val MIN_WAVEFORM_POINTS = 16
    private const val MAX_WAVEFORM_POINTS = 160
    private const val SAMPLE_BUFFER_BYTES = 64 * 1024
    private const val CODEC_DEQUEUE_TIMEOUT_US = 10_000L
    private const val MAX_IDLE_DEQUEUES = 500
    private const val ANALYSIS_VERSION = "decoded-pcm-v1"
  }
}
