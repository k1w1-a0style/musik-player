from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


# The native spec identifies deletion intent so MP3 tail metadata remains fail-closed.
spec_path = Path("modules/expo-system-audio/android/src/main/java/expo/modules/systemaudio/saf/AudioTagRewriteSource.kt")
spec = spec_path.read_text()
if "val hasDeletionIntent" not in spec:
    spec = replace_once(
        spec,
        """  val hasIntent: Boolean
    get() = touchedFields.isNotEmpty()
""",
        """  val hasIntent: Boolean
    get() = touchedFields.isNotEmpty()

  val hasDeletionIntent: Boolean
    get() = removeCover || touchedFields.any { field ->
      field in TEXT_FIELDS && normalizedValue(field) == null
    }
""",
        "native deletion intent",
    )
spec_path.write_text(spec)


# Preserve the old semantic guard: ID3v1/APE/Lyrics3 tails make MP3 deletion unverifiable.
mp3_path = Path("modules/expo-system-audio/android/src/main/java/expo/modules/systemaudio/saf/StreamingMp3TagRewriter.kt")
mp3 = mp3_path.read_text()
if "hasUnsupportedTailMetadata" not in mp3:
    mp3 = replace_once(
        mp3,
        """    val header = parsed.first
    val frames = parsed.second
    val targetMajor = if (header?.major == 4) 4 else 3
""",
        """    val header = parsed.first
    val frames = parsed.second
    if (spec.hasDeletionIntent && hasUnsupportedTailMetadata(original)) {
      throw AudioTagRewriteException(
        "WriteNotImplemented",
        "MP3 deletion is blocked while ID3v1, APEv2, or Lyrics3 tail metadata remains.",
      )
    }
    val targetMajor = if (header?.major == 4) 4 else 3
""",
        "MP3 deletion tail guard",
    )
    insert_at = mp3.index("  private fun touchedFrameIds(")
    helper = """  private fun hasUnsupportedTailMetadata(file: File): Boolean {
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

"""
    mp3 = mp3[:insert_at] + helper + mp3[insert_at:]
mp3_path.write_text(mp3)


# Add a native deletion verifier that never returns the audio file to JavaScript.
module_path = Path("modules/expo-system-audio/android/src/main/java/expo/modules/systemaudio/SystemAudioModule.kt")
module = module_path.read_text()
if "import expo.modules.systemaudio.saf.StreamDigests" not in module:
    module = module.replace(
        "import expo.modules.systemaudio.saf.StreamingAudioTagRewriteSource\n",
        "import expo.modules.systemaudio.saf.StreamingAudioTagRewriteSource\nimport expo.modules.systemaudio.saf.StreamDigests\n",
        1,
    )
if 'AsyncFunction("verifyAudioTagDeletion")' not in module:
    module = replace_once(
        module,
        """    AsyncFunction("writeAudioTags") { uri: String, request: Map<String, Any?> ->
      writeAudioTags(uri, request)
    }
""",
        """    AsyncFunction("writeAudioTags") { uri: String, request: Map<String, Any?> ->
      writeAudioTags(uri, request)
    }

    AsyncFunction("verifyAudioTagDeletion") { uri: String, request: Map<String, Any?> ->
      verifyAudioTagDeletion(uri, request)
    }
""",
        "native deletion verification registration",
    )
if "private fun verifyAudioTagDeletion(" not in module:
    insert_at = module.index("  private fun getAudioTagRecoveryStatus()")
    verifier = """  private fun verifyAudioTagDeletion(uri: String, request: Map<String, Any?>): Boolean {
    val parsed = try {
      Uri.parse(uri)
    } catch (_: Throwable) {
      return false
    }
    if (parsed.scheme != "content" || parsed.authority.isNullOrBlank()) return false
    val ctx = appContext.reactContext ?: return false
    val maxBytes = (request["maxFileSizeBytes"] as? Number)?.toLong()
      ?: MAX_SAFE_TAG_WRITE_FILE_BYTES
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

"""
    module = module[:insert_at] + verifier + module[insert_at:]
module_path.write_text(module)


# Expose the metadata-only verifier in the TypeScript wrapper and require it in the contract.
index_path = Path("modules/expo-system-audio/index.ts")
index = index_path.read_text()
if "verifyAudioTagDeletion?" not in index:
    index = index.replace(
        "  writeAudioTags?(uri: string, request: AudioTagWriteRequest): Promise<AudioTagWriteResult>;\n",
        "  writeAudioTags?(uri: string, request: AudioTagWriteRequest): Promise<AudioTagWriteResult>;\n  verifyAudioTagDeletion?(uri: string, request: AudioTagWriteRequest): Promise<boolean>;\n",
        1,
    )
