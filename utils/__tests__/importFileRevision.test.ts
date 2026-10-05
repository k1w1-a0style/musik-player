import { getInfoAsync } from 'expo-file-system/legacy';
import { readImportFileRevision, sameImportFileRevision } from '../importFileRevision';

jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }));
const info = getInfoAsync as jest.Mock;
beforeEach(() => info.mockReset());

test('checks content so a same-size tag edit is detected even with an unchanged timestamp', async () => {
  info.mockResolvedValue({ exists: true, size: 1000, md5: 'new-tag-bytes' });
  const revision = await readImportFileRevision('content://provider/track', { size: 1000, modificationTime: 100 });
  expect(info).toHaveBeenCalledWith('content://provider/track', { md5: true });
  expect(sameImportFileRevision({ size: 1000, modificationTime: 100, contentHash: 'old-tag-bytes' }, revision)).toBe(false);
  expect(sameImportFileRevision(revision, revision)).toBe(true);
});

test('uses filesystem modification time for ordinary files', async () => {
  info.mockResolvedValue({ exists: true, size: 2000, md5: 'bytes', modificationTime: 200 });
  expect(await readImportFileRevision('file:///track.mp3')).toEqual({ size: 2000, contentHash: 'bytes', modificationTime: 200 });
});

test.each([undefined, { exists: false }])('unknown revision %p is not assumed unchanged', async result => {
  info.mockResolvedValue(result);
  const revision = await readImportFileRevision('content://provider/unknown');
  expect(sameImportFileRevision({}, revision)).toBe(false);
});

test('retains MediaStore hints if the content provider refuses the digest', async () => {
  info.mockRejectedValue(new Error('provider has no stream'));
  const revision = await readImportFileRevision('content://media/42', { size: 1000, modificationTime: 200 });
  expect(sameImportFileRevision({ size: 1000, modificationTime: 200 }, revision)).toBe(true);
  expect(sameImportFileRevision({ size: 1000, modificationTime: 100 }, revision)).toBe(false);
});

test('does not swallow cancellation during a revision read', async () => {
  const controller = new AbortController();
  info.mockImplementation(() => { controller.abort(new Error('cancelled')); return Promise.resolve({ exists: true }); });
  await expect(readImportFileRevision('content://provider/track', {}, controller.signal)).rejects.toThrow('cancelled');
});
