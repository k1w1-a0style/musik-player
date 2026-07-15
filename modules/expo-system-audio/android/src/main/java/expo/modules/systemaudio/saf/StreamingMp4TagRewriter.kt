package expo.modules.systemaudio.saf

import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.RandomAccessFile

object StreamingMp4TagRewriter {
  private const val MAX_MOOV_BYTES = 16L * 1024L * 1024L
  private const val BUFFER_BYTES = 64 * 1024

  private data class TopAtom(
    val start: Long,
    val end: Long,
    val size: Long,
    val type: String,
    val typeBytes: ByteArray,
  )

  private data class Atom(
    val start: Int,
    val end: Int,
    val size: Int,
    val type: String,
    val typeBytes: ByteArray,
    val payloadStart: Int,
  )

  private val MOOV = type("moov")
  private val MDAT = type("mdat")
  private val UDTA = type("udta")
  private val META = type("meta")
  private val ILST = type("ilst")
  private val DATA = type("data")
  private val TRKN = type("trkn")
  private val DISK = type("disk")
  private val COVR = type("covr")
  private val CNAM = byteArrayOf(0xa9.toByte(), 'n'.code.toByte(), 'a'.code.toByte(), 'm'.code.toByte())
  private val CART = byteArrayOf(0xa9.toByte(), 'A'.code.toByte(), 'R'.code.toByte(), 'T'.code.toByte())
  private val AART = type("aART")
  private val CALB = byteArrayOf(0xa9.toByte(), 'a'.code.toByte(), 'l'.code.toByte(), 'b'.code.toByte())
  private val CDAY = byteArrayOf(0xa9.toByte(), 'd'.code.toByte(), 'a'.code.toByte(), 'y'.code.toByte())
  private val CGEN = byteArrayOf(0xa9.toByte(), 'g'.code.toByte(), 'e'.code.toByte(), 'n'.code.toByte())
  private val CCMT = byteArrayOf(0xa9.toByte(), 'c'.code.toByte(), 'm'.code.toByte(), 't'.code.toByte())

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

    val top = parseTopAtoms(original)
    val moov = top.firstOrNull { it.type == "moov" }
      ?: throw AudioTagRewriteException("InvalidTagData", "Missing moov atom.")
    val mdats = top.filter { it.type == "mdat" }
    if (mdats.isEmpty()) throw AudioTagRewriteException("InvalidTagData", "Missing mdat atom.")
    if (moov.size > MAX_MOOV_BYTES || moov.size > maxBytes || moov.size > Int.MAX_VALUE) {
      throw AudioTagRewriteException("FileTooLarge", "MP4 moov metadata exceeds the safe native rewrite limit.")
    }

    val moovBytes = ByteArray(moov.size.toInt())
    RandomAccessFile(original, "r").use { source ->
      source.seek(moov.start)
      source.readFully(moovBytes)
    }
    val rewrite = rewriteMoov(moovBytes, spec)
    val changed = rewrite.first
    val newMoov = rewrite.second

    if (changed && newMoov.size.toLong() != moov.size && mdats.any { it.start >= moov.end }) {
      throw AudioTagRewriteException(
        "WriteNotImplemented",
        "moov-before-mdat size changes are blocked for offset safety.",
      )
    }
    val expectedSize = original.length() - moov.size + if (changed) newMoov.size.toLong() else moov.size
    if (expectedSize <= 0L || expectedSize > maxBytes) throw SizeLimitException()

    FileOutputStream(temporary).use { output ->
      if (!changed) {
        FileInputStream(original).use { input -> copyBounded(input, output, maxBytes) }
      } else {
        RandomAccessFile(original, "r").use { source ->
          var written = 0L
          for (atom in top) {
            if (atom === moov) {
              written += newMoov.size.toLong()
              if (written > maxBytes) throw SizeLimitException()
              output.write(newMoov)
            } else {
              written = copyRange(source, output, atom.start, atom.size, written, maxBytes)
            }
          }
          if (written != expectedSize) {
            throw AudioTagRewriteException("InvalidTagData", "MP4 rewrite size is inconsistent.")
          }
        }
      }
      output.flush()
      output.fd.sync()
    }

