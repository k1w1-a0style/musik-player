import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';

interface SyncCurrentSongFromTrackArgs {
  event: unknown;
  songSources: Song[][];
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  persistCurrentSongId: (song: Song | null) => Promise<void>;
}

type ActiveTrackEventParseResult =
  | { kind: 'track'; trackId: string }
  | { kind: 'clear' }
  | { kind: 'ignore' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const normalizeActiveTrackId = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

export const parseActiveTrackEvent = (event: unknown): ActiveTrackEventParseResult => {
  if (!isRecord(event)) return { kind: 'ignore' };

  const directTrackId = normalizeActiveTrackId(event.trackId);
  if (directTrackId) return { kind: 'track', trackId: directTrackId };

  if (!Object.prototype.hasOwnProperty.call(event, 'track')) return { kind: 'ignore' };
  const track = event.track;
  if (track == null) return { kind: 'clear' };

  if (isRecord(track)) {
    const id = normalizeActiveTrackId(track.id);
    return id ? { kind: 'track', trackId: id } : { kind: 'clear' };
  }

  const id = normalizeActiveTrackId(track);
  return id ? { kind: 'track', trackId: id } : { kind: 'clear' };
};

export const getTrackIdFromActiveTrackEvent = (event: unknown): string | undefined => {
  const parsed = parseActiveTrackEvent(event);
  return parsed.kind === 'track' ? parsed.trackId : undefined;
};

export const findTrackSongById = (
  trackId: string | undefined,
  songSources: Song[][],
): Song | undefined => {
  const normalizedTrackId = normalizeActiveTrackId(trackId);
  if (!normalizedTrackId) return undefined;
  for (const source of songSources) {
    const song = source.find(item => normalizeActiveTrackId(item.id) === normalizedTrackId);
    if (song) return song;
  }
  return undefined;
};

export const syncCurrentSongFromActiveTrackEvent = ({
  event,
  songSources,
  setCurrentSong,
  persistCurrentSongId,
}: SyncCurrentSongFromTrackArgs): void => {
  const parsed = parseActiveTrackEvent(event);
  if (parsed.kind === 'ignore') return;

  if (parsed.kind === 'clear') {
    setCurrentSong(null);
    void persistCurrentSongId(null);
    return;
  }

  const song = findTrackSongById(parsed.trackId, songSources);
  if (!song) {
    setCurrentSong(null);
    void persistCurrentSongId(null);
    return;
  }
  setCurrentSong(song);
  void persistCurrentSongId(song);
};