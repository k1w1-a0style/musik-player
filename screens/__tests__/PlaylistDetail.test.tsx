import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import PlaylistDetail from '../PlaylistDetail';
import type { Playlist, Song } from '../../types/Song';

let mockPlaylistId = 'playlist-1';
let mockSongs: Song[] = [];
let mockPlaylists: Playlist[] = [];
let mockMoveSongInPlaylistEnabled = true;
const mockGoBack = jest.fn();
const mockDeletePlaylist = jest.fn();
const mockRenamePlaylist = jest.fn();
const mockAddSongToPlaylist = jest.fn();
const mockRemoveSongFromPlaylist = jest.fn();
const mockMoveSongInPlaylist = jest.fn();
const mockPlayPlaylist = jest.fn(async () => undefined);

const mockAppTheme = {
  palette: {
    background: '#08090B',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(210, 218, 230, 0.28)',
    error: '#FF6F8A',
    primary: '#D8DEE8',
    primaryDark: '#87909E',
    surface: '#111318',
    surfaceElevated: '#191B21',
    text: {
      primary: '#F4F5F7',
      secondary: 'rgba(244, 245, 247, 0.70)',
      muted: 'rgba(244, 245, 247, 0.42)',
      onPrimary: '#07090C',
    },
  },
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { playlistId: mockPlaylistId } }),
}));

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    theme: mockAppTheme,
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
  }),
}));

jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: () => ({
    playlists: mockPlaylists,
    deletePlaylist: mockDeletePlaylist,
    renamePlaylist: mockRenamePlaylist,
    addSongToPlaylist: mockAddSongToPlaylist,
    removeSongFromPlaylist: mockRemoveSongFromPlaylist,
    moveSongInPlaylist: mockMoveSongInPlaylistEnabled ? mockMoveSongInPlaylist : undefined,
    playPlaylist: mockPlayPlaylist,
    songs: mockSongs,
  }),
}));

jest.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
  ChevronUp: 'ChevronUp',
  Edit3: 'Edit3',
  Plus: 'Plus',
  Play: 'Play',
  Search: 'Search',
  Trash2: 'Trash2',
  X: 'X',
}));

const song = (id: string, patch: Partial<Song> = {}): Song => ({
  id,
  title: patch.title ?? id,
  artist: patch.artist ?? 'Artist',
  album: patch.album ?? 'Album',
  uri: patch.uri ?? `file://${id}`,
  ...patch,
});

const playlist = (id: string, songIds: string[], patch: Partial<Playlist> = {}): Playlist => ({
  id,
  name: patch.name ?? id,
  songIds,
  createdAt: patch.createdAt ?? 1,
  updatedAt: patch.updatedAt ?? 1,
});

beforeEach(() => {
  mockPlaylistId = 'playlist-1';
  mockMoveSongInPlaylistEnabled = true;
  mockDeletePlaylist.mockClear();
  mockRenamePlaylist.mockClear();
  mockAddSongToPlaylist.mockClear();
  mockRemoveSongFromPlaylist.mockClear();
  mockMoveSongInPlaylist.mockClear();
  mockGoBack.mockClear();
  mockPlayPlaylist.mockClear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockSongs = [
    song('song-a', { title: 'Alpha', artist: 'Artist A' }),
    song('song-b', { title: 'Beta', artist: 'Artist B' }),
    song('song-c', { title: 'Gamma', artist: 'Artist C' }),
  ];
  mockPlaylists = [playlist('playlist-1', ['song-b', 'song-a'], { name: 'Road Mix' })];
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders playlist name, valid song count, and contained songs in playlist order', () => {
  const { getByTestId, getByText } = render(<PlaylistDetail />);

  expect(getByTestId('playlist-detail-screen')).toBeTruthy();
  expect(getByText('Road Mix')).toBeTruthy();
  expect(getByText('2 Titel')).toBeTruthy();
  expect(getByTestId('playlist-detail-play-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-add-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-rename-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-delete-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-song-song-b')).toBeTruthy();
  expect(getByTestId('playlist-detail-song-song-a')).toBeTruthy();
  expect(getByTestId('playlist-detail-move-up-song-song-b')).toBeTruthy();
  expect(getByTestId('playlist-detail-move-down-song-song-b')).toBeTruthy();
  expect(getByTestId('playlist-detail-move-up-song-song-a')).toBeTruthy();
  expect(getByTestId('playlist-detail-move-down-song-song-a')).toBeTruthy();
  expect(getByTestId('playlist-detail-remove-song-song-b')).toBeTruthy();
  expect(getByTestId('playlist-detail-remove-song-song-a')).toBeTruthy();
  expect(getByText('Beta')).toBeTruthy();
  expect(getByText('Artist B')).toBeTruthy();
  expect(getByText('Alpha')).toBeTruthy();
  expect(getByText('Artist A')).toBeTruthy();
});

test('plays the playlist through the existing playlist playback action', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-play-button'));

  expect(mockPlayPlaylist).toHaveBeenCalledWith('playlist-1');
});

