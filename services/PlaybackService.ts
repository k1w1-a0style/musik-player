import TrackPlayer, { Event } from 'react-native-track-player';
import { runExclusiveNativeQueueMutation } from '../utils/nativeQueueMutationLock';

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
    handleRemotePlaybackAction('play', () => runExclusiveNativeQueueMutation(() => TrackPlayer.play()));
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    handleRemotePlaybackAction('pause', () => TrackPlayer.pause());
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    handleRemotePlaybackAction('stop', () => TrackPlayer.stop());
  });
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    handleRemotePlaybackAction('next', () => runExclusiveNativeQueueMutation(() => TrackPlayer.skipToNext()));
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    handleRemotePlaybackAction('previous', () => runExclusiveNativeQueueMutation(() => TrackPlayer.skipToPrevious()));
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    if (typeof position !== 'number' || !Number.isFinite(position) || position < 0) {
      return;
    }

    handleRemotePlaybackAction('seek', () => runExclusiveNativeQueueMutation(() => TrackPlayer.seekTo(position)));
  });
  TrackPlayer.addEventListener(Event.RemoteJumpForward, ({ interval }) => {
    handleRemotePlaybackAction('jump forward', () => TrackPlayer.seekBy(interval ?? 10));
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, ({ interval }) => {
    handleRemotePlaybackAction('jump backward', () => TrackPlayer.seekBy(-(interval ?? 10)));
  });
};
