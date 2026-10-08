import { createSongMergeIndex, mergeSongs } from '../libraryPresentation';
import type { Song } from '../../types/Song';

const song = (id: string, title = id, uri = `file:///${id}.mp3`): Song => ({ id, title, uri, artist: 'Artist' });

test('incremental batches keep rich metadata and sort only the requested snapshot', () => {
  const index = createSongMergeIndex([ { ...song('a', 'Zulu'), album: 'Album', cover: 'file:///cover.jpg' } ]);
  index.addAll([song('b', 'Beta')]);
  index.addAll([song('a', 'Alpha')]);
  expect(index.snapshot()).toEqual([
    expect.objectContaining({ id: 'a', title: 'Alpha', album: 'Album', cover: 'file:///cover.jpg' }),
    expect.objectContaining({ id: 'b', title: 'Beta' }),
  ]);
  expect(index.snapshot()).toBe(index.snapshot());
});

test('a bridge joins previously separate aliases without losing their original lookup keys', () => {
  const a = { ...song('a', 'A'), album: 'Album' };
  const b = { ...song('b', 'B'), genre: 'Techno' };
  const index = createSongMergeIndex([a, b]);
  index.addAll([song('b', 'Combined', a.uri)]);
  expect(index.snapshot()).toEqual([expect.objectContaining({ id: 'b', title: 'Combined', album: 'Album', genre: 'Techno' })]);
  expect(index.find(a)?.title).toBe('Combined');
  index.addAll([song('c', 'Latest', b.uri)]);
  expect(index.snapshot()).toHaveLength(1);
  expect(index.find(a)?.title).toBe('Latest');
});

test('insertion history matches a single merge across chunk boundaries and transitive aliases', () => {
  const chunks = [[song('a'), song('b')], [song('b', 'Bridge', 'file:///a.mp3')], [song('c', 'Tail', 'file:///b.mp3')]];
  const index = createSongMergeIndex();
  for (const chunk of chunks) index.addAll(chunk);
  expect(index.snapshot()).toEqual(mergeSongs([], chunks.flat()));
  expect(index.snapshot().map(item => item.title)).toEqual(['Tail']);
});
