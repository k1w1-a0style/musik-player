import { applyTagEditToBuffer, normalizeTagWriterErrorCode, TagWriterError } from '../tagWriter';
import { tagWriterErrorMessage } from '../../screens/tagEditorHelpers';

const u8 = (...values: number[]) => new Uint8Array(values);

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

const synchsafe = (size: number): Uint8Array => u8(
  (size >> 21) & 0x7f,
  (size >> 14) & 0x7f,
  (size >> 7) & 0x7f,
  size & 0x7f,
);

const ascii = (value: string): Uint8Array => new Uint8Array([...value].map(char => char.charCodeAt(0)));

const id3v24Frame = (id: string, body: Uint8Array, flags: [number, number] = [0, 0]): Uint8Array =>
  concat(ascii(id), synchsafe(body.length), u8(flags[0], flags[1]), body);

const id3v24Tag = (frames: Uint8Array[], audio: Uint8Array = u8(0xaa, 0xbb)): Uint8Array => {
  const payload = concat(...frames);
  return concat(u8(0x49, 0x44, 0x33, 0x04, 0x00, 0x00), synchsafe(payload.length), payload, audio);
};

const findSequence = (buffer: Uint8Array, sequence: Uint8Array): number => {
  for (let index = 0; index <= buffer.length - sequence.length; index += 1) {
    if (sequence.every((byte, offset) => buffer[index + offset] === byte)) return index;
  }
  return -1;
};

const id3v22 = new Uint8Array([
  0x49, 0x44, 0x33, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xaa, 0xbb,
]);

const simpleId3v24 = id3v24Tag([
  id3v24Frame('TIT2', concat(u8(0x03), ascii('Old title'))),
]);

describe('tag writer ID3 version error codes', () => {
  it('emits a specific code for ID3v2.2 write blocks', () => {
    try {
      applyTagEditToBuffer(id3v22, 'mp3', { songId: 's1', tags: { title: 'X' } });
      throw new Error('Expected ID3v2.2 write block');
    } catch (error) {
      expect(error).toBeInstanceOf(TagWriterError);
      expect((error as TagWriterError).code).toBe('WriteNotImplementedV22');
      expect((error as Error).message).toContain('ID3v2.2');
      expect(tagWriterErrorMessage((error as TagWriterError).code, (error as Error).message)).toContain('ID3v2.2');
    }
  });

  it('keeps ordinary ID3v2.4 tags as v2.4 and preserves untouched UTF-8 frames', () => {
    const audio = u8(0xde, 0xad, 0xbe, 0xef);
    const original = id3v24Tag([
      id3v24Frame('TIT2', concat(u8(0x03), ascii('Old title'))),
      id3v24Frame('TPE1', concat(u8(0x03), ascii('UTF8 Artist'))),
    ], audio);

    const result = applyTagEditToBuffer(original, 'mp3', {
      songId: 's1',
      tags: { title: 'New title' },
    });

    expect(result[3]).toBe(0x04);
    const artistFrameOffset = findSequence(result, ascii('TPE1'));
    expect(artistFrameOffset).toBeGreaterThan(0);
    expect(result[artistFrameOffset + 10]).toBe(0x03);
    expect(Array.from(result.slice(-audio.length))).toEqual(Array.from(audio));
  });

  it('blocks ID3v2.4 frames with unsupported flags before mutation', () => {
    const flagged = id3v24Tag([
      id3v24Frame('TIT2', concat(u8(0x03), ascii('Old title')), [0, 1]),
    ]);

    expect(() => applyTagEditToBuffer(flagged, 'mp3', {
      songId: 's1',
      tags: { title: 'New title' },
    })).toThrow(TagWriterError);
  });

  it('rewrites a simple ID3v2.4 tag instead of emitting a version block', () => {
    const result = applyTagEditToBuffer(simpleId3v24, 'mp3', { songId: 's1', tags: { title: 'X' } });
    expect(result[3]).toBe(0x04);
    expect(result).not.toBe(simpleId3v24);
  });

  it('keeps unrelated WriteNotImplemented errors generic', () => {
    const error = new TagWriterError('WriteNotImplemented', 'MP4 largesize atoms are not supported yet.');

    expect(error.code).toBe('WriteNotImplemented');
    expect(tagWriterErrorMessage(error.code, error.message)).toContain('Tag-Layout');
  });

  it('normalizes only known ID3 version messages', () => {
    expect(normalizeTagWriterErrorCode('WriteNotImplemented', 'Existing ID3v2.2 tags are not supported yet.')).toBe('WriteNotImplementedV22');
    expect(normalizeTagWriterErrorCode('WriteNotImplemented', 'Rewriting existing ID3v2.4 tags is not supported yet.')).toBe('WriteNotImplementedV24');
    expect(normalizeTagWriterErrorCode('WriteNotImplemented', 'Other unsupported write.')).toBe('WriteNotImplemented');
    expect(normalizeTagWriterErrorCode('InvalidTagData', 'ID3v2.4 mention inside unrelated error.')).toBe('InvalidTagData');
  });


  it('normalizes native SAF error codes at runtime', () => {
    expect(normalizeTagWriterErrorCode('BackupCorrupted')).toBe('BackupCorrupted');
    expect(normalizeTagWriterErrorCode('RecoveryPending')).toBe('RecoveryPending');
    expect(normalizeTagWriterErrorCode('UnknownNativeCode')).toBe('ReplaceFailed');
    expect(normalizeTagWriterErrorCode(null)).toBe('ReplaceFailed');
    expect(normalizeTagWriterErrorCode(undefined)).toBe('ReplaceFailed');
    expect(normalizeTagWriterErrorCode(42)).toBe('ReplaceFailed');
  });

  it('maps BackupCorrupted to the German recovery safety message', () => {
    expect(tagWriterErrorMessage('BackupCorrupted')).toContain('Wiederherstellungs-Backup ist beschädigt');
  });

  it('does not affect normal MP3 writes', () => {
    const output = applyTagEditToBuffer(u8(1, 2, 3), 'mp3', {
      songId: 's1',
      tags: { title: 'X' },
    });

    expect(String.fromCharCode(output[0], output[1], output[2])).toBe('ID3');
  });
});
