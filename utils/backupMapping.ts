import type { Song, Playlist } from '../types/Song';
import { getSongSourceKey } from './songSourceIdentity';
import type { BackupSongReference, MusicBackup } from './backupFormat';

export const toBackupSongReference = (song: Song): BackupSongReference => ({
  id: song.id, title: song.title, artist: song.artist,
  uri: song.fileInfo?.uri ?? song.uri,
  size: song.fileInfo?.size && song.fileInfo.size > 0 ? song.fileInfo.size : undefined,
  modificationTime: song.fileInfo?.modificationTime && song.fileInfo.modificationTime > 0
    ? song.fileInfo.modificationTime : undefined,
  contentHash: /^[a-f0-9]{64}$/i.test(song.fileInfo?.contentHash ?? '') ? song.fileInfo!.contentHash!.toLowerCase() : undefined,
});
const hasSameRevision = (left: BackupSongReference, right: BackupSongReference): boolean => {
  if (left.contentHash && right.contentHash) return left.contentHash.toLowerCase() === right.contentHash.toLowerCase();
  return Boolean(left.size && right.size && left.modificationTime && right.modificationTime
    && left.size === right.size && left.modificationTime === right.modificationTime);
};
export type BackupMatch = { reference: BackupSongReference; status: 'mapped' | 'missing' | 'conflict'; song?: Song };
export type ManualBackupMapping = Readonly<Record<string, string | null>>;
export const mapBackupSongs = (backup: MusicBackup, songs: Song[], manual: ManualBackupMapping = {}): BackupMatch[] => {
  const byId = new Map(songs.map(song => [song.id, song]));
  const bySource = new Map<string, Song[]>();
  const byHash = new Map<string, Song[]>();
  for (const song of songs) {
    const source = toBackupSongReference(song);
    const key = getSongSourceKey(source.uri);
    if (key) {
      const entries = bySource.get(key) ?? [];
      entries.push(song); bySource.set(key, entries);
    }
    if (source.contentHash) {
      const entries = byHash.get(source.contentHash) ?? [];
      entries.push(song); byHash.set(source.contentHash, entries);
    }
  }
  return backup.songs.map(reference => {
    if (Object.hasOwn(manual, reference.id)) {
      const song = byId.get(manual[reference.id] ?? '');
      return { reference, status: song ? 'mapped' : 'missing', song };
    }
    const key = getSongSourceKey(reference.uri);
    const sameSource = key ? (bySource.get(key) ?? []) : [];
    const candidates = sameSource.filter(song => hasSameRevision(reference, toBackupSongReference(song)));
    const matches = candidates.length > 0 ? candidates
      : reference.contentHash ? (byHash.get(reference.contentHash.toLowerCase()) ?? []) : [];
    return { reference, status: matches.length === 1 ? 'mapped' : matches.length > 1 || sameSource.length > 0 ? 'conflict' : 'missing',
      song: matches.length === 1 ? matches[0] : undefined };
  });
};
export const mergeBackupCollection = (
  backup: MusicBackup, matches: BackupMatch[], playlists: Playlist[], favorites: string[], now = Date.now(),
): { playlists: Playlist[]; favorites: string[]; addedPlaylists: number; addedFavorites: number; skippedSongs: number } => {
  const mapping = new Map(matches.flatMap(match => match.song ? [[match.reference.id, match.song.id] as const] : []));
  const mappedIds = (ids: string[]) => [...new Set(ids.flatMap(id => mapping.get(id) ? [mapping.get(id)!] : []))];
  const nextFavorites = [...new Set([...favorites, ...mappedIds(backup.favorites)])];
  const nextPlaylists = [...playlists];
  const usedIds = new Set(playlists.map(playlist => playlist.id));
  backup.playlists.forEach((playlist, index) => {
    let id = `backup-${now}-${index}`;
    while (usedIds.has(id)) id += '-copy';
    usedIds.add(id);
    const name = playlists.some(existing => existing.name === playlist.name) ? `${playlist.name} (Backup)` : playlist.name;
    nextPlaylists.push({ id, name, songIds: mappedIds(playlist.songIds), createdAt: playlist.createdAt, updatedAt: now });
  });
  return { playlists: nextPlaylists, favorites: nextFavorites, addedPlaylists: backup.playlists.length,
    addedFavorites: nextFavorites.length - favorites.length, skippedSongs: matches.filter(match => !match.song).length };
};
