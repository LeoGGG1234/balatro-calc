import { describe, it, expect } from 'vitest';
import { Rank, Suit, CardEdition, HandType } from '../src/engine/types';
import { scorePlay } from '../src/engine/scorer';
import { defaultState, card } from './helpers';

describe('Scorer — Pareidolia', () => {
  it('Smiley Face triggers on all cards with pareidolia', () => {
    const handCards = [
      card(Rank.Two, Suit.Spades),   // number card
      card(Rank.Three, Suit.Hearts),  // number card
      card(Rank.Five, Suit.Clubs),    // number card
      card(Rank.Eight, Suit.Diamonds), // number card
      card(Rank.Ten, Suit.Spades),    // number card
      card(Rank.Four, Suit.Hearts),
      card(Rank.Six, Suit.Clubs),
      card(Rank.Seven, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['smiley_face']);
    const candidate: PlayCandidate = {
      playedCards: handCards.slice(0, 5), // 5 number cards
      heldCards: handCards.slice(5),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    // Without pareidolia: Smiley Face doesn't trigger (no face cards)
    const without = scorePlay(state, candidate);
    // High Card L1: 5 chips, 1 mult
    // Cards: 2+3+5+8+10 = 28
    // Total chips: 5 + 28 = 33, mult: 1
    expect(without.totalMult).toBe(1);
    expect(without.totalChips).toBe(33);

    // With pareidolia: all cards are face, +5 mult each → +25 mult
    const withParei = scorePlay(state, candidate, {
      jokerModifiers: { fourFingers: false, smeared: false, shortcut: false, allCardsFace: true },
    });
    // Total chips: 33, mult: 1 + 25 = 26, score: 33 * 26 = 858
    expect(withParei.totalMult).toBe(26);
    expect(withParei.finalScore).toBe(858);
  });

  it('Scary Face triggers on all cards with pareidolia', () => {
    const handCards = [
      card(Rank.Two, Suit.Spades),
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Four, Suit.Hearts),
      card(Rank.Six, Suit.Clubs),
      card(Rank.Seven, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['scary_face']);
    const candidate: PlayCandidate = {
      playedCards: handCards.slice(0, 5), // 5 number cards
      heldCards: handCards.slice(5),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    // Without pareidolia: Scary Face doesn't trigger
    const without = scorePlay(state, candidate);
    // Cards chips: 2+3+5+8+10 = 28, base chips: 5
    expect(without.totalChips).toBe(33);

    // With pareidolia: +30 chips per card → +150 chips
    const withParei = scorePlay(state, candidate, {
      jokerModifiers: { fourFingers: false, smeared: false, shortcut: false, allCardsFace: true },
    });
    // Total chips: 5 + 28 + 150 = 183
    expect(withParei.totalChips).toBe(183);
    // Score: 183 * 1 = 183
    expect(withParei.finalScore).toBe(183);
  });

  it('Photograph triggers on first card with pareidolia (any card)', () => {
    const handCards = [
      card(Rank.Two, Suit.Spades),   // number card, NOT a face card
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Four, Suit.Hearts),
      card(Rank.Six, Suit.Clubs),
      card(Rank.Seven, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['photograph']);
    const candidate: PlayCandidate = {
      playedCards: handCards.slice(0, 5),
      heldCards: handCards.slice(5),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    // Without pareidolia: Photograph doesn't trigger (first card is Two, not face)
    const without = scorePlay(state, candidate);
    expect(without.totalMult).toBe(1);

    // With pareidolia: first card (Two) is treated as face → ×2 mult
    // But Photograph triggers on EACH card's first trigger, so ALL 5 cards get ×2
    // mult: 1 × 2^5 = 32
    const withParei = scorePlay(state, candidate, {
      jokerModifiers: { fourFingers: false, smeared: false, shortcut: false, allCardsFace: true },
    });
    expect(withParei.totalMult).toBe(32);
  });

  it('Sock and Buskin retriggers all cards with pareidolia', () => {
    const handCards = [
      card(Rank.Two, Suit.Spades),
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Four, Suit.Hearts),
      card(Rank.Six, Suit.Clubs),
      card(Rank.Seven, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['sock_and_buskin', 'scary_face']);
    const candidate: PlayCandidate = {
      playedCards: handCards.slice(0, 5),
      heldCards: handCards.slice(5),
      handType: HandType.HighCard,
      jokerOrder: [0, 1],
    };

    // Without pareidolia: no retrigger + no Scary Face (all number cards)
    const without = scorePlay(state, candidate);
    // Cards: 5 base + 28 rank = 33 chips, mult: 1
    expect(without.totalChips).toBe(33);

    // With pareidolia: Sock retriggers each card once → 10 triggers total
    // Each trigger: rank chips + Scary Face 30
    // Cards: 2×(2+30) + 2×(3+30) + 2×(5+30) + 2×(8+30) + 2×(10+30) = 356
    // Plus base chips 5: total = 361
    const withParei = scorePlay(state, candidate, {
      jokerModifiers: { fourFingers: false, smeared: false, shortcut: false, allCardsFace: true },
    });
    expect(withParei.totalChips).toBe(361);
    expect(withParei.finalScore).toBe(361);
  });
});

// ─── Joker Order Tests ──────────────────────────────────────────

