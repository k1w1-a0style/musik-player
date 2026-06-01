import { useMemo } from 'react';
import type { ColorValue } from 'react-native';
import type { PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import { displayAlbum } from '../utils/libraryPresentation';
import { getSongArtworkUri } from '../utils/songArtwork';

type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];

interface UseNowPlayingPresentationArgs {
  currentSong: Song | null;
  palette: PaletteResult | null;
}

interface NowPlayingPresentationState {
  accent: string;
  accentDark: string;
  gradientColors: GradientColors;
  albumTitle: string;
  artworkUri?: string;
  progressAccent: string;
  progressAccentDark: string;
}

export const useNowPlayingPresentation = ({
  currentSong,
  palette,
}: UseNowPlayingPresentationArgs): NowPlayingPresentationState => {
  const accent = palette?.vibrant ?? palette?.dominant ?? theme.palette.accent;
  const accentDark = palette?.darkVibrant ?? palette?.darkMuted ?? theme.palette.backgroundDeep;
  const gradientColors = useMemo<GradientColors>(
    () => theme.gradients.nowPlayingBackdrop(accent, accentDark),
    [accent, accentDark],
  );
  const albumTitle = currentSong ? displayAlbum(currentSong) : 'Aus deiner Bibliothek';
  const artworkUri = getSongArtworkUri(currentSong);
  const progressAccent = palette?.vibrant ?? theme.palette.primary;
  const progressAccentDark = palette?.lightVibrant ?? theme.palette.primaryDark;

  return {
    accent,
    accentDark,
    gradientColors,
    albumTitle,
    artworkUri,
    progressAccent,
    progressAccentDark,
  };
};
