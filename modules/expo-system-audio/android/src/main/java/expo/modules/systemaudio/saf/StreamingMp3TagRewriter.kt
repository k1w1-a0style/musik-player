package expo.modules.systemaudio.saf

import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.RandomAccessFile

object StreamingMp3TagRewriter {
  private const val ID3_HEADER_BYTES = 10
  private const val MAX_ID3_METADATA_BYTES = 16L * 1024L * 1024L
  private const val BUFFER_BYTES = 64 * 1024
  private const val SYNCHSAFE_MAX = 0x0fffffff

  private data class Header(
    val major: Int,
    val flags: Int,
    val payloadSize: Int,
    val totalTagBytes: Long,
    val frameStart: Int,
  )

  private data class Frame(
    val id: String,
    val raw: ByteArray,
  )

  fun rewrite(
    original: File,
    temporary: File,
    spec: NativeTagEditSpec,
    maxBytes: Long,
  ): AudioTagRewriteResult {
    if (!original.isFile || original.length() <= 0L) {
      throw AudioTagRewriteException("InvalidTagData", "Audio file is empty or unavailable.")
    }
    if (original.length() > maxBytes) throw SizeLimitException()

    val parsed = readHeaderAndFrames(original, maxBytes)
    val header = parsed.first
    val frames = parsed.second
    if (spec.hasDeletionIntent && hasUnsupportedTailMetadata(original)) {
      throw AudioTagRewriteException(
        "WriteNotImplemented",
        "MP3 deletion is blocked while ID3v1, APEv2, or Lyrics3 tail metadata remains.",
      )
    }
    val targetMajor = if (header?.major == 4) 4 else 3
    val touchedIds = touchedFrameIds(spec)
    val existingTouched = frames.any { it.id in touchedIds }
    val replacements = buildReplacementFrames(spec, targetMajor)
    val changed = spec.hasIntent && (existingTouched || replacements.isNotEmpty())

    FileOutputStream(temporary).use { output ->
      if (!changed) {
        FileInputStream(original).use { input -> copyBounded(input, output, maxBytes) }
      } else {
        val kept = frames.filterNot { it.id in touchedIds }.map { it.raw }
        val payloadSize = kept.sumOf { it.size.toLong() } + replacements.sumOf { it.size.toLong() }
        if (payloadSize > SYNCHSAFE_MAX.toLong()) {
          throw AudioTagRewriteException("InvalidTagData", "ID3 tag size exceeds the synchsafe limit.")
        }
        if (payloadSize > 0L) {
          output.write(buildHeader(targetMajor, payloadSize.toInt()))
          kept.forEach(output::write)
          replacements.forEach(output::write)
        }
        val audioStart = header?.totalTagBytes ?: 0L
        RandomAccessFile(original, "r").use { source ->
          source.seek(audioStart)
          copyBounded(source, output, maxBytes, initialBytes = if (payloadSize > 0L) ID3_HEADER_BYTES + payloadSize else 0L)
        }
      }
      output.flush()
      output.fd.sync()
    }

    val digest = StreamDigests.hashFile(temporary, maxBytes)
    return AudioTagRewriteResult(changed = changed, digest = digest)
  }

