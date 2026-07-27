import type { Song } from '../types/Song';
import type { NativeQueueActionResult } from './playbackQueueActionHelpers';

export type HydrationStatus = 'loading' | 'ready' | 'degraded' | 'retry-required';

export class NativePlaybackBlockedError extends Error {
  readonly hydrationStatus: Exclude<HydrationStatus, 'ready'>;

  constructor(hydrationStatus: Exclude<HydrationStatus, 'ready'>) {
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

export const guardNativePlaybackActions = (
  hydrationStatus: HydrationStatus | undefined,
  actions: NativePlaybackActions,
): NativePlaybackActions => {
  if (hydrationStatus === undefined || hydrationStatus === 'ready') return actions;

  const blockedError = (): NativePlaybackBlockedError => new NativePlaybackBlockedError(hydrationStatus);
  const blockedQueue = async (): Promise<NativeQueueActionResult> => ({
    status: 'failed',
    error: blockedError(),
  });
  const blockedControl = async (): Promise<void> => {
    throw blockedError();
  };

  return {
    playSong: blockedQueue,
    playSongNext: blockedQueue,
    addSongToQueue: blockedQueue,
    reorderQueue: blockedQueue,
    toggleShuffle: blockedQueue,
    playPlaylist: blockedControl,
    next: blockedControl,
    previous: blockedControl,
    togglePlayPause: blockedControl,
    seekTo: blockedControl,
    stop: blockedControl,
  };
};
