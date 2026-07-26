import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
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

  test('does not let late hydration overwrite a newer user selection', async () => {
    let resolveAppearance!: (value: 'dark' | 'light') => void;
    mockedStorage.getAppAppearance.mockImplementationOnce(() => new Promise(resolve => {
      resolveAppearance = resolve;
    }));
    const { getByTestId } = renderThemeProvider();

    fireEvent.press(getByTestId('set-light'));
    expect(getByTestId('theme-state').props.children).toBe('light|graphite|graphite-light|loading');

    await act(async () => {
      resolveAppearance('dark');
    });

    await waitFor(() => expect(getByTestId('theme-state').props.children).toBe('light|graphite|graphite-light|hydrated'));
    await waitFor(() => expect(mockedStorage.setAppAppearance).toHaveBeenCalledWith('light'));
  });

  test('does not let late hydration replace the rollback anchor after a successful user write', async () => {
    let resolveHydration!: (value: 'dark' | 'light') => void;
    let rejectSecondWrite!: (error: Error) => void;
    mockedStorage.getAppAppearance.mockImplementationOnce(() => new Promise(resolve => {
      resolveHydration = resolve;
    }));
    mockedStorage.setAppAppearance
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise((_resolve, reject) => {
        rejectSecondWrite = reject;
      }));
    const { getByTestId } = renderThemeProvider();

    fireEvent.press(getByTestId('set-light'));
    await waitFor(() => expect(mockedStorage.setAppAppearance).toHaveBeenNthCalledWith(1, 'light'));
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByTestId('set-dark'));
    await waitFor(() => expect(mockedStorage.setAppAppearance).toHaveBeenNthCalledWith(2, 'dark'));

    await act(async () => {
      resolveHydration('dark');
    });
    await waitFor(() => expect(getByTestId('theme-state').props.children).toBe('dark|graphite|graphite-dark|hydrated'));

    await act(async () => {
      rejectSecondWrite(new Error('second write failed'));
    });
    await waitFor(() => expect(getByTestId('theme-state').props.children).toBe('light|graphite|graphite-light|hydrated'));
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
    await waitFor(() => expect(mockedStorage.setAppAppearance).toHaveBeenNthCalledWith(1, 'light'));

    fireEvent.press(getByTestId('set-dark'));
    expect(getByTestId('theme-state').props.children).toBe('dark|graphite|graphite-dark|hydrated');

    await act(async () => {
      rejectLight(new Error('light write failed'));
    });

    await waitFor(() => expect(mockedStorage.setAppAppearance).toHaveBeenNthCalledWith(2, 'dark'));
    expect(getByTestId('theme-state').props.children).toBe('dark|graphite|graphite-dark|hydrated');
  });

  test('does not roll back a newer identical appearance request when an older one fails', async () => {
    let rejectFirstLight: (error: Error) => void = () => undefined;
    mockedStorage.setAppAppearance
      .mockImplementationOnce(() => new Promise((_resolve, reject) => {
        rejectFirstLight = reject;
      }))
      .mockResolvedValueOnce(undefined);
    const { getByTestId } = renderThemeProvider();

    await waitFor(() => expect(getByTestId('theme-state').props.children).toBe('dark|graphite|graphite-dark|hydrated'));

    fireEvent.press(getByTestId('set-light'));
    await waitFor(() => expect(mockedStorage.setAppAppearance).toHaveBeenNthCalledWith(1, 'light'));
    fireEvent.press(getByTestId('set-light'));
    expect(getByTestId('theme-state').props.children).toBe('light|graphite|graphite-light|hydrated');

    await act(async () => {
      rejectFirstLight(new Error('first light write failed'));
    });

    await waitFor(() => expect(mockedStorage.setAppAppearance).toHaveBeenNthCalledWith(2, 'light'));
    expect(getByTestId('theme-state').props.children).toBe('light|graphite|graphite-light|hydrated');
  });

  test('does not roll back the final skin in an ABA request sequence', async () => {
    let rejectFirstNeon: (error: Error) => void = () => undefined;
    mockedStorage.setAppThemeSkin
      .mockImplementationOnce(() => new Promise((_resolve, reject) => {
        rejectFirstNeon = reject;
      }))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    const { getByTestId } = renderThemeProvider();

    await waitFor(() => expect(getByTestId('theme-state').props.children).toBe('dark|graphite|graphite-dark|hydrated'));

    fireEvent.press(getByTestId('set-neon'));
    await waitFor(() => expect(mockedStorage.setAppThemeSkin).toHaveBeenNthCalledWith(1, 'neon-cover'));
    fireEvent.press(getByTestId('set-graphite'));
    fireEvent.press(getByTestId('set-neon'));
    expect(getByTestId('theme-state').props.children).toBe('dark|neon-cover|neon-cover-dark|hydrated');

    await act(async () => {
      rejectFirstNeon(new Error('first neon write failed'));
    });

    await waitFor(() => expect(mockedStorage.setAppThemeSkin).toHaveBeenNthCalledWith(3, 'neon-cover'));
    expect(getByTestId('theme-state').props.children).toBe('dark|neon-cover|neon-cover-dark|hydrated');
  });
});
