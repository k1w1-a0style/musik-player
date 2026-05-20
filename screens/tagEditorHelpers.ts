import type { Song, SongCoverInfo } from '../types/Song';
import type {
  EditableCover,
  EditableTrackTags,
  TagEditDraft,
  TagWriterErrorCode,
  WriteTagsResult,
} from '../types/TagEdit';
import type { PickedTagCover } from '../utils/tagCoverPicker';
import { normalizeEditableTags } from '../utils/tagValidation';

export type FormState = Record<keyof EditableTrackTags, string>;

const SAF_READ_ONLY_MESSAGE =
  'Diese Datei liegt in einem geschützten Android-Ordner. Kopiere sie zuerst in einen lokalen Musikordner, um Tags bearbeiten zu können.';
const ID3V24_UNSUPPORTED_MESSAGE =
  'Diese MP3 nutzt ID3v2.4 oder ein noch nicht unterstütztes Tag-Layout. Der Editor schreibt aktuell nur sichere ID3v2.3-Änderungen.';
const FILE_REPLACE_UNSUPPORTED_MESSAGE =
  'Sicheres Ersetzen wird auf dieser Plattform noch nicht unterstützt.';

export const FIELDS: Array<{ key: keyof EditableTrackTags; label: string }> = [
  { key: 'title', label: 'Titel' },
  { key: 'artist', label: 'Künstler' },
  { key: 'album', label: 'Album' },
  { key: 'year', label: 'Jahr' },
  { key: 'genre', label: 'Genre' },
  { key: 'trackNumber', label: 'Tracknummer' },
  { key: 'discNumber', label: 'Discnummer' },
  { key: 'comment', label: 'Kommentar' },
];

export const ERROR_MESSAGES: Record<TagWriterErrorCode, string> = {
  MissingWritePermission: SAF_READ_ONLY_MESSAGE,
  UnsupportedUri: 'URI ist nicht schreibbar (remote/unknown).',
  UnsupportedFormat: 'Format wird aktuell nicht unterstützt.',
  WriteNotImplemented: ID3V24_UNSUPPORTED_MESSAGE,
  InvalidTagData: 'Ungültige Metadaten. Bitte Eingaben prüfen.',
  FileTooLarge:
    'Datei ist für sicheres In-App-Tag-Schreiben zu groß. Bitte extern bearbeiten oder kleinere Dateien nutzen.',
  BackupFailed: 'Backup konnte nicht erstellt werden.',
  TempWriteFailed: 'Temporäre Datei konnte nicht geschrieben werden.',
  VerificationFailed: 'Verifikation der temporären Datei fehlgeschlagen.',
  ReplaceFailed: 'Datei konnte nicht ersetzt werden.',
  RollbackFailed: 'Rollback fehlgeschlagen.',
};

export const COVER_PICK_ERROR_MESSAGES = {
  missingBase64: 'Cover konnte nicht gelesen werden. Bitte anderes Bild wählen.',
  unsupportedMime: 'Nur JPG/JPEG und PNG werden als Cover unterstützt.',
  tooLarge: 'Cover ist zu groß. Bitte ein Bild bis maximal 5 MB wählen.',
} as const;

export const toInitialForm = (song: Song): FormState => ({
  title: song.title ?? '',
  artist: song.artist ?? '',
  album: song.album ?? '',
  year: song.year ?? '',
  genre: song.genre ?? '',
  trackNumber: song.trackNumber ?? '',
  discNumber: song.discNumber ?? '',
  comment: song.comment ?? '',
});

export const buildDraftFromDirtyFields = (
  songId: string,
  form: FormState,
  dirty: Partial<Record<keyof EditableTrackTags, boolean>>,
  removeCover: boolean,
  replacementCover?: EditableCover | null,
): TagEditDraft => {
  const tags: EditableTrackTags = {};
  for (const field of FIELDS) {
    if (!dirty[field.key]) continue;
    tags[field.key] = form[field.key];
  }
  return {
    songId,
    tags,
    ...(replacementCover ? { cover: replacementCover } : {}),
    ...(removeCover && !replacementCover ? { removeCover: true } : {}),
  };
};

export const capabilityReason = (reason?: string): string =>
  reason ?? 'Schreiben ist für diesen Track nicht verfügbar.';

