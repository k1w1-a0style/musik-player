import {
  buildMusicProviderContextStateInput,
  buildMusicProviderEffectsStateInput,
} from '../musicProviderStateInput';
import type { MusicProviderState } from '../useMusicProviderState';
import type { Song } from '../../types/Song';

const noop = () => undefined;
const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A' }];

const state: MusicProviderState = {
  isReady: true,
  setIsReady: noop,
  libraryHydrationReady: true,
  setLibraryHydrationReady: noop,
  songs,
  setSongsState: noop,
  currentSong: songs[0],
  setCurrentSong: noop,
  playbackQueue: songs,
  setPlaybackQueue: noop,
  playlists: [{ id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1, updatedAt: 1 }],
  setPlaylists: noop,
  shuffle: false,
  setShuffle: noop,
};

describe('musicProviderStateInput', () => {
  test('builds context state input from provider state', () => {
    expect(buildMusicProviderContextStateInput(state)).toEqual({
      songs,
      currentSong: songs[0],
      playbackQueue: songs,
      playlists: state.playlists,
      shuffle: false,
      isReady: true,
    });
  });

  test('builds effects state input from provider state', () => {
    expect(buildMusicProviderEffectsStateInput(state)).toEqual({
      isReady: true,
      libraryHydrationReady: true,
      setIsReady: state.setIsReady,
      setLibraryHydrationReady: state.setLibraryHydrationReady,
      songs,
      setSongsState: state.setSongsState,
      currentSongSetter: state.setCurrentSong,
      playbackQueueSetter: state.setPlaybackQueue,
      playlists: state.playlists,
      setPlaylists: state.setPlaylists,
      shuffle: false,
      setShuffle: state.setShuffle,
    });
  });
});
