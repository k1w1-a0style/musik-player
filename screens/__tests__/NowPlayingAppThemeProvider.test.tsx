import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AppThemeProvider } from '../../contexts/AppThemeContext';
import { getAppTheme } from '../../utils/appTheme';
import NowPlayingHeader from '../NowPlayingHeader';

jest.mock('../../utils/storage', () => ({
  storage: {
    get: jest.fn(() => Promise.resolve(null)),
    getAppAppearance: jest.fn(() => Promise.resolve('light')),
    getAppThemeSkin: jest.fn(() => Promise.resolve('graphite')),
    setAppAppearance: jest.fn(() => Promise.resolve(true)),
    setAppThemeSkin: jest.fn(() => Promise.resolve(true)),
  },
}));

test('NowPlaying subcomponent renders with AppThemeProvider and applies hydrated light theme text colors', async () => {
  const { getByText } = render(
    <AppThemeProvider>
      <NowPlayingHeader albumTitle="Provider Album" onClose={jest.fn()} onMore={jest.fn()} />
    </AppThemeProvider>,
  );

  expect(getByText('Album: Provider Album')).toBeTruthy();

  await waitFor(() => {
    expect(JSON.stringify(getByText('Album: Provider Album').props.style)).toContain(
      getAppTheme('light', 'graphite').palette.text.primary,
    );
  });
});
