import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import TrackPlayer from 'react-native-track-player';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import { sanitizeSongsForStorage } from '../utils/coverCache';
import {
  buildHydratedPlaybackQueue,
  didSongCoversChange,
} from '../utils/musicHydration';
import { StorageKeys, storage } from '../utils/storage';
import { toTrackPlayerRepeatMode } from '../utils/audioPlaybackModes';
import { setupTrackPlayer } from '../utils/trackPlayerSetup';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';

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

      const [
        storedSongs,
        storedPlaylists,
        storedEqEnabled,
        storedEqBands,
        storedEqPreset,
        storedVolume,
        storedRepeat,
        storedShuffle,
        storedCurrentSongId,
      ] = await Promise.all([
        storage.get<Song[]>(StorageKeys.SONGS),
        storage.get<Playlist[]>(StorageKeys.PLAYLISTS),
        storage.get<boolean>(StorageKeys.EQ_ENABLED),
        storage.get<number[]>(StorageKeys.EQ_BANDS),
        storage.get<EqPresetName | 'custom'>(StorageKeys.EQ_PRESET),
        storage.get<number>(StorageKeys.VOLUME),
        storage.get<RepeatMode>(StorageKeys.REPEAT_MODE),
        storage.get<boolean>(StorageKeys.SHUFFLE),
        storage.get<string>(StorageKeys.CURRENT_SONG_ID),
      ]);

      if (cancelled) return;

      if (storedSongs) {
        const sanitizedSongs = await sanitizeSongsForStorage(storedSongs);
        if (cancelled) return;

        songsRef.current = sanitizedSongs;
        setSongsState(sanitizedSongs);

        if (didSongCoversChange(sanitizedSongs, storedSongs)) {
          await storage.set(StorageKeys.SONGS, sanitizedSongs);
        }

        const {
          hydratedQueue,
          orderedQueue,
          restoredSong,
          shouldClearPersistedCurrentSongId,
        } = buildHydratedPlaybackQueue(sanitizedSongs, storedCurrentSongId, storedShuffle ?? false);

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

      if (storedPlaylists) setPlaylists(storedPlaylists);
      if (storedEqEnabled != null) setEqEnabledState(storedEqEnabled);
      if (storedEqBands) setEqBandsState(storedEqBands);
      if (storedEqPreset) setEqPreset(storedEqPreset);
      if (storedVolume != null) {
        setVolumeState(storedVolume);
        TrackPlayer.setVolume(storedVolume).catch(() => undefined);
      }
      if (storedRepeat) {
        setRepeatMode(storedRepeat);
        TrackPlayer.setRepeatMode(toTrackPlayerRepeatMode(storedRepeat)).catch(() => undefined);
      }
      if (storedShuffle != null) setShuffle(storedShuffle);

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