test('moves songs through the existing playlist move action', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-move-down-song-song-b'));
  fireEvent.press(getByTestId('playlist-detail-move-up-song-song-a'));

  expect(mockMoveSongInPlaylist).toHaveBeenNthCalledWith(1, 'playlist-1', 'song-b', 'down');
  expect(mockMoveSongInPlaylist).toHaveBeenNthCalledWith(2, 'playlist-1', 'song-a', 'up');
});

test('disables move controls at playlist boundaries', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  expect(getByTestId('playlist-detail-move-up-song-song-b').props.accessibilityState.disabled).toBe(true);
  expect(getByTestId('playlist-detail-move-down-song-song-b').props.accessibilityState.disabled).toBe(false);
  expect(getByTestId('playlist-detail-move-up-song-song-a').props.accessibilityState.disabled).toBe(false);
  expect(getByTestId('playlist-detail-move-down-song-song-a').props.accessibilityState.disabled).toBe(true);
  expect(mockMoveSongInPlaylist).not.toHaveBeenCalled();
});

test('disables move controls when the move action is unavailable', () => {
  mockMoveSongInPlaylistEnabled = false;

  const { getByTestId } = render(<PlaylistDetail />);

  expect(getByTestId('playlist-detail-move-up-song-song-b').props.accessibilityState.disabled).toBe(true);
  expect(getByTestId('playlist-detail-move-down-song-song-b').props.accessibilityState.disabled).toBe(true);
  expect(getByTestId('playlist-detail-move-up-song-song-a').props.accessibilityState.disabled).toBe(true);
  expect(getByTestId('playlist-detail-move-down-song-song-a').props.accessibilityState.disabled).toBe(true);
  expect(mockMoveSongInPlaylist).not.toHaveBeenCalled();
});

test('opens add panel with songs that are not already in the playlist', () => {
  const { getByTestId, queryByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-add-button'));

  expect(getByTestId('playlist-detail-add-panel')).toBeTruthy();
  expect(getByTestId('playlist-detail-add-candidate-song-c')).toBeTruthy();
  expect(getByTestId('playlist-detail-add-song-song-c')).toBeTruthy();
  expect(queryByTestId('playlist-detail-add-candidate-song-a')).toBeNull();
  expect(queryByTestId('playlist-detail-add-candidate-song-b')).toBeNull();
});

test('adds a song to the playlist through the existing playlist action', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-add-button'));
  fireEvent.press(getByTestId('playlist-detail-add-song-song-c'));

  expect(mockAddSongToPlaylist).toHaveBeenCalledWith('playlist-1', 'song-c');
});

test('filters the virtualized add list by title, artist, or album', () => {
  mockSongs.push(song('song-d', { title: 'Night Drive', artist: 'Kiwi', album: 'Autobahn' }));
  const { getByTestId, queryByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-add-button'));
  fireEvent.changeText(getByTestId('playlist-detail-add-search'), 'autobahn');

  expect(getByTestId('playlist-detail-add-candidate-song-d')).toBeTruthy();
  expect(queryByTestId('playlist-detail-add-candidate-song-c')).toBeNull();
});

test('shows add empty state when all songs are already in the playlist', () => {
  mockPlaylists = [playlist('playlist-1', ['song-a', 'song-b', 'song-c'], { name: 'Full Mix' })];

  const { getByTestId, getByText, queryByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-add-button'));

  expect(getByText('Alle verfügbaren Titel sind bereits in dieser Playlist.')).toBeTruthy();
  expect(getByTestId('playlist-detail-add-empty')).toBeTruthy();
  expect(queryByTestId('playlist-detail-add-song-song-c')).toBeNull();
});

test('opens rename input with the current playlist name', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-rename-button'));

  expect(getByTestId('playlist-detail-rename-input').props.value).toBe('Road Mix');
  expect(getByTestId('playlist-detail-rename-save').props.accessibilityState.disabled).toBe(true);
});

test('renames the playlist with a trimmed name', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-rename-button'));
  fireEvent.changeText(getByTestId('playlist-detail-rename-input'), '  Night Drive  ');
  fireEvent.press(getByTestId('playlist-detail-rename-save'));

  expect(mockRenamePlaylist).toHaveBeenCalledWith('playlist-1', 'Night Drive');
});

test('does not rename to an empty name', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-rename-button'));
  fireEvent.changeText(getByTestId('playlist-detail-rename-input'), '   ');
  fireEvent.press(getByTestId('playlist-detail-rename-save'));

  expect(mockRenamePlaylist).not.toHaveBeenCalled();
});

test('cancels rename without saving changes', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-rename-button'));
  fireEvent.changeText(getByTestId('playlist-detail-rename-input'), 'New Name');
  fireEvent.press(getByTestId('playlist-detail-rename-cancel'));

  expect(mockRenamePlaylist).not.toHaveBeenCalled();
});

