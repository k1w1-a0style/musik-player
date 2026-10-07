import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { AppState } from 'react-native';
import type { Song } from '../types/Song';
import { createSongPersistenceTask } from './songPersistenceTask';
import { waitForPersistQueueIdle, type PersistQueueIdleResult, type PersistResult } from './musicPersistenceHelpers';
import { StorageKeys } from '../utils/storage';

interface AcceptedSongSnapshot {
  songs: Song[];
  setSongsState: (songs: Song[]) => void;
  persistedRefs: MutableRefObject<Record<string, string>>;
}

type SongPersistenceTask = ReturnType<typeof createSongPersistenceTask>;

const useSongHydrationFlush = (
  isReady: boolean,
  snapshot: AcceptedSongSnapshot,
  currentTask: MutableRefObject<SongPersistenceTask | null>,
  inFlight: MutableRefObject<Set<Promise<PersistResult>>>,
) => {
  const latestAccepted = useRef<AcceptedSongSnapshot | null>(null);
  if (isReady) latestAccepted.current = snapshot;
  return useCallback(async (): Promise<PersistQueueIdleResult> => {
    const snapshot = latestAccepted.current;
    if (!snapshot) return { status: 'idle' };
    // Cancel preparatory work before the durable flush, so no older task can
    // enqueue a stale snapshot after it. Writes already queued retain their lock.
    currentTask.current?.cancel();
    // Background/readiness flushes can still be preparing covers before they
    // enter the storage queue. Settle those too, then commit the newest snapshot.
    while (inFlight.current.size) await Promise.all(inFlight.current);
    const task = createSongPersistenceTask(snapshot.songs, snapshot.setSongsState, snapshot.persistedRefs);
    const promise = task.start(true);
    inFlight.current.add(promise);
    void promise.then(() => { inFlight.current.delete(promise); });
    const result = await promise;
    if (result.status !== 'stored' && result.status !== 'unchanged') {
      return result.status === 'failed' ? result : { status: 'failed' };
    }
    return waitForPersistQueueIdle(StorageKeys.SONGS, snapshot.persistedRefs.current);
  }, [currentTask, inFlight]);
};

export const usePersistedSongs = (
  isReady: boolean,
  songs: Song[],
  setSongsState: (songs: Song[]) => void,
  persistedRefs: MutableRefObject<Record<string, string>>,
): (() => Promise<PersistQueueIdleResult>) => {
  const pendingFlush = useRef<((detached?: boolean) => void) | undefined>(undefined);
  const firstPendingAt = useRef<number | undefined>(undefined);
  const currentTask = useRef<SongPersistenceTask | null>(null);
  const inFlight = useRef(new Set<Promise<PersistResult>>());
  const readyRef = useRef(isReady);
  readyRef.current = isReady;
  const flushForHydration = useSongHydrationFlush(isReady, { songs, setSongsState, persistedRefs }, currentTask, inFlight);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') pendingFlush.current?.();
    });
    return () => {
      // Start the latest pending snapshot before the snapshot effect releases its owner.
      pendingFlush.current?.(true);
      // Preparation may already have started and removed the pending callback.
      void currentTask.current?.start(true);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const task = createSongPersistenceTask(songs, setSongsState, persistedRefs);
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
  }, [isReady, persistedRefs, setSongsState, songs]);

  return flushForHydration;
};
