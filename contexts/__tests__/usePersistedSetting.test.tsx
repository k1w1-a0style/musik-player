import React, { useRef } from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePersistedSetting } from '../usePersistedSetting';
import { StorageKeys, storage } from '../../utils/storage';

const PersistedSettingProbe = ({
  ready,
  value,
  debounceMs,
}: {
  ready: boolean;
  value: number;
  debounceMs?: number;
}) => {
  const persistedRefs = useRef<Record<string, string>>({});
  usePersistedSetting(ready, StorageKeys.VOLUME, value, persistedRefs, { debounceMs });
  return <Text testID="value">{value}</Text>;
};

describe('usePersistedSetting', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
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

  test('debounces rapid changes and persists only the latest value', async () => {
    jest.useFakeTimers();
    const setSpy = jest.spyOn(storage, 'set').mockResolvedValue(true);
    const screen = render(<PersistedSettingProbe ready value={0.2} debounceMs={250} />);

    await act(async () => undefined);
    screen.rerender(<PersistedSettingProbe ready value={0.8} debounceMs={250} />);
    await act(async () => undefined);
    expect(setSpy).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(249);
    });
    expect(setSpy).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(StorageKeys.VOLUME, 0.8);
  });

  test('flushes a pending debounced value when its owner unmounts', async () => {
    jest.useFakeTimers();
    const setSpy = jest.spyOn(storage, 'set').mockResolvedValue(true);
    const screen = render(<PersistedSettingProbe ready value={0.7} debounceMs={250} />);

    await act(async () => undefined);
    expect(setSpy).not.toHaveBeenCalled();
    screen.unmount();
    await act(async () => undefined);

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(StorageKeys.VOLUME, 0.7);
  });
});
