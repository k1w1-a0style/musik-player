import type { TagEditDraft } from '../types/TagEdit';

export const hasDraftTagIntent = (
  draft: TagEditDraft,
  key: keyof TagEditDraft['tags'],
): boolean =>
  Object.prototype.hasOwnProperty.call(draft.tags, key) && draft.tags[key] !== undefined;

export const hasAnyTagEditIntent = (draft: TagEditDraft): boolean => {
  const keys: Array<keyof TagEditDraft['tags']> = [
    'title',
    'artist',
    'album',
    'year',
    'genre',
    'trackNumber',
    'discNumber',
    'comment',
  ];
  const hasTagIntent = keys.some(key => hasDraftTagIntent(draft, key));
  return hasTagIntent || Boolean(draft.cover) || draft.removeCover === true;
};