export const blockingReasonMessage = (reasons: TagWriterErrorCode[]): string | undefined => {
  if (reasons.includes('MissingWritePermission')) return SAF_READ_ONLY_MESSAGE;
  if (reasons.includes('FileTooLarge'))
    return 'Datei ist zu groß für sicheres In-App-Tag-Schreiben.';
  if (reasons.includes('WriteNotImplemented')) return FILE_REPLACE_UNSUPPORTED_MESSAGE;
  if (reasons.includes('UnsupportedFormat')) return 'Format nicht unterstützt.';
  if (reasons.includes('UnsupportedUri'))
    return 'URI ist nicht schreibbar (remote/unknown).';
  return undefined;
};

export const safetyNotice = (song: Song): string | undefined => {
  const uri = song.fileInfo?.uri ?? song.uri;
  const container = (
    song.fileInfo?.extension ??
    song.fileInfo?.container ??
    ''
  ).toLowerCase();
  if (uri?.startsWith('content://')) {
    return SAF_READ_ONLY_MESSAGE;
  }
  if (container === 'm4a' || container === 'mp4') {
    return 'MP4/M4A wird nur für bekannte, sichere Atom-Layouts geschrieben. Manche Dateien bleiben bewusst blockiert.';
  }
  if (uri?.startsWith('file://')) {
    return 'file:// Schreiben nutzt Backup + Temp + Byteprüfung; der finale Replace ist geschützt, aber nicht OS-atomar.';
  }
  return undefined;
};

export const buildFormAfterSave = (
  song: Song,
  currentForm: FormState,
  draft: TagEditDraft,
): FormState => {
  const normalizedTags = normalizeEditableTags(draft.tags);
  const next = toInitialForm(song);
  for (const field of FIELDS) {
    if (Object.prototype.hasOwnProperty.call(draft.tags, field.key)) {
      next[field.key] = normalizedTags[field.key] ?? '';
    } else {
      next[field.key] = currentForm[field.key];
    }
  }
  return next;
};

const applyEditableTagPatch = (
  metadataPatch: Partial<Song>,
  key: keyof EditableTrackTags,
  value: string | undefined,
): void => {
  switch (key) {
    case 'title':
      metadataPatch.title = value;
      break;
    case 'artist':
      metadataPatch.artist = value;
      break;
    case 'album':
      metadataPatch.album = value;
      break;
    case 'year':
      metadataPatch.year = value;
      break;
    case 'genre':
      metadataPatch.genre = value;
      break;
    case 'trackNumber':
      metadataPatch.trackNumber = value;
      break;
    case 'discNumber':
      metadataPatch.discNumber = value;
      break;
    case 'comment':
      metadataPatch.comment = value;
      break;
  }
};

export const buildMetadataPatchFromDraft = (
  draft: TagEditDraft,
  replacementCover?: PickedTagCover | null,
): Partial<Song> => {
  const normalizedTags = normalizeEditableTags(draft.tags);
  const metadataPatch: Partial<Song> = {};

  for (const field of FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(draft.tags, field.key)) continue;
    applyEditableTagPatch(metadataPatch, field.key, normalizedTags[field.key]);
  }

  if (draft.removeCover) {
    metadataPatch.cover = undefined;
    metadataPatch.coverInfo = undefined as SongCoverInfo | undefined;
  }

  if (draft.cover) {
    metadataPatch.cover = replacementCover?.uri;
    metadataPatch.coverInfo = { status: 'embedded', uri: replacementCover?.uri } as SongCoverInfo;
  }

  return metadataPatch;
};

const REMOVABLE_COVER_STATUSES: ReadonlySet<NonNullable<SongCoverInfo['status']>> =
  new Set(['embedded', 'cached', 'external']);

export const hasRemovableCover = (song: Song): boolean => {
  if (song.cover) return true;
  if (song.coverInfo?.uri) return true;
  const status = song.coverInfo?.status;
  return Boolean(status && REMOVABLE_COVER_STATUSES.has(status));
};

export const statusMessage = (result: WriteTagsResult): string => {
  if (result.status === 'written') return 'Metadaten erfolgreich geschrieben.';
  if (result.status === 'noop') return 'Keine Änderung.';
  if (result.status === 'rolledBack') return 'Änderung wurde zurückgerollt.';
  return 'Schreiben blockiert.';
};