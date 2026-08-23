import { startStartupTimer } from '../startupTiming';

test('records a startup phase once with a rounded non-negative duration', () => {
  const readings = [100, 126.6, 140];
  const log = jest.fn();
  const finish = startStartupTimer('music-library', {
    now: () => readings.shift() ?? 140,
    log,
  });

  expect(finish('ready', { songCount: 12 })).toEqual({
    phase: 'music-library',
    outcome: 'ready',
    durationMs: 27,
    details: { songCount: 12 },
  });
  expect(finish('failed')).toBeUndefined();
  expect(log).toHaveBeenCalledTimes(1);
});

test('contains logger failures so diagnostics cannot break startup', () => {
  const finish = startStartupTimer('tag-write-recovery', {
    now: () => 5,
    log: () => { throw new Error('logger unavailable'); },
  });

  expect(() => finish('ready')).not.toThrow();
});
