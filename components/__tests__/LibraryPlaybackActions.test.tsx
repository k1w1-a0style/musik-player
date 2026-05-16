import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryPlaybackActions from '../LibraryPlaybackActions';

test('renders favorite indicator when requested', () => {
  const { getByTestId } = render(<LibraryPlaybackActions disabled={false} showFavoriteIcon onShuffle={jest.fn()} onPlay={jest.fn()} />);

  expect(getByTestId('library-favorites-indicator')).toBeTruthy();
});

test('calls shuffle and play callbacks', () => {
  const onShuffle = jest.fn();
  const onPlay = jest.fn();
  const { getByTestId } = render(<LibraryPlaybackActions disabled={false} onShuffle={onShuffle} onPlay={onPlay} />);

  fireEvent.press(getByTestId('library-shuffle-button'));
  fireEvent.press(getByTestId('library-play-button'));

  expect(onShuffle).toHaveBeenCalledTimes(1);
  expect(onPlay).toHaveBeenCalledTimes(1);
});

test('disables shuffle and play buttons', () => {
  const onShuffle = jest.fn();
  const onPlay = jest.fn();
  const { getByTestId } = render(<LibraryPlaybackActions disabled onShuffle={onShuffle} onPlay={onPlay} />);

  expect(getByTestId('library-shuffle-button').props.accessibilityState.disabled).toBe(true);
  expect(getByTestId('library-play-button').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(getByTestId('library-shuffle-button'));
  fireEvent.press(getByTestId('library-play-button'));

  expect(onShuffle).not.toHaveBeenCalled();
  expect(onPlay).not.toHaveBeenCalled();
});
