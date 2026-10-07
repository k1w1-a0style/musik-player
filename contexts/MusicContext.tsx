import React, { type ReactNode } from 'react';
import { View } from 'react-native';
import { MusicContextProviders } from './MusicContextProviders';
import { useMusicProviderController } from './useMusicProviderController';
import AppLoading from '../components/AppLoading';
import PlaybackRecoveryBanner from '../components/PlaybackRecoveryBanner';
export {
  useLibraryMusicContext,
  useMiniPlayerMusicContext,
  useMusicContext,
  useNowPlayingMusicContext,
} from './musicContexts';

export const MusicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { value, libraryValue, miniPlayerValue, nowPlayingValue, contentReady } = useMusicProviderController();
  const hydrationFailed = value.hydrationStatus === 'degraded' || value.hydrationStatus === 'retry-required';
  const recovering = value.hydrationStatus === 'loading';

  return (
    <MusicContextProviders
      value={value}
      libraryValue={libraryValue}
      miniPlayerValue={miniPlayerValue}
      nowPlayingValue={nowPlayingValue}
    >
      {contentReady
        ? <View style={{ flex: 1 }}>
          {children}
          {(hydrationFailed || recovering) && <PlaybackRecoveryBanner recovering={recovering} onRetry={value.retryHydration} />}
        </View>
        : <AppLoading degraded={hydrationFailed} onRetry={value.retryHydration} />}
    </MusicContextProviders>
  );
};
