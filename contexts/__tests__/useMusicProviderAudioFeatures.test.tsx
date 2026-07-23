import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { useMusicProviderAudioFeatures } from '../useMusicProviderAudioFeatures';

jest.mock('../useNativeEqualizer', () => ({
  useNativeEqualizer: jest.fn(() => ({ available: true, enabled: true, bands: [], minMillibel: -1500, maxMillibel: 1500 })),
}));

jest.mock('../useAlbumPalette', () => ({
  useAlbumPaletteState: jest.fn(() => ({
    palette: { dominant: '#111111' },
    isLoading: true,
  })),
}));

const Probe = () => {
  const state = useMusicProviderAudioFeatures({
    currentSong: null,
    eqEnabled: true,
    eqBands: [],
  });

  return (
    <>
      <Text testID="eq">{String(state.eqNative?.available)}</Text>
      <Text testID="palette">{state.palette?.dominant}</Text>
      <Text testID="palette-loading">{String(state.paletteLoading)}</Text>
    </>
  );
};

describe('useMusicProviderAudioFeatures', () => {
  test('exposes supported audio features without visualizer state', () => {
    const { getByTestId } = render(<Probe />);

    expect(getByTestId('eq').props.children).toBe('true');
    expect(getByTestId('palette').props.children).toBe('#111111');
    expect(getByTestId('palette-loading').props.children).toBe('true');
  });
});
