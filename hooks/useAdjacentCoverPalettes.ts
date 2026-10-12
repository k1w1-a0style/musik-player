import { useEffect } from 'react';
import type { Song } from '../types/Song';
import { getSongPaletteIdentity } from '../contexts/albumPaletteIdentity';
import { warmAlbumPalette } from '../contexts/albumPaletteHelpers';

export const useAdjacentCoverPalettes = (next: Song | null, previous: Song | null,
  paletteLoading: boolean | undefined) => {
  const { artworkUri: nextUri, revision: nextRevision } = getSongPaletteIdentity(next);
  const { artworkUri: previousUri, revision: previousRevision } = getSongPaletteIdentity(previous);
  useEffect(() => {
    if (paletteLoading) return;
    let cancelled = false;
    const timer = setTimeout(() => { void (async () => {
      await warmAlbumPalette(nextUri, { revision: nextRevision === '||' ? '' : nextRevision });
      if (!cancelled) await warmAlbumPalette(previousUri, { revision: previousRevision === '||' ? '' : previousRevision });
    })(); }, 100);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [nextRevision, nextUri, paletteLoading, previousRevision, previousUri]);
};
