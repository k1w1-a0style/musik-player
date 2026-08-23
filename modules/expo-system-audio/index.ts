import { NativeModule, requireNativeModule } from 'expo';

export interface EqBandInfo {
  index: number;
  centerFreqHz: number;
}

export interface EqInitResult {
  available: boolean;
  enabled: boolean;
  bands: EqBandInfo[];
  minMillibel: number;
  maxMillibel: number;
}

export interface PaletteResult {
  dominant?: string;
  vibrant?: string;
  lightVibrant?: string;
  darkVibrant?: string;
  muted?: string;
  lightMuted?: string;
  darkMuted?: string;
}

export interface EmbeddedArtworkResult {
  uri: string;
  mimeType: string;
  byteLength?: number;
  width?: number;
  height?: number;
}

export interface AudioTagWriteRequest {
  operationId?: string;
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

export interface AudioTagWriteResult {
  success: boolean;
  uri: string;
  changedFields: string[];
  failedFields: string[];
  errorCode?: string;
  message?: string;
  backupUri?: string;
  tempUri?: string;
  verified: boolean;
  noop?: boolean;
  bytesBefore?: number;
  bytesAfter?: number;
  transactionId?: string;
  recoveryPending?: boolean;
  recovered?: boolean;
  cleanupPending?: boolean;
  operationId?: string;
  phase?: 'ACCEPTED' | 'LOCK_ACQUIRED' | 'NATIVE_MUTATION_STARTED' | 'PENDING_NATIVE_RESULT' | 'COMPLETED' | 'FAILED' | 'CANCELLED_BEFORE_MUTATION';
  terminal?: boolean;
  retryable?: boolean;
}

export type NativeBitrateMode = 'cbr' | 'vbr' | 'unknown';

export interface AudioInfoResult {
  durationMs?: number;
  bitrateBps?: number;
  bitrateMode?: NativeBitrateMode;
  sizeBytes?: number;
  sampleRateHz?: number;
  channels?: number;
  mimeType?: string;
  displayName?: string;
}

/**
 * Native waveform result. `points` are normalized 0..1 envelope values and are
 * downsampled natively so rendering never has to inspect audio bytes.
 */
export interface WaveformPeaksResult {
  points: number[];
  durationMs?: number;
  /** Identifies results derived from decoded audio samples, not container packet sizes. */
  analysis?: 'decoded-pcm-v1';
}

/**
 * Native Fast-Path metadata read powered by Android's MediaMetadataRetriever.
 * Returns the standard tag fields that MediaMetadataRetriever can decode
 * reliably for content://, file:// and SAF-backed URIs. Missing/insecure fields
 * stay undefined so callers can fall back to the JS-ID3 parser per field.
 *
 * Status: implemented on Android and exposed through the TS interface; the
 * actual on-device behaviour stays "pending Android device validation" until a
 * Development APK exercises it on a real device.
 */
export interface FastMetadataResult {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: string;
  trackNumber?: string;
  discNumber?: string;
  genre?: string;
  composer?: string;
  durationMs?: number;
  bitrateBps?: number;
  mimeType?: string;
}

export type RecoveryStatusResult = {
  /** False when native storage could not be inspected; callers must recover fail-closed. */
  available?: boolean;
  pendingCount: number;
  quarantineCount?: number;
  /** Terminal native receipts still awaiting durable JavaScript acknowledgement. */
  retainedOutcomeCount?: number;
  transactions: Array<{ transactionId: string; state: string }>;
};

export type RecoveryRunResult = {
  success: boolean;
  errorCode?: string;
  message?: string;
  recoveryPending?: boolean;
  recovered?: boolean;
  recoveredCount?: number;
  cleanedCount?: number;
  pendingCount?: number;
  failedCount?: number;
  transactions?: Array<{
    transactionId: string;
    previousState?: string;
    resultState?: string;
    recovered: boolean;
    pending: boolean;
    errorCode?: string;
  }>;
};

declare class ExpoSystemAudioModule extends NativeModule {
  eqInit(audioSessionId: number): Promise<EqInitResult | null>;
  eqSetEnabled(enabled: boolean): boolean;
  eqSetBandLevel(band: number, millibel: number): boolean;
  eqRelease(): void;
  extractPalette(uri: string): Promise<PaletteResult | null>;
  extractEmbeddedArtwork(uri: string): Promise<EmbeddedArtworkResult | null>;
  extractAudioInfo(uri: string): Promise<AudioInfoResult | null>;
  extractMetadataFast?(uri: string): Promise<FastMetadataResult | null>;
  writeAudioTags?(uri: string, request: AudioTagWriteRequest): Promise<AudioTagWriteResult>;
  verifyAudioTagDeletion?(uri: string, request: AudioTagWriteRequest): Promise<boolean>;
  getAudioTagRecoveryStatus?(): Promise<RecoveryStatusResult>;
  recoverPendingAudioTagTransactions?(uri?: string): Promise<RecoveryRunResult>;
  acknowledgeAudioTagRecoveryOutcomes?(operationIds: string[]): Promise<boolean>;
}

declare class ExpoSystemAudioWaveformModule extends NativeModule {
  extractWaveformPeaks?(uri: string, pointCount?: number, requestId?: string): Promise<WaveformPeaksResult | null>;
  cancelWaveformExtraction?(requestId: string): boolean;
}

const native: ExpoSystemAudioModule | null = (() => {
  try {
    return requireNativeModule<ExpoSystemAudioModule>('ExpoSystemAudio');
  } catch {
    return null;
  }
})();

const waveformNative: ExpoSystemAudioWaveformModule | null = (() => {
  try {
    return requireNativeModule<ExpoSystemAudioWaveformModule>('ExpoSystemAudioWaveform');
  } catch {
    return null;
  }
})();

/**
 * Durable SAF writes require the complete native transaction/recovery contract.
 * Failing closed here prevents a JS update from silently using an older native
 * writer that still exposes the legacy non-streaming writer without the complete transaction contract.
 */
const hasNativeTagWriter =
  native !== null &&
  typeof native.writeAudioTags === 'function' &&
  typeof native.verifyAudioTagDeletion === 'function' &&
  typeof native.getAudioTagRecoveryStatus === 'function' &&
  typeof native.recoverPendingAudioTagTransactions === 'function' &&
  typeof native.acknowledgeAudioTagRecoveryOutcomes === 'function';

const hasNativeMetadataFastPath =
  native !== null && typeof native.extractMetadataFast === 'function';

const hasNativeWaveformExtraction =
  waveformNative !== null && typeof waveformNative.extractWaveformPeaks === 'function';

const hasNativeWaveformCancellation =
  hasNativeWaveformExtraction && typeof waveformNative?.cancelWaveformExtraction === 'function';

const tagWriteOperationIdPattern = /^[A-Za-z0-9._-]{1,80}$/;
const isValidTagWriteOperationId = (value: string): boolean =>
  value !== '.' && value !== '..' && tagWriteOperationIdPattern.test(value);
let tagWriteOperationSequence = 0;
const createNativeTagWriteOperationId = (): string =>
  `tag-${Date.now().toString(36)}-${(++tagWriteOperationSequence).toString(36)}`;

// Native SAF tag writes may hold two full-size app-private copies plus provider
// resources. Bound the public module boundary so callers cannot reserve an
// unbounded number of native transactions across different document URIs.
const MAX_NATIVE_TAG_WRITES_IN_FLIGHT = 2;
let nativeTagWritesInFlight = 0;

const tagWriteCapacityConflict = (
  uri: string,
  request: AudioTagWriteRequest,
  operationId: string,
): AudioTagWriteResult => ({
  success: false,
  uri,
  changedFields: [],
  failedFields: request.changedFields ?? [],
  errorCode: 'TransactionConflict',
  message: 'Native tag write capacity is busy. Retry after an active write completes.',
  verified: false,
  recoveryPending: false,
  operationId,
  phase: 'FAILED',
  terminal: true,
  retryable: true,
});

// Read-only native calls are not cancellable on every Android/SAF provider.
// Keep a final module-boundary safety net so an unguarded caller can never wait
// forever, while the stricter per-feature timeouts (for example backfills) still
// win first. Timed-out raw native calls continue occupying a slot until they
// actually settle, so detached work can never grow with the library size.
const NATIVE_READ_SAFETY_TIMEOUT_MS = 20_000;
const MAX_NATIVE_READS_IN_FLIGHT = 2;
let nativeReadsInFlight = 0;

type NativeReadSettlement<T> =
  | { kind: 'value'; value: T }
  | { kind: 'error'; error: unknown };

const runBoundedNativeRead = async <T>(operation: () => Promise<T>): Promise<T | null> => {
  if (nativeReadsInFlight >= MAX_NATIVE_READS_IN_FLIGHT) return null;
  nativeReadsInFlight += 1;
  const raw = Promise.resolve().then(operation);
  const settled: Promise<NativeReadSettlement<T>> = raw.then(
    value => ({ kind: 'value', value }),
    error => ({ kind: 'error', error }),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ kind: 'timeout' }>(resolve => {
    timer = setTimeout(() => resolve({ kind: 'timeout' }), NATIVE_READ_SAFETY_TIMEOUT_MS);
  });
  const first = await Promise.race([settled, timeout]);
  if (first.kind === 'timeout') {
    void settled.finally(() => {
      nativeReadsInFlight = Math.max(0, nativeReadsInFlight - 1);
    });
    return null;
  }
  if (timer) clearTimeout(timer);
  nativeReadsInFlight = Math.max(0, nativeReadsInFlight - 1);
  if (first.kind === 'error') throw first.error;
  return first.value;
};

export const SystemAudio = {
  isAvailable: native !== null,
  hasNativeTagWriter,
  hasNativeMetadataFastPath,
  hasNativeWaveformExtraction,
  hasNativeWaveformCancellation,

  async eqInit(audioSessionId: number): Promise<EqInitResult | null> {
    return native && Number.isInteger(audioSessionId) && audioSessionId > 0
      ? native.eqInit(audioSessionId)
      : null;
  },

  eqSetEnabled(enabled: boolean): boolean {
    return native ? native.eqSetEnabled(enabled) : false;
  },

  eqSetBandLevel(band: number, millibel: number): boolean {
    return native ? native.eqSetBandLevel(band, millibel) : false;
  },

  eqRelease(): void {
    native?.eqRelease();
  },

  async extractPalette(uri: string): Promise<PaletteResult | null> {
    return native ? runBoundedNativeRead(() => native.extractPalette(uri)) : null;
  },

  async extractEmbeddedArtwork(uri: string): Promise<EmbeddedArtworkResult | null> {
    return native ? runBoundedNativeRead(() => native.extractEmbeddedArtwork(uri)) : null;
  },

  async extractAudioInfo(uri: string): Promise<AudioInfoResult | null> {
    return native ? runBoundedNativeRead(() => native.extractAudioInfo(uri)) : null;
  },

  /**
   * Native Fast-Path: prefers MediaMetadataRetriever-decoded fields. Returns
   * `null` when the native module or the optional fast-path function is
   * unavailable so callers can fall back to the JS-ID3 parser. Marked as
   * pending Android device validation until exercised in a Development APK.
   */
  async extractMetadataFast(uri: string): Promise<FastMetadataResult | null> {
    const extract = native?.extractMetadataFast?.bind(native);
    if (!extract) return null;
    try {
      return await runBoundedNativeRead(() => extract(uri));
    } catch {
      return null;
    }
  },

  async extractWaveformPeaks(uri: string, pointCount?: number, requestId?: string): Promise<WaveformPeaksResult | null> {
    if (!waveformNative?.extractWaveformPeaks) return null;
    return requestId === undefined
      ? waveformNative.extractWaveformPeaks(uri, pointCount)
      : waveformNative.extractWaveformPeaks(uri, pointCount, requestId);
  },

  cancelWaveformExtraction(requestId: string): boolean {
    return waveformNative?.cancelWaveformExtraction?.(requestId) ?? false;
  },

  async getAudioTagRecoveryStatus(): Promise<RecoveryStatusResult> {
    return native?.getAudioTagRecoveryStatus
      ? native.getAudioTagRecoveryStatus()
      : { available: true, pendingCount: 0, retainedOutcomeCount: 0, transactions: [] };
  },

  async recoverPendingAudioTagTransactions(uri?: string): Promise<RecoveryRunResult> {
    return hasNativeTagWriter && native?.recoverPendingAudioTagTransactions
      ? native.recoverPendingAudioTagTransactions(uri)
      : { success: false, errorCode: 'WriteNotImplemented', recoveryPending: false, recovered: false };
  },

  async acknowledgeAudioTagRecoveryOutcomes(operationIds: string[]): Promise<boolean> {
    return hasNativeTagWriter && native?.acknowledgeAudioTagRecoveryOutcomes
      ? native.acknowledgeAudioTagRecoveryOutcomes(operationIds)
      : false;
  },

  async verifyAudioTagDeletion(uri: string, request: AudioTagWriteRequest): Promise<boolean> {
    return hasNativeTagWriter && native?.verifyAudioTagDeletion
      ? native.verifyAudioTagDeletion(uri, request)
      : false;
  },

  async writeAudioTags(uri: string, request: AudioTagWriteRequest): Promise<AudioTagWriteResult> {
    const operationId = request.operationId ?? createNativeTagWriteOperationId();
    if (!isValidTagWriteOperationId(operationId)) {
      return {
        success: false, uri, changedFields: [], failedFields: request.changedFields ?? [],
        errorCode: 'InvalidTagData', message: 'Tag write operation identifier is invalid.',
        verified: false, operationId, phase: 'FAILED', terminal: true, retryable: false,
      };
    }
    if (!hasNativeTagWriter || !native?.writeAudioTags) {
      return {
        success: false,
        uri,
        changedFields: [],
        failedFields: request.changedFields ?? [],
        errorCode: 'WriteNotImplemented',
        message: 'Durable native audio tag writing is unavailable. A new development build is required.',
        verified: false,
        operationId,
        phase: 'FAILED',
        terminal: true,
        retryable: false,
      };
    }
    if (nativeTagWritesInFlight >= MAX_NATIVE_TAG_WRITES_IN_FLIGHT) {
      return tagWriteCapacityConflict(uri, request, operationId);
    }

    nativeTagWritesInFlight += 1;
    try {
      const result = await native.writeAudioTags(uri, { ...request, operationId });
      return { ...result, operationId: result.operationId ?? operationId };
    } finally {
      nativeTagWritesInFlight = Math.max(0, nativeTagWritesInFlight - 1);
    }
  },
};

export default SystemAudio;
