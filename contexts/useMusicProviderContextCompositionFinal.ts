import { buildMusicProviderContextAudioFeatureInput } from './musicProviderAudioFeatureInput';
import {
  buildMusicProviderContextEqualizerInput,
  buildMusicProviderContextPlaybackInput,
} from './musicProviderControlInput';
import { buildMusicProviderContextValue } from './musicProviderContextBuilder';
import { buildMusicProviderContextActionsInput } from './musicProviderActionInput';
import { buildMusicProviderContextStateInput } from './musicProviderStateInput';
import { useProvidedMusicContextValuesFinal } from './useProvidedMusicContextValuesFinal';
import type { ProvidedMusicContextValuesFinal } from './useProvidedMusicContextValuesFinal';
import type { MusicProviderDomainActions } from './useMusicProviderDomainActions';
import type { MusicProviderRuntime } from './useMusicProviderRuntime';

export const useMusicProviderContextCompositionFinal = (
  runtime: MusicProviderRuntime,
  actions: MusicProviderDomainActions,
): ProvidedMusicContextValuesFinal => {
  const contextActions = buildMusicProviderContextActionsInput(actions);
  const queueOrderAction = actions['reorderQueue'];

  return useProvidedMusicContextValuesFinal(
    buildMusicProviderContextValue({
      state: buildMusicProviderContextStateInput(runtime.state),
      library: contextActions.library,
      playback: buildMusicProviderContextPlaybackInput(runtime.playback, {
        playSong: actions.playSong,
        reorderQueue: queueOrderAction,
        toggleShuffle: actions.toggleShuffle,
      }),
      equalizer: buildMusicProviderContextEqualizerInput(runtime.equalizer),
      audioFeatures: buildMusicProviderContextAudioFeatureInput(runtime.audioFeatures),
      playlists: contextActions.playlists,
    }),
  );
};
