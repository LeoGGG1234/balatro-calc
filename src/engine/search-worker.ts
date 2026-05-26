/**
 * Web Worker for running search computations off the main thread.
 *
 * Usage (from main thread):
 *   const worker = new Worker(
 *     new URL('./search-worker.ts', import.meta.url),
 *     { type: 'module' }
 *   );
 *   worker.postMessage({ type: 'search', state, config });
 *   worker.onmessage = (e) => { const result = e.data; };
 */

import type { GameState, SearchResult } from './types';
import { findOptimalPlays, type SearchConfig } from './search';
import type { ScoreOptions } from './scorer';
import { analyzeDiscards } from './discard-analyzer';
import { computeFogCardEV, type FogCardEVResult, type FogEVConfig } from './fog-ev';

// ─── Message Types ──────────────────────────────────────────────

export interface WorkerSearchRequest {
  type: 'search';
  id: number;
  state: GameState;
  config?: Partial<SearchConfig>;
  options?: ScoreOptions;
}

export interface WorkerDiscardRequest {
  type: 'discard';
  id: number;
  state: GameState;
  searchConfig?: Partial<SearchConfig>;
  options?: ScoreOptions;
}

export interface WorkerFogEVRequest {
  type: 'fog_ev';
  id: number;
  state: GameState;
  searchConfig?: Partial<SearchConfig>;
  scoreOptions?: ScoreOptions;
  config?: Partial<FogEVConfig>;
}

export interface WorkerProgressMessage {
  type: 'progress';
  id: number;
  evaluated: number;
  totalEstimate: number;
}

export interface WorkerResultMessage {
  type: 'result';
  id: number;
  result: SearchResult;
}

export interface WorkerDiscardResultMessage {
  type: 'discard_result';
  id: number;
  result: ReturnType<typeof analyzeDiscards>;
}

export interface WorkerFogEVResultMessage {
  type: 'fog_ev_result';
  id: number;
  result: FogCardEVResult | null;
}

export interface WorkerErrorMessage {
  type: 'error';
  id: number;
  message: string;
}

export type WorkerRequest = WorkerSearchRequest | WorkerDiscardRequest | WorkerFogEVRequest;
export type WorkerResponse =
  | WorkerResultMessage
  | WorkerDiscardResultMessage
  | WorkerFogEVResultMessage
  | WorkerProgressMessage
  | WorkerErrorMessage;

// ─── Worker Message Handler ─────────────────────────────────────

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'search': {
        const onProgress = (evaluated: number, total: number) => {
          const response: WorkerProgressMessage = {
            type: 'progress',
            id: msg.id,
            evaluated,
            totalEstimate: total,
          };
          self.postMessage(response);
        };
        const result = findOptimalPlays(
          msg.state,
          { ...msg.config, onProgress },
          msg.options,
        );
        const response: WorkerResultMessage = {
          type: 'result',
          id: msg.id,
          result,
        };
        self.postMessage(response);
        break;
      }

      case 'discard': {
        const result = analyzeDiscards(msg.state, undefined, msg.searchConfig, msg.options);
        const response: WorkerDiscardResultMessage = {
          type: 'discard_result',
          id: msg.id,
          result,
        };
        self.postMessage(response);
        break;
      }

      case 'fog_ev': {
        const result = computeFogCardEV(
          msg.state,
          msg.searchConfig,
          msg.scoreOptions,
          msg.config,
        );
        const response: WorkerFogEVResultMessage = {
          type: 'fog_ev_result',
          id: msg.id,
          result,
        };
        self.postMessage(response);
        break;
      }

      default:
        throw new Error(`Unknown message type: ${(msg as { type: string }).type}`);
    }
  } catch (err) {
    const response: WorkerErrorMessage = {
      type: 'error',
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
