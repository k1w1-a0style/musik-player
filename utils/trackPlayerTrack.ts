import type { Song } from '../types/Song';
import { asPlayableSong, type PlayableSong } from './playableSong';
import { getSongArtworkUri } from './songArtwork';

const normalizeOptionalText = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

const normalizeRequiredText = (value: string, fallback: string): string =>
  normalizeOptionalText(value) ?? fallback;

export const resolvePlayableTrackUrl = (song: PlayableSong): string => normalizeOptionalText(song.uri) ?? '';

export const toTrackPlayerTrack = (song: PlayableSong) => {
  const url = resolvePlayableTrackUrl(song);
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

export const tryToTrackPlayerTrack = (song: Song) => {
  const playableSong = asPlayableSong(song);
  if (!playableSong) {
    console.warn(`[TrackPlayer] Skipping non-playable song ${song.id}.`);
    return null;
  }

  return toTrackPlayerTrack(playableSong);
};
