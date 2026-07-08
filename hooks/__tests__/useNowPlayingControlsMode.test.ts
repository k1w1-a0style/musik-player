import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNowPlayingControlsMode } from '../useNowPlayingControlsMode';

const storageKey = '@musikplayer:nowPlayingControlsMode';

describe('useNowPlayingControlsMode', () => {
  beforeEach(() => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    jest.restoreAllMocks();
  });

  test('hydrates the default mode when nothing is stored', async () => {
    const { result } = renderHook(() => useNowPlayingControlsMode());

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(result.current.mode).toBe('buttons');
  });

  test('hydrates a stored mode', async () => {
    await AsyncStorage.setItem(storageKey, JSON.stringify('coverSwipe'));

    const { result } = renderHook(() => useNowPlayingControlsMode());

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(result.current.mode).toBe('coverSwipe');
  });

  test('falls back to buttons for invalid stored values', async () => {
    await AsyncStorage.setItem(storageKey, JSON.stringify('sideways-toaster'));

    const { result } = renderHook(() => useNowPlayingControlsMode());

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(result.current.mode).toBe('buttons');
  });

  test('updates and persists the selected mode', async () => {
    const { result } = renderHook(() => useNowPlayingControlsMode());

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    act(() => {
      result.current.setMode('coverSwipe');
    });

    expect(result.current.mode).toBe('coverSwipe');
    await waitFor(async () => {
      await expect(AsyncStorage.getItem(storageKey)).resolves.toBe(JSON.stringify('coverSwipe'));
    });
  });
});
