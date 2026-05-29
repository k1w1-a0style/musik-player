import type { MusicProviderEffectsArgs } from './useMusicProviderEffects';

type PlaybackRefsInput = Pick<
  MusicProviderEffectsArgs,
  | 'songsRef'
  | 'queueContextRef'
  | 'baseQueueContextRef'
  | 'nativeQueueRef'
  | 'persistCurrentSongId'
>;

type ProviderStateInput = Pick<
  MusicProviderEffectsArgs,
  | 'isReady'
  | 'setIsReady'
  | 'songs'
  | 'setSongsState'
  | 'currentSongSetter'
  | 'playbackQueueSetter'
  | 'playlists'
  | 'setPlaylists'
  | 'shuffle'
  | 'setShuffle'
>;

type PlaybackSettingsInput = Pick<
  MusicProviderEffectsArgs,
  'repeatMode' | 'setRepeatMode' | 'volume' | 'setVolumeState'
>;

type EqualizerSettingsInput = Pick<
  MusicProviderEffectsArgs,
  | 'eqEnabled'
  | 'setEqEnabledState'
  | 'eqBands'
  | 'setEqBandsState'
  | 'eqPreset'
  | 'setEqPreset'
>;

interface MusicProviderEffectsInputSections {
  refs: PlaybackRefsInput;
  state: ProviderStateInput;
  playback: PlaybackSettingsInput;
  equalizer: EqualizerSettingsInput;
}

export const buildMusicProviderEffectsInput = ({
  refs,
  state,
  playback,
  equalizer,
}: MusicProviderEffectsInputSections): MusicProviderEffectsArgs => ({
  ...refs,
  ...state,
  ...playback,
  ...equalizer,
});
