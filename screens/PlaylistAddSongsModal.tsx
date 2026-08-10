import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View,
  type ListRenderItem } from 'react-native';
import { Plus, Search, X } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import type { Song } from '../types/Song';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { getPlaylistModalBackdropColor } from '../utils/appThemeOverlays';
import { displayArtist, displayTitle } from '../utils/libraryPresentation';

interface PlaylistAddSongsModalProps {
  visible: boolean;
  playlistName: string;
  songs: Song[];
  onAddSong: (songId: string) => void;
  onClose: () => void;
}

const normalizeSearchText = (value: string): string => value.trim().toLocaleLowerCase('de-DE');

export const filterPlaylistAddSongs = (songs: Song[], query: string): Song[] => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return songs;
  return songs.filter(song => [displayTitle(song), displayArtist(song), song.album ?? '']
    .some(value => normalizeSearchText(value).includes(normalizedQuery)));
};

const PlaylistAddSongsModal = ({ visible, playlistName, songs,
  onAddSong, onClose }: PlaylistAddSongsModalProps) => {
  const { appearance, theme } = useAppTheme();
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);
  const filteredSongs = useMemo(() => filterPlaylistAddSongs(songs, query), [query, songs]);
  const renderSong = useCallback<ListRenderItem<Song>>(({ item }) => (
    <View style={[styles.songRow, { borderBottomColor: theme.palette.border }]}
      testID={`playlist-detail-add-candidate-${item.id}`}>
      <View style={styles.songTextWrap}>
        <Text style={[styles.songTitle, { color: theme.palette.text.primary }]} numberOfLines={1}>
          {displayTitle(item)}
        </Text>
        <Text style={[styles.songSubtitle, { color: theme.palette.text.secondary }]} numberOfLines={1}>
          {displayArtist(item)}
        </Text>
      </View>
      <Pressable accessibilityRole="button"
        accessibilityLabel={`${displayTitle(item)} zur Playlist hinzufügen`}
        onPress={() => onAddSong(item.id)} style={({ pressed }) => [styles.addButton,
          { backgroundColor: theme.palette.primary, borderColor: theme.palette.primaryDark },
          pressed && styles.pressed]} testID={`playlist-detail-add-song-${item.id}`}>
        <Plus color={theme.palette.text.onPrimary} size={18} />
        <Text style={[styles.addButtonText, { color: theme.palette.text.onPrimary }]}>Hinzufügen</Text>
      </Pressable>
    </View>
  ), [onAddSong, theme.palette]);
  const emptyMessage = songs.length === 0
    ? 'Alle verfügbaren Titel sind bereits in dieser Playlist.'
    : 'Keine passenden Titel gefunden.';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}
      statusBarTranslucent testID="playlist-detail-add-modal">
      <View style={[styles.backdrop, { backgroundColor: getPlaylistModalBackdropColor(appearance) }]}>
        <View style={[styles.panel, { backgroundColor: theme.palette.background,
          borderColor: theme.palette.borderStrong }]} testID="playlist-detail-add-panel">
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.eyebrow, { color: theme.palette.primary }]}>PLAYLIST</Text>
              <Text style={[styles.title, { color: theme.palette.text.primary }]} numberOfLines={1}>
                Titel zu „{playlistName}“ hinzufügen
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Titelauswahl schließen"
              onPress={onClose} style={styles.closeButton} testID="playlist-detail-add-close">
              <X color={theme.palette.text.primary} size={23} />
            </Pressable>
          </View>
          <View style={[styles.search, { backgroundColor: theme.palette.surface,
            borderColor: theme.palette.border }]}>
            <Search color={theme.palette.text.secondary} size={18} />
            <TextInput value={query} onChangeText={setQuery} autoFocus
              accessibilityLabel="Verfügbare Titel durchsuchen" placeholder="Titel, Künstler oder Album"
              placeholderTextColor={theme.palette.text.muted} selectionColor={theme.palette.primary}
              style={[styles.searchInput, { color: theme.palette.text.primary }]}
              testID="playlist-detail-add-search" />
            {query ? <Pressable accessibilityRole="button" accessibilityLabel="Suche löschen"
              onPress={() => setQuery('')} style={styles.clearButton} testID="playlist-detail-add-search-clear">
              <X color={theme.palette.text.secondary} size={18} />
            </Pressable> : null}
          </View>
          <FlatList data={filteredSongs} keyExtractor={song => song.id} renderItem={renderSong}
            keyboardShouldPersistTaps="handled" initialNumToRender={12} maxToRenderPerBatch={10}
            windowSize={7} contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={[styles.empty, { color: theme.palette.text.muted }]}
              testID="playlist-detail-add-empty">{emptyMessage}</Text>}
            testID="playlist-detail-add-list" />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  panel: { height: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  header: { minHeight: 74, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: APP_THEME_TOKENS.spacing.md, gap: APP_THEME_TOKENS.spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 9, letterSpacing: 1.4 },
  title: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 19, marginTop: 2 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  search: { minHeight: 48, flexDirection: 'row', alignItems: 'center', marginHorizontal: 14,
    marginBottom: 8, paddingLeft: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 9, paddingHorizontal: 8,
    fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 14 },
  clearButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 14, paddingBottom: 40, flexGrow: 1 },
  songRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth },
  songTextWrap: { flex: 1, minWidth: 0 },
  songTitle: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 14 },
  songSubtitle: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 12, marginTop: 2 },
  addButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, borderRadius: APP_THEME_TOKENS.borderRadius.pill,
    borderWidth: StyleSheet.hairlineWidth },
  addButtonText: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 12 },
  empty: { marginTop: 48, paddingHorizontal: 20, textAlign: 'center',
    fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 14 },
  pressed: { opacity: 0.68 },
});

export default React.memo(PlaylistAddSongsModal);
