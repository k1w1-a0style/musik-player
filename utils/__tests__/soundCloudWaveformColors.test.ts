import { getSoundCloudWaveformColors } from '../soundCloudWaveformColors';

test.each(['#ffffff', '#000000', '#555555', '#0000ff', 'invalid'])(
  'keeps colored, darker played audio even when artwork accent is %s', accent => {
    expect(getSoundCloudWaveformColors(accent)).toEqual({ unplayed: '#ff5500', played: '#8c2f00' });
  },
);

test('retains readable artwork color and darkens only the played part', () => {
  expect(getSoundCloudWaveformColors('#44ccaa')).toEqual({ unplayed: '#44ccaa', played: '#25705e' });
});
