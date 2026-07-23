import type { EqInitResult, PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { useAlbumPaletteState } from './useAlbumPalette';
import { useNativeEqualizer } from './useNativeEqualizer';

export interface MusicProviderAudioFeatures {
  eqNative: EqInitResult | null;
  palette: PaletteResult | null;
  paletteLoading?: boolean;
}

export interface MusicProviderAudioFeaturesArgs {
  currentSong: Song | null;
  eqEnabled: boolean;
  eqBands: number[];
}

export const useMusicProviderAudioFeatures = ({
  currentSong,
  eqEnabled,
  eqBands,
}: MusicProviderAudioFeaturesArgs): MusicProviderAudioFeatures => {
  const eqNative = useNativeEqualizer(eqEnabled, eqBands);
  const { palette, isLoading: paletteLoading } = useAlbumPaletteState(currentSong);
  return { eqNative, palette, paletteLoading };
};
