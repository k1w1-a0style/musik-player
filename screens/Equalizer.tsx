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
        minimumValue={-10}
        maximumValue={10}
        step={1}
        onValueChange={handleBassChange}
      />
      <Text style={styles.label}>Bass</Text>
      <Slider
        style={styles.slider}
        value={mid}
        minimumValue={-10}
        maximumValue={10}
        step={1}
        onValueChange={handleMidChange}
      />
      <Text style={styles.label}>Mid</Text>
      <Slider
        style={styles.slider}
        value={treble}
        minimumValue={-10}
        maximumValue={10}
        step={1}
        onValueChange={handleTrebleChange}
      />
      <Text style={styles.label}>Treble</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  title: {
    fontSize: 24,
    color: theme.palette.text.primary,
    padding: 16,
  },
  slider: {
    width: '100%',
    height: 40,
    margin: 10,
  },
  label: {
    fontSize: 18,
    color: theme.palette.text.secondary,
    padding: 10,
  },
});

export default Equalizer;