import { parseId3FromUri } from '../id3Parser';

const mockReadAsStringAsync = jest.fn();
const mockGetInfoAsync = jest.fn();

jest.mock('expo-file-system', () => ({
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
}));

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));

describe('parseId3FromUri', () => {
  const enc = (s: string): number[] => Array.from(s).map(ch => ch.charCodeAt(0));
  const u32be = (n: number): number[] => [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const atom = (type: string, payload: number[]): number[] => [...u32be(payload.length + 8), ...enc(type), ...payload];
  const b64 = (bytes: number[]): string => Buffer.from(Uint8Array.from(bytes)).toString('base64');

  beforeEach(() => {
    mockReadAsStringAsync.mockReset();
    mockGetInfoAsync.mockReset();
  });

  test('uses mp4 parsing when URI has query params', async () => {
    const webp = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
    const data = atom('data', [0, 0, 0, 13, 0, 0, 0, 0, ...webp]);
    const moov = atom('moov', atom('udta', atom('meta', [0, 0, 0, 0, ...atom('ilst', atom('covr', data))])));
    mockReadAsStringAsync.mockResolvedValueOnce(b64(moov));

    const tags = await parseId3FromUri('file:///music/track.m4a?token=abc');
    expect(tags.cover?.startsWith('data:image/webp;base64,')).toBe(true);
    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///music/track.m4a', expect.any(Object));
  });

  test('falls back to tail read for larger mp4 files', async () => {
    // first read: no recognizable image payload
    mockReadAsStringAsync.mockResolvedValueOnce('AAAA');
    mockGetInfoAsync.mockResolvedValueOnce({ size: 2 * 1024 * 1024 });
    // second read (tail): JPEG signature
    const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0, 0];
    const tailMoov = atom('moov', atom('udta', atom('meta', [0, 0, 0, 0, ...atom('ilst', atom('covr', atom('data', [0, 0, 0, 13, 0, 0, 0, 0, ...jpeg])))])));
    mockReadAsStringAsync.mockResolvedValueOnce(b64([0x01, 0x02, 0x03, ...tailMoov]));

    const tags = await parseId3FromUri('file:///music/album.mp4?token=xyz');
    expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///music/album.mp4');
    expect(mockReadAsStringAsync).toHaveBeenCalledTimes(2);
    expect(mockReadAsStringAsync).toHaveBeenLastCalledWith(
      'file:///music/album.mp4',
      expect.objectContaining({ position: expect.any(Number) }),
    );
    expect(tags.cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });
});
