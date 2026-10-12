import { act, renderHook } from '@testing-library/react-native';
import { useRef, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSongLibraryState } from '../songLibraryState';
import { usePersistedSongs } from '../usePersistedSongs';
import { storage, StorageKeys } from '../../utils/storage';
import type { Song } from '../../types/Song';

const initial: Song[] = [{ id: 'one', title: 'Original', artist: 'Artist', uri: 'file:///one.mp3' }];
const setup = () => {
  const state = createSongLibraryState(initial);
  const view = renderHook(() => {
    const songs = useSyncExternalStore(state.subscribe, state.getSnapshot);
    const refs = useRef<Record<string, string>>({});
    return usePersistedSongs(true, songs, state.setSongs, refs, state);
  });
  return { state, view };
};
beforeEach(async () => { await AsyncStorage.clear(); await storage.setSongs(initial); });
afterEach(() => { jest.restoreAllMocks(); });

test('a metadata confirmation waits for real I/O and survives a fresh storage load', async () => {
  const { state, view } = setup();
  await view.result.current();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const original = storage.set.bind(storage);
  let began = false;
  jest.spyOn(storage, 'set').mockImplementation(async (key, value) => {
    if (key === StorageKeys.SONGS && !began) { began = true; await gate; }
    return original(key, value);
  });
  let acknowledged = false;
  let pending!: Promise<void>;
  act(() => {
    state.setSongs(current => current.map(song => ({ ...song, title: 'Cleaned' })));
    pending = state.confirmCurrent().then(() => { acknowledged = true; });
  });
  await act(async () => { for (let tick = 0; tick < 12; tick += 1) await Promise.resolve(); });
  expect(began).toBe(true);
  expect(acknowledged).toBe(false);
  await act(async () => { release(); await pending; });
  expect(acknowledged).toBe(true);
  expect((await storage.getSongs())[0].title).toBe('Cleaned');
  view.unmount(); await view.result.current();
});

test('failure rejects confirmation and never claims a durable metadata change', async () => {
  const { state, view } = setup();
  await view.result.current();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const original = storage.set.bind(storage);
  const write = jest.spyOn(storage, 'set').mockImplementation(async (key, value) =>
    key === StorageKeys.SONGS ? false : original(key, value));
  act(() => state.setSongs(current => current.map(song => ({ ...song, title: 'Unstored' }))));
  await expect(state.confirmCurrent()).rejects.toThrow();
  expect((await storage.getSongs())[0].title).toBe('Original');
  write.mockRestore(); view.unmount(); await view.result.current();
});

test('confirmation includes prior hidden imports without publishing them again', async () => {
  const state = createSongLibraryState(initial);
  let stored = initial;
  state.configurePersistence(async read => { stored = read(); return stored; });
  await state.commitImport({ baselineSongs: initial, importedSongs: [{ ...initial[0], id: 'hidden', uri: 'file:///hidden.mp3' }], activeTab: 'tracks' },
    { controller: new AbortController() });
  state.setSongs([ { ...initial[0], title: 'Cleaned' } ]);
  await state.confirmCurrent();
  expect(stored.map(song => song.id)).toEqual(['one', 'hidden']);
  expect(stored[0].title).toBe('Cleaned');
});

test('confirmation refuses an unconfigured persistence boundary', async () => {
  const state = createSongLibraryState(initial);
  await expect(state.confirmCurrent()).rejects.toThrow('nicht bereit');
});
