import {
  getLibraryListShellBackgroundColor,
  getLibraryMenuBackdropColor,
  getPlaylistModalBackdropColor,
  getNowPlayingBackdropOverlayColors,
  getNowPlayingMenuBackdropColor,
  getNowPlayingSnapPagerInactiveDotColor,
  getNowPlayingWaveformRestColor,
  getTagEditorWarningBoxColors,
} from '../appThemeOverlays';

describe('appThemeOverlays', () => {
  test('returns Now Playing backdrop overlay gradients per appearance', () => {
    expect(getNowPlayingBackdropOverlayColors('dark')).toEqual([
      'rgba(5,6,10,0.0)',
      'rgba(5,6,10,0.55)',
      'rgba(5,6,10,0.95)',
    ]);

    expect(getNowPlayingBackdropOverlayColors('light')).toEqual([
      'rgba(244,245,247,0.0)',
      'rgba(244,245,247,0.44)',
      'rgba(244,245,247,0.86)',
    ]);
  });

  test('returns Now Playing snap pager inactive dot colors per appearance', () => {
    expect(getNowPlayingSnapPagerInactiveDotColor('dark')).toBe('rgba(255,255,255,0.25)');
    expect(getNowPlayingSnapPagerInactiveDotColor('light')).toBe('rgba(16,19,25,0.24)');
  });

  test('returns Now Playing waveform rest colors per appearance', () => {
    expect(getNowPlayingWaveformRestColor('dark')).toBe('rgba(255,255,255,0.22)');
    expect(getNowPlayingWaveformRestColor('light')).toBe('rgba(16,19,25,0.18)');
  });

  test('returns menu backdrop colors per appearance', () => {
    expect(getNowPlayingMenuBackdropColor('dark')).toBe('rgba(0,0,0,0.22)');
    expect(getNowPlayingMenuBackdropColor('light')).toBe('rgba(0,0,0,0.12)');

    expect(getLibraryMenuBackdropColor('dark')).toBe('rgba(0,0,0,0.22)');
    expect(getLibraryMenuBackdropColor('light')).toBe('rgba(0,0,0,0.14)');
  });

  test('returns playlist sheet backdrop colors per appearance', () => {
    expect(getPlaylistModalBackdropColor('dark')).toBe('rgba(0,0,0,0.52)');
    expect(getPlaylistModalBackdropColor('light')).toBe('rgba(0,0,0,0.28)');
  });

  test('returns Library list shell background colors per appearance', () => {
    expect(getLibraryListShellBackgroundColor('dark')).toBe('rgba(255,255,255,0.055)');
    expect(getLibraryListShellBackgroundColor('light')).toBe('rgba(255,255,255,0.62)');
  });

  test('returns TagEditor warning box colors per appearance', () => {
    expect(getTagEditorWarningBoxColors('dark')).toEqual({
      backgroundColor: 'rgba(255, 111, 138, 0.12)',
      borderColor: 'rgba(255, 111, 138, 0.40)',
    });

    expect(getTagEditorWarningBoxColors('light')).toEqual({
      backgroundColor: 'rgba(200, 58, 89, 0.10)',
      borderColor: 'rgba(200, 58, 89, 0.34)',
    });
  });
});
