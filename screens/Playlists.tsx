import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { ListMusic, Play, Plus, Trash2 } from 'lucide-react-native';
import { useMusicContext } from '../contexts/MusicContext';
import AppBackground from '../components/AppBackground';
import { theme } from '../theme';

const Playlists: React.FC = () => {
  const { playlists, createPlaylist, deletePlaylist, playPlaylist, songs } =
    useMusicContext();
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleCreatePlaylist = (): void => {
    const trimmed = newPlaylistName.trim();
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

  return (
    <AppBackground>
      <View style={styles.container} testID="playlists-screen">
        <Text style={styles.eyebrow}>SAMMLUNGEN</Text>
        <Text style={styles.header}>Playlists</Text>

        <View style={styles.inputContainer}>
          <TextInput
            testID="new-playlist-input"
            style={styles.input}
            placeholder="Neue Playlist erstellen…"
            placeholderTextColor={theme.palette.text.muted}
            value={newPlaylistName}
            onChangeText={setNewPlaylistName}
            onSubmitEditing={handleCreatePlaylist}
            returnKeyType="done"
            accessibilityLabel="Name der neuen Playlist"
          />
          <Pressable
            testID="create-playlist-button"
            accessibilityRole="button"
            accessibilityLabel="Playlist erstellen"
            onPress={handleCreatePlaylist}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Plus color={theme.palette.text.onPrimary} size={18} />
          </Pressable>
        </View>

        <FlatList
          data={playlists}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
          renderItem={({ item }) => {
            const valid = item.songIds.filter(id => songs.find(s => s.id === id)).length;
            return (
              <View style={styles.playlistItem} testID={`playlist-item-${item.id}`}>
                <View style={styles.playlistIcon}>
                  <ListMusic color={theme.palette.primary} size={22} />
                </View>
                <View style={styles.playlistInfo}>
                  <Text style={styles.playlistName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.songCount}>
                    {valid} {valid === 1 ? 'Titel' : 'Titel'}
                  </Text>
                </View>
                <Pressable
                  testID={`play-playlist-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Playlist ${item.name} abspielen`}
                  onPress={() => playPlaylist(item.id)}
                  disabled={valid === 0}
                  style={({ pressed }) => [
                    styles.iconButton,
                    valid === 0 && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Play
                    color={valid > 0 ? theme.palette.primary : theme.palette.text.muted}
                    size={18}
                    fill={valid > 0 ? theme.palette.primary : 'transparent'}
                  />
                </Pressable>
                <Pressable
                  testID={`delete-playlist-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Playlist ${item.name} löschen`}
                  onPress={() => handleDeletePlaylist(item.id, item.name)}
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                >
                  <Trash2 color={theme.palette.error} size={18} />
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText} testID="playlists-empty">
              Noch keine Playlists. Lege oben deine erste an.
            </Text>
          }
        />
      </View>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
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
  inputContainer: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: theme.palette.surface,
    color: theme.palette.text.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.palette.border,
    fontFamily: theme.fonts.body,
  },
  addButton: {
    backgroundColor: theme.palette.primary,
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.palette.border,
    gap: theme.spacing.md,
  },
  playlistIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.palette.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistInfo: { flex: 1 },
  playlistName: {
    fontSize: 15,
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.heading,
    letterSpacing: -0.2,
  },
  songCount: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 2,
    fontFamily: theme.fonts.body,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: theme.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  disabled: { opacity: 0.4 },
  emptyText: {
    textAlign: 'center',
    marginTop: theme.spacing.xxl,
    color: theme.palette.text.secondary,
    fontFamily: theme.fonts.body,
  },
});

export default Playlists;
