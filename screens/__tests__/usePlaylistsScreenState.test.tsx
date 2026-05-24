import React from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { usePlaylistsScreenState } from '../usePlaylistsScreenState';

const mockCreatePlaylist = jest.fn();
const mockDeletePlaylist = jest.fn();
const mockPlayPlaylist = jest.fn();

const mockPlaylists = [
  {
    id: 'p1',
    name: 'Main',
    songIds: ['s1', 'missing'],
    createdAt: 1, updatedAt: 1,
  },
  {
    id: 'p2',
    name: 'Empty',
    songIds: [],
    createdAt: 2, updatedAt: 2,
  },
];

const mockSongs = [
  { id: 's1', title: 'One', artist: 'Artist' },
  { id: 's2', title: 'Two', artist: 'Artist' },
];

jest.mock('../../contexts/MusicContext', () => ({
  useMusicContext: () => ({
    playlists: mockPlaylists,
    createPlaylist: mockCreatePlaylist,
    deletePlaylist: mockDeletePlaylist,
    playPlaylist: mockPlayPlaylist,
    songs: mockSongs,
  }),
}));

const PlaylistsStateProbe = () => {
  const state = usePlaylistsScreenState();

  return (
    <>
      <Text testID="name">{state.newPlaylistName || 'empty'}</Text>
      <Text testID="entry-count">{String(state.playlistEntries.length)}</Text>
      <Text testID="first-valid-count">{String(state.playlistEntries[0]?.validSongCount ?? -1)}</Text>
      <Pressable testID="set-empty-name" onPress={() => state.setNewPlaylistName('   ')} />
      <Pressable testID="set-name" onPress={() => state.setNewPlaylistName('  Techno  ')} />
      <Pressable testID="create" onPress={state.handleCreatePlaylist} />
      <Pressable testID="delete" onPress={() => state.handleDeletePlaylist('p1', 'Main')} />
      <Pressable testID="play" onPress={() => { void state.playPlaylist('p1'); }} />
    </>
  );
};

describe('usePlaylistsScreenState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('builds playlist entries with valid song counts', () => {
    const { getByTestId } = render(<PlaylistsStateProbe />);

    expect(getByTestId('entry-count').props.children).toBe('2');
    expect(getByTestId('first-valid-count').props.children).toBe('1');
  });

  test('blocks empty playlist creation', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByTestId } = render(<PlaylistsStateProbe />);

    fireEvent.press(getByTestId('set-empty-name'));
    fireEvent.press(getByTestId('create'));

    expect(mockCreatePlaylist).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Fehler', 'Bitte gib einen Namen für die Playlist ein.');
  });

  test('creates playlist with trimmed name and clears input', () => {
    const { getByTestId } = render(<PlaylistsStateProbe />);

    fireEvent.press(getByTestId('set-name'));
    expect(getByTestId('name').props.children).toBe('  Techno  ');

    fireEvent.press(getByTestId('create'));

    expect(mockCreatePlaylist).toHaveBeenCalledWith('Techno');
    expect(getByTestId('name').props.children).toBe('empty');
  });

  test('confirms playlist deletion and deletes on confirm', () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_, __, buttons) => {
      buttons?.[1]?.onPress?.();
    });
    const { getByTestId } = render(<PlaylistsStateProbe />);

    fireEvent.press(getByTestId('delete'));

    expect(mockDeletePlaylist).toHaveBeenCalledWith('p1');
  });

  test('exposes play playlist action', () => {
    const { getByTestId } = render(<PlaylistsStateProbe />);

    fireEvent.press(getByTestId('play'));

    expect(mockPlayPlaylist).toHaveBeenCalledWith('p1');
  });
});
