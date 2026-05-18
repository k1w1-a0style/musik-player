import { buildMusicProviderEffectsRefsInput } from '../musicProviderRefsInput';
import type { MusicPlaybackRefs } from '../useMusicPlaybackRefs';
import type { Song } from '../../types/Song';

const noopAsync = async () => undefined;
const createSongRef = (current: Song[] = []) => ({ current });

const refs: MusicPlaybackRefs = {
  songsRef: createSongRef([{ id: 's1', title: 'One', artist: 'A' }]),
  queueContextRef: createSongRef(),
  baseQueueContextRef: createSongRef(),
  nativeQueueRef: createSongRef(),
  persistCurrentSongId: noopAsync,
};

describe('buildMusicProviderEffectsRefsInput', () => {
  test('builds effects refs input from playback refs', () => {
    expect(buildMusicProviderEffectsRefsInput(refs)).toEqual({
      songsRef: refs.songsRef,
      queueContextRef: refs.queueContextRef,
      baseQueueContextRef: refs.baseQueueContextRef,
      nativeQueueRef: refs.nativeQueueRef,
      persistCurrentSongId: refs.persistCurrentSongId,
    });
  });
});
