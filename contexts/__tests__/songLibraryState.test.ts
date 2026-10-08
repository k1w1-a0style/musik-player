import { createSongLibraryState } from '../songLibraryState';
import type { Song } from '../../types/Song';

const song = (id: string): Song => ({ id, title: id, artist: 'Artist', uri: `file:///${id}.mp3` });
const generation = () => ({ controller: new AbortController() });
const delta = (baselineSongs: Song[], importedSongs: Song[]) => ({ baselineSongs, importedSongs, activeTab: 'tracks' as const });
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

test('a confirmed checkpoint is durable independently of the published React snapshot', async () => {
  const initial = [song('existing')];
  const state = createSongLibraryState(initial);
  const gate = deferred();
  let durable = initial;
  state.configurePersistence(async read => { await gate.promise; durable = read(); return durable; });
  const commit = state.commitImport(delta(initial, [song('imported')]), generation());
  await Promise.resolve();
  expect(state.getSnapshot()).toBe(initial);
  gate.resolve();
  await commit;
  expect(durable.map(song => song.id)).toEqual(['existing', 'imported']);
  expect(state.getSnapshot()).toBe(initial);
  state.publishImport();
  expect(state.getSnapshot().map(song => song.id)).toEqual(['existing', 'imported']);
});

test('an ordinary edit based on the visible snapshot retains hidden confirmed imports and deletions', async () => {
  const initial = [song('existing'), song('removed')];
  const state = createSongLibraryState(initial);
  state.configurePersistence(async read => read());
  await state.commitImport(delta(initial, [song('hidden')]), generation());
  state.setSongs([ { ...initial[0], title: 'Saved edit' } ]);
  expect(state.getCurrent()).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'existing', title: 'Saved edit' }), song('hidden'),
  ]));
  expect(state.getCurrent().some(song => song.id === 'removed')).toBe(false);
});

test('a failed checkpoint cannot publish unconfirmed staged songs', async () => {
  const initial = [song('existing')];
  const state = createSongLibraryState(initial);
  state.configurePersistence(async () => { throw new Error('disk full'); });
  await expect(state.commitImport(delta(initial, [song('unconfirmed')]), generation())).rejects.toThrow('disk full');
  state.publishImport();
  expect(state.getSnapshot()).toBe(initial);
  expect(state.getCurrent()).toBe(initial);
});

test('a cancelled generation cannot enqueue a new checkpoint after its replacement', async () => {
  const state = createSongLibraryState();
  const persist = jest.fn(async read => read());
  state.configurePersistence(persist);
  const old = generation();
  old.controller.abort();
  await expect(state.commitImport(delta([], [song('late')]), old)).rejects.toThrow();
  expect(persist).not.toHaveBeenCalled();
});
