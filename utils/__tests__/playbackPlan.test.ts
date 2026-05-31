import {
  buildPlaySongQueuePlan,
  buildShuffleTogglePlan,
  normalizePlayableQueue,
} from '../playbackPlan';
import type { Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
  { id: 's3', title: 'Three', artist: 'B', uri: 'file:///s3.mp3' },
];

describe('playbackPlan helpers', () => {
  test('normalizes playable queue entries before planning', () => {
    const dirtyQueue: Song[] = [
      { id: ' s1 ', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
      { id: 's1', title: 'Duplicate', artist: 'A', uri: 'file:///duplicate.mp3' },
      { id: 's2', title: 'No Uri', artist: 'A' },
      { id: '   ', title: 'Blank', artist: 'A', uri: 'file:///blank.mp3' },
      songs[2],
    ];

    expect(normalizePlayableQueue(dirtyQueue).map(song => song.id)).toEqual(['s1', 's3']);
  });

  test('logs warning for blank ids when warn=true', () => {
    const logger = { warn: jest.fn() };

    const normalized = normalizePlayableQueue([
      { id: '   ', title: 'Blank', artist: 'A', uri: 'file:///blank.mp3' },
      songs[0],
    ], { warn: true, logger });

    expect(normalized.map(song => song.id)).toEqual(['s1']);
    expect(logger.warn).toHaveBeenCalledWith(
      '[normalizePlayableQueue] dropped song',
      expect.objectContaining({ reason: 'blank-id', title: 'Blank' }),
    );
  });

  test('logs warning for missing/falsy uri when warn=true', () => {
    const logger = { warn: jest.fn() };

    const normalized = normalizePlayableQueue([
      { id: 's1', title: 'No Uri', artist: 'A' },
      { id: 's2', title: 'Empty Uri', artist: 'A', uri: '' },
      songs[2],
    ], { warn: true, logger });

    expect(normalized.map(song => song.id)).toEqual(['s3']);
    expect(logger.warn).toHaveBeenCalledWith(
      '[normalizePlayableQueue] dropped song',
      expect.objectContaining({ reason: 'missing-uri', songId: 's1', title: 'No Uri' }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      '[normalizePlayableQueue] dropped song',
      expect.objectContaining({ reason: 'missing-uri', songId: 's2', title: 'Empty Uri' }),
    );
  });

  test('drops whitespace-only uri as non-playable', () => {
    const logger = { warn: jest.fn() };

    const normalized = normalizePlayableQueue([
      { id: 's1', title: 'Whitespace Uri', artist: 'A', uri: '   ' },
      songs[2],
    ], { warn: true, logger });

    expect(normalized.map(song => song.id)).toEqual(['s3']);
    expect(logger.warn).toHaveBeenCalledWith(
      '[normalizePlayableQueue] dropped song',
      expect.objectContaining({ reason: 'missing-uri', songId: 's1', title: 'Whitespace Uri' }),
    );
  });

  test('logs warning for duplicate ids when warn=true', () => {
    const logger = { warn: jest.fn() };

    const normalized = normalizePlayableQueue([
      songs[0],
      { ...songs[0], title: 'Duplicate', uri: 'file:///dup.mp3' },
      songs[1],
    ], { warn: true, logger });

    expect(normalized.map(song => song.id)).toEqual(['s1', 's2']);
    expect(logger.warn).toHaveBeenCalledWith(
      '[normalizePlayableQueue] dropped song',
      expect.objectContaining({ reason: 'duplicate-id', songId: 's1', title: 'Duplicate' }),
    );
  });

  test('does not log warnings when warn=false', () => {
    const logger = { warn: jest.fn() };

    const normalized = normalizePlayableQueue([
      { id: '   ', title: 'Blank', artist: 'A', uri: 'file:///blank.mp3' },
      { id: 's2', title: 'No Uri', artist: 'A' },
      songs[0],
      { ...songs[0], title: 'Duplicate', uri: 'file:///dup.mp3' },
    ], { warn: false, logger });

    expect(normalized.map(song => song.id)).toEqual(['s1']);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('does not log warnings for fully valid queues', () => {
    const logger = { warn: jest.fn() };

    const normalized = normalizePlayableQueue(songs, { warn: true, logger });

    expect(normalized.map(song => song.id)).toEqual(['s1', 's2', 's3']);
    expect(logger.warn).not.toHaveBeenCalled();
  });

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



  test('does not reuse native queue when same song ids are in a different order', () => {
    const nativeQueue = [songs[0], songs[1], songs[2]];
    const contextQueue = [songs[0], songs[2], songs[1]];
    const plan = buildPlaySongQueuePlan(songs[2], contextQueue, nativeQueue);

    expect(plan?.canReuseNativeQueue).toBe(false);
    expect(plan?.rebuildOrderedQueue.map(song => song.id)).toEqual(['s3', 's2', 's1']);
  });

  test('normalizes queues before deciding native queue reuse', () => {
    const dirtySourceQueue = [songs[0], { ...songs[1], uri: undefined }, songs[1], songs[2], songs[2]];
    const dirtyNativeQueue = [{ ...songs[0], id: ' s1 ' }, songs[1], songs[2], songs[2]];
    const plan = buildPlaySongQueuePlan(songs[1], dirtySourceQueue, dirtyNativeQueue);

    expect(plan?.queueWithRequested.map(song => song.id)).toEqual(['s1', 's2', 's3']);
    expect(plan?.canReuseNativeQueue).toBe(true);
    expect(plan?.reusableOrderedQueue.map(song => song.id)).toEqual(['s2', 's3', 's1']);
  });

  test('returns null when requested song has no playable uri and is not in playable queue', () => {
    const plan = buildPlaySongQueuePlan(
      { id: 'missing', title: 'Missing', artist: 'A' },
      songs,
      [],
    );

    expect(plan).toBeNull();
  });

  test('returns null for blank requested song ids', () => {
    expect(buildPlaySongQueuePlan({ id: '   ', title: 'Blank', artist: 'A', uri: 'file:///x.mp3' }, songs, [])).toBeNull();
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

  test('builds shuffle plans from normalized playable queues', () => {
    const dirtyQueue = [songs[0], { ...songs[1], uri: undefined }, songs[1], songs[2], songs[2]];
    const plan = buildShuffleTogglePlan({
      currentQueue: dirtyQueue,
      baseQueue: [],
      currentSongId: ' s2 ',
      shuffleEnabled: false,
      random: () => 0,
    });

    expect(plan?.nextQueue.map(song => song.id).sort()).toEqual(['s1', 's2', 's3']);
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

  test('returns null for empty shuffle queue after filtering unplayable entries', () => {
    expect(buildShuffleTogglePlan({
      currentQueue: [{ id: 's1', title: 'No Uri', artist: 'A' }],
      baseQueue: [],
      shuffleEnabled: false,
    })).toBeNull();
  });
});
