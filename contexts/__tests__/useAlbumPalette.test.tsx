import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import { useAlbumPalette } from '../useAlbumPalette';
import {
  buildJsFallbackPalette,
  mergeNativeAndFallbackPalette,
} from '../../utils/jsPaletteFallback';
import type { Song } from '../../types/Song';

const songWithCover: Song = {
  id: 's1',
  title: 'One',
  artist: 'A',
  cover: 'file:///cover.jpg',
};

const secondSongWithCover: Song = {
  id: 's2',
  title: 'Two',
  artist: 'A',
  cover: 'file:///cover-2.jpg',
};

const PaletteProbe = ({ song }: { song: Song | null }) => {
  const palette = useAlbumPalette(song);
  return <Text testID="palette">{palette ? JSON.stringify(palette) : ''}</Text>;
};

const readPalette = (children: string): Record<string, string> | null =>
  (children ? JSON.parse(children) : null);
const readDominant = (children: string): string => readPalette(children)?.dominant ?? '';

describe('useAlbumPalette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('starts without palette and applies native palette when initial extraction resolves', async () => {
    let resolvePalette: (value: { dominant: string }) => void = () => undefined;
    jest.spyOn(SystemAudio, 'extractPalette').mockReturnValueOnce(new Promise(resolve => {
      resolvePalette = resolve;
    }));

    const { getByTestId } = render(<PaletteProbe song={songWithCover} />);

    expect(getByTestId('palette').props.children).toBe('');
    expect(SystemAudio.extractPalette).toHaveBeenCalledWith('file:///cover.jpg');

    await act(async () => {
      resolvePalette({ dominant: '#111111' });
    });
    await waitFor(() => expect(readDominant(getByTestId('palette').props.children)).toBe('#111111'));
    expect(readPalette(getByTestId('palette').props.children)).toEqual(
      mergeNativeAndFallbackPalette({ dominant: '#111111' }, songWithCover),
    );
  });

  test('fills missing native fields from the matching song fallback for partial palettes', async () => {
    jest
      .spyOn(SystemAudio, 'extractPalette')
      .mockResolvedValueOnce({ dominant: '#111111' })
      .mockResolvedValueOnce({ muted: '#333333' })
      .mockResolvedValueOnce({ darkVibrant: '#444444' });

    const { getByTestId, rerender } = render(<PaletteProbe song={songWithCover} />);
    await waitFor(() => expect(readDominant(getByTestId('palette').props.children)).toBe('#111111'));
    expect(readPalette(getByTestId('palette').props.children)).toEqual({
      ...buildJsFallbackPalette(songWithCover),
      dominant: '#111111',
    });

    rerender(<PaletteProbe song={secondSongWithCover} />);
    await waitFor(() => expect(readPalette(getByTestId('palette').props.children)?.muted).toBe('#333333'));
    expect(readPalette(getByTestId('palette').props.children)).toEqual({
      ...buildJsFallbackPalette(secondSongWithCover),
      muted: '#333333',
    });

    const thirdSongWithCover = {
      ...secondSongWithCover,
      id: 's3',
      title: 'Three',
      cover: 'file:///cover-3.jpg',
    };
    rerender(<PaletteProbe song={thirdSongWithCover} />);
    await waitFor(() => expect(readPalette(getByTestId('palette').props.children)?.darkVibrant).toBe('#444444'));
    expect(readPalette(getByTestId('palette').props.children)).toEqual({
      ...buildJsFallbackPalette(thirdSongWithCover),
      darkVibrant: '#444444',
    });
  });

  test('resets palette immediately on track change instead of retaining previous palette', async () => {
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

    const secondEffectivePalette = mergeNativeAndFallbackPalette(
      { dominant: '#222222' },
      secondSongWithCover,
    );

    const { getByTestId, rerender } = render(<PaletteProbe song={songWithCover} />);

    await act(async () => {
      resolveFirst({ dominant: '#111111' });
    });
    await waitFor(() => expect(readDominant(getByTestId('palette').props.children)).toBe('#111111'));

    rerender(<PaletteProbe song={secondSongWithCover} />);

    // Source-keyed immediate reset: palette clears during loading
    expect(getByTestId('palette').props.children).toBe('');

    await act(async () => {
      resolveSecond({ dominant: '#222222' });
    });
    await waitFor(() => expect(readPalette(getByTestId('palette').props.children)).toEqual(secondEffectivePalette));
  });

  test('ignores stale palette results after the artwork changes', async () => {
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

    const { getByTestId, rerender } = render(<PaletteProbe song={songWithCover} />);
    rerender(<PaletteProbe song={secondSongWithCover} />);

    await act(async () => {
      resolveSecond({ dominant: '#222222' });
    });
    await waitFor(() => expect(readDominant(getByTestId('palette').props.children)).toBe('#222222'));

    await act(async () => {
      resolveFirst({ dominant: '#111111' });
    });
    expect(readDominant(getByTestId('palette').props.children)).toBe('#222222');
  });

  test('resets palette immediately when extraction is pending and stays clear after failure', async () => {
    let resolveFirst: (value: { dominant: string }) => void = () => undefined;
    let rejectSecond: (error: Error) => void = () => undefined;
    jest
      .spyOn(SystemAudio, 'extractPalette')
      .mockReturnValueOnce(new Promise(resolve => {
        resolveFirst = resolve;
      }))
      .mockReturnValueOnce(new Promise((resolve, reject) => {
        rejectSecond = reject;
      }));

    const firstEffectivePalette = mergeNativeAndFallbackPalette(
      { dominant: '#111111' },
      songWithCover,
    );
    const { getByTestId, rerender } = render(<PaletteProbe song={songWithCover} />);

    await act(async () => {
      resolveFirst({ dominant: '#111111' });
    });
    await waitFor(() => expect(readPalette(getByTestId('palette').props.children)).toEqual(firstEffectivePalette));

    rerender(<PaletteProbe song={secondSongWithCover} />);
    // Immediate reset: no stale palette retention
    expect(getByTestId('palette').props.children).toBe('');

    await act(async () => {
      rejectSecond(new Error('failed'));
    });
    // Still empty after failure
    await waitFor(() => expect(getByTestId('palette').props.children).toBe(''));
  });

  test('clears retained palette immediately when the new song has no artwork', async () => {
    jest.spyOn(SystemAudio, 'extractPalette').mockResolvedValueOnce({ dominant: '#111111' });

    const { getByTestId, rerender } = render(<PaletteProbe song={songWithCover} />);
    await waitFor(() => expect(readDominant(getByTestId('palette').props.children)).toBe('#111111'));

    rerender(<PaletteProbe song={{ id: 'no-cover', title: 'nc', artist: 'A' }} />);

    expect(getByTestId('palette').props.children).toBe('');
  });

  test('does not set hook state after unmount', async () => {
    let resolvePalette: (value: { dominant: string }) => void = () => undefined;
    jest.spyOn(SystemAudio, 'extractPalette').mockReturnValueOnce(new Promise(resolve => {
      resolvePalette = resolve;
    }));

    const { unmount } = render(<PaletteProbe song={songWithCover} />);
    unmount();

    await act(async () => {
      resolvePalette({ dominant: '#111111' });
    });
  });

  test('recomputes fallback fields for a new song that shares the same artwork', async () => {
    jest.spyOn(SystemAudio, 'extractPalette').mockResolvedValueOnce({ dominant: '#111111' });
    const sameArtworkSong: Song = {
      ...songWithCover,
      id: 's1-remix',
      title: 'One (Remix)',
      artist: 'Different Artist',
    };
    const firstEffectivePalette = mergeNativeAndFallbackPalette(
      { dominant: '#111111' },
      songWithCover,
    );
    const secondEffectivePalette = mergeNativeAndFallbackPalette(
      { dominant: '#111111' },
      sameArtworkSong,
    );
    expect(secondEffectivePalette.vibrant).not.toBe(firstEffectivePalette.vibrant);

    const { getByTestId, rerender } = render(<PaletteProbe song={songWithCover} />);
    await waitFor(() => expect(readPalette(getByTestId('palette').props.children)).toEqual(firstEffectivePalette));

    rerender(<PaletteProbe song={sameArtworkSong} />);

    expect(readPalette(getByTestId('palette').props.children)).toEqual(secondEffectivePalette);
    expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(1);
  });
});
