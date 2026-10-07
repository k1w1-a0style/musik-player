// eslint-disable-next-line @typescript-eslint/no-require-imports -- Exercise the real adapter against a native API double.
jest.mock('expo-file-system/legacy', () => require('./waveformFileSystemMock'));
import { resetWaveformFileSystem, waveformFiles, writeAsStringAsync } from './waveformFileSystemMock';
import { ensureWaveformDirectory, isWaveformFileName, listWaveformFiles, readWaveformFile,
  removeWaveformFile, waveformFileExists, writeWaveformFile } from '../waveformFileStore';
const name = `${'a'.repeat(32)}-${'b'.repeat(32)}.json`;
beforeEach(() => { resetWaveformFileSystem(); jest.clearAllMocks(); });

test('stores only managed app-document payloads and preserves them until explicit removal', async () => {
  await ensureWaveformDirectory();
  expect(await waveformFileExists(name)).toBe(false);
  await writeWaveformFile(name, '{"points":[0,1]}');
  expect(writeAsStringAsync).toHaveBeenCalledWith(`file:///documents/waveforms/v6/${name}`, '{"points":[0,1]}');
  await expect(readWaveformFile(name)).resolves.toBe('{"points":[0,1]}');
  expect(await waveformFileExists(name)).toBe(true);
  waveformFiles.set('file:///documents/waveforms/v6/unrelated.txt', 'keep');
  expect(await listWaveformFiles()).toEqual([name]);
  await removeWaveformFile(name);
  await removeWaveformFile(name);
  expect(await waveformFileExists(name)).toBe(false);
  expect(waveformFiles.get('file:///documents/waveforms/v6/unrelated.txt')).toBe('keep');
});

test.each(['../song.mp3', '/tmp/waveform.json', `${'a'.repeat(32)}.json`, `${name}/child`])('rejects an unsafe filename: %s', name => {
  expect(isWaveformFileName(name)).toBe(false);
  expect(() => writeWaveformFile(name, 'bad')).toThrow('Waveform document path unavailable');
  expect(writeAsStringAsync).not.toHaveBeenCalled();
});
