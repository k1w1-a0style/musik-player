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

  it('compares MP3 genre codes against the parser-normalized genre', () => {
    const draft: TagEditDraft = {
      songId: song.id,
      tags: { genre: '17' },
    };
    const reread: Song = { ...song, genre: 'Rock' };

    expect(buildVerifiedTagPatch(song, reread, draft)).toEqual({ genre: 'Rock' });
  });

  it('keeps numeric M4A/MP4 genres literal during verification', () => {
    const mp4Song: Song = {
      ...song,
      uri: 'file:///song.m4a',
      fileInfo: { uri: 'file:///song.m4a', extension: 'm4a' },
    };
    const draft: TagEditDraft = {
      songId: mp4Song.id,
      tags: { genre: '17' },
    };
    const reread: Song = { ...mp4Song, genre: '17' };

    expect(buildVerifiedTagPatch(mp4Song, reread, draft)).toEqual({ genre: '17' });
  });

  it('accepts the exact re-read embedded cover bytes as verified truth', () => {
    const verifiedCover = 'data:image/jpeg;base64,AQID';
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
      cover: verifiedCover,
      coverInfo: {
        status: 'embedded',
        uri: verifiedCover,
        embeddedArtworkChecked: true,
      },
    };

    expect(buildVerifiedTagPatch(song, reread, draft)).toMatchObject({
      cover: verifiedCover,
      coverInfo: {
        status: 'embedded',
        uri: verifiedCover,
      },
    });
  });

  it('rejects a stale or different cover after a reported write', () => {
    const draft: TagEditDraft = {
      songId: song.id,
      tags: {},
      cover: {
        mimeType: 'image/jpeg',
        data: new Uint8Array([1, 2, 3]),
      },
    };

    expect(buildVerifiedTagPatch(song, song, draft)).toBeUndefined();
  });
});
