import {
  useLibraryImportActions,
  useLibraryMetadataRefreshActions,
  useLibraryRenderers,
  useLibraryScanFolderActions,
  useLibraryStoredState,
} from '../libraryHooks';
import { useLibraryImportActions as directUseLibraryImportActions } from '../useLibraryImportActions';
import { useLibraryMetadataRefreshActions as directUseLibraryMetadataRefreshActions } from '../useLibraryMetadataRefreshActions';
import { useLibraryRenderers as directUseLibraryRenderers } from '../useLibraryRenderers';
import { useLibraryScanFolderActions as directUseLibraryScanFolderActions } from '../useLibraryScanFolderActions';
import { useLibraryStoredState as directUseLibraryStoredState } from '../useLibraryStoredState';

test('exports library hooks', () => {
  expect(useLibraryImportActions).toBe(directUseLibraryImportActions);
  expect(useLibraryMetadataRefreshActions).toBe(directUseLibraryMetadataRefreshActions);
  expect(useLibraryRenderers).toBe(directUseLibraryRenderers);
  expect(useLibraryScanFolderActions).toBe(directUseLibraryScanFolderActions);
  expect(useLibraryStoredState).toBe(directUseLibraryStoredState);
});
