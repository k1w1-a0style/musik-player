import React from 'react';
import { render } from '@testing-library/react-native';
import NowPlayingTitleRow from '../NowPlayingTitleRow';
import type { Song } from '../../types/Song';

const baseSong: Song = {
  id: 'song-1',
  title: 'Real Title',
  artist: 'Artist',
  uri: 'file:///music/Real%20Title.mp3',
};

const renderRow = (currentSong: Song | null) => render(
  <NowPlayingTitleRow
    currentSong={currentSong}
    favorite={false}
    favoritePending={false}
    onToggleFavorite={jest.fn()}
  />,
);

describe('NowPlayingTitleRow metadata display fallbacks', () => {
  test('shows no-selection copy only when currentSong is null', () => {
    const { getByText } = renderRow(null);

    expect(getByText('Kein Titel ausgewählt')).toBeTruthy();
  });

  test.each([
    ['unknown', 'Artist - Real Song.m4a', 'Real Song'],
    ['null', 'Real Song.m4a', 'Real Song'],
    ['undefined', 'Artist - Real Song.webm', 'Real Song'],
    ['<unknown>', 'Artist - Real Song.mp3', 'Real Song'],
    ['   ', 'Artist - Real Song.m4b', 'Real Song'],
  ])(
    'uses filename fallback instead of no-selection copy for placeholder title %p',
    (title, filename, expectedTitle) => {
      const { getByText, queryByText } = renderRow({
        ...baseSong,
        title,
        fileInfo: { filename },
      });

      expect(queryByText('Kein Titel ausgewählt')).toBeNull();
      expect(getByText(expectedTitle)).toBeTruthy();
    },
  );

  test('uses unknown title fallback rather than no-selection copy when currentSong has no usable title source', () => {
    const { getByText, queryByText } = renderRow({
      ...baseSong,
      title: 'unknown',
      uri: undefined,
      fileInfo: undefined,
    });

    expect(queryByText('Kein Titel ausgewählt')).toBeNull();
    expect(getByText('Unbekannter Titel')).toBeTruthy();
  });

  test('keeps a real title unchanged', () => {
    const { getByText } = renderRow({
      ...baseSong,
      title: 'Clean Song Title',
      fileInfo: { filename: 'Ignored Filename.webm' },
    });

    expect(getByText('Clean Song Title')).toBeTruthy();
  });

  test.each([
    ['My%20Song%20%28Live%29.mp3', 'My Song (Live)'],
    ['My%20Song%20%28Live%29.m4a', 'My Song (Live)'],
    ['My%20Song%20%28Live%29.webm', 'My Song (Live)'],
  ])('decodes and strips audio extension for %s fallback', (filename, expectedTitle) => {
    const { getByText, queryByText } = renderRow({
      ...baseSong,
      title: 'unknown',
      fileInfo: { filename },
    });

    expect(queryByText('Kein Titel ausgewählt')).toBeNull();
    expect(getByText(expectedTitle)).toBeTruthy();
  });
});
