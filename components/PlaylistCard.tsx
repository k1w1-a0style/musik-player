import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ListMusic } from 'lucide-react-native';
import { theme } from '../theme';

interface Playlist {
  id: string;
  name: string;
  songs: string[];
}

interface Props {
  playlist: Playlist;
  onPress?: () => void;
}

const PlaylistCard: React.FC<Props> = ({ playlist, onPress }) => {
  return (
    <Pressable
      testID={`playlist-card-${playlist.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Playlist ${playlist.name}`}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.icon}>
        <ListMusic color={theme.palette.primary} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {playlist.name}
        </Text>
        <Text style={styles.meta}>{playlist.songs.length} Titel</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.surface,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.palette.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  name: {
    color: theme.palette.text.primary,
    fontSize: 15,
    fontFamily: theme.fonts.heading,
  },
  meta: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: theme.fonts.body,
  },
});

export default PlaylistCard;
