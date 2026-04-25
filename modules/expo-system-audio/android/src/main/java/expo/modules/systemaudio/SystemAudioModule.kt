package expo.modules.systemaudio

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.audiofx.Equalizer
import android.media.audiofx.Visualizer
import android.net.Uri
import android.util.Base64
import androidx.core.content.ContextCompat
import androidx.palette.graphics.Palette
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.InputStream
import java.net.URL
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Bridges Android's AudioEffect APIs (Equalizer + Visualizer) and the
 * androidx.palette color extraction to JavaScript.
 *
 * The Equalizer is attached to audioSession=0 (output mix) which affects
 * all audio coming out of the device while the app holds the effect.
 * Requires MODIFY_AUDIO_SETTINGS (auto-granted at install on most devices).
 *
 * The Visualizer also attaches to audioSession=0 and requires RECORD_AUDIO
 * at runtime on Android 9+ — the JS side asks the user, this module
 * simply reports back whether it could start.
 */
class SystemAudioModule : Module() {
  private var equalizer: Equalizer? = null
  private var visualizer: Visualizer? = null
  private var fftBins: Int = 16

  override fun definition() = ModuleDefinition {
    Name("ExpoSystemAudio")

    Events("onFftData", "onVisualizerStateChanged")

    // ---------- Equalizer ----------

    AsyncFunction("eqInit") {
      ensureEqualizer()
      val eq = equalizer ?: return@AsyncFunction null
      val range = eq.bandLevelRange
      val bands = (0 until eq.numberOfBands).map { i ->
        val freq = try { eq.getCenterFreq(i.toShort()) } catch (_: Throwable) { 0 }
        mapOf(
          "index" to i,
          "centerFreqHz" to freq / 1000, // millihertz → Hz
        )
      }
      mapOf(
        "available" to true,
        "enabled" to eq.enabled,
        "bands" to bands,
        "minMillibel" to range[0].toInt(),
        "maxMillibel" to range[1].toInt(),
      )
    }

    Function("eqSetEnabled") { enabled: Boolean ->
      ensureEqualizer()
      equalizer?.enabled = enabled
      enabled
    }

    Function("eqSetBandLevel") { band: Int, millibel: Int ->
      ensureEqualizer()
      val eq = equalizer ?: return@Function false
      try {
        val clamped = millibel.coerceIn(eq.bandLevelRange[0].toInt(), eq.bandLevelRange[1].toInt())
        eq.setBandLevel(band.toShort(), clamped.toShort())
        true
      } catch (_: Throwable) {
        false
      }
    }

    Function("eqRelease") {
      releaseEqualizer()
    }

    // ---------- Visualizer ----------

    AsyncFunction("visualizerStart") { bins: Int ->
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      val granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) ==
        PackageManager.PERMISSION_GRANTED
      if (!granted) {
        sendEvent("onVisualizerStateChanged", mapOf("running" to false, "reason" to "no_permission"))
        return@AsyncFunction false
      }
      try {
        releaseVisualizer()
        fftBins = bins.coerceIn(8, 128)
        val v = Visualizer(0)
        val sizeRange = Visualizer.getCaptureSizeRange()
        v.captureSize = sizeRange[1].coerceAtMost(1024)
        v.scalingMode = Visualizer.SCALING_MODE_NORMALIZED
        v.setDataCaptureListener(
          object : Visualizer.OnDataCaptureListener {
            override fun onWaveFormDataCapture(
              v: Visualizer?,
              waveform: ByteArray?,
              samplingRate: Int,
            ) {}

            override fun onFftDataCapture(
              v: Visualizer?,
              fft: ByteArray?,
              samplingRate: Int,
            ) {
              val data = fft ?: return
              // Compute magnitude per FFT bin, then group into `fftBins`.
              val halfSize = data.size / 2
              val mags = DoubleArray(halfSize)
              for (i in 0 until halfSize) {
                val real = data[2 * i].toInt()
                val imag = data[2 * i + 1].toInt()
                mags[i] = sqrt((real * real + imag * imag).toDouble())
              }
              // Group logarithmically for nicer visual distribution
              val out = DoubleArray(fftBins)
              if (halfSize > 0) {
                val logMin = 0.0
                val logMax = kotlin.math.ln(halfSize.toDouble())
                for (b in 0 until fftBins) {
                  val lo = kotlin.math.exp(logMin + (logMax - logMin) * b / fftBins)
                    .toInt().coerceIn(0, halfSize - 1)
                  val hi = kotlin.math.exp(logMin + (logMax - logMin) * (b + 1) / fftBins)
                    .toInt().coerceAtLeast(lo + 1).coerceAtMost(halfSize)
                  var sum = 0.0
                  var n = 0
                  for (i in lo until hi) {
                    sum += mags[i]; n += 1
                  }
                  out[b] = if (n > 0) sum / n else 0.0
                }
              }
              // Normalize to 0..1 (typical max ~140)
              val normalized = out.map { (it / 140.0).coerceIn(0.0, 1.0) }
              sendEvent("onFftData", mapOf("data" to normalized))
            }
          },
          Visualizer.getMaxCaptureRate() / 2,
          false,
          true, // FFT only
        )
        v.enabled = true
        visualizer = v
        sendEvent("onVisualizerStateChanged", mapOf("running" to true, "reason" to "ok"))
        true
      } catch (e: Throwable) {
        sendEvent("onVisualizerStateChanged", mapOf("running" to false, "reason" to (e.message ?: "error")))
        false
      }
    }

