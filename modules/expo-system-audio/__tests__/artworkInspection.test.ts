import type { EmbeddedArtworkResult } from '../index';

const artwork: EmbeddedArtworkResult = { uri: 'file:///cache/staging.jpg', mimeType: 'image/jpeg', leaseId: 'receipt' };
const load = (methods?: Record<string, unknown>) => {
  jest.resetModules();
  jest.doMock('expo', () => ({
    NativeModule: class {},
    requireNativeModule: jest.fn((name: string) => {
      if (name === 'ExpoSystemAudio' && methods) return methods;
      throw new Error('native module unavailable');
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

test('distinguishes a completed empty inspection from unavailable native artwork support', async () => {
  const native = jest.fn().mockResolvedValue(null);
  const module = load({ extractEmbeddedArtwork: native });
  await expect(module.inspectEmbeddedArtwork('content://song')).resolves.toEqual({ checked: true, artwork: null });
  expect(native).toHaveBeenCalledTimes(1);
  await expect(load().inspectEmbeddedArtwork('content://song')).resolves.toEqual({ checked: false, artwork: null });
  await expect(load({}).inspectEmbeddedArtwork('content://song')).resolves.toEqual({ checked: false, artwork: null });
});

test('a provider failure leaves artwork eligible for a future inspection', async () => {
  const module = load({ extractEmbeddedArtwork: jest.fn().mockRejectedValue(new Error('provider busy')) });
  await expect(module.inspectEmbeddedArtwork('content://song')).resolves.toEqual({ checked: false, artwork: null });
});

test('pool contention never claims that native inspected the skipped document', async () => {
  let complete!: (value: null) => void;
  const native = jest.fn().mockResolvedValue(null);
  const held = new Promise<null>(resolve => { complete = resolve; });
  const module = load({ extractAudioInfo: jest.fn(() => held), extractEmbeddedArtwork: native });
  const first = module.extractAudioInfo('content://first');
  const second = module.extractAudioInfo('content://second');
  await expect(module.inspectEmbeddedArtwork('content://skipped')).resolves.toEqual({ checked: false, artwork: null });
  expect(native).not.toHaveBeenCalled();
  complete(null);
  await Promise.all([first, second]);
  await expect(module.inspectEmbeddedArtwork('content://skipped')).resolves.toEqual({ checked: true, artwork: null });
});

test('timed-out inspections keep their raw slots and release each late artwork receipt once', async () => {
  jest.useFakeTimers();
  const completions: Array<(value: EmbeddedArtworkResult) => void> = [];
  const native = jest.fn(() => new Promise<EmbeddedArtworkResult>(resolve => { completions.push(resolve); }));
  const release = jest.fn().mockResolvedValue(true);
  const module = load({ extractEmbeddedArtwork: native, releaseEmbeddedArtworkLease: release });
  const first = module.inspectEmbeddedArtwork('content://slow');
  const second = module.inspectEmbeddedArtwork('content://slow-too');
  await jest.advanceTimersByTimeAsync(20_000);
  await expect(Promise.all([first, second])).resolves.toEqual([
    { checked: false, artwork: null }, { checked: false, artwork: null },
  ]);
  await expect(module.inspectEmbeddedArtwork('content://retry')).resolves.toEqual({ checked: false, artwork: null });
  expect(native).toHaveBeenCalledTimes(2);
  completions[0]({ ...artwork, leaseId: 'receipt-first' });
  completions[1]({ ...artwork, leaseId: 'receipt-second' });
  await jest.advanceTimersByTimeAsync(0);
  expect(release).toHaveBeenCalledTimes(2);
  expect(release).toHaveBeenCalledWith('receipt-first');
  expect(release).toHaveBeenCalledWith('receipt-second');
});

test('a completed inspection transfers the staging receipt to the consumer', async () => {
  const release = jest.fn().mockResolvedValue(true);
  const module = load({ extractEmbeddedArtwork: jest.fn().mockResolvedValue(artwork), releaseEmbeddedArtworkLease: release });
  await expect(module.inspectEmbeddedArtwork('content://song')).resolves.toEqual({ checked: true, artwork });
  expect(release).not.toHaveBeenCalled();
});
