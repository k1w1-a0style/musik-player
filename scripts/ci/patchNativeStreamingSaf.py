from pathlib import Path
import re


def replace_between(text: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"{label}: start marker missing")
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"{label}: end marker missing")
    return text[:start] + replacement + text[end:]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


# Transaction engine: replace the full-audio Base64 request with a native rewrite source.
tx_path = Path("modules/expo-system-audio/android/src/main/java/expo/modules/systemaudio/saf/AudioTagTransaction.kt")
tx = tx_path.read_text()
tx = tx.replace("import android.util.Base64\n", "")
tx = replace_between(
    tx,
    "data class TransactionWriteRequest(",
    "data class TransactionResult(",
    """data class TransactionWriteRequest(
  val uri: Uri,
  val rewriteSource: AudioTagRewriteSource,
  val changedFields: List<String>,
  val maxBytes: Long,
  val expectedOriginalSize: Long? = null,
  val expectedOriginalSha256: String? = null,
)

""",
    "transaction request",
)
if "val noop: Boolean" not in tx:
    tx = replace_once(
        tx,
        "  val verified: Boolean = false,\n",
        "  val verified: Boolean = false,\n  val noop: Boolean = false,\n",
        "transaction noop result",
    )

space_start = tx.find("    val expectedSpace = ")
space_end_marker = "    if (storage.availableBytes() < expectedSpace) {"
space_end = tx.find(space_end_marker, space_start)
if space_start < 0 or space_end < 0:
    raise SystemExit("storage estimate markers missing")
space_replacement = """    if (request.maxBytes <= 0L) {
      return@withLock TransactionResult(
        success = false,
        errorCode = "InvalidTagData",
        message = "Maximum file size must be positive.",
      )
    }
    val expectedSpace = listOf(
      store.size(request.uri) ?: request.maxBytes,
      request.maxBytes,
      safetyMarginBytes,
    ).fold(0L) { total, rawValue ->
      val value = rawValue.coerceAtLeast(0L)
      if (Long.MAX_VALUE - total < value) Long.MAX_VALUE else total + value
    }
"""
tx = tx[:space_start] + space_replacement + tx[space_end:]

tx, count = re.subn(
    r"if \(\s*request\.expectedOriginalSha256\.isNullOrBlank\(\) \|\|\s*request\.expectedOriginalSha256\.lowercase\(\) != originalDigest\.sha256Hex\s*\)",
    "if (\n        !request.expectedOriginalSha256.isNullOrBlank() &&\n        request.expectedOriginalSha256.lowercase() != originalDigest.sha256Hex\n      )",
    tx,
    count=1,
)
if count != 1:
    raise SystemExit(f"optional original digest: expected one match, found {count}")

rewrite_start = tx.find('      val rewrittenTemporary = File(directory, "rewritten.tmp")')
rewrite_end = tx.find("      val backupDigest = verifyOriginalBackup", rewrite_start)
if rewrite_start < 0 or rewrite_end < 0:
    raise SystemExit("rewrite staging markers missing")
rewrite_block = """      val rewrittenTemporary = File(directory, "rewritten.tmp")
      val rewriteResult = try {
        request.rewriteSource.rewrite(
          original = storage.original(directory),
          temporary = rewrittenTemporary,
          maxBytes = request.maxBytes,
        )
      } catch (error: AudioTagRewriteException) {
        return@withLock cleanupBeforeMutation(
          directory,
          journal,
          error.errorCode,
          error.message ?: "Native audio tag rewrite failed.",
          before = originalDigest.sizeBytes,
        )
      }
      val rewrittenDigest = rewriteResult.digest

      if (rewrittenDigest.sizeBytes <= 0L) {
        return@withLock cleanupBeforeMutation(
          directory,
          journal,
          "InvalidTagData",
          "Rewritten audio payload is empty.",
          before = originalDigest.sizeBytes,
        )
      }
      if (!StreamDigests.verifyFile(rewrittenTemporary, rewrittenDigest, request.maxBytes)) {
        return@withLock cleanupBeforeMutation(
          directory,
          journal,
          "TempWriteFailed",
          "Rewritten staging verification failed.",
          before = originalDigest.sizeBytes,
          after = rewrittenDigest.sizeBytes,
        )
      }

      if (!rewriteResult.changed || rewrittenDigest == originalDigest) {
        return@withLock try {
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

"""
tx = tx[:rewrite_start] + rewrite_block + tx[rewrite_end:]

decode_start = tx.find("  fun decodeBase64ToFileWithDigest(")
if decode_start >= 0:
    decode_end = tx.find("  fun verifyFile(", decode_start)
    if decode_end < 0:
        raise SystemExit("decode helper end marker missing")
    tx = tx[:decode_start] + tx[decode_end:]

