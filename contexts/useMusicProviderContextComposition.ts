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
import { guardNativePlaybackActions } from './nativePlaybackActionGuard';

export const useMusicProviderContextComposition = (
  runtime: MusicProviderRuntime,
  actions: MusicProviderDomainActions,
): ProvidedMusicContextValues => {
  const contextActions = buildMusicProviderContextActionsInput(actions);
  const guardedPlayback = guardNativePlaybackActions(runtime.state.hydrationStatus, {
    playSong: actions.playSong, playSongNext: actions.playSongNext, addSongToQueue: actions.addSongToQueue,
    reorderQueue: actions.reorderQueue ?? (async () => ({ status: 'failed' as const })),
    toggleShuffle: actions.toggleShuffle, playPlaylist: actions.playPlaylist,
    next: runtime.playback.next, previous: runtime.playback.previous,
    togglePlayPause: runtime.playback.togglePlayPause, seekTo: runtime.playback.seekTo, stop: runtime.playback.stop,
  });

  return useProvidedMusicContextValues(
    buildMusicProviderContextInput({
      state: buildMusicProviderContextStateInput(runtime.state),
      library: contextActions.library,
      playback: buildMusicProviderContextPlaybackInput(runtime.playback, {
        playSong: guardedPlayback.playSong,
        playSongNext: guardedPlayback.playSongNext,
        addSongToQueue: guardedPlayback.addSongToQueue,
        reorderQueue: guardedPlayback.reorderQueue,
        toggleShuffle: guardedPlayback.toggleShuffle,
        togglePlayPause: guardedPlayback.togglePlayPause, stop: guardedPlayback.stop,
        seekTo: guardedPlayback.seekTo, next: guardedPlayback.next, previous: guardedPlayback.previous,
      }),
      equalizer: buildMusicProviderContextEqualizerInput(runtime.equalizer),
      audioFeatures: buildMusicProviderContextAudioFeatureInput(runtime.audioFeatures),
      playlists: { ...contextActions.playlists, playPlaylist: guardedPlayback.playPlaylist },
    }),
  );
};
