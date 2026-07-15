package expo.modules.systemaudio.saf

import android.util.Base64
import java.io.File
import java.io.IOException
import java.util.Calendar

data class AudioTagRewriteResult(
  val changed: Boolean,
  val digest: DigestInfo,
)

interface AudioTagRewriteSource {
  fun rewrite(
    original: File,
    temporary: File,
    maxBytes: Long,
  ): AudioTagRewriteResult
}

class AudioTagRewriteException(
  val errorCode: String,
  message: String,
  cause: Throwable? = null,
) : IOException(message, cause)

data class NativeTagEditSpec(
  val container: String,
  val tags: Map<String, String?>,
  val touchedFields: Set<String>,
  val removeCover: Boolean,
  val coverMimeType: String?,
  val coverBytes: ByteArray?,
) {
  fun normalizedValue(field: String): String? =
    tags[field]?.trim()?.takeIf { it.isNotEmpty() }

  val hasIntent: Boolean
    get() = touchedFields.isNotEmpty()

  companion object {
    val TEXT_FIELDS = setOf(
      "title",
      "artist",
      "albumArtist",
      "album",
      "year",
      "genre",
      "trackNumber",
      "discNumber",
      "comment",
    )
    val ALL_FIELDS = TEXT_FIELDS + "cover"
  }
}

object NativeTagEditRequestParser {
  private const val MAX_COVER_BYTES = 8L * 1024L * 1024L
  private const val MAX_TEXT_CHARS = 64 * 1024
  private val positionRegex = Regex("^\\d{1,3}(?:/\\d{1,3})?$")
  private val yearRegex = Regex("^\\d{4}$")

  fun parse(
    request: Map<String, Any?>,
    changedFields: List<String>,
    maxBytes: Long,
  ): NativeTagEditSpec {
    if (maxBytes <= 0) {
      throw AudioTagRewriteException("InvalidTagData", "Maximum file size must be positive.")
    }

    val container = (request["container"] as? String)
      ?.trim()
      ?.lowercase()
      ?: throw AudioTagRewriteException("UnsupportedFormat", "Audio container is missing.")
    if (container !in setOf("mp3", "m4a", "mp4")) {
      throw AudioTagRewriteException("UnsupportedFormat", "Audio container is not supported.")
    }

    val touched = changedFields.toSet()
    if (touched.size != changedFields.size || touched.any { it !in NativeTagEditSpec.ALL_FIELDS }) {
      throw AudioTagRewriteException("InvalidTagData", "Changed fields contain unsupported or duplicate entries.")
    }

    val rawTags = request["tags"] as? Map<*, *> ?: emptyMap<Any?, Any?>()
    val unknownTagKeys = rawTags.keys.filterIsInstance<String>().filter { it !in NativeTagEditSpec.TEXT_FIELDS }
    if (unknownTagKeys.isNotEmpty()) {
      throw AudioTagRewriteException("InvalidTagData", "Tag payload contains unsupported fields.")
    }

    val tags = buildMap<String, String?> {
      for (field in touched.filter { it in NativeTagEditSpec.TEXT_FIELDS }) {
        val raw = rawTags[field]
        if (raw != null && raw !is String) {
          throw AudioTagRewriteException("InvalidTagData", "Tag field $field must be text or null.")
        }
        val value = (raw as? String)?.trim()?.takeIf { it.isNotEmpty() }
        if (value != null && value.length > MAX_TEXT_CHARS) {
          throw AudioTagRewriteException("InvalidTagData", "Tag field $field is too long.")
        }
        put(field, value)
      }
    }

    validateTagValues(tags)

    val removeCover = request["removeCover"] as? Boolean ?: false
    val coverPayload = request["cover"] as? Map<*, *>
    if (removeCover && coverPayload != null) {
      throw AudioTagRewriteException("InvalidTagData", "Cover removal and replacement cannot be requested together.")
    }
    if ((removeCover || coverPayload != null) && "cover" !in touched) {
      throw AudioTagRewriteException("InvalidTagData", "Cover payload is missing the cover changed-field marker.")
    }
    if ("cover" in touched && !removeCover && coverPayload == null) {
      throw AudioTagRewriteException("InvalidTagData", "Cover edit payload is missing.")
    }

    val coverMimeType: String?
    val coverBytes: ByteArray?
    if (coverPayload == null) {
      coverMimeType = null
      coverBytes = null
    } else {
      coverMimeType = (coverPayload["mimeType"] as? String)?.trim()?.lowercase()
        ?: throw AudioTagRewriteException("InvalidTagData", "Cover MIME type is missing.")
      if (coverMimeType !in setOf("image/jpeg", "image/png")) {
        throw AudioTagRewriteException("InvalidTagData", "Cover MIME type is unsupported.")
      }
      val base64 = coverPayload["dataBase64"] as? String
        ?: throw AudioTagRewriteException("InvalidTagData", "Cover bytes are missing.")
      val coverLimit = minOf(MAX_COVER_BYTES, maxBytes)
      if (decodedBase64ByteLength(base64) > coverLimit) {
        throw AudioTagRewriteException("FileTooLarge", "Cover payload exceeds the safe size limit.")
      }
      coverBytes = try {
        Base64.decode(base64, Base64.DEFAULT)
      } catch (error: IllegalArgumentException) {
        throw AudioTagRewriteException("InvalidTagData", "Cover payload is not valid Base64.", error)
      }
      if (coverBytes.isEmpty() || coverBytes.size.toLong() > coverLimit) {
        throw AudioTagRewriteException("InvalidTagData", "Cover payload is empty or too large.")
      }
      val detectedMime = detectImageMime(coverBytes)
      if (detectedMime != coverMimeType) {
        throw AudioTagRewriteException("InvalidTagData", "Cover bytes do not match the declared MIME type.")
      }
    }

    return NativeTagEditSpec(
      container = container,
      tags = tags,
      touchedFields = touched,
      removeCover = removeCover,
      coverMimeType = coverMimeType,
      coverBytes = coverBytes,
    )
  }

