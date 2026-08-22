import SystemAudio from 'expo-system-audio';
import type { Song } from '../types/Song';
import { isAbortError, isTimeoutError, withTimeout } from './withTimeout';
import {
  clearWaveformFailure,
  getWaveformFailureBackoff,
  recordWaveformFailure,
  scheduleNativeWaveformExtraction,
  type WaveformExtractionPriority,
  WaveformSchedulerUnavailableError,
} from './waveformExtractionLifecycle';
import { buildFallbackWaveform, buildNativeWaveform, getWaveformSourceIdentity } from './waveformGenerator';
import { DEFAULT_WAVEFORM_POINT_COUNT, type NativeWaveformResult, type SongWaveform } from './waveformTypes';
import {
  classifyWaveformContainer,
  type NativeWaveformDecision,
  type WaveformSourceDiagnostics,
} from './waveformDecision';

export const WAVEFORM_EXTRACTION_TIMEOUT_MS = 25_000;
let waveformRequestSequence = 0;

const nextWaveformRequestId = (): string =>
  `waveform-${Date.now().toString(36)}-${(++waveformRequestSequence).toString(36)}`;

export const resolveWaveformUri = (song: Song | null | undefined): string | undefined =>
  song?.fileInfo?.uri ?? song?.uri;

export const buildImmediateWaveform = (
  song: Song | null | undefined,
  durationMs: number,
  pointCount = DEFAULT_WAVEFORM_POINT_COUNT,
): SongWaveform => buildFallbackWaveform(song, durationMs, pointCount);

export const hasUsefulNativeShape = (points: readonly number[]): boolean => {
  const finite = points.filter(point => Number.isFinite(point));
  if (finite.length < 8) return false;
  // A decoded silent passage or an intentionally flat master is still valid
  // audio evidence. Shape/variance gates used for packet-size approximations
  // would incorrectly reject exactly those files.
  return finite.length === points.length && finite.every(point => point >= 0 && point <= 1);
};

type DecisionReporter = (decision: NativeWaveformDecision, nativePointCount: number) => void;
type NativeWaveformExtractor = (
  uri: string,
  pointCount?: number,
  requestId?: string,
) => Promise<NativeWaveformResult | null>;

interface NativeWaveformCancellationApi {
  hasNativeWaveformCancellation?: boolean;
  cancelWaveformExtraction?: (requestId: string) => boolean;
}

const runScheduledNativeExtraction = (
  extractor: NativeWaveformExtractor,
  cancellationApi: NativeWaveformCancellationApi,
  uri: string,
  pointCount: number,
  extractionKey: string,
  signal?: AbortSignal,
  priority: WaveformExtractionPriority = 'foreground',
): Promise<NativeWaveformResult | null> => withTimeout(
  waiterSignal => scheduleNativeWaveformExtraction(
    extractionKey,
    async nativeSignal => {
      if (!cancellationApi.hasNativeWaveformCancellation || !cancellationApi.cancelWaveformExtraction) {
        return extractor(uri, pointCount);
      }
      const requestId = nextWaveformRequestId();
      const cancel = () => { cancellationApi.cancelWaveformExtraction?.(requestId); };
      nativeSignal.addEventListener('abort', cancel, { once: true });
      try {
        if (nativeSignal.aborted) cancel();
        return await extractor(uri, pointCount, requestId);
      } finally {
        nativeSignal.removeEventListener('abort', cancel);
      }
    },
    waiterSignal,
    {
      priority,
      rejoinDetached: !cancellationApi.hasNativeWaveformCancellation
        || !cancellationApi.cancelWaveformExtraction,
    },
  ),
  WAVEFORM_EXTRACTION_TIMEOUT_MS,
  'Waveform extraction timed out',
  { signal },
);

