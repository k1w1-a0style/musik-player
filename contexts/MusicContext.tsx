import React, { type ReactNode } from 'react';
import { MusicContextProviders } from './MusicContextProviders';
import { useMusicProviderController } from './useMusicProviderController';
import AppLoading from '../components/AppLoading';
export {
  useLibraryMusicContext,
  useMiniPlayerMusicContext,
  useMusicContext,
  useNowPlayingMusicContext,
} from './musicContexts';

export const MusicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { value, libraryValue, miniPlayerValue, nowPlayingValue, contentReady } = useMusicProviderController();
  const hydrationFailed = value.hydrationStatus === 'degraded' || value.hydrationStatus === 'retry-required';

  return (
    <MusicContextProviders
      value={value}
      libraryValue={libraryValue}
      miniPlayerValue={miniPlayerValue}
      nowPlayingValue={nowPlayingValue}
    >
      {contentReady && !hydrationFailed
        ? children
        : <AppLoading degraded={hydrationFailed} onRetry={value.retryHydration} />}
    </MusicContextProviders>
  );
};
