import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
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

jest.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

const song = { id: 's1', title: 'One', artist: 'Artist' };
const previousSong = { id: 's0', title: 'Zero', artist: 'Artist' };
const nextSong = { id: 's2', title: 'Two', artist: 'Artist' };

describe('NowPlayingCoverArtwork', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  test('wraps the optimized cover image in a swipe gesture surface when enabled', () => {
    const { getByTestId } = render(
      <NowPlayingCoverArtwork
        song={song}
        previousSong={previousSong}
        nextSong={nextSong}
        artworkUri="file:///cover.jpg"
        previousArtworkUri="file:///previous.jpg"
        nextArtworkUri="file:///next.jpg"
        isPlaying
        accent="#123456"
        coverSize={160}
        swipeEnabled
        onSwipeLeft={jest.fn()}
        onSwipeRight={jest.fn()}
      />,
    );

    expect(getByTestId('now-playing-cover-swipe-gesture')).toBeTruthy();
    expect(getByTestId('now-playing-cover-image').props.resizeMethod).toBe('resize');
    expect(getByTestId('now-playing-cover-previous-image').props.source).toEqual({ uri: 'file:///previous.jpg' });
    expect(getByTestId('now-playing-cover-next-image').props.source).toEqual({ uri: 'file:///next.jpg' });
  });

  test('dispatches an allowed left swipe before the native animation finishes', () => {
    const onSwipeLeft = jest.fn();
    const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({
      start: (callback?: (result: { finished: boolean }) => void) => callback?.({ finished: true }),
      stop: jest.fn(),
      reset: jest.fn(),
    }) as Animated.CompositeAnimation);
    const { getByTestId } = render(
      <NowPlayingCoverArtwork song={song} nextSong={nextSong} isPlaying accent="#123456" coverSize={160}
        swipeEnabled canSwipeLeft onSwipeLeft={onSwipeLeft} />,
    );

    act(() => {
      fireEvent(getByTestId('now-playing-cover-swipe-gesture'), 'handlerStateChange', {
        nativeEvent: { oldState: State.ACTIVE, state: State.END, translationX: -60, translationY: 2 },
      });
    });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    timing.mockRestore();
  });

  test('keeps the three cover pages frozen until the animated track switch settles', () => {
    const onSwipeLeft = jest.fn();
    let finishAnimation: ((result: { finished: boolean }) => void) | undefined;
    jest.spyOn(Animated, 'timing').mockImplementation(() => ({
      start: (callback?: (result: { finished: boolean }) => void) => { finishAnimation = callback; },
      stop: jest.fn(),
      reset: jest.fn(),
    }) as Animated.CompositeAnimation);
    const initialProps = {
      song,
      previousSong,
      nextSong,
      artworkUri: 'file:///one.jpg',
      previousArtworkUri: 'file:///zero.jpg',
      nextArtworkUri: 'file:///two.jpg',
      isPlaying: true,
      accent: '#123456',
      coverSize: 160,
      swipeEnabled: true,
      canSwipeLeft: true,
      onSwipeLeft,
    };
    const { getByTestId, rerender } = render(<NowPlayingCoverArtwork {...initialProps} />);

    act(() => {
      fireEvent(getByTestId('now-playing-cover-swipe-gesture'), 'handlerStateChange', {
        nativeEvent: { oldState: State.ACTIVE, state: State.END, translationX: -60, translationY: 1 },
      });
    });
    rerender(<NowPlayingCoverArtwork {...initialProps}
      song={nextSong} previousSong={song} nextSong={{ id: 's3', title: 'Three', artist: 'Artist' }}
      artworkUri="file:///two.jpg" previousArtworkUri="file:///one.jpg" nextArtworkUri="file:///three.jpg" />);

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(getByTestId('now-playing-cover-image').props.source).toEqual({ uri: 'file:///one.jpg' });

    act(() => finishAnimation?.({ finished: true }));

    expect(getByTestId('now-playing-cover-image').props.source).toEqual({ uri: 'file:///two.jpg' });
  });

  test('resets instead of finishing a left swipe when left swipes are disabled', () => {
    const onSwipeLeft = jest.fn();
    const { getByTestId } = render(
      <NowPlayingCoverArtwork
        song={song}
        nextSong={nextSong}
        isPlaying
        accent="#123456"
        coverSize={160}
        swipeEnabled
        canSwipeLeft={false}
        onSwipeLeft={onSwipeLeft}
      />,
    );

    act(() => {
      fireEvent(getByTestId('now-playing-cover-swipe-gesture'), 'handlerStateChange', {
        nativeEvent: { oldState: State.ACTIVE, state: State.END, translationX: -60 },
      });
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
