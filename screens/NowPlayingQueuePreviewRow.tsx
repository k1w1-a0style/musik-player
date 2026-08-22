import React from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View,
  type GestureResponderHandlers } from 'react-native';
import { GripVertical, Volume2 } from 'lucide-react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useAnimatedQueuePreview, useQueueRowDrag } from '../hooks/useQueueRowDrag';
import { APP_THEME_TOKENS } from '../utils/appTheme';

export { resolveQueueReorderTargetIndex } from '../utils/soundCloudPlayer';

export interface NowPlayingQueueColors {
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  surfaceElevated: string;
  border: string;
}

interface NowPlayingQueuePreviewRowProps {
  id: string;
  index?: number;
  queueLength?: number;
  rowHeight?: number;
  minShiftIndex?: number;
  getScrollOffset?: () => number;
  onDragPosition?: (index: number, dragY: number, movementDirection: -1 | 0 | 1) => void;
  onDragEnd?: () => void;
  artworkUri?: string;
  previewOffsetY?: number;
  dragScrollCompensation?: Animated.Value;
  colors?: NowPlayingQueueColors;
  title: string;
  artist: string;
  isCurrent: boolean;
  canShift?: boolean;
  accentColor?: string;
  onPress: (songId: string) => void;
  onShift?: (fromIndex: number, toIndex: number) => void;
}

const getZeroScrollOffset = (): number => 0;

const QueueArtwork = ({ id, artworkUri, title, colors }: { id: string; artworkUri?: string;
  title: string; colors: NowPlayingQueueColors }) => {
  const artworkSource = React.useMemo(() => artworkUri ? { uri: artworkUri } : null, [artworkUri]);
  if (artworkSource) return <Image source={artworkSource} style={styles.queueArtwork} resizeMode="cover"
    resizeMethod="resize" fadeDuration={0} accessible={false} testID={`queue-artwork-${id}`} />;
  return (
    <View style={[styles.queueArtwork, styles.queueArtworkFallback, { backgroundColor: colors.surfaceElevated }]}
      testID={`queue-artwork-fallback-${id}`}>
      <Text style={[styles.queueArtworkLetter, { color: colors.textMuted }]}>{title.trim().charAt(0).toUpperCase() || '♪'}</Text>
    </View>
  );
};

const PlayingBadge = ({ id, visible, accentColor, textColor }: { id: string; visible: boolean;
  accentColor: string; textColor: string }) => {
  if (!visible) return null;
  return (
    <View style={[styles.playingBadge, { borderColor: accentColor }]} testID={`queue-active-indicator-${id}`}>
      <View testID={`queue-active-icon-${id}`}><Volume2 color={accentColor} size={14} /></View>
      <Text style={[styles.playingLabel, { color: textColor }]} numberOfLines={1}>Läuft gerade</Text>
    </View>
  );
};

const DragHandle = ({ id, visible, enabled, accentColor, colors, panHandlers }: { id: string; visible: boolean;
  enabled: boolean; accentColor: string; colors: NowPlayingQueueColors;
  panHandlers?: GestureResponderHandlers }) => {
  if (!visible) return null;
  return (
    <View style={[styles.dragHandle, { backgroundColor: colors.surfaceElevated }]}
      {...panHandlers} testID={`queue-drag-handle-${id}`}>
      <GripVertical color={enabled ? accentColor : colors.textMuted} size={20} />
    </View>
  );
};

