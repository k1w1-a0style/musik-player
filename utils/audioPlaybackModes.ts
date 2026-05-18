import { RepeatMode as RNTPRepeatMode } from 'react-native-track-player';
import type { RepeatMode } from '../types/Song';

export const toTrackPlayerRepeatMode = (mode: RepeatMode): RNTPRepeatMode =>
  mode === 'off'
    ? RNTPRepeatMode.Off
    : mode === 'one'
      ? RNTPRepeatMode.Track
      : RNTPRepeatMode.Queue;
