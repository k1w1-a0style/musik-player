import {
  persistAddedScanFolder,
  persistChangedFolderErrorUpdates,
  persistRemovedScanFolder,
} from '../libraryScanFolderPersistence';
import { persistAddedScanFolder as directPersistAddedScanFolder } from '../libraryScanFolderAddPersistence';
import { persistChangedFolderErrorUpdates as directPersistChangedFolderErrorUpdates } from '../libraryFolderUpdatePersistence';
import { persistRemovedScanFolder as directPersistRemovedScanFolder } from '../libraryScanFolderRemovePersistence';

test('exports scan folder persistence utilities', () => {
  expect(persistAddedScanFolder).toBe(directPersistAddedScanFolder);
  expect(persistChangedFolderErrorUpdates).toBe(directPersistChangedFolderErrorUpdates);
  expect(persistRemovedScanFolder).toBe(directPersistRemovedScanFolder);
});
