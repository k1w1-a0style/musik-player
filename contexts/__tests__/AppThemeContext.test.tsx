import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { AppThemeProvider, useAppTheme, useOptionalAppTheme } from '../AppThemeContext';
import { storage } from '../../utils/storage';

jest.mock('../../utils/storage', () => ({
  storage: {
    getAppAppearance: jest.fn().mockResolvedValue('dark'),
    getAppThemeSkin: jest.fn().mockResolvedValue('graphite'),
    setAppAppearance: jest.fn().mockResolvedValue(undefined),
    setAppThemeSkin: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockedStorage = storage as unknown as jest.Mocked<Pick<
  typeof storage,
  'getAppAppearance' | 'getAppThemeSkin' | 'setAppAppearance' | 'setAppThemeSkin'
>>;

const ThemeProbe = () => {
  const { appearance, skin, theme, isHydrated, setAppearance, setSkin } = useAppTheme();

  return (
    <>
      <Text testID="theme-state">{`${appearance}|${skin}|${theme.id}|${isHydrated ? 'hydrated' : 'loading'}`}</Text>
      <Pressable testID="set-light" onPress={() => setAppearance('light')} />
      <Pressable testID="set-neon" onPress={() => setSkin('neon-cover')} />
    </>
  );
};

const renderThemeProvider = () => render(
  <AppThemeProvider>
    <ThemeProbe />
  </AppThemeProvider>,
);

describe('AppThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStorage.getAppAppearance.mockResolvedValue('dark');
    mockedStorage.getAppThemeSkin.mockResolvedValue('graphite');
    mockedStorage.setAppAppearance.mockResolvedValue(undefined);
    mockedStorage.setAppThemeSkin.mockResolvedValue(undefined);
  });

  test('returns null from the optional hook outside the provider', () => {
    const { result } = renderHook(() => useOptionalAppTheme());

    expect(result.current).toBeNull();
  });

  test('hydrates stored appearance and skin values on mount', async () => {
    mockedStorage.getAppAppearance.mockResolvedValue('light');
    mockedStorage.getAppThemeSkin.mockResolvedValue('minimal');

    const { getByTestId } = renderThemeProvider();

    await waitFor(() => expect(getByTestId('theme-state').props.children).toBe('light|minimal|minimal-light|hydrated'));
    expect(mockedStorage.getAppAppearance).toHaveBeenCalledTimes(1);
    expect(mockedStorage.getAppThemeSkin).toHaveBeenCalledTimes(1);
  });

  test('falls back to default theme values when storage hydration fails', async () => {
    mockedStorage.getAppAppearance.mockRejectedValue(new Error('appearance failed'));
    mockedStorage.getAppThemeSkin.mockRejectedValue(new Error('skin failed'));

    const { getByTestId } = renderThemeProvider();

    await waitFor(() => expect(getByTestId('theme-state').props.children).toBe('dark|graphite|graphite-dark|hydrated'));
  });

  test('updates and persists appearance and skin changes', async () => {
    const { getByTestId } = renderThemeProvider();

    await waitFor(() => expect(getByTestId('theme-state').props.children).toBe('dark|graphite|graphite-dark|hydrated'));

    fireEvent.press(getByTestId('set-light'));
    expect(getByTestId('theme-state').props.children).toBe('light|graphite|graphite-light|hydrated');
    expect(mockedStorage.setAppAppearance).toHaveBeenCalledWith('light');

    fireEvent.press(getByTestId('set-neon'));
    expect(getByTestId('theme-state').props.children).toBe('light|neon-cover|neon-cover-light|hydrated');
    expect(mockedStorage.setAppThemeSkin).toHaveBeenCalledWith('neon-cover');
  });
});
