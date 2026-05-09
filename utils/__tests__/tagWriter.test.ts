import { applyTagEditToBuffer, prepareTagEditPlan, serializeId3TextFrame, TagWriterError, writeTagsToFile } from '../tagWriter';
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

  test('serializeId3TextFrame creates expected frame header', () => {
    const frame = serializeId3TextFrame('TIT2', 'Hi');
    expect(String.fromCharCode(...Array.from(frame.slice(0, 4)))).toBe('TIT2');
    expect(frame[10]).toBe(0x00);
  });

  test('writeTagsToFile stays blocked', async () => {
    await expect(writeTagsToFile()).rejects.toThrow(/disabled/i);
  });
});
