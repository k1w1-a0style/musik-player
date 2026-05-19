import TrackPlayer, { Event } from 'react-native-track-player';

const logRemotePlaybackError = (action: string, error: unknown): void => {
  console.warn(`[PlaybackService] Remote ${action} failed`, error);
};

const handleRemotePlaybackAction = (action: string, run: () => Promise<unknown>): void => {
  run().catch(error => logRemotePlaybackError(action, error));
};

/**
 * Background service registered in index.js.
 * Handles remote controls from Lockscreen / Notification / Bluetooth.
 */
export const PlaybackService = async (): Promise<void> => {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    handleRemotePlaybackAction('play', () => TrackPlayer.play());
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    handleRemotePlaybackAction('pause', () => TrackPlayer.pause());
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    handleRemotePlaybackAction('stop', () => TrackPlayer.stop());
  });
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    handleRemotePlaybackAction('next', () => TrackPlayer.skipToNext());
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    handleRemotePlaybackAction('previous', () => TrackPlayer.skipToPrevious());
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    handleRemotePlaybackAction('seek', () => TrackPlayer.seekTo(position));
  });
  TrackPlayer.addEventListener(Event.RemoteJumpForward, ({ interval }) => {
    handleRemotePlaybackAction('jump forward', () => TrackPlayer.seekBy(interval ?? 10));
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, ({ interval }) => {
    handleRemotePlaybackAction('jump backward', () => TrackPlayer.seekBy(-(interval ?? 10)));
  });
};
