import { useMusicProviderContextCompositionFinal as useMusicProviderContextComposition } from './useMusicProviderContextCompositionFinal';
import { useMusicProviderDomainActions } from './useMusicProviderDomainActions';
import { useMusicProviderDomainEffects } from './useMusicProviderDomainEffects';
import { useMusicProviderRuntime } from './useMusicProviderRuntime';

export const useMusicProviderController = () => {
  const runtime = useMusicProviderRuntime();
  const actions = useMusicProviderDomainActions(runtime);

  useMusicProviderDomainEffects(runtime);

  return useMusicProviderContextComposition(runtime, actions);
};
