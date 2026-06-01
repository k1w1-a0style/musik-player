import type { MusicProviderAudioFeaturesArgs } from './useMusicProviderAudioFeatures';
import type { EqualizerControls } from './useEqualizerControls';
import type { MusicProviderState } from './useMusicProviderState';

export const buildMusicProviderAudioFeaturesInput = ({
  providerState,
  equalizer,
}: {
  providerState: MusicProviderState;
  equalizer: EqualizerControls;
}): MusicProviderAudioFeaturesArgs => ({
  currentSong: providerState.currentSong,
  eqEnabled: equalizer.eqEnabled,
  eqBands: equalizer.eqBands,
});
