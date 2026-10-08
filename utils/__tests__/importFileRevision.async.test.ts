import { File } from 'expo-file-system';
import { SystemAudio } from 'expo-system-audio';
import { readImportFileRevision } from '../importFileRevision';
import { resetImportFileReadsForTests, withImportFileBudget } from '../libraryImportBudget';

jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-system-audio', () => ({ SystemAudio: { readImportFileStat: jest.fn() } }));
const stat = SystemAudio.readImportFileStat as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  stat.mockReset();
  (File as unknown as jest.Mock).mockClear();
  resetImportFileReadsForTests();
});
afterEach(() => { jest.useRealTimers(); resetImportFileReadsForTests(); });

test('a pending provider stat yields to the event loop without calling synchronous File.info', async () => {
  let finish!: (value: { size: number; modificationTime: number }) => void;
  stat.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const read = readImportFileRevision('content://provider/document/track.mp3');
  let ticked = false;
  setTimeout(() => { ticked = true; }, 1);
  await jest.advanceTimersByTimeAsync(1);
  expect(ticked).toBe(true);
  expect(stat).toHaveBeenCalledWith('content://provider/document/track.mp3');
  expect(File).not.toHaveBeenCalled();
  finish({ size: 2000, modificationTime: 1700000000000 });
  await expect(read).resolves.toEqual({ size: 2000, modificationTime: 1700000000000 });
});

test('a stalled stat retains both import reservations until its real results settle', async () => {
  const finishes: Array<(value: null) => void> = [];
  stat.mockImplementation(() => new Promise(resolve => { finishes.push(resolve); }));
  const read = (signal: AbortSignal) => readImportFileRevision('content://provider/track', {}, signal);
  const first = expect(withImportFileBudget(read, undefined, 10)).rejects.toThrow('Zeitlimits');
  const second = expect(withImportFileBudget(read, undefined, 10)).rejects.toThrow('Zeitlimits');
  await jest.advanceTimersByTimeAsync(10);
  await Promise.all([first, second]);
  await expect(withImportFileBudget(read)).rejects.toThrow('beschäftigt');
  expect(stat).toHaveBeenCalledTimes(2);
  finishes.forEach(finish => finish(null));
  await jest.advanceTimersByTimeAsync(0);
  stat.mockResolvedValue({ size: 12, modificationTime: 30 });
  await expect(withImportFileBudget(read)).resolves.toEqual({ size: 12, modificationTime: 30 });
});
