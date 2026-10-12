import React, { createContext, useContext, useMemo, useState } from 'react';

export const MINI_PLAYER_BOTTOM_MARGIN = 12;
export const MINI_PLAYER_LIST_GAP = 20;

interface MiniPlayerViewport {
  bottomInset: number;
  reportHeight: (height: number) => void;
}
const MiniPlayerViewportContext = createContext<MiniPlayerViewport>({ bottomInset: 20, reportHeight: () => undefined });

/** The list reserves the measured overlay, including its safe-area offset. */
export const MiniPlayerViewportProvider = ({ children, safeAreaBottom }: {
  children: React.ReactNode;
  safeAreaBottom: number;
}) => {
  const [height, reportHeight] = useState(0);
  const value = useMemo(() => ({ reportHeight,
    bottomInset: MINI_PLAYER_LIST_GAP + (height > 0 ? height + safeAreaBottom + MINI_PLAYER_BOTTOM_MARGIN : 0),
  }), [height, safeAreaBottom]);
  return <MiniPlayerViewportContext.Provider value={value}>{children}</MiniPlayerViewportContext.Provider>;
};

export const useMiniPlayerViewport = (): MiniPlayerViewport => useContext(MiniPlayerViewportContext);
