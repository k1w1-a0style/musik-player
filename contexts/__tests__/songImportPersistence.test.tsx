import { useRef, useSyncExternalStore } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSongLibraryState } from '../songLibraryState';
import { usePersistedSongs } from '../usePersistedSongs';
import { storage, StorageKeys } from '../../utils/storage';
import * as coverCache from '../../utils/coverCache';
import type { Song } from '../../types/Song';

const song = (id: string): Song => ({ id, title: id, artist: 'Artist', uri: `file:///${id}.mp3` });
const initial = Array.from({ length: 100 }, (_, index) => song(String(index)));
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};
const setup = () => {
  const state = createSongLibraryState(initial);
  const view = renderHook(() => {
    const songs = useSyncExternalStore(state.subscribe, state.getSnapshot);
    const refs = useRef<Record<string, string>>({});
    return usePersistedSongs(true, songs, state.setSongs, refs, state);
  });
  const commit = (songs: Song[] = [song('imported')]) => state.commitImport({
    activeTab: 'tracks', baselineSongs: initial, importedSongs: songs,
  }, { controller: new AbortController() });
  const finish = async () => { view.unmount(); await view.result.current(); };
  return { state, view, commit, finish };
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await storage.setSongs(initial);
  jest.useFakeTimers();
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('a confirmed hidden checkpoint survives a fresh storage load and an older UI debounce', async () => {
  const { state, commit, finish } = setup();
  await act(async () => { await commit(); });
  expect(state.getSnapshot()).toBe(initial);
  expect((await storage.getSongs()).some(song => song.id === 'imported')).toBe(true);
  await act(async () => { jest.advanceTimersByTime(350); });
  expect((await storage.getSongs()).some(song => song.id === 'imported')).toBe(true);
  const restarted = createSongLibraryState(await storage.getSongs());
  expect(restarted.getSnapshot().some(song => song.id === 'imported')).toBe(true);
  await finish();
});

test('ordinary edits during a slow checkpoint are saved before its confirmation', async () => {
  const { state, commit, finish } = setup();
  const gate = deferred();
  const original = storage.set.bind(storage);
  let started = false;
  jest.spyOn(storage, 'set').mockImplementation(async (key, value) => {
    if (key === StorageKeys.SONGS && !started) { started = true; await gate.promise; }
    return original(key, value);
  });
  const pending = commit();
  await act(async () => { await Promise.resolve(); });
  expect(started).toBe(true);
  act(() => state.setSongs(current => current.filter(song => song.id !== '1')
    .map(song => song.id === '0' ? { ...song, title: 'Saved edit' } : song)));
  expect(state.getCurrent().some(song => song.id === 'imported')).toBe(false);
  await act(async () => { gate.resolve(); await pending; });
  const durable = await storage.getSongs();
  expect(durable.find(song => song.id === '0')?.title).toBe('Saved edit');
  expect(durable.some(song => song.id === '1')).toBe(false);
  expect(durable.some(song => song.id === 'imported')).toBe(true);
  await finish();
});

test('an older delayed preparation cannot write after the durable import checkpoint', async () => {
  const { commit, finish } = setup();
  const gate = deferred();
  const original = coverCache.sanitizeSongsForStorage;
  let first = true;
  jest.spyOn(coverCache, 'sanitizeSongsForStorage').mockImplementation(async (...args) => {
    if (first) { first = false; await gate.promise; }
    return original(...args);
  });
  await act(async () => { jest.advanceTimersByTime(350); });
  const pending = commit();
  await act(async () => { await Promise.resolve(); });
  await act(async () => { gate.resolve(); await pending; });
  expect((await storage.getSongs()).some(song => song.id === 'imported')).toBe(true);
  await finish();
});

test('unmount with an unpublished checkpoint retains the latest authoritative snapshot', async () => {
  const { commit, finish } = setup();
  await act(async () => { await commit(); });
  await finish();
  expect((await storage.getSongs()).some(song => song.id === 'imported')).toBe(true);
});

test('cancelling during real storage I/O retains the stored checkpoint without late UI publication', async () => {
  const { state, finish } = setup();
  const gate = deferred();
  const original = storage.set.bind(storage);
  let started = false;
  jest.spyOn(storage, 'set').mockImplementation(async (key, value) => {
    if (key === StorageKeys.SONGS && !started) { started = true; await gate.promise; }
    return original(key, value);
  });
  const old = new AbortController();
  const pending = state.commitImport({ baselineSongs: initial, importedSongs: [song('imported')], activeTab: 'tracks' },
    { controller: old });
  await act(async () => { await Promise.resolve(); });
  expect(started).toBe(true);
  old.abort();
  await act(async () => { gate.resolve(); await pending; });
  expect(state.getSnapshot()).toBe(initial);
  expect((await storage.getSongs()).some(song => song.id === 'imported')).toBe(true);
  await state.waitForCheckpoints();
  await act(async () => {
    await state.commitImport({ baselineSongs: state.getCurrent(), importedSongs: [song('next')], activeTab: 'tracks' },
      { controller: new AbortController() });
    state.publishImport();
  });
  expect(state.getSnapshot().map(song => song.id)).toEqual(expect.arrayContaining(['imported', 'next']));
  await finish();
});

test('write failure rejects acknowledgement and keeps the visible confirmed library', async () => {
  const { state, commit, finish } = setup();
  const original = storage.set.bind(storage);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const write = jest.spyOn(storage, 'set').mockImplementation(async (key, value) => key === StorageKeys.SONGS ? false : original(key, value));
  await expect(commit()).rejects.toThrow('nicht sicher gespeichert');
  state.publishImport();
  expect(state.getSnapshot()).toBe(initial);
  expect(state.getCurrent()).toBe(initial);
  expect((await storage.getSongs()).some(song => song.id === 'imported')).toBe(false);
  write.mockRestore();
  await act(async () => { await commit(); });
  expect((await storage.getSongs()).some(song => song.id === 'imported')).toBe(true);
  await finish();
});
