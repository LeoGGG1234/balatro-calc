/**
 * Fog-card Expected Value computation engine.
 *
 * When hand cards include fog (unknown) placeholders after an "Apply Discard"
 * in unseeded mode, this engine enumerates possible draw outcomes from the
 * remaining deck and computes the expected optimal-play score.
 */

import type {
  Card, GameState, DeckComposition,
} from './types';
import { HandType, isFogCard, ALL_RANKS, ALL_SUITS, ALL_HAND_TYPES, CardEnhancement, CardEdition, Seal } from './types';
import { findOptimalPlays, type SearchConfig } from './search';
import type { ScoreOptions } from './scorer';

// ─── Types ──────────────────────────────────────────────────────

export interface FogCardEVResult {
  /** Expected value of the optimal play score */
  expectedScore: number;
  /** Median score */
  medianScore: number;
  /** Minimum score among samples */
  minScore: number;
  /** Maximum score among samples */
  maxScore: number;
  /** Probability distribution over hand types */
  handProbabilities: Partial<Record<HandType, number>>;
  /** Number of draw combinations evaluated */
  samplesEvaluated: number;
  /** Whether the result used exact enumeration (true) or Monte Carlo sampling (false) */
  exact: boolean;
  /** Evaluation time in ms */
  evaluationTimeMs: number;
}

export interface FogEVConfig {
  /** Maximum number of draw combinations to evaluate before switching to sampling */
  maxExactCombinations: number;
  /** Number of Monte Carlo samples when exact enumeration is too large */
  monteCarloSamples: number;
}

const DEFAULT_CONFIG: FogEVConfig = {
  maxExactCombinations: 500,
  monteCarloSamples: 200,
};

// ─── Main API ───────────────────────────────────────────────────

export function computeFogCardEV(
  state: GameState,
  searchConfig?: Partial<SearchConfig>,
  scoreOptions?: ScoreOptions,
  config?: Partial<FogEVConfig>,
): FogCardEVResult | null {
  const startTime = performance.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const fogIndices: number[] = [];
  const realCards: Card[] = [];

  for (let i = 0; i < state.handCards.length; i++) {
    if (isFogCard(state.handCards[i])) {
      fogIndices.push(i);
    } else {
      realCards.push(state.handCards[i]);
    }
  }

  if (fogIndices.length === 0) return null; // No fog cards

  const fogCount = fogIndices.length;
  const deck = state.deckComposition;

  // Build the pool of available cards from deck
  const pool = buildAvailableCardPool(deck);
  if (pool.length === 0) return null;

  // Enumerate or sample draw combinations
  const totalCombos = binomial(pool.length, fogCount);
  const useExact = totalCombos <= cfg.maxExactCombinations && totalCombos > 0;

  const drawCombos: Card[][] = useExact
    ? enumerateDraws(pool, fogCount)
    : sampleDraws(pool, fogCount, cfg.monteCarloSamples);

  if (drawCombos.length === 0) return null;

  // Score each draw combination
  const scores: number[] = [];
  const handTypeCounts: Partial<Record<HandType, number>> = {};

  for (const drawnCards of drawCombos) {
    // Build resolved hand: real cards + drawn cards in fog positions
    const resolvedHand = buildResolvedHand(state.handCards, fogIndices, drawnCards);

    const testState: GameState = {
      ...state,
      handCards: resolvedHand,
    };

    const result = findOptimalPlays(testState, searchConfig, scoreOptions);
    const score = result.optimalPlay?.totalScore ?? 0;
    scores.push(score);

    const handType = result.optimalPlay?.handType ?? HandType.HighCard;
    handTypeCounts[handType] = (handTypeCounts[handType] ?? 0) + 1;
  }

  // Compute statistics
  scores.sort((a, b) => a - b);
  const minScore = scores[0] ?? 0;
  const maxScore = scores[scores.length - 1] ?? 0;
  const medianScore = scores[Math.floor(scores.length / 2)] ?? 0;
  const expectedScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Hand type probabilities
  const handProbabilities: Partial<Record<HandType, number>> = {};
  const total = drawCombos.length;
  for (const ht of ALL_HAND_TYPES) {
    const count = handTypeCounts[ht] ?? 0;
    if (count > 0) handProbabilities[ht] = count / total;
  }

  return {
    expectedScore,
    medianScore,
    minScore,
    maxScore,
    handProbabilities,
    samplesEvaluated: drawCombos.length,
    exact: useExact,
    evaluationTimeMs: performance.now() - startTime,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i;
  }
  return result;
}

