import {
  blockingReasonMessage,
  buildDraftFromDirtyFields,
  buildMetadataPatchFromDraft,
  ERROR_MESSAGES,
  hasRemovableCover,
  safetyNotice,
  statusMessage,
  toInitialForm,
  type FormState,
} from '../tagEditorHelpers';
import type { Song } from '../../types/Song';
import type { WriteTagsResult } from '../../types/TagEdit';
import type { PickedTagCover } from '../../utils/tagCoverPicker';

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

const writeResult = (status: WriteTagsResult['status']): WriteTagsResult => ({
  status,
  sourceUri: 'file:///song.mp3',
  warnings: [],
});

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
    const cover: PickedTagCover = {
      uri: 'file:///new-cover.jpg',
      mimeType: 'image/jpeg',
      data: new Uint8Array([1, 2, 3]),
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
    expect(statusMessage(writeResult('written'))).toBe('Metadaten erfolgreich geschrieben.');
    expect(statusMessage(writeResult('noop'))).toBe('Keine Änderung.');
    expect(statusMessage(writeResult('rolledBack'))).toBe('Änderung wurde zurückgerollt.');
    expect(statusMessage(writeResult('blocked'))).toBe('Schreiben blockiert.');
  });

  test('explains protected Android content URIs with an actionable copy hint', () => {
    expect(blockingReasonMessage(['MissingWritePermission'])).toContain('Kopiere sie zuerst in einen lokalen Musikordner');
    expect(safetyNotice({ id: 's3', title: 'Protected', artist: 'Artist', uri: 'content://music/song.mp3' })).toContain('Kopiere sie zuerst in einen lokalen Musikordner');
    expect(ERROR_MESSAGES.MissingWritePermission).toContain('geschützten Android-Ordner');
  });

  test('explains unsupported tag write layouts separately from platform replace support', () => {
    expect(ERROR_MESSAGES.WriteNotImplemented).toContain('ID3v2.4');
    expect(blockingReasonMessage(['WriteNotImplemented'])).toContain('Sicheres Ersetzen');
  });
});