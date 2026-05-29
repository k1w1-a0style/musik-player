import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNowPlayingFavorite } from '../useNowPlayingFavorite';

const mockIsFavoriteSongId = jest.fn<Promise<boolean>, [string]>();
const mockSetFavoriteSongId = jest.fn<Promise<string[]>, [string, boolean]>();

jest.mock('../../utils/storage', () => ({
  isFavoriteSongId: (songId: string) => mockIsFavoriteSongId(songId),
  normalizeStorageSongId: (songId?: string) => {
    const trimmed = songId?.trim();
    return trimmed || undefined;
  },
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

  test('normalizes song ids before favorite lookup and persistence', async () => {
    const { getByTestId } = render(<FavoriteProbe songId=" s1 " />);
    await waitFor(() => expect(mockIsFavoriteSongId).toHaveBeenCalledWith('s1'));

    fireEvent.press(getByTestId('toggle'));

    expect(mockSetFavoriteSongId).toHaveBeenCalledWith('s1', true);
    await waitFor(() => expect(getByTestId('pending').props.children).toBe('false'));
  });

  test('resets favorite state without a song id', async () => {
    const { getByTestId } = render(<FavoriteProbe />);

    await waitFor(() => expect(getByTestId('favorite').props.children).toBe('false'));
    expect(getByTestId('pending').props.children).toBe('false');
    expect(mockIsFavoriteSongId).not.toHaveBeenCalled();
  });

  test('ignores blank song ids', async () => {
    const { getByTestId } = render(<FavoriteProbe songId="   " />);

    fireEvent.press(getByTestId('toggle'));

    expect(mockIsFavoriteSongId).not.toHaveBeenCalled();
    expect(mockSetFavoriteSongId).not.toHaveBeenCalled();
  });

  test('toggles favorite state optimistically', async () => {
    const { getByTestId } = render(<FavoriteProbe songId="s1" />);
    await waitFor(() => expect(mockIsFavoriteSongId).toHaveBeenCalledWith('s1'));

    fireEvent.press(getByTestId('toggle'));

    expect(mockSetFavoriteSongId).toHaveBeenCalledWith('s1', true);
    await waitFor(() => expect(getByTestId('pending').props.children).toBe('false'));
  });

  test('logs and keeps a safe false favorite state when lookup fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error('read failed');
    mockIsFavoriteSongId.mockRejectedValueOnce(error);

    const { getByTestId } = render(<FavoriteProbe songId="s1" />);

    await waitFor(() => expect(warn).toHaveBeenCalledWith(
      '[NowPlayingFavorite] Failed to load favorite state.',
      { songId: 's1', error },
    ));
    expect(getByTestId('favorite').props.children).toBe('false');
    expect(getByTestId('pending').props.children).toBe('false');

    warn.mockRestore();
  });

  test('rolls favorite state back and logs when persistence fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error('storage full');
    mockSetFavoriteSongId.mockRejectedValueOnce(error);
    const { getByTestId } = render(<FavoriteProbe songId="s1" />);
    await waitFor(() => expect(mockIsFavoriteSongId).toHaveBeenCalledWith('s1'));

    fireEvent.press(getByTestId('toggle'));

    await waitFor(() => expect(getByTestId('favorite').props.children).toBe('false'));
    expect(getByTestId('pending').props.children).toBe('false');
    expect(warn).toHaveBeenCalledWith(
      '[NowPlayingFavorite] Failed to persist favorite state.',
      { songId: 's1', favorite: true, error },
    );

    warn.mockRestore();
  });
});
