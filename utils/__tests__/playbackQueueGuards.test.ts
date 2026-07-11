import { canSkipToNextInQueue } from '../playbackQueueGuards';

const song1 = { id: 's1', title: 'One', artist: 'Artist' };
const song2 = { id: 's2', title: 'Two', artist: 'Artist' };
const missingSong = { id: 'missing', title: 'Missing', artist: 'Artist' };

describe('canSkipToNextInQueue', () => {
  test('returns false when current song is at the last queue index and repeat all is off', () => {
    expect(canSkipToNextInQueue({ currentSong: song2, playbackQueue: [song1, song2], repeatMode: 'off' })).toBe(false);
  });

  test('returns true when current song is at the last queue index and repeat all is enabled', () => {
    expect(canSkipToNextInQueue({ currentSong: song2, playbackQueue: [song1, song2], repeatMode: 'all' })).toBe(true);
  });

  test('returns true when current song is before the last queue index', () => {
    expect(canSkipToNextInQueue({ currentSong: song1, playbackQueue: [song1, song2], repeatMode: 'off' })).toBe(true);
  });

  test('returns true when current song is missing from a multi-track queue', () => {
    expect(canSkipToNextInQueue({ currentSong: missingSong, playbackQueue: [song1, song2], repeatMode: 'off' })).toBe(true);
  });

  test('returns false without a current song or when the queue has at most one song', () => {
    expect(canSkipToNextInQueue({ currentSong: null, playbackQueue: [song1, song2], repeatMode: 'off' })).toBe(false);
    expect(canSkipToNextInQueue({ currentSong: song1, playbackQueue: [], repeatMode: 'off' })).toBe(false);
    expect(canSkipToNextInQueue({ currentSong: song1, playbackQueue: [song1], repeatMode: 'off' })).toBe(false);
  });
});
