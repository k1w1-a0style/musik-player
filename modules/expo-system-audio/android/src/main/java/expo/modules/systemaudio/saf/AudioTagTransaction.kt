package expo.modules.systemaudio.saf

import android.net.Uri
import android.os.StatFs
import android.system.Os
import android.system.OsConstants
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

enum class TransactionState { PREPARING, BACKUP_READY, WRITE_STARTED, WRITTEN_UNVERIFIED, COMMITTED, RECOVERY_REQUIRED, RECOVERY_FAILED, RECOVERED }

enum class WriteExecutionPhase {
  PREPARING,
  BACKUP_DURABLE,
  REWRITE_DURABLE,
  WRITE_INTENT_DURABLE,
  TARGET_MUTATION_STARTED,
  TARGET_SYNCED,
  TARGET_VERIFIED,
  COMMITTED_DURABLE,
}

data class DigestInfo(val sizeBytes: Long, val sha256Hex: String)

data class TransactionJournal(
  val schemaVersion: Int = 1,
  val transactionId: String,
  val targetUri: String,
  val state: TransactionState,
  val createdAtEpochMs: Long,
  val updatedAtEpochMs: Long,
  val originalSizeBytes: Long? = null,
  val originalSha256Hex: String? = null,
  val rewrittenSizeBytes: Long? = null,
  val rewrittenSha256Hex: String? = null,
  val changedFields: List<String> = emptyList(),
) {
  fun withState(state: TransactionState): TransactionJournal = copy(state = state, updatedAtEpochMs = System.currentTimeMillis())
  fun toJson(): String = JSONObject().apply {
    put("schemaVersion", schemaVersion)
    put("transactionId", transactionId)
    put("targetUri", targetUri)
    put("state", state.name)
    put("createdAtEpochMs", createdAtEpochMs)
    put("updatedAtEpochMs", updatedAtEpochMs)
    put("originalSizeBytes", originalSizeBytes ?: JSONObject.NULL)
    put("originalSha256Hex", originalSha256Hex ?: JSONObject.NULL)
    put("rewrittenSizeBytes", rewrittenSizeBytes ?: JSONObject.NULL)
    put("rewrittenSha256Hex", rewrittenSha256Hex ?: JSONObject.NULL)
    put("changedFields", JSONArray(changedFields))
  }.toString()

  companion object {
    private val transactionIdRegex = Regex("^[A-Za-z0-9._-]{1,80}$")
    private val sha256Regex = Regex("^[0-9a-f]{64}$")
    private val allowedChangedFields = setOf("title", "artist", "albumArtist", "album", "year", "genre", "trackNumber", "discNumber", "comment", "cover")
    private const val EXPECTED_SCHEMA_VERSION = 1

    fun fromJson(text: String): TransactionJournal = parseAndValidate(text, expectedDirectoryName = null, requireFilesIn = null)

    fun parseAndValidate(text: String, expectedDirectoryName: String?, requireFilesIn: File?): TransactionJournal {
      require(text.toByteArray(Charsets.UTF_8).size <= TransactionStorage.MAX_JOURNAL_BYTES) { "journal too large" }
      val o = JSONObject(text)
      val schemaVersion = o.getInt("schemaVersion")
      require(schemaVersion == EXPECTED_SCHEMA_VERSION) { "unsupported journal schema" }
      val transactionId = o.getString("transactionId")
      require(transactionIdRegex.matches(transactionId)) { "invalid transaction id" }
      if (expectedDirectoryName != null) require(transactionId == expectedDirectoryName) { "transaction id mismatch" }
      val targetUri = o.getString("targetUri")
      val parsedUri = Uri.parse(targetUri)
      require(parsedUri.scheme == "content" && !parsedUri.authority.isNullOrBlank()) { "invalid target uri" }
      val state = TransactionState.valueOf(o.getString("state"))
      val createdAt = o.getLong("createdAtEpochMs")
      val updatedAt = o.getLong("updatedAtEpochMs")
      require(createdAt >= 0 && updatedAt >= 0) { "invalid timestamps" }
      fun optSize(name: String): Long? = if (o.isNull(name)) null else o.getLong(name).also { require(it >= 0) { "invalid size" } }
      fun optSha(name: String): String? = if (o.isNull(name)) null else o.getString(name).lowercase().also { require(sha256Regex.matches(it)) { "invalid digest" } }
      val fieldsJson = o.optJSONArray("changedFields") ?: JSONArray()
      val changedFields = (0 until fieldsJson.length()).map { fieldsJson.getString(it) }
      require(changedFields.all { it in allowedChangedFields }) { "invalid changed field" }
      val journal = TransactionJournal(
        schemaVersion = schemaVersion,
        transactionId = transactionId,
        targetUri = targetUri,
        state = state,
        createdAtEpochMs = createdAt,
        updatedAtEpochMs = updatedAt,
        originalSizeBytes = optSize("originalSizeBytes"),
        originalSha256Hex = optSha("originalSha256Hex"),
        rewrittenSizeBytes = optSize("rewrittenSizeBytes"),
        rewrittenSha256Hex = optSha("rewrittenSha256Hex"),
        changedFields = changedFields,
      )
      journal.validateForState(requireFilesIn)
      return journal
    }
  }

  fun validateForState(dir: File? = null) {
    fun requireOriginal() {
      require(originalSizeBytes != null && originalSha256Hex != null) { "original digest missing" }
      if (dir != null) require(File(dir, "original.bin").isFile) { "original backup missing" }
    }
    fun requireRewritten() {
      require(rewrittenSizeBytes != null && rewrittenSha256Hex != null) { "rewritten digest missing" }
      if (dir != null && state != TransactionState.COMMITTED) require(File(dir, "rewritten.bin").isFile) { "rewritten backup missing" }
    }
    when (state) {
      TransactionState.PREPARING -> Unit
      TransactionState.BACKUP_READY -> requireOriginal()
      TransactionState.WRITE_STARTED, TransactionState.WRITTEN_UNVERIFIED, TransactionState.RECOVERY_REQUIRED, TransactionState.RECOVERY_FAILED, TransactionState.RECOVERED -> {
        requireOriginal()
        requireRewritten()
      }
      TransactionState.COMMITTED -> requireRewritten()
    }
  }
}

