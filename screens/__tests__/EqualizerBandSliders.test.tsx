import React from 'react';
import { render } from '@testing-library/react-native';
import EqualizerBandSliders from '../EqualizerBandSliders';

const mockAppTheme = {
  palette: {
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#D8DEE8',
    text: {
      primary: '#F4F5F7',
      secondary: 'rgba(244, 245, 247, 0.70)',
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    theme: mockAppTheme,
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
  }),
}));

jest.mock('@react-native-community/slider', () => ({
  __esModule: true,
  default: 'Slider',
}));

test('renders EQ band sliders with accessibility labels', () => {
  const { getAllByText, getByLabelText, getByText } = render(
    <EqualizerBandSliders eqEnabled eqBands={[1, 0, -1, 2, -2]} onChangeBand={jest.fn()} />,
  );

  expect(getByLabelText('EQ-Band 60 Hz')).toBeTruthy();
  expect(getByLabelText('EQ-Band 1 kHz')).toBeTruthy();
  expect(getByText('60')).toBeTruthy();
  expect(getAllByText('0').length).toBeGreaterThan(0);
});

test('uses app theme slider colors', () => {
  const { getByLabelText } = render(
    <EqualizerBandSliders eqEnabled eqBands={[0, 0, 0, 0, 0]} onChangeBand={jest.fn()} />,
  );

  const slider = getByLabelText('EQ-Band 60 Hz');
  expect(slider.props.minimumTrackTintColor).toBe(mockAppTheme.palette.primary);
  expect(slider.props.maximumTrackTintColor).toBe(mockAppTheme.palette.border);
  expect(slider.props.thumbTintColor).toBe(mockAppTheme.palette.primary);
});
