import React, { useRef, useState } from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import TrackPlayer from 'react-native-track-player';
import { mergeUniqueSongs, patchSongById, useLibraryActions } from '../useLibraryActions';
import type { Playlist, Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'B', uri: 'file:///s2.mp3' },
];

const LibraryProbe = () => {
  const [currentSongs, setSongsState] = useState<Song[]>([songs[0]]);
  const [currentSong, setCurrentSong] = useState<Song | null>(songs[0]);
  const [playbackQueue, setPlaybackQueue] = useState<Song[]>(songs);
  const [playlists, setPlaylists] = useState<Playlist[]>([
    { id: 'pl-1', name: 'List', songIds: ['s1', 'missing'], createdAt: 1 },
  ]);
  const queueContextRef = useRef<Song[]>(songs.slice());
  const baseQueueContextRef = useRef<Song[]>(songs.slice());
  const nativeQueueRef = useRef<Song[]>(songs.slice());

  const { setSongs, addSongs, updateSongMetadata } = useLibraryActions({
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    setSongsState,
    setCurrentSong,
    setPlaybackQueue,
    setPlaylists,
  });

  return (
    <>
      <Text testID="songs">{currentSongs.map(song => song.id).join(',')}</Text>
      <Text testID="current-title">{currentSong?.title ?? ''}</Text>
      <Text testID="queue-title">{playbackQueue[0]?.title ?? ''}</Text>
      <Text testID="playlist-songs">{playlists[0]?.songIds.join(',') ?? ''}</Text>
      <Button testID="set-songs" title="set" onPress={() => setSongs([songs[1]])} />
      <Button testID="add-songs" title="add" onPress={() => addSongs([songs[0], songs[1]])} />
      <Button testID="patch-song" title="patch" onPress={() => updateSongMetadata('s1', { title: 'Updated' })} />
    </>
  );
};

describe('useLibraryActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('merges unique songs', () => {
    expect(mergeUniqueSongs([songs[0]], [songs[0], songs[1]])).toEqual(songs);
  });

  test('patches song by id', () => {
    expect(patchSongById('s1', { title: 'Updated' })(songs[0]).title).toBe('Updated');
    expect(patchSongById('missing', { title: 'Updated' })(songs[0])).toBe(songs[0]);
  });

  test('sets songs and prunes playlist song ids', () => {
    const { getByTestId } = render(<LibraryProbe />);

    act(() => fireEvent.press(getByTestId('set-songs')));

    expect(getByTestId('songs').props.children).toBe('s2');
    expect(getByTestId('playlist-songs').props.children).toBe('');
  });

  test('adds only missing songs', () => {
    const { getByTestId } = render(<LibraryProbe />);

    act(() => fireEvent.press(getByTestId('add-songs')));

    expect(getByTestId('songs').props.children).toBe('s1,s2');
  });

  test('updates metadata in state refs and native queue', () => {
    const { getByTestId } = render(<LibraryProbe />);

    act(() => fireEvent.press(getByTestId('patch-song')));

    expect(getByTestId('current-title').props.children).toBe('Updated');
    expect(getByTestId('queue-title').props.children).toBe('Updated');
    expect(TrackPlayer.updateMetadataForTrack).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ title: 'Updated' }),
    );
  });
});
