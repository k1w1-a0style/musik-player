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

type RecoveryStatusResult = {
  pendingCount: number;
  quarantineCount?: number;
  transactions: Array<{ transactionId: string; state: string }>;
};

type RecoveryRunResult = {
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
  typeof native.recoverPendingAudioTagTransactions === 'function';

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
    return native ? native.extractPalette(uri) : null;
  },

  async extractEmbeddedArtwork(uri: string): Promise<EmbeddedArtworkResult | null> {
    return native ? native.extractEmbeddedArtwork(uri) : null;
  },

  async extractAudioInfo(uri: string): Promise<AudioInfoResult | null> {
    return native ? native.extractAudioInfo(uri) : null;
  },

  /**
   * Native Fast-Path: prefers MediaMetadataRetriever-decoded fields. Returns
   * `null` when the native module or the optional fast-path function is
   * unavailable so callers can fall back to the JS-ID3 parser. Marked as
   * pending Android device validation until exercised in a Development APK.
   */
  async extractMetadataFast(uri: string): Promise<FastMetadataResult | null> {
    if (!native?.extractMetadataFast) return null;
    try {
      return await native.extractMetadataFast(uri);
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
      : { pendingCount: 0, transactions: [] };
  },

  async recoverPendingAudioTagTransactions(uri?: string): Promise<RecoveryRunResult> {
    return native?.recoverPendingAudioTagTransactions
      ? native.recoverPendingAudioTagTransactions(uri)
      : { success: true, recoveryPending: false, recovered: false };
  },

  async verifyAudioTagDeletion(uri: string, request: AudioTagWriteRequest): Promise<boolean> {
    return native?.verifyAudioTagDeletion
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
    const result = await native.writeAudioTags(uri, { ...request, operationId });
    return { ...result, operationId: result.operationId ?? operationId };
  },
};

export default SystemAudio;
