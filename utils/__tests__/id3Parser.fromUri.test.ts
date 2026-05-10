import { parseId3FromUri } from '../id3Parser';

const mockReadAsStringAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockFileBytes = jest.fn();

jest.mock('expo-file-system', () => ({
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  File: class {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    bytes() { return mockFileBytes(); }
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));

describe('parseId3FromUri', () => {
  const enc = (s: string): number[] => Array.from(s).map(ch => ch.charCodeAt(0));
  const u32be = (n: number): number[] => [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const synchsafe = (n: number): number[] => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
  const atom = (type: string, payload: number[]): number[] => [...u32be(payload.length + 8), ...enc(type), ...payload];
  const b64 = (bytes: number[]): string => Buffer.from(Uint8Array.from(bytes)).toString('base64');
  const id3TextFrame = (id: string, text: string): number[] => {
    const body = [0x00, ...enc(text)];
    return [...enc(id), ...u32be(body.length), 0, 0, ...body];
  };
  const buildId3 = (frames: number[][]): string => {
    const flat = frames.flat();
    const header = [...enc('ID3'), 3, 0, 0, ...synchsafe(flat.length)];
    return b64([...header, ...flat]);
  };

  beforeEach(() => {
    mockReadAsStringAsync.mockReset();
    mockGetInfoAsync.mockReset();
    mockFileBytes.mockReset();
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
    mockReadAsStringAsync.mockResolvedValueOnce(b64(new Array(3005).fill(0x01).concat(tailMoov)));

    const tags = await parseId3FromUri('file:///music/album.mp4?token=xyz');
    expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///music/album.mp4');
    expect(mockReadAsStringAsync).toHaveBeenCalledTimes(2);
    expect(mockReadAsStringAsync).toHaveBeenLastCalledWith(
      'file:///music/album.mp4',
      expect.objectContaining({ position: expect.any(Number) }),
    );
    expect(tags.cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });


  test('tail read remains untrusted and does not skip fake printable header before real moov', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce('AAAA');
    mockGetInfoAsync.mockResolvedValueOnce({ size: 2 * 1024 * 1024 });
    const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0, 0];
    const fakeHeader = [0, 0, 0, 0x40, 0x7a, 0x7a, 0x7a, 0x7a, ...new Array(56).fill(0x00)];
    const tailMoov = atom('moov', atom('udta', atom('meta', [0, 0, 0, 0, ...atom('ilst', atom('covr', atom('data', [0, 0, 0, 13, 0, 0, 0, 0, ...jpeg])))])));
    mockReadAsStringAsync.mockResolvedValueOnce(b64([...fakeHeader, ...tailMoov]));

    const tags = await parseId3FromUri('file:///music/tail-untrusted.mp4?token=xyz');
    expect(tags.cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  test('returns parsed head tags when getInfoAsync fails', async () => {
    const id3WithTitle = buildId3([id3TextFrame('TIT2', 'Song')]);
    mockReadAsStringAsync.mockResolvedValueOnce(id3WithTitle);
    mockGetInfoAsync.mockRejectedValueOnce(new Error('info failed'));

    const tags = await parseId3FromUri('file:///music/album.mp4');
    expect(tags.title).toBe('Song');
  });

  test('returns parsed head tags when tail read fails', async () => {
    const id3WithArtist = buildId3([id3TextFrame('TPE1', 'Art')]);
    mockReadAsStringAsync.mockResolvedValueOnce(id3WithArtist);
    mockGetInfoAsync.mockResolvedValueOnce({ size: 2 * 1024 * 1024 });
    mockReadAsStringAsync.mockRejectedValueOnce(new Error('tail read failed'));

    const tags = await parseId3FromUri('file:///music/album.mp4');
    expect(tags.artist).toBe('Art');
  });

  test('uses bounded File API fallback for small files when legacy read fails', async () => {
    mockReadAsStringAsync.mockRejectedValueOnce(new Error('legacy unavailable'));
    mockGetInfoAsync.mockResolvedValueOnce({ size: 256 });
    mockFileBytes.mockResolvedValueOnce(new Uint8Array([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0]));

    await parseId3FromUri('file:///music/small.mp3?x=1');
    expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///music/small.mp3');
    expect(mockFileBytes).toHaveBeenCalled();
  });

  test('does not use File.bytes fallback for large files', async () => {
    mockReadAsStringAsync.mockRejectedValueOnce(new Error('legacy unavailable'));
    mockGetInfoAsync.mockResolvedValueOnce({ size: 2 * 1024 * 1024 });

    const tags = await parseId3FromUri('file:///music/big.mp3');
    expect(tags).toEqual({});
    expect(mockFileBytes).not.toHaveBeenCalled();
  });
});
