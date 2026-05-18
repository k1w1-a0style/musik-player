import type { Song } from '../types/Song';
import { getSongArtworkUri } from './songArtwork';

export const toTrackPlayerTrack = (song: Song) => ({
  id: song.id,
  url: song.uri ?? '',
  title: song.title,
  artist: song.artist,
  album: song.album,
  artwork: getSongArtworkUri(song),
  duration: song.duration ? song.duration / 1000 : undefined,
});
