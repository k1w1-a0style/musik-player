import {
  useLibraryImportActions,
  useLibraryMenuActions,
  useLibraryMetadataRefreshActions,
  useLibraryPlaybackActions,
  useLibraryRenderers,
  useLibraryScanFolderActions,
  useLibraryStoredState,
} from '../libraryHooks';
import { useLibraryImportActions as directUseLibraryImportActions } from '../useLibraryImportActions';
import { useLibraryMenuActions as directUseLibraryMenuActions } from '../useLibraryMenuActions';
import { useLibraryMetadataRefreshActions as directUseLibraryMetadataRefreshActions } from '../useLibraryMetadataRefreshActions';
import { useLibraryPlaybackActions as directUseLibraryPlaybackActions } from '../useLibraryPlaybackActions';
import { useLibraryRenderers as directUseLibraryRenderers } from '../useLibraryRenderers';
import { useLibraryScanFolderActions as directUseLibraryScanFolderActions } from '../useLibraryScanFolderActions';
import { useLibraryStoredState as directUseLibraryStoredState } from '../useLibraryStoredState';

test('exports library hooks', () => {
  expect(useLibraryImportActions).toBe(directUseLibraryImportActions);
  expect(useLibraryMenuActions).toBe(directUseLibraryMenuActions);
  expect(useLibraryMetadataRefreshActions).toBe(directUseLibraryMetadataRefreshActions);
  expect(useLibraryPlaybackActions).toBe(directUseLibraryPlaybackActions);
  expect(useLibraryRenderers).toBe(directUseLibraryRenderers);
  expect(useLibraryScanFolderActions).toBe(directUseLibraryScanFolderActions);
  expect(useLibraryStoredState).toBe(directUseLibraryStoredState);
});
