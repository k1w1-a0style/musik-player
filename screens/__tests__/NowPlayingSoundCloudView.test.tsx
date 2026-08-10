import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert, Animated, BackHandler, Share, StatusBar, View } from 'react-native';
import NowPlayingSoundCloudView from '../NowPlayingSoundCloudView';

const mockWaveformViewport = jest.fn((_props: Record<string, unknown>) => null);
const MockView = View;

jest.mock('../../contexts/PlaybackProgressContext', () => ({
  usePlaybackProgress: () => ({ position: 1_000, duration: 120_000 }),
}));

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: 'dark',
    theme: {
      palette: {
        border: 'rgba(255,255,255,0.12)',
        surfaceElevated: '#202020',
        text: {
          primary: '#101319',
          secondary: 'rgba(16,19,25,0.7)',
          muted: 'rgba(16,19,25,0.5)',
        },
      },
    },
  }),
}));

jest.mock('../../hooks/useSongWaveform', () => ({
  useSongWaveform: () => ({
    waveform: {
      version: 3,
      source: 'fallback',
      sourceKey: 'test-waveform',
      sourceFingerprint: 'wf3:00000000000000000000000000000001',
      generatedAt: 1,
      durationMs: 120_000,
      points: [0.2, 0.8, 0.5],
    },
  }),
}));

jest.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('../../components/SoundCloudWaveformViewport', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockWaveformViewport(props);
    return <MockView testID={props.interactive === false ? 'adjacent-waveform' : 'active-waveform'} />;
  },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: { children?: React.ReactNode }) => {
    return <MockView {...props}>{children}</MockView>;
  },
}));

jest.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
  Heart: 'Heart',
  Info: 'Info',
  ListMusic: 'ListMusic',
  MoreHorizontal: 'MoreHorizontal',
  Pause: 'Pause',
  Play: 'Play',
  Repeat: 'Repeat',
  Repeat1: 'Repeat1',
  Share2: 'Share2',
  Shuffle: 'Shuffle',
  SkipBack: 'SkipBack',
  SkipForward: 'SkipForward',
  X: 'X',
  GripVertical: 'GripVertical',
  Volume2: 'Volume2',
}));

const songs = [
  { id: 'song-0', title: 'Previous track', artist: 'Previous artist', cover: 'https://example.com/prev.jpg', duration: 120_000 },
  { id: 'song-1', title: 'Track title', artist: 'Artist', cover: 'https://example.com/art.jpg', duration: 120_000 },
  { id: 'song-2', title: 'Next track', artist: 'Next artist', cover: 'https://example.com/next.jpg', duration: 120_000 },
];

const renderSoundCloudView = (props: Partial<React.ComponentProps<typeof NowPlayingSoundCloudView>> = {}) => {
  const defaultProps: React.ComponentProps<typeof NowPlayingSoundCloudView> = {
    currentSong: songs[1],
    previousSong: songs[0],
    nextSong: songs[2],
    artworkUri: songs[1].cover,
    previousArtworkUri: songs[0].cover,
    nextArtworkUri: songs[2].cover,
    isPlaying: false,
    onSeek: jest.fn(async () => undefined),
    onTogglePlayback: jest.fn(async () => undefined),
    onSwipeToNext: jest.fn(),
    onSwipeToPrevious: jest.fn(),
    canSwipeToNext: true,
    onCollapse: jest.fn(),
    onOpenTrackInfo: jest.fn(),
    onOpenMenu: jest.fn(),
    favorite: false,
    favoritePending: false,
    onToggleFavorite: jest.fn(),
    queue: songs,
    onPlayQueueItem: jest.fn(),
    onQueueShift: jest.fn(),
    canShiftQueue: true,
    shuffle: false,
    repeatMode: 'off',
    onToggleShuffle: jest.fn(async () => ({ status: 'committed' as const })),
    onCycleRepeatMode: jest.fn(async () => undefined),
    topInset: 0,
    bottomInset: 0,
  };

  return render(<NowPlayingSoundCloudView {...defaultProps} {...props} />);
};

