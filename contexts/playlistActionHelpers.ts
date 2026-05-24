import type { Playlist, Song } from '../types/Song';
import { createPlaylistId } from '../utils/playlistIds';

export const createPlaylistRecord = (name: string, now: number = Date.now()): Playlist => ({
  id: createPlaylistId(),
  name,
  songIds: [],
  createdAt: now,
  updatedAt: now,
});

export const createPlaylistRecordFromQueue = (
  name: string,
  queue: Song[],
  now: number = Date.now(),
): Playlist | null => {
  const seenSongIds = new Set<string>();
  const songIds = queue
    .map(song => song.id)
    .filter(songId => {
      if (!songId || seenSongIds.has(songId)) return false;
      seenSongIds.add(songId);
      return true;
    });

  if (songIds.length === 0) return null;

  return {
    ...createPlaylistRecord(name.trim() || 'Gespeicherte Queue', now),
    songIds,
  };
};

export const appendPlaylist = (playlists: Playlist[], playlist: Playlist): Playlist[] => [
  ...playlists,
  playlist,
];

export const buildPlaylistQueue = (playlist: Playlist, songs: Song[]): Song[] =>
  playlist.songIds
    .map(id => songs.find(song => song.id === id))
    .filter((song): song is Song => !!song);

export const runPlayPlaylistAction = async ({
  playlistId,
  playlists,
  songs,
  playSong,
}: {
  playlistId: string;
  playlists: Playlist[];
  songs: Song[];
  playSong: (song: Song, queue?: Song[]) => Promise<void>;
}): Promise<void> => {
  const playlist = playlists.find(item => item.id === playlistId);
  if (!playlist) return;
  const queue = buildPlaylistQueue(playlist, songs);
  if (queue.length > 0) await playSong(queue[0], queue);
};
