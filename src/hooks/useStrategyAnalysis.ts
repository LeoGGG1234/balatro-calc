import { useState, useCallback, useRef } from 'react';
import type { SearchConfig } from '../engine/types';
import type { ScoreOptions } from '../engine/scorer';
import type { StrategyRecommendation, StrategyConfig } from '../engine/strategy-evaluator';
import { buildGameState, type GameStateForm } from './useGameState';
import { getSearchClient } from '../engine/search-client';

// ─── Hook State ────────────────────────────────────────────────

export type StrategyStatus = 'idle' | 'computing' | 'done' | 'error';

export interface StrategyState {
  status: StrategyStatus;
  result: StrategyRecommendation | null;
  error: string | null;
}

export function useStrategyAnalysis() {
  const [state, setState] = useState<StrategyState>({
    status: 'idle',
    result: null,
    error: null,
  });

  const computingRef = useRef(false);

  const analyze = useCallback(async (
    form: GameStateForm,
    config?: Partial<StrategyConfig>,
    searchConfig?: Partial<SearchConfig>,
    scoreOptions?: ScoreOptions,
  ) => {
    if (computingRef.current) return;
    computingRef.current = true;

    setState({ status: 'computing', result: null, error: null });

    try {
      const gameState = buildGameState(form);
      const client = getSearchClient();
      const { result, error } = await client.analyzeStrategy(
        gameState, config, searchConfig, scoreOptions,
      );

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
