import React, { useRef } from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePersistedSetting } from '../usePersistedSetting';
import { StorageKeys, storage } from '../../utils/storage';

const PersistedSettingProbe = ({ ready, value }: { ready: boolean; value: number }) => {
  const persistedRefs = useRef<Record<string, string>>({});
  usePersistedSetting(ready, StorageKeys.VOLUME, value, persistedRefs);
  return <Text testID="value">{value}</Text>;
};

describe('usePersistedSetting', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test('does not persist before ready', async () => {
    render(<PersistedSettingProbe ready={false} value={0.4} />);

    await waitFor(async () => {
      expect(await storage.get(StorageKeys.VOLUME)).toBeNull();
    });
  });

  test('persists setting after ready', async () => {
    render(<PersistedSettingProbe ready value={0.4} />);

    await waitFor(async () => {
      expect(await storage.get(StorageKeys.VOLUME)).toBe(0.4);
    });
  });
});
