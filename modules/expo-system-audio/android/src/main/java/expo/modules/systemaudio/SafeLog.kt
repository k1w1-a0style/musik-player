package expo.modules.systemaudio

import java.security.MessageDigest

private val SAFE_LOG_SCHEME = Regex("^([A-Za-z][A-Za-z0-9+.-]*):")
private const val SAFE_LOG_HASH_BYTES = 6

/**
 * Produces a stable diagnostic reference without exposing authorities, paths,
 * document IDs, filenames, query strings or fragments.
 */
internal fun String.safeLogReference(): String {
  val value = trim()
  val scheme = SAFE_LOG_SCHEME.find(value)?.groupValues?.get(1)?.lowercase() ?: "none"
  val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
  val reference = digest.take(SAFE_LOG_HASH_BYTES)
    .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
  return "scheme=$scheme ref=$reference"
}

/** Exception messages are intentionally omitted because providers may embed paths. */
internal fun Throwable.safeLogType(): String =
  javaClass.simpleName.takeIf { it.isNotBlank() } ?: "Throwable"
