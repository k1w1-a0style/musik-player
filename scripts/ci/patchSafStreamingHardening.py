from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


source_path = Path('modules/expo-system-audio/android/src/main/java/expo/modules/systemaudio/saf/AudioTagRewriteSource.kt')
source = source_path.read_text()
if 'const val MAX_SAFE_TAG_WRITE_FILE_BYTES' not in source:
    source = source.replace(
        'import java.util.Calendar\n',
        'import java.util.Calendar\n\nconst val MAX_SAFE_TAG_WRITE_FILE_BYTES = 50L * 1024L * 1024L\n',
        1,
    )
source = replace_once(
    source,
    '''interface AudioTagRewriteSource {
  fun rewrite(
    original: File,
    temporary: File,
    maxBytes: Long,
  ): AudioTagRewriteResult
}''',
    '''interface AudioTagRewriteSource {
  fun rewrite(
    original: File,
    temporary: File,
    maxBytes: Long,
  ): AudioTagRewriteResult

  fun estimatedOutputSizeUpperBound(originalSize: Long, maxBytes: Long): Long = maxBytes
}''',
    'rewrite source estimate contract',
)
if 'fun estimatedReplacementGrowthUpperBound()' not in source:
    marker = '''  val hasDeletionIntent: Boolean
    get() = removeCover || touchedFields.any { field ->
      field in TEXT_FIELDS && normalizedValue(field) == null
    }
'''
    replacement = marker + '''
  fun estimatedReplacementGrowthUpperBound(): Long {
    var total = 128L * 1024L
    for (field in touchedFields) {
      if (field !in TEXT_FIELDS) continue
      val value = normalizedValue(field) ?: continue
      val encodedUpperBound = value.length.toLong() * 4L + 64L
      total = saturatingAdd(total, encodedUpperBound)
    }
    coverBytes?.let { bytes -> total = saturatingAdd(total, bytes.size.toLong() + 128L) }
    return total
  }

  private fun saturatingAdd(left: Long, right: Long): Long =
    if (right > 0L && Long.MAX_VALUE - left < right) Long.MAX_VALUE else left + right
'''
    source = replace_once(source, marker, replacement, 'replacement growth estimate')
source = source.replace(
    '''    if (maxBytes <= 0) {
      throw AudioTagRewriteException("InvalidTagData", "Maximum file size must be positive.")
    }
''',
    '''    if (maxBytes <= 0L) {
      throw AudioTagRewriteException("InvalidTagData", "Maximum file size must be positive.")
    }
    if (maxBytes > MAX_SAFE_TAG_WRITE_FILE_BYTES) {
      throw AudioTagRewriteException("FileTooLarge", "Maximum file size exceeds the native safety limit.")
    }

    val rawChangedFields = request["changedFields"]
    if (rawChangedFields != null) {
      if (rawChangedFields !is List<*> || rawChangedFields.size != changedFields.size || rawChangedFields.any { it !is String }) {
        throw AudioTagRewriteException("InvalidTagData", "Changed fields must be a string list.")
      }
    } else if (changedFields.isNotEmpty()) {
      throw AudioTagRewriteException("InvalidTagData", "Changed fields payload is missing.")
    }
''',
    1,
)
source = replace_once(
    source,
    '''    val rawTags = request["tags"] as? Map<*, *> ?: emptyMap<Any?, Any?>()
    val unknownTagKeys = rawTags.keys.filterIsInstance<String>().filter { it !in NativeTagEditSpec.TEXT_FIELDS }
    if (unknownTagKeys.isNotEmpty()) {
      throw AudioTagRewriteException("InvalidTagData", "Tag payload contains unsupported fields.")
    }

    val tags = buildMap<String, String?> {
      for (field in touched.filter { it in NativeTagEditSpec.TEXT_FIELDS }) {
        val raw = rawTags[field]
''',
    '''    val rawTagsValue = request["tags"]
    if (rawTagsValue != null && rawTagsValue !is Map<*, *>) {
      throw AudioTagRewriteException("InvalidTagData", "Tag payload must be an object.")
    }
    val rawTags = rawTagsValue as? Map<*, *> ?: emptyMap<Any?, Any?>()
    if (rawTags.keys.any { it !is String || it !in NativeTagEditSpec.TEXT_FIELDS }) {
      throw AudioTagRewriteException("InvalidTagData", "Tag payload contains unsupported fields.")
    }

    val tags = buildMap<String, String?> {
      for (field in touched.filter { it in NativeTagEditSpec.TEXT_FIELDS }) {
        if (!rawTags.containsKey(field)) {
          throw AudioTagRewriteException("InvalidTagData", "Changed tag field $field is missing from the payload.")
        }
        val raw = rawTags[field]
''',
    'strict tag payload',
)
source = replace_once(
    source,
    '''    val removeCover = request["removeCover"] as? Boolean ?: false
    val coverPayload = request["cover"] as? Map<*, *>
''',
    '''    val removeCoverValue = request["removeCover"]
    if (removeCoverValue != null && removeCoverValue !is Boolean) {
      throw AudioTagRewriteException("InvalidTagData", "removeCover must be a boolean.")
    }
    val removeCover = removeCoverValue as? Boolean ?: false
    val coverValue = request["cover"]
    if (coverValue != null && coverValue !is Map<*, *>) {
      throw AudioTagRewriteException("InvalidTagData", "Cover payload must be an object.")
    }
    val coverPayload = coverValue as? Map<*, *>
    if (coverPayload != null && coverPayload.keys.any { it !is String || it !in setOf("mimeType", "dataBase64") }) {
      throw AudioTagRewriteException("InvalidTagData", "Cover payload contains unsupported fields.")
    }
''',
    'strict cover payload',
)
source = replace_once(
    source,
    '''class StreamingAudioTagRewriteSource(
  private val spec: NativeTagEditSpec,
) : AudioTagRewriteSource {
  override fun rewrite(
''',
    '''class StreamingAudioTagRewriteSource(
  private val spec: NativeTagEditSpec,
) : AudioTagRewriteSource {
  override fun estimatedOutputSizeUpperBound(originalSize: Long, maxBytes: Long): Long {
    val growth = spec.estimatedReplacementGrowthUpperBound()
    val estimate = if (growth > 0L && Long.MAX_VALUE - originalSize < growth) Long.MAX_VALUE else originalSize + growth
    return estimate.coerceAtMost(maxBytes)
  }

  override fun rewrite(
''',
    'streaming estimate override',
)
source_path.write_text(source)


