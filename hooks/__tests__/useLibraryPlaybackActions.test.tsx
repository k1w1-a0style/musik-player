import React from 'react';
import { Pressable } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useLibraryPlaybackActions } from '../useLibraryPlaybackActions';
import type { LibraryAlbumViewMode } from '../../types/LibraryView';
import type { Song } from '../../types/Song';

const mockShuffleItems = jest.fn((items: Song[]) => [...items].reverse());

jest.mock('../../utils/libraryShuffle', () => ({
  shuffleItems: (items: Song[]) => mockShuffleItems(items),
}));

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'Artist' },
  { id: 's2', title: 'Two', artist: 'Artist' },
];

interface PlaybackActionsProbeProps {
  songsForActiveList?: Song[];
}

const handleSongPress = jest.fn();
const playSong = jest.fn();
const setAlbumViewMode = jest.fn();

const PlaybackActionsProbe: React.FC<PlaybackActionsProbeProps> = ({
  songsForActiveList = songs,
}) => {
  const actions = useLibraryPlaybackActions({
    handleSongPress,
    playSong,
    setAlbumViewMode,
    songsForActiveList,
  });

  return (
    <>
      <Pressable testID="play-active" onPress={actions.handlePlayActiveList} />
      <Pressable testID="shuffle" onPress={actions.handleShufflePress} />
      <Pressable testID="toggle-view" onPress={actions.toggleAlbumView} />
    </>
  );
};

describe('useLibraryPlaybackActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('plays the first song from the active list', () => {
    const { getByTestId } = render(<PlaybackActionsProbe />);

    fireEvent.press(getByTestId('play-active'));

    expect(handleSongPress).toHaveBeenCalledWith(songs[0], songs);
  });

  test('does not play an empty active list', () => {
    const { getByTestId } = render(<PlaybackActionsProbe songsForActiveList={[]} />);

    fireEvent.press(getByTestId('play-active'));
    fireEvent.press(getByTestId('shuffle'));

    expect(handleSongPress).not.toHaveBeenCalled();
    expect(playSong).not.toHaveBeenCalled();
    expect(mockShuffleItems).not.toHaveBeenCalled();
  });

  test('shuffles active list and plays first shuffled song', () => {
    const { getByTestId } = render(<PlaybackActionsProbe />);

    fireEvent.press(getByTestId('shuffle'));

    expect(mockShuffleItems).toHaveBeenCalledWith(songs);
    expect(playSong).toHaveBeenCalledWith(songs[1], [songs[1], songs[0]]);
  });

  test('toggles album view mode updater', () => {
    const { getByTestId } = render(<PlaybackActionsProbe />);

    fireEvent.press(getByTestId('toggle-view'));

    expect(setAlbumViewMode).toHaveBeenCalledTimes(1);
    const updater = setAlbumViewMode.mock.calls[0][0] as (mode: LibraryAlbumViewMode) => LibraryAlbumViewMode;
    expect(updater('grid')).toBe('list');
    expect(updater('list')).toBe('grid');
  });
});
