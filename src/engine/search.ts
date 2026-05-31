import type {
  Card, GameState, JokerInstance,
  PlayCandidate, ScoredPlay, SearchResult, HandRanking,
} from './types';
import { HandType } from './types';
import { recognizeHand } from './hand-evaluator';
import { getJokerModifiers } from './joker-data';
import { getJoker } from './joker-effects';
import type { ScoreOptions } from './scorer';
import { scorePlay } from './scorer';
import {
  generateOptimalJokerOrderings, generateAllPermutations,
} from './joker-order';
import { combinations } from './combo-utils';

// Re-export useful types
export type { ScoreOptions } from './scorer';

// ─── Configuration ──────────────────────────────────────────────

export interface SearchConfig {
  includeJokerOrdering: boolean;
  /** Use smart category-based ordering (fast) vs full brute force (slow but exhaustive) */
  smartOrdering: boolean;
  maxComputationMs: number;
  /** Progress callback for worker — fires every ~16ms with (evaluated, total) */
  onProgress?: (evaluated: number, total: number) => void;
}

const DEFAULT_CONFIG: SearchConfig = {
  includeJokerOrdering: true,
  smartOrdering: true,
  maxComputationMs: 10000,
};

// ─── Card Subset Generation ────────────────────────────────────

function* generateCardSubsets(cards: Card[]): Generator<{ indices: number[]; cards: Card[] }> {
  const n = cards.length;
  const maxSize = Math.min(5, n);

  for (let size = 1; size <= maxSize; size++) {
    for (const indices of combinations(n, size)) {
      const subsetCards = indices.map(i => cards[i]);
      yield { indices, cards: subsetCards };
    }
  }
}

// ─── Smart Joker Ordering ──────────────────────────────────────

function generateJokerOrderings(jokers: JokerInstance[], smart: boolean): number[][] {
  if (smart) {
    return generateOptimalJokerOrderings(jokers);
  }
  return Array.from(generateAllPermutations(jokers.length));
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
  let genCount = 0;
  for (const subset of generateCardSubsets(state.handCards)) {
    // Timeout check during generation (every 100 subsets to amortize performance.now() cost)
    if (++genCount % 100 === 0 && performance.now() - startTime > cfg.maxComputationMs) break;

    const playedCards = subset.cards;
    const heldCards = state.handCards.filter((_, i) => !subset.indices.includes(i));

    // Determine hand type (with joker modifiers for four_fingers/smeared/shortcut)
    const handType = recognizeHand(playedCards, jokerModifiers);

    // Boss effect: The Eye — skip forbidden hand types
    if (state.blind.forbiddenHandTypes?.includes(handType)) continue;

    // Boss effect: The Mouth — only allow the forced hand type
    if (state.blind.forcedHandType && handType !== state.blind.forcedHandType) continue;

    // Boss effect: The Psychic — must play exactly 5 cards
    if (state.blind.mustPlayFiveCards && playedCards.length !== 5) continue;

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

  // Pre-build joker definition map so scorePlay doesn't rebuild it per candidate
  const jokerDefs = new Map(state.jokers.map(j => [j.id, getJoker(j.id)] as const));

  // Step 3: Score each candidate
  const scoredPlays: ScoredPlay[] = [];
  let evaluated = 0;
  let lastProgressTime = 0;
  const totalCandidates = candidates.length;

  for (const candidate of candidates) {
    // Early termination check
    if (performance.now() - startTime > cfg.maxComputationMs) break;

    const breakdown = scorePlay(state, candidate, { ...options, jokerModifiers, jokerDefs });
    evaluated++;

    // Progress reporting (~every 16ms to avoid flooding the message channel)
    if (cfg.onProgress) {
      const now = performance.now();
      if (now - lastProgressTime > 16) {
        lastProgressTime = now;
        cfg.onProgress(evaluated, totalCandidates);
      }
    }

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

// ─── Lightweight Best Score (no aggregation/sorting) ─────────────

/**
 * Fast variant of findOptimalPlays that returns only the maximum score.
 * Skips hand-type aggregation and full-result sorting. Useful for
 * Monte Carlo EV estimation where only the top score matters.
 */
export function findBestScore(
  state: GameState,
  config: Partial<SearchConfig> = {},
  options: ScoreOptions = {}
): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = performance.now();

  const jokerModifiers = getJokerModifiers(state.jokers);
  const jokerOrderings = cfg.includeJokerOrdering
    ? generateJokerOrderings(state.jokers, cfg.smartOrdering)
    : [state.jokers.map((_, i) => i)];

  // Pre-build joker definition map once
  const jokerDefs = new Map(state.jokers.map(j => [j.id, getJoker(j.id)] as const));

  let maxScore = 0;
  let genCount = 0;

  for (const subset of generateCardSubsets(state.handCards)) {
    if (++genCount % 100 === 0 && performance.now() - startTime > cfg.maxComputationMs) break;

    const playedCards = subset.cards;
    const handType = recognizeHand(playedCards, jokerModifiers);

    // Boss effect filters
    if (state.blind.forbiddenHandTypes?.includes(handType)) continue;
    if (state.blind.forcedHandType && handType !== state.blind.forcedHandType) continue;
    if (state.blind.mustPlayFiveCards && playedCards.length !== 5) continue;
    if (state.blind.forcedCardId && !playedCards.some(c => c.id === state.blind.forcedCardId)) continue;

    const heldCards = state.handCards.filter((_, i) => !subset.indices.includes(i));

    for (const jokerOrder of jokerOrderings) {
      const breakdown = scorePlay(state, {
        playedCards,
        heldCards,
        handType,
        jokerOrder,
      }, { ...options, jokerModifiers, jokerDefs });

      if (breakdown.finalScore > maxScore) {
        maxScore = breakdown.finalScore;
      }
    }
  }

  return maxScore;
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
  if (!Number.isFinite(score)) return score.toString();
  if (score < 1000) return score.toString();
  if (score < 1_000_000) return (score / 1000).toFixed(1) + 'K';
  if (score < 1_000_000_000) return (score / 1_000_000).toFixed(1) + 'M';
  if (score < 1_000_000_000_000) return (score / 1_000_000_000).toFixed(1) + 'B';
  // Scientific notation for very large scores
  const exp = Math.floor(Math.log10(score));
  const mantissa = score / Math.pow(10, exp);
  return mantissa.toFixed(2) + 'e' + exp;
}

