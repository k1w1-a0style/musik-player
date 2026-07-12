import {
  getLibraryListShellBackgroundColor,
  getLibraryMenuBackdropColor,
  getNowPlayingBackdropOverlayColors,
  getNowPlayingMenuBackdropColor,
  getNowPlayingSnapPagerInactiveDotColor,
  getNowPlayingSoundCloudOverlayColors,
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

  test('returns SoundCloud overlay colors per appearance', () => {
    expect(getNowPlayingSoundCloudOverlayColors('dark')).toEqual({
      gradient: ['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.78)'],
      titleBackgroundColor: 'rgba(0,0,0,0.78)',
      artistBackgroundColor: 'rgba(0,0,0,0.68)',
      infoBackgroundColor: 'rgba(0,0,0,0.68)',
      playButtonBackgroundColor: 'rgba(0,0,0,0.46)',
      carouselScrimColor: 'rgba(0,0,0,0.16)',
      carouselTitleColor: '#ffffff',
      carouselArtistColor: 'rgba(255,255,255,0.78)',
      carouselTextShadowColor: 'rgba(0,0,0,0.45)',
    });

    expect(getNowPlayingSoundCloudOverlayColors('light')).toEqual({
      gradient: ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.78)'],
      titleBackgroundColor: 'rgba(255,255,255,0.78)',
      artistBackgroundColor: 'rgba(255,255,255,0.68)',
      infoBackgroundColor: 'rgba(255,255,255,0.68)',
      playButtonBackgroundColor: 'rgba(255,255,255,0.46)',
      carouselScrimColor: 'rgba(255,255,255,0.12)',
      carouselTitleColor: '#101318',
      carouselArtistColor: 'rgba(16,19,25,0.78)',
      carouselTextShadowColor: 'rgba(255,255,255,0.45)',
    });
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
