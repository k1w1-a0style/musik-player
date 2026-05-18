import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Disc3 } from 'lucide-react-native';
import GlassCard from '../components/GlassCard';
import ModernControls from '../components/ModernControls';
import { theme } from '../theme';

interface NowPlayingBottomControlsRowProps {
  volume: number;
  onVolumeChange: (value: number) => Promise<void>;
  bottomInset: number;
  onOpenTrackInfo: () => void;
}

const NowPlayingBottomControlsRow = React.memo(({
  volume,
  onVolumeChange,
  bottomInset,
  onOpenTrackInfo,
}: NowPlayingBottomControlsRowProps) => (
  <View style={[styles.bottomRow, { paddingBottom: Math.max(28, bottomInset + 24) }]}>
    <View style={styles.bottomSpacer} />
    <GlassCard style={styles.glassRow} intensity={theme.blur.medium}>
      <ModernControls volume={volume} onVolumeChange={onVolumeChange} />
    </GlassCard>
    <Pressable onPress={onOpenTrackInfo} style={styles.bottomBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="TrackInfo öffnen">
      <Disc3 color={theme.palette.text.muted} size={20} />
    </Pressable>
  </View>
));

const styles = StyleSheet.create({
  bottomRow: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6 },
  bottomSpacer: { width: 42, height: 42 },
  bottomBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.palette.surfaceElevated },
  glassRow: { flex: 1 },
});

export default NowPlayingBottomControlsRow;
