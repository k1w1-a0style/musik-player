package expo.modules.systemaudio

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import kotlin.math.max
import kotlin.math.roundToInt

/** Disposable display variants; the source artwork is never modified. */
internal class ArtworkThumbnailCache(
  private val directory: File,
  private val atomicReplace: (File, File) -> Unit,
  private val now: () -> Long = System::currentTimeMillis,
  private val maxFiles: Int = 256,
  private val maxBytes: Long = 32L * 1024L * 1024L,
) {
  private var lastTrim = Long.MIN_VALUE

  fun get(source: File, requestedSize: Int, revision: String): File? = synchronized(lock) {
    if (!source.isFile || source.length() !in 1..MAX_SOURCE_BYTES) return@synchronized null
    val size = requestedSize.coerceIn(32, 512)
    val sourceStamp = "${source.canonicalPath}|${source.length()}|${source.lastModified()}|$revision"
    val key = MessageDigest.getInstance("SHA-256").digest("v1|$size|$sourceStamp".toByteArray())
      .joinToString("") { "%02x".format(it.toInt() and 0xff) }
    if (!directory.isDirectory && !directory.mkdirs()) return@synchronized null
    val destination = File(directory, "$key.png")
    if (!validThumbnail(destination, size)) {
      val thumbnail = decodeThumbnail(source, size) ?: return@synchronized null
      var temporary: File? = null
      try {
        temporary = File.createTempFile(".thumbnail-", ".tmp", directory)
        FileOutputStream(temporary).use { stream ->
          check(thumbnail.compress(Bitmap.CompressFormat.PNG, 100, stream))
          stream.fd.sync()
        }
        // Do not publish a variant from a source replaced during decoding.
        val currentStamp = "${source.canonicalPath}|${source.length()}|${source.lastModified()}|$revision"
        if (sourceStamp != currentStamp || !validThumbnail(temporary, size)) return@synchronized null
        atomicReplace(temporary, destination)
      } finally {
        thumbnail.recycle()
        temporary?.delete()
      }
    }
    val accessTime = now()
    destination.setLastModified(accessTime)
    if (lastTrim == Long.MIN_VALUE || accessTime - lastTrim >= 30_000L) {
      lastTrim = accessTime
      trim(destination, accessTime)
    }
    destination
  }

  private fun decodeThumbnail(source: File, size: Int): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(source.absolutePath, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    // Bound the intermediate bitmap as well as the published image.
    while (max(bounds.outWidth, bounds.outHeight).toLong() / sample > size * 2L) sample *= 2
    val decoded = BitmapFactory.decodeFile(source.absolutePath,
      BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
    val ratio = minOf(1.0, size.toDouble() / max(decoded.width, decoded.height))
    val width = max(1, (decoded.width * ratio).roundToInt())
    val height = max(1, (decoded.height * ratio).roundToInt())
    if (width == decoded.width && height == decoded.height) return decoded
    return try { Bitmap.createScaledBitmap(decoded, width, height, true) }
    finally { decoded.recycle() }
  }

  private fun validThumbnail(file: File, size: Int): Boolean {
    if (!file.isFile || file.length() !in 1..MAX_THUMBNAIL_BYTES) return false
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.absolutePath, bounds)
    return bounds.outWidth in 1..size && bounds.outHeight in 1..size
  }

  private fun trim(returned: File, accessTime: Long) {
    val entries = directory.listFiles()?.filter { it.isFile } ?: return
    entries.filter { it.name.startsWith(".thumbnail-") && accessTime - it.lastModified() > 60_000L }
      .forEach { it.delete() }
    val images = entries.filter { NAME.matches(it.name) }.sortedByDescending { it.lastModified() }
    val protected = images.filter { it == returned || accessTime - it.lastModified() <= 60_000L }.toSet()
    var count = protected.size
    var bytes = protected.sumOf { it.length() }
    images.filterNot { it in protected }.forEach {
      if (count < maxFiles && bytes + it.length() <= maxBytes) {
        count += 1
        bytes += it.length()
      } else it.delete()
    }
  }

  companion object {
    private val lock = Any()
    private val NAME = Regex("[0-9a-f]{64}\\.png")
    private const val MAX_SOURCE_BYTES = 2L * 1024L * 1024L
    private const val MAX_THUMBNAIL_BYTES = 2L * 1024L * 1024L
  }
}
