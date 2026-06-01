import { applyHydrationFailureState } from './musicHydrationApplyState';
import { resetNativeQueueAfterHydrationFailure } from './musicHydrationNativeQueue';
import { clearPersistedCurrentSongIdAfterFailure } from './musicHydrationPersistence';
import type { RunMusicHydrationArgs } from './musicHydrationTypes';

export const applyHydrationFailureFallback = async (
  args: Omit<RunMusicHydrationArgs, 'setIsReady' | 'isCancelled' | 'setPlaylists' | 'setEqEnabledState' | 'setEqBandsState' | 'setEqPreset' | 'setVolumeState' | 'setRepeatMode' | 'setShuffle'>,
  error: unknown,
): Promise<void> => {
  applyHydrationFailureState(args);
  await resetNativeQueueAfterHydrationFailure();
  clearPersistedCurrentSongIdAfterFailure();
  console.warn('[MusicHydration:Fatal] Falling back to safe empty state after hydration failure.', error);
};
