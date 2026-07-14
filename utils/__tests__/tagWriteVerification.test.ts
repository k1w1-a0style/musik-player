import type { TagFileWriteAdapter } from '../tagFileWriteAdapter';
import { applyTagEditToBuffer } from '../tagWriterValidation';
import { encodeBytesToBase64 } from '../base64';
import {
  hasTagDeletionIntent,
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

describe('tag deletion byte verification', () => {
  const audio = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4]);
  const deleteTitleDraft = { songId: song.id, tags: { title: '' } };

  test('detects explicit text and cover deletion intents only', () => {
    expect(hasTagDeletionIntent(deleteTitleDraft)).toBe(true);
    expect(hasTagDeletionIntent({ songId: song.id, tags: { title: 'New' } })).toBe(false);
    expect(hasTagDeletionIntent({ songId: song.id, tags: {}, removeCover: true })).toBe(true);
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
