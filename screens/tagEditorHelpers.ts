import type { Song, SongCoverInfo } from '../types/Song';
import type {
  EditableCover,
  EditableTrackTags,
  TagEditDraft,
  TagWriterErrorCode,
  WriteTagsResult,
} from '../types/TagEdit';
import { normalizeEditableTags } from '../utils/tagValidation';

export type FormState = Record<keyof EditableTrackTags, string>;

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
  MissingWritePermission:
    'SAF/content:// Schreiben ist noch nicht unterstützt. Du kannst die Datei anzeigen, aber Tags nicht direkt speichern.',
  UnsupportedUri: 'URI ist nicht schreibbar (remote/unknown).',
  UnsupportedFormat: 'Format wird aktuell nicht unterstützt.',
  WriteNotImplemented: 'Sicheres Ersetzen auf dieser Plattform noch nicht unterstützt.',
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
  if (reasons.includes('MissingWritePermission'))
    return 'SAF/content:// Schreiben ist noch nicht unterstützt. Du kannst die Datei anzeigen, aber Tags nicht direkt speichern.';
  if (reasons.includes('FileTooLarge'))
    return 'Datei ist zu groß für sicheres In-App-Tag-Schreiben.';
  if (reasons.includes('WriteNotImplemented'))
    return 'iOS/Web file://: sicherer Replace nicht unterstützt.';
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
    return 'SAF/content:// Dateien sind aktuell read-only. Zum Bearbeiten bitte eine lokale file:// Kopie verwenden.';
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
