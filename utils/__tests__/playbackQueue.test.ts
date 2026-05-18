import {
  hasSameSongIds,
  moveSongToFront,
  rotateQueueFromIndex,
  shuffleQueueKeepingCurrent,
} from '../playbackQueue';
import type { Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A' },
  { id: 's2', title: 'Two', artist: 'A' },
  { id: 's3', title: 'Three', artist: 'B' },
];

describe('playbackQueue helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('moves requested song to the front without mutating the original queue', () => {
    expect(moveSongToFront(songs, 's2').map(song => song.id)).toEqual(['s2', 's3', 's1']);
    expect(songs.map(song => song.id)).toEqual(['s1', 's2', 's3']);
  });

  test('returns a shallow copy when requested song is missing', () => {
    const result = moveSongToFront(songs, 'missing');
    expect(result).toEqual(songs);
    expect(result).not.toBe(songs);
  });

  test('rotates queue from index', () => {
    expect(rotateQueueFromIndex(songs, 2).map(song => song.id)).toEqual(['s3', 's1', 's2']);
    expect(rotateQueueFromIndex(songs, 0)).toEqual(songs);
  });

  test('compares queues by song id multiset', () => {
    expect(hasSameSongIds(songs, [songs[2], songs[0], songs[1]])).toBe(true);
    expect(hasSameSongIds(songs, [songs[0], songs[1]])).toBe(false);
    expect(hasSameSongIds([songs[0], songs[0]], [songs[0], songs[1]])).toBe(false);
  });

  test('keeps current song first while shuffling the rest', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const result = shuffleQueueKeepingCurrent(songs, 's2');

    expect(result[0].id).toBe('s2');
    expect(result.map(song => song.id).sort()).toEqual(['s1', 's2', 's3']);
  });
});
