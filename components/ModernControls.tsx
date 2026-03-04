import React from 'react';
import { View, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

const ModernControls: React.FC = () => {
  return (
    <View style={styles.container}>
      <Slider style={styles.slider} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slider: {
    width: '100%',
  },
});

export default ModernControls;
