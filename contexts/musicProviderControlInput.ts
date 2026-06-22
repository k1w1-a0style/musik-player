import type { MusicContextValue } from './musicContextTypes';
import type { MusicProviderEffectsArgs } from './useMusicProviderEffects';
import type { EqualizerControls } from './useEqualizerControls';
import type { PlaybackControls } from './usePlaybackControls';

type ContextPlaybackInput = Pick<
  MusicContextValue,
  | 'isPlaying'
  | 'isBuffering'
  | 'playSong'
  | 'reorderQueue'
  | 'togglePlayPause'
  | 'stop'
  | 'seekTo'
  | 'next'
  | 'previous'
  | 'toggleShuffle'
  | 'repeatMode'
  | 'cycleRepeatMode'
  | 'volume'
  | 'setVolume'
>;

type EffectsPlaybackInput = Pick<
  MusicProviderEffectsArgs,
  'repeatMode' | 'setRepeatMode' | 'volume' | 'setVolumeState'
>;

type ContextEqualizerInput = Pick<
  MusicContextValue,
  'eqEnabled' | 'setEqEnabled' | 'eqBands' | 'setEqBand' | 'eqPreset' | 'applyEqPreset'
>;

type EffectsEqualizerInput = Pick<
  MusicProviderEffectsArgs,
  | 'eqEnabled'
  | 'setEqEnabledState'
  | 'eqBands'
  | 'setEqBandsState'
  | 'eqPreset'
  | 'setEqPreset'
>;

export const buildMusicProviderContextPlaybackInput = (
  playback: PlaybackControls,
  actions: Pick<MusicContextValue, 'playSong' | 'reorderQueue' | 'toggleShuffle'>,
): ContextPlaybackInput => ({
  isPlaying: playback.isPlaying,
  isBuffering: playback.isBuffering,
  playSong: actions.playSong,
  reorderQueue: actions.reorderQueue,
  togglePlayPause: playback.togglePlayPause,
  stop: playback.stop,
  seekTo: playback.seekTo,
  next: playback.next,
  previous: playback.previous,
  toggleShuffle: actions.toggleShuffle,
  repeatMode: playback.repeatMode,
  cycleRepeatMode: playback.cycleRepeatMode,
  volume: playback.volume,
  setVolume: playback.setVolume,
});

export const buildMusicProviderEffectsPlaybackInput = (
  playback: PlaybackControls,
): EffectsPlaybackInput => ({
  repeatMode: playback.repeatMode,
  setRepeatMode: playback.setRepeatMode,
  volume: playback.volume,
  setVolumeState: playback.setVolumeState,
});

export const buildMusicProviderContextEqualizerInput = (
  equalizer: EqualizerControls,
): ContextEqualizerInput => ({
  eqEnabled: equalizer.eqEnabled,
  setEqEnabled: equalizer.setEqEnabled,
  eqBands: equalizer.eqBands,
  setEqBand: equalizer.setEqBand,
  eqPreset: equalizer.eqPreset,
  applyEqPreset: equalizer.applyEqPreset,
});

export const buildMusicProviderEffectsEqualizerInput = (
  equalizer: EqualizerControls,
): EffectsEqualizerInput => ({
  eqEnabled: equalizer.eqEnabled,
  setEqEnabledState: equalizer.setEqEnabledState,
  eqBands: equalizer.eqBands,
  setEqBandsState: equalizer.setEqBandsState,
  eqPreset: equalizer.eqPreset,
  setEqPreset: equalizer.setEqPreset,
});
