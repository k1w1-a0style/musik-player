import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

export const PLAYER_COLOR_CROSSFADE_DELAY_MS = 120;
export const PLAYER_COLOR_CROSSFADE_MS = 760;

interface CrossfadeSnapshot<T> {
  key: string;
  value: T;
}

interface CrossfadeLayersProps<T> {
  value: T;
  valueKey: string;
  renderLayer: (value: T) => React.ReactNode;
  testID: string;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Keeps layout geometry owned by one active layer while visual-only values
 * crossfade above it. The outgoing layer is non-interactive and absolutely
 * positioned, so controls cannot jump or receive duplicate gestures.
 */
const CrossfadeLayers = <T,>({ value, valueKey, renderLayer, testID,
  duration = PLAYER_COLOR_CROSSFADE_MS, delay = PLAYER_COLOR_CROSSFADE_DELAY_MS,
  style }: CrossfadeLayersProps<T>) => {
  const reduceMotion = useReducedMotion();
  const incoming = useMemo<CrossfadeSnapshot<T>>(
    () => ({ key: valueKey, value }),
    [value, valueKey],
  );
  const [active, setActive] = useState(incoming);
  const [outgoing, setOutgoing] = useState<CrossfadeSnapshot<T> | null>(null);
  const transition = useRef(new Animated.Value(1)).current;
  const generationRef = useRef(0);

  useEffect(() => {
    if (incoming.key === active.key) return;
    // Finish the current blend before moving to the latest requested value.
    // This avoids a visible opacity jump during very fast track changes.
    if (outgoing && !reduceMotion) return;

    generationRef.current += 1;
    const generation = generationRef.current;
    transition.stopAnimation();
    setActive(incoming);

    if (reduceMotion || duration <= 0) {
      transition.setValue(1);
      setOutgoing(null);
      return;
    }

    setOutgoing(active);
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && generationRef.current === generation) setOutgoing(null);
    });
  }, [active, delay, duration, incoming, outgoing, reduceMotion, transition]);

  useEffect(() => () => transition.stopAnimation(), [transition]);

  const outgoingOpacity = useMemo(() => Animated.subtract(1, transition), [transition]);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {outgoing ? (
        <Animated.View pointerEvents="none" accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, styles.layer, { opacity: outgoingOpacity }]}
          testID={`${testID}-outgoing`}>
          {renderLayer(outgoing.value)}
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.layer, { opacity: outgoing ? transition : 1 }]}
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
