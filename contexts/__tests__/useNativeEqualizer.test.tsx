import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import SystemAudio, { type EqInitResult } from 'expo-system-audio';
import { useNativeEqualizer } from '../useNativeEqualizer';

const eqNative: EqInitResult = {
  available: true,
  enabled: false,
  minMillibel: -300,
  maxMillibel: 300,
  bands: [
    { index: 0, centerFreqHz: 60 },
    { index: 1, centerFreqHz: 1000 },
  ],
};

const NativeEqProbe = ({ enabled, bands }: { enabled: boolean; bands: number[] }) => {
  const native = useNativeEqualizer(enabled, bands);
  return <Text testID="available">{String(native?.available ?? false)}</Text>;
};

describe('useNativeEqualizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('initializes native EQ and applies enabled state plus bands', async () => {
    jest.spyOn(SystemAudio, 'eqInit').mockResolvedValueOnce(eqNative);

    const { getByTestId } = render(
      <NativeEqProbe enabled bands={[5, 0, 0, 0, 2, 0, 0, 0, 0, -5]} />,
    );

    await waitFor(() => expect(getByTestId('available').props.children).toBe('true'));

    expect(SystemAudio.eqSetEnabled).toHaveBeenCalledWith(true);
    expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledWith(0, 300);
    expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledWith(1, 200);
  });

  test('does not apply bands when native EQ is unavailable', async () => {
    jest.spyOn(SystemAudio, 'eqInit').mockResolvedValueOnce({ ...eqNative, available: false });

    const { getByTestId } = render(
      <NativeEqProbe enabled bands={[5, 0, 0, 0, 2, 0, 0, 0, 0, -5]} />,
    );

    await waitFor(() => expect(getByTestId('available').props.children).toBe('false'));

    expect(SystemAudio.eqSetBandLevel).not.toHaveBeenCalled();
  });

  test('releases native EQ on unmount', async () => {
    jest.spyOn(SystemAudio, 'eqInit').mockResolvedValueOnce(eqNative);

    const view = render(<NativeEqProbe enabled={false} bands={new Array(10).fill(0)} />);

    await waitFor(() => expect(SystemAudio.eqInit).toHaveBeenCalled());
    view.unmount();

    expect(SystemAudio.eqRelease).toHaveBeenCalled();
  });
});
