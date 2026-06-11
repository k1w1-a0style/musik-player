import React from 'react';
import { Image } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import NowPlaying from '../NowPlaying';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const pendingFavoriteLookup = () => new Promise<boolean>(() => undefined);
const mockIsFavoriteSongId = jest.fn<Promise<boolean>, [string]>(pendingFavoriteLookup);
const mockSetFavoriteSongId = jest.fn<Promise<string[]>, [string, boolean]>(() => Promise.resolve([]));
const mockSaveQueueAsPlaylist = jest.fn(() => ({ id: 'pl-1', name: 'Gespeicherte Queue', songIds: ['s1'], createdAt: 1 }));
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

const mockNowPlayingContext = {
  playbackQueue: [{ id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' }],
  currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' },
  seekTo: jest.fn(async () => undefined),
  isPlaying: false,
  volume: 1,
  setVolume: jest.fn(async () => undefined),
  palette: null,
  playSong: jest.fn(async () => undefined),
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
jest.mock('../../components/ModernControls', () => () => null);
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

  test('hides broken cover image after error', () => {
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(<NowPlaying />);
    const img = UNSAFE_getByType(Image);
    fireEvent(img, 'error');
    expect(UNSAFE_queryByType(Image)).toBeNull();
  });

  test('favorite icon persists an actionable favorite state', async () => {
    mockIsFavoriteSongId.mockResolvedValue(false);
    const { getByLabelText } = render(<NowPlaying />);
    await waitFor(() => expect(mockIsFavoriteSongId).toHaveBeenCalledWith('s1'));

    fireEvent.press(getByLabelText('Track favorisieren'));

    expect(mockSetFavoriteSongId).toHaveBeenCalledWith('s1', true);
    await waitFor(() =>
      expect(getByLabelText('Track favorisieren').props.accessibilityState?.disabled).toBe(false),
    );
  });

  test('favorite icon normalizes current song id before lookup and persistence', async () => {
    setCurrentSongId(' s1 ');
    mockIsFavoriteSongId.mockResolvedValue(false);
    const { getByLabelText } = render(<NowPlaying />);

    await waitFor(() => expect(mockIsFavoriteSongId).toHaveBeenCalledWith('s1'));
    fireEvent.press(getByLabelText('Track favorisieren'));

    expect(mockSetFavoriteSongId).toHaveBeenCalledWith('s1', true);
  });

  test('favorite icon ignores blank current song ids', async () => {
    setCurrentSongId('   ');
    const { getByLabelText } = render(<NowPlaying />);

    fireEvent.press(getByLabelText('Track favorisieren'));

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

    fireEvent.press(getByLabelText('Track favorisieren'));
    expect(mockSetFavoriteSongId).toHaveBeenCalledWith('s1', true);
    await waitFor(() =>
      expect(getByLabelText('Track favorisieren').props.accessibilityState?.disabled).toBe(false),
    );

    await act(async () => {
      resolveFavoriteLookup(false);
    });

    expect(getByLabelText('Track favorisieren').props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(getByLabelText('Track favorisieren'));
    expect(mockSetFavoriteSongId).toHaveBeenLastCalledWith('s1', false);
    await waitFor(() =>
      expect(getByLabelText('Track favorisieren').props.accessibilityState?.disabled).toBe(false),
    );
  });

  test('favorite icon rolls back when persistence fails', async () => {
    mockIsFavoriteSongId.mockResolvedValue(false);
    mockSetFavoriteSongId.mockRejectedValueOnce(new Error('storage full'));
    const { getByLabelText, UNSAFE_getByProps } = render(<NowPlaying />);
    await waitFor(() => expect(mockIsFavoriteSongId).toHaveBeenCalledWith('s1'));

    fireEvent.press(getByLabelText('Track favorisieren'));

    expect(mockSetFavoriteSongId).toHaveBeenCalledWith('s1', true);
    await waitFor(() =>
      expect(getByLabelText('Track favorisieren').props.accessibilityState?.disabled).toBe(false),
    );
    expect(UNSAFE_getByProps({ accessibilityLabel: 'Track favorisieren' }).props.accessibilityState?.disabled).toBe(false);
  });

  test('close button remains interactive and triggers goBack', () => {
    const { getByTestId, getByLabelText } = render(<NowPlaying />);
    expect(getByLabelText('Now Playing schließen')).toBeTruthy();
    fireEvent.press(getByTestId('now-playing-close'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('more menu is interactive and opens actions', () => {
    const { getByLabelText, getByText } = render(<NowPlaying />);
    fireEvent.press(getByLabelText('Now Playing Menü öffnen'));
    expect(getByText('TrackInfo öffnen')).toBeTruthy();
    expect(getByText('Queue speichern')).toBeTruthy();
  });

  test('queue save menu item saves the current queue as playlist', () => {
    const { getByLabelText, getByText } = render(<NowPlaying />);
    fireEvent.press(getByLabelText('Now Playing Menü öffnen'));
    fireEvent.press(getByText('Queue speichern'));

    expect(mockSaveQueueAsPlaylist).toHaveBeenCalledWith(
      expect.stringMatching(/^Gespeicherte Queue — .+/),
      mockNowPlayingContext.playbackQueue,
    );
  });
});
