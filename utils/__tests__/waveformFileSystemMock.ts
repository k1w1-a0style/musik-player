/** Stateful native filesystem double shared only by waveform storage suites. */
const files = new Map<string, string>();
export const waveformFiles = files;
export const resetWaveformFileSystem = (): void => files.clear();
export const documentDirectory = 'file:///documents/';
export const makeDirectoryAsync = jest.fn(async () => undefined);
export const readDirectoryAsync = jest.fn(async (directory: string) => [...files.keys()]
  .filter(uri => uri.startsWith(directory)).map(uri => uri.slice(directory.length)));
export const readAsStringAsync = jest.fn(async (uri: string) => {
  const value = files.get(uri);
  if (value === undefined) throw new Error('File not found');
  return value;
});
export const writeAsStringAsync = jest.fn(async (uri: string, value: string) => { files.set(uri, value); });
export const deleteAsync = jest.fn(async (uri: string) => { files.delete(uri); });
export const getInfoAsync = jest.fn(async (uri: string) => ({ exists: files.has(uri), isDirectory: false,
  size: files.get(uri)?.length ?? 0 }));
