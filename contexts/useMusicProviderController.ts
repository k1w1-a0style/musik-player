import { useMusicProviderContextComposition } from './useMusicProviderContextComposition';
import { useMusicProviderDomainActions } from './useMusicProviderDomainActions';
import { useMusicProviderDomainEffects } from './useMusicProviderDomainEffects';
import { useMusicProviderRuntime } from './useMusicProviderRuntime';
import { useResumePositionTracking } from '../hooks/useResumePositionTracking';

export const useMusicProviderController = () => {
  const runtime = useMusicProviderRuntime();
  const actions = useMusicProviderDomainActions(runtime);

  useMusicProviderDomainEffects(runtime);
  useResumePositionTracking(runtime.refs.nativeQueueRef);

  return {
    ...useMusicProviderContextComposition(runtime, actions),
    contentReady: runtime.state.libraryHydrationReady || runtime.state.isReady,
  };
};
