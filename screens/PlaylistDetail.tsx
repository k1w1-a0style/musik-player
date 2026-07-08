import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { Edit3, Trash2, Play } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import { theme as staticTheme } from '../theme';
import type { AppStackParamList } from '../types/navigation';
import type { Song } from '../types/Song';

type PlaylistDetailRoute = RouteProp<AppStackParamList, 'PlaylistDetail'>;
type PlaylistDetailNavigation = NativeStackNavigationProp<AppStackParamList, 'PlaylistDetail'>;

const playlistTrackLabel = (count: number): string => `${count} Titel`;

const PlaylistDetail: React.FC = () => {
  const route = useRoute<PlaylistDetailRoute>();
  const navigation = useNavigation<PlaylistDetailNavigation>();
  const { theme } = useAppTheme();
  const { playlists, deletePlaylist, renamePlaylist, playPlaylist, songs } = useLibraryMusicContext();
  const playlistId = route.params.playlistId;
  const [renameOpen, setRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState('');

  const playlist = useMemo(
    () => playlists.find(item => item.id === playlistId),
    [playlistId, playlists],
  );

  useEffect(() => {
    if (!renameOpen && playlist) setDraftName(playlist.name);
  }, [playlist, renameOpen]);

  const playlistSongs = useMemo(() => {
    if (!playlist) return [];
    const songsById = new Map(songs.map(song => [song.id, song]));
    return playlist.songIds.flatMap(songId => {
      const song = songsById.get(songId);
      return song ? [song] : [];
    });
  }, [playlist, songs]);

  const missingSongs = playlist ? Math.max(playlist.songIds.length - playlistSongs.length, 0) : 0;
  const playDisabled = playlistSongs.length === 0;
  const trimmedDraftName = draftName.trim();
  const renameDisabled = !playlist || trimmedDraftName.length === 0 || trimmedDraftName === playlist.name;

  const openRename = () => {
    if (!playlist) return;
    setDraftName(playlist.name);
    setRenameOpen(true);
  };

  const closeRename = () => {
    setRenameOpen(false);
    if (playlist) setDraftName(playlist.name);
  };

  const submitRename = () => {
    if (!playlist || renameDisabled) return;
    renamePlaylist(playlist.id, trimmedDraftName);
    setRenameOpen(false);
  };

  const confirmDeletePlaylist = () => {
    if (!playlist) return;
    Alert.alert(
      'Playlist löschen',
      `„${playlist.name}“ wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            deletePlaylist(playlist.id);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const renderSong: ListRenderItem<Song> = ({ item, index }) => (
    <View
      style={[styles.songRow, { borderBottomColor: theme.palette.border }]}
      testID={`playlist-detail-song-${item.id}`}
    >
      <Text style={[styles.songIndex, { color: theme.palette.text.muted }]}>{index + 1}</Text>
      <View style={styles.songTextWrap}>
        <Text style={[styles.songTitle, { color: theme.palette.text.primary }]} numberOfLines={1}>
          {item.title || 'Unbekannter Titel'}
        </Text>
        <Text style={[styles.songSubtitle, { color: theme.palette.text.secondary }]} numberOfLines={1}>
          {item.artist || 'Unbekannter Künstler'}
        </Text>
      </View>
    </View>
  );

  if (!playlist) {
    return (
      <View
        style={[styles.root, styles.centered, { backgroundColor: theme.palette.background }]}
        testID="playlist-detail-not-found"
      >
        <Text style={[styles.title, { color: theme.palette.text.primary }]}>Playlist nicht gefunden</Text>
        <Text style={[styles.subtitle, { color: theme.palette.text.secondary }]}>Diese Playlist existiert nicht mehr.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.palette.background }]} testID="playlist-detail-screen">
      <FlatList
        data={playlistSongs}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={renderSong}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.palette.text.primary }]} numberOfLines={2}>
              {playlist.name}
            </Text>
            <Text style={[styles.subtitle, { color: theme.palette.text.secondary }]}>{playlistTrackLabel(playlistSongs.length)}</Text>
            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Playlist ${playlist.name} abspielen`}
                accessibilityState={{ disabled: playDisabled }}
                disabled={playDisabled}
                onPress={() => void playPlaylist(playlist.id)}
                style={[
                  styles.playButton,
                  {
                    backgroundColor: theme.palette.primary,
                    borderColor: theme.palette.primaryDark,
                  },
                ]}
                testID="playlist-detail-play-button"
              >
                <Play color={theme.palette.text.onPrimary} size={18} />
                <Text style={[styles.playButtonText, { color: theme.palette.text.onPrimary }]}>Abspielen</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Playlist ${playlist.name} umbenennen`}
                onPress={openRename}
                style={[
                  styles.renameButton,
                  {
                    backgroundColor: theme.palette.surface,
                    borderColor: theme.palette.border,
                  },
                ]}
                testID="playlist-detail-rename-button"
              >
                <Edit3 color={theme.palette.text.primary} size={17} />
                <Text style={[styles.renameButtonText, { color: theme.palette.text.primary }]}>Umbenennen</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Playlist ${playlist.name} löschen`}
                onPress={confirmDeletePlaylist}
                style={[
                  styles.deleteButton,
                  {
                    backgroundColor: theme.palette.surface,
                    borderColor: theme.palette.error,
                  },
                ]}
                testID="playlist-detail-delete-button"
              >
                <Trash2 color={theme.palette.error} size={17} />
                <Text style={[styles.deleteButtonText, { color: theme.palette.error }]}>Löschen</Text>
              </Pressable>
            </View>
            {missingSongs > 0 && (
              <Text style={[styles.warning, { color: theme.palette.error }]}>{missingSongs} nicht mehr gefunden</Text>
            )}
          </View>
        )}
        ListEmptyComponent={(
          <Text style={[styles.empty, { color: theme.palette.text.muted }]} testID="playlist-detail-empty">
            Diese Playlist ist noch leer.
          </Text>
        )}
      />

      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={closeRename}>
        <View style={styles.modalBackdrop} testID="playlist-detail-rename-modal">
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.palette.surfaceElevated,
                borderColor: theme.palette.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.palette.text.primary }]}>Playlist umbenennen</Text>
            <TextInput
              accessibilityLabel="Neuer Playlist-Name"
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Playlist-Name"
              placeholderTextColor={theme.palette.text.muted}
              selectionColor={theme.palette.primary}
              style={[
                styles.renameInput,
                {
                  backgroundColor: theme.palette.surface,
                  borderColor: theme.palette.borderStrong,
                  color: theme.palette.text.primary,
                },
              ]}
              testID="playlist-detail-rename-input"
            />
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Umbenennen abbrechen"
                onPress={closeRename}
                style={[
                  styles.modalButton,
                  { borderColor: theme.palette.border, backgroundColor: theme.palette.surface },
                ]}
                testID="playlist-detail-rename-cancel"
              >
                <Text style={[styles.modalButtonText, { color: theme.palette.text.secondary }]}>Abbrechen</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Playlist speichern"
                accessibilityState={{ disabled: renameDisabled }}
                disabled={renameDisabled}
                onPress={submitRename}
                style={[
                  styles.modalButton,
                  { borderColor: theme.palette.primaryDark, backgroundColor: theme.palette.primary },
                ]}
                testID="playlist-detail-rename-save"
              >
                <Text style={[styles.modalButtonText, { color: theme.palette.text.onPrimary }]}>Speichern</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: staticTheme.spacing.lg,
    gap: staticTheme.spacing.sm,
  },
  content: {
    padding: staticTheme.spacing.md,
    paddingBottom: 96,
  },
  header: {
    gap: staticTheme.spacing.xs,
    marginBottom: staticTheme.spacing.lg,
  },
  title: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: staticTheme.fonts.body,
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: staticTheme.spacing.sm,
    marginTop: staticTheme.spacing.sm,
  },
  playButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: staticTheme.spacing.md,
  },
  renameButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: staticTheme.spacing.md,
  },
  deleteButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: staticTheme.spacing.md,
  },
  playButtonText: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 14,
  },
  renameButtonText: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 14,
  },
  deleteButtonText: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 14,
  },
  warning: {
    fontFamily: staticTheme.fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    fontFamily: staticTheme.fonts.body,
    fontSize: 14,
    marginTop: staticTheme.spacing.xl,
    textAlign: 'center',
  },
  songRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  songIndex: {
    width: 24,
    textAlign: 'right',
    fontFamily: staticTheme.fonts.body,
    fontSize: 12,
  },
  songTextWrap: { flex: 1, minWidth: 0 },
  songTitle: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 15,
  },
  songSubtitle: {
    fontFamily: staticTheme.fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: staticTheme.spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: staticTheme.radii.elevatedCard,
    padding: staticTheme.spacing.md,
    gap: staticTheme.spacing.md,
  },
  modalTitle: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 18,
  },
  renameInput: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: staticTheme.radii.card,
    paddingHorizontal: staticTheme.spacing.md,
    fontFamily: staticTheme.fonts.body,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: staticTheme.spacing.sm,
  },
  modalButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: staticTheme.spacing.md,
  },
  modalButtonText: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 14,
  },
});

export default PlaylistDetail;
