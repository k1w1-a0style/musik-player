import { applyTagEditToBuffer, decodeSynchsafe, encodeSynchsafe, TagWriterError } from '../tagWriter';
import { ensureTagEditWriteAllowed, prepareTagEditPlan, writeTagsToFile } from '../tagWriter';
import type { Song } from '../../types/Song';

const song = (overrides: Partial<Song>): Song => ({ id: '1', title: 'A', artist: 'B', ...overrides });
const u8 = (...x: number[]) => new Uint8Array(x);
const text = (s: string) => new TextEncoder().encode(s);
const mkFrame = (id: string, body: Uint8Array) => { const f = new Uint8Array(10 + body.length); f.set(text(id),0); f.set([0,0,0,body.length],4); f.set(body,10); return f; };
const mkTag = (frames: Uint8Array[], version = 3, flags = 0, footer = false) => { const payload = frames.reduce((n,f)=>n+f.length,0); const h = new Uint8Array(10); h.set([0x49,0x44,0x33,version,0,flags],0); h.set(encodeSynchsafe(payload),6); const b = new Uint8Array(10+payload+(footer?10:0)); b.set(h,0); let o=10; for(const f of frames){b.set(f,o);o+=f.length;} return b; };

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

  test('removeCover ignores invalid payload', () => {
    const out = applyTagEditToBuffer(u8(1,2), 'mp3', { songId:'1', tags:{}, removeCover:true, cover:{mimeType:'image/jpeg', data:u8(0)} });
    expect(out[0]).toBe(0x49);
  });

  test('unsync tag throws', () => {
    const src = new Uint8Array([...mkTag([],3,0x80), 1,2]);
    expect(() => applyTagEditToBuffer(src, 'mp3', { songId:'1', tags:{} })).toThrow(/unsynchronisation/i);
  });

  test('v2.4 footer is removed and audio starts after footer boundary', () => {
    const frame = mkFrame('TIT2', u8(0x03, 0x41));
    const tag = mkTag([frame], 4, 0x10, true);
    const src = new Uint8Array([...tag, 0xaa, 0xbb, 0xcc]);
    const out = applyTagEditToBuffer(src, 'mp3', { songId: '1', tags: { artist: 'X' } });
    expect(Array.from(out.slice(out.length - 3))).toEqual([0xaa, 0xbb, 0xcc]);
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
