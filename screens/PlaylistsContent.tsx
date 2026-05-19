import React from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import type { Playlist } from '../types/Song';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { theme } from '../theme';
import PlaylistCreateForm from './PlaylistCreateForm';
import PlaylistListItem from './PlaylistListItem';

interface PlaylistEntry {
  playlist: Playlist;
  validSongCount: number;
}

interface PlaylistsContentProps {
  newPlaylistName: string;
  onChangePlaylistName: (value: string) => void;
  onCreatePlaylist: () => void;
  playlistEntries: PlaylistEntry[];
  onPlayPlaylist: (id: string) => void;
  onDeletePlaylist: (id: string, name: string) => void;
}

const PlaylistsContent: React.FC<PlaylistsContentProps> = ({
  newPlaylistName,
  onChangePlaylistName,
  onCreatePlaylist,
  playlistEntries,
  onPlayPlaylist,
  onDeletePlaylist,
}) => (
  <AppBackground>
    <Screen style={styles.container} testID="playlists-screen" contentStyle={styles.content}>
      <Text style={styles.eyebrow}>SAMMLUNGEN</Text>
      <Text style={styles.header}>Playlists</Text>

      <PlaylistCreateForm
        value={newPlaylistName}
        onChangeText={onChangePlaylistName}
        onSubmit={onCreatePlaylist}
      />

      <FlatList
        data={playlistEntries}
        keyExtractor={item => item.playlist.id}
        contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
        renderItem={({ item }) => (
          <PlaylistListItem
            playlist={item.playlist}
            validSongCount={item.validSongCount}
            onPlay={onPlayPlaylist}
            onDelete={onDeletePlaylist}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText} testID="playlists-empty">
            Noch keine Playlists. Lege oben deine erste an.
          </Text>
        }
      />
    </Screen>
  </AppBackground>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: theme.spacing.md, paddingTop: 8 },
  eyebrow: {
    color: theme.palette.primary,
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: theme.fonts.body,
  },
  header: {
    fontSize: 32,
    fontFamily: theme.fonts.display,
    letterSpacing: -1.0,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: theme.spacing.xxl,
    color: theme.palette.text.secondary,
    fontFamily: theme.fonts.body,
  },
});

export default PlaylistsContent;
