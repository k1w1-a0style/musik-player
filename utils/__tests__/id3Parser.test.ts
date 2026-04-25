import { parseId3Buffer } from '../id3Parser';

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
});
