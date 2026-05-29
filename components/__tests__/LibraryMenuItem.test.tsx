import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryMenuItem from '../LibraryMenuItem';

test('renders label and calls onPress', () => {
  const onPress = jest.fn();
  const { getByText, getByTestId } = render(<LibraryMenuItem label="Importieren / Rescan" onPress={onPress} />);

  expect(getByText('Importieren / Rescan')).toBeTruthy();
  fireEvent.press(getByTestId('library-menu-item-importieren-rescan'));

  expect(onPress).toHaveBeenCalledTimes(1);
});

test('does not call onPress when disabled', () => {
  const onPress = jest.fn();
  const { getByTestId } = render(<LibraryMenuItem label="Metadaten aktualisieren" onPress={onPress} disabled />);

  const item = getByTestId('library-menu-item-metadaten-aktualisieren');
  expect(item.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(item);

  expect(onPress).not.toHaveBeenCalled();
});

test('applies muted text style', () => {
  const { getByText } = render(<LibraryMenuItem label="Aktive Scan-Ordner: 1" onPress={jest.fn()} muted />);

  const textStyle = getByText('Aktive Scan-Ordner: 1').props.style;
  expect(textStyle).toEqual(expect.arrayContaining([expect.objectContaining({ fontSize: 14 })]));
});
