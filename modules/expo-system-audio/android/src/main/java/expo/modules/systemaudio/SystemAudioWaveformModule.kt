package expo.modules.systemaudio

import android.media.AudioFormat
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Process
import android.os.SystemClock
import android.util.Log
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.CancellationException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.Executors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

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

  fun cancelAll() { requests.values.forEach { it.set(true) } }
}

/** Decodes the selected audio track to PCM before calculating its envelope. */
class SystemAudioWaveformModule : Module() {
  private val cancellationRegistry = WaveformCancellationRegistry()
  // Decode away from Expo's shared module queue and below playback priority.
  // One worker also bounds native CPU use when obsolete JS waiters detach.
  private val dispatcher = Executors.newSingleThreadExecutor { task ->
    Thread({
      Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
      task.run()
    }, "waveform-analysis").apply { isDaemon = true }
  }.asCoroutineDispatcher()
  private val analysisScope = CoroutineScope(SupervisorJob() + dispatcher)

  override fun definition() = ModuleDefinition {
    Name("ExpoSystemAudioWaveform")
    Constants("supportsWaveformProgress" to true)
    Events("onWaveformProgress")

    AsyncFunction("extractWaveformPeaks") { uri: String, requestedPoints: Int?, requestId: String?, promise: Promise ->
      val cancellation = cancellationRegistry.register(requestId)
      // Register before dispatch, so queued obsolete work can be cancelled too.
      analysisScope.launch {
        try {
          promise.resolve(extractWaveformPeaks(uri, requestedPoints ?: DEFAULT_WAVEFORM_POINTS, cancellation, requestId))
        } finally {
          cancellationRegistry.complete(requestId, cancellation)
        }
      }
    }

    OnDestroy {
      cancellationRegistry.cancelAll()
      analysisScope.cancel()
      dispatcher.close()
    }

    Function("cancelWaveformExtraction") { requestId: String ->
      cancellationRegistry.cancel(requestId)
    }
  }

  private fun extractWaveformPeaks(
    uri: String,
    requestedPoints: Int,
    cancellation: AtomicBoolean,
    requestId: String?,
  ): Map<String, Any?>? {
    val pointCount = requestedPoints.coerceIn(MIN_WAVEFORM_POINTS, MAX_WAVEFORM_POINTS)
    val extractor = MediaExtractor()
    val startedAt = SystemClock.elapsedRealtime()
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
      val progress = WaveformProgressReporter(durationMs * 1000L) { ratio ->
        if (!cancellation.get() && !requestId.isNullOrBlank()) {
          sendEvent("onWaveformProgress", mapOf("requestId" to requestId, "progress" to ratio))
        }
      }
      val peaks = readDecodedPcmEnvelope(extractor, format, pointCount, durationMs, cancellation) { positionUs ->
        progress.update(positionUs, SystemClock.elapsedRealtime())
      }
      throwIfCancelled(cancellation)
      if (peaks.isEmpty()) return null
      progress.complete()
      mapOf(
        "points" to peaks,
        "durationMs" to durationMs,
        "analysis" to ANALYSIS_VERSION,
        "analysisDurationMs" to (SystemClock.elapsedRealtime() - startedAt),
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
    onProgress: (Long) -> Unit,
  ): List<Double> {
    if (durationMs > Long.MAX_VALUE / 1000L) return emptyList()
    val durationUs = durationMs * 1000L
    val mime = inputFormat.stringValue(MediaFormat.KEY_MIME) ?: return emptyList()
    return if (mime == MediaFormat.MIMETYPE_AUDIO_RAW) {
      readRawPcmEnvelope(extractor, inputFormat, pointCount, durationUs, cancellation, onProgress)
    } else {
      CallbackPcmWaveformDecoder.decode(extractor, inputFormat, mime, pointCount, durationUs, cancellation, onProgress)
    }
  }

  private fun readRawPcmEnvelope(
    extractor: MediaExtractor,
    format: MediaFormat,
    pointCount: Int,
    durationUs: Long,
    cancellation: AtomicBoolean,
    onProgress: (Long) -> Unit,
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
      onProgress(presentationTimeUs)
      if (!extractor.advance()) break
    }
    return envelope.normalizedPoints()
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
    private const val DEFAULT_WAVEFORM_POINTS = 1024
    private const val MIN_WAVEFORM_POINTS = 16
    private const val MAX_WAVEFORM_POINTS = 1024
    private const val SAMPLE_BUFFER_BYTES = 64 * 1024
    private const val ANALYSIS_VERSION = "decoded-pcm-v1"
  }
}
