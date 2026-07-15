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
  tags?: Record<string, string | null | undefined>;
  container?: 'mp3' | 'm4a' | 'mp4' | string;
  /** Base64 encoded, already tag-rewritten full audio payload. */
  rewrittenAudioBase64?: string;
  expectedOriginalSizeBytes?: number;
  expectedOriginalSha256Hex?: string;
  expectedWrittenSizeBytes?: number;
  expectedWrittenSha256Hex?: string;
  maxFileSizeBytes?: number;
  changedFields?: string[];
  failedFields?: string[];
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
  bytesBefore?: number;
  bytesAfter?: number;
  transactionId?: string;
  recoveryPending?: boolean;
  recovered?: boolean;
  cleanupPending?: boolean;
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
  eqInit(): Promise<EqInitResult | null>;
  eqSetEnabled(enabled: boolean): boolean;
  eqSetBandLevel(band: number, millibel: number): boolean;
  eqRelease(): void;
  extractPalette(uri: string): Promise<PaletteResult | null>;
  extractEmbeddedArtwork(uri: string): Promise<EmbeddedArtworkResult | null>;
  extractAudioInfo(uri: string): Promise<AudioInfoResult | null>;
  extractMetadataFast?(uri: string): Promise<FastMetadataResult | null>;
  readAudioFileBase64?(uri: string, maxBytes?: number): Promise<string | null>;
  writeAudioTags?(uri: string, request: AudioTagWriteRequest): Promise<AudioTagWriteResult>;
  getAudioTagRecoveryStatus?(): Promise<RecoveryStatusResult>;
  recoverPendingAudioTagTransactions?(uri?: string): Promise<RecoveryRunResult>;
}

declare class ExpoSystemAudioWaveformModule extends NativeModule {
  extractWaveformPeaks?(uri: string, pointCount?: number): Promise<WaveformPeaksResult | null>;
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
 * writer that still exposes the legacy read/write methods without crash recovery.
 */
const hasNativeTagWriter =
  native !== null &&
  typeof native.readAudioFileBase64 === 'function' &&
  typeof native.writeAudioTags === 'function' &&
  typeof native.getAudioTagRecoveryStatus === 'function' &&
  typeof native.recoverPendingAudioTagTransactions === 'function';

const hasNativeMetadataFastPath =
  native !== null && typeof native.extractMetadataFast === 'function';

const hasNativeWaveformExtraction =
  waveformNative !== null && typeof waveformNative.extractWaveformPeaks === 'function';

export const SystemAudio = {
  isAvailable: native !== null,
  hasNativeTagWriter,
  hasNativeMetadataFastPath,
  hasNativeWaveformExtraction,

  async eqInit(): Promise<EqInitResult | null> {
    return native ? native.eqInit() : null;
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

  async extractWaveformPeaks(uri: string, pointCount?: number): Promise<WaveformPeaksResult | null> {
    if (!waveformNative?.extractWaveformPeaks) return null;
    try {
      return await waveformNative.extractWaveformPeaks(uri, pointCount);
    } catch {
      return null;
    }
  },

  async readAudioFileBase64(uri: string, maxBytes?: number): Promise<string | null> {
    return native?.readAudioFileBase64 ? native.readAudioFileBase64(uri, maxBytes) : null;
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

  async writeAudioTags(uri: string, request: AudioTagWriteRequest): Promise<AudioTagWriteResult> {
    if (!hasNativeTagWriter || !native?.writeAudioTags) {
      return {
        success: false,
        uri,
        changedFields: [],
        failedFields: request.changedFields ?? [],
        errorCode: 'WriteNotImplemented',
        message: 'Durable native audio tag writing is unavailable. A new development build is required.',
        verified: false,
      };
    }
    return native.writeAudioTags(uri, request);
  },
};

export default SystemAudio;
