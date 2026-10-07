import {
  documentDirectory, makeDirectoryAsync, readDirectoryAsync, readAsStringAsync,
  writeAsStringAsync, deleteAsync, getInfoAsync,
} from 'expo-file-system/legacy';
import { WAVEFORM_VERSION } from './waveformTypes';

/** App documents survive process restarts and Android's disposable cache cleanup. */
const directory = documentDirectory ? `${documentDirectory}waveforms/v${WAVEFORM_VERSION}/` : null;
export const isWaveformFileName = (name: string): boolean => /^[0-9a-f]{32}-[0-9a-f]{32}\.json$/.test(name);

const uriFor = (name: string): string => {
  if (!directory || !isWaveformFileName(name)) throw new Error('Waveform document path unavailable');
  return `${directory}${name}`;
};

export const ensureWaveformDirectory = async (): Promise<void> => {
  if (!directory) throw new Error('Waveform document directory unavailable');
  await makeDirectoryAsync(directory, { intermediates: true });
};
export const listWaveformFiles = async (): Promise<string[]> => {
  if (!directory) throw new Error('Waveform document directory unavailable');
  return (await readDirectoryAsync(directory)).filter(isWaveformFileName);
};
export const readWaveformFile = (name: string): Promise<string> => readAsStringAsync(uriFor(name));
export const writeWaveformFile = (name: string, value: string): Promise<void> => writeAsStringAsync(uriFor(name), value);
export const removeWaveformFile = (name: string): Promise<void> => deleteAsync(uriFor(name), { idempotent: true });
export const waveformFileExists = async (name: string): Promise<boolean> => (await getInfoAsync(uriFor(name))).exists;
