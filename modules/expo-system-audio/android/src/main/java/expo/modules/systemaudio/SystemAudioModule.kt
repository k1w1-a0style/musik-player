package expo.modules.systemaudio

import android.graphics.Bitmap
import android.content.Intent
import android.graphics.BitmapFactory
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import expo.modules.systemaudio.saf.SafPermissionPolicy
import expo.modules.systemaudio.saf.AndroidSafContentStore
import expo.modules.systemaudio.saf.AudioTagRewriteException
import expo.modules.systemaudio.saf.NativeTagEditRequestParser
import expo.modules.systemaudio.saf.StreamingAudioTagRewriteSource
import expo.modules.systemaudio.saf.StreamDigests
import expo.modules.systemaudio.saf.MAX_SAFE_TAG_WRITE_FILE_BYTES
import expo.modules.systemaudio.saf.AudioTagTransactionManager
import expo.modules.systemaudio.saf.TransactionStorage
import expo.modules.systemaudio.saf.TransactionWriteRequest
import expo.modules.systemaudio.saf.isValidTagWriteOperationId
import android.media.audiofx.Equalizer
import android.net.Uri
import android.util.Base64
import android.os.Build
import android.util.Log
import androidx.palette.graphics.Palette
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.UUID
import kotlin.math.roundToInt

/**
 * Bridges Android's Equalizer API and the androidx.palette color extraction
 * to JavaScript.
 *
 * The Equalizer is attached only to the active TrackPlayer audio session.
 * Invalid or unavailable sessions fail closed; the device output mix is never used.
 * Requires MODIFY_AUDIO_SETTINGS.
 */
class SystemAudioModule : Module() {
  private var equalizer: Equalizer? = null
  private var equalizerAudioSessionId: Int? = null
  override fun definition() = ModuleDefinition {
    Name("ExpoSystemAudio")

    // ---------- Equalizer ----------

    AsyncFunction("eqInit") { audioSessionId: Int ->
      if (audioSessionId <= 0) return@AsyncFunction null
      ensureEqualizer(audioSessionId)
      val eq = equalizer ?: return@AsyncFunction null
      val range = eq.bandLevelRange
      val bands = (0 until eq.numberOfBands).map { i ->
        val freq = try { eq.getCenterFreq(i.toShort()) } catch (_: Throwable) { 0 }
        mapOf(
          "index" to i,
          "centerFreqHz" to freq / 1000, // millihertz → Hz
        )
      }
      mapOf(
        "available" to true,
        "enabled" to eq.enabled,
        "bands" to bands,
        "minMillibel" to range[0].toInt(),
        "maxMillibel" to range[1].toInt(),
      )
    }

    Function("eqSetEnabled") { enabled: Boolean ->
      val eq = equalizer ?: return@Function false
      try {
        eq.enabled = enabled
        eq.enabled == enabled
      } catch (_: Throwable) {
        false
      }
    }

    Function("eqSetBandLevel") { band: Int, millibel: Int ->
      val eq = equalizer ?: return@Function false
      try {
        val clamped = millibel.coerceIn(eq.bandLevelRange[0].toInt(), eq.bandLevelRange[1].toInt())
        eq.setBandLevel(band.toShort(), clamped.toShort())
        true
      } catch (_: Throwable) {
        false
      }
    }

    Function("eqRelease") {
      releaseEqualizer()
    }

    // ---------- Palette / artwork extraction ----------

    AsyncFunction("extractPalette") { uri: String ->
      val bitmap = loadBitmap(uri) ?: return@AsyncFunction null
      val palette = Palette.from(bitmap).generate()
      bitmap.recycle()
      val result = mutableMapOf<String, Any?>()
      result["dominant"] = palette.dominantSwatch?.rgb?.let(::hex)
      result["vibrant"] = palette.vibrantSwatch?.rgb?.let(::hex)
      result["lightVibrant"] = palette.lightVibrantSwatch?.rgb?.let(::hex)
      result["darkVibrant"] = palette.darkVibrantSwatch?.rgb?.let(::hex)
      result["muted"] = palette.mutedSwatch?.rgb?.let(::hex)
      result["lightMuted"] = palette.lightMutedSwatch?.rgb?.let(::hex)
      result["darkMuted"] = palette.darkMutedSwatch?.rgb?.let(::hex)
      result
    }

    AsyncFunction("extractAudioInfo") { uri: String ->
      extractAudioInfo(uri)
    }

    AsyncFunction("extractMetadataFast") { uri: String ->
      extractFastMetadata(uri)
    }
AsyncFunction("writeAudioTags") { uri: String, request: Map<String, Any?> ->
      writeAudioTags(uri, request)
    }

    AsyncFunction("verifyAudioTagDeletion") { uri: String, request: Map<String, Any?> ->
      verifyAudioTagDeletion(uri, request)
    }

    AsyncFunction("getAudioTagRecoveryStatus") {
      getAudioTagRecoveryStatus()
    }

    AsyncFunction("recoverPendingAudioTagTransactions") { uri: String? ->
      recoverPendingAudioTagTransactions(uri)
    }

    AsyncFunction("extractEmbeddedArtwork") { uri: String ->
      val bytes = readEmbeddedArtwork(uri) ?: return@AsyncFunction null
      if (bytes.size.toLong() > MAX_EMBEDDED_ARTWORK_BYTES) {
        Log.d(TAG, "embedded artwork too large bytes=${bytes.size} uri=${uri.safeLogUri()}")
        return@AsyncFunction null
      }
      val mimeType = detectImageMime(bytes) ?: run {
        Log.d(TAG, "embedded artwork has unknown mime; bytes=${bytes.size} uri=${uri.safeLogUri()}")
        return@AsyncFunction null
      }
      val fileUri = cacheArtworkBytes(uri, bytes, extensionForMime(mimeType)) ?: return@AsyncFunction null
      Log.d(TAG, "embedded artwork cached bytes=${bytes.size} mime=$mimeType file=${fileUri.safeLogUri()}")
      mapOf(
        "uri" to fileUri,
        "mimeType" to mimeType,
        "byteLength" to bytes.size,
      )
    }

    OnCreate {
      startAudioTagRecoveryIfNeeded()
    }

    OnDestroy {
      releaseEqualizer()
      audioTagRecoveryFuture?.cancel(false)
      audioTagRecoveryExecutor.shutdown()
    }
  }


