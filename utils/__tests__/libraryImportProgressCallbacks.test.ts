import { createImportProgressCallbacks } from '../libraryImportProgressCallbacks';

const song = (id: string) => ({ id, title: id, artist: 'Artist', uri: `file:///${id}.mp3` });

test('accepted batches accumulate without deleting the existing library, then reject late callbacks', () => {
  const onApply = jest.fn();
  const onFileProgress = jest.fn();
  const activity = jest.fn();
  const callbacks = createImportProgressCallbacks({ songs: [song('existing')], signal: new AbortController().signal, activity, onApply, onFileProgress });
  callbacks.onCheckpoint({ songs: [song('first')], processed: 1, total: 2 });
  callbacks.onCheckpoint({ songs: [song('second')], processed: 2, total: 2 });
  expect(callbacks.getSongs().map(item => item.id)).toEqual(['existing', 'first', 'second']);
  callbacks.close();
  callbacks.onCheckpoint({ songs: [song('late')], processed: 3, total: 3 });
  callbacks.onFileProgress({ total: 3, processed: 3, currentTitle: 'late' });
  expect(onApply).toHaveBeenCalledTimes(2);
  expect(activity).toHaveBeenCalledTimes(2);
  expect(onFileProgress).not.toHaveBeenCalled();
});

test('aborted operations cannot publish progress or accept metadata from a detached native call', () => {
  const controller = new AbortController();
  const onApply = jest.fn();
  const onFileProgress = jest.fn();
  const callbacks = createImportProgressCallbacks({ songs: [song('existing')], signal: controller.signal, activity: jest.fn(), onApply, onFileProgress });
  controller.abort();
  callbacks.onCheckpoint({ songs: [song('stale')], processed: 1, total: 1 });
  callbacks.onFileProgress({ total: 1, processed: 1, currentTitle: 'stale' });
  expect(onApply).not.toHaveBeenCalled();
  expect(onFileProgress).not.toHaveBeenCalled();
});
