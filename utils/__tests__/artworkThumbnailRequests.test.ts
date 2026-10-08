import { SystemAudio } from 'expo-system-audio';
import { requestArtworkThumbnail } from '../artworkThumbnailRequests';

test('limits concurrent generations, shares in-flight variants and rechecks completed disk paths', async () => {
  const complete: Array<(value: string | null) => void> = [];
  const create = SystemAudio.createArtworkThumbnail as jest.Mock;
  create.mockReset().mockImplementation(() => new Promise(resolve => { complete.push(resolve); }));
  const first = requestArtworkThumbnail('file://one', 128, '');
  expect(requestArtworkThumbnail('file://one', 128, '')).toBe(first);
  const second = requestArtworkThumbnail('file://two', 128, '');
  const third = requestArtworkThumbnail('file://three', 128, '');
  expect(create).toHaveBeenCalledTimes(2);
  complete[0]('file://small-one');
  await first;
  await Promise.resolve();
  await Promise.resolve();
  expect(create).toHaveBeenCalledTimes(3);
  complete[1](null);
  complete[2]('file://small-three');
  await Promise.all([second, third]);
  await Promise.resolve();
  const again = requestArtworkThumbnail('file://one', 128, '');
  expect(create).toHaveBeenCalledTimes(4);
  complete[3](null);
  await expect(again).resolves.toBeNull();
});
