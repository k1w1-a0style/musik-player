import { applyTagEditToBuffer, buildId3v23TagFromDraft, buildMp3TextFrames, ensureTagEditWriteAllowed, ID3_TEXT_FRAME_MAP, mergeId3v23TagIntoMp3Buffer, prepareTagEditPlan, serializeId3ApicFrame, serializeId3CommentFrame, serializeId3TextFrame, TagWriterError, writeTagsToFile } from '../tagWriter';
import type { Song } from '../../types/Song';

const song = (overrides: Partial<Song>): Song => ({ id: '1', title: 'A', artist: 'B', ...overrides });

describe('tagWriter', () => {
  test('UnsupportedFormat is thrown', () => {
    expect(() => applyTagEditToBuffer(new Uint8Array([1]), 'unsupported', { songId: '1', tags: {} })).toThrow(TagWriterError);
  });

  test('WriteNotImplemented for m4a/mp4', () => {
    expect(() => applyTagEditToBuffer(new Uint8Array([1]), 'm4a', { songId: '1', tags: {} })).toThrow(/not implemented/i);
  });

  test('prepareTagEditPlan warns for risky uri', () => {
    const plan = prepareTagEditPlan(song({ uri: 'content://x/1', fileInfo: { extension: 'mp3' } }), { songId: '1', tags: {} });
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  test('prepareTagEditPlan rejects unknown uri type', () => {
    expect(() => prepareTagEditPlan(song({ uri: '/relative/file.mp3', fileInfo: { extension: 'mp3' } }), { songId: '1', tags: {} })).toThrow(/unsupported uri/i);
  });

  test('serializeId3TextFrame creates expected frame header', () => {
    const frame = serializeId3TextFrame('TIT2', 'Hi');
    expect(String.fromCharCode(...Array.from(frame.slice(0, 4)))).toBe('TIT2');
    expect(frame[10]).toBe(0x00);
  });

  test('serializeId3TextFrame rejects invalid frame id', () => {
    expect(() => serializeId3TextFrame('TXXX', 'X')).toThrow(/unsupported id3 text frame id/i);
  });

  test('serializeId3TextFrame rejects empty payload', () => {
    expect(() => serializeId3TextFrame('TIT2', '   ')).toThrow(/must not be empty/i);
  });


  test('serializeId3CommentFrame creates COMM frame', () => {
    const frame = serializeId3CommentFrame('hello');
    expect(String.fromCharCode(...Array.from(frame.slice(0, 4)))).toBe('COMM');
  });

  test('serializeId3ApicFrame creates APIC frame', () => {
    const frame = serializeId3ApicFrame('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff]));
    expect(String.fromCharCode(...Array.from(frame.slice(0, 4)))).toBe('APIC');
  });
  test('buildMp3TextFrames maps known fields', () => {
    const frames = buildMp3TextFrames({ title: 'Song', artist: 'Artist', comment: 'ignored' });
    expect(frames.length).toBe(2);
    expect(ID3_TEXT_FRAME_MAP.title).toBe('TIT2');
  });



  test('buildId3v23TagFromDraft creates ID3 header and payload', () => {
    const tag = buildId3v23TagFromDraft({ songId: '1', tags: { title: 'Song', artist: 'Artist' } });
    expect(String.fromCharCode(...Array.from(tag.slice(0, 3)))).toBe('ID3');
    expect(tag[3]).toBe(0x03);
    expect(tag.length).toBeGreaterThan(10);
  });


  test('mergeId3v23TagIntoMp3Buffer prepends tag when no ID3 exists', () => {
    const audio = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
    const merged = mergeId3v23TagIntoMp3Buffer(audio, { songId: '1', tags: { title: 'Song' } });
    expect(String.fromCharCode(...Array.from(merged.slice(0, 3)))).toBe('ID3');
    expect(Array.from(merged.slice(-4))).toEqual([0xff, 0xfb, 0x90, 0x64]);
  });

  test('mergeId3v23TagIntoMp3Buffer replaces existing ID3 tag', () => {
    const oldTag = new Uint8Array([0x49,0x44,0x33,0x03,0x00,0x00,0x00,0x00,0x00,0x00]);
    const audio = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
    const original = new Uint8Array(oldTag.length + audio.length);
    original.set(oldTag, 0);
    original.set(audio, oldTag.length);
    const merged = mergeId3v23TagIntoMp3Buffer(original, { songId: '1', tags: { artist: 'Artist' } });
    expect(String.fromCharCode(...Array.from(merged.slice(0, 3)))).toBe('ID3');
    expect(Array.from(merged.slice(-4))).toEqual([0xff, 0xfb, 0x90, 0x64]);
  });




  test('mergeId3v23TagIntoMp3Buffer preserves unknown existing frames', () => {
    const txxx = new Uint8Array([
      0x54,0x58,0x58,0x58, // TXXX
      0x00,0x00,0x00,0x03, // size
      0x00,0x00,
      0x00,0x41,0x42, // payload
    ]);
    const header = new Uint8Array([0x49,0x44,0x33,0x03,0x00,0x00,0x00,0x00,0x00,0x0d]);
    const audio = new Uint8Array([0xff,0xfb,0x90,0x64]);
    const original = new Uint8Array(header.length + txxx.length + audio.length);
    original.set(header, 0);
    original.set(txxx, header.length);
    original.set(audio, header.length + txxx.length);

    const merged = mergeId3v23TagIntoMp3Buffer(original, { songId: '1', tags: { title: 'Song' } });
    const mergedText = String.fromCharCode(...Array.from(merged));
    expect(mergedText.includes('TXXX')).toBe(true);
    expect(Array.from(merged.slice(-4))).toEqual([0xff, 0xfb, 0x90, 0x64]);
  });
  test('mergeId3v23TagIntoMp3Buffer rejects truncated existing ID3 tag', () => {
    const truncated = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0xff]);
    expect(() => mergeId3v23TagIntoMp3Buffer(truncated, { songId: '1', tags: { title: 'X' } })).toThrow(/truncated/i);
  });
  test('mp3 apply path returns merged buffer', () => {
    const original = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
    const merged = applyTagEditToBuffer(original, 'mp3', { songId: '1', tags: { title: 'X' } });
    expect(String.fromCharCode(...Array.from(merged.slice(0, 3)))).toBe('ID3');
    expect(Array.from(merged.slice(-4))).toEqual([0xff, 0xfb, 0x90, 0x64]);
  });

  test('ensureTagEditWriteAllowed maps permission errors', () => {
    expect(() => ensureTagEditWriteAllowed(song({ uri: 'content://x/1', fileInfo: { extension: 'mp3' } }))).toThrow(/permission/i);
    expect(() => ensureTagEditWriteAllowed(song({ uri: 'https://example.com/a.mp3', fileInfo: { extension: 'mp3' } }))).toThrow(/read-only/i);
  });
  test('writeTagsToFile stays blocked', async () => {
    await expect(writeTagsToFile()).rejects.toThrow(/disabled/i);
  });
});