    Function("visualizerStop") {
      releaseVisualizer()
    }

    // ---------- Palette extraction ----------

    AsyncFunction("extractPalette") { uri: String ->
      val bitmap = loadBitmap(uri) ?: return@AsyncFunction null
      val palette = Palette.from(bitmap).generate()
      bitmap.recycle()
      val result = mutableMapOf<String, Any?>()
      result["dominant"] = palette.dominantSwatch?.rgb?.let(::hex)
      result["vibrant"] = palette.vibrantSwatch?.rgb?.let(::hex)
      result["lightVibrant"] = palette.lightVibrantSwatch?.rgb?.let(::hex)
      result["darkVibrant"] = palette.darkVibrantSwatch?.rgb?.let(::hex)
      result["muted"] = palette.mutedSwatch?.rgb?.let(::hex)
      result["lightMuted"] = palette.lightMutedSwatch?.rgb?.let(::hex)
      result["darkMuted"] = palette.darkMutedSwatch?.rgb?.let(::hex)
      result
    }

    OnDestroy {
      releaseVisualizer()
      releaseEqualizer()
    }
  }

  private fun ensureEqualizer() {
    if (equalizer == null) {
      try {
        equalizer = Equalizer(0, 0).apply { enabled = true }
      } catch (_: Throwable) {
        equalizer = null
      }
    }
  }

  private fun releaseEqualizer() {
    try {
      equalizer?.enabled = false
      equalizer?.release()
    } catch (_: Throwable) {}
    equalizer = null
  }

  private fun releaseVisualizer() {
    try {
      visualizer?.enabled = false
      visualizer?.release()
    } catch (_: Throwable) {}
    visualizer = null
    sendEvent("onVisualizerStateChanged", mapOf("running" to false, "reason" to "stopped"))
  }

  private fun hex(rgb: Int): String {
    val r = (rgb shr 16) and 0xff
    val g = (rgb shr 8) and 0xff
    val b = rgb and 0xff
    return String.format("#%02X%02X%02X", r, g, b)
  }

  private fun loadBitmap(uri: String): Bitmap? {
    return try {
      when {
        uri.startsWith("data:") -> {
          val comma = uri.indexOf(',')
          if (comma < 0) null
          else {
            val bytes = Base64.decode(uri.substring(comma + 1), Base64.DEFAULT)
            val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
          }
        }
        uri.startsWith("http") -> {
          val stream: InputStream = URL(uri).openStream()
          stream.use {
            val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
            BitmapFactory.decodeStream(it, null, opts)
          }
        }
        else -> {
          val ctx = appContext.reactContext ?: return null
          val parsed = Uri.parse(uri)
          ctx.contentResolver.openInputStream(parsed)?.use { stream ->
            val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
            BitmapFactory.decodeStream(stream, null, opts)
          }
        }
      }
    } catch (_: Throwable) {
      null
    }
  }

  @Suppress("unused")
  private fun normalize01(v: Double): Double = v.coerceIn(0.0, 1.0)

  @Suppress("unused")
  private fun toIntPercent(v: Double): Int = (v * 100).roundToInt()
}
