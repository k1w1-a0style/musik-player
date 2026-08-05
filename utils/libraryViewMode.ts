import type { LibraryAlbumViewMode } from '../types/LibraryView';

export type LibrarySongViewMode = 'list' | 'gridLarge' | 'gridSmall' | 'banner';

export type LibrarySongCardVariant = 'row' | 'tile' | 'banner';

export const LIBRARY_SONG_VIEW_MODES: readonly LibrarySongViewMode[] = ['list', 'gridLarge', 'gridSmall', 'banner'] as const;

export const DEFAULT_LIBRARY_SONG_VIEW_MODE: LibrarySongViewMode = 'list';

const LIBRARY_SONG_VIEW_MODE_LABELS: Record<LibrarySongViewMode, string> = {
  list: 'Liste',
  gridLarge: 'Raster',
  gridSmall: 'Klein',
  banner: 'Banner',
};

const LIBRARY_SONG_VIEW_COLUMNS: Record<LibrarySongViewMode, number> = {
  list: 1,
  gridLarge: 2,
  gridSmall: 3,
  banner: 1,
};

const LIBRARY_SONG_CARD_VARIANTS: Record<LibrarySongViewMode, LibrarySongCardVariant> = {
  list: 'row',
  gridLarge: 'tile',
  gridSmall: 'tile',
  banner: 'banner',
};

export const isLibrarySongViewMode = (value: unknown): value is LibrarySongViewMode =>
  value === 'list' || value === 'gridLarge' || value === 'gridSmall' || value === 'banner';

export const getLibrarySongViewModeLabel = (mode: LibrarySongViewMode): string => LIBRARY_SONG_VIEW_MODE_LABELS[mode];

export const getLibrarySongViewColumns = (mode: LibrarySongViewMode): number => LIBRARY_SONG_VIEW_COLUMNS[mode];

export const getLibrarySongCardVariant = (mode: LibrarySongViewMode): LibrarySongCardVariant => LIBRARY_SONG_CARD_VARIANTS[mode];

export const getNextLibrarySongViewMode = (mode: LibrarySongViewMode): LibrarySongViewMode => {
  const index = LIBRARY_SONG_VIEW_MODES.indexOf(mode);
  return LIBRARY_SONG_VIEW_MODES[(index + 1) % LIBRARY_SONG_VIEW_MODES.length];
};

// Album list view domain.
export const DEFAULT_LIBRARY_ALBUM_VIEW_MODE: LibraryAlbumViewMode = 'grid';

export const isLibraryAlbumViewMode = (value: unknown): value is LibraryAlbumViewMode =>
  value === 'grid' || value === 'list';
