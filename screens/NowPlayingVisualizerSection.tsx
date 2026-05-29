import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Visualizer from '../components/Visualizer';
import { theme } from '../theme';

interface NowPlayingVisualizerSectionProps {
  visible: boolean;
  fftBins: number[];
  isPlaying: boolean;
  color: string;
  hint: string | null;
}

const NowPlayingVisualizerSection: React.FC<NowPlayingVisualizerSectionProps> = ({
  visible,
  fftBins,
  isPlaying,
  color,
  hint,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.visualizerWrap}>
      <Visualizer bins={fftBins} active={isPlaying} color={color} height={44} />
      {!!hint && <Text style={styles.visualizerHint}>{hint}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  visualizerWrap: { paddingHorizontal: 20, marginTop: 4, marginBottom: theme.spacing.sm },
  visualizerHint: { marginTop: 6, textAlign: 'center', color: theme.palette.text.muted, fontSize: 12, lineHeight: 16 },
});

export default NowPlayingVisualizerSection;
