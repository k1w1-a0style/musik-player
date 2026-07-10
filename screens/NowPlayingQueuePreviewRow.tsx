import React from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type PanResponderGestureState } from 'react-native';
import { GripVertical, Volume2 } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';

interface NowPlayingQueuePreviewRowProps {
  id: string;
  index?: number;
  queueLength?: number;
  rowHeight?: number;
  title: string;
  artist: string;
  isCurrent: boolean;
  canShift?: boolean;
  accentColor?: string;
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
  accentColor,
  onPress,
  onShift,
}: NowPlayingQueuePreviewRowProps) => {
  const { theme } = useAppTheme();
  const resolvedAccentColor = accentColor ?? theme.palette.primary;
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
        isCurrent && [styles.queueItemActive, { borderColor: resolvedAccentColor, backgroundColor: `${resolvedAccentColor}18` }],
        dragEnabled && [styles.queueItemEditing, { borderColor: resolvedAccentColor }],
        dragging && [styles.queueItemDragging, { backgroundColor: theme.palette.surfaceElevated }],
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
      <View style={[styles.queueAccent, { backgroundColor: theme.palette.border }, isCurrent && { backgroundColor: resolvedAccentColor }]} testID={`queue-accent-bar-${id}`} />
      <View style={styles.queueTextWrap}>
        <Text
          style={[styles.queueTitle, { color: theme.palette.text.primary }, isCurrent && styles.queueTitleActive]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        <Text style={[styles.queueArtist, { color: theme.palette.text.secondary }]} numberOfLines={1} ellipsizeMode="tail">{artist}</Text>
      </View>
      {isCurrent ? (
        <View style={[styles.playingBadge, { borderColor: resolvedAccentColor }]} testID={`queue-active-indicator-${id}`}>
          <View testID={`queue-active-icon-${id}`}>
            <Volume2 color={resolvedAccentColor} size={14} />
          </View>
          <Text style={[styles.playingLabel, { color: theme.palette.text.primary }]} numberOfLines={1}>Aktiv</Text>
        </View>
      ) : null}
      {canDrag ? (
        <View style={[styles.dragHandle, { backgroundColor: theme.palette.surfaceElevated }]} testID={`queue-drag-handle-${id}`}>
          <GripVertical color={dragEnabled ? resolvedAccentColor : theme.palette.text.muted} size={18} />
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  queueItem: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: APP_THEME_TOKENS.radii.input, paddingHorizontal: 8 },
  queueItemActive: { borderWidth: 1 },
  queueItemEditing: { borderWidth: 1 },
  queueItemDragging: { zIndex: 20, elevation: 8, opacity: 0.96 },
  queueItemPressed: { opacity: 0.72 },
  queueAccent: { width: 3, height: 20, borderRadius: 3 },
  queueTextWrap: { flex: 1 },
  queueTitle: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 12 },
  queueTitleActive: { fontWeight: '700' },
  queueArtist: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 11, marginTop: 1 },
  playingBadge: { minWidth: 54, maxWidth: 72, height: 26, borderRadius: 13, borderWidth: 1, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  playingLabel: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 10 },
  dragHandle: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
});

export default NowPlayingQueuePreviewRow;
