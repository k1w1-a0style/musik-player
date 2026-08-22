import React from 'react';
import { Pressable as MockPressable, Text as MockText, View as MockView } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import App, { AppContent } from '../App';
import AppErrorBoundary from '../components/AppErrorBoundary';

const mockUseFonts = jest.fn((_fonts: unknown): [boolean, Error?] => [true]);

jest.mock('expo-font', () => ({
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
    jest.restoreAllMocks();
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

  test('continues with system fonts when custom font loading fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockUseFonts.mockReturnValueOnce([false, new Error('font unavailable')]);

    const { getByTestId } = render(<AppContent />);

    await waitFor(() => expect(getByTestId('app-providers')).toBeTruthy());
    expect(warn).toHaveBeenCalledWith(
      '[Fonts] Custom fonts failed to load; using the system fallback.',
      'Error: font unavailable',
    );
  });

  test('renders providers and navigation after startup restoration', async () => {
    const { getByTestId } = render(<App />);

    await waitFor(() => expect(getByTestId('app-providers')).toBeTruthy());
    expect(getByTestId('themed-status-bar')).toBeTruthy();
    expect(getByTestId('root-navigator')).toBeTruthy();
  });

  test('does not block providers and navigation while tag-write recovery is pending', async () => {
    let finishRecovery!: () => void;
    const pending = new Promise<void>(resolve => { finishRecovery = resolve; });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const recovery = require('../utils/tagWriterRecovery') as typeof import('../utils/tagWriterRecovery');
    jest.spyOn(recovery, 'restoreAndReconcileTagWrites').mockImplementationOnce(() => pending.then(() => []));

    const { getByTestId, queryByTestId } = render(<AppContent />);

    expect(getByTestId('app-providers')).toBeTruthy();
    expect(getByTestId('root-navigator')).toBeTruthy();
    expect(queryByTestId('app-loading')).toBeNull();

    await act(async () => { finishRecovery(); await pending; });
  });

  test('keeps the app available when background tag-write restoration fails', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const recovery = require('../utils/tagWriterRecovery') as typeof import('../utils/tagWriterRecovery');
    jest.spyOn(recovery, 'restoreAndReconcileTagWrites').mockRejectedValueOnce(new Error('storage unavailable'));
    const { getByTestId, queryByTestId } = render(<AppContent />);

    await waitFor(() => expect(getByTestId('app-providers')).toBeTruthy());
    expect(queryByTestId('app-loading')).toBeNull();
    await waitFor(() => expect(warning).toHaveBeenCalledWith(
      '[TagWriter] Startup recovery reconciliation failed.',
      'Error: storage unavailable',
    ));
  });

  test('does not restart background tag-write restoration on rerender', async () => {
    let finishRecovery!: () => void;
    const pending = new Promise<void>(resolve => { finishRecovery = resolve; });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const recovery = require('../utils/tagWriterRecovery') as typeof import('../utils/tagWriterRecovery');
    const restore = jest.spyOn(recovery, 'restoreAndReconcileTagWrites')
      .mockImplementationOnce(() => pending.then(() => []));
    const view = render(<AppContent />);

    view.rerender(<AppContent />);
    expect(view.getByTestId('app-providers')).toBeTruthy();
    expect(restore).toHaveBeenCalledTimes(1);
    await act(async () => { finishRecovery(); await pending; });
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
