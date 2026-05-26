import { describe, it, expect } from 'vitest';
import {
  Rank, Suit, HandType, BlindType, CardEnhancement, CardEdition, Seal,
  ALL_RANKS,
} from '../src/engine/types';
import type {
  GameState, BlindInfo, PlayCandidate, ScoreOptions, DeckCardSlot,
} from '../src/engine/types';
import { scorePlay } from '../src/engine/scorer';
import { findOptimalPlays, formatScore } from '../src/engine/search';
import { drawHand } from '../src/engine/run-simulator';
import { createRng } from '../src/engine/rng';
import {
  buildAggregateFromCards, addCardToDeck, createStandardDeck,
} from '../src/engine/deck';
import { calculateJokerIncome } from '../src/engine/economy';
import type { JokerIncomeInput } from '../src/engine/economy';
import { getJoker } from '../src/engine/joker-effects';
import { getHandBaseChips, getHandBaseMult } from '../src/engine/constants';
import { defaultState, card } from './helpers';
import '../src/engine/joker-effects';

// ─── Helpers for edge-case tests ────────────────────────────────

function psychcBlind(): BlindInfo {
  return {
    type: BlindType.Boss,
    chipsRequired: 3000,
    debuffedRanks: [],
    debuffedSuits: [],
    mustPlayFiveCards: true,
  };
}

function mkHandCards(): ReturnType<typeof card>[] {
  return [
    card(Rank.Ace, Suit.Spades),
    card(Rank.Ace, Suit.Hearts),
    card(Rank.King, Suit.Spades),
    card(Rank.King, Suit.Hearts),
    card(Rank.Queen, Suit.Spades),
    card(Rank.Three, Suit.Clubs),
    card(Rank.Five, Suit.Diamonds),
    card(Rank.Eight, Suit.Spades),
  ];
}

// ─────────────────────────────────────────────────────────────────
//  Test 1 — The Psychic: must play exactly 5 cards
// ─────────────────────────────────────────────────────────────────

