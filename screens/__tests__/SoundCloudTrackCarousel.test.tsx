import React from 'react';
import { Animated, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import SoundCloudTrackCarousel from '../SoundCloudTrackCarousel';

const songs = [
  { id: 'previous', title: 'Previous', artist: 'Artist', cover: 'file:///previous.jpg' },
  { id: 'current', title: 'Current', artist: 'Artist', cover: 'file:///current.jpg' },
  { id: 'next', title: 'Next', artist: 'Artist', cover: 'file:///next.jpg' },
];

const renderCarousel = (props: Partial<React.ComponentProps<typeof SoundCloudTrackCarousel>> = {}) => {
  const defaults: React.ComponentProps<typeof SoundCloudTrackCarousel> = {
    currentSong: songs[1],
    previousSong: songs[0],
    nextSong: songs[2],
    currentArtworkUri: songs[1].cover,
    previousArtworkUri: songs[0].cover,
    nextArtworkUri: songs[2].cover,
    isPlaying: true,
    topInset: 0,
    bottomInset: 0,
    verticalDrag: new Animated.Value(0),
    canSwipeToNext: true,
    onSwipeToNext: jest.fn(),
    onSwipeToPrevious: jest.fn(),
    onCollapse: jest.fn(),
    onOpenQueue: jest.fn(),
    renderPage: ({ role }) => <View testID={`page-content-${role}`} />,
  };
  return render(<SoundCloudTrackCarousel {...defaults} {...props} />);
};

describe('SoundCloudTrackCarousel gestures', () => {
  beforeEach(() => {
    jest.useFakeTimers();
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
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('commits a fast horizontal page swipe once', () => {
    const onSwipeToNext = jest.fn();
    const { getByTestId, unmount } = renderCarousel({ onSwipeToNext });

    act(() => {
      fireEvent(getByTestId('soundcloud-track-swipe-gesture'), 'handlerStateChange', {
        nativeEvent: {
          oldState: State.ACTIVE,
          state: State.END,
          translationX: -80,
          translationY: 4,
          velocityX: -1_000,
        },
      });
    });

    expect(onSwipeToNext).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('freezes artwork, title and waveform source until the page transition finishes', () => {
    let finishTrackAnimation: ((result: { finished: boolean }) => void) | undefined;
    (Animated.timing as jest.MockedFunction<typeof Animated.timing>).mockImplementation((_value, config) => ({
      start: callback => {
        if (config.duration === 270) {
          finishTrackAnimation = callback;
          return;
        }
        callback?.({ finished: true });
      },
      stop: jest.fn(),
      reset: jest.fn(),
    }) as Animated.CompositeAnimation);
    const onSwipeToNext = jest.fn();
    const afterNext = { id: 'after-next', title: 'After next', artist: 'Artist' };
    const renderPage: React.ComponentProps<typeof SoundCloudTrackCarousel>['renderPage'] = ({ role, song }) => (
      <View testID={`page-content-${role}`} accessibilityLabel={song?.id} />
    );
    const initialProps: React.ComponentProps<typeof SoundCloudTrackCarousel> = {
      currentSong: songs[1], previousSong: songs[0], nextSong: songs[2],
      currentArtworkUri: songs[1].cover, previousArtworkUri: songs[0].cover,
      nextArtworkUri: songs[2].cover,
      isPlaying: true, topInset: 0, bottomInset: 0, verticalDrag: new Animated.Value(0),
      onSwipeToNext, onSwipeToPrevious: jest.fn(), onCollapse: jest.fn(), onOpenQueue: jest.fn(), renderPage,
    };
    const { getByTestId, rerender, unmount } = render(<SoundCloudTrackCarousel {...initialProps} />);

    act(() => {
      fireEvent(getByTestId('soundcloud-track-swipe-gesture'), 'handlerStateChange', {
        nativeEvent: {
          oldState: State.ACTIVE,
          state: State.END,
          translationX: -80,
          translationY: 4,
          velocityX: -1_000,
        },
      });
    });

    expect(finishTrackAnimation).toEqual(expect.any(Function));
    expect(onSwipeToNext).toHaveBeenCalledTimes(1);

    rerender(<SoundCloudTrackCarousel {...initialProps} currentSong={songs[2]}
      previousSong={songs[1]} nextSong={afterNext} currentArtworkUri={songs[2].cover}
      previousArtworkUri={songs[1].cover} nextArtworkUri={undefined} />);
    expect(getByTestId('page-content-current').props.accessibilityLabel).toBe('current');
    expect(getByTestId('soundcloud-carousel-current-artwork').props.source.uri).toBe(songs[1].cover);

    act(() => finishTrackAnimation?.({ finished: true }));
    expect(onSwipeToNext).toHaveBeenCalledTimes(1);
    expect(getByTestId('page-content-current').props.accessibilityLabel).toBe('next');
    expect(getByTestId('soundcloud-carousel-current-artwork').props.source.uri).toBe(songs[2].cover);
    unmount();
  });

  test('blocks a next swipe when there is no queue candidate', () => {
    const onSwipeToNext = jest.fn();
    const { getByTestId, queryByTestId, unmount } = renderCarousel({
      nextSong: null, nextArtworkUri: undefined, canSwipeToNext: false, onSwipeToNext,
    });

    act(() => {
      fireEvent(getByTestId('soundcloud-track-swipe-gesture'), 'handlerStateChange', {
        nativeEvent: {
          oldState: State.ACTIVE,
          state: State.END,
          translationX: -180,
          translationY: 2,
          velocityX: -1_100,
        },
      });
    });

    expect(onSwipeToNext).not.toHaveBeenCalled();
    expect(queryByTestId('soundcloud-carousel-next-artwork', { includeHiddenElements: true })).toBeNull();
    unmount();
  });

  test('collapses after a deliberate downward fling and renders only one stationary page', () => {
    const onCollapse = jest.fn();
    const { getByTestId, queryByTestId, unmount } = renderCarousel({ onCollapse });
    const hidden = { includeHiddenElements: true };

    expect(getByTestId('page-content-current')).toBeTruthy();
    expect(queryByTestId('page-content-previous', hidden)).toBeNull();
    expect(queryByTestId('page-content-next', hidden)).toBeNull();
    expect(getByTestId('soundcloud-current-page-layer')).toBeTruthy();

    act(() => {
      fireEvent(getByTestId('soundcloud-collapse-gesture'), 'handlerStateChange', {
        nativeEvent: {
          oldState: State.ACTIVE,
          state: State.END,
          translationY: 60,
          velocityY: 1_100,
        },
      });
    });

    expect(onCollapse).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('opens the queue after an upward fling', () => {
    const onOpenQueue = jest.fn();
    const { getByTestId, unmount } = renderCarousel({ onOpenQueue });

    act(() => {
      fireEvent(getByTestId('soundcloud-collapse-gesture'), 'handlerStateChange', {
        nativeEvent: {
          oldState: State.ACTIVE,
          state: State.END,
          translationX: 2,
          translationY: -70,
          velocityY: -1_000,
        },
      });
    });

    expect(onOpenQueue).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('keeps artwork static except for the explicit pager transition', () => {
    const { unmount } = renderCarousel();
    const driftConfigs = (Animated.timing as jest.MockedFunction<typeof Animated.timing>).mock.calls
      .map(([, config]) => config)
      .filter(config => (config.duration ?? 0) >= 9_000);

    expect(driftConfigs).toHaveLength(0);
    expect(Animated.loop).not.toHaveBeenCalled();
    unmount();
  });
});
