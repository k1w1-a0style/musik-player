import type { EmbeddedArtworkResult } from '../index';

const artwork: EmbeddedArtworkResult = { uri: 'file:///cache/staging.jpg', mimeType: 'image/jpeg', leaseId: 'owned-lease' };

const loadModule = (methods: Record<string, unknown>) => {
  jest.resetModules();
  jest.doMock('expo', () => ({
    NativeModule: class {},
    requireNativeModule: jest.fn((name: string) => {
      if (name === 'ExpoSystemAudio') return methods;
      throw new Error('optional module absent');
    }),
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../index') as typeof import('../index')).SystemAudio;
};

afterEach(() => {
  jest.useRealTimers();
  jest.resetModules();
  jest.dontMock('expo');
});

test('transfers a successful receipt to its consumer without releasing it early', async () => {
  const release = jest.fn().mockResolvedValue(true);
  const module = loadModule({ extractEmbeddedArtwork: jest.fn().mockResolvedValue(artwork), releaseEmbeddedArtworkLease: release });
  await expect(module.extractEmbeddedArtwork('content://music/one.mp3')).resolves.toEqual(artwork);
  expect(release).not.toHaveBeenCalled();
  await expect(module.releaseEmbeddedArtworkLease(artwork.leaseId)).resolves.toBe(true);
  expect(release).toHaveBeenCalledWith('owned-lease');
  await expect(module.releaseEmbeddedArtworkLease()).resolves.toBe(false);
  expect(release).toHaveBeenCalledTimes(1);
});

test('keeps the legacy APK contract when native leases are unavailable', async () => {
  const legacyArtwork = { uri: artwork.uri, mimeType: artwork.mimeType };
  const module = loadModule({ extractEmbeddedArtwork: jest.fn().mockResolvedValue(legacyArtwork) });
  await expect(module.extractEmbeddedArtwork('content://music/one.mp3')).resolves.toEqual(legacyArtwork);
  await expect(module.releaseEmbeddedArtworkLease('unknown')).resolves.toBe(false);
});

test('release bridge errors do not replace a successful cover copy result', async () => {
  const module = loadModule({ extractEmbeddedArtwork: jest.fn().mockResolvedValue(artwork),
    releaseEmbeddedArtworkLease: jest.fn(() => { throw new Error('bridge gone'); }) });
  await expect(module.extractEmbeddedArtwork('content://music/one.mp3')).resolves.toEqual(artwork);
  await expect(module.releaseEmbeddedArtworkLease(artwork.leaseId)).resolves.toBe(false);
});

test('swallows an asynchronous release rejection after dispatching cleanup', async () => {
  const release = jest.fn().mockRejectedValue(new Error('module destroyed'));
  const module = loadModule({ releaseEmbeddedArtworkLease: release });
  await expect(module.releaseEmbeddedArtworkLease(artwork.leaseId)).resolves.toBe(false);
  expect(release).toHaveBeenCalledWith('owned-lease');
});

test('releases a late native receipt after the module safety deadline discards it', async () => {
  jest.useFakeTimers();
  let complete!: (value: EmbeddedArtworkResult) => void;
  const release = jest.fn().mockResolvedValue(true);
  const module = loadModule({ extractEmbeddedArtwork: jest.fn(() => new Promise(resolve => { complete = resolve; })),
    releaseEmbeddedArtworkLease: release });
  const pending = module.extractEmbeddedArtwork('content://music/one.mp3');
  await jest.advanceTimersByTimeAsync(20_000);
  await expect(pending).resolves.toBeNull();
  expect(release).not.toHaveBeenCalled();
  complete(artwork);
  await jest.advanceTimersByTimeAsync(0);
  expect(release).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledWith('owned-lease');
});

test('releases exactly once when native completion shares the timeout tick', async () => {
  jest.useFakeTimers();
  const release = jest.fn().mockResolvedValue(true);
  const module = loadModule({ extractEmbeddedArtwork: jest.fn(() => new Promise(resolve => {
    setTimeout(() => resolve(artwork), 20_000);
  })), releaseEmbeddedArtworkLease: release });
  const pending = module.extractEmbeddedArtwork('content://music/one.mp3');
  await jest.advanceTimersByTimeAsync(20_000);
  const outcome = await pending;
  if (outcome) await module.releaseEmbeddedArtworkLease(outcome.leaseId);
  expect(release).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledWith('owned-lease');
});

test('combined import snapshot keeps the consumer lease and supports older APKs', async () => {
  const release = jest.fn().mockResolvedValue(true);
  const snapshot = { audioInfo: { durationMs: 1000 }, artwork: { checked: true, artwork } };
  const read = jest.fn().mockResolvedValue(snapshot);
  const module = loadModule({ extractImportSnapshot: read, releaseEmbeddedArtworkLease: release });
  await expect(module.extractImportSnapshot('content://one.mp3', true)).resolves.toEqual(snapshot);
  expect(read).toHaveBeenCalledWith('content://one.mp3', true);
  expect(release).not.toHaveBeenCalled();
  const older = loadModule({ extractAudioInfo: jest.fn() });
  await expect(older.extractImportSnapshot('content://one.mp3', true)).resolves.toBeNull();
});

test('combined snapshot reclaims a late discarded receipt and never confirms absence on timeout', async () => {
  jest.useFakeTimers();
  let complete!: (value: unknown) => void;
  const release = jest.fn().mockResolvedValue(true);
  const read = jest.fn(() => new Promise(resolve => { complete = resolve; }));
  const module = loadModule({ extractImportSnapshot: read, releaseEmbeddedArtworkLease: release });
  const pending = module.extractImportSnapshot('content://one.mp3', true);
  await jest.advanceTimersByTimeAsync(20_000);
  await expect(pending).resolves.toEqual({ audioInfo: null, artwork: { checked: false, artwork: null } });
  expect(release).not.toHaveBeenCalled();
  complete({ audioInfo: null, artwork: { checked: true, artwork } });
  await jest.advanceTimersByTimeAsync(0);
  expect(release).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledWith(artwork.leaseId);
});

test('combined native rejection remains retryable and unchecked', async () => {
  const module = loadModule({ extractImportSnapshot: jest.fn().mockRejectedValue(new Error('provider failed')) });
  await expect(module.extractImportSnapshot('content://one.mp3', true)).resolves.toEqual({
    audioInfo: null, artwork: { checked: false, artwork: null },
  });
});
