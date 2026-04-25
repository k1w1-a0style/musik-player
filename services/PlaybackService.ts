import TrackPlayer, { Event } from 'react-native-track-player';

/**
 * Background service registered in index.js.
 * Handles remote controls from Lockscreen / Notification / Bluetooth.
 */
export const PlaybackService = async (): Promise<void> => {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play();
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.stop();
  });
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    TrackPlayer.skipToNext();
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    TrackPlayer.skipToPrevious();
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    TrackPlayer.seekTo(position);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpForward, ({ interval }) => {
    TrackPlayer.seekBy(interval ?? 10);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, ({ interval }) => {
    TrackPlayer.seekBy(-(interval ?? 10));
  });
};
