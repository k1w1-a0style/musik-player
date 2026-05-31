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

const u24be = (n: number): number[] => [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];

const synchsafe = (n: number): number[] => [
  (n >> 21) & 0x7f,
  (n >> 14) & 0x7f,
  (n >> 7) & 0x7f,
  n & 0x7f,
];

const buildTextFrame = (id: string, text: string, flag1 = 0, flag2 = 0): number[] => {
  // encoding 0x00 = ISO-8859-1
  const body = [0x00, ...enc(text)];
  return [...enc(id), ...u32be(body.length), flag1, flag2, ...body];
};

const buildTextFrameV24 = (id: string, text: string, flag1 = 0, flag2 = 0): number[] => {
  const body = [0x00, ...enc(text)];
  return [...enc(id), ...synchsafe(body.length), flag1, flag2, ...body];
};
const buildUtf8TextFrame = (id: string, utf8Bytes: number[]): number[] => {
  const body = [0x03, ...utf8Bytes];
  return [...enc(id), ...u32be(body.length), 0, 0, ...body];
};

const buildId3v23 = (frames: number[][], flags = 0): Uint8Array => {
  const flat = frames.reduce<number[]>((acc, f) => acc.concat(f), []);
  const totalSize = flat.length;
  const header = [
    ...enc('ID3'),
    3, 0, // v2.3.0
    flags,
    ...synchsafe(totalSize),
  ];
  return new Uint8Array([...header, ...flat]);
};

const buildId3v24 = (frames: number[][], flags = 0): Uint8Array => {
  const flat = frames.reduce<number[]>((acc, f) => acc.concat(f), []);
  return new Uint8Array([...enc('ID3'), 4, 0, flags, ...synchsafe(flat.length), ...flat]);
};

const buildId3v22 = (frames: number[][]): Uint8Array => {
  const flat = frames.reduce<number[]>((acc, frame) => acc.concat(frame), []);
  return new Uint8Array([...enc('ID3'), 2, 0, 0, ...synchsafe(flat.length), ...flat]);
};

const buildTextFrameV22 = (id: string, text: string): number[] => {
  const body = [0x00, ...enc(text)];
  return [...enc(id), ...u24be(body.length), ...body];
};

const buildCommFrame = (text: string, description = ''): number[] => {
  const body = [0x00, 0x65, 0x6e, 0x67, ...enc(description), 0x00, ...enc(text)];
  return [...enc('COMM'), ...u32be(body.length), 0, 0, ...body];
};

const buildCommFrameV22 = (text: string, description = ''): number[] => {
  const body = [0x00, 0x65, 0x6e, 0x67, ...enc(description), 0x00, ...enc(text)];
  return [...enc('COM'), ...u24be(body.length), ...body];
};

const buildApicFrame = (mime: string, imageBytes: number[]): number[] => {
  const body = [0x00, ...enc(mime), 0x00, 0x03, 0x00, ...imageBytes];
  return [...enc('APIC'), ...u32be(body.length), 0, 0, ...body];
};

const buildPicFrameV22 = (format: string, imageBytes: number[]): number[] => {
  const body = [0x00, ...enc(format), 0x03, 0x00, ...imageBytes];
  return [...enc('PIC'), ...u24be(body.length), ...body];
};

