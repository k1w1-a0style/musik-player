import TrackPlayer, { Event } from 'react-native-track-player';
import { runExclusiveNativePlaybackControl } from '../utils/nativeQueueMutationLock';
import { cancelSleepTimer, enforceExpiredSleepTimer } from './sleepTimerController';

const logRemotePlaybackError = (action: string, error: unknown): void => {
  console.warn(`[PlaybackService] Remote ${action} failed`, error);
};

const handleRemotePlaybackAction = (action: string, run: () => Promise<unknown>): void => {
  run().catch(error => logRemotePlaybackError(action, error));
};

const normalizeJumpInterval = (interval: unknown): number =>
  typeof interval === 'number' && Number.isFinite(interval) && interval > 0 ? interval : 10;

/**
 * Background service registered in index.js.
 * Handles remote controls from Lockscreen / Notification / Bluetooth.
 */
export const PlaybackService = async (): Promise<void> => {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    handleRemotePlaybackAction('play', () => runExclusiveNativePlaybackControl(() => TrackPlayer.play()));
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    handleRemotePlaybackAction('pause', () => runExclusiveNativePlaybackControl(() => TrackPlayer.pause()));
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    handleRemotePlaybackAction('stop', () => runExclusiveNativePlaybackControl(() => TrackPlayer.stop()));
  });
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    handleRemotePlaybackAction('next', () => runExclusiveNativePlaybackControl(() => TrackPlayer.skipToNext()));
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    handleRemotePlaybackAction('previous', () => runExclusiveNativePlaybackControl(() => TrackPlayer.skipToPrevious()));
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    if (typeof position !== 'number' || !Number.isFinite(position) || position < 0) {
      return;
    }

    handleRemotePlaybackAction('seek', () => runExclusiveNativePlaybackControl(() => TrackPlayer.seekTo(position)));
  });
  TrackPlayer.addEventListener(Event.RemoteJumpForward, ({ interval }) => {
    handleRemotePlaybackAction('jump forward', () => runExclusiveNativePlaybackControl(() => TrackPlayer.seekBy(normalizeJumpInterval(interval))));
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, ({ interval }) => {
    handleRemotePlaybackAction('jump backward', () => runExclusiveNativePlaybackControl(() => TrackPlayer.seekBy(-normalizeJumpInterval(interval))));
  });
  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, () => {
    handleRemotePlaybackAction('sleep timer expiry', () => enforceExpiredSleepTimer());
  });
};

export const cleanupPlaybackService = (): void => {
  cancelSleepTimer();
};
