import { runSelectedLibrarySources } from '../libraryScanSources';
import { OperationAbortError } from '../withTimeout';
const song = { id: 'a', title: 'A', artist: 'B' };
const setup = () => ({ signal: new AbortController().signal, media: jest.fn().mockResolvedValue([song]),
  folders: jest.fn().mockResolvedValue([]), beginSource: jest.fn(), onSourceFailure: jest.fn() });
test.each(['media-library', 'folders'] as const)('%s never silently switches to the other source', async source => {
  const options = setup();
  await runSelectedLibrarySources({ ...options, source });
  expect(options.media).toHaveBeenCalledTimes(source === 'media-library' ? 1 : 0);
  expect(options.folders).toHaveBeenCalledTimes(source === 'folders' ? 1 : 0);
});
test('explicit both continues past an unavailable media source and retains imported folder results', async () => {
  const options = setup(); options.media.mockRejectedValue(new Error('Permission denied')); options.folders.mockResolvedValue([song]);
  expect(await runSelectedLibrarySources({ ...options, source: 'both' })).toEqual([song]);
  expect(options.onSourceFailure).toHaveBeenCalledTimes(1);
  expect(options.beginSource).toHaveBeenCalledTimes(2);
});
test('cancellation does not start the following source', async () => {
  const options = setup(); options.media.mockRejectedValue(new OperationAbortError());
  await expect(runSelectedLibrarySources({ ...options, source: 'both' })).rejects.toBeInstanceOf(OperationAbortError);
  expect(options.folders).not.toHaveBeenCalled();
});
