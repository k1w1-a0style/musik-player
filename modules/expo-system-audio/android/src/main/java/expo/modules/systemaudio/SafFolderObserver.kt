package expo.modules.systemaudio

import android.content.ContentResolver
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.DocumentsContract

/** Subscribes only to saved document-tree roots. Providers that omit change
 * notifications are still rescanned when the app returns to the foreground. */
internal class SafFolderObserver {
  private var registration: Pair<ContentResolver, ContentObserver>? = null

  @Synchronized
  fun replace(resolver: ContentResolver, roots: List<String>, changed: () -> Unit) {
    close()
    if (roots.isEmpty()) return
    val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
      override fun onChange(selfChange: Boolean) {
        val isCurrent = synchronized(this@SafFolderObserver) { registration?.second === this }
        if (isCurrent) changed()
      }
    }
    registration = resolver to observer
    roots.distinct().take(128).forEach { root ->
      try {
        val uri = Uri.parse(root)
        if (uri.scheme != ContentResolver.SCHEME_CONTENT || !DocumentsContract.isTreeUri(uri)) return@forEach
        val children = DocumentsContract.buildChildDocumentsUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))
        resolver.registerContentObserver(children, true, observer)
      } catch (_: SecurityException) {
        // A temporarily unavailable permission does not remove the source.
      } catch (_: IllegalArgumentException) {
        // Some providers do not offer observable child document URIs.
      }
    }
  }

  @Synchronized
  fun close() {
    val (resolver, observer) = registration ?: return
    registration = null
    resolver.unregisterContentObserver(observer)
  }
}
