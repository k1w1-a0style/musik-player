import React, { useRef, useState } from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import { useMusicHydration } from '../useMusicHydration';
import { StorageKeys, storage } from '../../utils/storage';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../../types/Song';

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
}));

const storedSongs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
];

const storedPlaylists: Playlist[] = [
  { id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1, updatedAt: 1 },
];

const HydrationProbe = ({ retryToken = 0 }: { retryToken?: number }) => {
  const [isReady, setIsReady] = useState(false);
  const [libraryHydrationReady, setLibraryHydrationReady] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [, setPlaylists] = useState<Playlist[]>([]);
  const [, setEqEnabled] = useState(false);
  const [, setEqBands] = useState<number[]>([]);
  const [, setEqPreset] = useState<EqPresetName | 'custom'>('flat');
  const [, setVolume] = useState(1);
  const [, setRepeatMode] = useState<RepeatMode>('off');
  const [, setShuffle] = useState(false);

  const songsRef = useRef<Song[]>([]);
  const queueContextRef = useRef<Song[]>([]);
  const baseQueueContextRef = useRef<Song[]>([]);
  const nativeQueueRef = useRef<Song[]>([]);

  useMusicHydration({
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    setIsReady,
    setLibraryHydrationReady,
    hydrationRetryToken: retryToken,
    setSongsState: setSongs,
    setCurrentSong,
    setPlaybackQueue: setQueue,
    setPlaylists,
    setEqEnabledState: setEqEnabled,
    setEqBandsState: setEqBands,
    setEqPreset,
    setVolumeState: setVolume,
    setRepeatMode,
    setShuffle,
  });

  return (
    <>
      <Text testID="ready">{String(isReady)}</Text>
      <Text testID="library-ready">{String(libraryHydrationReady)}</Text>
      <Text testID="songs">{songs.map(song => song.id).join(',')}</Text>
      <Text testID="queue">{queue.map(song => song.id).join(',')}</Text>
      <Text testID="current">{currentSong?.id ?? ''}</Text>
    </>
  );
};

describe('useMusicHydration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test('hydrates songs, queue, current song and TrackPlayer state', async () => {
    await storage.set(StorageKeys.SONGS, storedSongs);
    await storage.set(StorageKeys.PLAYLISTS, storedPlaylists);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's2');
    await storage.set(StorageKeys.VOLUME, 0.7);
    await storage.set(StorageKeys.REPEAT_MODE, 'all');

    const { getByTestId } = render(<HydrationProbe />);

    await waitFor(() => expect(getByTestId('ready').props.children).toBe('true'));

    expect(getByTestId('songs').props.children).toBe('s1,s2');
    expect(getByTestId('queue').props.children).toBe('s2,s1');
    expect(getByTestId('current').props.children).toBe('s2');
    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(TrackPlayer.add).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 's2' })]));
    expect(TrackPlayer.setVolume).toHaveBeenCalledWith(0.7);
  });

  test('publishes the stored library before TrackPlayer setup finishes', async () => {
    let finishSetup!: () => void;
    const pendingSetup = new Promise<void>(resolve => { finishSetup = resolve; });
    jest.mocked(TrackPlayer.setupPlayer).mockImplementationOnce(() => pendingSetup);
    await storage.set(StorageKeys.SONGS, storedSongs);
    await storage.set(StorageKeys.PLAYLISTS, storedPlaylists);

    const { getByTestId } = render(<HydrationProbe />);

    await waitFor(() => expect(getByTestId('library-ready').props.children).toBe('true'), { timeout: 300 });
    expect(getByTestId('songs').props.children).toBe('s1,s2');
    expect(getByTestId('ready').props.children).toBe('false');

    finishSetup();
    await pendingSetup;
    await waitFor(() => expect(getByTestId('ready').props.children).toBe('true'));
  });

  test('closes library readiness while a retry generation hydrates a new snapshot', async () => {
    await storage.set(StorageKeys.SONGS, storedSongs);
    await storage.set(StorageKeys.PLAYLISTS, storedPlaylists);

    const view = render(<HydrationProbe />);
    await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
    expect(view.getByTestId('library-ready').props.children).toBe('true');

    let finishRetryRead!: (songs: Song[]) => void;
    const pendingRetryRead = new Promise<Song[]>(resolve => { finishRetryRead = resolve; });
    const originalGet = storage.get.bind(storage) as (key: string) => Promise<unknown | null>;
    jest.spyOn(storage, 'get').mockImplementation((key: string) =>
      key === StorageKeys.SONGS ? pendingRetryRead : originalGet(key));

    view.rerender(<HydrationProbe retryToken={1} />);
    await waitFor(() => {
      expect(view.getByTestId('ready').props.children).toBe('false');
      expect(view.getByTestId('library-ready').props.children).toBe('false');
    });

    finishRetryRead(storedSongs);
    await pendingRetryRead;
    await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
    expect(view.getByTestId('library-ready').props.children).toBe('true');
  });

  test('runs hydration only once for a provider mount across rerenders', async () => {
    await storage.set(StorageKeys.SONGS, storedSongs);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');

    const { getByTestId, rerender } = render(<HydrationProbe />);

    await waitFor(() => expect(getByTestId('ready').props.children).toBe('true'));
    rerender(<HydrationProbe />);

    expect(TrackPlayer.reset).toHaveBeenCalledTimes(1);
  });

  test('clears missing persisted current song id', async () => {
    await storage.set(StorageKeys.SONGS, storedSongs);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 'missing');

    const { getByTestId } = render(<HydrationProbe />);

    await waitFor(() => expect(getByTestId('ready').props.children).toBe('true'));

    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });
});
