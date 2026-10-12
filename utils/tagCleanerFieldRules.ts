import type { CleanerChange, CleanerField, CleanerRules } from '../types/TagCleaner';
import type { EditableTrackTags } from '../types/TagEdit';
export const CLEANER_FIELDS: CleanerField[] = ['title', 'artist', 'albumArtist', 'album', 'year', 'genre', 'trackNumber', 'discNumber', 'comment'];
export const DEFAULT_CLEANER_RULES: CleanerRules = { whitespace: true, assignment: true, numbers: true, consistency: true, urlSuffix: true, filenames: false, privateUrls: false };
export const THOROUGH_CLEANER_RULES: CleanerRules = { ...DEFAULT_CLEANER_RULES, filenames: true, privateUrls: true };
export const cleanerWhitespace = (value: string): string => value.normalize('NFC').replace(/[\s\u00a0]+/g, ' ').trim();
export const cleanerNumber = (value: string): string => {
  const match = /^\s*(\d+)\s*(?:\/\s*(\d+)\s*)?$/.exec(value);
  if (!match) return value;
  const number = Number(match[1]);
  const total = match[2] === undefined ? undefined : Number(match[2]);
  if (!Number.isSafeInteger(number) || number < 1) return value;
  if (total !== undefined && (!Number.isSafeInteger(total) || total < number)) return value;
  return total === undefined ? String(number) : `${number}/${total}`;
};
const removeTerminalUrl = (value: string): string => {
  const match = /^(.+?)\s+-\s+(?:https?:\/\/|www\.)[A-Za-z0-9][A-Za-z0-9./?=&%+#_~:@-]*$/.exec(value);
  return match ? match[1].trim() : value;
};
export const cleanerChange = (field: CleanerChange['field'], before: string, after: string, reason: string,
  confidence: CleanerChange['confidence'] = 'safe', previewOnly = false): CleanerChange => ({
  field, before, after, reason, confidence, previewOnly,
  selected: confidence === 'safe' && !previewOnly, confirmed: false,
});
const fieldChange = (field: CleanerField, before: string, rules: CleanerRules): CleanerChange | undefined => {
  if (field === 'comment') return undefined;
  let after = rules.whitespace ? cleanerWhitespace(before) : before;
  if (rules.numbers && (field === 'trackNumber' || field === 'discNumber')) after = cleanerNumber(after);
  const canRemoveUrl = rules.urlSuffix && ['title', 'artist', 'album'].includes(field);
  const stripped = canRemoveUrl ? removeTerminalUrl(after) : after;
  const urlRemoved = stripped !== after;
  after = stripped;
  if (after === before) return undefined;
  return cleanerChange(field, before, after, urlRemoved ? 'Klar abgegrenzter Website-Anhang.' : 'Leerzeichen, Unicode oder numerische Schreibweise.', urlRemoved ? 'review' : 'safe');
};
const assignmentChanges = (tags: EditableTrackTags, filename: string): CleanerChange[] => {
  const parsed = /^(?:\d+ - )?([^-]+) - (.+)\.[a-zA-Z0-9]+$/.exec(filename);
  if (!parsed) return [];
  const candidates: Array<[CleanerField, string]> = [['artist', parsed[1].trim()], ['title', parsed[2].trim()]];
  return candidates.filter(([field]) => !tags[field]).map(([field, value]) =>
    cleanerChange(field, '', value, 'Fehlendes Feld aus Dateiname: Zuordnung prüfen.', 'uncertain'));
};
export const cleanerFieldChanges = (tags: EditableTrackTags, filename: string, rules: CleanerRules): CleanerChange[] => {
  const changes: CleanerChange[] = [];
  for (const field of CLEANER_FIELDS) {
    const before = tags[field];
    if (before === undefined) continue;
    const change = fieldChange(field, before, rules);
    if (change) changes.push(change);
  }
  return rules.assignment ? [...changes, ...assignmentChanges(tags, filename)] : changes;
};
export const cleanerFilenameChange = (tags: EditableTrackTags, filename: string): CleanerChange | undefined => {
  const extension = /\.([A-Za-z0-9]+)$/.exec(filename)?.[0];
  if (!extension || !tags.title || !tags.artist) return undefined;
  const number = cleanerNumber(tags.trackNumber ?? '').split('/')[0];
  const prefix = /^[1-9]\d*$/.test(number) ? `${number.padStart(2, '0')} - ` : '';
  const after = `${prefix}${tags.artist} - ${tags.title}${extension}`;
  if (after === filename || after.length > 255 || /[\x00-\x1f<>:"/\\|?*]/.test(after)) return undefined;
  if (after === '.' || after === '..' || after.endsWith(' ') || after.endsWith('.')) return undefined;
  return cleanerChange('filename', filename, after, 'Dateiname an bestätigte Tags angleichen; Umbenennen nur im Exportplan.', 'safe', true);
};
