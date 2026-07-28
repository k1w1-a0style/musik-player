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
  isCurrent?: () => boolean;
}

type CurrentSongPersistenceQueue = {
  chain: Promise<void>;
  pending: number;
};

type PrefetchedCurrentSongId =
  | { status: 'fulfilled'; value: string | null }
  | { status: 'rejected'; error: unknown };

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

const prefetchPersistedCurrentSongId = (): Promise<PrefetchedCurrentSongId> =>
  readPersistedCurrentSongId().then(
    value => ({ status: 'fulfilled', value }),
    error => ({ status: 'rejected', error }),
  );

const writePersistedCurrentSongId = async (songId: string | null): Promise<boolean> => {
  const confirmed = songId
    ? await storage.set(StorageKeys.CURRENT_SONG_ID, songId)
    : await (storage.remove(StorageKeys.CURRENT_SONG_ID) as Promise<unknown>);
  return confirmed !== false;
};

const resolvePreviousPersistedId = async (
  hadPendingPredecessor: boolean,
  knownPreviousId: string | null | undefined,
  prefetchedPreviousId: Promise<PrefetchedCurrentSongId>,
): Promise<string | null> => {
  if (hadPendingPredecessor) return readPersistedCurrentSongId();
  if (knownPreviousId !== undefined) return normalizeSongId(knownPreviousId) ?? null;
  const prefetched = await prefetchedPreviousId;
  if (prefetched.status === 'rejected') throw prefetched.error;
  return prefetched.value;
};

const normalizeDesiredId = (resolved: string | null | undefined): string | null | undefined => {
  if (resolved === undefined) return undefined;
  return normalizeSongId(resolved) ?? null;
};

const confirmedResult = (desiredId: string | null): CurrentSongPersistenceResult =>
  desiredId
    ? { status: 'set-confirmed' }
    : { status: 'remove-confirmed' };

const commitDesiredCurrentSongId = async ({
  desiredId,
  previousPersistedId,
  isRequestCurrent,
}: {
  desiredId: string | null;
  previousPersistedId: string | null;
  isRequestCurrent: () => boolean;
}): Promise<CurrentSongPersistenceResult> => {
  if (!await writePersistedCurrentSongId(desiredId)) {
    return { status: 'unconfirmed', error: new Error('Current-song persistence was not confirmed.') };
  }
  if (isRequestCurrent()) return confirmedResult(desiredId);
  if (!await writePersistedCurrentSongId(previousPersistedId)) {
    return {
      status: 'unconfirmed',
      error: new Error('Stale current-song persistence restoration was not confirmed.'),
    };
  }
  return { status: 'not-required' };
};

export const persistCurrentSongIdSerialized = async ({
  resolveDesiredId,
  knownPreviousId,
  isCurrent,
}: PersistCurrentSongIdArgs): Promise<CurrentSongPersistenceResult> => {
  const isGenerationCurrent = captureCurrentSongPersistenceGeneration();
  const isRequestCurrent = (): boolean => isGenerationCurrent() && (isCurrent?.() ?? true);
  if (!isRequestCurrent()) return { status: 'not-required' };

  const prefetchedPreviousId = knownPreviousId === undefined
    ? prefetchPersistedCurrentSongId()
    : Promise.resolve<PrefetchedCurrentSongId>({
      status: 'fulfilled',
      value: normalizeSongId(knownPreviousId) ?? null,
    });

  return enqueueCurrentSongPersistence(async hadPendingPredecessor => {
    if (!isRequestCurrent()) return { status: 'not-required' };

    let previousPersistedId: string | null;
    try {
      previousPersistedId = await resolvePreviousPersistedId(
        hadPendingPredecessor,
        knownPreviousId,
        prefetchedPreviousId,
      );
    } catch (error) {
      return { status: 'rejected', error };
    }

    if (!isRequestCurrent()) return { status: 'not-required' };

    let desiredId: string | null | undefined;
    try {
      desiredId = normalizeDesiredId(resolveDesiredId(previousPersistedId));
    } catch (error) {
      return { status: 'rejected', error };
    }

    if (desiredId === undefined) return { status: 'not-required' };

    try {
      return await commitDesiredCurrentSongId({ desiredId, previousPersistedId, isRequestCurrent });
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
