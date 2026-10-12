import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useLibraryMusicContext, useMiniPlayerMusicContext } from './MusicContext';
import { useAccentPreferences } from './AccentPreferencesContext';
import { hydrateAlbumPaletteCache, flushAlbumPaletteCache } from './albumPaletteCache';
import { backfillAlbumPalettes } from './albumPaletteBackfill';
import { mergeNativeAndFallbackPalette } from '../utils/jsPaletteFallback';
import { registerPersistenceFlusher } from '../utils/persistenceMaintenance';
import { useMetadataRefreshActive } from '../utils/metadataRefreshActivity';

/** Mount inside MusicProvider and the backup-owned AccentPreferencesProvider. */
export const PaletteRuntimeBridge = () => {
  const { songs, isReady, hydrationStatus } = useLibraryMusicContext();
  const { currentSong, palette, isPlaying } = useMiniPlayerMusicContext();
  const { setCoverAccent } = useAccentPreferences();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const metadataBusy = useMetadataRefreshActive();
  const currentAccent = mergeNativeAndFallbackPalette(palette, currentSong).vibrant;
  useEffect(() => { setCoverAccent?.(currentAccent); }, [currentAccent, setCoverAccent]);
  useEffect(() => {
    void hydrateAlbumPaletteCache();
    const unregister = registerPersistenceFlusher(() => { void flushAlbumPaletteCache(); });
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state !== 'active') void flushAlbumPaletteCache();
    });
    return () => { unregister(); subscription.remove(); void flushAlbumPaletteCache(); };
  }, []);
  useEffect(() => {
    if (!active || metadataBusy || !isReady || isPlaying || hydrationStatus === 'loading' || hydrationStatus === 'retry-required') return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void hydrateAlbumPaletteCache().then(() => backfillAlbumPalettes(songs, controller.signal,
        () => AppState.currentState !== 'active'));
    }, 750);
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') controller.abort();
    });
    return () => { clearTimeout(timer); controller.abort(); subscription.remove(); };
  }, [active, hydrationStatus, isPlaying, isReady, metadataBusy, songs]);
  return null;
};
