import React from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type PanResponderGestureState } from 'react-native';
import { GripVertical } from 'lucide-react-native';
import { theme } from '../theme';

interface NowPlayingQueuePreviewRowProps {
  id: string;
  index?: number;
  queueLength?: number;
  rowHeight?: number;
  title: string;
  artist: string;
  isCurrent: boolean;
  canShift?: boolean;
  onPress: (songId: string) => void;
  onShift?: (fromIndex: number, toIndex: number) => void;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const NowPlayingQueuePreviewRow = React.memo(({
  id,
  index = 0,
  queueLength = 0,
  rowHeight = 44,
  title,
  artist,
  isCurrent,
  canShift = false,
  onPress,
  onShift,
}: NowPlayingQueuePreviewRowProps) => {
  const [dragEnabled, setDragEnabled] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [dragY, setDragY] = React.useState(0);
  const canDrag = canShift && !!onShift && queueLength > 1 && index > 0;

  const resolveTargetIndex = React.useCallback((gesture: Pick<PanResponderGestureState, 'dy'>): number => {
    const deltaRows = Math.round(gesture.dy / Math.max(1, rowHeight));
    return clamp(index + deltaRows, 1, Math.max(1, queueLength - 1));
  }, [index, queueLength, rowHeight]);

  const resetDragState = React.useCallback(() => {
    setDragging(false);
    setDragY(0);
    setDragEnabled(false);
  }, []);

  const finishDrag = React.useCallback((gesture: Pick<PanResponderGestureState, 'dy'>) => {
    const targetIndex = resolveTargetIndex(gesture);
    if (canDrag && targetIndex !== index) {
      onShift?.(index, targetIndex);
    }
    resetDragState();
  }, [canDrag, index, onShift, resetDragState, resolveTargetIndex]);

  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => canDrag && dragEnabled && Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => {
      if (!canDrag) return;
      setDragging(true);
      setDragY(0);
    },
    onPanResponderMove: (_event, gesture) => {
      if (!canDrag) return;
      setDragY(gesture.dy);
    },
    onPanResponderRelease: (_event, gesture) => finishDrag(gesture),
    onPanResponderTerminate: (_event, gesture) => finishDrag(gesture),
    onShouldBlockNativeResponder: () => false,
  }), [canDrag, dragEnabled, finishDrag]);

  const handlePress = React.useCallback(() => {
    if (dragEnabled) {
      resetDragState();
      return;
    }
    onPress(id);
  }, [dragEnabled, id, onPress, resetDragState]);

  const handleLongPress = React.useCallback(() => {
    if (canDrag) setDragEnabled(true);
  }, [canDrag]);

  const trimmedArtist = artist.trim();
  const accessibilityLabel = trimmedArtist
    ? `${title} von ${trimmedArtist} abspielen`
    : `${title} abspielen`;
  const dragStateLabel = dragEnabled ? ' Ziehen zum Umsortieren aktiv.' : ' Zum Umsortieren gedrückt halten und ziehen.';

  return (
    <Pressable
      testID={`queue-row-${id}`}
      style={({ pressed }) => [
        styles.queueItem,
        isCurrent && styles.queueItemActive,
        dragEnabled && styles.queueItemEditing,
        dragging && styles.queueItemDragging,
        dragging && { transform: [{ translateY: dragY }] },
        pressed && !dragging && styles.queueItemPressed,
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={260}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel + (canDrag ? dragStateLabel : '')}
      accessibilityHint={canDrag ? 'Lange gedrückt halten, dann nach oben oder unten ziehen.' : undefined}
      accessibilityState={{ selected: isCurrent }}
      {...panResponder.panHandlers}
    >
      <View style={[styles.queueAccent, isCurrent && styles.queueAccentActive]} />
      <View style={styles.queueTextWrap}>
        <Text style={[styles.queueTitle, isCurrent && styles.queueTitleActive]} numberOfLines={1}>{title}</Text>
        <Text style={styles.queueArtist} numberOfLines={1}>{artist}</Text>
      </View>
      {canDrag ? (
        <View style={styles.dragHandle} testID={`queue-drag-handle-${id}`}>
          <GripVertical color={dragEnabled ? theme.palette.primary : theme.palette.text.muted} size={18} />
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  queueItem: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: theme.borderRadius.sm, paddingHorizontal: 8 },
  queueItemActive: { backgroundColor: theme.palette.primaryGlow },
  queueItemEditing: { borderWidth: 1, borderColor: theme.palette.primary },
  queueItemDragging: { zIndex: 20, elevation: 8, backgroundColor: theme.palette.surfaceElevated, opacity: 0.96 },
  queueItemPressed: { opacity: 0.72 },
  queueAccent: { width: 3, height: 20, borderRadius: 3, backgroundColor: theme.palette.border },
  queueAccentActive: { backgroundColor: theme.palette.primary },
  queueTextWrap: { flex: 1 },
  queueTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 12 },
  queueTitleActive: { color: theme.palette.primary },
  queueArtist: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 1 },
  dragHandle: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: theme.palette.surfaceElevated },
});

export default NowPlayingQueuePreviewRow;
