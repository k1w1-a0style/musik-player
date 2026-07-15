package expo.modules.systemaudio.saf

import android.net.Uri
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream

/**
 * Recognizes live SAF bytes that can be explained by an interrupted write of
 * rewritten.bin over original.bin without accepting arbitrary third-party edits.
 *
 * Supported interrupted shapes:
 * - provider truncates first and only a strict prefix of rewritten.bin survives;
 * - provider overwrites a prefix but leaves the untouched original suffix.
 *
 * Exact original and exact rewritten matches are handled by the transaction
 * manager before this classifier is called.
 */
object InterruptedSafWriteClassifier {
  fun matches(
    store: SafContentStore,
    uri: Uri,
    original: File,
    rewritten: File,
    maxBytes: Long,
  ): Boolean {
    if (!original.isFile || !rewritten.isFile || rewritten.length() <= 0L) return false

    return try {
      val liveInput = store.openInput(uri) ?: return false
      BufferedInputStream(liveInput).use { live ->
        BufferedInputStream(FileInputStream(original)).use { originalInput ->
          BufferedInputStream(FileInputStream(rewritten)).use { rewrittenInput ->
            matchesStreams(live, originalInput, rewrittenInput, maxBytes)
          }
        }
      }
    } catch (_: Throwable) {
      false
    }
  }

  private fun matchesStreams(
    live: BufferedInputStream,
    original: BufferedInputStream,
    rewritten: BufferedInputStream,
    maxBytes: Long,
  ): Boolean {
    var liveBytes = 0L

    // A prefix candidate means every live byte seen so far is explained by the
    // corresponding rewritten byte. A suffix candidate means there is some
    // transition point after at least one rewritten mutation where all later
    // bytes equal the original file.
    var prefixPossible = true
    var prefixContainsMutation = false
    var originalSuffixPossible = false
    var suffixContainsMutation = false

    while (true) {
      val liveByte = live.read()
      if (liveByte < 0) break

      liveBytes += 1
      if (liveBytes > maxBytes) return false

      val originalByte = original.read()
      val rewrittenByte = rewritten.read()

      val oldPrefixPossible = prefixPossible
      val oldPrefixContainsMutation = prefixContainsMutation
      val oldSuffixPossible = originalSuffixPossible
      val oldSuffixContainsMutation = suffixContainsMutation

      prefixPossible = oldPrefixPossible && rewrittenByte >= 0 && liveByte == rewrittenByte
      prefixContainsMutation = prefixPossible && (
        oldPrefixContainsMutation || originalByte < 0 || liveByte != originalByte
      )

      val transitionToOriginalSuffix =
        oldPrefixPossible && originalByte >= 0 && liveByte == originalByte
      val continueOriginalSuffix =
        oldSuffixPossible && originalByte >= 0 && liveByte == originalByte

      originalSuffixPossible = transitionToOriginalSuffix || continueOriginalSuffix
      suffixContainsMutation =
        (transitionToOriginalSuffix && oldPrefixContainsMutation) ||
          (continueOriginalSuffix && oldSuffixContainsMutation)

      if (!prefixPossible && !originalSuffixPossible) return false
    }

    val originalHasMore = original.read() >= 0
    val rewrittenHasMore = rewritten.read() >= 0

    // Any strict prefix of the staged rewrite is attributable to a provider
    // that truncated the target and crashed before the remaining bytes were
    // written. This includes a prefix that happens to be shared with the
    // original before the first changed byte.
    val truncatedRewrittenPrefix = prefixPossible && rewrittenHasMore

    val rewrittenPrefixWithOriginalTail =
      originalSuffixPossible && suffixContainsMutation && !originalHasMore

    return truncatedRewrittenPrefix || rewrittenPrefixWithOriginalTail
  }
}
