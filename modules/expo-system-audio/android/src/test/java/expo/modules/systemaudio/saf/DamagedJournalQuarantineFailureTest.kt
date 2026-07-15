package expo.modules.systemaudio.saf

import android.net.Uri
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.io.OutputStream
import java.security.MessageDigest

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class DamagedJournalQuarantineFailureTest {
  private class FailFirstDirectorySync : DirectoryDurabilitySync {
    var calls = 0

    override fun sync(directory: File) {
      calls += 1
      if (calls == 1) throw IOException("forced quarantine durability failure")
    }
  }

  private class Store(initial: ByteArray) : SafContentStore {
    var bytes: ByteArray = initial
    var reads = 0
    var writes = 0

    override fun openInput(uri: Uri): ByteArrayInputStream {
      reads += 1
      return ByteArrayInputStream(bytes)
    }

    override fun openTruncatingOutput(uri: Uri): OutputStream {
      writes += 1
      val output = ByteArrayOutputStream()
      return object : OutputStream() {
        override fun write(value: Int) = output.write(value)

        override fun write(buffer: ByteArray, offset: Int, length: Int) {
          output.write(buffer, offset, length)
        }

        override fun close() {
          bytes = output.toByteArray()
        }
      }
    }

    override fun sync(output: OutputStream) = Unit
    override fun hasWritePermission(uri: Uri): Boolean = true
    override fun isWritable(uri: Uri): Boolean = true
    override fun size(uri: Uri): Long = bytes.size.toLong()
  }

  @Test
  fun targetedWriteIsBlockedWhenDamagedJournalCannotBeQuarantined() {
    val parent = createTempDir(prefix = "saf-damaged-journal-parent-")
    val root = File(parent, "transactions").apply { mkdirs() }
    val damaged = File(root, "unknown-transaction").apply { mkdirs() }
    File(damaged, "original.bin").writeText("backup")
    File(damaged, "journal.json").writeText("{")

    val directorySync = FailFirstDirectorySync()
    val storage = TransactionStorage(root, directorySync)
    val original = "old".toByteArray()
    val rewritten = "new".toByteArray()
    val store = Store(original)
    val manager = AudioTagTransactionManager(storage, store, 0)
    val uri = Uri.parse("content://provider/tree/other-song")

    val result = manager.write(
      TransactionWriteRequest(
        uri = uri,
        rewriteSource = staticRewriteSource(rewritten),
        changedFields = listOf("title"),
        maxBytes = 1024 * 1024,
        expectedOriginalSize = original.size.toLong(),
        expectedOriginalSha256 = sha256(original),
        expectedWrittenSha256 = sha256(rewritten),
      ),
    )

    assertFalse(result.success)
    assertEquals("RecoveryPending", result.errorCode)
    assertTrue(result.recoveryPending)
    assertEquals(0, store.reads)
    assertEquals(0, store.writes)
    assertTrue(damaged.exists())
    assertEquals(1, directorySync.calls)
  }

  private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
    .digest(bytes)
    .joinToString("") { byte -> "%02x".format(byte) }
}
