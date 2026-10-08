import { renderHook } from '@testing-library/react-native';
import { useLibraryImportStateUpdate } from '../useLibraryImportStateUpdate';
import { buildImportedSongsUpdate } from '../../utils/libraryImportFlow';
import { createImportProgressCallbacks } from '../../utils/libraryImportProgressCallbacks';
import { createSongLibraryState } from '../../contexts/songLibraryState';
import type { Song } from '../../types/Song';

const song = (id: string) => ({ id, title: id, artist: 'Artist', uri: `file:///${id}.mp3` });
const setup = (songs: Song[], ensureCurrentImport = jest.fn()) => {
  const state = createSongLibraryState(songs);
  state.configurePersistence(async read => read());
  const setSongs = jest.fn((next: Song[]) => state.setSongs(next));
  state.configureImportPublication(setSongs);
  const view = renderHook(() => useLibraryImportStateUpdate({ songs, setSongs, songImport: state,
    setActiveTab: jest.fn(), ensureCurrentImport }));
  return { state, setSongs, ...view };
};
const generation = (id = 1) => ({ id, controller: new AbortController() });

// Persistence is the boundary double here; separate provider tests use real storage.
test('an immediately restarted import retains confirmed chunks before song props rerender', async () => {
  const songs = [song('existing')];
  const view = setup(songs);
  await view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(songs, [song('first')]), generation());
  const accepted = await view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(songs, [song('second')]), generation(2));
  expect(accepted.map(item => item.id)).toEqual(expect.arrayContaining(['existing', 'first', 'second']));
  expect(view.state.getSnapshot().map(item => item.id)).toEqual(['existing', 'first', 'second']);
});

test('stale generations cannot update the baseline used by the next import', async () => {
  const songs = [song('existing')];
  const view = setup(songs, jest.fn(() => { throw new Error('superseded'); }));
  await expect(view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(songs, [song('stale')]), generation()))
    .rejects.toThrow('superseded');
  expect(view.setSongs).not.toHaveBeenCalled();
});

test('checkpoint deltas preserve unrelated edits, removals and additions made during a scan', async () => {
  const baseline = [song('existing'), song('removed')];
  const view = setup(baseline);
  const active = generation();
  const callbacks = createImportProgressCallbacks({ songs: baseline, signal: active.controller.signal,
    activity: jest.fn(), onFileProgress: jest.fn(),
    onApply: update => view.result.current.applyImportedSongsUpdate(update, active, false),
    onPublish: () => { view.result.current.publishImportedSongs(active); } });
  await callbacks.onCheckpoint({ songs: [song('first')], processed: 1, total: 2 });
  view.state.setSongs([ { ...song('existing'), title: 'Newer edit' }, song('first'), song('external') ]);
  await callbacks.onCheckpoint({ songs: [song('second')], processed: 2, total: 2 });
  callbacks.close();
  const published = view.state.getSnapshot();
  expect(published.find(song => song.id === 'existing')?.title).toBe('Newer edit');
  expect(published.map(song => song.id)).toEqual(expect.arrayContaining(['external', 'first', 'second']));
  expect(published.some(song => song.id === 'removed')).toBe(false);
});

test('later checkpoints and the final replay preserve a concurrently edited scanned source', async () => {
  const baseline = [{ ...song('existing'), fileInfo: { modificationTime: 1, contentHash: 'before' } }];
  const view = setup(baseline);
  const active = generation();
  const staleSource = { ...baseline[0], title: 'Scanned title' };
  await view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(baseline, [staleSource]), active);
  view.state.setSongs(current => current.map(song => ({ ...song, title: 'Saved tag edit', cover: 'file:///new-cover.jpg',
    fileInfo: { ...song.fileInfo, modificationTime: 2, contentHash: 'edited' } })));
  await view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(baseline, [staleSource, song('new')]), active);
  await view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(baseline, [staleSource, song('last')]), active);
  await view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(baseline, [staleSource, song('new'), song('last')]), active);
  expect(view.state.getSnapshot().find(song => song.id === 'existing')).toMatchObject({ title: 'Saved tag edit',
    cover: 'file:///new-cover.jpg', fileInfo: { modificationTime: 2, contentHash: 'edited' } });
  expect(view.state.getSnapshot().map(song => song.id)).toEqual(expect.arrayContaining(['new', 'last']));
});

test('a track removed after scan start is not resurrected by a delayed metadata batch', async () => {
  const baseline = [song('removed')];
  const view = setup([]);
  const accepted = await view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(baseline, baseline), generation());
  expect(accepted).toEqual([]);
});

test('an unchanged source accepts richer scan metadata and retains its canonical ID across aliases', async () => {
  const baseline = [song('canonical')];
  const view = setup(baseline);
  const incoming = { ...baseline[0], id: 'provider-alias', title: 'Read from tags', album: 'Album' };
  const accepted = await view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(baseline, [incoming]), generation());
  expect(accepted).toEqual([expect.objectContaining({ id: 'canonical', title: 'Read from tags', album: 'Album' })]);
});
