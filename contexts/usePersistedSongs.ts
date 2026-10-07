import { useEffect, useRef, type MutableRefObject } from 'react';
import { AppState } from 'react-native';
import type { Song } from '../types/Song';
import { createSongPersistenceTask } from './songPersistenceTask';

export const usePersistedSongs = (
  isReady: boolean,
  songs: Song[],
  setSongsState: (songs: Song[]) => void,
  persistedRefs: MutableRefObject<Record<string, string>>,
): void => {
  const pendingFlush = useRef<((detached?: boolean) => void) | undefined>(undefined);
  const firstPendingAt = useRef<number | undefined>(undefined);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') pendingFlush.current?.();
    });
    return () => {
      // Start the latest pending snapshot before the snapshot effect releases its owner.
      pendingFlush.current?.(true);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const task = createSongPersistenceTask(songs, setSongsState, persistedRefs);
    let cancelled = false;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = (flushDetached = false): void => {
      if (started || cancelled) return;
      started = true;
      clearTimeout(timer);
      firstPendingAt.current = undefined;
      if (pendingFlush.current === flush) pendingFlush.current = undefined;
      task.start(flushDetached);
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
      cancelled = true;
      clearTimeout(timer);
      if (pendingFlush.current === flush) pendingFlush.current = undefined;
      task.cancel();
    };
  }, [isReady, persistedRefs, setSongsState, songs]);
};
