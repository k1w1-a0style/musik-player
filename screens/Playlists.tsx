import React from 'react';
import { Text, StyleSheet, FlatList } from 'react-native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { theme } from '../theme';
import PlaylistCreateForm from './PlaylistCreateForm';
import PlaylistListItem from './PlaylistListItem';
import { usePlaylistsScreenState } from './usePlaylistsScreenState';

const Playlists: React.FC = () => {
  const {
    newPlaylistName,
    setNewPlaylistName,
    playlistEntries,
    handleCreatePlaylist,
    handleDeletePlaylist,
    playPlaylist,
  } = usePlaylistsScreenState();

  return (
    <AppBackground>
      <Screen style={styles.container} testID="playlists-screen" contentStyle={styles.content}>
        <Text style={styles.eyebrow}>SAMMLUNGEN</Text>
        <Text style={styles.header}>Playlists</Text>

        <PlaylistCreateForm
          value={newPlaylistName}
          onChangeText={setNewPlaylistName}
          onSubmit={handleCreatePlaylist}
        />

        <FlatList
          data={playlistEntries}
          keyExtractor={item => item.playlist.id}
          contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
          renderItem={({ item }) => (
            <PlaylistListItem
              playlist={item.playlist}
              validSongCount={item.validSongCount}
              onPlay={playPlaylist}
              onDelete={handleDeletePlaylist}
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
};

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

export default Playlists;
