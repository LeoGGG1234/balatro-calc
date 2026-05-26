import { describe, it, expect } from 'vitest';
import { isFaceCard, isNumberCard, rankToChips, isStone, Rank, Suit, CardEnhancement } from '../src/engine/types';
import { card } from './helpers';

describe('Type Utilities', () => {
  it('isFaceCard returns true for J, Q, K', () => {
    expect(isFaceCard(Rank.Jack)).toBe(true);
    expect(isFaceCard(Rank.Queen)).toBe(true);
    expect(isFaceCard(Rank.King)).toBe(true);
  });

  it('isFaceCard returns false for numbers and Ace', () => {
    expect(isFaceCard(Rank.Two)).toBe(false);
    expect(isFaceCard(Rank.Ten)).toBe(false);
    expect(isFaceCard(Rank.Ace)).toBe(false);
  });

  it('isNumberCard returns true for 2-10', () => {
    expect(isNumberCard(Rank.Two)).toBe(true);
    expect(isNumberCard(Rank.Five)).toBe(true);
    expect(isNumberCard(Rank.Ten)).toBe(true);
  });

  it('isNumberCard returns false for J, Q, K, A', () => {
    expect(isNumberCard(Rank.Jack)).toBe(false);
    expect(isNumberCard(Rank.Queen)).toBe(false);
    expect(isNumberCard(Rank.King)).toBe(false);
    expect(isNumberCard(Rank.Ace)).toBe(false);
  });

  it('rankToChips returns correct values', () => {
    expect(rankToChips(Rank.Two)).toBe(2);
    expect(rankToChips(Rank.Ten)).toBe(10);
    expect(rankToChips(Rank.Jack)).toBe(10);
    expect(rankToChips(Rank.Queen)).toBe(10);
    expect(rankToChips(Rank.King)).toBe(10);
    expect(rankToChips(Rank.Ace)).toBe(11);
  });

  it('isStone detects stone cards', () => {
    const stone = card(Rank.Two, Suit.Spades, CardEnhancement.Stone);
    const normal = card(Rank.Two, Suit.Spades, CardEnhancement.None);
    expect(isStone(stone)).toBe(true);
    expect(isStone(normal)).toBe(false);
  });
});

// ─── Constants Tests ────────────────────────────────────────────

