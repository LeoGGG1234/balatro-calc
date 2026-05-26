import { describe, it, expect } from 'vitest';
import { HandType, Rank, Suit, CardEnhancement, CardEdition, Seal, JokerCategory, JokerRarity } from '../src/engine/types';
import { scorePlay, computeBaseballCardMult } from '../src/engine/scorer';
import { registerJoker, getJoker } from '../src/engine/joker-effects';
import { defaultState, card } from './helpers';

describe('Scorer', () => {
  it('scores a basic High Card correctly', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, []);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0]], // Ace high card
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [],
    };

    const result = scorePlay(state, candidate);

    // Level 1 High Card: 5 chips, 1 mult
    // Ace: 11 chips
    // Total: (5 + 11) * 1 = 16
    expect(result.baseHand.chips).toBe(5);
    expect(result.baseHand.mult).toBe(1);
    expect(result.totalChips).toBe(16); // 5 base + 11 ace
  });

  it('scores a Pair with Joker joker', () => {
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

    const state = defaultState(handCards, ['joker']); // +4 mult
    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]], // Pair of Aces
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);

    // Level 1 Pair: 10 chips, 2 mult
    // Cards: Ace (11) + Ace (11) = 22 chips
    // Joker: +4 mult
    // Total: (10 + 22) × (2 + 4) = 32 × 6 = 192
    expect(result.totalChips).toBe(32);
    expect(result.totalMult).toBe(6);
    expect(result.finalScore).toBe(192);
  });

  it('scores a Flush with Lusty Joker', () => {
    const handCards = [
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Hearts),
      card(Rank.Eight, Suit.Hearts),
      card(Rank.Ten, Suit.Hearts),
      card(Rank.Two, Suit.Spades),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['lusty_joker']); // +4 mult per heart scored
    const candidate: PlayCandidate = {
      playedCards: handCards.slice(0, 5),
      heldCards: handCards.slice(5),
      handType: HandType.Flush,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);

    // Level 1 Flush: 35 chips, 4 mult
    // Cards: A(11)+3(3)+5(5)+8(8)+10(10) = 37 chips
    // Lusty Joker: +4 mult per heart → 5 hearts × 4 = +20 mult
    // Total: (35 + 37) × (4 + 20) = 72 × 24 = 1728
    expect(result.totalChips).toBe(72);
    expect(result.totalMult).toBe(24);
    expect(result.finalScore).toBe(1728);
  });

  it('scores correctly with ×Mult joker', () => {
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

    const state = defaultState(handCards, ['joker', 'cavendish']); // +4 mult, ×3
    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0, 1], // Joker first (+4), then Cavendish (×3)
    };

    const result = scorePlay(state, candidate);

    // Pair: (10+22) × (2+4) × 3 = 32 × 6 × 3 = 576
    expect(result.totalChips).toBe(32);
    expect(result.finalScore).toBe(576);
  });

  it('demonstrates bad joker order reduces score', () => {
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

    // Bad order: Cavendish (×3) first, then Joker (+4)
    const badCandidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [1, 0], // Cavendish first, Joker second
    };

    const badResult = scorePlay(state, badCandidate);

    // (10+22) × (2×3) + 4 = 32 × 6 = 192, then +4 = 196... wait that's wrong
    // Actually: Cavendish first: mult = 2 × 3 = 6, then Joker: mult = 6 + 4 = 10
    // Total: 32 × 10 = 320
    // Good order: Joker first: mult = 2 + 4 = 6, then Cavendish: mult = 6 × 3 = 18
    // Total: 32 × 18 = 576

    // The correct good score is 576, the bad score is 320
    // But our scorer just adds joker effects which multiply/add linearly
    // Wait, the bad result: 32 * (2 * 3 + 4) = 32 * 10 = 320 — actually that's correct
    // Actually let me re-check:
    // Base mult = 2 (Pair)
    // Cavendish evaluates first: mult *= 3 → mult = 6
    // Joker evaluates second: mult += 4 → mult = 10
    // Total: 32 * 10 = 320
    expect(badResult.finalScore).toBe(320);

    // Good order should be better: 32 * (2 + 4) * 3 = 32 * 6 * 3 = 576
    const goodCandidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0, 1],
    };
    const goodResult = scorePlay(state, goodCandidate);
    expect(goodResult.finalScore).toBe(576);
    expect(goodResult.finalScore).toBeGreaterThan(badResult.finalScore);
  });

  it('handles Glass card correctly', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades, CardEnhancement.Glass),
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, []);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0]], // Glass Ace
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [],
    };

    const result = scorePlay(state, candidate);

    // High Card L1: 5 chips, 1 mult
    // Ace: 11 chips
    // Glass: ×2 mult
    // Total: (5 + 11) × (1 × 2) = 16 × 2 = 32
    expect(result.totalChips).toBe(16);
    expect(result.finalScore).toBe(32);
  });

  it('handles Steel card in held hand', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Hearts, CardEnhancement.Steel),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, []);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0]], // Ace
      heldCards: handCards.slice(1), // includes Steel King
      handType: HandType.HighCard,
      jokerOrder: [],
    };

    const result = scorePlay(state, candidate);

    // High Card L1: 5 chips, 1 mult
    // Ace: 11 chips
    // Steel King in hand: ×1.5 mult
    // Total chips: 5 + 11 = 16
    // Total mult: 1 * 1.5 = 1.5
    // Score: 16 * 1.5 = 24
    expect(result.totalChips).toBe(16);
    expect(result.finalScore).toBe(24);
  });

  it('handles Bonus card correctly', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades, CardEnhancement.Bonus),
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, []);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0]],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [],
    };

    const result = scorePlay(state, candidate);

    // High Card L1: 5 chips, 1 mult
    // Ace: 11 chips
    // Bonus: +30 chips
    // Total chips: 5 + 11 + 30 = 46
    // Total mult: 1
    // Score: 46
    expect(result.totalChips).toBe(46);
    expect(result.finalScore).toBe(46);
  });

  it('debuffed cards contribute 0 chips and mult', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Spades),
    ];
    handCards[0].debuffed = true;

    const state: GameState = {
      ...defaultState(),
      handCards,
      jokers: [],
    };

    const candidate: PlayCandidate = {
      playedCards: handCards,
      heldCards: [],
      handType: HandType.HighCard,
      jokerOrder: [],
      totalScore: 0,
      breakdown: undefined as any,
    };

    const result = scorePlay(state, candidate);
    // Debuffed Ace contributes 0; only King (10 chips) counts
    // High Card L1: 5 chips + 10 (King) = 15 chips
    expect(result.totalChips).toBe(15);
    expect(result.finalScore).toBe(15);
  });
});

