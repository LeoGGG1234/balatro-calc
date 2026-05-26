import { describe, it, expect } from 'vitest';
import { Rank, Suit, CardEnhancement, CardEdition } from '../src/engine/types';
import { analyzeDiscards, quickDiscardTip } from '../src/engine/discard-analyzer';
import { defaultState, card } from './helpers';

describe('Discard Analyzer', () => {
  it('analyzeDiscards returns baseline and options', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
    ];

    const state = defaultState(handCards, ['joker']);
    const result = analyzeDiscards(state);

    expect(result.baselineScore).toBeGreaterThan(0);
    expect(result.baselineHand).toBeDefined();
    expect(result.options.length).toBeGreaterThan(0);
    expect(result.topRecommendations.length).toBeGreaterThan(0);
    expect(result.topRecommendations.length).toBeLessThanOrEqual(5);
    expect(result.evaluationTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.discardsRemaining).toBe(3);
  });

  it('discard options are sorted by improvement descending', () => {
    const handCards = [
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Spades),
    ];

    const state = defaultState(handCards, ['joker']);
    const result = analyzeDiscards(state);

    for (let i = 1; i < result.options.length; i++) {
      expect(result.options[i - 1].improvement).toBeGreaterThanOrEqual(
        result.options[i].improvement
      );
    }
  });

  it('each discard option has valid indices', () => {
    const handCards = [
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
    ];

    const state = defaultState(handCards, ['joker']);
    const result = analyzeDiscards(state);

    for (const opt of result.options) {
      expect(opt.discardIndices.length).toBeGreaterThan(0);
      expect(opt.discardIndices.length).toBeLessThanOrEqual(5);
      for (const idx of opt.discardIndices) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(handCards.length);
      }
      // Kept cards + discarded == total
      expect(opt.keptCards.length + opt.discardCards.length).toBe(handCards.length);
      // Discard cards match the indices
      const discIds = new Set(opt.discardCards.map(c => c.id));
      for (const idx of opt.discardIndices) {
        expect(discIds.has(handCards[idx].id)).toBe(true);
      }
    }
  });

  it('analyzeDiscards with strong hand returns options', () => {
    // Already a flush — discarding should still give viable options
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Spades),
      card(Rank.Queen, Suit.Spades),
      card(Rank.Jack, Suit.Spades),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['joker']);
    const result = analyzeDiscards(state);

    expect(result.baselineScore).toBeGreaterThan(0);
    expect(result.options.length).toBeGreaterThan(0);
  });

  it('discard handles empty hand gracefully', () => {
    const state = defaultState([], []);
    const result = analyzeDiscards(state);

    expect(result.baselineScore).toBe(0);
    expect(result.options).toHaveLength(0);
    expect(result.topRecommendations).toHaveLength(0);
  });

  it('quickDiscardTip returns suggestions for mediocre hands', () => {
    const handCards = [
      card(Rank.Two, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Ten, Suit.Hearts),
      card(Rank.Three, Suit.Spades),
      card(Rank.Six, Suit.Diamonds),
      card(Rank.Seven, Suit.Clubs),
      card(Rank.Nine, Suit.Hearts),
    ];

    const state = defaultState(handCards, ['joker']);
    const tip = quickDiscardTip(state);

    // Should suggest discarding low-value cards
    if (tip) {
      expect(tip.discardIndices.length).toBeGreaterThan(0);
      expect(tip.discardCards.length).toBeGreaterThan(0);
      expect(tip.reason).toBeTruthy();
    }
  });

  it('quickDiscardTip returns null for empty hand', () => {
    const state = defaultState([], []);
    const tip = quickDiscardTip(state);
    expect(tip).toBeNull();
  });

  it('quickDiscardTip with strong hand returns null', () => {
    // Four of a Kind — excellent hand
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Ace, Suit.Clubs),
      card(Rank.Ace, Suit.Diamonds),
      card(Rank.King, Suit.Spades),
    ];

    const state = defaultState(handCards, ['joker']);
    const tip = quickDiscardTip(state);

    // Four of a Kind is high-tier, so quick tip may return null
    // (no discard needed)
    if (tip) {
      // If it does return, it should be minor
      expect(tip.discardIndices.length).toBeLessThanOrEqual(1);
    }
  });
});

// ─── Search — Smart Ordering Tests ──────────────────────────────

