import React, { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';

interface WaveformBarsProps {
  points: readonly number[];
  sourceKey: string;
  width: number;
  height: number;
  color: string;
}

const BAR_WIDTH = 1.5;

export const buildSoundCloudWaveformPath = (
  points: readonly number[],
  width: number,
  height: number,
): string => {
  const safePoints = points.length > 0 ? points : [0.08];
  const drawableWidth = Math.max(0, width - BAR_WIDTH);
  const step = safePoints.length <= 1 ? 0 : drawableWidth / (safePoints.length - 1);
  return safePoints.map((point, index) => {
    const safePoint = Number.isFinite(point) ? Math.max(0.04, Math.min(1, point)) : 0.08;
    const barHeight = Math.max(4, safePoint * (height - 20));
    const x = BAR_WIDTH / 2 + index * step;
    const top = (height - barHeight) / 2;
    return `M${x.toFixed(2)} ${top.toFixed(2)}V${(top + barHeight).toFixed(2)}`;
  }).join('');
};

const WaveformBars = React.memo(({ points, sourceKey, width, height, color }: WaveformBarsProps) => {
  const path = useMemo(() => buildSoundCloudWaveformPath(points, width, height), [height, points, width]);
  return (
    <Svg width={width} height={height} testID={`soundcloud-waveform-bars-${sourceKey}`}>
      <Path d={path} fill="none" stroke={color} strokeWidth={BAR_WIDTH} strokeLinecap="round" />
    </Svg>
  );
});

WaveformBars.displayName = 'SoundCloudWaveformBars';

interface SoundCloudWaveformLayersProps {
  points: readonly number[];
  sourceKey: string;
  ready?: boolean;
  stripWidth: number;
  height: number;
  viewportCenter: number;
  accent: string;
  translateX: Animated.AnimatedAddition<number>;
  showProgress?: boolean;
}

const SoundCloudWaveformLayers = ({ points, sourceKey, stripWidth, height, viewportCenter,
  accent, translateX, ready = true, showProgress = true }: SoundCloudWaveformLayersProps) => {
  const stripStyle = useMemo(() => ({ width: stripWidth, height,
    transform: [{ translateX }] }), [height, stripWidth, translateX]);
  return (
    <>
      {ready ? <Animated.View style={[styles.strip, stripStyle]} testID="soundcloud-waveform-unplayed-layer">
        <WaveformBars points={points} sourceKey={`${sourceKey}-rest`} width={stripWidth}
          height={height} color={SOUNDCLOUD_PLAYER_COLORS.waveformRest} />
      </Animated.View> : <View pointerEvents="none" style={[styles.loadingLine,
        { width: '100%', backgroundColor: SOUNDCLOUD_PLAYER_COLORS.waveformRest }]}
        testID="soundcloud-waveform-loading-line" />}
      {showProgress ? <><View style={[styles.playedClip, { width: viewportCenter }]} testID="soundcloud-waveform-played-clip">
        {ready ? <Animated.View style={[styles.strip, stripStyle]} testID="soundcloud-waveform-played-layer">
          <WaveformBars points={points} sourceKey={`${sourceKey}-played`} width={stripWidth}
            height={height} color={accent} />
        </Animated.View> : <View style={[styles.loadingLine, { width: viewportCenter, backgroundColor: accent }]}
          testID="soundcloud-waveform-loading-played-line" />}
      </View>
      <View pointerEvents="none" style={[styles.playheadOutline, { left: viewportCenter - 2 }]}
        testID="soundcloud-waveform-playhead">
        <View style={styles.playhead} />
      </View></> : null}
    </>
  );
};

const styles = StyleSheet.create({
  strip: { position: 'absolute', left: 0, top: 0 },
  playedClip: { ...StyleSheet.absoluteFillObject, right: undefined, overflow: 'hidden' },
  loadingLine: { position: 'absolute', left: 0, top: '50%', height: 2,
    marginTop: -1, borderRadius: 1 },
  playheadOutline: { position: 'absolute', top: 3, bottom: 3, width: 4, borderRadius: 2,
    backgroundColor: SOUNDCLOUD_PLAYER_COLORS.waveformPlayheadOutline,
    alignItems: 'center', justifyContent: 'center' },
  playhead: { width: 2, height: '100%', borderRadius: 1,
    backgroundColor: SOUNDCLOUD_PLAYER_COLORS.waveformPlayhead },
});

export default React.memo(SoundCloudWaveformLayers);
