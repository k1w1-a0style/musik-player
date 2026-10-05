import { getSoundCloudWaveformColors } from '../soundCloudWaveformColors';

test.each(['#ffffff', '#000000', '#555555', '#0000ff', '#44ccaa', 'invalid'])(
  'uses the same readable timeline colors for every artwork accent, including %s', accent => {
    expect(getSoundCloudWaveformColors(accent)).toEqual({ unplayed: '#ededed', played: '#ff5500' });
  });
