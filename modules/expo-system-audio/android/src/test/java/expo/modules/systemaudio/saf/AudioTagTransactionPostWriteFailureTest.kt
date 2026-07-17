package expo.modules.systemaudio.saf

import android.net.Uri
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowStatFs
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.io.OutputStream
import java.security.MessageDigest

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AudioTagTransactionPostWriteFailureTest {
  private val uri = Uri.parse("content://provider/tree/song")

  @Before fun registerStorageCapacity() {
    ShadowStatFs.registerStats(
      File(System.getProperty("java.io.tmpdir")),
      1_000_000,
      1_000_000,
      1_000_000,
    )
  }

  @After fun resetStorageCapacity() {
    ShadowStatFs.reset()
  }

  @Test fun oversizedProviderTailTriggersVerifiedRollback() {
    val original = "abc".toByteArray()
    val rewritten = "XY".toByteArray()
    val root = createTempDir(prefix = "saf-oversize-tail-")
    val store = object : MemoryStore(original) {
      override fun outputBytes(call: Int, written: ByteArray): ByteArray =
        if (call == 1) written + "-tail".toByteArray() else written
    }

    val result = AudioTagTransactionManager(
      TransactionStorage(root, NoopDirectorySync),
      store,
      0,
    ).write(request(original, rewritten, maxBytes = original.size.toLong()))

    assertFalse(result.success)
    assertEquals("VerificationFailed", result.errorCode)
    assertTrue(result.recovered)
    assertFalse(result.recoveryPending)
    assertArrayEquals(original, store.bytes)
    assertTrue(root.listFiles().isNullOrEmpty())
  }

  @Test fun writtenUnverifiedJournalSyncFailureRollsBackWithoutDeletingRecoveryEarly() {
    val original = "old".toByteArray()
    val rewritten = "new".toByteArray()
    val root = createTempDir(prefix = "saf-written-journal-failure-")
    val store = MemoryStore(original)
    val sync = object : DirectoryDurabilitySync {
      override fun sync(directory: File) {
        val journal = File(directory, "journal.json")
        if (journal.isFile && journal.readText().contains("\"state\":\"WRITTEN_UNVERIFIED\"")) {
          throw IOException("written-unverified directory sync failed")
        }
      }
    }

    val result = AudioTagTransactionManager(
      TransactionStorage(root, sync),
      store,
      0,
    ).write(request(original, rewritten, maxBytes = 1024))

    assertFalse(result.success)
    assertEquals("ReplaceFailed", result.errorCode)
    assertTrue(result.recovered)
    assertFalse(result.recoveryPending)
    assertArrayEquals(original, store.bytes)
    assertTrue(root.listFiles().isNullOrEmpty())
  }

  private open class MemoryStore(initial: ByteArray) : SafContentStore {
    @Volatile var bytes: ByteArray = initial
    @Volatile var writes = 0

    override fun openInput(uri: Uri): ByteArrayInputStream = ByteArrayInputStream(bytes)

    override fun openTruncatingOutput(uri: Uri): OutputStream {
      writes += 1
      val call = writes
      val output = ByteArrayOutputStream()
      return object : OutputStream() {
        override fun write(value: Int) = output.write(value)
        override fun write(buffer: ByteArray, offset: Int, length: Int) =
          output.write(buffer, offset, length)
        override fun close() {
          bytes = outputBytes(call, output.toByteArray())
        }
      }
    }

    open fun outputBytes(call: Int, written: ByteArray): ByteArray = written

    override fun sync(output: OutputStream) = Unit
    override fun hasWritePermission(uri: Uri): Boolean = true
    override fun isWritable(uri: Uri): Boolean = true
    override fun size(uri: Uri): Long = bytes.size.toLong()
  }

  private object NoopDirectorySync : DirectoryDurabilitySync {
    override fun sync(directory: File) = Unit
  }

  private fun request(
    original: ByteArray,
    rewritten: ByteArray,
    maxBytes: Long,
  ): TransactionWriteRequest = TransactionWriteRequest(
    uri = uri,
    rewriteSource = staticRewriteSource(rewritten),
    changedFields = listOf("title"),
    maxBytes = maxBytes,
    expectedOriginalSize = original.size.toLong(),
    expectedOriginalSha256 = sha(original),
  )

  private fun sha(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
    .digest(bytes)
    .joinToString("") { "%02x".format(it) }
}
