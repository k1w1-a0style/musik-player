import React from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderHandlers,
  type NativeSyntheticEvent,
} from 'react-native';
import { GripVertical, Trash2 } from 'lucide-react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useAnimatedQueuePreview, useQueueRowDrag } from '../hooks/useQueueRowDrag';
import type { Song } from '../types/Song';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { displayArtist, displayTitle } from '../utils/libraryPresentation';
import { getSongArtworkUri } from '../utils/songArtwork';

export const PLAYLIST_DETAIL_ROW_HEIGHT = 68;

interface PlaylistDetailSongRowProps {
  song: Song;
  index: number;
  songCount: number;
  previewOffsetY: number;
  dragScrollCompensation?: Animated.Value;
  canReorder: boolean;
  getScrollOffset: () => number;
  onDragPosition: (index: number, dragY: number, direction: -1 | 0 | 1) => void;
  onDragEnd: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (song: Song) => void;
}

const SongArtwork = React.memo(({ song, title, backgroundColor, textColor }: {
  song: Song;
  title: string;
  backgroundColor: string;
  textColor: string;
}) => {
  const uri = getSongArtworkUri(song);
  const source = React.useMemo(() => uri ? { uri } : null, [uri]);
  if (source) {
    return <Image source={source} resizeMode="cover" resizeMethod="resize" fadeDuration={0}
      style={styles.artwork} accessible={false} testID={`playlist-detail-artwork-${song.id}`} />;
  }
  return (
    <View style={[styles.artwork, styles.artworkFallback, { backgroundColor }]}>
      <Text style={[styles.artworkLetter, { color: textColor }]}>
        {title.charAt(0).toUpperCase() || '♪'}
      </Text>
    </View>
  );
});

const usePlaylistRowAccessibilityAction = (index: number, songCount: number,
  onReorder: (fromIndex: number, toIndex: number) => void) => React.useCallback(
  (event: NativeSyntheticEvent<{ actionName: string }>) => {
    const direction = event.nativeEvent.actionName === 'increment' ? 1
      : event.nativeEvent.actionName === 'decrement' ? -1 : 0;
    const targetIndex = index + direction;
    if (direction && targetIndex >= 0 && targetIndex < songCount) onReorder(index, targetIndex);
  },
  [index, onReorder, songCount],
);

const PlaylistDetailSongRow = React.memo(({ song, index, songCount, previewOffsetY,
  dragScrollCompensation,
  canReorder, getScrollOffset, onDragPosition, onDragEnd, onReorder, onRemove,
}: PlaylistDetailSongRowProps) => {
  const { theme } = useAppTheme();
  const canDrag = canReorder && songCount > 1;
  const drag = useQueueRowDrag({
    index,
    queueLength: songCount,
    rowHeight: PLAYLIST_DETAIL_ROW_HEIGHT,
    minShiftIndex: 0,
    canDrag,
    getScrollOffset,
    onDragPosition,
    onDragEnd,
    onShift: onReorder,
  });
  const previewY = useAnimatedQueuePreview(previewOffsetY);
  const translateY = React.useMemo(
    () => Animated.add(Animated.add(drag.dragY, previewY), dragScrollCompensation ?? 0),
    [drag.dragY, dragScrollCompensation, previewY],
  );
  const title = displayTitle(song);
  const artist = displayArtist(song);
  const handleAccessibilityAction = usePlaylistRowAccessibilityAction(index, songCount, onReorder);
  return (
    <Animated.View style={[styles.animatedRow, { height: PLAYLIST_DETAIL_ROW_HEIGHT,
      transform: [{ translateY }] }, drag.dragging && styles.animatedRowDragging]}
      testID={`playlist-detail-drag-surface-${song.id}`}>
      <Pressable testID={`playlist-detail-song-${song.id}`}
        accessible accessibilityRole="adjustable"
        accessibilityLabel={`${title} von ${artist}. Position ${index + 1} von ${songCount}`}
        accessibilityHint={canDrag ? 'Die Zeile lange drücken und ziehen oder den Griff rechts verwenden.' : undefined}
        accessibilityActions={canDrag ? [{ name: 'decrement', label: 'Nach oben verschieben' },
          { name: 'increment', label: 'Nach unten verschieben' }] : undefined}
        onAccessibilityAction={canDrag ? handleAccessibilityAction : undefined}
        style={({ pressed }) => [styles.songRow, { borderBottomColor: theme.palette.border },
          drag.dragEnabled && { borderColor: theme.palette.primary,
            backgroundColor: theme.palette.surfaceElevated, borderWidth: 1 },
          drag.dragging && styles.songRowDragging,
          pressed && !drag.dragging && styles.songRowPressed]}>
        <PanGestureHandler enabled={canDrag} activateAfterLongPress={340}
          {...drag.longPressGestureHandlers} testID={`playlist-detail-long-press-drag-${song.id}`}>
          <Animated.View style={styles.longPressArea}>
            <Text style={[styles.songIndex, { color: theme.palette.text.muted }]}>{index + 1}</Text>
            <SongArtwork song={song} title={title} backgroundColor={theme.palette.surfaceElevated}
              textColor={theme.palette.text.muted} />
            <View style={styles.songTextWrap}>
              <Text style={[styles.songTitle, { color: theme.palette.text.primary }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.songSubtitle, { color: theme.palette.text.secondary }]} numberOfLines={1}>
                {artist}
              </Text>
            </View>
          </Animated.View>
        </PanGestureHandler>
        <Pressable accessibilityRole="button" accessibilityLabel={`${title} aus Playlist entfernen`}
          onPress={() => onRemove(song)} style={[styles.removeSongButton,
            { backgroundColor: theme.palette.surface, borderColor: theme.palette.error }]}
          testID={`playlist-detail-remove-song-${song.id}`}>
          <Trash2 color={theme.palette.error} size={18} />
        </Pressable>
        {canDrag ? (
          <View style={[styles.dragHandle, { backgroundColor: theme.palette.surface }]}
            {...(drag.panHandlers as GestureResponderHandlers)}
            testID={`playlist-detail-drag-handle-${song.id}`}>
            <GripVertical color={drag.dragging ? theme.palette.primary : theme.palette.text.muted}
              size={21} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  animatedRow: { zIndex: 1 },
  animatedRowDragging: { zIndex: 20, elevation: 9 },
  songRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_THEME_TOKENS.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: APP_THEME_TOKENS.radii.input,
    paddingHorizontal: APP_THEME_TOKENS.spacing.xs,
  },
  longPressArea: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center',
    gap: APP_THEME_TOKENS.spacing.sm },
  songRowDragging: { borderWidth: 1, opacity: 0.98, transform: [{ scale: 1.015 }] },
  songRowPressed: { opacity: 0.76 },
  songIndex: { width: 24, textAlign: 'right', fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 12 },
  artwork: { width: 50, height: 50, borderRadius: 5 },
  artworkFallback: { alignItems: 'center', justifyContent: 'center' },
  artworkLetter: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 18 },
  songTextWrap: { flex: 1, minWidth: 0 },
  songTitle: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 14 },
  songSubtitle: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 11, marginTop: 2 },
  dragHandle: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  removeSongButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderRadius: APP_THEME_TOKENS.borderRadius.pill },
});

export default PlaylistDetailSongRow;