  private fun readHeaderAndFrames(original: File, maxBytes: Long): Pair<Header?, List<Frame>> {
    RandomAccessFile(original, "r").use { source ->
      val prefixLength = minOf(ID3_HEADER_BYTES.toLong(), source.length()).toInt()
      val prefix = ByteArray(prefixLength)
      source.readFully(prefix)
      val hasPreamble = prefixLength >= 3 && prefix[0] == 0x49.toByte() &&
        prefix[1] == 0x44.toByte() && prefix[2] == 0x33.toByte()
      if (!hasPreamble) return null to emptyList()
      if (prefixLength < ID3_HEADER_BYTES) {
        throw AudioTagRewriteException("InvalidTagData", "Truncated ID3 header.")
      }

      val major = prefix[3].toInt() and 0xff
      if (major == 2) {
        throw AudioTagRewriteException("WriteNotImplemented", "Existing ID3v2.2 tags are not supported yet.")
      }
      if (major !in setOf(3, 4)) {
        throw AudioTagRewriteException("InvalidTagData", "Unsupported ID3 major version: $major")
      }
      val flags = prefix[5].toInt() and 0xff
      if ((flags and 0x80) != 0) {
        throw AudioTagRewriteException("WriteNotImplemented", "Existing ID3 unsynchronisation is not supported yet.")
      }
      if (major == 4 && (flags and 0x40) != 0) {
        throw AudioTagRewriteException("WriteNotImplemented", "Existing ID3v2.4 extended headers are not supported for safe rewriting yet.")
      }
      if (major == 4 && (flags and 0x20) != 0) {
        throw AudioTagRewriteException("WriteNotImplemented", "Existing experimental ID3v2.4 tags are not supported for safe rewriting yet.")
      }
      if (major == 4 && (flags and 0x10) != 0) {
        throw AudioTagRewriteException("WriteNotImplemented", "Existing ID3v2.4 footer tags are not supported yet.")
      }

      val payloadSize = decodeSynchsafe(prefix, 6)
      val footerBytes = if (major == 4 && (flags and 0x10) != 0) 10 else 0
      val totalTagBytes = ID3_HEADER_BYTES.toLong() + payloadSize.toLong() + footerBytes
      if (totalTagBytes > source.length()) {
        throw AudioTagRewriteException("InvalidTagData", "ID3 tag size exceeds the file length.")
      }
      if (totalTagBytes > maxBytes || totalTagBytes > MAX_ID3_METADATA_BYTES) {
        throw AudioTagRewriteException("FileTooLarge", "ID3 metadata exceeds the safe native rewrite limit.")
      }

      val tag = ByteArray(totalTagBytes.toInt())
      source.seek(0)
      source.readFully(tag)
      var frameStart = ID3_HEADER_BYTES
      if ((flags and 0x40) != 0) {
        if (major != 3 || frameStart + 4 > ID3_HEADER_BYTES + payloadSize) {
          throw AudioTagRewriteException("InvalidTagData", "Truncated ID3 extended header.")
        }
        val extendedSize = readU32(tag, frameStart)
        if (extendedSize < 6 || frameStart.toLong() + 4L + extendedSize.toLong() > (ID3_HEADER_BYTES + payloadSize).toLong()) {
          throw AudioTagRewriteException("InvalidTagData", "Invalid ID3v2.3 extended header size.")
        }
        frameStart += 4 + extendedSize.toInt()
      }

      val header = Header(major, flags, payloadSize, totalTagBytes, frameStart)
      return header to parseFrames(tag, header)
    }
  }

  private fun parseFrames(tag: ByteArray, header: Header): List<Frame> {
    val frames = mutableListOf<Frame>()
    val end = ID3_HEADER_BYTES + header.payloadSize
    var offset = header.frameStart
    while (offset + 10 <= end) {
      if (tag[offset] == 0.toByte()) break
      val id = String(tag, offset, 4, Charsets.US_ASCII)
      if (!Regex("^[A-Z0-9]{4}$").matches(id)) {
        throw AudioTagRewriteException("InvalidTagData", "Invalid ID3 frame ID.")
      }
      val size = if (header.major == 4) decodeSynchsafe(tag, offset + 4) else readU32(tag, offset + 4)
      if (size < 0 || offset.toLong() + 10L + size.toLong() > end.toLong()) {
        throw AudioTagRewriteException("InvalidTagData", "Truncated ID3 frame.")
      }
      frames += Frame(id, tag.copyOfRange(offset, offset + 10 + size))
      offset += 10 + size
    }
    return frames
  }

  private fun hasUnsupportedTailMetadata(file: File): Boolean {
    RandomAccessFile(file, "r").use { source ->
      val candidateEnds = linkedSetOf(source.length())
      val id3v1Start = source.length() - 128L
      if (hasMarker(source, id3v1Start, "TAG")) {
        candidateEnds += id3v1Start
        val enhancedStart = id3v1Start - 227L
        if (hasMarker(source, enhancedStart, "TAG+")) candidateEnds += enhancedStart
      }
      return candidateEnds.any { end ->
        hasMarker(source, end - 32L, "APETAGEX") ||
          hasMarker(source, end - 9L, "LYRICS200") ||
          hasMarker(source, end - 9L, "LYRICSEND")
      } || candidateEnds.size > 1
    }
  }

