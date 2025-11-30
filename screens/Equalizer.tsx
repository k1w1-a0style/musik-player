import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Slider, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { Audio } from 'expo-av';

const Equalizer = () => {
  const [audio, setAudio] = useState(new Audio.Sound());
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);

  useEffect(() => {
    // Load audio file
    audio.loadAsync(require('../assets/audio.mp3'));
  }, []);

  const handleBassChange = (value) => {
    setBass(value);
    // Update audio bass
    audio.setBass(value);
  };

  const handleMidChange = (value) => {
    setMid(value);
    // Update audio mid
    audio.setMid(value);
  };

  const handleTrebleChange = (value) => {
    setTreble(value);
    // Update audio treble
    audio.setTreble(value);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Equalizer</Text>
      <Slider
        style={styles.slider}
        value={bass}
        onValueChange={handleBassChange}
        minimumValue={-10}
        maximumValue={10}
        step={1}
      />
      <Text>Bass: {bass}</Text>
      <Slider
        style={styles.slider}
        value={mid}
        onValueChange={handleMidChange}
        minimumValue={-10}
        maximumValue={10}
        step={1}
      />
      <Text>Mid: {mid}</Text>
      <Slider
        style={styles.slider}
        value={treble}
        onValueChange={handleTrebleChange}
        minimumValue={-10}
        maximumValue={10}
        step={1}
      />
      <Text>Treble: {treble}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.md,
  },
  slider: {
    width: '80%',
    marginVertical: theme.spacing.sm,
  },
});

export default Equalizer;
