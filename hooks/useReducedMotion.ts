import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { usePlayerPresentation } from '../contexts/PlayerPresentationContext';

export const useReducedMotion = (): boolean => {
  const [reduceMotion, setReduceMotion] = useState(false);
  const { presentation } = usePlayerPresentation();

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (active) setReduceMotion(enabled === true);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion || presentation.quiet;
};
