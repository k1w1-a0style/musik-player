import React from 'react';

const mockAppTheme = {
  palette: {
    primary: '#7C3AED',
    surfaceElevated: '#191B21',
    border: 'rgba(255, 255, 255, 0.08)',
    text: { primary: '#F4F5F7', secondary: '#CCCCCC', muted: '#888888' },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({ theme: mockAppTheme, appearance: 'dark' }),
}));

import { fireEvent, render } from '@testing-library/react-native';
import SongPlaylistPickerModal from '../SongPlaylistPickerModal';
import type { Playlist, Song } from '../../types/Song';

const song: Song = { id: 'song-1', title: 'Track', artist: 'Artist' };
const playlists: Playlist[] = [
  { id: 'playlist-1', name: 'Roadtrip', songIds: [], createdAt: 1, updatedAt: 1 },
  { id: 'playlist-2', name: 'Favorites', songIds: ['song-1'], createdAt: 1, updatedAt: 1 },
];
const onTogglePlaylist = jest.fn();

const renderPicker = (items = playlists) => render(
  <SongPlaylistPickerModal
    visible
    song={song}
    playlists={items}
    onClose={jest.fn()}
    onTogglePlaylist={onTogglePlaylist}
  />,
);

describe('SongPlaylistPickerModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders playlists and membership state', () => {
    const screen = renderPicker();

    expect(screen.getByText('Roadtrip')).toBeTruthy();
    expect(screen.getByText('Favorites')).toBeTruthy();
    expect(screen.getByTestId('song-playlist-picker-status-playlist-1').props.children).toBe('Hinzufügen');
    expect(screen.getByTestId('song-playlist-picker-status-playlist-2').props.children).toBe('Enthalten');
  });

  it('toggles add for a playlist without the song', () => {
    const screen = renderPicker();

    fireEvent.press(screen.getByTestId('song-playlist-picker-item-playlist-1'));

    expect(onTogglePlaylist).toHaveBeenCalledWith('playlist-1', false);
  });

  it('toggles remove for a playlist with the song', () => {
    const screen = renderPicker();

    fireEvent.press(screen.getByTestId('song-playlist-picker-item-playlist-2'));

    expect(onTogglePlaylist).toHaveBeenCalledWith('playlist-2', true);
  });

  it('renders empty playlist state', () => {
    const screen = renderPicker([]);

    expect(screen.getByText('Keine Playlists vorhanden.')).toBeTruthy();
  });
});
