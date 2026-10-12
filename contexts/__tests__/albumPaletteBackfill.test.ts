import SystemAudio from 'expo-system-audio';
import { storage } from '../../utils/storage';
import { hashString128 } from '../../utils/stringHash';
import { beginMetadataRefreshActivity, endMetadataRefreshActivity, resetMetadataRefreshActivityForTests } from '../../utils/metadataRefreshActivity';
import { backfillAlbumPalettes, PALETTE_BACKFILL_PER_TURN } from '../albumPaletteBackfill';
import { extractAlbumPalette, resetAlbumPaletteSingleFlightForTests, warmAlbumPalette } from '../albumPaletteHelpers';

jest.mock('../../utils/coverCache', () => ({ getManagedCoverCacheDirectory: () => 'file:///managed/covers' }));
jest.mock('../../utils/storage', () => ({ storage: { get: jest.fn(), set: jest.fn().mockResolvedValue(true) } }));
const songs = (count: number) => Array.from({ length: count }, (_, index) => ({ id: String(index), title: 'Song', artist: 'Artist',
  cover: `file:///managed/covers/${index.toString(16).padStart(32, '0')}-${hashString128('image/jpeg')}.jpg` }));
beforeEach(() => { jest.clearAllMocks(); (storage.get as jest.Mock).mockResolvedValue(null); resetAlbumPaletteSingleFlightForTests(); resetMetadataRefreshActivityForTests(); });
afterEach(resetAlbumPaletteSingleFlightForTests);

test('5000 covers dispatch at most ten candidates per UI turn and no concurrent native flights', async () => {
  let active = 0; let peak = 0; let previous = 0;
  jest.spyOn(SystemAudio, 'extractPalette').mockImplementation(async () => {
    active += 1; peak = Math.max(peak, active); await Promise.resolve(); active -= 1;
    return { vibrant: '#44ccaa' };
  });
  const yieldTurn = jest.fn(async () => {
    const calls = (SystemAudio.extractPalette as jest.Mock).mock.calls.length;
    expect(calls - previous).toBeLessThanOrEqual(PALETTE_BACKFILL_PER_TURN); previous = calls;
  });
  await backfillAlbumPalettes(songs(5000), new AbortController().signal, () => false, yieldTurn);
  expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(5000);
  expect(yieldTurn).toHaveBeenCalledTimes(500);
  expect(peak).toBe(1);
});
test('metadata scan/refresh activity blocks all optional colors, then cancel stops between candidates', async () => {
  jest.spyOn(SystemAudio, 'extractPalette').mockResolvedValue({ vibrant: '#44ccaa' });
  beginMetadataRefreshActivity();
  await warmAlbumPalette('file:///cover.jpg');
  await backfillAlbumPalettes(songs(10), new AbortController().signal, () => false, async () => undefined);
  expect(SystemAudio.extractPalette).not.toHaveBeenCalled();
  endMetadataRefreshActivity();
  const controller = new AbortController();
  await backfillAlbumPalettes(songs(50), controller.signal, () => false, async () => { controller.abort(); });
  expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(10);
});
test('optional work never queues ahead of the newest foreground cover', async () => {
  let finish!: (value: { vibrant: string }) => void;
  jest.spyOn(SystemAudio, 'extractPalette').mockReturnValueOnce(new Promise(resolve => { finish = resolve; }))
    .mockResolvedValue({ vibrant: '#44ccaa' });
  const optional = warmAlbumPalette('file:///background.jpg');
  const foreground = extractAlbumPalette('file:///current.jpg');
  await warmAlbumPalette('file:///other-background.jpg');
  finish({ vibrant: '#445566' });
  await Promise.all([optional, foreground]);
  expect(SystemAudio.extractPalette).toHaveBeenCalledTimes(2);
  expect(SystemAudio.extractPalette).toHaveBeenLastCalledWith('file:///current.jpg');
});
