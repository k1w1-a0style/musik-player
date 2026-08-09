import {
  getQueuePreviewOffset,
  resolveSoundCloudSeekRatio,
  shouldCommitSoundCloudSwipe,
  shouldCollapseSoundCloudPlayer,
} from '../soundCloudPlayer';

describe('SoundCloud player gesture math', () => {
  test('seeking moves the timeline opposite to the waveform drag', () => {
    expect(resolveSoundCloudSeekRatio({ startRatio: 0.5, translationX: -200, travelWidth: 800 })).toBe(0.75);
    expect(resolveSoundCloudSeekRatio({ startRatio: 0.5, translationX: 200, travelWidth: 800 })).toBe(0.25);
  });

  test('seeking clamps safely at both track boundaries', () => {
    expect(resolveSoundCloudSeekRatio({ startRatio: 0.1, translationX: 400, travelWidth: 800 })).toBe(0);
    expect(resolveSoundCloudSeekRatio({ startRatio: 0.9, translationX: -400, travelWidth: 800 })).toBe(1);
    expect(resolveSoundCloudSeekRatio({ startRatio: Number.NaN, translationX: 10, travelWidth: 0 })).toBe(0);
  });

  test('track swipe requires horizontal intent and either distance or velocity', () => {
    expect(shouldCommitSoundCloudSwipe({ translationX: -120, translationY: 8, velocityX: -200, width: 360 })).toBe(true);
    expect(shouldCommitSoundCloudSwipe({ translationX: -30, translationY: 4, velocityX: -950, width: 360 })).toBe(true);
    expect(shouldCommitSoundCloudSwipe({ translationX: -40, translationY: 80, velocityX: -1200, width: 360 })).toBe(false);
    expect(shouldCommitSoundCloudSwipe({ translationX: -40, translationY: 2, velocityX: -200, width: 360 })).toBe(false);
  });

  test('collapse follows a deliberate downward drag or fling only', () => {
    expect(shouldCollapseSoundCloudPlayer({ translationY: 160, velocityY: 100, height: 700 })).toBe(true);
    expect(shouldCollapseSoundCloudPlayer({ translationY: 40, velocityY: 1100, height: 700 })).toBe(true);
    expect(shouldCollapseSoundCloudPlayer({ translationY: -200, velocityY: -1200, height: 700 })).toBe(false);
  });
});

describe('SoundCloud queue live displacement', () => {
  test('opens a slot while an item moves down', () => {
    expect(getQueuePreviewOffset({ index: 3, dragIndex: 1, targetIndex: 4, rowHeight: 68 })).toBe(-68);
    expect(getQueuePreviewOffset({ index: 5, dragIndex: 1, targetIndex: 4, rowHeight: 68 })).toBe(0);
  });

  test('opens a slot while an item moves up', () => {
    expect(getQueuePreviewOffset({ index: 2, dragIndex: 4, targetIndex: 1, rowHeight: 68 })).toBe(68);
    expect(getQueuePreviewOffset({ index: 0, dragIndex: 4, targetIndex: 1, rowHeight: 68 })).toBe(0);
  });
});
