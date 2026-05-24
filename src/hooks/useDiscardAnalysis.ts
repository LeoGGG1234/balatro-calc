import { useState, useCallback, useRef } from 'react';
import type { DiscardResult } from '../engine/discard-analyzer';
import type { SearchConfig } from '../engine/search';
import type { ScoreOptions } from '../engine/scorer';
import { buildGameState, type GameStateForm } from './useGameState';
import { getSearchClient } from '../engine/search-client';

export type DiscardStatus = 'idle' | 'computing' | 'done' | 'error';

export interface DiscardState {
  status: DiscardStatus;
  result: DiscardResult | null;
  error: string | null;
}

export function useDiscardAnalysis() {
  const [state, setState] = useState<DiscardState>({
    status: 'idle',
    result: null,
    error: null,
  });

  const computingRef = useRef(false);

  const analyze = useCallback(async (
    form: GameStateForm,
    searchConfig?: Partial<SearchConfig>,
    options?: ScoreOptions
  ) => {
    if (computingRef.current) return;
    computingRef.current = true;

    setState({ status: 'computing', result: null, error: null });

    try {
      const gameState = buildGameState(form);
      const client = getSearchClient();
      const { result, error } = await client.analyzeDiscards(gameState, searchConfig, options);

      if (error) {
        setState({ status: 'error', result: null, error });
      } else if (result) {
        setState({ status: 'done', result, error: null });
      } else {
        setState({ status: 'error', result: null, error: 'No result returned' });
      }
    } catch (err) {
      setState({
        status: 'error',
        result: null,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      computingRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, error: null });
  }, []);

  return { ...state, analyze, reset };
}
