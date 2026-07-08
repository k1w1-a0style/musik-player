import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import PlaylistDetail from '../PlaylistDetail';
import type { Playlist, Song } from '../../types/Song';

let mockPlaylistId = 'playlist-1';
let mockSongs: Song[] = [];
let mockPlaylists: Playlist[] = [];
const mockGoBack = jest.fn();
const mockDeletePlaylist = jest.fn();
const mockRenamePlaylist = jest.fn();
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
    playPlaylist: mockPlayPlaylist,
    songs: mockSongs,
  }),
}));

jest.mock('lucide-react-native', () => ({
  Edit3: 'Edit3',
  Play: 'Play',
  Trash2: 'Trash2',
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
  mockDeletePlaylist.mockClear();
  mockRenamePlaylist.mockClear();
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
  expect(getByTestId('playlist-detail-rename-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-delete-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-song-song-b')).toBeTruthy();
  expect(getByTestId('playlist-detail-song-song-a')).toBeTruthy();
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

test('opens rename modal with the current playlist name', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-rename-button'));

  expect(getByTestId('playlist-detail-rename-modal')).toBeTruthy();
  expect(getByTestId('playlist-detail-rename-input').props.value).toBe('Road Mix');
  expect(getByTestId('playlist-detail-rename-save').props.accessibilityState.disabled).toBe(true);
});

test('renames the playlist with a trimmed name', () => {
  const { getByTestId, queryByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-rename-button'));
  fireEvent.changeText(getByTestId('playlist-detail-rename-input'), '  Night Drive  ');
  fireEvent.press(getByTestId('playlist-detail-rename-save'));

  expect(mockRenamePlaylist).toHaveBeenCalledWith('playlist-1', 'Night Drive');
  expect(queryByTestId('playlist-detail-rename-modal')).toBeNull();
});

test('does not rename to an empty name', () => {
  const { getByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-rename-button'));
  fireEvent.changeText(getByTestId('playlist-detail-rename-input'), '   ');
  const saveButton = getByTestId('playlist-detail-rename-save');

  expect(saveButton.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(saveButton);
  expect(mockRenamePlaylist).not.toHaveBeenCalled();
});

test('cancels rename without saving changes', () => {
  const { getByTestId, queryByTestId } = render(<PlaylistDetail />);

  fireEvent.press(getByTestId('playlist-detail-rename-button'));
  fireEvent.changeText(getByTestId('playlist-detail-rename-input'), 'New Name');
  fireEvent.press(getByTestId('playlist-detail-rename-cancel'));

  expect(mockRenamePlaylist).not.toHaveBeenCalled();
  expect(queryByTestId('playlist-detail-rename-modal')).toBeNull();
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

  const { getByTestId, getByText } = render(<PlaylistDetail />);
  const playButton = getByTestId('playlist-detail-play-button');

  expect(getByText('Empty Mix')).toBeTruthy();
  expect(getByText('0 Titel')).toBeTruthy();
  expect(getByTestId('playlist-detail-empty')).toBeTruthy();
  expect(getByText('Diese Playlist ist noch leer.')).toBeTruthy();
  expect(playButton.props.accessibilityState.disabled).toBe(true);
  expect(getByTestId('playlist-detail-rename-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-delete-button')).toBeTruthy();
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
  expect(getByTestId('playlist-detail-rename-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-delete-button')).toBeTruthy();
  expect(getByTestId('playlist-detail-song-song-a')).toBeTruthy();
  expect(getByTestId('playlist-detail-song-song-c')).toBeTruthy();
  expect(queryByTestId('playlist-detail-song-missing-song')).toBeNull();
});

test('shows not found state for an unknown playlist id', () => {
  mockPlaylistId = 'unknown-playlist';

  const { getByTestId, getByText, queryByTestId } = render(<PlaylistDetail />);

  expect(getByTestId('playlist-detail-not-found')).toBeTruthy();
  expect(getByText('Playlist nicht gefunden')).toBeTruthy();
  expect(getByText('Diese Playlist existiert nicht mehr.')).toBeTruthy();
  expect(queryByTestId('playlist-detail-play-button')).toBeNull();
  expect(queryByTestId('playlist-detail-rename-button')).toBeNull();
  expect(queryByTestId('playlist-detail-delete-button')).toBeNull();
});
