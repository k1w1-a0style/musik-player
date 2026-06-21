import { buildMusicProviderContextAudioFeatureInput } from './musicProviderAudioFeatureInput';
import {
  buildMusicProviderContextEqualizerInput,
  buildMusicProviderContextPlaybackInput,
} from './musicProviderControlInput';
import { buildMusicProviderContextValue } from './musicProviderContextBuilder';
import { buildMusicProviderContextActionsInput } from './musicProviderActionInput';
import { buildMusicProviderContextStateInput } from './musicProviderStateInput';
import { useProvidedMusicContextValues } from './useProvidedMusicContextValues';
import type { ProvidedMusicContextValues } from './useProvidedMusicContextValues';
import type { MusicProviderDomainActions } from './useMusicProviderDomainActions';
import type { MusicProviderRuntime } from './useMusicProviderRuntime';

export const useMusicProviderContextCompositionWithQueue = (
  runtime: MusicProviderRuntime,
  actions: MusicProviderDomainActions,
): ProvidedMusicContextValues => {
  const contextActions = buildMusicProviderContextActionsInput(actions);

  return useProvidedMusicContextValues(
    buildMusicProviderContextValue({
      state: buildMusicProviderContextStateInput(runtime.state),
      library: contextActions.library,
      playback: buildMusicProviderContextPlaybackInput(runtime.playback, {
        playSong: actions.playSong,
        reorderQueue: actions.reorderQueue,
        toggleShuffle: actions.toggleShuffle,
      }),
      equalizer: buildMusicProviderContextEqualizerInput(runtime.equalizer),
      audioFeatures: buildMusicProviderContextAudioFeatureInput(runtime.audioFeatures),
      playlists: contextActions.playlists,
    }),
  );
};
