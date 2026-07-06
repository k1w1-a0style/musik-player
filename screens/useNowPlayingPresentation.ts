import { useMemo } from 'react';
import type { ColorValue } from 'react-native';
import type { PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { useOptionalAppTheme } from '../contexts/AppThemeContext';
import { getAppTheme } from '../utils/appTheme';
import { theme as staticTheme } from '../theme';
import { displayAlbum } from '../utils/libraryPresentation';
import { getSongArtworkUri } from '../utils/songArtwork';
import { mergeNativeAndFallbackPalette, pickReadableForeground } from '../utils/jsPaletteFallback';

type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];

interface UseNowPlayingPresentationArgs {
  currentSong: Song | null;
  palette: PaletteResult | null;
}

interface NowPlayingPresentationState {
  accent: string;
  accentDark: string;
  accentMuted: string;
  gradientColors: GradientColors;
  albumTitle: string;
  artworkUri?: string;
  progressAccent: string;
  progressAccentDark: string;
  foregroundOnAccent: string;
  hasNativePalette: boolean;
}

export const useNowPlayingPresentation = ({
  currentSong,
  palette,
}: UseNowPlayingPresentationArgs): NowPlayingPresentationState => {
  const appTheme = useOptionalAppTheme()?.theme ?? getAppTheme();

  // Native palette wins per-field, JS fallback fills the gaps so the gradient
  // is never the hard black/green brand color and stays deterministic per song.
  const effectivePalette = useMemo(
    () => mergeNativeAndFallbackPalette(palette, currentSong),
    [palette, currentSong],
  );
  const accent = effectivePalette.vibrant ?? effectivePalette.dominant ?? appTheme.palette.accent;
  const accentDark = effectivePalette.darkVibrant ?? effectivePalette.darkMuted ?? appTheme.palette.backgroundDeep;
  const accentMuted = effectivePalette.muted ?? effectivePalette.darkMuted ?? appTheme.palette.surface;
  const gradientColors = useMemo<GradientColors>(
    () => staticTheme.gradients.nowPlayingBackdrop(accent, accentDark),
    [accent, accentDark],
  );
  const albumTitle = currentSong ? displayAlbum(currentSong) : 'Aus deiner Bibliothek';
  const artworkUri = getSongArtworkUri(currentSong);
  const progressAccent = effectivePalette.vibrant ?? appTheme.palette.primary;
  const progressAccentDark = effectivePalette.lightVibrant ?? appTheme.palette.primaryDark;
  const foregroundOnAccent = pickReadableForeground(accent);

  return {
    accent,
    accentDark,
    accentMuted,
    gradientColors,
    albumTitle,
    artworkUri,
    progressAccent,
    progressAccentDark,
    foregroundOnAccent,
    hasNativePalette: palette !== null,
  };
};
