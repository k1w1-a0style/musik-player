import { useMemo } from 'react';
import type { ColorValue } from 'react-native';
import type { PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { useOptionalAppTheme } from '../contexts/AppThemeContext';
import { getAppTheme } from '../utils/appTheme';
import { displayAlbum } from '../utils/libraryPresentation';
import { getSongArtworkUri } from '../utils/songArtwork';
import { mergeNativeAndFallbackPalette } from '../utils/jsPaletteFallback';
import { useAccentPreferences } from '../contexts/AccentPreferencesContext';
import { readableAccentForeground, resolveAccentColor } from '../utils/accentPreferences';

type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];

interface UseNowPlayingPresentationArgs {
  currentSong: Song | null;
  palette: PaletteResult | null;
  paletteLoading?: boolean;
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
  const { preferences } = useAccentPreferences();

  // Native palette wins per-field, JS fallback fills the gaps so the gradient
  // is never the hard black/green brand color and stays deterministic per song.
  const effectivePalette = useMemo(
    () => mergeNativeAndFallbackPalette(palette, currentSong),
    [palette, currentSong],
  );
  const accent = resolveAccentColor(preferences.playerAccent,
    effectivePalette.vibrant ?? effectivePalette.dominant ?? appTheme.palette.accent);
  const accentDark = effectivePalette.darkVibrant ?? effectivePalette.darkMuted ?? appTheme.palette.backgroundDeep;
  const accentMuted = effectivePalette.muted ?? effectivePalette.darkMuted ?? appTheme.palette.surface;
  const gradientColors = useMemo<GradientColors>(
    () => [accentDark, appTheme.palette.backgroundDeep, appTheme.palette.background] as const,
    [accentDark, appTheme.palette.backgroundDeep, appTheme.palette.background],
  );
  const albumTitle = currentSong ? displayAlbum(currentSong) : 'Aus deiner Bibliothek';
  const artworkUri = getSongArtworkUri(currentSong);
  const progressAccent = accent;
  const progressAccentDark = preferences.playerAccent === 'cover' ? effectivePalette.lightVibrant ?? appTheme.palette.primaryDark : accent;
  const foregroundOnAccent = readableAccentForeground(accent);

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
