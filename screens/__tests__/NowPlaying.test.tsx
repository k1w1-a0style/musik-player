import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import NowPlaying from '../NowPlaying';

const mockAppThemeContextValue = {
  appearance: 'dark',
  skin: 'graphite',
  isHydrated: true,
  setAppearance: jest.fn(),
  setSkin: jest.fn(),
  theme: {
    id: 'graphite-dark',
    appearance: 'dark',
    skin: 'graphite',
    label: 'Graphite Dark',
    navigationDark: true,
    statusBarStyle: 'light-content',
    palette: {
      background: '#08090B',
      backgroundDeep: '#030406',
      surface: '#111318',
      surfaceElevated: '#191B21',
      surfaceGlass: 'rgba(18, 20, 26, 0.76)',
      card: '#111318',
      cardElevated: '#1A1D24',
      border: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(210, 218, 230, 0.28)',
      primary: '#D8DEE8',
      primaryDark: '#87909E',
      primaryGlow: 'rgba(216, 222, 232, 0.12)',
      accent: '#BFC7D4',
      accentGlow: 'rgba(191, 199, 212, 0.10)',
      success: '#D8DEE8',
      error: '#FF6F8A',
      warning: '#FFCA77',
      text: {
        primary: '#F4F5F7',
        secondary: 'rgba(244, 245, 247, 0.70)',
        muted: 'rgba(244, 245, 247, 0.42)',
        onPrimary: '#07090C',
      },
    },
    gradients: {
      background: ['#030406', '#08090B', '#0D1014'],
      nowPlaying: ['#030406', '#08090B', '#0D1014'],
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => mockAppThemeContextValue,
  useOptionalAppTheme: () => mockAppThemeContextValue,
}));

const FAVORITE_ADD_LABEL = 'Titel favorisieren';
const FAVORITE_REMOVE_LABEL = 'Titel ist Favorit — tippen zum Entfernen';
const CLOSE_NOW_PLAYING_LABEL = 'Wiedergabe schließen';
const OPEN_NOW_PLAYING_MENU_LABEL = 'Wiedergabe-Menü öffnen';
const OPEN_TRACK_INFO_LABEL = 'Titelinformationen öffnen';
const SAVE_QUEUE_LABEL = 'Warteschlange speichern';
const OPEN_EQUALIZER_LABEL = 'Equalizer öffnen';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const pendingFavoriteLookup = () => new Promise<boolean>(() => undefined);
const mockIsFavoriteSongId = jest.fn<Promise<boolean>, [string]>(pendingFavoriteLookup);
const mockSetFavoriteSongId = jest.fn<Promise<string[]>, [string, boolean]>(() => Promise.resolve([]));
const mockSaveQueueAsPlaylist = jest.fn(() => ({ id: 'pl-1', name: 'Gespeicherte Warteschlange', songIds: ['s1'], createdAt: 1 }));
let mockNowPlayingStateCrash = false;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
}));

jest.mock('../../utils/storage', () => ({
  isFavoriteSongId: (songId: string) => mockIsFavoriteSongId(songId),
  normalizeStorageSongId: (songId?: string) => {
    const trimmed = songId?.trim();
    return trimmed || undefined;
  },
  setFavoriteSongId: (songId: string, favorite: boolean) => mockSetFavoriteSongId(songId, favorite),
}));

jest.mock('../../hooks/useNowPlayingControlsMode', () => ({
  useNowPlayingControlsMode: () => ({
    mode: 'buttons',
    isHydrated: true,
    setMode: jest.fn(),
  }),
}));

