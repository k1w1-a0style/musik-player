import { NativeModule, requireNativeModule, EventSubscription } from 'expo-modules-core';

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

export interface FftEvent {
  data: number[];
}

export interface VisualizerStateEvent {
  running: boolean;
  reason: string;
}

declare class ExpoSystemAudioModule extends NativeModule<{
  onFftData: (e: FftEvent) => void;
  onVisualizerStateChanged: (e: VisualizerStateEvent) => void;
}> {
  eqInit(): Promise<EqInitResult | null>;
  eqSetEnabled(enabled: boolean): boolean;
  eqSetBandLevel(band: number, millibel: number): boolean;
  eqRelease(): void;
  visualizerStart(bins: number): Promise<boolean>;
  visualizerStop(): void;
  extractPalette(uri: string): Promise<PaletteResult | null>;
}

const native: ExpoSystemAudioModule | null = (() => {
  try {
    return requireNativeModule<ExpoSystemAudioModule>('ExpoSystemAudio');
  } catch {
    return null;
  }
})();

const noopSub: EventSubscription = { remove: () => undefined };

/**
 * Public API. Gracefully degrades to a no-op implementation when the
 * native module is unavailable (e.g. running in Expo Go or in Jest).
 */
export const SystemAudio = {
  isAvailable: native !== null,

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

  async visualizerStart(bins = 16): Promise<boolean> {
    return native ? native.visualizerStart(bins) : false;
  },

  visualizerStop(): void {
    native?.visualizerStop();
  },

  onFft(cb: (data: number[]) => void): EventSubscription {
    if (!native) return noopSub;
    return native.addListener('onFftData', e => cb(e.data));
  },

  onVisualizerState(cb: (e: VisualizerStateEvent) => void): EventSubscription {
    if (!native) return noopSub;
    return native.addListener('onVisualizerStateChanged', cb);
  },

  async extractPalette(uri: string): Promise<PaletteResult | null> {
    return native ? native.extractPalette(uri) : null;
  },
};

export default SystemAudio;
