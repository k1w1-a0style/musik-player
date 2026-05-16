import type { ScanFolder } from '../types/ScanFolder';
import { displayFolderName } from './libraryPresentation';

interface BuildScanFolderOptions {
  now?: () => number;
  random?: () => number;
}

interface DirectoryPermissionResultLike {
  granted?: boolean;
  directoryUri?: string | null;
}

const randomSuffix = (random: () => number): string =>
  random().toString(36).slice(2, 8);

export const getEnabledScanFolders = (folders: ScanFolder[]): ScanFolder[] =>
  folders.filter(folder => folder.enabled);

export const canUseScanFolderPicker = (platformOs: string): boolean =>
  platformOs === 'android';

export const hasGrantedDirectoryPermission = (permission: DirectoryPermissionResultLike): boolean =>
  permission.granted === true && typeof permission.directoryUri === 'string' && permission.directoryUri.length > 0;

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
