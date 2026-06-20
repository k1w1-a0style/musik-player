import type { TagEditDraft } from '../types/TagEdit';

export const EDITABLE_TAG_KEYS: Array<keyof TagEditDraft['tags']> = [
  'title',
  'artist',
  'albumArtist',
  'album',
  'year',
  'genre',
  'trackNumber',
  'discNumber',
  'comment',
];

export const hasDraftTagIntent = (
  draft: TagEditDraft,
  key: keyof TagEditDraft['tags'],
): boolean =>
  Object.prototype.hasOwnProperty.call(draft.tags, key) && draft.tags[key] !== undefined;

export const hasAnyTagEditIntent = (draft: TagEditDraft): boolean => {
  const hasTagIntent = EDITABLE_TAG_KEYS.some(key => hasDraftTagIntent(draft, key));
  return hasTagIntent || Boolean(draft.cover) || draft.removeCover === true;
};