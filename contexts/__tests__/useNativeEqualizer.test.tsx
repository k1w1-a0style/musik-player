import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
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

const NativeEqProbe = ({ enabled, bands, sessionKey = null }: { enabled: boolean; bands: number[]; sessionKey?: string | null }) => {
  const native = useNativeEqualizer(enabled, bands, sessionKey);
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

  test('keeps the working equalizer active while a replacement session initializes', async () => {
    let resolveReplacement!: (value: EqInitResult) => void;
    jest.spyOn(SystemAudio, 'eqInit')
      .mockResolvedValueOnce(eqNative)
      .mockImplementationOnce(() => new Promise(resolve => {
        resolveReplacement = resolve;
      }));

    const view = render(
      <NativeEqProbe enabled={false} bands={new Array(10).fill(0)} sessionKey="song-a" />,
    );
    await waitFor(() => expect(SystemAudio.eqInit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.getByTestId('available').props.children).toBe('true'));
    (SystemAudio.eqRelease as jest.Mock).mockClear();

    view.rerender(
      <NativeEqProbe enabled={false} bands={new Array(10).fill(0)} sessionKey="song-b" />,
    );
    await waitFor(() => expect(SystemAudio.eqInit).toHaveBeenCalledTimes(2));
    expect(SystemAudio.eqRelease).not.toHaveBeenCalled();

    await act(async () => {
      resolveReplacement(eqNative);
    });
    expect(SystemAudio.eqRelease).not.toHaveBeenCalled();
    view.unmount();
    expect(SystemAudio.eqRelease).toHaveBeenCalledTimes(1);
  });

  test('releases an equalizer that initializes after the final unmount', async () => {
    let resolveInit!: (value: EqInitResult) => void;
    jest.spyOn(SystemAudio, 'eqInit').mockImplementationOnce(() => new Promise(resolve => {
      resolveInit = resolve;
    }));

    const view = render(<NativeEqProbe enabled={false} bands={new Array(10).fill(0)} />);
    await waitFor(() => expect(SystemAudio.eqInit).toHaveBeenCalled());
    view.unmount();
    expect(SystemAudio.eqRelease).toHaveBeenCalledTimes(1);

    resolveInit(eqNative);
    await waitFor(() => expect(SystemAudio.eqRelease).toHaveBeenCalledTimes(2));
  });

  test('releases native EQ on unmount', async () => {
    jest.spyOn(SystemAudio, 'eqInit').mockResolvedValueOnce(eqNative);

    const view = render(<NativeEqProbe enabled={false} bands={new Array(10).fill(0)} />);

    await waitFor(() => expect(SystemAudio.eqInit).toHaveBeenCalled());
    view.unmount();

    expect(SystemAudio.eqRelease).toHaveBeenCalled();
  });
});
