import type { Song } from '../types/Song';
import { getSongPaletteIdentity, getPersistentPaletteKey } from './albumPaletteIdentity';
import { warmAlbumPalette } from './albumPaletteHelpers';
import { isMetadataRefreshActive } from '../utils/metadataRefreshActivity';

export const PALETTE_BACKFILL_PER_TURN = 10;
const yieldToUI = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 16));
/** Optional maintenance: never join a scan/checkpoint and never queue ahead of playback. */
export const backfillAlbumPalettes = async (songs: readonly Song[], signal: AbortSignal,
  shouldPause: () => boolean = () => false, yieldTurn: () => Promise<void> = yieldToUI): Promise<void> => {
  const visited = new Set<string>();
  for (let start = 0; start < songs.length; start += PALETTE_BACKFILL_PER_TURN) {
    if (signal.aborted || shouldPause() || isMetadataRefreshActive()) return;
    for (const song of songs.slice(start, start + PALETTE_BACKFILL_PER_TURN)) {
      if (signal.aborted || shouldPause() || isMetadataRefreshActive()) return;
      const identity = getSongPaletteIdentity(song);
      if (!identity.artworkUri || !getPersistentPaletteKey(identity.artworkUri) || visited.has(identity.key!)) continue;
      visited.add(identity.key!);
      await warmAlbumPalette(identity.artworkUri, { signal, revision: identity.revision });
    }
    await yieldTurn();
  }
};
