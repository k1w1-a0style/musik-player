import SystemAudio from 'expo-system-audio';
import { getAndroidStorageSourceKey } from './androidStorageSourceIdentity';
/** Source identity is not display text. Preserve path/document case and URI
 * semantics; only remove an enclosing SAF tree when the same encoded document
 * segment is present. A filename/size/duration match is never identity proof. */
const canonicalSegment = (segment: string): string => {
  try { return encodeURIComponent(decodeURIComponent(segment)); }
  catch { return segment; }
};

export const getSongSourceKey = (uri?: string): string | undefined => {
  const raw = uri?.trim();
  if (!raw) return undefined;
  const android = getAndroidStorageSourceKey(raw, SystemAudio?.primaryStoragePath);
  if (android) return android;
  const document = /^(content:\/\/[^/?#]+)\/(?:tree\/[^/?#]+\/)?document\/([^/?#]+)([?#].*)?$/i.exec(raw);
  if (document) return `${document[1]}/document/${canonicalSegment(document[2])}${document[3] ?? ''}`;
  const file = /^(file:\/\/)([^/?#]*)(\/[^?#]*)(?:[?#].*)?$/i.exec(raw);
  if (file) return `file://${file[2]}${file[3].split('/').map(canonicalSegment).join('/')}`;
  return raw;
};

