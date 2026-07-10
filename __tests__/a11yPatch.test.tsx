import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import AppErrorBoundary from '../components/AppErrorBoundary';
import LibraryMenuModal from '../components/LibraryMenuModal';
import EqualizerPresetList from '../screens/EqualizerPresetList';
import NowPlayingMenuModal from '../screens/NowPlayingMenuModal';
import NowPlayingQueuePreviewRow from '../screens/NowPlayingQueuePreviewRow';
import TagEditorActions from '../screens/TagEditorActions';
import TagEditorFields from '../screens/TagEditorFields';
import type { FormState } from '../screens/tagEditorHelpers';

jest.mock('../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
    theme: {
      palette: {
        background: '#07090C',
        surface: '#101218',
        surfaceElevated: '#191B21',
        surfaceGlass: 'rgba(18, 20, 26, 0.76)',
        border: 'rgba(255, 255, 255, 0.08)',
        borderStrong: 'rgba(210, 218, 230, 0.28)',
        primary: '#D8DEE8',
        primaryDark: '#87909E',
        primaryGlow: 'rgba(216, 222, 232, 0.12)',
        error: '#FF6F8A',
        text: {
          primary: '#F4F5F7',
          secondary: 'rgba(244, 245, 247, 0.70)',
          muted: 'rgba(244, 245, 247, 0.42)',
          onPrimary: '#07090C',
        },
      },
      gradients: {
        background: ['#07090C', '#101218'],
        nowPlaying: ['#07090C', '#191B21'],
      },
    },
  }),
}));

const form: FormState = {
  title: 'Titel A',
  artist: 'Künstler A',
  albumArtist: '',
  album: 'Album A',
  year: '2026',
  genre: 'Rock',
  trackNumber: '1',
  discNumber: '1',
  comment: 'Kommentar',
};