function buildAvailableCardPool(deck: DeckComposition): Card[] {
  const pool: Card[] = [];
  let idCounter = 0;

  if (deck.cards && deck.cards.length > 0) {
    for (const slot of deck.cards) {
      pool.push({
        id: `pool_${idCounter++}`,
        rank: slot.rank,
        suit: slot.suit,
        enhancement: slot.enhancement,
        edition: slot.edition,
        seal: slot.seal,
        debuffed: false,
      });
    }
    return pool;
  }

  // Fallback: build pool from aggregate counts with proportional modifier distribution
  const remainingByRank = deck.remainingByRank;
  const remainingBySuit = deck.remainingBySuit;
  const enhCounts = deck.enhancementCounts;
  const edCounts = deck.editionCounts;
  const sealCounts = deck.sealCounts;

  for (const rank of ALL_RANKS) {
    for (const suit of ALL_SUITS) {
      const rankCount = remainingByRank[rank] ?? 0;
      const suitCount = remainingBySuit[suit] ?? 0;
      if (rankCount > 0 && suitCount > 0) {
        pool.push({
          id: `pool_${idCounter++}`,
          rank,
          suit,
          enhancement: CardEnhancement.None,
          edition: CardEdition.None,
          seal: Seal.None,
          debuffed: false,
        });
      }
    }
  }

  // Distribute modifiers proportionally from aggregate counts
  if (pool.length > 0) {
    poolModifiers(pool, enhCounts, edCounts, sealCounts);
  }

  return pool;
}

/**
 * Assign enhancement/edition/seal modifiers to pool cards proportionally,
 * so held-in-hand jokers like Baron/Mime see accurate modifier distributions.
 * Rounds counts down to fit pool size without over-assignment.
 */
function poolModifiers(
  pool: Card[],
  enhCounts?: Partial<Record<string, number>>,
  edCounts?: Partial<Record<string, number>>,
  sealCounts?: Partial<Record<string, number>>,
): void {
  const n = pool.length;

  // Sort cards randomly so modifier assignment isn't positional
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  let cursor = 0;

  // Assign enhancements (excluding 'none')
  if (enhCounts) {
    for (const [enhStr, count] of Object.entries(enhCounts)) {
      const enh = enhStr as CardEnhancement;
      if (enh === CardEnhancement.None || count == null) continue;
      const assigned = Math.min(Math.round(count), n);
      for (let i = 0; i < assigned && cursor < n; i++) {
        pool[cursor]!.enhancement = enh;
        cursor++;
      }
    }
  }

  cursor = 0;
  // Assign editions (excluding 'none')
  if (edCounts) {
    for (const [edStr, count] of Object.entries(edCounts)) {
      const ed = edStr as CardEdition;
      if (ed === CardEdition.None || count == null) continue;
      const assigned = Math.min(Math.round(count), n);
      for (let i = 0; i < assigned && cursor < n; i++) {
        pool[cursor]!.edition = ed;
        cursor++;
      }
    }
  }

  cursor = 0;
  // Assign seals (excluding 'none')
  if (sealCounts) {
    for (const [sealStr, count] of Object.entries(sealCounts)) {
      const s = sealStr as Seal;
      if (s === Seal.None || count == null) continue;
      const assigned = Math.min(Math.round(count), n);
      for (let i = 0; i < assigned && cursor < n; i++) {
        pool[cursor]!.seal = s;
        cursor++;
      }
    }
  }
}

function enumerateDraws(pool: Card[], count: number): Card[][] {
  const result: Card[][] = [];

  function recurse(start: number, depth: number, current: number[]) {
    if (depth === count) {
      result.push(current.map(i => ({ ...pool[i] })));
      return;
    }
    const remaining = count - depth - 1;
    for (let i = start; i <= pool.length - remaining - 1; i++) {
      current.push(i);
      recurse(i + 1, depth + 1, current);
      current.pop();
    }
  }

  recurse(0, 0, []);
  return result;
}

function sampleDraws(pool: Card[], count: number, numSamples: number): Card[][] {
  const result: Card[][] = [];
  const usedKeys = new Set<string>();

  for (let s = 0; s < numSamples; s++) {
    const shuffled = [...pool];
    // Fisher-Yates shuffle (partial — only need first `count` elements)
    for (let i = shuffled.length - 1; i >= shuffled.length - count; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const draw = shuffled.slice(shuffled.length - count);
    const key = draw.map(c => c.id).sort().join(',');
    if (usedKeys.has(key)) continue; // Avoid duplicates
    usedKeys.add(key);
    result.push(draw.map(c => ({ ...c })));
  }

  return result;
}

function buildResolvedHand(
  originalHand: Card[],
  fogIndices: number[],
  drawnCards: Card[],
): Card[] {
  const result = [...originalHand];
  for (let i = 0; i < fogIndices.length; i++) {
    result[fogIndices[i]] = { ...drawnCards[i], id: `drawn_${i}` };
  }
  return result;
}
