import {
  formatBytes,
  formatCoverStatus,
  formatDuration,
  formatSampleRate,
} from '../TrackInfo';

describe('TrackInfo formatters', () => {
  test('formatDuration handles unavailable and mm:ss/hh:mm:ss', () => {
    expect(formatDuration(undefined)).toBe('Nicht verfügbar');
    expect(formatDuration(0)).toBe('Nicht verfügbar');
    expect(formatDuration(245000)).toBe('4:05');
    expect(formatDuration(3661000)).toBe('1:01:01');
  });

  test('formatBytes handles unavailable and units', () => {
    expect(formatBytes(undefined)).toBe('Nicht verfügbar');
    expect(formatBytes(0)).toBe('Nicht verfügbar');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1048576)).toBe('1.00 MB');
  });

  test('formatSampleRate handles unavailable and Hz/kHz', () => {
    expect(formatSampleRate(undefined)).toBe('Nicht verfügbar');
    expect(formatSampleRate(0)).toBe('Nicht verfügbar');
    expect(formatSampleRate(960)).toBe('960 Hz');
    expect(formatSampleRate(44100)).toBe('44.1 kHz');
  });

  test('formatCoverStatus maps internal states', () => {
    expect(formatCoverStatus('cached')).toBe('Gecachtes Cover');
    expect(formatCoverStatus('embedded')).toBe('Eingebettetes Cover');
    expect(formatCoverStatus('external')).toBe('Externe URI');
    expect(formatCoverStatus('none')).toBe('Kein eingebettetes Cover gefunden');
    expect(formatCoverStatus('unknown')).toBe('Unbekannt');
    expect(formatCoverStatus(undefined)).toBe('Unbekannt');
  });
});
