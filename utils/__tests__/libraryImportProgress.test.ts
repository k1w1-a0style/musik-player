import { createImportFileProgressReporter } from '../libraryImportProgress';

test('concurrent readers retain an active title and count each finished file', () => {
  const publish = jest.fn();
  const reporter = createImportFileProgressReporter(publish);
  reporter.addFiles(2);
  reporter.start('content://provider/document/primary%3AMusic%2FFirst.mp3');
  reporter.start('file:///Second.mp3');
  expect(publish).toHaveBeenLastCalledWith({ total: 2, processed: 0, currentTitle: 'First.mp3' });
  reporter.finish('content://provider/document/primary%3AMusic%2FFirst.mp3');
  expect(publish).toHaveBeenLastCalledWith({ total: 2, processed: 1, currentTitle: 'Second.mp3' });
  reporter.finish('file:///Second.mp3');
  expect(publish).toHaveBeenLastCalledWith({ total: 2, processed: 2, currentTitle: '' });
});

test('late reader completions cannot publish after cancellation or supersession', () => {
  const publish = jest.fn();
  const controller = new AbortController();
  const reporter = createImportFileProgressReporter(publish, controller.signal);
  reporter.addFiles(1);
  reporter.start('file:///First.mp3');
  publish.mockClear();
  controller.abort();
  reporter.finish('file:///First.mp3');
  expect(publish).not.toHaveBeenCalled();
});
