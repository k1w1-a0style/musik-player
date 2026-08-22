export interface StartupTimingEvent {
  phase: string;
  outcome: string;
  durationMs: number;
  details?: Readonly<Record<string, number | string | boolean>>;
}

interface StartupTimerOptions {
  now?: () => number;
  log?: (event: StartupTimingEvent) => void;
}

const defaultNow = (): number => globalThis.performance?.now?.() ?? Date.now();

const defaultLog = (event: StartupTimingEvent): void => {
  if (process.env.NODE_ENV === 'test') return;
  // eslint-disable-next-line no-console
  console.info('[StartupTiming]', event);
};

/** Creates an idempotent, data-minimal startup phase timer. */
export const startStartupTimer = (
  phase: string,
  { now = defaultNow, log = defaultLog }: StartupTimerOptions = {},
) => {
  const startedAt = now();
  let finished = false;

  return (
    outcome: string,
    details?: StartupTimingEvent['details'],
  ): StartupTimingEvent | undefined => {
    if (finished) return undefined;
    finished = true;
    const event: StartupTimingEvent = {
      phase,
      outcome,
      durationMs: Math.max(0, Math.round(now() - startedAt)),
      ...(details ? { details } : {}),
    };
    try {
      log(event);
    } catch {
      // Diagnostics must never affect startup correctness.
    }
    return event;
  };
};
