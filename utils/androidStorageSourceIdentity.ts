/** Only Android's external-storage provider declares a filesystem volume/path.
 * Opaque cloud/provider documents and display-name matches remain distinct. */
const safePath = (path: string): string | undefined => {
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part.includes('\\') || part.includes('\0'))) return undefined;
  return parts.map(encodeURIComponent).join('/');
};
export const getAndroidStorageSourceKey = (uri: string, primaryRoot?: string): string | undefined => {
  const document = /^content:\/\/com\.android\.externalstorage\.documents\/(?:tree\/[^/?#]+\/)?document\/([^/?#]+)$/.exec(uri);
  if (document) {
    try {
      const decoded = decodeURIComponent(document[1]);
      const split = decoded.indexOf(':');
      const volume = decoded.slice(0, split); const path = safePath(decoded.slice(split + 1));
      if (split > 0 && /^(primary|[\da-fA-F]{4}-[\da-fA-F]{4})$/.test(volume) && path) return `android-storage:${volume}:${path}`;
    } catch { return undefined; }
  }
  const file = /^file:\/\/\/([^?#]*)(?:[?#].*)?$/.exec(uri);
  if (!file) return undefined;
  try {
    const parts = file[1].split('/').map(decodeURIComponent);
    if (parts.some(part => part.includes('/'))) return undefined;
    const decoded = '/' + parts.join('/');
    const root = primaryRoot?.replace(/\/$/, '');
    if (root && decoded.startsWith(root + '/')) {
      const path = safePath(decoded.slice(root.length + 1));
      return path ? `android-storage:primary:${path}` : undefined;
    }
    const secondary = /^\/storage\/([\da-fA-F]{4}-[\da-fA-F]{4})\/(.+)$/.exec(decoded);
    const path = secondary && safePath(secondary[2]);
    return secondary && path ? `android-storage:${secondary[1]}:${path}` : undefined;
  } catch { return undefined; }
};
