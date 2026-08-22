import type { Song, SongCoverInfo } from '../types/Song';
import type {
  EditableCover,
  EditableTrackTags,
  TagEditDraft,
  TagWriterErrorCode,
  WriteOperationPlan,
  WriteTagsResult,
} from '../types/TagEdit';
import { normalizeEditableTags } from '../utils/tagValidation';

export type FormState = Record<keyof EditableTrackTags, string>;

const SAF_READ_ONLY_MESSAGE =
  'Bei Android-Medien- oder SAF-Quellen kann der Schreibzugriff eingeschränkt sein. Falls Speichern fehlschlägt, wähle die Datei erneut über den System-Dateiauswahldialog aus.';
const ID3V22_UNSUPPORTED_MESSAGE =
  'Diese MP3 nutzt ID3v2.2. Dieses sehr alte Tag-Format wird aktuell nicht geschrieben; bitte extern nach ID3v2.3 konvertieren.';
const ID3V24_UNSUPPORTED_MESSAGE =
  'Diese MP3 nutzt eine ID3v2.4-Sonderstruktur (z. B. Unsynchronisation, Footer oder Frame-Flags), die der Editor nicht sicher umschreiben kann. Gewöhnliche ID3v2.4-Tags werden konservativ geschrieben.';
const TAG_LAYOUT_UNSUPPORTED_MESSAGE = 'Dieses Tag-Layout wird aktuell noch nicht sicher geschrieben.';
const FILE_REPLACE_UNSUPPORTED_MESSAGE = 'Sicheres Ersetzen wird auf dieser Plattform noch nicht unterstützt.';
const MP4_ATOM_STRUCTURE_UNSUPPORTED_MESSAGE = 'Diese MP4/M4A-Atomstruktur wird nicht sicher geschrieben.';

export const FIELDS: Array<{ key: keyof EditableTrackTags; label: string }> = [
  { key: 'title', label: 'Titel' },
  { key: 'artist', label: 'Künstler' },
  { key: 'albumArtist', label: 'Album-Künstler' },
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
  WriteNotImplemented: TAG_LAYOUT_UNSUPPORTED_MESSAGE,
  WriteNotImplementedV22: ID3V22_UNSUPPORTED_MESSAGE,
  WriteNotImplementedV24: ID3V24_UNSUPPORTED_MESSAGE,
  InvalidTagData: 'Ungültige Metadaten. Bitte Eingaben prüfen.',
  FileTooLarge: 'Datei ist für sicheres In-App-Tag-Schreiben zu groß. Bitte extern bearbeiten oder kleinere Dateien nutzen.',
  BackupFailed: 'Backup konnte nicht erstellt werden.',
  TempWriteFailed: 'Temporäre Datei konnte nicht geschrieben werden.',
  VerificationFailed: 'Verifikation der temporären Datei fehlgeschlagen.',
  ReplaceFailed: 'Datei konnte nicht ersetzt werden.',
  RollbackFailed: 'Rollback fehlgeschlagen.',
  TransactionConflict: 'Eine andere Schreibtransaktion läuft bereits.',
  OperationIdAlreadyUsed: 'Diese Schreibvorgangs-ID wurde bereits verwendet.',
  OperationIdReservationFailed: 'Die Schreibvorgangs-ID konnte nicht sicher reserviert werden.',
  OperationJournalCapacityExceeded: 'Zu viele Schreibvorgänge sind aktiv. Bitte nach deren Abschluss erneut versuchen.',
  RecoveryPending: 'Eine frühere Schreibtransaktion muss zuerst wiederhergestellt werden.',
  RecoveryFailed: 'Wiederherstellung einer früheren Schreibtransaktion fehlgeschlagen.',
  BackupCorrupted: 'Das gespeicherte Wiederherstellungs-Backup ist beschädigt. Die Originaldatei wurde aus Sicherheitsgründen nicht verändert.',
  InsufficientStorage: 'Nicht genug app-interner Speicher für ein dauerhaftes Backup.',
};

export const tagWriterErrorMessage = (code: TagWriterErrorCode, message?: string): string => {
  if (code === 'WriteNotImplemented') {
    if (message?.includes('ID3v2.2')) return ID3V22_UNSUPPORTED_MESSAGE;
    if (message?.includes('ID3v2.4')) return ID3V24_UNSUPPORTED_MESSAGE;
  }
  return ERROR_MESSAGES[code] ?? 'Speichern fehlgeschlagen.';
};

export const COVER_PICK_ERROR_MESSAGES = {
  missingUri: 'Cover-URI fehlt oder ist ungültig. Bitte anderes Bild wählen.',
  missingBase64: 'Cover konnte nicht gelesen werden. Bitte anderes Bild wählen.',
  invalidBase64: 'Cover-Daten sind beschädigt. Bitte anderes Bild wählen.',
  unsupportedMime: 'Nur JPG/JPEG und PNG werden als Cover unterstützt.',
  tooLarge: 'Cover ist zu groß. Bitte ein Bild bis maximal 5 MB wählen.',
  invalidImageBytes: 'Cover-Daten enthalten kein unterstütztes JPG/PNG-Bild. Bitte anderes Bild wählen.',
} as const;

