import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import { useAudioVisualizer } from '../useAudioVisualizer';

type SystemAudioMock = typeof SystemAudio & {
  __triggerFft: (data: number[]) => void;
  __triggerState: (event: { running: boolean; reason: string }) => void;
};

const mockSystemAudio = SystemAudio as SystemAudioMock;

const VisualizerProbe = ({ isPlaying }: { isPlaying: boolean }) => {
  const { fftBins, visualizerRunning, visualizerError } = useAudioVisualizer(isPlaying);
  return (
    <>
      <Text testID="bins">{fftBins.join(',')}</Text>
      <Text testID="running">{String(visualizerRunning)}</Text>
      <Text testID="error">{visualizerError ?? ''}</Text>
    </>
  );
};

describe('useAudioVisualizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('registers listeners and stops visualizer on mount', () => {
    render(<VisualizerProbe isPlaying={false} />);

    expect(SystemAudio.onFft).toHaveBeenCalled();
    expect(SystemAudio.onVisualizerState).toHaveBeenCalled();
    expect(SystemAudio.visualizerStop).toHaveBeenCalled();
  });

  test('throttles fft updates', () => {
    const { getByTestId } = render(<VisualizerProbe isPlaying />);

    act(() => {
      mockSystemAudio.__triggerFft([1, 2, 3]);
    });
    expect(getByTestId('bins').props.children).toBe(new Array(16).fill(0).join(','));

    jest.spyOn(Date, 'now').mockReturnValue(120);
    act(() => {
      mockSystemAudio.__triggerFft([1, 2, 3]);
    });
    expect(getByTestId('bins').props.children).toBe('1,2,3');
  });

  test('updates visualizer running state and error', () => {
    const { getByTestId } = render(<VisualizerProbe isPlaying />);

    act(() => {
      mockSystemAudio.__triggerState({ running: true, reason: '' });
    });
    expect(getByTestId('running').props.children).toBe('true');
    expect(getByTestId('error').props.children).toBe('');

    act(() => {
      mockSystemAudio.__triggerState({ running: false, reason: 'permission denied' });
    });
    expect(getByTestId('running').props.children).toBe('false');
    expect(getByTestId('error').props.children).toBe('permission denied');
  });

  test('removes listeners and stops visualizer on unmount', () => {
    const view = render(<VisualizerProbe isPlaying />);

    view.unmount();

    expect(SystemAudio.visualizerStop).toHaveBeenCalledTimes(2);
  });
});
