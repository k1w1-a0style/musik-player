import type { EqInitResult, PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { useAlbumPalette } from './useAlbumPalette';
import { useAudioVisualizer } from './useAudioVisualizer';
import { useNativeEqualizer } from './useNativeEqualizer';

export const ENABLE_VISUALIZER = false;

export interface MusicProviderAudioFeatures {
  eqNative: EqInitResult | null;
  palette: PaletteResult | null;
  fftBins: number[];
  visualizerRunning: boolean;
  visualizerError: string | null;
}

export interface MusicProviderAudioFeaturesArgs {
  currentSong: Song | null;
  eqEnabled: boolean;
  eqBands: number[];
  isPlaying: boolean;
}

export const useMusicProviderAudioFeatures = ({
  currentSong,
  eqEnabled,
  eqBands,
  isPlaying,
}: MusicProviderAudioFeaturesArgs): MusicProviderAudioFeatures => {
  const eqNative = useNativeEqualizer(eqEnabled, eqBands);
  const palette = useAlbumPalette(currentSong);
  const { fftBins, visualizerRunning, visualizerError } = useAudioVisualizer(isPlaying, ENABLE_VISUALIZER);

  return { eqNative, palette, fftBins, visualizerRunning, visualizerError };
};
