import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import PlaylistDetail from '../PlaylistDetail';
import type { Playlist, Song } from '../../types/Song';

let mockPlaylistId = 'playlist-1';
let mockSongs: Song[] = [];
let mockPlaylists: Playlist[] = [];
const mockPlayPlaylist = jest.fn(async () => undefined);

const mockAppTheme = {
  palette: {
    background: '#08090B',
    border: 'rgba(255, 255, 255, 0.08)',
    error: '#FF6F8A',
    primary: '#D8DEE8',
    primaryDark: '#87909E',
    text: {
      primary: '#F4F5F7',
      secondary: 'rgba(244, 245, 247, 0.70)',
      muted: 'rgba(244, 245, 247, 0.42)',
      onPrimary: '#07090C',
    },
  },
};

jest.mock('@react-navigation/native', () => ({
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
    playPlaylist: mockPlayPlaylist,
    songs: mockSongs,
  }),
}));

jest.mock('lucide-react-native', () => ({
  Play: 'Play',
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
  mockPlayPlaylist.mockClear();
  mockSongs = [
    song('song-a', { title: 'Alpha', artist: 'Artist A' }),
    song('song-b', { title: 'Beta', artist: 'Artist B' }),
    song('song-c', { title: 'Gamma', artist: 'Artist C' }),
  ];
  mockPlaylists = [playlist('playlist-1', ['song-b', 'song-a'], { name: 'Road Mix' })];
});

test('renders playlist name, valid song count, and contained songs in playlist order', () => {
  const { getByTestId, getByText } = render(<PlaylistDetail />);

  expect(getByTestId('playlist-detail-screen')).toBeTruthy();
  expect(getByText('Road Mix')).toBeTruthy();
  expect(getByText('2 Titel')).toBeTruthy();
  expect(getByTestId('playlist-detail-play-button')).toBeTruthy();
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

test('shows empty state for an empty playlist and disables play action', () => {
  mockPlaylists = [playlist('playlist-1', [], { name: 'Empty Mix' })];

  const { getByTestId, getByText } = render(<PlaylistDetail />);
  const playButton = getByTestId('playlist-detail-play-button');

  expect(getByText('Empty Mix')).toBeTruthy();
  expect(getByText('0 Titel')).toBeTruthy();
  expect(getByTestId('playlist-detail-empty')).toBeTruthy();
  expect(getByText('Diese Playlist ist noch leer.')).toBeTruthy();
  expect(playButton.props.accessibilityState.disabled).toBe(true);
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
});
