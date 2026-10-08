import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { AppState } from 'react-native';
import type { Song } from '../types/Song';
import { createSongPersistenceTask } from './songPersistenceTask';
import { waitForPersistQueueIdle, type PersistQueueIdleResult, type PersistResult } from './musicPersistenceHelpers';
import { StorageKeys } from '../utils/storage';
import { createSongCheckpointWriter, type AcceptedSongSnapshot, type SongPersistenceTask } from './songCheckpointWriter';
import type { SongLibraryState } from './songLibraryState';

const useSongCheckpointPersistence = (
  isReady: boolean, snapshot: AcceptedSongSnapshot,
  currentTask: MutableRefObject<SongPersistenceTask | null>,
  inFlight: MutableRefObject<Set<Promise<PersistResult>>>,
  pendingFlush: MutableRefObject<((detached?: boolean) => void) | undefined>,
  songLibrary?: SongLibraryState,
) => {
  const accepted = useRef<AcceptedSongSnapshot | null>(null);
  if (isReady) accepted.current = snapshot;
  const writerRef = useRef<ReturnType<typeof createSongCheckpointWriter> | null>(null);
  writerRef.current ??= createSongCheckpointWriter({ accepted: () => accepted.current, currentTask, inFlight,
    onUnblocked: () => pendingFlush.current?.() });
  const writer = writerRef.current;
  songLibrary?.configurePersistence(isReady ? async (readCurrent, onConfirmed) => {
    const stored = await writer.flush(readCurrent, onConfirmed);
    if (!stored) throw new Error('Bibliothek ist noch nicht bereit. Bitte erneut versuchen.');
    return stored;
  } : undefined);
  const flushForHydration = useCallback(async (): Promise<PersistQueueIdleResult> => {
    await songLibrary?.waitForCheckpoints();
    try { await writer.flush(); }
    catch (error) { return { status: 'failed', error }; }
    const refs = accepted.current?.persistedRefs.current;
    return refs ? waitForPersistQueueIdle(StorageKeys.SONGS, refs) : { status: 'idle' };
  }, [songLibrary, writer]);
  return { writer, flushForHydration };
};

const useSongPersistenceLifecycle = (
  pendingFlush: MutableRefObject<((detached?: boolean) => void) | undefined>,
  currentTask: MutableRefObject<SongPersistenceTask | null>,
  writer: ReturnType<typeof createSongCheckpointWriter>, songLibrary?: SongLibraryState,
): void => {
  const flushLatest = useCallback(() => {
    if (songLibrary) void writer.flush().catch(error => console.warn('[usePersistedSongs] Unmount flush failed:', error));
    else {
      pendingFlush.current?.(true);
      void currentTask.current?.start(true);
    }
  }, [currentTask, pendingFlush, songLibrary, writer]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') pendingFlush.current?.();
    });
    return () => {
      flushLatest();
      subscription.remove();
    };
  }, [flushLatest, pendingFlush]);
};

export const usePersistedSongs = (
  isReady: boolean,
  songs: Song[],
  setSongsState: (songs: Song[]) => void,
  persistedRefs: MutableRefObject<Record<string, string>>,
  songLibrary?: SongLibraryState,
): (() => Promise<PersistQueueIdleResult>) => {
  const pendingFlush = useRef<((detached?: boolean) => void) | undefined>(undefined);
  const firstPendingAt = useRef<number | undefined>(undefined);
  const currentTask = useRef<SongPersistenceTask | null>(null);
  const inFlight = useRef(new Set<Promise<PersistResult>>());
  const readyRef = useRef(isReady);
  readyRef.current = isReady;
  const { writer, flushForHydration } = useSongCheckpointPersistence(isReady,
    { songs, setSongsState, persistedRefs, readCurrent: songLibrary?.getCurrent }, currentTask, inFlight, pendingFlush, songLibrary);
  useSongPersistenceLifecycle(pendingFlush, currentTask, writer, songLibrary);

  useEffect(() => {
    if (!isReady) return;
    let task = createSongPersistenceTask(songs, setSongsState, persistedRefs);
    currentTask.current = task;
    let cancelled = false;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = (flushDetached = false): void => {
      if (cancelled) return;
      if (started) {
        if (flushDetached) void task.start(true);
        return;
      }
      if (writer.isBlocked()) return;
      if (songLibrary) {
        const fresh = createSongPersistenceTask(songLibrary.getCurrent(), setSongsState, persistedRefs);
        task.cancel(); task = fresh; currentTask.current = fresh;
      }
      started = true;
      clearTimeout(timer);
      firstPendingAt.current = undefined;
      if (pendingFlush.current === flush) pendingFlush.current = undefined;
      const promise = task.start(flushDetached);
      inFlight.current.add(promise);
      void promise.then(() => { inFlight.current.delete(promise); });
    };
    pendingFlush.current = flush;
    if (songs.length >= 100) {
      firstPendingAt.current ??= Date.now();
      // Coalesce import/cover bursts before preparation and JSON serialization, with
      // a maximum wait so a continuously growing import still makes durable progress.
      const delay = Math.max(0, Math.min(350, 2000 - (Date.now() - firstPendingAt.current)));
      timer = setTimeout(flush, delay);
    } else {
      flush();
    }

    return () => {
      if (!readyRef.current) flush(true);
      cancelled = true;
      clearTimeout(timer);
      if (pendingFlush.current === flush) pendingFlush.current = undefined;
      task.cancel();
      if (currentTask.current === task) currentTask.current = null;
    };
  }, [isReady, persistedRefs, setSongsState, songLibrary, songs, writer]);

  return flushForHydration;
};