// ─── Scorer — Joker Editions ───────────────────────────────────

describe('Scorer — Joker Editions', () => {
  it('Foil edition adds 50 chips', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, []);
    // Add a joker with Foil edition
    state.jokers = [{ id: 'joker', edition: CardEdition.Foil }];

    const candidate: PlayCandidate = {
      playedCards: [handCards[0]],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);
    // High Card L1: 5 chips, 1 mult
    // Ace: 11 chips
    // Joker: +4 mult
    // Foil: +50 chips
    // Total chips: 5 + 11 + 50 = 66
    expect(result.totalChips).toBe(66);
    expect(result.totalMult).toBe(5); // 1 base + 4 joker
    expect(result.finalScore).toBe(330);
  });

  it('Holographic edition adds 10 mult', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, []);
    state.jokers = [{ id: 'joker', edition: CardEdition.Holographic }];

    const candidate: PlayCandidate = {
      playedCards: [handCards[0]],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);
    // High Card: 5+11 chips = 16, mult: 1 + 4(joker) + 10(holo) = 15
    expect(result.totalMult).toBe(15);
    expect(result.finalScore).toBe(240);
  });

  it('Polychrome edition gives x1.5 mult', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, []);
    state.jokers = [{ id: 'joker', edition: CardEdition.Polychrome }];

    const candidate: PlayCandidate = {
      playedCards: [handCards[0]],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);
    // High Card: 16 chips, mult: (1 + 4) * 1.5 = 7.5
    expect(result.totalMult).toBe(7.5);
    expect(result.finalScore).toBe(120);
  });
});

// ─── Scorer — Blueprint / Brainstorm ───────────────────────────

describe('Scorer — Blueprint / Brainstorm', () => {
  it('Blueprint copies the joker to its right', () => {
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

    const state = defaultState(handCards, ['blueprint', 'joker']);
    // Blueprint at index 0 copies Joker at index 1 (+4 mult)
    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0, 1],
    };

    const result = scorePlay(state, candidate);
    // Pair: (10+22) * (2 + 4(joker) + 4(blueprint copying joker)) = 32 * 10 = 320
    expect(result.totalMult).toBe(10);
    expect(result.finalScore).toBe(320);
  });

  it('Brainstorm copies the leftmost joker', () => {
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

    const state = defaultState(handCards, ['joker', 'brainstorm']);
    // Brainstorm at index 1 copies leftmost = Joker at index 0 (+4 mult)
    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0, 1],
    };

    const result = scorePlay(state, candidate);
    // Pair: (10+22) * (2 + 4(joker) + 4(brainstorm copying joker)) = 32 * 10 = 320
    expect(result.totalMult).toBe(10);
    expect(result.finalScore).toBe(320);
  });
});

