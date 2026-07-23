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
      <Pressable testID="set-dark" onPress={() => setAppearance('dark')} />
      <Pressable testID="set-neon" onPress={() => setSkin('neon-cover')} />
      <Pressable testID="set-graphite" onPress={() => setSkin('graphite')} />
    </>
  );
};

const renderThemeProvider = () => render(
  <AppThemeProvider>
    <ThemeProbe />
  </AppThemeProvider>,
);

describe('AppThemeContext', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockedStorage.getAppAppearance.mockResolvedValue('dark');
    mockedStorage.getAppThemeSkin.mockResolvedValue('graphite');
    mockedStorage.setAppAppearance.mockResolvedValue(undefined);
    mockedStorage.setAppThemeSkin.mockResolvedValue(undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
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
    await waitFor(() => expect(mockedStorage.setAppAppearance).toHaveBeenCalledWith('light'));

    fireEvent.press(getByTestId('set-neon'));
    expect(getByTestId('theme-state').props.children).toBe('light|neon-cover|neon-cover-light|hydrated');
    await waitFor(() => expect(mockedStorage.setAppThemeSkin).toHaveBeenCalledWith('neon-cover'));
  });

  test('rolls appearance and skin back when persistence fails', async () => {
    mockedStorage.setAppAppearance.mockRejectedValueOnce(new Error('appearance write failed'));
    mockedStorage.setAppThemeSkin.mockRejectedValueOnce(new Error('skin write failed'));
    const { getByTestId } = renderThemeProvider();

    await waitFor(() => expect(getByTestId('theme-state').props.children).toBe('dark|graphite|graphite-dark|hydrated'));

    fireEvent.press(getByTestId('set-light'));
    expect(getByTestId('theme-state').props.children).toBe('light|graphite|graphite-light|hydrated');
    await waitFor(() => expect(getByTestId('theme-state').props.children).toBe('dark|graphite|graphite-dark|hydrated'));

    fireEvent.press(getByTestId('set-neon'));
    expect(getByTestId('theme-state').props.children).toBe('dark|neon-cover|neon-cover-dark|hydrated');
    await waitFor(() => expect(getByTestId('theme-state').props.children).toBe('dark|graphite|graphite-dark|hydrated'));

    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  test('serializes rapid writes and keeps the last successfully persisted value', async () => {
    let rejectLight: (error: Error) => void = () => undefined;
    mockedStorage.setAppAppearance
      .mockImplementationOnce(() => new Promise((_resolve, reject) => {
        rejectLight = reject;
      }))
      .mockResolvedValueOnce(undefined);
    const { getByTestId } = renderThemeProvider();

    await waitFor(() => expect(getByTestId('theme-state').props.children).toBe('dark|graphite|graphite-dark|hydrated'));

    fireEvent.press(getByTestId('set-light'));
    fireEvent.press(getByTestId('set-dark'));
    expect(getByTestId('theme-state').props.children).toBe('dark|graphite|graphite-dark|hydrated');

    rejectLight(new Error('light write failed'));

    await waitFor(() => expect(mockedStorage.setAppAppearance).toHaveBeenNthCalledWith(2, 'dark'));
    expect(getByTestId('theme-state').props.children).toBe('dark|graphite|graphite-dark|hydrated');
  });
});
