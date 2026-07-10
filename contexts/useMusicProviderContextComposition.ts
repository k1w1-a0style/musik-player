import { buildMusicProviderContextAudioFeatureInput } from './musicProviderAudioFeatureInput';
import {
  buildMusicProviderContextEqualizerInput,
  buildMusicProviderContextPlaybackInput,
} from './musicProviderControlInput';
import { buildMusicProviderContextInput } from './musicProviderContextInput';
import { buildMusicProviderContextActionsInput } from './musicProviderActionInput';
import { buildMusicProviderContextStateInput } from './musicProviderStateInput';
import { useProvidedMusicContextValues } from './useProvidedMusicContextValues';
import type { ProvidedMusicContextValues } from './useProvidedMusicContextValues';
import type { MusicProviderDomainActions } from './useMusicProviderDomainActions';
import type { MusicProviderRuntime } from './useMusicProviderRuntime';

export const useMusicProviderContextComposition = (
  runtime: MusicProviderRuntime,
  actions: MusicProviderDomainActions,
): ProvidedMusicContextValues => {
  const contextActions = buildMusicProviderContextActionsInput(actions);

  return useProvidedMusicContextValues(
    buildMusicProviderContextInput({
      state: buildMusicProviderContextStateInput(runtime.state),
      library: contextActions.library,
      playback: buildMusicProviderContextPlaybackInput(runtime.playback, {
        playSong: actions.playSong,
        playSongNext: actions.playSongNext,
        addSongToQueue: actions.addSongToQueue,
        reorderQueue: actions.reorderQueue,
        toggleShuffle: actions.toggleShuffle,
      }),
      equalizer: buildMusicProviderContextEqualizerInput(runtime.equalizer),
      audioFeatures: buildMusicProviderContextAudioFeatureInput(runtime.audioFeatures),
      playlists: contextActions.playlists,
    }),
  );
};
