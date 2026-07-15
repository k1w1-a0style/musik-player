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
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AudioTagTransactionManagerTest {
  private object NoopDirectorySync : DirectoryDurabilitySync {
    override fun sync(directory: File) = Unit
  }

  private class CountingDirectorySync(
    private val failOnCall: Int? = null,
  ) : DirectoryDurabilitySync {
    var calls = 0
      private set

    override fun sync(directory: File) {
      calls += 1
      if (calls == failOnCall) throw IOException("directory sync failure")
    }
  }

  @Before fun registerRobolectricStorageCapacity() {
    ShadowStatFs.registerStats(
      File(System.getProperty("java.io.tmpdir")),
      1_000_000,
      1_000_000,
      1_000_000,
    )
  }

  @After fun resetRobolectricStorageCapacity() {
    ShadowStatFs.reset()
  }

  private fun tmp(): File = createTempDir(prefix = "saf-tx-test-")
  private fun sha(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
    .digest(bytes)
    .joinToString("") { "%02x".format(it) }
  private fun b64(bytes: ByteArray): String = Base64.getEncoder().encodeToString(bytes)
  private fun req(uri: Uri, original: ByteArray, rewritten: ByteArray): TransactionWriteRequest =
    TransactionWriteRequest(
      uri = uri,
      rewrittenBase64 = b64(rewritten),
      changedFields = listOf("title"),
      maxBytes = 1024 * 1024,
      expectedOriginalSize = original.size.toLong(),
      expectedOriginalSha256 = sha(original),
      expectedWrittenSize = rewritten.size.toLong(),
      expectedWrittenSha256 = sha(rewritten),
    )

  private open class FakeStore(initial: ByteArray = "old".toByteArray()) : SafContentStore {
    @Volatile var bytes: ByteArray = initial
    @Volatile var permission = true
    @Volatile var writable = true
    @Volatile var writes = 0
    @Volatile var reads = 0
    var failOpenOnWriteCall: Int? = null
    var failPartialOnWriteCall: Int? = null
    var failSyncOnWriteCall: Int? = null
    var replacementBeforeReadCall: Pair<Int, ByteArray>? = null
    var readOverride: ((Int, ByteArray) -> ByteArray)? = null
    var outputOpened: CountDownLatch? = null
    var holdWriteUntil: CountDownLatch? = null

    override fun openInput(uri: Uri): ByteArrayInputStream {
      reads += 1
      replacementBeforeReadCall?.takeIf { it.first == reads }?.let {
        bytes = it.second
        replacementBeforeReadCall = null
      }
      val payload = readOverride?.invoke(reads, bytes) ?: bytes
      return ByteArrayInputStream(payload)
    }

    override fun openTruncatingOutput(uri: Uri): OutputStream? {
      writes += 1
      val call = writes
      if (failOpenOnWriteCall == call) throw IOException("write open failed")
      val openedLatch = outputOpened
      val holdLatch = holdWriteUntil
      openedLatch?.countDown()
      holdLatch?.await(10, TimeUnit.SECONDS)
      val out = ByteArrayOutputStream()
      return object : OutputStream() {
        private var count = 0
        override fun write(value: Int) {
          if (failPartialOnWriteCall == call && count++ >= 2) throw IOException("partial write")
          out.write(value)
        }

        override fun write(buffer: ByteArray, offset: Int, length: Int) {
          if (failPartialOnWriteCall == call) {
            val partial = minOf(2, length)
            out.write(buffer, offset, partial)
            throw IOException("partial write")
          }
          out.write(buffer, offset, length)
        }

        override fun close() {
          bytes = out.toByteArray()
        }
      }
    }

    override fun sync(output: OutputStream) {
      if (failSyncOnWriteCall == writes) throw IOException("sync failure")
    }

    override fun hasWritePermission(uri: Uri): Boolean = permission
    override fun isWritable(uri: Uri): Boolean = writable
    override fun size(uri: Uri): Long = bytes.size.toLong()
  }

  private fun storage(root: File, sync: DirectoryDurabilitySync = NoopDirectorySync) =
    TransactionStorage(root, sync)
  private fun manager(root: File, store: FakeStore, margin: Long = 0) =
    AudioTagTransactionManager(storage(root), store, margin)

  private val uri = Uri.parse("content://provider/tree/song")

  @Test fun successfulWriteVerifiesAndCleansArtifacts() {
    val old = "old".toByteArray()
    val rewritten = "new".toByteArray()
    val root = tmp()
    val store = FakeStore(old)
    val result = manager(root, store).write(req(uri, old, rewritten))
    assertTrue(result.success)
    assertTrue(result.verified)
    assertArrayEquals(rewritten, store.bytes)
    assertTrue(root.listFiles().isNullOrEmpty())
  }

  @Test fun targetIsNotOpenedBeforeOriginalVerification() {
    val old = "old".toByteArray()
    val store = FakeStore(old)
    val result = manager(tmp(), store).write(req(uri, "wrong".toByteArray(), "new".toByteArray()))
    assertFalse(result.success)
    assertEquals("VerificationFailed", result.errorCode)
    assertEquals(0, store.writes)
    assertArrayEquals(old, store.bytes)
  }

  @Test fun backupReadFailureDoesNotMutateTarget() {
    val old = "old".toByteArray()
    val store = object : FakeStore(old) {
      override fun openInput(uri: Uri): ByteArrayInputStream {
        throw IOException("backup read failed")
      }
    }
    val result = manager(tmp(), store).write(req(uri, old, "new".toByteArray()))
    assertFalse(result.success)
    assertEquals(0, store.writes)
    assertArrayEquals(old, store.bytes)
  }

  @Test fun insufficientStorageIsRejectedBeforeMutation() {
    val old = "old".toByteArray()
    val root = tmp()
    ShadowStatFs.registerStats(root, 1, 0, 0)
    val store = FakeStore(old)
    val result = manager(root, store).write(req(uri, old, "new".toByteArray()))
    assertEquals("InsufficientStorage", result.errorCode)
    assertEquals(0, store.writes)
  }

  @Test fun externalChangeBeforeWriteIntentAbortsWithoutMutation() {
    val old = "old".toByteArray()
    val external = "external".toByteArray()
    val store = FakeStore(old).apply { replacementBeforeReadCall = 2 to external }
    val result = manager(tmp(), store).write(req(uri, old, "new".toByteArray()))
    assertFalse(result.success)
    assertEquals("VerificationFailed", result.errorCode)
    assertEquals(0, store.writes)
    assertArrayEquals(external, store.bytes)
  }

  @Test fun invalidBase64IsRejectedBeforeMutation() {
    val old = "old".toByteArray()
    val store = FakeStore(old)
    val result = manager(tmp(), store).write(req(uri, old, "new".toByteArray()).copy(rewrittenBase64 = "@@@"))
    assertEquals("InvalidTagData", result.errorCode)
    assertEquals(0, store.writes)
  }

  @Test fun targetOpenFailureRollsBackAndReportsOriginalWriteError() {
    val old = "old".toByteArray()
    val root = tmp()
    val store = FakeStore(old).apply { failOpenOnWriteCall = 1 }
    val result = manager(root, store).write(req(uri, old, "new".toByteArray()))
    assertFalse(result.success)
    assertEquals("ReplaceFailed", result.errorCode)
    assertTrue(result.recovered)
    assertFalse(result.recoveryPending)
    assertArrayEquals(old, store.bytes)
    assertTrue(root.listFiles().isNullOrEmpty())
  }

  @Test fun partialTargetWriteRollsBackSuccessfully() {
    val old = "old".toByteArray()
    val root = tmp()
    val store = FakeStore(old).apply { failPartialOnWriteCall = 1 }
    val result = manager(root, store).write(req(uri, old, "newer".toByteArray()))
    assertEquals("ReplaceFailed", result.errorCode)
    assertTrue(result.recovered)
    assertFalse(result.recoveryPending)
    assertArrayEquals(old, store.bytes)
    assertTrue(root.listFiles().isNullOrEmpty())
  }

  @Test fun targetSyncFailureRollsBackSuccessfully() {
    val old = "old".toByteArray()
    val store = FakeStore(old).apply { failSyncOnWriteCall = 1 }
    val result = manager(tmp(), store).write(req(uri, old, "new".toByteArray()))
    assertEquals("ReplaceFailed", result.errorCode)
    assertTrue(result.recovered)
    assertArrayEquals(old, store.bytes)
  }

  @Test fun postWriteHashMismatchRestoresOriginalAndPreservesVerificationError() {
    val old = "old".toByteArray()
    val store = FakeStore(old).apply {
      readOverride = { readCall, current -> if (readCall == 3) "wrong".toByteArray() else current }
    }
    val result = manager(tmp(), store).write(req(uri, old, "new".toByteArray()))
    assertEquals("VerificationFailed", result.errorCode)
    assertTrue(result.recovered)
    assertFalse(result.recoveryPending)
    assertArrayEquals(old, store.bytes)
  }

  @Test fun failedRollbackPreservesTransactionForRecovery() {
    val old = "old".toByteArray()
    val root = tmp()
    val store = FakeStore(old).apply {
      failPartialOnWriteCall = 1
      failOpenOnWriteCall = 2
    }
    val result = manager(root, store).write(req(uri, old, "newer".toByteArray()))
    assertFalse(result.success)
    assertEquals("RollbackFailed", result.errorCode)
    assertTrue(result.recoveryPending)
    assertFalse(root.listFiles().isNullOrEmpty())
  }

  @Test fun corruptedBackupIsDetectedBeforeRecoveryMutation() {
    val root = prepared(TransactionState.WRITE_STARTED)
    File(root.listFiles()!!.single(), "original.bin").writeText("tampered")
    val store = FakeStore("partial".toByteArray())
    val summary = manager(root, store).recoverPendingSummary()
    assertFalse(summary.success)
    assertEquals("BackupCorrupted", summary.transactions.single().errorCode)
    assertEquals(0, store.writes)
    assertArrayEquals("partial".toByteArray(), store.bytes)
  }

  @Test fun committedTransactionIsCleanupOnlyEvenAfterExternalEdit() {
    val root = prepared(TransactionState.COMMITTED)
    val external = "externally-edited".toByteArray()
    val store = FakeStore(external)
    val summary = manager(root, store).recoverPendingSummary()
    assertTrue(summary.success)
    assertEquals(0, store.writes)
    assertArrayEquals(external, store.bytes)
    assertTrue(root.listFiles().isNullOrEmpty())
  }

  @Test fun crashedWriteWithOriginalStillPresentCleansWithoutWriting() {
    val root = prepared(TransactionState.WRITE_STARTED)
    val old = "old".toByteArray()
    val store = FakeStore(old)
    val summary = manager(root, store).recoverPendingSummary()
    assertTrue(summary.success)
    assertEquals(0, store.writes)
    assertArrayEquals(old, store.bytes)
    assertTrue(root.listFiles().isNullOrEmpty())
  }

  @Test fun crashedWriteWithRewrittenContentCommitsWithoutRollback() {
    val root = prepared(TransactionState.WRITTEN_UNVERIFIED)
    val rewritten = "new".toByteArray()
    val store = FakeStore(rewritten)
    val summary = manager(root, store).recoverPendingSummary()
    assertTrue(summary.success)
    assertEquals(0, store.writes)
    assertArrayEquals(rewritten, store.bytes)
    assertTrue(root.listFiles().isNullOrEmpty())
  }

  @Test fun truncatedPartialCrashIsRestoredFromOriginalBackup() {
    val original = "abcdef".toByteArray()
    val rewritten = "UVWXYZ".toByteArray()
    val root = prepared(TransactionState.WRITE_STARTED, original, rewritten)
    val store = FakeStore("UV".toByteArray())
    val summary = manager(root, store).recoverPendingSummary()
    assertTrue(summary.success)
    assertEquals(1, summary.recoveredCount)
    assertEquals(1, store.writes)
    assertArrayEquals(original, store.bytes)
    assertTrue(root.listFiles().isNullOrEmpty())
  }

  @Test fun overwrittenPrefixWithOriginalTailIsRestored() {
    val original = "abcdef".toByteArray()
    val rewritten = "UVWXYZ".toByteArray()
    val root = prepared(TransactionState.WRITE_STARTED, original, rewritten)
    val store = FakeStore("UVcdef".toByteArray())
    val summary = manager(root, store).recoverPendingSummary()
    assertTrue(summary.success)
    assertEquals(1, summary.recoveredCount)
    assertEquals(1, store.writes)
    assertArrayEquals(original, store.bytes)
  }

  @Test fun crashedWriteWithUnknownExternalContentStaysPendingAndIsNotOverwritten() {
    val root = prepared(TransactionState.WRITE_STARTED)
    val external = "external-after-crash".toByteArray()
    val store = FakeStore(external)
    val summary = manager(root, store).recoverPendingSummary()
    assertFalse(summary.success)
    assertTrue(summary.pendingCount > 0)
    assertEquals(0, store.writes)
    assertArrayEquals(external, store.bytes)
    assertFalse(root.listFiles().isNullOrEmpty())
  }

  @Test fun recoveryWithoutPermissionRemainsPending() {
    val root = prepared(TransactionState.WRITE_STARTED)
    val store = FakeStore("partial".toByteArray()).apply { permission = false }
    val result = manager(root, store).recoverPending()
    assertEquals("RecoveryPending", result.errorCode)
    assertTrue(result.recoveryPending)
    assertEquals(0, store.writes)
  }

  @Test fun statusIsReadOnly() {
    val root = prepared(TransactionState.WRITE_STARTED)
    val dir = root.listFiles()!!.single()
    val journalBefore = File(dir, "journal.json").readText()
    val originalBefore = File(dir, "original.bin").readBytes()
    val store = FakeStore("partial".toByteArray())
    val manager = manager(root, store)
    val status = manager.status()
    assertEquals(1, status["pendingCount"])
    assertEquals(0, store.writes)
    assertEquals(journalBefore, File(dir, "journal.json").readText())
    assertArrayEquals(originalBefore, File(dir, "original.bin").readBytes())
    assertArrayEquals("partial".toByteArray(), store.bytes)
  }

  @Test fun damagedJournalIsQuarantinedAndDoesNotBlockIndependentUri() {
    val root = tmp()
    val damaged = File(root, "damaged").apply { mkdirs() }
    File(damaged, "original.bin").writeText("backup")
    File(damaged, "journal.json").writeText("{")
    val otherUri = Uri.parse("content://provider/tree/other")
    val store = FakeStore("old".toByteArray())
    val result = manager(root, store).write(req(otherUri, "old".toByteArray(), "new".toByteArray()))
    assertTrue(result.success)
    assertArrayEquals("new".toByteArray(), store.bytes)
    val quarantine = File(root.parentFile, "audio-tag-transactions-quarantine")
    assertTrue(quarantine.listFiles()?.isNotEmpty() == true)
  }

  @Test fun journalAcceptsAllFieldsEmittedByJsWriter() {
    val fields = listOf("title", "artist", "albumArtist", "album", "year", "genre", "trackNumber", "discNumber", "comment", "cover")
    val journal = TransactionJournal(
      transactionId = "tx",
      targetUri = uri.toString(),
      state = TransactionState.PREPARING,
      createdAtEpochMs = 1,
      updatedAtEpochMs = 1,
      changedFields = fields,
    )
    assertEquals(fields, TransactionJournal.fromJson(journal.toJson()).changedFields)
  }

  @Test fun journalRejectsUnknownChangedField() {
    val journal = TransactionJournal(
      transactionId = "tx",
      targetUri = uri.toString(),
      state = TransactionState.PREPARING,
      createdAtEpochMs = 1,
      updatedAtEpochMs = 1,
      changedFields = listOf("track"),
    )
    assertThrows(IllegalArgumentException::class.java) { TransactionJournal.fromJson(journal.toJson()) }
  }

  @Test fun directorySyncFailureDuringStorageCreationIsPropagated() {
    val parent = tmp()
    val root = File(parent, "transactions")
    val sync = CountingDirectorySync(failOnCall = 1)
    assertThrows(IOException::class.java) { TransactionStorage(root, sync) }
    assertEquals(1, sync.calls)
  }

  @Test fun twoWritesForSameUriNeverOpenTargetConcurrently() {
    val old = "old".toByteArray()
    val first = "first".toByteArray()
    val second = "second".toByteArray()
    val root = tmp()
    val opened = CountDownLatch(1)
    val release = CountDownLatch(1)
    val store = FakeStore(old).apply {
      outputOpened = opened
      holdWriteUntil = release
    }
    val manager = manager(root, store)
    var firstResult: TransactionResult? = null
    var secondResult: TransactionResult? = null

    val firstThread = thread { firstResult = manager.write(req(uri, old, first)) }
    assertTrue(opened.await(5, TimeUnit.SECONDS))
    store.outputOpened = null
    store.holdWriteUntil = null
    val secondThread = thread { secondResult = manager.write(req(uri, first, second)) }
    Thread.sleep(150)
    assertEquals(1, store.writes)
    release.countDown()
    firstThread.join(10_000)
    secondThread.join(10_000)

    assertTrue(firstResult?.success == true)
    assertTrue(secondResult?.success == true)
    assertArrayEquals(second, store.bytes)
  }

  private fun prepared(
    state: TransactionState,
    original: ByteArray = "old".toByteArray(),
    rewritten: ByteArray = "new".toByteArray(),
  ): File {
    val root = tmp()
    val storage = storage(root)
    val dir = storage.createDir()
    storage.original(dir).writeBytes(original)
    if (state != TransactionState.PREPARING && state != TransactionState.BACKUP_READY) {
      storage.rewritten(dir).writeBytes(rewritten)
    }
    storage.atomicWriteJournal(
      dir,
      TransactionJournal(
        transactionId = dir.name,
        targetUri = uri.toString(),
        state = state,
        createdAtEpochMs = 1,
        updatedAtEpochMs = 1,
        originalSizeBytes = if (state == TransactionState.PREPARING) null else original.size.toLong(),
        originalSha256Hex = if (state == TransactionState.PREPARING) null else sha(original),
        rewrittenSizeBytes = if (state == TransactionState.PREPARING || state == TransactionState.BACKUP_READY) null else rewritten.size.toLong(),
        rewrittenSha256Hex = if (state == TransactionState.PREPARING || state == TransactionState.BACKUP_READY) null else sha(rewritten),
      ),
    )
    return root
  }
}
