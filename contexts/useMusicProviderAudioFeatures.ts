import type { EqInitResult, PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { useAlbumPalette } from './useAlbumPalette';
import { useNativeEqualizer } from './useNativeEqualizer';


export interface MusicProviderAudioFeatures {
  eqNative: EqInitResult | null;
  palette: PaletteResult | null;
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
  const palette = useAlbumPalette(currentSong);
  return { eqNative, palette };
};
