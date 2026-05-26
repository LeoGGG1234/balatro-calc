import { describe, it, expect } from 'vitest';
import { Rank, Suit, CardEdition } from '../src/engine/types';
import { findOptimalPlays, findOptimalPlay } from '../src/engine/search';
import { defaultState, card } from './helpers';

describe('Search — Smart Ordering', () => {
  it('search with smartOrdering=true reports fewer orderings than brute force', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Spades),
      card(Rank.Queen, Suit.Spades),
      card(Rank.Jack, Suit.Spades),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
    ];

    // 3 regular jokers — smart should use 1 ordering, brute would use 6
    const state = defaultState(handCards, ['joker', 'cavendish', 'stuntman']);

    const smartResult = findOptimalPlays(state, { smartOrdering: true });
    const bruteResult = findOptimalPlays(state, { smartOrdering: false });

    // Smart ordering should evaluate fewer or equal orderings
    expect(smartResult.orderingsEvaluated).toBeLessThanOrEqual(
      bruteResult.orderingsEvaluated
    );
  });

  it('smart ordering finds the same optimal score as brute force', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Ace, Suit.Clubs),
      card(Rank.King, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
    ];

    const state = defaultState(handCards, ['joker', 'cavendish', 'stuntman']);

    const smartResult = findOptimalPlays(state, { smartOrdering: true });
    const bruteResult = findOptimalPlays(state, { smartOrdering: false });

    expect(smartResult.optimalPlay.totalScore).toBe(
      bruteResult.optimalPlay.totalScore
    );
  });

  it('search result includes orderingsEvaluated', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
    ];

    const state = defaultState(handCards, ['joker', 'cavendish']);
    const result = findOptimalPlays(state);

    expect(result.orderingsEvaluated).toBeGreaterThanOrEqual(1);
    expect(result.combinationsEvaluated).toBeGreaterThanOrEqual(
      result.orderingsEvaluated
    );
  });

  it('smartOrdering default is true (smart)', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
    ];

    // Use default config (smartOrdering should be true)
    const state = defaultState(handCards, ['joker', 'cavendish', 'stuntman']);
    const result = findOptimalPlays(state, {});

    // With 3 non-Blueprint jokers, smart ordering should use exactly 1 ordering
    expect(result.orderingsEvaluated).toBe(1);
  });

  it('smart ordering with Blueprint evaluates more than 1 ordering', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Spades),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['joker', 'blueprint']);
    const result = findOptimalPlays(state, { smartOrdering: true });

    // Blueprint needs to be tried at different positions
    expect(result.orderingsEvaluated).toBeGreaterThan(1);
  });
});

// ─── Search Client (Web Worker) ─────────────────────────────────

