import TrackPlayer, { Event } from 'react-native-track-player';
import { runExclusiveNativePlaybackControl } from '../utils/nativeQueueMutationLock';
import { enforceExpiredSleepTimer, restorePersistedSleepTimer } from './sleepTimerController';
import { getNativeHydrationGate } from '../utils/nativeHydrationGate';

const logRemotePlaybackError = (action: string, error: unknown): void => {
  console.warn(`[PlaybackService] Remote ${action} failed`, error);
};

const handleRemotePlaybackAction = (
  action: string,
  run: () => Promise<unknown>,
  invalidatesPendingSeek = false,
): void => {
  const queuedAt = getNativeHydrationGate();
  if (queuedAt.status !== 'ready' || !queuedAt.owned) {
    console.warn('[PlaybackService] Remote action blocked', { action, gateStatus: queuedAt.status, reason: 'native-hydration-not-ready' });
    return;
  }
  runExclusiveNativePlaybackControl(async () => {
    const current = getNativeHydrationGate();
    if (current.status !== 'ready' || !current.owned || current.revision !== queuedAt.revision) {
      console.warn('[PlaybackService] Remote action blocked', { action, gateStatus: current.status, reason: 'native-hydration-changed-before-execution' });
      return;
    }
    await run();
  }, { invalidatesPendingSeek }).catch(error => logRemotePlaybackError(action, error));
};

const normalizeJumpInterval = (interval: unknown): number =>
  typeof interval === 'number' && Number.isFinite(interval) && interval > 0 ? interval : 10;

/**
 * Background service registered in index.js.
 * Handles remote controls from Lockscreen / Notification / Bluetooth.
 */
export const PlaybackService = async (): Promise<void> => {
  void restorePersistedSleepTimer().catch(error => {
    console.warn('[PlaybackService] Sleep timer restore failed', error);
  });
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    handleRemotePlaybackAction('play', () => TrackPlayer.play());
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    handleRemotePlaybackAction('pause', () => TrackPlayer.pause());
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    handleRemotePlaybackAction('stop', () => TrackPlayer.stop(), true);
  });
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    handleRemotePlaybackAction('next', () => TrackPlayer.skipToNext(), true);
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    handleRemotePlaybackAction('previous', () => TrackPlayer.skipToPrevious(), true);
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    if (typeof position !== 'number' || !Number.isFinite(position) || position < 0) {
      return;
    }

    handleRemotePlaybackAction('seek', () => TrackPlayer.seekTo(position), true);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpForward, ({ interval }) => {
    handleRemotePlaybackAction('jump forward', () => TrackPlayer.seekBy(normalizeJumpInterval(interval)), true);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, ({ interval }) => {
    handleRemotePlaybackAction('jump backward', () => TrackPlayer.seekBy(-normalizeJumpInterval(interval)), true);
  });
  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, () => {
    enforceExpiredSleepTimer().catch(error => logRemotePlaybackError('sleep timer expiry', error));
  });
};
