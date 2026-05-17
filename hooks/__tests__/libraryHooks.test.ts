import {
  useLibraryAlerts,
  useLibraryComponentProps,
  useLibraryImportActions,
  useLibraryMenuActions,
  useLibraryMetadataRefreshActions,
  useLibraryNavigationActions,
  useLibraryPlaybackActions,
  useLibraryRenderers,
  useLibraryScanFolderActions,
  useLibraryScreenState,
  useLibraryStoredState,
  useLibraryViewState,
} from '../libraryHooks';
import { useLibraryAlerts as directUseLibraryAlerts } from '../useLibraryAlerts';
import { useLibraryComponentProps as directUseLibraryComponentProps } from '../useLibraryComponentProps';
import { useLibraryImportActions as directUseLibraryImportActions } from '../useLibraryImportActions';
import { useLibraryMenuActions as directUseLibraryMenuActions } from '../useLibraryMenuActions';
import { useLibraryMetadataRefreshActions as directUseLibraryMetadataRefreshActions } from '../useLibraryMetadataRefreshActions';
import { useLibraryNavigationActions as directUseLibraryNavigationActions } from '../useLibraryNavigationActions';
import { useLibraryPlaybackActions as directUseLibraryPlaybackActions } from '../useLibraryPlaybackActions';
import { useLibraryRenderers as directUseLibraryRenderers } from '../useLibraryRenderers';
import { useLibraryScanFolderActions as directUseLibraryScanFolderActions } from '../useLibraryScanFolderActions';
import { useLibraryScreenState as directUseLibraryScreenState } from '../useLibraryScreenState';
import { useLibraryStoredState as directUseLibraryStoredState } from '../useLibraryStoredState';
import { useLibraryViewState as directUseLibraryViewState } from '../useLibraryViewState';

test('exports library hooks', () => {
  expect(useLibraryAlerts).toBe(directUseLibraryAlerts);
  expect(useLibraryComponentProps).toBe(directUseLibraryComponentProps);
  expect(useLibraryImportActions).toBe(directUseLibraryImportActions);
  expect(useLibraryMenuActions).toBe(directUseLibraryMenuActions);
  expect(useLibraryMetadataRefreshActions).toBe(directUseLibraryMetadataRefreshActions);
  expect(useLibraryNavigationActions).toBe(directUseLibraryNavigationActions);
  expect(useLibraryPlaybackActions).toBe(directUseLibraryPlaybackActions);
  expect(useLibraryRenderers).toBe(directUseLibraryRenderers);
  expect(useLibraryScanFolderActions).toBe(directUseLibraryScanFolderActions);
  expect(useLibraryScreenState).toBe(directUseLibraryScreenState);
  expect(useLibraryStoredState).toBe(directUseLibraryStoredState);
  expect(useLibraryViewState).toBe(directUseLibraryViewState);
});
