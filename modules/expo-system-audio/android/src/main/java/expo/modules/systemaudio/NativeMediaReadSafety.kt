package expo.modules.systemaudio

import android.graphics.Bitmap

/** Power-of-two BitmapFactory sampling with a ceiling bound for odd image sizes. */
internal fun calculatePaletteSampleSize(width: Int, height: Int, maxPixels: Int): Int {
  if (width <= 0 || height <= 0 || maxPixels <= 0) return 1
  var sampleSize = 1
  fun sampledPixels(): Long {
    val sampledWidth = (width.toLong() + sampleSize - 1L) / sampleSize
    val sampledHeight = (height.toLong() + sampleSize - 1L) / sampleSize
    return sampledWidth * sampledHeight
  }
  while (sampledPixels() > maxPixels) {
    if (sampleSize > Int.MAX_VALUE / 2) return sampleSize
    sampleSize *= 2
  }
  return sampleSize
}

/** Reads one optional metadata field without letting an OEM decoder defect erase sibling fields. */
internal fun readNonBlankMetadata(reader: () -> String?): String? =
  try {
    reader()?.takeIf { it.isNotBlank() }
  } catch (_: Throwable) {
    null
  }

/** Reads one positive numeric metadata field independently from every other field. */
internal fun readPositiveLongMetadata(reader: () -> String?): Long? =
  try {
    reader()?.toLongOrNull()?.takeIf { it > 0L }
  } catch (_: Throwable) {
    null
  }

/** Runs an operation and releases its resource on success and failure. */
internal inline fun <T, R> withResourceReleased(
  resource: T,
  release: (T) -> Unit,
  operation: (T) -> R,
): R =
  try {
    operation(resource)
  } finally {
    release(resource)
  }

/** Always releases decoded palette bitmaps, including when Palette generation throws. */
internal inline fun <T> withBitmapRecycled(bitmap: Bitmap, operation: (Bitmap) -> T): T =
  withResourceReleased(
    resource = bitmap,
    release = { source -> if (!source.isRecycled) source.recycle() },
    operation = operation,
  )
