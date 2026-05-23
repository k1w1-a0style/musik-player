import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import { useMusicProviderAudioFeatures } from '../useMusicProviderAudioFeatures';

jest.mock('../useNativeEqualizer', () => ({
  useNativeEqualizer: jest.fn(() => null),
}));

jest.mock('../useAlbumPalette', () => ({
  useAlbumPalette: jest.fn(() => null),
}));

const Probe = () => {
  const state = useMusicProviderAudioFeatures({
    currentSong: null,
    eqEnabled: false,
    eqBands: [],
    isPlaying: true,
  });

  return (
    <>
      <Text testID="bins">{state.fftBins.join(',')}</Text>
      <Text testID="running">{String(state.visualizerRunning)}</Text>
      <Text testID="error">{state.visualizerError ?? ''}</Text>
    </>
  );
};

describe('useMusicProviderAudioFeatures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('keeps visualizer disabled and does not register native visualizer listeners', () => {
    const { getByTestId } = render(<Probe />);

    expect(getByTestId('bins').props.children).toBe(new Array(16).fill(0).join(','));
    expect(getByTestId('running').props.children).toBe('false');
    expect(getByTestId('error').props.children).toBe('');
    expect(SystemAudio.onFft).not.toHaveBeenCalled();
    expect(SystemAudio.onVisualizerState).not.toHaveBeenCalled();
    expect(SystemAudio.visualizerStop).not.toHaveBeenCalled();
  });
});
