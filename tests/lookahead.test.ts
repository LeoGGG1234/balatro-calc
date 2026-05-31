import { describe, it, expect } from 'vitest';
import { Rank, Suit, CardEnhancement, CardEdition, Seal } from '../src/engine/types';
import type { DeckCardSlot } from '../src/engine/types';
import { computeMultiStepEV, enhanceWithLookahead } from '../src/engine/lookahead';
import {
  computeDiscardEV, sampleDrawsWithoutReplacement, buildAvailableCardPool,
} from '../src/engine/strategy-evaluator';
import { createRng } from '../src/engine/rng';
import { defaultState, card } from './helpers';

// ─── Test Helpers ──────────────────────────────────────────────────

const ALL_RANKS = [Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
  Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King, Rank.Ace];
const ALL_SUITS = [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds];

/** Build a standard 52-card deck, excluding the given hand cards (matched by id). */
function buildRemainingDeck(handCards: { id: string; rank: Rank; suit: Suit }[]): DeckCardSlot[] {
  const handIds = new Set(handCards.map(c => c.id));
  const remaining: DeckCardSlot[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      const slot: DeckCardSlot = {
        rank, suit,
        enhancement: CardEnhancement.None,
        edition: CardEdition.None,
        seal: Seal.None,
      };
      // Exclude cards that are in hand (matched by rank+suit since
      // test hand cards have unique rank-suit pairs)
      const isInHand = handCards.some(hc => hc.rank === rank && hc.suit === suit);
      if (!isInHand) {
        remaining.push(slot);
      }
    }
  }
  return remaining;
}

function makeDeckComp(handCards: { id: string; rank: Rank; suit: Suit }[]) {
  const cards = buildRemainingDeck(handCards);
  return {
    totalCards: cards.length,
    remainingByRank: {},
    remainingBySuit: {},
    cards,
  };
}

