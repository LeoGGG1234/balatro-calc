import { describe, it, expect } from 'vitest';
import { HandType } from '../src/engine/types';
import { getHandBaseChips, getHandBaseMult, getDefaultHandLevels, getBlindBaseChips } from '../src/engine/constants';

describe('Constants', () => {
  it('getHandBaseChips returns base chips for level 1', () => {
    expect(getHandBaseChips(HandType.HighCard, 1)).toBe(5);
    expect(getHandBaseChips(HandType.Pair, 1)).toBe(10);
    expect(getHandBaseChips(HandType.Flush, 1)).toBe(35);
    expect(getHandBaseChips(HandType.FlushFive, 1)).toBe(160);
  });

  it('getHandBaseChips scales with level', () => {
    expect(getHandBaseChips(HandType.Flush, 1)).toBe(35);
    expect(getHandBaseChips(HandType.Flush, 2)).toBe(50);  // +15 per level
    expect(getHandBaseChips(HandType.Flush, 3)).toBe(65);
  });

  it('getHandBaseMult returns base mult for level 1', () => {
    expect(getHandBaseMult(HandType.HighCard, 1)).toBe(1);
    expect(getHandBaseMult(HandType.Pair, 1)).toBe(2);
    expect(getHandBaseMult(HandType.FlushFive, 1)).toBe(16);
  });

  it('getHandBaseMult scales with level', () => {
    expect(getHandBaseMult(HandType.Pair, 1)).toBe(2);
    expect(getHandBaseMult(HandType.Pair, 2)).toBe(3);  // +1 per level
    expect(getHandBaseMult(HandType.Pair, 3)).toBe(4);
  });

  it('getDefaultHandLevels returns level 1 for all hands', () => {
    const levels = getDefaultHandLevels();
    for (const ht of Object.values(HandType)) {
      expect(levels[ht]).toBe(1);
    }
  });

  it('getBlindBaseChips scales with ante', () => {
    const ante1Small = getBlindBaseChips(1, 'small');
    const ante2Small = getBlindBaseChips(2, 'small');
    expect(ante2Small).toBeGreaterThan(ante1Small);
    expect(ante1Small).toBe(300);
  });

  it('getBlindBaseChips: big > small, boss > big', () => {
    const small = getBlindBaseChips(1, 'small');
    const big = getBlindBaseChips(1, 'big');
    const boss = getBlindBaseChips(1, 'boss');
    expect(big).toBeGreaterThan(small);
    expect(boss).toBeGreaterThan(big);
  });
});

// ─── Card Effects Tests ─────────────────────────────────────────

