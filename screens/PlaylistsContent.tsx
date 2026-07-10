import React from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { useAppTheme } from '../contexts/AppThemeContext';
import type { Playlist } from '../types/Song';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
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
}) => {
  const { theme } = useAppTheme();

  return (
    <AppBackground>
      <Screen style={styles.container} testID="playlists-screen" contentStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: theme.palette.primary }]}>SAMMLUNGEN</Text>
        <Text style={[styles.header, { color: theme.palette.text.primary }]}>Playlists</Text>

        <PlaylistCreateForm
          value={newPlaylistName}
          onChangeText={onChangePlaylistName}
          onSubmit={onCreatePlaylist}
        />

        <FlatList
          data={playlistEntries}
          keyExtractor={item => item.playlist.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <PlaylistListItem
              playlist={item.playlist}
              validSongCount={item.validSongCount}
              onPlay={onPlayPlaylist}
              onDelete={onDeletePlaylist}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.palette.text.secondary }]} testID="playlists-empty">
              Noch keine Playlists. Lege oben deine erste an.
            </Text>
          }
        />
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: staticTokens.spacing.md, paddingTop: 8 },
  listContent: { paddingBottom: staticTokens.spacing.xxl },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: staticTokens.fonts.body,
  },
  header: {
    fontSize: 32,
    fontFamily: staticTokens.fonts.display,
    letterSpacing: -1.0,
    marginBottom: staticTokens.spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: staticTokens.spacing.xxl,
    fontFamily: staticTokens.fonts.body,
  },
});

export default PlaylistsContent;