describe('Multi-Step Lookahead', () => {
  describe('computeMultiStepEV', () => {
    it('returns EV for a valid discard candidate', () => {
      const handCards = [
        card(Rank.Ace, Suit.Spades),
        card(Rank.King, Suit.Spades),
        card(Rank.Queen, Suit.Spades),
        card(Rank.Three, Suit.Hearts),
        card(Rank.Five, Suit.Diamonds),
        card(Rank.Eight, Suit.Clubs),
        card(Rank.Two, Suit.Hearts),
        card(Rank.Four, Suit.Diamonds),
      ];

      const state = {
        ...defaultState(handCards, ['joker']),
        deckComposition: makeDeckComp(handCards),
      };

      // Discard cards at indices 6, 7 (Two/Hearts, Four/Diamonds)
      const result = computeMultiStepEV(state, [6, 7]);

      expect(result.firstDiscardIndices).toEqual([6, 7]);
      expect(result.expectedValue).toBeGreaterThan(0);
      expect(result.totalSamples).toBeGreaterThan(0);
      expect(result.singleStepEV).toBeGreaterThan(0);
    });

    it('returns secondDiscardHelps when 2nd discard adds value', () => {
      const handCards = [
        card(Rank.Two, Suit.Clubs),
        card(Rank.Three, Suit.Diamonds),
        card(Rank.King, Suit.Spades),
        card(Rank.King, Suit.Hearts),
        card(Rank.Ace, Suit.Spades),
        card(Rank.Ace, Suit.Hearts),
        card(Rank.Four, Suit.Diamonds),
        card(Rank.Seven, Suit.Clubs),
      ];
      const state = {
        ...defaultState(handCards, ['joker']),
        deckComposition: makeDeckComp(handCards),
      };

      // Discard the two singleton low cards
      const result = computeMultiStepEV(state, [0, 1]);

      expect(result.expectedValue).toBeGreaterThan(0);
      // secondDiscardHelps might be true or false depending on sample
      expect(typeof result.secondDiscardHelps).toBe('boolean');
    });

    it('handles empty pool gracefully', () => {
      const handCards = [card(Rank.Ace, Suit.Spades)];
      const state = {
        ...defaultState(handCards, []),
        deckComposition: {
          totalCards: 0,
          remainingByRank: {},
          remainingBySuit: {},
          cards: [],
        },
      };

      // Empty pool (no deck cards)
      const result = computeMultiStepEV(state, [0]);

      expect(result.expectedValue).toBeGreaterThanOrEqual(0);
      expect(result.totalSamples).toBeGreaterThanOrEqual(0);
    });

    it('respects maxComputationMs time limit', () => {
      const handCards = [
        card(Rank.Ace, Suit.Spades),
        card(Rank.King, Suit.Spades),
        card(Rank.Queen, Suit.Spades),
        card(Rank.Jack, Suit.Spades),
        card(Rank.Ten, Suit.Spades),
      ];
      const state = {
        ...defaultState(handCards, ['joker']),
        deckComposition: makeDeckComp(handCards),
      };

      const startTime = performance.now();
      const result = computeMultiStepEV(state, [4], {
        maxDepth: 2,
        samplesFirstStep: 5,
        samplesSecondStep: 5,
        maxSecondDiscards: 2,
        maxComputationMs: 5000,
      });
      const elapsed = performance.now() - startTime;

      expect(result.expectedValue).toBeGreaterThan(0);
      expect(result.totalSamples).toBeGreaterThan(0);
      // Should complete within reasonable time
      expect(elapsed).toBeLessThan(15000);
    });
  });

  describe('enhanceWithLookahead', () => {
    it('returns enhanced EvOptions for top discard candidates', () => {
      const handCards = [
        card(Rank.Ace, Suit.Spades),
        card(Rank.King, Suit.Spades),
        card(Rank.Queen, Suit.Spades),
        card(Rank.Three, Suit.Hearts),
        card(Rank.Five, Suit.Diamonds),
        card(Rank.Eight, Suit.Clubs),
        card(Rank.Two, Suit.Hearts),
        card(Rank.Four, Suit.Diamonds),
      ];
      const state = {
        ...defaultState(handCards, ['joker']),
        deckComposition: makeDeckComp(handCards),
      };

      const candidates = [
        { indices: [6, 7], keptCards: handCards.slice(0, 6) },
        { indices: [3, 4], keptCards: handCards.filter((_, i) => i !== 3 && i !== 4) },
      ];

      const enhanced = enhanceWithLookahead(state, candidates);

      expect(enhanced.length).toBeLessThanOrEqual(2);
      expect(enhanced.length).toBeGreaterThan(0);
      for (const opt of enhanced) {
        expect(opt.type).toBe('discard');
        expect(opt.isEV).toBe(true);
        expect(opt.score).toBeGreaterThan(0);
      }
    });

    it('respects time limit and returns partial results', () => {
      const handCards = Array.from({ length: 8 }, (_, i) =>
        card(
          [Rank.Ace, Rank.King, Rank.Queen, Rank.Jack, Rank.Ten, Rank.Nine, Rank.Eight, Rank.Seven][i],
          [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds][i % 4],
        ),
      );
      const state = {
        ...defaultState(handCards, ['joker']),
        deckComposition: makeDeckComp(handCards),
      };

      const candidates = [
        { indices: [7], keptCards: handCards.slice(0, 7) },
        { indices: [6, 7], keptCards: handCards.slice(0, 6) },
        { indices: [5, 6, 7], keptCards: handCards.slice(0, 5) },
      ];

      const enhanced = enhanceWithLookahead(state, candidates, {
        maxComputationMs: 3000,
        samplesFirstStep: 3,
        samplesSecondStep: 3,
      });

      // Should return at least some results
      expect(enhanced.length).toBeGreaterThan(0);
    });
  });
});

// ─── computeDiscardEV — Direct Unit Tests ───────────────────────

