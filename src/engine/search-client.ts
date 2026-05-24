/**
 * Main-thread client for the search Web Worker.
 *
 * Provides a Promise-based API for running search and discard analysis
 * in a background thread.
 */

import type { GameState, SearchResult } from './types';
import type { SearchConfig } from './search';
import type { ScoreOptions } from './scorer';
import type { DiscardResult } from './discard-analyzer';
import type {
  WorkerSearchRequest, WorkerDiscardRequest,
  WorkerResultMessage, WorkerDiscardResultMessage,
  WorkerErrorMessage, WorkerResponse,
} from './search-worker';

// ─── Client Class ───────────────────────────────────────────────

type Resolver<T> = (value: T) => void;

export class SearchClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Resolver<unknown>>();
  private workerPath: string | URL;

  constructor(workerPath?: string | URL) {
    this.workerPath = workerPath ?? new URL('./search-worker.ts', import.meta.url);
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(this.workerPath, { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleMessage(event.data);
      };
      this.worker.onerror = (err) => {
        console.error('Search worker error:', err);
        // Reject all pending promises
        for (const [id, resolve] of this.pending) {
          (resolve as Resolver<{ error: string }>)({ error: err.message });
          this.pending.delete(id);
        }
      };
    }
    return this.worker;
  }

  private handleMessage(msg: WorkerResponse): void {
    const resolve = this.pending.get(msg.id);
    if (!resolve) return;

    switch (msg.type) {
      case 'result':
      case 'discard_result':
        this.pending.delete(msg.id);
        (resolve as Resolver<WorkerResultMessage | WorkerDiscardResultMessage>)(msg);
        break;
      case 'error':
        this.pending.delete(msg.id);
        (resolve as Resolver<WorkerErrorMessage>)(msg);
        break;
      case 'progress':
        // Progress messages don't resolve the promise; caller polled
        break;
    }
  }

  /**
   * Run findOptimalPlays in a worker thread.
   */
  search(
    state: GameState,
    config?: Partial<SearchConfig>,
    options?: ScoreOptions
  ): Promise<{ result?: SearchResult; error?: string }> {
    return new Promise(resolve => {
      const id = this.nextId++;
      this.pending.set(id, resolve as Resolver<unknown>);

      const msg: WorkerSearchRequest = {
        type: 'search',
        id,
        state,
        config,
        options,
      };

      this.getWorker().postMessage(msg);
    }).then((raw) => {
      const m = raw as WorkerResultMessage | WorkerErrorMessage;
      if ('result' in m) return { result: m.result };
      return { error: (m as WorkerErrorMessage).message };
    });
  }

  /**
   * Run discard analysis in a worker thread.
   */
  analyzeDiscards(
    state: GameState,
    searchConfig?: Partial<SearchConfig>,
    options?: ScoreOptions
  ): Promise<{ result?: DiscardResult; error?: string }> {
    return new Promise(resolve => {
      const id = this.nextId++;
      this.pending.set(id, resolve as Resolver<unknown>);

      const msg: WorkerDiscardRequest = {
        type: 'discard',
        id,
        state,
        searchConfig,
        options,
      };

      this.getWorker().postMessage(msg);
    }).then((raw) => {
      const m = raw as WorkerDiscardResultMessage | WorkerErrorMessage;
      if ('result' in m) return { result: m.result };
      return { error: (m as WorkerErrorMessage).message };
    });
  }

  /**
   * Terminate the worker. The client is unusable after this.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.pending.clear();
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

let defaultClient: SearchClient | null = null;

export function getSearchClient(): SearchClient {
  if (!defaultClient) {
    defaultClient = new SearchClient();
  }
  return defaultClient;
}

