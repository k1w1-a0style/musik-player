import React, { useRef, useState } from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { buildPlaylistQueue, usePlaylistActions } from '../usePlaylistActions';
import type { Playlist, Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'B', uri: 'file:///s2.mp3' },
];

const initialPlaylist: Playlist = {
  id: 'pl-1',
  name: 'Initial',
  songIds: ['s1'],
  createdAt: 1,
};

const PlaylistProbe = ({ playSong }: { playSong: jest.Mock }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([initialPlaylist]);
  const songsRef = useRef<Song[]>(songs);
  const {
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    playPlaylist,
  } = usePlaylistActions({ playlists, setPlaylists, songsRef, playSong });

  return (
    <>
      <Text testID="names">{playlists.map(playlist => playlist.name).join(',')}</Text>
      <Text testID="song-ids">{playlists[0]?.songIds.join(',') ?? ''}</Text>
      <Button testID="create" title="create" onPress={() => createPlaylist('Created')} />
      <Button testID="rename" title="rename" onPress={() => renamePlaylist('pl-1', 'Renamed')} />
      <Button testID="add" title="add" onPress={() => addSongToPlaylist('pl-1', 's2')} />
      <Button testID="remove" title="remove" onPress={() => removeSongFromPlaylist('pl-1', 's1')} />
      <Button testID="delete" title="delete" onPress={() => deletePlaylist('pl-1')} />
      <Button testID="play" title="play" onPress={() => void playPlaylist('pl-1')} />
    </>
  );
};

describe('usePlaylistActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('builds playlist queues while skipping missing songs', () => {
    expect(buildPlaylistQueue({ ...initialPlaylist, songIds: ['s2', 'missing', 's1'] }, songs)).toEqual([
      songs[1],
      songs[0],
    ]);
  });

  test('creates, renames, adds, removes and deletes playlists', () => {
    const playSong = jest.fn(async () => undefined);
    const { getByTestId } = render(<PlaylistProbe playSong={playSong} />);

    act(() => fireEvent.press(getByTestId('create')));
    expect(getByTestId('names').props.children).toContain('Created');

    act(() => fireEvent.press(getByTestId('rename')));
    expect(getByTestId('names').props.children).toContain('Renamed');

    act(() => fireEvent.press(getByTestId('add')));
    expect(getByTestId('song-ids').props.children).toBe('s1,s2');

    act(() => fireEvent.press(getByTestId('remove')));
    expect(getByTestId('song-ids').props.children).toBe('s2');

    act(() => fireEvent.press(getByTestId('delete')));
    expect(getByTestId('names').props.children).toBe('Created');
  });

  test('plays the playlist queue from its first song', async () => {
    const playSong = jest.fn(async () => undefined);
    const { getByTestId } = render(<PlaylistProbe playSong={playSong} />);

    await act(async () => {
      fireEvent.press(getByTestId('play'));
    });

    expect(playSong).toHaveBeenCalledWith(songs[0], [songs[0]]);
  });
});
