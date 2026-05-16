interface LibrarySettingsAlert {
  title: string;
  message: string;
}

export const librarySettingsMessages = {
  title: 'Einstellungen',
  comingSoonMessage: 'Theme- und App-Einstellungen kommen im nächsten Schritt.',
};

export const getLibrarySettingsComingSoonAlert = (): LibrarySettingsAlert => ({
  title: librarySettingsMessages.title,
  message: librarySettingsMessages.comingSoonMessage,
});
