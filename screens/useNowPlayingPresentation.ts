import { useMemo } from 'react';
import type { ColorValue } from 'react-native';
import type { PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import { getSongArtworkUri } from '../utils/songArtwork';
import { formatVisualizerHint } from './nowPlayingHelpers';

type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];

interface UseNowPlayingPresentationArgs {
  currentSong: Song | null;
  palette: PaletteResult | null;
  visualizerError: string | null;
}

interface NowPlayingPresentationState {
  accent: string;
  accentDark: string;
  gradientColors: GradientColors;
  albumTitle: string;
  visualizerHint: string | null;
  artworkUri?: string;
  progressAccent: string;
  progressAccentDark: string;
  visualizerColor: string;
}

export const useNowPlayingPresentation = ({
  currentSong,
  palette,
  visualizerError,
}: UseNowPlayingPresentationArgs): NowPlayingPresentationState => {
  const accent = palette?.vibrant ?? palette?.dominant ?? theme.palette.accent;
  const accentDark = palette?.darkVibrant ?? palette?.darkMuted ?? theme.palette.backgroundDeep;
  const gradientColors = useMemo<GradientColors>(
    () => theme.gradients.nowPlayingBackdrop(accent, accentDark),
    [accent, accentDark],
  );
  const albumTitle = currentSong?.album ?? 'Aus deiner Bibliothek';
  const visualizerHint = useMemo(() => formatVisualizerHint(visualizerError), [visualizerError]);
  const artworkUri = getSongArtworkUri(currentSong);
  const progressAccent = palette?.vibrant ?? theme.palette.primary;
  const progressAccentDark = palette?.lightVibrant ?? theme.palette.primaryDark;
  const visualizerColor = palette?.vibrant ?? theme.palette.primary;

  return {
    accent,
    accentDark,
    gradientColors,
    albumTitle,
    visualizerHint,
    artworkUri,
    progressAccent,
    progressAccentDark,
    visualizerColor,
  };
};