test('asks for confirmation before removing a song from the playlist', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-remove-song-song-b'));

  expect(Alert.alert).toHaveBeenCalledWith(
    'Titel entfernen',
    '„Beta“ aus „Road Mix“ entfernen?',
    expect.arrayContaining([
      expect.objectContaining({ text: 'Abbrechen', style: 'cancel' }),
      expect.objectContaining({ text: 'Entfernen', style: 'destructive' }),
    ]),
  );
  expect(mockRemoveSongFromPlaylist).not.toHaveBeenCalled();
});

test('removes a song from the playlist after confirmation', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-remove-song-song-b'));
  const removeAction = jest.mocked(Alert.alert).mock.calls[0][2]?.find(action => action.text === 'Entfernen');
  removeAction?.onPress?.();

  expect(mockRemoveSongFromPlaylist).toHaveBeenCalledWith('playlist-1', 'song-b');
});

test('asks for confirmation before deleting the playlist', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-delete-button'));

  expect(Alert.alert).toHaveBeenCalledWith(
    'Playlist löschen',
    '„Road Mix“ wirklich löschen?',
    expect.arrayContaining([
      expect.objectContaining({ text: 'Abbrechen', style: 'cancel' }),
      expect.objectContaining({ text: 'Löschen', style: 'destructive' }),
    ]),
  );
  expect(mockDeletePlaylist).not.toHaveBeenCalled();
  expect(mockGoBack).not.toHaveBeenCalled();
});

test('deletes the playlist and navigates back after confirmation', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-delete-button'));
  const deleteAction = jest.mocked(Alert.alert).mock.calls[0][2]?.find(action => action.text === 'Löschen');
  deleteAction?.onPress?.();

  expect(mockDeletePlaylist).toHaveBeenCalledWith('playlist-1');
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});

test('shows empty state for an empty playlist and disables play action', () => {
  mockPlaylists = [playlist('playlist-1', [], { name: 'Empty Mix' })];

  const { getByTestId, getByText, queryByTestId } = render(<PlaylistDetail />);
  const playButton = getByTestId('playlist-detail-play-button');

  expect(getByText('Empty Mix')).toBeTruthy();
  expect(getByText('0 Titel')).toBeTruthy();
  expect(getByTestId('playlist-detail-empty')).toBeTruthy();
  expect(getByText('Diese Playlist ist noch leer.')).toBeTruthy();
  expect(playButton.props.accessibilityState.disabled).toBe(true);
  expect(getByTestId('playlist-detail-add-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-rename-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-delete-button')).toBeTruthy();
  expect(queryByTestId('playlist-detail-move-up-song-song-a')).toBeNull();
  expect(queryByTestId('playlist-detail-move-down-song-song-a')).toBeNull();
  expect(queryByTestId('playlist-detail-remove-song-song-a')).toBeNull();
  fireEvent.press(playButton);
  expect(mockPlayPlaylist).not.toHaveBeenCalled();
});

test('shows missing song warning without rendering missing songs', () => {
  mockPlaylists = [playlist('playlist-1', ['song-a', 'missing-song', 'song-c'], { name: 'Partial Mix' })];

  const { getByTestId, getByText, queryByTestId } = render(<PlaylistDetail />);

  expect(getByText('Partial Mix')).toBeTruthy();
  expect(getByText('2 Titel')).toBeTruthy();
  expect(getByText('1 nicht mehr gefunden')).toBeTruthy();
  expect(getByTestId('playlist-detail-play-button').props.accessibilityState.disabled).toBe(false);
  expect(getByTestId('playlist-detail-add-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-rename-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-delete-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-song-song-a')).toBeTruthy();
  expect(getByTestId('playlist-detail-song-song-c')).toBeTruthy();
  expect(getByTestId('playlist-detail-move-up-song-song-a')).toBeTruthy();
  expect(getByTestId('playlist-detail-move-down-song-song-c')).toBeTruthy();
  expect(getByTestId('playlist-detail-remove-song-song-a')).toBeTruthy();
  expect(getByTestId('playlist-detail-remove-song-song-c')).toBeTruthy();
  expect(queryByTestId('playlist-detail-song-missing-song')).toBeNull();
});

test('shows not found state for an unknown playlist id', () => {
  mockPlaylistId = 'unknown-playlist';

  const { getByTestId, getByText, queryByTestId } = render(<PlaylistDetail />);

  expect(getByTestId('playlist-detail-not-found')).toBeTruthy();
  expect(getByText('Playlist nicht gefunden')).toBeTruthy();
  expect(getByText('Diese Playlist existiert nicht mehr.')).toBeTruthy();
  expect(queryByTestId('playlist-detail-play-button')).toBeNull();
  expect(queryByTestId('playlist-detail-add-button')).toBeNull();
  expect(queryByTestId('playlist-detail-rename-button')).toBeNull();
  expect(queryByTestId('playlist-detail-delete-button')).toBeNull();
  expect(queryByTestId('playlist-detail-move-up-song-song-a')).toBeNull();
  expect(queryByTestId('playlist-detail-move-down-song-song-a')).toBeNull();
  expect(queryByTestId('playlist-detail-remove-song-song-a')).toBeNull();
});
