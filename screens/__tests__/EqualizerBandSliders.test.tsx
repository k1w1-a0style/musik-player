import React from 'react';
import { render } from '@testing-library/react-native';
import EqualizerBandSliders from '../EqualizerBandSliders';

jest.mock('@react-native-community/slider', () => 'Slider');

describe('EqualizerBandSliders', () => {
  const eqBands = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  test('exposes distinct accessibility labels for equalizer bands', () => {
    const { getByLabelText } = render(
      <EqualizerBandSliders eqEnabled eqBands={eqBands} onChangeBand={jest.fn()} />,
    );

    expect(getByLabelText('EQ Band 60 Hz')).toBeTruthy();
    expect(getByLabelText('EQ Band 170 Hz')).toBeTruthy();
  });

  test('exposes disabled accessibility state when EQ is disabled', () => {
    const { getByLabelText } = render(
      <EqualizerBandSliders eqEnabled={false} eqBands={eqBands} onChangeBand={jest.fn()} />,
    );

    expect(getByLabelText('EQ Band 60 Hz').props.accessibilityState?.disabled).toBe(true);
  });
});