// ─── Scorer — State Overrides ──────────────────────────────────

describe('Scorer — State Overrides', () => {
  it('ride_the_bus override adds mult', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['ride_the_bus']);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0]],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    // ride_the_bus with +15 accumulated mult
    const result = scorePlay(state, candidate, { jokerStateOverrides: { 0: 15 } });
    expect(result.totalMult).toBe(16); // 1 base + 15 override
  });

  it('hologram override gives xMult', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['hologram']);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0]],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    // hologram with x2.5 mult (accumulated from adding cards)
    const result = scorePlay(state, candidate, { jokerStateOverrides: { 0: 2.5 } });
    expect(result.totalMult).toBe(2.5); // 1 * 2.5
    expect(result.finalScore).toBe(40); // 16 * 2.5
  });

  it('ice_cream override adds chips', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['ice_cream']);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0]],
      heldCards: handCards.slice(1),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    // ice_cream with 75 chips remaining
    const result = scorePlay(state, candidate, { jokerStateOverrides: { 0: 75 } });
    expect(result.totalChips).toBe(91); // 5 base + 11 Ace + 75 ice cream
  });

  it('drivers_license with >=16 enhanced cards gives x3', () => {
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

    const state = defaultState(handCards, ['drivers_license']);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.Pair,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate, { jokerStateOverrides: { 0: 16 } });
    expect(result.totalMult).toBe(6); // 2 base * 3
    expect(result.finalScore).toBe(192); // 32 * 6
  });
});

// ─── Scorer — Retrigger Mechanics ──────────────────────────────

describe('Scorer — Retrigger Mechanics', () => {
  it('Hanging Chad retriggers first card twice', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['hanging_chad']);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);
    // Ace triggers 3 times (1 original + 2 Chad), King triggers 1 time
    // Ace: 3 * 11 = 33, King: 1 * 10 = 10
    // Base chips: 5, Total chips: 5 + 33 + 10 = 48
    expect(result.totalChips).toBe(48);
    // 3 triggers for Ace, 1 for King = 4 card scores
    expect(result.cardScores).toHaveLength(4);
  });

  it('Dusk retriggers all cards on final hand', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['dusk']);
    state.roundState.isFinalHand = true;

    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);
    // Each card triggers 2 times (1 + 1 dusk)
    expect(result.cardScores).toHaveLength(4); // 2 cards * 2 triggers
    // Ace 2*11=22, King 2*10=20, base 5 → 47
    expect(result.totalChips).toBe(47);
  });

  it('Red seal gives +1 retrigger', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades, CardEnhancement.None, CardEdition.None, Seal.Red),
      card(Rank.King, Suit.Hearts),
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
      handType: HandType.HighCard,
      jokerOrder: [],
    };

    const result = scorePlay(state, candidate);
    // Ace: 2 triggers (1 + 1 red seal) * 11 = 22
    // King: 1 trigger * 10 = 10
    // Base chips: 5, Total: 5 + 22 + 10 = 37
    expect(result.totalChips).toBe(37);
    expect(result.cardScores).toHaveLength(3); // Ace*2 + King*1
  });

  it('Red seal + Hanging Chad + Dusk stack correctly', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades, CardEnhancement.None, CardEdition.None, Seal.Red),
      card(Rank.King, Suit.Hearts),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Four, Suit.Clubs),
      card(Rank.Six, Suit.Diamonds),
    ];

    const state = defaultState(handCards, ['hanging_chad', 'dusk']);
    state.roundState.isFinalHand = true;

    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]],
      heldCards: handCards.slice(2),
      handType: HandType.HighCard,
      jokerOrder: [0, 1],
    };

    const result = scorePlay(state, candidate);
    // Ace: 1 + 1(red) + 2(chad) + 1(dusk) = 5 triggers → 5*11 = 55
    // King: 1 + 1(dusk) = 2 triggers → 2*10 = 20
    // Base chips: 5, Total: 5 + 55 + 20 = 80
    expect(result.totalChips).toBe(80);
    expect(result.cardScores).toHaveLength(7); // 5 + 2
  });
});

// ─── Scorer — Held-in-Hand Effects ─────────────────────────────

