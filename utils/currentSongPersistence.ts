import { getNativeHydrationGate } from './nativeHydrationGate';
import { StorageKeys, storage } from './storage';

export type CurrentSongPersistenceStatus =
  | 'set-confirmed'
  | 'remove-confirmed'
  | 'not-required'
  | 'unconfirmed'
  | 'rejected';

export interface CurrentSongPersistenceResult {
  status: CurrentSongPersistenceStatus;
  error?: unknown;
}

export interface PersistCurrentSongIdArgs {
  resolveDesiredId: (persistedId: string | null) => string | null | undefined;
  knownPreviousId?: string | null;
}

type CurrentSongPersistenceQueue = {
  chain: Promise<void>;
  pending: number;
};

const currentSongPersistenceQueue: CurrentSongPersistenceQueue = {
  chain: Promise.resolve(),
  pending: 0,
};

const normalizeSongId = (value: unknown): string | undefined => {
  const id = String(value ?? '').trim();
  return id || undefined;
};

const enqueueCurrentSongPersistence = async <T,>(
  operation: (hadPendingPredecessor: boolean) => Promise<T>,
): Promise<T> => {
  const hadPendingPredecessor = currentSongPersistenceQueue.pending > 0;
  currentSongPersistenceQueue.pending += 1;
  const run = currentSongPersistenceQueue.chain
    .catch(() => undefined)
    .then(() => operation(hadPendingPredecessor));
  currentSongPersistenceQueue.chain = run.then(() => undefined, () => undefined);
  try {
    return await run;
  } finally {
    currentSongPersistenceQueue.pending -= 1;
  }
};

export const resetCurrentSongPersistenceQueueForTests = (): void => {
  currentSongPersistenceQueue.chain = Promise.resolve();
  currentSongPersistenceQueue.pending = 0;
};

const captureCurrentSongPersistenceGeneration = (): (() => boolean) => {
  const captured = getNativeHydrationGate();
  return () => {
    const current = getNativeHydrationGate();
    return current.generation === captured.generation && current.owned === captured.owned;
  };
};

const readPersistedCurrentSongId = async (): Promise<string | null> =>
  normalizeSongId(await storage.get(StorageKeys.CURRENT_SONG_ID)) ?? null;

const writePersistedCurrentSongId = async (songId: string | null): Promise<boolean> => {
  const confirmed = songId
    ? await storage.set(StorageKeys.CURRENT_SONG_ID, songId)
    : await (storage.remove(StorageKeys.CURRENT_SONG_ID) as Promise<unknown>);
  return confirmed !== false;
};

export const persistCurrentSongIdSerialized = async ({
  resolveDesiredId,
  knownPreviousId,
}: PersistCurrentSongIdArgs): Promise<CurrentSongPersistenceResult> => {
  const isGenerationCurrent = captureCurrentSongPersistenceGeneration();

  return enqueueCurrentSongPersistence(async hadPendingPredecessor => {
    if (!isGenerationCurrent()) return { status: 'not-required' };

    let previousPersistedId: string | null;
    try {
      previousPersistedId = !hadPendingPredecessor && knownPreviousId !== undefined
        ? normalizeSongId(knownPreviousId) ?? null
        : await readPersistedCurrentSongId();
    } catch (error) {
      return { status: 'rejected', error };
    }

    if (!isGenerationCurrent()) return { status: 'not-required' };

    let desiredId: string | null | undefined;
    try {
      const resolved = resolveDesiredId(previousPersistedId);
      desiredId = resolved === undefined ? undefined : normalizeSongId(resolved) ?? null;
    } catch (error) {
      return { status: 'rejected', error };
    }

    if (desiredId === undefined || desiredId === previousPersistedId) {
      return { status: 'not-required' };
    }

    try {
      if (!await writePersistedCurrentSongId(desiredId)) {
        return { status: 'unconfirmed', error: new Error('Current-song persistence was not confirmed.') };
      }
      if (isGenerationCurrent()) {
        return { status: desiredId ? 'set-confirmed' : 'remove-confirmed' };
      }
      if (!await writePersistedCurrentSongId(previousPersistedId)) {
        return {
          status: 'unconfirmed',
          error: new Error('Stale current-song persistence restoration was not confirmed.'),
        };
      }
      return { status: 'not-required' };
    } catch (error) {
      return { status: 'rejected', error };
    }
  });
};

export const assertCurrentSongPersistenceSucceeded = (
  result: CurrentSongPersistenceResult,
): void => {
  if (result.status !== 'rejected' && result.status !== 'unconfirmed') return;
  if (result.error instanceof Error) throw result.error;
  throw new Error('Current-song persistence failed.');
};
