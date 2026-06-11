import React from 'react';
import AppErrorBoundary from '../AppErrorBoundary';
import AppProviders from '../AppProviders';
import { MusicProvider } from '../../contexts/MusicContext';
import { PlaybackProgressProvider } from '../../contexts/PlaybackProgressContext';

const onlyChild = (element: React.ReactElement<{ children?: React.ReactNode }>) =>
  React.Children.only(element.props.children) as React.ReactElement<{ children?: React.ReactNode }>;

describe('AppProviders', () => {
  test('keeps provider order without a second root error boundary', () => {
    const tree = AppProviders({ children: <></> }) as React.ReactElement<{ children?: React.ReactNode }>;
    const musicProvider = onlyChild(tree);
    const playbackProvider = onlyChild(musicProvider);

    expect(tree.type).not.toBe(AppErrorBoundary);
    expect(musicProvider.type).toBe(MusicProvider);
    expect(playbackProvider.type).toBe(PlaybackProgressProvider);
  });
});
