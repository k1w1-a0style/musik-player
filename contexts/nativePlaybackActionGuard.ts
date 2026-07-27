import type { Song } from '../types/Song';
import type { NativeQueueActionResult } from './playbackQueueActionHelpers';

export type HydrationStatus = 'loading' | 'ready' | 'degraded' | 'retry-required';

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
  if (hydrationStatus !== 'degraded' && hydrationStatus !== 'retry-required') return actions;
  const blockedQueue = async (): Promise<NativeQueueActionResult> => ({
    status: 'failed', error: new Error('Native queue hydration requires verification.'),
  });
  const blockedControl = async (): Promise<void> => undefined;
  return {
    playSong: blockedQueue, playSongNext: blockedQueue, addSongToQueue: blockedQueue,
    reorderQueue: blockedQueue, toggleShuffle: blockedQueue, playPlaylist: blockedControl,
    next: blockedControl, previous: blockedControl, togglePlayPause: blockedControl,
    seekTo: blockedControl, stop: blockedControl,
  };
};
