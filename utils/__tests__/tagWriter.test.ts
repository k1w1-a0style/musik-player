import { applyTagEditToBuffer, decodeSynchsafe, encodeSynchsafe, hasCompleteId3Header, readId3Header, TagWriterError, validateId3PayloadSize } from '../tagWriter';
import { ensureTagEditWriteAllowed, prepareTagEditPlan, writeTagsToFile } from '../tagWriter';
import type { Song } from '../../types/Song';

const song = (overrides: Partial<Song>): Song => ({ id: '1', title: 'A', artist: 'B', ...overrides });
const u8 = (...x: number[]) => new Uint8Array(x);
const text = (s: string) => new TextEncoder().encode(s);
const mkFrame = (id: string, body: Uint8Array) => { const f = new Uint8Array(10 + body.length); f.set(text(id),0); f.set([0,0,0,body.length],4); f.set(body,10); return f; };
const mkTag = (frames: Uint8Array[], version = 3, flags = 0, footer = false) => { const payload = frames.reduce((n,f)=>n+f.length,0); const h = new Uint8Array(10); h.set([0x49,0x44,0x33,version,0,flags],0); h.set(encodeSynchsafe(payload),6); const b = new Uint8Array(10+payload+(footer?10:0)); b.set(h,0); let o=10; for(const f of frames){b.set(f,o);o+=f.length;} return b; };
const frameIds = (buffer: Uint8Array): string[] => {
  const ids: string[] = [];
  const size = decodeSynchsafe(buffer.slice(6, 10));
  let p = 10;
  const end = 10 + size;
  while (p + 10 <= end && buffer[p] !== 0) {
    ids.push(String.fromCharCode(buffer[p], buffer[p + 1], buffer[p + 2], buffer[p + 3]));
    const frameSize = (buffer[p + 4] << 24) | (buffer[p + 5] << 16) | (buffer[p + 6] << 8) | buffer[p + 7];
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
      try { encodeSynchsafe(size as number); throw new Error('Expected throw'); } catch (error) { expect((error as TagWriterError).code).toBe('InvalidTagData'); }
    }
  });

  test('validateId3PayloadSize enforces synchsafe upper bound', () => {
    expect(() => validateId3PayloadSize(0x0fffffff)).not.toThrow();
    expect(() => validateId3PayloadSize(0x10000000)).toThrow(/synchsafe/i);
  });


  test('truncated ID3 preamble of 3 bytes is rejected', () => {
    expect(() => applyTagEditToBuffer(u8(0x49, 0x44, 0x33), 'mp3', { songId: '1', tags: { title: 'X' } })).toThrow(/Truncated ID3 header/i);
  });

  test('truncated ID3 preamble of 4 bytes is rejected', () => {
    expect(() => applyTagEditToBuffer(u8(0x49, 0x44, 0x33, 0x03), 'mp3', { songId: '1', tags: { title: 'X' } })).toThrow(/Truncated ID3 header/i);
  });

  test('readId3Header rejects ID3 preamble shorter than full header', () => {
    expect(() => readId3Header(u8(0x49, 0x44, 0x33, 0x03, 0x00))).toThrow(/Truncated ID3 header/i);
  });

  test('buffer with only "ID" is not treated as ID3 preamble', () => {
    expect(hasCompleteId3Header(u8(0x49, 0x44))).toBe(false);
    const out = applyTagEditToBuffer(u8(0x49, 0x44, 0x01), 'mp3', { songId: '1', tags: { title: 'X' } });
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
    const audio = u8(1,2,3,4);
    const out = applyTagEditToBuffer(audio, 'mp3', { songId:'1', tags:{ title:'Ärger' } });
    expect(String.fromCharCode(out[0],out[1],out[2])).toBe('ID3');
    expect(out[3]).toBe(3);
    expect(Array.from(out.slice(out.length-4))).toEqual([1,2,3,4]);
  });

  test('writes unicode including emoji as utf16', () => {
    const audio = u8(4, 3, 2, 1);
    const out = applyTagEditToBuffer(audio, 'mp3', { songId: '1', tags: { title: 'Привет 漢字 🎵' } });
    const headerSize = decodeSynchsafe(out.slice(6, 10));
    const payload = out.slice(10, 10 + headerSize);
    expect(new TextDecoder().decode(payload).includes('TIT2')).toBe(true);
    expect(payload.includes(0x01)).toBe(true);
    expect(payload.includes(0xff)).toBe(true);
    expect(payload.includes(0xfe)).toBe(true);
  });

  test('year uses TYER and drops TDRC', () => {
    const tdrc = mkFrame('TDRC', u8(0,'2'.charCodeAt(0)));
    const src = new Uint8Array([...mkTag([tdrc]), 9,9]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId:'1', tags:{ year:'2020' } });
    const s = new TextDecoder().decode(out);
    expect(s.includes('TYER')).toBe(true);
    expect(s.includes('TDRC')).toBe(false);
  });

  test('partial title edit preserves untouched artist/album', () => {
    const src = new Uint8Array([...mkTag([mkFrame('TIT2', u8(0x03, 0x41)), mkFrame('TPE1', u8(0x03, 0x42)), mkFrame('TALB', u8(0x03, 0x43))]), 7, 7]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'New Title' } });
    const ids = frameIds(out);
    expect(ids).toContain('TIT2');
    expect(ids).toContain('TPE1');
    expect(ids).toContain('TALB');
  });

  test('partial genre edit preserves year/track/disc', () => {
    const src = new Uint8Array([...mkTag([mkFrame('TYER', u8(0x03, 0x32)), mkFrame('TCON', u8(0x03, 0x31)), mkFrame('TRCK', u8(0x03, 0x31)), mkFrame('TPOS', u8(0x03, 0x31))]), 1]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { genre: 'Techno' } });
    const ids = frameIds(out);
    expect(ids).toEqual(expect.arrayContaining(['TYER', 'TCON', 'TRCK', 'TPOS']));
  });

  test('without year field existing TYER and TDRC are preserved', () => {
    const src = new Uint8Array([...mkTag([mkFrame('TYER', u8(0x03, 0x32)), mkFrame('TDRC', u8(0x03, 0x32))]), 1]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } });
    expect(frameIds(out)).toEqual(expect.arrayContaining(['TYER', 'TDRC']));
  });

  test('comment touched empty removes COMM, untouched preserves COMM', () => {
    const src = new Uint8Array([...mkTag([mkFrame('COMM', u8(0x01, 0x65, 0x6e, 0x67, 0x00, 0x00, 0x00, 0x00)), mkFrame('TPE1', u8(0x03, 0x42))]), 1]);
    const unchanged = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'A' } });
    expect(frameIds(unchanged)).toContain('COMM');
    const removed = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { comment: '   ' } });
    expect(frameIds(removed)).not.toContain('COMM');
  });


  test('comment touched with value replaces COMM and keeps other frames', () => {
    const oldComm = mkFrame('COMM', u8(0x01, 0x65, 0x6e, 0x67, 0x00, 0x00, 0x00, 0x00));
    const src = new Uint8Array([...mkTag([oldComm, mkFrame('TPE1', u8(0x03, 0x42))]), 1]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { comment: 'New' } });
    const ids = frameIds(out);
    expect(ids).toContain('COMM');
    expect(ids).toContain('TPE1');
  });

  test('unicode comment is written via COMM frame', () => {
    const out = applyTagEditToBuffer(u8(1, 2, 3), 'mp3', { songId: '1', tags: { comment: 'Привет 🎵' } });
    expect(frameIds(out)).toContain('COMM');
  });

  test('title touched empty removes TIT2 but keeps others', () => {
    const src = new Uint8Array([...mkTag([mkFrame('TIT2', u8(0x03, 0x41)), mkFrame('TPE1', u8(0x03, 0x42))]), 1]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: '   ' } });
    expect(frameIds(out)).not.toContain('TIT2');
    expect(frameIds(out)).toContain('TPE1');
  });


  test('undefined fields are untouched and preserve existing semantic frames', () => {
    const src = new Uint8Array([...mkTag([mkFrame('TIT2', u8(0x03, 0x41)), mkFrame('TPE1', u8(0x03, 0x42)), mkFrame('TALB', u8(0x03, 0x43))]), 1, 2, 3]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: undefined, artist: undefined, album: undefined } });
    expect(frameIds(out)).toEqual(expect.arrayContaining(['TIT2', 'TPE1', 'TALB']));
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  test('cover remove/replace/preserve behaviors', () => {
    const apic = mkFrame('APIC', u8(0x00, 0x69, 0x6d, 0x61, 0x67, 0x65, 0x2f, 0x6a, 0x70, 0x65, 0x67, 0x00, 0x03, 0x00, 0xff, 0xd8, 0xff));
    const src = new Uint8Array([...mkTag([apic, mkFrame('TPE1', u8(0x03, 0x42))]), 1]);
    expect(frameIds(applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {}, removeCover: true }))).not.toContain('APIC');
    expect(frameIds(applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {}, cover: { mimeType: 'image/png', data: u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) } }))).toContain('APIC');
    expect(frameIds(applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } }))).toContain('APIC');
  });



  test('apic body stores mime, type and image bytes at tail', () => {
    const data = u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    const out = applyTagEditToBuffer(u8(1, 2, 3), 'mp3', { songId: '1', tags: {}, cover: { mimeType: 'image/png', data } });
    const size = decodeSynchsafe(out.slice(6, 10));
    const payload = out.slice(10, 10 + size);
    const apicIndex = new TextDecoder().decode(payload).indexOf('APIC');
    expect(apicIndex).toBeGreaterThanOrEqual(0);
    const frameStart = apicIndex;
    const frameSize = (payload[frameStart + 4] << 24) | (payload[frameStart + 5] << 16) | (payload[frameStart + 6] << 8) | payload[frameStart + 7];
    const body = payload.slice(frameStart + 10, frameStart + 10 + frameSize);
    expect(body[0]).toBe(0x00);
    expect(new TextDecoder().decode(body).includes('image/png')).toBe(true);
    expect(body[body.length - data.length - 2]).toBe(0x03);
    expect(Array.from(body.slice(body.length - data.length))).toEqual(Array.from(data));
  });

  test('preserves valid unknown frames like TXXX and PRIV', () => {
    const src = new Uint8Array([...mkTag([mkFrame('TXXX', u8(0x00, 0x41)), mkFrame('PRIV', u8(0x01, 0x02)), mkFrame('TPE1', u8(0x03, 0x42))]), 1]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } });
    expect(frameIds(out)).toEqual(expect.arrayContaining(['TXXX', 'PRIV', 'TPE1', 'TIT2']));
  });

  test('rejects existing non-ASCII frame id', () => {
    const bad = mkFrame('ÿPE1', u8(0x03, 0x41));
    const src = new Uint8Array([...mkTag([bad]), 1]);
    expect(() => applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } })).toThrow(/frame ID/i);
  });

  test('rejects existing lowercase frame id', () => {
    const bad = mkFrame('abcd', u8(0x03, 0x41));
    const src = new Uint8Array([...mkTag([bad]), 1]);
    expect(() => applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } })).toThrow(/frame ID/i);
  });

  test('removeCover ignores invalid payload', () => {
    const out = applyTagEditToBuffer(u8(1,2), 'mp3', { songId:'1', tags:{}, removeCover:true, cover:{mimeType:'image/jpeg', data:u8(0)} });
    expect(Array.from(out)).toEqual([1,2]);
  });

  test('unsync tag throws', () => {
    const src = new Uint8Array([...mkTag([],3,0x80), 1,2]);
    expect(() => applyTagEditToBuffer(src, 'mp3', { songId:'1', tags:{} })).toThrow(/unsynchronisation/i);
  });



  test('untagged mp3 with empty draft is a no-op', () => {
    const src = u8(1, 2, 3, 4);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {} });
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  test('untagged mp3 with removeCover true is a no-op', () => {
    const src = u8(5, 6, 7);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {}, removeCover: true });
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  test('existing tag with empty draft is a no-op', () => {
    const src = new Uint8Array([...mkTag([mkFrame('TIT2', u8(0x03, 0x41))]), 9]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {} });
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  test('existing tag with removeCover true and no APIC is a no-op', () => {
    const src = new Uint8Array([...mkTag([mkFrame('TPE1', u8(0x03, 0x42))]), 9]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {}, removeCover: true });
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  test('existing id3v2.4 is rejected to avoid mixed-version output', () => {
    const frame = mkFrame('TIT2', u8(0x03, 0x41));
    const tag = mkTag([frame], 4, 0x10, true);
    const src = new Uint8Array([...tag, 0xaa, 0xbb, 0xcc]);
    expect(() => applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { artist: 'X' } })).toThrow(/ID3v2.4/i);
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
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: undefined, comment: undefined } });
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  test('existing id3v2.4 with whitespace title is still blocked as edit intent', () => {
    const frame = mkFrame('TIT2', u8(0x03, 0x41));
    const tag = mkTag([frame], 4, 0x10, true);
    const src = new Uint8Array([...tag, 0xaa, 0xbb, 0xcc]);
    expect(() => applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: '   ' } })).toThrow(/ID3v2.4/i);
  });

  test('existing id3v2.4 with removeCover true is still blocked as edit intent', () => {
    const frame = mkFrame('TIT2', u8(0x03, 0x41));
    const tag = mkTag([frame], 4, 0x10, true);
    const src = new Uint8Array([...tag, 0xaa, 0xbb, 0xcc]);
    expect(() => applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {}, removeCover: true })).toThrow(/ID3v2.4/i);
  });

  test('existing id3v2.4 with cover set is still blocked as edit intent', () => {
    const frame = mkFrame('TIT2', u8(0x03, 0x41));
    const tag = mkTag([frame], 4, 0x10, true);
    const src = new Uint8Array([...tag, 0xaa, 0xbb, 0xcc]);
    expect(() => applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {}, cover: { mimeType: 'image/png', data: u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) } })).toThrow(/ID3v2.4/i);
  });

  test('existing id3v2.2 is rejected', () => {
    const src = new Uint8Array([0x49, 0x44, 0x33, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xaa, 0xbb]);
    expect(() => applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } })).toThrow(/ID3v2.2/i);
  });

  test('container policy', () => {
    expect(Array.from(applyTagEditToBuffer(u8(1), 'm4a', { songId: '1', tags: {} }))).toEqual([1]);
    expect(Array.from(applyTagEditToBuffer(u8(1), 'mp4', { songId: '1', tags: {} }))).toEqual([1]);
    expect(() => applyTagEditToBuffer(u8(1), 'unsupported', { songId: '1', tags: {} })).toThrow(TagWriterError);
  });

  test('ensureTagEditWriteAllowed code mapping', () => {
    const cases: Array<{ s: Song; code: string }> = [
            { s: song({ uri: 'content://a.mp3', fileInfo: { extension: 'mp3' } }), code: 'MissingWritePermission' },
      { s: song({ uri: 'https://a.mp3', fileInfo: { extension: 'mp3' } }), code: 'UnsupportedUri' },
      { s: song({ uri: 'file:///a.flac', fileInfo: { extension: 'flac' } }), code: 'UnsupportedFormat' },
    ];
    for (const item of cases) { try { ensureTagEditWriteAllowed(item.s); throw new Error('Expected throw'); } catch (error) { expect((error as TagWriterError).code).toBe(item.code); } }
  });

  test('planning path remains and write call requires readable file', async () => {
    const plan = prepareTagEditPlan(song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), { songId: '1', tags: { comment: '   ' }, removeCover: true });
    expect(plan.warnings.length).toBeGreaterThanOrEqual(0);
    await expect(writeTagsToFile(song({ uri: 'content://x.mp3', fileInfo: { extension: 'mp3' } }), { songId: '1', tags: {} })).rejects.toThrow(/SAF/i);
  });
});

