package expo.modules.systemaudio

import android.graphics.Bitmap
import android.content.Intent
import android.graphics.BitmapFactory
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.media.audiofx.Equalizer
import android.net.Uri
import android.util.Base64
import android.util.Log
import androidx.palette.graphics.Palette
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import kotlin.math.roundToInt

/**
 * Bridges Android's Equalizer API and the androidx.palette color extraction
 * to JavaScript.
 *
 * The Equalizer is attached to audioSession=0 (output mix) which affects
 * all audio coming out of the device while the app holds the effect.
 * Requires MODIFY_AUDIO_SETTINGS (auto-granted at install on most devices).
 */
class SystemAudioModule : Module() {
  private var equalizer: Equalizer? = null
  override fun definition() = ModuleDefinition {
    Name("ExpoSystemAudio")

    // ---------- Equalizer ----------

    AsyncFunction("eqInit") {
      ensureEqualizer()
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
      ensureEqualizer()
      equalizer?.enabled = enabled
      enabled
    }

    Function("eqSetBandLevel") { band: Int, millibel: Int ->
      ensureEqualizer()
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



    AsyncFunction("readAudioFileBase64") { uri: String, maxBytes: Long? ->
      readAudioFileBase64(uri, maxBytes ?: MAX_SAFE_TAG_WRITE_FILE_BYTES)
    }

    AsyncFunction("writeAudioTags") { uri: String, request: Map<String, Any?> ->
      writeAudioTags(uri, request)
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

    OnDestroy {
      releaseEqualizer()
    }
  }


  private fun readAudioFileBase64(uri: String, maxBytes: Long): String? {
    val parsed = Uri.parse(uri)
    val size = fileSizeForAnyUri(parsed)
    if (size != null && size > maxBytes) return null
    return try {
      val bytes = readAllBytesFromUri(parsed, maxBytes) ?: return null
      Base64.encodeToString(bytes, Base64.NO_WRAP)
    } catch (e: Throwable) {
      Log.d(TAG, "audio read failed ${e.javaClass.simpleName}: ${e.message} uri=${uri.safeLogUri()}")
      null
    }
  }

  private fun writeAudioTags(uri: String, request: Map<String, Any?>): Map<String, Any?> {
    val changedFields = (request["changedFields"] as? List<*>)?.filterIsInstance<String>() ?: emptyList()
    fun result(success: Boolean, code: String?, message: String, verified: Boolean = false, bytesBefore: Long? = null, bytesAfter: Long? = null): Map<String, Any?> = mapOf(
      "success" to success,
      "uri" to uri,
      "changedFields" to if (success) changedFields else emptyList<String>(),
      "failedFields" to if (success) emptyList<String>() else changedFields,
      "errorCode" to code,
      "message" to message,
      "verified" to verified,
      "bytesBefore" to bytesBefore,
      "bytesAfter" to bytesAfter,
    )

    val parsed = try { Uri.parse(uri) } catch (_: Throwable) {
      return result(false, "UnsupportedUri", "URI could not be parsed.")
    }
    if (parsed.scheme != "content") {
      return result(false, "UnsupportedUri", "Native SAF tag writing only accepts content:// URIs.")
    }
    val rewrittenBase64 = request["rewrittenAudioBase64"] as? String
      ?: return result(false, "InvalidTagData", "Rewritten audio payload is missing.")
    val maxBytes = (request["maxFileSizeBytes"] as? Number)?.toLong() ?: MAX_SAFE_TAG_WRITE_FILE_BYTES
    val expectedOriginal = (request["expectedOriginalSizeBytes"] as? Number)?.toLong()
    val expectedOriginalSha256 = (request["expectedOriginalSha256Hex"] as? String)?.trim()?.lowercase()
    val expectedWritten = (request["expectedWrittenSizeBytes"] as? Number)?.toLong()
    val ctx = appContext.reactContext ?: return result(false, "WriteNotImplemented", "Android context is unavailable.")
    val resolver = ctx.contentResolver

    try {
      if (!hasSafWritePermission(parsed)) {
        return result(false, "MissingWritePermission", "No persisted or direct writable SAF permission is available for this URI.")
      }
      if (!isDocumentWritable(parsed)) {
        return result(false, "MissingWritePermission", "The SAF provider does not advertise writable document flags.")
      }
      val originalSize = fileSizeForAnyUri(parsed)
      if (originalSize != null && originalSize > maxBytes) {
        return result(false, "FileTooLarge", "File exceeds the safe tag write size limit.", bytesBefore = originalSize)
      }
      val original = readAllBytesFromUri(parsed, maxBytes)
        ?: return result(false, "UnsupportedUri", "Original SAF document could not be read.")
      if (expectedOriginal != null && expectedOriginal != original.size.toLong()) {
        return result(false, "VerificationFailed", "Original size changed before write; aborting without modifying the document.", bytesBefore = original.size.toLong())
      }
      if (expectedOriginalSha256.isNullOrBlank()) {
        return result(false, "VerificationFailed", "Original content digest is required before writing SAF documents.", bytesBefore = original.size.toLong())
      }
      if (!isValidSha256Hex(expectedOriginalSha256) || sha256Hex(original) != expectedOriginalSha256) {
        return result(false, "VerificationFailed", "Original content changed before write; aborting without modifying the document.", bytesBefore = original.size.toLong())
      }
      val rewritten = Base64.decode(rewrittenBase64, Base64.DEFAULT)
      if (rewritten.isEmpty()) return result(false, "InvalidTagData", "Rewritten audio payload is empty.", bytesBefore = original.size.toLong())
      if (rewritten.size.toLong() > maxBytes) return result(false, "FileTooLarge", "Rewritten audio exceeds the safe tag write size limit.", bytesBefore = original.size.toLong(), bytesAfter = rewritten.size.toLong())
      if (expectedWritten != null && expectedWritten != rewritten.size.toLong()) {
        return result(false, "VerificationFailed", "Rewritten size does not match the expected payload size.", bytesBefore = original.size.toLong(), bytesAfter = rewritten.size.toLong())
      }

      val temp = File.createTempFile("saf-tag-write-", ".tmp", ctx.cacheDir)
      try {
        temp.writeBytes(rewritten)
        if (!temp.isFile || temp.length() != rewritten.size.toLong() || !temp.readBytes().contentEquals(rewritten)) {
          return result(false, "VerificationFailed", "Temporary rewritten payload verification failed.", bytesBefore = original.size.toLong(), bytesAfter = rewritten.size.toLong())
        }
        val pfd = resolver.openFileDescriptor(parsed, "rwt")
          ?: return result(false, "MissingWritePermission", "Provider refused writable file descriptor.", bytesBefore = original.size.toLong())
        try {
          pfd.use { descriptor ->
            FileOutputStream(descriptor.fileDescriptor).use { out ->
              out.write(rewritten)
              out.flush()
              descriptor.fileDescriptor.sync()
            }
          }
        } catch (e: Throwable) {
          Log.d(TAG, "SAF descriptor write failed ${e.javaClass.simpleName}: ${e.message} uri=${uri.safeLogUri()}")
          restoreOriginalAfterFailedSafWrite(parsed, original)
          val restored = readAllBytesFromUri(parsed, maxBytes)
          if (restored == null || !restored.contentEquals(original)) {
            return result(
              false,
              "RollbackFailed",
              "SAF provider failed during write and rollback could not be verified.",
              bytesBefore = original.size.toLong(),
              bytesAfter = rewritten.size.toLong(),
            )
          }
          return result(
            false,
            "ReplaceFailed",
            "SAF provider failed during write; original bytes were restored: ${e.message}",
            bytesBefore = original.size.toLong(),
            bytesAfter = rewritten.size.toLong(),
          )
        }
        val after = readAllBytesFromUri(parsed, maxBytes)
        if (after == null || !after.contentEquals(rewritten)) {
          restoreOriginalAfterFailedSafWrite(parsed, original)
          val restored = readAllBytesFromUri(parsed, maxBytes)
          if (restored == null || !restored.contentEquals(original)) {
            return result(false, "RollbackFailed", "Written SAF document failed verification and rollback could not be verified.", bytesBefore = original.size.toLong(), bytesAfter = rewritten.size.toLong())
          }
          return result(false, "VerificationFailed", "Written SAF document failed verification; original bytes were restored.", bytesBefore = original.size.toLong(), bytesAfter = rewritten.size.toLong())
        }
        return result(true, null, "Tags written and verified.", verified = true, bytesBefore = original.size.toLong(), bytesAfter = rewritten.size.toLong())
      } finally {
        try { temp.delete() } catch (_: Throwable) {}
      }
    } catch (e: SecurityException) {
      return result(false, "MissingWritePermission", "SAF provider denied write permission: ${e.message}")
    } catch (e: Throwable) {
      Log.d(TAG, "SAF tag write failed ${e.javaClass.simpleName}: ${e.message} uri=${uri.safeLogUri()}")
      return result(false, "ReplaceFailed", "SAF provider failed during write: ${e.message}")
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
    val direct = try { ctx.checkUriPermission(uri, android.os.Process.myPid(), android.os.Process.myUid(), Intent.FLAG_GRANT_WRITE_URI_PERMISSION) == android.content.pm.PackageManager.PERMISSION_GRANTED } catch (_: Throwable) { false }
    if (direct) return true
    return ctx.contentResolver.persistedUriPermissions.any { perm ->
      perm.isWritePermission && (perm.uri == uri || uri.toString().startsWith(perm.uri.toString()))
    }
  }

  private fun isDocumentWritable(uri: Uri): Boolean {
    val ctx = appContext.reactContext ?: return false
    return try {
      if (!DocumentsContract.isDocumentUri(ctx, uri)) return true
      ctx.contentResolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_FLAGS), null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) return@use false
        val index = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_FLAGS)
        if (index < 0 || cursor.isNull(index)) return@use false
        val flags = cursor.getInt(index)
        (flags and DocumentsContract.Document.FLAG_SUPPORTS_WRITE) != 0 ||
          (flags and DocumentsContract.Document.FLAG_SUPPORTS_DELETE) != 0
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

  private fun ensureEqualizer() {
    if (equalizer == null) {
      try {
        equalizer = Equalizer(0, 0).apply { enabled = true }
      } catch (_: Throwable) {
        equalizer = null
      }
    }
  }

  private fun releaseEqualizer() {
    try {
      equalizer?.enabled = false
      equalizer?.release()
    } catch (_: Throwable) {}
    equalizer = null
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
            if (decodedBase64ByteLength(base64Payload) > MAX_PALETTE_IMAGE_BYTES) return null
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

  private fun decodedBase64ByteLength(value: String): Long {
    var cleanLength = 0L
    var last = '\u0000'
    var secondLast = '\u0000'
    value.forEach { char ->
      if (!char.isWhitespace()) {
        secondLast = last
        last = char
        cleanLength += 1
      }
    }
    val padding = when {
      cleanLength >= 2 && secondLast == '=' && last == '=' -> 2L
      cleanLength >= 1 && last == '=' -> 1L
      else -> 0L
    }
    return (cleanLength * 3L / 4L) - padding
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
    private const val MAX_SAFE_TAG_WRITE_FILE_BYTES = 50L * 1024L * 1024L
  }
}
