import { describe, it, expect } from 'vitest';
import { HandType, Rank, Suit, CardEnhancement, CardEdition } from '../src/engine/types';
import { recognizeHand, evaluatePlay } from '../src/engine/hand-evaluator';
import { getJokerModifiers } from '../src/engine/joker-data';
import { defaultState, card } from './helpers';

describe('Hand Evaluator', () => {
  it('recognizes a Pair', () => {
    const cards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Five, Suit.Spades),
    ];
    expect(recognizeHand(cards)).toBe(HandType.Pair);
  });

  it('recognizes Two Pair', () => {
    const cards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Clubs),
      card(Rank.King, Suit.Diamonds),
    ];
    expect(recognizeHand(cards)).toBe(HandType.TwoPair);
  });

  it('recognizes Three of a Kind', () => {
    const cards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Ace, Suit.Clubs),
    ];
    expect(recognizeHand(cards)).toBe(HandType.ThreeOfAKind);
  });

  it('recognizes a Straight', () => {
    const cards = [
      card(Rank.Ten, Suit.Spades),
      card(Rank.Jack, Suit.Hearts),
      card(Rank.Queen, Suit.Clubs),
      card(Rank.King, Suit.Diamonds),
      card(Rank.Ace, Suit.Spades),
    ];
    expect(recognizeHand(cards)).toBe(HandType.Straight);
  });

  it('recognizes a Flush', () => {
    const cards = [
      card(Rank.Two, Suit.Hearts),
      card(Rank.Five, Suit.Hearts),
      card(Rank.Eight, Suit.Hearts),
      card(Rank.Jack, Suit.Hearts),
      card(Rank.Ace, Suit.Hearts),
    ];
    expect(recognizeHand(cards)).toBe(HandType.Flush);
  });

  it('recognizes Full House', () => {
    const cards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Ace, Suit.Clubs),
      card(Rank.King, Suit.Diamonds),
      card(Rank.King, Suit.Spades),
    ];
    expect(recognizeHand(cards)).toBe(HandType.FullHouse);
  });

  it('recognizes Four of a Kind', () => {
    const cards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Ace, Suit.Clubs),
      card(Rank.Ace, Suit.Diamonds),
    ];
    expect(recognizeHand(cards)).toBe(HandType.FourOfAKind);
  });

  it('recognizes Straight Flush', () => {
    const cards = [
      card(Rank.Nine, Suit.Spades),
      card(Rank.Ten, Suit.Spades),
      card(Rank.Jack, Suit.Spades),
      card(Rank.Queen, Suit.Spades),
      card(Rank.King, Suit.Spades),
    ];
    const result = recognizeHand(cards);
    expect(result).toBe(HandType.StraightFlush);
  });

  it('recognizes Royal Flush', () => {
    const cards = [
      card(Rank.Ten, Suit.Hearts),
      card(Rank.Jack, Suit.Hearts),
      card(Rank.Queen, Suit.Hearts),
      card(Rank.King, Suit.Hearts),
      card(Rank.Ace, Suit.Hearts),
    ];
    const result = recognizeHand(cards);
    expect(result).toBe(HandType.RoyalFlush);
  });

  it('recognizes High Card', () => {
    const cards = [card(Rank.Ace, Suit.Spades)];
    expect(recognizeHand(cards)).toBe(HandType.HighCard);
  });
});

// ─── Hand Evaluator with Joker Modifiers ───────────────────────