  private fun validateTagValues(tags: Map<String, String?>) {
    tags["year"]?.let { value ->
      val currentYear = Calendar.getInstance().get(Calendar.YEAR) + 1
      val parsed = value.toIntOrNull()
      if (!yearRegex.matches(value) || parsed == null || parsed !in 1900..currentYear) {
        throw AudioTagRewriteException("InvalidTagData", "Year is invalid.")
      }
    }
    for (field in listOf("trackNumber", "discNumber")) {
      tags[field]?.let { value ->
        if (!positionRegex.matches(value)) {
          throw AudioTagRewriteException("InvalidTagData", "$field is invalid.")
        }
      }
    }
    tags["genre"]?.let { value ->
      if (value.length > 100) {
        throw AudioTagRewriteException("InvalidTagData", "Genre is too long.")
      }
    }
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

  private fun detectImageMime(bytes: ByteArray): String? = when {
    bytes.size >= 3 &&
      bytes[0] == 0xff.toByte() &&
      bytes[1] == 0xd8.toByte() &&
      bytes[2] == 0xff.toByte() -> "image/jpeg"
    bytes.size >= 8 &&
      bytes[0] == 0x89.toByte() &&
      bytes[1] == 0x50.toByte() &&
      bytes[2] == 0x4e.toByte() &&
      bytes[3] == 0x47.toByte() &&
      bytes[4] == 0x0d.toByte() &&
      bytes[5] == 0x0a.toByte() &&
      bytes[6] == 0x1a.toByte() &&
      bytes[7] == 0x0a.toByte() -> "image/png"
    else -> null
  }
}

class StreamingAudioTagRewriteSource(
  private val spec: NativeTagEditSpec,
) : AudioTagRewriteSource {
  override fun rewrite(
    original: File,
    temporary: File,
    maxBytes: Long,
  ): AudioTagRewriteResult = when (spec.container) {
    "mp3" -> StreamingMp3TagRewriter.rewrite(original, temporary, spec, maxBytes)
    "m4a", "mp4" -> StreamingMp4TagRewriter.rewrite(original, temporary, spec, maxBytes)
    else -> throw AudioTagRewriteException("UnsupportedFormat", "Audio container is not supported.")
  }
}