describe('computeDiscardEV', () => {
  it('returns deterministic EV for same inputs (seeded RNG)', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Spades),
      card(Rank.Queen, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Five, Suit.Hearts),
      card(Rank.Six, Suit.Diamonds),
    ];
    const state = {
      ...defaultState(handCards, ['joker']),
      deckComposition: makeDeckComp(handCards),
    };
    const pool = buildAvailableCardPool(state.deckComposition);
    const rng = createRng('test-seed-42');

    const result1 = computeDiscardEV(state, [3, 4], pool, 30, rng);
    const rng2 = createRng('test-seed-42');
    const result2 = computeDiscardEV(state, [3, 4], pool, 30, rng2);

    // Same seed → identical results
    expect(result1.expectedValue).toBe(result2.expectedValue);
    expect(result1.minScore).toBe(result2.minScore);
    expect(result1.maxScore).toBe(result2.maxScore);
    expect(result1.samplesEvaluated).toBe(result2.samplesEvaluated);
  });

  it('returns valid structure with hand probabilities', () => {
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
    const state = {
      ...defaultState(handCards, ['joker']),
      deckComposition: makeDeckComp(handCards),
    };
    const pool = buildAvailableCardPool(state.deckComposition);
    const rng = createRng('balatro-calc-ev-v2');

    const result = computeDiscardEV(state, [5, 6, 7], pool, 50, rng);

    expect(result.expectedValue).toBeGreaterThan(0);
    expect(result.samplesEvaluated).toBeGreaterThan(0);
    expect(result.minScore).toBeLessThanOrEqual(result.expectedValue);
    expect(result.maxScore).toBeGreaterThanOrEqual(result.expectedValue);
    expect(result.handProbabilities).toBeDefined();
    // At least one hand type should have probability > 0
    const totalProb = Object.values(result.handProbabilities).reduce((a, b) => a + b, 0);
    expect(totalProb).toBeCloseTo(1, 1);
  });

  it('handles empty pool gracefully', () => {
    const handCards = [card(Rank.Ace, Suit.Spades)];
    const state = {
      ...defaultState(handCards, []),
      deckComposition: { totalCards: 0, remainingByRank: {}, remainingBySuit: {}, cards: [] },
    };
    const pool = buildAvailableCardPool(state.deckComposition);
    const rng = createRng('test');

    const result = computeDiscardEV(state, [0], pool, 10, rng);

    expect(result.expectedValue).toBeGreaterThanOrEqual(0);
    expect(result.samplesEvaluated).toBe(0);
  });
});

// ─── sampleDrawsWithoutReplacement — Determinism Tests ──────────

describe('sampleDrawsWithoutReplacement', () => {
  it('produces identical samples for identical seeds', () => {
    const pool = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Queen, Suit.Diamonds),
      card(Rank.Jack, Suit.Clubs),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Nine, Suit.Hearts),
    ];

    const rng1 = createRng('sample-test');
    const rng2 = createRng('sample-test');

    const draws1 = sampleDrawsWithoutReplacement(pool, 2, 5, rng1);
    const draws2 = sampleDrawsWithoutReplacement(pool, 2, 5, rng2);

    expect(draws1.length).toBe(draws2.length);
    for (let i = 0; i < draws1.length; i++) {
      expect(draws1[i].length).toBe(draws2[i].length);
      for (let j = 0; j < draws1[i].length; j++) {
        expect(draws1[i][j].rank).toBe(draws2[i][j].rank);
        expect(draws1[i][j].suit).toBe(draws2[i][j].suit);
      }
    }
  });

  it('returns empty array for empty pool', () => {
    const rng = createRng('test');
    const draws = sampleDrawsWithoutReplacement([], 2, 10, rng);
    expect(draws).toEqual([]);
  });

  it('caps samples at binomial maximum', () => {
    const pool = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Queen, Suit.Diamonds),
    ];
    const rng = createRng('cap-test');

    // C(3,2) = 3 combinations max, request 100 samples → should cap at 3
    const draws = sampleDrawsWithoutReplacement(pool, 2, 100, rng);

    expect(draws.length).toBeLessThanOrEqual(3);
  });
});
