import { buildQueueReorderPlan, moveArrayItem } from '../queueReorder';
import type { Song } from '../../types/Song';

const queue: Song[] = [
  { id: 'current', title: 'Current', artist: 'A', uri: 'file:///current.mp3' },
  { id: 'one', title: 'One', artist: 'A', uri: 'file:///one.mp3' },
  { id: 'two', title: 'Two', artist: 'A', uri: 'file:///two.mp3' },
  { id: 'three', title: 'Three', artist: 'A', uri: 'file:///three.mp3' },
];

test('moves an array item without mutating the source', () => {
  const source = ['a', 'b', 'c'];
  expect(moveArrayItem(source, 2, 1)).toEqual(['a', 'c', 'b']);
  expect(source).toEqual(['a', 'b', 'c']);
});

test('reorders only upcoming queue items after the current song', () => {
  const plan = buildQueueReorderPlan({ queue, currentSongId: 'current', fromIndex: 3, toIndex: 1 });

  expect(plan?.changed).toBe(true);
  expect(plan?.queue.map(song => song.id)).toEqual(['current', 'three', 'one', 'two']);
  expect(plan?.selectedSong?.id).toBe('current');
});

test('moving the active item preserves its identity at its new position', () => {
  const plan = buildQueueReorderPlan({ queue, currentSongId: 'current', fromIndex: 0, toIndex: 2 });
  expect(plan?.queue.map(song => song.id)).toEqual(['one', 'two', 'current', 'three']);
  expect(plan?.currentIndex).toBe(2);
  expect(plan?.selectedSong).toBe(queue[0]);
});

test('allows moving a track before the active item without changing the active song', () => {
  const plan = buildQueueReorderPlan({ queue, currentSongId: 'current', fromIndex: 2, toIndex: 0 });
  expect(plan?.queue.map(song => song.id)).toEqual(['two', 'current', 'one', 'three']);
  expect(plan?.currentIndex).toBe(1);
  expect(plan?.selectedSong).toBe(queue[0]);
});

test('allows sorting while the last track is active', () => {
  const plan = buildQueueReorderPlan({ queue, currentSongId: 'three', fromIndex: 1, toIndex: 0 });
  expect(plan?.queue.map(song => song.id)).toEqual(['one', 'current', 'two', 'three']);
  expect(plan?.selectedSong).toBe(queue[3]);
});

test.each([NaN, Infinity, -Infinity, -1, 5, 1.5])('rejects invalid source index %s', fromIndex => {
  expect(buildQueueReorderPlan({ queue, fromIndex, toIndex: 0 })).toBeNull();
});

test.each([NaN, Infinity, -Infinity, -1, 5, 1.5])('rejects invalid target index %s', toIndex => {
  expect(buildQueueReorderPlan({ queue, fromIndex: 1, toIndex })).toBeNull();
});
