import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';

interface SyncCurrentSongFromTrackArgs {
  event: unknown;
  songSources: Song[][];
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  persistCurrentSongId: (song: Song | null) => Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const getTrackIdFromActiveTrackEvent = (event: unknown): string | undefined => {
  if (!isRecord(event) || !isRecord(event.track)) return undefined;
  return typeof event.track.id === 'string' ? event.track.id : undefined;
};

export const findTrackSongById = (
  trackId: string | undefined,
  songSources: Song[][],
): Song | undefined => {
  if (!trackId) return undefined;
  for (const source of songSources) {
    const song = source.find(item => item.id === trackId);
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
  const trackId = getTrackIdFromActiveTrackEvent(event);
  const song = findTrackSongById(trackId, songSources);
  if (!song) return;
  setCurrentSong(song);
  void persistCurrentSongId(song);
};