import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import { useNowPlayingPresentation } from '../useNowPlayingPresentation';
import { buildJsFallbackPalette, mergeNativeAndFallbackPalette } from '../../utils/jsPaletteFallback';
import { useAlbumPaletteState } from '../../contexts/useAlbumPalette';
import type { Song } from '../../types/Song';
const mockAppTheme = {
  appearance: 'dark',
  skin: 'graphite',
  isHydrated: true,
  setAppearance: () => undefined,
  setSkin: () => undefined,
  theme: {
    palette: {
      background: '#08090B',
      backgroundDeep: '#030406',
      surface: '#111318',
      surfaceElevated: '#191B21',
      border: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(210, 218, 230, 0.28)',
      primary: '#D8DEE8',
      primaryDark: '#87909E',
      accent: '#BFC7D4',
      text: {
        primary: '#F4F5F3',
        secondary: 'rgba(244, 245, 247, 0.70)',
        muted: 'rgba(244, 245, 247, 0.42)',
        onPrimary: '#07090C',
      },
    },
    gradients: {
      background: ['#030406', '#08090B', '#0D1014'],
      nowPlaying: ['#030406', '#08090B', '#0D1014'],
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => mockAppTheme,
  useOptionalAppTheme: () => mockAppTheme,
}));

const song: Song = {
  id: 's1',
  title: 'One',
  artist: 'A',
  album: 'Album',
  cover: 'file:///cover.jpg',
};

const secondSong: Song = {
  id: 's2',
  title: 'Two',
  artist: 'B',
  album: 'Second Album',
  cover: 'file:///cover-2.jpg',
};

const PresentationProbe = () => {
  const presentation = useNowPlayingPresentation({
    currentSong: song,
    palette: {
      dominant: '#111111',
      vibrant: '#222222',
      darkVibrant: '#333333',
      lightVibrant: '#444444',
    },
  });

  return (
    <>
      <Text testID="accent">{presentation.accent}</Text>
      <Text testID="accent-dark">{presentation.accentDark}</Text>
      <Text testID="album-title">{presentation.albumTitle}</Text>
      <Text testID="artwork-uri">{presentation.artworkUri}</Text>
      <Text testID="gradient-count">{presentation.gradientColors.length}</Text>
      <Text testID="gradient-colors">{presentation.gradientColors.join('|')}</Text>
      <Text testID="progress-accent">{presentation.progressAccent}</Text>
      <Text testID="progress-accent-dark">{presentation.progressAccentDark}</Text>
    </>
  );
};

describe('useNowPlayingPresentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('builds presentation values from current song and palette', () => {
    const { getByTestId } = render(<PresentationProbe />);

    expect(getByTestId('accent').props.children).toBe('#222222');
    expect(getByTestId('accent-dark').props.children).toBe('#333333');
    expect(getByTestId('album-title').props.children).toBe('Album');
    expect(getByTestId('artwork-uri').props.children).toBe('file:///cover.jpg');
    expect(getByTestId('gradient-count').props.children).toBe(3);
    expect(getByTestId('gradient-colors').props.children).toBe('#333333|#030406|#08090B');
    expect(getByTestId('progress-accent').props.children).toBe('#222222');
    expect(getByTestId('progress-accent-dark').props.children).toBe('#444444');
  });

  test('falls back to JS palette when native palette is null', () => {
    const FallbackProbe = () => {
      const presentation = useNowPlayingPresentation({ currentSong: song, palette: null });
      return (
        <>
          <Text testID="accent">{presentation.accent}</Text>
          <Text testID="has-native">{String(presentation.hasNativePalette)}</Text>
          <Text testID="foreground">{presentation.foregroundOnAccent}</Text>
        </>
      );
    };
    const { getByTestId } = render(<FallbackProbe />);
    expect(getByTestId('has-native').props.children).toBe('false');
    // JS fallback returns a deterministic hex like "#xxxxxx" – not the brand green.
    const accent = getByTestId('accent').props.children as string;
    expect(accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(accent).not.toBe(mockAppTheme.theme.palette.accent);
    // Foreground is one of the two safe contrast colors.
    expect(['#FFFFFF', '#0A0B0C']).toContain(getByTestId('foreground').props.children);
  });

  test('does not mix a retained partial native palette with the new song fallback while artwork loads', async () => {
    let resolveFirst: (value: { dominant: string }) => void = () => undefined;
    let resolveSecond: (value: { dominant: string }) => void = () => undefined;
    jest
      .spyOn(SystemAudio, 'extractPalette')
      .mockReturnValueOnce(new Promise(resolve => {
        resolveFirst = resolve;
      }))
      .mockReturnValueOnce(new Promise(resolve => {
        resolveSecond = resolve;
      }));
    const TransitionProbe = ({ currentSong }: { currentSong: Song }) => {
      const { palette, isLoading } = useAlbumPaletteState(currentSong);
      const presentation = useNowPlayingPresentation({
        currentSong,
        palette,
        paletteLoading: isLoading,
      });
      return <Text testID="accent">{presentation.accent}</Text>;
    };
    const firstVisibleAccent = mergeNativeAndFallbackPalette({ dominant: '#111111' }, song).vibrant;
    const secondFallbackAccent = buildJsFallbackPalette(secondSong).vibrant;
    const secondVisibleAccent = mergeNativeAndFallbackPalette({ dominant: '#222222' }, secondSong).vibrant;
    expect(firstVisibleAccent).not.toBe(secondFallbackAccent);

    const { getByTestId, rerender } = render(<TransitionProbe currentSong={song} />);

    await act(async () => {
      resolveFirst({ dominant: '#111111' });
    });
    await waitFor(() => expect(getByTestId('accent').props.children).toBe(firstVisibleAccent));

    rerender(<TransitionProbe currentSong={secondSong} />);

    expect(getByTestId('accent').props.children).toBe(firstVisibleAccent);
    expect(getByTestId('accent').props.children).not.toBe(secondFallbackAccent);

    await act(async () => {
      resolveSecond({ dominant: '#222222' });
    });
    await waitFor(() => expect(getByTestId('accent').props.children).toBe(secondVisibleAccent));
  });

  test('hasNativePalette is true when palette is provided', () => {
    const Probe = () => {
      const presentation = useNowPlayingPresentation({ currentSong: song, palette: { dominant: '#111111' } });
      return <Text testID="has-native">{String(presentation.hasNativePalette)}</Text>;
    };
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('has-native').props.children).toBe('true');
  });
});
