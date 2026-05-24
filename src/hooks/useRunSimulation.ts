import { useState, useCallback, useRef } from 'react';
import type { RunConfig, RunResult } from '../engine/run-simulator';
import { simulateRun } from '../engine/run-simulator';
import { buildGameState, type GameStateForm } from './useGameState';

export type RunSimStatus = 'idle' | 'running' | 'done' | 'error';

export interface RunSimState {
  status: RunSimStatus;
  result: RunResult | null;
  error: string | null;
}

export function useRunSimulation() {
  const [state, setState] = useState<RunSimState>({
    status: 'idle',
    result: null,
    error: null,
  });

  const computingRef = useRef(false);

  const run = useCallback(async (
    form: GameStateForm,
    config: Partial<RunConfig> = {},
  ) => {
    if (computingRef.current) return;
    computingRef.current = true;

    setState({ status: 'running', result: null, error: null });

    // Yield to React renderer before blocking computation
    setTimeout(() => {
      try {
        const gameState = buildGameState(form);
        const result = simulateRun(gameState, config);
        setState({ status: 'done', result, error: null });
      } catch (err) {
        setState({
          status: 'error',
          result: null,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        computingRef.current = false;
      }
    }, 50);
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, error: null });
  }, []);

  return { ...state, run, reset };
}
