import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import SoundCloudTrackPage from '../SoundCloudTrackPage';
jest.mock('../../components/SoundCloudWaveformViewport', () => () => null);
jest.mock('../../contexts/PlaybackProgressContext', () => ({usePlaybackProgress: () => ({position: 0, duration: 1000})}));
jest.mock('../../hooks/useSongWaveform', () => ({useSongWaveform: () => ({waveform: {points: []},waveformReady: false,loadingNative: false})}));
const props = {song: {id: 'synthetic',title: 'Ein langer deutscher Titel zum Prüfen',artist: 'Künstler'},role: 'current' as const,isPlaying: true,accent: '#00ff00',canSwipeToNext: true,topInset: 0,bottomInset: 0,onTogglePlayback: jest.fn(),onPrevious: jest.fn(),onNext: jest.fn(),onSeek: jest.fn(async()=>undefined),onOpenTrackInfo: jest.fn(),reduceMotion: true};
test('metadata grows with scaled text and never clips the info action', () => {
 const view = render(<SoundCloudTrackPage {...props}/>);
 const metadata = StyleSheet.flatten(view.getByTestId('soundcloud-track-metadata').props.style);
 expect(metadata.height).toBeUndefined(); expect(metadata.overflow).not.toBe('hidden'); expect(metadata.flexShrink).toBe(0);
 const chip = view.getByTestId('soundcloud-track-info-chip');
 expect(StyleSheet.flatten(chip.props.style)).toMatchObject({minHeight: 48,minWidth: 48,maxWidth: '100%'});
 const text = view.getByText('Infos zu diesem Track');
 expect(StyleSheet.flatten(text.props.style).flexShrink).toBe(1);
 expect(text.props.numberOfLines).toBeUndefined(); expect(text.props.allowFontScaling).not.toBe(false); expect(text.props.adjustsFontSizeToFit).not.toBe(true);
 fireEvent.press(chip); expect(props.onOpenTrackInfo).toHaveBeenCalledTimes(1);
});
