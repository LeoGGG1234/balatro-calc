import { describe, it, expect } from 'vitest';
import { Rank, Suit } from '../src/engine/types';
import { computeMultiStepEV, enhanceWithLookahead } from '../src/engine/lookahead';
import { defaultState, card } from './helpers';

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
        deckComposition: {
          totalCards: 44, // 52 - 8 hand cards
          remainingByRank: {},
          remainingBySuit: { S: 10, H: 10, C: 10, D: 10 },
          cards: [],
        },
      };

      // Discard cards at indices 3, 4 (Two/Hearts, Four/Diamonds)
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
        deckComposition: {
          totalCards: 44,
          remainingByRank: {},
          remainingBySuit: { S: 10, H: 10, C: 10, D: 10 },
          cards: [],
        },
      };

      // Discard the two singleton low cards
      const result = computeMultiStepEV(state, [0, 1]);

      expect(result.expectedValue).toBeGreaterThan(0);
      // secondDiscardHelps might be true or false depending on sample
      expect(typeof result.secondDiscardHelps).toBe('boolean');
    });

    it('handles empty pool gracefully', () => {
      const handCards = [card(Rank.Ace, Suit.Spades)];
      const state = defaultState(handCards, []);

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
        deckComposition: {
          totalCards: 47,
          remainingByRank: {},
          remainingBySuit: { S: 8, H: 13, C: 13, D: 13 },
          cards: [],
        },
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
        deckComposition: {
          totalCards: 44,
          remainingByRank: {},
          remainingBySuit: { S: 10, H: 10, C: 10, D: 10 },
          cards: [],
        },
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
        deckComposition: {
          totalCards: 44,
          remainingByRank: {},
          remainingBySuit: { S: 10, H: 10, C: 10, D: 10 },
          cards: [],
        },
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