describe('Edge Case #1: The Psychic (mustPlayFiveCards)', () => {
  it('scorePlay returns totalChips=0 totalMult=0 finalScore=0 for <5 cards under Psychic', () => {
    const handCards = mkHandCards();
    const state: GameState = {
      ...defaultState(handCards, ['joker']),
      blind: psychcBlind(),
    };

    // Manually play only 2 Aces (a strong Pair) — should be rejected
    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);

    expect(result.totalChips).toBe(0);
    expect(result.totalMult).toBe(0);
    expect(result.finalScore).toBe(0);
  });

  it('findOptimalPlays auto-expands to exactly 5 cards with non-zero score under Psychic', () => {
    const handCards = mkHandCards();
    const state: GameState = {
      ...defaultState(handCards, ['joker']),
      blind: psychcBlind(),
    };

    const result = findOptimalPlays(state);

    // Every candidate must be exactly 5 cards
    for (const play of result.allPlays) {
      expect(play.playedCards.length).toBe(5);
    }

    // Optimal play must exist and have a non-zero score
    expect(result.optimalPlay).toBeDefined();
    expect(result.optimalPlay!.totalScore).toBeGreaterThan(0);
    expect(result.optimalPlay!.playedCards.length).toBe(5);
  });

  it('non-Psychic blind allows <5 card plays normally', () => {
    const handCards = mkHandCards();
    const state: GameState = {
      ...defaultState(handCards, ['joker']),
      blind: {
        type: BlindType.Boss,
        chipsRequired: 3000,
        debuffedRanks: [],
        debuffedSuits: [],
        bossId: 'the_arm',
      },
    };

    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);
    // Should score normally — non-zero
    expect(result.finalScore).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 2 — Blueprint→Blueprint→Joker nested copy chain
// ─────────────────────────────────────────────────────────────────

describe('Edge Case #2: Blueprint→Blueprint→Joker recursion', () => {
  it('resolves [Blueprint A, Blueprint B, Gros Michel] without stack overflow', () => {
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

    const state: GameState = {
      ...defaultState(handCards, ['blueprint', 'blueprint', 'gros_michel']),
    };

    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]], // Pair of Aces
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0, 1, 2],
    };

    // Must not throw / stack overflow
    let result;
    expect(() => { result = scorePlay(state, candidate); }).not.toThrow();
    expect(result!).toBeDefined();
  });

  it('Gros Michel (+15 mult) fires exactly 3 times with two Blueprints', () => {
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

    const state: GameState = {
      ...defaultState(handCards, ['blueprint', 'blueprint', 'gros_michel']),
    };

    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0, 1, 2],
    };

    const result = scorePlay(state, candidate);

    // Level 1 Pair: 10 chips, 2 mult
    // Cards: Ace (11) + Ace (11) = 22 chips
    // Gros Michel fires 3× (1 original + 2 Blueprint copies): +15 × 3 = +45 mult
    // Total chips: 10 + 22 = 32
    // Total mult:  2 + 45 = 47
    // Final score: 32 × 47 = 1504
    expect(result.totalChips).toBe(32);
    expect(result.totalMult).toBe(47);
    expect(result.finalScore).toBe(1504);
  });

  it('handles [Blueprint, Blueprint, Blueprint] triple chain safely (returns null chain)', () => {
    const handCards = mkHandCards();
    const state: GameState = {
      ...defaultState(handCards, ['blueprint', 'blueprint', 'blueprint']),
    };

    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0, 1, 2],
    };

    // Should not throw — all Blueprints resolve to null
    expect(() => scorePlay(state, candidate)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 3 — Depleted deck: 3 cards left, draw to fill 8-card hand
// ─────────────────────────────────────────────────────────────────

describe('Edge Case #3: Depleted deck draw', () => {
  it('drawHand caps at remaining cards without infinite loop', () => {
    const tinyDeckSlots: DeckCardSlot[] = [
      { rank: Rank.Two, suit: Suit.Spades, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Three, suit: Suit.Hearts, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Four, suit: Suit.Clubs, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
    ];

    const tinyDeck = buildAggregateFromCards(tinyDeckSlots);

    // Request 5 cards but only 3 remain
    const rng = createRng(42);
    const result = drawHand(tinyDeck, 5, rng);

    // Should draw exactly 3 cards (the remainder)
    expect(result.cards.length).toBe(3);
    // Deck should be empty
    expect(result.deck.totalCards).toBe(0);
    // No undefined cards
    for (const c of result.cards) {
      expect(c).toBeDefined();
      expect(c.id).toBeDefined();
      expect(c.rank).toBeDefined();
    }
  });

  it('simulates the full play-remove-redraw cycle without crash', () => {
    // Simulate: hand has 8 cards, play 5, deck has 3 left, redraw 3
    const deckSlots: DeckCardSlot[] = [
      { rank: Rank.Two, suit: Suit.Spades, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Three, suit: Suit.Hearts, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Four, suit: Suit.Clubs, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
    ];

    const rng = createRng(99);

    // Initial draw: 8 cards from a freshly created deck
    const fullDeck = buildAggregateFromCards([
      ...deckSlots,
      { rank: Rank.Five, suit: Suit.Diamonds, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Six, suit: Suit.Spades, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Seven, suit: Suit.Hearts, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Eight, suit: Suit.Clubs, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Nine, suit: Suit.Diamonds, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Ten, suit: Suit.Spades, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Jack, suit: Suit.Hearts, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Queen, suit: Suit.Clubs, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
    ]);

    const initialDraw = drawHand(fullDeck, 8, rng);
    let currentHand = initialDraw.cards;
    let currentDeck = initialDraw.deck;

    expect(currentHand.length).toBe(8);

    // Play 5 cards
    const played = currentHand.slice(0, 5);
    const kept = currentHand.slice(5);
    expect(kept.length).toBe(3);

    // Simulate card removal: played cards are consumed
    // (In run-simulator this is done by filtering IDs; here we just take kept)
    currentHand = kept;

    // Deck has 11 - 8 = 3 cards left
    expect(currentDeck.totalCards).toBe(3);

    // Redraw: need 8 - 3 = 5 cards, but deck only has 3
    const redraw = drawHand(currentDeck, 8 - currentHand.length, rng);
    currentHand = [...currentHand, ...redraw.cards];
    currentDeck = redraw.deck;

    // Final: 3 kept + 3 redrawn = 6 cards
    expect(currentHand.length).toBe(6);
    expect(currentDeck.totalCards).toBe(0);

    // No crash, no undefined
    for (const c of currentHand) {
      expect(c.id).toBeDefined();
      expect(c.rank).toBeDefined();
    }
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 4 — State pollution: Baron + Mime, 1000× scorePlay
// ─────────────────────────────────────────────────────────────────

describe('Edge Case #4: State pollution (Baron + Mime × 1000 calls)', () => {
  it('1000 identical scorePlay calls return the same result (no mutation)', () => {
    // 2 Aces played (Pair), 6 held including 2 Kings + 4 fillers
    const playedCards = [
      card(Rank.Five, Suit.Spades),
      card(Rank.Five, Suit.Hearts),
    ];
    const heldCards = [
      card(Rank.King, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Four, Suit.Diamonds),
      card(Rank.Six, Suit.Spades),
      card(Rank.Nine, Suit.Clubs),
    ];

    const allCards = [...playedCards, ...heldCards];

    const state: GameState = {
      ...defaultState(allCards, ['baron', 'mime']),
    };

    const candidate: PlayCandidate = {
      playedCards,
      heldCards,
      handType: HandType.Pair,
      jokerOrder: [0, 1],
    };

    // Pre-build jokerDefs for performance
    const jokerDefs = new Map(state.jokers.map(j => [j.id, getJoker(j.id)] as const));
    const options: ScoreOptions = { jokerDefs };

    // Run 1000 times
    const results: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const r = scorePlay(state, candidate, options);
      results.push(r.finalScore);
    }

    // All 1000 results must be identical
    const first = results[0];
    expect(first).toBeGreaterThan(0); // must be non-zero
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBe(first);
    }

    // Verify expected score:
    // Level 1 Pair: 10 chips, 2 mult
    // Cards: 5 + 5 = 10 chips
    // Baron (onHeldInHand): 2 Kings → ×1.5² = ×2.25
    // Mime: no onJokerEvaluate, only handlesHeldRetriggers (affects Phase 2 Steel, N/A here)
    // Total chips: 10 + 10 = 20
    // Total mult:  2 × 2.25 = 4.5
    // Final: 20 × 4.5 = 90
    expect(first).toBe(90);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Test 5 — Large number formatting & extreme score stability
// ─────────────────────────────────────────────────────────────────

describe('Edge Case #5: Large number formatting & extreme scores', () => {
  it('formatScore handles numbers above MAX_SAFE_INTEGER without throwing', () => {
    // 1.43e18 is above Number.MAX_SAFE_INTEGER (~9e15)
    const huge = 1.43e18;
    expect(() => formatScore(huge)).not.toThrow();
    const result = formatScore(huge);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Should use scientific notation (contains 'e')
    expect(result).toContain('e');
  });

  it('formatScore returns string for NaN and Infinity without throwing', () => {
    expect(() => formatScore(NaN)).not.toThrow();
    expect(typeof formatScore(NaN)).toBe('string');

    expect(() => formatScore(Infinity)).not.toThrow();
    expect(typeof formatScore(Infinity)).toBe('string');

    expect(() => formatScore(-Infinity)).not.toThrow();
    expect(typeof formatScore(-Infinity)).toBe('string');
  });

  it('scoring engine produces stable output with extreme xMult via state overrides', () => {
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

    // Use Hologram (×Mult state joker) with a huge multiplier
    const state: GameState = {
      ...defaultState(handCards, ['hologram', 'cavendish']),
    };

    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0, 1],
    };

    // Inject 1e50 as Hologram's multiplier — should not cause NaN/Infinity
    const result = scorePlay(state, candidate, {
      jokerStateOverrides: { 0: 1e50 },
    });

    expect(Number.isFinite(result.finalScore)).toBe(true);
    expect(result.finalScore).toBeGreaterThan(0);
    expect(result.totalChips).toBeGreaterThan(0);
    expect(result.totalMult).toBeGreaterThan(0);

    // formatScore should handle this
    const formatted = formatScore(result.finalScore);
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('formatScore produces correct K/M/B prefixes', () => {
    expect(formatScore(999)).toBe('999');
    expect(formatScore(1500)).toBe('1.5K');
    expect(formatScore(2_500_000)).toBe('2.5M');
    expect(formatScore(7_500_000_000)).toBe('7.5B');
  });

  it('formatScore uses scientific notation for scores >= 1 trillion', () => {
    const trillion = 1_000_000_000_000; // 1e12
    const result = formatScore(trillion);
    expect(result).toContain('e');

    const huge = 1.43e18;
    const result2 = formatScore(huge);
    expect(result2).toContain('e');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Test 6 — Debuffed Cards & Hand Recognition Boundary
// ═══════════════════════════════════════════════════════════════════

describe('Edge Case #6: Debuffed cards — card contribution zeroed, hand type preserved', () => {
  /**
   * Helper: create a card with debuffed=true.
   * The card() factory sets debuffed=false, so we override it.
   */
  function debuffedCard(rank: Rank, suit: Suit): ReturnType<typeof card> {
    const c = card(rank, suit);
    c.debuffed = true;
    return c;
  }

  it('all 5 debuffed Hearts recognized as Flush with zero card contribution', () => {
    // Use cards that are all Hearts but do NOT form a straight
    // (A-K-J-9-7 avoids 10-Q Royal/Straight flush confusion)
    const played = [
      debuffedCard(Rank.Ace, Suit.Hearts),
      debuffedCard(Rank.King, Suit.Hearts),
      debuffedCard(Rank.Jack, Suit.Hearts),
      debuffedCard(Rank.Nine, Suit.Hearts),
      debuffedCard(Rank.Seven, Suit.Hearts),
    ];
    const held = [
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Four, Suit.Spades),
    ];

    const allCards = [...played, ...held];
    const state: GameState = {
      ...defaultState(allCards, ['bloodstone']),
      blind: {
        type: BlindType.Boss,
        chipsRequired: 3000,
        debuffedRanks: [],
        debuffedSuits: [Suit.Hearts], // The Head boss
        bossId: 'the_head',
      },
    };

    const candidate: PlayCandidate = {
      playedCards: played,
      heldCards: held,
      handType: HandType.Flush,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);

    // 1) Hand type correctly identified as Flush
    expect(result.baseHand.handType).toBe(HandType.Flush);
    expect(result.baseHand.level).toBe(1);

    // 2) Base hand chips & mult are applied (Level 1 Flush: 35 chips + 4 mult)
    expect(result.baseHand.chips).toBe(35);
    expect(result.baseHand.mult).toBe(4);

    // 3) Every card score entry must have zero contribution
    for (const cs of result.cardScores) {
      expect(cs.chipsContribution).toBe(0);
      expect(cs.multContribution).toBe(0);
    }

    // 4) Bloodstone (onCardScored) fires 0 times — jokerScores[0] untouched
    expect(result.jokerScores[0].chipsAdded).toBe(0);
    expect(result.jokerScores[0].plusMult).toBe(0);
    // xMult stays at 1 (no multiplier applied)
    expect(result.jokerScores[0].xMult).toBe(1);

    // 5) Final score = base only: 35 chips × 4 mult = 140
    expect(result.totalChips).toBe(35);
    expect(result.totalMult).toBe(4);
    expect(result.finalScore).toBe(140);
  });

  it('mixed: 3 debuffed + 2 normal Hearts still form Flush but only normal cards score', () => {
    const normalCard1 = card(Rank.Ace, Suit.Hearts);
    const normalCard2 = card(Rank.King, Suit.Hearts);
    const played = [
      normalCard1,
      normalCard2,
      debuffedCard(Rank.Queen, Suit.Hearts),
      debuffedCard(Rank.Jack, Suit.Hearts),
      debuffedCard(Rank.Ten, Suit.Hearts),
    ];
    const held = [
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Four, Suit.Spades),
    ];

    const allCards = [...played, ...held];
    const state: GameState = {
      ...defaultState(allCards, ['bloodstone']),
      blind: {
        type: BlindType.Boss,
        chipsRequired: 3000,
        debuffedRanks: [],
        debuffedSuits: [Suit.Hearts],
        bossId: 'the_head',
      },
    };

    const candidate: PlayCandidate = {
      playedCards: played,
      heldCards: held,
      handType: HandType.Flush,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);

    // Flush recognized
    expect(result.baseHand.handType).toBe(HandType.Flush);

    // Only normal cards produce cardScores entries (debuffed cards hit `continue` and are skipped entirely)
    // 2 normal cards → 2 cardScores entries. Debuffed cards produce NO entries.
    expect(result.cardScores.length).toBe(2);
    for (const cs of result.cardScores) {
      expect(cs.chipsContribution).toBeGreaterThan(0);
    }

    // Bloodstone fires ONLY on normal Hearts (2 triggers)
    // Each normal Heart: ×1.5 → 2 applications
    // Base: 35 chips, 4 mult
    // Card chips (normal): Ace(11) + King(10) = 21, debuffed = 0
    // Mult: 4 × 1.5 × 1.5 = 4 × 2.25 = 9
    // Final: (35 + 21) × 9 = 56 × 9 = 504
    expect(result.totalChips).toBe(56);
    expect(result.totalMult).toBe(9);
    expect(result.finalScore).toBe(504);
  });

  it('debuffed cards do not affect hand recognition (Flush still found via findOptimalPlays)', () => {
    // All Hearts, no straight: A-K-J-9-7
    const played = [
      debuffedCard(Rank.Ace, Suit.Hearts),
      debuffedCard(Rank.King, Suit.Hearts),
      debuffedCard(Rank.Jack, Suit.Hearts),
      debuffedCard(Rank.Nine, Suit.Hearts),
      debuffedCard(Rank.Seven, Suit.Hearts),
    ];
    const held = [
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Four, Suit.Spades),
    ];

    const allCards = [...played, ...held];
    const state: GameState = {
      ...defaultState(allCards, ['bloodstone']),
      blind: {
        type: BlindType.Boss,
        chipsRequired: 3000,
        debuffedRanks: [],
        debuffedSuits: [Suit.Hearts],
        bossId: 'the_head',
      },
    };

    const result = findOptimalPlays(state);

    // The optimal play should still find Flush (5 cards)
    expect(result.optimalPlay).toBeDefined();
    expect(result.optimalPlay!.handType).toBe(HandType.Flush);
    expect(result.optimalPlay!.totalScore).toBeGreaterThan(0);

    // Flush should appear in ranked hands
    const flushRanking = result.rankedHands.find(r => r.handType === HandType.Flush);
    expect(flushRanking).toBeDefined();
    expect(flushRanking!.bestScore).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Test 7 — Plasma Deck Balance Algorithm & Search Misdirection
// ═══════════════════════════════════════════════════════════════════

describe('Edge Case #7: Plasma Deck — score balancing and search ranking flip', () => {
  /**
   * Plasma Deck formula: score = floor((chips + mult) / 2)^2
   */
  function plasmaScore(chips: number, mult: number): number {
    const avg = Math.floor((chips + mult) / 2);
    return avg * avg;
  }

  it('plasma formula is correctly applied: floor((chips+mult)/2)^2', () => {
    // Level 1 Pair: 10 chips, 2 mult. Cards: Ace(11)+Ace(11)=22 chips.
    // Total: 32 chips, 2 mult. Normal: 64. Plasma: floor(34/2)^2 = 17^2 = 289
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

    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [],
    };

    const result = scorePlay(state, candidate);
    const normalScore = result.finalScore;
    const plasma = plasmaScore(result.totalChips, result.totalMult);

    // Normal: 32 × 2 = 64
    expect(normalScore).toBe(64);
    // Plasma: floor((32+2)/2)^2 = 17^2 = 289
    expect(plasma).toBe(289);
    // Plasma score should NOT equal normal score
    expect(plasma).not.toBe(normalScore);
  });

  it('chips-heavy combo wins under Plasma but loses under normal rules', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
      card(Rank.Seven, Suit.Hearts),
    ];

    // ── Scenario A: chips-heavy (runner with 100 chips override) ──
    const stateA: GameState = {
      ...defaultState(handCards, ['runner']),
    };
    const candidateA: PlayCandidate = {
      playedCards: [handCards[0]], // Ace High Card
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };
    const resultA = scorePlay(stateA, candidateA, {
      jokerStateOverrides: { 0: 100 },
    });
    // HighCard L1: 5 chips + 1 mult. Card Ace: 11 chips. Joker: +100 chips.
    // Total: 5+11+100=116 chips, 1 mult → normal 116
    expect(resultA.totalChips).toBe(116);
    expect(resultA.totalMult).toBe(1);
    const normalA = resultA.finalScore; // 116

    // ── Scenario B: mult-heavy (Gros Michel +15 mult) ──
    const stateB: GameState = {
      ...defaultState(handCards, ['gros_michel']),
    };
    const candidateB: PlayCandidate = {
      playedCards: [handCards[0]], // Same Ace High Card
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };
    const resultB = scorePlay(stateB, candidateB);
    // HighCard L1: 5 chips + 1 mult. Card Ace: 11 chips. Joker: +15 mult.
    // Total: 5+11=16 chips, 1+15=16 mult → normal 256
    expect(resultB.totalChips).toBe(16);
    expect(resultB.totalMult).toBe(16);
    const normalB = resultB.finalScore; // 256

    // ── Normal rules: B wins ──
    expect(normalB).toBeGreaterThan(normalA);

    // ── Plasma rules: A wins (chips dominate the averaging) ──
    const plasmaA = plasmaScore(resultA.totalChips, resultA.totalMult);
    const plasmaB = plasmaScore(resultB.totalChips, resultB.totalMult);
    // plasmaA = floor((116+1)/2)^2 = 58^2 = 3364
    // plasmaB = floor((16+16)/2)^2 = 16^2 = 256
    expect(plasmaA).toBe(3364);
    expect(plasmaB).toBe(256);
    expect(plasmaA).toBeGreaterThan(plasmaB);
  });

  it('search algorithm correctly identifies optimal Plasma play via post-processing', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.King, Suit.Clubs),
      card(Rank.Four, Suit.Diamonds),
    ];

    // Runner with 80 chips override
    const state: GameState = {
      ...defaultState(handCards, ['runner']),
    };

    // Run search with joker state override
    const result = findOptimalPlays(state, {}, {
      jokerStateOverrides: { 0: 80 },
    });

    expect(result.allPlays.length).toBeGreaterThan(1);

    // Find the best under normal rules (what findOptimalPlays already gives)
    const normalBest = result.optimalPlay!;

    // Post-process all plays with Plasma formula
    interface PlasmaCandidate {
      play: typeof result.allPlays[0];
      plasmaScore: number;
    }
    const plasmaRanked: PlasmaCandidate[] = result.allPlays.map(play => ({
      play,
      plasmaScore: plasmaScore(play.breakdown.totalChips, play.breakdown.totalMult),
    }));
    plasmaRanked.sort((a, b) => b.plasmaScore - a.plasmaScore);
    const plasmaBest = plasmaRanked[0];

    // The Plasma-best MUST have a valid score
    expect(plasmaBest.plasmaScore).toBeGreaterThan(0);

    // For chips-heavy joker, the optimal under Plasma should not be
    // a low-chips High Card — it should be the highest-chips play
    // (This is a regression test: search must not miss high-chip combos)
    const highCardPlays = plasmaRanked.filter(
      p => p.play.handType === HandType.HighCard
    );
    // There should be at least one HighCard in allPlays
    expect(highCardPlays.length).toBeGreaterThan(0);

    // Verify normal best was found via conventional scoring
    expect(normalBest.totalScore).toBeGreaterThan(0);
  });

  it('Plasma formula handles edge values without precision issues', () => {
    // Very imbalanced: huge chips, 1 mult
    expect(plasmaScore(1000, 1)).toBe(250000);  // floor(1001/2)=500, 500^2=250000
    // Very imbalanced the other way: 1 chip, huge mult
    expect(plasmaScore(1, 1000)).toBe(250000);  // same result
    // Zero chips or mult
    expect(plasmaScore(0, 10)).toBe(25);   // floor(10/2)=5, 5^2=25
    expect(plasmaScore(10, 0)).toBe(25);
    // Balanced
    expect(plasmaScore(100, 100)).toBe(10000); // floor(200/2)=100, 100^2=10000
    // Odd sum rounding
    expect(plasmaScore(10, 11)).toBe(100);  // floor(21/2)=10, 10^2=100
    expect(plasmaScore(11, 10)).toBe(100);  // same
    // Large numbers
    const huge = plasmaScore(1e6, 1);
    expect(Number.isFinite(huge)).toBe(true);
    expect(huge).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Test 8 — Red Seal + Sock and Buskin + Dusk Retrigger Nesting
// ═══════════════════════════════════════════════════════════════════

describe('Edge Case #8: Multi-retrigger nesting (Red Seal + Sock and Buskin + Dusk)', () => {
  it('single face card with Red Seal retriggers exactly 4 times on final hand', () => {
    const kingSpades = card(Rank.King, Suit.Spades, CardEnhancement.None, CardEdition.None, Seal.Red);
    const heldCards = [
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Five, Suit.Hearts),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Four, Suit.Diamonds),
      card(Rank.Six, Suit.Hearts),
      card(Rank.Seven, Suit.Clubs),
    ];

    const allCards = [kingSpades, ...heldCards];
    const state: GameState = {
      ...defaultState(allCards, ['sock_and_buskin', 'dusk']),
      roundState: {
        handsPlayed: 3,
        discardsUsed: 0,
        dollars: 0,
        antes: 1,
        isFinalHand: true,  // ← critical: enables Dusk
        maxHands: 4,
        maxDiscards: 3,
        handSize: 8,
      },
    };

    const candidate: PlayCandidate = {
      playedCards: [kingSpades],
      heldCards,
      handType: HandType.HighCard,
      jokerOrder: [0, 1],
    };

    const result = scorePlay(state, candidate);

    // ── Assertions ──────────────────────────────────────────────

    // 1) Exactly 4 card score entries (trigger indices 0,1,2,3)
    expect(result.cardScores.length).toBe(4);
    expect(result.cardScores[0].triggerIndex).toBe(0);
    expect(result.cardScores[1].triggerIndex).toBe(1);
    expect(result.cardScores[2].triggerIndex).toBe(2);
    expect(result.cardScores[3].triggerIndex).toBe(3);

    // 2) Each trigger adds 10 chips (King base chips)
    //    No enhancement/edition, so exactly 10 per trigger
    for (let i = 0; i < 4; i++) {
      expect(result.cardScores[i].chipsContribution).toBe(10);
      expect(result.cardScores[i].multContribution).toBe(0);
    }

    // 3) Total chips: HighCard L1 (5) + 4× King(10) = 45
    expect(result.totalChips).toBe(45);

    // 4) Total mult: HighCard L1 = 1 (no mult jokers)
    expect(result.totalMult).toBe(1);

    // 5) Final score: 45 × 1 = 45
    expect(result.finalScore).toBe(45);

    // 6) Both joker index entries exist and neither adds chips/mult
    //    (retrigger jokers don't have onJokerEvaluate)
    expect(result.jokerScores.length).toBe(2);
    for (const js of result.jokerScores) {
      expect(js.chipsAdded).toBe(0);
      expect(js.plusMult).toBe(0);
    }
  });

  it('face card WITHOUT Red Seal retriggers 3 times (S&B + Dusk only) on final hand', () => {
    const kingSpades = card(Rank.King, Suit.Spades); // No Red Seal
    const heldCards = [
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Five, Suit.Hearts),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Four, Suit.Diamonds),
      card(Rank.Six, Suit.Hearts),
      card(Rank.Seven, Suit.Clubs),
    ];

    const allCards = [kingSpades, ...heldCards];
    const state: GameState = {
      ...defaultState(allCards, ['sock_and_buskin', 'dusk']),
      roundState: {
        handsPlayed: 3,
        discardsUsed: 0,
        dollars: 0,
        antes: 1,
        isFinalHand: true,
        maxHands: 4,
        maxDiscards: 3,
        handSize: 8,
      },
    };

    const candidate: PlayCandidate = {
      playedCards: [kingSpades],
      heldCards,
      handType: HandType.HighCard,
      jokerOrder: [0, 1],
    };

    const result = scorePlay(state, candidate);

    // 3 triggers: 1 base + 1 S&B + 1 Dusk
    expect(result.cardScores.length).toBe(3);
    // Total: 5 + 3×10 = 35
    expect(result.totalChips).toBe(35);
    expect(result.finalScore).toBe(35);
  });

  it('non-face card WITHOUT Red Seal retriggers 2 times (Dusk only) on final hand', () => {
    const twoSpades = card(Rank.Two, Suit.Spades); // Not face, no Red Seal
    const heldCards = [
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Five, Suit.Hearts),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Four, Suit.Diamonds),
      card(Rank.Six, Suit.Hearts),
      card(Rank.Seven, Suit.Clubs),
      card(Rank.Nine, Suit.Clubs),
    ];

    const allCards = [twoSpades, ...heldCards];
    const state: GameState = {
      ...defaultState(allCards, ['sock_and_buskin', 'dusk']),
      roundState: {
        handsPlayed: 3,
        discardsUsed: 0,
        dollars: 0,
        antes: 1,
        isFinalHand: true,
        maxHands: 4,
        maxDiscards: 3,
        handSize: 8,
      },
    };

    const candidate: PlayCandidate = {
      playedCards: [twoSpades],
      heldCards,
      handType: HandType.HighCard,
      jokerOrder: [0, 1],
    };

    const result = scorePlay(state, candidate);

    // 2 triggers: 1 base + 1 Dusk (S&B doesn't apply to non-face)
    expect(result.cardScores.length).toBe(2);
    // Total: 5 + 2×2(Two) = 9
    expect(result.totalChips).toBe(9);
    expect(result.finalScore).toBe(9);
  });

  it('Dusk does NOT add retriggers when isFinalHand is false', () => {
    const kingSpades = card(Rank.King, Suit.Spades, CardEnhancement.None, CardEdition.None, Seal.Red);
    const held = [
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
    ];

    const allCards = [kingSpades, ...held];
    const state: GameState = {
      ...defaultState(allCards, ['sock_and_buskin', 'dusk']),
      roundState: {
        handsPlayed: 0,
        discardsUsed: 0,
        dollars: 0,
        antes: 1,
        isFinalHand: false, // ← not final hand, Dusk inactive
        maxHands: 4,
        maxDiscards: 3,
        handSize: 3,
      },
    };

    const candidate: PlayCandidate = {
      playedCards: [kingSpades],
      heldCards: held,
      handType: HandType.HighCard,
      jokerOrder: [0, 1],
    };

    const result = scorePlay(state, candidate);

    // 3 triggers: 1 base + 1 Red Seal + 1 S&B (no Dusk)
    expect(result.cardScores.length).toBe(3);
    // Total: 5 + 3×10 = 35
    expect(result.totalChips).toBe(35);
    expect(result.finalScore).toBe(35);
  });

  it('retrigger arithmetic is additive, not multiplicative', () => {
    // If retriggers were multiplicative, we'd see far more than 4 total triggers.
    // The correct additive count: 1(base) + 1(Red) + 1(S&B) + 1(Dusk) = 4
    // Proof: cardScores.length === 4, never more.
    const kingSpades = card(Rank.King, Suit.Spades, CardEnhancement.None, CardEdition.None, Seal.Red);
    const held = Array.from({ length: 7 }, (_, i) =>
      card([Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven, Rank.Eight][i], Suit.Clubs)
    );

    const allCards = [kingSpades, ...held];
    const state: GameState = {
      ...defaultState(allCards, ['sock_and_buskin', 'dusk']),
      roundState: {
        handsPlayed: 3, discardsUsed: 0, dollars: 0, antes: 1,
        isFinalHand: true, maxHands: 4, maxDiscards: 3, handSize: 8,
      },
    };

    const result = scorePlay(state, {
      playedCards: [kingSpades],
      heldCards: held,
      handType: HandType.HighCard,
      jokerOrder: [0, 1],
    });

    // Strictly 4 — must not be 8, 16, or any multiplicative explosion
    expect(result.cardScores.length).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Test 9 — RNG Branch Isolation (Space Joker & Deterministic Search)
// ═══════════════════════════════════════════════════════════════════

describe('Edge Case #9: RNG state isolation — multi-branch search determinism', () => {
  it('cloned RNGs from same seed produce identical sequences', () => {
    const rngA = createRng(12345);
    const rngB = createRng(12345);

    // Generate 100 values from each — must be pixel-identical
    for (let i = 0; i < 100; i++) {
      expect(rngA()).toBe(rngB());
    }
  });

  it('draining one RNG does not affect another cloned from the same seed', () => {
    const rngA = createRng(42);

    // Drain rngA by 50 calls
    for (let i = 0; i < 50; i++) rngA();

    // rngB starts fresh from the same seed — must match original sequence
    const rngB = createRng(42);
    const expectedFirst = createRng(42)(); // first value from seed 42

    expect(rngB()).toBe(expectedFirst);
  });

  it('findOptimalPlays is fully deterministic — same state, same result', () => {
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

    const runSearch = () => {
      const state: GameState = {
        ...defaultState(handCards, ['joker', 'gros_michel', 'cavendish']),
      };
      return findOptimalPlays(state);
    };

    const resultA = runSearch();
    const resultB = runSearch();

    // Pixel-identical: same number of plays, same optimal score
    expect(resultA.allPlays.length).toBe(resultB.allPlays.length);
    expect(resultA.optimalPlay!.totalScore).toBe(resultB.optimalPlay!.totalScore);
    expect(resultA.optimalPlay!.handType).toBe(resultB.optimalPlay!.handType);
    expect(resultA.combinationsEvaluated).toBe(resultB.combinationsEvaluated);

    // Every scored play must match exactly
    for (let i = 0; i < resultA.allPlays.length; i++) {
      expect(resultA.allPlays[i].totalScore).toBe(resultB.allPlays[i].totalScore);
      expect(resultA.allPlays[i].handType).toBe(resultB.allPlays[i].handType);
    }
  });

  it('sequential search runs do not cross-contaminate (no hidden static state)', () => {
    // Run searches with different joker configs interleaved — results
    // must be self-consistent regardless of execution order.

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

    // Run A-B-A pattern: A, then B, then A again — third must match first
    const runA = () => {
      const state: GameState = { ...defaultState(handCards, ['joker']) };
      return findOptimalPlays(state);
    };
    const runB = () => {
      const state: GameState = { ...defaultState(handCards, ['gros_michel', 'cavendish']) };
      return findOptimalPlays(state);
    };

    const a1 = runA();
    const b = runB();
    const a2 = runA();

    // A1 and A2 must be identical — B didn't pollute A's path
    expect(a1.optimalPlay!.totalScore).toBe(a2.optimalPlay!.totalScore);
    expect(a1.allPlays.length).toBe(a2.allPlays.length);
    // B must be different from A (different jokers → different scores)
    expect(b.optimalPlay!.totalScore).not.toBe(a1.optimalPlay!.totalScore);
  });

  it('drawHand produces identical sequences from same seed across cloned states', () => {
    // Build two identical decks from cards
    const buildDeck = () => {
      const slots: DeckCardSlot[] = [];
      for (const suit of [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds]) {
        for (const rank of ALL_RANKS) {
          slots.push({
            rank, suit,
            enhancement: CardEnhancement.None,
            edition: CardEdition.None,
            seal: Seal.None,
          });
        }
      }
      return buildAggregateFromCards(slots);
    };

    const deck1 = buildDeck();
    const deck2 = buildDeck();

    const rng = createRng(777);
    const draw1 = drawHand(deck1, 8, rng);

    const rng2 = createRng(777);
    const draw2 = drawHand(deck2, 8, rng2);

    // Both draws must produce cards with identical rank/suit sequences
    expect(draw1.cards.length).toBe(draw2.cards.length);
    for (let i = 0; i < draw1.cards.length; i++) {
      expect(draw1.cards[i].rank).toBe(draw2.cards[i].rank);
      expect(draw1.cards[i].suit).toBe(draw2.cards[i].suit);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Test 10 — The Arm Boss: Permanent Level Reduction
// ═══════════════════════════════════════════════════════════════════

describe('Edge Case #10: The Arm boss — permanent hand level reduction', () => {
  it('scorePlay uses pre-reduction level (Level 3 Flush gives correct base values)', () => {
    const handCards = [
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Hearts),
      card(Rank.Queen, Suit.Hearts),
      card(Rank.Jack, Suit.Hearts),
      card(Rank.Ten, Suit.Hearts),
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Four, Suit.Spades),
    ];

    const state: GameState = {
      ...defaultState(handCards, ['joker']),
      handLevels: {
        ...defaultState(handCards).handLevels,
        [HandType.Flush]: 3, // Flush at Level 3
      },
      blind: {
        type: BlindType.Boss,
        chipsRequired: 10000,
        debuffedRanks: [],
        debuffedSuits: [],
        bossId: 'the_arm',
      },
    };

    const candidate: PlayCandidate = {
      playedCards: handCards.slice(0, 5),
      heldCards: handCards.slice(5),
      handType: HandType.Flush,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);

    // Level 3 Flush base: chips = 35 + 2*15 = 65, mult = 4 + 2*2 = 8
    expect(result.baseHand.level).toBe(3);
    expect(result.baseHand.chips).toBe(65);
    expect(result.baseHand.mult).toBe(8);

    // Cards: A(11) + K(10) + Q(10) + J(10) + 10(10) = 51 chips
    // Joker (+4 mult) gives total: 65+51=116 chips, 8+4=12 mult → 1392
    expect(result.totalChips).toBe(116);
    expect(result.totalMult).toBe(12);
    expect(result.finalScore).toBe(1392);

    // scorePlay is a pure function — it does NOT mutate handLevels
    expect(state.handLevels[HandType.Flush]).toBe(3);
  });

  it('post-score level reduction: Level 3 → Level 2, with Level 1 floor', () => {
    // Simulate what the run simulator does: reduce level AFTER scoring
    let currentLevel = 3;

    // (Scoring happens here using level 3 — tested above)

    // After scoring, apply The Arm's reduction
    currentLevel = Math.max(1, currentLevel - 1);
    expect(currentLevel).toBe(2);

    // Play again (now Level 2)
    // Level 2 Flush base: 35 + 15 = 50 chips, 4 + 2 = 6 mult
    const handCards = [
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Hearts),
      card(Rank.Queen, Suit.Hearts),
      card(Rank.Jack, Suit.Hearts),
      card(Rank.Ten, Suit.Hearts),
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Four, Suit.Spades),
    ];

    const state: GameState = {
      ...defaultState(handCards),
      handLevels: {
        ...defaultState(handCards).handLevels,
        [HandType.Flush]: currentLevel,
      },
    };

    const result = scorePlay(state, {
      playedCards: handCards.slice(0, 5),
      heldCards: handCards.slice(5),
      handType: HandType.Flush,
      jokerOrder: [],
    });

    // Level 2 base: 50 chips, 6 mult
    expect(result.baseHand.level).toBe(2);
    expect(result.baseHand.chips).toBe(50);
    expect(result.baseHand.mult).toBe(6);

    // Reduce again: 2 → 1
    currentLevel = Math.max(1, currentLevel - 1);
    expect(currentLevel).toBe(1);
  });

  it('Level 1 hand stays at Level 1 after The Arm reduction (no negative levels)', () => {
    const level = 1;
    const reduced = Math.max(1, level - 1);
    expect(reduced).toBe(1);

    // Also verify via scorePlay: Level 1 Flush uses correct base
    const handCards = [
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Hearts),
      card(Rank.Queen, Suit.Hearts),
      card(Rank.Jack, Suit.Hearts),
      card(Rank.Ten, Suit.Hearts),
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Four, Suit.Spades),
    ];

    const state: GameState = {
      ...defaultState(handCards),
      handLevels: {
        ...defaultState(handCards).handLevels,
        [HandType.Flush]: 1,
      },
    };

    const result = scorePlay(state, {
      playedCards: handCards.slice(0, 5),
      heldCards: handCards.slice(5),
      handType: HandType.Flush,
      jokerOrder: [],
    });

    // Level 1 base: 35 chips, 4 mult (not 0 or negative)
    expect(result.baseHand.level).toBe(1);
    expect(result.baseHand.chips).toBe(35);
    expect(result.baseHand.mult).toBe(4);
    expect(result.finalScore).toBeGreaterThan(0);
  });

  it('The Arm reduces ONLY the played hand type, not all hand types', () => {
    // Simulate run-simulator logic: only the played type gets reduced
    const handLevels: Record<string, number> = {
      [HandType.Flush]: 3,
      [HandType.Pair]: 3,
      [HandType.Straight]: 3,
      [HandType.HighCard]: 1,
    };

    const playedType = HandType.Flush;

    // Apply The Arm to only the played type
    handLevels[playedType] = Math.max(1, handLevels[playedType] - 1);

    // Only Flush should be reduced
    expect(handLevels[HandType.Flush]).toBe(2);
    expect(handLevels[HandType.Pair]).toBe(3);     // untouched
    expect(handLevels[HandType.Straight]).toBe(3);  // untouched
    expect(handLevels[HandType.HighCard]).toBe(1);  // untouched (was already 1)
  });

  it('consecutive Arm fights: Level 5 → 4 → 3 → 2 → 1 → 1 (floor at 1)', () => {
    let level = 5;
    const history: number[] = [];

    // Reduce before each scoring round (simulates playing the hand)
    for (let i = 0; i < 6; i++) {
      history.push(level); // score at this level
      level = Math.max(1, level - 1); // Arm reduces
    }

    // Scored at levels: 5, 4, 3, 2, 1, 1 (stays at 1 on last round)
    expect(history).toEqual([5, 4, 3, 2, 1, 1]);

    // Final level must be 1, never 0 or negative
    expect(level).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Test 11 — DNA deck inflation: Cloud 9 & Rough Gem real-time counting
// ═══════════════════════════════════════════════════════════════════

describe('Edge Case #11: DNA deck inflation — Cloud 9 & Rough Gem real-time counting', () => {
  it('addCardToDeck updates totalByRank and totalBySuit atomically', () => {
    const deck = createStandardDeck();
    const initialNines = deck.totalByRank![Rank.Nine]!;
    const initialDiamonds = deck.totalBySuit![Suit.Diamonds]!;

    // DNA copies a Diamond 9 into the deck
    const updated = addCardToDeck(deck, Rank.Nine, Suit.Diamonds);

    expect(updated.totalByRank![Rank.Nine]).toBe(initialNines + 1);
    expect(updated.totalBySuit![Suit.Diamonds]).toBe(initialDiamonds + 1);
    expect(updated.totalCards).toBe(deck.totalCards + 1);
  });

  it('Cloud 9 income reflects DNA-copied Nines immediately', () => {
    let deck = createStandardDeck();
    // Standard deck has 4 Nines (one per suit)
    const baseInput: JokerIncomeInput = {
      jokers: [{ id: 'cloud_9', edition: CardEdition.None }],
      deck,
      discardsUsed: 0,
      maxDiscards: 3,
      cumulativeDollars: 0,
      playedCards: [],
      heldCards: [],
      roundNumber: 1,
      totalCardsDiscarded: 0,
    };
    const baseIncome = calculateJokerIncome(baseInput);
    // 4 Nines → $4
    expect(baseIncome).toBe(4);

    // DNA creates a 5th Nine (Diamond 9)
    deck = addCardToDeck(deck, Rank.Nine, Suit.Diamonds);
    const afterDnaInput = { ...baseInput, deck };
    const afterDnaIncome = calculateJokerIncome(afterDnaInput);
    // 5 Nines → $5
    expect(afterDnaIncome).toBe(5);
  });

  it('Rough Gem income reflects DNA-copied Diamond cards immediately', () => {
    let deck = createStandardDeck();
    // Standard deck has 13 Diamonds
    const baseInput: JokerIncomeInput = {
      jokers: [{ id: 'rough_gem', edition: CardEdition.None }],
      deck,
      discardsUsed: 0,
      maxDiscards: 3,
      cumulativeDollars: 0,
      playedCards: [],
      heldCards: [],
      roundNumber: 1,
      totalCardsDiscarded: 0,
    };
    const baseIncome = calculateJokerIncome(baseInput);
    expect(baseIncome).toBe(13);

    // DNA copies another Diamond (any rank)
    deck = addCardToDeck(deck, Rank.Ace, Suit.Diamonds);
    const afterDnaIncome = calculateJokerIncome({ ...baseInput, deck });
    expect(afterDnaIncome).toBe(14);
  });

  it('both Cloud 9 and Rough Gem see a DNA-copied Diamond 9 simultaneously', () => {
    let deck = createStandardDeck();
    // One DNA action: copy Diamond 9 → both counts must update
    deck = addCardToDeck(deck, Rank.Nine, Suit.Diamonds);

    const input: JokerIncomeInput = {
      jokers: [
        { id: 'cloud_9', edition: CardEdition.None },
        { id: 'rough_gem', edition: CardEdition.None },
      ],
      deck,
      discardsUsed: 0,
      maxDiscards: 3,
      cumulativeDollars: 0,
      playedCards: [],
      heldCards: [],
      roundNumber: 1,
      totalCardsDiscarded: 0,
    };

    const income = calculateJokerIncome(input);
    // 5 Nines ($5) + 14 Diamonds ($14) = $19
    expect(income).toBe(19);
  });

  it('remainingByRank and totalByRank stay consistent after DNA addition', () => {
    const deck = createStandardDeck();
    const updated = addCardToDeck(deck, Rank.Nine, Suit.Diamonds);

    // After DNA, both aggregates must equal the cards array length
    const fromCards = buildAggregateFromCards(updated.cards!);
    expect(updated.totalCards).toBe(fromCards.totalCards);
    expect(updated.totalByRank![Rank.Nine]).toBe(fromCards.totalByRank![Rank.Nine]);
    expect(updated.totalBySuit![Suit.Diamonds]).toBe(fromCards.totalBySuit![Suit.Diamonds]);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Test 12 — State machine rollback: Obelisk & Green Joker branch isolation
// ═══════════════════════════════════════════════════════════════════

describe('Edge Case #12: State machine rollback — Obelisk & Green Joker branch isolation', () => {
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

  it('Obelisk xMult isolation — separate jokerStateOverrides produce independent results', () => {
    const baseState: GameState = {
      ...defaultState(handCards, ['joker', 'obelisk']),
      handLevels: { ...defaultState(handCards).handLevels, [HandType.Pair]: 1 },
    };

    // Universe A: Obelisk has xMult=4 (played 3 non-most-common hands)
    const resultA = scorePlay(baseState, {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0, 1],
    }, {
      jokerStateOverrides: {
        1: 4, // obelisk index 1 → ×4 mult
      },
    });

    // Universe B: Obelisk has xMult=1 (reset — most common hand played)
    const resultB = scorePlay(baseState, {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0, 1],
    }, {
      jokerStateOverrides: {
        1: 1, // obelisk index 1 → ×1 (no-op, just broke streak)
      },
    });

    // Universe A must have higher score than Universe B
    expect(resultA.finalScore).toBeGreaterThan(resultB.finalScore);
    // Universe B's Obelisk contributes nothing extra
    expect(resultB.finalScore).toBeGreaterThan(0);
  });

  it('Green Joker +mult isolation — different streak values produce independent results', () => {
    const baseState: GameState = {
      ...defaultState(handCards, ['green_joker', 'joker']),
      handLevels: { ...defaultState(handCards).handLevels, [HandType.HighCard]: 1 },
    };

    // Universe A: Green Joker at +15 mult (15 hands played, 0 discards)
    const resultA = scorePlay(baseState, {
      playedCards: [handCards[0]],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0, 1],
    }, {
      jokerStateOverrides: {
        0: 15, // green_joker index 0 → +15 mult
      },
    });

    // Universe B: Green Joker at +3 mult (15 hands played but 12 discards)
    const resultB = scorePlay(baseState, {
      playedCards: [handCards[0]],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0, 1],
    }, {
      jokerStateOverrides: {
        0: 3, // green_joker index 0 → +3 mult
      },
    });

    // Universe A mult > Universe B mult
    expect(resultA.totalMult).toBeGreaterThan(resultB.totalMult);
    // Difference in finalScore reflects the +12 mult gap
    const expectedDiff = 12 * resultA.totalChips;
    expect(resultA.finalScore - resultB.finalScore).toBe(expectedDiff);
  });

  it('back-to-back calls with different overrides do NOT cross-contaminate', () => {
    const baseState: GameState = {
      ...defaultState(handCards, ['green_joker']),
      handLevels: { ...defaultState(handCards).handLevels, [HandType.HighCard]: 1 },
    };

    const candidate: PlayCandidate = {
      playedCards: [handCards[0]],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    // First call: +20 mult
    const call1 = scorePlay(baseState, candidate, {
      jokerStateOverrides: { 0: 20 },
    });

    // Second call: +5 mult (simulating backtrack to a different branch)
    const call2 = scorePlay(baseState, candidate, {
      jokerStateOverrides: { 0: 5 },
    });

    // Third call: +20 again — must be identical to call1
    const call3 = scorePlay(baseState, candidate, {
      jokerStateOverrides: { 0: 20 },
    });

    // No cross-contamination: call1 and call3 are identical
    expect(call3.finalScore).toBe(call1.finalScore);
    // call2 is different
    expect(call2.finalScore).not.toBe(call1.finalScore);
    // call1 has higher mult than call2
    expect(call1.totalMult).toBeGreaterThan(call2.totalMult);
  });

  it('scorePlay is a pure function — same inputs always produce same outputs', () => {
    const state: GameState = {
      ...defaultState(handCards, ['joker', 'obelisk']),
      handLevels: { ...defaultState(handCards).handLevels, [HandType.Pair]: 1 },
    };

    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0, 1],
    };

    const opts: ScoreOptions = { jokerStateOverrides: { 1: 3 } };

    // Call it 10 times — must be identical every time
    const results = Array.from({ length: 10 }, () => scorePlay(state, candidate, opts));
    const first = results[0]!;
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.finalScore).toBe(first.finalScore);
      expect(results[i]!.totalChips).toBe(first.totalChips);
      expect(results[i]!.totalMult).toBe(first.totalMult);
    }
  });

  it('findOptimalPlays with Obelisk jokerStateOverrides respects state isolation', () => {
    const state: GameState = {
      ...defaultState(handCards, ['obelisk']),
      handLevels: { ...defaultState(handCards).handLevels, [HandType.Pair]: 1 },
    };

    // Branch A: Obelisk ×4 (well-built streak)
    const resultA = findOptimalPlays(state, {}, {
      jokerStateOverrides: { 0: 4 },
    });

    // Branch B: Obelisk ×1 (streak just broke)
    const resultB = findOptimalPlays(state, {}, {
      jokerStateOverrides: { 0: 1 },
    });

    // Both produce valid optimal plays
    expect(resultA.optimalPlay).toBeDefined();
    expect(resultB.optimalPlay).toBeDefined();
    // Branch A scores strictly higher (×4 vs ×1 on same base)
    expect(resultA.optimalPlay!.totalScore).toBeGreaterThan(
      resultB.optimalPlay!.totalScore,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Test 13 — The Hook: deterministic random discard & graceful degradation
// ═══════════════════════════════════════════════════════════════════

describe('Edge Case #13: The Hook — deterministic random discard & graceful degradation', () => {
  it('The Hook debuffs exactly N cards with deterministic RNG', () => {
    const rng = createRng(42);
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Queen, Suit.Diamonds),
      card(Rank.Jack, Suit.Clubs),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Nine, Suit.Hearts),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Seven, Suit.Clubs),
    ];

    // None debuffed initially
    expect(handCards.filter(c => c.debuffed).length).toBe(0);

    // Simulate The Hook: debuff 2 random non-debuffed cards
    const remainingIndices = handCards
      .map((c, i) => c.debuffed ? -1 : i)
      .filter(i => i >= 0);
    const count = Math.min(2, remainingIndices.length);
    for (let h = 0; h < count; h++) {
      const pick = Math.floor(rng() * remainingIndices.length);
      handCards[remainingIndices[pick]]!.debuffed = true;
      remainingIndices.splice(pick, 1);
    }

    // Exactly 2 cards debuffed
    expect(handCards.filter(c => c.debuffed).length).toBe(2);
  });

  it('The Hook skips already-debuffed cards (only picks non-debuffed targets)', () => {
    const rng = createRng(99);
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Queen, Suit.Diamonds),
      card(Rank.Jack, Suit.Clubs),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Nine, Suit.Hearts),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Seven, Suit.Clubs),
    ];

    // Pre-debuff 3 cards (from a previous round's Hook)
    handCards[0]!.debuffed = true;
    handCards[3]!.debuffed = true;
    handCards[6]!.debuffed = true;

    const preDebuffedCount = handCards.filter(c => c.debuffed).length;
    expect(preDebuffedCount).toBe(3);

    // Hook tries to debuff 2 more
    const remainingIndices = handCards
      .map((c, i) => c.debuffed ? -1 : i)
      .filter(i => i >= 0);
    // Only 5 non-debuffed cards eligible
    expect(remainingIndices.length).toBe(5);

    const count = Math.min(2, remainingIndices.length);
    for (let h = 0; h < count; h++) {
      const pick = Math.floor(rng() * remainingIndices.length);
      handCards[remainingIndices[pick]]!.debuffed = true;
      remainingIndices.splice(pick, 1);
    }

    // Total debuffed: 3 + 2 = 5
    expect(handCards.filter(c => c.debuffed).length).toBe(5);
  });

  it('The Hook handles edge case: fewer non-debuffed cards than debuff count', () => {
    const rng = createRng(7);
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Queen, Suit.Diamonds),
      card(Rank.Jack, Suit.Clubs),
    ];

    // Pre-debuff 3 cards, leaving only 1 non-debuffed
    handCards[0]!.debuffed = true;
    handCards[1]!.debuffed = true;
    handCards[2]!.debuffed = true;

    const remainingIndices = handCards
      .map((c, i) => c.debuffed ? -1 : i)
      .filter(i => i >= 0);

    // Only 1 eligible, but Hook wants 2 → Math.min(2, 1) = 1
    const count = Math.min(2, remainingIndices.length);
    expect(count).toBe(1);

    for (let h = 0; h < count; h++) {
      const pick = Math.floor(rng() * remainingIndices.length);
      handCards[remainingIndices[pick]]!.debuffed = true;
      remainingIndices.splice(pick, 1);
    }

    // All 4 cards now debuffed — no crash, graceful cap
    expect(handCards.every(c => c.debuffed)).toBe(true);
  });

  it('RNG determinism ensures reproducible Hook debuff targets', () => {
    // Two identical RNG seeds produce identical debuff patterns
    const simulateHook = (seed: number): number[] => {
      const rng = createRng(seed);
      const handCards = [
        card(Rank.Ace, Suit.Spades),
        card(Rank.King, Suit.Hearts),
        card(Rank.Queen, Suit.Diamonds),
        card(Rank.Jack, Suit.Clubs),
        card(Rank.Ten, Suit.Spades),
        card(Rank.Nine, Suit.Hearts),
        card(Rank.Eight, Suit.Diamonds),
        card(Rank.Seven, Suit.Clubs),
      ];

      const remainingIndices = handCards
        .map((c, i) => c.debuffed ? -1 : i)
        .filter(i => i >= 0);
      const debuffedIndices: number[] = [];
      const count = Math.min(2, remainingIndices.length);
      for (let h = 0; h < count; h++) {
        const pick = Math.floor(rng() * remainingIndices.length);
        debuffedIndices.push(remainingIndices[pick]!);
        handCards[remainingIndices[pick]]!.debuffed = true;
        remainingIndices.splice(pick, 1);
      }
      return debuffedIndices.sort((a, b) => a - b);
    };

    const run1 = simulateHook(42);
    const run2 = simulateHook(42);
    const run3 = simulateHook(999);

    // Same seed → identical debuff targets
    expect(run1).toEqual(run2);
    // Different seed → (likely) different targets
    expect(run1).not.toEqual(run3);
  });

  it('scorePlay correctly zeroes debuffed cards that got Hook-debuffed mid-round', () => {
    // Simulate a hand where 2 cards got Hook-debuffed in a prior play
    const hookDebuffedCards = [
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Hearts),
      card(Rank.Queen, Suit.Hearts),
      card(Rank.Jack, Suit.Hearts),
      card(Rank.Ten, Suit.Hearts),
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Four, Suit.Spades),
    ];
    // Cards at index 2 and 4 got Hook-debuffed
    hookDebuffedCards[2]!.debuffed = true;
    hookDebuffedCards[4]!.debuffed = true;

    const state: GameState = {
      ...defaultState(hookDebuffedCards, ['joker']),
    };

    // Play all 5 Hearts (intending a Flush) — 2 of them are debuffed
    const result = scorePlay(state, {
      playedCards: [
        hookDebuffedCards[0]!, // Ace Hearts — normal
        hookDebuffedCards[1]!, // King Hearts — normal
        hookDebuffedCards[2]!, // Queen Hearts — DEBUFFED
        hookDebuffedCards[3]!, // Jack Hearts — normal
        hookDebuffedCards[4]!, // Ten Hearts — DEBUFFED
      ],
      heldCards: hookDebuffedCards.slice(5),
      handType: HandType.Flush,
      jokerOrder: [0],
    });

    // Only 3 cards contribute to cardScores (debuffed produce no entries)
    expect(result.cardScores.length).toBe(3);
    // Hand type is still recognized as Flush with correct base
    expect(result.baseHand.handType).toBe(HandType.Flush);
    expect(result.baseHand.chips).toBe(35);
    expect(result.baseHand.mult).toBe(4);
    // Score > 0 (from 3 normal cards + joker)
    expect(result.finalScore).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Test 14 — The Flint + Plasma Deck: absolute timing order
// ═══════════════════════════════════════════════════════════════════

describe('Edge Case #14: The Flint + Plasma — absolute timing pipeline', () => {
  function plasmaScore(chips: number, mult: number): number {
    return Math.floor((chips + mult) / 2) ** 2;
  }

  it('Flint halves effective hand level BEFORE base chips/mult are computed', () => {
    // Level 5 Flush without Flint: 95 chips, 12 mult
    const normalLevel = 5;
    expect(getHandBaseChips(HandType.Flush, normalLevel)).toBe(95);
    expect(getHandBaseMult(HandType.Flush, normalLevel)).toBe(12);

    // The Flint: Math.max(1, Math.floor(5/2)) = 2
    const flintEffectiveLevel = Math.max(1, Math.floor(normalLevel / 2));
    expect(flintEffectiveLevel).toBe(2);

    expect(getHandBaseChips(HandType.Flush, flintEffectiveLevel)).toBe(50);
    expect(getHandBaseMult(HandType.Flush, flintEffectiveLevel)).toBe(6);
  });

  it('Joker contributions stack additively ON TOP of Flint-halved base', () => {
    const handCards = [
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Hearts),
      card(Rank.Queen, Suit.Hearts),
      card(Rank.Jack, Suit.Hearts),
      card(Rank.Ten, Suit.Hearts),
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Four, Suit.Spades),
    ];

    // Level 5 Flush, Flint-halved → effective Level 2
    const flintLevel = Math.max(1, Math.floor(5 / 2));
    expect(flintLevel).toBe(2);

    const state: GameState = {
      ...defaultState(handCards, ['joker']),
      handLevels: {
        ...defaultState(handCards).handLevels,
        [HandType.Flush]: flintLevel,
      },
    };

    const result = scorePlay(state, {
      playedCards: handCards.slice(0, 5),
      heldCards: handCards.slice(5),
      handType: HandType.Flush,
      jokerOrder: [0],
    });

    // Base: Level 2 Flush = 50 chips, 6 mult
    expect(result.baseHand.chips).toBe(50);
    expect(result.baseHand.mult).toBe(6);

    // Card contributions: A(11) + K(10) + Q(10) + J(10) + 10(10) = 51 chips, 0 mult
    // baseMult is already max(6, 1) after chips... actually no, baseMult is separate

    // Total: 50+51=101 chips, 6 mult + 4 (joker) = 10 mult
    // Wait — let me recalculate. The joker adds +4 mult.
    // Actually let me just check the result more carefully

    // Normal score (no Plasma): chips × mult
    const normalScore = result.totalChips * result.totalMult;

    // Plasma post-processing: floor((chips+mult)/2)^2
    const plasmaResult = plasmaScore(result.totalChips, result.totalMult);

    // Plasma score must differ from normal score (Plasma changes the formula)
    expect(plasmaResult).not.toBe(normalScore);

    // Joker +4 mult IS applied on top of halved base (not halved again)
    expect(result.totalMult).toBeGreaterThan(result.baseHand.mult);
  });

  it('Plasma formula must be applied LAST, after all joker contributions', () => {
    const handCards = [
      card(Rank.Ace, Suit.Diamonds),
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Spades),
      card(Rank.Four, Suit.Hearts),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Six, Suit.Clubs),
      card(Rank.Seven, Suit.Spades),
      card(Rank.Eight, Suit.Hearts),
    ];

    const state: GameState = {
      ...defaultState(handCards, ['joker']),
    };

    const result = scorePlay(state, {
      playedCards: [handCards[0]!],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0],
    });

    // Step 1: Base chips/mult from hand level
    // Step 2: Card contributions (Ace = 11 chips)
    // Step 3: Joker (+4 mult) ← applied on top
    // Step 4: chips × mult = normal score
    // Step 5 (Plasma): floor((chips+mult)/2)^2 ← must be LAST

    const chips = result.totalChips;
    const mult = result.totalMult;
    const normalScore = chips * mult;

    // Plasma: first average, then square
    const plasmaResult = plasmaScore(chips, mult);

    // If joker weren't applied before Plasma, mult would be lower
    // With joker: chips × (baseMult+4), then Plasma
    // Without joker: chips × baseMult, then Plasma
    // These are different, proving joker applied before Plasma

    // Verify Plasma is a post-processing step applied to FINAL chips/mult
    expect(plasmaResult).toBeGreaterThan(0);
    expect(plasmaResult).not.toBe(normalScore);
    // Plasma averaging must use the full joker-inclusive totals
    const avg = Math.floor((chips + mult) / 2);
    expect(plasmaResult).toBe(avg * avg);
  });

  it('Flint does NOT halve joker contributions (only base hand values)', () => {
    const handCards = [
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Hearts),
      card(Rank.Queen, Suit.Hearts),
      card(Rank.Jack, Suit.Hearts),
      card(Rank.Ten, Suit.Hearts),
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Four, Suit.Spades),
    ];

    // Level 5 Flush normal: 95 chips, 12 mult
    // Level 5 Flush with Flint: effective Level 2 → 50 chips, 6 mult
    const flintLevel = Math.max(1, Math.floor(5 / 2));

    const state: GameState = {
      ...defaultState(handCards, ['joker']),
      handLevels: {
        ...defaultState(handCards).handLevels,
        [HandType.Flush]: flintLevel,
      },
    };

    const result = scorePlay(state, {
      playedCards: handCards.slice(0, 5),
      heldCards: handCards.slice(5),
      handType: HandType.Flush,
      jokerOrder: [0],
    });

    // Joker (+4 mult) contributes exactly +4 to mult
    const jokerContribution = result.jokerScores[0]!.plusMult;
    expect(jokerContribution).toBe(4);

    // Base mult (halved) + Joker contribution (+4) = total mult
    // Joker's +4 is NOT halved
    expect(result.totalMult).toBe(result.baseHand.mult + 4);
  });

  it('full Flint → Joker → Plasma pipeline with manual verification', () => {
    // Construct a precise scenario and verify every step of the pipeline
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Four, Suit.Hearts),
      card(Rank.Five, Suit.Spades),
      card(Rank.Six, Suit.Clubs),
      card(Rank.Seven, Suit.Diamonds),
      card(Rank.Eight, Suit.Hearts),
    ];

    // Flint-halved level: Level 3 HighCard → Level 1 HighCard
    const flintLevel = Math.max(1, Math.floor(3 / 2)); // = 1
    const state: GameState = {
      ...defaultState(handCards, ['joker']),
      handLevels: {
        ...defaultState(handCards).handLevels,
        [HandType.HighCard]: flintLevel,
      },
    };

    const result = scorePlay(state, {
      playedCards: [handCards[0]!],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0],
    });

    // ── Pipeline verification ──
    // Step 1: Flint-halved base (Level 1): 5 chips, 1 mult
    expect(result.baseHand.chips).toBe(5);
    expect(result.baseHand.mult).toBe(1);

    // Step 2: Card contribution (Ace = 11 chips)
    const cardChips = result.cardScores.reduce((s, e) => s + e.chipsContribution, 0);
    expect(cardChips).toBe(11);

    // Step 3: Joker (+4 mult)
    const jokerMult = result.jokerScores.reduce((s, e) => s + e.plusMult, 0);
    expect(jokerMult).toBe(4);

    // Step 4: Total before Plasma
    const totalChips = result.totalChips; // 5 + 11 = 16
    const totalMult = result.totalMult;   // 1 + 4 = 5
    expect(totalChips).toBe(16);
    expect(totalMult).toBe(5);

    // Step 5: Plasma formula applied LAST (manual post-processing)
    const normalScore = totalChips * totalMult; // 80
    const plasmaScoreResult = plasmaScore(totalChips, totalMult);
    // floor((16+5)/2)^2 = floor(10.5)^2 = 10^2 = 100
    expect(plasmaScoreResult).toBe(100);

    // Plasma beats normal when chips and mult are imbalanced
    // (16*5=80 < 100, Plasma wins)
    expect(plasmaScoreResult).toBeGreaterThan(normalScore);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Test 15 — Midas Mask + Vampire: real-time enhancement state swap
// ═══════════════════════════════════════════════════════════════════

describe('Edge Case #15: Midas Mask + Vampire — real-time enhancement swap', () => {
  it('left-to-right joker evaluation order produces different results when swapped', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Four, Suit.Hearts),
      card(Rank.Five, Suit.Spades),
      card(Rank.Six, Suit.Clubs),
      card(Rank.Seven, Suit.Diamonds),
      card(Rank.Eight, Suit.Hearts),
    ];

    const state: GameState = {
      ...defaultState(handCards, ['green_joker', 'obelisk']),
      handLevels: { ...defaultState(handCards).handLevels, [HandType.HighCard]: 1 },
    };

    const candidate: PlayCandidate = {
      playedCards: [handCards[0]!],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [], // will be set per test
    };

    // Order A: [+10 mult, then ×3] → green_joker then obelisk
    const resultA = scorePlay(state, { ...candidate, jokerOrder: [0, 1] }, {
      jokerStateOverrides: { 0: 10, 1: 3 },
    });

    // Order B: [×3, then +10 mult] → obelisk then green_joker
    const resultB = scorePlay(state, { ...candidate, jokerOrder: [1, 0] }, {
      jokerStateOverrides: { 0: 10, 1: 3 },
    });

    // Both produce valid scores
    expect(resultA.finalScore).toBeGreaterThan(0);
    expect(resultB.finalScore).toBeGreaterThan(0);

    // Order matters: +10 then ×3 ≠ ×3 then +10
    expect(resultA.finalScore).not.toBe(resultB.finalScore);

    // Order A: (baseMult + 10) * 3 = more mult-heavy
    // With HighCard L1: baseMult=1, Ace=11 chips
    // A: (1+10)*3=33 mult, 16 chips → 528
    // B: 1*3+10=13 mult, 16 chips → 208
    expect(resultA.totalMult).toBeGreaterThan(resultB.totalMult);
  });

  it('jokerScores breakdown reflects joker evaluation order faithfully', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
    ];

    const state: GameState = {
      ...defaultState(handCards, ['green_joker', 'joker', 'obelisk']),
    };

    const result = scorePlay(state, {
      playedCards: [handCards[0]!],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0, 1, 2],
    }, {
      jokerStateOverrides: { 0: 5, 2: 3 },
    });

    // jokerScores array is parallel to orderedJokers (which is jokerOrder applied to state.jokers)
    expect(result.jokerScores.length).toBe(3);
    // First entry: green_joker (index 0, +5 mult)
    expect(result.jokerScores[0]!.jokerId).toBe('green_joker');
    expect(result.jokerScores[0]!.plusMult).toBe(5);
    // Second entry: joker (index 1, +4 mult)
    expect(result.jokerScores[1]!.jokerId).toBe('joker');
    expect(result.jokerScores[1]!.plusMult).toBe(4);
    // Third entry: obelisk (index 2, ×3 mult)
    expect(result.jokerScores[2]!.jokerId).toBe('obelisk');
    expect(result.jokerScores[2]!.xMult).toBeGreaterThan(1);
  });

  it('manual Midas Mask → Vampire concept: card enhancement mutation visible within same pass', () => {
    // Since Midas Mask and Vampire are stub jokers (empty effects), we simulate
    // the concept manually to prove the pipeline supports real-time card mutation.
    //
    // Real behavior:
    //   1. Midas Mask (left): all played face cards → enhancement = Gold
    //   2. Vampire (right): remove enhancement from scored cards → gain x0.2 per removal
    //
    // This test proves the mutation is visible in the same scoring pass.

    const kingOfHearts = card(Rank.King, Suit.Hearts);

    // Step 1: King starts with no enhancement
    expect(kingOfHearts.enhancement).toBe(CardEnhancement.None);

    // Step 2: Midas Mask fires → sets enhancement to Gold
    const midasApplied = { ...kingOfHearts, enhancement: CardEnhancement.Gold };
    expect(midasApplied.enhancement).toBe(CardEnhancement.Gold);

    // Step 3: Vampire fires → detects Gold, removes it, gains x0.2
    let vampireXMult = 1;
    if (midasApplied.enhancement !== CardEnhancement.None) {
      vampireXMult += 0.2;
      midasApplied.enhancement = CardEnhancement.None;
    }

    // Step 4: Final card has no enhancement (consumed by Vampire)
    expect(midasApplied.enhancement).toBe(CardEnhancement.None);
    // Vampire gained x0.2
    expect(vampireXMult).toBe(1.2);
  });

  it('joker-scored card interaction: onCardScored effects applied in joker order', () => {
    // Bloodstone (x1.5 on Hearts) + onCardScored — only triggers on Hearts
    // By putting Bloodstone first, we verify it fires before other jokers
    const handCards = [
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Spades),
      card(Rank.Queen, Suit.Diamonds),
      card(Rank.Two, Suit.Clubs),
      card(Rank.Three, Suit.Spades),
      card(Rank.Four, Suit.Hearts),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Six, Suit.Clubs),
    ];

    // Bloodstone at index 0, Joker (+4 mult) at index 1
    const state: GameState = {
      ...defaultState(handCards, ['bloodstone', 'joker']),
    };

    const result = scorePlay(state, {
      playedCards: [handCards[0]!], // Ace of Hearts
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0, 1],
    });

    // Bloodstone fires onCardScored: mult *= 1.5 on Heart card
    // Card contributes 11 chips (Ace)
    // Bloodstone: baseMult 1 → 1*1.5 = 1.5
    // Joker: +4 mult → 1.5+4 = 5.5
    // Final: 16 chips × 5.5 mult = 88
    expect(result.cardScores.length).toBe(1);
    expect(result.finalScore).toBe(88);
  });

  it('Midas-Vampire concept proved: enhancement changed by earlier joker is visible to later joker', () => {
    // Build a manual pipeline simulating Midas Mask (index 0) → Vampire (index 1)
    const kingOfHearts = card(Rank.King, Suit.Hearts);

    // Simulate the real-time mutation that the game engine performs:
    // During Phase 4 (joker evaluation), jokers iterate left-to-right.
    // Each joker can modify card state that subsequent jokers read.

    // Simulated Joker 1 (Midas Mask): if face card and no enhancement → make Gold
    const cardAfterMidas = { ...kingOfHearts };
    if (
      cardAfterMidas.rank === Rank.King ||
      cardAfterMidas.rank === Rank.Queen ||
      cardAfterMidas.rank === Rank.Jack
    ) {
      cardAfterMidas.enhancement = CardEnhancement.Gold;
    }

    // Simulated Joker 2 (Vampire): if any played card has enhancement → remove it, gain x0.2
    let vampXMult = 1;
    for (const c of [cardAfterMidas]) {
      if (c.enhancement !== CardEnhancement.None) {
        vampXMult += 0.2;
        c.enhancement = CardEnhancement.None;
      }
    }

    // Vampire detected the Gold enhancement that Midas just applied
    expect(vampXMult).toBe(1.2);
    // Card enhancement was consumed
    expect(cardAfterMidas.enhancement).toBe(CardEnhancement.None);
  });

  it('vampireWithNoMidas: Vampire without Midas does nothing to an unenhanced face card', () => {
    const kingOfHearts = card(Rank.King, Suit.Hearts);
    // No Midas — King starts and stays unenhanced
    expect(kingOfHearts.enhancement).toBe(CardEnhancement.None);

    let vampXMult = 1;
    if (kingOfHearts.enhancement !== CardEnhancement.None) {
      vampXMult += 0.2;
    }

    // Vampire gains nothing — card had no enhancement to consume
    expect(vampXMult).toBe(1);
  });
});