  private fun writeAudioTags(uri: String, request: Map<String, Any?>): Map<String, Any?> {
    val changedFields = (request["changedFields"] as? List<*>)?.filterIsInstance<String>() ?: emptyList()
    fun result(tx: expo.modules.systemaudio.saf.TransactionResult): Map<String, Any?> = mapOf(
      "success" to tx.success,
      "uri" to uri,
      "changedFields" to if (tx.success) changedFields else emptyList<String>(),
      "failedFields" to if (tx.success) emptyList<String>() else changedFields,
      "errorCode" to tx.errorCode,
      "message" to tx.message,
      "verified" to tx.verified,
      "noop" to tx.noop,
      "bytesBefore" to tx.bytesBefore,
      "bytesAfter" to tx.bytesAfter,
      "transactionId" to tx.transactionId,
      "recoveryPending" to tx.recoveryPending,
      "recovered" to tx.recovered,
      "cleanupPending" to tx.cleanupPending,
      "operationId" to (tx.transactionId ?: request["operationId"]),
      "phase" to tx.phase,
      "terminal" to tx.terminal,
      "retryable" to tx.retryable,
    )
    val parsed = try { Uri.parse(uri) } catch (_: Throwable) {
      return result(expo.modules.systemaudio.saf.TransactionResult(false, "UnsupportedUri", "URI could not be parsed."))
    }
    if (parsed.scheme != "content" || parsed.authority.isNullOrBlank()) {
      return result(expo.modules.systemaudio.saf.TransactionResult(false, "UnsupportedUri", "Native SAF tag writing only accepts valid content:// URIs."))
    }
    val ctx = appContext.reactContext ?: return result(expo.modules.systemaudio.saf.TransactionResult(false, "WriteNotImplemented", "Android context is unavailable."))
    return try {
      val maxBytes = parseTagWriteMaxBytes(request["maxFileSizeBytes"])
      val spec = NativeTagEditRequestParser.parse(request, changedFields, maxBytes)
      val operationId = when (val supplied = request["operationId"]) {
        null -> UUID.randomUUID().toString()
        is String -> supplied.takeIf(::isValidTagWriteOperationId)
          ?: throw AudioTagRewriteException("InvalidTagData", "Tag write operation identifier is invalid.")
        else -> throw AudioTagRewriteException("InvalidTagData", "Tag write operation identifier is invalid.")
      }
      val manager = audioTagTransactionManager(ctx)
      result(manager.write(TransactionWriteRequest(
        operationId = operationId,
        uri = parsed,
        rewriteSource = StreamingAudioTagRewriteSource(spec),
        changedFields = changedFields,
        maxBytes = maxBytes,
        expectedOriginalSize = (request["expectedOriginalSizeBytes"] as? Number)?.toLong(),
        expectedOriginalSha256 = (request["expectedOriginalSha256Hex"] as? String)?.trim()?.lowercase(),
      )))
    } catch (e: AudioTagRewriteException) {
      result(expo.modules.systemaudio.saf.TransactionResult(false, e.errorCode, e.message ?: "Native tag rewrite request is invalid."))
    } catch (e: SecurityException) {
      result(expo.modules.systemaudio.saf.TransactionResult(false, "MissingWritePermission", "SAF provider denied write permission: ${e.message}"))
    } catch (e: Throwable) {
      Log.d(TAG, "SAF tag transaction failed ${e.javaClass.simpleName}: ${e.message} uri=${uri.safeLogUri()}")
      result(expo.modules.systemaudio.saf.TransactionResult(false, "ReplaceFailed", "SAF transaction failed: ${e.message}"))
    }
  }

