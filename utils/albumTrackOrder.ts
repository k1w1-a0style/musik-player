import type { Song } from '../types/Song';

const leadingNumber = (value?: string): number | undefined => {
  const text = value?.trim().match(/^\d+/)?.[0];
  const number = text === undefined ? NaN : Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
};
const trackTitles = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
const trackKeys = new WeakMap<Song, { disc: number; track: number; title: string; id: string }>();
const getTrackKeys = (song: Song) => {
  let keys = trackKeys.get(song);
  if (!keys) {
    keys = { disc: leadingNumber(song.discNumber) ?? 1, track: leadingNumber(song.trackNumber) ?? Infinity,
      title: song.title, id: song.id };
    trackKeys.set(song, keys);
  }
  return keys;
};
/** Missing disc means a single-disc album; missing track sorts after known ones. */
export const compareAlbumTracks = (left: Song, right: Song): number => {
  const a = getTrackKeys(left); const b = getTrackKeys(right);
  return a.disc - b.disc || a.track - b.track || trackTitles.compare(a.title, b.title) || a.id.localeCompare(b.id);
};

