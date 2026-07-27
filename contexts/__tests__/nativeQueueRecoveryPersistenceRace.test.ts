import type { Song } from '../../types/Song';
import {
  acquireNativeHydrationGate,
  releaseNativeHydrationGate,
  resetNativeHydrationGateForTests,
} from '../../utils/nativeHydrationGate';
import { StorageKeys, storage } from '../../utils/storage';
import {
  persistNativeCurrentSong,
  resetCurrentSongPersistenceQueueForTests,
} from '../nativeQueueRecovery';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///2.mp3' },
  { id: 's3', title: 'Three', artist: 'A', uri: 'file:///3.mp3' },
];

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

beforeEach(() => {
  resetNativeHydrationGateForTests();
  resetCurrentSongPersistenceQueueForTests();
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
  resetCurrentSongPersistenceQueueForTests();
  resetNativeHydrationGateForTests();
});

const mockPersistedCurrentSong = (initialId: string | null) => {
  let persistedId = initialId;
  let setCall = 0;
  const firstWriteStarted = deferred();
  const releaseFirstWrite = deferred();

  jest.spyOn(storage, 'get').mockImplementation((async () => persistedId) as typeof storage.get);
  const setSpy = jest.spyOn(storage, 'set');
  setSpy.mockImplementation((async (_key: string, value: unknown) => {
    setCall += 1;
    if (setCall === 1) {
      firstWriteStarted.resolve();
      await releaseFirstWrite.promise;
    }
    persistedId = String(value);
    return true;
  }) as typeof storage.set);

  return {
    firstWriteStarted,
    releaseFirstWrite,
    getPersistedId: () => persistedId,
    setSpy,
  };
};

test('an in-flight write restores the previous id when its hydration generation is released', async () => {
  const gateOwner = acquireNativeHydrationGate();
  const persistence = mockPersistedCurrentSong('s1');

  const staleWrite = persistNativeCurrentSong(songs[1], songs);
  await persistence.firstWriteStarted.promise;
  releaseNativeHydrationGate(gateOwner);
  persistence.releaseFirstWrite.resolve();

  await expect(staleWrite).resolves.toEqual({ status: 'not-required' });
  expect(persistence.getPersistedId()).toBe('s1');
  expect(persistence.setSpy.mock.calls).toEqual([
    [StorageKeys.CURRENT_SONG_ID, 's2'],
    [StorageKeys.CURRENT_SONG_ID, 's1'],
  ]);
});

test('a newer hydration generation is serialized after stale-write restoration and wins', async () => {
  acquireNativeHydrationGate();
  const persistence = mockPersistedCurrentSong('s1');

  const staleWrite = persistNativeCurrentSong(songs[1], songs);
  await persistence.firstWriteStarted.promise;

  acquireNativeHydrationGate();
  const newestWrite = persistNativeCurrentSong(songs[2], songs);
  persistence.releaseFirstWrite.resolve();

  await expect(staleWrite).resolves.toEqual({ status: 'not-required' });
  await expect(newestWrite).resolves.toEqual({ status: 'set-confirmed' });
  expect(persistence.getPersistedId()).toBe('s3');
  expect(persistence.setSpy.mock.calls).toEqual([
    [StorageKeys.CURRENT_SONG_ID, 's2'],
    [StorageKeys.CURRENT_SONG_ID, 's1'],
    [StorageKeys.CURRENT_SONG_ID, 's3'],
  ]);
});