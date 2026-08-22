import { buildMusicProviderEffectsInput } from '../musicProviderEffectsInput';
import type { MusicProviderEffectsArgs } from '../useMusicProviderEffects';
import type { Song } from '../../types/Song';

const noop = () => undefined;
const noopAsync = async () => undefined;
const createSongRef = (current: Song[] = []) => ({ current });

const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A' }];

const baseInput: MusicProviderEffectsArgs = {
  songsRef: createSongRef(songs),
  queueContextRef: createSongRef(),
  baseQueueContextRef: createSongRef(),
  nativeQueueRef: createSongRef(),
  persistCurrentSongId: noopAsync,
  isReady: true,
  setIsReady: noop,
  setLibraryHydrationReady: noop,
  songs,
  setSongsState: noop,
  currentSongSetter: noop,
  playbackQueueSetter: noop,
  playlists: [{ id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1, updatedAt: 1 }],
  setPlaylists: noop,
  shuffle: false,
  setShuffle: noop,
  repeatMode: 'off',
  setRepeatMode: noop,
  volume: 0.8,
  setVolumeState: noop,
  eqEnabled: false,
  setEqEnabledState: noop,
  eqBands: new Array(10).fill(0),
  setEqBandsState: noop,
  eqPreset: 'flat',
  setEqPreset: noop,
};

describe('buildMusicProviderEffectsInput', () => {
  test('combines provider effect sections into full effect args', () => {
    expect(
      buildMusicProviderEffectsInput({
        refs: {
          songsRef: baseInput.songsRef,
          queueContextRef: baseInput.queueContextRef,
          baseQueueContextRef: baseInput.baseQueueContextRef,
          nativeQueueRef: baseInput.nativeQueueRef,
          persistCurrentSongId: baseInput.persistCurrentSongId,
        },
        state: {
          isReady: baseInput.isReady,
          setIsReady: baseInput.setIsReady,
          setLibraryHydrationReady: baseInput.setLibraryHydrationReady,
          songs: baseInput.songs,
          setSongsState: baseInput.setSongsState,
          currentSongSetter: baseInput.currentSongSetter,
          playbackQueueSetter: baseInput.playbackQueueSetter,
          playlists: baseInput.playlists,
          setPlaylists: baseInput.setPlaylists,
          shuffle: baseInput.shuffle,
          setShuffle: baseInput.setShuffle,
        },
        playback: {
          repeatMode: baseInput.repeatMode,
          setRepeatMode: baseInput.setRepeatMode,
          volume: baseInput.volume,
          setVolumeState: baseInput.setVolumeState,
        },
        equalizer: {
          eqEnabled: baseInput.eqEnabled,
          setEqEnabledState: baseInput.setEqEnabledState,
          eqBands: baseInput.eqBands,
          setEqBandsState: baseInput.setEqBandsState,
          eqPreset: baseInput.eqPreset,
          setEqPreset: baseInput.setEqPreset,
        },
      }),
    ).toEqual(baseInput);
  });
});
