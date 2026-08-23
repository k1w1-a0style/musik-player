import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import { useAlbumPaletteState } from '../../contexts/useAlbumPalette';
import type { Song } from '../../types/Song';
import { buildJsFallbackPalette, mergeNativeAndFallbackPalette } from '../../utils/jsPaletteFallback';
import { useNowPlayingPresentation } from '../useNowPlayingPresentation';

jest.mock('../../contexts/AppThemeContext', () => ({
  useOptionalAppTheme: () => undefined,
}));

const firstSong: Song = {
  id: 'first',
  title: 'First',
  artist: 'Artist A',
  cover: 'file:///first.jpg',
};

const secondSong: Song = {
  id: 'second',
  title: 'Second',
  artist: 'Artist B',
  cover: 'file:///second.jpg',
};

const noArtworkSong: Song = {
  id: 'no-artwork',
  title: 'No Artwork',
  artist: 'Artist C',
};

const Probe = ({ song }: { song: Song }) => {
  const { palette, isLoading } = useAlbumPaletteState(song);
  const presentation = useNowPlayingPresentation({
    currentSong: song,
    palette,
    paletteLoading: isLoading,
  });

  return (
    <>
      <Text testID="accent">{presentation.accent}</Text>
      <Text testID="loading">{String(isLoading)}</Text>
    </>
  );
};

describe('useNowPlayingPresentation palette lifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retains the previous palette only while the new artwork is loading', async () => {
    let resolveFirst: (value: { dominant: string }) => void = () => undefined;
    let rejectSecond: (error: Error) => void = () => undefined;

    jest
      .spyOn(SystemAudio, 'extractPalette')
      .mockReturnValueOnce(new Promise(resolve => {
        resolveFirst = resolve;
      }))
      .mockReturnValueOnce(new Promise((_resolve, reject) => {
        rejectSecond = reject;
      }));

    const firstAccent = mergeNativeAndFallbackPalette(
      { dominant: '#111111' },
      firstSong,
    ).vibrant;
    const secondFallbackAccent = buildJsFallbackPalette(secondSong).vibrant;

    const { getByTestId, rerender } = render(<Probe song={firstSong} />);

    await act(async () => {
      resolveFirst({ dominant: '#111111' });
    });
    await waitFor(() => expect(getByTestId('accent').props.children).toBe(firstAccent));

    rerender(<Probe song={secondSong} />);

    expect(getByTestId('loading').props.children).toBe('true');
    expect(getByTestId('accent').props.children).toBe(firstAccent);

    await act(async () => {
      rejectSecond(new Error('palette extraction failed'));
    });

    await waitFor(() => expect(getByTestId('loading').props.children).toBe('false'));
    expect(getByTestId('accent').props.children).toBe(secondFallbackAccent);
    expect(getByTestId('accent').props.children).not.toBe(firstAccent);
  });

  test('clears the retained palette immediately when the new song has no artwork', async () => {
    jest.spyOn(SystemAudio, 'extractPalette').mockResolvedValueOnce({ dominant: '#111111' });

    const firstAccent = mergeNativeAndFallbackPalette(
      { dominant: '#111111' },
      firstSong,
    ).vibrant;
    const noArtworkFallbackAccent = buildJsFallbackPalette(noArtworkSong).vibrant;

    const { getByTestId, rerender } = render(<Probe song={firstSong} />);
    await waitFor(() => expect(getByTestId('accent').props.children).toBe(firstAccent));

    rerender(<Probe song={noArtworkSong} />);

    expect(getByTestId('loading').props.children).toBe('false');
    expect(getByTestId('accent').props.children).toBe(noArtworkFallbackAccent);
    expect(getByTestId('accent').props.children).not.toBe(firstAccent);
  });
});