interface SafContentStore {
  fun openInput(uri: Uri): InputStream?
  fun openTruncatingOutput(uri: Uri): OutputStream?
  fun sync(output: OutputStream)
  fun hasWritePermission(uri: Uri): Boolean
  fun isWritable(uri: Uri): Boolean
  fun size(uri: Uri): Long?
}

interface DirectoryDurabilitySync {
  fun sync(directory: File)
}

object AndroidDirectoryDurabilitySync : DirectoryDurabilitySync {
  override fun sync(directory: File) {
    if (!directory.exists() || !directory.isDirectory) throw java.io.IOException("directory sync target is invalid")
    val fd = Os.open(directory.absolutePath, OsConstants.O_RDONLY or OsConstants.O_DIRECTORY or OsConstants.O_CLOEXEC, 0)
    try {
      Os.fsync(fd)
    } finally {
      Os.close(fd)
    }
  }
}

class TransactionStorage(private val root: File, private val directorySync: DirectoryDurabilitySync = AndroidDirectoryDurabilitySync) {
  companion object { const val MAX_JOURNAL_BYTES = 64 * 1024 }
  private val quarantineRoot = File(root.parentFile ?: root, "audio-tag-transactions-quarantine")

  init {
    if (!root.exists() && !root.mkdirs()) throw java.io.IOException("transaction root mkdir failed")
    syncDirectory(root.parentFile ?: root)
  }

  fun createDir(): File {
    val dir = File(root, UUID.randomUUID().toString())
    if (!dir.mkdirs()) throw java.io.IOException("transaction directory mkdir failed")
    syncDirectory(root)
    return dir
  }

  fun dirs(): List<File> = root.listFiles()?.filter { it.isDirectory }?.sortedBy { it.name } ?: emptyList()
  fun original(dir: File) = File(dir, "original.bin")
  fun rewritten(dir: File) = File(dir, "rewritten.bin")
  fun journal(dir: File) = File(dir, "journal.json")
  fun journalTmp(dir: File) = File(dir, "journal.tmp")

