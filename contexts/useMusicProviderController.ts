import {
  buildMusicProviderContextEqualizerInput,
  buildMusicProviderContextPlaybackInput,
  buildMusicProviderEffectsEqualizerInput,
  buildMusicProviderEffectsPlaybackInput,
} from './musicProviderControlInput';
import { buildMusicProviderContextAudioFeatureInput } from './musicProviderAudioFeatureInput';
import { buildMusicProviderContextInput } from './musicProviderContextInput';
import { buildMusicProviderEffectsInput } from './musicProviderEffectsInput';
import {
  buildMusicProviderContextLibraryInput,
  buildMusicProviderContextPlaylistInput,
} from './musicProviderActionInput';
import { buildMusicProviderActionsInput } from './musicProviderActionsInput';
import { buildMusicProviderEffectsRefsInput } from './musicProviderRefsInput';
import {
  buildMusicProviderContextStateInput,
  buildMusicProviderEffectsStateInput,
} from './musicProviderStateInput';
import { useMusicPlaybackRefs } from './useMusicPlaybackRefs';
import { useMusicProviderActions } from './useMusicProviderActions';
import { useMusicProviderAudioFeatures } from './useMusicProviderAudioFeatures';
import { useMusicProviderControls } from './useMusicProviderControls';
import { useMusicProviderEffects } from './useMusicProviderEffects';
import { useMusicProviderState } from './useMusicProviderState';
import { useProvidedMusicContextValues } from './useProvidedMusicContextValues';

export const useMusicProviderController = () => {
  const providerState = useMusicProviderState();
  const { songs, currentSong } = providerState;

  const { playback, equalizer } = useMusicProviderControls();
  const { isPlaying } = playback;
  const { eqEnabled, eqBands } = equalizer;

  const audioFeatures = useMusicProviderAudioFeatures({
    currentSong,
    eqEnabled,
    eqBands,
    isPlaying,
  });

  const playbackRefs = useMusicPlaybackRefs(songs);

  const actions = useMusicProviderActions(
    buildMusicProviderActionsInput({
      playbackRefs,
      providerState,
      currentSongId: currentSong?.id,
    }),
  );

  useMusicProviderEffects(
    buildMusicProviderEffectsInput({
      refs: buildMusicProviderEffectsRefsInput(playbackRefs),
      state: buildMusicProviderEffectsStateInput(providerState),
      playback: buildMusicProviderEffectsPlaybackInput(playback),
      equalizer: buildMusicProviderEffectsEqualizerInput(equalizer),
    }),
  );

  return useProvidedMusicContextValues(
    buildMusicProviderContextInput({
      state: buildMusicProviderContextStateInput(providerState),
      library: buildMusicProviderContextLibraryInput(actions),
      playback: buildMusicProviderContextPlaybackInput(playback, {
        playSong: actions.playSong,
        toggleShuffle: actions.toggleShuffle,
      }),
      equalizer: buildMusicProviderContextEqualizerInput(equalizer),
      audioFeatures: buildMusicProviderContextAudioFeatureInput(audioFeatures),
      playlists: buildMusicProviderContextPlaylistInput(actions),
    }),
  );
};
