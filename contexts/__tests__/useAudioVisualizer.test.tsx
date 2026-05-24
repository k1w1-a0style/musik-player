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

const VisualizerProbe = ({
  isPlaying,
  enabled = true,
}: {
  isPlaying: boolean;
  enabled?: boolean;
}) => {
  const { fftBins, visualizerRunning, visualizerError } = useAudioVisualizer(isPlaying, enabled);
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

  test('does not register listeners or stop visualizer when disabled', () => {
    render(<VisualizerProbe isPlaying={false} enabled={false} />);

    expect(SystemAudio.onFft).not.toHaveBeenCalled();
    expect(SystemAudio.onVisualizerState).not.toHaveBeenCalled();
    expect(SystemAudio.visualizerStop).not.toHaveBeenCalled();
  });

  test('removes subscriptions when enabled changes from true to false', () => {
    const view = render(<VisualizerProbe isPlaying enabled />);

    expect(SystemAudio.onFft).toHaveBeenCalledTimes(1);
    expect(SystemAudio.onVisualizerState).toHaveBeenCalledTimes(1);

    view.rerender(<VisualizerProbe isPlaying enabled={false} />);

    expect(SystemAudio.visualizerStop).toHaveBeenCalledTimes(2);
  });

  test('resets visualizer state when enabled changes from true to false', () => {
    const { getByTestId, rerender } = render(<VisualizerProbe isPlaying enabled />);

    jest.spyOn(Date, 'now').mockReturnValue(120);
    act(() => {
      mockSystemAudio.__triggerFft([1, 2, 3]);
      mockSystemAudio.__triggerState({ running: true, reason: '' });
    });

    expect(getByTestId('bins').props.children).toBe('1,2,3');
    expect(getByTestId('running').props.children).toBe('true');
    expect(getByTestId('error').props.children).toBe('');

    rerender(<VisualizerProbe isPlaying enabled={false} />);

    expect(getByTestId('bins').props.children).toBe(new Array(16).fill(0).join(','));
    expect(getByTestId('running').props.children).toBe('false');
    expect(getByTestId('error').props.children).toBe('');
    expect(SystemAudio.onFft).toHaveBeenCalledTimes(1);
    expect(SystemAudio.onVisualizerState).toHaveBeenCalledTimes(1);
    expect(SystemAudio.visualizerStop).toHaveBeenCalledTimes(2);
  });


  test('clears visualizer error when enabled changes from true to false', () => {
    const { getByTestId, rerender } = render(<VisualizerProbe isPlaying enabled />);

    act(() => {
      mockSystemAudio.__triggerState({ running: false, reason: 'permission denied' });
    });

    expect(getByTestId('error').props.children).toBe('permission denied');

    rerender(<VisualizerProbe isPlaying enabled={false} />);

    expect(getByTestId('error').props.children).toBe('');
  });

  test('registers listeners when enabled changes from false to true', () => {
    const view = render(<VisualizerProbe isPlaying enabled={false} />);

    expect(SystemAudio.onFft).not.toHaveBeenCalled();
    expect(SystemAudio.onVisualizerState).not.toHaveBeenCalled();

    view.rerender(<VisualizerProbe isPlaying enabled />);

    expect(SystemAudio.onFft).toHaveBeenCalledTimes(1);
    expect(SystemAudio.onVisualizerState).toHaveBeenCalledTimes(1);
    expect(SystemAudio.visualizerStop).toHaveBeenCalledTimes(1);
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