  fun atomicWriteJournal(dir: File, journal: TransactionJournal) {
    if (!dir.exists() && !dir.mkdirs()) throw java.io.IOException("transaction directory mkdir failed")
    syncDirectory(dir.parentFile ?: root)
    val tmp = journalTmp(dir)
    FileOutputStream(tmp).use { out ->
      val data = journal.toJson().toByteArray(Charsets.UTF_8)
      out.write(data)
      out.flush()
      out.fd.sync()
    }
    promote(tmp, journal(dir))
  }

  fun promote(tmp: File, target: File) {
    if (!tmp.renameTo(target)) throw java.io.IOException("rename failed: ${tmp.name}")
    syncDirectory(target.parentFile ?: root)
  }

  fun readJournalSafely(dir: File): TransactionJournal? {
    return try {
      val journalFile = journal(dir).takeIf { it.isFile } ?: return null
      if (journalFile.length() > MAX_JOURNAL_BYTES) return null
      TransactionJournal.parseAndValidate(journalFile.readText(Charsets.UTF_8), dir.name, dir)
    } catch (_: Throwable) {
      null
    }
  }

  fun quarantinedDirs(): List<File> = quarantineRoot.listFiles()?.filter { it.isDirectory }?.sortedBy { it.name } ?: emptyList()

  fun quarantineDamaged(dir: File): File {
    if (!quarantineRoot.exists() && !quarantineRoot.mkdirs()) throw java.io.IOException("quarantine mkdir failed")
    syncDirectory(quarantineRoot.parentFile ?: root)
    val target = File(quarantineRoot, "${dir.name}-${System.currentTimeMillis()}")
    if (!dir.renameTo(target)) throw java.io.IOException("quarantine rename failed")
    File(target, "quarantine.json").writeText(JSONObject().put("transactionId", dir.name).put("reason", "damaged-journal").put("quarantinedAtEpochMs", System.currentTimeMillis()).toString(), Charsets.UTF_8)
    syncDirectory(quarantineRoot)
    syncDirectory(root)
    return target
  }

  fun cleanup(dir: File) {
    if (dir.exists() && !dir.deleteRecursively()) throw java.io.IOException("transaction cleanup failed")
    syncDirectory(dir.parentFile ?: root)
  }

  fun markRecoveryState(dir: File, journal: TransactionJournal, state: TransactionState): TransactionJournal {
    val next = journal.withState(state)
    atomicWriteJournal(dir, next)
    return next
  }

  fun availableBytes(): Long = try { StatFs(root.absolutePath).availableBytes } catch (_: Throwable) { Long.MAX_VALUE }

  private fun syncDirectory(dir: File) {
    if (!dir.exists()) return
    try {
      directorySync.sync(dir)
    } catch (e: Throwable) {
      throw java.io.IOException("directory sync failed", e)
    }
  }
}