describe('V6.6 accessibility patch', () => {
  test('TagEditorActions exposes save and back buttons with labels and state', () => {
    const props = {
      canSave: true,
      saving: false,
      status: null,
      onConfirmSave: jest.fn(),
      onBack: jest.fn(),
    };
    const { getByTestId, getByLabelText, rerender } = render(<TagEditorActions {...props} />);

    expect(getByTestId('save-button').props.accessibilityRole).toBe('button');
    expect(getByTestId('save-button').props.accessibilityLabel).toBe('Metadaten speichern');
    expect(getByTestId('save-button').props.accessibilityState).toEqual({ disabled: false });

    const backButton = getByLabelText('Zurück');
    expect(backButton.props.accessibilityRole).toBe('button');
    expect(backButton.props.accessibilityLabel).toBe('Zurück');

    rerender(<TagEditorActions {...props} saving canSave={false} />);
    expect(getByTestId('save-button').props.accessibilityLabel).toBe('Speichern läuft');
    expect(getByTestId('save-button').props.accessibilityState).toEqual({ disabled: true });
  });

  test('TagEditorFields labels text inputs and mirrors editable state', () => {
    const { getByTestId, rerender } = render(
      <TagEditorFields form={form} editable onChangeField={jest.fn()} />,
    );

    expect(getByTestId('input-title').props.accessibilityLabel).toBe('Titel');
    expect(getByTestId('input-artist').props.accessibilityLabel).toBe('Künstler');
    expect(getByTestId('input-album').props.accessibilityLabel).toBe('Album');
    expect(getByTestId('input-genre').props.accessibilityLabel).toBe('Genre');
    expect(getByTestId('input-title').props.accessibilityState).toEqual({ disabled: false });

    rerender(<TagEditorFields form={form} editable={false} onChangeField={jest.fn()} />);
    expect(getByTestId('input-title').props.accessibilityState).toEqual({ disabled: true });
  });

  test('modal backdrops are not individually accessible while menu items remain rendered', () => {
    const menuProps = {
      visible: true,
      favorite: false,
      onClose: jest.fn(),
      onOpenTrackInfo: jest.fn(),
      onOpenEqualizer: jest.fn(),
      onToggleFavorite: jest.fn(),
      onSaveQueueAsPlaylist: jest.fn(),
      sleepTimerActive: false,
      onStartSleepTimer: jest.fn(),
      onCancelSleepTimer: jest.fn(),
    };
    const { getByTestId, getByText } = render(<NowPlayingMenuModal {...menuProps} />);

    expect(getByTestId('now-playing-menu-backdrop').props.accessible).toBe(false);
    expect(getByText('Titelinformationen öffnen')).toBeTruthy();
    expect(getByText('Warteschlange speichern')).toBeTruthy();

    const libraryProps = {
      visible: true,
      loading: false,
      isReady: true,
      hasSongs: true,
      activeFolders: 2,
      onClose: jest.fn(),
      onImport: jest.fn(),
      onRefreshMetadata: jest.fn(),
      onAddFolder: jest.fn(),
      onShowFolders: jest.fn(),
      onOpenSettings: jest.fn(),
      onOpenEqualizer: jest.fn(),
    };
    const library = render(<LibraryMenuModal {...libraryProps} />);

    expect(library.getByTestId('library-menu-backdrop').props.accessible).toBe(false);
    expect(library.getByText('Metadaten aktualisieren')).toBeTruthy();
    expect(library.getByText('Einstellungen')).toBeTruthy();
  });

  test('queue rows expose button role, playback labels, and selected state', () => {
    const onPress = jest.fn();
    const { getByLabelText, rerender } = render(
      <NowPlayingQueuePreviewRow
        id="song-a"
        title="Titel A"
        artist="Künstler A"
        isCurrent={false}
        onPress={onPress}
      />,
    );

    const row = getByLabelText('Titel A von Künstler A abspielen');
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityState).toEqual({ selected: false });

    rerender(
      <NowPlayingQueuePreviewRow
        id="song-a"
        title="Titel A"
        artist="Künstler A"
        isCurrent
        onPress={onPress}
      />,
    );
    expect(getByLabelText('Titel A von Künstler A abspielen').props.accessibilityState).toEqual({ selected: true });

    rerender(
      <NowPlayingQueuePreviewRow
        id="song-b"
        title="Titel B"
        artist=""
        isCurrent={false}
        onPress={onPress}
      />,
    );
    expect(getByLabelText('Titel B abspielen').props.accessibilityLabel).toBe('Titel B abspielen');
  });

  test('EqualizerPresetList uses German visible labels and exposes preset button state', () => {
    const { getByLabelText, getByText, rerender } = render(
      <EqualizerPresetList eqPreset="rock" onApplyPreset={jest.fn()} />,
    );

    expect(getByText('Voreinstellungen')).toBeTruthy();
    const rockPreset = getByLabelText('Equalizer-Preset Rock anwenden');
    expect(rockPreset.props.accessibilityRole).toBe('button');
    expect(rockPreset.props.accessibilityState).toEqual({ selected: true });

    rerender(<EqualizerPresetList eqPreset="custom" onApplyPreset={jest.fn()} />);
    expect(getByText('Benutzerdefiniert')).toBeTruthy();
  });

  test('AppErrorBoundary reset button is labeled and still resets the fallback', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;

    function ThrowingChild() {
      if (shouldThrow) {
        throw new Error('boom');
      }
      return <Text testID="healthy-child">ok</Text>;
    }

    const { getByTestId, getByLabelText } = render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>,
    );

    const resetButton = getByTestId('app-error-boundary-reset');
    expect(resetButton.props.accessibilityRole).toBe('button');
    expect(resetButton.props.accessibilityLabel).toBe('Neu versuchen');
    expect(getByLabelText('Neu versuchen')).toBeTruthy();

    shouldThrow = false;
    fireEvent.press(resetButton);
    expect(getByTestId('healthy-child')).toBeTruthy();
    consoleError.mockRestore();
  });
});
