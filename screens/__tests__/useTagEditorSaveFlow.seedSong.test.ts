import type { Song } from '../../types/Song';
import type { TagEditDraft } from '../../types/TagEdit';
import { buildTagVerificationSeedSong } from '../useTagEditorSaveFlow';

const COMPLETE_SONG: Song = {
  id: 'song-1',
  title: 'Old title',
  artist: 'Old artist',
  albumArtist: 'Old album artist',
  album: 'Old album',
  year: '1999',
  genre: 'Rock',
  trackNumber: '3',
  discNumber: '1',
  comment: 'Old comment',
  uri: 'content://playback/song-1',
  fileInfo: {
    uri: 'content://saf/document/song-1',
    extension: 'mp3',
  },
  cover: 'file:///old-cover.jpg',
  coverInfo: { status: 'embedded', uri: 'file:///old-cover.jpg' },
};

const draft = (tags: TagEditDraft['tags']): TagEditDraft => ({
  songId: COMPLETE_SONG.id,
  tags,
});

describe('buildTagVerificationSeedSong field reset contract', () => {
  test('clears every drafted editable field before the re-read', () => {
    const seed = buildTagVerificationSeedSong(
      COMPLETE_SONG,
      draft({
        title: 'New title',
        artist: 'New artist',
        albumArtist: 'New album artist',
        album: 'New album',
        year: '2026',
        genre: 'Jazz',
        trackNumber: '7',
        discNumber: '2',
        comment: 'New comment',
      }),
    );

    expect(seed).toMatchObject({
      id: COMPLETE_SONG.id,
      title: '',
      artist: '',
      uri: 'content://saf/document/song-1',
      fileInfo: {
        ...COMPLETE_SONG.fileInfo,
        uri: 'content://saf/document/song-1',
      },
      cover: COMPLETE_SONG.cover,
      coverInfo: COMPLETE_SONG.coverInfo,
    });
    expect(seed.albumArtist).toBeUndefined();
    expect(seed.album).toBeUndefined();
    expect(seed.year).toBeUndefined();
    expect(seed.genre).toBeUndefined();
    expect(seed.trackNumber).toBeUndefined();
    expect(seed.discNumber).toBeUndefined();
    expect(seed.comment).toBeUndefined();
  });

  test('keeps fields that are not part of the draft unchanged', () => {
    const seed = buildTagVerificationSeedSong(
      COMPLETE_SONG,
      draft({ title: 'New title', genre: 'Jazz' }),
    );

    expect(seed.title).toBe('');
    expect(seed.genre).toBeUndefined();
    expect(seed.artist).toBe(COMPLETE_SONG.artist);
    expect(seed.albumArtist).toBe(COMPLETE_SONG.albumArtist);
    expect(seed.album).toBe(COMPLETE_SONG.album);
    expect(seed.year).toBe(COMPLETE_SONG.year);
    expect(seed.trackNumber).toBe(COMPLETE_SONG.trackNumber);
    expect(seed.discNumber).toBe(COMPLETE_SONG.discNumber);
    expect(seed.comment).toBe(COMPLETE_SONG.comment);
    expect(seed.cover).toBe(COMPLETE_SONG.cover);
    expect(seed.coverInfo).toBe(COMPLETE_SONG.coverInfo);
  });
});