describe('parseId3Buffer (v2.2)', () => {
  test('parses common v2.2 text frames and comments', () => {
    const buf = buildId3v22([
      buildTextFrameV22('TT2', 'Old Title'),
      buildTextFrameV22('TP1', 'Old Artist'),
      buildTextFrameV22('TAL', 'Old Album'),
      buildTextFrameV22('TYE', '1999'),
      buildTextFrameV22('TCO', 'Techno'),
      buildTextFrameV22('TRK', '7/12'),
      buildTextFrameV22('TPA', '1/2'),
      buildCommFrameV22('Old comment'),
    ]);

    expect(parseId3Buffer(buf)).toMatchObject({
      title: 'Old Title',
      artist: 'Old Artist',
      album: 'Old Album',
      year: '1999',
      genre: 'Techno',
      trackNumber: '7/12',
      discNumber: '1/2',
      comment: 'Old comment',
    });
  });

  test('TPE2-equivalent TP2 fills artist only when TP1 is missing', () => {
    expect(parseId3Buffer(buildId3v22([buildTextFrameV22('TP2', 'Album Artist')])).artist).toBe('Album Artist');
    expect(parseId3Buffer(buildId3v22([
      buildTextFrameV22('TP1', 'Lead Artist'),
      buildTextFrameV22('TP2', 'Album Artist'),
    ])).artist).toBe('Lead Artist');
  });

  test('still parses v2.2 PIC cover frames', () => {
    const tags = parseId3Buffer(buildId3v22([buildPicFrameV22('JPG', [0xff, 0xd8, 0xff, 0xe0])]));
    expect(tags.cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });
});

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
  test('handles UTF-8 4-byte code points', () => {
    const body = [0x03, 0x53, 0xf0, 0x9f, 0x8e, 0xa7];
    const frame = [...enc('TIT2'), ...u32be(body.length), 0, 0, ...body];
    expect(parseId3Buffer(buildId3v23([frame])).title).toBe('S🎧');
  });
  test('truncated utf8 sequences do not throw', () => {
    const frames = [
      buildUtf8TextFrame('TIT2', [0xc3]),
      buildUtf8TextFrame('TALB', [0xe2, 0x82]),
      buildUtf8TextFrame('TPE1', [0xf0, 0x9f, 0x92]),
      buildUtf8TextFrame('TCON', [0xe2, 0x28, 0xa1]),
    ];
    expect(() => parseId3Buffer(buildId3v23(frames))).not.toThrow();
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

  test('parses TRCK/TPOS and COMM', () => {
    const buf = buildId3v23([
      buildTextFrame('TRCK', '3/12'),
      buildTextFrame('TPOS', '1/2'),
      buildCommFrame('Main comment'),
    ]);
    const tags = parseId3Buffer(buf);
    expect(tags.trackNumber).toBe('3/12');
    expect(tags.discNumber).toBe('1/2');
    expect(tags.comment).toBe('Main comment');
  });

  test('COMM prefers empty description over described frames', () => {
    const buf = buildId3v23([buildCommFrame('fallback', 'desc'), buildCommFrame('preferred', '')]);
    expect(parseId3Buffer(buf).comment).toBe('preferred');
  });

  test('truncated COMM does not throw', () => {
    const frame = [...enc('COMM'), ...u32be(2), 0, 0, 0x00, 0x65];
    const buf = buildId3v23([frame]);
    expect(() => parseId3Buffer(buf)).not.toThrow();
  });
  test('COMM fallback uses non-empty description if no empty one exists', () => {
    const buf = buildId3v23([buildCommFrame('fallback text', 'desc')]);
    expect(parseId3Buffer(buf).comment).toBe('fallback text');
  });
  test('COMM UTF-8 with emoji parses correctly', () => {
    const body = [0x03, 0x65, 0x6e, 0x67, 0x00, 0xf0, 0x9f, 0x98, 0x8a];
    const frame = [...enc('COMM'), ...u32be(body.length), 0, 0, ...body];
    expect(parseId3Buffer(buildId3v23([frame])).comment).toBe('😊');
  });

  test('truncated buffer does not throw', () => {
    const buf = new Uint8Array(20);
    buf[0] = 0x49; buf[1] = 0x44; buf[2] = 0x33; buf[3] = 3;
    expect(() => parseId3Buffer(buf)).not.toThrow();
  });

  test('valid syncsafe tag size is decoded and parsed', () => {
    const frame = buildTextFrame('TIT2', 'Syncsafe OK');
    const buf = buildId3v23([frame]);
    expect(parseId3Buffer(buf).title).toBe('Syncsafe OK');
  });

  test('invalid syncsafe tag size with a high bit is ignored safely', () => {
    const frame = buildTextFrame('TIT2', 'Should Not Parse');
    const buf = buildId3v23([frame]);
    buf[6] = 0x80;
    expect(parseId3Buffer(buf)).toEqual({});
  });

  test('corrupt short ID3 header does not throw', () => {
    expect(() => parseId3Buffer(new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0]))).not.toThrow();
    expect(parseId3Buffer(new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0]))).toEqual({});
  });

  test('tag-level unsynchronisation is removed before reading frames', () => {
    const unsyncedTitle = [0x00, 0xff, 0x00, 0xe1, ...enc('Title')];
    const frame = [...enc('TIT2'), ...u32be(unsyncedTitle.length), 0, 0, ...unsyncedTitle];
    const tags = parseId3Buffer(buildId3v23([frame], 0x80));
    expect(tags.title).toBe(String.fromCharCode(0xff, 0xe1) + 'Title');
  });

  test('frames with unsupported v2.3 format flags are skipped', () => {
    const buf = buildId3v23([
      buildTextFrame('TIT2', 'Compressed Title', 0, 0x80),
      buildTextFrame('TALB', 'Normal Album'),
    ]);
    const tags = parseId3Buffer(buf);
    expect(tags.title).toBeUndefined();
    expect(tags.album).toBe('Normal Album');
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
  test('truncated APIC does not throw and returns no cover', () => {
    const frame = [...enc('APIC'), ...u32be(3), 0, 0, 0x00, 0x69, 0x6d];
    const tags = parseId3Buffer(buildId3v23([frame]));
    expect(tags.cover).toBeUndefined();
  });
  test('APIC without image bytes returns no cover', () => {
    const frame = [...enc('APIC'), ...u32be(13), 0, 0, 0x00, ...enc('image/jpeg'), 0x00, 0x03, 0x00];
    expect(parseId3Buffer(buildId3v23([frame])).cover).toBeUndefined();
  });
  test('invalid frame id stops safely', () => {
    const bad = [...enc('@@@!'), ...u32be(4), 0, 0, 0, 0, 0, 0];
    expect(() => parseId3Buffer(buildId3v23([bad]))).not.toThrow();
  });
});

