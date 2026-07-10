import React from 'react';
import { StyleSheet } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { AppThemeProvider } from '../../contexts/AppThemeContext';
import { getAppTheme } from '../../utils/appTheme';
import TagEditorFields from '../TagEditorFields';
import TrackInfoRow from '../TrackInfoRow';
import EqualizerPresetList from '../EqualizerPresetList';
import EqualizerStatusCard from '../EqualizerStatusCard';

let mockStoredAppearance: 'dark' | 'light' = 'dark';
let mockStoredSkin: 'graphite' | 'minimal' | 'neon-cover' = 'graphite';

jest.mock('../../utils/storage', () => ({
  storage: {
    getAppAppearance: jest.fn(() => Promise.resolve(mockStoredAppearance)),
    getAppThemeSkin: jest.fn(() => Promise.resolve(mockStoredSkin)),
    setAppAppearance: jest.fn(),
    setAppThemeSkin: jest.fn(),
  },
}));

jest.mock('../../components/GlassCard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const renderWithProvider = (ui: React.ReactElement) => render(<AppThemeProvider>{ui}</AppThemeProvider>);

beforeEach(() => {
  mockStoredAppearance = 'dark';
  mockStoredSkin = 'graphite';
});

test('TagEditor fields render inside AppThemeProvider with light theme input colors', async () => {
  mockStoredAppearance = 'light';
  const expectedTheme = getAppTheme('light', 'graphite');
  const { getByTestId } = renderWithProvider(
    <TagEditorFields
      form={{ title: 'Titel', artist: '', album: '', albumArtist: '', genre: '', year: '', trackNumber: '', discNumber: '', comment: '' }}
      editable
      onChangeField={jest.fn()}
    />,
  );

  await waitFor(() => {
    const titleInputStyle = StyleSheet.flatten(getByTestId('input-title').props.style);
    expect(titleInputStyle.color).toBe(expectedTheme.palette.text.primary);
    expect(titleInputStyle.backgroundColor).toBe(expectedTheme.palette.surface);
    expect(getByTestId('input-title').props.placeholderTextColor).toBe(expectedTheme.palette.text.muted);
  });
});

test('TrackInfo row renders inside AppThemeProvider with dynamic text color', async () => {
  mockStoredAppearance = 'light';
  mockStoredSkin = 'minimal';
  const expectedTheme = getAppTheme('light', 'minimal');
  const { getByText } = renderWithProvider(<TrackInfoRow label="Codec" value="AAC" />);

  await waitFor(() => {
    const rowStyle = StyleSheet.flatten(getByText('Codec: AAC').props.style);
    expect(rowStyle.color).toBe(expectedTheme.palette.text.secondary);
  });
});

test('Equalizer status card and preset list render with AppThemeProvider in dark and light themes', async () => {
  mockStoredAppearance = 'dark';
  const darkTheme = getAppTheme('dark', 'graphite');
  const darkRender = renderWithProvider(
    <>
      <EqualizerStatusCard eqNative={null} />
      <EqualizerPresetList eqPreset="flat" onApplyPreset={jest.fn()} />
    </>,
  );

  await waitFor(() => {
    const badgeStyle = StyleSheet.flatten(darkRender.getByText('○ NUR UI').props.style);
    expect(badgeStyle.color).toBe(darkTheme.palette.warning);
    expect(JSON.stringify(darkRender.getByTestId('equalizer-preset-flat').props.style)).toContain(darkTheme.palette.primary);
  });

  darkRender.unmount();
  mockStoredAppearance = 'light';
  const lightTheme = getAppTheme('light', 'graphite');
  const lightRender = renderWithProvider(
    <>
      <EqualizerStatusCard eqNative={null} />
      <EqualizerPresetList eqPreset="custom" onApplyPreset={jest.fn()} />
    </>,
  );

  await waitFor(() => {
    const statusStyle = StyleSheet.flatten(lightRender.getByText(/Native Equalizer-API nicht verfügbar/).props.style);
    expect(statusStyle.color).toBe(lightTheme.palette.text.secondary);
    expect(JSON.stringify(lightRender.getByTestId('equalizer-preset-custom').props.style)).toContain(lightTheme.palette.primary);
  });
});
