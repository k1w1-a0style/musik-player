import {
  DEFAULT_LIBRARY_SONG_VIEW_MODE,
  LIBRARY_SONG_VIEW_MODES,
  getLibrarySongCardVariant,
  getLibrarySongViewColumns,
  getLibrarySongViewModeLabel,
  getNextLibrarySongViewMode,
  isLibrarySongViewMode,
} from '../libraryViewMode';

describe('libraryViewMode', () => {
  test('defaults and guards', () => {
    expect(DEFAULT_LIBRARY_SONG_VIEW_MODE).toBe('list');
    expect(LIBRARY_SONG_VIEW_MODES).toEqual(['list', 'gridLarge', 'gridSmall', 'banner']);
    expect(isLibrarySongViewMode('banner')).toBe(true);
    expect(isLibrarySongViewMode('mosaic')).toBe(false);
  });

  test('cycles through all view modes', () => {
    expect(getNextLibrarySongViewMode('list')).toBe('gridLarge');
    expect(getNextLibrarySongViewMode('gridLarge')).toBe('gridSmall');
    expect(getNextLibrarySongViewMode('gridSmall')).toBe('banner');
    expect(getNextLibrarySongViewMode('banner')).toBe('list');
  });

  test('maps columns and card variant per mode', () => {
    expect(getLibrarySongViewColumns('list')).toBe(1);
    expect(getLibrarySongViewColumns('gridLarge')).toBe(2);
    expect(getLibrarySongViewColumns('gridSmall')).toBe(3);
    expect(getLibrarySongViewColumns('banner')).toBe(1);

    expect(getLibrarySongCardVariant('list')).toBe('row');
    expect(getLibrarySongCardVariant('gridLarge')).toBe('tile');
    expect(getLibrarySongCardVariant('gridSmall')).toBe('tile');
    expect(getLibrarySongCardVariant('banner')).toBe('banner');
  });

  test('exposes labels', () => {
    expect(getLibrarySongViewModeLabel('list')).toBe('Liste');
    expect(getLibrarySongViewModeLabel('gridLarge')).toBe('Raster');
    expect(getLibrarySongViewModeLabel('gridSmall')).toBe('Klein');
    expect(getLibrarySongViewModeLabel('banner')).toBe('Banner');
  });
});
