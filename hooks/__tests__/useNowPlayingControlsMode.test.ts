import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetRememberedNowPlayingControlsModeForTests,
  useNowPlayingControlsMode } from '../useNowPlayingControlsMode';

const storageKey = '@musikplayer:nowPlayingPlayerLayout';
const previousStorageKey = '@musikplayer:nowPlayingControlsMode';

describe('useNowPlayingControlsMode', () => {
  beforeEach(() => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    resetRememberedNowPlayingControlsModeForTests();
    jest.restoreAllMocks();
  });

  test('hydrates the default layout when nothing is stored', async () => {
    const { result } = renderHook(() => useNowPlayingControlsMode());

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(result.current.mode).toBe('classic');
  });

  test('hydrates a stored player layout', async () => {
    await AsyncStorage.setItem(storageKey, JSON.stringify('soundcloud'));

    const { result } = renderHook(() => useNowPlayingControlsMode());

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(result.current.mode).toBe('soundcloud');
  });

  test('migrates the old cover swipe mode to the SoundCloud layout', async () => {
    await AsyncStorage.setItem(previousStorageKey, JSON.stringify('coverSwipe'));

    const { result } = renderHook(() => useNowPlayingControlsMode());

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(result.current.mode).toBe('soundcloud');
  });

  test('falls back to classic for invalid stored values', async () => {
    await AsyncStorage.setItem(storageKey, JSON.stringify('sideways-toaster'));

    const { result } = renderHook(() => useNowPlayingControlsMode());

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(result.current.mode).toBe('classic');
  });

  test('updates and persists the selected layout', async () => {
    const { result } = renderHook(() => useNowPlayingControlsMode());

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    act(() => {
      result.current.setMode('soundcloud');
    });

    expect(result.current.mode).toBe('soundcloud');
    await waitFor(async () => {
      await expect(AsyncStorage.getItem(storageKey)).resolves.toBe(JSON.stringify('soundcloud'));
    });
  });

  test('reuses the hydrated layout synchronously for the next screen mount', async () => {
    await AsyncStorage.setItem(storageKey, JSON.stringify('soundcloud'));
    const first = renderHook(() => useNowPlayingControlsMode());
    await waitFor(() => expect(first.result.current.isHydrated).toBe(true));
    await waitFor(() => expect(first.result.current.mode).toBe('soundcloud'));
    first.unmount();

    const second = renderHook(() => useNowPlayingControlsMode());

    expect(second.result.current).toMatchObject({ mode: 'soundcloud', isHydrated: true });
    second.unmount();
  });
});