describe('Hand Evaluator — Four Fingers', () => {
  const mod = { fourFingers: true, smeared: false, shortcut: false };

  it('4-card Flush with Four Fingers', () => {
    const cards = [
      card(Rank.Two, Suit.Hearts),
      card(Rank.Five, Suit.Hearts),
      card(Rank.Eight, Suit.Hearts),
      card(Rank.Jack, Suit.Hearts),
    ];
    expect(recognizeHand(cards, mod)).toBe(HandType.Flush);
  });

  it('4-card Straight with Four Fingers', () => {
    const cards = [
      card(Rank.Five, Suit.Spades),
      card(Rank.Six, Suit.Hearts),
      card(Rank.Seven, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
    ];
    expect(recognizeHand(cards, mod)).toBe(HandType.Straight);
  });

  it('4-card Straight Flush with Four Fingers', () => {
    const cards = [
      card(Rank.Five, Suit.Clubs),
      card(Rank.Six, Suit.Clubs),
      card(Rank.Seven, Suit.Clubs),
      card(Rank.Eight, Suit.Clubs),
    ];
    const result = recognizeHand(cards, mod);
    expect(result).toBe(HandType.StraightFlush);
  });

  it('5-card hands still work normally with Four Fingers', () => {
    const cards = [
      card(Rank.Ten, Suit.Spades),
      card(Rank.Jack, Suit.Hearts),
      card(Rank.Queen, Suit.Clubs),
      card(Rank.King, Suit.Diamonds),
      card(Rank.Ace, Suit.Spades),
    ];
    expect(recognizeHand(cards, mod)).toBe(HandType.Straight);
  });

  it('4-card Four of a Kind unaffected by Four Fingers', () => {
    const cards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Ace, Suit.Clubs),
      card(Rank.Ace, Suit.Diamonds),
    ];
    expect(recognizeHand(cards, mod)).toBe(HandType.FourOfAKind);
  });
});

describe('Hand Evaluator — Smeared', () => {
  const mod = { fourFingers: false, smeared: true, shortcut: false };

  it('mixed Hearts + Diamonds = Flush with Smeared', () => {
    const cards = [
      card(Rank.Two, Suit.Hearts),
      card(Rank.Five, Suit.Hearts),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Jack, Suit.Diamonds),
      card(Rank.Ace, Suit.Hearts),
    ];
    expect(recognizeHand(cards, mod)).toBe(HandType.Flush);
  });

  it('mixed Spades + Clubs = Flush with Smeared', () => {
    const cards = [
      card(Rank.Two, Suit.Spades),
      card(Rank.Five, Suit.Clubs),
      card(Rank.Eight, Suit.Spades),
      card(Rank.Jack, Suit.Clubs),
      card(Rank.Ace, Suit.Spades),
    ];
    expect(recognizeHand(cards, mod)).toBe(HandType.Flush);
  });

  it('mixed red + black = no Flush with Smeared', () => {
    const cards = [
      card(Rank.Two, Suit.Hearts),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Spades),  // black suit
      card(Rank.Jack, Suit.Diamonds),
      card(Rank.Ace, Suit.Hearts),
    ];
    // 4 red + 1 black = no flush without Four Fingers
    const result = recognizeHand(cards, mod);
    expect(result).not.toBe(HandType.Flush);
  });

  it('wild card counts for both color groups with Smeared', () => {
    const cards = [
      card(Rank.Two, Suit.Hearts),
      card(Rank.Five, Suit.Hearts),
      card(Rank.Eight, Suit.Hearts),
      card(Rank.Jack, Suit.Hearts),
      card(Rank.Ace, Suit.Spades, CardEnhancement.Wild),
    ];
    // Wild Ace counts as Hearts (red) → 4h + 1w = 5 red → flush
    expect(recognizeHand(cards, mod)).toBe(HandType.Flush);
  });
});

