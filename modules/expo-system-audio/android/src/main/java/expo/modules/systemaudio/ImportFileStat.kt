package expo.modules.systemaudio

import android.database.Cursor
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import java.io.File

/** Provider metadata only: never opens or hashes an audio stream. */
internal fun readProviderFileStat(
  uri: String,
  query: (Uri, Array<String>) -> Cursor?,
): Map<String, Long?>? = try {
  val parsed = Uri.parse(uri)
  when (parsed.scheme) {
    "content" -> query(parsed, arrayOf(OpenableColumns.SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED))?.use { cursor ->
      if (!cursor.moveToFirst()) null else {
        fun positiveColumn(name: String): Long? {
          val index = cursor.getColumnIndex(name)
          return if (index < 0 || cursor.isNull(index)) null else cursor.getLong(index).takeIf { it > 0 }
        }
        mapOf("size" to positiveColumn(OpenableColumns.SIZE),
          "modificationTime" to positiveColumn(DocumentsContract.Document.COLUMN_LAST_MODIFIED))
      }
    }
    "file", null -> {
      val path = if (parsed.scheme == "file") parsed.path else uri
      path?.let(::File)?.takeIf { it.isFile }?.let {
        mapOf("size" to it.length().takeIf { size -> size > 0 },
          "modificationTime" to it.lastModified().takeIf { date -> date > 0 })
      }
    }
    else -> null
  }
} catch (_: Throwable) { null }
