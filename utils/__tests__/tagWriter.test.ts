import { applyTagEditToBuffer, buildMp3TextFrames, ID3_TEXT_FRAME_MAP, prepareTagEditPlan, serializeId3TextFrame, TagWriterError, writeTagsToFile } from '../tagWriter';
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
  test('buildMp3TextFrames maps known fields', () => {
    const frames = buildMp3TextFrames({ title: 'Song', artist: 'Artist', comment: 'ignored' });
    expect(frames.length).toBe(2);
    expect(ID3_TEXT_FRAME_MAP.title).toBe('TIT2');
  });


  test('mp3 apply path is intentionally blocked', () => {
    expect(() => applyTagEditToBuffer(new Uint8Array([1, 2, 3]), 'mp3', { songId: '1', tags: { title: 'X' } })).toThrow(/not yet enabled/i);
  });
  test('writeTagsToFile stays blocked', async () => {
    await expect(writeTagsToFile()).rejects.toThrow(/disabled/i);
  });
});
