import {
  classifyWaveformContainer,
  describeWaveformDecision,
  isNativeWaveformAccepted,
  isNativeWaveformRejectionNoteworthy,
  type NativeWaveformDecision,
} from '../waveformDecision';

describe('waveformDecision', () => {
  describe('classifyWaveformContainer', () => {
    test.each([
      ['file:///song.mp3', 'mp3'],
      ['file:///song.M4A', 'm4a'],
      ['file:///audiobook.m4b', 'm4a'],
      ['file:///clip.mp4', 'mp4'],
      ['file:///sound.aac', 'aac'],
      ['file:///lossless.flac', 'flac'],
      ['file:///pcm.wav', 'wav'],
      ['file:///stream.ogg', 'ogg'],
      ['file:///voice.opus', 'opus'],
      ['content://media/external/audio/42', 'other'],
      ['file:///no-extension', 'other'],
      ['file:///track.mp3?token=abc#frag', 'mp3'],
      ['file:///weird.name.with.dots.m4a', 'm4a'],
    ])('classifies %s as %s', (uri, expected) => {
      expect(classifyWaveformContainer(uri)).toBe(expected);
    });

    test('returns other for nullish uris without throwing', () => {
      expect(classifyWaveformContainer(null)).toBe('other');
      expect(classifyWaveformContainer(undefined)).toBe('other');
      expect(classifyWaveformContainer('')).toBe('other');
    });
  });

  describe('isNativeWaveformAccepted', () => {
    test('is only true for the accepted decision', () => {
      expect(isNativeWaveformAccepted('native-accepted')).toBe(true);
      const rejections: NativeWaveformDecision[] = [
        'no-uri',
        'no-native-extractor',
        'native-empty',
        'native-unusable-shape',
        'native-source-key-changed',
        'native-error',
      ];
      rejections.forEach(decision => expect(isNativeWaveformAccepted(decision)).toBe(false));
    });
  });

  describe('isNativeWaveformRejectionNoteworthy', () => {
    test('only flags native-attempted rejections, not normal fallback states', () => {
      expect(isNativeWaveformRejectionNoteworthy('native-empty')).toBe(true);
      expect(isNativeWaveformRejectionNoteworthy('native-unusable-shape')).toBe(true);
      expect(isNativeWaveformRejectionNoteworthy('native-source-key-changed')).toBe(true);
      expect(isNativeWaveformRejectionNoteworthy('native-error')).toBe(true);
      // Normal states must never create warning/log noise.
      expect(isNativeWaveformRejectionNoteworthy('no-uri')).toBe(false);
      expect(isNativeWaveformRejectionNoteworthy('no-native-extractor')).toBe(false);
      expect(isNativeWaveformRejectionNoteworthy('native-accepted')).toBe(false);
    });
  });

  describe('describeWaveformDecision', () => {
    test('produces a compact, contextual line', () => {
      expect(
        describeWaveformDecision({
          container: 'm4a',
          decision: 'native-unusable-shape',
          source: 'fallback',
          nativePointCount: 12,
        }),
      ).toBe('[Waveform] source=fallback decision=native-unusable-shape container=m4a nativePoints=12');
    });
  });
});
