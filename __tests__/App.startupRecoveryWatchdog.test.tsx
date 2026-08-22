import React from 'react';
import { Text as MockText, View as MockView } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { AppContent } from '../App';
import * as recovery from '../utils/tagWriterRecovery';

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

test('continues into the read-only app after startup recovery times out', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(recovery, 'restoreAndReconcileTagWrites')
    .mockRejectedValueOnce(new recovery.TagWriteStartupTimeoutError());
  const view = render(<AppContent />);

  await waitFor(() => expect(view.getByTestId('app-providers')).toBeTruthy());
  expect(view.queryByTestId('app-loading')).toBeNull();
  expect(view.getByTestId('root-navigator')).toBeTruthy();
  expect(warning).toHaveBeenCalledWith(
    '[TagWriter] Startup recovery timed out; continuing with tag writes disabled.',
    expect.stringContaining('TagWriteStartupTimeoutError'),
  );
  warning.mockRestore();
});
