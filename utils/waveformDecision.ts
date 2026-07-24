import type { WaveformSource } from './waveformTypes';

/**
 * Traceability helpers for the native-vs-fallback waveform decision.
 *
 * The extraction pipeline collapses many distinct outcomes into a single
 * `SongWaveform | null`. For MP3 vs M4A parity debugging we want to know *why*
 * a given track ended up on the native or the fallback path without changing
 * any playback/seeking behavior. These helpers stay pure so they can be unit
 * tested and reused by a `__DEV__`-guarded logger.
 */

export type WaveformContainer =
  | 'mp3'
  | 'm4a'
  | 'mp4'
  | 'aac'
  | 'flac'
  | 'wav'
  | 'ogg'
  | 'opus'
  | 'other';

export type NativeWaveformDecision =
  | 'no-uri'
  | 'no-native-extractor'
  | 'native-empty'
  | 'native-unusable-shape'
  | 'native-source-key-changed'
  | 'native-timeout'
  | 'native-error'
  | 'native-accepted';

const CONTAINER_BY_EXTENSION: Record<string, WaveformContainer> = {
  mp3: 'mp3',
  m4a: 'm4a',
  m4b: 'm4a',
  mp4: 'mp4',
  aac: 'aac',
  flac: 'flac',
  wav: 'wav',
  wave: 'wav',
  ogg: 'ogg',
  oga: 'ogg',
  opus: 'opus',
};

/**
 * Best-effort container classification from a file URI/extension. Query strings
 * and fragments are stripped first so `content://`/`file://` URIs with trailing
 * params still resolve. Unknown extensions map to `other` (never throws).
 */
export const classifyWaveformContainer = (uri: string | null | undefined): WaveformContainer => {
  if (!uri) return 'other';
  const withoutQuery = uri.split(/[?#]/, 1)[0] ?? '';
  const lastSlash = Math.max(withoutQuery.lastIndexOf('/'), withoutQuery.lastIndexOf('\\'));
  const segment = withoutQuery.slice(lastSlash + 1);
  const lastDot = segment.lastIndexOf('.');
  if (lastDot < 0) return 'other';
  const extension = segment.slice(lastDot + 1).toLowerCase();
  return CONTAINER_BY_EXTENSION[extension] ?? 'other';
};

export const isNativeWaveformAccepted = (decision: NativeWaveformDecision): boolean =>
  decision === 'native-accepted';

/**
 * A decision is only worth logging when the native path was actually attempted
 * and then rejected. Missing URIs, a device without the native extractor and a
 * clean accept are all normal states and must not create warning noise.
 */
export const isNativeWaveformRejectionNoteworthy = (decision: NativeWaveformDecision): boolean =>
  decision === 'native-empty'
  || decision === 'native-unusable-shape'
  || decision === 'native-source-key-changed'
  || decision === 'native-timeout'
  || decision === 'native-error';

export interface WaveformSourceDiagnostics {
  container: WaveformContainer;
  decision: NativeWaveformDecision;
  source: WaveformSource;
  nativePointCount: number;
}

export const describeWaveformDecision = (diagnostics: WaveformSourceDiagnostics): string =>
  `[Waveform] source=${diagnostics.source} decision=${diagnostics.decision} `
  + `container=${diagnostics.container} nativePoints=${diagnostics.nativePointCount}`;
