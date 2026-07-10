import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { EqInitResult } from 'expo-system-audio';
import type { EqPresetName } from '../types/Song';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import EqualizerBandSliders from './EqualizerBandSliders';
import EqualizerCurveChart from './EqualizerCurveChart';
import EqualizerHeader from './EqualizerHeader';
import EqualizerPresetList from './EqualizerPresetList';
import EqualizerStatusCard from './EqualizerStatusCard';

interface EqualizerContentProps {
  eqEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  eqBands: number[];
  onChangeBand: (index: number, value: number) => void;
  eqPreset: EqPresetName | 'custom';
  onApplyPreset: (preset: EqPresetName) => void;
  eqNative: EqInitResult | null;
  curvePath: string;
}

const EqualizerContent: React.FC<EqualizerContentProps> = ({
  eqEnabled,
  onToggleEnabled,
  eqBands,
  onChangeBand,
  eqPreset,
  onApplyPreset,
  eqNative,
  curvePath,
}) => (
  <AppBackground>
    <Screen style={styles.container} testID="equalizer-screen" contentStyle={styles.content}>
      <ScrollView>
        <EqualizerHeader eqEnabled={eqEnabled} onToggleEnabled={onToggleEnabled} />
        <EqualizerStatusCard eqNative={eqNative} />
        <EqualizerCurveChart curvePath={curvePath} />
        <EqualizerPresetList eqPreset={eqPreset} onApplyPreset={onApplyPreset} />
        <EqualizerBandSliders eqEnabled={eqEnabled} eqBands={eqBands} onChangeBand={onChangeBand} />
      </ScrollView>
    </Screen>
  </AppBackground>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: APP_THEME_TOKENS.spacing.md, paddingTop: 8 },
});

export default EqualizerContent;
