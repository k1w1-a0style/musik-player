import { RepeatMode as RNTPRepeatMode } from 'react-native-track-player';
import type { RepeatMode } from '../types/Song';

export const toTrackPlayerRepeatMode = (mode: RepeatMode | unknown): RNTPRepeatMode => {
  if (mode === 'one') return RNTPRepeatMode.Track;
  if (mode === 'all') return RNTPRepeatMode.Queue;
  return RNTPRepeatMode.Off;
};