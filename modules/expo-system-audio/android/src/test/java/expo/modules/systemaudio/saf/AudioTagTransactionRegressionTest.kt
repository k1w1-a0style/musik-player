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
import java.util.Base64

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AudioTagTransactionRegressionTest {
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

  @Test fun writeIntentJournalFailureDoesNotMutateTargetOrEscapeCleanup() {
    val root = createTempDir(prefix = "saf-write-intent-failure-")
    val sync = object : DirectoryDurabilitySync {
      override fun sync(directory: File) {
        val journal = File(directory, "journal.json")
        if (journal.isFile && journal.readText().contains("\"state\":\"WRITE_STARTED\"")) {
          throw IOException("write-intent directory sync failed")
        }
      }
    }
    val store = MemoryStore("old".toByteArray())
    val manager = AudioTagTransactionManager(TransactionStorage(root, sync), store, 0)

    val result = manager.write(request("old".toByteArray(), "new".toByteArray()))

    assertFalse(result.success)
    assertEquals("ReplaceFailed", result.errorCode)
    assertEquals(0, store.writes)
    assertArrayEquals("old".toByteArray(), store.bytes)
    assertTrue(root.listFiles().isNullOrEmpty())
  }

  @Test fun providerFailureOnSecondCrashClassificationOpenReturnsPending() {
    val root = preparedTransaction(
      state = TransactionState.WRITE_STARTED,
      original = "abcdef".toByteArray(),
      rewritten = "UVWXYZ".toByteArray(),
    )
    val store = object : MemoryStore("external".toByteArray()) {
      override fun openInput(uri: Uri): ByteArrayInputStream {
        reads += 1
        if (reads == 2) throw IOException("provider disappeared")
        return ByteArrayInputStream(bytes)
      }
    }

    val summary = AudioTagTransactionManager(
      TransactionStorage(root, NoopDirectorySync),
      store,
      0,
    ).recoverPendingSummary()

    assertFalse(summary.success)
    assertEquals(1, summary.pendingCount)
    assertEquals(0, store.writes)
    assertArrayEquals("external".toByteArray(), store.bytes)
    assertFalse(root.listFiles().isNullOrEmpty())
  }

  @Test fun strictSharedPrefixBeforeFirstChangedByteIsClassifiedAsInterruptedWrite() {
    val directory = createTempDir(prefix = "saf-shared-prefix-")
    val original = File(directory, "original.bin").apply { writeText("abcdef") }
    val rewritten = File(directory, "rewritten.bin").apply { writeText("abCDEF") }
    val store = MemoryStore("ab".toByteArray())

    assertTrue(
      InterruptedSafWriteClassifier.matches(
        store = store,
        uri = uri,
        original = original,
        rewritten = rewritten,
        maxBytes = 1024,
      ),
    )
  }

  private open class MemoryStore(initial: ByteArray) : SafContentStore {
    @Volatile var bytes: ByteArray = initial
    @Volatile var reads = 0
    @Volatile var writes = 0

    override fun openInput(uri: Uri): ByteArrayInputStream {
      reads += 1
      return ByteArrayInputStream(bytes)
    }

    override fun openTruncatingOutput(uri: Uri): OutputStream {
      writes += 1
      val output = ByteArrayOutputStream()
      return object : OutputStream() {
        override fun write(value: Int) = output.write(value)
        override fun write(buffer: ByteArray, offset: Int, length: Int) =
          output.write(buffer, offset, length)
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

  private object NoopDirectorySync : DirectoryDurabilitySync {
    override fun sync(directory: File) = Unit
  }

  private fun request(original: ByteArray, rewritten: ByteArray): TransactionWriteRequest =
    TransactionWriteRequest(
      uri = uri,
      rewrittenBase64 = Base64.getEncoder().encodeToString(rewritten),
      changedFields = listOf("title"),
      maxBytes = 1024,
      expectedOriginalSize = original.size.toLong(),
      expectedOriginalSha256 = sha(original),
      expectedWrittenSize = rewritten.size.toLong(),
      expectedWrittenSha256 = sha(rewritten),
    )

  private fun preparedTransaction(
    state: TransactionState,
    original: ByteArray,
    rewritten: ByteArray,
  ): File {
    val root = createTempDir(prefix = "saf-recovery-regression-")
    val storage = TransactionStorage(root, NoopDirectorySync)
    val directory = storage.createDir()
    storage.original(directory).writeBytes(original)
    storage.rewritten(directory).writeBytes(rewritten)
    storage.atomicWriteJournal(
      directory,
      TransactionJournal(
        transactionId = directory.name,
        targetUri = uri.toString(),
        state = state,
        createdAtEpochMs = 1,
        updatedAtEpochMs = 1,
        originalSizeBytes = original.size.toLong(),
        originalSha256Hex = sha(original),
        rewrittenSizeBytes = rewritten.size.toLong(),
        rewrittenSha256Hex = sha(rewritten),
        changedFields = listOf("title"),
      ),
    )
    return root
  }

  private fun sha(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
    .digest(bytes)
    .joinToString("") { "%02x".format(it) }
}
