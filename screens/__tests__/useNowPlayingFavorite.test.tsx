import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNowPlayingFavorite } from '../useNowPlayingFavorite';

const mockIsFavoriteSongId = jest.fn<Promise<boolean>, [string]>();
const mockSetFavoriteSongId = jest.fn<Promise<string[]>, [string, boolean]>();

jest.mock('../../utils/storage', () => ({
  isFavoriteSongId: (songId: string) => mockIsFavoriteSongId(songId),
  setFavoriteSongId: (songId: string, favorite: boolean) => mockSetFavoriteSongId(songId, favorite),
}));

const FavoriteProbe = ({ songId }: { songId?: string }) => {
  const { favorite, favoritePending, toggleFavorite } = useNowPlayingFavorite(songId);

  return (
    <>
      <Text testID="favorite">{String(favorite)}</Text>
      <Text testID="pending">{String(favoritePending)}</Text>
      <Pressable testID="toggle" onPress={toggleFavorite} />
    </>
  );
};

describe('useNowPlayingFavorite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFavoriteSongId.mockResolvedValue(false);
    mockSetFavoriteSongId.mockResolvedValue([]);
  });

  test('loads favorite state for the current song', async () => {
    mockIsFavoriteSongId.mockResolvedValueOnce(true);
    const { getByTestId } = render(<FavoriteProbe songId="s1" />);

    await waitFor(() => expect(getByTestId('favorite').props.children).toBe('true'));
    expect(mockIsFavoriteSongId).toHaveBeenCalledWith('s1');
  });

  test('resets favorite state without a song id', async () => {
    const { getByTestId } = render(<FavoriteProbe />);

    await waitFor(() => expect(getByTestId('favorite').props.children).toBe('false'));
    expect(getByTestId('pending').props.children).toBe('false');
    expect(mockIsFavoriteSongId).not.toHaveBeenCalled();
  });

  test('toggles favorite state optimistically', async () => {
    const { getByTestId } = render(<FavoriteProbe songId="s1" />);
    await waitFor(() => expect(mockIsFavoriteSongId).toHaveBeenCalledWith('s1'));

    fireEvent.press(getByTestId('toggle'));

    expect(mockSetFavoriteSongId).toHaveBeenCalledWith('s1', true);
    await waitFor(() => expect(getByTestId('pending').props.children).toBe('false'));
  });

  test('rolls favorite state back when persistence fails', async () => {
    mockSetFavoriteSongId.mockRejectedValueOnce(new Error('storage full'));
    const { getByTestId } = render(<FavoriteProbe songId="s1" />);
    await waitFor(() => expect(mockIsFavoriteSongId).toHaveBeenCalledWith('s1'));

    fireEvent.press(getByTestId('toggle'));

    await waitFor(() => expect(getByTestId('favorite').props.children).toBe('false'));
    expect(getByTestId('pending').props.children).toBe('false');
  });
});
