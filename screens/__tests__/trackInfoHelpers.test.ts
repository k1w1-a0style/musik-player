import {
  formatBytes,
  formatCoverStatus,
  formatDuration,
  formatSampleRate,
  valueOrNA,
} from '../trackInfoHelpers';

describe('trackInfoHelpers', () => {
  test('formats durations', () => {
    expect(formatDuration()).toBe('Nicht verfügbar');
    expect(formatDuration(0)).toBe('Nicht verfügbar');
    expect(formatDuration(245000)).toBe('4:05');
    expect(formatDuration(3723000)).toBe('1:02:03');
  });

  test('formats bytes', () => {
    expect(formatBytes()).toBe('Nicht verfügbar');
    expect(formatBytes(0)).toBe('Nicht verfügbar');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1048576)).toBe('1.00 MB');
  });

  test('formats sample rates', () => {
    expect(formatSampleRate()).toBe('Nicht verfügbar');
    expect(formatSampleRate(0)).toBe('Nicht verfügbar');
    expect(formatSampleRate(44100)).toBe('44.1 kHz');
    expect(formatSampleRate(800)).toBe('800 Hz');
  });

  test('formats cover status', () => {
    expect(formatCoverStatus('cached')).toBe('Gecachtes Cover');
    expect(formatCoverStatus('embedded')).toBe('Eingebettetes Cover');
    expect(formatCoverStatus('external')).toBe('Externe URI');
    expect(formatCoverStatus('none')).toBe('Kein eingebettetes Cover gefunden');
    expect(formatCoverStatus('unknown')).toBe('Unbekannt');
  });

  test('formats empty values as not available', () => {
    expect(valueOrNA()).toBe('Nicht verfügbar');
    expect(valueOrNA('')).toBe('Nicht verfügbar');
    expect(valueOrNA('Song')).toBe('Song');
    expect(valueOrNA(2024)).toBe('2024');
  });
});
