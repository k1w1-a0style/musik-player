import { createContext } from 'react';
import { createRequiredContextHook } from './createRequiredContextHook';
import type {
  LibraryMusicContextValue,
  MiniPlayerMusicContextValue,
  MusicContextValue,
  NowPlayingMusicContextValue,
} from './musicContextTypes';

export const MusicContext = createContext<MusicContextValue | null>(null);
export const LibraryMusicContext = createContext<LibraryMusicContextValue | null>(null);
export const MiniPlayerMusicContext = createContext<MiniPlayerMusicContextValue | null>(null);
export const NowPlayingMusicContext = createContext<NowPlayingMusicContextValue | null>(null);

export const useMusicContext = createRequiredContextHook(
  MusicContext,
  'useMusicContext',
  'MusicProvider',
);

export const useLibraryMusicContext = createRequiredContextHook(
  LibraryMusicContext,
  'useLibraryMusicContext',
  'MusicProvider',
);

export const useMiniPlayerMusicContext = createRequiredContextHook(
  MiniPlayerMusicContext,
  'useMiniPlayerMusicContext',
  'MusicProvider',
);

export const useNowPlayingMusicContext = createRequiredContextHook(
  NowPlayingMusicContext,
  'useNowPlayingMusicContext',
  'MusicProvider',
);