describe('NowPlayingSoundCloudView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Animated, 'timing').mockImplementation((_value, _config) => ({
      start: (callback?: (result: { finished: boolean }) => void) => callback?.({ finished: true }),
      stop: jest.fn(),
      reset: jest.fn(),
    }) as Animated.CompositeAnimation);
    jest.spyOn(Animated, 'spring').mockImplementation((_value, _config) => ({
      start: (callback?: (result: { finished: boolean }) => void) => callback?.({ finished: true }),
      stop: jest.fn(),
      reset: jest.fn(),
    }) as Animated.CompositeAnimation);
    jest.spyOn(Animated, 'loop').mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn(),
    }) as Animated.CompositeAnimation);
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('keeps the playing canvas minimal and toggles playback by tapping the artwork', () => {
    const onTogglePlayback = jest.fn(async () => undefined);
    const { getByTestId, queryByTestId } = renderSoundCloudView({ isPlaying: true, onTogglePlayback });

    expect(queryByTestId('soundcloud-pause-button')).toBeNull();
    expect(queryByTestId('soundcloud-paused-controls')).toBeNull();
    expect(queryByTestId('soundcloud-carousel-current-paused-artwork')).toBeNull();
    fireEvent.press(getByTestId('soundcloud-swipe-hitbox'));

    expect(onTogglePlayback).toHaveBeenCalledTimes(1);
    expect(mockWaveformViewport).toHaveBeenCalledWith(expect.objectContaining({
      currentPosition: 1_000,
      duration: 120_000,
      isPlaying: true,
      height: 116,
    }));
  });

  test('shows paused transport controls and respects the queue end guard', () => {
    const onSwipeToPrevious = jest.fn();
    const onSwipeToNext = jest.fn();
    const onTogglePlayback = jest.fn(async () => undefined);
    const { getByTestId } = renderSoundCloudView({
      isPlaying: false,
      canSwipeToNext: false,
      onSwipeToPrevious,
      onSwipeToNext,
      onTogglePlayback,
    });

    fireEvent.press(getByTestId('soundcloud-previous-button'));
    fireEvent.press(getByTestId('soundcloud-play-button'));
    fireEvent.press(getByTestId('soundcloud-next-button'));

    expect(onSwipeToPrevious).toHaveBeenCalledTimes(1);
    expect(onTogglePlayback).toHaveBeenCalledTimes(1);
    expect(onSwipeToNext).not.toHaveBeenCalled();
    expect(getByTestId('soundcloud-next-button').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('soundcloud-carousel-current-paused-artwork').props.blurRadius).toBe(18);
  });

  test('moves metadata and waveforms with all three artwork pages', () => {
    const { getByTestId, getByText, getAllByTestId } = renderSoundCloudView();
    const hidden = { includeHiddenElements: true };

    expect(getByTestId('soundcloud-carousel-previous-artwork', hidden).props.source.uri).toBe(songs[0].cover);
    expect(getByTestId('soundcloud-carousel-current-artwork').props.source.uri).toBe(songs[1].cover);
    expect(getByTestId('soundcloud-carousel-next-artwork', hidden).props.source.uri).toBe(songs[2].cover);
    expect(getByText('Previous track', hidden)).toBeTruthy();
    expect(getByText('Track title')).toBeTruthy();
    expect(getByText('Next track', hidden)).toBeTruthy();
    expect(getAllByTestId('adjacent-waveform', hidden)).toHaveLength(2);
    expect(getByTestId('active-waveform')).toBeTruthy();
    expect(getByTestId('soundcloud-carousel-previous-panel', hidden).props.importantForAccessibility)
      .toBe('no-hide-descendants');
  });

  test('forces readable status-bar icons over the dark player', () => {
    const view = renderSoundCloudView();

    expect(view.UNSAFE_getByType(StatusBar).props.barStyle).toBe('light-content');
  });

  test('closes the queue before Android back can close the player', () => {
    const addListener = jest.spyOn(BackHandler, 'addEventListener');
    const { getByTestId, queryByTestId } = renderSoundCloudView();

    fireEvent.press(getByTestId('soundcloud-open-queue'));
    const backCall = addListener.mock.calls.find(([event]) => event === 'hardwareBackPress');

    expect(backCall).toBeTruthy();
    let handled = false;
    act(() => { handled = backCall?.[1]() ?? false; });
    expect(handled).toBe(true);
    expect(queryByTestId('soundcloud-queue-sheet')).toBeNull();
  });

  test('wires close, like, info, share, queue, and more actions', async () => {
    const onCollapse = jest.fn();
    const onToggleFavorite = jest.fn();
    const onOpenTrackInfo = jest.fn();
    const onOpenMenu = jest.fn();
    const { getByTestId, getByText } = renderSoundCloudView({
      onCollapse,
      onToggleFavorite,
      onOpenTrackInfo,
      onOpenMenu,
    });

    fireEvent.press(getByTestId('now-playing-close'));
    fireEvent.press(getByTestId('soundcloud-like'));
    fireEvent.press(getByTestId('soundcloud-track-info'));
    fireEvent.press(getByTestId('soundcloud-share'));
    fireEvent.press(getByTestId('soundcloud-more'));
    fireEvent.press(getByTestId('soundcloud-open-queue'));

    expect(onCollapse).toHaveBeenCalledTimes(1);
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(onOpenTrackInfo).toHaveBeenCalledTimes(1);
    expect(Share.share).toHaveBeenCalledWith({ title: 'Track title', message: 'Track title — Artist' });
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
    expect(getByTestId('soundcloud-queue-sheet')).toBeTruthy();
    expect(getByText('Als Nächstes')).toBeTruthy();
    expect(JSON.stringify(getByText('Läuft gerade').props.style)).toContain('#ffffff');
    expect(JSON.stringify(getByText('Läuft gerade').props.style)).not.toContain('#101319');

    await act(async () => {
      fireEvent.press(getByTestId('soundcloud-queue-shuffle'));
      fireEvent.press(getByTestId('soundcloud-queue-repeat'));
    });
  });

  test('shows useful feedback when the platform share sheet fails', async () => {
    jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('share unavailable'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByTestId } = renderSoundCloudView();

    fireEvent.press(getByTestId('soundcloud-share'));

    await act(async () => undefined);
    expect(alert).toHaveBeenCalledWith('Teilen nicht möglich', 'Der Titel konnte nicht geteilt werden.');
  });
});
