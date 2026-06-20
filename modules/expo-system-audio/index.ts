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
}

export interface AudioTagWriteRequest {
  tags?: Record<string, string | null | undefined>;
  container?: 'mp3' | 'm4a' | 'mp4' | string;
  /** Base64 encoded, already tag-rewritten full audio payload. */
  rewrittenAudioBase64?: string;
  expectedOriginalSizeBytes?: number;
  expectedOriginalSha256Hex?: string;
  expectedWrittenSizeBytes?: number;
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
}

export interface AudioInfoResult {
  durationMs?: number;
  bitrateBps?: number;
  sizeBytes?: number;
  sampleRateHz?: number;
  channels?: number;
  mimeType?: string;
  displayName?: string;
}

declare class ExpoSystemAudioModule extends NativeModule {
  eqInit(): Promise<EqInitResult | null>;
  eqSetEnabled(enabled: boolean): boolean;
  eqSetBandLevel(band: number, millibel: number): boolean;
  eqRelease(): void;
  extractPalette(uri: string): Promise<PaletteResult | null>;
  extractEmbeddedArtwork(uri: string): Promise<EmbeddedArtworkResult | null>;
  extractAudioInfo(uri: string): Promise<AudioInfoResult | null>;
  readAudioFileBase64?(uri: string, maxBytes?: number): Promise<string | null>;
  writeAudioTags?(uri: string, request: AudioTagWriteRequest): Promise<AudioTagWriteResult>;
}

const native: ExpoSystemAudioModule | null = (() => {
  try {
    return requireNativeModule<ExpoSystemAudioModule>('ExpoSystemAudio');
  } catch {
    return null;
  }
})();

/**
 * Public API. Gracefully degrades to a no-op implementation when the
 * native module is unavailable (e.g. running in Expo Go or in Jest).
 */
const hasNativeTagWriter =
  native !== null &&
  typeof native.readAudioFileBase64 === 'function' &&
  typeof native.writeAudioTags === 'function';

export const SystemAudio = {
  isAvailable: native !== null,
  hasNativeTagWriter,

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

  async readAudioFileBase64(uri: string, maxBytes?: number): Promise<string | null> {
    return native?.readAudioFileBase64 ? native.readAudioFileBase64(uri, maxBytes) : null;
  },

  async writeAudioTags(uri: string, request: AudioTagWriteRequest): Promise<AudioTagWriteResult> {
    if (!native?.writeAudioTags) {
      return {
        success: false,
        uri,
        changedFields: [],
        failedFields: request.changedFields ?? [],
        errorCode: 'WriteNotImplemented',
        message: 'Native audio tag writer is unavailable. A new development build is required.',
        verified: false,
      };
    }
    return native.writeAudioTags(uri, request);
  },
};

export default SystemAudio;
