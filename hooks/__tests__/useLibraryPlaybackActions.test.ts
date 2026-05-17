import { renderHook, act } from '@testing-library/react-native';
import { useState } from 'react';
import { useLibraryPlaybackActions } from '../useLibraryPlaybackActions';
import type { Song } from '../../types/Song';

const song = (id: string): Song => ({
  id,
  title: id,
  artist: 'Artist',
  album: 'Album',
  uri: id,
});

const useHarness = ({
  handleSongPress = jest.fn(),
  playSong = jest.fn(),
  songsForActiveList = [song('a'), song('b')],
} = {}) => {
  const [albumViewMode, setAlbumViewMode] = useState<'grid' | 'list'>('grid');
  const actions = useLibraryPlaybackActions({
    handleSongPress,
    playSong,
    setAlbumViewMode,
    songsForActiveList,
  });

  return { actions, albumViewMode };
};

test('handlePlayActiveList plays first active song with full queue', () => {
  const handleSongPress = jest.fn();
  const { result } = renderHook(() => useHarness({ handleSongPress }));

  act(() => {
    result.current.actions.handlePlayActiveList();
  });

  expect(handleSongPress).toHaveBeenCalledWith(song('a'), [song('a'), song('b')]);
});

test('handleShufflePress plays a shuffled queue', () => {
  const playSong = jest.fn();
  const { result } = renderHook(() => useHarness({ playSong }));

  act(() => {
    result.current.actions.handleShufflePress();
  });

  expect(playSong).toHaveBeenCalledTimes(1);
  expect(playSong.mock.calls[0][1]).toHaveLength(2);
});

test('toggleAlbumView toggles between grid and list', () => {
  const { result } = renderHook(() => useHarness());

  act(() => {
    result.current.actions.toggleAlbumView();
  });

  expect(result.current.albumViewMode).toBe('list');

  act(() => {
    result.current.actions.toggleAlbumView();
  });

  expect(result.current.albumViewMode).toBe('grid');
});