for token in ("rewrittenBase64", "expectedWrittenSize", "expectedWrittenSha256", "decodeBase64ToFileWithDigest"):
    if token in tx:
        raise SystemExit(f"legacy transaction token remains: {token}")
tx_path.write_text(tx)


# Native Expo bridge: accept only metadata + optional cover and invoke the streaming source.
module_path = Path("modules/expo-system-audio/android/src/main/java/expo/modules/systemaudio/SystemAudioModule.kt")
module = module_path.read_text()
module = module.replace("import android.util.Base64\n", "")
if "AudioTagRewriteException" not in module:
    module = module.replace(
        "import expo.modules.systemaudio.saf.AndroidSafContentStore\n",
        "import expo.modules.systemaudio.saf.AndroidSafContentStore\n"
        "import expo.modules.systemaudio.saf.AudioTagRewriteException\n"
        "import expo.modules.systemaudio.saf.NativeTagEditRequestParser\n"
        "import expo.modules.systemaudio.saf.StreamingAudioTagRewriteSource\n",
        1,
    )
module = re.sub(
    r'\n\s*AsyncFunction\("readAudioFileBase64"\) \{ uri: String, maxBytes: Long\? ->\s*readAudioFileBase64\(uri, maxBytes \?: MAX_SAFE_TAG_WRITE_FILE_BYTES\)\s*\}\s*',
    "\n",
    module,
    count=1,
)
read_start = module.find("  private fun readAudioFileBase64(")
if read_start >= 0:
    read_end = module.find("  private fun writeAudioTags(", read_start)
    if read_end < 0:
        raise SystemExit("native read helper end marker missing")
    module = module[:read_start] + module[read_end:]
if '"noop" to tx.noop' not in module:
    module = module.replace(
        '      "verified" to tx.verified,\n',
        '      "verified" to tx.verified,\n      "noop" to tx.noop,\n',
        1,
    )
write_start = module.find('    val rewrittenBase64 = request["rewrittenAudioBase64"] as? String')
write_end = module.find("    } catch (e: SecurityException) {", write_start)
if write_start < 0 or write_end < 0:
    raise SystemExit("native write bridge markers missing")
new_write = """    val ctx = appContext.reactContext ?: return result(expo.modules.systemaudio.saf.TransactionResult(false, "WriteNotImplemented", "Android context is unavailable."))
    return try {
      val maxBytes = (request["maxFileSizeBytes"] as? Number)?.toLong()
        ?: MAX_SAFE_TAG_WRITE_FILE_BYTES
      val spec = NativeTagEditRequestParser.parse(request, changedFields, maxBytes)
      val manager = audioTagTransactionManager(ctx)
      result(manager.write(TransactionWriteRequest(
        uri = parsed,
        rewriteSource = StreamingAudioTagRewriteSource(spec),
        changedFields = changedFields,
        maxBytes = maxBytes,
        expectedOriginalSize = (request["expectedOriginalSizeBytes"] as? Number)?.toLong(),
        expectedOriginalSha256 = (request["expectedOriginalSha256Hex"] as? String)?.trim()?.lowercase(),
      )))
    } catch (e: AudioTagRewriteException) {
      result(expo.modules.systemaudio.saf.TransactionResult(false, e.errorCode, e.message ?: "Native tag rewrite request is invalid."))
"""
module = module[:write_start] + new_write + module[write_end:]
length_start = module.find("  private fun decodedBase64ByteLength(")
if length_start >= 0:
    length_end = module.find("  private fun String.safeLogUri()", length_start)
    if length_end < 0:
        raise SystemExit("decoded length helper end marker missing")
    module = module[:length_start] + module[length_end:]
for token in ("readAudioFileBase64", "rewrittenAudioBase64", "rewrittenBase64"):
    if token in module:
        raise SystemExit(f"legacy native bridge token remains: {token}")
module_path.write_text(module)


# TypeScript bridge.
index_path = Path("modules/expo-system-audio/index.ts")
index = index_path.read_text()
index = replace_between(
    index,
    "export interface AudioTagWriteRequest {",
    "export interface AudioTagWriteResult {",
    """export interface AudioTagWriteRequest {
  tags?: Record<string, string | null | undefined>;
  container?: 'mp3' | 'm4a' | 'mp4' | string;
  removeCover?: boolean;
  cover?: {
    mimeType: 'image/jpeg' | 'image/png';
    dataBase64: string;
  };
  expectedOriginalSizeBytes?: number;
  expectedOriginalSha256Hex?: string;
  maxFileSizeBytes?: number;
  changedFields?: string[];
}

""",
    "TypeScript request",
)
if "  noop?: boolean;" not in index:
    index = index.replace("  verified: boolean;\n", "  verified: boolean;\n  noop?: boolean;\n", 1)
