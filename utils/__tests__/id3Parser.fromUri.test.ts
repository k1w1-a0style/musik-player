import { parseId3FromUri } from '../id3Parser';

const mockReadAsStringAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockFileBytes = jest.fn();
const mockOpen = jest.fn();

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    bytes() {
      return mockFileBytes();
    }
    open() {
      return mockOpen();
    }
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
}));

describe('parseId3FromUri', () => {
  const existingFile = (size: number) => ({ exists: true, uri: 'file:///mock', isDirectory: false, size });
  const enc = (s: string): number[] => Array.from(s).map(ch => ch.charCodeAt(0));
  const u32be = (n: number): number[] => [
    (n >> 24) & 0xff,
    (n >> 16) & 0xff,
    (n >> 8) & 0xff,
    n & 0xff,
  ];
  const synchsafe = (n: number): number[] => [
    (n >> 21) & 0x7f,
    (n >> 14) & 0x7f,
    (n >> 7) & 0x7f,
    n & 0x7f,
  ];
  const atom = (type: string, payload: number[]): number[] => [
    ...u32be(payload.length + 8),
    ...enc(type),
    ...payload,
  ];
  const b64 = (bytes: number[]): string =>
    Buffer.from(Uint8Array.from(bytes)).toString('base64');
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
    mockOpen.mockReset();
  });

  test('uses mp4 parsing when URI has query params', async () => {
    const webp = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
    const data = atom('data', [0, 0, 0, 13, 0, 0, 0, 0, ...webp]);
    const moov = atom(
      'moov',
      atom('udta', atom('meta', [0, 0, 0, 0, ...atom('ilst', atom('covr', data))])),
    );
    mockReadAsStringAsync.mockResolvedValueOnce(b64(moov));

    const tags = await parseId3FromUri('file:///music/track.m4a?token=abc');
    expect(tags.cover?.startsWith('data:image/webp;base64,')).toBe(true);
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(
      'file:///music/track.m4a',
      expect.any(Object),
    );
  });

  test('keeps content URI query params when reading provider-backed files', async () => {
    const webp = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
    const data = atom('data', [0, 0, 0, 13, 0, 0, 0, 0, ...webp]);
    const moov = atom(
      'moov',
      atom('udta', atom('meta', [0, 0, 0, 0, ...atom('ilst', atom('covr', data))])),
    );
    mockReadAsStringAsync.mockResolvedValueOnce(b64(moov));

    const uri = 'content://provider/tree/music/track.m4a?documentId=abc';
    const tags = await parseId3FromUri(uri);

    expect(tags.cover?.startsWith('data:image/webp;base64,')).toBe(true);
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(uri, expect.any(Object));
  });

  test('head read uses trusted aligned scan and finds cover after ftyp/mdat', async () => {
    const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0, 0];
    const ftyp = atom('ftyp', [0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 1]);
    const mdat = atom('mdat', new Array(8 * 1024).fill(0x55));
    const moov = atom(
      'moov',
      atom(
        'udta',
        atom('meta', [
          0,
          0,
          0,
          0,
          ...atom('ilst', atom('covr', atom('data', [0, 0, 0, 13, 0, 0, 0, 0, ...jpeg]))),
        ]),
      ),
    );
    mockReadAsStringAsync.mockResolvedValueOnce(b64([...ftyp, ...mdat, ...moov]));

    const tags = await parseId3FromUri('file:///music/aligned-head.m4a');
    expect(tags.cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(mockGetInfoAsync).not.toHaveBeenCalled();
  });

  test('falls back to tail read for larger mp4 files', async () => {
    // first read: no recognizable image payload
    mockReadAsStringAsync.mockResolvedValueOnce('AAAA');
    mockGetInfoAsync.mockResolvedValueOnce(existingFile(2 * 1024 * 1024));
    // second read (tail): JPEG signature
    const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0, 0];
    const tailMoov = atom(
      'moov',
      atom(
        'udta',
        atom('meta', [
          0,
          0,
          0,
          0,
          ...atom('ilst', atom('covr', atom('data', [0, 0, 0, 13, 0, 0, 0, 0, ...jpeg]))),
        ]),
      ),
    );
    mockReadAsStringAsync.mockResolvedValueOnce(
      b64(new Array(3005).fill(0x01).concat(tailMoov)),
    );

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
    mockGetInfoAsync.mockResolvedValueOnce(existingFile(2 * 1024 * 1024));
    const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0, 0];
    const fakeHeader = [
      0,
      0,
      0,
      0x40,
      0x7a,
      0x7a,
      0x7a,
      0x7a,
      ...new Array(56).fill(0x00),
    ];
    const tailMoov = atom(
      'moov',
      atom(
        'udta',
        atom('meta', [
          0,
          0,
          0,
          0,
          ...atom('ilst', atom('covr', atom('data', [0, 0, 0, 13, 0, 0, 0, 0, ...jpeg]))),
        ]),
      ),
    );
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
    mockGetInfoAsync.mockResolvedValueOnce(existingFile(2 * 1024 * 1024));
    mockReadAsStringAsync.mockRejectedValueOnce(new Error('tail read failed'));

    const tags = await parseId3FromUri('file:///music/album.mp4');
    expect(tags.artist).toBe('Art');
  });

  test('uses bounded File API fallback for small files when legacy read fails', async () => {
    mockReadAsStringAsync.mockRejectedValueOnce(new Error('legacy unavailable'));
    mockGetInfoAsync.mockResolvedValueOnce(existingFile(256));
    mockFileBytes.mockResolvedValueOnce(
      new Uint8Array([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0]),
    );

    await parseId3FromUri('file:///music/small.mp3?x=1');
    expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///music/small.mp3');
    expect(mockFileBytes).toHaveBeenCalled();
  });

  test('uses bounded File.open fallback instead of File.bytes for large files', async () => {
    mockReadAsStringAsync.mockRejectedValueOnce(new Error('legacy unavailable'));
    mockGetInfoAsync.mockResolvedValueOnce(existingFile(2 * 1024 * 1024));
    const bytes = Uint8Array.from([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0]);
    let offset: number | null = 0;
    const handle = {
      get offset() {
        return offset;
      },
      set offset(next: number | null) {
        offset = next;
      },
      readBytes: jest.fn((length: number): Uint8Array => bytes.subarray(offset ?? 0, (offset ?? 0) + length)),
      close: jest.fn(),
    };
    mockOpen.mockReturnValueOnce(handle);

    await parseId3FromUri('file:///music/big.mp3');
    expect(mockOpen).toHaveBeenCalled();
    expect(mockFileBytes).not.toHaveBeenCalled();
    expect(handle.readBytes).toHaveBeenCalledWith(1024 * 1024);
    expect(handle.close).toHaveBeenCalled();
  });

  test('legacy fallback scans large ID3 tags without loading oversized APIC payloads', async () => {
    const titleFrame = id3TextFrame('TIT2', 'After Cover');
    const apicSize = 2 * 1024 * 1024;
    const apicHeader = [...enc('APIC'), ...u32be(apicSize), 0, 0];
    const tagSize = apicHeader.length + apicSize + titleFrame.length;
    const header = [...enc('ID3'), 3, 0, 0, ...synchsafe(tagSize)];
    const firstChunk = new Array(1024 * 1024).fill(0);
    firstChunk.splice(0, header.length, ...header);
    firstChunk.splice(header.length, apicHeader.length, ...apicHeader);
    mockReadAsStringAsync.mockImplementation(async (_uri, options) => {
      if (options.position === undefined) return b64(firstChunk);
      if (options.position === 10 + apicSize + apicHeader.length) return b64(titleFrame.slice(0, 10));
      if (options.position === 10 + apicSize + apicHeader.length + 10) return b64(titleFrame.slice(10));
      return '';
    });

    const tags = await parseId3FromUri('file:///music/large-apic.mp3');

    expect(tags.title).toBe('After Cover');
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(
      'file:///music/large-apic.mp3',
      expect.objectContaining({ length: 1024 * 1024 }),
    );
    expect(mockReadAsStringAsync).not.toHaveBeenCalledWith(
      'file:///music/large-apic.mp3',
      expect.objectContaining({ length: apicSize }),
    );
  });

  test('returns controlled result when ranged metadata scan cannot read later frames', async () => {
    const titleFrame = id3TextFrame('TIT2', 'Hidden');
    const apicSize = 2 * 1024 * 1024;
    const apicHeader = [...enc('APIC'), ...u32be(apicSize), 0, 0];
    const tagSize = apicHeader.length + apicSize + titleFrame.length;
    const header = [...enc('ID3'), 3, 0, 0, ...synchsafe(tagSize)];
    const firstChunk = new Array(1024 * 1024).fill(0);
    firstChunk.splice(0, header.length, ...header);
    firstChunk.splice(header.length, apicHeader.length, ...apicHeader);
    mockReadAsStringAsync.mockResolvedValueOnce(b64(firstChunk));
    mockReadAsStringAsync.mockRejectedValueOnce(new Error('range failed'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const tags = await parseId3FromUri('file:///music/unreadable-range.mp3');

    expect(tags).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith('[ID3Parser] Bounded ID3 frame scan failed.', expect.any(Error));
    warnSpy.mockRestore();
  });
});
