import React, { useRef, useState } from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePersistedSongs } from '../usePersistedSongs';
import * as musicPersistenceHelpers from '../musicPersistenceHelpers';
import { cleanupCoverCache } from '../../utils/coverCacheCleanup';
import { StorageKeys, storage } from '../../utils/storage';
import type { Song } from '../../types/Song';

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
}));

jest.mock('../../utils/coverCacheCleanup', () => ({
  cleanupCoverCache: jest.fn(async () => undefined),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
}));

const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];

const PersistedSongsProbe = ({ ready }: { ready: boolean }) => {
  const [currentSongs, setCurrentSongs] = useState(songs);
  const persistedRefs = useRef<Record<string, string>>({});
  usePersistedSongs(ready, currentSongs, setCurrentSongs, persistedRefs);
  return <Text testID="songs-count">{currentSongs.length}</Text>;
};

describe('usePersistedSongs', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test('does not persist before ready', async () => {
    render(<PersistedSongsProbe ready={false} />);

    await waitFor(async () => {
      expect(await storage.get(StorageKeys.SONGS)).toBeNull();
    });
  });

  test('persists songs after ready', async () => {
    render(<PersistedSongsProbe ready />);

    await waitFor(async () => {
      expect(await storage.get(StorageKeys.SONGS)).toEqual(songs);
    });
  });


  test('runs cover cleanup after a stored songs commit', async () => {
    jest.spyOn(musicPersistenceHelpers, 'persistIfChanged').mockResolvedValueOnce({ status: 'stored' });

    render(<PersistedSongsProbe ready />);

    await waitFor(() => expect(cleanupCoverCache).toHaveBeenCalledWith(songs));
  });

  test('runs cover cleanup after unchanged when the exact sanitized snapshot is already persisted', async () => {
    jest.spyOn(musicPersistenceHelpers, 'persistIfChanged').mockResolvedValueOnce({ status: 'unchanged' });

    render(<PersistedSongsProbe ready />);

    await waitFor(() => expect(cleanupCoverCache).toHaveBeenCalledWith(songs));
  });

  test('does not run cover cleanup when songs persistence is superseded', async () => {
    jest.spyOn(musicPersistenceHelpers, 'persistIfChanged').mockResolvedValueOnce({ status: 'superseded' });

    render(<PersistedSongsProbe ready />);

    await waitFor(() => expect(musicPersistenceHelpers.persistIfChanged).toHaveBeenCalledTimes(1));
    expect(cleanupCoverCache).not.toHaveBeenCalled();
  });

  test('warns without cover cleanup when songs persistence fails', async () => {
    const error = new Error('persist failed');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(musicPersistenceHelpers, 'persistIfChanged').mockResolvedValueOnce({ status: 'failed', error });

    render(<PersistedSongsProbe ready />);

    await waitFor(() => expect(warn).toHaveBeenCalledWith('[usePersistedSongs] Persistence failed:', error));
    expect(cleanupCoverCache).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('warns and keeps rendering when song persistence fails', async () => {
    const error = new Error('storage failed');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(musicPersistenceHelpers, 'prepareSongsForPersistence').mockRejectedValueOnce(error);

    const { getByTestId } = render(<PersistedSongsProbe ready />);

    expect(getByTestId('songs-count').props.children).toBe(1);
    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith('[usePersistedSongs] Persistence failed:', error);
    });

    warn.mockRestore();
  });
});
