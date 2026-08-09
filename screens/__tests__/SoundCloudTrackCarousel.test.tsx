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
    canSwipeToNext: true,
    isPlaying: false,
    onSwipeToNext: jest.fn(),
    onSwipeToPrevious: jest.fn(),
    onCollapse: jest.fn(),
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

  test('blocks a next swipe when there is no queue candidate', () => {
    const onSwipeToNext = jest.fn();
    const { getByTestId, unmount } = renderCarousel({ nextSong: null, canSwipeToNext: false, onSwipeToNext });

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
    unmount();
  });

  test('collapses after a deliberate downward fling and keeps all page content in the track', () => {
    const onCollapse = jest.fn();
    const { getByTestId, unmount } = renderCarousel({ onCollapse });

    expect(getByTestId('page-content-previous')).toBeTruthy();
    expect(getByTestId('page-content-current')).toBeTruthy();
    expect(getByTestId('page-content-next')).toBeTruthy();

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
});