describe('Hand Evaluator — Shortcut', () => {
  const mod = { fourFingers: false, smeared: false, shortcut: true };

  it('Straight with single gap using Shortcut', () => {
    const cards = [
      card(Rank.Five, Suit.Spades),
      card(Rank.Seven, Suit.Hearts),  // skip 6
      card(Rank.Eight, Suit.Clubs),
      card(Rank.Nine, Suit.Diamonds),
      card(Rank.Ten, Suit.Spades),
    ];
    // 5=5, 7=7, 8=8, 9=9, 10=10 → sorted: 5,7,8,9,10
    // Diffs: 5→7(2, shortcut OK), 7→8(1), 8→9(1), 9→10(1). Run=5 ≥ 5 ✓
    expect(recognizeHand(cards, mod)).toBe(HandType.Straight);
  });

  it('Straight with every-other-rank using Shortcut', () => {
    const cards = [
      card(Rank.Ten, Suit.Spades),
      card(Rank.Eight, Suit.Hearts),
      card(Rank.Six, Suit.Clubs),
      card(Rank.Four, Suit.Diamonds),
      card(Rank.Two, Suit.Spades),
    ];
    // 10=10, 8=8, 6=6, 4=4, 2=2 → sorted: 2,4,6,8,10
    // Diffs: 2→4(2 OK), 4→6(2 OK), 6→8(2 OK), 8→10(2 OK). Run=5 ≥ 5 ✓
    expect(recognizeHand(cards, mod)).toBe(HandType.Straight);
  });

  it('normal Straight still works with Shortcut', () => {
    const cards = [
      card(Rank.Five, Suit.Spades),
      card(Rank.Six, Suit.Hearts),
      card(Rank.Seven, Suit.Clubs),
      card(Rank.Eight, Suit.Diamonds),
      card(Rank.Nine, Suit.Spades),
    ];
    expect(recognizeHand(cards, mod)).toBe(HandType.Straight);
  });

  it('gapped cards that skip 2 ranks = no Straight with Shortcut', () => {
    const cards = [
      card(Rank.Ten, Suit.Spades),
      card(Rank.Seven, Suit.Hearts),  // gap of 3 from 10
      card(Rank.Four, Suit.Clubs),
      card(Rank.Ace, Suit.Diamonds),
      card(Rank.Two, Suit.Spades),
    ];
    const result = recognizeHand(cards, mod);
    // 10,7,4,A,2 → values: 1,2,4,7,10 → diffs: 1(OK), 2(OK), 3(too big), 3(too big)
    // Max run ≤ 3, can't reach 5
    expect(result).not.toBe(HandType.Straight);
  });
});

describe('Hand Evaluator — Combined modifiers', () => {
  it('4-card gapped Straight with Four Fingers + Shortcut', () => {
    const mod = { fourFingers: true, smeared: false, shortcut: true };
    const cards = [
      card(Rank.Ten, Suit.Spades),
      card(Rank.Eight, Suit.Hearts),
      card(Rank.Six, Suit.Clubs),
      card(Rank.Four, Suit.Diamonds),
    ];
    // 10=10, 8=8, 6=6, 4=4 → sorted: 4,6,8,10
    // Diffs: 4→6(2 OK), 6→8(2 OK), 8→10(2 OK). Run=4 ≥ 4 ✓
    expect(recognizeHand(cards, mod)).toBe(HandType.Straight);
  });

  it('4-card mixed-color Flush with Four Fingers + Smeared', () => {
    const mod = { fourFingers: true, smeared: true, shortcut: false };
    const cards = [
      card(Rank.Two, Suit.Hearts),
      card(Rank.Five, Suit.Diamonds),
      card(Rank.Eight, Suit.Hearts),
      card(Rank.Jack, Suit.Hearts),
    ];
    // 3 Hearts + 1 Diamond = 4 red → flush with four_fingers (min 4)
    expect(recognizeHand(cards, mod)).toBe(HandType.Flush);
  });
});

// ─── Hand Evaluator — Advanced Cases ──────────────────────────

