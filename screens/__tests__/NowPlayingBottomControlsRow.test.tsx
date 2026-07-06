import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import NowPlayingBottomControlsRow from '../NowPlayingBottomControlsRow';

const mockAppTheme = {
  palette: {
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    border: 'rgba(255, 255, 255, 0.08)',
    text: {
      muted: 'rgba(244, 245, 247, 0.42)',
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

jest.mock('../../components/VolumeSlider', () => ({
  __esModule: true,
  default: 'VolumeSlider',
}));

test('renders volume wrapper and opens track info', () => {
  const onOpenTrackInfo = jest.fn();
  const { getByTestId } = render(
    <NowPlayingBottomControlsRow
      volume={0.5}
      onVolumeChange={jest.fn()}
      bottomInset={0}
      onOpenTrackInfo={onOpenTrackInfo}
      accentColor="#fff"
    />,
  );

  expect(getByTestId('now-playing-volume-wrap')).toBeTruthy();

  fireEvent.press(getByTestId('now-playing-track-info-button'));
  expect(onOpenTrackInfo).toHaveBeenCalledTimes(1);
});

test('uses app theme chrome for track info button', () => {
  const { getByTestId } = render(
    <NowPlayingBottomControlsRow
      volume={0.5}
      onVolumeChange={jest.fn()}
      bottomInset={0}
      onOpenTrackInfo={jest.fn()}
      accentColor="#fff"
    />,
  );

  const styleText = JSON.stringify(getByTestId('now-playing-track-info-button').props.style);
  expect(styleText).toContain(mockAppTheme.palette.surfaceGlass);
  expect(styleText).toContain(mockAppTheme.palette.border);
});