describe('parseId3Buffer (v2.4)', () => {
  test('parses normal v2.4 text frames', () => {
    const tags = parseId3Buffer(buildId3v24([
      buildTextFrameV24('TIT2', 'V24 Title'),
      buildTextFrameV24('TDRC', '2026'),
    ]));
    expect(tags.title).toBe('V24 Title');
    expect(tags.year).toBe('2026');
  });

  test('removes v2.4 frame-level unsynchronisation', () => {
    const body = [0x00, 0xff, 0x00, 0xe2, ...enc('Frame')];
    const frame = [...enc('TIT2'), ...synchsafe(body.length), 0, 0x02, ...body];
    expect(parseId3Buffer(buildId3v24([frame])).title).toBe(String.fromCharCode(0xff, 0xe2) + 'Frame');
  });

  test('skips v2.4 frames with data length indicator', () => {
    const tags = parseId3Buffer(buildId3v24([
      buildTextFrameV24('TIT2', 'Unsafe', 0, 0x01),
      buildTextFrameV24('TALB', 'Safe Album'),
    ]));
    expect(tags.title).toBeUndefined();
    expect(tags.album).toBe('Safe Album');
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

  test('aligned trusted top-level scan skips large top-level atoms and still finds covr', () => {
    const jpeg = [0xff, 0xd8, 0xff, 0xe0];
    const dataPayload = [0, 0, 0, 13, 0, 0, 0, 0, ...jpeg];
    const ftyp = atom('ftyp', [0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 1]);
    const mdat = atom('mdat', new Array(16 * 1024).fill(0x2a));
    const moov = atom('moov', atom('udta', atom('meta', [0, 0, 0, 0, ...atom('ilst', atom('covr', atom('data', dataPayload)))])));
    const bytes = new Uint8Array([...ftyp, ...mdat, ...moov]);
    const cover = parseMp4CoverFromBuffer(bytes, { trustedTopLevel: true });
    expect(cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  test('parses covr even when buffer starts misaligned before moov', () => {
    const jpeg = [0xff, 0xd8, 0xff, 0xe0];
    const dataPayload = [0, 0, 0, 13, 0, 0, 0, 0, ...jpeg];
    const moov = atom('moov', atom('udta', atom('meta', [0, 0, 0, 0, ...atom('ilst', atom('covr', atom('data', dataPayload)))])));
    const bytes = new Uint8Array(new Array(3005).fill(0x7a).concat(moov));
    const cover = parseMp4CoverFromBuffer(bytes, { trustedTopLevel: false });
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
    const cover = parseMp4CoverFromBuffer(bytes, { trustedTopLevel: false });
    expect(cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });
});
