import type { JokerInstance } from './types';
import { JokerCategory } from './types';
import { getJoker } from './joker-effects';

// ─── Joker Classification ─────────────────────────────────────────

type JokerClass = 'chips' | 'plus_mult' | 'xmult' | 'retrigger' | 'blueprint' | 'brainstorm' | 'other';

interface ClassifiedJoker {
  index: number;
  id: string;
  cls: JokerClass;
  category: JokerCategory;
}

function classifyJokers(jokers: JokerInstance[]): ClassifiedJoker[] {
  return jokers.map((j, i) => {
    const cls = classifyOne(j);
    const def = getJoker(j.id);
    return {
      index: i,
      id: j.id,
      cls,
      category: def?.category ?? JokerCategory.Effect,
    };
  });
}

function classifyOne(joker: JokerInstance): JokerClass {
  if (joker.id === 'blueprint') return 'blueprint';
  if (joker.id === 'brainstorm') return 'brainstorm';
  const def = getJoker(joker.id);
  if (!def) return 'other';
  switch (def.category) {
    case JokerCategory.Chips: return 'chips';
    case JokerCategory.PlusMult: return 'plus_mult';
    case JokerCategory.XMult: return 'xmult';
    case JokerCategory.Retrigger: return 'retrigger';
    default: return 'other';
  }
}

// ─── Smart Ordering Generation ──────────────────────────────────────

/**
 * Generate the optimal joker orderings, using category-based pruning.
 *
 * Constraints:
 * - ×Mult jokers MUST go after +Mult jokers (so +Mult values get multiplied)
 * - Blueprint must be placed left of a copyable joker to be useful
 * - Within +Chips, +Mult: order doesn't matter (addition is commutative)
 * - Within ×Mult: order doesn't matter (multiplication is associative)
 *
 * Returns an array of index permutations (each is number[]).
 */
export function generateOptimalJokerOrderings(jokers: JokerInstance[]): number[][] {
  if (jokers.length <= 1) {
    return jokers.length === 0 ? [[]] : [[0]];
  }

  const classified = classifyJokers(jokers);

  // Special handling when Blueprint or Brainstorm is present:
  // these jokers benefit from position changes since they copy neighbors.
  const hasBlueprint = classified.some(c => c.cls === 'blueprint');
  const hasBrainstorm = classified.some(c => c.cls === 'brainstorm');

  if (!hasBlueprint && !hasBrainstorm) {
    // Simple case: canonical order is optimal
    return [canonicalOrder(classified)];
  }

  // When Blueprint/Brainstorm are present, generate meaningful permutations
  return generateEffectPermutations(classified);
}

/**
 * Build the canonical (optimal default) order:
 * chips → plus_mult → xmult → retrigger → other (left to right)
 *
 * Retriggers go last so that card re-triggers benefit from
 * all chips/+mult/×mult accumulated up to that point.
 */
function canonicalOrder(classified: ClassifiedJoker[]): number[] {
  const groups = groupByClass(classified);
  const order: number[] = [];

  // Category priority (left to right):
  // chips → +mult → ×mult → retrigger
  // Blueprint/Brainstorm at the end so we don't mess with their positioning
  const priority: JokerClass[] = ['chips', 'plus_mult', 'xmult', 'retrigger', 'brainstorm', 'blueprint', 'other'];

  for (const cls of priority) {
    const group = groups.get(cls);
    if (group) {
      for (const c of group) {
        order.push(c.index);
      }
    }
  }

  return order;
}

function groupByClass(classified: ClassifiedJoker[]): Map<JokerClass, ClassifiedJoker[]> {
  const map = new Map<JokerClass, ClassifiedJoker[]>();
  for (const c of classified) {
    const list = map.get(c.cls);
    if (list) list.push(c);
    else map.set(c.cls, [c]);
  }
  return map;
}

/**
 * Generate permutations when Blueprint/Brainstorm are present.
 *
 * Blueprint copies the joker to its right, so we try placing it
 * to the left of each copyable joker (and also at the far right
 * as a fallback/no-copy position).
 *
 * Brainstorm always copies the leftmost joker, so its position
 * doesn't affect WHAT it copies, but its own edition still applies.
 * We try Brainstorm at various positions.
 */
