import React, { type ReactNode } from 'react';
import {
  LibraryMusicContext,
  MiniPlayerMusicContext,
  MusicContext,
  NowPlayingMusicContext,
} from './musicContexts';
import type {
  LibraryMusicContextValue,
  MiniPlayerMusicContextValue,
  MusicContextValue,
  NowPlayingMusicContextValue,
} from './musicContextTypes';

interface MusicContextProvidersProps {
  value: MusicContextValue;
  libraryValue: LibraryMusicContextValue;
  miniPlayerValue: MiniPlayerMusicContextValue;
  nowPlayingValue: NowPlayingMusicContextValue;
  children: ReactNode;
}

export const MusicContextProviders: React.FC<MusicContextProvidersProps> = ({
  value,
  libraryValue,
  miniPlayerValue,
  nowPlayingValue,
  children,
}) => (
  <MusicContext.Provider value={value}>
    <LibraryMusicContext.Provider value={libraryValue}>
      <MiniPlayerMusicContext.Provider value={miniPlayerValue}>
        <NowPlayingMusicContext.Provider value={nowPlayingValue}>
          {children}
        </NowPlayingMusicContext.Provider>
      </MiniPlayerMusicContext.Provider>
    </LibraryMusicContext.Provider>
  </MusicContext.Provider>
);
