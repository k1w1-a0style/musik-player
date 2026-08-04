package expo.modules.systemaudio

import android.graphics.Bitmap

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

/** Always releases decoded palette bitmaps, including when Palette generation throws. */
internal inline fun <T> withBitmapRecycled(bitmap: Bitmap, operation: (Bitmap) -> T): T =
  try {
    operation(bitmap)
  } finally {
    if (!bitmap.isRecycled) bitmap.recycle()
  }
