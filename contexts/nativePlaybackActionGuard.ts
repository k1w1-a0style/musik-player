import type { Song } from '../types/Song';
import { getNativeHydrationGate } from '../utils/nativeHydrationGate';
import type { NativeQueueActionResult } from './playbackQueueActionHelpers';

export type HydrationStatus = 'loading' | 'ready' | 'degraded' | 'retry-required';
type BlockedHydrationStatus = Exclude<HydrationStatus, 'ready'>;

export class NativePlaybackBlockedError extends Error {
  readonly hydrationStatus: BlockedHydrationStatus;

  constructor(hydrationStatus: BlockedHydrationStatus) {
    super(`Native playback is blocked while hydration status is "${hydrationStatus}".`);
    this.name = 'NativePlaybackBlockedError';
    this.hydrationStatus = hydrationStatus;
  }
}

export interface NativePlaybackActions {
  playSong: (song: Song, queue?: Song[]) => Promise<NativeQueueActionResult>;
  playSongNext: (song: Song) => Promise<NativeQueueActionResult>;
  addSongToQueue: (song: Song) => Promise<NativeQueueActionResult>;
  reorderQueue: (fromIndex: number, toIndex: number) => Promise<NativeQueueActionResult>;
  toggleShuffle: () => Promise<NativeQueueActionResult>;
  playPlaylist: (playlistId: string) => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (millis: number) => Promise<void>;
  stop: () => Promise<void>;
}

const resolveBlockedStatus = (renderStatus: HydrationStatus | undefined): BlockedHydrationStatus | null => {
  if (renderStatus === undefined) return null;
  const gate = getNativeHydrationGate();
  const effectiveStatus = gate.owned ? gate.status : renderStatus;
  return effectiveStatus === 'ready' ? null : effectiveStatus;
};

const blockedQueueResult = (status: BlockedHydrationStatus): NativeQueueActionResult => ({
  status: 'failed',
  error: new NativePlaybackBlockedError(status),
});

export const guardNativePlaybackActions = (
  hydrationStatus: HydrationStatus | undefined,
  actions: NativePlaybackActions,
): NativePlaybackActions => {
  if (hydrationStatus === undefined) return actions;

  const guardQueue = <TArgs extends unknown[]>(
    action: (...args: TArgs) => Promise<NativeQueueActionResult>,
  ) => async (...args: TArgs): Promise<NativeQueueActionResult> => {
    const blockedStatus = resolveBlockedStatus(hydrationStatus);
    return blockedStatus ? blockedQueueResult(blockedStatus) : action(...args);
  };
  const guardControl = <TArgs extends unknown[]>(
    action: (...args: TArgs) => Promise<void>,
  ) => async (...args: TArgs): Promise<void> => {
    const blockedStatus = resolveBlockedStatus(hydrationStatus);
    if (blockedStatus) throw new NativePlaybackBlockedError(blockedStatus);
    await action(...args);
  };

  return {
    playSong: guardQueue(actions.playSong),
    playSongNext: guardQueue(actions.playSongNext),
    addSongToQueue: guardQueue(actions.addSongToQueue),
    reorderQueue: guardQueue(actions.reorderQueue),
    toggleShuffle: guardQueue(actions.toggleShuffle),
    playPlaylist: guardControl(actions.playPlaylist),
    next: guardControl(actions.next),
    previous: guardControl(actions.previous),
    togglePlayPause: guardControl(actions.togglePlayPause),
    seekTo: guardControl(actions.seekTo),
    stop: guardControl(actions.stop),
  };
};
