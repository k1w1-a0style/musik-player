import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SystemAudio from 'expo-system-audio';
import { MusicProvider, useMusicContext } from '../MusicContext';

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readDirectoryAsync: jest.fn(async () => []),
  deleteAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readDirectoryAsync: jest.fn(async () => []),
  deleteAsync: jest.fn(async () => undefined),
}));

const Probe: React.FC = () => {
  const ctx = useMusicContext();
  return <Text testID="ready">{String(ctx.isReady)}</Text>;
};

describe('MusicContext native audio fallback', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  test('keeps provider ready when native equalizer init rejects', async () => {
    (SystemAudio.eqInit as jest.Mock).mockRejectedValueOnce(new Error('native init failed'));

    const { getByTestId } = render(
      <MusicProvider>
        <Probe />
      </MusicProvider>,
    );

    await waitFor(() => expect(getByTestId('ready').props.children).toBe('true'));
    expect(SystemAudio.eqInit).toHaveBeenCalled();
  });
});
