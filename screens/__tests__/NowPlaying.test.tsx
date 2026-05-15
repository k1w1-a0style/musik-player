import React from 'react';
import { Alert, Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import NowPlaying from '../NowPlaying';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
}));

const mockNowPlayingContext = {
  playbackQueue: [{ id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' }],
  currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' },
  seekTo: jest.fn(async () => undefined),
  isPlaying: false,
  volume: 1,
  setVolume: jest.fn(async () => undefined),
  palette: null,
  fftBins: [],
  visualizerRunning: false,
  visualizerError: null as string | null,
  playSong: jest.fn(async () => undefined),
};

jest.mock('../../contexts/MusicContext', () => ({
  useNowPlayingMusicContext: () => mockNowPlayingContext,
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
jest.mock('../../components/Visualizer', () => () => null);
jest.mock('../../components/GlassCard', () => ({ children }: { children?: React.ReactNode }) => <>{children}</>);
jest.mock('../../components/Screen', () => ({ children }: { children?: React.ReactNode }) => <>{children}</>);

describe('NowPlaying cover fallback', () => {
  beforeEach(() => {
    mockNowPlayingContext.visualizerError = null;
    mockGoBack.mockClear();
    mockNavigate.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('hides broken cover image after error', () => {
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(<NowPlaying />);
    const img = UNSAFE_getByType(Image);
    fireEvent(img, 'error');
    expect(UNSAFE_queryByType(Image)).toBeNull();
  });

  test('does not show visualizer hint for neutral stopped reason', () => {
    mockNowPlayingContext.visualizerError = 'stopped';
    const { queryByText } = render(<NowPlaying />);
    expect(queryByText(/Visualizer deaktiviert/i)).toBeNull();
  });

  test('hides visualizer hint while visualizer is disabled for performance stabilization', () => {
    mockNowPlayingContext.visualizerError = 'no_permission';
    const { queryByText } = render(<NowPlaying />);
    expect(queryByText('Visualizer deaktiviert (keine Mikrofonberechtigung).')).toBeNull();
  });

  test('favorite icon is exposed as an actionable button', () => {
    const { getByLabelText } = render(<NowPlaying />);
    const favorite = getByLabelText('Track favorisieren');
    fireEvent.press(favorite);
    expect(Alert.alert).toHaveBeenCalledWith('Favorit', 'Track als Favorit markiert.');
  });

  test('close button remains interactive and triggers goBack', () => {
    const { getByTestId, getByLabelText } = render(<NowPlaying />);
    expect(getByLabelText('Now Playing schließen')).toBeTruthy();
    fireEvent.press(getByTestId('now-playing-close'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('more icon stays decorative and hidden from accessibility tree', () => {
    const { queryByLabelText, queryByTestId } = render(<NowPlaying />);
    expect(queryByLabelText('Mehr Optionen')).toBeNull();
    expect(queryByTestId('now-playing-more')).toBeNull();
  });
});
