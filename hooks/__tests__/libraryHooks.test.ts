import {
  useLibraryImportActions,
  useLibraryMetadataRefreshActions,
  useLibraryScanFolderActions,
  useLibraryStoredState,
} from '../libraryHooks';
import { useLibraryImportActions as directUseLibraryImportActions } from '../useLibraryImportActions';
import { useLibraryMetadataRefreshActions as directUseLibraryMetadataRefreshActions } from '../useLibraryMetadataRefreshActions';
import { useLibraryScanFolderActions as directUseLibraryScanFolderActions } from '../useLibraryScanFolderActions';
import { useLibraryStoredState as directUseLibraryStoredState } from '../useLibraryStoredState';

test('exports library hooks', () => {
  expect(useLibraryImportActions).toBe(directUseLibraryImportActions);
  expect(useLibraryMetadataRefreshActions).toBe(directUseLibraryMetadataRefreshActions);
  expect(useLibraryScanFolderActions).toBe(directUseLibraryScanFolderActions);
  expect(useLibraryStoredState).toBe(directUseLibraryStoredState);
});
