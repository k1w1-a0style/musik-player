import type { Song } from '../types/Song';
import { getSongArtworkUri } from './songArtwork';

export const toTrackPlayerTrack = (song: Song) => {
  if (!song.uri) {
    console.warn(`[TrackPlayerTrack] Song ${song.id} has no playable URI.`);
  }

  return {
    id: song.id,
    url: song.uri ?? '',
    title: song.title,
    artist: song.artist,
    album: song.album,
    artwork: getSongArtworkUri(song),
    duration: song.duration ? song.duration / 1000 : undefined,
  };
};
