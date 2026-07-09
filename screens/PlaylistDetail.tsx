import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { Edit3, Plus, Trash2, Play } from 'lucide-react-native';
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
  const {
    playlists,
    deletePlaylist,
    renamePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    moveSongInPlaylist,
    playPlaylist,
    songs,
  } = useLibraryMusicContext();
  const playlistId = route.params.playlistId;
  const [renameOpen, setRenameOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draftName, setDraftName] = useState('');

  const playlist = useMemo(
    () => playlists.find(item => item.id === playlistId),
    [playlistId, playlists],
  );

  useEffect(() => {
    if (!renameOpen && playlist) setDraftName(playlist.name);
  }, [playlist, renameOpen]);

  const playlistSongIds = useMemo(() => new Set(playlist?.songIds ?? []), [playlist]);

  const playlistSongs = useMemo(() => {
    if (!playlist) return [];
    const songsById = new Map(songs.map(song => [song.id, song]));
    return playlist.songIds.flatMap(songId => {
      const song = songsById.get(songId);
      return song ? [song] : [];
    });
  }, [playlist, songs]);

  const addableSongs = useMemo(
    () => (playlist ? songs.filter(song => !playlistSongIds.has(song.id)) : []),
    [playlist, playlistSongIds, songs],
  );

  const missingSongs = playlist ? Math.max(playlist.songIds.length - playlistSongs.length, 0) : 0;
  const playDisabled = playlistSongs.length === 0;
  const trimmedDraftName = draftName.trim();
  const renameDisabled = !playlist || trimmedDraftName.length === 0 || trimmedDraftName === playlist.name;

  const openRename = () => {
    if (!playlist) return;
    setAddOpen(false);
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

  const toggleAddPanel = () => {
    setRenameOpen(false);
    setAddOpen(open => !open);
  };

  const handleAddSong = (songId: string) => {
    if (!playlist) return;
    addSongToPlaylist(playlist.id, songId);
  };

  const handleMoveSong = (songId: string, direction: 'up' | 'down') => {
    if (!playlist) return;
    moveSongInPlaylist(playlist.id, songId, direction);
  };

  const confirmRemoveSong = (song: Song) => {
    if (!playlist) return;
    Alert.alert(
      'Titel entfernen',
      `„${song.title || 'Unbekannter Titel'}“ aus „${playlist.name}“ entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: () => removeSongFromPlaylist(playlist.id, song.id),
        },
      ],
    );
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

  const renderSong: ListRenderItem<Song> = ({ item, index }) => {
    const isFirstSong = index === 0;
    const isLastSong = index === playlistSongs.length - 1;

    return (
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
        <View style={styles.moveSongActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.title || 'Unbekannter Titel'} nach oben verschieben`}
            accessibilityState={{ disabled: isFirstSong }}
            disabled={isFirstSong}
            onPress={() => handleMoveSong(item.id, 'up')}
            style={[
              styles.moveSongButton,
              {
                backgroundColor: theme.palette.surface,
                borderColor: theme.palette.border,
              },
            ]}
            testID={`playlist-detail-move-up-song-${item.id}`}
          >
            <Text style={[styles.moveSongText, { color: theme.palette.text.secondary }]}>Hoch</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.title || 'Unbekannter Titel'} nach unten verschieben`}
            accessibilityState={{ disabled: isLastSong }}
            disabled={isLastSong}
            onPress={() => handleMoveSong(item.id, 'down')}
            style={[
              styles.moveSongButton,
              {
                backgroundColor: theme.palette.surface,
                borderColor: theme.palette.border,
              },
            ]}
            testID={`playlist-detail-move-down-song-${item.id}`}
          >
            <Text style={[styles.moveSongText, { color: theme.palette.text.secondary }]}>Runter</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.title || 'Unbekannter Titel'} aus Playlist entfernen`}
          onPress={() => confirmRemoveSong(item)}
          style={[
            styles.removeSongButton,
            {
              backgroundColor: theme.palette.surface,
              borderColor: theme.palette.error,
            },
          ]}
          testID={`playlist-detail-remove-song-${item.id}`}
        >
          <Text style={[styles.removeSongText, { color: theme.palette.error }]}>Entfernen</Text>
        </Pressable>
      </View>
    );
  };

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
                accessibilityLabel={`Titel zu ${playlist.name} hinzufügen`}
                onPress={toggleAddPanel}
                style={[
                  styles.addButton,
                  {
                    backgroundColor: theme.palette.surface,
                    borderColor: theme.palette.border,
                  },
                ]}
                testID="playlist-detail-add-button"
              >
                <Plus color={theme.palette.text.primary} size={17} />
                <Text style={[styles.addButtonText, { color: theme.palette.text.primary }]}>Titel hinzufügen</Text>
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
            {addOpen && (
              <View
                style={[
                  styles.addPanel,
                  {
                    backgroundColor: theme.palette.surfaceElevated,
                    borderColor: theme.palette.border,
                  },
                ]}
                testID="playlist-detail-add-panel"
              >
                <Text style={[styles.panelTitle, { color: theme.palette.text.primary }]}>Titel hinzufügen</Text>
                {addableSongs.length === 0 ? (
                  <Text style={[styles.panelEmpty, { color: theme.palette.text.muted }]} testID="playlist-detail-add-empty">
                    Alle verfügbaren Titel sind bereits in dieser Playlist.
                  </Text>
                ) : (
                  addableSongs.map(song => (
                    <View
                      key={song.id}
                      style={[styles.addSongRow, { borderTopColor: theme.palette.border }]}
                      testID={`playlist-detail-add-candidate-${song.id}`}
                    >
                      <View style={styles.addSongTextWrap}>
                        <Text style={[styles.songTitle, { color: theme.palette.text.primary }]} numberOfLines={1}>
                          {song.title || 'Unbekannter Titel'}
                        </Text>
                        <Text style={[styles.songSubtitle, { color: theme.palette.text.secondary }]} numberOfLines={1}>
                          {song.artist || 'Unbekannter Künstler'}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${song.title || 'Unbekannter Titel'} zur Playlist hinzufügen`}
                        onPress={() => handleAddSong(song.id)}
                        style={[
                          styles.addSongButton,
                          { borderColor: theme.palette.primaryDark, backgroundColor: theme.palette.primary },
                        ]}
                        testID={`playlist-detail-add-song-${song.id}`}
                      >
                        <Text style={[styles.addSongButtonText, { color: theme.palette.text.onPrimary }]}>Hinzufügen</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}
            {renameOpen && (
              <View
                style={[
                  styles.renamePanel,
                  {
                    backgroundColor: theme.palette.surfaceElevated,
                    borderColor: theme.palette.border,
                  },
                ]}
                testID="playlist-detail-rename-panel"
              >
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
                <View style={styles.renameActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Umbenennen abbrechen"
                    onPress={closeRename}
                    style={[
                      styles.renameActionButton,
                      { borderColor: theme.palette.border, backgroundColor: theme.palette.surface },
                    ]}
                    testID="playlist-detail-rename-cancel"
                  >
                    <Text style={[styles.renameActionText, { color: theme.palette.text.secondary }]}>Abbrechen</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Playlist speichern"
                    accessibilityState={{ disabled: renameDisabled }}
                    disabled={renameDisabled}
                    onPress={submitRename}
                    style={[
                      styles.renameActionButton,
                      { borderColor: theme.palette.primaryDark, backgroundColor: theme.palette.primary },
                    ]}
                    testID="playlist-detail-rename-save"
                  >
                    <Text style={[styles.renameActionText, { color: theme.palette.text.onPrimary }]}>Speichern</Text>
                  </Pressable>
                </View>
              </View>
            )}
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
  addButton: {
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
  addButtonText: {
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
  addPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: staticTheme.radii.card,
    gap: staticTheme.spacing.sm,
    marginTop: staticTheme.spacing.sm,
    padding: staticTheme.spacing.md,
  },
  panelTitle: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 16,
  },
  panelEmpty: {
    fontFamily: staticTheme.fonts.body,
    fontSize: 13,
  },
  addSongRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: staticTheme.spacing.sm,
  },
  addSongTextWrap: { flex: 1, minWidth: 0 },
  addSongButton: {
    minHeight: 34,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: staticTheme.spacing.sm,
  },
  addSongButtonText: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 12,
  },
  renamePanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: staticTheme.radii.card,
    gap: staticTheme.spacing.sm,
    marginTop: staticTheme.spacing.sm,
    padding: staticTheme.spacing.md,
  },
  renameInput: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: staticTheme.radii.card,
    paddingHorizontal: staticTheme.spacing.md,
    fontFamily: staticTheme.fonts.body,
    fontSize: 16,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: staticTheme.spacing.sm,
  },
  renameActionButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: staticTheme.spacing.md,
  },
  renameActionText: {
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
  moveSongActions: {
    flexDirection: 'row',
    gap: staticTheme.spacing.xs,
  },
  moveSongButton: {
    minHeight: 34,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: staticTheme.spacing.sm,
  },
  moveSongText: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 12,
  },
  removeSongButton: {
    minHeight: 34,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: staticTheme.spacing.sm,
  },
  removeSongText: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 12,
  },
});

export default PlaylistDetail;
