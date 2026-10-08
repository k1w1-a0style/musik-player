import React, { useMemo, type ReactNode } from 'react';
import {
  LibraryMusicContext,
  MiniPlayerMusicContext,
  MusicContext,
  NowPlayingMusicContext,
  EqualizerMusicContext,
} from './musicContexts';
import type {
  LibraryMusicContextValue,
  MiniPlayerMusicContextValue,
  MusicContextValue,
  NowPlayingMusicContextValue,
  EqualizerMusicContextValue,
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
}) => {
  const { eqEnabled, setEqEnabled, eqBands, setEqBand, eqPreset, applyEqPreset, eqNative } = value;
  const equalizerValue = useMemo<EqualizerMusicContextValue>(() => ({
    eqEnabled, setEqEnabled, eqBands, setEqBand, eqPreset, applyEqPreset, eqNative,
  }), [eqEnabled, setEqEnabled, eqBands, setEqBand, eqPreset, applyEqPreset, eqNative]);
  return (
  <MusicContext.Provider value={value}>
    <LibraryMusicContext.Provider value={libraryValue}>
      <MiniPlayerMusicContext.Provider value={miniPlayerValue}>
        <NowPlayingMusicContext.Provider value={nowPlayingValue}>
          <EqualizerMusicContext.Provider value={equalizerValue}>
            {children}
          </EqualizerMusicContext.Provider>
        </NowPlayingMusicContext.Provider>
      </MiniPlayerMusicContext.Provider>
    </LibraryMusicContext.Provider>
  </MusicContext.Provider>
  );
};
