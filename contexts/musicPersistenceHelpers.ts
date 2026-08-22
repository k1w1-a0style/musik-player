import { EQ_BAND_COUNT, EQ_PRESETS, type EqPresetName, type Playlist, type RepeatMode, type Song } from '../types/Song';
import { sanitizeSongsForStorage } from '../utils/coverCache';
import type { CoverCacheProtection } from '../utils/coverCacheCleanup';
import { didSongCoversChange } from '../utils/musicHydration';
import { sanitizePlaylists } from '../utils/playlistState';
import { normalizeFavoriteSongIds, StorageKeys, storage } from '../utils/storage';

const clampVolume = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 1;

const isRepeatMode = (value: unknown): value is RepeatMode =>
  value === 'off' || value === 'one' || value === 'all';

const isEqPresetName = (value: unknown): value is EqPresetName =>
  typeof value === 'string' && value in EQ_PRESETS;

const normalizeEqBands = (value: unknown): number[] =>
  Array.isArray(value) &&
  value.length === EQ_BAND_COUNT &&
  value.every(item => typeof item === 'number' && Number.isFinite(item))
    ? value
    : [...EQ_PRESETS.flat];

export const normalizePersistedValue = <T,>(key: string, value: T): T => {
  if (key === StorageKeys.PLAYLISTS && Array.isArray(value)) {
    return sanitizePlaylists(value as Playlist[]) as T;
  }
  if (key === StorageKeys.FAVORITE_SONG_IDS) {
    return normalizeFavoriteSongIds(value) as T;
  }
  if (key === StorageKeys.VOLUME) {
    return clampVolume(value) as T;
  }
  if (key === StorageKeys.REPEAT_MODE) {
    return (isRepeatMode(value) ? value : 'off') as T;
  }
  if (key === StorageKeys.EQ_BANDS) {
    return normalizeEqBands(value) as T;
  }
  if (key === StorageKeys.EQ_PRESET) {
    return (isEqPresetName(value) || value === 'custom' ? value : 'flat') as T;
  }
  if (key === StorageKeys.EQ_ENABLED || key === StorageKeys.SHUFFLE) {
    return (typeof value === 'boolean' ? value : false) as T;
  }
  return value;
};

export type PersistResult =
  | { status: 'stored' }
  | { status: 'unchanged' }
  | { status: 'superseded' }
  | { status: 'dropped' }
  | { status: 'failed'; error?: unknown };

interface PendingPersistRequest {
  serialized: string;
  value: unknown;
  resolve: Array<(result: PersistResult) => void>;
}

interface PersistQueueState {
  inFlight: boolean;
  pendingRequest?: PendingPersistRequest;
  drainPromise?: Promise<void>;
}

const persistQueues = new WeakMap<Record<string, string>, Map<string, PersistQueueState>>();

const getPersistQueueState = (
  persistedRefs: Record<string, string>,
  key: string,
): PersistQueueState => {
  let queuesByKey = persistQueues.get(persistedRefs);
  if (!queuesByKey) {
    queuesByKey = new Map<string, PersistQueueState>();
    persistQueues.set(persistedRefs, queuesByKey);
  }

  let queueState = queuesByKey.get(key);
  if (!queueState) {
    queueState = { inFlight: false };
    queuesByKey.set(key, queueState);
  }
  return queueState;
};

const resolveRequest = (request: PendingPersistRequest, result: PersistResult): void => {
  request.resolve.forEach(resolve => resolve(result));
};

const drainPersistQueue = async (
  key: string,
  persistedRefs: Record<string, string>,
  queueState: PersistQueueState,
): Promise<void> => {
  if (queueState.inFlight) return queueState.drainPromise ?? Promise.resolve();

  queueState.inFlight = true;
  try {
    while (queueState.pendingRequest) {
      const request = queueState.pendingRequest;
      queueState.pendingRequest = undefined;

      if (persistedRefs[key] === request.serialized) {
        resolveRequest(request, { status: 'unchanged' });
        continue;
      }

      try {
        const confirmed = await storage.set(key, request.value);
        if (confirmed !== true) {
          console.warn('[MusicPersistence] Failed to persist setting.', { key, error: undefined });
          resolveRequest(request, { status: 'failed' });
          continue;
        }
        persistedRefs[key] = request.serialized;
        const nextRequest = queueState.pendingRequest as PendingPersistRequest | undefined;
        if (nextRequest?.serialized === request.serialized) {
          request.resolve.push(...nextRequest.resolve);
          queueState.pendingRequest = undefined;
        }

        resolveRequest(request, queueState.pendingRequest === undefined
          ? { status: 'stored' }
          : { status: 'superseded' });
      } catch (error) {
        console.warn('[MusicPersistence] Failed to persist setting.', { key, error });
        resolveRequest(request, { status: 'failed', error });
      }
    }
  } finally {
    queueState.inFlight = false;
    queueState.drainPromise = undefined;
  }
};

export const persistIfChanged = async <T,>(
  key: string,
  value: T,
  persistedRefs: Record<string, string>,
): Promise<PersistResult> => {
  const normalizedValue = normalizePersistedValue(key, value);
  const serialized = JSON.stringify(normalizedValue);
  const queueState = getPersistQueueState(persistedRefs, key);

  if (persistedRefs[key] === serialized && queueState.pendingRequest === undefined && !queueState.inFlight) {
    return { status: 'unchanged' };
  }

  const resultPromise = new Promise<PersistResult>(resolve => {
    if (queueState.pendingRequest?.serialized === serialized) {
      queueState.pendingRequest.resolve.push(resolve);
      return;
    }

    if (queueState.pendingRequest) {
      resolveRequest(queueState.pendingRequest, { status: 'dropped' });
    }

    queueState.pendingRequest = {
      serialized,
      value: normalizedValue,
      resolve: [resolve],
    };
  });

  queueState.drainPromise ??= drainPersistQueue(key, persistedRefs, queueState);
  return resultPromise;
};

/** Waits until all writes already queued for a key have reached a terminal result. */
export const waitForPersistQueueIdle = async (
  key: string,
  persistedRefs: Record<string, string>,
): Promise<void> => {
  const queueState = getPersistQueueState(persistedRefs, key);
  while (queueState.inFlight || queueState.pendingRequest) {
    queueState.drainPromise ??= drainPersistQueue(key, persistedRefs, queueState);
    await queueState.drainPromise;
  }
};

export const prepareSongsForPersistence = async (
  songs: Song[],
  coverProtection?: CoverCacheProtection,
): Promise<{ sanitizedSongs: Song[]; coversChanged: boolean }> => {
  const sanitizedSongs = await sanitizeSongsForStorage(songs, coverProtection);
  return {
    sanitizedSongs,
    coversChanged: didSongCoversChange(sanitizedSongs, songs),
  };
};
