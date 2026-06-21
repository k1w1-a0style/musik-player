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

test('does not move the active item', () => {
  expect(buildQueueReorderPlan({ queue, currentSongId: 'current', fromIndex: 0, toIndex: 2 })).toBeNull();
});

test('clamps target before current item to first upcoming position', () => {
  const plan = buildQueueReorderPlan({ queue, currentSongId: 'current', fromIndex: 2, toIndex: 0 });

  expect(plan?.queue.map(song => song.id)).toEqual(['current', 'two', 'one', 'three']);
});
