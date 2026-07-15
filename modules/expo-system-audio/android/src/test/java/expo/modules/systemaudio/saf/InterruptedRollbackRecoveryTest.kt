package expo.modules.systemaudio.saf

import android.net.Uri
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.OutputStream
import java.security.MessageDigest

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class InterruptedRollbackRecoveryTest {
  private object NoopDirectorySync : DirectoryDurabilitySync {
    override fun sync(directory: File) = Unit
  }

  private class Store(initial: ByteArray) : SafContentStore {
    var bytes: ByteArray = initial
    var writes = 0

    override fun openInput(uri: Uri) = ByteArrayInputStream(bytes)

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

  private val uri = Uri.parse("content://provider/tree/song")

  @Test
  fun truncatedOriginalPrefixFromInterruptedRollbackIsRestored() {
    val original = "abcdef".toByteArray()
    val rewritten = "UVWXYZ".toByteArray()
    val fixture = fixture(original, rewritten, "ab".toByteArray())

    val summary = fixture.manager.recoverPendingSummary()

    assertTrue(summary.success)
    assertEquals(1, summary.recoveredCount)
    assertEquals(1, fixture.store.writes)
    assertArrayEquals(original, fixture.store.bytes)
    assertTrue(fixture.root.listFiles().isNullOrEmpty())
  }

  @Test
  fun originalPrefixWithRewrittenTailFromInterruptedRollbackIsRestored() {
    val original = "abcdef".toByteArray()
    val rewritten = "UVWXYZ".toByteArray()
    val fixture = fixture(original, rewritten, "abWXYZ".toByteArray())

    val summary = fixture.manager.recoverPendingSummary()

    assertTrue(summary.success)
    assertEquals(1, summary.recoveredCount)
    assertEquals(1, fixture.store.writes)
    assertArrayEquals(original, fixture.store.bytes)
    assertTrue(fixture.root.listFiles().isNullOrEmpty())
  }

  private data class Fixture(
    val root: File,
    val store: Store,
    val manager: AudioTagTransactionManager,
  )

  private fun fixture(
    original: ByteArray,
    rewritten: ByteArray,
    live: ByteArray,
  ): Fixture {
    val root = createTempDir(prefix = "saf-interrupted-rollback-")
    val storage = TransactionStorage(root, NoopDirectorySync)
    val directory = storage.createDir()
    storage.original(directory).writeBytes(original)
    storage.rewritten(directory).writeBytes(rewritten)
    storage.atomicWriteJournal(
      directory,
      TransactionJournal(
        transactionId = directory.name,
        targetUri = uri.toString(),
        state = TransactionState.RECOVERY_FAILED,
        createdAtEpochMs = 1,
        updatedAtEpochMs = 1,
        originalSizeBytes = original.size.toLong(),
        originalSha256Hex = sha256(original),
        rewrittenSizeBytes = rewritten.size.toLong(),
        rewrittenSha256Hex = sha256(rewritten),
        changedFields = listOf("title"),
      ),
    )
    val store = Store(live)
    return Fixture(root, store, AudioTagTransactionManager(storage, store, 0))
  }

  private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
    .digest(bytes)
    .joinToString("") { byte -> "%02x".format(byte) }
}
