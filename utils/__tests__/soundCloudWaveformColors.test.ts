import { getSoundCloudWaveformColors } from '../soundCloudWaveformColors';

test.each(['#ffffff', '#000000', '#555555', '#0000ff', 'invalid'])(
  'keeps colored, darker played audio even when artwork accent is %s', accent => {
    expect(getSoundCloudWaveformColors(accent)).toEqual({ unplayed: '#ededed', played: '#8c2f00' });
  },
);

test('keeps upcoming audio white and the played part in a darker artwork color', () => {
  expect(getSoundCloudWaveformColors('#44ccaa')).toEqual({ unplayed: '#ededed', played: '#25705e' });
});
