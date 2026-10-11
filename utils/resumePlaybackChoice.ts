import { Alert } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import type { ResumePositionStore } from './resumePositionStore';

export type ResumePlaybackChoice = ({ status: 'continue'; startPositionMs?: number } | { status: 'cancel' }) & { isCurrent?: () => boolean };
const showChoice = (song: Song, positionMs: number): Promise<ResumePlaybackChoice> => new Promise(resolve => {
  const seconds = Math.floor(positionMs / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  Alert.alert('Wiedergabe fortsetzen?', `${song.title}\nGespeicherte Position: ${time}`, [
    { text: 'Abbrechen', style: 'cancel', onPress: () => resolve({ status: 'cancel' }) },
    { text: 'Von vorn', onPress: () => resolve({ status: 'continue', startPositionMs: 0 }) },
    { text: 'Fortsetzen', onPress: () => resolve({ status: 'continue', startPositionMs: positionMs }) },
  ], { cancelable: true, onDismiss: () => resolve({ status: 'cancel' }) });
});
export const resolveResumePlaybackChoice = async (
  song: Song, store: ResumePositionStore, isCurrent: () => boolean,
): Promise<ResumePlaybackChoice> => {
  const entry = await store.lookup(song);
  if (!isCurrent()) return { status: 'cancel' };
  if (!entry) return { status: 'continue' };
  try {
    const active = await TrackPlayer.getActiveTrack();
    if (active?.id === song.id) {
      const progress = await TrackPlayer.getProgress();
      const playing = await TrackPlayer.getPlayWhenReady();
      const verified = await TrackPlayer.getActiveTrack();
      if (!isCurrent()) return { status: 'cancel' };
      if (verified?.id !== active.id) return { status: 'cancel' };
      // An existing session keeps its live position. Resume is offered when
      // selecting another track or a cold-start track at its beginning.
      if (progress.position > 1 || playing) return { status: 'continue' };
    }
  } catch (error) {
    console.warn('[Resume] Native position unavailable; stored seek omitted.', error);
    return isCurrent() ? { status: 'continue' } : { status: 'cancel' };
  }
  if (!isCurrent()) return { status: 'cancel' };
  const choice = await showChoice(song, entry.positionMs);
  return isCurrent() ? choice : { status: 'cancel' };
};
