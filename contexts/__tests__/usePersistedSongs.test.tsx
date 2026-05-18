import React, { useRef, useState } from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePersistedSongs } from '../usePersistedSongs';
import { StorageKeys, storage } from '../../utils/storage';
import type { Song } from '../../types/Song';

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
});
