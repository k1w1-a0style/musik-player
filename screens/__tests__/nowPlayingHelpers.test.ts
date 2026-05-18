import {
  buildNowPlayingQueue,
  buildQueueById,
  formatVisualizerHint,
} from '../nowPlayingHelpers';
import type { Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A' },
  { id: 's2', title: 'Two', artist: 'B' },
];

describe('nowPlayingHelpers', () => {
  test('formats visualizer hints', () => {
    expect(formatVisualizerHint(null)).toBeNull();
    expect(formatVisualizerHint('stopped')).toBeNull();
    expect(formatVisualizerHint('ok')).toBeNull();
    expect(formatVisualizerHint('no_permission')).toBe('Visualizer deaktiviert (keine Mikrofonberechtigung).');
    expect(formatVisualizerHint('device_busy')).toBe('Visualizer deaktiviert (device_busy).');
  });

  test('builds queue from playback queue or current song fallback', () => {
    expect(buildNowPlayingQueue(songs, null)).toBe(songs);
    expect(buildNowPlayingQueue([], songs[0])).toEqual([songs[0]]);
    expect(buildNowPlayingQueue([], null)).toEqual([]);
  });

  test('builds queue lookup by id', () => {
    const queueById = buildQueueById(songs);

    expect(queueById.get('s1')).toBe(songs[0]);
    expect(queueById.get('s2')).toBe(songs[1]);
  });
});
