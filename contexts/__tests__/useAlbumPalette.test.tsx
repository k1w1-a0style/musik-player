import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import { useAlbumPalette } from '../useAlbumPalette';
import type { Song } from '../../types/Song';

const songWithCover: Song = {
  id: 's1',
  title: 'One',
  artist: 'A',
  cover: 'file:///cover.jpg',
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
});
