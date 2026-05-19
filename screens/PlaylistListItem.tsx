import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ListMusic, Play, Trash2 } from 'lucide-react-native';
import type { Playlist } from '../types/Song';
import { theme } from '../theme';
import { formatPlaylistSongCount } from './playlistHelpers';

interface PlaylistListItemProps {
  playlist: Playlist;
  validSongCount: number;
  onPlay: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}

const PlaylistListItem: React.FC<PlaylistListItemProps> = ({
  playlist,
  validSongCount,
  onPlay,
  onDelete,
}) => (
  <View style={styles.playlistItem} testID={`playlist-item-${playlist.id}`}>
    <View style={styles.playlistIcon}>
      <ListMusic color={theme.palette.primary} size={22} />
    </View>
    <View style={styles.playlistInfo}>
      <Text style={styles.playlistName} numberOfLines={1}>
        {playlist.name}
      </Text>
      <Text style={styles.songCount}>{formatPlaylistSongCount(validSongCount)}</Text>
    </View>
    <Pressable
      testID={`play-playlist-${playlist.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Playlist ${playlist.name} abspielen`}
      onPress={() => onPlay(playlist.id)}
      disabled={validSongCount === 0}
      style={({ pressed }) => [
        styles.iconButton,
        validSongCount === 0 && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Play
        color={validSongCount > 0 ? theme.palette.primary : theme.palette.text.muted}
        size={18}
        fill={validSongCount > 0 ? theme.palette.primary : 'transparent'}
      />
    </Pressable>
    <Pressable
      testID={`delete-playlist-${playlist.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Playlist ${playlist.name} löschen`}
      onPress={() => onDelete(playlist.id, playlist.name)}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Trash2 color={theme.palette.error} size={18} />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
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
  pressed: { opacity: 0.7 },
});

export default PlaylistListItem;
