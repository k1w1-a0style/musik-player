import { applyTagEditToBuffer, TagWriterError } from '../tagWriter';

const u8 = (...values: number[]) => new Uint8Array(values);

const id3v22 = new Uint8Array([
  0x49, 0x44, 0x33, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xaa, 0xbb,
]);

const id3v24 = new Uint8Array([
  0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a,
  0x54, 0x49, 0x54, 0x32, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xaa, 0xbb,
]);

describe('tag writer ID3 version error codes', () => {
  it('exposes a specific code for ID3v2.2 write blocks', () => {
    try {
      applyTagEditToBuffer(id3v22, 'mp3', { songId: 's1', tags: { title: 'X' } });
      throw new Error('Expected ID3v2.2 write block');
    } catch (error) {
      expect(error).toBeInstanceOf(TagWriterError);
      expect((error as TagWriterError).code).toBe('WriteNotImplementedV22');
      expect((error as Error).message).toContain('ID3v2.2');
    }
  });

  it('exposes a specific code for ID3v2.4 write blocks', () => {
    try {
      applyTagEditToBuffer(id3v24, 'mp3', { songId: 's1', tags: { title: 'X' } });
      throw new Error('Expected ID3v2.4 write block');
    } catch (error) {
      expect(error).toBeInstanceOf(TagWriterError);
      expect((error as TagWriterError).code).toBe('WriteNotImplementedV24');
      expect((error as Error).message).toContain('ID3v2.4');
    }
  });

  it('keeps unrelated WriteNotImplemented errors generic', () => {
    const error = new TagWriterError('WriteNotImplemented', 'MP4 largesize atoms are not supported yet.');

    expect(error.code).toBe('WriteNotImplemented');
  });

  it('does not affect normal MP3 writes', () => {
    const output = applyTagEditToBuffer(u8(1, 2, 3), 'mp3', {
      songId: 's1',
      tags: { title: 'X' },
    });

    expect(String.fromCharCode(output[0], output[1], output[2])).toBe('ID3');
  });
});
