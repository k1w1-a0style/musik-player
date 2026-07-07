import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ListMusic, Play } from 'lucide-react-native';
import { theme as staticTheme } from '../theme';
import { useAppTheme } from '../contexts/AppThemeContext';
import type { LibraryPlaylistItem } from '../utils/libraryPlaylists';

interface LibraryPlaylistRowProps {
  playlist: LibraryPlaylistItem;
  onOpen: (playlistId: string) => void;
  onPlay: (playlistId: string) => void | Promise<void>;
}

const LibraryPlaylistRow: React.FC<LibraryPlaylistRowProps> = ({ playlist, onOpen, onPlay }) => {
  const { theme } = useAppTheme();
  const disabled = playlist.validCount === 0;

  return (
    <View
      style={[styles.playlistRow, { borderBottomColor: theme.palette.border }]}
      testID={`library-playlist-${playlist.id}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Playlist ${playlist.name}`}
        onPress={() => onOpen(playlist.id)}
        style={({ pressed }) => [styles.openArea, pressed && styles.pressed]}
        testID={`open-playlist-${playlist.id}`}
      >
        <View
          style={[
            styles.groupIcon,
            {
              backgroundColor: theme.palette.surfaceGlass,
              borderColor: theme.palette.border,
            },
          ]}
          testID={`library-playlist-icon-${playlist.id}`}
        >
          <ListMusic color={theme.palette.primary} size={20} />
        </View>
        <View style={styles.groupTextWrap}>
          <Text style={[styles.groupTitle, { color: theme.palette.text.primary }]} numberOfLines={1}>
            {playlist.name}
          </Text>
          <Text style={[styles.groupSubtitle, { color: theme.palette.text.secondary }]}>{playlist.validCount} Titel</Text>
          {playlist.validCount !== playlist.totalCount && (
            <Text style={[styles.playlistWarning, { color: theme.palette.error }]}>
              {playlist.totalCount - playlist.validCount} nicht mehr gefunden
            </Text>
          )}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Playlist ${playlist.name} abspielen`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => void onPlay(playlist.id)}
        style={({ pressed }) => [
          styles.roundButton,
          {
            backgroundColor: theme.palette.surfaceGlass,
            borderColor: theme.palette.border,
          },
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
        testID={`play-playlist-${playlist.id}`}
      >
        <Play color={playlist.validCount > 0 ? theme.palette.text.primary : theme.palette.text.muted} size={17} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  playlistRow: {
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  openArea: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  groupTextWrap: { flex: 1, minWidth: 0 },
  groupTitle: { fontFamily: staticTheme.fonts.heading, fontSize: 15 },
  groupSubtitle: { fontFamily: staticTheme.fonts.body, fontSize: 12, marginTop: 2 },
  playlistWarning: { fontFamily: staticTheme.fonts.body, fontSize: 11, marginTop: 2 },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});

export default LibraryPlaylistRow;
