import type { Song } from '../types/Song';
import { getSongArtworkUri } from './songArtwork';

const normalizeOptionalText = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

const normalizeRequiredText = (value: string, fallback: string): string =>
  normalizeOptionalText(value) ?? fallback;

export const resolvePlayableTrackUrl = (song: Pick<Song, 'uri'>): string =>
  normalizeOptionalText(song.uri) ?? '';

export const toTrackPlayerTrack = (song: Song) => {
  const url = resolvePlayableTrackUrl(song);
  if (!url) {
    console.warn(`[TrackPlayerTrack] Song ${song.id} has no playable URI.`);
  }

  return {
    id: normalizeRequiredText(song.id, 'unknown'),
    url,
    title: normalizeRequiredText(song.title, 'Unbekannter Titel'),
    artist: normalizeRequiredText(song.artist, 'Unbekannt'),
    album: normalizeOptionalText(song.album),
    artwork: getSongArtworkUri(song),
    duration: song.duration && song.duration > 0 ? song.duration / 1000 : undefined,
  };
};