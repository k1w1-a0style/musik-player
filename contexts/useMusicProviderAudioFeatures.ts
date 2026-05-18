import type { EqInitResult, PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { useAlbumPalette } from './useAlbumPalette';
import { useAudioVisualizer } from './useAudioVisualizer';
import { useNativeEqualizer } from './useNativeEqualizer';

interface MusicProviderAudioFeatures {
  eqNative: EqInitResult | null;
  palette: PaletteResult | null;
  fftBins: number[];
  visualizerRunning: boolean;
  visualizerError: string | null;
}

export const useMusicProviderAudioFeatures = ({
  currentSong,
  eqEnabled,
  eqBands,
  isPlaying,
}: {
  currentSong: Song | null;
  eqEnabled: boolean;
  eqBands: number[];
  isPlaying: boolean;
}): MusicProviderAudioFeatures => {
  const eqNative = useNativeEqualizer(eqEnabled, eqBands);
  const palette = useAlbumPalette(currentSong);
  const { fftBins, visualizerRunning, visualizerError } = useAudioVisualizer(isPlaying);

  return { eqNative, palette, fftBins, visualizerRunning, visualizerError };
};
