export const formatDuration = (ms?: number): string => {
  if (!ms || ms <= 0) return 'Nicht verfügbar';
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

export const formatBytes = (value?: number): string => {
  if (!value || value <= 0) return 'Nicht verfügbar';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
};

export const formatSampleRate = (value?: number): string => {
  if (!value || value <= 0) return 'Nicht verfügbar';
  if (value >= 1000) return `${(value / 1000).toFixed(1)} kHz`;
  return `${value} Hz`;
};

export const formatCoverStatus = (status?: string): string => {
  switch (status) {
    case 'cached':
      return 'Gecachtes Cover';
    case 'embedded':
      return 'Eingebettetes Cover';
    case 'external':
      return 'Externe URI';
    case 'none':
      return 'Kein eingebettetes Cover gefunden';
    default:
      return 'Unbekannt';
  }
};

export const valueOrNA = (value?: string | number): string =>
  value === undefined || value === null || value === '' ? 'Nicht verfügbar' : String(value);
