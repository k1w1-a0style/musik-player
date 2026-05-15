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

const assignChanged = <K extends keyof Song>(patch: Partial<Song>, song: Song, key: K, value?: string): void => {
  if (!hasText(value)) return;
  const normalized = value.trim();
  if (song[key] !== normalized) patch[key] = normalized as Song[K];
};

const applyTagsToSong = (song: Song, tags: Id3Tags): Song => {
  const patch: Partial<Song> = {};
  assignChanged(patch, song, 'title', tags.title);
  assignChanged(patch, song, 'artist', tags.artist);
  assignChanged(patch, song, 'album', tags.album);
  assignChanged(patch, song, 'year', tags.year);
  assignChanged(patch, song, 'genre', tags.genre);
  assignChanged(patch, song, 'trackNumber', tags.trackNumber);
  assignChanged(patch, song, 'discNumber', tags.discNumber);
  assignChanged(patch, song, 'comment', tags.comment);
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
