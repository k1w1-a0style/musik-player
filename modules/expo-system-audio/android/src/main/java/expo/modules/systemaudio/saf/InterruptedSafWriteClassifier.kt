package expo.modules.systemaudio.saf

import android.net.Uri
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream

/**
 * Recognizes live SAF bytes that can be explained by an interrupted transaction
 * write without accepting arbitrary third-party edits.
 *
 * Supported forward-write shapes:
 * - a strict prefix of rewritten.bin after truncate-before-write;
 * - a rewritten prefix followed by the untouched original suffix.
 *
 * Supported rollback-write shapes:
 * - a strict prefix of original.bin after truncate-before-restore;
 * - an original prefix followed by the still-present rewritten suffix.
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

    var forwardPrefixPossible = true
    var forwardPrefixContainsMutation = false
    var forwardOriginalSuffixPossible = false
    var forwardSuffixContainsMutation = false

    var rollbackPrefixPossible = true
    var rollbackPrefixContainsMutation = false
    var rollbackRewrittenSuffixPossible = false
    var rollbackSuffixContainsMutation = false

    while (true) {
      val liveByte = live.read()
      if (liveByte < 0) break

      liveBytes += 1
      if (liveBytes > maxBytes) return false

      val originalByte = original.read()
      val rewrittenByte = rewritten.read()

      val oldForwardPrefixPossible = forwardPrefixPossible
      val oldForwardPrefixContainsMutation = forwardPrefixContainsMutation
      val oldForwardSuffixPossible = forwardOriginalSuffixPossible
      val oldForwardSuffixContainsMutation = forwardSuffixContainsMutation

      forwardPrefixPossible =
        oldForwardPrefixPossible && rewrittenByte >= 0 && liveByte == rewrittenByte
      forwardPrefixContainsMutation = forwardPrefixPossible && (
        oldForwardPrefixContainsMutation || originalByte < 0 || liveByte != originalByte
      )

      val transitionToOriginalSuffix =
        oldForwardPrefixPossible && originalByte >= 0 && liveByte == originalByte
      val continueOriginalSuffix =
        oldForwardSuffixPossible && originalByte >= 0 && liveByte == originalByte

      forwardOriginalSuffixPossible = transitionToOriginalSuffix || continueOriginalSuffix
      forwardSuffixContainsMutation =
        (transitionToOriginalSuffix && oldForwardPrefixContainsMutation) ||
          (continueOriginalSuffix && oldForwardSuffixContainsMutation)

      val oldRollbackPrefixPossible = rollbackPrefixPossible
      val oldRollbackPrefixContainsMutation = rollbackPrefixContainsMutation
      val oldRollbackSuffixPossible = rollbackRewrittenSuffixPossible
      val oldRollbackSuffixContainsMutation = rollbackSuffixContainsMutation

      rollbackPrefixPossible =
        oldRollbackPrefixPossible && originalByte >= 0 && liveByte == originalByte
      rollbackPrefixContainsMutation = rollbackPrefixPossible && (
        oldRollbackPrefixContainsMutation || rewrittenByte < 0 || liveByte != rewrittenByte
      )

      val transitionToRewrittenSuffix =
        oldRollbackPrefixPossible && rewrittenByte >= 0 && liveByte == rewrittenByte
      val continueRewrittenSuffix =
        oldRollbackSuffixPossible && rewrittenByte >= 0 && liveByte == rewrittenByte

      rollbackRewrittenSuffixPossible = transitionToRewrittenSuffix || continueRewrittenSuffix
      rollbackSuffixContainsMutation =
        (transitionToRewrittenSuffix && oldRollbackPrefixContainsMutation) ||
          (continueRewrittenSuffix && oldRollbackSuffixContainsMutation)

      if (
        !forwardPrefixPossible &&
        !forwardOriginalSuffixPossible &&
        !rollbackPrefixPossible &&
        !rollbackRewrittenSuffixPossible
      ) return false
    }

    val originalHasMore = original.read() >= 0
    val rewrittenHasMore = rewritten.read() >= 0

    val truncatedForwardWrite = forwardPrefixPossible && rewrittenHasMore
    val forwardPrefixWithOriginalTail =
      forwardOriginalSuffixPossible && forwardSuffixContainsMutation && !originalHasMore

    val truncatedRollbackWrite = rollbackPrefixPossible && originalHasMore
    val rollbackPrefixWithRewrittenTail =
      rollbackRewrittenSuffixPossible && rollbackSuffixContainsMutation && !rewrittenHasMore

    return truncatedForwardWrite ||
      forwardPrefixWithOriginalTail ||
      truncatedRollbackWrite ||
      rollbackPrefixWithRewrittenTail
  }
}
