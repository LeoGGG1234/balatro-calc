import type {
  Card, GameState, JokerInstance,
  PlayCandidate, ScoredPlay, SearchResult, HandRanking,
} from './types';
import { HandType, isStone } from './types';
import { recognizeHand } from './hand-evaluator';
import { getJokerModifiers } from './joker-data';
import type { ScoreOptions } from './scorer';
import { scorePlay } from './scorer';
import {
  generateOptimalJokerOrderings,
} from './joker-order';

// Re-export useful types
export type { ScoreOptions } from './scorer';

// ─── Configuration ──────────────────────────────────────────────

export interface SearchConfig {
  includeJokerOrdering: boolean;
  /** Use smart category-based ordering (fast) vs full brute force (slow but exhaustive) */
  smartOrdering: boolean;
  maxComputationMs: number;
}

const DEFAULT_CONFIG: SearchConfig = {
  includeJokerOrdering: true,
  smartOrdering: true,
  maxComputationMs: 10000,
};

// ─── Card Subset Generation ────────────────────────────────────

function* generateCardSubsets(cards: Card[]): Generator<{ indices: number[]; cards: Card[] }> {
  const n = cards.length;
  // Generate subsets of size 1 through min(5, n)
  const maxSize = Math.min(5, n);

  // For each subset size
  for (let size = 1; size <= maxSize; size++) {
    // Generate all combinations of given size
    const indices = Array.from({ length: size }, (_, i) => i);

    while (true) {
      // Count stone cards in this subset
      const subsetCards = indices.map(i => cards[i]);
      const stoneCount = subsetCards.filter(c => isStone(c)).length;

      // A hand with stone cards: scoring cards + stones = total
      // Stones don't count as "cards" for hand type, they're filler
      const scoringCount = size - stoneCount;

      // Most hands need at least 1 scoring card
      if (scoringCount > 0 || size === 5) {
        // Stone-only subsets still count (all stones = high card with 250 chips?)
        // Actually no — stone cards each give 50 chips, and they'd form a hand
        // For practical purposes, always include the subset
        yield { indices: [...indices], cards: subsetCards };
      }

      // Generate next combination
      let i = size - 1;
      while (i >= 0 && indices[i] === n - size + i) {
        i--;
      }
      if (i < 0) break;

      indices[i]++;
      for (let j = i + 1; j < size; j++) {
        indices[j] = indices[j - 1] + 1;
      }
    }
  }
}

// ─── Joker Permutation Generation ────────────────────────────────

