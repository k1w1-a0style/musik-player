package expo.modules.systemaudio.saf

import android.net.Uri
import android.os.StatFs
import android.system.Os
import android.system.OsConstants
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.security.MessageDigest
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantLock
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.withLock

enum class TransactionState {
  PREPARING,
  BACKUP_READY,
  WRITE_STARTED,
  WRITTEN_UNVERIFIED,
  COMMITTED,
  RECOVERY_REQUIRED,
  RECOVERY_FAILED,
  RECOVERED,
}

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

data class DigestInfo(
  val sizeBytes: Long,
  val sha256Hex: String,
)

data class TransactionJournal(
  val schemaVersion: Int = 2,
  val transactionId: String,
  val targetUri: String,
  val state: TransactionState,
  val createdAtEpochMs: Long,
  val updatedAtEpochMs: Long,
  val maxBytes: Long = MAX_SAFE_TAG_WRITE_FILE_BYTES,
  val originalSizeBytes: Long? = null,
  val originalSha256Hex: String? = null,
  val rewrittenSizeBytes: Long? = null,
  val rewrittenSha256Hex: String? = null,
  val changedFields: List<String> = emptyList(),
) {
  fun withState(nextState: TransactionState): TransactionJournal = copy(
    state = nextState,
    updatedAtEpochMs = System.currentTimeMillis(),
  )

  fun toJson(): String = JSONObject().apply {
    put("schemaVersion", schemaVersion)
    put("transactionId", transactionId)
    put("targetUri", targetUri)
    put("state", state.name)
    put("createdAtEpochMs", createdAtEpochMs)
    put("updatedAtEpochMs", updatedAtEpochMs)
    put("maxBytes", maxBytes)
    put("originalSizeBytes", originalSizeBytes ?: JSONObject.NULL)
    put("originalSha256Hex", originalSha256Hex ?: JSONObject.NULL)
    put("rewrittenSizeBytes", rewrittenSizeBytes ?: JSONObject.NULL)
    put("rewrittenSha256Hex", rewrittenSha256Hex ?: JSONObject.NULL)
    put("changedFields", JSONArray(changedFields))
  }.toString()

  fun validateForState(directory: File? = null) {
    require(maxBytes in 1..MAX_SAFE_TAG_WRITE_FILE_BYTES) { "invalid max bytes" }

    fun requireOriginal(requireFile: Boolean) {
      require(originalSizeBytes != null && originalSha256Hex != null) { "original digest missing" }
      if (requireFile && directory != null) {
        require(File(directory, TransactionStorage.ORIGINAL_FILE).isFile) { "original backup missing" }
      }
    }

    fun requireRewritten(requireFile: Boolean) {
      require(rewrittenSizeBytes != null && rewrittenSha256Hex != null) { "rewritten digest missing" }
      if (requireFile && directory != null) {
        require(File(directory, TransactionStorage.REWRITTEN_FILE).isFile) { "rewritten payload missing" }
      }
    }

    when (state) {
      TransactionState.PREPARING -> Unit
      TransactionState.BACKUP_READY -> requireOriginal(requireFile = false)
      TransactionState.WRITE_STARTED,
      TransactionState.WRITTEN_UNVERIFIED,
      TransactionState.RECOVERY_REQUIRED,
      TransactionState.RECOVERY_FAILED,
      -> {
        requireOriginal(requireFile = true)
        requireRewritten(requireFile = true)
      }
      TransactionState.COMMITTED -> requireRewritten(requireFile = false)
      TransactionState.RECOVERED -> {
        requireOriginal(requireFile = false)
        requireRewritten(requireFile = false)
      }
    }
  }

  companion object {
    private const val CURRENT_SCHEMA_VERSION = 2
    private val supportedSchemaVersions = setOf(1, CURRENT_SCHEMA_VERSION)
    private val transactionIdRegex = Regex("^[A-Za-z0-9._-]{1,80}$")
    private val sha256Regex = Regex("^[0-9a-f]{64}$")
    private val allowedChangedFields = setOf(
      "title",
      "artist",
      "albumArtist",
      "album",
      "year",
      "genre",
      "trackNumber",
      "discNumber",
      "comment",
      "cover",
    )

    fun fromJson(text: String): TransactionJournal = parseAndValidate(
      text = text,
      expectedDirectoryName = null,
      requireFilesIn = null,
    )

    fun parseAndValidate(
      text: String,
      expectedDirectoryName: String?,
      requireFilesIn: File?,
    ): TransactionJournal {
      require(text.toByteArray(Charsets.UTF_8).size <= TransactionStorage.MAX_JOURNAL_BYTES) {
        "journal too large"
      }
      val json = JSONObject(text)
      val schemaVersion = json.getInt("schemaVersion")
      require(schemaVersion in supportedSchemaVersions) { "unsupported journal schema" }

      val transactionId = json.getString("transactionId")
      require(transactionIdRegex.matches(transactionId)) { "invalid transaction id" }
      if (expectedDirectoryName != null) {
        require(transactionId == expectedDirectoryName) { "transaction id mismatch" }
      }

      val targetUri = json.getString("targetUri")
      val parsedUri = Uri.parse(targetUri)
      require(parsedUri.scheme == "content" && !parsedUri.authority.isNullOrBlank()) {
        "invalid target uri"
      }

      val state = TransactionState.valueOf(json.getString("state"))
      val createdAtEpochMs = json.getLong("createdAtEpochMs")
      val updatedAtEpochMs = json.getLong("updatedAtEpochMs")
      require(createdAtEpochMs >= 0 && updatedAtEpochMs >= 0) { "invalid timestamps" }

      fun optionalSize(name: String): Long? {
        if (json.isNull(name)) return null
        return json.getLong(name).also { require(it >= 0) { "invalid size" } }
      }

      fun optionalSha(name: String): String? {
        if (json.isNull(name)) return null
        return json.getString(name).lowercase().also {
          require(sha256Regex.matches(it)) { "invalid digest" }
        }
      }

      val fieldsJson = json.optJSONArray("changedFields") ?: JSONArray()
      val changedFields = (0 until fieldsJson.length()).map { fieldsJson.getString(it) }
      require(changedFields.all { it in allowedChangedFields }) { "invalid changed field" }

      val originalSizeBytes = optionalSize("originalSizeBytes")
      val rewrittenSizeBytes = optionalSize("rewrittenSizeBytes")
      val maxBytes = if (schemaVersion >= CURRENT_SCHEMA_VERSION) {
        json.getLong("maxBytes")
      } else {
        // V1 journals predate the persisted budget. The writer was already
        // hard-limited to 50 MiB, so recover under that same finite ceiling.
        MAX_SAFE_TAG_WRITE_FILE_BYTES
      }
      require(maxBytes in 1..MAX_SAFE_TAG_WRITE_FILE_BYTES) { "invalid max bytes" }

      return TransactionJournal(
        schemaVersion = schemaVersion,
        transactionId = transactionId,
        targetUri = targetUri,
        state = state,
        createdAtEpochMs = createdAtEpochMs,
        updatedAtEpochMs = updatedAtEpochMs,
        maxBytes = maxBytes,
        originalSizeBytes = originalSizeBytes,
        originalSha256Hex = optionalSha("originalSha256Hex"),
        rewrittenSizeBytes = rewrittenSizeBytes,
        rewrittenSha256Hex = optionalSha("rewrittenSha256Hex"),
        changedFields = changedFields,
      ).also { it.validateForState(requireFilesIn) }
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
    if (!directory.exists() || !directory.isDirectory) {
      throw IOException("directory sync target is invalid")
    }
    val descriptor = try {
      Os.open(directory.absolutePath, OsConstants.O_RDONLY, 0)
    } catch (error: Throwable) {
      throw IOException("directory open failed", error)
    }
    try {
      Os.fsync(descriptor)
    } catch (error: Throwable) {
      throw IOException("directory fsync failed", error)
    } finally {
      try {
        Os.close(descriptor)
      } catch (_: Throwable) {
        // The fsync result above is authoritative; do not mask it with close noise.
      }
    }
  }
}

private val TAG_WRITE_OPERATION_ID_PATTERN = Regex("^[A-Za-z0-9._-]{1,80}$")

fun isValidTagWriteOperationId(value: String): Boolean =
  value != "." && value != ".." && TAG_WRITE_OPERATION_ID_PATTERN.matches(value)

/**
 * Returns a stable coordination identity without changing the URI sent to the
 * provider. Android document URIs encode their opaque document ID after a
 * `document` (or, for a bare tree URI, `tree`) path marker. Decoding that
 * complete suffix once makes literal and percent-encoded spellings converge,
 * including document IDs which themselves contain slashes.
 *
 * Unknown content-URI shapes deliberately fall back to one authority bucket.
 * This may serialize unrelated unusual URIs, but cannot let aliases on the
 * same provider mutate concurrently. Malformed/non-content URIs share a final
 * fail-closed bucket.
 */
internal fun safTargetKey(uri: Uri): String = try {
  if (!uri.scheme.equals("content", ignoreCase = true)) return "uri:fallback"
  val authority = uri.authority?.takeIf { it.isNotBlank() }
    ?.lowercase(Locale.ROOT)
    ?: return "content:fallback"
  val encodedPath = uri.encodedPath.orEmpty()
  val marker = when {
    encodedPath.contains("/document/") -> "/document/"
    encodedPath.contains("/tree/") -> "/tree/"
    else -> null
  }
  if (marker == null) return "content:$authority:fallback"
  val encodedDocumentId = encodedPath.substringAfter(marker, missingDelimiterValue = "")
  if (encodedDocumentId.isEmpty()) return "content:$authority:fallback"
  "content:$authority:document:${Uri.decode(encodedDocumentId)}"
} catch (_: Throwable) {
  val authority = try { uri.authority?.lowercase(Locale.ROOT) } catch (_: Throwable) { null }
  if (authority.isNullOrBlank()) "content:fallback" else "content:$authority:fallback"
}

class TransactionStorage(
  private val root: File,
  private val directorySync: DirectoryDurabilitySync = AndroidDirectoryDurabilitySync,
  private val availableBytesProvider: (File) -> Long = { directory ->
    StatFs(directory.absolutePath).availableBytes
  },
  private val partialDirectoryDelete: (File) -> Boolean = { it.deleteRecursively() },
) {
  companion object {
    const val MAX_JOURNAL_BYTES = 64 * 1024
    const val ORIGINAL_FILE = "original.bin"
    const val REWRITTEN_FILE = "rewritten.bin"
    private const val JOURNAL_FILE = "journal.json"
    private const val JOURNAL_TMP_FILE = "journal.tmp"
    private const val QUARANTINE_DIRECTORY = "audio-tag-transactions-quarantine"
  }

  private val quarantineRoot = File(root.parentFile ?: root, QUARANTINE_DIRECTORY)

  init {
    val created = !root.exists()
    if (created && !root.mkdirs()) throw IOException("transaction root mkdir failed")
    if (!root.isDirectory) throw IOException("transaction root is not a directory")
    if (created) syncDirectory(root.parentFile ?: root)
  }

  fun createDir(operationId: String = UUID.randomUUID().toString()): File {
    if (!isValidTagWriteOperationId(operationId)) {
      throw AudioTagRewriteException("InvalidTagData", "Tag write operation identifier is invalid.")
    }
    val directory = File(root, operationId)
    val canonicalRoot = root.canonicalFile
    if (directory.canonicalFile.parentFile != canonicalRoot) {
      throw AudioTagRewriteException("InvalidTagData", "Tag write operation identifier escapes transaction storage.")
    }
    if (!directory.mkdirs()) throw IOException("transaction directory mkdir failed")
    try {
      syncDirectory(root)
    } catch (primary: Throwable) {
      // Only this invocation's newly-created, already-contained child is
      // eligible for rollback. Never clean a pre-existing or escaped path.
      try {
        if (directory.canonicalFile.parentFile == canonicalRoot &&
          directory.exists() && !partialDirectoryDelete(directory)
        ) {
          throw IOException("partial transaction directory cleanup failed")
        }
      } catch (cleanup: Throwable) {
        primary.addSuppressed(cleanup)
      }
      throw primary
    }
    return directory
  }

  fun dirs(): List<File> = root.listFiles()
    ?.filter { it.isDirectory }
    ?.sortedBy { it.name }
    ?: emptyList()

  fun quarantinedDirs(): List<File> = quarantineRoot.listFiles()
    ?.filter { it.isDirectory }
    ?.sortedBy { it.name }
    ?: emptyList()

  fun original(directory: File): File = File(directory, ORIGINAL_FILE)
  fun rewritten(directory: File): File = File(directory, REWRITTEN_FILE)
  fun journal(directory: File): File = File(directory, JOURNAL_FILE)
  fun journalTmp(directory: File): File = File(directory, JOURNAL_TMP_FILE)

  fun atomicWriteJournal(directory: File, journal: TransactionJournal) {
    ensureDirectory(directory)
    val temporary = journalTmp(directory)
    writeBytesDurably(temporary, journal.toJson().toByteArray(Charsets.UTF_8))
    promote(temporary, journal(directory))
  }

  fun promote(temporary: File, target: File) {
    if (!temporary.isFile) throw IOException("promotion source is missing: ${temporary.name}")
    if (!temporary.renameTo(target)) throw IOException("rename failed: ${temporary.name}")
    syncDirectory(target.parentFile ?: root)
  }

  fun readJournalSafely(directory: File): TransactionJournal? {
    return try {
      val file = journal(directory)
      if (!file.isFile || file.length() > MAX_JOURNAL_BYTES) return null
      TransactionJournal.parseAndValidate(
        text = file.readText(Charsets.UTF_8),
        expectedDirectoryName = directory.name,
        requireFilesIn = directory,
      )
    } catch (_: Throwable) {
      null
    }
  }

  fun quarantineDamaged(directory: File): File {
    val quarantineCreated = !quarantineRoot.exists()
    if (quarantineCreated && !quarantineRoot.mkdirs()) throw IOException("quarantine mkdir failed")
    if (!quarantineRoot.isDirectory) throw IOException("quarantine root is invalid")
    if (quarantineCreated) syncDirectory(quarantineRoot.parentFile ?: root)

    val target = File(quarantineRoot, "${directory.name}-${System.currentTimeMillis()}")
    if (!directory.renameTo(target)) throw IOException("quarantine rename failed")
    syncDirectory(root)
    syncDirectory(quarantineRoot)

    val metadata = JSONObject()
      .put("transactionId", directory.name)
      .put("reason", "damaged-journal")
      .put("quarantinedAtEpochMs", System.currentTimeMillis())
      .toString()
      .toByteArray(Charsets.UTF_8)
    val metadataTmp = File(target, "quarantine.tmp")
    writeBytesDurably(metadataTmp, metadata)
    promote(metadataTmp, File(target, "quarantine.json"))
    return target
  }

  fun cleanup(directory: File) {
    val parent = directory.parentFile ?: root
    if (directory.exists() && !directory.deleteRecursively()) {
      throw IOException("transaction cleanup failed")
    }
    syncDirectory(parent)
  }

  fun markRecoveryState(
    directory: File,
    journal: TransactionJournal,
    state: TransactionState,
  ): TransactionJournal {
    val next = journal.withState(state)
    atomicWriteJournal(directory, next)
    return next
  }

  fun availableBytes(): Long? = try {
    availableBytesProvider(root).takeIf { it >= 0L }
  } catch (_: Throwable) {
    null
  }

  private fun ensureDirectory(directory: File) {
    val created = !directory.exists()
    if (created && !directory.mkdirs()) throw IOException("transaction directory mkdir failed")
    if (!directory.isDirectory) throw IOException("transaction directory is invalid")
    if (created) syncDirectory(directory.parentFile ?: root)
  }

  private fun writeBytesDurably(file: File, bytes: ByteArray) {
    FileOutputStream(file).use { output ->
      output.write(bytes)
      output.flush()
      output.fd.sync()
    }
  }

  private fun syncDirectory(directory: File) {
    if (!directory.exists()) return
    try {
      directorySync.sync(directory)
    } catch (error: Throwable) {
      throw IOException("directory sync failed", error)
    }
  }
}

object StreamDigests {
  private const val BUFFER_SIZE = 64 * 1024

  fun hashFile(file: File, maxBytes: Long): DigestInfo = FileInputStream(file).use {
    hashStream(it, maxBytes)
  }

  fun hashUri(store: SafContentStore, uri: Uri, maxBytes: Long): DigestInfo? =
    store.openInput(uri)?.use { hashStream(it, maxBytes) }

  fun copyUriToFileWithDigest(
    store: SafContentStore,
    uri: Uri,
    temporary: File,
    maxBytes: Long,
  ): DigestInfo? = store.openInput(uri)?.use { copyToFile(it, temporary, maxBytes) }

  fun copyFileToUriWithDigest(
    file: File,
    store: SafContentStore,
    uri: Uri,
    maxBytes: Long,
  ): DigestInfo? = store.openTruncatingOutput(uri)?.use { output ->
    val digest = MessageDigest.getInstance("SHA-256")
    var total = 0L
    val buffer = ByteArray(BUFFER_SIZE)
    FileInputStream(file).use { input ->
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        total += read.toLong()
        if (total > maxBytes) throw SizeLimitException()
        digest.update(buffer, 0, read)
        output.write(buffer, 0, read)
      }
    }
    output.flush()
    store.sync(output)
    DigestInfo(total, digest.hex())
  }

  fun verifyFile(file: File, expected: DigestInfo, maxBytes: Long): Boolean =
    file.isFile && hashFile(file, maxBytes) == expected

  private fun copyToFile(input: InputStream, temporary: File, maxBytes: Long): DigestInfo {
    val digest = MessageDigest.getInstance("SHA-256")
    var total = 0L
    val buffer = ByteArray(BUFFER_SIZE)
    FileOutputStream(temporary).use { output ->
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        total += read.toLong()
        if (total > maxBytes) throw SizeLimitException()
        digest.update(buffer, 0, read)
        output.write(buffer, 0, read)
      }
      output.flush()
      output.fd.sync()
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
      total += read.toLong()
      if (total > maxBytes) throw SizeLimitException()
      digest.update(buffer, 0, read)
    }
    return DigestInfo(total, digest.hex())
  }

  private fun MessageDigest.hex(): String = digest().joinToString("") { "%02x".format(it) }
}

