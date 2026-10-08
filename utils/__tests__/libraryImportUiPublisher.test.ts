import { createImportUiPublisher } from '../libraryImportUiPublisher';

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

const setup = () => {
  const songs = jest.fn();
  const progress = jest.fn();
  const controller = new AbortController();
  const ui = createImportUiPublisher({ isActive: () => !controller.signal.aborted,
    publishSongs: songs, publishProgress: progress });
  return { ui, songs, progress, controller };
};

test('first results are immediate and a confirmed partial batch appears at 650ms', () => {
  const { ui, songs } = setup();
  ui.accepted(1);
  expect(songs).toHaveBeenCalledTimes(1);
  ui.accepted(100);
  jest.advanceTimersByTime(649);
  expect(songs).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  expect(songs).toHaveBeenCalledTimes(2);
});

test('200 confirmed titles publish once even when their metadata arrives as separate checkpoints', () => {
  const { ui, songs } = setup();
  ui.accepted(1); ui.accepted(100); ui.accepted(100);
  expect(songs).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(650);
  expect(songs).toHaveBeenCalledTimes(2);
});

test('file progress coalesces to its latest values and forces accurate completion', () => {
  const { ui, progress } = setup();
  ui.progress({ total: 250, processed: 0, currentTitle: 'First' });
  for (let index = 1; index <= 100; index++) ui.progress({ total: 250, processed: index, currentTitle: String(index) });
  expect(progress).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(650);
  expect(progress).toHaveBeenLastCalledWith({ total: 250, processed: 100, currentTitle: '100' });
  ui.progress({ total: 250, processed: 250, currentTitle: '' });
  expect(progress).toHaveBeenLastCalledWith({ total: 250, processed: 250, currentTitle: '' });
});

test('a stopped generation cannot publish a delayed timer or its final buffered values', () => {
  const { ui, songs, controller } = setup();
  ui.accepted(1); ui.accepted(100);
  controller.abort();
  jest.advanceTimersByTime(650); ui.flush();
  expect(songs).toHaveBeenCalledTimes(1);
});

test('the final tail is published synchronously without waiting for another timer', () => {
  const { ui, songs } = setup();
  ui.accepted(1); ui.accepted(20); ui.flush(); ui.cancel();
  expect(songs).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});
