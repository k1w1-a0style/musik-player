import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ListMusic, Play, Trash2 } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import type { Playlist } from '../types/Song';
import { APP_THEME_TOKENS } from '../utils/appTheme';
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
}) => {
  const { theme } = useAppTheme();
  const canPlay = validSongCount > 0;
  const playColor = canPlay ? theme.palette.primary : theme.palette.text.muted;

  return (
    <View
      style={[
        styles.playlistItem,
        {
          backgroundColor: theme.palette.surface,
          borderColor: theme.palette.border,
        },
      ]}
      testID={`playlist-item-${playlist.id}`}
    >
      <View style={[styles.playlistIcon, { backgroundColor: theme.palette.primaryGlow }]}>
        <ListMusic color={theme.palette.primary} size={22} />
      </View>
      <View style={styles.playlistInfo}>
        <Text style={[styles.playlistName, { color: theme.palette.text.primary }]} numberOfLines={1}>
          {playlist.name}
        </Text>
        <Text style={[styles.songCount, { color: theme.palette.text.secondary }]}>
          {formatPlaylistSongCount(validSongCount)}
        </Text>
      </View>
      <Pressable
        testID={`play-playlist-${playlist.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Playlist ${playlist.name} abspielen`}
        onPress={() => onPlay(playlist.id)}
        disabled={!canPlay}
        style={({ pressed }) => [
          styles.iconButton,
          {
            backgroundColor: theme.palette.surfaceElevated,
            borderColor: theme.palette.border,
          },
          !canPlay && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Play
          color={playColor}
          size={18}
          fill={canPlay ? theme.palette.primary : 'transparent'}
        />
      </Pressable>
      <Pressable
        testID={`delete-playlist-${playlist.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Playlist ${playlist.name} löschen`}
        onPress={() => onDelete(playlist.id, playlist.name)}
        style={({ pressed }) => [
          styles.iconButton,
          {
            backgroundColor: theme.palette.surfaceElevated,
            borderColor: theme.palette.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <Trash2 color={theme.palette.error} size={18} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: APP_THEME_TOKENS.spacing.md,
    borderRadius: APP_THEME_TOKENS.borderRadius.md,
    marginBottom: APP_THEME_TOKENS.spacing.sm,
    borderWidth: 1,
    gap: APP_THEME_TOKENS.spacing.md,
  },
  playlistIcon: {
    width: 44,
    height: 44,
    borderRadius: APP_THEME_TOKENS.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistInfo: { flex: 1 },
  playlistName: {
    fontSize: 15,
    fontFamily: APP_THEME_TOKENS.fonts.heading,
    letterSpacing: -0.2,
  },
  songCount: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: APP_THEME_TOKENS.fonts.body,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: APP_THEME_TOKENS.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});

export default PlaylistListItem;
