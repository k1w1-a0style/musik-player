import {
  describeWaveformDecision,
  isNativeWaveformRejectionNoteworthy,
  type WaveformSourceDiagnostics,
} from './waveformDecision';

declare const __DEV__: boolean;

/**
 * Default telemetry is dev-only and throttled by outcome. It keeps native
 * decoder failures diagnosable without producing normal production log noise.
 */
const loggedWaveformDecisionKeys = new Set<string>();

export const resetWaveformDecisionLogThrottleForTests = (): void => {
  loggedWaveformDecisionKeys.clear();
};

const getWaveformDecisionLogKey = (diagnostics: WaveformSourceDiagnostics): string => [
  diagnostics.source,
  diagnostics.decision,
  diagnostics.container ?? 'unknown',
].join('|');

export const logWaveformDecision = (diagnostics: WaveformSourceDiagnostics): void => {
  if (typeof __DEV__ === 'undefined' || !__DEV__
    || !isNativeWaveformRejectionNoteworthy(diagnostics.decision)) return;
  const key = getWaveformDecisionLogKey(diagnostics);
  if (loggedWaveformDecisionKeys.has(key)) return;
  loggedWaveformDecisionKeys.add(key);
  // eslint-disable-next-line no-console
  console.info(describeWaveformDecision(diagnostics));
};

/** Per-load timing separates cache/analysis latency from Metro startup time. */
export const logWaveformTiming = (source: 'cache' | 'native' | 'analysis' | 'unavailable', elapsedMs: number, points: number): void => {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  // eslint-disable-next-line no-console
  console.info('[WaveformTiming]', { source, elapsedMs, points });
};
