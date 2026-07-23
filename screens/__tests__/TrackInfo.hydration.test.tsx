import React from 'react';
import { render } from '@testing-library/react-native';
import TrackInfo from '../TrackInfo';

const baseState = {
  song: null,
  isReady: false,
  coverUri: undefined,
  coverStatus: 'none' as const,
  coverDimensions: undefined,
  importedAt: undefined,
  coverFailed: false,
  setCoverFailed: jest.fn(),
  openTagEditor: jest.fn(),
  removeFromLibrary: jest.fn(),
};

let mockState = { ...baseState };

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    theme: {
      palette: {
        primary: '#ffffff',
        text: { primary: '#ffffff', secondary: '#cccccc' },
      },
    },
  }),
}));

jest.mock('../../components/AppBackground', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('../../components/Screen', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('../useTrackInfoScreenState', () => ({
  useTrackInfoScreenState: () => mockState,
}));

// A missing song before hydration and a missing song after hydration are distinct UI states.
describe('TrackInfo hydration state', () => {
  beforeEach(() => {
    mockState = { ...baseState };
  });

  test('shows a loading state instead of not found before library hydration completes', () => {
    const { getByText, queryByText } = render(<TrackInfo />);

    expect(getByText('Track-Informationen werden geladen…')).toBeTruthy();
    expect(queryByText('Titel nicht gefunden.')).toBeNull();
  });

  test('shows not found only after hydration completed', () => {
    mockState = { ...baseState, isReady: true };

    const { getByText, queryByText } = render(<TrackInfo />);

    expect(getByText('Titel nicht gefunden.')).toBeTruthy();
    expect(queryByText('Track-Informationen werden geladen…')).toBeNull();
  });
});
