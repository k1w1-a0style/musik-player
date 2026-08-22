import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import { runMusicHydration } from './musicHydrationHelpers';
import { acquireNativeHydrationGate, publishNativeHydrationGate, releaseNativeHydrationGate } from '../utils/nativeHydrationGate';

interface UseMusicHydrationArgs {
  songsRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  nativeQueueRef: MutableRefObject<Song[]>;
  setIsReady: Dispatch<SetStateAction<boolean>>;
  setLibraryHydrationReady?: Dispatch<SetStateAction<boolean>>;
  setHydrationStatus?: Dispatch<SetStateAction<'loading' | 'ready' | 'degraded' | 'retry-required'>>;
  hydrationRetryToken?: number;
  setSongsState: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  setEqEnabledState: Dispatch<SetStateAction<boolean>>;
  setEqBandsState: Dispatch<SetStateAction<number[]>>;
  setEqPreset: Dispatch<SetStateAction<EqPresetName | 'custom'>>;
  setVolumeState: Dispatch<SetStateAction<number>>;
  setRepeatMode: Dispatch<SetStateAction<RepeatMode>>;
  setShuffle: Dispatch<SetStateAction<boolean>>;
}

export const useMusicHydration = ({
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setIsReady,
  setLibraryHydrationReady,
  setHydrationStatus,
  hydrationRetryToken,
  setSongsState,
  setCurrentSong,
  setPlaybackQueue,
  setPlaylists,
  setEqEnabledState,
  setEqBandsState,
  setEqPreset,
  setVolumeState,
  setRepeatMode,
  setShuffle,
}: UseMusicHydrationArgs): void => {
  useEffect(() => {
    let cancelled = false;
    const gateOwner = acquireNativeHydrationGate();
    publishNativeHydrationGate(gateOwner, 'loading');
    setIsReady(false);
    setLibraryHydrationReady?.(false);
    setHydrationStatus?.('loading');

    void runMusicHydration({
      songsRef,
      queueContextRef,
      baseQueueContextRef,
      nativeQueueRef,
      setIsReady,
      setLibraryHydrationReady,
      setHydrationStatus,
      gateOwner,
      setSongsState,
      setCurrentSong,
      setPlaybackQueue,
      setPlaylists,
      setEqEnabledState,
      setEqBandsState,
      setEqPreset,
      setVolumeState,
      setRepeatMode,
      setShuffle,
      isCancelled: () => cancelled,
    });

    return () => {
      cancelled = true;
      releaseNativeHydrationGate(gateOwner);
    };
    // Hydration must run exactly once for a provider mount. The refs and React
    // setters are stable hand-off targets for that initial run, not signals for
    // restarting persisted-state hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrationRetryToken]);
};
