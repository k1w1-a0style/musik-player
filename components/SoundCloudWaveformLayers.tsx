import React, { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';

interface WaveformBarsProps {
  points: readonly number[];
  sourceKey: string;
  width: number;
  height: number;
  color: string;
}

const BAR_WIDTH = 3;

const WaveformBars = React.memo(({ points, sourceKey, width, height, color }: WaveformBarsProps) => {
  const safePoints = points.length > 0 ? points : [0.08];
  const step = safePoints.length <= 1 ? 0 : (width - BAR_WIDTH) / (safePoints.length - 1);
  return (
    <Svg width={width} height={height} testID={`soundcloud-waveform-bars-${sourceKey}`}>
      {safePoints.map((point, index) => {
        const safePoint = Number.isFinite(point) ? Math.max(0.04, Math.min(1, point)) : 0.08;
        const barHeight = Math.max(4, safePoint * (height - 20));
        return <Rect key={`${sourceKey}-${index}`} x={index * step} y={(height - barHeight) / 2}
          width={BAR_WIDTH} height={barHeight} rx={BAR_WIDTH / 2} fill={color} />;
      })}
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
      <View pointerEvents="none" style={[styles.playhead, { left: viewportCenter - 1, backgroundColor: accent }]}
        testID="soundcloud-waveform-playhead" /></> : null}
    </>
  );
};

const styles = StyleSheet.create({
  strip: { position: 'absolute', left: 0, top: 0 },
  playedClip: { ...StyleSheet.absoluteFillObject, right: undefined, overflow: 'hidden' },
  loadingLine: { position: 'absolute', left: 0, top: '50%', height: 2,
    marginTop: -1, borderRadius: 1 },
  playhead: { position: 'absolute', top: 4, bottom: 4, width: 2, borderRadius: 1 },
});

export default React.memo(SoundCloudWaveformLayers);