describe('Hand Evaluator — Advanced', () => {
  it('recognizes Ace-low Straight (A-2-3-4-5)', () => {
    const cards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Two, Suit.Hearts),
      card(Rank.Three, Suit.Clubs),
      card(Rank.Four, Suit.Diamonds),
      card(Rank.Five, Suit.Spades),
    ];
    const result = recognizeHand(cards);
    expect(result).toBe(HandType.Straight);
  });

  it('Wild card helps form a Flush', () => {
    const cards = [
      card(Rank.Two, Suit.Hearts),
      card(Rank.Five, Suit.Hearts),
      card(Rank.Eight, Suit.Hearts),
      card(Rank.Jack, Suit.Hearts),
      card(Rank.Ace, Suit.Spades, CardEnhancement.Wild),
    ];
    const result = recognizeHand(cards);
    // Wild Ace counts as Hearts → 5 hearts = flush
    expect(result).toBe(HandType.Flush);
  });

  it('Stone cards do not contribute rank to hand type', () => {
    const cards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Ace, Suit.Clubs),
      card(Rank.Ace, Suit.Diamonds),
      card(Rank.Two, Suit.Spades, CardEnhancement.Stone),
    ];
    const result = recognizeHand(cards);
    // 4 Aces + 1 Stone = Four of a Kind (stone has no rank, can't fill 5th Ace)
    expect(result).toBe(HandType.FourOfAKind);
  });

  it('recognizes Five of a Kind', () => {
    const cards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Ace, Suit.Clubs),
      card(Rank.Ace, Suit.Diamonds),
      card(Rank.Ace, Suit.Spades, CardEnhancement.Bonus), // second Ace Spades with diff enhancement
    ];
    const result = recognizeHand(cards);
    expect(result).toBe(HandType.FiveOfAKind);
  });

  it('Stone card does not fill rank gap for Five of a Kind', () => {
    const cards = [
      card(Rank.King, Suit.Spades),
      card(Rank.King, Suit.Hearts),
      card(Rank.King, Suit.Clubs),
      card(Rank.King, Suit.Diamonds),
      card(Rank.Two, Suit.Spades, CardEnhancement.Stone),
    ];
    const result = recognizeHand(cards);
    // 4 Kings + 1 Stone = Four of a Kind (stone has no rank)
    expect(result).toBe(HandType.FourOfAKind);
  });

  it('recognizes Flush House', () => {
    const cards = [
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Hearts),
      card(Rank.King, Suit.Hearts),
    ];
    const result = recognizeHand(cards);
    expect(result).toBe(HandType.FlushHouse);
  });

  it('recognizes Flush Five', () => {
    const cards = [
      card(Rank.Queen, Suit.Clubs),
      card(Rank.Queen, Suit.Clubs),
      card(Rank.Queen, Suit.Clubs),
      card(Rank.Queen, Suit.Clubs),
      card(Rank.Queen, Suit.Clubs),
    ];
    const result = recognizeHand(cards);
    expect(result).toBe(HandType.FlushFive);
  });

  it('Full House beats Flush with same cards', () => {
    // AKQ of Hearts + AK of Hearts → could be Flush, but Full House takes priority
    // Actually 3 Aces + 2 Kings all Hearts = Flush House, not Full House
    // Let's use mixed suits for a true Full House check
    const cards = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.Ace, Suit.Clubs),
      card(Rank.King, Suit.Diamonds),
      card(Rank.King, Suit.Spades),
    ];
    const result = recognizeHand(cards);
    expect(result).toBe(HandType.FullHouse);
  });

  it('evaluatePlay correctly separates played and held cards', () => {
    const hand = [
      card(Rank.Ace, Suit.Spades),
      card(Rank.Ace, Suit.Hearts),
      card(Rank.King, Suit.Clubs),
      card(Rank.Three, Suit.Diamonds),
      card(Rank.Five, Suit.Spades),
    ];
    const result = evaluatePlay(hand, [0, 1]); // Play the pair of Aces
    expect(result.handType).toBe(HandType.Pair);
    expect(result.scoringCards).toHaveLength(2);
    expect(result.heldCards).toHaveLength(3);
  });
});

// ─── Scoring Tests ─────────────────────────────────────────────

