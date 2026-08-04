import {
  applyTagEditToBuffer,
  decodeSynchsafe,
  encodeSynchsafe,
  hasCompleteId3Header,
  readId3Header,
  TagWriterError,
  buildTagWritePayload,
  resolveWritableTagUri,
  validateId3PayloadSize,
  DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES,
} from '../tagWriter';
import {
  ensureTagEditWriteAllowed,
  prepareTagEditPlan,
  writeTagsToFile,
} from '../tagWriter';
import type { Song } from '../../types/Song';
import type { TagFileWriteAdapter } from '../tagFileWriteAdapter';
import type { TagWriterErrorCode, WriteTagsResult } from '../../types/TagEdit';

const song = (overrides: Partial<Song>): Song => ({
  id: '1',
  title: 'A',
  artist: 'B',
  ...overrides,
});
const u8 = (...x: number[]) => new Uint8Array(x);
const text = (s: string) => new TextEncoder().encode(s);
const mkFrame = (id: string, body: Uint8Array) => {
  const f = new Uint8Array(10 + body.length);
  f.set(text(id), 0);
  f.set([0, 0, 0, body.length], 4);
  f.set(body, 10);
  return f;
};
const mkTag = (frames: Uint8Array[], version = 3, flags = 0, footer = false) => {
  const payload = frames.reduce((n, f) => n + f.length, 0);
  const h = new Uint8Array(10);
  h.set([0x49, 0x44, 0x33, version, 0, flags], 0);
  h.set(encodeSynchsafe(payload), 6);
  const b = new Uint8Array(10 + payload + (footer ? 10 : 0));
  b.set(h, 0);
  let o = 10;
  for (const f of frames) {
    b.set(f, o);
    o += f.length;
  }
  return b;
};
const frameIds = (buffer: Uint8Array): string[] => {
  const ids: string[] = [];
  const size = decodeSynchsafe(buffer.slice(6, 10));
  let p = 10;
  const end = 10 + size;
  while (p + 10 <= end && buffer[p] !== 0) {
    ids.push(String.fromCharCode(buffer[p], buffer[p + 1], buffer[p + 2], buffer[p + 3]));
    const frameSize =
      (buffer[p + 4] << 24) |
      (buffer[p + 5] << 16) |
      (buffer[p + 6] << 8) |
      buffer[p + 7];
    p += 10 + frameSize;
  }
  return ids;
};