index = re.sub(r"\n\s*readAudioFileBase64\?\([^\n]+\n", "\n", index, count=1)
index = index.replace("  typeof native.readAudioFileBase64 === 'function' &&\n", "")
index = re.sub(
    r"\n\s*async readAudioFileBase64\([\s\S]*?\n\s*\},\n\n\s*async getAudioTagRecoveryStatus",
    "\n\n  async getAudioTagRecoveryStatus",
    index,
    count=1,
)
index = index.replace(
    "legacy read/write methods without crash recovery",
    "legacy non-streaming writer without the complete transaction contract",
)
for token in ("readAudioFileBase64", "rewrittenAudioBase64", "expectedWrittenSizeBytes", "expectedWrittenSha256Hex"):
    if token in index:
        raise SystemExit(f"legacy TypeScript token remains: {token}")
index_path.write_text(index)


# JS SAF writer: metadata-only request, no audio-file reads or full-buffer rewrite.
saf_path = Path("utils/tagWriterSaf.ts")
saf_path.write_text("""import SystemAudio, { type AudioTagWriteRequest, type AudioTagWriteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import type { TagEditDraft, WriteTagsResult } from '../types/TagEdit';
import { DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES } from './tagWriteOrchestrator';
import { encodeBytesToBase64 } from './base64';
import { withUriWriteLock } from './tagWriterLocks';
import { getSupportedContainer } from './tagEditCapability';
import { normalizeTagWriterErrorCode, TagWriterError } from './tagWriterError';
import { validateTagWriteDraftOrThrow } from './tagWriterValidation';

const textTagFields = ['title', 'artist', 'albumArtist', 'album', 'year', 'genre', 'trackNumber', 'discNumber', 'comment'] as const;

const changedFieldsForDraft = (draft: TagEditDraft): string[] => {
  const fields: string[] = textTagFields.filter(field => Object.prototype.hasOwnProperty.call(draft.tags, field));
  if (draft.cover || draft.removeCover) fields.push('cover');
  return fields;
};

const failureStatus = (code?: string): WriteTagsResult['status'] => {
  if (code === 'MissingWritePermission') return 'permissionDenied';
  if (code === 'UnsupportedFormat' || code === 'UnsupportedUri') return 'unsupportedUri';
  return 'writeFailed';
};

const toResult = (nativeResult: AudioTagWriteResult, warnings: string[] = []): WriteTagsResult => {
  const errorCode = nativeResult.success ? undefined : normalizeTagWriterErrorCode(nativeResult.errorCode, nativeResult.message ?? '');
  const status: WriteTagsResult['status'] = nativeResult.success && nativeResult.verified
    ? (nativeResult.noop ? 'noop' : 'written')
    : failureStatus(errorCode);
  return {
    status,
    sourceUri: nativeResult.uri,
    backupUri: nativeResult.backupUri,
    tempUri: nativeResult.tempUri,
    bytesBefore: nativeResult.bytesBefore,
    bytesAfter: nativeResult.bytesAfter,
    warnings,
    errorCode,
    errorMessage: nativeResult.success ? undefined : nativeResult.message,
    transactionId: nativeResult.transactionId,
    recoveryPending: nativeResult.recoveryPending,
    recovered: nativeResult.recovered,
    cleanupPending: nativeResult.cleanupPending,
  };
};

export const writeTagsToSafContentUri = async (
  song: Song,
  draft: TagEditDraft,
  options?: { maxFileSizeBytes?: number },
): Promise<WriteTagsResult> => {
  const uri = song.fileInfo?.uri ?? song.uri;
  if (!uri) {
    return { status: 'unsupportedUri', warnings: [], errorCode: 'UnsupportedUri', errorMessage: 'Song has no editable URI.' };
  }

  return withUriWriteLock(uri, async () => {
    const container = getSupportedContainer(song);
    const changedFields = changedFieldsForDraft(draft);
    if (!SystemAudio.hasNativeTagWriter) {
      return toResult({
        success: false,
        uri,
        changedFields: [],
        failedFields: changedFields,
        errorCode: 'WriteNotImplemented',
        message: 'Native streaming SAF audio tag writer is unavailable. A new Development Build/APK is required.',
        verified: false,
      });
    }

    try {
      validateTagWriteDraftOrThrow(draft);
      const maxBytes = options?.maxFileSizeBytes ?? DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES;
      const request: AudioTagWriteRequest = {
        tags: { ...draft.tags },
        container,
        removeCover: Boolean(draft.removeCover),
        cover: draft.removeCover || !draft.cover
          ? undefined
          : {
              mimeType: draft.cover.mimeType,
              dataBase64: encodeBytesToBase64(draft.cover.data),
            },
        maxFileSizeBytes: maxBytes,
        changedFields,
      };
      return toResult(await SystemAudio.writeAudioTags(uri, request));
    } catch (error) {
      if (error instanceof TagWriterError) {
        return {
          status: failureStatus(error.code),
          sourceUri: uri,
          warnings: [],
          errorCode: error.code,
          errorMessage: error.message,
        };
      }
      return {
        status: 'writeFailed',
        sourceUri: uri,
        warnings: [],
        errorCode: 'WriteNotImplemented',
        errorMessage: String(error),
      };
    }
  });
};
""")


