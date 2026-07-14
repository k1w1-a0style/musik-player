package expo.modules.systemaudio.saf

/**
 * Conservative, provider-aware helpers for SAF persisted permission decisions.
 *
 * Document IDs are provider-defined identifiers. This policy only falls back to
 * path-like descendant checks for Android's ExternalStorageProvider, whose IDs
 * are documented by platform behavior as "volume:path". Other providers must
 * be accepted by framework/provider APIs before a tree grant covers a child.
 */
object SafPermissionPolicy {
  const val EXTERNAL_STORAGE_DOCUMENTS_AUTHORITY = "com.android.externalstorage.documents"

  enum class PersistedGrantKind { DOCUMENT, TREE, UNKNOWN }

  enum class ProviderChildDecision { CHILD, NOT_CHILD, UNAVAILABLE }

  fun isPersistedGrantCovered(
    grantKind: PersistedGrantKind,
    hasWritePermission: Boolean,
    grantAuthority: String?,
    grantDocumentId: String?,
    targetAuthority: String?,
    targetDocumentId: String?,
    providerChildDecision: ProviderChildDecision = ProviderChildDecision.UNAVAILABLE,
  ): Boolean {
    if (!hasWritePermission) return false
    if (grantAuthority == null || grantAuthority != targetAuthority) return false
    return when (grantKind) {
      PersistedGrantKind.DOCUMENT -> grantDocumentId != null && grantDocumentId == targetDocumentId
      PersistedGrantKind.TREE -> when (providerChildDecision) {
        ProviderChildDecision.CHILD -> true
        ProviderChildDecision.NOT_CHILD -> false
        ProviderChildDecision.UNAVAILABLE -> fallbackCoversDocumentId(
          grantAuthority,
          grantDocumentId,
          targetAuthority,
          targetDocumentId,
        )
      }
      PersistedGrantKind.UNKNOWN -> false
    }
  }

  fun isDocumentWritableFromFlags(flags: Int?, supportsWriteFlag: Int): Boolean =
    flags != null && (flags and supportsWriteFlag) != 0

  fun isExternalStorageDocumentIdDescendant(treeDocumentId: String?, targetDocumentId: String?): Boolean {
    val tree = parseExternalStorageDocumentId(treeDocumentId) ?: return false
    val target = parseExternalStorageDocumentId(targetDocumentId) ?: return false
    if (tree.volumeId != target.volumeId) return false
    if (tree.path.isEmpty()) return true
    return target.path == tree.path || target.path.startsWith("${tree.path}/")
  }

  fun fallbackCoversDocumentId(
    authority: String?,
    treeDocumentId: String?,
    targetAuthority: String?,
    targetDocumentId: String?,
  ): Boolean {
    if (authority != EXTERNAL_STORAGE_DOCUMENTS_AUTHORITY) return false
    if (targetAuthority != EXTERNAL_STORAGE_DOCUMENTS_AUTHORITY) return false
    return isExternalStorageDocumentIdDescendant(treeDocumentId, targetDocumentId)
  }

  private fun parseExternalStorageDocumentId(documentId: String?): ExternalStorageDocumentId? {
    if (documentId.isNullOrEmpty()) return null
    val separator = documentId.indexOf(':')
    if (separator < 0 || separator != documentId.lastIndexOf(':')) return null
    val volumeId = documentId.substring(0, separator)
    if (volumeId.isBlank()) return null
    val path = documentId.substring(separator + 1)
    if (path.isEmpty()) return ExternalStorageDocumentId(volumeId, path)
    if (path.startsWith('/') || path.endsWith('/') || path.contains("//")) return null
    val segments = path.split('/')
    if (segments.any { it.isEmpty() || it == "." || it == ".." }) return null
    return ExternalStorageDocumentId(volumeId, path)
  }

  private data class ExternalStorageDocumentId(val volumeId: String, val path: String)
}
