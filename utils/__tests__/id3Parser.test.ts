import { parseId3Buffer, parseMp4CoverFromBuffer } from '../id3Parser';

/**
 * Build a minimal ID3v2.3 header + a single text frame.
 *  header: "ID3" + ver(3,0) + flags(0) + size (synchsafe, 4 bytes)
 *  frame:  4-byte ID + 4-byte size (big-endian, NOT synchsafe in v2.3) + 2 flags + body
 */
const enc = (s: string): number[] => {
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 1) out.push(s.charCodeAt(i));
  return out;
};

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

const buildTextFrame = (id: string, text: string): number[] => {
  // encoding 0x00 = ISO-8859-1
  const body = [0x00, ...enc(text)];
  return [...enc(id), ...u32be(body.length), 0, 0, ...body];
};

const buildId3v23 = (frames: number[][]): Uint8Array => {
  const flat = frames.reduce<number[]>((acc, f) => acc.concat(f), []);
  const totalSize = flat.length;
  const header = [
    ...enc('ID3'),
    3, 0, // v2.3.0
    0, // flags
    ...synchsafe(totalSize),
  ];
  return new Uint8Array([...header, ...flat]);
};

const buildApicFrame = (mime: string, imageBytes: number[]): number[] => {
  const body = [0x00, ...enc(mime), 0x00, 0x03, 0x00, ...imageBytes];
  return [...enc('APIC'), ...u32be(body.length), 0, 0, ...body];
};

describe('parseId3Buffer (v2.3)', () => {
  test('parses TIT2 / TPE1 / TALB / TYER / TCON', () => {
    const buf = buildId3v23([
      buildTextFrame('TIT2', 'Get Lucky'),
      buildTextFrame('TPE1', 'Daft Punk'),
      buildTextFrame('TALB', 'Random Access Memories'),
      buildTextFrame('TYER', '2013'),
      buildTextFrame('TCON', 'Electronic'),
    ]);
    const tags = parseId3Buffer(buf);
    expect(tags.title).toBe('Get Lucky');
    expect(tags.artist).toBe('Daft Punk');
    expect(tags.album).toBe('Random Access Memories');
    expect(tags.year).toBe('2013');
    expect(tags.genre).toBe('Electronic');
  });

  test('returns empty object for missing ID3 header', () => {
    const buf = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
    expect(parseId3Buffer(buf)).toEqual({});
  });

  test('handles UTF-8 encoded text frame (encoding byte 0x03)', () => {
    const utf8Title = 'Sürströmming';
    const utf8 = new TextEncoder().encode(utf8Title);
    const body = [0x03, ...Array.from(utf8)];
    const frame = [...enc('TIT2'), ...u32be(body.length), 0, 0, ...body];
    const buf = buildId3v23([frame]);
    const tags = parseId3Buffer(buf);
    expect(tags.title).toBe(utf8Title);
  });

  test('TPE2 fills artist if TPE1 is missing', () => {
    const buf = buildId3v23([buildTextFrame('TPE2', 'Various Artists')]);
    expect(parseId3Buffer(buf).artist).toBe('Various Artists');
  });

  test('TPE1 takes priority over TPE2', () => {
    const buf = buildId3v23([
      buildTextFrame('TPE1', 'Lead Artist'),
      buildTextFrame('TPE2', 'Album Artist'),
    ]);
    expect(parseId3Buffer(buf).artist).toBe('Lead Artist');
  });

  test('truncated buffer does not throw', () => {
    const buf = new Uint8Array(20);
    buf[0] = 0x49; buf[1] = 0x44; buf[2] = 0x33; buf[3] = 3;
    expect(() => parseId3Buffer(buf)).not.toThrow();
  });

  test('parses APIC cover as data URI', () => {
    const jpegMagic = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
    const buf = buildId3v23([buildApicFrame('image/jpeg', jpegMagic)]);
    const tags = parseId3Buffer(buf);
    expect(tags.cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  test('falls back to magic bytes when APIC mime is invalid', () => {
    const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const buf = buildId3v23([buildApicFrame('invalid/mime', pngMagic)]);
    const tags = parseId3Buffer(buf);
    expect(tags.cover?.startsWith('data:image/png;base64,')).toBe(true);
  });

  test('rejects APIC cover when mime is image/jpeg but bytes are invalid', () => {
    const badBytes = [0x00, 0x01, 0x02, 0x03];
    const buf = buildId3v23([buildApicFrame('image/jpeg', badBytes)]);
    const tags = parseId3Buffer(buf);
    expect(tags.cover).toBeUndefined();
  });
});

describe('parseMp4CoverFromBuffer', () => {
  const atom = (type: string, payload: number[]): number[] => {
    const size = payload.length + 8;
    return [...u32be(size), ...enc(type), ...payload];
  };

  test('parses covr data atom in mp4 ilst tree', () => {
    const jpeg = [0xff, 0xd8, 0xff, 0xe0];
    const dataPayload = [0, 0, 0, 13, 0, 0, 0, 0, ...jpeg];
    const covr = atom('covr', atom('data', dataPayload));
    const ilst = atom('ilst', covr);
    const meta = atom('meta', [0, 0, 0, 0, ...ilst]);
    const udta = atom('udta', meta);
    const moov = atom('moov', udta);

    const cover = parseMp4CoverFromBuffer(new Uint8Array(moov));
    expect(cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  test('parses covr even when buffer starts misaligned before moov', () => {
    const jpeg = [0xff, 0xd8, 0xff, 0xe0];
    const dataPayload = [0, 0, 0, 13, 0, 0, 0, 0, ...jpeg];
    const moov = atom('moov', atom('udta', atom('meta', [0, 0, 0, 0, ...atom('ilst', atom('covr', atom('data', dataPayload)))])));
    const bytes = new Uint8Array(new Array(3005).fill(0x7a).concat(moov));
    const cover = parseMp4CoverFromBuffer(bytes);
    expect(cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  test('does not skip valid moov after unknown plausible atom header', () => {
    const jpeg = [0xff, 0xd8, 0xff, 0xe0];
    const dataPayload = [0, 0, 0, 13, 0, 0, 0, 0, ...jpeg];
    const moov = atom('moov', atom('udta', atom('meta', [0, 0, 0, 0, ...atom('ilst', atom('covr', atom('data', dataPayload)))])));
    const fakeSize = [0x00, 0x00, 0x00, 0x20];
    const fakeType = [0x7a, 0x7a, 0x7a, 0x7a];
    const fakePayload = new Array(24).fill(0x00);
    const bytes = new Uint8Array([...fakeSize, ...fakeType, ...fakePayload, ...moov]);
    const cover = parseMp4CoverFromBuffer(bytes);
    expect(cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });
});
