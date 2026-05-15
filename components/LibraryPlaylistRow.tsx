import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ListMusic, Play } from 'lucide-react-native';
import { theme } from '../theme';
import type { LibraryPlaylistItem } from '../utils/libraryPlaylists';

interface LibraryPlaylistRowProps {
  playlist: LibraryPlaylistItem;
  onPlay: (playlistId: string) => void | Promise<void>;
}

const LibraryPlaylistRow: React.FC<LibraryPlaylistRowProps> = ({ playlist, onPlay }) => {
  const disabled = playlist.validCount === 0;

  return (
    <View style={styles.playlistRow} testID={`library-playlist-${playlist.id}`}>
      <View style={styles.groupIcon}>
        <ListMusic color={theme.palette.primary} size={20} />
      </View>
      <View style={styles.groupTextWrap}>
        <Text style={styles.groupTitle} numberOfLines={1}>{playlist.name}</Text>
        <Text style={styles.groupSubtitle}>{playlist.validCount} {playlist.validCount === 1 ? 'Track' : 'Tracks'}</Text>
        {playlist.validCount !== playlist.totalCount && <Text style={styles.playlistWarning}>{playlist.totalCount - playlist.validCount} nicht mehr gefunden</Text>}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Playlist ${playlist.name} abspielen`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => void onPlay(playlist.id)}
        style={({ pressed }) => [styles.roundButton, pressed && styles.pressed, disabled && styles.disabled]}
        testID={`play-playlist-${playlist.id}`}
      >
        <Play color={playlist.validCount > 0 ? theme.palette.text.primary : theme.palette.text.muted} size={17} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  playlistRow: { height: 66, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.palette.border },
  groupIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  groupTextWrap: { flex: 1, minWidth: 0 },
  groupTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 15 },
  groupSubtitle: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 2 },
  playlistWarning: { color: theme.palette.error, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 2 },
  roundButton: { width: 36, height: 36, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});

export default LibraryPlaylistRow;
