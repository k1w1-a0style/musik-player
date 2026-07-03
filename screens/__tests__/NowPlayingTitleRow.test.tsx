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

  test.each(['unknown', 'null', 'undefined', '<unknown>', '   '])(
    'uses filename fallback instead of no-selection copy for placeholder title %p',
    (title) => {
      const { getByText, queryByText } = renderRow({
        ...baseSong,
        title,
        fileInfo: { filename: 'Artist - Song.m4a' },
      });

      expect(queryByText('Kein Titel ausgewählt')).toBeNull();
      expect(getByText('Artist - Song')).toBeTruthy();
    },
  );

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
