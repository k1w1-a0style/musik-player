import type { MusicProviderAudioFeaturesArgs } from './useMusicProviderAudioFeatures';
import type { EqualizerControls } from './useEqualizerControls';
import type { PlaybackControls } from './usePlaybackControls';
import type { MusicProviderState } from './useMusicProviderState';

export const buildMusicProviderAudioFeaturesInput = ({
  providerState,
  playback,
  equalizer,
}: {
  providerState: MusicProviderState;
  playback: PlaybackControls;
  equalizer: EqualizerControls;
}): MusicProviderAudioFeaturesArgs => ({
  currentSong: providerState.currentSong,
  eqEnabled: equalizer.eqEnabled,
  eqBands: equalizer.eqBands,
  isPlaying: playback.isPlaying,
});