class SizeLimitException : IOException("size limit exceeded")

data class TransactionWriteRequest(
  val operationId: String = UUID.randomUUID().toString(),
  val uri: Uri,
  val rewriteSource: AudioTagRewriteSource,
  val changedFields: List<String>,
  val maxBytes: Long,
  val expectedOriginalSize: Long? = null,
  val expectedOriginalSha256: String? = null,
)

/**
 * Retry policy for a completed native tag-write attempt. Retryable failures are
 * safe to attempt again only after their external cause (permission, capacity,
 * provider I/O, or pending recovery) has been addressed. Verification failures
 * are deterministic content mismatches and remain permanent unless recovery is
 * still pending. Unknown codes fail closed as non-retryable.
 */
internal fun isRetryableTagWriteFailure(
  success: Boolean,
  errorCode: String?,
  recoveryPending: Boolean,
): Boolean {
  if (success) return false
  if (recoveryPending) return true
  return errorCode in setOf(
    "TransactionConflict",
    "RecoveryPending",
    "RecoveryFailed",
    "MissingWritePermission",
    "InsufficientStorage",
    "BackupFailed",
    "TempWriteFailed",
    "ReplaceFailed",
    "RollbackFailed",
  )
}

data class TransactionResult(
  val success: Boolean,
  val errorCode: String?,
  val message: String,
  val verified: Boolean = false,
  val noop: Boolean = false,
  val bytesBefore: Long? = null,
  val bytesAfter: Long? = null,
  val transactionId: String? = null,
  val recoveryPending: Boolean = false,
  val recovered: Boolean = false,
  val cleanupPending: Boolean = false,
  val phase: String = if (success) "COMPLETED" else "FAILED",
  val terminal: Boolean = true,
  val retryable: Boolean = isRetryableTagWriteFailure(success, errorCode, recoveryPending),
) {
  init {
    require(!success || !retryable) { "successful transaction results cannot be retryable" }
    require(!recoveryPending || retryable) { "recovery-pending transaction results must be retryable" }
  }
}