    val digest = StreamDigests.hashFile(temporary, maxBytes)
    return AudioTagRewriteResult(changed = changed, digest = digest)
  }

  private fun rewriteMoov(moovBytes: ByteArray, spec: NativeTagEditSpec): Pair<Boolean, ByteArray> {
    val moovChildren = parseAtoms(moovBytes, 8, moovBytes.size)
    val udta = moovChildren.firstOrNull { it.type == "udta" }
      ?: throw AudioTagRewriteException("WriteNotImplemented", "Missing udta atom.")
    val udtaChildren = parseAtoms(moovBytes, udta.payloadStart, udta.end)
    val meta = udtaChildren.firstOrNull { it.type == "meta" }
      ?: throw AudioTagRewriteException("WriteNotImplemented", "Missing meta atom.")
    if (meta.payloadStart + 4 > meta.end) {
      throw AudioTagRewriteException("InvalidTagData", "Invalid meta fullbox.")
    }
    val metaChildren = parseAtoms(moovBytes, meta.payloadStart + 4, meta.end)
    val ilst = metaChildren.firstOrNull { it.type == "ilst" }
      ?: throw AudioTagRewriteException("WriteNotImplemented", "Missing ilst atom.")
    val ilstChildren = parseAtoms(moovBytes, ilst.payloadStart, ilst.end)

    val textTypes = linkedMapOf(
      "title" to CNAM,
      "artist" to CART,
      "albumArtist" to AART,
      "album" to CALB,
      "year" to CDAY,
      "genre" to CGEN,
      "comment" to CCMT,
    )
    val editedTypes = buildSet {
      textTypes.forEach { (field, atomType) -> if (field in spec.touchedFields) add(atomKey(atomType)) }
      if ("trackNumber" in spec.touchedFields) add("trkn")
      if ("discNumber" in spec.touchedFields) add("disk")
      if ("cover" in spec.touchedFields) add("covr")
    }

    val newIlstChildren = mutableListOf<ByteArray>()
    ilstChildren.filterNot { it.type in editedTypes }.forEach { child ->
      newIlstChildren += moovBytes.copyOfRange(child.start, child.end)
    }

    var changed = false
    for ((field, atomType) in textTypes) {
      if (field !in spec.touchedFields) continue
      changed = true
      spec.normalizedValue(field)?.let { value ->
        newIlstChildren += rebuildAtom(atomType, buildDataAtom(1, value.toByteArray(Charsets.UTF_8)))
      }
    }
    if ("trackNumber" in spec.touchedFields) {
      changed = true
      spec.normalizedValue("trackNumber")?.let { newIlstChildren += buildPackedNumberAtom(TRKN, it) }
    }
    if ("discNumber" in spec.touchedFields) {
      changed = true
      spec.normalizedValue("discNumber")?.let { newIlstChildren += buildPackedNumberAtom(DISK, it) }
    }
    if ("cover" in spec.touchedFields) {
      if (spec.removeCover) {
        changed = changed || ilstChildren.any { it.type == "covr" }
      } else {
        val mime = spec.coverMimeType
        val bytes = spec.coverBytes
        if (mime != null && bytes != null) {
          changed = true
          newIlstChildren += rebuildAtom(COVR, buildDataAtom(if (mime == "image/png") 14 else 13, bytes))
        }
      }
    }

    if (!changed) return false to moovBytes.copyOf()

    val newIlst = rebuildAtom(ILST, concatenate(newIlstChildren))
    val newMetaChildren = metaChildren.map { child ->
      if (child.start == ilst.start) newIlst else moovBytes.copyOfRange(child.start, child.end)
    }
    val fullbox = moovBytes.copyOfRange(meta.payloadStart, meta.payloadStart + 4)
    val newMetaPayload = concatenate(listOf(fullbox, concatenate(newMetaChildren)))
    val newMeta = rebuildAtom(META, newMetaPayload)

    val newUdtaChildren = udtaChildren.map { child ->
      if (child.start == meta.start) newMeta else moovBytes.copyOfRange(child.start, child.end)
    }
    val newUdta = rebuildAtom(UDTA, concatenate(newUdtaChildren))
    val newMoovChildren = moovChildren.map { child ->
      if (child.start == udta.start) newUdta else moovBytes.copyOfRange(child.start, child.end)
    }
    return true to rebuildAtom(MOOV, concatenate(newMoovChildren))
  }

  private fun parseTopAtoms(file: File): List<TopAtom> = RandomAccessFile(file, "r").use { source ->
    val length = source.length()
    val atoms = mutableListOf<TopAtom>()
    var offset = 0L
    while (offset < length) {
      if (offset + 8L > length) {
        throw AudioTagRewriteException("InvalidTagData", "Truncated MP4 atom header.")
      }
      source.seek(offset)
      val header = ByteArray(8)
      source.readFully(header)
      val size32 = readU32(header, 0)
      val atomType = header.copyOfRange(4, 8)
      if (size32 == 1L) {
        throw AudioTagRewriteException("WriteNotImplemented", "MP4 largesize atoms are not supported yet.")
      }
      val size = if (size32 == 0L) length - offset else size32
      if (size < 8L || offset + size > length) {
        throw AudioTagRewriteException("InvalidTagData", "Invalid MP4 atom size for ${atomKey(atomType)}.")
      }
      atoms += TopAtom(offset, offset + size, size, atomKey(atomType), atomType)
      offset += size
    }
    atoms
  }

  private fun parseAtoms(buffer: ByteArray, start: Int, end: Int): List<Atom> {
    if (start < 0 || end < start || end > buffer.size) {
      throw AudioTagRewriteException("InvalidTagData", "Invalid MP4 atom bounds.")
    }
    val atoms = mutableListOf<Atom>()
    var offset = start
    while (offset < end) {
      if (offset + 8 > end) {
        throw AudioTagRewriteException("InvalidTagData", "Truncated MP4 atom header.")
      }
      val size32 = readU32(buffer, offset)
      val atomType = buffer.copyOfRange(offset + 4, offset + 8)
      if (size32 == 1L) {
        throw AudioTagRewriteException("WriteNotImplemented", "MP4 largesize atoms are not supported yet.")
      }
      if (size32 == 0L || size32 < 8L || size32 > Int.MAX_VALUE) {
        throw AudioTagRewriteException("InvalidTagData", "Invalid nested MP4 atom size for ${atomKey(atomType)}.")
      }
      val atomEnd = offset.toLong() + size32
      if (atomEnd > end.toLong()) {
        throw AudioTagRewriteException("InvalidTagData", "MP4 atom exceeds its parent for ${atomKey(atomType)}.")
      }
      atoms += Atom(offset, atomEnd.toInt(), size32.toInt(), atomKey(atomType), atomType, offset + 8)
      offset = atomEnd.toInt()
    }
    return atoms
  }

  private fun buildDataAtom(dataType: Int, payload: ByteArray): ByteArray {
    val body = ByteArray(8 + payload.size)
    writeU32(body, 0, dataType.toLong())
    writeU32(body, 4, 0)
    payload.copyInto(body, 8)
    return rebuildAtom(DATA, body)
  }

  private fun buildPackedNumberAtom(atomType: ByteArray, value: String): ByteArray {
    val match = Regex("^(\\d+)(?:/(\\d+))?$").matchEntire(value)
      ?: throw AudioTagRewriteException("InvalidTagData", "Invalid packed track/disc format.")
    val current = match.groupValues[1].toIntOrNull()
      ?: throw AudioTagRewriteException("InvalidTagData", "Invalid packed track/disc number.")
    val total = match.groupValues.getOrNull(2)?.takeIf { it.isNotEmpty() }?.toIntOrNull() ?: 0
    if (current !in 0..0xffff || total !in 0..0xffff) {
      throw AudioTagRewriteException("InvalidTagData", "Track/disc number exceeds the MP4 limit.")
    }
    val payload = ByteArray(8)
    payload[2] = ((current ushr 8) and 0xff).toByte()
    payload[3] = (current and 0xff).toByte()
    payload[4] = ((total ushr 8) and 0xff).toByte()
    payload[5] = (total and 0xff).toByte()
    return rebuildAtom(atomType, buildDataAtom(0, payload))
  }

  private fun rebuildAtom(atomType: ByteArray, payload: ByteArray): ByteArray {
    val size = 8L + payload.size.toLong()
    if (size > 0xffffffffL) {
      throw AudioTagRewriteException("WriteNotImplemented", "MP4 atom exceeds the 32-bit size limit.")
    }
    val output = ByteArray(size.toInt())
    writeU32(output, 0, size)
    atomType.copyInto(output, 4)
    payload.copyInto(output, 8)
    return output
  }

  private fun concatenate(parts: List<ByteArray>): ByteArray {
    val size = parts.sumOf { it.size.toLong() }
    if (size > Int.MAX_VALUE) {
      throw AudioTagRewriteException("FileTooLarge", "MP4 metadata exceeds the in-memory metadata limit.")
    }
    return ByteArrayOutputStream(size.toInt()).use { output ->
      parts.forEach(output::write)
      output.toByteArray()
    }
  }

  private fun copyRange(
    source: RandomAccessFile,
    output: java.io.OutputStream,
    start: Long,
    count: Long,
    alreadyWritten: Long,
    maxBytes: Long,
  ): Long {
    source.seek(start)
    var remaining = count
    var written = alreadyWritten
    val buffer = ByteArray(BUFFER_BYTES)
    while (remaining > 0L) {
      val read = source.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
      if (read < 0) throw AudioTagRewriteException("InvalidTagData", "Unexpected end of MP4 file.")
      written += read.toLong()
      if (written > maxBytes) throw SizeLimitException()
      output.write(buffer, 0, read)
      remaining -= read.toLong()
    }
    return written
  }

  private fun copyBounded(input: java.io.InputStream, output: java.io.OutputStream, maxBytes: Long) {
    var total = 0L
    val buffer = ByteArray(BUFFER_BYTES)
    while (true) {
      val read = input.read(buffer)
      if (read < 0) break
      total += read.toLong()
      if (total > maxBytes) throw SizeLimitException()
      output.write(buffer, 0, read)
    }
  }

  private fun readU32(bytes: ByteArray, offset: Int): Long {
    if (offset < 0 || offset + 4 > bytes.size) {
      throw AudioTagRewriteException("InvalidTagData", "Truncated 32-bit MP4 value.")
    }
    return ((bytes[offset].toLong() and 0xff) shl 24) or
      ((bytes[offset + 1].toLong() and 0xff) shl 16) or
      ((bytes[offset + 2].toLong() and 0xff) shl 8) or
      (bytes[offset + 3].toLong() and 0xff)
  }

  private fun writeU32(bytes: ByteArray, offset: Int, value: Long) {
    if (value !in 0..0xffffffffL || offset < 0 || offset + 4 > bytes.size) {
      throw AudioTagRewriteException("InvalidTagData", "Invalid 32-bit MP4 value.")
    }
    bytes[offset] = ((value ushr 24) and 0xff).toByte()
    bytes[offset + 1] = ((value ushr 16) and 0xff).toByte()
    bytes[offset + 2] = ((value ushr 8) and 0xff).toByte()
    bytes[offset + 3] = (value and 0xff).toByte()
  }

  private fun type(value: String): ByteArray {
    val bytes = value.toByteArray(Charsets.ISO_8859_1)
    require(bytes.size == 4)
    return bytes
  }

  private fun atomKey(value: ByteArray): String = value.toString(Charsets.ISO_8859_1)
}
