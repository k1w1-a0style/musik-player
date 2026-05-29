import { useEqualizerControls, type EqualizerControls } from './useEqualizerControls';
import { usePlaybackControls, type PlaybackControls } from './usePlaybackControls';

interface MusicProviderControls {
  playback: PlaybackControls;
  equalizer: EqualizerControls;
}

export const useMusicProviderControls = (): MusicProviderControls => {
  const playback = usePlaybackControls();
  const equalizer = useEqualizerControls();

  return { playback, equalizer };
};
