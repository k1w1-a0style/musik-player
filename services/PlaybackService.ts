import TrackPlayer, { Event } from 'react-native-track-player';
import { runExclusiveNativePlaybackControl } from '../utils/nativeQueueMutationLock';
import { enforceExpiredSleepTimer, restorePersistedSleepTimer } from './sleepTimerController';
import { getNativeHydrationGate } from '../utils/nativeHydrationGate';
import { getNativePlaybackIntent, isNativePlaybackIntentConfirmed, recordNativePlaybackIntent, restoreNativePlaybackIntent, type DesiredPlaybackState } from '../utils/nativePlaybackIntent';
import { enqueuePlaybackIntent } from '../utils/playbackIntentScheduler';
import { requestNativeTrackNavigation } from '../utils/nativeTrackNavigation';
import { createRemotePlaybackIntentBuffer } from './remotePlaybackIntentBuffer';
import { createRemoteNavigationIntentBuffer } from './remoteNavigationIntentBuffer';

let remoteIntentBuffer: ReturnType<typeof createRemotePlaybackIntentBuffer> | null = null;
let remoteNavigationBuffer: ReturnType<typeof createRemoteNavigationIntentBuffer> | null = null;
const remoteSubscriptions: Array<ReturnType<typeof TrackPlayer.addEventListener>> = [];
const registerRemoteListener: typeof TrackPlayer.addEventListener = (event, listener) => {
  const subscription = TrackPlayer.addEventListener(event, listener);
  remoteSubscriptions.push(subscription);
  return subscription;
};

const logRemotePlaybackError = (action: string, error: unknown): void => {
  console.warn(`[PlaybackService] Remote ${action} failed`, error);
};
const logBlockedRemoteAction = (action: string): void => {
  console.warn('[PlaybackService] Remote action blocked', {
    action, gateStatus: getNativeHydrationGate().status, reason: 'native-hydration-not-ready',
  });
};

const handleRemotePlaybackAction = (
  action: string,
  run: (assertCurrent: () => void) => Promise<unknown>,
  invalidatesPendingSeek = false,
): Promise<void> => {
  const queuedAt = getNativeHydrationGate();
  if (queuedAt.status !== 'ready' || !queuedAt.owned) {
    logBlockedRemoteAction(action);
    return Promise.resolve();
  }
  return enqueuePlaybackIntent(() => runExclusiveNativePlaybackControl(async ({ assertHydrationCurrent }) => {
    const current = getNativeHydrationGate();
    if (current.status !== 'ready' || !current.owned || current.revision !== queuedAt.revision) {
      console.warn('[PlaybackService] Remote action blocked', { action, gateStatus: current.status, reason: 'native-hydration-changed-before-execution' });
      return;
    }
    assertHydrationCurrent();
    await run(assertHydrationCurrent);
    assertHydrationCurrent();
  }, { hydrationCapture: queuedAt, invalidatesPendingSeek })).catch(error => logRemotePlaybackError(action, error));
};

const handleRemoteTransportIntent = (desired: DesiredPlaybackState, isCurrent: () => boolean = () => true): Promise<void> => {
  if (desired === 'stopped') remoteNavigationBuffer?.clear();
  const gate = getNativeHydrationGate();
  if (!gate.owned || gate.status !== 'ready') {
    let revision = 0;
    const buffered = remoteIntentBuffer?.submitWithCompletion(desired, stillCurrent => {
      if (getNativePlaybackIntent().revision === revision) return handleRemoteTransportIntent(desired, stillCurrent);
      return Promise.resolve();
    });
    if (buffered?.accepted) revision = recordNativePlaybackIntent(desired, buffered.isCurrent).revision;
    else logBlockedRemoteAction(desired);
    return buffered?.completion ?? Promise.resolve();
  }
  let applied = false;
  const intent = recordNativePlaybackIntent(desired, () => applied || isCurrent());
  const action = { playing: 'play', paused: 'pause', stopped: 'stop' }[desired];
  return handleRemotePlaybackAction(action, async assertCurrent => {
    if (!isCurrent() || getNativePlaybackIntent().revision !== intent.revision) return;
    if (isNativePlaybackIntentConfirmed(intent.revision)) { applied = true; return; }
    applied = await restoreNativePlaybackIntent(desired, intent.revision, () => { assertCurrent(); return isCurrent(); });
  }, desired === 'stopped');
};

