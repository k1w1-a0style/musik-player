import type { Song } from '../types/Song';
import type { HydrationPlan } from './musicHydrationPlan';
import type { HydrateStoredSongsArgs, RunMusicHydrationArgs } from './musicHydrationTypes';

export type HydrationStateTargets = Pick<
  HydrateStoredSongsArgs,
  | 'songsRef'
  | 'queueContextRef'
  | 'baseQueueContextRef'
  | 'setSongsState'
  | 'setCurrentSong'
  | 'setPlaybackQueue'
>;

export const applyHydratedSongsState = (
  plan: HydrationPlan,
  { songsRef, setSongsState }: Pick<HydrationStateTargets, 'songsRef' | 'setSongsState'>,
): void => {
  songsRef.current = plan.hydratedSongs;
  setSongsState(plan.hydratedSongs);
};

export const applyHydratedQueueState = (
  plan: HydrationPlan,
  { queueContextRef, baseQueueContextRef, setPlaybackQueue }: Pick<HydrationStateTargets, 'queueContextRef' | 'baseQueueContextRef' | 'setPlaybackQueue'>,
): void => {
  baseQueueContextRef.current = plan.hydratedQueue.slice();
  queueContextRef.current = plan.playableQueue.slice();
  setPlaybackQueue(plan.playableQueue.slice());
};

export const applyHydratedCurrentSongState = (
  plan: HydrationPlan,
  { setCurrentSong }: Pick<HydrationStateTargets, 'setCurrentSong'>,
): void => {
  if (plan.restoredSong) setCurrentSong(plan.restoredSong);
};

export const applyHydrationFailureState = ({
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setSongsState,
  setCurrentSong,
  setPlaybackQueue,
}: Omit<RunMusicHydrationArgs, 'setIsReady' | 'isCancelled' | 'setPlaylists' | 'setEqEnabledState' | 'setEqBandsState' | 'setEqPreset' | 'setVolumeState' | 'setRepeatMode' | 'setShuffle'>): void => {
  const emptySongs: Song[] = [];
  songsRef.current = emptySongs;
  queueContextRef.current = emptySongs;
  baseQueueContextRef.current = emptySongs;
  nativeQueueRef.current = emptySongs;
  setSongsState(emptySongs);
  setPlaybackQueue(emptySongs);
  setCurrentSong(null);
};