module_path = Path('modules/expo-system-audio/android/src/main/java/expo/modules/systemaudio/SystemAudioModule.kt')
module = module_path.read_text()
if 'import expo.modules.systemaudio.saf.MAX_SAFE_TAG_WRITE_FILE_BYTES\n' not in module:
    module = module.replace(
        'import expo.modules.systemaudio.saf.StreamDigests\n',
        'import expo.modules.systemaudio.saf.StreamDigests\nimport expo.modules.systemaudio.saf.MAX_SAFE_TAG_WRITE_FILE_BYTES\n',
        1,
    )
module = module.replace('    private const val MAX_SAFE_TAG_WRITE_FILE_BYTES = 50L * 1024L * 1024L\n', '')
module = module.replace(
    '''    if (parsed.scheme != "content") {
      return result(expo.modules.systemaudio.saf.TransactionResult(false, "UnsupportedUri", "Native SAF tag writing only accepts content:// URIs."))
    }
''',
    '''    if (parsed.scheme != "content" || parsed.authority.isNullOrBlank()) {
      return result(expo.modules.systemaudio.saf.TransactionResult(false, "UnsupportedUri", "Native SAF tag writing only accepts valid content:// URIs."))
    }
''',
    1,
)
module = module.replace(
    '''      val maxBytes = (request["maxFileSizeBytes"] as? Number)?.toLong()
        ?: MAX_SAFE_TAG_WRITE_FILE_BYTES
''',
    '''      val maxBytes = parseTagWriteMaxBytes(request["maxFileSizeBytes"])
''',
    1,
)
module = module.replace(
    '''    val maxBytes = (request["maxFileSizeBytes"] as? Number)?.toLong()
      ?: MAX_SAFE_TAG_WRITE_FILE_BYTES
''',
    '''    val maxBytes = try {
      parseTagWriteMaxBytes(request["maxFileSizeBytes"])
    } catch (_: AudioTagRewriteException) {
      return false
    }
''',
    1,
)
if 'private fun parseTagWriteMaxBytes(' not in module:
    marker = '  private fun verifyAudioTagDeletion(uri: String, request: Map<String, Any?>): Boolean {'
    index = module.find(marker)
    if index < 0:
        raise SystemExit('native deletion verifier marker missing')
    helper = '''  private fun parseTagWriteMaxBytes(raw: Any?): Long {
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

'''
    module = module[:index] + helper + module[index:]
