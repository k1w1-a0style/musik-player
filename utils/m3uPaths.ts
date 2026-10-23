// Provider IDs are opaque. Only Android's external-storage document contract
// exposes a real volume/path; never infer a path from a display name or title.
export const localPlaylistPath = (location: string): string | null => {
  try {
    if (/^content:\/\/com\.android\.externalstorage\.documents\//.test(location)) {
      const id = decodeURIComponent(location.split('/document/')[1] ?? '');
      const colon = id.indexOf(':');
      if (colon < 1) return null;
      const volume = id.slice(0, colon);
      if (!/^(primary|[A-Fa-f0-9-]+)$/.test(volume)) return null;
      return normalizePath(`/storage/${volume === 'primary' ? 'emulated/0' : volume}/${id.slice(colon + 1)}`);
    }
    if (/^file:\/\//i.test(location)) {
      const match = /^file:\/\/(?:localhost)?(\/[^?#]*)$/i.exec(location);
      return match ? normalizePath(decodeURIComponent(match[1])) : null;
    }
    return location.startsWith('/') && !location.startsWith('//') ? normalizePath(location) : null;
  } catch { return null; }
};

const normalizePath = (path: string): string | null => {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  const normalized = `/${parts.join('/')}`;
  return normalized.replace(/^\/sdcard\//, '/storage/emulated/0/');
};

export const m3uLocationKey = (location: string, playlistUri?: string): string | null => {
  if (/[\u0000-\u001f\u007f]/.test(location) || location.length > 8192) return null;
  const path = localPlaylistPath(location);
  if (path) return `path:${path}`;
  if (/^content:\/\/[^/]+\/.+/.test(location)) return `uri:${location}`;
  if (/^[a-z][a-z0-9+.-]*:|^[/\\]/i.test(location)) return null;
  const base = playlistUri ? localPlaylistPath(playlistUri) : null;
  if (!base) return null;
  const resolved = normalizePath(`${base.slice(0, base.lastIndexOf('/'))}/${location.replace(/\\/g, '/')}`);
  return resolved ? `path:${resolved}` : null;
};

export const isRelativeM3uLocation = (location: string): boolean =>
  !/^[a-z][a-z0-9+.-]*:|^[/\\]/i.test(location);
