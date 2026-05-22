import { RepeatMode as RNTPRepeatMode } from 'react-native-track-player';
import { toTrackPlayerRepeatMode } from '../audioPlaybackModes';

describe('audioPlaybackModes', () => {
  test('maps app repeat modes to TrackPlayer repeat modes', () => {
    expect(toTrackPlayerRepeatMode('off')).toBe(RNTPRepeatMode.Off);
    expect(toTrackPlayerRepeatMode('one')).toBe(RNTPRepeatMode.Track);
    expect(toTrackPlayerRepeatMode('all')).toBe(RNTPRepeatMode.Queue);
  });

  test('defaults invalid repeat mode values to off', () => {
    expect(toTrackPlayerRepeatMode('bad')).toBe(RNTPRepeatMode.Off);
    expect(toTrackPlayerRepeatMode(undefined)).toBe(RNTPRepeatMode.Off);
    expect(toTrackPlayerRepeatMode(null)).toBe(RNTPRepeatMode.Off);
  });
});