data class RestoreResult(
  val restored: Boolean,
  val verified: Boolean,
  val recoveryPending: Boolean,
  val errorCode: String?,
  val message: String,
  val cleanupPending: Boolean = false,
)

data class RecoveryTransactionReport(
  val transactionId: String,
  val previousState: String?,
  val resultState: String?,
  val recovered: Boolean,
  val pending: Boolean,
  val errorCode: String?,
)

data class RecoverySummary(
  val success: Boolean,
  val recoveredCount: Int,
  val cleanedCount: Int,
  val pendingCount: Int,
  val failedCount: Int,
  val transactions: List<RecoveryTransactionReport>,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "success" to success,
    "recoveredCount" to recoveredCount,
    "cleanedCount" to cleanedCount,
    "pendingCount" to pendingCount,
    "failedCount" to failedCount,
    "transactions" to transactions.map {
      mapOf(
        "transactionId" to it.transactionId,
        "previousState" to it.previousState,
        "resultState" to it.resultState,
        "recovered" to it.recovered,
        "pending" to it.pending,
        "errorCode" to it.errorCode,
      )
    },
  )
}

/**
 * Maps the outcome of targeted recovery to the identity of the new write
 * attempt. Pending recovery remains retryable, while an exclusively terminal
 * failure preserves its error code. If terminal reports disagree (or omit a
 * code), RecoveryFailed is the deterministic fail-closed aggregate.
 */
