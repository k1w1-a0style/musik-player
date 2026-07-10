import React from 'react';

const mockAppTheme = {
  palette: {
    primary: '#7C3AED',
    surfaceElevated: '#191B21',
    border: 'rgba(255, 255, 255, 0.08)',
    text: { primary: '#F4F5F7', secondary: '#CCCCCC', muted: '#888888' },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({ theme: mockAppTheme, appearance: 'dark' }),
}));

import { fireEvent, render } from '@testing-library/react-native';
import SongActionMenuModal from '../SongActionMenuModal';

const props = {
  visible: true,
  onClose: jest.fn(),
  onOpenTrackInfo: jest.fn(),
  onOpenPlaylistPicker: jest.fn(),
};

describe('SongActionMenuModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders song actions', () => {
    const screen = render(<SongActionMenuModal {...props} />);

    expect(screen.getByText('Titelinformationen öffnen')).toBeTruthy();
    expect(screen.getByText('Zu Playlist hinzufügen')).toBeTruthy();
  });

  it('opens track info', () => {
    const screen = render(<SongActionMenuModal {...props} />);

    fireEvent.press(screen.getByText('Titelinformationen öffnen'));

    expect(props.onOpenTrackInfo).toHaveBeenCalledTimes(1);
  });

  it('opens playlist picker', () => {
    const screen = render(<SongActionMenuModal {...props} />);

    fireEvent.press(screen.getByText('Zu Playlist hinzufügen'));

    expect(props.onOpenPlaylistPicker).toHaveBeenCalledTimes(1);
  });
});
