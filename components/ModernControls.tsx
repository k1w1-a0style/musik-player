import React from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';

const ModernControls: React.FC = () => {
  return (
    <View>
      <Text>Volume Control</Text>
      <Slider minimumValue={0} maximumValue={100} />
    </View>
  );
};

export default ModernControls;
