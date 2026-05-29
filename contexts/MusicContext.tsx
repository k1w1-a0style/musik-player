import React, { type ReactNode } from 'react';
import { MusicContextProviders } from './MusicContextProviders';
import { useMusicProviderController } from './useMusicProviderController';
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
      {children}
    </MusicContextProviders>
  );
};
