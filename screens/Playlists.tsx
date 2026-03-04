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
    if (newPlaylistName.trim() === '') {
      Alert.alert('Fehler', 'Bitte gib einen Namen für die Playlist ein.');
      return;
    }
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: newPlaylistName.trim(),
      songs: [],
    };
    setPlaylists([...playlists, newPlaylist]);
    setNewPlaylistName('');
  };

  const handleDeletePlaylist = (id: string) => {
    Alert.alert(
      'Playlist löschen',
      'Bist du sicher, dass du diese Playlist löschen möchtest?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            setPlaylists(playlists.filter((p) => p.id !== id));
          },
        },
      ]
    );
  };

  const renderPlaylist = ({ item }: { item: Playlist }) => (
    <View style={styles.playlistItem}>
      <Text style={styles.playlistName}>{item.name}</Text>
      <Text style={styles.songCount}>{item.songs.length} Titel</Text>
      <TouchableOpacity onPress={() => handleDeletePlaylist(item.id)} style={styles.deleteButton}>
        <Text style={styles.deleteButtonText}>Löschen</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Meine Playlists</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Neue Playlist erstellen"
          value={newPlaylistName}
          onChangeText={setNewPlaylistName}
        />
        <TouchableOpacity onPress={handleCreatePlaylist} style={styles.addButton}>
          <Text style={styles.addButtonText}>Erstellen</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={playlists}
        renderItem={renderPlaylist}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>Noch keine Playlists vorhanden.</Text>}
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: theme.spacing.lg,
    color: theme.palette.text.primary,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: theme.palette.card,
    color: theme.palette.text.primary,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  addButton: {
    backgroundColor: theme.palette.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  addButtonText: {
    color: theme.palette.text.primary,
    fontWeight: 'bold',
  },
  playlistItem: {
    backgroundColor: theme.palette.card,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playlistName: {
    fontSize: 18,
    color: theme.palette.text.primary,
    flex: 1,
  },
  songCount: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    marginRight: theme.spacing.md,
  },
  deleteButton: {
    backgroundColor: theme.palette.error,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: theme.spacing.lg,
    color: theme.palette.text.secondary,
  },
});

export default Playlists;
