interface LibraryFolderAlert {
  title: string;
  message: string;
}

export const libraryFolderMessages = {
  unsupportedTitle: 'Nicht unterstützt',
  folderPickerUnsupportedMessage: 'Die Ordnerauswahl wird aktuell nur unter Android unterstützt.',
  folderPickerUnavailableMessage: 'Die Ordnerauswahl ist auf diesem Gerät nicht verfügbar. Nutze stattdessen den normalen Import.',
  cancelledTitle: 'Abgebrochen',
  noFolderSelectedMessage: 'Es wurde kein Ordner ausgewählt.',
  duplicateTitle: 'Hinweis',
  duplicateFolderMessage: 'Dieser Ordner ist bereits in der Scan-Liste.',
  removeFailedTitle: 'Ordner konnte nicht entfernt werden',
  removeFailedMessage: 'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.',
};

export const getScanFolderUnsupportedAlert = (): LibraryFolderAlert => ({
  title: libraryFolderMessages.unsupportedTitle,
  message: libraryFolderMessages.folderPickerUnsupportedMessage,
});

export const getScanFolderUnavailableAlert = (): LibraryFolderAlert => ({
  title: libraryFolderMessages.unsupportedTitle,
  message: libraryFolderMessages.folderPickerUnavailableMessage,
});

export const getScanFolderCancelledAlert = (): LibraryFolderAlert => ({
  title: libraryFolderMessages.cancelledTitle,
  message: libraryFolderMessages.noFolderSelectedMessage,
});

export const getDuplicateScanFolderAlert = (): LibraryFolderAlert => ({
  title: libraryFolderMessages.duplicateTitle,
  message: libraryFolderMessages.duplicateFolderMessage,
});

export const getScanFolderRemoveFailedAlert = (): LibraryFolderAlert => ({
  title: libraryFolderMessages.removeFailedTitle,
  message: libraryFolderMessages.removeFailedMessage,
});
