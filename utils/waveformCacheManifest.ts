import { hashString128 } from './stringHash';
import { hasBassEnvelope } from './coverBassPulse';
import { isWaveformFileName } from './waveformFileStore';
import { isWaveformSourceIdentity, WAVEFORM_FINGERPRINT_PREFIX,
  type SongWaveform, type WaveformSourceIdentity } from './waveformTypes';

export const MAX_PERSISTED_WAVEFORM_BYTES = 128 * 1024 * 1024;
export const MAX_WAVEFORM_PAYLOAD_BYTES = 1024 * 1024;
export const MAX_WAVEFORM_MANIFEST_BYTES = 8 * 1024 * 1024;
export interface WaveformManifestEntry extends WaveformSourceIdentity {
  fileName: string;
  bytes: number;
  checksum: string;
  source: SongWaveform['source'];
  hasBass: boolean;
  generatedAt: number;
}
export const waveformPayloadBytes = (raw: string): number => {
  // JSON arrays and identities are ASCII in normal use; count UTF-8 correctly
  // for imported legacy keys too, without allocating a second encoded payload.
  let bytes = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && raw.charCodeAt(index + 1) >= 0xdc00
      && raw.charCodeAt(index + 1) <= 0xdfff) { bytes += 4; index += 1; }
    else bytes += 3;
  }
  return bytes;
};
export const waveformManifestEntry = (waveform: SongWaveform, raw: string): WaveformManifestEntry => {
  const checksum = hashString128(raw);
  return {
    sourceKey: waveform.sourceKey, sourceFingerprint: waveform.sourceFingerprint,
    fileName: `${waveform.sourceFingerprint.slice(WAVEFORM_FINGERPRINT_PREFIX.length)}-${checksum}.json`,
    bytes: waveformPayloadBytes(raw), checksum, source: waveform.source,
    hasBass: hasBassEnvelope(waveform), generatedAt: waveform.generatedAt,
  };
};
const isEntry = (value: unknown): value is WaveformManifestEntry => {
  if (!isWaveformSourceIdentity(value)) return false;
  const entry = value as Partial<WaveformManifestEntry>;
  return typeof entry.fileName === 'string' && isWaveformFileName(entry.fileName)
    && typeof entry.checksum === 'string' && /^[0-9a-f]{32}$/.test(entry.checksum)
    && entry.fileName === `${entry.sourceFingerprint!.slice(WAVEFORM_FINGERPRINT_PREFIX.length)}-${entry.checksum}.json`
    && Number.isSafeInteger(entry.bytes) && entry.bytes! > 0 && entry.bytes! <= MAX_WAVEFORM_PAYLOAD_BYTES
    && (entry.source === 'native' || entry.source === 'fallback') && typeof entry.hasBass === 'boolean'
    && typeof entry.generatedAt === 'number' && Number.isFinite(entry.generatedAt) && entry.generatedAt >= 0;
};
export const serializeWaveformManifest = (entries: WaveformManifestEntry[]): string =>
  JSON.stringify({ format: 1, entries, checksum: hashString128(JSON.stringify(entries)) });

export const parseWaveformManifest = (raw: string | null): WaveformManifestEntry[] | null => {
  if (!raw || raw.length > MAX_WAVEFORM_MANIFEST_BYTES || waveformPayloadBytes(raw) > MAX_WAVEFORM_MANIFEST_BYTES) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.format !== 1 || !Array.isArray(value.entries) || !value.entries.every(isEntry)
      || value.checksum !== hashString128(JSON.stringify(value.entries))) return null;
    const entries = value.entries as WaveformManifestEntry[];
    if (new Set(entries.map(entry => entry.sourceKey)).size !== entries.length
      || entries.reduce((bytes, entry) => bytes + entry.bytes, 0) > MAX_PERSISTED_WAVEFORM_BYTES) return null;
    return entries;
  } catch { return null; }
};
/** Newest/recently used entries win only when the byte budget is exhausted. */
export const fitWaveformManifest = (entries: WaveformManifestEntry[]): {
  active: WaveformManifestEntry[]; stale: WaveformManifestEntry[];
} => {
  const active: WaveformManifestEntry[] = []; const stale: WaveformManifestEntry[] = [];
  let bytes = 0; let manifestBytes = 128;
  for (const entry of entries) {
    const entryBytes = waveformPayloadBytes(JSON.stringify(entry)) + 1;
    if (bytes + entry.bytes > MAX_PERSISTED_WAVEFORM_BYTES
      || manifestBytes + entryBytes > MAX_WAVEFORM_MANIFEST_BYTES) stale.push(entry);
    else { active.push(entry); bytes += entry.bytes; manifestBytes += entryBytes; }
  }
  return { active, stale };
};