  private fun hasMarker(source: RandomAccessFile, offset: Long, marker: String): Boolean {
    if (offset < 0L || offset + marker.length > source.length()) return false
    source.seek(offset)
    val bytes = ByteArray(marker.length)
    source.readFully(bytes)
    return bytes.contentEquals(marker.toByteArray(Charsets.US_ASCII))
  }

  private fun touchedFrameIds(spec: NativeTagEditSpec): Set<String> = buildSet {
    if ("title" in spec.touchedFields) add("TIT2")
    if ("artist" in spec.touchedFields) add("TPE1")
    if ("albumArtist" in spec.touchedFields) add("TPE2")
    if ("album" in spec.touchedFields) add("TALB")
    if ("year" in spec.touchedFields) {
      add("TYER")
      add("TDRC")
    }
    if ("genre" in spec.touchedFields) add("TCON")
    if ("trackNumber" in spec.touchedFields) add("TRCK")
    if ("discNumber" in spec.touchedFields) add("TPOS")
    if ("comment" in spec.touchedFields) add("COMM")
    if ("cover" in spec.touchedFields) add("APIC")
  }

  private fun buildReplacementFrames(spec: NativeTagEditSpec, major: Int): List<ByteArray> = buildList {
    fun text(field: String, id: String) {
      if (field !in spec.touchedFields) return
      spec.normalizedValue(field)?.let { add(textFrame(id, it, major)) }
    }
    text("title", "TIT2")
    text("artist", "TPE1")
    text("albumArtist", "TPE2")
    text("album", "TALB")
    if ("year" in spec.touchedFields) {
      spec.normalizedValue("year")?.let { value ->
        if (major == 4) add(textFrame("TDRC", value, major))
        else {
          add(textFrame("TYER", value, major))
          add(textFrame("TDRC", value, major))
        }
      }
    }
    text("genre", "TCON")
    text("trackNumber", "TRCK")
    text("discNumber", "TPOS")
    if ("comment" in spec.touchedFields) {
      spec.normalizedValue("comment")?.let { add(commentFrame(it, major)) }
    }
    if ("cover" in spec.touchedFields && !spec.removeCover) {
      val mime = spec.coverMimeType
      val bytes = spec.coverBytes
      if (mime != null && bytes != null) add(artworkFrame(mime, bytes, major))
    }
  }

  private fun textFrame(id: String, value: String, major: Int): ByteArray {
    val encoded = utf16Bom(value)
    val body = ByteArray(1 + encoded.size)
    body[0] = 1
    encoded.copyInto(body, 1)
    return frame(id, body, major)
  }

  private fun commentFrame(value: String, major: Int): ByteArray {
    val descriptor = utf16Bom("")
    val text = utf16Bom(value)
    val body = ByteArray(1 + 3 + descriptor.size + text.size)
    var offset = 0
    body[offset++] = 1
    body[offset++] = 'e'.code.toByte()
    body[offset++] = 'n'.code.toByte()
    body[offset++] = 'g'.code.toByte()
    descriptor.copyInto(body, offset)
    offset += descriptor.size
    text.copyInto(body, offset)
    return frame("COMM", body, major)
  }

  private fun artworkFrame(mimeType: String, data: ByteArray, major: Int): ByteArray {
    val mime = mimeType.toByteArray(Charsets.US_ASCII)
    val body = ByteArray(1 + mime.size + 1 + 1 + 1 + data.size)
    var offset = 0
    body[offset++] = 0
    mime.copyInto(body, offset)
    offset += mime.size
    body[offset++] = 0
    body[offset++] = 3
    body[offset++] = 0
    data.copyInto(body, offset)
    return frame("APIC", body, major)
  }

  private fun frame(id: String, body: ByteArray, major: Int): ByteArray {
    if (!Regex("^[A-Z0-9]{4}$").matches(id)) {
      throw AudioTagRewriteException("InvalidTagData", "Invalid ID3 frame ID.")
    }
    if (body.size.toLong() > SYNCHSAFE_MAX.toLong() && major == 4) {
      throw AudioTagRewriteException("InvalidTagData", "ID3 frame size exceeds the synchsafe limit.")
    }
    val output = ByteArray(10 + body.size)
    id.toByteArray(Charsets.US_ASCII).copyInto(output, 0)
    if (major == 4) encodeSynchsafe(body.size).copyInto(output, 4)
    else writeU32(output, 4, body.size.toLong())
    body.copyInto(output, 10)
    return output
  }

