import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibrarySongViewControl from '../LibrarySongViewControl';

describe('LibrarySongViewControl', () => {
  test('shows the current view label', () => {
    const { getByTestId } = render(<LibrarySongViewControl mode="gridSmall" onCycle={jest.fn()} />);
    expect(getByTestId('library-song-view-control-label').props.children).toBe('Klein');
  });

  test('cycles on press', () => {
    const onCycle = jest.fn();
    const { getByTestId } = render(<LibrarySongViewControl mode="list" onCycle={onCycle} />);

    fireEvent.press(getByTestId('library-song-view-control'));

    expect(onCycle).toHaveBeenCalledTimes(1);
  });
});
