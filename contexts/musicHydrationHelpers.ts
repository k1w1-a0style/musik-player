import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import TrackPlayer from 'react-native-track-player';
import { EQ_BAND_COUNT, type EqPresetName, type Playlist, type RepeatMode, type Song } from '../types/Song';
import { toTrackPlayerRepeatMode } from '../utils/audioPlaybackModes';
import { sanitizeSongsForStorage } from '../utils/coverCache';
import {
  buildHydratedPlaybackQueue,
  didSongCoversChange,
  normalizeHydrationSongs,
  normalizePlaylistsForHydratedSongs,
} from '../utils/musicHydration';
import { prunePlaylists, sanitizePlaylists } from '../utils/playlistState';
import { migrateLegacySongFavoritesFromStoredSongs, StorageKeys, storage } from '../utils/storage';
import { setupTrackPlayer } from '../utils/trackPlayerSetup';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import { toPlayableSongs } from '../utils/playableSong';

export interface StoredMusicHydrationState {
  songs: Song[] | null;
  playlists: Playlist[] | null;
  eqEnabled: boolean | null;
  eqBands: number[] | null;
  eqPreset: EqPresetName | 'custom' | null;
  volume: number | null;
  repeatMode: RepeatMode | null;
  shuffle: boolean | null;
  currentSongId: string | null;
}

export interface ApplyStoredPlaybackSettingsArgs {
  stored: StoredMusicHydrationState;
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  setEqEnabledState: Dispatch<SetStateAction<boolean>>;
  setEqBandsState: Dispatch<SetStateAction<number[]>>;
  setEqPreset: Dispatch<SetStateAction<EqPresetName | 'custom'>>;
  setVolumeState: Dispatch<SetStateAction<number>>;
  setRepeatMode: Dispatch<SetStateAction<RepeatMode>>;
  setShuffle: Dispatch<SetStateAction<boolean>>;
}

export interface HydrateStoredSongsArgs {
  stored: StoredMusicHydrationState;
  songsRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  nativeQueueRef: MutableRefObject<Song[]>;
  setSongsState: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  isCancelled: () => boolean;
}

export interface RunMusicHydrationArgs extends Omit<HydrateStoredSongsArgs, 'stored'>, Omit<ApplyStoredPlaybackSettingsArgs, 'stored'> {
  setIsReady: Dispatch<SetStateAction<boolean>>;
}

export const sanitizeStoredPlaylistsForHydration = (stored: StoredMusicHydrationState): Playlist[] | null => {
  if (!stored.playlists) return null;
  if (!stored.songs) return sanitizePlaylists(stored.playlists);
  return prunePlaylists(stored.playlists, new Set(stored.songs.map(song => song.id)));
};

