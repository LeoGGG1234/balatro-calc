import { describe, it, expect } from 'vitest';
import { Rank, Suit, CardEnhancement, CardEdition, Seal } from '../src/engine/types';
import { getCardBaseChips, applyEnhancementOnScored, applyEnhancementHeld, getSealRetriggers, scoreCardTrigger } from '../src/engine/card-effects';
import { card } from './helpers';

describe('Card Effects', () => {
  it('getCardBaseChips returns rank chips for normal cards', () => {
    expect(getCardBaseChips(card(Rank.Ace, Suit.Spades))).toBe(11);
    expect(getCardBaseChips(card(Rank.Five, Suit.Hearts))).toBe(5);
    expect(getCardBaseChips(card(Rank.Ten, Suit.Clubs))).toBe(10);
  });

  it('getCardBaseChips returns 50 for stone cards', () => {
    const stone = card(Rank.Two, Suit.Spades, CardEnhancement.Stone);
    expect(getCardBaseChips(stone)).toBe(50);
  });

  it('applyEnhancementOnScored — Bonus adds 30 chips', () => {
    const acc = { chips: 0, mult: 1 };
    applyEnhancementOnScored(
      card(Rank.Ace, Suit.Spades, CardEnhancement.Bonus), acc, false
    );
    expect(acc.chips).toBe(30);
    expect(acc.mult).toBe(1);
  });

  it('applyEnhancementOnScored — Mult adds 4 mult', () => {
    const acc = { chips: 0, mult: 1 };
    applyEnhancementOnScored(
      card(Rank.Ace, Suit.Spades, CardEnhancement.Mult), acc, false
    );
    expect(acc.chips).toBe(0);
    expect(acc.mult).toBe(5);
  });

  it('applyEnhancementOnScored — Glass multiplies mult by 2', () => {
    const acc = { chips: 0, mult: 3 };
    applyEnhancementOnScored(
      card(Rank.Ace, Suit.Spades, CardEnhancement.Glass), acc, false
    );
    expect(acc.mult).toBe(6);
  });

  it('applyEnhancementOnScored — Lucky adds 20 mult', () => {
    const acc = { chips: 0, mult: 1 };
    applyEnhancementOnScored(
      card(Rank.Ace, Suit.Spades, CardEnhancement.Lucky), acc, false
    );
    expect(acc.mult).toBe(21);
  });

  it('applyEnhancementHeld — Steel multiplies mult by 1.5', () => {
    const acc = { chips: 0, mult: 2 };
    applyEnhancementHeld(
      card(Rank.King, Suit.Hearts, CardEnhancement.Steel), acc
    );
    expect(acc.mult).toBe(3); // 2 * 1.5
  });

  it('getSealRetriggers returns 1 for red seal, 0 otherwise', () => {
    expect(getSealRetriggers(Seal.Red)).toBe(1);
    expect(getSealRetriggers(Seal.None)).toBe(0);
    expect(getSealRetriggers(Seal.Blue)).toBe(0);
  });

  it('scoreCardTrigger adds base chips and enhancement', () => {
    const acc = { chips: 0, mult: 1 };
    scoreCardTrigger(
      card(Rank.King, Suit.Spades, CardEnhancement.Bonus), acc, false
    );
    // King = 10 chips + Bonus = 30 → 40 chips
    expect(acc.chips).toBe(40);
    expect(acc.mult).toBe(1);
  });
});

// ─── Hand Evaluator Tests ──────────────────────────────────────

