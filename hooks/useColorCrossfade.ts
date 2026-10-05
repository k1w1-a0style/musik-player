import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

export const PLAYER_COLOR_CROSSFADE_DELAY_MS = 0;
export const PLAYER_COLOR_CROSSFADE_MS = 1000;
export interface ColorLayer<T> { key: string; value: T; weight: number }

/** Retarget from the currently visible mixture, without queuing older tracks. */
export const useColorCrossfade = <T,>(value: T, key: string,
  duration = PLAYER_COLOR_CROSSFADE_MS, delay = PLAYER_COLOR_CROSSFADE_DELAY_MS) => {
  const incoming = useMemo(() => ({ key, value, weight: 1 }), [key, value]);
  const [layers, setLayers] = useState<{ active: ColorLayer<T>; outgoing: ColorLayer<T>[] }>({
    active: incoming, outgoing: [],
  });
  const layersRef = useRef(layers);
  const transition = useRef(new Animated.Value(1)).current;
  const generationRef = useRef(0);

  useEffect(() => {
    if (incoming.key === layersRef.current.active.key) return;
    const generation = ++generationRef.current;
    transition.stopAnimation(progress => {
      if (generation !== generationRef.current) return;
      const previous = layersRef.current;
      const fraction = Math.max(0, Math.min(1, progress));
      const mixture = previous.outgoing.length
        ? [...previous.outgoing.map(layer => ({ ...layer, weight: layer.weight * (1 - fraction) })),
          { ...previous.active, weight: fraction }] : [previous.active];
      // Bound image/control history during repeated rapid swipes. Retain the
      // strongest contributions in their original compositing order.
      const strongest = [...mixture].sort((a, b) => b.weight - a.weight).slice(0, 8);
      const outgoing = duration <= 0 ? [] : mixture.filter(layer => layer.weight > 0.001 && strongest.includes(layer));
      const total = outgoing.reduce((sum, layer) => sum + layer.weight, 0);
      const next = { active: incoming,
        outgoing: outgoing.map(layer => ({ ...layer, weight: layer.weight / total })) };
      layersRef.current = next;
      transition.setValue(outgoing.length ? 0 : 1);
      setLayers(next);
    });
  }, [duration, incoming, transition]);

  useEffect(() => {
    if (!layers.outgoing.length) return;
    const generation = generationRef.current;
    const animation = Animated.timing(transition, { toValue: 1, duration, delay,
      easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false });
    animation.start(({ finished }) => {
      if (!finished || generation !== generationRef.current) return;
      const next = { active: layersRef.current.active, outgoing: [] };
      layersRef.current = next;
      setLayers(next);
    });
    return () => animation.stop();
  }, [delay, duration, layers, transition]);
  useEffect(() => () => { ++generationRef.current; transition.stopAnimation(); }, [transition]);

  return { ...layers, transition };
};
