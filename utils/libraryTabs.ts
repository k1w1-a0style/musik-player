import type { ScanFolder } from '../types/ScanFolder';

export const LIBRARY_TABS = [
  { key: 'tracks', label: 'Titel' },
  { key: 'favorites', label: 'Favoriten' },
  { key: 'playlists', label: 'Playlisten' },
  { key: 'albums', label: 'Alben' },
  { key: 'artists', label: 'Künstler' },
  { key: 'genres', label: 'Genres' },
  { key: 'folders', label: 'Ordner' },
] as const;

export type LibraryTab = (typeof LIBRARY_TABS)[number]['key'];

export const countActiveScanFolders = (folders: ScanFolder[]): number =>
  folders.filter(folder => folder.enabled).length;

export const getLibraryEmptyMessage = (activeTab: LibraryTab): string => {
  if (activeTab === 'folders') return 'Noch keine Scan-Ordner. Über ⋮ kannst du Ordner hinzufügen.';
  if (activeTab === 'favorites') return 'Noch keine Favoriten markiert.';
  if (activeTab === 'playlists') return 'Noch keine Playlists angelegt. Nutze den Playlists-Tab unten, um eine neue Liste zu erstellen.';
  if (activeTab === 'albums') return 'Keine Alben gefunden. Importiere neu, damit Tags/Cover aktualisiert werden.';
  if (activeTab === 'artists') return 'Keine Interpreten gefunden.';
  if (activeTab === 'genres') return 'Keine Genres gefunden.';
  return 'Keine Treffer gefunden.';
};