module = module.replace(
    '''  /** Computes decoded size for bounded image data URIs only; audio bytes never use Base64. */
    private fun decodedImageBase64ByteLength(value: String): Long {
''',
    '''  /** Computes decoded size for bounded image data URIs only; audio bytes never use Base64. */
  private fun decodedImageBase64ByteLength(value: String): Long {
''',
    1,
)
module = module.replace('\n      private fun String.safeLogUri()', '\n  private fun String.safeLogUri()', 1)
module = module.replace('\n    }\n\n  private fun String.safeLogUri()', '\n  }\n\n  private fun String.safeLogUri()', 1)
module_path.write_text(module)


tx_path = Path('modules/expo-system-audio/android/src/main/java/expo/modules/systemaudio/saf/AudioTagTransaction.kt')
tx = tx_path.read_text()
old_space = '''    val expectedSpace = listOf(
      store.size(request.uri) ?: request.maxBytes,
      request.maxBytes,
      safetyMarginBytes,
    ).fold(0L) { total, rawValue ->
      val value = rawValue.coerceAtLeast(0L)
      if (Long.MAX_VALUE - total < value) Long.MAX_VALUE else total + value
    }
'''
new_space = '''    val knownOriginalSize = store.size(request.uri)?.takeIf { it >= 0L }
    if (knownOriginalSize != null && knownOriginalSize > request.maxBytes) {
      return@withLock TransactionResult(
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
'''
tx = replace_once(tx, old_space, new_space, 'storage estimate')
tx_path.write_text(tx)


helper_path = Path('modules/expo-system-audio/android/src/test/java/expo/modules/systemaudio/saf/TestAudioTagRewriteSource.kt')
helper = helper_path.read_text()
if 'override fun estimatedOutputSizeUpperBound' not in helper:
    helper = helper.replace(
        '''): AudioTagRewriteSource = object : AudioTagRewriteSource {
  override fun rewrite(original: File, temporary: File, maxBytes: Long): AudioTagRewriteResult {
''',
        '''): AudioTagRewriteSource = object : AudioTagRewriteSource {
  override fun estimatedOutputSizeUpperBound(originalSize: Long, maxBytes: Long): Long =
    bytes.size.toLong().coerceAtMost(maxBytes)

  override fun rewrite(original: File, temporary: File, maxBytes: Long): AudioTagRewriteResult {
''',
        1,
    )
helper_path.write_text(helper)


manager_test_path = Path('modules/expo-system-audio/android/src/test/java/expo/modules/systemaudio/saf/AudioTagTransactionManagerTest.kt')
manager_test = manager_test_path.read_text()
if 'smallRewriteUsesActualOutputEstimateInsteadOfGlobalLimit' not in manager_test:
    marker = '''  @Test fun insufficientStorageIsRejectedBeforeMutation() {
'''
    index = manager_test.find(marker)
    if index < 0:
        raise SystemExit('storage test insertion marker missing')
    test = '''  @Test fun smallRewriteUsesActualOutputEstimateInsteadOfGlobalLimit() {
    val old = "old".toByteArray()
    val rewritten = "new".toByteArray()
    val root = tmp()
    ShadowStatFs.registerStats(root, 1, 1, 1)
    val store = FakeStore(old)

    val result = manager(root, store).write(req(uri, old, rewritten))

    assertTrue(result.success)
    assertArrayEquals(rewritten, store.bytes)
  }

'''
    manager_test = manager_test[:index] + test + manager_test[index:]
manager_test_path.write_text(manager_test)


stream_test_path = Path('modules/expo-system-audio/android/src/test/java/expo/modules/systemaudio/saf/StreamingAudioTagRewriterTest.kt')
stream_test = stream_test_path.read_text()
if 'requestParserRejectsMissingTouchedTextField' not in stream_test:
    marker = '''  @Test
  fun requestParserRejectsCoverMimeSpoofing() {
'''
    index = stream_test.find(marker)
    if index < 0:
        raise SystemExit('parser test insertion marker missing')
    tests = '''  @Test
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

'''
    stream_test = stream_test[:index] + tests + stream_test[index:]
stream_test_path.write_text(stream_test)


for path in (source_path, module_path, tx_path, helper_path, manager_test_path, stream_test_path):
    text = path.read_text()
    if '\t' in text:
        raise SystemExit(f'tab introduced in {path}')