  private fun parseTagWriteMaxBytes(raw: Any?): Long {
    if (raw == null) return MAX_SAFE_TAG_WRITE_FILE_BYTES
    if (raw !is Number) {
      throw AudioTagRewriteException("InvalidTagData", "Maximum file size must be numeric.")
    }
    val numeric = raw.toDouble()
    if (!numeric.isFinite() || numeric % 1.0 != 0.0) {
      throw AudioTagRewriteException("InvalidTagData", "Maximum file size must be a finite integer.")
    }
    val value = raw.toLong()
    if (value <= 0L) {
      throw AudioTagRewriteException("InvalidTagData", "Maximum file size must be positive.")
    }
    if (value > MAX_SAFE_TAG_WRITE_FILE_BYTES) {
      throw AudioTagRewriteException("FileTooLarge", "Maximum file size exceeds the native safety limit.")
    }
    return value
  }

  private fun verifyAudioTagDeletion(uri: String, request: Map<String, Any?>): Boolean {
    val parsed = try {
      Uri.parse(uri)
    } catch (_: Throwable) {
      return false
    }
    if (parsed.scheme != "content" || parsed.authority.isNullOrBlank()) return false
    val ctx = appContext.reactContext ?: return false
    val maxBytes = try {
      parseTagWriteMaxBytes(request["maxFileSizeBytes"])
    } catch (_: AudioTagRewriteException) {
      return false
    }
    val changedFields = (request["changedFields"] as? List<*>)?.filterIsInstance<String>() ?: emptyList()
    val original = File.createTempFile("tag-delete-original-", ".bin", ctx.cacheDir)
    val rewritten = File.createTempFile("tag-delete-rewritten-", ".bin", ctx.cacheDir)
    return try {
      val spec = NativeTagEditRequestParser.parse(request, changedFields, maxBytes)
      if (!spec.hasDeletionIntent) return false
      val recovery = audioTagTransactionManager(ctx).recoverPendingSummary(parsed)
      if (!recovery.success) return false
      val store = AndroidSafContentStore(ctx)
      val originalDigest = StreamDigests.copyUriToFileWithDigest(store, parsed, original, maxBytes)
        ?: return false
      val rewrite = StreamingAudioTagRewriteSource(spec).rewrite(original, rewritten, maxBytes)
      !rewrite.changed || rewrite.digest == originalDigest
    } catch (error: Throwable) {
      Log.d(TAG, "SAF deletion verification failed ${error.javaClass.simpleName}: ${error.message} uri=${uri.safeLogUri()}")
      false
    } finally {
      original.delete()
      rewritten.delete()
    }
  }

  private fun getAudioTagRecoveryStatus(): Map<String, Any?> {
    val ctx = appContext.reactContext ?: return mapOf("pendingCount" to 0, "transactions" to emptyList<Map<String, Any?>>())
    return audioTagTransactionManager(ctx).status()
  }

