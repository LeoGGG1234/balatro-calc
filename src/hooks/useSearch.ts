import { useState, useCallback, useRef, useEffect } from 'react';
import type { SearchResult, SearchConfig } from '../engine/types';
import type { ScoreOptions } from '../engine/scorer';
import { buildGameState, type GameStateForm } from './useGameState';
import { getSearchClient } from '../engine/search-client';

// ─── Hook State ────────────────────────────────────────────────

export type SearchStatus = 'idle' | 'computing' | 'done' | 'error';

export interface SearchState {
  status: SearchStatus;
  result: SearchResult | null;
  error: string | null;
}

export function useSearch() {
  const [state, setState] = useState<SearchState>({
    status: 'idle',
    result: null,
    error: null,
  });

  const computingRef = useRef(false);

  // Cleanup: terminate worker on unmount
  useEffect(() => {
    const client = getSearchClient();
    return () => {
      client.terminate();
    };
  }, []);

  const search = useCallback(async (
    form: GameStateForm,
    config?: Partial<SearchConfig>,
    options?: ScoreOptions
  ) => {
    if (computingRef.current) return;
    computingRef.current = true;

    setState({ status: 'computing', result: null, error: null });

    try {
      const gameState = buildGameState(form);
      const client = getSearchClient();
      const { result, error } = await client.search(gameState, config, options);

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

  return { ...state, search, reset };
}
