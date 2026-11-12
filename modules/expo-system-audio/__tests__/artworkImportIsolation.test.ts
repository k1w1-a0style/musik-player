test('two stalled artwork reads do not occupy the bounded import snapshot lane', async () => {
  jest.useFakeTimers(); jest.resetModules();
  const release: Array<(value: null) => void> = [];
  const artwork = jest.fn(() => new Promise<null>(resolve => release.push(resolve)));
  const snapshot = jest.fn().mockResolvedValue({ audioInfo: { durationMs: 1000 }, artwork: { checked: false, artwork: null } });
  jest.doMock('expo', () => ({ NativeModule: class {}, requireNativeModule: (name: string) => {
    if (name === 'ExpoSystemAudio') return { extractEmbeddedArtwork: artwork, extractImportSnapshot: snapshot };
    throw new Error('optional module absent');
  } }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SystemAudio } = require('../index') as typeof import('../index');
  const first = SystemAudio.extractEmbeddedArtwork('content://a');
  const second = SystemAudio.extractEmbeddedArtwork('content://b');
  await Promise.resolve(); await jest.advanceTimersByTimeAsync(20_000);
  await expect(first).resolves.toBeNull(); await expect(second).resolves.toBeNull();
  await expect(SystemAudio.extractImportSnapshot('content://healthy', false, new AbortController().signal))
    .resolves.toMatchObject({ audioInfo: { durationMs: 1000 } });
  await expect(SystemAudio.extractEmbeddedArtwork('content://c')).resolves.toBeNull();
  expect(artwork).toHaveBeenCalledTimes(2);
  release.forEach(done => done(null)); await jest.advanceTimersByTimeAsync(0);
  jest.useRealTimers(); jest.resetModules(); jest.dontMock('expo');
});
