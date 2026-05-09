import { applyTagEditToBuffer, decodeSynchsafe, encodeSynchsafe, TagWriterError } from '../tagWriter';
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

  test('title touched empty removes TIT2 but keeps others', () => {
    const src = new Uint8Array([...mkTag([mkFrame('TIT2', u8(0x03, 0x41)), mkFrame('TPE1', u8(0x03, 0x42))]), 1]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: '   ' } });
    expect(frameIds(out)).not.toContain('TIT2');
    expect(frameIds(out)).toContain('TPE1');
  });


  test('undefined touched fields remove existing semantic frames', () => {
    const src = new Uint8Array([...mkTag([mkFrame('TIT2', u8(0x03, 0x41)), mkFrame('TPE1', u8(0x03, 0x42))]), 1]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: undefined, artist: undefined, album: undefined } });
    expect(frameIds(out)).not.toContain('TIT2');
    expect(frameIds(out)).not.toContain('TPE1');
  });

  test('cover remove/replace/preserve behaviors', () => {
    const apic = mkFrame('APIC', u8(0x00, 0x69, 0x6d, 0x61, 0x67, 0x65, 0x2f, 0x6a, 0x70, 0x65, 0x67, 0x00, 0x03, 0x00, 0xff, 0xd8, 0xff));
    const src = new Uint8Array([...mkTag([apic, mkFrame('TPE1', u8(0x03, 0x42))]), 1]);
    expect(frameIds(applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {}, removeCover: true }))).not.toContain('APIC');
    expect(frameIds(applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: {}, cover: { mimeType: 'image/png', data: u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) } }))).toContain('APIC');
    expect(frameIds(applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } }))).toContain('APIC');
  });

  test('removeCover ignores invalid payload', () => {
    const out = applyTagEditToBuffer(u8(1,2), 'mp3', { songId:'1', tags:{}, removeCover:true, cover:{mimeType:'image/jpeg', data:u8(0)} });
    expect(out[0]).toBe(0x49);
  });

  test('unsync tag throws', () => {
    const src = new Uint8Array([...mkTag([],3,0x80), 1,2]);
    expect(() => applyTagEditToBuffer(src, 'mp3', { songId:'1', tags:{} })).toThrow(/unsynchronisation/i);
  });

  test('existing id3v2.4 is rejected to avoid mixed-version output', () => {
    const frame = mkFrame('TIT2', u8(0x03, 0x41));
    const tag = mkTag([frame], 4, 0x10, true);
    const src = new Uint8Array([...tag, 0xaa, 0xbb, 0xcc]);
    expect(() => applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { artist: 'X' } })).toThrow(/ID3v2.4/i);
  });

  test('existing id3v2.2 is rejected', () => {
    const src = new Uint8Array([0x49, 0x44, 0x33, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xaa, 0xbb]);
    expect(() => applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { title: 'X' } })).toThrow(/ID3v2.2/i);
  });

  test('container policy', () => {
    expect(() => applyTagEditToBuffer(u8(1), 'm4a', { songId: '1', tags: {} })).toThrow(TagWriterError);
    expect(() => applyTagEditToBuffer(u8(1), 'mp4', { songId: '1', tags: {} })).toThrow(TagWriterError);
    expect(() => applyTagEditToBuffer(u8(1), 'unsupported', { songId: '1', tags: {} })).toThrow(TagWriterError);
  });

  test('ensureTagEditWriteAllowed code mapping', () => {
    const cases: Array<{ s: Song; code: string }> = [
      { s: song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), code: 'WriteNotImplemented' },
      { s: song({ uri: 'content://a.mp3', fileInfo: { extension: 'mp3' } }), code: 'MissingWritePermission' },
      { s: song({ uri: 'https://a.mp3', fileInfo: { extension: 'mp3' } }), code: 'UnsupportedUri' },
      { s: song({ uri: 'file:///a.flac', fileInfo: { extension: 'flac' } }), code: 'UnsupportedFormat' },
    ];
    for (const item of cases) { try { ensureTagEditWriteAllowed(item.s); throw new Error('Expected throw'); } catch (error) { expect((error as TagWriterError).code).toBe(item.code); } }
  });

  test('planning path and blocked file write unchanged', async () => {
    const plan = prepareTagEditPlan(song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), { songId: '1', tags: { comment: '   ' }, removeCover: true });
    expect(plan.warnings.length).toBeGreaterThanOrEqual(0);
    await expect(writeTagsToFile()).rejects.toThrow(/disabled/i);
  });
});
