import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';

interface SyncCurrentSongFromTrackArgs {
  event: { track?: { id?: unknown } | null };
  songSources: Song[][];
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  persistCurrentSongId: (song: Song | null) => Promise<void>;
}

export const getTrackIdFromActiveTrackEvent = (
  event: { track?: { id?: unknown } | null },
): string | undefined => (typeof event.track?.id === 'string' ? event.track.id : undefined);

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