function* generateJokerPermutations(jokers: JokerInstance[]): Generator<number[]> {
  const n = jokers.length;
  if (n === 0) {
    yield [];
    return;
  }
  if (n === 1) {
    yield [0];
    return;
  }

  // Generate all permutations using Heap's algorithm
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

// ─── Smart Joker Ordering ──────────────────────────────────────

function generateJokerOrderings(jokers: JokerInstance[], smart: boolean): number[][] {
  if (smart) {
    return generateOptimalJokerOrderings(jokers);
  }
  // Full brute force fallback
  return Array.from(generateJokerPermutations(jokers));
}

// ─── Main Search Function ──────────────────────────────────────

export function findOptimalPlays(
  state: GameState,
  config: Partial<SearchConfig> = {},
  options: ScoreOptions = {}
): SearchResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = performance.now();

  const jokerModifiers = getJokerModifiers(state.jokers);

  // Pre-generate joker orderings (same for all subsets)
  const jokerOrderings = cfg.includeJokerOrdering
    ? generateJokerOrderings(state.jokers, cfg.smartOrdering)
    : [state.jokers.map((_, i) => i)];

  const candidates: PlayCandidate[] = [];

  // Step 1 & 2: Generate all card subsets × joker orderings
  for (const subset of generateCardSubsets(state.handCards)) {
    const playedCards = subset.cards;
    const heldCards = state.handCards.filter((_, i) => !subset.indices.includes(i));

    // Determine hand type (with joker modifiers for four_fingers/smeared/shortcut)
    const handType = recognizeHand(playedCards, jokerModifiers);

    // Boss effect: The Eye — skip forbidden hand types
    if (state.blind.forbiddenHandTypes?.includes(handType)) continue;

    // Boss effect: The Mouth — only allow the forced hand type
    if (state.blind.forcedHandType && handType !== state.blind.forcedHandType) continue;

    // Boss effect: The Psychic — must play exactly 5 cards (non-stone)
    if (state.blind.mustPlayFiveCards) {
      const nonStoneCount = playedCards.filter(c => !isStone(c)).length;
      if (nonStoneCount !== 5) continue;
    }

    // Boss effect: Cerulean Bell — must include the forced card
    if (state.blind.forcedCardId && !playedCards.some(c => c.id === state.blind.forcedCardId)) {
      continue;
    }

    for (const jokerOrder of jokerOrderings) {
      candidates.push({
        playedCards,
        heldCards,
        handType,
        jokerOrder,
      });
    }
  }

  // Step 3: Score each candidate
  const scoredPlays: ScoredPlay[] = [];
  let evaluated = 0;

  for (const candidate of candidates) {
    // Early termination check
    if (performance.now() - startTime > cfg.maxComputationMs) break;

    const breakdown = scorePlay(state, candidate, { ...options, jokerModifiers });
    evaluated++;

    scoredPlays.push({
      playedCards: candidate.playedCards,
      heldCards: candidate.heldCards,
      handType: candidate.handType,
      jokerOrder: candidate.jokerOrder,
      totalScore: breakdown.finalScore,
      breakdown,
    });
  }

  // Step 4: Sort by score descending
  scoredPlays.sort((a, b) => b.totalScore - a.totalScore);

  // Step 5: Aggregate by hand type
  const handRankings = aggregateByHandType(scoredPlays);

  return {
    optimalPlay: scoredPlays[0],
    allPlays: scoredPlays,
    rankedHands: handRankings,
    evaluationTimeMs: performance.now() - startTime,
    combinationsEvaluated: evaluated,
    orderingsEvaluated: jokerOrderings.length,
  };
}

// ─── Hand Type Aggregation ──────────────────────────────────────

function aggregateByHandType(scoredPlays: ScoredPlay[]): HandRanking[] {
  const map = new Map<HandType, { bestScore: number; count: number }>();

  for (const play of scoredPlays) {
    const existing = map.get(play.handType);
    if (!existing) {
      map.set(play.handType, { bestScore: play.totalScore, count: 1 });
    } else {
      if (play.totalScore > existing.bestScore) {
        existing.bestScore = play.totalScore;
      }
      existing.count++;
    }
  }

  const rankings: HandRanking[] = [];
  for (const [handType, data] of map) {
    rankings.push({ handType, bestScore: data.bestScore, count: data.count });
  }
  rankings.sort((a, b) => b.bestScore - a.bestScore);

  return rankings;
}

// ─── Sync Search (for tests/direct use) ─────────────────────────

export function findOptimalPlay(
  state: GameState,
  config?: Partial<SearchConfig>,
  options?: ScoreOptions
): ScoredPlay | null {
  const result = findOptimalPlays(state, config, options);
  return result.optimalPlay ?? null;
}

// ─── Search Result Formatting ──────────────────────────────────

export function formatScore(score: number): string {
  if (score < 1000) return score.toString();
  if (score < 1_000_000) return (score / 1000).toFixed(1) + 'K';
  if (score < 1_000_000_000) return (score / 1_000_000).toFixed(1) + 'M';
  if (score < 1_000_000_000_000) return (score / 1_000_000_000).toFixed(1) + 'B';
  // Scientific notation for very large scores
  const exp = Math.floor(Math.log10(score));
  const mantissa = score / Math.pow(10, exp);
  return mantissa.toFixed(2) + 'e' + exp;
}

