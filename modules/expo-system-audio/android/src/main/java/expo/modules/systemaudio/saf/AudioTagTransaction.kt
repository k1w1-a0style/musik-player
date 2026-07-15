package expo.modules.systemaudio.saf

import android.net.Uri
import android.os.StatFs
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
    put("schemaVersion", schemaVersion); put("transactionId", transactionId); put("targetUri", targetUri); put("state", state.name)
    put("createdAtEpochMs", createdAtEpochMs); put("updatedAtEpochMs", updatedAtEpochMs)
    put("originalSizeBytes", originalSizeBytes ?: JSONObject.NULL); put("originalSha256Hex", originalSha256Hex ?: JSONObject.NULL)
    put("rewrittenSizeBytes", rewrittenSizeBytes ?: JSONObject.NULL); put("rewrittenSha256Hex", rewrittenSha256Hex ?: JSONObject.NULL)
    put("changedFields", JSONArray(changedFields))
  }.toString()
  companion object {
    fun fromJson(text: String): TransactionJournal {
      val o = JSONObject(text)
      val fields = o.optJSONArray("changedFields") ?: JSONArray()
      return TransactionJournal(
        schemaVersion = o.getInt("schemaVersion"), transactionId = o.getString("transactionId"), targetUri = o.getString("targetUri"),
        state = TransactionState.valueOf(o.getString("state")), createdAtEpochMs = o.getLong("createdAtEpochMs"), updatedAtEpochMs = o.getLong("updatedAtEpochMs"),
        originalSizeBytes = if (o.isNull("originalSizeBytes")) null else o.getLong("originalSizeBytes"), originalSha256Hex = if (o.isNull("originalSha256Hex")) null else o.getString("originalSha256Hex"),
        rewrittenSizeBytes = if (o.isNull("rewrittenSizeBytes")) null else o.getLong("rewrittenSizeBytes"), rewrittenSha256Hex = if (o.isNull("rewrittenSha256Hex")) null else o.getString("rewrittenSha256Hex"),
        changedFields = (0 until fields.length()).mapNotNull { fields.optString(it).takeIf(String::isNotBlank) },
      )
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

class TransactionStorage(private val root: File) {
  init { root.mkdirs() }
  fun createDir(): File { val dir = File(root, UUID.randomUUID().toString()); dir.mkdirs(); return dir }
  fun dirs(): List<File> = root.listFiles()?.filter { it.isDirectory } ?: emptyList()
  fun original(dir: File) = File(dir, "original.bin")
  fun rewritten(dir: File) = File(dir, "rewritten.bin")
  fun journal(dir: File) = File(dir, "journal.json")
  fun atomicWriteJournal(dir: File, journal: TransactionJournal) {
    dir.mkdirs(); val tmp = File(dir, "journal.tmp")
    FileOutputStream(tmp).use { out -> val data = journal.toJson().toByteArray(Charsets.UTF_8); out.write(data); out.flush(); out.fd.sync() }
    if (!tmp.renameTo(journal(dir))) throw java.io.IOException("journal rename failed")
  }
  fun readJournalSafely(dir: File): TransactionJournal? = try { journal(dir).takeIf { it.isFile }?.readText(Charsets.UTF_8)?.let(TransactionJournal::fromJson) } catch (_: Throwable) { null }
  fun cleanup(dir: File) { dir.deleteRecursively() }
  fun availableBytes(): Long = try { StatFs(root.absolutePath).availableBytes } catch (_: Throwable) { Long.MAX_VALUE }
}

object StreamDigests {
  private const val BUFFER_SIZE = 64 * 1024
  fun hashFile(file: File, maxBytes: Long): DigestInfo = FileInputStream(file).use { hashStream(it, maxBytes) }
  fun hashUri(store: SafContentStore, uri: Uri, maxBytes: Long): DigestInfo? = store.openInput(uri)?.use { hashStream(it, maxBytes) }
  fun copyUriToFileWithDigest(store: SafContentStore, uri: Uri, tmp: File, maxBytes: Long): DigestInfo? = store.openInput(uri)?.use { input -> copyToFile(input, tmp, maxBytes) }
  fun copyFileToUriWithDigest(file: File, store: SafContentStore, uri: Uri, maxBytes: Long): DigestInfo? = store.openTruncatingOutput(uri)?.use { output ->
    val digest = MessageDigest.getInstance("SHA-256"); var total = 0L; val buffer = ByteArray(BUFFER_SIZE)
    FileInputStream(file).use { input -> while (true) { val read = input.read(buffer); if (read < 0) break; total += read; if (total > maxBytes) throw SizeLimitException(); digest.update(buffer,0,read); output.write(buffer,0,read) } }
    output.flush(); store.sync(output); DigestInfo(total, digest.hex())
  }
  fun decodeBase64ToFileWithDigest(base64: String, tmp: File, maxBytes: Long): DigestInfo {
    val input = android.util.Base64InputStream(base64.byteInputStream(Charsets.US_ASCII), Base64.DEFAULT)
    return input.use { copyToFile(it, tmp, maxBytes) }
  }
  fun verifyFile(file: File, expected: DigestInfo, maxBytes: Long): Boolean = file.isFile && hashFile(file, maxBytes) == expected
  private fun copyToFile(input: InputStream, tmp: File, maxBytes: Long): DigestInfo {
    val digest = MessageDigest.getInstance("SHA-256"); var total = 0L; val buffer = ByteArray(BUFFER_SIZE)
    FileOutputStream(tmp).use { out -> while (true) { val read = input.read(buffer); if (read < 0) break; total += read; if (total > maxBytes) throw SizeLimitException(); digest.update(buffer,0,read); out.write(buffer,0,read) }; out.flush(); out.fd.sync() }
    return DigestInfo(total, digest.hex())
  }
  private fun hashStream(input: InputStream, maxBytes: Long): DigestInfo { val digest = MessageDigest.getInstance("SHA-256"); var total=0L; val b=ByteArray(BUFFER_SIZE); while(true){ val r=input.read(b); if(r<0) break; total+=r; if(total>maxBytes) throw SizeLimitException(); digest.update(b,0,r)}; return DigestInfo(total,digest.hex()) }
  private fun MessageDigest.hex() = digest().joinToString("") { "%02x".format(it) }
}
class SizeLimitException: java.io.IOException("size limit exceeded")


data class TransactionWriteRequest(val uri: Uri, val rewrittenBase64: String, val changedFields: List<String>, val maxBytes: Long, val expectedOriginalSize: Long?, val expectedOriginalSha256: String?, val expectedWrittenSize: Long?, val expectedWrittenSha256: String? = null)
data class TransactionResult(val success: Boolean, val errorCode: String?, val message: String, val verified: Boolean=false, val bytesBefore: Long?=null, val bytesAfter: Long?=null, val transactionId: String?=null, val recoveryPending: Boolean=false, val recovered: Boolean=false)

class AudioTagTransactionManager(private val storage: TransactionStorage, private val store: SafContentStore, private val safetyMarginBytes: Long = 1024 * 1024) {
  private val lock = ReentrantLock()
  fun recoverPending(targetUri: Uri? = null): TransactionResult = lock.withLock {
    for (dir in storage.dirs()) {
      val journal = storage.readJournalSafely(dir) ?: return@withLock TransactionResult(false, "RecoveryPending", "A damaged transaction journal is quarantined.", recoveryPending = true)
      if (targetUri == null || journal.targetUri == targetUri.toString()) {
        val result = recoverDir(dir, journal)
        if (!result.success || result.recoveryPending) return@withLock result
      }
    }
    TransactionResult(true, null, "No pending recovery.", recovered = false)
  }
  fun status(): Map<String, Any?> = lock.withLock { mapOf("pendingCount" to storage.dirs().size, "transactions" to storage.dirs().mapNotNull { d -> storage.readJournalSafely(d)?.let { mapOf("transactionId" to it.transactionId, "state" to it.state.name) } }) }
  fun write(req: TransactionWriteRequest): TransactionResult = lock.withLock {
    val recovery = recoverPending(req.uri); if (!recovery.success || recovery.recoveryPending) return@withLock recovery
    if (!store.hasWritePermission(req.uri) || !store.isWritable(req.uri)) return@withLock TransactionResult(false, "MissingWritePermission", "No writable SAF permission is available.")
    val expectedSpace = (store.size(req.uri) ?: 0L) + (req.expectedWrittenSize ?: 0L) + safetyMarginBytes
    if (storage.availableBytes() < expectedSpace) return@withLock TransactionResult(false, "InsufficientStorage", "Insufficient app-private storage for durable transaction.")
    val dir = storage.createDir(); var journal = TransactionJournal(transactionId = dir.name, targetUri = req.uri.toString(), state = TransactionState.PREPARING, createdAtEpochMs = System.currentTimeMillis(), updatedAtEpochMs = System.currentTimeMillis(), changedFields = req.changedFields)
    try {
      storage.atomicWriteJournal(dir, journal)
      val originalTmp = File(dir, "original.tmp"); val originalDigest = StreamDigests.copyUriToFileWithDigest(store, req.uri, originalTmp, req.maxBytes) ?: return failCleanup(dir, "BackupFailed", "Original could not be backed up.")
      if (req.expectedOriginalSize != null && req.expectedOriginalSize != originalDigest.sizeBytes) return failCleanup(dir, "VerificationFailed", "Original size changed before write.", originalDigest.sizeBytes)
      if (req.expectedOriginalSha256.isNullOrBlank() || req.expectedOriginalSha256.lowercase() != originalDigest.sha256Hex) return failCleanup(dir, "VerificationFailed", "Original content changed before write.", originalDigest.sizeBytes)
      if (!StreamDigests.verifyFile(originalTmp, originalDigest, req.maxBytes) || !originalTmp.renameTo(storage.original(dir))) return failCleanup(dir, "BackupFailed", "Original backup verification failed.", originalDigest.sizeBytes)
      journal = journal.copy(state = TransactionState.BACKUP_READY, updatedAtEpochMs = System.currentTimeMillis(), originalSizeBytes = originalDigest.sizeBytes, originalSha256Hex = originalDigest.sha256Hex); storage.atomicWriteJournal(dir, journal)
      val rewrittenTmp = File(dir, "rewritten.tmp"); val rewrittenDigest = try { StreamDigests.decodeBase64ToFileWithDigest(req.rewrittenBase64, rewrittenTmp, req.maxBytes) } catch (_: IllegalArgumentException) { return failCleanup(dir, "InvalidTagData", "Rewritten payload is not valid base64.", originalDigest.sizeBytes) }
      if (rewrittenDigest.sizeBytes <= 0) return failCleanup(dir, "InvalidTagData", "Rewritten audio payload is empty.", originalDigest.sizeBytes)
      if (req.expectedWrittenSize != null && req.expectedWrittenSize != rewrittenDigest.sizeBytes) return failCleanup(dir, "VerificationFailed", "Rewritten size does not match expected payload.", originalDigest.sizeBytes, rewrittenDigest.sizeBytes)
      if (!req.expectedWrittenSha256.isNullOrBlank() && req.expectedWrittenSha256.lowercase() != rewrittenDigest.sha256Hex) return failCleanup(dir, "VerificationFailed", "Rewritten digest does not match expected payload.", originalDigest.sizeBytes, rewrittenDigest.sizeBytes)
      if (!StreamDigests.verifyFile(rewrittenTmp, rewrittenDigest, req.maxBytes) || !rewrittenTmp.renameTo(storage.rewritten(dir))) return failCleanup(dir, "TempWriteFailed", "Rewritten staging verification failed.", originalDigest.sizeBytes, rewrittenDigest.sizeBytes)
      journal = journal.copy(rewrittenSizeBytes = rewrittenDigest.sizeBytes, rewrittenSha256Hex = rewrittenDigest.sha256Hex, updatedAtEpochMs = System.currentTimeMillis()); storage.atomicWriteJournal(dir, journal)
      val liveDigest = StreamDigests.hashUri(store, req.uri, req.maxBytes) ?: return failCleanup(dir, "UnsupportedUri", "Original could not be re-read.", originalDigest.sizeBytes, rewrittenDigest.sizeBytes)
      if (liveDigest != originalDigest) return failCleanup(dir, "VerificationFailed", "Original changed after backup; write aborted.", originalDigest.sizeBytes, rewrittenDigest.sizeBytes)
      journal = journal.withState(TransactionState.WRITE_STARTED); storage.atomicWriteJournal(dir, journal)
      try { StreamDigests.copyFileToUriWithDigest(storage.rewritten(dir), store, req.uri, req.maxBytes) ?: throw java.io.IOException("provider refused output") } catch (e: Throwable) { return rollback(dir, journal, "ReplaceFailed", "SAF write failed; original restored if possible.", req.maxBytes) }
      journal = journal.withState(TransactionState.WRITTEN_UNVERIFIED); storage.atomicWriteJournal(dir, journal)
      val after = try {
        StreamDigests.hashUri(store, req.uri, req.maxBytes)
      } catch (_: SizeLimitException) {
        null
      }
      if (after != rewrittenDigest) return rollback(dir, journal, "VerificationFailed", "Written SAF document failed verification.", req.maxBytes)
      journal = journal.withState(TransactionState.COMMITTED); storage.atomicWriteJournal(dir, journal); storage.cleanup(dir)
      TransactionResult(true, null, "Tags written and verified.", true, originalDigest.sizeBytes, rewrittenDigest.sizeBytes, journal.transactionId)
    } catch (e: SizeLimitException) { failCleanup(dir, "FileTooLarge", "File exceeds the safe tag write size limit.") } catch (e: Throwable) { failCleanup(dir, "ReplaceFailed", "SAF transaction failed: ${e.message}") }
  }
  private fun failCleanup(dir: File, code: String, message: String, before: Long?=null, after: Long?=null): TransactionResult { storage.cleanup(dir); return TransactionResult(false, code, message, bytesBefore=before, bytesAfter=after) }
  private fun rollback(dir: File, journal: TransactionJournal, code: String, message: String, maxBytes: Long): TransactionResult {
    val uri = Uri.parse(journal.targetUri); return try { StreamDigests.copyFileToUriWithDigest(storage.original(dir), store, uri, maxBytes); val restored = StreamDigests.hashUri(store, uri, maxBytes); if (restored?.sizeBytes == journal.originalSizeBytes && restored.sha256Hex == journal.originalSha256Hex) { storage.atomicWriteJournal(dir, journal.withState(TransactionState.RECOVERED)); storage.cleanup(dir); TransactionResult(false, code, message, bytesBefore=journal.originalSizeBytes, bytesAfter=journal.rewrittenSizeBytes, recovered=true) } else { storage.atomicWriteJournal(dir, journal.withState(TransactionState.RECOVERY_REQUIRED)); TransactionResult(false, "RollbackFailed", "Rollback verification failed.", bytesBefore=journal.originalSizeBytes, bytesAfter=journal.rewrittenSizeBytes, recoveryPending=true) } } catch (_: Throwable) { storage.atomicWriteJournal(dir, journal.withState(TransactionState.RECOVERY_FAILED)); TransactionResult(false, "RollbackFailed", "Rollback failed and recovery remains pending.", bytesBefore=journal.originalSizeBytes, bytesAfter=journal.rewrittenSizeBytes, recoveryPending=true) }
  }
  private fun recoverDir(dir: File, journal: TransactionJournal): TransactionResult {
    val uri = Uri.parse(journal.targetUri)
    if (journal.state == TransactionState.PREPARING || journal.state == TransactionState.BACKUP_READY) { storage.cleanup(dir); return TransactionResult(true, null, "Prepared transaction cleaned.") }
    if (!store.hasWritePermission(uri) || !store.isWritable(uri)) return TransactionResult(false, "RecoveryPending", "Recovery permission is missing.", recoveryPending = true)
    if (journal.state == TransactionState.COMMITTED) { val expected = journal.rewrittenSizeBytes?.let { sz -> journal.rewrittenSha256Hex?.let { DigestInfo(sz, it) } }; val live = StreamDigests.hashUri(store, uri, Long.MAX_VALUE); if (expected != null && live == expected) { storage.cleanup(dir); return TransactionResult(true, null, "Committed transaction cleaned.") } }
    if (!storage.original(dir).isFile) { storage.atomicWriteJournal(dir, journal.withState(TransactionState.RECOVERY_FAILED)); return TransactionResult(false, "RecoveryFailed", "Original backup is missing.", recoveryPending = true) }
    return rollback(dir, journal, "RecoveryFailed", "Pending SAF transaction recovered.", Long.MAX_VALUE)
  }
}