describe('tagWriter mp3 id3v2.3', () => {
  test('syncsafe roundtrip', () => {
    expect(decodeSynchsafe(encodeSynchsafe(123456))).toBe(123456);
  });

  test('encodeSynchsafe accepts lower and upper bounds', () => {
    expect(Array.from(encodeSynchsafe(0))).toEqual([0, 0, 0, 0]);
    expect(Array.from(encodeSynchsafe(0x0fffffff))).toEqual([0x7f, 0x7f, 0x7f, 0x7f]);
  });

  test('encodeSynchsafe rejects invalid sizes', () => {
    const invalid = [0x10000000, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5];
    for (const size of invalid) {
      try {
        encodeSynchsafe(size as number);
        throw new Error('Expected throw');
      } catch (error) {
        expect((error as TagWriterError).code).toBe('InvalidTagData');
      }
    }
  });

  test('validateId3PayloadSize enforces synchsafe upper bound', () => {
    expect(() => validateId3PayloadSize(0x0fffffff)).not.toThrow();
    expect(() => validateId3PayloadSize(0x10000000)).toThrow(/synchsafe/i);
  });

  test('truncated ID3 preamble of 3 bytes is rejected', () => {
    expect(() =>
      applyTagEditToBuffer(u8(0x49, 0x44, 0x33), 'mp3', {
        songId: '1',
        tags: { title: 'X' },
      }),
    ).toThrow(/Truncated ID3 header/i);
  });

  test('truncated ID3 preamble of 4 bytes is rejected', () => {
    expect(() =>
      applyTagEditToBuffer(u8(0x49, 0x44, 0x33, 0x03), 'mp3', {
        songId: '1',
        tags: { title: 'X' },
      }),
    ).toThrow(/Truncated ID3 header/i);
  });

  test('readId3Header rejects ID3 preamble shorter than full header', () => {
    expect(() => readId3Header(u8(0x49, 0x44, 0x33, 0x03, 0x00))).toThrow(
      /Truncated ID3 header/i,
    );
  });

  test('buffer with only "ID" is not treated as ID3 preamble', () => {
    expect(hasCompleteId3Header(u8(0x49, 0x44))).toBe(false);
    const out = applyTagEditToBuffer(u8(0x49, 0x44, 0x01), 'mp3', {
      songId: '1',
      tags: { title: 'X' },
    });
    expect(String.fromCharCode(out[0], out[1], out[2])).toBe('ID3');
    expect(Array.from(out.slice(-3))).toEqual([0x49, 0x44, 0x01]);
  });

  test('non-ID3 short preamble is treated as untagged audio', () => {
    const src = u8(0x49, 0x44, 0x90, 0x64);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } });
    expect(String.fromCharCode(out[0], out[1], out[2])).toBe('ID3');
    expect(Array.from(out.slice(-src.length))).toEqual(Array.from(src));
  });

  test('writes mp3, keeps audio bytes and v2.3 header', () => {
    const audio = u8(1, 2, 3, 4);
    const out = applyTagEditToBuffer(audio, 'mp3', {
      songId: '1',
      tags: { title: 'Ärger' },
    });
    expect(String.fromCharCode(out[0], out[1], out[2])).toBe('ID3');
    expect(out[3]).toBe(3);
    expect(Array.from(out.slice(out.length - 4))).toEqual([1, 2, 3, 4]);
  });

  test('writes unicode including emoji as utf16', () => {
    const audio = u8(4, 3, 2, 1);
    const out = applyTagEditToBuffer(audio, 'mp3', {
      songId: '1',
      tags: { title: 'Привет 漢字 🎵' },
    });
    const headerSize = decodeSynchsafe(out.slice(6, 10));
    const payload = out.slice(10, 10 + headerSize);
    expect(new TextDecoder().decode(payload).includes('TIT2')).toBe(true);
    expect(payload.includes(0x01)).toBe(true);
    expect(payload.includes(0xff)).toBe(true);
    expect(payload.includes(0xfe)).toBe(true);
  });

  test('year writes both TYER and TDRC when year is edited', () => {
    const tdrc = mkFrame('TDRC', u8(0, '2'.charCodeAt(0)));
    const src = new Uint8Array([...mkTag([tdrc]), 9, 9]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { year: '2020' } });
    const ids = frameIds(out);
    expect(ids).toContain('TYER');
    expect(ids).toContain('TDRC');
  });

  test('partial title edit preserves untouched artist/album', () => {
    const src = new Uint8Array([
      ...mkTag([
        mkFrame('TIT2', u8(0x03, 0x41)),
        mkFrame('TPE1', u8(0x03, 0x42)),
        mkFrame('TALB', u8(0x03, 0x43)),
      ]),
      7,
      7,
    ]);
    const out = applyTagEditToBuffer(src, 'mp3', {
      songId: '1',
      tags: { title: 'New Title' },
    });
    const ids = frameIds(out);
    expect(ids).toContain('TIT2');
    expect(ids).toContain('TPE1');
    expect(ids).toContain('TALB');
  });

  test('partial genre edit preserves year/track/disc', () => {
    const src = new Uint8Array([
      ...mkTag([
        mkFrame('TYER', u8(0x03, 0x32)),
        mkFrame('TCON', u8(0x03, 0x31)),
        mkFrame('TRCK', u8(0x03, 0x31)),
        mkFrame('TPOS', u8(0x03, 0x31)),
      ]),
      1,
    ]);
    const out = applyTagEditToBuffer(src, 'mp3', {
      songId: '1',
      tags: { genre: 'Techno' },
    });
    const ids = frameIds(out);
    expect(ids).toEqual(expect.arrayContaining(['TYER', 'TCON', 'TRCK', 'TPOS']));
  });

  test('without year field existing TYER and TDRC are preserved', () => {
    const src = new Uint8Array([
      ...mkTag([mkFrame('TYER', u8(0x03, 0x32)), mkFrame('TDRC', u8(0x03, 0x32))]),
      1,
    ]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } });
    expect(frameIds(out)).toEqual(expect.arrayContaining(['TYER', 'TDRC']));
  });

  test('comment touched empty removes COMM, untouched preserves COMM', () => {
    const src = new Uint8Array([
      ...mkTag([
        mkFrame('COMM', u8(0x01, 0x65, 0x6e, 0x67, 0x00, 0x00, 0x00, 0x00)),
        mkFrame('TPE1', u8(0x03, 0x42)),
      ]),
      1,
    ]);
    const unchanged = applyTagEditToBuffer(src, 'mp3', {
      songId: '1',
      tags: { title: 'A' },
    });
    expect(frameIds(unchanged)).toContain('COMM');
    const removed = applyTagEditToBuffer(src, 'mp3', {
      songId: '1',
      tags: { comment: '   ' },
    });
    expect(frameIds(removed)).not.toContain('COMM');
  });

  test('comment touched with value replaces COMM and keeps other frames', () => {
    const oldComm = mkFrame('COMM', u8(0x01, 0x65, 0x6e, 0x67, 0x00, 0x00, 0x00, 0x00));
    const src = new Uint8Array([...mkTag([oldComm, mkFrame('TPE1', u8(0x03, 0x42))]), 1]);
    const out = applyTagEditToBuffer(src, 'mp3', {
      songId: '1',
      tags: { comment: 'New' },
    });
    const ids = frameIds(out);
    expect(ids).toContain('COMM');
    expect(ids).toContain('TPE1');
  });

  test('comment frame uses UTF-16 empty descriptor with BOM terminator', () => {
    const out = applyTagEditToBuffer(u8(1, 2, 3), 'mp3', {
      songId: '1',
      tags: { comment: 'New' },
    });
    const frameStart = 10;
    const frameSize =
      (out[frameStart + 4] << 24) |
      (out[frameStart + 5] << 16) |
      (out[frameStart + 6] << 8) |
      out[frameStart + 7];
    const body = out.slice(frameStart + 10, frameStart + 10 + frameSize);

    expect(String.fromCharCode(out[frameStart], out[frameStart + 1], out[frameStart + 2], out[frameStart + 3])).toBe('COMM');
    expect(Array.from(body.slice(0, 8))).toEqual([0x01, 0x65, 0x6e, 0x67, 0xff, 0xfe, 0x00, 0x00]);
  });

  test('unicode comment is written via COMM frame', () => {
    const out = applyTagEditToBuffer(u8(1, 2, 3), 'mp3', {
      songId: '1',
      tags: { comment: 'Привет 🎵' },
    });
    expect(frameIds(out)).toContain('COMM');
  });

  test('title touched empty removes TIT2 but keeps others', () => {
    const src = new Uint8Array([
      ...mkTag([mkFrame('TIT2', u8(0x03, 0x41)), mkFrame('TPE1', u8(0x03, 0x42))]),
      1,
    ]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: '   ' } });
    expect(frameIds(out)).not.toContain('TIT2');
    expect(frameIds(out)).toContain('TPE1');
  });

  test('undefined fields are untouched and preserve existing semantic frames', () => {
    const src = new Uint8Array([
      ...mkTag([
        mkFrame('TIT2', u8(0x03, 0x41)),
        mkFrame('TPE1', u8(0x03, 0x42)),
        mkFrame('TALB', u8(0x03, 0x43)),
      ]),
      1,
      2,
      3,
    ]);
    const out = applyTagEditToBuffer(src, 'mp3', {
      songId: '1',
      tags: { title: undefined, artist: undefined, album: undefined },
    });
    expect(frameIds(out)).toEqual(expect.arrayContaining(['TIT2', 'TPE1', 'TALB']));
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  test('cover remove/replace/preserve behaviors', () => {
    const apic = mkFrame(
      'APIC',
      u8(
        0x00,
        0x69,
        0x6d,
        0x61,
        0x67,
        0x65,
        0x2f,
        0x6a,
        0x70,
        0x65,
        0x67,
        0x00,
        0x03,
        0x00,
        0xff,
        0xd8,
        0xff,
      ),
    );
    const src = new Uint8Array([...mkTag([apic, mkFrame('TPE1', u8(0x03, 0x42))]), 1]);
    expect(
      frameIds(
        applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {}, removeCover: true }),
      ),
    ).not.toContain('APIC');
    expect(
      frameIds(
        applyTagEditToBuffer(src, 'mp3', {
          songId: '1',
          tags: {},
          cover: {
            mimeType: 'image/png',
            data: u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
          },
        }),
      ),
    ).toContain('APIC');
    expect(
      frameIds(applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } })),
    ).toContain('APIC');
  });

  test('apic body stores mime, type and image bytes at tail', () => {
    const data = u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    const out = applyTagEditToBuffer(u8(1, 2, 3), 'mp3', {
      songId: '1',
      tags: {},
      cover: { mimeType: 'image/png', data },
    });
    const size = decodeSynchsafe(out.slice(6, 10));
    const payload = out.slice(10, 10 + size);
    const apicIndex = new TextDecoder().decode(payload).indexOf('APIC');
    expect(apicIndex).toBeGreaterThanOrEqual(0);
    const frameStart = apicIndex;
    const frameSize =
      (payload[frameStart + 4] << 24) |
      (payload[frameStart + 5] << 16) |
      (payload[frameStart + 6] << 8) |
      payload[frameStart + 7];
    const body = payload.slice(frameStart + 10, frameStart + 10 + frameSize);
    expect(body[0]).toBe(0x00);
    expect(new TextDecoder().decode(body).includes('image/png')).toBe(true);
    expect(body[body.length - data.length - 2]).toBe(0x03);
    expect(Array.from(body.slice(body.length - data.length))).toEqual(Array.from(data));
  });

  test('preserves valid unknown frames like TXXX and PRIV', () => {
    const src = new Uint8Array([
      ...mkTag([
        mkFrame('TXXX', u8(0x00, 0x41)),
        mkFrame('PRIV', u8(0x01, 0x02)),
        mkFrame('TPE1', u8(0x03, 0x42)),
      ]),
      1,
    ]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } });
    expect(frameIds(out)).toEqual(
      expect.arrayContaining(['TXXX', 'PRIV', 'TPE1', 'TIT2']),
    );
  });

  test('rejects existing non-ASCII frame id', () => {
    const bad = mkFrame('ÿPE1', u8(0x03, 0x41));
    const src = new Uint8Array([...mkTag([bad]), 1]);
    expect(() =>
      applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } }),
    ).toThrow(/frame ID/i);
  });

  test('rejects existing lowercase frame id', () => {
    const bad = mkFrame('abcd', u8(0x03, 0x41));
    const src = new Uint8Array([...mkTag([bad]), 1]);
    expect(() =>
      applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } }),
    ).toThrow(/frame ID/i);
  });

  test('removeCover ignores invalid payload', () => {
    const out = applyTagEditToBuffer(u8(1, 2), 'mp3', {
      songId: '1',
      tags: {},
      removeCover: true,
      cover: { mimeType: 'image/jpeg', data: u8(0) },
    });
    expect(Array.from(out)).toEqual([1, 2]);
  });

  test('unsync tag throws', () => {
    const src = new Uint8Array([...mkTag([], 3, 0x80), 1, 2]);
    expect(() => applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {} })).toThrow(
      /unsynchronisation/i,
    );
  });

  test('untagged mp3 with empty draft is a no-op', () => {
    const src = u8(1, 2, 3, 4);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {} });
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  test('untagged mp3 with removeCover true is a no-op', () => {
    const src = u8(5, 6, 7);
    const out = applyTagEditToBuffer(src, 'mp3', {
      songId: '1',
      tags: {},
      removeCover: true,
    });
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  test('existing tag with empty draft is a no-op', () => {
    const src = new Uint8Array([...mkTag([mkFrame('TIT2', u8(0x03, 0x41))]), 9]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {} });
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  test('existing tag with removeCover true and no APIC is a no-op', () => {
    const src = new Uint8Array([...mkTag([mkFrame('TPE1', u8(0x03, 0x42))]), 9]);
    const out = applyTagEditToBuffer(src, 'mp3', {
      songId: '1',
      tags: {},
      removeCover: true,
    });
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  test('existing id3v2.4 is rejected to avoid mixed-version output', () => {
    const frame = mkFrame('TIT2', u8(0x03, 0x41));
    const tag = mkTag([frame], 4, 0x10, true);
    const src = new Uint8Array([...tag, 0xaa, 0xbb, 0xcc]);
    expect(() =>
      applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { artist: 'X' } }),
    ).toThrow(/ID3v2.4/i);
  });

  test('existing id3v2.4 with no-op draft returns original bytes unchanged', () => {
    const frame = mkFrame('TIT2', u8(0x03, 0x41));
    const tag = mkTag([frame], 4, 0x10, true);
    const src = new Uint8Array([...tag, 0xaa, 0xbb, 0xcc]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {} });
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  test('existing id3v2.4 with undefined-only draft returns original bytes unchanged', () => {
    const frame = mkFrame('TIT2', u8(0x03, 0x41));
    const tag = mkTag([frame], 4, 0x10, true);
    const src = new Uint8Array([...tag, 0xaa, 0xbb, 0xcc]);
    const out = applyTagEditToBuffer(src, 'mp3', {
      songId: '1',
      tags: { title: undefined, comment: undefined },
    });
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  test('existing id3v2.4 with whitespace title is still blocked as edit intent', () => {
    const frame = mkFrame('TIT2', u8(0x03, 0x41));
    const tag = mkTag([frame], 4, 0x10, true);
    const src = new Uint8Array([...tag, 0xaa, 0xbb, 0xcc]);
    expect(() =>
      applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: '   ' } }),
    ).toThrow(/ID3v2.4/i);
  });

  test('existing id3v2.4 with removeCover true is still blocked as edit intent', () => {
    const frame = mkFrame('TIT2', u8(0x03, 0x41));
    const tag = mkTag([frame], 4, 0x10, true);
    const src = new Uint8Array([...tag, 0xaa, 0xbb, 0xcc]);
    expect(() =>
      applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {}, removeCover: true }),
    ).toThrow(/ID3v2.4/i);
  });

  test('existing id3v2.4 with cover set is still blocked as edit intent', () => {
    const frame = mkFrame('TIT2', u8(0x03, 0x41));
    const tag = mkTag([frame], 4, 0x10, true);
    const src = new Uint8Array([...tag, 0xaa, 0xbb, 0xcc]);
    expect(() =>
      applyTagEditToBuffer(src, 'mp3', {
        songId: '1',
        tags: {},
        cover: {
          mimeType: 'image/png',
          data: u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
        },
      }),
    ).toThrow(/ID3v2.4/i);
  });

  test('existing id3v2.2 is rejected', () => {
    const src = new Uint8Array([
      0x49, 0x44, 0x33, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xaa, 0xbb,
    ]);
    expect(() =>
      applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } }),
    ).toThrow(/ID3v2.2/i);
  });

  test('container policy', () => {
    expect(
      Array.from(applyTagEditToBuffer(u8(1), 'm4a', { songId: '1', tags: {} })),
    ).toEqual([1]);
    expect(
      Array.from(applyTagEditToBuffer(u8(1), 'mp4', { songId: '1', tags: {} })),
    ).toEqual([1]);
    expect(() =>
      applyTagEditToBuffer(u8(1), 'unsupported', { songId: '1', tags: {} }),
    ).toThrow(TagWriterError);
  });

  test('ensureTagEditWriteAllowed code mapping', () => {
    const cases: Array<{ s: Song; code: string }> = [
      {
        s: song({ uri: 'content://a.mp3', fileInfo: { extension: 'mp3' } }),
        code: 'MissingWritePermission',
      },
      {
        s: song({ uri: 'https://a.mp3', fileInfo: { extension: 'mp3' } }),
        code: 'UnsupportedUri',
      },
      {
        s: song({ uri: 'file:///a.flac', fileInfo: { extension: 'flac' } }),
        code: 'UnsupportedFormat',
      },
    ];
    for (const item of cases) {
      try {
        ensureTagEditWriteAllowed(item.s);
        throw new Error('Expected throw');
      } catch (error) {
        expect((error as TagWriterError).code).toBe(item.code);
      }
    }
  });

  test('ensureTagEditWriteAllowed respects platform-gated file write support', () => {
    const localMp3 = song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } });
    expect(() => ensureTagEditWriteAllowed(localMp3, 'android')).not.toThrow();
    expect(() => ensureTagEditWriteAllowed(localMp3, 'ios')).toThrow(
      expect.objectContaining({ code: 'WriteNotImplemented' }),
    );
    expect(() => ensureTagEditWriteAllowed(localMp3, 'web')).toThrow(
      expect.objectContaining({ code: 'WriteNotImplemented' }),
    );
  });

  test('ensureTagEditWriteAllowed keeps missing/remote/content/unsupported mapping', () => {
    expect(() =>
      ensureTagEditWriteAllowed(song({ fileInfo: { extension: 'mp3' } }), 'android'),
    ).toThrow(expect.objectContaining({ code: 'UnsupportedUri' }));
    expect(() =>
      ensureTagEditWriteAllowed(
        song({ uri: 'https://example.com/a.mp3', fileInfo: { extension: 'mp3' } }),
        'android',
      ),
    ).toThrow(expect.objectContaining({ code: 'UnsupportedUri' }));
    expect(() =>
      ensureTagEditWriteAllowed(
        song({ uri: 'content://x.mp3', fileInfo: { extension: 'mp3' } }),
        'android',
      ),
    ).toThrow(expect.objectContaining({ code: 'MissingWritePermission' }));
    expect(() =>
      ensureTagEditWriteAllowed(
        song({ uri: 'file:///a.flac', fileInfo: { extension: 'flac' } }),
        'android',
      ),
    ).toThrow(expect.objectContaining({ code: 'UnsupportedFormat' }));
  });

  test('planning path remains and write call requires readable file', async () => {
    const plan = prepareTagEditPlan(
      song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { comment: '   ' }, removeCover: true },
    );
    expect(plan.warnings.length).toBeGreaterThanOrEqual(0);
    const result = await writeTagsToFile(
      song({ uri: 'content://x.mp3', fileInfo: { extension: 'mp3' } }),
      {
        songId: '1',
        tags: {},
      },
    );
    expect(result).toMatchObject({
      status: 'writeFailed',
      errorCode: 'WriteNotImplemented',
    });
  });
});

