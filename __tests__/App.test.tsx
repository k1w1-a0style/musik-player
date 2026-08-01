import React from 'react';
import { Text as MockText, View as MockView } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import App, { AppContent } from '../App';
import AppErrorBoundary from '../components/AppErrorBoundary';

const mockUseFonts = jest.fn((_fonts: unknown) => [true]);

jest.mock('@expo-google-fonts/bricolage-grotesque', () => ({
  useFonts: (fonts: unknown) => mockUseFonts(fonts),
}));

jest.mock('../appFonts', () => ({
  appFonts: { BricolageGrotesque_400Regular: 1 },
}));

jest.mock('../components/AppLoading', () => ({
  __esModule: true,
  default: function MockAppLoading() {
    return <MockText testID="app-loading">loading</MockText>;
  },
}));

jest.mock('../components/ThemedStatusBar', () => ({
  __esModule: true,
  default: function MockThemedStatusBar() {
    return <MockText testID="themed-status-bar">status bar</MockText>;
  },
}));

jest.mock('../components/AppProviders', () => ({
  __esModule: true,
  default: function MockAppProviders({ children }: { children: React.ReactNode }) {
    return <MockView testID="app-providers">{children}</MockView>;
  },
}));

jest.mock('../navigation/RootNavigator', () => ({
  __esModule: true,
  default: function MockRootNavigator() {
    return <MockText testID="root-navigator">root navigator</MockText>;
  },
}));

describe('App', () => {
  beforeEach(() => {
    mockUseFonts.mockReturnValue([true]);
    jest.clearAllMocks();
  });

  test('wraps root content in AppErrorBoundary', () => {
    const tree = App() as React.ReactElement<{ children: React.ReactNode }>;

    expect(tree.type).toBe(AppErrorBoundary);
    const child = React.Children.only(tree.props.children) as React.ReactElement;
    expect(child.type).toBe(AppContent);
  });

  test('renders loading state while fonts are loading inside AppContent', async () => {
    mockUseFonts.mockReturnValueOnce([false]);

    const { getByTestId, queryByTestId } = render(<AppContent />);

    expect(getByTestId('app-loading')).toBeTruthy();
    expect(queryByTestId('app-providers')).toBeNull();
    await act(async () => { await Promise.resolve(); });
  });

  test('renders providers and navigation after startup restoration', async () => {
    const { getByTestId } = render(<App />);

    await waitFor(() => expect(getByTestId('app-providers')).toBeTruthy());
    expect(getByTestId('themed-status-bar')).toBeTruthy();
    expect(getByTestId('root-navigator')).toBeTruthy();
  });
});
