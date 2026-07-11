import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
            <View style={[styles.emptyCard, { backgroundColor: theme.palette.surfaceElevated, borderColor: theme.palette.border }]} testID="playlists-empty">
              <Text style={[styles.emptyTitle, { color: theme.palette.text.primary }]}>Noch keine Playlists</Text>
              <Text style={[styles.emptyText, { color: theme.palette.text.secondary }]}>Erstelle hier deine erste Sammlung.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Neue Playlist erstellen"
                testID="playlists-empty-create-button"
                onPress={onCreatePlaylist}
                style={[styles.emptyButton, { backgroundColor: theme.palette.primary }]}
              >
                <Text style={[styles.emptyButtonText, { color: theme.palette.text.onPrimary }]}>Neue Playlist erstellen</Text>
              </Pressable>
            </View>
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
  emptyCard: {
    alignItems: 'center',
    borderRadius: staticTokens.radii.card,
    borderWidth: 1,
    gap: 10,
    marginTop: staticTokens.spacing.xxl,
    padding: staticTokens.spacing.lg,
  },
  emptyTitle: {
    fontFamily: staticTokens.fonts.heading,
    fontSize: 18,
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: staticTokens.fonts.body,
  },
  emptyButton: {
    borderRadius: 999,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyButtonText: {
    fontFamily: staticTokens.fonts.heading,
    fontSize: 14,
  },
});

export default PlaylistsContent;
