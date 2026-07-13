import type { Song } from '../../types/Song';
import type { TagEditDraft } from '../../types/TagEdit';
import {
  buildTagVerificationSeedSong,
  buildVerifiedTagPatch,
} from '../useTagEditorSaveFlow';

const song: Song = {
  id: 'song-1',
  title: 'Old title',
  artist: 'Old artist',
  album: 'Old album',
  uri: 'file:///song.mp3',
  fileInfo: { uri: 'file:///song.mp3', extension: 'mp3' },
  cover: 'file:///old-cover.jpg',
  coverInfo: { status: 'embedded', uri: 'file:///old-cover.jpg' },
};

describe('TagEditor post-write verification helpers', () => {
  it('clears drafted fields and cover state before the metadata re-read', () => {
    const draft: TagEditDraft = {
      songId: song.id,
      tags: { title: '', album: '', artist: 'New artist' },
      removeCover: true,
    };

    const seed = buildTagVerificationSeedSong(song, draft);

    expect(seed.title).toBe('');
    expect(seed.artist).toBe('');
    expect(seed.album).toBeUndefined();
    expect(seed.cover).toBeUndefined();
    expect(seed.coverInfo).toBeUndefined();
    expect(seed.fileInfo).toEqual(song.fileInfo);
  });

  it('re-reads the same fileInfo URI that the writer targets', () => {
    const sourceWithDifferentPlaybackUri: Song = {
      ...song,
      uri: 'content://playback-cache/song-1',
      fileInfo: { ...song.fileInfo, uri: 'content://saf/document/song-1' },
    };

    const seed = buildTagVerificationSeedSong(sourceWithDifferentPlaybackUri, {
      songId: song.id,
      tags: { title: 'New title' },
    });

    expect(seed.uri).toBe('content://saf/document/song-1');
    expect(seed.fileInfo?.uri).toBe('content://saf/document/song-1');
  });

  it('accepts confirmed text and cover deletions instead of restoring old song values', () => {
    const draft: TagEditDraft = {
      songId: song.id,
      tags: { title: '', album: '' },
      removeCover: true,
    };
    const reread = buildTagVerificationSeedSong(song, draft);

    expect(buildVerifiedTagPatch(song, reread, draft)).toEqual({
      title: '',
      album: undefined,
      cover: undefined,
      coverInfo: undefined,
    });
  });

  it('rejects a deletion when the re-read still contains the old metadata', () => {
    const draft: TagEditDraft = {
      songId: song.id,
      tags: { title: '' },
    };

    expect(buildVerifiedTagPatch(song, song, draft)).toBeUndefined();
  });

  it('uses the re-read embedded cover instead of the picker preview as verified truth', () => {
    const draft: TagEditDraft = {
      songId: song.id,
      tags: {},
      cover: {
        mimeType: 'image/jpeg',
        data: new Uint8Array([1, 2, 3]),
      },
    };
    const reread: Song = {
      ...song,
      cover: 'file:///verified-embedded-cover.jpg',
      coverInfo: {
        status: 'embedded',
        uri: 'file:///verified-embedded-cover.jpg',
        embeddedArtworkChecked: true,
      },
    };

    expect(buildVerifiedTagPatch(song, reread, draft)).toMatchObject({
      cover: 'file:///verified-embedded-cover.jpg',
      coverInfo: {
        status: 'embedded',
        uri: 'file:///verified-embedded-cover.jpg',
      },
    });
  });
});