const acceptDecodedNativeResult = ({
  result, song, durationMs, pointCount, sourceKey, sourceFingerprint,
  extractionKey, report, recordFailures,
}: {
  result: NativeWaveformResult | null;
  song: Song | null | undefined;
  durationMs: number;
  pointCount: number;
  sourceKey: string;
  sourceFingerprint: string;
  extractionKey: string;
  report: DecisionReporter;
  recordFailures: boolean;
}): SongWaveform | null => {
  const recordFailure = (reason: Parameters<typeof recordWaveformFailure>[1]): void => {
    if (recordFailures) recordWaveformFailure(extractionKey, reason);
  };
  const points = result?.points ?? [];
  if (!result || points.length === 0) {
    recordFailure('native-empty');
    report('native-empty', 0);
    return null;
  }
  // Older Development APKs returned compressed packet sizes. Those values can
  // visibly contradict silence/peaks in the actual audio and are never shown.
  if (result.analysis !== 'decoded-pcm-v1') {
    recordFailure('native-unsupported-analysis');
    report('native-unsupported-analysis', points.length);
    return null;
  }
  if (!hasUsefulNativeShape(points)) {
    recordFailure('native-unusable-shape');
    report('native-unusable-shape', points.length);
    return null;
  }
  const waveform = buildNativeWaveform(song, result, durationMs, pointCount);
  if (waveform.sourceKey !== sourceKey || waveform.sourceFingerprint !== sourceFingerprint) {
    report('native-source-key-changed', points.length);
    return null;
  }
  report('native-accepted', points.length);
  clearWaveformFailure(extractionKey);
  return waveform;
};

const handleNativeExtractionError = (
  error: unknown,
  extractionKey: string,
  report: DecisionReporter,
  recordFailures: boolean,
): null => {
  if (isAbortError(error)) return null;
  if (error instanceof WaveformSchedulerUnavailableError) {
    // Global capacity pressure is transient; do not create source backoff.
    report('native-scheduler-unavailable', 0);
    return null;
  }
  if (isTimeoutError(error)) {
    if (recordFailures) recordWaveformFailure(extractionKey, 'native-timeout');
    report('native-timeout', 0);
    return null;
  }
  if (recordFailures) recordWaveformFailure(extractionKey, 'native-error');
  report('native-error', 0);
  return null;
};

export const extractNativeWaveform = async (
  song: Song | null | undefined,
  durationMs: number,
  options?: {
    pointCount?: number;
    signal?: AbortSignal;
    priority?: WaveformExtractionPriority;
    onDecision?: (diagnostics: WaveformSourceDiagnostics) => void;
  },
): Promise<SongWaveform | null> => {
  const uri = resolveWaveformUri(song);
  const { sourceKey, sourceFingerprint } = getWaveformSourceIdentity(song);
  const extractionKey = sourceFingerprint;
  const pointCount = options?.pointCount ?? DEFAULT_WAVEFORM_POINT_COUNT;
  const priority = options?.priority ?? 'foreground';
  const recordFailures = priority === 'foreground';
  const container = classifyWaveformContainer(uri);
  const report = (decision: NativeWaveformDecision, nativePointCount: number): void => {
    options?.onDecision?.({
      container,
      decision,
      source: decision === 'native-accepted' ? 'native' : 'fallback',
      nativePointCount,
    });
  };
  const extractor = (SystemAudio as unknown as {
    extractWaveformPeaks?: NativeWaveformExtractor;
  }).extractWaveformPeaks;
  const cancellationApi = SystemAudio as NativeWaveformCancellationApi;

  if (!uri) {
    report('no-uri', 0);
    return null;
  }
  if (!extractor) {
    report('no-native-extractor', 0);
    return null;
  }

  if (getWaveformFailureBackoff(extractionKey)) return null;

  try {
    const result = await runScheduledNativeExtraction(
      extractor, cancellationApi, uri, pointCount, extractionKey, options?.signal, priority,
    );
    return acceptDecodedNativeResult({
      result, song, durationMs, pointCount, sourceKey, sourceFingerprint,
      extractionKey, report, recordFailures,
    });
  } catch (error) {
    return handleNativeExtractionError(error, extractionKey, report, recordFailures);
  }
};
