import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList } from 'react-native';
import { theme } from '../theme';

const Covers = () => {
  const [covers, setCovers] = useState([]);

  useEffect(() => {
    // Load covers from storage
    setCovers([
      { id: 1, image: require('../assets/cover1.jpg') },
      { id: 2, image: require('../assets/cover2.jpg') },
      { id: 3, image: require('../assets/cover3.jpg') },
    ]);
  }, []);

  const handleSelectCover = (cover) => {
    // Select cover
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Covers</Text>
      <FlatList
        data={covers}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleSelectCover(item)}>
            <Image source={item.image} style={styles.cover} />
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id.toString()}
      />
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
  cover: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.sm,
    margin: theme.spacing.sm,
  },
});

export default Covers;
