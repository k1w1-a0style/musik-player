import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import AppLoading from '../AppLoading';

const mockAppTheme = {
  palette: {
    background: '#08090B',
    primary: '#D8DEE8',
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: () => undefined,
    setSkin: () => undefined,
    theme: mockAppTheme,
  }),
}));

test('renders themed loading container', () => {
  const { getByTestId } = render(<AppLoading />);
  const style = StyleSheet.flatten(getByTestId('app-loading').props.style);

  expect(style.flex).toBe(1);
  expect(style.backgroundColor).toBe(mockAppTheme.palette.background);
});