describe('Scorer — Held-in-Hand Effects', () => {
  it('Baron gives x1.5 per King held in hand', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.King, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Five, Suit.Spades),
    ];

    const state = defaultState(handCards, ['baron']);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0]], // Play Ace
      heldCards: handCards.slice(1), // Hold K, K, 3, 5
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);
    // High Card: 16 chips, mult: 1 * 1.5 * 1.5 = 2.25 (2 kings held)
    expect(result.totalMult).toBe(2.25);
    expect(result.finalScore).toBe(36); // 16 * 2.25
  });

  it('Shoot the Moon gives +13 mult per Queen held', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Queen, Suit.Hearts),
      card(Rank.Queen, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Five, Suit.Spades),
    ];

    const state = defaultState(handCards, ['shoot_the_moon']);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0]],
      heldCards: handCards.slice(1), // Hold Q, Q, 3, 5
      handType: HandType.HighCard,
      jokerOrder: [0],
    };

    const result = scorePlay(state, candidate);
    expect(result.totalMult).toBe(27); // 1 base + 13*2 queens = 27
  });

  it('Mime re-triggers held card effects (Steel + Baron + Mime)', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Hearts, CardEnhancement.Steel),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),
    ];

    const state = defaultState(handCards, ['baron', 'mime']);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0]],
      heldCards: handCards.slice(1), // Steel King, 3, 5, 8
      handType: HandType.HighCard,
      jokerOrder: [0, 1],
    };

    const result = scorePlay(state, candidate);
    // Baron: King held → x1.5 per pass
    // Steel King: x1.5 per pass
    // Mime: 2 passes
    // Pass 1: mult = 1 * 1.5(baron) * 1.5(steel) = 2.25
    // Pass 2: mult = 2.25 * 1.5(steel again) = 3.375
    // Actually let me check: Mime re-triggers held card *enhancements* (Steel),
    // and held joker effects (Baron) already trigger via onHeldInHand.
    // The scorer runs 2 passes for heldPasses.
    // Pass 0: Steel x1.5, Baron x1.5 → mult = 1*1.5*1.5 = 2.25
    // Pass 1: Steel x1.5 again → mult = 2.25*1.5 = 3.375
    expect(result.totalMult).toBeCloseTo(3.375, 3);
  });

  it('Two Steel cards stack multiplicatively', () => {
    const handCards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.King, Suit.Hearts, CardEnhancement.Steel),
      card(Rank.Queen, Suit.Clubs, CardEnhancement.Steel),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Five, Suit.Spades),
    ];

    const state = defaultState(handCards, []);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0]],
      heldCards: handCards.slice(1), // 2 Steel cards held
      handType: HandType.HighCard,
      jokerOrder: [],
    };

    const result = scorePlay(state, candidate);
    // mult = 1 * 1.5 * 1.5 = 2.25
    expect(result.totalMult).toBe(2.25);
  });
});

// ─── Scorer — Special Cards ───────────────────────────────────

describe('Scorer — Special Cards', () => {
  it('Stone card in played hand does not score individually', () => {
    const handCards = [
      card(Rank.Two, Suit.Spades, CardEnhancement.Stone),
      card(Rank.Three, Suit.Hearts),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
    ];

    const state = defaultState(handCards, []);
    const candidate: PlayCandidate = {
      playedCards: [handCards[0], handCards[1]], // Stone + 3
      heldCards: handCards.slice(2),
      handType: HandType.HighCard,
      jokerOrder: [],
    };

    const result = scorePlay(state, candidate);
    // Stone: +50 chips; 3: rankToChips(3)=3 chips; base High Card: 5 chips → total 58
    expect(result.totalChips).toBe(58);
  });

  it('computeBaseballCardMult gives x1.5 per uncommon joker', () => {
    // Joker (common) + Cavendish (common) = 0 uncommons
    const jokers1 = [{ id: 'joker', edition: CardEdition.None as const }];
    expect(computeBaseballCardMult(jokers1)).toBe(1); // 1.5^0

    // Add an uncommon joker: Four Fingers
    const jokers2 = [
      { id: 'joker', edition: CardEdition.None as const },
      { id: 'four_fingers', edition: CardEdition.None as const },
    ];
    expect(computeBaseballCardMult(jokers2)).toBe(1.5); // 1.5^1

    // Two uncommons
    const jokers3 = [
      { id: 'joker', edition: CardEdition.None as const },
      { id: 'four_fingers', edition: CardEdition.None as const },
      { id: 'shortcut', edition: CardEdition.None as const },
    ];
    expect(computeBaseballCardMult(jokers3)).toBe(2.25); // 1.5^2
  });
});

// ─── Search Tests ──────────────────────────────────────────────