describe('tag writable URI resolution', () => {
  test('resolveWritableTagUri prefers fileInfo.uri over song.uri when fileInfo is writable', () => {
    expect(
      resolveWritableTagUri(
        song({ uri: 'file:///fallback.mp3', fileInfo: { uri: 'file:///primary.mp3', extension: 'mp3' } }),
      ),
    ).toMatchObject({ ok: true, uri: 'file:///primary.mp3', source: 'fileInfo' });
  });

  test('resolveWritableTagUri rejects whitespace and missing URI without fallback', () => {
    expect(resolveWritableTagUri(song({ uri: '   ', fileInfo: { extension: 'mp3' } }))).toMatchObject({
      ok: false,
      status: 'unsupportedUri',
      reason: 'UnsupportedUri',
      uriType: 'empty',
    });
    expect(
      resolveWritableTagUri(song({ uri: 'file:///fallback.mp3', fileInfo: { uri: '   ', extension: 'mp3' } })),
    ).toMatchObject({ ok: false, source: 'fileInfo', uriType: 'empty' });
    expect(resolveWritableTagUri(song({ fileInfo: { extension: 'mp3' } }))).toMatchObject({
      ok: false,
      status: 'unsupportedUri',
      reason: 'UnsupportedUri',
    });
  });

  test('resolveWritableTagUri handles content and remote URIs explicitly', () => {
    expect(resolveWritableTagUri(song({ uri: 'content://a.mp3', fileInfo: { extension: 'mp3', source: 'saf' } }))).toMatchObject({
      ok: true,
      uri: 'content://a.mp3',
      uriType: 'content',
    });
    expect(resolveWritableTagUri(song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3', source: 'media-library' } }))).toMatchObject({
      ok: false,
      status: 'permissionDenied',
      reason: 'MissingWritePermission',
      uriType: 'content',
    });
    expect(resolveWritableTagUri(song({ uri: 'https://example.com/a.mp3', fileInfo: { extension: 'mp3' } }))).toMatchObject({
      ok: false,
      status: 'unsupportedUri',
      reason: 'UnsupportedUri',
      uriType: 'remote',
    });
  });

  test('buildTagWritePayload returns the normalized write target', () => {
    expect(
      buildTagWritePayload(
        song({ uri: 'file:///a.mp3', fileInfo: { uri: 'file:///b.mp3', extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
      ),
    ).toMatchObject({ uri: 'file:///b.mp3', uriSource: 'fileInfo', container: 'mp3' });
  });
});

describe('writeTagsToFile safe file writes', () => {
  type TestTagFileWriteAdapter = TagFileWriteAdapter & {
    canReplaceExistingFile: () => Promise<boolean>;
  };

  const mkAdapter = (initial: Record<string, Uint8Array>) => {
    const files = new Map(Object.entries(initial).map(([k, v]) => [k, v.slice()]));
    const ops: string[] = [];
    const adapter: TestTagFileWriteAdapter = {
      canReplaceExistingFile: async () => true,
      async getInfo(uri: string) {
        return { exists: files.has(uri), size: files.get(uri)?.length };
      },
      async readBytes(uri: string) {
        const v = files.get(uri);
        if (!v) throw new Error('missing');
        return v.slice();
      },
      async writeBytes(uri: string, bytes: Uint8Array) {
        ops.push(`temp:${uri}`);
        files.set(uri, bytes.slice());
      },
      async copyFile(from: string, to: string) {
        ops.push(`copy:${from}->${to}`);
        const v = files.get(from);
        if (!v) throw new Error('missing');
        files.set(to, v.slice());
      },
      async moveOrReplaceFile(from: string, to: string) {
        ops.push(`replace:${from}->${to}`);
        const v = files.get(from);
        if (!v) throw new Error('missing');
        files.set(to, v.slice());
        files.delete(from);
      },
      async deleteFile(uri: string) {
        files.delete(uri);
      },
    };
    return { ops, adapter, files };
  };

  const expectWriteFailure = async (
    resultPromise: Promise<WriteTagsResult>,
    errorCode: TagWriterErrorCode,
  ): Promise<WriteTagsResult> => {
    const result = await resultPromise;
    expect(result).toMatchObject({ errorCode });
    expect(result.status === 'unsupportedUri' || result.status === 'permissionDenied' || result.status === 'writeFailed').toBe(true);
    return result;
  };

  test('content uri without native writer returns controlled WriteNotImplemented', async () => {
    await expectWriteFailure(
      writeTagsToFile(song({ uri: 'content://a', fileInfo: { extension: 'mp3' } }), {
        songId: '1',
        tags: { title: 'X' },
      }),
      'WriteNotImplemented',
    );
  });

  test('unsupported replace support fails early without touching filesystem', async () => {
    const uri = 'file:///a.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'canReplaceExistingFile').mockResolvedValue(false);
    const copySpy = jest.spyOn(adapter, 'copyFile');
    const writeSpy = jest.spyOn(adapter, 'writeBytes');
    const replaceSpy = jest.spyOn(adapter, 'moveOrReplaceFile');
    const deleteSpy = jest.spyOn(adapter, 'deleteFile');
    await expectWriteFailure(
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
        { adapter },
      ),
      'WriteNotImplemented',
    );
    expect(copySpy).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  test('file uri no-op does not write backup/temp/replace', async () => {
    const uri = 'file:///a.mp3';
    const src = u8(1, 2, 3, 4);
    const { adapter, ops } = mkAdapter({ [uri]: src });
    const res = await writeTagsToFile(
      song({ uri, fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: {} },
      { adapter },
    );
    expect(res.status).toBe('noop');
    expect(ops).toEqual([]);
  });

  test('file uri write does backup temp verify replace in order', async () => {
    const uri = 'file:///a.mp3';
    const { adapter, ops, files } = mkAdapter({ [uri]: u8(1, 2, 3) });
    const res = await writeTagsToFile(
      song({ uri, fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' } },
      { adapter },
    );
    expect(res.status).toBe('written');
    expect(ops[0]).toContain('.bak');
    expect(ops[1]).toContain('.tmp');
    expect(ops[2]).toContain('replace');
    expect(files.get(uri)?.[0]).toBe(0x49);
    expect(
      Array.from(files.keys()).some(k => k.startsWith(`${uri}.`) && k.endsWith('.bak')),
    ).toBe(false);
  });

  test('each write attempt uses unique backup and temp sidecar paths', async () => {
    const uri = 'file:///a.mp3';
    const { adapter, ops } = mkAdapter({ [uri]: u8(1, 2, 3) });
    await writeTagsToFile(
      song({ uri, fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' } },
      { adapter },
    );
    await writeTagsToFile(
      song({ uri, fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'Y' } },
      { adapter },
    );
    const copyTargets = ops
      .filter(op => op.startsWith(`copy:${uri}->`))
      .map(op => op.split('->')[1]);
    const tempTargets = ops
      .filter(op => op.startsWith('temp:'))
      .map(op => op.replace('temp:', ''));
    expect(new Set(copyTargets).size).toBe(copyTargets.length);
    expect(new Set(tempTargets).size).toBe(tempTargets.length);
  });

  test('concurrent writes to same uri are serialized to avoid stale rollback clobbering newer bytes', async () => {
    const uri = 'file:///a.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    let activeWrites = 0;
    let maxActiveWrites = 0;
    const realCopy = adapter.copyFile.bind(adapter);
    jest.spyOn(adapter, 'copyFile').mockImplementation(async (from: string, to: string) => {
      if (from === uri && to.endsWith('.bak')) {
        activeWrites += 1;
        maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
        await new Promise(resolve => setTimeout(resolve, 0));
        await realCopy(from, to);
        activeWrites -= 1;
        return;
      }
      await realCopy(from, to);
    });

    const [firstResult, secondResult] = await Promise.all([
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
        { adapter },
      ),
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'Y' } },
        { adapter },
      ),
    ]);

    expect(firstResult.status).toBe('written');
    expect(secondResult.status).toBe('written');
    expect(maxActiveWrites).toBe(1);
  });

  test('backup failure stops before temp/replace', async () => {
    const uri = 'file:///a.mp3';
    const { adapter, ops } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'copyFile').mockImplementation(async () => {
      throw new Error('copy failed');
    });
    await expectWriteFailure(
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
        { adapter },
      ),
      'BackupFailed',
    );
    expect(ops.find(x => x.startsWith('temp:'))).toBeUndefined();
    expect(ops.find(x => x.startsWith('replace:'))).toBeUndefined();
  });

  test('source info failure throws UnsupportedUri and does not attempt write steps', async () => {
    const uri = 'file:///a.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    const readSpy = jest.spyOn(adapter, 'readBytes');
    const copySpy = jest.spyOn(adapter, 'copyFile');
    const writeSpy = jest.spyOn(adapter, 'writeBytes');
    const replaceSpy = jest.spyOn(adapter, 'moveOrReplaceFile');
    const deleteSpy = jest.spyOn(adapter, 'deleteFile');
    jest.spyOn(adapter, 'getInfo').mockImplementation(async () => {
      throw new Error('info unreadable');
    });
    await expectWriteFailure(
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
        { adapter },
      ),
      'UnsupportedUri',
    );
    expect(readSpy).not.toHaveBeenCalled();
    expect(copySpy).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  test('source read failure throws UnsupportedUri and does not attempt write steps', async () => {
    const uri = 'file:///a.mp3';
    const { adapter, ops } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'readBytes').mockImplementation(async (readUri: string) => {
      if (readUri === uri) throw new Error('source unreadable');
      return u8(1, 2, 3);
    });
    await expectWriteFailure(
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
        { adapter },
      ),
      'UnsupportedUri',
    );
    expect(ops.find(x => x.startsWith('copy:'))).toBeUndefined();
    expect(ops.find(x => x.startsWith('temp:'))).toBeUndefined();
    expect(ops.find(x => x.startsWith('replace:'))).toBeUndefined();
  });

  test('oversized files are blocked before reading full bytes when size is known', async () => {
    const uri = 'file:///huge.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'getInfo').mockImplementation(async () => ({
      exists: true,
      size: 11,
      isDirectory: false,
    }));
    const readSpy = jest.spyOn(adapter, 'readBytes');
    const copySpy = jest.spyOn(adapter, 'copyFile');

    await expectWriteFailure(
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
        { adapter, maxFileSizeBytes: 10 },
      ),
      'FileTooLarge',
    );
    expect(readSpy).not.toHaveBeenCalled();
    expect(copySpy).not.toHaveBeenCalled();
  });

  test('oversized files are blocked after read when provider does not report size', async () => {
    const uri = 'file:///huge.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3, 4) });
    jest.spyOn(adapter, 'getInfo').mockImplementation(async () => ({ exists: true }));
    const copySpy = jest.spyOn(adapter, 'copyFile');

    await expectWriteFailure(
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
        { adapter, maxFileSizeBytes: 3 },
      ),
      'FileTooLarge',
    );
    expect(copySpy).not.toHaveBeenCalled();
  });

  test('runtime options cannot widen the hard file-write safety ceiling', async () => {
    const uri = 'file:///a.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    const readSpy = jest.spyOn(adapter, 'readBytes');

    await expectWriteFailure(
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
        { adapter, maxFileSizeBytes: DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES + 1 },
      ),
      'FileTooLarge',
    );
    expect(readSpy).not.toHaveBeenCalled();
  });

  test('verification failure blocks replace when temp bytes differ from rewritten payload', async () => {
    const uri = 'file:///a.mp3';
    const { adapter, ops, files } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'readBytes').mockImplementation(async (readUri: string) => {
      if (readUri.endsWith('.tmp')) return u8(0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00);
      return u8(1, 2, 3);
    });
    await expectWriteFailure(
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
        { adapter },
      ),
      'VerificationFailed',
    );
    expect(ops.find(x => x.startsWith('replace:'))).toBeUndefined();
    expect(
      Array.from(files.keys()).some(k => k.startsWith(`${uri}.`) && k.endsWith('.tmp')),
    ).toBe(false);
    expect(
      Array.from(files.keys()).some(k => k.startsWith(`${uri}.`) && k.endsWith('.bak')),
    ).toBe(false);
  });

  test('temp read failure throws VerificationFailed and tries best-effort temp cleanup', async () => {
    const uri = 'file:///a.mp3';
    const { adapter, ops } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'readBytes').mockImplementation(async (readUri: string) => {
      if (readUri.includes('.tmp')) throw new Error('temp unreadable');
      return u8(1, 2, 3);
    });
    const delSpy = jest.spyOn(adapter, 'deleteFile');
    await expectWriteFailure(
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
        { adapter },
      ),
      'VerificationFailed',
    );
    expect(ops.find(x => x.startsWith('replace:'))).toBeUndefined();
    expect(delSpy).toHaveBeenCalledTimes(2);
  });

  test('temp write failure removes attempt-scoped backup sidecar', async () => {
    const uri = 'file:///a.mp3';
    const { adapter, files } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'writeBytes').mockImplementation(async () => {
      throw new Error('temp write failed');
    });
    await expectWriteFailure(
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
        { adapter },
      ),
      'TempWriteFailed',
    );
    expect(
      Array.from(files.keys()).some(k => k.startsWith(`${uri}.`) && k.endsWith('.bak')),
    ).toBe(false);
  });

  test('replace failure returns rolledBack and cleans temp/backup when rollback succeeds', async () => {
    const uri = 'file:///a.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'moveOrReplaceFile').mockImplementation(async () => {
      throw new Error('replace failed');
    });
    const deleteSpy = jest.spyOn(adapter, 'deleteFile');
    const result = await writeTagsToFile(
      song({ uri, fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' } },
      { adapter },
    );
    expect(result.status).toBe('rolledBack');
    expect(result.warnings.join(' ')).toMatch(/rollback restored backup/i);
    expect(deleteSpy).toHaveBeenCalledWith(expect.stringContaining('.tmp'));
    expect(deleteSpy).toHaveBeenCalledWith(expect.stringContaining('.bak'));
    expect(result.warnings.join(' ')).not.toMatch(/cleanup failed after rollback/i);
  });

  test('rollback backup cleanup failure is non-fatal and returns rolledBack with warning', async () => {
    const uri = 'file:///a.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'moveOrReplaceFile').mockImplementation(async () => {
      throw new Error('replace failed');
    });
    jest.spyOn(adapter, 'deleteFile').mockImplementation(async (targetUri: string) => {
      if (targetUri.endsWith('.bak')) throw new Error('backup cleanup failed');
    });
    const result = await writeTagsToFile(
      song({ uri, fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' } },
      { adapter },
    );
    expect(result.status).toBe('rolledBack');
    expect(result.warnings.join(' ')).toMatch(/backup cleanup failed after rollback/i);
  });

  test('rollback temp cleanup failure is non-fatal and returns rolledBack with warning', async () => {
    const uri = 'file:///a.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'moveOrReplaceFile').mockImplementation(async () => {
      throw new Error('replace failed');
    });
    jest.spyOn(adapter, 'deleteFile').mockImplementation(async (targetUri: string) => {
      if (targetUri.endsWith('.tmp')) throw new Error('temp cleanup failed');
    });
    const result = await writeTagsToFile(
      song({ uri, fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' } },
      { adapter },
    );
    expect(result.status).toBe('rolledBack');
    expect(result.warnings.join(' ')).toMatch(/temp cleanup failed after rollback/i);
  });

  test('replace failure with rollback failure throws RollbackFailed', async () => {
    const uri = 'file:///a.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'moveOrReplaceFile').mockImplementation(async () => {
      throw new Error('replace failed');
    });
    jest.spyOn(adapter, 'copyFile').mockImplementation(async (from: string, to: string) => {
      if (from.endsWith('.bak') && to === uri) throw new Error('rollback failed');
    });
    await expectWriteFailure(
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
        { adapter },
      ),
      'RollbackFailed',
    );
  });

  test('replace verification failure rolls back to original bytes', async () => {
    const uri = 'file:///a.mp3';
    const original = u8(1, 2, 3);
    const { adapter, files } = mkAdapter({ [uri]: original });
    jest.spyOn(adapter, 'moveOrReplaceFile').mockImplementation(async () => {
      files.set(uri, u8(9, 9, 9));
    });
    const result = await writeTagsToFile(
      song({ uri, fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' } },
      { adapter },
    );
    expect(result.status).toBe('rolledBack');
    expect(files.get(uri)).toEqual(original);
    expect(result.warnings.join(' ')).toMatch(/rollback restored backup/i);
  });

  test('rollback verification failure is reported as RollbackFailed', async () => {
    const uri = 'file:///a.mp3';
    const { adapter, files } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'moveOrReplaceFile').mockImplementation(async () => {
      throw new Error('replace failed');
    });
    jest.spyOn(adapter, 'copyFile').mockImplementation(async (from: string, to: string) => {
      if (from.endsWith('.bak') && to === uri) {
        files.set(uri, u8(7, 7, 7));
        return;
      }
      const v = files.get(from);
      if (!v) throw new Error('missing');
      files.set(to, v.slice());
    });
    await expectWriteFailure(
      writeTagsToFile(
        song({ uri, fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
        { adapter },
      ),
      'RollbackFailed',
    );
    expect(files.get(uri)).toEqual(u8(7, 7, 7));
  });

  test('backup cleanup failure keeps success with warning', async () => {
    const uri = 'file:///a.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'deleteFile').mockImplementation(async (targetUri: string) => {
      if (targetUri.endsWith('.bak')) throw new Error('cleanup failed');
    });
    const result = await writeTagsToFile(
      song({ uri, fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' } },
      { adapter },
    );
    expect(result.status).toBe('written');
    expect(result.warnings.join(' ')).toMatch(/backup cleanup failed/i);
  });

  test('temp cleanup failure after successful replace is non-fatal warning', async () => {
    const uri = 'file:///a.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    jest.spyOn(adapter, 'deleteFile').mockImplementation(async (targetUri: string) => {
      if (targetUri.includes('.tmp')) throw new Error('temp cleanup failed');
    });
    const result = await writeTagsToFile(
      song({ uri, fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' } },
      { adapter },
    );
    expect(result.status).toBe('written');
    expect(result.warnings.join(' ')).toMatch(/temp cleanup failed/i);
  });
});

describe('writeTagsToFile SAF/content native route', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const loadWithNative = (native: Record<string, unknown>) => {
    jest.doMock('expo-system-audio', () => ({
      __esModule: true,
      default: native,
      SystemAudio: native,
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../tagWriter') as typeof import('../tagWriter');
  };

  test('routes content:// mp3 through the metadata-only native SAF writer', async () => {
    const native = {
      isAvailable: true,
      hasNativeTagWriter: true,
      writeAudioTags: jest.fn(async (uri: string, request: { changedFields: string[]; operationId: string }) => ({
        success: true,
        uri,
        changedFields: request.changedFields,
        failedFields: [],
        verified: true,
        bytesBefore: 3,
        bytesAfter: 30,
        transactionId: 'tx-1',
        recovered: false,
        recoveryPending: false,
        operationId: request.operationId, phase: 'COMPLETED', terminal: true, retryable: false,
      })),
    };
    const { writeTagsToFile: write } = loadWithNative(native);
    const result = await write(
      song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' } },
    );
    expect(result.status).toBe('written');
    expect(result.transactionId).toBe('tx-1');
    expect(native.writeAudioTags).toHaveBeenCalledWith(
      'content://media/a.mp3',
      expect.objectContaining({
        container: 'mp3',
        tags: { title: 'X' },
        changedFields: ['title'],
      }),
    );
  });

  test('runtime options cannot widen the hard SAF safety ceiling', async () => {
    const native = {
      isAvailable: true,
      hasNativeTagWriter: true,
      writeAudioTags: jest.fn(),
    };
    const { writeTagsToFile: write } = loadWithNative(native);
    const result = await write(
      song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' } },
      { maxFileSizeBytes: DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES + 1 },
    );

    expect(result).toMatchObject({ status: 'writeFailed', errorCode: 'FileTooLarge' });
    expect(native.writeAudioTags).not.toHaveBeenCalled();
  });

  test('file:// keeps using the existing adapter path', async () => {
    const native = { isAvailable: true, hasNativeTagWriter: true, writeAudioTags: jest.fn() };
    const { writeTagsToFile: write } = loadWithNative(native);
    const uri = 'file:///a.mp3';
    const files = new Map<string, Uint8Array>([[uri, u8(1, 2, 3)]]);
    const adapter: TagFileWriteAdapter = {
      canReplaceExistingFile: async () => true,
      getInfo: async target => ({ exists: files.has(target), size: files.get(target)?.length }),
      readBytes: async target => files.get(target) ?? u8(),
      writeBytes: async (target, bytes) => { files.set(target, bytes); },
      copyFile: async (from, to) => { files.set(to, files.get(from) ?? u8()); },
      moveOrReplaceFile: async (from, to) => { files.set(to, files.get(from) ?? u8()); },
      deleteFile: async target => { files.delete(target); },
    };
    const result = await write(song({ uri, fileInfo: { extension: 'mp3' } }), { songId: '1', tags: { title: 'X' } }, { adapter });
    expect(result.status).toBe('written');
    expect(native.writeAudioTags).not.toHaveBeenCalled();
  });

  test('native unavailable returns WriteNotImplemented without crashing', async () => {
    const native = { isAvailable: false, hasNativeTagWriter: false, writeAudioTags: jest.fn() };
    const { writeTagsToFile: write } = loadWithNative(native);
    const result = await write(
      song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' } },
    );
    expect(result.status).toBe('writeFailed');
    expect(result.errorCode).toBe('WriteNotImplemented');
  });

  test('native failures never report written', async () => {
    const cases = [
      ['MissingWritePermission', 'permissionDenied'],
      ['UnsupportedFormat', 'unsupportedUri'],
      ['VerificationFailed', 'writeFailed'],
    ] as const;
    for (const [errorCode, status] of cases) {
      const native = {
        isAvailable: true,
        hasNativeTagWriter: true,
        writeAudioTags: jest.fn(async (uri: string, request: { operationId: string }) => ({
          success: false,
          uri,
          changedFields: [],
          failedFields: ['title'],
          errorCode,
          message: errorCode,
          verified: false,
          operationId: request.operationId, phase: 'FAILED', terminal: true, retryable: true,
        })),
      };
      const { writeTagsToFile: write } = loadWithNative(native);
      const result = await write(
        song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3' } }),
        { songId: '1', tags: { title: 'X' } },
      );
      expect(result.status).toBe(status);
      jest.dontMock('expo-system-audio');
      jest.resetModules();
    }
  });

  test('content:// m4a reaches the native streaming writer', async () => {
    const native = {
      isAvailable: true,
      hasNativeTagWriter: true,
      writeAudioTags: jest.fn(async (uri: string) => ({
        success: false,
        uri,
        changedFields: [],
        failedFields: ['title'],
        errorCode: 'WriteNotImplemented',
        message: 'fixture',
        verified: false,
      })),
    };
    const { writeTagsToFile: write } = loadWithNative(native);
    const result = await write(
      song({ uri: 'content://media/a.m4a', fileInfo: { extension: 'm4a' } }),
      { songId: '1', tags: { title: 'X' } },
    );
    expect(native.writeAudioTags).toHaveBeenCalledWith(
      'content://media/a.m4a',
      expect.objectContaining({ container: 'm4a' }),
    );
    expect(result.errorCode).not.toBe('UnsupportedFormat');
  });
});
