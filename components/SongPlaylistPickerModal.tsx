import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import type { Playlist, Song } from '../types/Song';
import { theme as staticTheme } from '../theme';
import { getLibraryMenuBackdropColor } from '../utils/appThemeOverlays';

interface SongPlaylistPickerModalProps {
  visible: boolean;
  song: Song | null;
  playlists: Playlist[];
  onClose: () => void;
  onTogglePlaylist: (playlistId: string, containsSong: boolean) => void;
}

const SongPlaylistPickerModal: React.FC<SongPlaylistPickerModalProps> = ({
  visible,
  song,
  playlists,
  onClose,
  onTogglePlaylist,
}) => {
  const { appearance, theme } = useAppTheme();
  const songId = song?.id;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: getLibraryMenuBackdropColor(appearance) }]}
        onPress={onClose}
        accessible={false}
        testID="song-playlist-picker-backdrop"
      >
        <View
          style={[styles.card, { backgroundColor: theme.palette.surfaceElevated, borderColor: theme.palette.border }]}
          testID="song-playlist-picker-card"
        >
          <Text style={[styles.title, { color: theme.palette.text.primary }]}>Playlist auswählen</Text>
          {playlists.length === 0 ? (
            <Text style={[styles.empty, { color: theme.palette.text.muted }]}>Keine Playlists vorhanden.</Text>
          ) : playlists.map(playlist => {
            const containsSong = !!songId && playlist.songIds.includes(songId);
            return (
              <Pressable
                key={playlist.id}
                accessibilityRole="button"
                accessibilityLabel={`${containsSong ? 'Aus Playlist entfernen' : 'Zu Playlist hinzufügen'}: ${playlist.name}`}
                testID={`song-playlist-picker-item-${playlist.id}`}
                onPress={() => onTogglePlaylist(playlist.id, containsSong)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={[styles.name, { color: theme.palette.text.primary }]} numberOfLines={1}>{playlist.name}</Text>
                <Text
                  style={[styles.status, { color: containsSong ? theme.palette.primary : theme.palette.text.muted }]}
                  testID={`song-playlist-picker-status-${playlist.id}`}
                >
                  {containsSong ? 'Enthalten' : 'Hinzufügen'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: { borderRadius: 22, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16 },
  title: { fontFamily: staticTheme.fonts.heading, fontSize: 17, marginBottom: 8 },
  empty: { fontFamily: staticTheme.fonts.body, fontSize: 14, paddingVertical: 12 },
  row: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pressed: { opacity: 0.72 },
  name: { flex: 1, fontFamily: staticTheme.fonts.body, fontSize: 15 },
  status: { fontFamily: staticTheme.fonts.body, fontSize: 12 },
});

export default SongPlaylistPickerModal;
