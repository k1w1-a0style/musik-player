import { useCallback, useRef, type MutableRefObject } from 'react';
import type { Song } from '../types/Song';
import { StorageKeys, storage } from '../utils/storage';

export interface MusicPlaybackRefs {
  songsRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  nativeQueueRef: MutableRefObject<Song[]>;
  persistCurrentSongId: (song: Song | null) => Promise<void>;
}

export const normalizeCurrentSongIdForPersistence = (songId: unknown): string | undefined => {
  if (typeof songId !== 'string') return undefined;
  const trimmed = songId.trim();
  return trimmed || undefined;
};

export const persistCurrentSongIdForLibrary = async (
  song: Song | null,
  songs: Song[],
): Promise<void> => {
  const songId = normalizeCurrentSongIdForPersistence(song?.id);
  if (!songId) {
    await storage.remove(StorageKeys.CURRENT_SONG_ID);
    return;
  }

  const existsInLibrary = songs.some(item => normalizeCurrentSongIdForPersistence(item.id) === songId);
  if (!existsInLibrary) {
    await storage.remove(StorageKeys.CURRENT_SONG_ID);
    return;
  }

  await storage.set(StorageKeys.CURRENT_SONG_ID, songId);
};

export const useMusicPlaybackRefs = (songs: Song[]): MusicPlaybackRefs => {
  const songsRef = useRef(songs);
  songsRef.current = songs;
  const queueContextRef = useRef<Song[]>([]);
  const baseQueueContextRef = useRef<Song[]>([]);
  const nativeQueueRef = useRef<Song[]>([]);

  const persistCurrentSongId = useCallback(
    async (song: Song | null): Promise<void> => {
      await persistCurrentSongIdForLibrary(song, songsRef.current);
    },
    [songsRef],
  );

  return {
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    persistCurrentSongId,
  };
};