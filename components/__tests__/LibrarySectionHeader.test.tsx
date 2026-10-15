import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import LibrarySectionHeader from '../LibrarySectionHeader';

const mockAppTheme = {
  palette: {
    text: {
      secondary: 'rgba(244, 245, 247, 0.70)',
      muted: 'rgba(244, 245, 247, 0.42)',
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    theme: mockAppTheme,
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
  }),
}));

test('renders header title', () => {
  const { getByText } = render(<LibrarySectionHeader title="Alben" />);

  expect(getByText('Alben')).toBeTruthy();
});

test('renders header count', () => {
  const { getByText } = render(<LibrarySectionHeader title="Ordner" count="2 aktiv" />);

  expect(getByText('2 aktiv')).toBeTruthy();
});

test('renders header action content', () => {
  const { getByText } = render(
    <LibrarySectionHeader title="Titel" count="5">
      <Text>Header Action</Text>
    </LibrarySectionHeader>,
  );

  expect(getByText('Header Action')).toBeTruthy();
});

test('uses app theme text colors', () => {
  const { getByText } = render(<LibrarySectionHeader title="Ordner" count="2 aktiv" />);

  expect(JSON.stringify(getByText('Ordner').props.style)).toContain(mockAppTheme.palette.text.secondary);
  expect(JSON.stringify(getByText('2 aktiv').props.style)).toContain(mockAppTheme.palette.text.muted);
});

test('keeps large titles and action rows unconstrained so they can wrap', () => {
  const title = 'Favoriten mit einem langen deutschen Titel';
  const { getByTestId, getByText } = render(
    <LibrarySectionHeader title={title}>
      <Text>Ansicht auswählen</Text><Text>Sortierung auswählen</Text>
    </LibrarySectionHeader>,
  );
  const container = StyleSheet.flatten(getByTestId('library-section-header').props.style);
  expect(container.height).toBeUndefined();
  expect(container.maxHeight).toBeUndefined();
  expect(container.flexWrap).toBe('wrap');
  const actions = StyleSheet.flatten(getByTestId('library-section-actions').props.style);
  expect(actions.flexWrap).toBe('wrap');
  expect(actions.maxWidth).toBe('100%');
  expect(getByText(title).props.numberOfLines).toBeUndefined();
  expect(getByText(title).props.allowFontScaling).not.toBe(false);
});