object StreamDigests {
  private const val BUFFER_SIZE = 64 * 1024
  fun hashFile(file: File, maxBytes: Long): DigestInfo = FileInputStream(file).use { hashStream(it, maxBytes) }
  fun hashUri(store: SafContentStore, uri: Uri, maxBytes: Long): DigestInfo? = store.openInput(uri)?.use { hashStream(it, maxBytes) }
  fun copyUriToFileWithDigest(store: SafContentStore, uri: Uri, tmp: File, maxBytes: Long): DigestInfo? = store.openInput(uri)?.use { input -> copyToFile(input, tmp, maxBytes) }
  fun copyFileToUriWithDigest(file: File, store: SafContentStore, uri: Uri, maxBytes: Long): DigestInfo? = store.openTruncatingOutput(uri)?.use { output ->
    val digest = MessageDigest.getInstance("SHA-256")
    var total = 0L
    val buffer = ByteArray(BUFFER_SIZE)
    FileInputStream(file).use { input ->
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        total += read
        if (total > maxBytes) throw SizeLimitException()
        digest.update(buffer, 0, read)
        output.write(buffer, 0, read)
      }
    }
    output.flush()
    store.sync(output)
    DigestInfo(total, digest.hex())
  }
  fun decodeBase64ToFileWithDigest(base64: String, tmp: File, maxBytes: Long): DigestInfo {
    val input = android.util.Base64InputStream(base64.byteInputStream(Charsets.US_ASCII), Base64.DEFAULT)
    return input.use { copyToFile(it, tmp, maxBytes) }
  }
  fun verifyFile(file: File, expected: DigestInfo, maxBytes: Long): Boolean = file.isFile && hashFile(file, maxBytes) == expected
  private fun copyToFile(input: InputStream, tmp: File, maxBytes: Long): DigestInfo {
    val digest = MessageDigest.getInstance("SHA-256")
    var total = 0L
    val buffer = ByteArray(BUFFER_SIZE)
    FileOutputStream(tmp).use { out ->
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        total += read
        if (total > maxBytes) throw SizeLimitException()
        digest.update(buffer, 0, read)
        out.write(buffer, 0, read)
      }
      out.flush()
      out.fd.sync()
    }
    return DigestInfo(total, digest.hex())
  }
  private fun hashStream(input: InputStream, maxBytes: Long): DigestInfo {
    val digest = MessageDigest.getInstance("SHA-256")
    var total = 0L
    val buffer = ByteArray(BUFFER_SIZE)
    while (true) {
      val read = input.read(buffer)
      if (read < 0) break
      total += read
      if (total > maxBytes) throw SizeLimitException()
      digest.update(buffer, 0, read)
    }
    return DigestInfo(total, digest.hex())
  }
  private fun MessageDigest.hex() = digest().joinToString("") { "%02x".format(it) }
}
class SizeLimitException: java.io.IOException("size limit exceeded")

data class TransactionWriteRequest(val uri: Uri, val rewrittenBase64: String, val changedFields: List<String>, val maxBytes: Long, val expectedOriginalSize: Long?, val expectedOriginalSha256: String?, val expectedWrittenSize: Long?, val expectedWrittenSha256: String? = null)
data class TransactionResult(val success: Boolean, val errorCode: String?, val message: String, val verified: Boolean=false, val bytesBefore: Long?=null, val bytesAfter: Long?=null, val transactionId: String?=null, val recoveryPending: Boolean=false, val recovered: Boolean=false, val cleanupPending: Boolean=false)

data class RestoreResult(val restored: Boolean, val verified: Boolean, val recoveryPending: Boolean, val errorCode: String?, val message: String)

data class RecoveryTransactionReport(val transactionId: String, val previousState: String?, val resultState: String?, val recovered: Boolean, val pending: Boolean, val errorCode: String?)
data class RecoverySummary(val success: Boolean, val recoveredCount: Int, val cleanedCount: Int, val pendingCount: Int, val failedCount: Int, val transactions: List<RecoveryTransactionReport>) {
  fun toMap(): Map<String, Any?> = mapOf(
    "success" to success,
    "recoveredCount" to recoveredCount,
    "cleanedCount" to cleanedCount,
    "pendingCount" to pendingCount,
    "failedCount" to failedCount,
    "transactions" to transactions.map { mapOf("transactionId" to it.transactionId, "previousState" to it.previousState, "resultState" to it.resultState, "recovered" to it.recovered, "pending" to it.pending, "errorCode" to it.errorCode) },
  )
}

class AudioTagTransactionManager(private val storage: TransactionStorage, private val store: SafContentStore, private val safetyMarginBytes: Long = 1024 * 1024) {
  private val lock = ReentrantLock()

  fun recoverPending(targetUri: Uri? = null): TransactionResult = lock.withLock {
    val summary = recoverPendingLocked(targetUri)
    TransactionResult(
      success = summary.success,
      errorCode = if (summary.success) null else "RecoveryPending",
      message = "Recovered ${summary.recoveredCount}, cleaned ${summary.cleanedCount}, pending ${summary.pendingCount}, failed ${summary.failedCount} SAF transaction(s).",
      recoveryPending = summary.pendingCount > 0 || summary.failedCount > 0,
      recovered = summary.recoveredCount > 0,
    )
  }

  fun recoverPendingSummary(targetUri: Uri? = null): RecoverySummary = lock.withLock { recoverPendingLocked(targetUri) }

