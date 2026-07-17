package expo.modules.systemaudio.saf

import java.io.File
import java.io.FileOutputStream

fun staticRewriteSource(
  bytes: ByteArray,
  changed: Boolean = true,
): AudioTagRewriteSource = object : AudioTagRewriteSource {
  override fun estimatedOutputSizeUpperBound(originalSize: Long, maxBytes: Long): Long =
    bytes.size.toLong().coerceAtMost(maxBytes)

  override fun rewrite(original: File, temporary: File, maxBytes: Long): AudioTagRewriteResult {
    if (bytes.size.toLong() > maxBytes) throw SizeLimitException()
    FileOutputStream(temporary).use { output ->
      output.write(bytes)
      output.flush()
      output.fd.sync()
    }
    return AudioTagRewriteResult(changed, StreamDigests.hashFile(temporary, maxBytes))
  }
}

fun failingRewriteSource(
  errorCode: String,
  message: String,
): AudioTagRewriteSource = object : AudioTagRewriteSource {
  override fun rewrite(original: File, temporary: File, maxBytes: Long): AudioTagRewriteResult {
    throw AudioTagRewriteException(errorCode, message)
  }
}
