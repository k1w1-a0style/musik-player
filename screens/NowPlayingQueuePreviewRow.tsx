import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface NowPlayingQueuePreviewRowProps {
  id: string;
  title: string;
  artist: string;
  isCurrent: boolean;
  onPress: (songId: string) => void;
}

const NowPlayingQueuePreviewRow = React.memo(({
  id,
  title,
  artist,
  isCurrent,
  onPress,
}: NowPlayingQueuePreviewRowProps) => {
  const handlePress = React.useCallback(() => onPress(id), [id, onPress]);

  return (
    <Pressable style={[styles.queueItem, isCurrent && styles.queueItemActive]} onPress={handlePress}>
      <View style={[styles.queueAccent, isCurrent && styles.queueAccentActive]} />
      <View style={styles.queueTextWrap}>
        <Text style={[styles.queueTitle, isCurrent && styles.queueTitleActive]} numberOfLines={1}>{title}</Text>
        <Text style={styles.queueArtist} numberOfLines={1}>{artist}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  queueItem: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: theme.borderRadius.sm, paddingHorizontal: 8 },
  queueItemActive: { backgroundColor: theme.palette.primaryGlow },
  queueAccent: { width: 3, height: 20, borderRadius: 3, backgroundColor: theme.palette.border },
  queueAccentActive: { backgroundColor: theme.palette.primary },
  queueTextWrap: { flex: 1 },
  queueTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 12 },
  queueTitleActive: { color: theme.palette.primary },
  queueArtist: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 1 },
});

export default NowPlayingQueuePreviewRow;
