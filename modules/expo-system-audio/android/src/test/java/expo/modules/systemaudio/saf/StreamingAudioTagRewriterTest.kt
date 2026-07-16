package expo.modules.systemaudio.saf

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.util.Base64

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class StreamingAudioTagRewriterTest {
  private val maxBytes = 4L * 1024L * 1024L

  @Test
  fun mp3TitleRewritePreservesAudioAndIsByteIdempotent() {
    val directory = createTempDir(prefix = "streaming-mp3-title-")
    val audio = byteArrayOf(
      0xff.toByte(), 0xfb.toByte(), 0x90.toByte(), 0x64,
      1, 2, 3, 4, 5, 6,
    )
    val original = File(directory, "original.mp3").apply { writeBytes(audio) }
    val first = File(directory, "first.mp3")
    val second = File(directory, "second.mp3")
    val spec = textSpec("mp3", "title", "Streamed title")

    val firstResult = StreamingMp3TagRewriter.rewrite(original, first, spec, maxBytes)
    val firstBytes = first.readBytes()
    val audioStart = 10 + decodeSynchsafe(firstBytes, 6)

    assertTrue(firstResult.changed)
    assertArrayEquals(byteArrayOf('I'.code.toByte(), 'D'.code.toByte(), '3'.code.toByte()), firstBytes.copyOfRange(0, 3))
    assertArrayEquals(audio, firstBytes.copyOfRange(audioStart, firstBytes.size))
    assertTrue(indexOf(firstBytes, "TIT2".toByteArray(Charsets.US_ASCII)) >= 0)

    val secondResult = StreamingMp3TagRewriter.rewrite(first, second, spec, maxBytes)
    assertTrue(secondResult.changed)
    assertArrayEquals(firstBytes, second.readBytes())
    assertEquals(firstResult.digest, secondResult.digest)
  }

  @Test
  fun mp3RewritePreservesUntouchedFlaggedId3v24FrameExactly() {
    val directory = createTempDir(prefix = "streaming-mp3-v24-flags-")
    val artistBody = byteArrayOf(3, 'A'.code.toByte(), 'r'.code.toByte(), 't'.code.toByte())
    val flaggedArtist = id3v24Frame("TPE1", artistBody, statusFlags = 0x20, formatFlags = 0)
    val audio = byteArrayOf(0xff.toByte(), 0xfb.toByte(), 4, 3, 2, 1)
    val originalBytes = id3v24Tag(flaggedArtist) + audio
    val original = File(directory, "original.mp3").apply { writeBytes(originalBytes) }
    val rewritten = File(directory, "rewritten.mp3")

    val result = StreamingMp3TagRewriter.rewrite(
      original,
      rewritten,
      textSpec("mp3", "title", "New title"),
      maxBytes,
    )
    val output = rewritten.readBytes()
    val audioStart = 10 + decodeSynchsafe(output, 6)

    assertTrue(result.changed)
    assertTrue(indexOf(output, flaggedArtist) >= 0)
    assertArrayEquals(audio, output.copyOfRange(audioStart, output.size))
  }

  @Test
  fun mp3RewriteRejectsSpoofedFileWithoutMpegAudioFrame() {
    val directory = createTempDir(prefix = "streaming-mp3-spoof-")
    val original = File(directory, "spoof.mp3").apply {
      writeBytes("not really an mp3".toByteArray(Charsets.UTF_8))
    }
    val rewritten = File(directory, "rewritten.mp3")

    val error = try {
      StreamingMp3TagRewriter.rewrite(original, rewritten, textSpec("mp3", "title", "Spoofed"), maxBytes)
      null
    } catch (caught: AudioTagRewriteException) {
      caught
    }

    assertEquals("InvalidTagData", error?.errorCode)
    assertFalse(rewritten.exists())
  }

  @Test
  fun mp3DeletionRemovesOnlyTheRequestedId3Frame() {
    val directory = createTempDir(prefix = "streaming-mp3-delete-")
    val audio = byteArrayOf(0xff.toByte(), 0xfb.toByte(), 9, 8, 7, 6, 5)
    val original = File(directory, "original.mp3").apply { writeBytes(audio) }
    val tagged = File(directory, "tagged.mp3")
    val deleted = File(directory, "deleted.mp3")

    StreamingMp3TagRewriter.rewrite(original, tagged, textSpec("mp3", "title", "Temporary"), maxBytes)
    val deletion = NativeTagEditSpec(
      container = "mp3",
      tags = mapOf("title" to null),
      touchedFields = setOf("title"),
      removeCover = false,
      coverMimeType = null,
      coverBytes = null,
    )
    val result = StreamingMp3TagRewriter.rewrite(tagged, deleted, deletion, maxBytes)

    assertTrue(result.changed)
    assertArrayEquals(audio, deleted.readBytes())
  }

  @Test
  fun mp3DeletionWithoutMatchingFrameIsANoop() {
    val directory = createTempDir(prefix = "streaming-mp3-noop-")
    val audio = byteArrayOf(0xff.toByte(), 0xfb.toByte(), 3, 2, 1)
    val original = File(directory, "original.mp3").apply { writeBytes(audio) }
    val rewritten = File(directory, "rewritten.mp3")
    val deletion = NativeTagEditSpec(
      container = "mp3",
      tags = mapOf("title" to null),
      touchedFields = setOf("title"),
      removeCover = false,
      coverMimeType = null,
      coverBytes = null,
    )

    val result = StreamingMp3TagRewriter.rewrite(original, rewritten, deletion, maxBytes)

    assertFalse(result.changed)
    assertArrayEquals(audio, rewritten.readBytes())
  }

  @Test
  fun mp3DeletionBlocksLegacyTailMetadata() {
    val directory = createTempDir(prefix = "streaming-mp3-tail-")
    val audio = byteArrayOf(0xff.toByte(), 0xfb.toByte(), 1, 2, 3)
    val id3v1 = ByteArray(128).also {
      it[0] = 'T'.code.toByte()
      it[1] = 'A'.code.toByte()
      it[2] = 'G'.code.toByte()
    }
    val original = File(directory, "legacy.mp3").apply { writeBytes(audio + id3v1) }
    val rewritten = File(directory, "rewritten.mp3")
    val deletion = NativeTagEditSpec(
      container = "mp3",
      tags = mapOf("title" to null),
      touchedFields = setOf("title"),
      removeCover = false,
      coverMimeType = null,
      coverBytes = null,
    )

    val error = try {
      StreamingMp3TagRewriter.rewrite(original, rewritten, deletion, maxBytes)
      null
    } catch (caught: AudioTagRewriteException) {
      caught
    }

    assertEquals("WriteNotImplemented", error?.errorCode)
    assertFalse(rewritten.exists())
  }

  @Test
  fun mp4MoovAfterMdatStreamsPayloadAndIsByteIdempotent() {
    val directory = createTempDir(prefix = "streaming-mp4-after-")
    val fixture = mp4Fixture(moovBeforeMdat = false, title = null)
    val original = File(directory, "original.m4a").apply { writeBytes(fixture.file) }
    val first = File(directory, "first.m4a")
    val second = File(directory, "second.m4a")
    val spec = textSpec("m4a", "title", "Streamed title")

    val firstResult = StreamingMp4TagRewriter.rewrite(original, first, spec, maxBytes)
    val firstBytes = first.readBytes()

    assertTrue(firstResult.changed)
    assertArrayEquals(fixture.mdat, firstBytes.copyOfRange(0, fixture.mdat.size))
    assertTrue(indexOf(firstBytes, byteArrayOf(0xa9.toByte(), 'n'.code.toByte(), 'a'.code.toByte(), 'm'.code.toByte())) >= 0)
    assertTrue(indexOf(firstBytes, "Streamed title".toByteArray(Charsets.UTF_8)) >= 0)

    val secondResult = StreamingMp4TagRewriter.rewrite(first, second, spec, maxBytes)
    assertArrayEquals(firstBytes, second.readBytes())
    assertEquals(firstResult.digest, secondResult.digest)
  }

  @Test
  fun mp4SizeChangingMoovAfterMdatPreservesTrailingTopLevelAtoms() {
    val directory = createTempDir(prefix = "streaming-mp4-trailing-atom-")
    val fixture = mp4Fixture(moovBeforeMdat = false, title = null)
    val trailingFree = atom("free", byteArrayOf(9, 8, 7, 6))
    val original = File(directory, "original.m4a").apply { writeBytes(fixture.file + trailingFree) }
    val rewritten = File(directory, "rewritten.m4a")

    val result = StreamingMp4TagRewriter.rewrite(
      original,
      rewritten,
      textSpec("m4a", "title", "A longer streamed title"),
      maxBytes,
    )
    val output = rewritten.readBytes()

    assertTrue(result.changed)
    assertArrayEquals(fixture.mdat, output.copyOfRange(0, fixture.mdat.size))
    assertArrayEquals(trailingFree, output.copyOfRange(output.size - trailingFree.size, output.size))
    assertTrue(indexOf(output, "A longer streamed title".toByteArray(Charsets.UTF_8)) >= 0)
  }

  @Test
  fun mp4MoovBeforeMdatAllowsSameSizeReplacementAndPreservesMdatOffset() {
    val directory = createTempDir(prefix = "streaming-mp4-same-size-")
    val fixture = mp4Fixture(moovBeforeMdat = true, title = "Old")
    val original = File(directory, "original.m4a").apply { writeBytes(fixture.file) }
    val rewritten = File(directory, "rewritten.m4a")

    val result = StreamingMp4TagRewriter.rewrite(original, rewritten, textSpec("m4a", "title", "New"), maxBytes)
    val bytes = rewritten.readBytes()
    val originalMdatStart = indexOf(fixture.file, "mdat".toByteArray(Charsets.US_ASCII)) - 4
    val rewrittenMdatStart = indexOf(bytes, "mdat".toByteArray(Charsets.US_ASCII)) - 4

    assertTrue(result.changed)
    assertEquals(fixture.file.size, bytes.size)
    assertEquals(originalMdatStart, rewrittenMdatStart)
    assertArrayEquals(fixture.mdat, bytes.copyOfRange(rewrittenMdatStart, rewrittenMdatStart + fixture.mdat.size))
    assertTrue(indexOf(bytes, "New".toByteArray(Charsets.UTF_8)) >= 0)
  }

  @Test
  fun mp4MoovBeforeMdatBlocksSizeChangingRewrite() {
    val directory = createTempDir(prefix = "streaming-mp4-offset-")
    val fixture = mp4Fixture(moovBeforeMdat = true, title = null)
    val original = File(directory, "original.m4a").apply { writeBytes(fixture.file) }
    val rewritten = File(directory, "rewritten.m4a")

    val error = try {
      StreamingMp4TagRewriter.rewrite(original, rewritten, textSpec("m4a", "title", "Longer title"), maxBytes)
      null
    } catch (caught: AudioTagRewriteException) {
      caught
    }

    assertEquals("WriteNotImplemented", error?.errorCode)
    assertFalse(rewritten.exists())
  }

  @Test
  fun requestParserRejectsMissingTouchedTextField() {
    val request = mapOf<String, Any?>(
      "container" to "mp3",
      "tags" to emptyMap<String, String?>(),
      "changedFields" to listOf("title"),
    )

    val error = try {
      NativeTagEditRequestParser.parse(request, listOf("title"), maxBytes)
      null
    } catch (caught: AudioTagRewriteException) {
      caught
    }

    assertEquals("InvalidTagData", error?.errorCode)
  }

  @Test
  fun requestParserRejectsMalformedChangedFields() {
    val request = mapOf<String, Any?>(
      "container" to "mp3",
      "tags" to mapOf("title" to "New"),
      "changedFields" to listOf("title", 7),
    )

    val error = try {
      NativeTagEditRequestParser.parse(request, listOf("title"), maxBytes)
      null
    } catch (caught: AudioTagRewriteException) {
      caught
    }

    assertEquals("InvalidTagData", error?.errorCode)
  }

  @Test
  fun requestParserRejectsMalformedTagObject() {
    val request = mapOf<String, Any?>(
      "container" to "mp3",
      "tags" to "not-an-object",
      "changedFields" to listOf("title"),
    )

    val error = try {
      NativeTagEditRequestParser.parse(request, listOf("title"), maxBytes)
      null
    } catch (caught: AudioTagRewriteException) {
      caught
    }

    assertEquals("InvalidTagData", error?.errorCode)
  }

  @Test
  fun requestParserRejectsMaxBytesAboveNativeLimit() {
    val request = mapOf<String, Any?>(
      "container" to "mp3",
      "tags" to mapOf("title" to "New"),
      "changedFields" to listOf("title"),
    )

    val error = try {
      NativeTagEditRequestParser.parse(request, listOf("title"), MAX_SAFE_TAG_WRITE_FILE_BYTES + 1L)
      null
    } catch (caught: AudioTagRewriteException) {
      caught
    }

    assertEquals("FileTooLarge", error?.errorCode)
  }

  @Test
  fun requestParserRejectsCoverMimeSpoofing() {
    val jpeg = byteArrayOf(0xff.toByte(), 0xd8.toByte(), 0xff.toByte(), 1, 2, 3)
    val request = mapOf<String, Any?>(
      "container" to "mp3",
      "tags" to emptyMap<String, String?>(),
      "cover" to mapOf(
        "mimeType" to "image/png",
        "dataBase64" to Base64.getEncoder().encodeToString(jpeg),
      ),
    )

    val error = try {
      NativeTagEditRequestParser.parse(request, listOf("cover"), maxBytes)
      null
    } catch (caught: AudioTagRewriteException) {
      caught
    }

    assertEquals("InvalidTagData", error?.errorCode)
  }

  private data class Mp4Fixture(
    val file: ByteArray,
    val mdat: ByteArray,
  )

  private fun textSpec(container: String, field: String, value: String): NativeTagEditSpec =
    NativeTagEditSpec(
      container = container,
      tags = mapOf(field to value),
      touchedFields = setOf(field),
      removeCover = false,
      coverMimeType = null,
      coverBytes = null,
    )

  private fun mp4Fixture(moovBeforeMdat: Boolean, title: String?): Mp4Fixture {
    val ilstChildren = if (title == null) {
      byteArrayOf()
    } else {
      atom(
        byteArrayOf(0xa9.toByte(), 'n'.code.toByte(), 'a'.code.toByte(), 'm'.code.toByte()),
        dataAtom(1, title.toByteArray(Charsets.UTF_8)),
      )
    }
    val ilst = atom("ilst", ilstChildren)
    val meta = atom("meta", byteArrayOf(0, 0, 0, 0) + ilst)
    val udta = atom("udta", meta)
    val moov = atom("moov", udta)
    val mdat = atom("mdat", byteArrayOf(7, 6, 5, 4, 3, 2, 1))
    return Mp4Fixture(
      file = if (moovBeforeMdat) moov + mdat else mdat + moov,
      mdat = mdat,
    )
  }

  private fun dataAtom(type: Int, payload: ByteArray): ByteArray {
    val body = ByteArray(8 + payload.size)
    writeU32(body, 0, type.toLong())
    writeU32(body, 4, 0)
    payload.copyInto(body, 8)
    return atom("data", body)
  }

  private fun atom(type: String, payload: ByteArray): ByteArray =
    atom(type.toByteArray(Charsets.ISO_8859_1), payload)

  private fun atom(type: ByteArray, payload: ByteArray): ByteArray {
    val output = ByteArray(8 + payload.size)
    writeU32(output, 0, output.size.toLong())
    type.copyInto(output, 4)
    payload.copyInto(output, 8)
    return output
  }

  private fun writeU32(bytes: ByteArray, offset: Int, value: Long) {
    bytes[offset] = ((value ushr 24) and 0xff).toByte()
    bytes[offset + 1] = ((value ushr 16) and 0xff).toByte()
    bytes[offset + 2] = ((value ushr 8) and 0xff).toByte()
    bytes[offset + 3] = (value and 0xff).toByte()
  }

  private fun id3v24Tag(vararg frames: ByteArray): ByteArray {
    val payload = frames.fold(byteArrayOf()) { accumulated, frame -> accumulated + frame }
    val header = ByteArray(10)
    header[0] = 'I'.code.toByte()
    header[1] = 'D'.code.toByte()
    header[2] = '3'.code.toByte()
    header[3] = 4
    encodeSynchsafe(payload.size).copyInto(header, 6)
    return header + payload
  }

  private fun id3v24Frame(
    id: String,
    body: ByteArray,
    statusFlags: Int,
    formatFlags: Int,
  ): ByteArray {
    val output = ByteArray(10 + body.size)
    id.toByteArray(Charsets.US_ASCII).copyInto(output, 0)
    encodeSynchsafe(body.size).copyInto(output, 4)
    output[8] = statusFlags.toByte()
    output[9] = formatFlags.toByte()
    body.copyInto(output, 10)
    return output
  }

  private fun encodeSynchsafe(value: Int): ByteArray = byteArrayOf(
    ((value ushr 21) and 0x7f).toByte(),
    ((value ushr 14) and 0x7f).toByte(),
    ((value ushr 7) and 0x7f).toByte(),
    (value and 0x7f).toByte(),
  )

  private fun decodeSynchsafe(bytes: ByteArray, offset: Int): Int =
    ((bytes[offset].toInt() and 0x7f) shl 21) or
      ((bytes[offset + 1].toInt() and 0x7f) shl 14) or
      ((bytes[offset + 2].toInt() and 0x7f) shl 7) or
      (bytes[offset + 3].toInt() and 0x7f)

  private fun indexOf(haystack: ByteArray, needle: ByteArray): Int {
    if (needle.isEmpty()) return 0
    for (start in 0..haystack.size - needle.size) {
      var matches = true
      for (index in needle.indices) {
        if (haystack[start + index] != needle[index]) {
          matches = false
          break
        }
      }
      if (matches) return start
    }
    return -1
  }
}
