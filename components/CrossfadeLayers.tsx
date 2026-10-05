import React from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColorCrossfade, PLAYER_COLOR_CROSSFADE_DELAY_MS, PLAYER_COLOR_CROSSFADE_MS } from '../hooks/useColorCrossfade';
export { PLAYER_COLOR_CROSSFADE_DELAY_MS, PLAYER_COLOR_CROSSFADE_MS } from '../hooks/useColorCrossfade';

interface CrossfadeLayersProps<T> {
  value: T;
  valueKey: string;
  renderLayer: (value: T) => React.ReactNode;
  testID: string;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  fill?: boolean;
}

/**
 * Keeps layout geometry owned by one active layer while visual-only values
 * crossfade above it. The outgoing layer is non-interactive and absolutely
 * positioned, so controls cannot jump or receive duplicate gestures.
 */
const CrossfadeLayers = <T,>({ value, valueKey, renderLayer, testID,
  duration = PLAYER_COLOR_CROSSFADE_MS, delay = PLAYER_COLOR_CROSSFADE_DELAY_MS,
  style, fill = false }: CrossfadeLayersProps<T>) => {
  const { active, outgoing, transition } = useColorCrossfade(value, valueKey, duration, delay);

  return (
    <View style={[styles.container, fill && StyleSheet.absoluteFill, style]} testID={testID}>
      {outgoing.length ? (
        <Animated.View pointerEvents="none" accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, styles.layer, { opacity: 1 }]}
          testID={`${testID}-outgoing`}>
          {outgoing.map((layer, index) => <View key={`${layer.key}:${index}`}
            style={[styles.layer, index > 0 && StyleSheet.absoluteFill, { opacity: index === 0 ? 1 : layer.weight / outgoing.slice(0, index + 1).reduce((sum, item) => sum + item.weight, 0) }]}>{renderLayer(layer.value)}</View>)}
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.layer, fill && StyleSheet.absoluteFill, { opacity: outgoing.length ? transition : 1 }]}
        testID={`${testID}-active`}>
        {renderLayer(active.value)}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'relative' },
  layer: { alignSelf: 'stretch' },
});

export default CrossfadeLayers;
