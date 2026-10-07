import React, { useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMusicProviderEffects } from '../useMusicProviderEffects';
import * as coverCache from '../../utils/coverCache';
import { StorageKeys, storage } from '../../utils/storage';
import { EQ_PRESETS, type EqPresetName, type Playlist, type RepeatMode, type Song } from '../../types/Song';

const storedSongs: Song[] = Array.from({ length: 100 }, (_, index) => ({
  id: `s${index}`, title: `Original ${index}`, artist: 'Artist', uri: `file:///s${index}.mp3`,
}));
const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

const RecoveryProbe = () => {
  const [isReady, setIsReady] = useState(false);
  const [libraryHydrationReady, setLibraryHydrationReady] = useState(false);
  const [hydrationStatus, setHydrationStatus] = useState<'loading' | 'ready' | 'degraded' | 'retry-required'>('loading');
  const [hydrationRetryToken, setRetry] = useState(0);
  const [songs, setSongsState] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [, currentSongSetter] = useState<Song | null>(null);
  const [, playbackQueueSetter] = useState<Song[]>([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [volume, setVolumeState] = useState(1);
  const [eqEnabled, setEqEnabledState] = useState(false);
  const [eqBands, setEqBandsState] = useState<number[]>([...EQ_PRESETS.flat]);
  const [eqPreset, setEqPreset] = useState<EqPresetName | 'custom'>('flat');
  const songsRef = useRef<Song[]>([]);
  const queueContextRef = useRef<Song[]>([]);
  const baseQueueContextRef = useRef<Song[]>([]);
  const nativeQueueRef = useRef<Song[]>([]);
  useMusicProviderEffects({
    songsRef, queueContextRef, baseQueueContextRef, nativeQueueRef,
    persistCurrentSongId: async () => undefined, isReady, libraryHydrationReady,
    setIsReady, setLibraryHydrationReady, setHydrationStatus, hydrationRetryToken,
    songs, setSongsState, currentSongSetter, playbackQueueSetter, playlists, setPlaylists,
    shuffle, setShuffle, repeatMode, setRepeatMode, volume, setVolumeState,
    eqEnabled, setEqEnabledState, eqBands, setEqBandsState, eqPreset, setEqPreset,
  });
  return <>
    <Text testID="ready">{String(isReady)}</Text>
    <Text testID="library-ready">{String(libraryHydrationReady)}</Text>
    <Text testID="status">{hydrationStatus}</Text>
    <Text testID="title">{songs.find(song => song.id === 's0')?.title}</Text>
    <Pressable testID="edit-and-retry" onPress={() => {
      setSongsState(current => current.map(song => song.id === 's0' ? { ...song, title: 'Accepted edit' } : song));
      setRetry(current => current + 1);
    }} />
    <Pressable testID="retry" onPress={() => setRetry(current => current + 1)} />
  </>;
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  await storage.setSongs(storedSongs);
});
afterEach(() => { jest.restoreAllMocks(); });

test('recovery waits for both song preparation and the durable latest commit before reloading', async () => {
  const view = render(<RecoveryProbe />);
  await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
  const preparation = createDeferred();
  const write = createDeferred();
  const originalPrepare = coverCache.sanitizeSongsForStorage;
  const prepareSpy = jest.spyOn(coverCache, 'sanitizeSongsForStorage').mockImplementation(async (...args) => {
    await preparation.promise;
    return originalPrepare(...args);
  });
  const originalSet = storage.set.bind(storage);
  const setSpy = jest.spyOn(storage, 'set').mockImplementation(async (key, value) => {
    if (key === StorageKeys.SONGS) await write.promise;
    return originalSet(key, value);
  });
  const getSpy = jest.spyOn(storage, 'get');
  fireEvent.press(view.getByTestId('edit-and-retry'));
  await waitFor(() => expect(prepareSpy).toHaveBeenCalled());
  expect(getSpy).not.toHaveBeenCalledWith(StorageKeys.SONGS);
  await act(async () => { preparation.resolve(); });
  await waitFor(() => expect(setSpy).toHaveBeenCalledWith(StorageKeys.SONGS,
    expect.arrayContaining([expect.objectContaining({ id: 's0', title: 'Accepted edit' })])));
  expect(getSpy).not.toHaveBeenCalledWith(StorageKeys.SONGS);
  await act(async () => { write.resolve(); });
  await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
  expect(view.getByTestId('title').props.children).toBe('Accepted edit');
  expect((await storage.getSongs()).find(song => song.id === 's0')?.title).toBe('Accepted edit');
});

test.each(['preparation', 'write'])('blocks stale recovery reads after %s failure and allows a durable retry', async failure => {
  const view = render(<RecoveryProbe />);
  await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const originalPrepare = coverCache.sanitizeSongsForStorage;
  const prepareSpy = jest.spyOn(coverCache, 'sanitizeSongsForStorage').mockImplementation(async (...args) => {
    if (failure === 'preparation') throw new Error('preparation unavailable');
    return originalPrepare(...args);
  });
  const originalSet = storage.set.bind(storage);
  const setSpy = jest.spyOn(storage, 'set').mockImplementation(async (key, value) =>
    key === StorageKeys.SONGS && failure === 'write' ? false : originalSet(key, value));
  const getSpy = jest.spyOn(storage, 'get');
  fireEvent.press(view.getByTestId('edit-and-retry'));
  await waitFor(() => expect(view.getByTestId('status').props.children).toBe('retry-required'));
  expect(view.getByTestId('title').props.children).toBe('Accepted edit');
  expect(view.getByTestId('ready').props.children).toBe('false');
  expect(view.getByTestId('library-ready').props.children).toBe('true');
  expect(getSpy).not.toHaveBeenCalledWith(StorageKeys.SONGS);
  prepareSpy.mockRestore();
  setSpy.mockRestore();
  fireEvent.press(view.getByTestId('retry'));
  await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
  expect(view.getByTestId('title').props.children).toBe('Accepted edit');
  expect((await storage.getSongs()).find(song => song.id === 's0')?.title).toBe('Accepted edit');
});
