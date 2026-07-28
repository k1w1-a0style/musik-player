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
  const { value, libraryValue, miniPlayerValue, nowPlayingValue } = useMusicProviderController();

  return (
    <MusicContextProviders
      value={value}
      libraryValue={libraryValue}
      miniPlayerValue={miniPlayerValue}
      nowPlayingValue={nowPlayingValue}
    >
      {value.hydrationStatus === 'ready' || value.hydrationStatus === undefined
        ? children
        : <AppLoading degraded={value.hydrationStatus === 'degraded' || value.hydrationStatus === 'retry-required'} onRetry={value.retryHydration} />}
    </MusicContextProviders>
  );
};
