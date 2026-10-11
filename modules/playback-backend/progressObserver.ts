import { addEventListener } from './events';
import { getProgress } from './player';
import { toProgress } from './conversions';
import { subscribeProgressMutation } from './progressMutations';
import { Event, type Progress } from './types';

/** Foreground UI observer only. The native player and remote service retain ownership. */
export const observeProgress = (update: (value: Progress) => void, intervalMs: number, poll: boolean): (() => void) => {
  let active = true; let reading = false; let pending = false; let revision = 0;
  let latest: Progress = { position: 0, duration: 0, buffered: 0 };
  const publish = (value: Progress): void => { latest = value; update(value); };
  const refresh = async (): Promise<void> => {
    if (!active || reading) return;
    reading = true; const requested = ++revision;
    try {
      const next = await getProgress();
      if (active && revision === requested) publish(next);
    } catch { /* Native startup/recovery is handled by the domain. */ }
    finally {
      reading = false;
      if (active && pending) { pending = false; void refresh(); }
    }
  };
  const invalidate = (): void => {
    revision += 1;
    if (reading) pending = true;
    else void refresh();
  };
  const track = addEventListener(Event.PlaybackActiveTrackChanged, invalidate);
  const heartbeat = addEventListener(Event.PlaybackProgressUpdated, payload => {
    if (!active) return;
    revision += 1;
    publish(toProgress({ ...payload, buffered: payload.buffered ?? latest.buffered }));
  });
  const unsubscribeSeek = subscribeProgressMutation(invalidate);
  const timer = poll ? setInterval(() => { void refresh(); }, intervalMs) : undefined;
  void refresh();
  return () => { active = false; clearInterval(timer); track.remove(); heartbeat.remove(); unsubscribeSeek(); };
};
