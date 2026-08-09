import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Repeat, Repeat1, Shuffle, X } from 'lucide-react-native';
import type { RepeatMode, Song } from '../types/Song';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
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
      <View><Text style={styles.queueEyebrow}>SOUNDCLOUD PLAYER</Text><Text style={styles.queueTitle}>Next up</Text></View>
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
  topInset, bottomInset }: SoundCloudQueueSheetProps) => {
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(height)).current;
  useEffect(() => {
    Animated.timing(translateY, { toValue: 0, duration: 260,
      easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [translateY]);
  const closeAnimated = useCallback(() => {
    Animated.timing(translateY, { toValue: height, duration: 220,
      easing: Easing.in(Easing.cubic), useNativeDriver: true })
      .start(({ finished }) => { if (finished) onClose(); });
  }, [height, onClose, translateY]);
  const topPadding = Math.max(topInset, 16);
  const bottomPadding = Math.max(bottomInset, 12);
  return (
    <Animated.View style={[styles.queueSheet, { paddingTop: topPadding, paddingBottom: bottomPadding,
      transform: [{ translateY }] }]} testID="soundcloud-queue-sheet">
      <QueueHeader shuffle={shuffle} repeatMode={repeatMode} onToggleShuffle={onToggleShuffle}
        onCycleRepeatMode={onCycleRepeatMode} onClose={closeAnimated} />
      <NowPlayingQueueCard queue={queue} currentSongId={currentSong?.id}
        maxHeight={height - topPadding - 78 - bottomPadding} onPlayQueueItem={onPlayQueueItem}
        onQueueShift={onQueueShift} canShiftQueue={canShiftQueue}
        accentColor={SOUNDCLOUD_PLAYER_COLORS.accent} colors={SOUNDCLOUD_QUEUE_COLORS} showHeader={false} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  queueSheet: { ...StyleSheet.absoluteFillObject, backgroundColor: SOUNDCLOUD_PLAYER_COLORS.queueBackground,
    zIndex: 100, elevation: 30 },
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
