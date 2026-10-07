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
    await waitFor(() => {
      expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledWith(0, 300);
      expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledWith(1, 200);
    });
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

  test('uses the latest slider values after a session refresh and disables immediately', async () => {
    jest.useFakeTimers();
    let resolveReplacement!: (value: EqInitResult) => void;
    jest.spyOn(SystemAudio, 'eqInit')
      .mockResolvedValueOnce(eqNative)
      .mockImplementationOnce(() => new Promise(resolve => { resolveReplacement = resolve; }));
    const emptyBands = new Array<number>(10).fill(0);
    const view = render(<NativeEqProbe enabled={false} bands={emptyBands} sessionKey="song-a" />);
    try {
      await waitFor(() => expect(view.getByTestId('available').props.children).toBe('true'));
      view.rerender(<NativeEqProbe enabled bands={[1, ...emptyBands.slice(1)]} sessionKey="song-a" />);
      view.rerender(<NativeEqProbe enabled bands={[2, ...emptyBands.slice(1)]} sessionKey="song-b" />);
      await waitFor(() => expect(SystemAudio.eqInit).toHaveBeenCalledTimes(2));
      act(() => jest.advanceTimersByTime(32));
      expect(SystemAudio.eqSetBandLevel).not.toHaveBeenCalled();

      await act(async () => { resolveReplacement(eqNative); });
      act(() => jest.advanceTimersByTime(16));
      expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledWith(0, 200);
      (SystemAudio.eqSetBandLevel as jest.Mock).mockClear();
      view.rerender(<NativeEqProbe enabled bands={[3, ...emptyBands.slice(1)]} sessionKey="song-b" />);
      view.rerender(<NativeEqProbe enabled={false} bands={[3, ...emptyBands.slice(1)]} sessionKey="song-b" />);
      expect(SystemAudio.eqSetEnabled).toHaveBeenLastCalledWith(false);
      act(() => jest.advanceTimersByTime(32));
      expect(SystemAudio.eqSetBandLevel).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  });

  test('unmount cancels a queued slider write before releasing the native effect', async () => {
    jest.useFakeTimers();
    jest.spyOn(SystemAudio, 'eqInit').mockResolvedValueOnce(eqNative);
    const bands = new Array<number>(10).fill(0);
    const view = render(<NativeEqProbe enabled={false} bands={bands} />);
    try {
      await waitFor(() => expect(view.getByTestId('available').props.children).toBe('true'));
      view.rerender(<NativeEqProbe enabled bands={bands} />);
      view.unmount();
      act(() => jest.advanceTimersByTime(32));
      expect(SystemAudio.eqSetBandLevel).not.toHaveBeenCalled();
      expect(SystemAudio.eqRelease).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
