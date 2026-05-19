import {
  buildDraftFromDirtyFields,
  buildMetadataPatchFromDraft,
  hasRemovableCover,
  statusMessage,
  toInitialForm,
  type FormState,
} from '../tagEditorHelpers';
import type { Song } from '../../types/Song';

const song: Song = {
  id: 's1',
  title: 'Title',
  artist: 'Artist',
  album: 'Album',
  cover: 'file:///cover.jpg',
  coverInfo: { status: 'external', uri: 'file:///cover.jpg' },
};

const form: FormState = {
  title: ' New Title ',
  artist: 'Artist',
  album: '   ',
  year: '',
  genre: '',
  trackNumber: '',
  discNumber: '',
  comment: '',
};

describe('tagEditorHelpers', () => {
  test('builds initial form from song', () => {
    expect(toInitialForm(song)).toMatchObject({
      title: 'Title',
      artist: 'Artist',
      album: 'Album',
    });
  });

  test('builds draft from dirty fields only', () => {
    expect(buildDraftFromDirtyFields('s1', form, { title: true }, false)).toEqual({
      songId: 's1',
      tags: { title: ' New Title ' },
    });
  });

  test('builds metadata patch from normalized tags', () => {
    const draft = buildDraftFromDirtyFields('s1', form, { title: true, album: true }, false);

    expect(buildMetadataPatchFromDraft(draft)).toEqual({
      title: 'New Title',
      album: undefined,
    });
  });

  test('adds remove cover patch', () => {
    const draft = buildDraftFromDirtyFields('s1', form, {}, true);

    expect(buildMetadataPatchFromDraft(draft)).toEqual({
      cover: undefined,
      coverInfo: undefined,
    });
  });

  test('adds replacement cover patch', () => {
    const cover = {
      uri: 'file:///new-cover.jpg',
      mimeType: 'image/jpeg',
      base64: 'abc',
      sizeBytes: 1234,
    };
    const draft = buildDraftFromDirtyFields('s1', form, {}, false, cover);

    expect(buildMetadataPatchFromDraft(draft, cover)).toEqual({
      cover: 'file:///new-cover.jpg',
      coverInfo: { status: 'embedded', uri: 'file:///new-cover.jpg' },
    });
  });

  test('detects removable covers', () => {
    expect(hasRemovableCover(song)).toBe(true);
    expect(hasRemovableCover({ id: 's2', title: 'No Cover', artist: 'Artist' })).toBe(false);
  });

  test('maps status messages', () => {
    expect(statusMessage({ status: 'written' })).toBe('Metadaten erfolgreich geschrieben.');
    expect(statusMessage({ status: 'noop' })).toBe('Keine Änderung.');
    expect(statusMessage({ status: 'rolledBack' })).toBe('Änderung wurde zurückgerollt.');
    expect(statusMessage({ status: 'blocked', reasons: [] })).toBe('Schreiben blockiert.');
  });
});