  fun status(): Map<String, Any?> = lock.withLock {
    val transactions = storage.dirs().map { dir ->
      val journal = storage.readJournalSafely(dir)
      mapOf("transactionId" to dir.name, "state" to (journal?.state?.name ?: "INVALID"))
    }
    mapOf("pendingCount" to transactions.size, "quarantineCount" to storage.quarantinedDirs().size, "transactions" to transactions)
  }

  fun write(req: TransactionWriteRequest): TransactionResult = lock.withLock {
    val recovery = recoverPendingLocked(req.uri)
    if (!recovery.success) {
      return@withLock TransactionResult(false, "RecoveryPending", "Pending recovery must complete before writing this SAF document.", recoveryPending = true)
    }
    if (!store.hasWritePermission(req.uri) || !store.isWritable(req.uri)) {
      return@withLock TransactionResult(false, "MissingWritePermission", "No writable SAF permission is available.")
    }
    val expectedSpace = (store.size(req.uri) ?: 0L) + (req.expectedWrittenSize ?: 0L) + safetyMarginBytes
    if (storage.availableBytes() < expectedSpace) {
      return@withLock TransactionResult(false, "InsufficientStorage", "Insufficient app-private storage for durable transaction.")
    }

    val dir = storage.createDir()
    var phase = WriteExecutionPhase.PREPARING
    var journal = TransactionJournal(transactionId = dir.name, targetUri = req.uri.toString(), state = TransactionState.PREPARING, createdAtEpochMs = System.currentTimeMillis(), updatedAtEpochMs = System.currentTimeMillis(), changedFields = req.changedFields)
    try {
      storage.atomicWriteJournal(dir, journal)
      val originalTmp = File(dir, "original.tmp")
      val originalDigest = StreamDigests.copyUriToFileWithDigest(store, req.uri, originalTmp, req.maxBytes)
        ?: return@withLock cleanupUnmodifiedTransaction(dir, journal, "BackupFailed", "Original could not be backed up.")
      if (req.expectedOriginalSize != null && req.expectedOriginalSize != originalDigest.sizeBytes) {
        return@withLock cleanupUnmodifiedTransaction(dir, journal, "VerificationFailed", "Original size changed before write.", originalDigest.sizeBytes)
      }
      if (req.expectedOriginalSha256.isNullOrBlank() || req.expectedOriginalSha256.lowercase() != originalDigest.sha256Hex) {
        return@withLock cleanupUnmodifiedTransaction(dir, journal, "VerificationFailed", "Original content changed before write.", originalDigest.sizeBytes)
      }
      if (!StreamDigests.verifyFile(originalTmp, originalDigest, req.maxBytes)) {
        return@withLock cleanupUnmodifiedTransaction(dir, journal, "BackupFailed", "Original backup verification failed.", originalDigest.sizeBytes)
      }
      storage.promote(originalTmp, storage.original(dir))
      journal = journal.copy(state = TransactionState.BACKUP_READY, updatedAtEpochMs = System.currentTimeMillis(), originalSizeBytes = originalDigest.sizeBytes, originalSha256Hex = originalDigest.sha256Hex)
      storage.atomicWriteJournal(dir, journal)
      phase = WriteExecutionPhase.BACKUP_DURABLE

      val rewrittenTmp = File(dir, "rewritten.tmp")
      val rewrittenDigest = try {
        StreamDigests.decodeBase64ToFileWithDigest(req.rewrittenBase64, rewrittenTmp, req.maxBytes)
      } catch (_: IllegalArgumentException) {
        return@withLock cleanupUnmodifiedTransaction(dir, journal, "InvalidTagData", "Rewritten payload is not valid base64.", originalDigest.sizeBytes)
      }
      if (rewrittenDigest.sizeBytes <= 0) {
        return@withLock cleanupUnmodifiedTransaction(dir, journal, "InvalidTagData", "Rewritten audio payload is empty.", originalDigest.sizeBytes)
      }
      if (req.expectedWrittenSize != null && req.expectedWrittenSize != rewrittenDigest.sizeBytes) {
        return@withLock cleanupUnmodifiedTransaction(dir, journal, "VerificationFailed", "Rewritten size does not match expected payload.", originalDigest.sizeBytes, rewrittenDigest.sizeBytes)
      }
      if (!req.expectedWrittenSha256.isNullOrBlank() && req.expectedWrittenSha256.lowercase() != rewrittenDigest.sha256Hex) {
        return@withLock cleanupUnmodifiedTransaction(dir, journal, "VerificationFailed", "Rewritten digest does not match expected payload.", originalDigest.sizeBytes, rewrittenDigest.sizeBytes)
      }
      if (!StreamDigests.verifyFile(rewrittenTmp, rewrittenDigest, req.maxBytes)) {
        return@withLock cleanupUnmodifiedTransaction(dir, journal, "TempWriteFailed", "Rewritten staging verification failed.", originalDigest.sizeBytes, rewrittenDigest.sizeBytes)
      }
      storage.promote(rewrittenTmp, storage.rewritten(dir))
      journal = journal.copy(rewrittenSizeBytes = rewrittenDigest.sizeBytes, rewrittenSha256Hex = rewrittenDigest.sha256Hex, updatedAtEpochMs = System.currentTimeMillis())
      storage.atomicWriteJournal(dir, journal)
      phase = WriteExecutionPhase.REWRITE_DURABLE

      val backupDigest = verifyOriginalBackupBeforeRestore(dir, journal, req.maxBytes)
        ?: return@withLock cleanupUnmodifiedTransaction(dir, journal, "BackupCorrupted", "Original backup verification failed before write.", originalDigest.sizeBytes, rewrittenDigest.sizeBytes)
      val liveDigest = StreamDigests.hashUri(store, req.uri, req.maxBytes)
        ?: return@withLock cleanupUnmodifiedTransaction(dir, journal, "UnsupportedUri", "Original could not be re-read.", originalDigest.sizeBytes, rewrittenDigest.sizeBytes)
      if (liveDigest != backupDigest) {
        return@withLock cleanupUnmodifiedTransaction(dir, journal, "VerificationFailed", "Original changed after backup; write aborted.", originalDigest.sizeBytes, rewrittenDigest.sizeBytes)
      }

      journal = journal.withState(TransactionState.WRITE_STARTED)
      storage.atomicWriteJournal(dir, journal)
      phase = WriteExecutionPhase.WRITE_INTENT_DURABLE

      try {
        phase = WriteExecutionPhase.TARGET_MUTATION_STARTED
        StreamDigests.copyFileToUriWithDigest(storage.rewritten(dir), store, req.uri, req.maxBytes)
          ?: throw java.io.IOException("provider refused output")
        phase = WriteExecutionPhase.TARGET_SYNCED
        journal = journal.withState(TransactionState.WRITTEN_UNVERIFIED)
        storage.atomicWriteJournal(dir, journal)
        val after = StreamDigests.hashUri(store, req.uri, req.maxBytes)
        if (after != rewrittenDigest) {
          return@withLock handleFailureAfterWriteIntent(dir, journal, "VerificationFailed", "Written SAF document failed verification.", req.maxBytes)
        }
        phase = WriteExecutionPhase.TARGET_VERIFIED
        journal = journal.withState(TransactionState.COMMITTED)
        storage.atomicWriteJournal(dir, journal)
        phase = WriteExecutionPhase.COMMITTED_DURABLE
      } catch (e: Throwable) {
        return@withLock handleFailureAfterWriteIntent(dir, journal, if (e is SizeLimitException) "VerificationFailed" else "ReplaceFailed", "SAF write failed; original restored if possible.", req.maxBytes)
      }
      try {
        storage.cleanup(dir)
      } catch (_: Throwable) {
        return@withLock TransactionResult(true, null, "Tags written and verified; committed transaction cleanup will be retried.", true, originalDigest.sizeBytes, rewrittenDigest.sizeBytes, journal.transactionId, cleanupPending = true)
      }
      TransactionResult(true, null, "Tags written and verified.", true, originalDigest.sizeBytes, rewrittenDigest.sizeBytes, journal.transactionId)
    } catch (e: Throwable) {
      if (phase.ordinal >= WriteExecutionPhase.WRITE_INTENT_DURABLE.ordinal) {
        handleFailureAfterWriteIntent(dir, journal, if (e is SizeLimitException) "VerificationFailed" else "ReplaceFailed", "SAF transaction failed after write intent; original restored if possible.", req.maxBytes)
      } else {
        cleanupUnmodifiedTransaction(dir, journal, if (e is SizeLimitException) "FileTooLarge" else "ReplaceFailed", if (e is SizeLimitException) "File exceeds the safe tag write size limit." else "SAF transaction failed: ${e.message}")
      }
    }
  }