# JS mocks and contract tests.
mock_path = Path("__mocks__/expo-system-audio.js")
mock_path.write_text(mock_path.read_text().replace("  readAudioFileBase64: jest.fn().mockResolvedValue(null),\n", ""))
wrapper_test = Path("modules/expo-system-audio/__tests__/index.test.ts")
wrapper_test.write_text(wrapper_test.read_text().replace("      readAudioFileBase64: jest.fn(),\n", ""))

recovery_test = Path("utils/__tests__/tagWriterSafRecoveryGate.test.ts")
recovery_test.write_text("""import type { Song } from '../../types/Song';

const song: Song = {
  id: 'song-1',
  title: 'Old title',
  artist: 'Artist',
  uri: 'content://provider/tree/song.mp3',
  fileInfo: {
    uri: 'content://provider/tree/song.mp3',
    extension: 'mp3',
    source: 'saf',
  },
};

const draft = {
  songId: 'song-1',
  tags: { title: 'New title' },
};

const loadWithNative = (native: Record<string, unknown>) => {
  jest.resetModules();
  jest.doMock('expo-system-audio', () => ({
    __esModule: true,
    default: native,
    SystemAudio: native,
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../tagWriterSaf') as typeof import('../tagWriterSaf');
};

describe('native streaming SAF write contract', () => {
  afterEach(() => {
    jest.dontMock('expo-system-audio');
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('native recovery-pending result blocks the save without any JS audio read', async () => {
    const write = jest.fn().mockResolvedValue({
      success: false,
      uri: song.uri,
      changedFields: [],
      failedFields: ['title'],
      errorCode: 'RecoveryPending',
      message: 'A transaction still requires recovery.',
      recoveryPending: true,
      verified: false,
    });
    const { writeTagsToSafContentUri } = loadWithNative({
      hasNativeTagWriter: true,
      writeAudioTags: write,
    });

    const result = await writeTagsToSafContentUri(song, draft);

    expect(result).toMatchObject({
      status: 'writeFailed',
      errorCode: 'RecoveryPending',
      recoveryPending: true,
    });
    expect(write).toHaveBeenCalledTimes(1);
  });

  test('sends only draft metadata and never a full rewritten audio payload', async () => {
    const write = jest.fn().mockImplementation(async (uri: string, request: Record<string, unknown>) => ({
      success: true,
      uri,
      changedFields: request.changedFields,
      failedFields: [],
      verified: true,
    }));
    const { writeTagsToSafContentUri } = loadWithNative({
      hasNativeTagWriter: true,
      writeAudioTags: write,
    });

    const result = await writeTagsToSafContentUri(song, draft);

    expect(result.status).toBe('written');
    const request = write.mock.calls[0][1];
    expect(request).toMatchObject({
      container: 'mp3',
      tags: { title: 'New title' },
      changedFields: ['title'],
    });
    expect(request).not.toHaveProperty('rewrittenAudioBase64');
    expect(request).not.toHaveProperty('expectedWrittenSha256Hex');
    expect(request).not.toHaveProperty('expectedWrittenSizeBytes');
  });

  test('encodes only the bounded cover payload and maps native no-op', async () => {
    const write = jest.fn().mockResolvedValue({
      success: true,
      uri: song.uri,
      changedFields: ['cover'],
      failedFields: [],
      verified: true,
      noop: true,
    });
    const { writeTagsToSafContentUri } = loadWithNative({
      hasNativeTagWriter: true,
      writeAudioTags: write,
    });
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const result = await writeTagsToSafContentUri(song, {
      songId: song.id,
      tags: {},
      cover: { mimeType: 'image/png', data: png },
    });

    expect(result.status).toBe('noop');
    expect(write.mock.calls[0][1]).toMatchObject({
      cover: { mimeType: 'image/png', dataBase64: 'iVBORw0KGgo=' },
      changedFields: ['cover'],
    });
  });
});
""")