const mockNowPlayingContext = {
  playbackQueue: [{ id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' }],
  currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' },
  seekTo: jest.fn(async () => undefined),
  isPlaying: false,
  togglePlayPause: jest.fn(async () => undefined),
  sleepTimerActive: false,
  startSleepTimer: jest.fn(),
  cancelSleepTimer: jest.fn(),
  volume: 1,
  setVolume: jest.fn(async () => undefined),
  palette: null,
  playSong: jest.fn(async () => undefined),
  next: jest.fn(async () => undefined),
  previous: jest.fn(async () => undefined),
  saveQueueAsPlaylist: mockSaveQueueAsPlaylist,
};

const setCurrentSongId = (id: string) => {
  mockNowPlayingContext.currentSong = {
    ...mockNowPlayingContext.currentSong,
    id,
  };
};

jest.mock('../../contexts/MusicContext', () => ({
  useNowPlayingMusicContext: () => {
    if (mockNowPlayingStateCrash) throw new Error('now playing screen state crash');

    return mockNowPlayingContext;
  },
}));

jest.mock('../../contexts/PlaybackProgressContext', () => ({
  usePlaybackProgress: () => ({ position: 0, duration: 100 }),
}));

jest.mock('../../hooks/useSongWaveform', () => ({
  useSongWaveform: () => ({
    waveform: {
      source: 'fallback',
      sourceKey: 'test-waveform',
      durationMs: 100,
      points: [0.1, 0.4, 0.8],
    },
    sourceKey: 'test-waveform',
    loadingNative: false,
  }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));
jest.mock('../../components/Controls', () => () => null);
jest.mock('../../components/ProgressBar', () => () => null);
jest.mock('../../components/WaveformScrubber', () => () => null);
jest.mock('../../components/VolumeSlider', () => () => null);
jest.mock('../../components/GlassCard', () => ({ children }: { children?: React.ReactNode }) => <>{children}</>);
jest.mock('../../components/Screen', () => ({ children }: { children?: React.ReactNode }) => <>{children}</>);

describe('NowPlaying cover fallback', () => {
  beforeEach(() => {
    mockNowPlayingStateCrash = false;
    setCurrentSongId('s1');
    mockGoBack.mockClear();
    mockNavigate.mockClear();
    mockSaveQueueAsPlaylist.mockClear();
    mockIsFavoriteSongId.mockClear();
    mockSetFavoriteSongId.mockClear();
    mockNowPlayingContext.next.mockClear();
    mockNowPlayingContext.previous.mockClear();
    mockNowPlayingContext.togglePlayPause.mockClear();
    mockNowPlayingContext.startSleepTimer.mockClear();
    mockNowPlayingContext.cancelSleepTimer.mockClear();
    mockNowPlayingContext.isPlaying = false;
    mockNowPlayingContext.sleepTimerActive = false;
    mockIsFavoriteSongId.mockImplementation(pendingFavoriteLookup);
  });

  test('renders the screen fallback when the inner screen-state component throws', () => {
    mockNowPlayingStateCrash = true;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const view = render(<NowPlaying />);

    expect(view.getByTestId('now-playing-error-boundary-fallback')).toBeTruthy();
    expect(view.getByText('Bereich konnte nicht geladen werden.')).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[NowPlaying] ErrorBoundary caught an error',
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );

    consoleErrorSpy.mockRestore();
    view.unmount();
  });

  test('renders split snap panels and blurred cover backdrop for phase 5', () => {
    const { getByTestId } = render(<NowPlaying />);
    expect(getByTestId('now-playing-snap-pager')).toBeTruthy();
    expect(getByTestId('now-playing-player-panel')).toBeTruthy();
    expect(getByTestId('now-playing-details-panel')).toBeTruthy();
    expect(getByTestId('now-playing-cover-backdrop')).toBeTruthy();
  });

  test('hides broken primary cover image after error while keeping the backdrop separate', () => {
    const { getByTestId, queryByTestId } = render(<NowPlaying />);
    fireEvent(getByTestId('now-playing-cover-image'), 'error');
    expect(queryByTestId('now-playing-cover-image')).toBeNull();
    expect(getByTestId('now-playing-cover-fallback')).toBeTruthy();
    expect(getByTestId('now-playing-cover-backdrop')).toBeTruthy();
  });

  test('favorite button shows correct label and checked state when track is already a favorite', async () => {
    mockIsFavoriteSongId.mockResolvedValue(true);
    const { getByLabelText } = render(<NowPlaying />);

    await waitFor(() => {
      const favoriteButton = getByLabelText(FAVORITE_REMOVE_LABEL);
      expect(favoriteButton).toBeTruthy();
      expect(favoriteButton.props.accessibilityState?.checked).toBe(true);
    });
  });

  test('favorite icon persists an actionable favorite state', async () => {
    mockIsFavoriteSongId.mockResolvedValue(false);
    const { getByLabelText } = render(<NowPlaying />);
    await waitFor(() => expect(mockIsFavoriteSongId).toHaveBeenCalledWith('s1'));

    const addButton = getByLabelText(FAVORITE_ADD_LABEL);
    expect(addButton.props.accessibilityState?.checked).toBe(false);

    fireEvent.press(addButton);

    expect(mockSetFavoriteSongId).toHaveBeenCalledWith('s1', true);
    await waitFor(() => {
      const removeButton = getByLabelText(FAVORITE_REMOVE_LABEL);
      expect(removeButton.props.accessibilityState?.disabled).toBe(false);
      expect(removeButton.props.accessibilityState?.checked).toBe(true);
    });
  });

  test('favorite icon normalizes current song id before lookup and persistence', async () => {
    setCurrentSongId(' s1 ');
    mockIsFavoriteSongId.mockResolvedValue(false);
    const { getByLabelText } = render(<NowPlaying />);

    await waitFor(() => expect(mockIsFavoriteSongId).toHaveBeenCalledWith('s1'));
    fireEvent.press(getByLabelText(FAVORITE_ADD_LABEL));

    expect(mockSetFavoriteSongId).toHaveBeenCalledWith('s1', true);
    await waitFor(() => {
      const removeButton = getByLabelText(FAVORITE_REMOVE_LABEL);
      expect(removeButton.props.accessibilityState?.disabled).toBe(false);
      expect(removeButton.props.accessibilityState?.checked).toBe(true);
    });
  });

  test('favorite icon ignores blank current song ids', async () => {
    setCurrentSongId('   ');
    const { getByLabelText } = render(<NowPlaying />);

    fireEvent.press(getByLabelText(FAVORITE_ADD_LABEL));

    expect(mockIsFavoriteSongId).not.toHaveBeenCalled();
    expect(mockSetFavoriteSongId).not.toHaveBeenCalled();
  });

  test('favorite icon ignores stale storage reads after optimistic toggle', async () => {
    let resolveFavoriteLookup: (value: boolean) => void = () => undefined;
    mockIsFavoriteSongId.mockImplementationOnce(
      () => new Promise<boolean>(resolve => {
        resolveFavoriteLookup = resolve;
      }),
    );
    mockSetFavoriteSongId.mockResolvedValue(['s1']);
    const { getByLabelText } = render(<NowPlaying />);
    await waitFor(() => expect(mockIsFavoriteSongId).toHaveBeenCalledWith('s1'));

    fireEvent.press(getByLabelText(FAVORITE_ADD_LABEL));
    expect(mockSetFavoriteSongId).toHaveBeenCalledWith('s1', true);
    await waitFor(() => {
      const removeButton = getByLabelText(FAVORITE_REMOVE_LABEL);
      expect(removeButton.props.accessibilityState?.disabled).toBe(false);
      expect(removeButton.props.accessibilityState?.checked).toBe(true);
    });

    await act(async () => {
      resolveFavoriteLookup(false);
    });

    const staleProtectedButton = getByLabelText(FAVORITE_REMOVE_LABEL);
    expect(staleProtectedButton.props.accessibilityState?.disabled).toBe(false);
    expect(staleProtectedButton.props.accessibilityState?.checked).toBe(true);
    fireEvent.press(staleProtectedButton);
    expect(mockSetFavoriteSongId).toHaveBeenLastCalledWith('s1', false);
    await waitFor(() => {
      const addButton = getByLabelText(FAVORITE_ADD_LABEL);
      expect(addButton.props.accessibilityState?.disabled).toBe(false);
      expect(addButton.props.accessibilityState?.checked).toBe(false);
    });
  });

  test('favorite icon rolls back when persistence fails', async () => {
    mockIsFavoriteSongId.mockResolvedValue(false);
    mockSetFavoriteSongId.mockRejectedValueOnce(new Error('storage full'));
    const { getByLabelText, UNSAFE_getByProps } = render(<NowPlaying />);
    await waitFor(() => expect(mockIsFavoriteSongId).toHaveBeenCalledWith('s1'));

    fireEvent.press(getByLabelText(FAVORITE_ADD_LABEL));

    expect(mockSetFavoriteSongId).toHaveBeenCalledWith('s1', true);
    await waitFor(() => {
      const addButton = getByLabelText(FAVORITE_ADD_LABEL);
      expect(addButton.props.accessibilityState?.disabled).toBe(false);
      expect(addButton.props.accessibilityState?.checked).toBe(false);
    });
    const unsafeFavoriteButton = UNSAFE_getByProps({ accessibilityLabel: FAVORITE_ADD_LABEL });
    expect(unsafeFavoriteButton.props.accessibilityState?.disabled).toBe(false);
    expect(unsafeFavoriteButton.props.accessibilityState?.checked).toBe(false);
  });

  test('close button remains interactive and triggers goBack', () => {
    const { getByTestId, getByLabelText } = render(<NowPlaying />);
    expect(getByLabelText(CLOSE_NOW_PLAYING_LABEL)).toBeTruthy();
    fireEvent.press(getByTestId('now-playing-close'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('more menu is interactive and opens actions', () => {
    const { getByLabelText, getByText } = render(<NowPlaying />);
    fireEvent.press(getByLabelText(OPEN_NOW_PLAYING_MENU_LABEL));
    expect(getByText(OPEN_TRACK_INFO_LABEL)).toBeTruthy();
    expect(getByText(OPEN_EQUALIZER_LABEL)).toBeTruthy();
    expect(getByText(SAVE_QUEUE_LABEL)).toBeTruthy();
  });

  test('equalizer menu item opens the equalizer screen', () => {
    const { getByLabelText, getByText } = render(<NowPlaying />);
    fireEvent.press(getByLabelText(OPEN_NOW_PLAYING_MENU_LABEL));
    fireEvent.press(getByText(OPEN_EQUALIZER_LABEL));

    expect(mockNavigate).toHaveBeenCalledWith('Equalizer');
  });


  test('sleep timer menu item starts the provider-owned timer and closes the menu', () => {
    const { getByLabelText, getByText, queryByText } = render(<NowPlaying />);

    fireEvent.press(getByLabelText(OPEN_NOW_PLAYING_MENU_LABEL));
    fireEvent.press(getByText('Sleep-Timer: 15 Minuten'));

    expect(mockNowPlayingContext.startSleepTimer).toHaveBeenCalledWith(15);
    expect(queryByText('Sleep-Timer: 15 Minuten')).toBeNull();
  });

  test('active sleep timer can be cancelled from the menu', () => {
    mockNowPlayingContext.sleepTimerActive = true;
    const { getByLabelText, getByText, queryByText } = render(<NowPlaying />);

    fireEvent.press(getByLabelText(OPEN_NOW_PLAYING_MENU_LABEL));
    fireEvent.press(getByText('Sleep-Timer abbrechen'));

    expect(mockNowPlayingContext.cancelSleepTimer).toHaveBeenCalledTimes(1);
    expect(queryByText('Sleep-Timer abbrechen')).toBeNull();
  });

  test('queue save menu item saves the current queue as playlist', () => {
    const { getByLabelText, getByText } = render(<NowPlaying />);
    fireEvent.press(getByLabelText(OPEN_NOW_PLAYING_MENU_LABEL));
    fireEvent.press(getByText(SAVE_QUEUE_LABEL));

    expect(mockSaveQueueAsPlaylist).toHaveBeenCalledWith(
      expect.stringMatching(/^Gespeicherte Warteschlange — .+/),
      mockNowPlayingContext.playbackQueue,
    );
  });
});