  private fun recoverPendingAudioTagTransactions(uri: String?): Map<String, Any?> {
  val ctx = appContext.reactContext ?: return mapOf("success" to false, "errorCode" to "WriteNotImplemented", "message" to "Android context is unavailable.", "recoveryPending" to false)
  val targetUri = uri?.trim()?.takeIf { it.isNotEmpty() }?.let { raw ->
    val parsed = try { Uri.parse(raw) } catch (_: Throwable) {
      return mapOf("success" to false, "errorCode" to "UnsupportedUri", "message" to "Recovery target URI could not be parsed.", "recoveryPending" to false)
    }
    if (parsed.scheme != "content") {
      return mapOf("success" to false, "errorCode" to "UnsupportedUri", "message" to "Recovery target must be a content:// URI.", "recoveryPending" to false)
    }
    parsed
  }
  return audioTagTransactionManager(ctx).recoverPendingSummary(targetUri).toMap()
}

private val audioTagRecoveryExecutor = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "saf-audio-tag-recovery").apply { isDaemon = true }
  }
  @Volatile private var audioTagRecoveryFuture: Future<*>? = null
  @Volatile private var audioTagTransactions: AudioTagTransactionManager? = null

  private fun audioTagTransactionManager(ctx: android.content.Context): AudioTagTransactionManager {
    return audioTagTransactions ?: synchronized(this) {
      audioTagTransactions ?: AudioTagTransactionManager(
        TransactionStorage(File(ctx.noBackupFilesDir, "audio-tag-transactions")),
        AndroidSafContentStore(ctx),
      ).also { audioTagTransactions = it }
    }
  }

  private fun startAudioTagRecoveryIfNeeded() {
    val ctx = appContext.reactContext ?: return
    if (audioTagRecoveryFuture != null) return
    synchronized(this) {
      if (audioTagRecoveryFuture != null) return
      val manager = audioTagTransactionManager(ctx)
      audioTagRecoveryFuture = audioTagRecoveryExecutor.submit { manager.recoverPendingSummary() }
    }
  }

  private fun sha256Hex(bytes: ByteArray): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
    return digest.joinToString("") { byte -> "%02x".format(byte) }
  }

  private fun isValidSha256Hex(value: String): Boolean =
    value.length == 64 && value.all { it in '0'..'9' || it in 'a'..'f' }

  private fun readAllBytesFromUri(uri: Uri, maxBytes: Long): ByteArray? {
    val ctx = appContext.reactContext ?: return null
    val out = ByteArrayOutputStream()
    ctx.contentResolver.openInputStream(uri)?.use { input ->
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
      var total = 0L
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        total += read.toLong()
        if (total > maxBytes) return null
        out.write(buffer, 0, read)
      }
    } ?: return null
    return out.toByteArray()
  }

  private fun fileSizeForAnyUri(uri: Uri): Long? {
    if (uri.scheme == "content") return readOpenableInfo(uri.toString())?.sizeBytes
    return fileSizeForUri(uri.toString())
  }

  private fun hasSafWritePermission(uri: Uri): Boolean {
    val ctx = appContext.reactContext ?: return false
    val direct = try {
      ctx.checkUriPermission(
        uri,
        android.os.Process.myPid(),
        android.os.Process.myUid(),
        Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
      ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    } catch (_: Throwable) { false }
    if (direct) return true

    return ctx.contentResolver.persistedUriPermissions.any { perm ->
      if (!perm.isWritePermission) return@any false
      if (perm.uri == uri) return@any true
      isUriCoveredByPersistedTreePermission(perm.uri, uri)
    }
  }

  private fun isUriCoveredByPersistedTreePermission(permissionUri: Uri, targetUri: Uri): Boolean {
    val ctx = appContext.reactContext ?: return false
    return try {
      if (!DocumentsContract.isTreeUri(permissionUri)) return false
      if (permissionUri.authority != targetUri.authority) return false
      val treeDocumentId = DocumentsContract.getTreeDocumentId(permissionUri)
      val targetDocumentId = when {
        DocumentsContract.isDocumentUri(ctx, targetUri) -> DocumentsContract.getDocumentId(targetUri)
        DocumentsContract.isTreeUri(targetUri) -> DocumentsContract.getTreeDocumentId(targetUri)
        else -> return false
      }
      val parentDocumentUri = DocumentsContract.buildDocumentUriUsingTree(permissionUri, treeDocumentId)
      val targetDocumentUri = when {
        DocumentsContract.isDocumentUri(ctx, targetUri) -> targetUri
        DocumentsContract.isTreeUri(targetUri) -> DocumentsContract.buildDocumentUriUsingTree(targetUri, targetDocumentId)
        else -> return false
      }
      SafPermissionPolicy.isPersistedGrantCovered(
        SafPermissionPolicy.PersistedGrantKind.TREE,
        true,
        permissionUri.authority,
        treeDocumentId,
        targetUri.authority,
        targetDocumentId,
        providerChildDecision = tryProviderChildDocumentCheck(parentDocumentUri, targetDocumentUri),
      )
    } catch (_: Throwable) { false }
  }

  private fun tryProviderChildDocumentCheck(
    parentDocumentUri: Uri,
    targetDocumentUri: Uri,
  ): SafPermissionPolicy.ProviderChildDecision {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return SafPermissionPolicy.ProviderChildDecision.UNAVAILABLE
    }
    val ctx = appContext.reactContext ?: return SafPermissionPolicy.ProviderChildDecision.UNAVAILABLE
    return try {
      if (DocumentsContract.isChildDocument(ctx.contentResolver, parentDocumentUri, targetDocumentUri)) {
        SafPermissionPolicy.ProviderChildDecision.CHILD
      } else {
        SafPermissionPolicy.ProviderChildDecision.NOT_CHILD
      }
    } catch (_: Throwable) { SafPermissionPolicy.ProviderChildDecision.UNAVAILABLE }
  }

  private fun isDocumentWritable(uri: Uri): Boolean {
    val ctx = appContext.reactContext ?: return false
    return try {
      val queryUri = when {
        DocumentsContract.isDocumentUri(ctx, uri) -> uri
        DocumentsContract.isTreeUri(uri) -> DocumentsContract.buildDocumentUriUsingTree(
          uri,
          DocumentsContract.getTreeDocumentId(uri),
        )
        else -> return false
      }
      ctx.contentResolver.query(queryUri, arrayOf(DocumentsContract.Document.COLUMN_FLAGS), null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) return@use false
        val index = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_FLAGS)
        if (index < 0 || cursor.isNull(index)) return@use false
        val flags = cursor.getInt(index)
        SafPermissionPolicy.isDocumentWritableFromFlags(flags, DocumentsContract.Document.FLAG_SUPPORTS_WRITE)
      } ?: false
    } catch (_: Throwable) { false }
  }

  private fun restoreOriginalAfterFailedSafWrite(uri: Uri, original: ByteArray) {
    val ctx = appContext.reactContext ?: return
    ctx.contentResolver.openFileDescriptor(uri, "rwt")?.use { descriptor ->
      FileOutputStream(descriptor.fileDescriptor).use { out ->
        out.write(original)
        out.flush()
        descriptor.fileDescriptor.sync()
      }
    }
  }

  private fun ensureEqualizer(audioSessionId: Int) {
    if (equalizer != null && equalizerAudioSessionId == audioSessionId) return
    releaseEqualizer()
    try {
      equalizer = Equalizer(0, audioSessionId).apply { enabled = true }
      equalizerAudioSessionId = audioSessionId
    } catch (_: Throwable) {
      equalizer = null
      equalizerAudioSessionId = null
    }
  }

  private fun releaseEqualizer() {
    try {
      equalizer?.enabled = false
      equalizer?.release()
    } catch (_: Throwable) {}
    equalizer = null
    equalizerAudioSessionId = null
  }

  private fun hex(rgb: Int): String {
    val r = (rgb shr 16) and 0xff
    val g = (rgb shr 8) and 0xff
    val b = rgb and 0xff
    return String.format("#%02X%02X%02X", r, g, b)
  }

  private fun loadBitmap(uri: String): Bitmap? {
    return try {
      when {
        uri.startsWith("data:") -> {
          val comma = uri.indexOf(',')
          if (comma < 0) null
          else {
            val base64Payload = uri.substring(comma + 1)
            if (decodedImageBase64ByteLength(base64Payload) > MAX_PALETTE_IMAGE_BYTES) return null
            val bytes = Base64.decode(base64Payload, Base64.DEFAULT)
            decodeByteArrayForPalette(bytes)
          }
        }
        uri.startsWith("http://") || uri.startsWith("https://") -> {
          Log.d(TAG, "remote palette extraction blocked uri=${uri.safeLogUri()}")
          null
        }
        else -> {
          val parsed = Uri.parse(uri)
          if (parsed.scheme == "file") {
            val path = parsed.path ?: return null
            decodeFileForPalette(path)
          } else {
            decodeContentUriForPalette(parsed)
          }
        }
      }
    } catch (e: Throwable) {
      Log.d(TAG, "palette bitmap decode failed ${e.javaClass.simpleName}: ${e.message} uri=${uri.safeLogUri()}")
      null
    }
  }

  private fun hasValidBounds(opts: BitmapFactory.Options): Boolean =
    opts.outWidth > 0 && opts.outHeight > 0

  private fun calculateInSampleSize(width: Int, height: Int, maxPixels: Int): Int {
    if (width <= 0 || height <= 0 || maxPixels <= 0) return 1

    var sampleSize = 1
    while ((width.toLong() / sampleSize) * (height.toLong() / sampleSize) > maxPixels) {
      if (sampleSize > Int.MAX_VALUE / 2) return sampleSize
      sampleSize *= 2
    }
    return sampleSize.coerceAtLeast(1)
  }

  private fun decodeByteArrayForPalette(bytes: ByteArray): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (!hasValidBounds(bounds)) return null

    val opts = BitmapFactory.Options().apply {
      inSampleSize = calculateInSampleSize(bounds.outWidth, bounds.outHeight, MAX_PALETTE_PIXELS)
    }
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
  }

  private fun decodeFileForPalette(path: String): Bitmap? {
    val file = File(path)
    if (!file.exists() || !file.isFile) return null

    val fileLength = file.length()
    if (fileLength > MAX_PALETTE_IMAGE_BYTES) {
      Log.d(TAG, "palette file too large bytes=$fileLength path=${path.safeLogUri()}")
      return null
    }

    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    if (!hasValidBounds(bounds)) return null

    val opts = BitmapFactory.Options().apply {
      inSampleSize = calculateInSampleSize(bounds.outWidth, bounds.outHeight, MAX_PALETTE_PIXELS)
    }
    return BitmapFactory.decodeFile(path, opts)
  }

  private fun decodeContentUriForPalette(uri: Uri): Bitmap? {
    val ctx = appContext.reactContext ?: return null

    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    val boundsStream = ctx.contentResolver.openInputStream(uri) ?: return null
    boundsStream.use { stream ->
      BitmapFactory.decodeStream(stream, null, bounds)
    }

    if (!hasValidBounds(bounds)) return null

    val opts = BitmapFactory.Options().apply {
      inSampleSize = calculateInSampleSize(bounds.outWidth, bounds.outHeight, MAX_PALETTE_PIXELS)
    }
    return ctx.contentResolver.openInputStream(uri)?.use { stream ->
      BitmapFactory.decodeStream(stream, null, opts)
    }
  }

  private fun extractAudioInfo(uri: String): Map<String, Any?>? {
    val result = mutableMapOf<String, Any?>()
    readOpenableInfo(uri)?.let { info ->
      info.sizeBytes?.let { result["sizeBytes"] = it }
      info.displayName?.let { result["displayName"] = it }
    }
    fileSizeForUri(uri)?.let { result.putIfAbsent("sizeBytes", it) }
    mimeTypeForUri(uri)?.let { result["mimeType"] = it }
    readRetrieverInfo(uri)?.let { info ->
      info.durationMs?.let { result["durationMs"] = it }
      info.bitrateBps?.let { result["bitrateBps"] = it }
    }
    readExtractorInfo(uri)?.let { info ->
      info.sampleRateHz?.let { result["sampleRateHz"] = it }
      info.channels?.let { result["channels"] = it }
      info.mimeType?.let { result.putIfAbsent("mimeType", it) }
    }
    return result.ifEmpty { null }
  }

  /**
   * Native Fast-Path: read the standard tag fields via MediaMetadataRetriever.
   * Marked pending Android device validation – the implementation is built so
   * callers can JS-ID3 fall back per missing field.
   */
  private fun extractFastMetadata(uri: String): Map<String, Any?>? {
    val retriever = MediaMetadataRetriever()
    return try {
      if (!configureDataSource(retriever, uri)) return null
      val result = mutableMapOf<String, Any?>()
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)?.takeIf { it.isNotBlank() }?.let { result["title"] = it }
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)?.takeIf { it.isNotBlank() }?.let { result["artist"] = it }
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM)?.takeIf { it.isNotBlank() }?.let { result["album"] = it }
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST)?.takeIf { it.isNotBlank() }?.let { result["albumArtist"] = it }
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR)?.takeIf { it.isNotBlank() }?.let { result["year"] = it }
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER)?.takeIf { it.isNotBlank() }?.let { result["trackNumber"] = it }
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DISC_NUMBER)?.takeIf { it.isNotBlank() }?.let { result["discNumber"] = it }
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_GENRE)?.takeIf { it.isNotBlank() }?.let { result["genre"] = it }
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_COMPOSER)?.takeIf { it.isNotBlank() }?.let { result["composer"] = it }
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()?.takeIf { it > 0 }?.let { result["durationMs"] = it }
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE)?.toLongOrNull()?.takeIf { it > 0 }?.let { result["bitrateBps"] = it }
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_MIMETYPE)?.takeIf { it.isNotBlank() }?.let { result["mimeType"] = it }
      result.ifEmpty { null }
    } catch (e: Throwable) {
      Log.d(TAG, "fast metadata unavailable ${e.javaClass.simpleName}: ${e.message} uri=${uri.safeLogUri()}")
      null
    } finally {
      try { retriever.release() } catch (_: Throwable) {}
    }
  }

  private data class OpenableInfo(val sizeBytes: Long?, val displayName: String?)
  private data class RetrieverInfo(val durationMs: Long?, val bitrateBps: Long?)
  private data class ExtractorInfo(val sampleRateHz: Int?, val channels: Int?, val mimeType: String?)

  private fun readOpenableInfo(uri: String): OpenableInfo? {
    val parsed = Uri.parse(uri)
    if (parsed.scheme != "content") return null
    val ctx = appContext.reactContext ?: return null
    return try {
      ctx.contentResolver.query(parsed, arrayOf(OpenableColumns.SIZE, OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) return@use null
        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        val size = if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) cursor.getLong(sizeIndex).takeIf { it > 0 } else null
        val name = if (nameIndex >= 0 && !cursor.isNull(nameIndex)) cursor.getString(nameIndex)?.takeIf { it.isNotBlank() } else null
        OpenableInfo(size, name)
      }
    } catch (e: Throwable) {
      Log.d(TAG, "openable info unavailable ${e.javaClass.simpleName}: ${e.message} uri=${uri.safeLogUri()}")
      null
    }
  }

  private fun fileSizeForUri(uri: String): Long? {
    return try {
      val parsed = Uri.parse(uri)
      val path = if (parsed.scheme == "file") parsed.path else if (parsed.scheme.isNullOrBlank()) uri else null
      path?.let { File(it) }?.takeIf { it.isFile }?.length()?.takeIf { it > 0 }
    } catch (_: Throwable) { null }
  }

  private fun mimeTypeForUri(uri: String): String? {
    val parsed = Uri.parse(uri)
    if (parsed.scheme != "content") return null
    val ctx = appContext.reactContext ?: return null
    return try { ctx.contentResolver.getType(parsed)?.takeIf { it.isNotBlank() } } catch (_: Throwable) { null }
  }

  private fun configureDataSource(retriever: MediaMetadataRetriever, uri: String): Boolean {
    val ctx = appContext.reactContext ?: return false
    val parsed = Uri.parse(uri)
    return try {
      when {
        parsed.scheme == "content" -> retriever.setDataSource(ctx, parsed)
        parsed.scheme == "file" -> retriever.setDataSource(parsed.path ?: return false)
        uri.startsWith("http://") || uri.startsWith("https://") -> return false
        else -> retriever.setDataSource(uri)
      }
      true
    } catch (e: Throwable) {
      Log.d(TAG, "metadata retriever unavailable ${e.javaClass.simpleName}: ${e.message} uri=${uri.safeLogUri()}")
      false
    }
  }

  private fun readRetrieverInfo(uri: String): RetrieverInfo? {
    val retriever = MediaMetadataRetriever()
    return try {
      if (!configureDataSource(retriever, uri)) return null
      val duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()?.takeIf { it > 0 }
      val bitrate = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE)?.toLongOrNull()?.takeIf { it > 0 }
      RetrieverInfo(duration, bitrate)
    } finally {
      try { retriever.release() } catch (_: Throwable) {}
    }
  }

  private fun readExtractorInfo(uri: String): ExtractorInfo? {
    val ctx = appContext.reactContext ?: return null
    val extractor = MediaExtractor()
    return try {
      val parsed = Uri.parse(uri)
      when {
        parsed.scheme == "content" -> extractor.setDataSource(ctx, parsed, null)
        parsed.scheme == "file" -> extractor.setDataSource(parsed.path ?: return null)
        uri.startsWith("http://") || uri.startsWith("https://") -> return null
        else -> extractor.setDataSource(uri)
      }
      for (i in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(i)
        val mime = if (format.containsKey(MediaFormat.KEY_MIME)) format.getString(MediaFormat.KEY_MIME) else null
        if (mime?.startsWith("audio/") == true) {
          val sampleRate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) format.getInteger(MediaFormat.KEY_SAMPLE_RATE).takeIf { it > 0 } else null
          val channels = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) format.getInteger(MediaFormat.KEY_CHANNEL_COUNT).takeIf { it > 0 } else null
          return ExtractorInfo(sampleRate, channels, mime)
        }
      }
      null
    } catch (e: Throwable) {
      Log.d(TAG, "media extractor unavailable ${e.javaClass.simpleName}: ${e.message} uri=${uri.safeLogUri()}")
      null
    } finally {
      try { extractor.release() } catch (_: Throwable) {}
    }
  }

  private fun readEmbeddedArtwork(uri: String): ByteArray? {
    val ctx = appContext.reactContext ?: return null
    val retriever = MediaMetadataRetriever()
    return try {
      val parsed = Uri.parse(uri)
      when {
        parsed.scheme == "content" -> retriever.setDataSource(ctx, parsed)
        parsed.scheme == "file" -> {
          val path = parsed.path
          if (path.isNullOrBlank()) {
            Log.d(TAG, "file uri has no path: ${uri.safeLogUri()}")
            return null
          }
          retriever.setDataSource(path)
        }
        uri.startsWith("http://") || uri.startsWith("https://") -> {
          Log.d(TAG, "remote embedded artwork extraction blocked uri=${uri.safeLogUri()}")
          return null
        }
        else -> retriever.setDataSource(uri)
      }
      val artwork = retriever.embeddedPicture
      if (artwork == null) Log.d(TAG, "no embedded artwork found uri=${uri.safeLogUri()}")
      else Log.d(TAG, "embedded artwork found bytes=${artwork.size} uri=${uri.safeLogUri()}")
      artwork
    } catch (e: Throwable) {
      Log.d(TAG, "embedded artwork failed ${e.javaClass.simpleName}: ${e.message} uri=${uri.safeLogUri()}")
      null
    } finally {
      try {
        retriever.release()
      } catch (_: Throwable) {}
    }
  }

  private fun cacheArtworkBytes(sourceUri: String, bytes: ByteArray, extension: String): String? {
    if (bytes.size.toLong() > MAX_EMBEDDED_ARTWORK_BYTES) return null
    val ctx = appContext.reactContext ?: return null
    return try {
      val dir = File(ctx.cacheDir, EMBEDDED_ARTWORK_CACHE_DIR)
      if (!dir.exists()) dir.mkdirs()
      val safeName = "${Integer.toHexString(sourceUri.hashCode())}-${Integer.toHexString(bytes.contentHashCode())}.$extension"
      val out = File(dir, safeName)
      if (!out.exists()) out.writeBytes(bytes)
      out.setLastModified(System.currentTimeMillis())
      trimEmbeddedArtworkCache(dir)
      "file://${out.absolutePath}"
    } catch (e: Throwable) {
      Log.d(TAG, "embedded artwork cache failed ${e.javaClass.simpleName}: ${e.message}")
      null
    }
  }

  private fun trimEmbeddedArtworkCache(dir: File) {
    try {
      val files = dir.listFiles()
        ?.filter { it.isFile }
        ?.sortedByDescending { it.lastModified() }
        ?: return
      var totalBytes = 0L
      var keptFiles = 0
      files.forEach { file ->
        val fileSize = file.length()
        val keepFile = keptFiles < MAX_EMBEDDED_ARTWORK_CACHE_FILES &&
          totalBytes + fileSize <= MAX_EMBEDDED_ARTWORK_CACHE_BYTES
        if (keepFile) {
          totalBytes += fileSize
          keptFiles += 1
        } else if (!file.delete()) {
          Log.d(TAG, "embedded artwork cache trim skipped file=${file.absolutePath.safeLogUri()}")
        }
      }
    } catch (e: Throwable) {
      Log.d(TAG, "embedded artwork cache trim failed ${e.javaClass.simpleName}: ${e.message}")
    }
  }

  private fun detectImageMime(bytes: ByteArray): String? {
    if (bytes.size >= 3 && bytes[0] == 0xff.toByte() && bytes[1] == 0xd8.toByte() && bytes[2] == 0xff.toByte())
      return "image/jpeg"
    if (
      bytes.size >= 8 &&
      bytes[0] == 0x89.toByte() && bytes[1] == 0x50.toByte() && bytes[2] == 0x4e.toByte() && bytes[3] == 0x47.toByte() &&
      bytes[4] == 0x0d.toByte() && bytes[5] == 0x0a.toByte() && bytes[6] == 0x1a.toByte() && bytes[7] == 0x0a.toByte()
    ) return "image/png"
    if (
      bytes.size >= 12 &&
      bytes[0] == 0x52.toByte() && bytes[1] == 0x49.toByte() && bytes[2] == 0x46.toByte() && bytes[3] == 0x46.toByte() &&
      bytes[8] == 0x57.toByte() && bytes[9] == 0x45.toByte() && bytes[10] == 0x42.toByte() && bytes[11] == 0x50.toByte()
    ) return "image/webp"
    return null
  }

  private fun extensionForMime(mimeType: String): String = when (mimeType) {
    "image/png" -> "png"
    "image/webp" -> "webp"
    else -> "jpg"
  }

  /** Computes decoded size for bounded image data URIs only; audio bytes never use Base64. */
  private fun decodedImageBase64ByteLength(value: String): Long {
      var cleanLength = 0L
      var last = '\u0000'
      var secondLast = '\u0000'
      value.forEach { char ->
        if (!char.isWhitespace()) {
          secondLast = last
          last = char
          cleanLength += 1L
        }
      }
      val padding = when {
        cleanLength >= 2L && secondLast == '=' && last == '=' -> 2L
        cleanLength >= 1L && last == '=' -> 1L
        else -> 0L
      }
      return ((cleanLength * 3L / 4L) - padding).coerceAtLeast(0L)
  }

  private fun String.safeLogUri(): String = if (length <= 140) this else take(140) + "…"

  @Suppress("unused")
  private fun normalize01(v: Double): Double = v.coerceIn(0.0, 1.0)

  @Suppress("unused")
  private fun toIntPercent(v: Double): Int = (v * 100).roundToInt()

  private companion object {
    private const val TAG = "SystemAudio"
    private const val EMBEDDED_ARTWORK_CACHE_DIR = "embedded-artwork"
    private const val MAX_EMBEDDED_ARTWORK_CACHE_FILES = 200
    private const val MAX_EMBEDDED_ARTWORK_CACHE_BYTES = 25L * 1024L * 1024L
    private const val MAX_EMBEDDED_ARTWORK_BYTES = 2L * 1024L * 1024L
    private const val MAX_PALETTE_IMAGE_BYTES = 2L * 1024L * 1024L
    private const val MAX_PALETTE_PIXELS = 1024 * 1024
  }
}
