import type { Song } from '../types/Song';
import { parseId3FromUri, type Id3Tags } from './id3Parser';

export interface SongMetadataRefreshResult {
  songs: Song[];
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const hasText = (value?: string): value is string => Boolean(value?.trim());

const applyTagsToSong = (song: Song, tags: Id3Tags): Song => {
  const patch: Partial<Song> = {};
  if (hasText(tags.title)) patch.title = tags.title.trim();
  if (hasText(tags.artist)) patch.artist = tags.artist.trim();
  if (hasText(tags.album)) patch.album = tags.album.trim();
  if (hasText(tags.year)) patch.year = tags.year.trim();
  if (hasText(tags.genre)) patch.genre = tags.genre.trim();
  if (hasText(tags.trackNumber)) patch.trackNumber = tags.trackNumber.trim();
  if (hasText(tags.discNumber)) patch.discNumber = tags.disNumber?.trim();
  if (hasText(tags.comment)) patch.comment = tags.comment.trim();
  return Object.keys(patch).length > 0 ? { ...song, ...patch } : song;
};

const didSongChange = (before: Song, after: Song): boolean => before !== after;

export const refreshSongsFromId3 = async (songs: Song[]): Promise<SongMetadataRefreshResult> => {
  const refreshed: Song[] = [];
  const errors: string[] = [];
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const song of songs) {
    const uri = song.uri ?? song.fileInfo?.uri;
    if (!uri) {
      skipped += 1;
      refreshed.push(song);
      continue;
    }
    try {
      const tags = await parseId3FromUri(uri);
      const next = applyTagsToSong(song, tags);
      if (didSongChange(song, next)) updated += 1;
      refreshed.push(next);
    } catch {
      failed += 1;
      errors.push(uri);
      refreshed.push(song);
    }
  }

  return { songs: refreshed, updated, skipped, failed, errors };
};
