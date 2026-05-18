import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import { sanitizeSongsForStorage } from '../utils/coverCache';
import {
  buildHydratedPlaybackQueue,
  didSongCoversChange,
} from '../utils/musicHydration';
import { StorageKeys, storage } from '../utils/storage';
import { setupTrackPlayer } from '../utils/trackPlayerSetup';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import {
  applyStoredPlaybackSettings,
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

      if (stored.songs) {
        const sanitizedSongs = await sanitizeSongsForStorage(stored.songs);
        if (cancelled) return;

        songsRef.current = sanitizedSongs;
        setSongsState(sanitizedSongs);

        if (didSongCoversChange(sanitizedSongs, stored.songs)) {
          await storage.set(StorageKeys.SONGS, sanitizedSongs);
        }

        const {
          hydratedQueue,
          orderedQueue,
          restoredSong,
          shouldClearPersistedCurrentSongId,
        } = buildHydratedPlaybackQueue(
          sanitizedSongs,
          stored.currentSongId,
          stored.shuffle ?? false,
        );

        baseQueueContextRef.current = hydratedQueue.slice();
        queueContextRef.current = orderedQueue;
        setPlaybackQueue(orderedQueue);

        if (shouldClearPersistedCurrentSongId) {
          await storage.remove(StorageKeys.CURRENT_SONG_ID);
        }

        if (restoredSong) {
          setCurrentSong(restoredSong);
          try {
            await TrackPlayer.reset();
            await TrackPlayer.add(orderedQueue.map(toTrackPlayerTrack));
            nativeQueueRef.current = orderedQueue.slice();
          } catch {
            // ignore hydration queue init failures
          }
        }
      }

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