if "typeof native.verifyAudioTagDeletion" not in index:
    index = index.replace(
        "  typeof native.writeAudioTags === 'function' &&\n",
        "  typeof native.writeAudioTags === 'function' &&\n  typeof native.verifyAudioTagDeletion === 'function' &&\n",
        1,
    )
if "async verifyAudioTagDeletion(" not in index:
    marker = "  async writeAudioTags(uri: string, request: AudioTagWriteRequest): Promise<AudioTagWriteResult> {"
    insert_at = index.index(marker)
    method = """  async verifyAudioTagDeletion(uri: string, request: AudioTagWriteRequest): Promise<boolean> {
    return native?.verifyAudioTagDeletion
      ? native.verifyAudioTagDeletion(uri, request)
      : false;
  },

"""
    index = index[:insert_at] + method + index[insert_at:]
index_path.write_text(index)


# Shared metadata-only request builder for SAF writes and native deletion verification.
request_path = Path("utils/tagWriterNativeRequest.ts")
request_path.write_text("""import type { AudioTagWriteRequest } from 'expo-system-audio';
import type { TagEditDraft, TagEditableContainer } from '../types/TagEdit';
import { encodeBytesToBase64 } from './base64';

const textTagFields = ['title', 'artist', 'albumArtist', 'album', 'year', 'genre', 'trackNumber', 'discNumber', 'comment'] as const;

export const changedFieldsForNativeTagDraft = (draft: TagEditDraft): string[] => {
  const fields: string[] = textTagFields.filter(field => Object.prototype.hasOwnProperty.call(draft.tags, field));
  if (draft.cover || draft.removeCover) fields.push('cover');
  return fields;
};

export const buildNativeTagWriteRequest = (
  draft: TagEditDraft,
  container: TagEditableContainer,
  maxFileSizeBytes: number,
): AudioTagWriteRequest => ({
  tags: { ...draft.tags },
  container,
  removeCover: Boolean(draft.removeCover),
  cover: draft.removeCover || !draft.cover
    ? undefined
    : {
        mimeType: draft.cover.mimeType,
        dataBase64: encodeBytesToBase64(draft.cover.data),
      },
  maxFileSizeBytes,
  changedFields: changedFieldsForNativeTagDraft(draft),
});
""")

saf_path = Path("utils/tagWriterSaf.ts")
saf = saf_path.read_text()
saf = saf.replace("import { encodeBytesToBase64 } from './base64';\n", "")
saf = saf.replace(
    "import { validateTagWriteDraftOrThrow } from './tagWriterValidation';\n",
    "import { validateTagWriteDraftOrThrow } from './tagWriterValidation';\nimport { buildNativeTagWriteRequest, changedFieldsForNativeTagDraft } from './tagWriterNativeRequest';\n",
    1,
)
start = saf.find("const textTagFields =")
end = saf.find("const failureStatus", start)
if start >= 0 and end >= 0:
    saf = saf[:start] + saf[end:]
saf = saf.replace("    const changedFields = changedFieldsForDraft(draft);", "    const changedFields = changedFieldsForNativeTagDraft(draft);")
request_start = saf.find("      const request: AudioTagWriteRequest = {")
request_end = saf.find("      return toResult(await SystemAudio.writeAudioTags(uri, request));", request_start)
if request_start < 0 or request_end < 0:
    raise SystemExit("SAF request block markers missing")
saf = saf[:request_start] + "      const request: AudioTagWriteRequest = buildNativeTagWriteRequest(draft, container, maxBytes);\n" + saf[request_end:]
saf_path.write_text(saf)


# Keep file:// byte verification; content:// uses the native streaming idempotence verifier.
verification_path = Path("utils/tagWriteVerification.ts")
verification = verification_path.read_text()
verification = verification.replace("import SystemAudio from 'expo-system-audio';", "import SystemAudio, { type AudioTagWriteRequest } from 'expo-system-audio';")
verification = verification.replace("import { decodeBase64ToBytes } from './base64';\n", "")
verification = verification.replace(
    "import { applyTagEditToBuffer } from './tagWriterValidation';\n",
    "import { applyTagEditToBuffer } from './tagWriterValidation';\nimport { buildNativeTagWriteRequest } from './tagWriterNativeRequest';\n",
    1,
)
verification = re.sub(
    r"type TagDeletionVerificationOptions = \{[\s\S]*?\};\n",
    """type TagDeletionVerificationOptions = {
  adapter?: TagFileWriteAdapter;
  maxFileSizeBytes?: number;
  verifyContentDeletion?: (uri: string, request: AudioTagWriteRequest) => Promise<boolean>;
};
""",
    verification,
    count=1,
)
verification = re.sub(
    r"\n  if \(uriType === 'content'\) \{[\s\S]*?\n  \}\n\n  return undefined;",
    "\n  return undefined;",
    verification,
    count=1,
)
try_start = verification.find("  try {\n    const writtenBytes = await readWrittenBytes")
if try_start < 0:
    raise SystemExit("deletion verification body marker missing")