export const loadStoredMusicHydrationState = async (): Promise<StoredMusicHydrationState> => {
  await migrateLegacySongFavoritesFromStoredSongs();
  const [
    songs,
    playlists,
    eqEnabled,
    eqBands,
    eqPreset,
    volume,
    repeatMode,
    shuffle,
    currentSongId,
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

  return {
    songs,
    playlists,
    eqEnabled,
    eqBands,
    eqPreset,
    volume,
    repeatMode,
    shuffle,
    currentSongId,
  };
};

export const hydrateStoredSongs = async ({
  stored,
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setSongsState,
  setCurrentSong,
  setPlaybackQueue,
  isCancelled,
}: HydrateStoredSongsArgs): Promise<StoredMusicHydrationState> => {
  if (!stored.songs) return stored;

  const sanitizedSongs = await sanitizeSongsForStorage(stored.songs);
  if (isCancelled()) return stored;

  const { songs: hydratedSongs, changed: songsWereNormalized } = normalizeHydrationSongs(sanitizedSongs);

  songsRef.current = hydratedSongs;
  setSongsState(hydratedSongs);

  if (didSongCoversChange(hydratedSongs, stored.songs) || songsWereNormalized) {
    await storage.set(StorageKeys.SONGS, hydratedSongs);
    if (isCancelled()) return stored;
  }

  const {
    hydratedQueue,
    orderedQueue,
    restoredSong,
    shouldClearPersistedCurrentSongId,
  } = buildHydratedPlaybackQueue(
    hydratedSongs,
    stored.currentSongId,
    stored.shuffle ?? false,
  );
  const playableQueue = toPlayableSongs(orderedQueue);

  baseQueueContextRef.current = hydratedQueue.slice();
  queueContextRef.current = playableQueue.slice();
  setPlaybackQueue(playableQueue.slice());

  const normalizedPlaylists = stored.playlists
    ? normalizePlaylistsForHydratedSongs(stored.playlists, hydratedSongs)
    : null;
  if (normalizedPlaylists && normalizedPlaylists !== stored.playlists) {
    await storage.set(StorageKeys.PLAYLISTS, normalizedPlaylists);
    if (isCancelled()) return stored;
  }

  if (shouldClearPersistedCurrentSongId) {
    await storage.remove(StorageKeys.CURRENT_SONG_ID);
    if (isCancelled()) return stored;
  }

  const playableRestoredSong = restoredSong
    ? playableQueue.find(song => song.id === restoredSong.id)
    : undefined;
  if (restoredSong && !playableRestoredSong) {
    console.warn('[MusicHydration] Restored current song is not playable; clearing persisted current song id.', {
      songId: restoredSong.id,
    });
    await storage.remove(StorageKeys.CURRENT_SONG_ID);
    try {
      await TrackPlayer.reset();
    } catch (error) {
      console.warn('[PlaybackQueue] Failed to reset native queue after dropping malformed restored song.', error);
    }
    nativeQueueRef.current = [];
    return { ...stored, songs: hydratedSongs, playlists: normalizedPlaylists };
  }

  if (playableRestoredSong) {
    setCurrentSong(playableRestoredSong);
    if (stored.currentSongId?.trim() !== playableRestoredSong.id) {
      await storage.set(StorageKeys.CURRENT_SONG_ID, playableRestoredSong.id);
      if (isCancelled()) return stored;
    }
  }
  try {
    await TrackPlayer.reset();
    if (isCancelled()) return { ...stored, songs: hydratedSongs, playlists: normalizedPlaylists };

    if (playableQueue.length === 0) {
      console.warn('[PlaybackQueue] Hydration produced no playable songs for native queue.');
      nativeQueueRef.current = [];
      return { ...stored, songs: hydratedSongs, playlists: normalizedPlaylists };
    }
    await TrackPlayer.add(playableQueue.map(toTrackPlayerTrack));
    if (isCancelled()) return { ...stored, songs: hydratedSongs, playlists: normalizedPlaylists };

    nativeQueueRef.current = playableQueue.slice();
  } catch (error) {
    console.warn('[PlaybackQueue] Failed to initialize hydrated native queue.', error);
    nativeQueueRef.current = [];
  }

  return {
    ...stored,
    songs: hydratedSongs,
    playlists: normalizedPlaylists,
  };
};

export const applyStoredPlaybackSettings = ({
  stored,
  setPlaylists,
  setEqEnabledState,
  setEqBandsState,
  setEqPreset,
  setVolumeState,
  setRepeatMode,
  setShuffle,
}: ApplyStoredPlaybackSettingsArgs): void => {
  const sanitizedPlaylists = sanitizeStoredPlaylistsForHydration(stored);
  if (sanitizedPlaylists) {
    setPlaylists(sanitizedPlaylists);
    if (sanitizedPlaylists !== stored.playlists) {
      void storage.set(StorageKeys.PLAYLISTS, sanitizedPlaylists).catch(error => {
        console.warn('[MusicHydration] Failed to persist sanitized playlists.', error);
      });
    }
  }
  if (stored.eqEnabled != null) setEqEnabledState(stored.eqEnabled);
  if (stored.eqBands?.length === EQ_BAND_COUNT) setEqBandsState(stored.eqBands);
  if (stored.eqPreset != null) setEqPreset(stored.eqPreset);
  if (stored.volume != null) {
    setVolumeState(stored.volume);
    TrackPlayer.setVolume(stored.volume).catch(error => {
      console.warn('[Playback] Failed to apply stored volume.', error);
    });
  }
  if (stored.repeatMode != null) {
    setRepeatMode(stored.repeatMode);
    TrackPlayer.setRepeatMode(toTrackPlayerRepeatMode(stored.repeatMode)).catch(error => {
      console.warn('[Playback] Failed to apply stored repeat mode.', error);
    });
  }
  if (stored.shuffle != null) setShuffle(stored.shuffle);
};

export const runMusicHydration = async ({
  setIsReady,
  isCancelled,
  ...args
}: RunMusicHydrationArgs): Promise<void> => {
  await setupTrackPlayer();
  if (isCancelled()) return;

  const stored = await loadStoredMusicHydrationState();

  if (isCancelled()) return;

  const hydratedStored = await hydrateStoredSongs({ stored, isCancelled, ...args });

  if (isCancelled()) return;

  applyStoredPlaybackSettings({ stored: hydratedStored, ...args });
  setIsReady(true);
};
