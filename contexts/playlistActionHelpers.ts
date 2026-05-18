import type { Playlist, Song } from '../types/Song';
import { createPlaylistId } from '../utils/playlistIds';

export const createPlaylistRecord = (name: string, now: number = Date.now()): Playlist => ({
  id: createPlaylistId(),
  name,
  songIds: [],
  createdAt: now,
});

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
