const pendingActions = new Set<string>();

interface PlaybackUiActionOptions {
  dropIfPending?: boolean;
}

/**
 * Fire-and-forget boundary for UI events. It consumes rejected promises so
 * React Native never receives an unhandled rejection and can optionally
 * collapse accidental double taps while the same native action is pending.
 */
export const runPlaybackUiAction = async (
  actionName: string,
  action: () => unknown | Promise<unknown>,
  { dropIfPending = false }: PlaybackUiActionOptions = {},
): Promise<void> => {
  if (dropIfPending && pendingActions.has(actionName)) return;
  if (dropIfPending) pendingActions.add(actionName);

  try {
    await action();
  } catch (error) {
    console.warn(`[PlaybackUI:${actionName}] Action failed.`, error);
  } finally {
    if (dropIfPending) pendingActions.delete(actionName);
  }
};

export const resetPlaybackUiActionsForTests = (): void => {
  pendingActions.clear();
};