  private fun buildHeader(major: Int, payloadSize: Int): ByteArray = ByteArray(ID3_HEADER_BYTES).also {
    it[0] = 0x49.toByte()
    it[1] = 0x44.toByte()
    it[2] = 0x33.toByte()
    it[3] = major.toByte()
    it[4] = 0
    it[5] = 0
    encodeSynchsafe(payloadSize).copyInto(it, 6)
  }

  private fun utf16Bom(value: String): ByteArray {
    val encoded = value.toByteArray(Charsets.UTF_16LE)
    return ByteArrayOutputStream(2 + encoded.size + 2).use { output ->
      output.write(0xff)
      output.write(0xfe)
      output.write(encoded)
      output.write(0)
      output.write(0)
      output.toByteArray()
    }
  }

  private fun decodeSynchsafe(bytes: ByteArray, offset: Int): Int {
    if (offset < 0 || offset + 4 > bytes.size) {
      throw AudioTagRewriteException("InvalidTagData", "Invalid synchsafe input size.")
    }
    var value = 0
    for (index in 0 until 4) {
      val byte = bytes[offset + index].toInt() and 0xff
      if (byte > 0x7f) throw AudioTagRewriteException("InvalidTagData", "Invalid synchsafe byte.")
      value = (value shl 7) or byte
    }
    return value
  }

  private fun encodeSynchsafe(value: Int): ByteArray {
    if (value !in 0..SYNCHSAFE_MAX) {
      throw AudioTagRewriteException("InvalidTagData", "ID3 tag size exceeds the synchsafe limit.")
    }
    return byteArrayOf(
      ((value shr 21) and 0x7f).toByte(),
      ((value shr 14) and 0x7f).toByte(),
      ((value shr 7) and 0x7f).toByte(),
      (value and 0x7f).toByte(),
    )
  }

  private fun readU32(bytes: ByteArray, offset: Int): Int {
    if (offset < 0 || offset + 4 > bytes.size) {
      throw AudioTagRewriteException("InvalidTagData", "Truncated 32-bit value.")
    }
    val value = ((bytes[offset].toLong() and 0xff) shl 24) or
      ((bytes[offset + 1].toLong() and 0xff) shl 16) or
      ((bytes[offset + 2].toLong() and 0xff) shl 8) or
      (bytes[offset + 3].toLong() and 0xff)
    if (value > Int.MAX_VALUE) {
      throw AudioTagRewriteException("WriteNotImplemented", "ID3 frame sizes above 2 GiB are not supported.")
    }
    return value.toInt()
  }

  private fun writeU32(bytes: ByteArray, offset: Int, value: Long) {
    if (value !in 0..0xffffffffL || offset < 0 || offset + 4 > bytes.size) {
      throw AudioTagRewriteException("InvalidTagData", "Invalid 32-bit frame size.")
    }
    bytes[offset] = ((value ushr 24) and 0xff).toByte()
    bytes[offset + 1] = ((value ushr 16) and 0xff).toByte()
    bytes[offset + 2] = ((value ushr 8) and 0xff).toByte()
    bytes[offset + 3] = (value and 0xff).toByte()
  }

  private fun copyBounded(
    input: java.io.InputStream,
    output: java.io.OutputStream,
    maxBytes: Long,
    initialBytes: Long = 0L,
  ): Long {
    var total = initialBytes
    val buffer = ByteArray(BUFFER_BYTES)
    while (true) {
      val read = input.read(buffer)
      if (read < 0) break
      total += read.toLong()
      if (total > maxBytes) throw SizeLimitException()
      output.write(buffer, 0, read)
    }
    return total
  }

  private fun copyBounded(
    input: RandomAccessFile,
    output: java.io.OutputStream,
    maxBytes: Long,
    initialBytes: Long,
  ): Long {
    var total = initialBytes
    val buffer = ByteArray(BUFFER_BYTES)
    while (true) {
      val read = input.read(buffer)
      if (read < 0) break
      total += read.toLong()
      if (total > maxBytes) throw SizeLimitException()
      output.write(buffer, 0, read)
    }
    return total
  }
}
