import {
  buildMusicProviderEffectsEqualizerInput,
  buildMusicProviderEffectsPlaybackInput,
} from './musicProviderControlInput';
import { buildMusicProviderEffectsInput } from './musicProviderEffectsInput';
import { buildMusicProviderEffectsRefsInput } from './musicProviderRefsInput';
import { buildMusicProviderEffectsStateInput } from './musicProviderStateInput';
import { useMusicProviderEffects } from './useMusicProviderEffects';
import type { MusicProviderRuntime } from './useMusicProviderRuntime';

export const useMusicProviderDomainEffects = (runtime: MusicProviderRuntime): void => {
  useMusicProviderEffects(
    buildMusicProviderEffectsInput({
      refs: buildMusicProviderEffectsRefsInput(runtime.refs),
      state: buildMusicProviderEffectsStateInput(runtime.state),
      playback: buildMusicProviderEffectsPlaybackInput(runtime.playback),
      equalizer: buildMusicProviderEffectsEqualizerInput(runtime.equalizer),
    }),
  );
};
