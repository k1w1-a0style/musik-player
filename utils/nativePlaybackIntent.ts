import TrackPlayer from 'react-native-track-player';

export type DesiredPlaybackState = 'playing' | 'paused' | 'stopped';
export interface PlaybackIntentSnapshot { revision: number; desired: DesiredPlaybackState | null }
let intent: PlaybackIntentSnapshot = { revision: 0, desired: null };
let intentIsValid: (() => boolean) | undefined;
let confirmedRevision = -1;
export const isNativePlaybackIntentConfirmed = (revision: number): boolean => confirmedRevision === revision;

export const getNativePlaybackIntent = (): PlaybackIntentSnapshot => intentIsValid?.() === false
  ? { ...intent, desired: null } : intent;
export const recordNativePlaybackIntent = (desired: DesiredPlaybackState, isValid?: () => boolean): PlaybackIntentSnapshot => {
  intentIsValid = isValid;
  intent = { desired, revision: intent.revision + 1 };
  return intent;
};
export const resolveNativePlaybackIntent = (
  capturedRevision: number,
  fallback: DesiredPlaybackState | 'unknown',
): DesiredPlaybackState | 'unknown' => intent.revision > capturedRevision && intent.desired && intentIsValid?.() !== false
  ? intent.desired : fallback;

const applyState = async (desired: DesiredPlaybackState | 'unknown'): Promise<void> => {
  if (desired === 'playing') await TrackPlayer.play();
  else if (desired === 'paused') await TrackPlayer.pause();
  else if (desired === 'stopped') await TrackPlayer.stop();
};

/** A newer pause/stop wins, including one arriving during a native play flight. */
export const restoreNativePlaybackIntent = async (
  fallback: DesiredPlaybackState | 'unknown',
  capturedRevision: number,
  isCurrent: () => boolean = () => true,
): Promise<boolean> => {
  let revision = capturedRevision;
  let desired = resolveNativePlaybackIntent(revision, fallback);
  while (isCurrent()) {
    revision = intent.revision;
    await applyState(desired);
    if (!isCurrent()) return false;
    if (desired === getNativePlaybackIntent().desired && intent.revision === revision) confirmedRevision = revision;
    if (intent.revision === revision) return true;
    desired = resolveNativePlaybackIntent(revision, desired);
  }
  return false;
};

export const resetNativePlaybackIntentForTests = (): void => {
  intent = { revision: 0, desired: null };
  intentIsValid = undefined;
  confirmedRevision = -1;
};
