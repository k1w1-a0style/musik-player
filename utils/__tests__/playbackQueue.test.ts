import {
  hasSameSongIdMultiset,
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
    expect(moveSongToFront(songs, ' s2 ').map(song => song.id)).toEqual(['s2', 's3', 's1']);
    expect(songs.map(song => song.id)).toEqual(['s1', 's2', 's3']);
  });

  test('moves songs with stored whitespace ids using normalized comparison', () => {
    const dirtySongs = [{ ...songs[0], id: ' s1 ' }, songs[1]];

    expect(moveSongToFront(dirtySongs, 's1').map(song => song.id)).toEqual([' s1 ', 's2']);
  });

  test('returns a shallow copy when requested song is missing or blank', () => {
    const missing = moveSongToFront(songs, 'missing');
    const blank = moveSongToFront(songs, '   ');

    expect(missing).toEqual(songs);
    expect(missing).not.toBe(songs);
    expect(blank).toEqual(songs);
    expect(blank).not.toBe(songs);
  });

  test('rotates queue from valid index and copies invalid index requests', () => {
    expect(rotateQueueFromIndex(songs, 2).map(song => song.id)).toEqual(['s3', 's1', 's2']);
    expect(rotateQueueFromIndex(songs, 0)).toEqual(songs);
    expect(rotateQueueFromIndex(songs, -1)).toEqual(songs);
    expect(rotateQueueFromIndex(songs, 3)).toEqual(songs);
    expect(rotateQueueFromIndex(songs, 1.5)).toEqual(songs);
    expect(rotateQueueFromIndex(songs, 0)).not.toBe(songs);
  });

  test('compares queues by normalized song id multiset', () => {
    expect(hasSameSongIdMultiset(songs, [songs[2], songs[0], songs[1]])).toBe(true);
    expect(hasSameSongIdMultiset([{ ...songs[0], id: ' s1 ' }], [songs[0]])).toBe(true);
    expect(hasSameSongIdMultiset(songs, [songs[0], songs[1]])).toBe(false);
    expect(hasSameSongIdMultiset([songs[0], songs[0]], [songs[0], songs[1]])).toBe(false);
  });

  test('keeps current song first while shuffling the rest with injected randomness', () => {
    const result = shuffleQueueKeepingCurrent(songs, ' s2 ', () => 0);

    expect(result.map(song => song.id)).toEqual(['s2', 's1', 's3']);
  });

  test('shuffle returns copied queue for two or fewer items', () => {
    const smallQueue = [songs[0], songs[1]];
    const result = shuffleQueueKeepingCurrent(smallQueue, 's2');

    expect(result.map(song => song.id)).toEqual(['s2', 's1']);
    expect(result).not.toBe(smallQueue);
  });
});
