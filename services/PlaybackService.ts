import TrackPlayer, { Event } from 'react-native-track-player';

/**
 * Background service registered in index.js.
 * Handles remote controls from Lockscreen / Notification / Bluetooth.
 */
export const PlaybackService = async (): Promise<void> => {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play().catch(() => undefined);
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause().catch(() => undefined);
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.stop().catch(() => undefined);
  });
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    TrackPlayer.skipToNext().catch(() => undefined);
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    TrackPlayer.skipToPrevious().catch(() => undefined);
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    TrackPlayer.seekTo(position).catch(() => undefined);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpForward, ({ interval }) => {
    TrackPlayer.seekBy(interval ?? 10).catch(() => undefined);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, ({ interval }) => {
    TrackPlayer.seekBy(-(interval ?? 10)).catch(() => undefined);
  });
};
