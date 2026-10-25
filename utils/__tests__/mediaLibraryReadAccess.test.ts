import { ensureAudioReadAccess, isMediaLibraryReadAccessError, MediaLibraryReadAccessError } from '../mediaLibraryReadAccess';

const granted = { status: 'granted', canAskAgain: true };
const denied = { status: 'denied', canAskAgain: true };
const signal = () => new AbortController().signal;

test('requests only audio read access and checks the resulting actual grant', async () => {
  const get = jest.fn().mockResolvedValueOnce(denied).mockResolvedValue(granted);
  const request = jest.fn().mockResolvedValue(granted);
  await ensureAudioReadAccess(request, get, signal());
  expect(get.mock.calls).toEqual([[false, ['audio']], [false, ['audio']]]);
  expect(request.mock.calls).toEqual([[false, ['audio']]]);
});

test('uses a fresh grant after restart or return from settings without another prompt', async () => {
  const get = jest.fn().mockResolvedValue(granted);
  const request = jest.fn();
  await ensureAudioReadAccess(request, get, signal());
  expect(get).toHaveBeenCalledWith(false, ['audio']);
  expect(request).not.toHaveBeenCalled();
});

test.each(['denied', 'undetermined'])('rejects a %s permission response without a scan grant', async status => {
  const get = jest.fn().mockResolvedValue(denied);
  const request = jest.fn().mockResolvedValue({ status });
  await expect(ensureAudioReadAccess(request, get, signal())).rejects.toBeInstanceOf(MediaLibraryReadAccessError);
  expect(request).toHaveBeenCalledTimes(1);
});

test('permanent denial never prompts again or loops', async () => {
  const get = jest.fn().mockResolvedValue({ status: 'denied', canAskAgain: false });
  const request = jest.fn();
  await expect(ensureAudioReadAccess(request, get, signal())).rejects.toBeInstanceOf(MediaLibraryReadAccessError);
  expect(request).not.toHaveBeenCalled();
  expect(get).toHaveBeenCalledTimes(1);
});

test('an automatic update never asks for permissions even when Android permits another prompt', async () => {
  const get = jest.fn().mockResolvedValue(denied);
  const request = jest.fn();
  await expect(ensureAudioReadAccess(request, get, signal(), false)).rejects.toBeInstanceOf(MediaLibraryReadAccessError);
  expect(request).not.toHaveBeenCalled(); expect(get).toHaveBeenCalledTimes(1);
});

test('rejects an optimistic request result when the actual read grant is absent', async () => {
  const get = jest.fn().mockResolvedValue(denied);
  const request = jest.fn().mockResolvedValue(granted);
  await expect(ensureAudioReadAccess(request, get, signal())).rejects.toBeInstanceOf(MediaLibraryReadAccessError);
  expect(get).toHaveBeenCalledTimes(2);
});

test('checks permission again on a later scan after revocation', async () => {
  const get = jest.fn().mockResolvedValueOnce(granted).mockResolvedValue({ status: 'denied', canAskAgain: false });
  const request = jest.fn();
  await ensureAudioReadAccess(request, get, signal());
  await expect(ensureAudioReadAccess(request, get, signal())).rejects.toBeInstanceOf(MediaLibraryReadAccessError);
  expect(request).not.toHaveBeenCalled();
});

test('cancellation during the permission check prevents a late prompt', async () => {
  const controller = new AbortController();
  let complete!: (value: typeof denied) => void;
  const get = jest.fn(() => new Promise<typeof denied>(resolve => { complete = resolve; }));
  const request = jest.fn();
  const pending = ensureAudioReadAccess(request, get, controller.signal);
  controller.abort(); complete(denied);
  await expect(pending).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});

test('recognizes the original native rejection without hiding unrelated IO failures', () => {
  expect(isMediaLibraryReadAccessError(new Error("Call to function 'ExpoMediaLibrary.getAssetsAsync' has been rejected. Missing MEDIA_LIBRARY permissions."))).toBe(true);
  expect(isMediaLibraryReadAccessError(new Error("ExpoMediaLibrary.getAssetsAsync rejected: SecurityException Permission Denial: reading MediaProvider requires android.permission.READ_MEDIA_AUDIO"))).toBe(true);
  expect(isMediaLibraryReadAccessError(new Error('SAF SecurityException Permission Denial'))).toBe(false);
  expect(isMediaLibraryReadAccessError(new Error('SAF provider readback failed'))).toBe(false);
  expect(isMediaLibraryReadAccessError(new Error('database full'))).toBe(false);
});
