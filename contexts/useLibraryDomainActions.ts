import { useLibraryActions } from './useLibraryActions';
import type { LibraryActions, LibraryActionsArgs } from './useLibraryActions';

export type LibraryDomainActionsInput = LibraryActionsArgs;
export type LibraryDomainActions = LibraryActions;

export const useLibraryDomainActions = (
  input: LibraryDomainActionsInput,
): LibraryDomainActions => useLibraryActions(input);