  private fun cleanupUnmodifiedTransaction(dir: File, journal: TransactionJournal, code: String, message: String, before: Long? = null, after: Long? = null): TransactionResult {
    require(journal.state == TransactionState.PREPARING || journal.state == TransactionState.BACKUP_READY) { "cleanup is forbidden after target write intent" }
    storage.cleanup(dir)
    return TransactionResult(false, code, message, bytesBefore = before, bytesAfter = after)
  }

  private fun handleFailureAfterWriteIntent(dir: File, journal: TransactionJournal, code: String, message: String, maxBytes: Long): TransactionResult =
    rollbackFailedWrite(dir, journal, code, message, maxBytes)

  private fun rollbackFailedWrite(dir: File, journal: TransactionJournal, code: String, message: String, maxBytes: Long): TransactionResult {
    val restore = restoreOriginal(dir, journal, maxBytes, recoveryErrorCode = "RollbackFailed")
    return if (restore.restored && restore.verified) {
      TransactionResult(false, code, message, bytesBefore = journal.originalSizeBytes, bytesAfter = journal.rewrittenSizeBytes, recovered = true, recoveryPending = false)
    } else {
      TransactionResult(false, restore.errorCode ?: "RollbackFailed", restore.message, bytesBefore = journal.originalSizeBytes, bytesAfter = journal.rewrittenSizeBytes, recoveryPending = true)
    }
  }

