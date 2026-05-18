import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import { setupTrackPlayer } from '../utils/trackPlayerSetup';
import {
  applyStoredPlaybackSettings,
  hydrateStoredSongs,
  loadStoredMusicHydrationState,
} from './musicHydrationHelpers';

interface UseMusicHydrationArgs {
  songsRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  nativeQueueRef: MutableRefObject<Song[]>;
  setIsReady: Dispatch<SetStateAction<boolean>>;
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

    (async () => {
      await setupTrackPlayer();
      const stored = await loadStoredMusicHydrationState();

      if (cancelled) return;

      await hydrateStoredSongs({
        stored,
        songsRef,
        queueContextRef,
        baseQueueContextRef,
        nativeQueueRef,
        setSongsState,
        setCurrentSong,
        setPlaybackQueue,
        isCancelled: () => cancelled,
      });

      if (cancelled) return;

      applyStoredPlaybackSettings({
        stored,
        setPlaylists,
        setEqEnabledState,
        setEqBandsState,
        setEqPreset,
        setVolumeState,
        setRepeatMode,
        setShuffle,
      });

      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    baseQueueContextRef,
    nativeQueueRef,
    queueContextRef,
    setCurrentSong,
    setEqBandsState,
    setEqEnabledState,
    setEqPreset,
    setIsReady,
    setPlaybackQueue,
    setPlaylists,
    setRepeatMode,
    setShuffle,
    setSongsState,
    setVolumeState,
    songsRef,
  ]);
};
