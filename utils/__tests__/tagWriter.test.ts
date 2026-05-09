import { applyTagEditToBuffer, ensureTagEditWriteAllowed, prepareTagEditPlan, TagWriterError, writeTagsToFile } from '../tagWriter';
import type { Song } from '../../types/Song';

const song = (overrides: Partial<Song>): Song => ({ id: '1', title: 'A', artist: 'B', ...overrides });

describe('tagWriter guarded behavior', () => {
  test('applyTagEditToBuffer throws per container policy', () => {
    expect(() => applyTagEditToBuffer(new Uint8Array([1]), 'mp3', { songId: '1', tags: {} })).toThrow(TagWriterError);
    expect(() => applyTagEditToBuffer(new Uint8Array([1]), 'm4a', { songId: '1', tags: {} })).toThrow(TagWriterError);
    expect(() => applyTagEditToBuffer(new Uint8Array([1]), 'mp4', { songId: '1', tags: {} })).toThrow(TagWriterError);
    expect(() => applyTagEditToBuffer(new Uint8Array([1]), 'unsupported', { songId: '1', tags: {} })).toThrow(TagWriterError);
  });

  test('ensureTagEditWriteAllowed code mapping', () => {
    const cases: Array<{ s: Song; code: string }> = [
      { s: song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), code: 'WriteNotImplemented' },
      { s: song({ uri: 'content://a.mp3', fileInfo: { extension: 'mp3' } }), code: 'MissingWritePermission' },
      { s: song({ uri: 'https://a.mp3', fileInfo: { extension: 'mp3' } }), code: 'UnsupportedUri' },
      { s: song({ uri: 'file:///a.flac', fileInfo: { extension: 'flac' } }), code: 'UnsupportedFormat' },
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

  test('removeCover ignores invalid cover payload in planning path', () => {
    const plan = prepareTagEditPlan(song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), {
      songId: '1',
      tags: { comment: '   ' },
      cover: { mimeType: 'image/jpeg', data: new Uint8Array([0x00]) },
      removeCover: true,
    });
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  test('writeTagsToFile stays blocked', async () => {
    await expect(writeTagsToFile()).rejects.toThrow(/disabled/i);
  });
});
