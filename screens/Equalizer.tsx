import React from 'react';
import EqualizerContent from './EqualizerContent';
import { useEqualizerScreenState } from './useEqualizerScreenState';

const Equalizer: React.FC = () => {
  const {
    eqEnabled,
    setEqEnabled,
    eqBands,
    setEqBand,
    eqPreset,
    applyEqPreset,
    eqNative,
    curvePath,
  } = useEqualizerScreenState();

  return (
    <EqualizerContent
      eqEnabled={eqEnabled}
      onToggleEnabled={setEqEnabled}
      eqBands={eqBands}
      onChangeBand={setEqBand}
      eqPreset={eqPreset}
      onApplyPreset={applyEqPreset}
      eqNative={eqNative}
      curvePath={curvePath}
    />
  );
};

export default Equalizer;
