import { describe, it, expect } from 'vitest';
import { JokerCategory, JokerRarity } from '../src/engine/types';
import { generateOptimalJokerOrderings, estimateOrderingCount, generateAllPermutations } from '../src/engine/joker-order';
import { registerJoker } from '../src/engine/joker-effects';

describe('Joker Order Engine', () => {
  describe('generateAllPermutations', () => {
    it('generates 1 permutation for n=0', () => {
      const perms = Array.from(generateAllPermutations(0));
      expect(perms).toEqual([[]]);
    });

    it('generates 1 permutation for n=1', () => {
      const perms = Array.from(generateAllPermutations(1));
      expect(perms).toEqual([[0]]);
      expect(perms).toHaveLength(1);
    });

    it('generates 2 permutations for n=2', () => {
      const perms = Array.from(generateAllPermutations(2));
      expect(perms).toHaveLength(2);
      expect(perms).toContainEqual([0, 1]);
      expect(perms).toContainEqual([1, 0]);
    });

    it('generates 6 permutations for n=3', () => {
      const perms = Array.from(generateAllPermutations(3));
      expect(perms).toHaveLength(6);
      // All indices 0,1,2 should appear exactly once in each position
      for (const pos of [0, 1, 2]) {
        const seen = new Set(perms.map(p => p[pos]));
        expect(seen.size).toBe(3);
      }
    });
  });

  describe('generateOptimalJokerOrderings', () => {
    it('returns empty for no jokers', () => {
      const result = generateOptimalJokerOrderings([]);
      expect(result).toEqual([[]]);
    });

    it('returns single ordering for one joker', () => {
      const result = generateOptimalJokerOrderings([{ id: 'joker', edition: 'none' }]);
      expect(result).toEqual([[0]]);
    });

    it('returns 1 canonical ordering for jokers without Blueprint/Brainstorm', () => {
      // +Mult joker + ×Mult cavendish — optimal order: +Mult first, ×Mult last
      const result = generateOptimalJokerOrderings([
        { id: 'joker', edition: 'none' },
        { id: 'cavendish', edition: 'none' },
      ]);
      // With smart ordering: canonical order puts +mult (joker) before xmult (cavendish)
      // So [0, 1] is canonical (joker at index 0, cavendish at index 1)
      expect(result.length).toBe(1);
      expect(result[0]).toEqual([0, 1]);
    });

    it('generates multiple orderings when Blueprint is present', () => {
      const result = generateOptimalJokerOrderings([
        { id: 'joker', edition: 'none' },
        { id: 'blueprint', edition: 'none' },
      ]);
      // Blueprint can be positioned at different spots to copy different jokers
      expect(result.length).toBeGreaterThan(1);
      // All orderings should include both joker indices
      for (const ordering of result) {
        expect(ordering.sort()).toEqual([0, 1]);
      }
    });

    it('generates multiple orderings when Brainstorm is present', () => {
      const result = generateOptimalJokerOrderings([
        { id: 'cavendish', edition: 'none' },
        { id: 'brainstorm', edition: 'none' },
      ]);
      expect(result.length).toBeGreaterThan(1);
    });

    it('canonical order puts chips before +mult before ×mult', () => {
      // stuntman=+chips, joker=+mult, cavendish=×mult
      const result = generateOptimalJokerOrderings([
        { id: 'cavendish', edition: 'none' },
        { id: 'stuntman', edition: 'none' },
        { id: 'joker', edition: 'none' },
      ]);
      expect(result.length).toBe(1);
      // Optimal: chips (index 1), then +mult (index 2), then ×mult (index 0)
      // Retriggers go after xmult; none here, so chips→plusMult→xmult
      expect(result[0]).toEqual([1, 2, 0]);
    });

    it('retrigger jokers are placed after xmult in canonical order', () => {
      // hack=retrigger, stuntman=+chips
      const result = generateOptimalJokerOrderings([
        { id: 'stuntman', edition: 'none' },
        { id: 'hack', edition: 'none' },
      ]);
      // Chips (index 0) before retrigger (index 1)
      expect(result.length).toBe(1);
      expect(result[0]).toEqual([0, 1]);
    });

    it('each generated ordering is a valid permutation', () => {
      const n = 5;
      const result = generateOptimalJokerOrderings([
        { id: 'joker', edition: 'none' },
        { id: 'cavendish', edition: 'none' },
        { id: 'stuntman', edition: 'none' },
        { id: 'blueprint', edition: 'none' },
        { id: 'brainstorm', edition: 'none' },
      ]);
      for (const ordering of result) {
        expect(ordering).toHaveLength(n);
        expect(new Set(ordering).size).toBe(n);
        for (const idx of ordering) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(n);
        }
      }
    });
  });

  describe('estimateOrderingCount', () => {
    it('returns 1 for jokers without Blueprint/Brainstorm', () => {
      const count = estimateOrderingCount([
        { id: 'joker', edition: 'none' },
        { id: 'cavendish', edition: 'none' },
      ]);
      expect(count).toBe(1);
    });

    it('returns >1 for jokers with Blueprint', () => {
      const count = estimateOrderingCount([
        { id: 'joker', edition: 'none' },
        { id: 'blueprint', edition: 'none' },
      ]);
      expect(count).toBeGreaterThan(1);
    });

    it('returns sensible bounds for many jokers', () => {
      const count = estimateOrderingCount([
        { id: 'joker', edition: 'none' },
        { id: 'cavendish', edition: 'none' },
        { id: 'stuntman', edition: 'none' },
        { id: 'blueprint', edition: 'none' },
        { id: 'brainstorm', edition: 'none' },
      ]);
      // Should be less than full 5! = 120
      expect(count).toBeLessThanOrEqual(120);
      expect(count).toBeGreaterThan(1);
    });
  });
});

// ─── Discard Analyzer Tests ─────────────────────────────────────