# Small test-only rewrite sources keep transaction/recovery tests format-independent.
helper = Path("modules/expo-system-audio/android/src/test/java/expo/modules/systemaudio/saf/TestAudioTagRewriteSource.kt")
helper.write_text("""package expo.modules.systemaudio.saf

import java.io.File
import java.io.FileOutputStream

fun staticRewriteSource(
  bytes: ByteArray,
  changed: Boolean = true,
): AudioTagRewriteSource = object : AudioTagRewriteSource {
  override fun rewrite(original: File, temporary: File, maxBytes: Long): AudioTagRewriteResult {
    if (bytes.size.toLong() > maxBytes) throw SizeLimitException()
    FileOutputStream(temporary).use { output ->
      output.write(bytes)
      output.flush()
      output.fd.sync()
    }
    return AudioTagRewriteResult(changed, StreamDigests.hashFile(temporary, maxBytes))
  }
}

fun failingRewriteSource(
  errorCode: String,
  message: String,
): AudioTagRewriteSource = object : AudioTagRewriteSource {
  override fun rewrite(original: File, temporary: File, maxBytes: Long): AudioTagRewriteResult {
    throw AudioTagRewriteException(errorCode, message)
  }
}
""")

test_root = Path("modules/expo-system-audio/android/src/test/java/expo/modules/systemaudio/saf")
for path in test_root.glob("*.kt"):
    text = path.read_text()
    text = text.replace("import java.util.Base64\n", "")
    text = text.replace("      rewrittenBase64 = b64(rewritten),\n", "      rewriteSource = staticRewriteSource(rewritten),\n")
    text = text.replace(
        "    rewrittenBase64 = Base64.getEncoder().encodeToString(rewritten),\n",
        "    rewriteSource = staticRewriteSource(rewritten),\n",
    )
    text = re.sub(r"\n\s*expectedWrittenSize = rewritten\.size\.toLong\(\),", "", text)
    text = re.sub(r"\n\s*expectedWrittenSha256 = sha\(rewritten\),", "", text)
    text = text.replace(
        "  private fun b64(bytes: ByteArray): String = Base64.getEncoder().encodeToString(bytes)\n",
        "",
    )
    text = text.replace(
        'val result = manager(tmp(), store).write(req(uri, old, "new".toByteArray()).copy(rewrittenBase64 = "@@@"))',
        'val result = manager(tmp(), store).write(req(uri, old, "new".toByteArray()).copy(rewriteSource = failingRewriteSource("InvalidTagData", "rewrite failed")))',
    )
    text = text.replace(
        "@Test fun invalidBase64IsRejectedBeforeMutation()",
        "@Test fun rewriteFailureIsRejectedBeforeMutation()",
    )
    path.write_text(text)


# Fix two literal/type issues in the newly added MP3 writer before compilation.
mp3_path = Path("modules/expo-system-audio/android/src/main/java/expo/modules/systemaudio/saf/StreamingMp3TagRewriter.kt")
mp3 = mp3_path.read_text()
mp3 = mp3.replace("frameStart.toLong() + 4L + extendedSize > ID3_HEADER_BYTES + payloadSize", "frameStart.toLong() + 4L + extendedSize.toLong() > (ID3_HEADER_BYTES + payloadSize).toLong()")
for value in ("0x49", "0x44", "0x33"):
    mp3 = mp3.replace(f"it[{ {'0x49': 0, '0x44': 1, '0x33': 2}[value] }] = {value}\n", f"it[{ {'0x49': 0, '0x44': 1, '0x33': 2}[value] }] = {value}.toByte()\n")
mp3_path.write_text(mp3)


# Fail closed if any production/test source still references the retired full-audio bridge.
leftovers = []
for path in Path(".").rglob("*"):
    if not path.is_file() or ".git" in path.parts:
        continue
    if path in {Path(".github/workflows/ci.yml"), Path("scripts/ci/patchNativeStreamingSaf.py")}:
        continue
    if path.suffix not in {".kt", ".ts", ".tsx", ".js"}:
        continue
    content = path.read_text(errors="ignore")
    for token in (
        "rewrittenAudioBase64",
        "rewrittenBase64",
        "readAudioFileBase64",
        "expectedWrittenSizeBytes",
        "expectedWrittenSha256Hex",
    ):
        if token in content:
            leftovers.append(f"{path}:{token}")
if leftovers:
    raise SystemExit("legacy full-file contract remains: " + ", ".join(leftovers))
