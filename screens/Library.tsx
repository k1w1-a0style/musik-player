import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const Library: React.FC = () => {
  return (
    <LinearGradient colors={['#e0e0e0', '#ffffff']}>
      <BlurView intensity={50} style={{ borderRadius: 10 }}>
        <Text>Library</Text>
      </BlurView>
    </LinearGradient>
  );
};

export default Library;
