import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
import { useMusicContext } from '../contexts/MusicContext';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { theme } from '../theme';
import EqualizerBandSliders from './EqualizerBandSliders';
import EqualizerCurveChart from './EqualizerCurveChart';
import EqualizerPresetList from './EqualizerPresetList';
import EqualizerStatusCard from './EqualizerStatusCard';
import { buildEqualizerCurvePath } from './equalizerHelpers';

const Equalizer: React.FC = () => {
  const { eqEnabled, setEqEnabled, eqBands, setEqBand, eqPreset, applyEqPreset, eqNative } = useMusicContext();

  const curvePath = useMemo(() => buildEqualizerCurvePath(eqBands), [eqBands]);

  return (
    <AppBackground>
      <Screen style={styles.container} testID="equalizer-screen" contentStyle={styles.content}><ScrollView>
        <Text style={styles.eyebrow}>SOUND</Text>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Equalizer</Text>
          <Switch value={eqEnabled} onValueChange={setEqEnabled} trackColor={{ false: theme.palette.border, true: theme.palette.primary }} thumbColor={theme.palette.text.primary} />
        </View>

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
  eyebrow: { color: theme.palette.primary, fontSize: 10, letterSpacing: 1.8, fontFamily: theme.fonts.body },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  title: { fontSize: 32, fontFamily: theme.fonts.display, letterSpacing: -1, color: theme.palette.text.primary },
});

export default Equalizer;
