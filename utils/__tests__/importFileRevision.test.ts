import { getInfoAsync } from 'expo-file-system/legacy';
import { SystemAudio } from 'expo-system-audio';
import { readImportFileRevision, sameImportFileRevision } from '../importFileRevision';

jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }));
const info = getInfoAsync as jest.Mock;
const stat = SystemAudio.readImportFileStat as jest.Mock;
beforeEach(() => { info.mockReset(); stat.mockReset(); });

test('a folder revision check reads only the provider stat, never the audio stream', async () => {
  stat.mockResolvedValue({ size: 20_000_000, modificationTime: 1_700_000_000_000 });
  const revision = await readImportFileRevision('content://provider/document/music.mp3');
  expect(revision).toEqual({ size: 20_000_000, modificationTime: 1_700_000_000_000 });
  expect(stat).toHaveBeenCalled();
  expect(info).not.toHaveBeenCalled();
});

test('checks content so a same-size tag edit is detected even with an unchanged timestamp', async () => {
  info.mockResolvedValue({ exists: true, size: 1000, md5: 'new-tag-bytes' });
  const revision = await readImportFileRevision('content://provider/track', { size: 1000, modificationTime: 100 }, undefined,
    { verifyContent: true });
  expect(info).toHaveBeenCalledWith('content://provider/track', { md5: true });
  expect(sameImportFileRevision({ size: 1000, modificationTime: 100, contentHash: 'old-tag-bytes' }, revision)).toBe(false);
  expect(sameImportFileRevision(revision, revision)).toBe(true);
});

test('uses filesystem modification time for ordinary files', async () => {
  stat.mockResolvedValue({ size: 2000, modificationTime: 200 });
  expect(await readImportFileRevision('file:///track.mp3')).toEqual({ size: 2000, modificationTime: 200 });
  expect(info).not.toHaveBeenCalled();
});

test.each([undefined, null])('unknown revision %p is not assumed unchanged', async result => {
  stat.mockResolvedValue(result);
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
  await expect(readImportFileRevision('content://provider/track', {}, controller.signal, { verifyContent: true })).rejects.toThrow('cancelled');
});

test('a Quick Scan does not hash provider audio when its timestamp is absent or zero', async () => {
  stat.mockResolvedValue({ size: 40_000_000, modificationTime: 0 });
  const revision = await readImportFileRevision('content://provider/undated.mp3');
  expect(revision).toEqual({ size: 40_000_000, modificationTime: undefined });
  expect(sameImportFileRevision({ size: 40_000_000 }, revision)).toBe(false);
  expect(info).not.toHaveBeenCalled();
  expect(sameImportFileRevision({ size: 40_000_000, modificationTime: 0 }, { size: 40_000_000, modificationTime: 0 })).toBe(false);
});

test('complete MediaStore hints need no additional provider query', async () => {
  expect(await readImportFileRevision('content://media/42', { size: 2000, modificationTime: 100 }))
    .toEqual({ size: 2000, modificationTime: 100 });
  expect(stat).not.toHaveBeenCalled();
  expect(info).not.toHaveBeenCalled();
});

test('provider errors preserve partial hints without opening an audio stream', async () => {
  stat.mockRejectedValue(new Error('permission denied'));
  expect(await readImportFileRevision('content://provider/42', { size: 100 })).toEqual({ size: 100 });
  expect(info).not.toHaveBeenCalled();
});
