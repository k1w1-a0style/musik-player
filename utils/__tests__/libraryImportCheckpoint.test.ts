import { createImportCheckpointReporter, ImportCheckpointError } from '../libraryImportCheckpoint';

const song = (id: string) => ({ id, title: id, artist: 'Artist' });

test('the first checkpoint cannot acknowledge before its durable callback settles', async () => {
  let release!: () => void;
  const durable = new Promise<void>(resolve => { release = resolve; });
  const report = createImportCheckpointReporter(() => durable);
  let confirmed = false;
  const first = report.add(song('first'), 1, 1).then(() => { confirmed = true; });
  await Promise.resolve();
  expect(confirmed).toBe(false);
  release(); await first;
  expect(confirmed).toBe(true);
});

test('large imports use durable 100-title batches and flush their final tail', async () => {
  const commit = jest.fn();
  const report = createImportCheckpointReporter(commit);
  for (let index = 0; index < 252; index++) await report.add(song(String(index)), index + 1, 252);
  await report.flush(252, 252);
  expect(commit.mock.calls.map(([batch]) => batch.songs.length)).toEqual([1, 100, 100, 51]);
});

test('slow metadata arrivals confirm a small batch after 500ms instead of waiting for 100 titles', async () => {
  let now = 1_000;
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
  const commit = jest.fn();
  try {
    const report = createImportCheckpointReporter(commit);
    await report.add(song('first'), 1, 3);
    now = 1_200;
    await report.add(song('second'), 2, 3);
    expect(commit).toHaveBeenCalledTimes(1);
    now = 1_500;
    await report.add(song('third'), 3, 3);
    expect(commit.mock.calls.map(([batch]) => batch.songs.length)).toEqual([1, 2]);
  } finally { clock.mockRestore(); }
});

test('checkpoint failure stops confirmation instead of becoming a per-file metadata error', async () => {
  const report = createImportCheckpointReporter(async () => { throw new Error('disk full'); });
  await expect(report.add(song('first'), 1, 2)).rejects.toBeInstanceOf(ImportCheckpointError);
  await expect(report.flush(1, 2)).rejects.toBeInstanceOf(ImportCheckpointError);
});

test('abort rejects the unconfirmed tail without a late checkpoint callback', async () => {
  const controller = new AbortController();
  const commit = jest.fn();
  const report = createImportCheckpointReporter(commit, controller.signal);
  await report.add(song('first'), 1, 2);
  await report.add(song('tail'), 2, 2);
  controller.abort();
  await expect(report.flush(2, 2)).rejects.toThrow();
  expect(commit).toHaveBeenCalledTimes(1);
});
