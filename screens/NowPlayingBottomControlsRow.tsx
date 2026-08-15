import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Disc3 } from 'lucide-react-native';
import VolumeSlider from '../components/VolumeSlider';
import { useAppTheme } from '../contexts/AppThemeContext';
import CrossfadeLayers from '../components/CrossfadeLayers';

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
}: NowPlayingBottomControlsRowProps) => {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.bottomRow, { paddingBottom: Math.max(18, bottomInset + 12) }]}>
      <View style={styles.bottomSpacer} />
      <View style={styles.volumeWrap} testID="now-playing-volume-wrap">
        <CrossfadeLayers value={accentColor} valueKey={accentColor}
          testID="volume-color-transition" renderLayer={color => (
            <VolumeSlider volume={volume} onVolumeChange={onVolumeChange} accentColor={color} />
          )} />
      </View>
      <Pressable
        onPress={onOpenTrackInfo}
        style={[
          styles.bottomBtn,
          {
            backgroundColor: theme.palette.surfaceGlass,
            borderColor: theme.palette.border,
          },
        ]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Titelinformationen öffnen"
        testID="now-playing-track-info-button"
      >
        <Disc3 color={theme.palette.text.muted} size={20} />
      </Pressable>
    </View>
  );
});

NowPlayingBottomControlsRow.displayName = 'NowPlayingBottomControlsRow';

const styles = StyleSheet.create({
  bottomRow: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 2 },
  bottomSpacer: { width: 38, height: 38 },
  bottomBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  volumeWrap: { flex: 1 },
});

export default NowPlayingBottomControlsRow;
