import React, { useMemo } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useMusicContext } from '../contexts/MusicContext';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { theme } from '../theme';
import EqualizerBandSliders from './EqualizerBandSliders';
import EqualizerCurveChart from './EqualizerCurveChart';
import EqualizerHeader from './EqualizerHeader';
import EqualizerPresetList from './EqualizerPresetList';
import EqualizerStatusCard from './EqualizerStatusCard';
import { buildEqualizerCurvePath } from './equalizerHelpers';

const Equalizer: React.FC = () => {
  const { eqEnabled, setEqEnabled, eqBands, setEqBand, eqPreset, applyEqPreset, eqNative } = useMusicContext();

  const curvePath = useMemo(() => buildEqualizerCurvePath(eqBands), [eqBands]);

  return (
    <AppBackground>
      <Screen style={styles.container} testID="equalizer-screen" contentStyle={styles.content}><ScrollView>
        <EqualizerHeader eqEnabled={eqEnabled} onToggleEnabled={setEqEnabled} />
        <EqualizerStatusCard eqNative={eqNative} />
        <EqualizerCurveChart curvePath={curvePath} />
        <EqualizerPresetList eqPreset={eqPreset} onApplyPreset={applyEqPreset} />
        <EqualizerBandSliders eqEnabled={eqEnabled} eqBands={eqBands} onChangeBand={setEqBand} />
      </ScrollView></Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: theme.spacing.md, paddingTop: 8 },
});

export default Equalizer;
