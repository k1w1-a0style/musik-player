package expo.modules.systemaudio

import android.database.MatrixCursor
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ImportFileStatTest {
  @Test fun providerStatUsesOnlySizeAndDateAndClosesItsCursor() {
    val columns = arrayOf(OpenableColumns.SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED)
    val cursor = MatrixCursor(columns).apply { addRow(arrayOf(2000L, 1700000000000L)) }
    val result = readProviderFileStat("content://provider/document/song") { uri, requested ->
      assertEquals("content://provider/document/song", uri.toString())
      assertArrayEquals(columns, requested)
      cursor
    }
    assertEquals(mapOf("size" to 2000L, "modificationTime" to 1700000000000L), result)
    assertTrue(cursor.isClosed)
  }

  @Test fun absentAndUnknownColumnsRemainUnknown() {
    val cursor = MatrixCursor(arrayOf(OpenableColumns.SIZE)).apply { addRow(arrayOf(0L)) }
    assertEquals(mapOf<String, Long?>("size" to null, "modificationTime" to null),
      readProviderFileStat("content://provider/song") { _, _ -> cursor })
    assertTrue(cursor.isClosed)
    val empty = MatrixCursor(arrayOf(OpenableColumns.SIZE))
    assertNull(readProviderFileStat("content://provider/missing") { _, _ -> empty })
    assertTrue(empty.isClosed)
  }

  @Test fun providerFailureDoesNotOpenOrGuessARevision() {
    assertNull(readProviderFileStat("content://provider/song") { _, _ -> throw SecurityException("no grant") })
    assertNull(readProviderFileStat("content://provider/song") { _, _ -> null })
  }

  @Test fun localFileDatesStayInMillisecondsWithoutCallingAProvider() {
    val file = File.createTempFile("import-stat-", ".mp3")
    try {
      file.writeBytes(byteArrayOf(1, 2, 3))
      assertTrue(file.setLastModified(1700000000000L))
      assertEquals(mapOf("size" to 3L, "modificationTime" to 1700000000000L),
        readProviderFileStat(file.toURI().toString()) { _, _ -> fail("unexpected provider query"); null })
    } finally { file.delete() }
  }

  @Test fun remoteAndMissingFilesCannotBecomeLocalRevisions() {
    for (uri in listOf("https://example.invalid/song.mp3", "file:///missing/song.mp3")) {
      assertNull(readProviderFileStat(uri) { _, _ -> fail("unexpected provider query"); null })
    }
  }
}
