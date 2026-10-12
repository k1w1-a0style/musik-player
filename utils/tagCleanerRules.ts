import type { Song } from '../types/Song';
import type { EditableTrackTags } from '../types/TagEdit';
import type { CleanerChange, CleanerMode, CleanerRow, CleanerRules, CleanerSnapshot } from '../types/TagCleaner';
import { getTagEditCapability } from './tagEditCapability';
import { getSongSourceKey } from './songSourceIdentity';
import { cleanerFieldChanges, cleanerFilenameChange, cleanerChange, CLEANER_FIELDS, DEFAULT_CLEANER_RULES } from './tagCleanerFieldRules';
import { buildCleanerConsistencyIndex, cleanerConsistencyChanges } from './tagCleanerConsistency';
export const cleanerDisplayTags = (song: Song): EditableTrackTags => {
  const tags: EditableTrackTags = {};
  for (const field of CLEANER_FIELDS) if (song[field] !== undefined) tags[field] = song[field];
  return tags;
};
const folderHint = (song: Song, tags: EditableTrackTags): CleanerChange | undefined => {
  const uri = song.fileInfo?.uri ?? song.uri ?? '';
  let decoded: string;
  try { decoded = decodeURIComponent(uri); } catch { return undefined; }
  const parent = decoded.split('/').slice(-2, -1)[0];
  const artist = tags.albumArtist ?? tags.artist;
  if (!parent || !artist || !tags.album) return undefined;
  const suffix = ` - ${tags.album}`;
  if (!parent.endsWith(suffix)) return undefined;
  const folderArtist = parent.slice(0, -suffix.length);
  if (folderArtist.toLowerCase() === artist.toLowerCase()) return undefined;
  const missingOne = artist.toLowerCase().split('').some((_, index) => artist.toLowerCase().slice(0, index) + artist.toLowerCase().slice(index + 1) === folderArtist.toLowerCase());
  if (!missingOne) return undefined;
  return cleanerChange('folder', parent, `${artist}${suffix}`, 'Möglicher Schreibfehler im Ordnernamen; nur Hinweis/Export.', 'review', true);
};
const optionalChanges = (song: Song, snapshot: CleanerSnapshot, tags: EditableTrackTags, rules: CleanerRules): CleanerChange[] => {
  const changes: CleanerChange[] = [];
  const hint = folderHint(song, tags);
  if (hint) changes.push(hint);
  const filename = rules.filenames ? cleanerFilenameChange(tags, song.fileInfo?.filename ?? '') : undefined;
  if (filename) changes.push(filename);
  if (rules.privateUrls) {
    const urls = snapshot.inventory.filter(item => item.id === 'WXXX');
    for (const item of urls) for (const value of item.values ?? [])
      changes.push(cleanerChange('website', value, '', 'Separates Website-Feld; optionale Löschung nur als Exportplan.', 'review', true));
  }
  return changes;
};
const rowStatus = (changes: CleanerChange[], snapshot: CleanerSnapshot, writable: boolean, mode: CleanerMode): CleanerRow['status'] => {
  if (mode === 'file' && !snapshot.verified) return 'unreadable';
  if (!changes.length) return 'clean';
  if (changes.some(change => change.confidence !== 'safe')) return 'conflict';
  return mode === 'file' && !writable ? 'readonly' : 'proposal';
};
export const analyzeCleanerRows = (songs: readonly Song[], snapshots: readonly CleanerSnapshot[], rules = DEFAULT_CLEANER_RULES, mode: CleanerMode = 'display'): CleanerRow[] => {
  const tagsList = songs.map((song, index) => mode === 'file' ? snapshots[index].tags : cleanerDisplayTags(song));
  const index = buildCleanerConsistencyIndex(tagsList);
  const seenFolders = new Set<string>();
  return songs.map((song, position) => {
    const original = snapshots[position];
    const tags = tagsList[position];
    const fieldChanges = cleanerFieldChanges(tags, song.fileInfo?.filename ?? '', rules);
    const consistency = rules.consistency ? cleanerConsistencyChanges(tags, index) : [];
    const changed = new Set(fieldChanges.map(change => change.field));
    const changes = [...fieldChanges, ...consistency.filter(change => !changed.has(change.field)), ...optionalChanges(song, original, tags, rules).filter(change => {
      if (change.field !== 'folder') return true;
      if (seenFolders.has(change.before)) return false;
      seenFolders.add(change.before); return true;
    })];
    const capability = getTagEditCapability(song);
    const writable = capability.canWrite && original.verified;
    const notes = original.error ? [original.error] : [];
    if (original.inventory.some(item => item.id === 'WXXX')) notes.push('WXXX: separates Website-Metadatenfeld, standardmäßig erhalten.');
    if (capability.reason && !capability.canWrite) notes.push(capability.reason);
    return { song, original, displayBefore: cleanerDisplayTags(song), sourceKey: getSongSourceKey(song.fileInfo?.uri ?? song.uri) ?? `id:${song.id}`,
      writable, changes, notes, status: rowStatus(changes, original, writable, mode) };
  });
};
export const selectedCleanerTags = (row: CleanerRow): EditableTrackTags => {
  const tags: EditableTrackTags = {};
  for (const change of row.changes) {
    if (change.previewOnly || !change.selected || (change.confidence !== 'safe' && !change.confirmed)) continue;
    if (CLEANER_FIELDS.includes(change.field as keyof EditableTrackTags)) tags[change.field as keyof EditableTrackTags] = change.after;
  }
  return tags;
};
