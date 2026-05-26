import { describe, it, expect, vi } from 'vitest';
import { SearchClient, getSearchClient } from '../src/engine/search-client';

describe('SearchClient', () => {
  // We test the client logic with a mocked Worker since vitest
  // runs in a Node environment without native Web Workers.

  it('getSearchClient returns a singleton', async () => {
    const { getSearchClient: gsc } = await import('../src/engine/search-client');
    const client1 = gsc();
    const client2 = gsc();
    expect(client1).toBe(client2);
    client1.terminate();
  });

  it('search() resolves with result on worker response', async () => {
    // Mock Worker before importing SearchClient
    const mockPostMessage = vi.fn();
    let storedOnMessage: ((e: MessageEvent) => void) | null = null;

    const mockWorker = vi.fn(function (this: unknown) {
      storedOnMessage = null;
      return {
        postMessage: mockPostMessage,
        terminate: vi.fn(),
        set onmessage(handler: (e: MessageEvent) => void) {
          storedOnMessage = handler;
        },
      };
    });
    vi.stubGlobal('Worker', mockWorker);

    // Re-import to get a fresh instance with mocked Worker
    const { SearchClient } = await import('../src/engine/search-client');
    const client = new SearchClient('/fake-worker.js');

    const searchPromise = client.search(
      { handCards: [], jokers: [], handLevels: {}, deckComposition: { totalCards: 52, remainingByRank: {}, remainingBySuit: {} }, blind: { type: 'small_blind', baseChips: 300 }, roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 } },
      { includeJokerOrdering: false },
    );

    // Simulate worker responding
    const mockResult = {
      type: 'result' as const,
      id: 1,
      result: {
        optimalPlay: null,
        allPlays: [],
        rankedHands: [],
        evaluationTimeMs: 5,
        combinationsEvaluated: 10,
        orderingsEvaluated: 1,
      },
    };
    expect(storedOnMessage).not.toBeNull();
    storedOnMessage!({ data: mockResult } as MessageEvent);

    const { result, error } = await searchPromise;
    expect(error).toBeUndefined();
    expect(result).toBeDefined();
    expect(result!.combinationsEvaluated).toBe(10);

    client.terminate();
    vi.unstubAllGlobals();
  });

  it('search() resolves with error on worker error', async () => {
    let storedOnMessage: ((e: MessageEvent) => void) | null = null;

    const mockWorker = vi.fn(function (this: unknown) {
      storedOnMessage = null;
      return {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        set onmessage(handler: (e: MessageEvent) => void) {
          storedOnMessage = handler;
        },
      };
    });
    vi.stubGlobal('Worker', mockWorker);

    const { SearchClient } = await import('../src/engine/search-client');
    const client = new SearchClient('/fake-worker.js');

    const searchPromise = client.search(
      { handCards: [], jokers: [], handLevels: {}, deckComposition: { totalCards: 52, remainingByRank: {}, remainingBySuit: {} }, blind: { type: 'small_blind', baseChips: 300 }, roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 } },
      { includeJokerOrdering: false },
    );

    // Simulate worker error
    expect(storedOnMessage).not.toBeNull();
    storedOnMessage!({ data: { type: 'error', id: 1, message: 'test error' } } as MessageEvent);

    const { result, error } = await searchPromise;
    expect(result).toBeUndefined();
    expect(error).toBe('test error');

    client.terminate();
    vi.unstubAllGlobals();
  });

  it('analyzeDiscards() resolves with discard result on worker response', async () => {
    let storedOnMessage: ((e: MessageEvent) => void) | null = null;

    const mockWorker = vi.fn(function (this: unknown) {
      storedOnMessage = null;
      return {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        set onmessage(handler: (e: MessageEvent) => void) {
          storedOnMessage = handler;
        },
      };
    });
    vi.stubGlobal('Worker', mockWorker);

    const { SearchClient } = await import('../src/engine/search-client');
    const client = new SearchClient('/fake-worker.js');

    const discardPromise = client.analyzeDiscards(
      { handCards: [], jokers: [], handLevels: {}, deckComposition: { totalCards: 52, remainingByRank: {}, remainingBySuit: {} }, blind: { type: 'small_blind', baseChips: 300 }, roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 } },
    );

    const mockResult = {
      type: 'discard_result' as const,
      id: 1,
      result: {
        baselineScore: 100,
        baselineHand: null,
        options: [],
        topRecommendations: [],
        evaluationTimeMs: 3,
        discardsRemaining: 3,
      },
    };
    expect(storedOnMessage).not.toBeNull();
    storedOnMessage!({ data: mockResult } as MessageEvent);

    const { result, error } = await discardPromise;
    expect(error).toBeUndefined();
    expect(result).toBeDefined();
    expect(result!.baselineScore).toBe(100);

    client.terminate();
    vi.unstubAllGlobals();
  });

  it('terminate() cleans up worker', async () => {
    const terminateMock = vi.fn();
    const mockWorker = vi.fn(function (this: unknown) {
      return {
        postMessage: vi.fn(),
        terminate: terminateMock,
        set onmessage(_: unknown) {},
      };
    });
    vi.stubGlobal('Worker', mockWorker);

    const { SearchClient } = await import('../src/engine/search-client');
    const client = new SearchClient('/fake-worker.js');

    // Trigger worker creation by calling search
    const _promise = client.search(
      { handCards: [], jokers: [], handLevels: {}, deckComposition: { totalCards: 52, remainingByRank: {}, remainingBySuit: {} }, blind: { type: 'small_blind', baseChips: 300 }, roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 } },
      { includeJokerOrdering: false },
    );

    client.terminate();
    expect(terminateMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});

// ─── Run Simulator ──────────────────────────────────────────────

