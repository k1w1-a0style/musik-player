import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Disc3 } from 'lucide-react-native';
import VolumeSlider from '../components/VolumeSlider';
import { theme } from '../theme';

interface NowPlayingBottomControlsRowProps {
  volume: number;
  onVolumeChange: (value: number) => Promise<void>;
  bottomInset: number;
  onOpenTrackInfo: () => void;
  accentColor: string;
}

const NowPlayingBottomControlsRow = React.memo(({
  volume,
  onVolumeChange,
  bottomInset,
  onOpenTrackInfo,
  accentColor,
}: NowPlayingBottomControlsRowProps) => (
  <View style={[styles.bottomRow, { paddingBottom: Math.max(18, bottomInset + 12) }]}>
    <View style={styles.bottomSpacer} />
    <View style={styles.volumeWrap} testID="now-playing-volume-wrap">
      <VolumeSlider volume={volume} onVolumeChange={onVolumeChange} accentColor={accentColor} />
    </View>
    <Pressable onPress={onOpenTrackInfo} style={styles.bottomBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Titelinformationen öffnen">
      <Disc3 color={theme.palette.text.muted} size={20} />
    </Pressable>
  </View>
));

const styles = StyleSheet.create({
  bottomRow: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 2 },
  bottomSpacer: { width: 38, height: 38 },
  bottomBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  volumeWrap: { flex: 1 },
});

export default NowPlayingBottomControlsRow;
