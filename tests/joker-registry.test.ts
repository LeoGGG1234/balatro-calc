import { describe, it, expect } from 'vitest';
import { JokerCategory, JokerRarity } from '../src/engine/types';
import { registerJoker, getJoker, getAllJokers, getJokersByCategory } from '../src/engine/joker-effects';
import { getJokerModifiers, getJokerRoundModifiers, resolveJokerState, getJokerCategoryLabel, getRarityLabel, searchJokers } from '../src/engine/joker-data';

describe('Joker Registry', () => {
  it('getJoker returns a known joker', () => {
    const joker = getJoker('joker');
    expect(joker).toBeDefined();
    expect(joker!.id).toBe('joker');
    expect(joker!.name).toBe('Joker');
    expect(joker!.category).toBe(JokerCategory.PlusMult);
  });

  it('getJoker returns undefined for unknown id', () => {
    expect(getJoker('nonexistent_joker_12345')).toBeUndefined();
  });

  it('getAllJokers returns all jokers', () => {
    const all = getAllJokers();
    expect(all.length).toBeGreaterThanOrEqual(144);
  });

  it('getJokersByCategory filters correctly', () => {
    const plusMultJokers = getJokersByCategory(JokerCategory.PlusMult);
    const xMultJokers = getJokersByCategory(JokerCategory.XMult);
    const chipsJokers = getJokersByCategory(JokerCategory.Chips);

    expect(plusMultJokers.length).toBeGreaterThan(0);
    expect(xMultJokers.length).toBeGreaterThan(0);
    expect(chipsJokers.length).toBeGreaterThan(0);

    // All jokers in plusMult should have PlusMult category
    for (const j of plusMultJokers) {
      expect(j.category).toBe(JokerCategory.PlusMult);
    }
  });

  it('getAllJokers has no duplicate IDs', () => {
    const all = getAllJokers();
    const ids = all.map(j => j.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ─── Joker Data Utilities Tests ────────────────────────────────

describe('Joker Data Utilities', () => {
  it('resolveJokerState returns override when provided', () => {
    const value = resolveJokerState('ride_the_bus', 0, { 0: 42 });
    expect(value).toBe(42);
  });

  it('resolveJokerState returns default when no override', () => {
    const value = resolveJokerState('ride_the_bus', 0, {});
    expect(value).toBe(1); // ride_the_bus default
  });

  it('resolveJokerState returns 0 for unknown joker', () => {
    const value = resolveJokerState('unknown_joker', 0, {});
    expect(value).toBe(0);
  });

  it('getJokerCategoryLabel returns correct labels', () => {
    expect(getJokerCategoryLabel(JokerCategory.Chips)).toBe('+Chips');
    expect(getJokerCategoryLabel(JokerCategory.PlusMult)).toBe('+Mult');
    expect(getJokerCategoryLabel(JokerCategory.XMult)).toBe('×Mult');
    expect(getJokerCategoryLabel(JokerCategory.Retrigger)).toBe('Retrigger');
    expect(getJokerCategoryLabel(JokerCategory.Effect)).toBe('Effect');
    expect(getJokerCategoryLabel(JokerCategory.Economy)).toBe('Economy');
  });

  it('getRarityLabel returns correct labels', () => {
    expect(getRarityLabel(JokerRarity.Common)).toBe('Common');
    expect(getRarityLabel(JokerRarity.Uncommon)).toBe('Uncommon');
    expect(getRarityLabel(JokerRarity.Rare)).toBe('Rare');
    expect(getRarityLabel(JokerRarity.Legendary)).toBe('Legendary');
  });

  it('searchJokers finds jokers by name substring', () => {
    const results = searchJokers('Joker');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(j => j.id === 'joker')).toBe(true);
  });

  it('searchJokers finds jokers by ID substring', () => {
    const results = searchJokers('blueprint');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('blueprint');
  });

  it('searchJokers is case-insensitive', () => {
    const lower = searchJokers('joker');
    const upper = searchJokers('JOKER');
    expect(lower.length).toBe(upper.length);
  });
});

// ─── Joker Modifiers Tests ──────────────────────────────────────

describe('getJokerModifiers', () => {
  it('returns all false for empty jokers', () => {
    const mods = getJokerModifiers([]);
    expect(mods).toEqual({
      fourFingers: false,
      smeared: false,
      shortcut: false,
      allCardsFace: false,
    });
  });

  it('detects pareidolia', () => {
    const mods = getJokerModifiers([{ id: 'pareidolia', edition: 'none' }]);
    expect(mods.allCardsFace).toBe(true);
    expect(mods.fourFingers).toBe(false);
  });

  it('detects multiple modifiers', () => {
    const mods = getJokerModifiers([
      { id: 'pareidolia', edition: 'none' },
      { id: 'four_fingers', edition: 'none' },
    ]);
    expect(mods.allCardsFace).toBe(true);
    expect(mods.fourFingers).toBe(true);
  });
});

// ─── Joker Round Modifiers Tests ────────────────────────────────

describe('getJokerRoundModifiers', () => {
  it('returns zeros for empty jokers', () => {
    const rm = getJokerRoundModifiers([]);
    expect(rm).toEqual({ handSizeBonus: 0, maxHandsBonus: 0, maxDiscardsBonus: 0 });
  });

  it('Juggler gives +1 hand size', () => {
    const rm = getJokerRoundModifiers([{ id: 'juggler', edition: 'none' }]);
    expect(rm.handSizeBonus).toBe(1);
    expect(rm.maxHandsBonus).toBe(0);
    expect(rm.maxDiscardsBonus).toBe(0);
  });

  it('Turtle Bean gives +5 hand size', () => {
    const rm = getJokerRoundModifiers([{ id: 'turtle_bean', edition: 'none' }]);
    expect(rm.handSizeBonus).toBe(5);
  });

  it('Troubadour gives +2 hand size, -1 max hands', () => {
    const rm = getJokerRoundModifiers([{ id: 'troubadour', edition: 'none' }]);
    expect(rm.handSizeBonus).toBe(2);
    expect(rm.maxHandsBonus).toBe(-1);
  });

  it('Merry Andy gives -1 hand size, +3 discards', () => {
    const rm = getJokerRoundModifiers([{ id: 'merry_andy', edition: 'none' }]);
    expect(rm.handSizeBonus).toBe(-1);
    expect(rm.maxDiscardsBonus).toBe(3);
  });

  it('Stuntman gives -2 hand size', () => {
    const rm = getJokerRoundModifiers([{ id: 'stuntman', edition: 'none' }]);
    expect(rm.handSizeBonus).toBe(-2);
  });

  it('Drunkard gives +1 discard', () => {
    const rm = getJokerRoundModifiers([{ id: 'drunkard', edition: 'none' }]);
    expect(rm.maxDiscardsBonus).toBe(1);
  });

  it('combined jokers sum correctly', () => {
    const rm = getJokerRoundModifiers([
      { id: 'juggler', edition: 'none' },
      { id: 'drunkard', edition: 'none' },
      { id: 'stuntman', edition: 'none' },
    ]);
    // +1 (juggler) -2 (stuntman) = -1 hand size
    expect(rm.handSizeBonus).toBe(-1);
    // +1 (drunkard) = +1 discard
    expect(rm.maxDiscardsBonus).toBe(1);
  });
});

// ─── Pareidolia Scoring Tests ───────────────────────────────────

