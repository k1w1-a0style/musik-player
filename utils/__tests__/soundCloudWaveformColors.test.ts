import { getSoundCloudWaveformColors } from '../soundCloudWaveformColors';

const luminance = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  .reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);

test.each(['#ffffff', '#000000', '#555555', '#0000ff', '#44ccaa', 'invalid'])(
  'cover choice remains visible on dark backgrounds and distinct from the neutral future: %s', accent => {
    const colors = getSoundCloudWaveformColors(accent, 'cover');
    expect(colors.unplayed).toBe('#ededed');
    expect(colors.played).toMatch(/^#[0-9a-f]{6}$/i);
    expect(luminance(colors.played)).toBeGreaterThan(0.13);
    expect(luminance(colors.played)).toBeLessThan(0.25);
    expect((luminance(colors.unplayed) + 0.05) / (luminance(colors.played) + 0.05)).toBeGreaterThan(3);
  });

test('cover choice preserves different readable hues; neutral/blue/orange are explicit choices', () => {
  expect(getSoundCloudWaveformColors('#44ccaa').played).not.toBe(getSoundCloudWaveformColors('#0000ff').played);
  expect(getSoundCloudWaveformColors('#ffffff', 'neutral').played).toBe('#858585');
  expect(getSoundCloudWaveformColors('#ffffff', 'blue').played).toBe('#4885c5');
  expect(getSoundCloudWaveformColors('#ffffff', 'orange').played).toBe('#ff5500');
  expect(getSoundCloudWaveformColors('invalid').played).toBe('#4885c5');
});
