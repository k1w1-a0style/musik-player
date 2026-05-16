import { libraryFolderMessages } from '../libraryFolderMessages';

test('exports stable scan folder alert messages', () => {
  expect(libraryFolderMessages.unsupportedTitle).toBe('Nicht unterstützt');
  expect(libraryFolderMessages.folderPickerUnsupportedMessage).toBe('Die Ordnerauswahl wird aktuell nur unter Android unterstützt.');
  expect(libraryFolderMessages.folderPickerUnavailableMessage).toBe('Die Ordnerauswahl ist auf diesem Gerät nicht verfügbar. Nutze stattdessen den normalen Import.');
  expect(libraryFolderMessages.cancelledTitle).toBe('Abgebrochen');
  expect(libraryFolderMessages.noFolderSelectedMessage).toBe('Es wurde kein Ordner ausgewählt.');
  expect(libraryFolderMessages.duplicateTitle).toBe('Hinweis');
  expect(libraryFolderMessages.duplicateFolderMessage).toBe('Dieser Ordner ist bereits in der Scan-Liste.');
});
