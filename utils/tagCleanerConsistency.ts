import type { CleanerChange, CleanerField } from '../types/TagCleaner';
import type { EditableTrackTags } from '../types/TagEdit';
import { cleanerChange, cleanerWhitespace } from './tagCleanerFieldRules';
type Variants = Map<string, number>;
export type CleanerConsistencyIndex = Map<string, { variantCount: number; preferred?: string }>;
const fields: CleanerField[] = ['artist', 'albumArtist', 'album'];
const indexKey = (tags: EditableTrackTags, field: CleanerField): string | undefined => {
  const album = cleanerWhitespace(tags.album ?? '').toLowerCase();
  const artist = cleanerWhitespace(tags.albumArtist ?? tags.artist ?? '').toLowerCase();
  const value = cleanerWhitespace(tags[field] ?? '').toLowerCase();
  return album && artist && value ? JSON.stringify([album, artist, field, value]) : undefined;
};
/** One O(n) pass before proposals. No row rescans the entire album. */
export const buildCleanerConsistencyIndex = (tagsList: readonly EditableTrackTags[]): CleanerConsistencyIndex => {
  const index: Map<string, Variants> = new Map();
  for (const tags of tagsList) {
    for (const field of fields) {
      const key = indexKey(tags, field);
      if (!key) continue;
      const value = tags[field]!;
      const variants = index.get(key) ?? new Map<string, number>();
      variants.set(value, (variants.get(value) ?? 0) + 1);
      index.set(key, variants);
    }
  }
  return new Map([...index].map(([key,variants]) => [key,{variantCount:variants.size,preferred:preferredVariant(variants)}]));
};
const preferredVariant = (variants: Variants): string | undefined => {
  let best: string | undefined;
  let count = 0;
  let tied = false;
  for (const [value, occurrences] of variants) {
    if (occurrences > count) { best = value; count = occurrences; tied = false; }
    else if (occurrences === count) tied = true;
  }
  return tied ? undefined : best;
};
export const cleanerConsistencyChanges = (tags: EditableTrackTags, index: CleanerConsistencyIndex): CleanerChange[] => {
  const changes: CleanerChange[] = [];
  for (const field of fields) {
    const key = indexKey(tags, field);
    const variants = key ? index.get(key) : undefined;
    if (!variants || variants.variantCount < 2) continue;
    const preferred = variants.preferred;
    // A majority is evidence for review, never authority to overwrite.
    if (preferred && preferred !== tags[field]) changes.push(cleanerChange(field, tags[field]!, preferred,
      'Abweichende Album-/Artist-Schreibweise; Eigenschreibweise bestätigen.', 'review'));
  }
  return changes;
};