  private fun recoverCrashedTransaction(dir: File, journal: TransactionJournal): TransactionResult {
    val restore = restoreOriginal(dir, journal, Long.MAX_VALUE, recoveryErrorCode = "RecoveryFailed")
    return if (restore.restored && restore.verified) {
      TransactionResult(true, null, "Pending SAF transaction recovered.", bytesBefore = journal.originalSizeBytes, bytesAfter = journal.rewrittenSizeBytes, recovered = true)
    } else {
      TransactionResult(false, restore.errorCode ?: "RecoveryFailed", restore.message, bytesBefore = journal.originalSizeBytes, bytesAfter = journal.rewrittenSizeBytes, recoveryPending = true)
    }
  }

  private fun restoreOriginal(dir: File, journal: TransactionJournal, maxBytes: Long, recoveryErrorCode: String): RestoreResult {
    val uri = Uri.parse(journal.targetUri)
    if (!store.hasWritePermission(uri) || !store.isWritable(uri)) {
      return RestoreResult(false, false, true, "RecoveryPending", "Recovery permission is missing.")
    }
    val expected = verifyOriginalBackupBeforeRestore(dir, journal, maxBytes) ?: run {
      markRecoveryFailed(dir, journal, "BackupCorrupted", "Original backup is corrupted; target was not modified by recovery.")
      return RestoreResult(false, false, true, "BackupCorrupted", "Original backup is corrupted; target was not modified by recovery.")
    }
    return try {
      StreamDigests.copyFileToUriWithDigest(storage.original(dir), store, uri, maxBytes)
      val restored = StreamDigests.hashUri(store, uri, maxBytes)
      if (restored == expected) {
        storage.markRecoveryState(dir, journal, TransactionState.RECOVERED)
        storage.cleanup(dir)
        RestoreResult(restored = true, verified = true, recoveryPending = false, errorCode = null, message = "Original restored and verified.")
      } else {
        storage.markRecoveryState(dir, journal, TransactionState.RECOVERY_REQUIRED)
        RestoreResult(restored = false, verified = false, recoveryPending = true, errorCode = recoveryErrorCode, message = "Restore verification failed.")
      }
    } catch (_: Throwable) {
      try { storage.markRecoveryState(dir, journal, TransactionState.RECOVERY_FAILED) } catch (_: Throwable) {}
      RestoreResult(restored = false, verified = false, recoveryPending = true, errorCode = recoveryErrorCode, message = "Restore failed and recovery remains pending.")
    }
  }

