import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Animated, PanResponder } from 'react-native';
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
    previousSong: { id: 'song-0', title: 'Previous track', artist: 'Previous artist', cover: 'https://example.com/prev.jpg' },
    nextSong: { id: 'song-2', title: 'Next track', artist: 'Next artist', cover: 'https://example.com/next.jpg' },
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

const releaseSwipe = (hitbox: ReturnType<ReturnType<typeof render>['getByTestId']>, dx: number, dy: number, vx = 0) => {
  const gesture = { dx, dy, vx };
  const shouldSet = Math.abs(dx) >= 18 && Math.abs(dx) > Math.abs(dy) * 1.15;
  const didSet = hitbox.props.onMoveShouldSetResponder({ nativeEvent: {} }, gesture);
  if (!didSet) return didSet;
  expect(didSet).toBe(shouldSet);
  act(() => {
    hitbox.props.onResponderMove({ nativeEvent: {} }, gesture);
    hitbox.props.onResponderRelease({ nativeEvent: {} }, gesture);
  });
  return didSet;
};

describe('NowPlayingSoundCloudView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(PanResponder, 'create').mockImplementation(config => ({
      panHandlers: {
        onMoveShouldSetResponder: config.onMoveShouldSetPanResponder,
        onMoveShouldSetResponderCapture: config.onMoveShouldSetPanResponderCapture,
        onResponderMove: config.onPanResponderMove,
        onResponderRelease: config.onPanResponderRelease,
        onResponderTerminate: config.onPanResponderTerminate,
      },
    }) as ReturnType<typeof PanResponder.create>);
    jest.spyOn(Animated, 'timing').mockImplementation((_value, _config) => ({ start: (callback?: (result: { finished: boolean }) => void) => callback?.({ finished: true }) }) as Animated.CompositeAnimation);
    jest.spyOn(Animated, 'spring').mockImplementation((_value, _config) => ({ start: (callback?: (result: { finished: boolean }) => void) => callback?.({ finished: true }) }) as Animated.CompositeAnimation);
  });

  afterEach(() => {
    jest.useRealTimers();
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



  test('renders carousel panels for previous, current, and next candidates', () => {
    const { getByTestId, getByText } = renderSoundCloudView();

    expect(getByTestId('soundcloud-track-carousel')).toBeTruthy();
    expect(getByTestId('soundcloud-carousel-previous-panel').props.source.uri).toBe('https://example.com/prev.jpg');
    expect(getByTestId('soundcloud-carousel-current-panel').props.source.uri).toBe('https://example.com/art.jpg');
    expect(getByTestId('soundcloud-carousel-next-panel').props.source.uri).toBe('https://example.com/next.jpg');
    expect(getByText('Previous track')).toBeTruthy();
    expect(getByText('Next track')).toBeTruthy();
  });

  test('short swipes and unavailable previous candidates snap back without switching tracks', () => {
    const onSwipeToPrevious = jest.fn();
    const onSwipeToNext = jest.fn();
    const { getByTestId, rerender } = renderSoundCloudView({ onSwipeToPrevious, onSwipeToNext });
    const carousel = getByTestId('soundcloud-track-carousel');

    releaseSwipe(carousel, -40, 2);
    releaseSwipe(carousel, 40, 2);

    expect(onSwipeToNext).not.toHaveBeenCalled();
    expect(onSwipeToPrevious).not.toHaveBeenCalled();

    rerender(<NowPlayingSoundCloudView
      currentSong={{ id: 'song-1', title: 'Track title', artist: 'Artist' }}
      previousSong={null}
      nextSong={{ id: 'song-2', title: 'Next track', artist: 'Next artist' }}
      artworkUri="https://example.com/art.jpg"
      isPlaying={false}
      position={1000}
      duration={120000}
      onSeek={jest.fn(async () => undefined)}
      onSwipeToNext={onSwipeToNext}
      onSwipeToPrevious={onSwipeToPrevious}
      canSwipeToNext
      onOpenTrackInfo={jest.fn()}
      progressAccent="#123456"
      volume={0.5}
      onVolumeChange={jest.fn(async () => undefined)}
      bottomInset={0}
    />);
    releaseSwipe(getByTestId('soundcloud-track-carousel'), 100, 4, 1);

    expect(onSwipeToPrevious).not.toHaveBeenCalled();
  });

  test('fast flicks commit once and current-song changes reset the carousel panels', () => {
    const onSwipeToNext = jest.fn();
    const { getByTestId, queryByText, rerender } = renderSoundCloudView({ onSwipeToNext });

    releaseSwipe(getByTestId('soundcloud-track-carousel'), -25, 2, -1.1);
    releaseSwipe(getByTestId('soundcloud-track-carousel'), -120, 2, -1.1);

    expect(onSwipeToNext).toHaveBeenCalledTimes(1);

    rerender(<NowPlayingSoundCloudView
      currentSong={{ id: 'song-2', title: 'Next track', artist: 'Next artist', cover: 'https://example.com/next.jpg' }}
      previousSong={{ id: 'song-1', title: 'Track title', artist: 'Artist', cover: 'https://example.com/art.jpg' }}
      nextSong={null}
      artworkUri="https://example.com/next.jpg"
      isPlaying={false}
      position={1000}
      duration={120000}
      onSeek={jest.fn(async () => undefined)}
      onSwipeToNext={onSwipeToNext}
      onSwipeToPrevious={jest.fn()}
      canSwipeToNext={false}
      onOpenTrackInfo={jest.fn()}
      progressAccent="#123456"
      volume={0.5}
      onVolumeChange={jest.fn(async () => undefined)}
      bottomInset={0}
    />);

    expect(queryByText('Stale next')).toBeNull();
    expect(getByTestId('soundcloud-carousel-current-panel').props.source.uri).toBe('https://example.com/next.jpg');
  });

  test('handles horizontal swipes on the large SoundCloud hitbox', () => {
    const onSwipeToPrevious = jest.fn();
    const onSwipeToNext = jest.fn();
    const nextRender = renderSoundCloudView({ onSwipeToPrevious, onSwipeToNext });

    releaseSwipe(nextRender.getByTestId('soundcloud-track-carousel'), -100, 4, -1);
    nextRender.unmount();

    const previousRender = renderSoundCloudView({ onSwipeToPrevious, onSwipeToNext });
    releaseSwipe(previousRender.getByTestId('soundcloud-track-carousel'), 100, 4, 1);

    expect(onSwipeToNext).toHaveBeenCalledTimes(1);
    expect(onSwipeToPrevious).toHaveBeenCalledTimes(1);
  });

  test('resets after a previous swipe that restarts the current track instead of changing songs', () => {
    jest.useFakeTimers();
    const onSwipeToPrevious = jest.fn();
    const { getByTestId } = renderSoundCloudView({ onSwipeToPrevious });
    const carousel = getByTestId('soundcloud-track-carousel');

    releaseSwipe(carousel, 100, 4, 1);
    releaseSwipe(carousel, 100, 4, 1);

    expect(onSwipeToPrevious).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(250);
    });
    releaseSwipe(carousel, 100, 4, 1);

    expect(onSwipeToPrevious).toHaveBeenCalledTimes(2);
  });

  test('does not fake a next swipe at queue end or react to vertical gestures', () => {
    const onSwipeToPrevious = jest.fn();
    const onSwipeToNext = jest.fn();
    const { getByTestId } = renderSoundCloudView({ canSwipeToNext: false, onSwipeToPrevious, onSwipeToNext });
    const hitbox = getByTestId('soundcloud-track-carousel');

    releaseSwipe(hitbox, -100, 4, -1);
    releaseSwipe(hitbox, 20, 80);

    expect(onSwipeToNext).not.toHaveBeenCalled();
    expect(onSwipeToPrevious).not.toHaveBeenCalled();
  });
});
