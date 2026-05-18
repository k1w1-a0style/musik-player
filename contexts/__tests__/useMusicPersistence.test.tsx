import React, { useState } from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMusicPersistence } from '../useMusicPersistence';
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

const PersistenceProbe = ({ ready }: { ready: boolean }) => {
  const [currentSongs, setCurrentSongs] = useState(songs);

  useMusicPersistence({
    isReady: ready,
    volume: 0.5,
    shuffle: true,
    repeatMode: 'all',
    eqEnabled: true,
    eqBands: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    eqPreset: 'rock',
    playlists: [{ id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1 }],
    songs: currentSongs,
    setSongsState: setCurrentSongs,
  });

  return <Text testID="songs-count">{currentSongs.length}</Text>;
};

describe('useMusicPersistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test('does not persist before hydration is ready', async () => {
    render(<PersistenceProbe ready={false} />);

    await waitFor(async () => {
      expect(await storage.get(StorageKeys.VOLUME)).toBeNull();
    });
  });

  test('persists music settings and songs after hydration is ready', async () => {
    render(<PersistenceProbe ready />);

    await waitFor(async () => {
      expect(await storage.get(StorageKeys.VOLUME)).toBe(0.5);
      expect(await storage.get(StorageKeys.SHUFFLE)).toBe(true);
      expect(await storage.get(StorageKeys.REPEAT_MODE)).toBe('all');
      expect(await storage.get(StorageKeys.EQ_ENABLED)).toBe(true);
      expect(await storage.get(StorageKeys.EQ_PRESET)).toBe('rock');
      expect(await storage.get(StorageKeys.SONGS)).toEqual(songs);
    });
  });
});
