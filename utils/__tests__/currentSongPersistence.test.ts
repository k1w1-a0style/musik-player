import {
  persistCurrentSongIdSerialized,
  resetCurrentSongPersistenceQueueForTests,
} from '../currentSongPersistence';
import { StorageKeys, storage } from '../storage';
import { resetNativeHydrationGateForTests } from '../nativeHydrationGate';

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

const mockPersistence = (initialId: string | null) => {
  let persistedId = initialId;
  let setCall = 0;
  const firstWriteStarted = deferred();
  const releaseFirstWrite = deferred();

  jest.spyOn(storage, 'get').mockImplementation((async () => persistedId) as typeof storage.get);
  const setSpy = jest.spyOn(storage, 'set').mockImplementation((async (_key: string, value: unknown) => {
    setCall += 1;
    if (setCall === 1) {
      firstWriteStarted.resolve();
      await releaseFirstWrite.promise;
    }
    persistedId = String(value);
    return true;
  }) as typeof storage.set);
  const removeSpy = jest.spyOn(storage, 'remove').mockImplementation(async () => {
    persistedId = null;
  });

  return {
    firstWriteStarted,
    releaseFirstWrite,
    getPersistedId: () => persistedId,
    setSpy,
    removeSpy,
  };
};

test('a queued successor resolves against the value committed by its predecessor', async () => {
  const persistence = mockPersistence('s1');
  const observedPreviousIds: Array<string | null> = [];

  const first = persistCurrentSongIdSerialized({ resolveDesiredId: () => 's2' });
  await persistence.firstWriteStarted.promise;
  const second = persistCurrentSongIdSerialized({
    resolveDesiredId: persistedId => {
      observedPreviousIds.push(persistedId);
      return 's3';
    },
  });
  persistence.releaseFirstWrite.resolve();

  await expect(first).resolves.toEqual({ status: 'set-confirmed' });
  await expect(second).resolves.toEqual({ status: 'set-confirmed' });
  expect(observedPreviousIds).toEqual(['s2']);
  expect(persistence.getPersistedId()).toBe('s3');
  expect(persistence.setSpy.mock.calls).toEqual([
    [StorageKeys.CURRENT_SONG_ID, 's2'],
    [StorageKeys.CURRENT_SONG_ID, 's3'],
  ]);
});

test('a caller that becomes stale during its write restores the previous value', async () => {
  const persistence = mockPersistence('s1');
  let current = true;

  const write = persistCurrentSongIdSerialized({
    isCurrent: () => current,
    resolveDesiredId: () => 's2',
  });
  await persistence.firstWriteStarted.promise;
  current = false;
  persistence.releaseFirstWrite.resolve();

  await expect(write).resolves.toEqual({ status: 'not-required' });
  expect(persistence.getPersistedId()).toBe('s1');
  expect(persistence.setSpy.mock.calls).toEqual([
    [StorageKeys.CURRENT_SONG_ID, 's2'],
    [StorageKeys.CURRENT_SONG_ID, 's1'],
  ]);
});

test('an undefined desired id is a confirmed no-op', async () => {
  const persistence = mockPersistence('s1');

  await expect(persistCurrentSongIdSerialized({
    resolveDesiredId: () => undefined,
  })).resolves.toEqual({ status: 'not-required' });

  expect(persistence.getPersistedId()).toBe('s1');
  expect(persistence.setSpy).not.toHaveBeenCalled();
  expect(persistence.removeSpy).not.toHaveBeenCalled();
});
