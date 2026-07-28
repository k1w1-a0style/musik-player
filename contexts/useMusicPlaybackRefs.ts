import { useCallback, useRef, type MutableRefObject } from 'react';
import type { Song } from '../types/Song';
import {
  assertCurrentSongPersistenceSucceeded,
  persistCurrentSongIdSerialized,
} from '../utils/currentSongPersistence';

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
  const existsInLibrary = !!songId
    && songs.some(item => normalizeCurrentSongIdForPersistence(item.id) === songId);
  const result = await persistCurrentSongIdSerialized({
    resolveDesiredId: () => existsInLibrary ? songId : null,
  });
  assertCurrentSongPersistenceSucceeded(result);
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
