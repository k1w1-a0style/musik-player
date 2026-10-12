import type { Song } from '../types/Song';
import { getManagedCoverCacheDirectory } from '../utils/coverCache';
import { getSongArtworkRevision, getSongArtworkUri } from '../utils/songArtwork';
import { hashString128 } from '../utils/stringHash';

const immutableMimeHashes = new Set(['image/jpeg', 'image/png', 'image/webp'].map(hashString128));
/** Only cacheBase64Cover's content-addressed files are immutable. Local URI copies are not. */
export const getPersistentPaletteKey = (uri: string): string | undefined => {
  const directory = getManagedCoverCacheDirectory();
  if (!directory || !uri.startsWith(`${directory}/`)) return undefined;
  const name = uri.slice(directory.length + 1);
  const match = /^([a-f0-9]{32})-([a-f0-9]{32})\.(jpg|png|webp)$/i.exec(name);
  if (!match || !immutableMimeHashes.has(match[2])) return undefined;
  return `cover-v1:${name}`;
};
export const getAlbumPaletteKey = (artworkUri: string, revision = ''): string =>
  getPersistentPaletteKey(artworkUri) ?? `${artworkUri}${revision ? `|revision:${revision}` : ''}`;
export const getSongPaletteIdentity = (song: Song | null) => {
  const artworkUri = getSongArtworkUri(song);
  const revision = getSongArtworkRevision(song);
  return { artworkUri, revision, key: artworkUri ? getAlbumPaletteKey(artworkUri, revision === '||' ? '' : revision) : undefined };
};
