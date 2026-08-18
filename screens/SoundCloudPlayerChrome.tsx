import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, Heart, Info, ListMusic, MoreHorizontal, Share2 } from 'lucide-react-native';
import type { RepeatMode, Song } from '../types/Song';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';
import SoundCloudQueueSheet from './SoundCloudQueueSheet';

interface PlayerActionProps {
  label: string;
  testID: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}

const PlayerAction = ({ label, testID, onPress, disabled, active, children }: PlayerActionProps) => (
  <Pressable style={({ pressed }) => [styles.action, pressed && styles.pressed, disabled && styles.disabled]}
    onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled, selected: !!active }} testID={testID}>
    {children}<Text style={[styles.actionLabel, active && styles.activeLabel]}>{label}</Text>
  </Pressable>
);

export interface SoundCloudPlayerChromeProps {
  currentSong: Song | null;
  onCollapse: () => void;
  onOpenTrackInfo: () => void;
  onOpenMenu: () => void;
  onShare: () => void;
  favorite: boolean;
  favoritePending: boolean;
  onToggleFavorite: () => void;
  queue: Song[];
  onPlayQueueItem: (songId: string) => void;
  onQueueShift: (fromIndex: number, toIndex: number) => void;
  canShiftQueue: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  onToggleShuffle: () => unknown | Promise<unknown>;
  onCycleRepeatMode: () => unknown | Promise<unknown>;
  topInset: number;
  bottomInset: number;
  reduceMotion?: boolean;
  queueOpen: boolean;
  onOpenQueue: () => void;
  onCloseQueue: () => void;
}

const QueueOverlay = ({ visible, onClose, ...props }: Omit<SoundCloudPlayerChromeProps,
  'onCollapse' | 'onOpenTrackInfo' | 'onOpenMenu' | 'onShare' | 'favorite' | 'favoritePending' | 'onToggleFavorite'>
  & { visible: boolean; onClose: () => void }) => {
  if (!visible) return null;
  return <SoundCloudQueueSheet queue={props.queue} currentSong={props.currentSong} onClose={onClose}
    onPlayQueueItem={props.onPlayQueueItem} onQueueShift={props.onQueueShift}
    canShiftQueue={props.canShiftQueue} shuffle={props.shuffle} repeatMode={props.repeatMode}
    onToggleShuffle={props.onToggleShuffle} onCycleRepeatMode={props.onCycleRepeatMode}
    topInset={props.topInset} bottomInset={props.bottomInset} reduceMotion={props.reduceMotion} />;
};

const SoundCloudPlayerChrome = (props: SoundCloudPlayerChromeProps) => {
  const hasSong = Boolean(props.currentSong);
  return (
    <>
      <View style={[styles.topChrome, { paddingTop: Math.max(props.topInset, 8) }]} pointerEvents="box-none">
        <Pressable style={styles.chromeButton} onPress={props.onCollapse} accessibilityRole="button"
          accessibilityLabel="Wiedergabe schließen" testID="now-playing-close">
          <ChevronDown color={SOUNDCLOUD_PLAYER_COLORS.foreground} size={26} />
        </Pressable>
      </View>
      <View style={[styles.actionBar, { paddingBottom: Math.max(props.bottomInset, 8) }]}
        pointerEvents="box-none" testID="soundcloud-action-bar">
        <PlayerAction label="Gefällt mir" testID="soundcloud-like" onPress={props.onToggleFavorite}
          disabled={!hasSong || props.favoritePending} active={props.favorite}>
          <Heart color={props.favorite ? SOUNDCLOUD_PLAYER_COLORS.accent : SOUNDCLOUD_PLAYER_COLORS.foreground}
            fill={props.favorite ? SOUNDCLOUD_PLAYER_COLORS.accent : 'transparent'} size={23} />
        </PlayerAction>
        <PlayerAction label="Info" testID="soundcloud-track-info" onPress={props.onOpenTrackInfo} disabled={!hasSong}>
          <Info color={SOUNDCLOUD_PLAYER_COLORS.foreground} size={23} />
        </PlayerAction>
        <PlayerAction label="Teilen" testID="soundcloud-share" onPress={props.onShare} disabled={!hasSong}>
          <Share2 color={SOUNDCLOUD_PLAYER_COLORS.foreground} size={23} />
        </PlayerAction>
        <PlayerAction label="Liste" testID="soundcloud-open-queue" onPress={props.onOpenQueue}>
          <ListMusic color={SOUNDCLOUD_PLAYER_COLORS.foreground} size={23} />
        </PlayerAction>
        <PlayerAction label="Mehr" testID="soundcloud-more" onPress={props.onOpenMenu}>
          <MoreHorizontal color={SOUNDCLOUD_PLAYER_COLORS.foreground} size={24} />
        </PlayerAction>
      </View>
      <QueueOverlay {...props} visible={props.queueOpen} onClose={props.onCloseQueue} />
    </>
  );
};

const styles = StyleSheet.create({
  topChrome: { position: 'absolute', top: 0, left: 8, right: 8, alignItems: 'flex-start' },
  chromeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: SOUNDCLOUD_PLAYER_COLORS.chromeButtonSurface },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 70, paddingTop: 7,
    paddingHorizontal: 8, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around',
    backgroundColor: SOUNDCLOUD_PLAYER_COLORS.actionBarSurface, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SOUNDCLOUD_PLAYER_COLORS.actionBarBorder },
  action: { minWidth: 54, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 5 },
  pressed: { opacity: 0.62 }, disabled: { opacity: 0.34 },
  actionLabel: { color: SOUNDCLOUD_PLAYER_COLORS.actionLabel, fontSize: 10, fontFamily: APP_THEME_TOKENS.fonts.body },
  activeLabel: { color: SOUNDCLOUD_PLAYER_COLORS.accent },
});

export default React.memo(SoundCloudPlayerChrome);
