import { useEqualizerControls, type EqualizerControls } from './useEqualizerControls';
import { usePlaybackControls, type PlaybackControls } from './usePlaybackControls';
import type { Song } from '../types/Song';

interface MusicProviderControls {
  playback: PlaybackControls;
  equalizer: EqualizerControls;
}

export const useMusicProviderControls = (currentSong?: Song | null): MusicProviderControls => {
  const playback = usePlaybackControls(currentSong);
  const equalizer = useEqualizerControls();

  return { playback, equalizer };
};