const handleRemoteNavigationIntent = (direction: 1 | -1, isCurrent: () => boolean = () => true): Promise<void> => {
  const action = direction > 0 ? 'next' : 'previous';
  const gate = getNativeHydrationGate();
  if (!gate.owned || gate.status !== 'ready') {
    const buffered = remoteIntentBuffer?.hasPendingStop() ? undefined
      : remoteNavigationBuffer?.submitWithCompletion(stillCurrent => handleRemoteNavigationIntent(direction, stillCurrent));
    if (!buffered?.accepted) logBlockedRemoteAction(action);
    return buffered?.completion ?? Promise.resolve();
  }
  return requestNativeTrackNavigation(direction, false, isCurrent).catch(error => logRemotePlaybackError(action, error));
};

const handleRemoteSeek = (action: string, run: () => Promise<void>): Promise<void> => {
  const gate = getNativeHydrationGate();
  if (!gate.owned || gate.status !== 'ready') { logBlockedRemoteAction(action); return Promise.resolve(); }
  const identity = TrackPlayer.getActiveTrack();
  // Consume failure even when a changed gate prevents the queued action running.
  void identity.catch(error => logRemotePlaybackError('seek identity', error));
  return handleRemotePlaybackAction(action, async assertCurrent => {
    const requested = await identity;
    const current = await TrackPlayer.getActiveTrack();
    assertCurrent();
    if (!requested || !current || requested.id !== current.id || requested.url !== current.url) return;
    await run();
  }, true);
};

const normalizeJumpInterval = (interval: unknown): number =>
  typeof interval === 'number' && Number.isFinite(interval) && interval > 0 ? interval : 10;

/**
 * Background service registered in index.js.
 * Handles remote controls from Lockscreen / Notification / Bluetooth.
 */
export const PlaybackService = async (): Promise<void> => {
  remoteSubscriptions.splice(0).forEach(subscription => subscription.remove());
  remoteIntentBuffer?.dispose();
  remoteNavigationBuffer?.dispose();
  remoteIntentBuffer = createRemotePlaybackIntentBuffer();
  remoteNavigationBuffer = createRemoteNavigationIntentBuffer();
  TrackPlayer.setRemoteCommandGuard(() => getNativeHydrationGate().owned);
  void restorePersistedSleepTimer().catch(error => {
    console.warn('[PlaybackService] Sleep timer restore failed', error);
  });
  registerRemoteListener(Event.RemotePlay, () => handleRemoteTransportIntent('playing'));
  registerRemoteListener(Event.RemotePause, () => handleRemoteTransportIntent('paused'));
  registerRemoteListener(Event.RemoteStop, () => handleRemoteTransportIntent('stopped'));
  registerRemoteListener(Event.RemoteNext, () => handleRemoteNavigationIntent(1));
  registerRemoteListener(Event.RemotePrevious, () => handleRemoteNavigationIntent(-1));
  registerRemoteListener(Event.RemoteSeek, ({ position }) => {
    if (typeof position !== 'number' || !Number.isFinite(position) || position < 0) {
      return Promise.resolve();
    }

    return handleRemoteSeek('seek', () => TrackPlayer.seekTo(position));
  });
  registerRemoteListener(Event.RemoteJumpForward, ({ interval }) => handleRemoteSeek('jump forward', () => TrackPlayer.seekBy(normalizeJumpInterval(interval))));
  registerRemoteListener(Event.RemoteJumpBackward, ({ interval }) => handleRemoteSeek('jump backward', () => TrackPlayer.seekBy(-normalizeJumpInterval(interval))));
  registerRemoteListener(Event.PlaybackProgressUpdated, () => enforceExpiredSleepTimer().catch(error => logRemotePlaybackError('sleep timer expiry', error)));
};
