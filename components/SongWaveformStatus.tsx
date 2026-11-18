import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RotateCw } from 'lucide-react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';
import { retrySongPreparation } from '../utils/libraryWaveformPreparation';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
import type { WaveformStatus } from '../utils/waveformStatus';

const SongWaveformStatus = ({ song, status }: { song: Song; status: WaveformStatus }) => {
  const { theme } = useAppTheme();
  if (status !== 'unavailable') return null;
  return <View pointerEvents="box-none" style={styles.status} testID={`song-waveform-status-${song.id}`}>
    <Pressable style={styles.retry} accessibilityRole="button"
      accessibilityLabel={`Vorbereitung für ${song.title} erneut versuchen`}
      onPress={event => { event?.stopPropagation(); void runPlaybackUiAction(`prepare-${song.id}`,
        () => retrySongPreparation(song), { dropIfPending: true }); }}>
      <RotateCw size={16} color={theme.palette.text.muted} />
    </Pressable>
  </View>;
};
const styles = StyleSheet.create({
  status: { width: 48, minHeight: 48,
    alignItems: 'center', justifyContent: 'center' },
  retry: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
export default React.memo(SongWaveformStatus);