try_end = verification.find("  } catch {\n    return false;\n  }", try_start)
if try_end < 0:
    raise SystemExit("deletion verification catch marker missing")
new_try = """  try {
    if (getUriType(uri) === 'content') {
      const maxBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES;
      const verifier = options.verifyContentDeletion
        ?? ((targetUri: string, request: AudioTagWriteRequest) => SystemAudio.verifyAudioTagDeletion(targetUri, request));
      return await verifier(uri, buildNativeTagWriteRequest(draft, container, maxBytes));
    }
    const writtenBytes = await readWrittenBytes(uri, options);
    if (!writtenBytes?.length) return false;
    if (container === 'mp3' && hasUnsupportedMp3TailMetadata(writtenBytes)) return false;
    const reapplied = applyTagEditToBuffer(writtenBytes, container, draft);
    return bytesEqual(writtenBytes, reapplied);
"""
verification = verification[:try_start] + new_try + verification[try_end:]
if "readAudioFileBase64" in verification:
    raise SystemExit("legacy content deletion read remains")
verification_path.write_text(verification)


# Update deletion verification tests to assert the metadata-only native boundary.
verification_test_path = Path("utils/__tests__/tagWriteVerification.test.ts")
verification_test = verification_test_path.read_text()
verification_test = verification_test.replace("import { encodeBytesToBase64 } from '../base64';\n", "")
old_content_tests = verification_test[verification_test.index("  test('supports byte evidence for content URIs"):verification_test.rindex("});")]
new_content_tests = """  test('verifies content deletions through the metadata-only native boundary', async () => {
    const contentSong = {
      ...song,
      uri: 'content://documents/song-1',
      fileInfo: { ...song.fileInfo, uri: 'content://documents/song-1' },
    };
    const verifyContentDeletion = jest.fn(async () => true);

    await expect(verifyTagDeletionState(contentSong, deleteTitleDraft, 'mp3', {
      verifyContentDeletion,
    })).resolves.toBe(true);
    expect(verifyContentDeletion).toHaveBeenCalledWith(
      'content://documents/song-1',
      expect.objectContaining({
        container: 'mp3',
        tags: { title: '' },
        changedFields: ['title'],
      }),
    );
  });

  test('rejects a negative native content deletion verdict', async () => {
    const contentSong = {
      ...song,
      uri: 'content://documents/song-1',
      fileInfo: { ...song.fileInfo, uri: 'content://documents/song-1' },
    };

    await expect(verifyTagDeletionState(contentSong, deleteTitleDraft, 'mp3', {
      verifyContentDeletion: jest.fn(async () => false),
    })).resolves.toBe(false);
  });
"""
verification_test = verification_test.replace(old_content_tests, new_content_tests)
verification_test_path.write_text(verification_test)


