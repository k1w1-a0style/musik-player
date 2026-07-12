import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PanResponder } from 'react-native';
import NowPlayingSoundCloudView from '../NowPlayingSoundCloudView';

const mockTogglePlayPause = jest.fn();
const mockWaveformScrubber = jest.fn((_props: Record<string, unknown>) => null);

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: 'dark',
    theme: {
      palette: {
        backgroundDeep: '#000000',
        borderStrong: 'rgba(255, 255, 255, 0.28)',
        text: {
          primary: '#ffffff',
          secondary: 'rgba(255, 255, 255, 0.7)',
        },
      },
    },
  }),
}));

jest.mock('../../contexts/MusicContext', () => ({
  useMusicContext: () => ({ togglePlayPause: mockTogglePlayPause }),
}));

jest.mock('../../hooks/useSongWaveform', () => ({
  useSongWaveform: () => ({ waveform: [0.2, 0.8, 0.5] }),
}));

jest.mock('../../components/WaveformScrubber', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockWaveformScrubber(props);
    return null;
  },
}));

jest.mock('../../components/VolumeSlider', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('lucide-react-native', () => ({
  Info: 'Info',
  Pause: 'Pause',
  Play: 'Play',
  SkipBack: 'SkipBack',
  SkipForward: 'SkipForward',
}));

const renderSoundCloudView = (props: Partial<React.ComponentProps<typeof NowPlayingSoundCloudView>> = {}) => {
  const defaultProps: React.ComponentProps<typeof NowPlayingSoundCloudView> = {
    currentSong: { id: 'song-1', title: 'Track title', artist: 'Artist' },
    artworkUri: 'https://example.com/art.jpg',
    isPlaying: false,
    position: 1000,
    duration: 120000,
    onSeek: jest.fn(async () => undefined),
    onSwipeToNext: jest.fn(),
    onSwipeToPrevious: jest.fn(),
    canSwipeToNext: true,
    onOpenTrackInfo: jest.fn(),
    progressAccent: '#123456',
    volume: 0.5,
    onVolumeChange: jest.fn(async () => undefined),
    bottomInset: 0,
  };

  return render(<NowPlayingSoundCloudView {...defaultProps} {...props} />);
};

const releaseSwipe = (hitbox: ReturnType<ReturnType<typeof render>['getByTestId']>, dx: number, dy: number) => {
  const gesture = { dx, dy };
  expect(hitbox.props.onMoveShouldSetResponder({ nativeEvent: {} }, gesture)).toBe(Math.abs(dx) >= 34 && Math.abs(dx) >= Math.abs(dy) * 1.05);
  hitbox.props.onResponderRelease({ nativeEvent: {} }, gesture);
};

describe('NowPlayingSoundCloudView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(PanResponder, 'create').mockImplementation(config => ({
      panHandlers: {
        onMoveShouldSetResponder: config.onMoveShouldSetPanResponder,
        onMoveShouldSetResponderCapture: config.onMoveShouldSetPanResponderCapture,
        onResponderRelease: config.onPanResponderRelease,
        onResponderTerminate: config.onPanResponderTerminate,
      },
    }) as ReturnType<typeof PanResponder.create>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows paused previous, play, and next controls and wires their handlers', () => {
    const onSwipeToPrevious = jest.fn();
    const onSwipeToNext = jest.fn();
    const { getByTestId } = renderSoundCloudView({ onSwipeToPrevious, onSwipeToNext, isPlaying: false });

    fireEvent.press(getByTestId('soundcloud-previous-button'));
    fireEvent.press(getByTestId('soundcloud-play-button'));
    fireEvent.press(getByTestId('soundcloud-next-button'));

    expect(onSwipeToPrevious).toHaveBeenCalledTimes(1);
    expect(mockTogglePlayPause).toHaveBeenCalledTimes(1);
    expect(onSwipeToNext).toHaveBeenCalledTimes(1);
  });

  test('disables paused next control at the queue end', () => {
    const onSwipeToNext = jest.fn();
    const { getByTestId } = renderSoundCloudView({ canSwipeToNext: false, onSwipeToNext, isPlaying: false });
    const nextButton = getByTestId('soundcloud-next-button');

    expect(nextButton.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(nextButton);

    expect(onSwipeToNext).not.toHaveBeenCalled();
  });

  test('shows a pause affordance while playing and keeps the waveform mounted', () => {
    const { getByTestId } = renderSoundCloudView({ isPlaying: true });

    fireEvent.press(getByTestId('soundcloud-pause-button'));

    expect(mockTogglePlayPause).toHaveBeenCalledTimes(1);
    expect(mockWaveformScrubber).toHaveBeenCalledWith(expect.objectContaining({ height: 116 }));
  });

  test('handles horizontal swipes on the large SoundCloud hitbox', () => {
    const onSwipeToPrevious = jest.fn();
    const onSwipeToNext = jest.fn();
    const { getByTestId } = renderSoundCloudView({ onSwipeToPrevious, onSwipeToNext });
    const hitbox = getByTestId('soundcloud-swipe-hitbox');

    releaseSwipe(hitbox, -60, 4);
    releaseSwipe(hitbox, 60, 4);

    expect(onSwipeToNext).toHaveBeenCalledTimes(1);
    expect(onSwipeToPrevious).toHaveBeenCalledTimes(1);
  });

  test('does not fake a next swipe at queue end or react to vertical gestures', () => {
    const onSwipeToPrevious = jest.fn();
    const onSwipeToNext = jest.fn();
    const { getByTestId } = renderSoundCloudView({ canSwipeToNext: false, onSwipeToPrevious, onSwipeToNext });
    const hitbox = getByTestId('soundcloud-swipe-hitbox');

    releaseSwipe(hitbox, -60, 4);
    releaseSwipe(hitbox, 20, 80);

    expect(onSwipeToNext).not.toHaveBeenCalled();
    expect(onSwipeToPrevious).not.toHaveBeenCalled();
  });
});