internal fun targetedRecoveryResult(
  request: TransactionWriteRequest,
  summary: RecoverySummary,
): TransactionResult? {
  if (summary.success) return null
  if (summary.pendingCount > 0) {
    return TransactionResult(
      success = false,
      errorCode = "RecoveryPending",
      message = "Pending recovery must complete before writing this SAF document.",
      recoveryPending = true,
      transactionId = request.operationId,
      phase = "FAILED",
      terminal = true,
    )
  }

  val terminalCodes = summary.transactions
    .filterNot { it.pending }
    .mapNotNull { it.errorCode }
    .distinct()
  val errorCode = terminalCodes.singleOrNull() ?: "RecoveryFailed"
  return TransactionResult(
    success = false,
    errorCode = errorCode,
    message = "Targeted recovery failed before writing this SAF document.",
    recoveryPending = false,
    transactionId = request.operationId,
    phase = "FAILED",
    terminal = true,
  )
}

class AudioTagTransactionManager(
  private val storage: TransactionStorage,
  private val store: SafContentStore,
  private val safetyMarginBytes: Long = 1024 * 1024,
) {
  private val maintenanceLock = ReentrantLock()
  private val lifecycleBarrier = ReentrantReadWriteLock(true)
  private data class TargetLock(val lock: ReentrantLock = ReentrantLock(), var users: Int = 0)
  private val targetLocks = ConcurrentHashMap<String, TargetLock>()

  /**
   * Lock order is always lifecycleBarrier -> maintenanceLock or
   * lifecycleBarrier -> target lock. A write first performs targeted recovery
   * while holding the exclusive barrier and maintenanceLock, releases both, and
   * then acquires the shared barrier and target lock for its mutation.
   * maintenanceLock and target locks are never nested. Writes hold the shared
   * barrier for their complete native mutation lifetime; recovery holds the
   * exclusive barrier, so it cannot inspect a live transaction journal.
   */
  fun recoverPending(targetUri: Uri? = null): TransactionResult = lifecycleBarrier.writeLock().withLock {
    val summary = maintenanceLock.withLock { recoverPendingLocked(targetUri) }
    TransactionResult(
      success = summary.success,
      errorCode = when {
        summary.success -> null
        summary.pendingCount > 0 -> "RecoveryPending"
        else -> "RecoveryFailed"
      },
      message = "Recovered ${summary.recoveredCount}, cleaned ${summary.cleanedCount}, pending ${summary.pendingCount}, failed ${summary.failedCount} SAF transaction(s).",
      recoveryPending = summary.pendingCount > 0,
      recovered = summary.recoveredCount > 0,
    )
  }

  fun recoverPendingSummary(targetUri: Uri? = null): RecoverySummary = lifecycleBarrier.writeLock().withLock {
    maintenanceLock.withLock { recoverPendingLocked(targetUri) }
  }

  fun status(): Map<String, Any?> = lifecycleBarrier.readLock().withLock {
    maintenanceLock.withLock {
      val transactions = storage.dirs().map { directory ->
        val journal = storage.readJournalSafely(directory)
        mapOf(
          "transactionId" to directory.name,
          "state" to (journal?.state?.name ?: "INVALID"),
        )
      }
      mapOf(
        "pendingCount" to transactions.size,
        "quarantineCount" to storage.quarantinedDirs().size,
        "transactions" to transactions,
      )
    }
  }

  fun write(request: TransactionWriteRequest): TransactionResult {
    targetedRecoveryBeforeWrite(request)?.let { return it }
    return lifecycleBarrier.readLock().withLock { writeWithTargetLock(request) }
  }

  private fun targetedRecoveryBeforeWrite(request: TransactionWriteRequest): TransactionResult? =
    if (!needsTargetedRecovery(request)) {
      null
    } else lifecycleBarrier.writeLock().withLock {
      maintenanceLock.withLock {
        val summary = try {
          recoverPendingLocked(request.uri)
        } catch (_: Throwable) {
          return@withLock recoveryPendingResult(request)
        }
        targetedRecoveryResult(request, summary)
      }
    }

  private fun needsTargetedRecovery(request: TransactionWriteRequest): Boolean {
    val canonicalTarget = safTargetKey(request.uri)
    if (synchronized(targetLocks) { targetLocks[canonicalTarget]?.users?.let { it > 0 } == true }) {
      // Let the normal target-lock path reject a concurrent live mutation. Its
      // journal is not a crashed transaction and must never be recovered.
      return false
    }
    return try {
      storage.dirs().any {
        storage.readJournalSafely(it)?.targetUri?.let { target -> safTargetKey(Uri.parse(target)) } == canonicalTarget
      }
    } catch (_: Throwable) {
      // Re-run the check under the recovery locks, where failures become a
      // structured, retryable result rather than allowing a mutation.
      true
    }
  }

  private fun recoveryPendingResult(request: TransactionWriteRequest) = TransactionResult(
    success = false,
    errorCode = "RecoveryPending",
    message = "Pending recovery must complete before writing this SAF document.",
    recoveryPending = true,
    transactionId = request.operationId,
    phase = "FAILED",
    terminal = true,
    retryable = true,
  )

  private fun writeWithTargetLock(request: TransactionWriteRequest): TransactionResult {
    val canonicalTarget = safTargetKey(request.uri)
    val target = synchronized(targetLocks) {
      targetLocks.computeIfAbsent(canonicalTarget) { TargetLock() }.also { it.users += 1 }
    }
    if (!target.lock.tryLock()) {
      synchronized(targetLocks) {
        target.users -= 1
        if (target.users == 0) targetLocks.remove(canonicalTarget, target)
      }
      return TransactionResult(
        success = false,
        errorCode = "TransactionConflict",
        message = "Another tag write is active for this SAF document.",
        transactionId = request.operationId,
        phase = "FAILED",
        terminal = true,
        retryable = true,
        recoveryPending = false,
      )
    }
    try {
      return writeLocked(request)
    } finally {
      target.lock.unlock()
      synchronized(targetLocks) {
        target.users -= 1
        if (target.users == 0) targetLocks.remove(canonicalTarget, target)
      }
    }
  }

  private fun writeLocked(request: TransactionWriteRequest): TransactionResult {
    val canonicalTarget = safTargetKey(request.uri)
    val hasPendingRecovery = storage.dirs().any {
      storage.readJournalSafely(it)?.targetUri?.let { target -> safTargetKey(Uri.parse(target)) } == canonicalTarget
    }
    if (hasPendingRecovery) {
      return recoveryPendingResult(request)
    }
    if (!store.hasWritePermission(request.uri) || !store.isWritable(request.uri)) {
      return TransactionResult(
        success = false,
        errorCode = "MissingWritePermission",
        message = "No writable SAF permission is available.",
      )
    }

    if (request.maxBytes <= 0L) {
      return TransactionResult(
        success = false,
        errorCode = "InvalidTagData",
        message = "Maximum file size must be positive.",
      )
    }
    if (request.maxBytes > MAX_SAFE_TAG_WRITE_FILE_BYTES) {
      return TransactionResult(
        success = false,
        errorCode = "FileTooLarge",
        message = "Maximum file size exceeds the native safety limit.",
      )
    }
    val knownOriginalSize = store.size(request.uri)?.takeIf { it >= 0L }
    if (knownOriginalSize != null && knownOriginalSize > request.maxBytes) {
      return TransactionResult(
        success = false,
        errorCode = "FileTooLarge",
        message = "File exceeds the safe tag write size limit.",
        bytesBefore = knownOriginalSize,
      )
    }
    val originalReserve = knownOriginalSize ?: request.maxBytes
    val rewrittenReserve = request.rewriteSource
      .estimatedOutputSizeUpperBound(originalReserve, request.maxBytes)
      .coerceIn(0L, request.maxBytes)
    val expectedSpace = listOf(
      originalReserve,
      rewrittenReserve,
      safetyMarginBytes,
    ).fold(0L) { total, rawValue ->
      val value = rawValue.coerceAtLeast(0L)
      if (Long.MAX_VALUE - total < value) Long.MAX_VALUE else total + value
    }
    val availableBytes = storage.availableBytes()
    if (availableBytes == null) {
      return TransactionResult(
        success = false,
        errorCode = "InsufficientStorage",
        message = "App-private storage capacity could not be verified.",
      )
    }
    if (availableBytes < expectedSpace) {
      return TransactionResult(
        success = false,
        errorCode = "InsufficientStorage",
        message = "Insufficient app-private storage for durable transaction.",
      )
    }

    val directory = storage.createDir(request.operationId)
    var phase = WriteExecutionPhase.PREPARING
    var journal = TransactionJournal(
      transactionId = directory.name,
      targetUri = request.uri.toString(),
      state = TransactionState.PREPARING,
      createdAtEpochMs = System.currentTimeMillis(),
      updatedAtEpochMs = System.currentTimeMillis(),
      maxBytes = request.maxBytes,
      changedFields = request.changedFields,
    )

    try {
      storage.atomicWriteJournal(directory, journal)
      val originalTemporary = File(directory, "original.tmp")
      val originalDigest = StreamDigests.copyUriToFileWithDigest(
        store = store,
        uri = request.uri,
        temporary = originalTemporary,
        maxBytes = request.maxBytes,
      ) ?: return cleanupBeforeMutation(
        directory,
        journal,
        "BackupFailed",
        "Original could not be backed up.",
      )

      if (request.expectedOriginalSize != null && request.expectedOriginalSize != originalDigest.sizeBytes) {
        return cleanupBeforeMutation(
          directory,
          journal,
          "VerificationFailed",
          "Original size changed before write.",
          before = originalDigest.sizeBytes,
        )
      }
      if (
        !request.expectedOriginalSha256.isNullOrBlank() &&
        request.expectedOriginalSha256.lowercase() != originalDigest.sha256Hex
      ) {
        return cleanupBeforeMutation(
          directory,
          journal,
          "VerificationFailed",
          "Original content changed before write.",
          before = originalDigest.sizeBytes,
        )
      }
      if (!StreamDigests.verifyFile(originalTemporary, originalDigest, request.maxBytes)) {
        return cleanupBeforeMutation(
          directory,
          journal,
          "BackupFailed",
          "Original backup verification failed.",
          before = originalDigest.sizeBytes,
        )
      }

      storage.promote(originalTemporary, storage.original(directory))
      journal = journal.copy(
        state = TransactionState.BACKUP_READY,
        updatedAtEpochMs = System.currentTimeMillis(),
        originalSizeBytes = originalDigest.sizeBytes,
        originalSha256Hex = originalDigest.sha256Hex,
      )
      storage.atomicWriteJournal(directory, journal)
      phase = WriteExecutionPhase.BACKUP_DURABLE

      val rewrittenTemporary = File(directory, "rewritten.tmp")
      val rewriteResult = try {
        request.rewriteSource.rewrite(
          original = storage.original(directory),
          temporary = rewrittenTemporary,
          maxBytes = request.maxBytes,
        )
      } catch (error: AudioTagRewriteException) {
        return cleanupBeforeMutation(
          directory,
          journal,
          error.errorCode,
          error.message ?: "Native audio tag rewrite failed.",
          before = originalDigest.sizeBytes,
        )
      }
      val rewrittenDigest = rewriteResult.digest

      if (rewrittenDigest.sizeBytes <= 0L) {
        return cleanupBeforeMutation(
          directory,
          journal,
          "InvalidTagData",
          "Rewritten audio payload is empty.",
          before = originalDigest.sizeBytes,
        )
      }
      if (!StreamDigests.verifyFile(rewrittenTemporary, rewrittenDigest, request.maxBytes)) {
        return cleanupBeforeMutation(
          directory,
          journal,
          "TempWriteFailed",
          "Rewritten staging verification failed.",
          before = originalDigest.sizeBytes,
          after = rewrittenDigest.sizeBytes,
        )
      }

      if (!rewriteResult.changed || rewrittenDigest == originalDigest) {
        return try {
          storage.cleanup(directory)
          TransactionResult(
            success = true,
            errorCode = null,
            message = "Tag edit is already satisfied; no SAF mutation was required.",
            verified = true,
            noop = true,
            bytesBefore = originalDigest.sizeBytes,
            bytesAfter = rewrittenDigest.sizeBytes,
            transactionId = journal.transactionId,
          )
        } catch (_: Throwable) {
          TransactionResult(
            success = true,
            errorCode = null,
            message = "Tag edit is already satisfied; transaction cleanup will be retried.",
            verified = true,
            noop = true,
            bytesBefore = originalDigest.sizeBytes,
            bytesAfter = rewrittenDigest.sizeBytes,
            transactionId = journal.transactionId,
            cleanupPending = true,
          )
        }
      }

      storage.promote(rewrittenTemporary, storage.rewritten(directory))
      journal = journal.copy(
        updatedAtEpochMs = System.currentTimeMillis(),
        rewrittenSizeBytes = rewrittenDigest.sizeBytes,
        rewrittenSha256Hex = rewrittenDigest.sha256Hex,
      )
      storage.atomicWriteJournal(directory, journal)
      phase = WriteExecutionPhase.REWRITE_DURABLE

      val backupDigest = verifyOriginalBackup(directory, journal, request.maxBytes)
        ?: return cleanupBeforeMutation(
          directory,
          journal,
          "BackupCorrupted",
          "Original backup verification failed before write.",
          before = originalDigest.sizeBytes,
          after = rewrittenDigest.sizeBytes,
        )
      val liveDigest = StreamDigests.hashUri(store, request.uri, request.maxBytes)
        ?: return cleanupBeforeMutation(
          directory,
          journal,
          "UnsupportedUri",
          "Original could not be re-read.",
          before = originalDigest.sizeBytes,
          after = rewrittenDigest.sizeBytes,
        )
      if (liveDigest != backupDigest) {
        return cleanupBeforeMutation(
          directory,
          journal,
          "VerificationFailed",
          "Original changed after backup; write aborted.",
          before = originalDigest.sizeBytes,
          after = rewrittenDigest.sizeBytes,
        )
      }

      val writeStartedJournal = journal.withState(TransactionState.WRITE_STARTED)
      storage.atomicWriteJournal(directory, writeStartedJournal)
      journal = writeStartedJournal
      phase = WriteExecutionPhase.WRITE_INTENT_DURABLE

      try {
        phase = WriteExecutionPhase.TARGET_MUTATION_STARTED
        StreamDigests.copyFileToUriWithDigest(
          file = storage.rewritten(directory),
          store = store,
          uri = request.uri,
          maxBytes = request.maxBytes,
        ) ?: throw IOException("provider refused output")
        phase = WriteExecutionPhase.TARGET_SYNCED

        val writtenUnverifiedJournal = journal.withState(TransactionState.WRITTEN_UNVERIFIED)
        storage.atomicWriteJournal(directory, writtenUnverifiedJournal)
        journal = writtenUnverifiedJournal
        val after = StreamDigests.hashUri(store, request.uri, request.maxBytes)
        if (after != rewrittenDigest) {
          return rollbackFailedWrite(
            directory,
            journal,
            "VerificationFailed",
            "Written SAF document failed verification.",
            request.maxBytes,
          )
        }
        phase = WriteExecutionPhase.TARGET_VERIFIED

        val committedJournal = journal.withState(TransactionState.COMMITTED)
        storage.atomicWriteJournal(directory, committedJournal)
        journal = committedJournal
        phase = WriteExecutionPhase.COMMITTED_DURABLE
      } catch (error: Throwable) {
        return rollbackFailedWrite(
          directory,
          journal,
          if (error is SizeLimitException) "VerificationFailed" else "ReplaceFailed",
          "SAF write failed; original restored if possible.",
          request.maxBytes,
        )
      }

      try {
        storage.cleanup(directory)
      } catch (_: Throwable) {
        return TransactionResult(
          success = true,
          errorCode = null,
          message = "Tags written and verified; committed transaction cleanup will be retried.",
          verified = true,
          bytesBefore = originalDigest.sizeBytes,
          bytesAfter = rewrittenDigest.sizeBytes,
          transactionId = journal.transactionId,
          cleanupPending = true,
        )
      }

      TransactionResult(
        success = true,
        errorCode = null,
        message = "Tags written and verified.",
        verified = true,
        bytesBefore = originalDigest.sizeBytes,
        bytesAfter = rewrittenDigest.sizeBytes,
        transactionId = journal.transactionId,
      )
    } catch (error: Throwable) {
      if (phase.ordinal >= WriteExecutionPhase.WRITE_INTENT_DURABLE.ordinal) {
        rollbackFailedWrite(
          directory,
          journal,
          if (error is SizeLimitException) "VerificationFailed" else "ReplaceFailed",
          "SAF transaction failed after write intent; original restored if possible.",
          request.maxBytes,
        )
      } else {
        cleanupBeforeMutation(
          directory,
          journal,
          if (error is SizeLimitException) "FileTooLarge" else "ReplaceFailed",
          if (error is SizeLimitException) {
            "File exceeds the safe tag write size limit."
          } else {
            "SAF transaction failed: ${error.message}"
          },
        )
      }
    }
  }

  private fun cleanupBeforeMutation(
    directory: File,
    journal: TransactionJournal,
    code: String,
    message: String,
    before: Long? = null,
    after: Long? = null,
  ): TransactionResult {
    require(journal.state == TransactionState.PREPARING || journal.state == TransactionState.BACKUP_READY) {
      "cleanup is forbidden after target write intent"
    }
    return try {
      storage.cleanup(directory)
      TransactionResult(
        success = false,
        errorCode = code,
        message = message,
        bytesBefore = before,
        bytesAfter = after,
      )
    } catch (_: Throwable) {
      TransactionResult(
        success = false,
        errorCode = code,
        message = "$message Transaction cleanup remains pending.",
        bytesBefore = before,
        bytesAfter = after,
        cleanupPending = true,
      )
    }
  }

  private fun rollbackFailedWrite(
    directory: File,
    journal: TransactionJournal,
    code: String,
    message: String,
    maxBytes: Long,
  ): TransactionResult {
    val restore = restoreOriginal(
      directory = directory,
      journal = journal,
      maxBytes = maxBytes,
      recoveryErrorCode = "RollbackFailed",
    )
    return if (restore.restored && restore.verified) {
      TransactionResult(
        success = false,
        errorCode = code,
        message = message,
        bytesBefore = journal.originalSizeBytes,
        bytesAfter = journal.rewrittenSizeBytes,
        recovered = true,
        recoveryPending = false,
        cleanupPending = restore.cleanupPending,
      )
    } else {
      TransactionResult(
        success = false,
        errorCode = restore.errorCode ?: "RollbackFailed",
        message = restore.message,
        bytesBefore = journal.originalSizeBytes,
        bytesAfter = journal.rewrittenSizeBytes,
        recoveryPending = restore.recoveryPending,
      )
    }
  }

  private fun restoreOriginal(
    directory: File,
    journal: TransactionJournal,
    maxBytes: Long,
    recoveryErrorCode: String,
  ): RestoreResult {
    val uri = Uri.parse(journal.targetUri)
    if (!store.hasWritePermission(uri) || !store.isWritable(uri)) {
      return RestoreResult(
        restored = false,
        verified = false,
        recoveryPending = true,
        errorCode = "RecoveryPending",
        message = "Recovery permission is missing.",
      )
    }

    val expected = verifyOriginalBackup(directory, journal, maxBytes) ?: run {
      markRecoveryFailed(
        directory,
        journal,
        "BackupCorrupted",
        "Original backup is corrupted; target was not modified by recovery.",
        recoveryPending = false,
      )
      return RestoreResult(
        restored = false,
        verified = false,
        recoveryPending = false,
        errorCode = "BackupCorrupted",
        message = "Original backup is corrupted; target was not modified by recovery.",
      )
    }

    return try {
      StreamDigests.copyFileToUriWithDigest(
        file = storage.original(directory),
        store = store,
        uri = uri,
        maxBytes = maxBytes,
      ) ?: throw IOException("provider refused recovery output")
      val restored = StreamDigests.hashUri(store, uri, maxBytes)
      if (restored != expected) {
        storage.markRecoveryState(directory, journal, TransactionState.RECOVERY_REQUIRED)
        return RestoreResult(
          restored = false,
          verified = false,
          recoveryPending = true,
          errorCode = recoveryErrorCode,
          message = "Restore verification failed.",
        )
      }

      try {
        storage.markRecoveryState(directory, journal, TransactionState.RECOVERED)
        storage.cleanup(directory)
        RestoreResult(
          restored = true,
          verified = true,
          recoveryPending = false,
          errorCode = null,
          message = "Original restored and verified.",
        )
      } catch (_: Throwable) {
        RestoreResult(
          restored = true,
          verified = true,
          recoveryPending = false,
          errorCode = null,
          message = "Original restored and verified; cleanup remains pending.",
          cleanupPending = true,
        )
      }
    } catch (_: Throwable) {
      try {
        storage.markRecoveryState(directory, journal, TransactionState.RECOVERY_FAILED)
      } catch (_: Throwable) {
        // Keep the existing journal and backup when even the failure state cannot be persisted.
      }
      RestoreResult(
        restored = false,
        verified = false,
        recoveryPending = true,
        errorCode = recoveryErrorCode,
        message = "Restore failed and recovery remains pending.",
      )
    }
  }

  private fun recoverCrashedTransaction(
    directory: File,
    journal: TransactionJournal,
  ): TransactionResult {
    val uri = Uri.parse(journal.targetUri)
    val originalDigest = verifyOriginalBackup(directory, journal, journal.maxBytes) ?: run {
      markRecoveryFailed(
        directory,
        journal,
        "BackupCorrupted",
        "Original backup is corrupted; target was not modified by recovery.",
        recoveryPending = false,
      )
      return TransactionResult(
        success = false,
        errorCode = "BackupCorrupted",
        message = "Original backup is corrupted; target was not modified by recovery.",
        bytesBefore = journal.originalSizeBytes,
        bytesAfter = journal.rewrittenSizeBytes,
        recoveryPending = false,
      )
    }

    val rewrittenDigest = try {
      DigestInfo(
        sizeBytes = requireNotNull(journal.rewrittenSizeBytes),
        sha256Hex = requireNotNull(journal.rewrittenSha256Hex),
      )
    } catch (_: Throwable) {
      return markRecoveryFailed(
        directory,
        journal,
        "RecoveryFailed",
        "Rewritten digest is missing.",
      )
    }

    val liveDigest = try {
      StreamDigests.hashUri(store, uri, journal.maxBytes)
    } catch (_: Throwable) {
      null
    } ?: return TransactionResult(
      success = false,
      errorCode = "RecoveryPending",
      message = "Current SAF content could not be verified; automatic recovery was not attempted.",
      bytesBefore = journal.originalSizeBytes,
      bytesAfter = journal.rewrittenSizeBytes,
      recoveryPending = true,
    )

    return when {
      liveDigest == originalDigest -> finalizeKnownRecoveryState(
        directory = directory,
        journal = journal,
        state = TransactionState.RECOVERED,
        message = "Original content was already intact; pending transaction cleaned.",
        recovered = true,
        verified = false,
      )
      liveDigest == rewrittenDigest -> finalizeKnownRecoveryState(
        directory = directory,
        journal = journal,
        state = TransactionState.COMMITTED,
        message = "Rewritten content was already complete and verified; transaction committed.",
        recovered = false,
        verified = true,
      )
      InterruptedSafWriteClassifier.matches(
        store = store,
        uri = uri,
        original = storage.original(directory),
        rewritten = storage.rewritten(directory),
        maxBytes = journal.maxBytes,
      ) -> {
      if (!store.hasWritePermission(uri) || !store.isWritable(uri)) {
        TransactionResult(
          success = false,
          errorCode = "RecoveryPending",
          message = "Recovery permission is missing for the required restore.",
          bytesBefore = journal.originalSizeBytes,
          bytesAfter = journal.rewrittenSizeBytes,
          recoveryPending = true,
        )
      } else {
        recoverInterruptedWrite(directory, journal)
      }
    }
      else -> preserveExternalEditConflict(directory, journal)
    }
  }

  private fun recoverInterruptedWrite(
    directory: File,
    journal: TransactionJournal,
  ): TransactionResult {
    val restore = restoreOriginal(
      directory = directory,
      journal = journal,
      maxBytes = journal.maxBytes,
      recoveryErrorCode = "RecoveryFailed",
    )
    return if (restore.restored && restore.verified) {
      TransactionResult(
        success = true,
        errorCode = null,
        message = "Interrupted SAF write was restored from the verified original backup.",
        bytesBefore = journal.originalSizeBytes,
        bytesAfter = journal.rewrittenSizeBytes,
        recovered = true,
        cleanupPending = restore.cleanupPending,
      )
    } else {
      TransactionResult(
        success = false,
        errorCode = restore.errorCode ?: "RecoveryFailed",
        message = restore.message,
        bytesBefore = journal.originalSizeBytes,
        bytesAfter = journal.rewrittenSizeBytes,
        recoveryPending = true,
      )
    }
  }

  private fun preserveExternalEditConflict(
    directory: File,
    journal: TransactionJournal,
  ): TransactionResult {
    try {
      storage.markRecoveryState(directory, journal, TransactionState.RECOVERY_REQUIRED)
    } catch (_: Throwable) {
      // Preserve all artifacts even when the state transition itself cannot be persisted.
    }
    return TransactionResult(
      success = false,
      errorCode = "RecoveryPending",
      message = "SAF content changed after the crash; automatic restore was refused to avoid overwriting external edits.",
      bytesBefore = journal.originalSizeBytes,
      bytesAfter = journal.rewrittenSizeBytes,
      recoveryPending = true,
    )
  }

  private fun finalizeKnownRecoveryState(
    directory: File,
    journal: TransactionJournal,
    state: TransactionState,
    message: String,
    recovered: Boolean,
    verified: Boolean,
  ): TransactionResult {
    return try {
      storage.markRecoveryState(directory, journal, state)
      storage.cleanup(directory)
      TransactionResult(
        success = true,
        errorCode = null,
        message = message,
        verified = verified,
        bytesBefore = journal.originalSizeBytes,
        bytesAfter = journal.rewrittenSizeBytes,
        recovered = recovered,
      )
    } catch (_: Throwable) {
      TransactionResult(
        success = true,
        errorCode = null,
        message = "$message Cleanup remains pending.",
        verified = verified,
        bytesBefore = journal.originalSizeBytes,
        bytesAfter = journal.rewrittenSizeBytes,
        recovered = recovered,
        cleanupPending = true,
      )
    }
  }

  private fun verifyOriginalBackup(
    directory: File,
    journal: TransactionJournal,
    maxBytes: Long,
  ): DigestInfo? {
    val expected = DigestInfo(
      sizeBytes = journal.originalSizeBytes ?: return null,
      sha256Hex = journal.originalSha256Hex ?: return null,
    )
    val actual = try {
      StreamDigests.hashFile(storage.original(directory), maxBytes)
    } catch (_: Throwable) {
      return null
    }
    return actual.takeIf { it == expected }
  }

  private fun markRecoveryFailed(
    directory: File,
    journal: TransactionJournal,
    code: String,
    message: String,
    recoveryPending: Boolean = true,
  ): TransactionResult {
    try {
      storage.markRecoveryState(directory, journal, TransactionState.RECOVERY_FAILED)
    } catch (_: Throwable) {
      // Preserve current artifacts when the failure state itself cannot be written.
    }
    return TransactionResult(
      success = false,
      errorCode = code,
      message = message,
      bytesBefore = journal.originalSizeBytes,
      bytesAfter = journal.rewrittenSizeBytes,
      recoveryPending = recoveryPending,
    )
  }

  private fun recoverPendingLocked(targetUri: Uri? = null): RecoverySummary {
    var recoveredCount = 0
    var cleanedCount = 0
    var pendingCount = 0
    var failedCount = 0
    val reports = mutableListOf<RecoveryTransactionReport>()
    val blockedTargets = mutableSetOf<String>()
    val requestedTarget = targetUri?.let(::safTargetKey)

    for (directory in storage.dirs()) {
      val journal = storage.readJournalSafely(directory)
      if (journal == null) {
        try {
          storage.quarantineDamaged(directory)
          if (targetUri == null) failedCount += 1
          reports += RecoveryTransactionReport(
            transactionId = directory.name,
            previousState = null,
            resultState = "QUARANTINED",
            recovered = false,
            pending = false,
            errorCode = "RecoveryFailed",
          )
        } catch (_: Throwable) {
          pendingCount += 1
          reports += RecoveryTransactionReport(
            transactionId = directory.name,
            previousState = null,
            resultState = "INVALID",
            recovered = false,
            pending = true,
            errorCode = "RecoveryPending",
          )
        }
        continue
      }

      val journalTarget = safTargetKey(Uri.parse(journal.targetUri))
      if (requestedTarget != null && journalTarget != requestedTarget) continue
      if (journalTarget in blockedTargets) {
        pendingCount += 1
        reports += RecoveryTransactionReport(
          transactionId = journal.transactionId,
          previousState = journal.state.name,
          resultState = journal.state.name,
          recovered = false,
          pending = true,
          errorCode = "RecoveryPending",
        )
        continue
      }

      val result = recoverDirectory(directory, journal)
      val nextJournal = storage.readJournalSafely(directory)
      if (result.recovered) recoveredCount += 1
      if (result.success && !result.recovered) cleanedCount += 1
      if (result.recoveryPending) {
        pendingCount += 1
        blockedTargets += journalTarget
      }
      if (!result.success && !result.recoveryPending) failedCount += 1
      reports += RecoveryTransactionReport(
        transactionId = journal.transactionId,
        previousState = journal.state.name,
        resultState = nextJournal?.state?.name ?: if (directory.exists()) journal.state.name else null,
        recovered = result.recovered,
        pending = result.recoveryPending,
        errorCode = result.errorCode,
      )
    }

    return RecoverySummary(
      success = pendingCount == 0 && failedCount == 0,
      recoveredCount = recoveredCount,
      cleanedCount = cleanedCount,
      pendingCount = pendingCount,
      failedCount = failedCount,
      transactions = reports,
    )
  }

  private fun recoverDirectory(
    directory: File,
    journal: TransactionJournal,
  ): TransactionResult {
    return when (journal.state) {
      TransactionState.PREPARING,
      TransactionState.BACKUP_READY,
      -> cleanupPreparedTransaction(directory)

      TransactionState.COMMITTED,
      TransactionState.RECOVERED,
      -> cleanupCommittedTransaction(directory)

      TransactionState.WRITE_STARTED,
      TransactionState.WRITTEN_UNVERIFIED,
      TransactionState.RECOVERY_REQUIRED,
      TransactionState.RECOVERY_FAILED,
      -> {
        val uri = Uri.parse(journal.targetUri)
        if (uri.scheme != "content" || uri.authority.isNullOrBlank()) {
          markRecoveryFailed(
            directory,
            journal,
            "RecoveryFailed",
            "Recovery target URI is invalid.",
          )
        } else {
          recoverCrashedTransaction(directory, journal)
        }
      }
    }
  }

  private fun cleanupPreparedTransaction(directory: File): TransactionResult = try {
    storage.cleanup(directory)
    TransactionResult(true, null, "Prepared transaction cleaned.")
  } catch (_: Throwable) {
    TransactionResult(
      success = false,
      errorCode = "RecoveryPending",
      message = "Prepared transaction cleanup failed.",
      recoveryPending = true,
    )
  }

  private fun cleanupCommittedTransaction(directory: File): TransactionResult = try {
    storage.cleanup(directory)
    TransactionResult(true, null, "Committed transaction cleaned.")
  } catch (_: Throwable) {
    TransactionResult(
      success = false,
      errorCode = "RecoveryPending",
      message = "Committed transaction cleanup failed.",
      recoveryPending = true,
    )
  }
}