const NowPlayingQueuePreviewRow = React.memo(({ id, index = 0, queueLength = 0, rowHeight = 68,
  minShiftIndex = 1, getScrollOffset = getZeroScrollOffset, onDragPosition, onDragEnd,
  artworkUri, previewOffsetY = 0, colors, title, artist, isCurrent, canShift = false,
  dragScrollCompensation, accentColor, onPress, onShift,
}: NowPlayingQueuePreviewRowProps) => {
  const { theme } = useAppTheme();
  const rowColors = React.useMemo<NowPlayingQueueColors>(() => colors ?? ({
    textPrimary: theme.palette.text.primary, textSecondary: theme.palette.text.secondary,
    textMuted: theme.palette.text.muted, surfaceElevated: theme.palette.surfaceElevated,
    border: theme.palette.border,
  }), [colors, theme.palette]);
  const resolvedAccentColor = accentColor ?? theme.palette.primary;
  const canDrag = canShift && !!onShift && queueLength > 1 && index >= minShiftIndex;
  const drag = useQueueRowDrag({ index, queueLength, rowHeight, minShiftIndex, canDrag,
    getScrollOffset, onDragPosition, onDragEnd, onShift });
  const previewY = useAnimatedQueuePreview(previewOffsetY);
  const translateY = React.useMemo(
    () => Animated.add(Animated.add(drag.dragY, previewY), dragScrollCompensation ?? 0),
    [drag.dragY, dragScrollCompensation, previewY],
  );
  const handlePress = React.useCallback(() => {
    onPress(id);
  }, [id, onPress]);
  const accessibilityLabel = artist.trim() ? `${title} von ${artist.trim()} abspielen` : `${title} abspielen`;
  const dragLabel = ' Zum Umsortieren lange drücken und ziehen oder den Griff rechts verwenden.';

  return (
    <Animated.View style={[styles.animatedRow,
      { height: rowHeight, transform: [{ translateY }] },
      drag.dragging && styles.animatedRowDragging]}
      testID={`queue-drag-surface-${id}`}>
      <Pressable testID={`queue-row-${id}`} onPress={handlePress}
        accessibilityRole="button" accessibilityLabel={accessibilityLabel + (canDrag ? dragLabel : '')}
        accessibilityHint={canDrag ? 'Die Zeile lange drücken und ziehen oder den Griff rechts verwenden.' : undefined}
        accessibilityState={{ selected: isCurrent }}
        style={({ pressed }) => [styles.queueItem,
          isCurrent && [styles.queueItemActive, { borderColor: resolvedAccentColor, backgroundColor: `${resolvedAccentColor}18` }],
          drag.dragEnabled && [styles.queueItemEditing, { borderColor: resolvedAccentColor }],
          drag.dragging && [styles.queueItemDragging, { backgroundColor: rowColors.surfaceElevated }],
          pressed && !drag.dragging && styles.queueItemPressed]}>
        <PanGestureHandler enabled={canDrag} activateAfterLongPress={340}
          {...drag.longPressGestureHandlers} testID={`queue-long-press-drag-${id}`}>
          <Animated.View style={styles.longPressArea}>
            <View style={[styles.queueAccent, { backgroundColor: rowColors.border },
              isCurrent && { backgroundColor: resolvedAccentColor }]} testID={`queue-accent-bar-${id}`} />
            <QueueArtwork id={id} artworkUri={artworkUri} title={title} colors={rowColors} />
            <View style={styles.queueTextWrap}>
              <Text style={[styles.queueTitle, { color: rowColors.textPrimary }, isCurrent && styles.queueTitleActive]}
                numberOfLines={1} ellipsizeMode="tail">{title}</Text>
              <Text style={[styles.queueArtist, { color: rowColors.textSecondary }]}
                numberOfLines={1} ellipsizeMode="tail">{artist}</Text>
            </View>
            <PlayingBadge id={id} visible={isCurrent} accentColor={resolvedAccentColor}
              textColor={rowColors.textPrimary} />
          </Animated.View>
        </PanGestureHandler>
        <DragHandle id={id} visible={canDrag} enabled={drag.dragging}
          accentColor={resolvedAccentColor} colors={rowColors} panHandlers={drag.panHandlers} />
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  animatedRow: { zIndex: 1 }, animatedRowDragging: { zIndex: 20, elevation: 8 },
  queueItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: APP_THEME_TOKENS.radii.input, paddingHorizontal: 8 },
  longPressArea: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  queueItemActive: { borderWidth: 1 }, queueItemEditing: { borderWidth: 1 },
  queueItemDragging: { opacity: 0.97 }, queueItemPressed: { opacity: 0.72 },
  queueAccent: { width: 3, height: 32, borderRadius: 3 },
  queueArtwork: { width: 52, height: 52, borderRadius: 3 },
  queueArtworkFallback: { alignItems: 'center', justifyContent: 'center' },
  queueArtworkLetter: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 19 },
  queueTextWrap: { flex: 1 }, queueTitle: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 13 },
  queueTitleActive: { fontWeight: '700' },
  queueArtist: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 11, marginTop: 2 },
  playingBadge: { minWidth: 66, maxWidth: 88, height: 28, borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  playingLabel: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 9 },
  dragHandle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
});

export default NowPlayingQueuePreviewRow;
