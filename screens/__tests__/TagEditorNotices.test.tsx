import React from 'react';
import { render } from '@testing-library/react-native';
import TagEditorNotices from '../TagEditorNotices';
import { getAppTheme } from '../../utils/appTheme';

const mockTheme = getAppTheme('dark', 'graphite');

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({ theme: mockTheme }),
}));

jest.mock('../../utils/appThemeOverlays', () => ({
  getTagEditorWarningBoxColors: () => ({ backgroundColor: '#111111', borderColor: '#222222' }),
}));

describe('TagEditorNotices', () => {
  test('renders the blocking reason before the capability reason', () => {
    const { getByText, queryByText } = render(
      <TagEditorNotices
        capabilityMessage="Capability message"
        blockedReasonMessage="Blocking message"
        safetyMessage="Safety message"
      />,
    );

    expect(getByText('Blocking message')).toBeTruthy();
    expect(queryByText('Capability message')).toBeNull();
    expect(getByText('Safety message')).toBeTruthy();
  });

  test('does not duplicate the same warning as info text', () => {
    const { getAllByText } = render(
      <TagEditorNotices
        blockedReasonMessage="Same message"
        safetyMessage="Same message"
      />,
    );

    expect(getAllByText('Same message')).toHaveLength(1);
  });
});
