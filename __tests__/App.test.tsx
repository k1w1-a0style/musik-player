import React from 'react';
import { Pressable as MockPressable, Text as MockText, View as MockView } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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
  default: function MockAppLoading({ degraded, onRetry }: { degraded?: boolean; onRetry?: () => void }) {
    return <MockView testID="app-loading">
      <MockText>{degraded ? 'failed' : 'loading'}</MockText>
      {degraded && <MockPressable testID="startup-retry" onPress={onRetry} />}
    </MockView>;
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

  test('offers a retry after startup restoration fails and renders after retry succeeds', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const recovery = require('../utils/tagWriterRecovery') as typeof import('../utils/tagWriterRecovery');
    const restore = jest.spyOn(recovery, 'restoreAndReconcileTagWrites')
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce([]);
    const { getByTestId } = render(<AppContent />);

    await waitFor(() => expect(getByTestId('startup-retry')).toBeTruthy());
    fireEvent.press(getByTestId('startup-retry'));
    await waitFor(() => expect(getByTestId('app-providers')).toBeTruthy());
    expect(restore).toHaveBeenCalledTimes(2);
  });

  test('coalesces overlapping startup recovery retries', async () => {
    let finishRetry!: () => void;
    const retry = new Promise<void>(resolve => { finishRetry = resolve; });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const recovery = require('../utils/tagWriterRecovery') as typeof import('../utils/tagWriterRecovery');
    const restore = jest.spyOn(recovery, 'restoreAndReconcileTagWrites')
      .mockRejectedValueOnce(new Error('native unavailable'))
      .mockImplementationOnce(() => retry.then(() => []));
    const { getByTestId } = render(<AppContent />);

    await waitFor(() => expect(getByTestId('startup-retry')).toBeTruthy());
    const retryButton = getByTestId('startup-retry');
    fireEvent.press(retryButton);
    fireEvent.press(retryButton);
    expect(restore).toHaveBeenCalledTimes(2);
    await act(async () => { finishRetry(); await retry; });
    await waitFor(() => expect(getByTestId('app-providers')).toBeTruthy());
  });

  test('ignores a late startup recovery result after unmount', async () => {
    let finishRecovery!: () => void;
    const pending = new Promise<void>(resolve => { finishRecovery = resolve; });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const recovery = require('../utils/tagWriterRecovery') as typeof import('../utils/tagWriterRecovery');
    jest.spyOn(recovery, 'restoreAndReconcileTagWrites').mockImplementationOnce(() => pending.then(() => []));
    const view = render(<AppContent />);

    view.unmount();
    await act(async () => { finishRecovery(); await pending; });
  });
});
