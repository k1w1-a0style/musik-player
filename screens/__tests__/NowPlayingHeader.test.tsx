import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import NowPlayingHeader from '../NowPlayingHeader';

const mockAppTheme = {
  palette: {
    text: {
      primary: '#F4F5F7',
      muted: 'rgba(244, 245, 247, 0.42)',
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

test('renders album title and calls header actions', () => {
  const onClose = jest.fn();
  const onMore = jest.fn();
  const { getByTestId, getByText } = render(
    <NowPlayingHeader albumTitle="Mein Album" onClose={onClose} onMore={onMore} />,
  );

  expect(getByText('JETZT LÄUFT')).toBeTruthy();
  expect(getByText('Mein Album')).toBeTruthy();

  fireEvent.press(getByTestId('now-playing-close'));
  fireEvent.press(getByTestId('now-playing-more'));

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onMore).toHaveBeenCalledTimes(1);
});

test('uses app theme text colors', () => {
  const { getByText } = render(
    <NowPlayingHeader albumTitle="Mein Album" onClose={jest.fn()} onMore={jest.fn()} />,
  );

  expect(JSON.stringify(getByText('JETZT LÄUFT').props.style)).toContain(mockAppTheme.palette.text.muted);
  expect(JSON.stringify(getByText('Mein Album').props.style)).toContain(mockAppTheme.palette.text.primary);
});


test('shows sleep timer countdown only when active', () => {
  const inactive = render(
    <NowPlayingHeader albumTitle="Mein Album" onClose={jest.fn()} onMore={jest.fn()} />,
  );
  expect(inactive.getByText('JETZT LÄUFT')).toBeTruthy();
  expect(inactive.queryByText('JETZT LÄUFT · TIMER 14:59')).toBeNull();

  const active = render(
    <NowPlayingHeader
      albumTitle="Mein Album"
      sleepTimerActive
      sleepTimerRemainingSeconds={14 * 60 + 59}
      onClose={jest.fn()}
      onMore={jest.fn()}
    />,
  );

  expect(active.getByText('JETZT LÄUFT · TIMER 14:59')).toBeTruthy();
});
