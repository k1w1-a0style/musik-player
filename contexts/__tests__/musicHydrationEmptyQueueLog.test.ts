import type { Song } from '../../types/Song';
import {
  buildEmptyPlayableQueueHydrationContext,
  isEmptyPlayableQueueLegitimate,
} from '../musicHydrationEmptyQueueLog';
import { createHydrationPlan } from '../musicHydrationPlan';
import type { StoredMusicHydrationState } from '../musicHydrationTypes';

const baseStored: StoredMusicHydrationState = {
  songs: null,
  playlists: null,
  eqEnabled: null,
  eqBands: null,
  eqPreset: null,
  volume: null,
  repeatMode: null,
  shuffle: false,
  currentSongId: null,
};

describe('musicHydrationEmptyQueueLog', () => {
  test('classifies an empty library / first launch as legitimate', () => {
    const plan = createHydrationPlan(baseStored, []);
    expect(isEmptyPlayableQueueLegitimate(plan)).toBe(true);
    expect(buildEmptyPlayableQueueHydrationContext(plan)).toEqual({
      restoredQueueCount: 0,
      librarySongCount: 0,
      playableQueueCount: 0,
      nativeQueueAction: 'clear',
      reason: 'empty-library',
    });
  });

  test('classifies a library without playable URIs as a real problem', () => {
    const unplayable: Song[] = [
      { id: 'a', title: 'A', artist: 'X' },
      { id: 'b', title: 'B', artist: 'X', uri: '   ' },
    ];
    const plan = createHydrationPlan({ ...baseStored, songs: unplayable }, unplayable);
    expect(isEmptyPlayableQueueLegitimate(plan)).toBe(false);
    expect(buildEmptyPlayableQueueHydrationContext(plan)).toEqual({
      restoredQueueCount: 0,
      librarySongCount: 2,
      playableQueueCount: 0,
      nativeQueueAction: 'clear',
      reason: 'no-playable-uris',
    });
  });

  test('reports playable counts when the hydrated queue has playable songs', () => {
    const playable: Song[] = [{ id: 'a', title: 'A', artist: 'X', uri: 'file:///a.mp3' }];
    const plan = createHydrationPlan({ ...baseStored, songs: playable, currentSongId: 'a' }, playable);
    expect(isEmptyPlayableQueueLegitimate(plan)).toBe(false);
    expect(buildEmptyPlayableQueueHydrationContext(plan)).toMatchObject({
      restoredQueueCount: 1,
      librarySongCount: 1,
      playableQueueCount: 1,
      reason: 'no-playable-uris',
    });
  });
});