function generateEffectPermutations(classified: ClassifiedJoker[]): number[][] {
  const results: number[][] = [];

  // Build a base order (canonical without blueprint/brainstorm)
  const nonEffect = classified.filter(
    c => c.cls !== 'blueprint' && c.cls !== 'brainstorm'
  );
  const blueprints = classified.filter(c => c.cls === 'blueprint');
  const brainstorms = classified.filter(c => c.cls === 'brainstorm');

  // Base order for non-effect jokers
  const baseOrder = canonicalOrder(nonEffect);

  if (blueprints.length === 0 && brainstorms.length === 0) {
    return [baseOrder];
  }

  // For a single Blueprint: try placing it at each possible position
  // (to the left of each copyable joker)
  if (blueprints.length === 1 && brainstorms.length === 0) {
    const bpIdx = blueprints[0].index;
    // Place bp at each position, and at the end
    for (let pos = 0; pos <= baseOrder.length; pos++) {
      const order = [...baseOrder];
      order.splice(pos, 0, bpIdx);
      results.push(order);
    }
    return results;
  }

  // For a single Brainstorm: position doesn't affect copy target
  // but could affect other jokers that depend on position
  if (brainstorms.length === 1 && blueprints.length === 0) {
    const bsIdx = brainstorms[0].index;
    // Brainstorm copies leftmost — try it as leftmost and at a few other spots
    for (let pos = 0; pos <= baseOrder.length; pos++) {
      const order = [...baseOrder];
      order.splice(pos, 0, bsIdx);
      results.push(order);
    }
    return results;
  }

  // Multiple Blueprints/Brainstorms: need more permutations
  // Generate all permutations of the effect jokers interleaved into the base
  const effectIndices = [...blueprints, ...brainstorms].map(c => c.index);
  const effectPerms = permute(effectIndices);

  for (const effPerm of effectPerms) {
    // Try placing the effect jokers at various split points in the base order
    for (let split = 0; split <= baseOrder.length; split++) {
      const order = [
        ...baseOrder.slice(0, split),
        ...effPerm,
        ...baseOrder.slice(split),
      ];
      results.push(order);
    }
  }

  return results;
}

/**
 * Generate all permutations of small arrays (n ≤ 4 typically).
 */
function permute(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const result: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permute(rest)) {
      result.push([arr[i], ...p]);
    }
  }
  return result;
}

// ─── Permutation Count Estimation ──────────────────────────────────

/**
 * Estimate how many orderings we'll evaluate. Useful for UI feedback.
 */
export function estimateOrderingCount(jokers: JokerInstance[]): number {
  const classified = classifyJokers(jokers);
  const bpCount = classified.filter(c => c.cls === 'blueprint').length;
  const bsCount = classified.filter(c => c.cls === 'brainstorm').length;
  const nonEffectCount = classified.length - bpCount - bsCount;

  if (bpCount === 0 && bsCount === 0) return 1;

  // Effect joker permutations × insertion positions
  const effectPerms = factorial(bpCount + bsCount);
  const insertionPoints = nonEffectCount + 1;

  return Math.min(effectPerms * insertionPoints, factorial(classified.length));
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// ─── Generate All Permutations (fallback) ──────────────────────────

/**
 * Heap's algorithm — generates all n! permutations.
 * Use as a fallback when smart ordering doesn't apply.
 */
export function* generateAllPermutations(n: number): Generator<number[]> {
  if (n === 0) {
    yield [];
    return;
  }
  if (n === 1) {
    yield [0];
    return;
  }

  const arr = Array.from({ length: n }, (_, i) => i);
  const c = Array(n).fill(0);

  yield [...arr];

  let i = 1;
  while (i < n) {
    if (c[i] < i) {
      if (i % 2 === 0) {
        [arr[0], arr[i]] = [arr[i], arr[0]];
      } else {
        [arr[c[i]], arr[i]] = [arr[i], arr[c[i]]];
      }
      yield [...arr];
      c[i]++;
      i = 1;
    } else {
      c[i] = 0;
      i++;
    }
  }
}
