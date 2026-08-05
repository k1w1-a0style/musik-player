package expo.modules.systemaudio

import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.util.concurrent.CancellationException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max
import kotlin.math.min

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

/**
 * Lightweight native waveform extraction.
 *
 * This intentionally runs outside render/UI code. It samples the audio track via
 * MediaExtractor and returns a normalized envelope that JS can cache. For
 * compressed formats this is a pragmatic seekbar envelope, not a studio-grade
 * decoded PCM waveform, but it is fast and safe for large libraries.
 */
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
      val peaks = readSampleEnvelope(extractor, pointCount, cancellation)
      throwIfCancelled(cancellation)
      if (peaks.isEmpty()) return null
      mapOf(
        "points" to normalize(peaks),
        "durationMs" to durationMs,
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

  private fun readSampleEnvelope(
    extractor: MediaExtractor,
    pointCount: Int,
    cancellation: AtomicBoolean,
  ): DoubleArray {
    val peaks = DoubleArray(pointCount)
    val buffer = ByteBuffer.allocateDirect(SAMPLE_BUFFER_BYTES)
    var sampleIndex = 0
    while (sampleIndex < MAX_SAMPLES_TO_READ) {
      throwIfCancelled(cancellation)
      buffer.clear()
      val sampleSize = extractor.readSampleData(buffer, 0)
      if (sampleSize <= 0) break
      val bucket = min(pointCount - 1, (sampleIndex.toLong() * pointCount / MAX_SAMPLES_TO_READ).toInt())
      peaks[bucket] = max(peaks[bucket], sampleSize.toDouble())
      sampleIndex += 1
      if (!extractor.advance()) break
    }
    return peaks
  }

  private fun normalize(peaks: DoubleArray): List<Double> {
    val maxPeak = peaks.maxOrNull()?.takeIf { it > 0.0 } ?: return emptyList()
    return peaks.map { peak ->
      val normalized = (peak / maxPeak).coerceIn(0.04, 1.0)
      // Slight floor keeps silent-looking compressed sections visible.
      max(0.08, normalized)
    }
  }

  private fun throwIfCancelled(cancellation: AtomicBoolean) {
    if (cancellation.get()) throw CancellationException("Waveform extraction cancelled")
  }


  private companion object {
    private const val TAG = "SystemAudioWaveform"
    private const val DEFAULT_WAVEFORM_POINTS = 72
    private const val MIN_WAVEFORM_POINTS = 16
    private const val MAX_WAVEFORM_POINTS = 160
    private const val SAMPLE_BUFFER_BYTES = 64 * 1024
    private const val MAX_SAMPLES_TO_READ = 2400
  }
}
