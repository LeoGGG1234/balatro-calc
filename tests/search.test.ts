import { describe, it, expect } from 'vitest';
import { Rank, Suit, HandType, CardEdition } from '../src/engine/types';
import { findOptimalPlays, findOptimalPlay, formatScore } from '../src/engine/search';
import { defaultState, card } from './helpers';

describe('Search', () => {
  it('finds the best hand among options', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Queen, Suit.Spades),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
    ];

    const state = defaultState(handCards, ['joker']);
    const result = findOptimalPlays(state);

    expect(result.optimalPlay).toBeDefined();
    expect(result.allPlays.length).toBeGreaterThan(0);

    // Full House (A-A-A-K-K) or Two Pair (A-A-K-K) should be best
    // With Ace = 11 chips each, Pair = 10chips/2mult base
    console.log('Best hand:', result.optimalPlay.handType, 'Score:', result.optimalPlay.totalScore);
    console.log('All ranked hands:', result.rankedHands.map(h => `${h.handType}: ${h.bestScore}`));
  });

  it('finds optimal joker ordering', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['joker', 'cavendish']);
    const result = findOptimalPlays(state, { includeJokerOrdering: true });

    expect(result.optimalPlay).toBeDefined();
    // Optimal joker order should be: joker (index 0 in original array) first, cavendish second
    // i.e., jokerOrder = [0, 1]
    expect(result.optimalPlay.jokerOrder).toEqual([0, 1]);
  });

  it('handles search without joker ordering optimization', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, []);
    const result = findOptimalPlays(state, { includeJokerOrdering: false });

    expect(result.optimalPlay).toBeDefined();
    expect(result.allPlays.length).toBeGreaterThan(0);
  });

  it('findOptimalPlay returns single best play', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
    ];

    const state = defaultState(handCards, ['joker']);
    const result = findOptimalPlay(state);

    expect(result).toBeDefined();
    expect(result!.totalScore).toBeGreaterThan(0);
  });

  it('search respects maxComputationMs limit', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Queen, Suit.Spades),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
    ];

    const state = defaultState(handCards, ['joker', 'cavendish', 'lusty_joker']);
    // With 3 jokers (6 permutations) and many subsets, this should still finish quick
    const result = findOptimalPlays(state, { maxComputationMs: 100 });
    expect(result.evaluationTimeMs).toBeLessThan(200);
    expect(result.combinationsEvaluated).toBeGreaterThan(0);
  });

  it('Cerulean Bell: forcedCardId filters candidates', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Spades),
      card(Rank.Queen, Suit.Spades),
      card(Rank.Ten, Suit.Spades),
    ];
    const forcedCardId = handCards[1].id; // King

    const state = {
      ...defaultState(handCards, []),
      blind: {
        type: 'boss' as const,
        chipsRequired: 300,
        debuffedRanks: [],
        debuffedSuits: [],
        forcedCardId,
      },
    };

    const result = findOptimalPlays(state, { includeJokerOrdering: false });
    // All candidates must include the forced card (King)
    for (const c of result.allPlays) {
      expect(c.playedCards.some(card => card.id === forcedCardId)).toBe(true);
    }
  });
});

// ─── formatScore Tests ──────────────────────────────────────────

describe('formatScore', () => {
  it('formats numbers < 1000 as-is', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(500)).toBe('500');
    expect(formatScore(999)).toBe('999');
  });

  it('formats thousands with K', () => {
    expect(formatScore(1000)).toBe('1.0K');
    expect(formatScore(1500)).toBe('1.5K');
    expect(formatScore(999999)).toBe('1000.0K');
  });

  it('formats millions with M', () => {
    expect(formatScore(1000000)).toBe('1.0M');
    expect(formatScore(2500000)).toBe('2.5M');
  });

  it('formats billions with B', () => {
    expect(formatScore(1000000000)).toBe('1.0B');
  });

  it('uses scientific notation for very large scores', () => {
    const result = formatScore(1000000000000);
    expect(result).toContain('e');
  });
});

// ─── Joker Registry Tests ──────────────────────────────────────

