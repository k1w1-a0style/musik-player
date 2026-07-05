import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import { useAlbumPalette } from '../useAlbumPalette';
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
  return <Text testID="palette">{palette?.dominant ?? ''}</Text>;
};

describe('useAlbumPalette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads palette for current song artwork', async () => {
    jest.spyOn(SystemAudio, 'extractPalette').mockResolvedValueOnce({ dominant: '#111111' });

    const { getByTestId } = render(<PaletteProbe song={songWithCover} />);

    await waitFor(() => expect(getByTestId('palette').props.children).toBe('#111111'));
    expect(SystemAudio.extractPalette).toHaveBeenCalledWith('file:///cover.jpg');
  });

  test('clears palette when song has no artwork', () => {
    const { getByTestId } = render(<PaletteProbe song={null} />);

    expect(getByTestId('palette').props.children).toBe('');
    expect(SystemAudio.extractPalette).not.toHaveBeenCalled();
  });

  test('clears palette when extraction fails', async () => {
    jest.spyOn(SystemAudio, 'extractPalette').mockRejectedValueOnce(new Error('failed'));

    const { getByTestId } = render(<PaletteProbe song={songWithCover} />);

    await waitFor(() => expect(getByTestId('palette').props.children).toBe(''));
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
    await waitFor(() => expect(getByTestId('palette').props.children).toBe('#222222'));

    await act(async () => {
      resolveFirst({ dominant: '#111111' });
    });
    expect(getByTestId('palette').props.children).toBe('#222222');
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

  test('resets palette immediately on artwork change so consumers do not read stale native colors', async () => {
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

    await act(async () => {
      resolveFirst({ dominant: '#111111' });
    });
    await waitFor(() => expect(getByTestId('palette').props.children).toBe('#111111'));

    rerender(<PaletteProbe song={secondSongWithCover} />);

    // Between artwork switch and the new native palette arriving the hook must
    // return null so consumers fall back to the deterministic JS palette rather
    // than painting the new cover with the previous song's native accents.
    expect(getByTestId('palette').props.children).toBe('');

    await act(async () => {
      resolveSecond({ dominant: '#222222' });
    });
    await waitFor(() => expect(getByTestId('palette').props.children).toBe('#222222'));
  });

  test('resets palette to null when a new song has no artwork', async () => {
    jest.spyOn(SystemAudio, 'extractPalette').mockResolvedValueOnce({ dominant: '#111111' });

    const { getByTestId, rerender } = render(<PaletteProbe song={songWithCover} />);
    await waitFor(() => expect(getByTestId('palette').props.children).toBe('#111111'));

    rerender(<PaletteProbe song={{ id: 'no-cover', title: 'nc', artist: 'A' }} />);

    expect(getByTestId('palette').props.children).toBe('');
  });
});
