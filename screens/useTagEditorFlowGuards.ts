import { useCallback, useRef, type RefObject } from 'react';
import type { Song } from '../types/Song';

type FlowToken = {
  generation: number;
  songId: string;
};

type FlowKind = 'cover' | 'save';

export const useTagEditorFlowGuards = (activeSongRef: RefObject<Song | undefined>) => {
  const coverPickGenerationRef = useRef(0);
  const saveGenerationRef = useRef(0);

  const invalidateFlows = useCallback((): void => {
    coverPickGenerationRef.current += 1;
    saveGenerationRef.current += 1;
  }, []);

  const beginCoverFlow = useCallback((songId: string): FlowToken => {
    coverPickGenerationRef.current += 1;
    return { generation: coverPickGenerationRef.current, songId };
  }, []);

  const beginSaveFlow = useCallback((songId: string): FlowToken => {
    saveGenerationRef.current += 1;
    return { generation: saveGenerationRef.current, songId };
  }, []);

  const isFlowStale = useCallback(
    (kind: FlowKind, token: FlowToken): boolean => {
      const currentGeneration =
        kind === 'cover' ? coverPickGenerationRef.current : saveGenerationRef.current;
      return currentGeneration !== token.generation || activeSongRef.current?.id !== token.songId;
    },
    [activeSongRef],
  );

  const isCoverFlowStale = useCallback(
    (token: FlowToken): boolean => isFlowStale('cover', token),
    [isFlowStale],
  );

  const isSaveFlowStale = useCallback(
    (token: FlowToken): boolean => isFlowStale('save', token),
    [isFlowStale],
  );

  return {
    beginCoverFlow,
    beginSaveFlow,
    invalidateFlows,
    isCoverFlowStale,
    isSaveFlowStale,
  };
};
