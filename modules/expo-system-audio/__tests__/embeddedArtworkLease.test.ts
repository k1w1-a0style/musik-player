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
