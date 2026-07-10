import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import NowPlayingMenuModal from '../NowPlayingMenuModal';

const mockAppTheme = {
  palette: {
    surfaceElevated: '#191B21',
    border: 'rgba(255, 255, 255, 0.08)',
    text: {
      primary: '#F4F5F7',
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

const renderMenu = (patch = {}) => render(
  <NowPlayingMenuModal
    visible
    favorite={false}
    onClose={jest.fn()}
    onOpenTrackInfo={jest.fn()}
    onOpenEqualizer={jest.fn()}
    onToggleFavorite={jest.fn()}
    onSaveQueueAsPlaylist={jest.fn()}
    sleepTimerActive={false}
    onStartSleepTimer={jest.fn()}
    onCancelSleepTimer={jest.fn()}
    {...patch}
  />,
);

test('renders menu actions', () => {
  const { getByText } = renderMenu();

  expect(getByText('Titelinformationen öffnen')).toBeTruthy();
  expect(getByText('Equalizer öffnen')).toBeTruthy();
  expect(getByText('Warteschlange speichern')).toBeTruthy();
  expect(getByText('Zu Favoriten hinzufügen')).toBeTruthy();
  expect(getByText('Sleep-Timer: 15 Minuten')).toBeTruthy();
  expect(getByText('Sleep-Timer: 30 Minuten')).toBeTruthy();
  expect(getByText('Sleep-Timer: 45 Minuten')).toBeTruthy();
  expect(getByText('Sleep-Timer: 60 Minuten')).toBeTruthy();
});

test('calls menu actions', () => {
  const onOpenTrackInfo = jest.fn();
  const onSaveQueueAsPlaylist = jest.fn();
  const onOpenEqualizer = jest.fn();
  const onToggleFavorite = jest.fn();
  const onClose = jest.fn();

  const { getByText } = renderMenu({
    onOpenTrackInfo,
    onSaveQueueAsPlaylist,
    onOpenEqualizer,
    onToggleFavorite,
    onClose,
  });

  fireEvent.press(getByText('Titelinformationen öffnen'));
  fireEvent.press(getByText('Equalizer öffnen'));
  fireEvent.press(getByText('Warteschlange speichern'));
  fireEvent.press(getByText('Zu Favoriten hinzufügen'));

  expect(onOpenTrackInfo).toHaveBeenCalledTimes(1);
  expect(onOpenEqualizer).toHaveBeenCalledTimes(1);
  expect(onSaveQueueAsPlaylist).toHaveBeenCalledTimes(1);
  expect(onToggleFavorite).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(2);
});


test.each([15, 30, 45, 60])('starts %i minute sleep timer and closes the menu', minutes => {
  const onStartSleepTimer = jest.fn();
  const onClose = jest.fn();
  const { getByText } = renderMenu({ onStartSleepTimer, onClose });

  fireEvent.press(getByText(`Sleep-Timer: ${minutes} Minuten`));

  expect(onStartSleepTimer).toHaveBeenCalledWith(minutes);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('renders and cancels an active sleep timer', () => {
  const onCancelSleepTimer = jest.fn();
  const onClose = jest.fn();
  const { getByText } = renderMenu({ sleepTimerActive: true, onCancelSleepTimer, onClose });

  fireEvent.press(getByText('Sleep-Timer abbrechen'));

  expect(onCancelSleepTimer).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('renders remove favorite label when favorite', () => {
  const { getByText } = renderMenu({ favorite: true });
  expect(getByText('Aus Favoriten entfernen')).toBeTruthy();
});

test('uses app theme menu chrome', () => {
  const { getByTestId } = renderMenu();
  const styleText = JSON.stringify(getByTestId('now-playing-menu-card').props.style);

  expect(styleText).toContain(mockAppTheme.palette.surfaceElevated);
  expect(styleText).toContain(mockAppTheme.palette.border);
});
