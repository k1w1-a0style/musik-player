import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

/** Lets the first navigation frame render before optional native backfills start. */
export const useAfterInitialInteractions = (): boolean => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const task = InteractionManager.runAfterInteractions(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
      task.cancel();
    };
  }, []);

  return ready;
};
