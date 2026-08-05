import {
  blockingReasonMessage,
  buildDraftFromDirtyFields,
  buildMetadataPatchFromDraft,
  ERROR_MESSAGES,
  hasRemovableCover,
  resetEmbeddedArtworkRevisionForTests,
  safetyNotice,
  statusMessage,
  tagWriterErrorMessage,
  toInitialForm,
  type FormState,
} from '../tagEditorHelpers';
import type { Song } from '../../types/Song';
import type { WriteTagsResult } from '../../types/TagEdit';
import type { PickedTagCover } from '../../utils/tagCoverPicker';
import { needsEmbeddedCoverBackfill } from '../../utils/songCoverBackfill';

const song: Song = {
  id: 's1',
  title: 'Title',
  artist: 'Artist',
  albumArtist: 'Various Artists',
  album: 'Album',
  cover: 'file:///cover.jpg',
  coverInfo: { status: 'external', uri: 'file:///cover.jpg' },
};

const form: FormState = {
  title: ' New Title ',
  artist: 'Artist',
  albumArtist: ' Various Artists ',
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
  beforeEach(() => {
    resetEmbeddedArtworkRevisionForTests();
  });

  test('builds initial form from song', () => {
    expect(toInitialForm(song)).toMatchObject({
      title: 'Title',
      artist: 'Artist',
      albumArtist: 'Various Artists',
      album: 'Album',
    });
  });

  test('builds draft from dirty fields only', () => {
    expect(buildDraftFromDirtyFields('s1', form, { title: true, albumArtist: true }, false)).toEqual({
      songId: 's1',
      tags: { title: ' New Title ', albumArtist: ' Various Artists ' },
    });
  });

  test('builds metadata patch from normalized tags', () => {
    const draft = buildDraftFromDirtyFields('s1', form, { title: true, albumArtist: true, album: true }, false);

    expect(buildMetadataPatchFromDraft(draft)).toEqual({
      title: 'New Title',
      albumArtist: 'Various Artists',
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

  test('adds replacement cover patch as a pending preview so backfill can extract a stable cover', () => {
    const cover: PickedTagCover = {
      uri: 'file:///new-cover.jpg',
      mimeType: 'image/jpeg',
      data: new Uint8Array([1, 2, 3]),
      sizeBytes: 1234,
    };
    const draft = buildDraftFromDirtyFields('s1', form, {}, false, cover);

    const patch = buildMetadataPatchFromDraft(draft, cover);

    expect(patch).toEqual({
      cover: 'file:///new-cover.jpg',
      coverInfo: {
        status: 'external',
        uri: 'file:///new-cover.jpg',
        embeddedArtworkChecked: false,
        embeddedArtworkRevision: 1,
        pendingEmbeddedArtworkRefresh: true,
        embeddedArtworkRefreshFailed: false,
      },
    });
    expect(needsEmbeddedCoverBackfill({ ...song, ...patch, uri: 'file:///song.mp3' })).toBe(true);
  });

  test('increments embedded artwork revision for repeated replacement patches', () => {
    const firstCover: PickedTagCover = {
      uri: 'file:///first-cover.jpg',
      mimeType: 'image/jpeg',
      data: new Uint8Array([1]),
      sizeBytes: 1,
    };
    const secondCover: PickedTagCover = {
      uri: 'file:///second-cover.jpg',
      mimeType: 'image/jpeg',
      data: new Uint8Array([2]),
      sizeBytes: 1,
    };

    const firstPatch = buildMetadataPatchFromDraft(buildDraftFromDirtyFields('s1', form, {}, false, firstCover), firstCover);
    const secondPatch = buildMetadataPatchFromDraft(buildDraftFromDirtyFields('s1', form, {}, false, secondCover), secondCover);

    expect(firstPatch.coverInfo?.embeddedArtworkRevision).toBe(1);
    expect(secondPatch.coverInfo?.embeddedArtworkRevision).toBe(2);
    expect(firstPatch.cover).toBe('file:///first-cover.jpg');
    expect(secondPatch.cover).toBe('file:///second-cover.jpg');
    expect(firstPatch.coverInfo?.pendingEmbeddedArtworkRefresh).toBe(true);
    expect(secondPatch.coverInfo?.pendingEmbeddedArtworkRefresh).toBe(true);
    expect(firstPatch.coverInfo?.embeddedArtworkRefreshFailed).toBe(false);
    expect(secondPatch.coverInfo?.embeddedArtworkRefreshFailed).toBe(false);
  });

  test('detects file-removable covers from legacy cover presence and embedded/cached statuses only', () => {
    expect(hasRemovableCover({ ...song, coverInfo: undefined })).toBe(true);
    expect(hasRemovableCover({ id: 's2', title: 'Embedded with URI', artist: 'Artist', coverInfo: { status: 'embedded', uri: 'file:///embedded.jpg' } })).toBe(true);
    expect(hasRemovableCover({ id: 's3', title: 'Cached with URI', artist: 'Artist', coverInfo: { status: 'cached', uri: 'file:///cached.jpg' } })).toBe(true);
    expect(hasRemovableCover({ id: 's4', title: 'Embedded without URI', artist: 'Artist', coverInfo: { status: 'embedded' } })).toBe(true);
    expect(hasRemovableCover({ id: 's5', title: 'External only', artist: 'Artist', coverInfo: { status: 'external', uri: 'file:///external.jpg' } })).toBe(false);
    expect(hasRemovableCover({ id: 's5-cover', title: 'External app cover', artist: 'Artist', cover: 'file:///app-cover.jpg', coverInfo: { status: 'external', uri: 'file:///app-cover.jpg' } })).toBe(false);
    expect(hasRemovableCover({
      id: 's5-pending',
      title: 'Pending replacement preview',
      artist: 'Artist',
      cover: 'file:///picked-cover.jpg',
      coverInfo: { status: 'external', uri: 'file:///picked-cover.jpg', pendingEmbeddedArtworkRefresh: true },
    })).toBe(true);
    expect(hasRemovableCover({
      id: 's5-failed',
      title: 'Failed replacement preview',
      artist: 'Artist',
      cover: 'file:///picked-cover.jpg',
      coverInfo: { status: 'external', uri: 'file:///picked-cover.jpg', pendingEmbeddedArtworkRefresh: false, embeddedArtworkRefreshFailed: true },
    })).toBe(true);
    expect(hasRemovableCover({ id: 's6', title: 'No cover', artist: 'Artist', coverInfo: { status: 'none' } })).toBe(false);
    expect(hasRemovableCover({ id: 's7', title: 'Unknown cover', artist: 'Artist', coverInfo: { status: 'unknown' } })).toBe(false);
    expect(hasRemovableCover({ id: 's8', title: 'Unknown app cover', artist: 'Artist', cover: 'file:///unknown-cover.jpg', coverInfo: { status: 'unknown' } })).toBe(false);
  });

  test('maps status messages', () => {
    expect(statusMessage(writeResult('written'))).toBe('Metadaten erfolgreich geschrieben.');
    expect(statusMessage(writeResult('noop'))).toBe('Keine Änderung.');
    expect(statusMessage(writeResult('rolledBack'))).toBe('Änderung wurde zurückgerollt.');
    expect(statusMessage(writeResult('blocked'))).toBe('Schreiben blockiert.');
  });

  test('explains protected Android content URIs with an actionable copy hint', () => {
    expect(blockingReasonMessage(['MissingWritePermission'])).toContain('Schreibzugriff eingeschränkt');
    expect(safetyNotice({ id: 's3', title: 'Protected', artist: 'Artist', uri: 'content://music/song.mp3' })).toContain('Schreibzugriff eingeschränkt');
    expect(ERROR_MESSAGES.MissingWritePermission).toContain('Android-Medien- oder SAF-Quellen');
  });

  test('explains unsupported tag write layouts separately from platform replace support', () => {
    expect(ERROR_MESSAGES.WriteNotImplemented).toContain('Tag-Layout');
    expect(blockingReasonMessage(['WriteNotImplemented'])).toContain('Sicheres Ersetzen');
  });

  test('preserves blocking reason priority and context-specific messages', () => {
    expect(blockingReasonMessage(['UnsupportedUri', 'MissingWritePermission'])).toContain('Schreibzugriff eingeschränkt');
    expect(blockingReasonMessage(['WriteNotImplemented'], {
      uriType: 'content',
      container: 'mp3',
      warnings: ['Cover artwork writes are unavailable for this payload.'],
    })).toContain('Cover-Schreiben');
    expect(blockingReasonMessage(['WriteNotImplemented'], {
      uriType: 'content',
      container: 'mp3',
      warnings: [],
    })).toContain('Texttag-Schreiben');
    expect(blockingReasonMessage(['WriteNotImplemented'], {
      uriType: 'file',
      container: 'm4a',
      warnings: [],
    })).toContain('Atomstruktur');
    expect(blockingReasonMessage(['UnsupportedFormat'], {
      uriType: 'file',
      container: 'mp4',
      warnings: [],
    })).toContain('Atomstruktur');
    expect(blockingReasonMessage(['UnsupportedFormat'], {
      uriType: 'file',
      container: 'mp3',
      warnings: [],
    })).toBe('Format nicht unterstützt.');
    expect(blockingReasonMessage(['UnsupportedUri'])).toContain('remote/unknown');
    expect(blockingReasonMessage([])).toBeUndefined();
  });

  test('explains ID3v2.2 and ID3v2.4 write blocks with specific messages', () => {
    expect(ERROR_MESSAGES.WriteNotImplementedV22).toContain('ID3v2.2');
    expect(ERROR_MESSAGES.WriteNotImplementedV22).toContain('ID3v2.3');
    expect(ERROR_MESSAGES.WriteNotImplementedV24).toContain('ID3v2.4');
    expect(ERROR_MESSAGES.WriteNotImplementedV24).toContain('Sonderstruktur');
    expect(blockingReasonMessage(['WriteNotImplementedV22'])).toContain('ID3v2.2');
    expect(blockingReasonMessage(['WriteNotImplementedV24'])).toContain('ID3v2.4');
    expect(tagWriterErrorMessage('WriteNotImplementedV22')).toContain('ID3v2.2');
    expect(tagWriterErrorMessage('WriteNotImplementedV24')).toContain('ID3v2.4');
  });

  test('keeps legacy generic writer version messages mapped for older errors', () => {
    expect(tagWriterErrorMessage('WriteNotImplemented', 'Existing ID3v2.2 tags are not supported yet.')).toContain('ID3v2.2');
    expect(tagWriterErrorMessage('WriteNotImplemented', 'Rewriting existing ID3v2.4 tags is not supported yet.')).toContain('ID3v2.4');
  });
});