import type { Song } from '../types/Song';

const leadingNumber = (value?: string): number | undefined => {
  const text = value?.trim().match(/^\d+/)?.[0];
  const number = text === undefined ? NaN : Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
};
const trackTitles = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
/** Missing disc means a single-disc album; missing track sorts after known ones. */
export const compareAlbumTracks = (left: Song, right: Song): number =>
  (leadingNumber(left.discNumber) ?? 1) - (leadingNumber(right.discNumber) ?? 1)
  || (leadingNumber(left.trackNumber) ?? Infinity) - (leadingNumber(right.trackNumber) ?? Infinity)
  || trackTitles.compare(left.title, right.title)
  || left.id.localeCompare(right.id);

