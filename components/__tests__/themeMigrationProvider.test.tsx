import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AppThemeProvider } from '../../contexts/AppThemeContext';
import LibrarySearchBar from '../LibrarySearchBar';
import { getAppTheme, type AppAppearance } from '../../utils/appTheme';
import { storage } from '../../utils/storage';

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

const renderWithStoredAppearance = async (appearance: AppAppearance, ui: React.ReactElement) => {
  await storage.setAppAppearance(appearance);
  await storage.setAppThemeSkin('graphite');
  const result = render(<AppThemeProvider>{ui}</AppThemeProvider>);
  const theme = getAppTheme(appearance, 'graphite');
  return { ...result, theme };
};

describe('library and playback app theme migration', () => {
  test('renders a Library component inside AppThemeProvider with dynamic light colors', async () => {
    const { getByTestId, theme } = await renderWithStoredAppearance(
      'light',
      <LibrarySearchBar value="" onChangeText={jest.fn()} />,
    );

    await waitFor(() => {
      expect(JSON.stringify(getByTestId('library-search-bar').props.style)).toContain(theme.palette.surfaceGlass);
    });
    expect(getByTestId('library-search-input').props.placeholderTextColor).toBe(theme.palette.text.muted);
    expect(JSON.stringify(getByTestId('library-search-input').props.style)).toContain(theme.palette.text.primary);
  });


  test('light and dark provider appearances do not reuse the same hard-coded Library surface', async () => {
    const lightRender = await renderWithStoredAppearance(
      'light',
      <LibrarySearchBar value="" onChangeText={jest.fn()} />,
    );
    await waitFor(() => {
      expect(JSON.stringify(lightRender.getByTestId('library-search-bar').props.style)).toContain(lightRender.theme.palette.surfaceGlass);
    });
    const lightStyle = JSON.stringify(lightRender.getByTestId('library-search-bar').props.style);
    lightRender.unmount();

    const darkRender = await renderWithStoredAppearance(
      'dark',
      <LibrarySearchBar value="" onChangeText={jest.fn()} />,
    );
    await waitFor(() => {
      expect(JSON.stringify(darkRender.getByTestId('library-search-bar').props.style)).toContain(darkRender.theme.palette.surfaceGlass);
    });
    const darkStyle = JSON.stringify(darkRender.getByTestId('library-search-bar').props.style);

    expect(lightStyle).toContain(getAppTheme('light', 'graphite').palette.surfaceGlass);
    expect(darkStyle).toContain(getAppTheme('dark', 'graphite').palette.surfaceGlass);
    expect(lightStyle).not.toBe(darkStyle);
  });
});
