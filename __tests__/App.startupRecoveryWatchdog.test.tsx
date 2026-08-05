import React from 'react';
import { Text as MockText, View as MockView } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { AppContent } from '../App';
import * as recovery from '../utils/tagWriterRecovery';

jest.mock('@expo-google-fonts/bricolage-grotesque', () => ({
  useFonts: () => [true],
}));

jest.mock('../appFonts', () => ({
  appFonts: { BricolageGrotesque_400Regular: 1 },
}));

jest.mock('../components/AppLoading', () => ({
  __esModule: true,
  default: function MockAppLoading() {
    return <MockView testID="app-loading" />;
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

test('continues into the read-only app after startup recovery times out', async () => {
  jest.spyOn(recovery, 'restoreAndReconcileTagWrites')
    .mockRejectedValueOnce(new recovery.TagWriteStartupTimeoutError());
  const view = render(<AppContent />);

  await waitFor(() => expect(view.getByTestId('app-providers')).toBeTruthy());
  expect(view.queryByTestId('app-loading')).toBeNull();
  expect(view.getByTestId('root-navigator')).toBeTruthy();
});
