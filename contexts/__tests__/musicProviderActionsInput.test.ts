import { buildMusicProviderActionsInput } from '../musicProviderActionsInput';
import type { MusicPlaybackRefs } from '../useMusicPlaybackRefs';
import type { MusicProviderState } from '../useMusicProviderState';
import type { Song } from '../../types/Song';

const noop = () => undefined;
const noopAsync = async () => undefined;
const createSongRef = (current: Song[] = []) => ({ current });

const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A' }];

const playbackRefs: MusicPlaybackRefs = {
  songsRef: createSongRef(songs),
  queueContextRef: createSongRef(),
  baseQueueContextRef: createSongRef(),
  nativeQueueRef: createSongRef(),
  persistCurrentSongId: noopAsync,
};

const providerState: MusicProviderState = {
  isReady: true,
  setIsReady: noop,
  songs,
  setSongsState: noop,
  currentSong: songs[0],
  setCurrentSong: noop,
  playbackQueue: songs,
  setPlaybackQueue: noop,
  playlists: [{ id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1 }],
  setPlaylists: noop,
  shuffle: false,
  setShuffle: noop,
};

describe('buildMusicProviderActionsInput', () => {
  test('builds actions args from playback refs and provider state', () => {
    expect(
      buildMusicProviderActionsInput({
        playbackRefs,
        providerState,
        currentSongId: 's1',
      }),
    ).toEqual({
      songsRef: playbackRefs.songsRef,
      queueContextRef: playbackRefs.queueContextRef,
      baseQueueContextRef: playbackRefs.baseQueueContextRef,
      nativeQueueRef: playbackRefs.nativeQueueRef,
      setSongsState: providerState.setSongsState,
      setCurrentSong: providerState.setCurrentSong,
      setPlaybackQueue: providerState.setPlaybackQueue,
      playlists: providerState.playlists,
      setPlaylists: providerState.setPlaylists,
      currentSongId: 's1',
      shuffle: false,
      setShuffle: providerState.setShuffle,
    });
  });
});
