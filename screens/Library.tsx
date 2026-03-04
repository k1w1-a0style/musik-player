import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const Library: React.FC = () => {
  return (
    <LinearGradient colors={['#ff7e5f', '#feb47b']}>
      <BlurView intensity={50} style={{ flex: 1 }}>
        <Text>Library</Text>
      </BlurView>
    </LinearGradient>
  );
};

export default Library;
