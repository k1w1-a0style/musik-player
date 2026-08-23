import React, { useCallback, useEffect, useMemo } from 'react';
import { Animated, BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { PanGestureHandler, State, type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { Repeat, Repeat1, Shuffle, X } from 'lucide-react-native';
import type { RepeatMode, Song } from '../types/Song';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
import { shouldCloseSoundCloudQueue } from '../utils/soundCloudPlayer';
import NowPlayingQueueCard from './NowPlayingQueueCard';
import type { NowPlayingQueueColors } from './NowPlayingQueuePreviewRow';

const SOUNDCLOUD_QUEUE_COLORS: NowPlayingQueueColors = {
  textPrimary: SOUNDCLOUD_PLAYER_COLORS.foreground,
  textSecondary: SOUNDCLOUD_PLAYER_COLORS.actionLabel,
  textMuted: SOUNDCLOUD_PLAYER_COLORS.queueControlInactive,
  surfaceElevated: SOUNDCLOUD_PLAYER_COLORS.artworkFallback,
  border: SOUNDCLOUD_PLAYER_COLORS.queueBorder,
};

export interface SoundCloudQueueSheetProps {
  queue: Song[];
  currentSong: Song | null;
  onClose: () => void;
  onPlayQueueItem: (songId: string) => void;
  onQueueShift: (fromIndex: number, toIndex: number) => void;
  canShiftQueue: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  onToggleShuffle: () => unknown | Promise<unknown>;
  onCycleRepeatMode: () => unknown | Promise<unknown>;
  topInset: number;
  bottomInset: number;
  open: boolean;
  motion: Animated.Value;
  onRestore: () => void;
}

interface QueueHeaderProps extends Pick<SoundCloudQueueSheetProps,
  'shuffle' | 'repeatMode' | 'onToggleShuffle' | 'onCycleRepeatMode'> {
  onClose: () => void;
}

const QueueHeader = ({ shuffle, repeatMode, onToggleShuffle, onCycleRepeatMode, onClose }: QueueHeaderProps) => {
  const repeatIcon = repeatMode === 'one' ? <Repeat1 color={SOUNDCLOUD_PLAYER_COLORS.accent} size={22} />
    : <Repeat color={repeatMode === 'off' ? SOUNDCLOUD_PLAYER_COLORS.queueControlInactive
      : SOUNDCLOUD_PLAYER_COLORS.accent} size={22} />;
  return (
    <View style={styles.queueHeader}>
      <View><Text style={styles.queueEyebrow}>SOUNDCLOUD PLAYER</Text><Text style={styles.queueTitle}>Als Nächstes</Text></View>
      <View style={styles.queueHeaderActions}>
        <Pressable style={[styles.queueHeaderButton, shuffle && styles.active]}
          onPress={() => void runPlaybackUiAction('soundcloud-shuffle', onToggleShuffle, { dropIfPending: true })}
          accessibilityRole="button" accessibilityLabel={shuffle ? 'Zufallswiedergabe ausschalten' : 'Zufallswiedergabe einschalten'}
          testID="soundcloud-queue-shuffle"><Shuffle color={shuffle ? SOUNDCLOUD_PLAYER_COLORS.accent
            : SOUNDCLOUD_PLAYER_COLORS.queueControlInactive} size={22} /></Pressable>
        <Pressable style={[styles.queueHeaderButton, repeatMode !== 'off' && styles.active]}
          onPress={() => void runPlaybackUiAction('soundcloud-repeat', onCycleRepeatMode, { dropIfPending: false })}
          accessibilityRole="button" accessibilityLabel="Wiederholungsmodus ändern"
          testID="soundcloud-queue-repeat">{repeatIcon}</Pressable>
        <Pressable style={styles.queueHeaderButton} onPress={onClose} accessibilityRole="button"
          accessibilityLabel="Warteschlange schließen" testID="soundcloud-queue-close">
          <X color={SOUNDCLOUD_PLAYER_COLORS.foreground} size={24} />
        </Pressable>
      </View>
    </View>
  );
};

const SoundCloudQueueSheet = ({ queue, currentSong, onClose, onPlayQueueItem, onQueueShift,
  canShiftQueue, shuffle, repeatMode, onToggleShuffle, onCycleRepeatMode,
  topInset, bottomInset, open, motion, onRestore }: SoundCloudQueueSheetProps) => {
  const { height: windowHeight } = useWindowDimensions();
  const height = Math.max(1, windowHeight);
  const translateY = useMemo(() => motion.interpolate({
    inputRange: [-height, 0], outputRange: [0, height], extrapolate: 'clamp',
  }), [height, motion]);
  const onDismissGesture = useCallback((event: PanGestureHandlerGestureEvent) => {
    const translationY = Math.max(0, Math.min(height, event.nativeEvent.translationY ?? 0));
    motion.setValue(-height + translationY);
  }, [height, motion]);
  const onDismissStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, state, translationY = 0, velocityY = 0 } = event.nativeEvent;
    if (state === State.CANCELLED || state === State.FAILED) onRestore();
    else if (state === State.END && oldState === State.ACTIVE) {
      if (shouldCloseSoundCloudQueue({ translationY, velocityY, height })) onClose();
      else onRestore();
    }
  }, [height, onClose, onRestore]);
  useEffect(() => {
    if (!open) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, open]);
  const topPadding = Math.max(topInset, 16);
  const bottomPadding = Math.max(bottomInset, 12);
  return (
    <Animated.View pointerEvents={open ? 'auto' : 'none'} accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      style={[styles.queueSheet, { paddingTop: topPadding, paddingBottom: bottomPadding,
        transform: [{ translateY }] }]} testID="soundcloud-queue-sheet">
      <PanGestureHandler enabled={open} activeOffsetY={8} failOffsetX={[-24, 24]}
        onGestureEvent={onDismissGesture} onHandlerStateChange={onDismissStateChange}
        testID="soundcloud-queue-dismiss-gesture">
        <Animated.View>
          <View style={styles.dismissHandle} />
          <QueueHeader shuffle={shuffle} repeatMode={repeatMode} onToggleShuffle={onToggleShuffle}
            onCycleRepeatMode={onCycleRepeatMode} onClose={onClose} />
        </Animated.View>
      </PanGestureHandler>
      {open ? <NowPlayingQueueCard queue={queue} currentSongId={currentSong?.id}
        maxHeight={height - topPadding - 86 - bottomPadding} onPlayQueueItem={onPlayQueueItem}
        onQueueShift={onQueueShift} canShiftQueue={canShiftQueue}
        accentColor={SOUNDCLOUD_PLAYER_COLORS.accent} colors={SOUNDCLOUD_QUEUE_COLORS} showHeader={false} /> : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  queueSheet: { ...StyleSheet.absoluteFillObject, backgroundColor: SOUNDCLOUD_PLAYER_COLORS.queueBackground,
    zIndex: 100, elevation: 30 },
  dismissHandle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, marginTop: 7,
    marginBottom: -3, backgroundColor: SOUNDCLOUD_PLAYER_COLORS.queueControlInactive },
  queueHeader: { height: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SOUNDCLOUD_PLAYER_COLORS.queueBorder },
  queueEyebrow: { color: SOUNDCLOUD_PLAYER_COLORS.accent, fontSize: 9, letterSpacing: 1.4,
    fontFamily: APP_THEME_TOKENS.fonts.body },
  queueTitle: { color: SOUNDCLOUD_PLAYER_COLORS.foreground, fontSize: 24, lineHeight: 28,
    fontFamily: APP_THEME_TOKENS.fonts.heading },
  queueHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  queueHeaderButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: SOUNDCLOUD_PLAYER_COLORS.queueControlActive },
});

export default SoundCloudQueueSheet;
