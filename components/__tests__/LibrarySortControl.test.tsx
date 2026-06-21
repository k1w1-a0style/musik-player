import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibrarySortControl from '../LibrarySortControl';

describe('LibrarySortControl', () => {
  test('shows the current sort label', () => {
    const { getByTestId } = render(<LibrarySortControl mode="year" onCycle={jest.fn()} />);
    expect(getByTestId('library-sort-control-label').props.children).toBe('Jahr');
  });

  test('cycles on press', () => {
    const onCycle = jest.fn();
    const { getByTestId } = render(<LibrarySortControl mode="alphabet" onCycle={onCycle} />);

    fireEvent.press(getByTestId('library-sort-control'));

    expect(onCycle).toHaveBeenCalledTimes(1);
  });
});
