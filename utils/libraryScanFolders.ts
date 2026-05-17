import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from './libraryTabs';
import { displayFolderName } from './libraryPresentation';

interface BuildScanFolderOptions {
  now?: () => number;
  random?: () => number;
}

interface DirectoryPermissionResultLike {
  granted?: boolean;
  directoryUri?: string | null;
}

interface GrantedDirectoryPermissionResult {
  granted: true;
  directoryUri: string;
}

interface AvailableScanFolderPickerResult {
  kind: 'available';
}

interface UnsupportedScanFolderPickerResult {
  kind: 'unsupported';
}

type ScanFolderPickerAvailabilityResult = AvailableScanFolderPickerResult | UnsupportedScanFolderPickerResult;

interface GrantedDirectoryPermissionSelectionResult {
  kind: 'granted';
  directoryUri: string;
}

interface CancelledDirectoryPermissionSelectionResult {
  kind: 'cancelled';
}

type DirectoryPermissionSelectionResult = GrantedDirectoryPermissionSelectionResult | CancelledDirectoryPermissionSelectionResult;

interface ScanFolderStateUpdate {
  scanFolders: ScanFolder[];
  activeTab: LibraryTab;
}

interface AddedScanFolderResult {
  kind: 'added';
  update: ScanFolderStateUpdate;
}

interface DuplicateScanFolderResult {
  kind: 'duplicate';
}

type ScanFolderAddResult = AddedScanFolderResult | DuplicateScanFolderResult;

const randomSuffix = (random: () => number): string =>
  random().toString(36).slice(2, 8);

export const getEnabledScanFolders = (folders: ScanFolder[]): ScanFolder[] =>
  folders.filter(folder => folder.enabled);

export const canUseScanFolderPicker = (platformOs: string): boolean =>
  platformOs === 'android';

export const buildScanFolderPickerAvailabilityResult = (platformOs: string): ScanFolderPickerAvailabilityResult => {
  if (!canUseScanFolderPicker(platformOs)) return { kind: 'unsupported' };

  return { kind: 'available' };
};

export const hasGrantedDirectoryPermission = (permission: DirectoryPermissionResultLike): permission is GrantedDirectoryPermissionResult =>
  permission.granted === true && typeof permission.directoryUri === 'string' && permission.directoryUri.length > 0;

export const buildDirectoryPermissionSelectionResult = (permission: DirectoryPermissionResultLike): DirectoryPermissionSelectionResult => {
  if (!hasGrantedDirectoryPermission(permission)) return { kind: 'cancelled' };

  return { kind: 'granted', directoryUri: permission.directoryUri };
};

export const wasScanFolderAdded = (previousFolders: ScanFolder[], nextFolders: ScanFolder[]): boolean =>
  nextFolders.length > previousFolders.length;

export const buildScanFolderStateUpdate = (scanFolders: ScanFolder[]): ScanFolderStateUpdate => ({
  scanFolders,
  activeTab: 'folders',
});

export const buildScanFolderAddResult = (previousFolders: ScanFolder[], nextFolders: ScanFolder[]): ScanFolderAddResult => {
  if (!wasScanFolderAdded(previousFolders, nextFolders)) return { kind: 'duplicate' };

  return { kind: 'added', update: buildScanFolderStateUpdate(nextFolders) };
};

export const buildScanFolderFromDirectoryUri = (
  directoryUri: string,
  options: BuildScanFolderOptions = {},
): ScanFolder => {
  const addedAt = options.now?.() ?? Date.now();
  const suffix = randomSuffix(options.random ?? Math.random);
  const id = `${addedAt}-${suffix}`;

  return {
    id,
    name: displayFolderName({ id, name: '', uri: directoryUri, addedAt, enabled: true }),
    uri: directoryUri,
    addedAt,
    enabled: true,
  };
};