# Replace the stale full-buffer SAF integration tests at the end of tagWriter.test.ts.
tag_test_path = Path("utils/__tests__/tagWriter.test.ts")
tag_test = tag_test_path.read_text()
describe_start = tag_test.index("describe('writeTagsToFile SAF/content native route'")
new_describe = """describe('writeTagsToFile SAF/content native route', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const loadWithNative = (native: Record<string, unknown>) => {
    jest.doMock('expo-system-audio', () => ({
      __esModule: true,
      default: native,
      SystemAudio: native,
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../tagWriter') as typeof import('../tagWriter');
  };

  test('routes content:// mp3 through the metadata-only native SAF writer', async () => {
    const native = {
      isAvailable: true,
      hasNativeTagWriter: true,
      writeAudioTags: jest.fn(async (uri: string, request: { changedFields: string[] }) => ({
        success: true,
        uri,
        changedFields: request.changedFields,
        failedFields: [],
        verified: true,
        bytesBefore: 3,
        bytesAfter: 30,
        transactionId: 'tx-1',
        recovered: false,
        recoveryPending: false,
      })),
    };
    const { writeTagsToFile: write } = loadWithNative(native);
    const result = await write(
      song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' } },
    );
    expect(result.status).toBe('written');
    expect(result.transactionId).toBe('tx-1');
    expect(native.writeAudioTags).toHaveBeenCalledWith(
      'content://media/a.mp3',
      expect.objectContaining({
        container: 'mp3',
        tags: { title: 'X' },
        changedFields: ['title'],
      }),
    );
  });

  test('file:// keeps using the existing adapter path', async () => {
    const native = { isAvailable: true, hasNativeTagWriter: true, writeAudioTags: jest.fn() };
    const { writeTagsToFile: write } = loadWithNative(native);
    const uri = 'file:///a.mp3';
    const files = new Map<string, Uint8Array>([[uri, u8(1, 2, 3)]]);
    const adapter: TagFileWriteAdapter = {
      canReplaceExistingFile: async () => true,
      getInfo: async target => ({ exists: files.has(target), size: files.get(target)?.length }),
      readBytes: async target => files.get(target) ?? u8(),
      writeBytes: async (target, bytes) => { files.set(target, bytes); },
      copyFile: async (from, to) => { files.set(to, files.get(from) ?? u8()); },
      moveOrReplaceFile: async (from, to) => { files.set(to, files.get(from) ?? u8()); },
      deleteFile: async target => { files.delete(target); },
    };
    const result = await write(song({ uri, fileInfo: { extension: 'mp3' } }), { songId: '1', tags: { title: 'X' } }, { adapter });
    expect(result.status).toBe('written');
    expect(native.writeAudioTags).not.toHaveBeenCalled();
  });

  test('native unavailable returns WriteNotImplemented without crashing', async () => {
    const native = { isAvailable: false, hasNativeTagWriter: false, writeAudioTags: jest.fn() };
    const { writeTagsToFile: write } = loadWithNative(native);
    const result = await write(
      song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' } },
    );
    expect(result.status).toBe('writeFailed');
    expect(result.errorCode).toBe('WriteNotImplemented');
  });

  test('native failures never report written', async () => {
    const cases = [
      ['MissingWritePermission', 'permissionDenied'],
      ['UnsupportedFormat', 'unsupportedUri'],
      ['VerificationFailed', 'writeFailed'],
    ] as const;
    for (const [errorCode, status] of cases) {
      const native = {
        isAvailable: true,
        hasNativeTagWriter: true,
        writeAudioTags: jest.fn(async (uri: string) => ({
          success: false,
          uri,
          changedFields: [],
          failedFields: ['title'],
          errorCode,
          message: errorCode,
          verified: false,
        })),
      };
      const { writeTagsToFile: write } = loadWithNative(native);
      const result = await write(
        song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
      );
      expect(result.status).toBe(status);
      jest.dontMock('expo-system-audio');
      jest.resetModules();
    }
  });

  test('content:// m4a reaches the native streaming writer', async () => {
    const native = {
      isAvailable: true,
      hasNativeTagWriter: true,
      writeAudioTags: jest.fn(async (uri: string) => ({
        success: false,
        uri,
        changedFields: [],
        failedFields: ['title'],
        errorCode: 'WriteNotImplemented',
        message: 'fixture',
        verified: false,
      })),
    };
    const { writeTagsToFile: write } = loadWithNative(native);
    const result = await write(
      song({ uri: 'content://media/a.m4a', fileInfo: { extension: 'm4a' } }),
      { songId: '1', tags: { title: 'X' } },
    );
    expect(native.writeAudioTags).toHaveBeenCalledWith(
      'content://media/a.m4a',
      expect.objectContaining({ container: 'm4a' }),
    );
    expect(result.errorCode).not.toBe('UnsupportedFormat');
  });
});
"""
tag_test_path.write_text(tag_test[:describe_start] + new_describe)


# Wrapper and default mock expose the full new native contract.
wrapper_test_path = Path("modules/expo-system-audio/__tests__/index.test.ts")
wrapper_test = wrapper_test_path.read_text()
wrapper_test = wrapper_test.replace(
    "      writeAudioTags: jest.fn(),\n      getAudioTagRecoveryStatus,",
    "      writeAudioTags: jest.fn(),\n      verifyAudioTagDeletion: jest.fn().mockResolvedValue(true),\n      getAudioTagRecoveryStatus,",
    1,
)
wrapper_test_path.write_text(wrapper_test)
mock_path = Path("__mocks__/expo-system-audio.js")
mock = mock_path.read_text()
if "verifyAudioTagDeletion" not in mock:
    mock = mock.replace(
        "  writeAudioTags: jest.fn(async (uri, request = {}) => ({",
        "  verifyAudioTagDeletion: jest.fn().mockResolvedValue(false),\n  writeAudioTags: jest.fn(async (uri, request = {}) => ({",
        1,
    )
mock_path.write_text(mock)


# Only production sources are forbidden from retaining the retired full-file bridge.
leftovers = []
for path in Path(".").rglob("*"):
    if not path.is_file() or ".git" in path.parts or "__tests__" in path.parts or "src/test" in path.as_posix():
        continue
    if path.suffix not in {".kt", ".ts", ".tsx", ".js"}:
        continue
    if path.as_posix().startswith("scripts/ci/"):
        continue
    content = path.read_text(errors="ignore")
    for token in ("rewrittenAudioBase64", "rewrittenBase64", "readAudioFileBase64"):
        if token in content:
            leftovers.append(f"{path}:{token}")
if leftovers:
    raise SystemExit("legacy production full-file contract remains: " + ", ".join(leftovers))
