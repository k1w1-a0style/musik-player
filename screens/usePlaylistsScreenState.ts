import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { Playlist } from '../types/Song';
import { useMusicContext } from '../contexts/MusicContext';
import { countValidPlaylistSongs, normalizePlaylistName } from './playlistHelpers';

interface PlaylistListEntry {
  playlist: Playlist;
  validSongCount: number;
}

export const usePlaylistsScreenState = () => {
  const { playlists, createPlaylist, deletePlaylist, playPlaylist, songs } = useMusicContext();
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const playlistEntries = useMemo<PlaylistListEntry[]>(
    () => playlists.map(playlist => ({
      playlist,
      validSongCount: countValidPlaylistSongs(playlist, songs),
    })),
    [playlists, songs],
  );

  const handleCreatePlaylist = (): void => {
    const trimmed = normalizePlaylistName(newPlaylistName);
    if (!trimmed) {
      Alert.alert('Fehler', 'Bitte gib einen Namen für die Playlist ein.');
      return;
    }

    createPlaylist(trimmed);
    setNewPlaylistName('');
  };

  const handleDeletePlaylist = (id: string, name: string): void => {
    Alert.alert(`Playlist „${name}" löschen?`, 'Die Playlist wird unwiderruflich entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => deletePlaylist(id),
      },
    ]);
  };

  return {
    newPlaylistName,
    setNewPlaylistName,
    playlistEntries,
    handleCreatePlaylist,
    handleDeletePlaylist,
    playPlaylist,
  };
};
