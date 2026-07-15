package expo.modules.systemaudio.saf

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import expo.modules.systemaudio.saf.SafPermissionPolicy
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream

class AndroidSafContentStore(private val context: Context) : SafContentStore {
  override fun openInput(uri: Uri): InputStream? = context.contentResolver.openInputStream(uri)
  override fun openTruncatingOutput(uri: Uri): OutputStream? {
    val pfd = context.contentResolver.openFileDescriptor(uri, "rwt") ?: return null
    return object : FileOutputStream(pfd.fileDescriptor) { override fun close() { try { super.close() } finally { pfd.close() } } }
  }
  override fun sync(output: OutputStream) { (output as? FileOutputStream)?.fd?.sync() }
  override fun hasWritePermission(uri: Uri): Boolean {
    val direct = try { context.checkUriPermission(uri, android.os.Process.myPid(), android.os.Process.myUid(), Intent.FLAG_GRANT_WRITE_URI_PERMISSION) == android.content.pm.PackageManager.PERMISSION_GRANTED } catch (_: Throwable) { false }
    if (direct) return true
    return context.contentResolver.persistedUriPermissions.any { perm -> perm.isWritePermission && (perm.uri == uri || isUriCoveredByPersistedTreePermission(perm.uri, uri)) }
  }
  override fun isWritable(uri: Uri): Boolean {
    return try {
      val queryUri = when {
        DocumentsContract.isDocumentUri(context, uri) -> uri
        DocumentsContract.isTreeUri(uri) -> DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))
        else -> return false
      }
      context.contentResolver.query(queryUri, arrayOf(DocumentsContract.Document.COLUMN_FLAGS), null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) return@use false
        val index = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_FLAGS)
        if (index < 0 || cursor.isNull(index)) return@use false
        SafPermissionPolicy.isDocumentWritableFromFlags(cursor.getInt(index), DocumentsContract.Document.FLAG_SUPPORTS_WRITE)
      } ?: false
    } catch (_: Throwable) {
      false
    }
  }
  override fun size(uri: Uri): Long? {
    return try {
      context.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) return@use null
        val index = cursor.getColumnIndex(OpenableColumns.SIZE)
        if (index < 0 || cursor.isNull(index)) null else cursor.getLong(index)
      }
    } catch (_: Throwable) { null }
  }
  private fun isUriCoveredByPersistedTreePermission(permissionUri: Uri, targetUri: Uri): Boolean {
    return try {
      if (!DocumentsContract.isTreeUri(permissionUri) || permissionUri.authority != targetUri.authority) return false
      val treeDocumentId = DocumentsContract.getTreeDocumentId(permissionUri)
      val targetDocumentId = when {
        DocumentsContract.isDocumentUri(context, targetUri) -> DocumentsContract.getDocumentId(targetUri)
        DocumentsContract.isTreeUri(targetUri) -> DocumentsContract.getTreeDocumentId(targetUri)
        else -> return false
      }
      val parentDocumentUri = DocumentsContract.buildDocumentUriUsingTree(permissionUri, treeDocumentId)
      val targetDocumentUri = if (DocumentsContract.isDocumentUri(context, targetUri)) targetUri else DocumentsContract.buildDocumentUriUsingTree(targetUri, targetDocumentId)
      SafPermissionPolicy.isPersistedGrantCovered(SafPermissionPolicy.PersistedGrantKind.TREE, true, permissionUri.authority, treeDocumentId, targetUri.authority, targetDocumentId, tryProviderChildDocumentCheck(parentDocumentUri, targetDocumentUri))
    } catch (_: Throwable) { false }
  }
  private fun tryProviderChildDocumentCheck(parentDocumentUri: Uri, targetDocumentUri: Uri): SafPermissionPolicy.ProviderChildDecision {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return SafPermissionPolicy.ProviderChildDecision.UNAVAILABLE
    return try { if (DocumentsContract.isChildDocument(context.contentResolver, parentDocumentUri, targetDocumentUri)) SafPermissionPolicy.ProviderChildDecision.CHILD else SafPermissionPolicy.ProviderChildDecision.NOT_CHILD } catch (_: Throwable) { SafPermissionPolicy.ProviderChildDecision.UNAVAILABLE }
  }
}
