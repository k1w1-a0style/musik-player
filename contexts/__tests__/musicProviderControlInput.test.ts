import {
  buildMusicProviderContextEqualizerInput,
  buildMusicProviderContextPlaybackInput,
  buildMusicProviderEffectsEqualizerInput,
  buildMusicProviderEffectsPlaybackInput,
} from '../musicProviderControlInput';
import type { EqualizerControls } from '../useEqualizerControls';
import type { PlaybackControls } from '../usePlaybackControls';

const noop = () => undefined;
const noopAsync = async () => undefined;

const playback: PlaybackControls = {
  isPlaying: true,
  isBuffering: false,
  repeatMode: 'off',
  setRepeatMode: noop,
  cycleRepeatMode: noopAsync,
  volume: 0.8,
  setVolumeState: noop,
  setVolume: noopAsync,
  togglePlayPause: noopAsync,
  stop: noopAsync,
  seekTo: noopAsync,
  next: noopAsync,
  previous: noopAsync,
};

const equalizer: EqualizerControls = {
  eqEnabled: true,
  setEqEnabled: noop,
  setEqEnabledState: noop,
  eqBands: new Array(10).fill(0),
  setEqBand: noop,
  setEqBandsState: noop,
  eqPreset: 'flat',
  applyEqPreset: noop,
  setEqPreset: noop,
};

describe('musicProviderControlInput', () => {
  test('builds context playback input', () => {
    const actions = { playSong: noopAsync, toggleShuffle: noopAsync };

    expect(buildMusicProviderContextPlaybackInput(playback, actions)).toEqual({
      isPlaying: true,
      isBuffering: false,
      playSong: actions.playSong,
      togglePlayPause: playback.togglePlayPause,
      stop: playback.stop,
      seekTo: playback.seekTo,
      next: playback.next,
      previous: playback.previous,
      toggleShuffle: actions.toggleShuffle,
      repeatMode: 'off',
      cycleRepeatMode: playback.cycleRepeatMode,
      volume: 0.8,
      setVolume: playback.setVolume,
    });
  });

  test('builds effects playback input', () => {
    expect(buildMusicProviderEffectsPlaybackInput(playback)).toEqual({
      repeatMode: 'off',
      setRepeatMode: playback.setRepeatMode,
      volume: 0.8,
      setVolumeState: playback.setVolumeState,
    });
  });

  test('builds context equalizer input', () => {
    expect(buildMusicProviderContextEqualizerInput(equalizer)).toEqual({
      eqEnabled: true,
      setEqEnabled: equalizer.setEqEnabled,
      eqBands: equalizer.eqBands,
      setEqBand: equalizer.setEqBand,
      eqPreset: 'flat',
      applyEqPreset: equalizer.applyEqPreset,
    });
  });

  test('builds effects equalizer input', () => {
    expect(buildMusicProviderEffectsEqualizerInput(equalizer)).toEqual({
      eqEnabled: true,
      setEqEnabledState: equalizer.setEqEnabledState,
      eqBands: equalizer.eqBands,
      setEqBandsState: equalizer.setEqBandsState,
      eqPreset: 'flat',
      setEqPreset: equalizer.setEqPreset,
    });
  });
});
