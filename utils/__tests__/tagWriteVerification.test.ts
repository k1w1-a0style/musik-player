import type { TagFileWriteAdapter } from '../tagFileWriteAdapter';
import { applyTagEditToBuffer } from '../tagWriterValidation';
import { encodeBytesToBase64 } from '../base64';
import {
  hasTagDeletionIntent,
  hasUnsupportedMp3TailMetadata,
  verifyTagDeletionState,
} from '../tagWriteVerification';

const song = {
  id: 'song-1',
  title: 'Old title',
  artist: 'Artist',
  uri: 'file:///song.mp3',
  fileInfo: { uri: 'file:///song.mp3', extension: 'mp3' },
};

const createReadAdapter = (bytes?: Uint8Array): TagFileWriteAdapter => ({
  canReplaceExistingFile: () => true,
  readBytes: jest.fn(async () => {
    if (!bytes) throw new Error('unreadable');
    return bytes;
  }),
  writeBytes: jest.fn(async () => undefined),
  copyFile: jest.fn(async () => undefined),
  moveOrReplaceFile: jest.fn(async () => undefined),
  deleteFile: jest.fn(async () => undefined),
  getInfo: jest.fn(async () => ({
    exists: Boolean(bytes),
    size: bytes?.length,
    isDirectory: false,
  })),
});

const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

const asciiBytes = (value: string): Uint8Array =>
  Uint8Array.from(Array.from(value, character => character.charCodeAt(0)));

const createId3v1Tail = (): Uint8Array => {
  const tail = new Uint8Array(128);
  tail.set(asciiBytes('TAG'), 0);
  tail.set(asciiBytes('Old title'), 3);
  return tail;
};

const createApeFooter = (): Uint8Array => {
  const footer = new Uint8Array(32);
  footer.set(asciiBytes('APETAGEX'), 0);
  return footer;
};

describe('tag deletion byte verification', () => {
  const audio = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4]);
  const deleteTitleDraft = { songId: song.id, tags: { title: '' } };

  test('detects explicit text and cover deletion intents only', () => {
    expect(hasTagDeletionIntent(deleteTitleDraft)).toBe(true);
    expect(hasTagDeletionIntent({ songId: song.id, tags: { title: 'New' } })).toBe(false);
    expect(hasTagDeletionIntent({ songId: song.id, tags: {}, removeCover: true })).toBe(true);
  });

  test('detects unsupported MP3 tail metadata layouts', () => {
    expect(hasUnsupportedMp3TailMetadata(audio)).toBe(false);
    expect(hasUnsupportedMp3TailMetadata(concatBytes(audio, createId3v1Tail()))).toBe(true);
    expect(hasUnsupportedMp3TailMetadata(concatBytes(audio, createApeFooter()))).toBe(true);
    expect(hasUnsupportedMp3TailMetadata(concatBytes(audio, asciiBytes('LYRICS200')))).toBe(true);
  });

  test('rejects a file whose title deletion has not actually been applied', async () => {
    const tagged = applyTagEditToBuffer(audio, 'mp3', {
      songId: song.id,
      tags: { title: 'Old title' },
    });

    await expect(verifyTagDeletionState(song, deleteTitleDraft, 'mp3', {
      adapter: createReadAdapter(tagged),
    })).resolves.toBe(false);
  });

  test('accepts a byte-idempotent title deletion', async () => {
    await expect(verifyTagDeletionState(song, deleteTitleDraft, 'mp3', {
      adapter: createReadAdapter(audio),
    })).resolves.toBe(true);
  });

  test('rejects byte-idempotent deletion when stale ID3v1 metadata remains', async () => {
    const withId3v1 = concatBytes(audio, createId3v1Tail());
    await expect(verifyTagDeletionState(song, deleteTitleDraft, 'mp3', {
      adapter: createReadAdapter(withId3v1),
    })).resolves.toBe(false);
  });

  test('rejects byte-idempotent deletion when an APEv2 footer remains', async () => {
    const withApeFooter = concatBytes(audio, createApeFooter());
    await expect(verifyTagDeletionState(song, deleteTitleDraft, 'mp3', {
      adapter: createReadAdapter(withApeFooter),
    })).resolves.toBe(false);
  });

  test('rejects an unreadable writer target instead of trusting empty metadata', async () => {
    await expect(verifyTagDeletionState(song, deleteTitleDraft, 'mp3', {
      adapter: createReadAdapter(undefined),
    })).resolves.toBe(false);
  });

  test('supports byte evidence for content URIs through the native read boundary', async () => {
    const contentSong = {
      ...song,
      uri: 'content://documents/song-1',
      fileInfo: { ...song.fileInfo, uri: 'content://documents/song-1' },
    };

    await expect(verifyTagDeletionState(contentSong, deleteTitleDraft, 'mp3', {
      readContentBase64: jest.fn(async () => encodeBytesToBase64(audio)),
    })).resolves.toBe(true);
  });

  test('rejects missing content read evidence', async () => {
    const contentSong = {
      ...song,
      uri: 'content://documents/song-1',
      fileInfo: { ...song.fileInfo, uri: 'content://documents/song-1' },
    };

    await expect(verifyTagDeletionState(contentSong, deleteTitleDraft, 'mp3', {
      readContentBase64: jest.fn(async () => null),
    })).resolves.toBe(false);
  });
});
