import { buildMusicProviderAudioFeaturesInput } from './musicProviderAudioFeaturesInput';
import { useMusicPlaybackRefs, type MusicPlaybackRefs } from './useMusicPlaybackRefs';
import { useMusicProviderAudioFeatures, type MusicProviderAudioFeatures } from './useMusicProviderAudioFeatures';
import { useMusicProviderControls } from './useMusicProviderControls';
import type { EqualizerControls } from './useEqualizerControls';
import type { PlaybackControls } from './usePlaybackControls';
import { useMusicProviderState, type MusicProviderState } from './useMusicProviderState';

export interface MusicProviderRuntime {
  state: MusicProviderState;
  playback: PlaybackControls;
  equalizer: EqualizerControls;
  audioFeatures: MusicProviderAudioFeatures;
  refs: MusicPlaybackRefs;
}

export const useMusicProviderRuntime = (): MusicProviderRuntime => {
  const state = useMusicProviderState();
  const { playback, equalizer } = useMusicProviderControls();
  const audioFeatures = useMusicProviderAudioFeatures(
    buildMusicProviderAudioFeaturesInput({
      providerState: state,
      equalizer,
    }),
  );
  const refs = useMusicPlaybackRefs(state.songs);

  return {
    state,
    playback,
    equalizer,
    audioFeatures,
    refs,
  };
};
