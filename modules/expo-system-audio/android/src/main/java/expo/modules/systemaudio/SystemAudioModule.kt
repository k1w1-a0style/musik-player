package expo.modules.systemaudio

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.media.audiofx.Equalizer
import android.net.Uri
import android.util.Base64
import android.util.Log
import androidx.palette.graphics.Palette
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import kotlin.math.roundToInt

/**
 * Bridges Android's Equalizer API and the androidx.palette color extraction
 * to JavaScript.
 *
 * The Equalizer is attached to audioSession=0 (output mix) which affects
 * all audio coming out of the device while the app holds the effect.
 * Requires MODIFY_AUDIO_SETTINGS (auto-granted at install on most devices).
 */
class SystemAudioModule : Module() {
  private var equalizer: Equalizer? = null
  override fun definition() = ModuleDefinition {
    Name("ExpoSystemAudio")

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

    // ---------- Palette / artwork extraction ----------

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

    AsyncFunction("extractEmbeddedArtwork") { uri: String ->
      val bytes = readEmbeddedArtwork(uri) ?: return@AsyncFunction null
      if (bytes.size.toLong() > MAX_EMBEDDED_ARTWORK_BYTES) {
        Log.d(TAG, "embedded artwork too large bytes=${bytes.size} uri=${uri.safeLogUri()}")
        return@AsyncFunction null
      }
      val mimeType = detectImageMime(bytes) ?: run {
        Log.d(TAG, "embedded artwork has unknown mime; bytes=${bytes.size} uri=${uri.safeLogUri()}")
        return@AsyncFunction null
      }
      val fileUri = cacheArtworkBytes(uri, bytes, extensionForMime(mimeType)) ?: return@AsyncFunction null
      Log.d(TAG, "embedded artwork cached bytes=${bytes.size} mime=$mimeType file=${fileUri.safeLogUri()}")
      mapOf(
        "uri" to fileUri,
        "mimeType" to mimeType,
        "byteLength" to bytes.size,
      )
    }

    OnDestroy {
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
            val base64Payload = uri.substring(comma + 1)
            if (decodedBase64ByteLength(base64Payload) > MAX_PALETTE_IMAGE_BYTES) return null
            val bytes = Base64.decode(base64Payload, Base64.DEFAULT)
            val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
          }
        }
        uri.startsWith("http://") || uri.startsWith("https://") -> {
          Log.d(TAG, "remote palette extraction blocked uri=${uri.safeLogUri()}")
          null
        }
        else -> {
          val ctx = appContext.reactContext ?: return null
          val parsed = Uri.parse(uri)
          if (parsed.scheme == "file") {
            val path = parsed.path ?: return null
            val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
            BitmapFactory.decodeFile(path, opts)
          } else {
            ctx.contentResolver.openInputStream(parsed)?.use { stream ->
              val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
              BitmapFactory.decodeStream(stream, null, opts)
            }
          }
        }
      }
    } catch (_: Throwable) {
      null
    }
  }

  private fun readEmbeddedArtwork(uri: String): ByteArray? {
    val ctx = appContext.reactContext ?: return null
    val retriever = MediaMetadataRetriever()
    return try {
      val parsed = Uri.parse(uri)
      when {
        parsed.scheme == "content" -> retriever.setDataSource(ctx, parsed)
        parsed.scheme == "file" -> {
          val path = parsed.path
          if (path.isNullOrBlank()) {
            Log.d(TAG, "file uri has no path: ${uri.safeLogUri()}")
            return null
          }
          retriever.setDataSource(path)
        }
        uri.startsWith("http://") || uri.startsWith("https://") -> {
          Log.d(TAG, "remote embedded artwork extraction blocked uri=${uri.safeLogUri()}")
          return null
        }
        else -> retriever.setDataSource(uri)
      }
      val artwork = retriever.embeddedPicture
      if (artwork == null) Log.d(TAG, "no embedded artwork found uri=${uri.safeLogUri()}")
      else Log.d(TAG, "embedded artwork found bytes=${artwork.size} uri=${uri.safeLogUri()}")
      artwork
    } catch (e: Throwable) {
      Log.d(TAG, "embedded artwork failed ${e.javaClass.simpleName}: ${e.message} uri=${uri.safeLogUri()}")
      null
    } finally {
      try {
        retriever.release()
      } catch (_: Throwable) {}
    }
  }

  private fun cacheArtworkBytes(sourceUri: String, bytes: ByteArray, extension: String): String? {
    if (bytes.size.toLong() > MAX_EMBEDDED_ARTWORK_BYTES) return null
    val ctx = appContext.reactContext ?: return null
    return try {
      val dir = File(ctx.cacheDir, EMBEDDED_ARTWORK_CACHE_DIR)
      if (!dir.exists()) dir.mkdirs()
      val safeName = "${Integer.toHexString(sourceUri.hashCode())}-${Integer.toHexString(bytes.contentHashCode())}.$extension"
      val out = File(dir, safeName)
      if (!out.exists()) out.writeBytes(bytes)
      out.setLastModified(System.currentTimeMillis())
      trimEmbeddedArtworkCache(dir)
      "file://${out.absolutePath}"
    } catch (e: Throwable) {
      Log.d(TAG, "embedded artwork cache failed ${e.javaClass.simpleName}: ${e.message}")
      null
    }
  }

  private fun trimEmbeddedArtworkCache(dir: File) {
    try {
      val files = dir.listFiles()
        ?.filter { it.isFile }
        ?.sortedByDescending { it.lastModified() }
        ?: return
      var totalBytes = 0L
      var keptFiles = 0
      files.forEach { file ->
        val fileSize = file.length()
        val keepFile = keptFiles < MAX_EMBEDDED_ARTWORK_CACHE_FILES &&
          totalBytes + fileSize <= MAX_EMBEDDED_ARTWORK_CACHE_BYTES
        if (keepFile) {
          totalBytes += fileSize
          keptFiles += 1
        } else if (!file.delete()) {
          Log.d(TAG, "embedded artwork cache trim skipped file=${file.absolutePath.safeLogUri()}")
        }
      }
    } catch (e: Throwable) {
      Log.d(TAG, "embedded artwork cache trim failed ${e.javaClass.simpleName}: ${e.message}")
    }
  }

  private fun detectImageMime(bytes: ByteArray): String? {
    if (bytes.size >= 3 && bytes[0] == 0xff.toByte() && bytes[1] == 0xd8.toByte() && bytes[2] == 0xff.toByte())
      return "image/jpeg"
    if (
      bytes.size >= 8 &&
      bytes[0] == 0x89.toByte() && bytes[1] == 0x50.toByte() && bytes[2] == 0x4e.toByte() && bytes[3] == 0x47.toByte() &&
      bytes[4] == 0x0d.toByte() && bytes[5] == 0x0a.toByte() && bytes[6] == 0x1a.toByte() && bytes[7] == 0x0a.toByte()
    ) return "image/png"
    if (
      bytes.size >= 12 &&
      bytes[0] == 0x52.toByte() && bytes[1] == 0x49.toByte() && bytes[2] == 0x46.toByte() && bytes[3] == 0x46.toByte() &&
      bytes[8] == 0x57.toByte() && bytes[9] == 0x45.toByte() && bytes[10] == 0x42.toByte() && bytes[11] == 0x50.toByte()
    ) return "image/webp"
    return null
  }

  private fun extensionForMime(mimeType: String): String = when (mimeType) {
    "image/png" -> "png"
    "image/webp" -> "webp"
    else -> "jpg"
  }

  private fun decodedBase64ByteLength(value: String): Long {
    var cleanLength = 0L
    var last = '\u0000'
    var secondLast = '\u0000'
    value.forEach { char ->
      if (!char.isWhitespace()) {
        secondLast = last
        last = char
        cleanLength += 1
      }
    }
    val padding = when {
      cleanLength >= 2 && secondLast == '=' && last == '=' -> 2L
      cleanLength >= 1 && last == '=' -> 1L
      else -> 0L
    }
    return (cleanLength * 3L / 4L) - padding
  }

  private fun String.safeLogUri(): String = if (length <= 140) this else take(140) + "…"

  @Suppress("unused")
  private fun normalize01(v: Double): Double = v.coerceIn(0.0, 1.0)

  @Suppress("unused")
  private fun toIntPercent(v: Double): Int = (v * 100).roundToInt()

  private companion object {
    private const val TAG = "SystemAudio"
    private const val EMBEDDED_ARTWORK_CACHE_DIR = "embedded-artwork"
    private const val MAX_EMBEDDED_ARTWORK_CACHE_FILES = 200
    private const val MAX_EMBEDDED_ARTWORK_CACHE_BYTES = 25L * 1024L * 1024L
    private const val MAX_EMBEDDED_ARTWORK_BYTES = 2L * 1024L * 1024L
    private const val MAX_PALETTE_IMAGE_BYTES = 2L * 1024L * 1024L
  }
}
