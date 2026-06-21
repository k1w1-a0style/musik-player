import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react-native';
import { theme } from '../theme';

interface NowPlayingQueuePreviewRowProps {
  id: string;
  index?: number;
  title: string;
  artist: string;
  isCurrent: boolean;
  canShift?: boolean;
  canShiftUp?: boolean;
  canShiftDown?: boolean;
  onPress: (songId: string) => void;
  onShift?: (fromIndex: number, toIndex: number) => void;
}

const NowPlayingQueuePreviewRow = React.memo(({
  id,
  index = 0,
  title,
  artist,
  isCurrent,
  canShift = false,
  canShiftUp = false,
  canShiftDown = false,
  onPress,
  onShift,
}: NowPlayingQueuePreviewRowProps) => {
  const [shiftMode, setShiftMode] = React.useState(false);
  const handlePress = React.useCallback(() => onPress(id), [id, onPress]);
  const handleLongPress = React.useCallback(() => {
    if (canShift) setShiftMode(value => !value);
  }, [canShift]);
  const shiftUp = React.useCallback(() => onShift?.(index, index - 1), [index, onShift]);
  const shiftDown = React.useCallback(() => onShift?.(index, index + 1), [index, onShift]);
  const trimmedArtist = artist.trim();
  const accessibilityLabel = trimmedArtist
    ? `${title} von ${trimmedArtist} abspielen`
    : `${title} abspielen`;
  const showShiftControls = canShift && onShift;

  return (
    <Pressable
      style={[styles.queueItem, isCurrent && styles.queueItemActive, shiftMode && styles.queueItemEditing]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={260}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isCurrent }}
    >
      <View style={[styles.queueAccent, isCurrent && styles.queueAccentActive]} />
      <View style={styles.queueTextWrap}>
        <Text style={[styles.queueTitle, isCurrent && styles.queueTitleActive]} numberOfLines={1}>{title}</Text>
        <Text style={styles.queueArtist} numberOfLines={1}>{artist}</Text>
      </View>
      {showShiftControls ? (
        <View style={styles.shiftControls} testID={`queue-shift-controls-${id}`}>
          <GripVertical color={theme.palette.text.muted} size={14} />
          <Pressable testID={`queue-shift-up-${id}`} accessibilityRole="button" accessibilityLabel={`${title} nach oben`} disabled={!canShiftUp} onPress={shiftUp} hitSlop={6} style={[styles.shiftButton, !canShiftUp && styles.shiftButtonDisabled]}>
            <ChevronUp color={canShiftUp ? theme.palette.text.primary : theme.palette.text.muted} size={14} />
          </Pressable>
          <Pressable testID={`queue-shift-down-${id}`} accessibilityRole="button" accessibilityLabel={`${title} nach unten`} disabled={!canShiftDown} onPress={shiftDown} hitSlop={6} style={[styles.shiftButton, !canShiftDown && styles.shiftButtonDisabled]}>
            <ChevronDown color={canShiftDown ? theme.palette.text.primary : theme.palette.text.muted} size={14} />
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  queueItem: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: theme.borderRadius.sm, paddingHorizontal: 8 },
  queueItemActive: { backgroundColor: theme.palette.primaryGlow },
  queueItemEditing: { borderWidth: 1, borderColor: theme.palette.primary },
  queueAccent: { width: 3, height: 20, borderRadius: 3, backgroundColor: theme.palette.border },
  queueAccentActive: { backgroundColor: theme.palette.primary },
  queueTextWrap: { flex: 1 },
  queueTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 12 },
  queueTitleActive: { color: theme.palette.primary },
  queueArtist: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 1 },
  shiftControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shiftButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: theme.palette.surfaceElevated },
  shiftButtonDisabled: { opacity: 0.35 },
});

export default NowPlayingQueuePreviewRow;
