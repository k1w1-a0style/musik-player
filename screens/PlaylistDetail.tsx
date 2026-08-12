import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Edit3, Plus, Trash2, Play } from 'lucide-react-native';
import { NativeViewGestureHandler } from 'react-native-gesture-handler';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import type { AppStackParamList } from '../types/navigation';
import type { Song } from '../types/Song';
import { useReorderableSongListDrag } from '../hooks/useNowPlayingQueueDrag';
import { getQueuePreviewOffset } from '../utils/soundCloudPlayer';
import PlaylistAddSongsModal from './PlaylistAddSongsModal';
import PlaylistDetailSongRow, { PLAYLIST_DETAIL_ROW_HEIGHT } from './PlaylistDetailSongRow';

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
  const listRef = useRef<FlatList<Song>>(null);
  const scrollOffsetRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const headerHeightRef = useRef(0);
  const rowStartOffsetRef = useRef(0);

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
  const canMoveSongs = typeof moveSongInPlaylist === 'function';
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

  const { dragPreview, dragScrollCompensation,
    handleDragPosition, handleDragEnd } = useReorderableSongListDrag({
    queueLength: playlistSongs.length,
    currentIndex: -1,
    listRef,
    scrollOffsetRef,
    viewportHeightRef,
    rowHeight: PLAYLIST_DETAIL_ROW_HEIGHT,
    minimumReorderIndex: 0,
    contentHeightOffsetRef: headerHeightRef,
    rowStartOffsetRef,
  });
  const getScrollOffset = useCallback(() => scrollOffsetRef.current, []);
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
  }, []);
  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (!playlist || !moveSongInPlaylist || fromIndex === toIndex) return;
    const sourceSong = playlistSongs[fromIndex];
    const targetSong = playlistSongs[toIndex];
    if (!sourceSong || !targetSong) return;
    moveSongInPlaylist(playlist.id, sourceSong.id, { targetSongId: targetSong.id });
  }, [moveSongInPlaylist, playlist, playlistSongs]);

  const confirmRemoveSong = useCallback((song: Song) => {
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
  }, [playlist, removeSongFromPlaylist]);

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

  const renderSong: ListRenderItem<Song> = useCallback(({ item, index }) => (
    <PlaylistDetailSongRow song={item} index={index} songCount={playlistSongs.length}
      canReorder={canMoveSongs} getScrollOffset={getScrollOffset}
      onDragPosition={handleDragPosition} onDragEnd={handleDragEnd}
      previewOffsetY={dragPreview ? getQueuePreviewOffset({
        index,
        dragIndex: dragPreview.index,
        targetIndex: dragPreview.targetIndex,
        rowHeight: PLAYLIST_DETAIL_ROW_HEIGHT,
      }) : 0}
      dragScrollCompensation={dragPreview?.index === index ? dragScrollCompensation : undefined}
      onReorder={handleReorder} onRemove={confirmRemoveSong} />
  ), [canMoveSongs, confirmRemoveSong, dragPreview, getScrollOffset, handleDragEnd,
    handleDragPosition, handleReorder, dragScrollCompensation, playlistSongs.length]);

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
      <NativeViewGestureHandler disallowInterruption>
      <FlatList
        ref={listRef}
        testID="playlist-detail-list"
        data={playlistSongs}
        keyExtractor={item => item.id}
        renderItem={renderSong}
        onLayout={event => { viewportHeightRef.current = event.nativeEvent.layout.height; }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        removeClippedSubviews={false}
        initialNumToRender={12} maxToRenderPerBatch={10} updateCellsBatchingPeriod={70} windowSize={7}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View style={styles.header} onLayout={event => {
            rowStartOffsetRef.current = event.nativeEvent.layout.height
              + APP_THEME_TOKENS.spacing.lg + APP_THEME_TOKENS.spacing.md;
            headerHeightRef.current = rowStartOffsetRef.current + 96;
          }}>
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
      </NativeViewGestureHandler>
      <PlaylistAddSongsModal visible={addOpen} playlistName={playlist.name} songs={addableSongs}
        onAddSong={handleAddSong} onClose={() => setAddOpen(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: APP_THEME_TOKENS.spacing.lg,
    gap: APP_THEME_TOKENS.spacing.sm,
  },
  content: {
    padding: APP_THEME_TOKENS.spacing.md,
    paddingBottom: 96,
  },
  header: {
    gap: APP_THEME_TOKENS.spacing.xs,
    marginBottom: APP_THEME_TOKENS.spacing.lg,
  },
  title: {
    fontFamily: APP_THEME_TOKENS.fonts.heading,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: APP_THEME_TOKENS.fonts.body,
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: APP_THEME_TOKENS.spacing.sm,
    marginTop: APP_THEME_TOKENS.spacing.sm,
  },
  playButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_THEME_TOKENS.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: APP_THEME_TOKENS.borderRadius.pill,
    paddingHorizontal: APP_THEME_TOKENS.spacing.md,
  },
  addButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_THEME_TOKENS.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: APP_THEME_TOKENS.borderRadius.pill,
    paddingHorizontal: APP_THEME_TOKENS.spacing.md,
  },
  renameButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_THEME_TOKENS.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: APP_THEME_TOKENS.borderRadius.pill,
    paddingHorizontal: APP_THEME_TOKENS.spacing.md,
  },
  deleteButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_THEME_TOKENS.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: APP_THEME_TOKENS.borderRadius.pill,
    paddingHorizontal: APP_THEME_TOKENS.spacing.md,
  },
  playButtonText: {
    fontFamily: APP_THEME_TOKENS.fonts.heading,
    fontSize: 14,
  },
  addButtonText: {
    fontFamily: APP_THEME_TOKENS.fonts.heading,
    fontSize: 14,
  },
  renameButtonText: {
    fontFamily: APP_THEME_TOKENS.fonts.heading,
    fontSize: 14,
  },
  deleteButtonText: {
    fontFamily: APP_THEME_TOKENS.fonts.heading,
    fontSize: 14,
  },
  renamePanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: APP_THEME_TOKENS.radii.card,
    gap: APP_THEME_TOKENS.spacing.sm,
    marginTop: APP_THEME_TOKENS.spacing.sm,
    padding: APP_THEME_TOKENS.spacing.md,
  },
  renameInput: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: APP_THEME_TOKENS.radii.card,
    paddingHorizontal: APP_THEME_TOKENS.spacing.md,
    fontFamily: APP_THEME_TOKENS.fonts.body,
    fontSize: 16,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: APP_THEME_TOKENS.spacing.sm,
  },
  renameActionButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: APP_THEME_TOKENS.borderRadius.pill,
    paddingHorizontal: APP_THEME_TOKENS.spacing.md,
  },
  renameActionText: {
    fontFamily: APP_THEME_TOKENS.fonts.heading,
    fontSize: 14,
  },
  warning: {
    fontFamily: APP_THEME_TOKENS.fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    fontFamily: APP_THEME_TOKENS.fonts.body,
    fontSize: 14,
    marginTop: APP_THEME_TOKENS.spacing.xl,
    textAlign: 'center',
  },
});

export default PlaylistDetail;
