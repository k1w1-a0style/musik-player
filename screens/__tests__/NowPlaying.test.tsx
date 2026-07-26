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
    mode: 'classic',
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
  sleepTimerRemainingSeconds: null as number | null,
  startSleepTimer: jest.fn(),
  cancelSleepTimer: jest.fn(),
  volume: 1,
  setVolume: jest.fn(async () => undefined),
  palette: null,
  playSong: jest.fn(async () => undefined),
  next: jest.fn(async () => undefined),
  previous: jest.fn(async () => undefined),
  saveQueueAsPlaylist: mockSaveQueueAsPlaylist,
  repeatMode: 'off',
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
    mockNowPlayingContext.sleepTimerRemainingSeconds = null;
    mockIsFavoriteSongId.mockImplementation(pendingFavoriteLookup);
  });

  test('renders the screen fallback when the inner screen-state component throws', () => {
    mockNowPlayingStateCrash = true;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { getByTestId } = render(<NowPlaying />);

    expect(getByTestId('now-playing-error-boundary-fallback')).toBeTruthy();
    consoleErrorSpy.mockRestore();
  });

  test('renders the cover fallback when artwork loading fails', () => {
    const { getByTestId } = render(<NowPlaying />);

    fireEvent(getByTestId('now-playing-cover-image'), 'error');

    expect(getByTestId('now-playing-cover-fallback')).toBeTruthy();
  });

  test('navigates to track info from the title row info button', () => {
    const { getByLabelText } = render(<NowPlaying />);

    fireEvent.press(getByLabelText(OPEN_TRACK_INFO_LABEL));

    expect(mockNavigate).toHaveBeenCalledWith('TrackInfo', { songId: 's1' });
  });

  test('opens and closes the now playing menu', async () => {
    const { getByLabelText, queryByText } = render(<NowPlaying />);

    fireEvent.press(getByLabelText(OPEN_NOW_PLAYING_MENU_LABEL));
    await waitFor(() => expect(queryByText('Equalizer öffnen')).toBeTruthy());

    fireEvent.press(getByLabelText('Menü schließen'));
    await waitFor(() => expect(queryByText('Equalizer öffnen')).toBeNull());
  });

  test('navigates to equalizer from the now playing menu', async () => {
    const { getByLabelText, getByText } = render(<NowPlaying />);

    fireEvent.press(getByLabelText(OPEN_NOW_PLAYING_MENU_LABEL));
    await waitFor(() => expect(getByText(OPEN_EQUALIZER_LABEL)).toBeTruthy());
    fireEvent.press(getByText(OPEN_EQUALIZER_LABEL));

    expect(mockNavigate).toHaveBeenCalledWith('Equalizer');
  });

  test('saves the queue from the now playing menu', async () => {
    const { getByLabelText, getByText } = render(<NowPlaying />);

    fireEvent.press(getByLabelText(OPEN_NOW_PLAYING_MENU_LABEL));
    await waitFor(() => expect(getByText(SAVE_QUEUE_LABEL)).toBeTruthy());
    fireEvent.press(getByText(SAVE_QUEUE_LABEL));

    expect(mockSaveQueueAsPlaylist).toHaveBeenCalledTimes(1);
  });

  test('shows sleep timer start and cancel entries', async () => {
    const { getByLabelText, getByText, getByTestId, rerender } = render(<NowPlaying />);

    fireEvent.press(getByLabelText(OPEN_NOW_PLAYING_MENU_LABEL));
    await waitFor(() => expect(getByText('Sleep-Timer: 1 Minute')).toBeTruthy());
    fireEvent.press(getByText('Sleep-Timer: 1 Minute'));
    expect(mockNowPlayingContext.startSleepTimer).toHaveBeenCalledWith(1);

    mockNowPlayingContext.sleepTimerActive = true;
    mockNowPlayingContext.sleepTimerRemainingSeconds = 14 * 60 + 59;
    rerender(<NowPlaying />);
    fireEvent.press(getByTestId('now-playing-more'));
    await waitFor(() => expect(getByText('Sleep-Timer aktiv · 14:59')).toBeTruthy());
    expect(getByText('JETZT LÄUFT · TIMER 14:59')).toBeTruthy();
    expect(getByText('Sleep-Timer abbrechen')).toBeTruthy();
    fireEvent.press(getByText('Sleep-Timer abbrechen'));
    expect(mockNowPlayingContext.cancelSleepTimer).toHaveBeenCalledTimes(1);
  });

  test('toggles favorite state from the title row', async () => {
    mockIsFavoriteSongId.mockResolvedValueOnce(false);
    const { getByLabelText, rerender } = render(<NowPlaying />);

    await waitFor(() => expect(getByLabelText(FAVORITE_ADD_LABEL)).toBeTruthy());
    fireEvent.press(getByLabelText(FAVORITE_ADD_LABEL));
    await waitFor(() => expect(mockSetFavoriteSongId).toHaveBeenCalledWith('s1', true));

    mockIsFavoriteSongId.mockResolvedValueOnce(true);
    rerender(<NowPlaying />);
    await waitFor(() => expect(getByLabelText(FAVORITE_REMOVE_LABEL)).toBeTruthy());
    fireEvent.press(getByLabelText(FAVORITE_REMOVE_LABEL));
    await waitFor(() => expect(mockSetFavoriteSongId).toHaveBeenCalledWith('s1', false));
  });

  test('resets favorite state when the current song changes', async () => {
    mockIsFavoriteSongId.mockResolvedValueOnce(true);
    const { getByLabelText, rerender } = render(<NowPlaying />);
    await waitFor(() => expect(getByLabelText(FAVORITE_REMOVE_LABEL)).toBeTruthy());

    mockIsFavoriteSongId.mockResolvedValueOnce(false);
    setCurrentSongId('s2');
    rerender(<NowPlaying />);

    await waitFor(() => expect(getByLabelText(FAVORITE_ADD_LABEL)).toBeTruthy());
  });

  test('closes the now playing screen from the header', () => {
    const { getByLabelText } = render(<NowPlaying />);

    fireEvent.press(getByLabelText(CLOSE_NOW_PLAYING_LABEL));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
