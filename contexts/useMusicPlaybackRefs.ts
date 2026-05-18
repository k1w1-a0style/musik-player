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

export const persistCurrentSongIdForLibrary = async (
  song: Song | null,
  songs: Song[],
): Promise<void> => {
  if (!song || !songs.some(item => item.id === song.id)) {
    await storage.remove(StorageKeys.CURRENT_SONG_ID);
    return;
  }
  await storage.set(StorageKeys.CURRENT_SONG_ID, song.id);
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
