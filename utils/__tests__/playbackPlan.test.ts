import {
  buildPlaySongQueuePlan,
  buildShuffleTogglePlan,
} from '../playbackPlan';
import type { Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
  { id: 's3', title: 'Three', artist: 'B', uri: 'file:///s3.mp3' },
];

describe('playbackPlan helpers', () => {
  test('builds a rebuild plan with requested song first', () => {
    const plan = buildPlaySongQueuePlan(songs[1], songs, []);

    expect(plan?.requestedSong.id).toBe('s2');
    expect(plan?.canReuseNativeQueue).toBe(false);
    expect(plan?.rebuildOrderedQueue.map(song => song.id)).toEqual(['s2', 's3', 's1']);
  });

  test('builds a native queue reuse plan when native queue has the same songs', () => {
    const nativeQueue = [songs[0], songs[1], songs[2]];
    const plan = buildPlaySongQueuePlan(songs[2], songs, nativeQueue);

    expect(plan?.nativeIndex).toBe(2);
    expect(plan?.canReuseNativeQueue).toBe(true);
    expect(plan?.reusableOrderedQueue.map(song => song.id)).toEqual(['s3', 's1', 's2']);
  });

  test('returns null when requested song has no playable uri and is not in playable queue', () => {
    const plan = buildPlaySongQueuePlan(
      { id: 'missing', title: 'Missing', artist: 'A' },
      songs,
      [],
    );

    expect(plan).toBeNull();
  });

  test('inserts an external playable song when it is not in the queue', () => {
    const external: Song = {
      id: 'external',
      title: 'External',
      artist: 'A',
      uri: 'file:///external.mp3',
    };

    const plan = buildPlaySongQueuePlan(external, songs, []);

    expect(plan?.queueWithRequested.map(song => song.id)).toEqual(['external', 's1', 's2', 's3']);
    expect(plan?.rebuildOrderedQueue.map(song => song.id)).toEqual(['external', 's1', 's2', 's3']);
  });

  test('builds shuffle-on plan while keeping current song first', () => {
    const plan = buildShuffleTogglePlan({
      currentQueue: songs,
      baseQueue: [],
      currentSongId: 's2',
      shuffleEnabled: false,
      random: () => 0,
    });

    expect(plan?.nextQueue[0].id).toBe('s2');
    expect(plan?.nextQueue.map(song => song.id).sort()).toEqual(['s1', 's2', 's3']);
    expect(plan?.nextBaseQueue.map(song => song.id)).toEqual(['s1', 's2', 's3']);
    expect(plan?.selectedSong?.id).toBe('s2');
  });

  test('builds shuffle-off plan from base queue rotated to current song', () => {
    const shuffled = [songs[1], songs[2], songs[0]];
    const plan = buildShuffleTogglePlan({
      currentQueue: shuffled,
      baseQueue: songs,
      currentSongId: 's3',
      shuffleEnabled: true,
    });

    expect(plan?.nextQueue.map(song => song.id)).toEqual(['s3', 's1', 's2']);
    expect(plan?.selectedSong?.id).toBe('s3');
  });

  test('builds shuffle-off fallback plan when current song is no longer in base queue', () => {
    const shuffled = [songs[1], songs[2], songs[0]];
    const plan = buildShuffleTogglePlan({
      currentQueue: shuffled,
      baseQueue: songs,
      currentSongId: 'removed-song',
      shuffleEnabled: true,
    });

    expect(plan?.nextQueue.map(song => song.id)).toEqual(['s1', 's2', 's3']);
    expect(plan?.selectedSong?.id).toBe('s1');
  });

  test('returns null for empty shuffle queue', () => {
    expect(buildShuffleTogglePlan({ currentQueue: [], baseQueue: [], shuffleEnabled: false })).toBeNull();
  });
});