  private fun verifyOriginalBackupBeforeRestore(dir: File, journal: TransactionJournal, maxBytes: Long): DigestInfo? {
    val expected = DigestInfo(journal.originalSizeBytes ?: return null, journal.originalSha256Hex ?: return null)
    val actual = try { StreamDigests.hashFile(storage.original(dir), maxBytes) } catch (_: Throwable) { return null }
    return actual.takeIf { it == expected }
  }

  private fun markRecoveryFailed(dir: File, journal: TransactionJournal, code: String, message: String): TransactionResult {
    try { storage.markRecoveryState(dir, journal, TransactionState.RECOVERY_FAILED) } catch (_: Throwable) {}
    return TransactionResult(false, code, message, recoveryPending = true)
  }

  private fun recoverPendingLocked(targetUri: Uri? = null): RecoverySummary {
    var recoveredCount = 0
    var cleanedCount = 0
    var pendingCount = 0
    var failedCount = 0
    val reports = mutableListOf<RecoveryTransactionReport>()
    val blockedUris = mutableSetOf<String>()
    for (dir in storage.dirs()) {
      val journal = storage.readJournalSafely(dir)
      if (journal == null) {
        try {
          storage.quarantineDamaged(dir)
          if (targetUri == null) failedCount++
          reports += RecoveryTransactionReport(dir.name, null, "QUARANTINED", recovered = false, pending = false, errorCode = "RecoveryFailed")
        } catch (_: Throwable) {
          if (targetUri == null) pendingCount++
          reports += RecoveryTransactionReport(dir.name, null, "INVALID", recovered = false, pending = targetUri == null, errorCode = "RecoveryPending")
        }
        continue
      }
      if (targetUri != null && journal.targetUri != targetUri.toString()) continue
      if (journal.targetUri in blockedUris) {
        pendingCount++
        reports += RecoveryTransactionReport(journal.transactionId, journal.state.name, journal.state.name, recovered = false, pending = true, errorCode = "RecoveryPending")
        continue
      }
      val result = recoverDir(dir, journal)
      val nextJournal = storage.readJournalSafely(dir)
      if (result.recovered) recoveredCount++
      if (result.success && !result.recovered) cleanedCount++
      if (result.recoveryPending) {
        pendingCount++
        blockedUris += journal.targetUri
      }
      if (!result.success && !result.recoveryPending) failedCount++
      reports += RecoveryTransactionReport(journal.transactionId, journal.state.name, nextJournal?.state?.name ?: if (dir.exists()) journal.state.name else null, result.recovered, result.recoveryPending, result.errorCode)
    }
    return RecoverySummary(pendingCount == 0 && failedCount == 0, recoveredCount, cleanedCount, pendingCount, failedCount, reports)
  }

  private fun recoverDir(dir: File, journal: TransactionJournal): TransactionResult {
    val uri = Uri.parse(journal.targetUri)
    return when (journal.state) {
      TransactionState.PREPARING, TransactionState.BACKUP_READY -> {
        try {
          storage.cleanup(dir)
          TransactionResult(true, null, "Prepared transaction cleaned.")
        } catch (_: Throwable) {
          TransactionResult(false, "RecoveryPending", "Prepared transaction cleanup failed.", recoveryPending = true)
        }
      }
      TransactionState.COMMITTED, TransactionState.RECOVERED -> {
        try {
          storage.cleanup(dir)
          TransactionResult(true, null, "Committed transaction cleaned.")
        } catch (_: Throwable) {
          TransactionResult(false, "RecoveryPending", "Committed transaction cleanup failed.", recoveryPending = true)
        }
      }
      TransactionState.WRITE_STARTED, TransactionState.WRITTEN_UNVERIFIED, TransactionState.RECOVERY_REQUIRED, TransactionState.RECOVERY_FAILED -> {
        if (uri.scheme != "content" || uri.authority.isNullOrBlank()) {
          return markRecoveryFailed(dir, journal, "RecoveryFailed", "Recovery target URI is invalid.")
        }
        recoverCrashedTransaction(dir, journal)
      }
    }
  }
}
