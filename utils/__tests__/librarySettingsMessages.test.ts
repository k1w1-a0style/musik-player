import { getLibrarySettingsComingSoonAlert, librarySettingsMessages } from '../librarySettingsMessages';

test('exports stable settings placeholder messages', () => {
  expect(librarySettingsMessages.title).toBe('Einstellungen');
  expect(librarySettingsMessages.comingSoonMessage).toBe('Theme- und App-Einstellungen kommen im nächsten Schritt.');
});

test('builds settings coming soon alert payload', () => {
  expect(getLibrarySettingsComingSoonAlert()).toEqual({
    title: 'Einstellungen',
    message: 'Theme- und App-Einstellungen kommen im nächsten Schritt.',
  });
});
