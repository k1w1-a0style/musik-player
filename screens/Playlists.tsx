import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { theme } from '../theme';

interface Playlist {
  id: string;
  name: string;
  songs: string[];
}

const Playlists: React.FC = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleCreatePlaylist = () => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) {
      Alert.alert('Fehler', 'Bitte gib einen Namen für die Playlist ein.');
      return;
    }
    setPlaylists(prev => [
      ...prev,
      { id: Date.now().toString(), name: trimmed, songs: [] },
    ]);
    setNewPlaylistName('');
  };

  const handleDeletePlaylist = (id: string) => {
    Alert.alert('Playlist löschen', 'Bist du sicher?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => setPlaylists(prev => prev.filter(p => p.id !== id)),
      },
    ]);
  };

  const renderPlaylist = ({ item }: { item: Playlist }) => (
    <View style={styles.playlistItem} testID={`playlist-item-${item.id}`}>
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistName}>{item.name}</Text>
        <Text style={styles.songCount}>{item.songs.length} Titel</Text>
      </View>
      <TouchableOpacity
        testID={`delete-playlist-${item.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Playlist ${item.name} löschen`}
        onPress={() => handleDeletePlaylist(item.id)}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteButtonText}>Löschen</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container} testID="playlists-screen">
      <Text style={styles.header}>Playlists</Text>
      <View style={styles.inputContainer}>
        <TextInput
          testID="new-playlist-input"
          style={styles.input}
          placeholder="Neue Playlist erstellen"
          placeholderTextColor={theme.palette.text.secondary}
          value={newPlaylistName}
          onChangeText={setNewPlaylistName}
          onSubmitEditing={handleCreatePlaylist}
          returnKeyType="done"
        />
        <TouchableOpacity
          testID="create-playlist-button"
          accessibilityRole="button"
          onPress={handleCreatePlaylist}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>Erstellen</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={playlists}
        renderItem={renderPlaylist}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Noch keine Playlists vorhanden.</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.md,
    backgroundColor: theme.palette.background,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: theme.spacing.lg,
    color: theme.palette.text.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: theme.palette.card,
    color: theme.palette.text.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  addButton: {
    backgroundColor: theme.palette.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  addButtonText: { color: theme.palette.text.onPrimary, fontWeight: '700' },
  playlistItem: {
    backgroundColor: theme.palette.card,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.palette.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playlistInfo: { flex: 1 },
  playlistName: { fontSize: 16, color: theme.palette.text.primary, fontWeight: '700' },
  songCount: { fontSize: 12, color: theme.palette.text.secondary, marginTop: 2 },
  deleteButton: {
    backgroundColor: theme.palette.error,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  deleteButtonText: { color: '#FFFFFF', fontWeight: '700' },
  emptyText: {
    textAlign: 'center',
    marginTop: theme.spacing.lg,
    color: theme.palette.text.secondary,
  },
});

export default Playlists;
