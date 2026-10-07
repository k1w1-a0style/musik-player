import { renderHook } from '@testing-library/react-native';
import { useLibraryImportStateUpdate } from '../useLibraryImportStateUpdate';
import { buildImportedSongsUpdate } from '../../utils/libraryImportFlow';
import { createImportProgressCallbacks } from '../../utils/libraryImportProgressCallbacks';
import type { Song } from '../../types/Song';

const song = (id: string) => ({ id, title: id, artist: 'Artist', uri: `file:///${id}.mp3` });

test('an immediately restarted import retains accepted chunks before song props rerender', () => {
  const setSongs = jest.fn();
  const songs = [song('existing')];
  const { result } = renderHook(() => useLibraryImportStateUpdate({ songs, setSongs, setActiveTab: jest.fn(), ensureCurrentImport: jest.fn() }));
  result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(songs, [song('first')]), { id: 1, controller: new AbortController() });
  const accepted = result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(songs, [song('second')]), { id: 2, controller: new AbortController() });
  expect(accepted.map(item => item.id)).toEqual(['existing', 'first', 'second']);
  expect(setSongs).toHaveBeenLastCalledWith(accepted);
});

test('stale generations cannot update the baseline used by the next import', () => {
  const setSongs = jest.fn();
  const ensureCurrentImport = jest.fn(() => { throw new Error('superseded'); });
  const songs = [song('existing')];
  const { result } = renderHook(() => useLibraryImportStateUpdate({ songs, setSongs, setActiveTab: jest.fn(), ensureCurrentImport }));
  expect(() => result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(songs, [song('stale')]),
    { id: 1, controller: new AbortController() })).toThrow('superseded');
  expect(setSongs).not.toHaveBeenCalled();
});

test('checkpoint deltas preserve unrelated edits, removals and additions made during a scan', () => {
  const baseline: Song[] = [song('existing'), song('removed')];
  let published = baseline;
  const generation = { id: 1, controller: new AbortController() };
  const view = renderHook(({ songs }: { songs: Song[] }) => useLibraryImportStateUpdate({ songs,
    setSongs: values => { published = values; }, setActiveTab: jest.fn(), ensureCurrentImport: jest.fn() }),
  { initialProps: { songs: published } });
  const callbacks = createImportProgressCallbacks({ songs: baseline, signal: generation.controller.signal,
    activity: jest.fn(), onFileProgress: jest.fn(),
    onApply: update => view.result.current.applyImportedSongsUpdate(update, generation) });
  callbacks.onCheckpoint({ songs: [song('first')], processed: 1, total: 2 });
  published = published.filter(song => song.id !== 'removed').map(song =>
    song.id === 'existing' ? { ...song, title: 'Newer edit' } : song);
  published.push(song('external'));
  view.rerender({ songs: published });
  callbacks.onCheckpoint({ songs: [song('second')], processed: 2, total: 2 });
  expect(published.find(song => song.id === 'existing')?.title).toBe('Newer edit');
  expect(published.map(song => song.id)).toEqual(expect.arrayContaining(['external', 'first', 'second']));
  expect(published.some(song => song.id === 'removed')).toBe(false);
});

test('later checkpoints and the final replay preserve a concurrently edited scanned source', () => {
  const baseline: Song[] = [{ ...song('existing'), fileInfo: { modificationTime: 1, contentHash: 'before' } }];
  let published = baseline;
  const generation = { id: 1, controller: new AbortController() };
  const view = renderHook(({ songs }: { songs: Song[] }) => useLibraryImportStateUpdate({ songs,
    setSongs: values => { published = values; }, setActiveTab: jest.fn(), ensureCurrentImport: jest.fn() }),
  { initialProps: { songs: published } });
  const callbacks = createImportProgressCallbacks({ songs: baseline, signal: generation.controller.signal,
    activity: jest.fn(), onFileProgress: jest.fn(),
    onApply: update => view.result.current.applyImportedSongsUpdate(update, generation) });
  const staleSource = { ...baseline[0], title: 'Scanned title' };
  callbacks.onCheckpoint({ songs: [staleSource], processed: 1, total: 3 });
  published = published.map(song => ({ ...song, title: 'Saved tag edit', cover: 'file:///new-cover.jpg',
    fileInfo: { ...song.fileInfo, modificationTime: 2, contentHash: 'edited' } }));
  view.rerender({ songs: published });
  callbacks.onCheckpoint({ songs: [staleSource, song('new')], processed: 2, total: 3 });
  view.rerender({ songs: published });
  callbacks.onCheckpoint({ songs: [staleSource, song('last')], processed: 3, total: 3 });
  view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(baseline, [staleSource, song('new'), song('last')]), generation);
  expect(published.find(song => song.id === 'existing')).toMatchObject({ title: 'Saved tag edit',
    cover: 'file:///new-cover.jpg', fileInfo: { modificationTime: 2, contentHash: 'edited' } });
  expect(published.map(song => song.id)).toEqual(expect.arrayContaining(['new', 'last']));
});

test('a track removed after scan start is not resurrected by a delayed metadata batch', () => {
  const baseline: Song[] = [song('removed')];
  const setSongs = jest.fn();
  const view = renderHook(() => useLibraryImportStateUpdate({ songs: [], setSongs,
    setActiveTab: jest.fn(), ensureCurrentImport: jest.fn() }));
  const accepted = view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(baseline, baseline),
    { id: 1, controller: new AbortController() });
  expect(accepted).toEqual([]);
});

test('an unchanged source accepts richer scan metadata and retains its canonical ID across aliases', () => {
  const baseline: Song[] = [song('canonical')];
  const view = renderHook(() => useLibraryImportStateUpdate({ songs: baseline, setSongs: jest.fn(),
    setActiveTab: jest.fn(), ensureCurrentImport: jest.fn() }));
  const incoming = { ...baseline[0], id: 'provider-alias', title: 'Read from tags', album: 'Album' };
  const accepted = view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate(baseline, [incoming]),
    { id: 1, controller: new AbortController() });
  expect(accepted).toEqual([expect.objectContaining({ id: 'canonical', title: 'Read from tags', album: 'Album' })]);
});
