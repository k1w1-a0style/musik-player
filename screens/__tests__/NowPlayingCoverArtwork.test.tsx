import React from 'react';
import { render } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { State } from 'react-native-gesture-handler';
import NowPlayingCoverArtwork from '../NowPlayingCoverArtwork';

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
    theme: {
      palette: {
        surface: '#101218',
        primary: '#D8DEE8',
      },
    },
  }),
}));

jest.mock('lucide-react-native', () => ({
  Disc3: 'Disc3',
}));

const song = { id: 's1', title: 'One', artist: 'Artist' };

describe('NowPlayingCoverArtwork', () => {
  test('renders cover card without swipe handlers by default', () => {
    const { getByTestId } = render(
      <NowPlayingCoverArtwork
        song={song}
        isPlaying={false}
        accent="#123456"
        coverSize={160}
      />,
    );

    const card = getByTestId('now-playing-cover-card');
    expect(card.props.onMoveShouldSetResponder).toBeUndefined();
    expect(getByTestId('now-playing-cover-fallback')).toBeTruthy();
  });

  test('attaches horizontal swipe handlers when enabled', () => {
    const { getByTestId } = render(
      <NowPlayingCoverArtwork
        song={song}
        artworkUri="file:///cover.jpg"
        isPlaying
        accent="#123456"
        coverSize={160}
        swipeEnabled
        onSwipeLeft={jest.fn()}
        onSwipeRight={jest.fn()}
      />,
    );

    const card = getByTestId('now-playing-cover-card');
    const gesture = getByTestId('now-playing-cover-swipe-gesture');
    expect(card.props.onMoveShouldSetResponder).toBeUndefined();
    expect(gesture.props.onGestureEvent).toEqual(expect.any(Function));
    expect(gesture.props.onHandlerStateChange).toEqual(expect.any(Function));
    expect(getByTestId('now-playing-cover-image').props.resizeMethod).toBe('resize');
  });

  test('commits an allowed left swipe once after the native animation finishes', () => {
    const onSwipeLeft = jest.fn();
    const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({
      start: (callback?: (result: { finished: boolean }) => void) => callback?.({ finished: true }),
      stop: jest.fn(),
      reset: jest.fn(),
    }) as Animated.CompositeAnimation);
    const { getByTestId } = render(
      <NowPlayingCoverArtwork song={song} isPlaying accent="#123456" coverSize={160}
        swipeEnabled canSwipeLeft onSwipeLeft={onSwipeLeft} />,
    );

    getByTestId('now-playing-cover-swipe-gesture').props.onHandlerStateChange({
      nativeEvent: { oldState: State.ACTIVE, state: State.END, translationX: -60, translationY: 2 },
    });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    timing.mockRestore();
  });

  test('resets instead of finishing a left swipe when left swipes are disabled', () => {
    const onSwipeLeft = jest.fn();
    const { getByTestId } = render(
      <NowPlayingCoverArtwork
        song={song}
        isPlaying
        accent="#123456"
        coverSize={160}
        swipeEnabled
        canSwipeLeft={false}
        onSwipeLeft={onSwipeLeft}
      />,
    );

    const gesture = getByTestId('now-playing-cover-swipe-gesture');
    gesture.props.onHandlerStateChange({
      nativeEvent: { oldState: State.ACTIVE, state: State.END, translationX: -60 },
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
