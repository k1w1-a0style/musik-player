import { useMemo } from 'react';
import {
  buildLibraryMusicContextValue,
  buildMiniPlayerMusicContextValue,
  buildNowPlayingMusicContextValue,
} from './musicContextValues';
import type {
  LibraryMusicContextValue,
  MiniPlayerMusicContextValue,
  MusicContextValue,
  NowPlayingMusicContextValue,
} from './musicContextTypes';
import { useMusicContextValue } from './useMusicContextValue';

interface ProvidedMusicContextValues {
  value: MusicContextValue;
  libraryValue: LibraryMusicContextValue;
  miniPlayerValue: MiniPlayerMusicContextValue;
  nowPlayingValue: NowPlayingMusicContextValue;
}

export const useProvidedMusicContextValues = (input: MusicContextValue): ProvidedMusicContextValues => {
  const value = useMusicContextValue(input);

  const libraryValue = useMemo(
    () => buildLibraryMusicContextValue(value),
    [value],
  );

  const miniPlayerValue = useMemo(
    () => buildMiniPlayerMusicContextValue(value),
    [value],
  );

  const nowPlayingValue = useMemo(
    () => buildNowPlayingMusicContextValue(value),
    [value],
  );

  return { value, libraryValue, miniPlayerValue, nowPlayingValue };
};