export const toInitialForm = (song: Song): FormState => ({
  title: song.title ?? '',
  artist: song.artist ?? '',
  albumArtist: song.albumArtist ?? '',
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

export const capabilityReason = (reason?: string): string => reason ?? 'Schreiben ist für diesen Titel nicht verfügbar.';

type BlockingReasonPlan = Pick<WriteOperationPlan, 'uriType' | 'container' | 'warnings'>;

const BLOCKING_REASON_PRIORITY: readonly TagWriterErrorCode[] = [
  'MissingWritePermission',
  'FileTooLarge',
  'WriteNotImplementedV22',
  'WriteNotImplementedV24',
  'WriteNotImplemented',
  'UnsupportedFormat',
  'UnsupportedUri',
];

const SIMPLE_BLOCKING_REASON_MESSAGES: Partial<Record<TagWriterErrorCode, string>> = {
  MissingWritePermission: SAF_READ_ONLY_MESSAGE,
  FileTooLarge: 'Datei ist zu groß für sicheres In-App-Tag-Schreiben.',
  WriteNotImplementedV22: ID3V22_UNSUPPORTED_MESSAGE,
  WriteNotImplementedV24: ID3V24_UNSUPPORTED_MESSAGE,
  UnsupportedUri: 'URI ist nicht schreibbar (remote/unknown).',
};

const isMp4Container = (plan?: BlockingReasonPlan): boolean =>
  plan?.container === 'm4a' || plan?.container === 'mp4';

const writeNotImplementedMessage = (plan?: BlockingReasonPlan): string => {
  const hasUnsupportedCoverWrite = plan?.uriType === 'content'
    && plan.warnings?.some(warning => warning.toLowerCase().includes('cover artwork writes'));
  if (hasUnsupportedCoverWrite) {
    return 'Cover-Schreiben für SAF/content:// ist in dieser Version noch nicht unterstützt. Entferne die Cover-Änderung, um MP3-Texttags zu speichern.';
  }
  if (plan?.uriType === 'content' && plan.container === 'mp3') {
    return 'MP3 SAF/content:// Texttag-Schreiben ist nur mit Android-SAF-Schreibfreigabe unterstützt; diese Quelle ist schreibgeschützt.';
  }
  return isMp4Container(plan) ? MP4_ATOM_STRUCTURE_UNSUPPORTED_MESSAGE : FILE_REPLACE_UNSUPPORTED_MESSAGE;
};

const unsupportedFormatMessage = (plan?: BlockingReasonPlan): string =>
  isMp4Container(plan) ? MP4_ATOM_STRUCTURE_UNSUPPORTED_MESSAGE : 'Format nicht unterstützt.';

export const blockingReasonMessage = (
  reasons: TagWriterErrorCode[],
  plan?: BlockingReasonPlan,
): string | undefined => {
  for (const reason of BLOCKING_REASON_PRIORITY) {
    if (!reasons.includes(reason)) continue;
    if (reason === 'WriteNotImplemented') return writeNotImplementedMessage(plan);
    if (reason === 'UnsupportedFormat') return unsupportedFormatMessage(plan);
    return SIMPLE_BLOCKING_REASON_MESSAGES[reason];
  }
  return undefined;
};

export const safetyNotice = (song: Song): string | undefined => {
  const uri = song.fileInfo?.uri ?? song.uri;
  const container = (song.fileInfo?.extension ?? song.fileInfo?.container ?? '').toLowerCase();
  if (uri?.startsWith('content://')) return SAF_READ_ONLY_MESSAGE;
  if (container === 'm4a' || container === 'mp4') return 'MP4/M4A wird nur für bekannte, sichere Atom-Layouts geschrieben. Manche Dateien bleiben bewusst blockiert.';
  if (uri?.startsWith('file://')) return 'file:// Schreiben nutzt Backup + Temp + Byteprüfung; der finale Replace ist geschützt, aber nicht OS-atomar.';
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

const REMOVABLE_COVER_STATUSES: ReadonlySet<NonNullable<SongCoverInfo['status']>> = new Set(['embedded', 'cached']);

export const hasRemovableCover = (song: Song): boolean => {
  const hasArtwork = Boolean(song.cover || song.coverInfo?.uri);
  if (hasArtwork && (song.coverInfo?.pendingEmbeddedArtworkRefresh === true || song.coverInfo?.embeddedArtworkRefreshFailed === true)) return true;
  const status = song.coverInfo?.status;
  if (status) return REMOVABLE_COVER_STATUSES.has(status);
  return Boolean(song.cover);
};

export const statusMessage = (result: WriteTagsResult): string => {
  if (result.status === 'written') return 'Metadaten erfolgreich geschrieben.';
  if (result.status === 'noop') return 'Keine Änderung.';
  if (result.status === 'rolledBack') return 'Änderung wurde zurückgerollt.';
  return 'Schreiben blockiert.';
};
