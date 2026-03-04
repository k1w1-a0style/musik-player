import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Button,
  Alert,
} from 'react-native';
import { theme } from '../theme';
import type { Song } from '../src/types/Song';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types'; // Annahme: Sie haben diese Datei erstellt

// Mock data for playlists - replace with actual data fetching
const mockPlaylists = [
  { id: '1', name: 'Favorites', songs: [] },
  { id: '2', name: 'Work Music', songs: [] },
];

type PlaylistsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Playlists'>;

const Playlists: React.FC = () => {
  const [playlists, setPlaylists] = useState(mockPlaylists);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const navigation = useNavigation<PlaylistsScreenNavigationProp>();

  useEffect(() => {
    // Fetch playlists from storage or API here
  }, []);

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim() === '') {
      Alert.alert('Fehler', 'Bitte geben Sie einen Namen für die Playlist ein.');
      return;
    }
    const newPlaylist = {
      id: Date.now().toString(),
      name: newPlaylistName,
      songs: [],
    };
    setPlaylists([...playlists, newPlaylist]);
    setNewPlaylistName('');
    setIsModalVisible(false);
  };

  const handleDeletePlaylist = (id: string) => {
    Alert.alert(
      'Playlist löschen',
      'Sind Sie sicher, dass Sie diese Playlist löschen möchten?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            setPlaylists(playlists.filter(playlist => playlist.id !== id));
          },
        },
      ]
    );
  };

  const renderPlaylistItem = ({ item }: { item: { id: string; name: string; songs: Song[] } }) => (
    <TouchableOpacity
      style={styles.playlistItem}
      onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
    >
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistName}>{item.name}</Text>
        <Text style={styles.songCount}>{item.songs.length} Titel</Text>
      </View>
      <TouchableOpacity onPress={() => handleDeletePlaylist(item.id)} style={styles.deleteButton}>
        <Text style={styles.deleteButtonText}>X</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={playlists}
        renderItem={renderPlaylistItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>Keine Playlists gefunden.</Text>}
      />
      <TouchableOpacity style={styles.createButton} onPress={() => setIsModalVisible(true)}>
        <Text style={styles.createButtonText}>Neue Playlist erstellen</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Neue Playlist</Text>
            <TextInput
              style={styles.input}
              placeholder="Name der Playlist"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
            />
            <View style={styles.modalButtons}>
              <Button title="Abbrechen" onPress={() => setIsModalVisible(false)} color="red" />
              <Button title="Erstellen" onPress={handleCreatePlaylist} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
    padding: theme.spacing.md,
  },
  playlistItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.md,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
  },
  songCount: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    marginTop: theme.spacing.xs,
  },
  deleteButton: {
    padding: theme.spacing.sm,
  },
  deleteButtonText: {
    color: theme.palette.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: theme.palette.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  createButtonText: {
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 16,
    color: theme.palette.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: theme.palette.card,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
    color: theme.palette.text.primary,
  },
  input: {
    backgroundColor: theme.palette.background,
    color: theme.palette.text.primary,
    width: '100%',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: theme.spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: theme.spacing.md,
  },
});

export default Playlists;
