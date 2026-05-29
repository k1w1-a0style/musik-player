import { buildMusicProviderAudioFeaturesInput } from '../musicProviderAudioFeaturesInput';
import type { EqualizerControls } from '../useEqualizerControls';
import type { PlaybackControls } from '../usePlaybackControls';
import type { MusicProviderState } from '../useMusicProviderState';
import type { Song } from '../../types/Song';

const noop = () => undefined;
const noopAsync = async () => undefined;
const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A' }];

const providerState: MusicProviderState = {
  isReady: true,
  setIsReady: noop,
  songs,
  setSongsState: noop,
  currentSong: songs[0],
  setCurrentSong: noop,
  playbackQueue: songs,
  setPlaybackQueue: noop,
  playlists: [],
  setPlaylists: noop,
  shuffle: false,
  setShuffle: noop,
};

const playback: PlaybackControls = {
  isPlaying: true,
  isBuffering: false,
  repeatMode: 'off',
  setRepeatMode: noop,
  cycleRepeatMode: noopAsync,
  volume: 1,
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
  eqBands: [1, 2, 3],
  setEqBand: noop,
  setEqBandsState: noop,
  eqPreset: 'flat',
  applyEqPreset: noop,
  setEqPreset: noop,
};

describe('buildMusicProviderAudioFeaturesInput', () => {
  test('builds audio feature args from provider state and controls', () => {
    expect(buildMusicProviderAudioFeaturesInput({ providerState, playback, equalizer })).toEqual({
      currentSong: songs[0],
      eqEnabled: true,
      eqBands: [1, 2, 3],
      isPlaying: true,
    });
  });
});