describe('writeTagsToFile safe file writes', () => {
  const mkAdapter = (initial: Record<string, Uint8Array>) => {
    const files = new Map(Object.entries(initial).map(([k, v]) => [k, v.slice()]));
    const ops: string[] = [];
    return {
      ops,
      adapter: {
        async getInfo(uri: string) { return { exists: files.has(uri), size: files.get(uri)?.length }; },
        async readBytes(uri: string) { const v = files.get(uri); if (!v) throw new Error('missing'); return v.slice(); },
        async writeBytes(uri: string, bytes: Uint8Array) { ops.push(`temp:${uri}`); files.set(uri, bytes.slice()); },
        async copyFile(from: string, to: string) { ops.push(`copy:${from}->${to}`); const v = files.get(from); if (!v) throw new Error('missing'); files.set(to, v.slice()); },
        async moveOrReplaceFile(from: string, to: string) { ops.push(`replace:${from}->${to}`); const v = files.get(from); if (!v) throw new Error('missing'); files.set(to, v.slice()); files.delete(from); },
        async deleteFile(uri: string) { files.delete(uri); },
      },
      files,
    };
  };

  test('content uri remains blocked', async () => {
    await expect(writeTagsToFile(song({ uri: 'content://a', fileInfo: { extension: 'mp3' } }), { songId: '1', tags: { title: 'X' } })).rejects.toMatchObject({ code: 'MissingWritePermission' });
  });

  test('file uri no-op does not write backup/temp/replace', async () => {
    const uri = 'file:///a.mp3';
    const src = u8(1, 2, 3, 4);
    const { adapter, ops } = mkAdapter({ [uri]: src });
    const res = await writeTagsToFile(song({ uri, fileInfo: { extension: 'mp3' } }), { songId: '1', tags: {} }, { adapter: adapter as any });
    expect(res.status).toBe('noop');
    expect(ops).toEqual([]);
  });

  test('file uri write does backup temp verify replace in order', async () => {
    const uri = 'file:///a.mp3';
    const { adapter, ops, files } = mkAdapter({ [uri]: u8(1, 2, 3) });
    const res = await writeTagsToFile(song({ uri, fileInfo: { extension: 'mp3' } }), { songId: '1', tags: { title: 'X' } }, { adapter: adapter as any });
    expect(res.status).toBe('written');
    expect(ops[0]).toContain('.bak');
    expect(ops[1]).toContain('.tmp');
    expect(ops[2]).toContain('replace');
    expect(files.get(uri)?.[0]).toBe(0x49);
    expect(files.has(`${uri}.bak`)).toBe(false);
  });

  test('backup failure stops before temp/replace', async () => {
    const uri = 'file:///a.mp3';
    const { adapter, ops } = mkAdapter({ [uri]: u8(1, 2, 3) });
    (adapter.copyFile as any) = jest.fn(async () => { throw new Error('copy failed'); });
    await expect(writeTagsToFile(song({ uri, fileInfo: { extension: 'mp3' } }), { songId: '1', tags: { title: 'X' } }, { adapter: adapter as any }))
      .rejects.toMatchObject({ code: 'BackupFailed' });
    expect(ops.find((x) => x.startsWith('temp:'))).toBeUndefined();
    expect(ops.find((x) => x.startsWith('replace:'))).toBeUndefined();
  });

  test('verification failure blocks replace when temp bytes differ from rewritten payload', async () => {
    const uri = 'file:///a.mp3';
    const { adapter, ops, files } = mkAdapter({ [uri]: u8(1, 2, 3) });
    (adapter.readBytes as any) = jest.fn(async (readUri: string) => {
      if (readUri.endsWith('.tmp')) return u8(0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00);
      return u8(1, 2, 3);
    });
    await expect(writeTagsToFile(song({ uri, fileInfo: { extension: 'mp3' } }), { songId: '1', tags: { title: 'X' } }, { adapter: adapter as any }))
      .rejects.toMatchObject({ code: 'VerificationFailed' });
    expect(ops.find((x) => x.startsWith('replace:'))).toBeUndefined();
    expect(files.has(`${uri}.tmp`)).toBe(false);
  });

  test('replace failure returns rolledBack when rollback succeeds', async () => {
    const uri = 'file:///a.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    (adapter.moveOrReplaceFile as any) = jest.fn(async () => { throw new Error('replace failed'); });
    const result = await writeTagsToFile(song({ uri, fileInfo: { extension: 'mp3' } }), { songId: '1', tags: { title: 'X' } }, { adapter: adapter as any });
    expect(result.status).toBe('rolledBack');
    expect(result.warnings.join(' ')).toMatch(/rollback restored backup/i);
  });

  test('replace failure with rollback failure throws RollbackFailed', async () => {
    const uri = 'file:///a.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    (adapter.moveOrReplaceFile as any) = jest.fn(async () => { throw new Error('replace failed'); });
    (adapter.copyFile as any) = jest.fn(async (from: string, to: string) => {
      if (from.endsWith('.bak') && to === uri) throw new Error('rollback failed');
    });
    await expect(writeTagsToFile(song({ uri, fileInfo: { extension: 'mp3' } }), { songId: '1', tags: { title: 'X' } }, { adapter: adapter as any }))
      .rejects.toMatchObject({ code: 'RollbackFailed' });
  });

  test('backup cleanup failure keeps success with warning', async () => {
    const uri = 'file:///a.mp3';
    const { adapter } = mkAdapter({ [uri]: u8(1, 2, 3) });
    (adapter.deleteFile as any) = jest.fn(async (targetUri: string) => {
      if (targetUri.endsWith('.bak')) throw new Error('cleanup failed');
    });
    const result = await writeTagsToFile(song({ uri, fileInfo: { extension: 'mp3' } }), { songId: '1', tags: { title: 'X' } }, { adapter: adapter as any });
    expect(result.status).toBe('written');
    expect(result.warnings.join(' ')).toMatch(/backup cleanup failed/i);
  });
});
