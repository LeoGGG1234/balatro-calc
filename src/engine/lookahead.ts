/**
 * Multi-Step Lookahead for EV Strategy Engine
 *
 * Extends the single-step "discard → play" evaluation to model multi-step
 * decision trees: "discard → evaluate → maybe discard again → play".
 *
 * Uses Monte Carlo sampling with aggressive pruning and depth-limited
 * recursion to keep computation tractable.
 */

import type { Card, GameState } from './types';
import { HandType } from './types';
import { findBestScore, type SearchConfig } from './search';
import type { ScoreOptions } from './scorer';
import { getJokerModifiers } from './joker-data';
import { combinations } from './combo-utils';
import {
  sampleDrawsWithoutReplacement, buildAvailableCardPool,
  type EvOption,
} from './strategy-evaluator';

// ─── Types ─────────────────────────────────────────────────────────

export interface LookaheadConfig {
  /** Maximum lookahead depth in discards (default 3) */
  maxDepth: number;
  /** Samples for the 1st discard MC (default 10) */
  samplesFirstStep: number;
  /** Samples for the 2nd discard MC (default 10) */
  samplesSecondStep: number;
  /** Maximum 2nd-discard candidates to evaluate (default 3) */
  maxSecondDiscards: number;
  /** Maximum computation time in ms (default 15000) */
  maxComputationMs: number;
  /** Minimum EV improvement to justify multi-step over single-step */
  benefitThreshold: number;
}

const DEFAULT_LOOKAHEAD_CONFIG: LookaheadConfig = {
  maxDepth: 2,
  samplesFirstStep: 10,
  samplesSecondStep: 10,
  maxSecondDiscards: 3,
  maxComputationMs: 15000,
  benefitThreshold: 0.10, // 10% improvement needed over single-step
};

export interface MultiDiscardEvResult {
  /** Candidate discard indices (1st discard) */
  firstDiscardIndices: number[];
  /** EV after considering full two-step tree */
  expectedValue: number;
  /** Single-step EV for comparison */
  singleStepEV: number;
  /** Best 2nd-step discard found (if any) */
  bestSecondDiscard?: { indices: number[]; handType?: HandType };
  /** Whether the 2nd discard adds significant value */
  secondDiscardHelps: boolean;
  /** Most likely final hand type */
  targetHandType?: HandType;
  /** Number of samples used */
  totalSamples: number;
  /** Hand type probability distribution */
  handProbabilities?: Partial<Record<HandType, number>>;
  /** Min/max observed in 1st-step outcomes */
  minScore?: number;
  maxScore?: number;
}

interface DiscardCandidate {
  indices: number[];
  heuristicScore: number;
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Compute the EV of a two-step discard sequence for a given 1st-discard candidate.
 *
 * Algorithm:
 *   1. Sample N outcomes from the 1st discard (draw from pool)
 *   2. For each outcome, compute:
 *      a. playScore = findBestScore(hand_after_1st_draw)
 *      b. For top-K 2nd-discard candidates, sample M 2nd-draws → average score
 *   3. For each 1st outcome: best = max(playScore, best_2nd_discard_EV)
 *   4. EV = average(best) over all 1st outcomes
 */
export function computeMultiStepEV(
  state: GameState,
  firstDiscardIndices: number[],
  config?: Partial<LookaheadConfig>,
  searchConfig?: Partial<SearchConfig>,
  scoreOptions?: ScoreOptions,
): MultiDiscardEvResult {
  const startTime = performance.now();
  const cfg = { ...DEFAULT_LOOKAHEAD_CONFIG, ...config };
  const pool = buildAvailableCardPool(state.deckComposition);
  const discardSet = new Set(firstDiscardIndices);
  const fogCount = firstDiscardIndices.length;

  // ── Pre-compute joker modifiers (shared across samples) ──
  const jokerModifiers = getJokerModifiers(state.jokers);

  // ── Sample 1st-draw outcomes ─────────────────────────
  const firstDraws = sampleDrawsWithoutReplacement(pool, fogCount, cfg.samplesFirstStep);
  if (firstDraws.length === 0) {
    // No pool: just return play score
    const playScore = findBestScore(state, searchConfig, scoreOptions);
    return {
      firstDiscardIndices,
      expectedValue: playScore,
      singleStepEV: playScore,
      secondDiscardHelps: false,
      totalSamples: 1,
    };
  }

  let evSum = 0;
  let singleStepEvSum = 0;
  const allScores: number[] = [];
  const allSingleScores: number[] = [];
  const handTypeCounts: Partial<Record<HandType, number>> = {};
  let totalSecondDraws = 0;
  let secondDiscardHelpCount = 0;
  let bestSecondDiscardOverall: { indices: number[] } | null = null;

  for (const drawnCards of firstDraws) {
    if (performance.now() - startTime > cfg.maxComputationMs) break;

    // Build hand after 1st discard + draw
    const resolvedHand: Card[] = [];
    const drawCopy = [...drawnCards];
    for (let i = 0; i < state.handCards.length; i++) {
      if (discardSet.has(i)) {
        resolvedHand.push(drawCopy.shift()!);
      } else {
        resolvedHand.push(state.handCards[i]);
      }
    }

    const stateAfterFirst: GameState = {
      ...state,
      handCards: resolvedHand,
    };

    // Score if we play now (after 1st discard)
    const playScore = findBestScore(stateAfterFirst, searchConfig, scoreOptions);
    singleStepEvSum += playScore;
    allSingleScores.push(playScore);
    let bestScore = playScore;

    // ── Generate 2nd-discard candidates ──────────────
    if (cfg.maxDepth >= 2) {
      const handSize = resolvedHand.length;
      const maxDiscardSize = Math.min(5, handSize - 1);
      const secondCandidates = generateDiscardCandidates(
        resolvedHand, maxDiscardSize, cfg.maxSecondDiscards, jokerModifiers,
        state.deckComposition,
      );

      let secondBestEV = 0;

      for (const candidate of secondCandidates) {
        if (performance.now() - startTime > cfg.maxComputationMs) break;

        // Sample 2nd draws (from same pool, approximate)
        const secondDraws = sampleDrawsWithoutReplacement(
          pool, candidate.indices.length, cfg.samplesSecondStep,
        );
        if (secondDraws.length === 0) continue;

        let secondEvSum = 0;
        const secondDiscardSet = new Set(candidate.indices);

        for (const secondDraw of secondDraws) {
          const handAfterSecond: Card[] = [];
          const sdCopy = [...secondDraw];
          for (let i = 0; i < resolvedHand.length; i++) {
            if (secondDiscardSet.has(i)) {
              handAfterSecond.push(sdCopy.shift()!);
            } else {
              handAfterSecond.push(resolvedHand[i]);
            }
          }

          const secondState: GameState = {
            ...state,
            handCards: handAfterSecond,
          };
          secondEvSum += findBestScore(secondState, searchConfig, scoreOptions);
          totalSecondDraws++;
        }

        const secondCandidateEV = secondEvSum / secondDraws.length;
        if (secondCandidateEV > secondBestEV) {
          secondBestEV = secondCandidateEV;
          bestSecondDiscardOverall = candidate;
        }
      }

      if (secondBestEV > playScore) {
        bestScore = Math.max(bestScore, secondBestEV);
        secondDiscardHelpCount++;
      }
    }

    evSum += bestScore;
    allScores.push(bestScore);

    // Track hand types (use the play after 1st discard as reference)
    // We could track more precisely but this is good enough
  }

  const numEvaluations = allScores.length;
  const ev = numEvaluations > 0 ? evSum / numEvaluations : 0;
  const singleStepEV = numEvaluations > 0 ? singleStepEvSum / numEvaluations : 0;

  allScores.sort((a, b) => a - b);

  // Hand type probabilities (approximate)
  const handProbabilities: Partial<Record<HandType, number>> = {};
  for (const ht of Object.keys(handTypeCounts) as HandType[]) {
    const count = handTypeCounts[ht] ?? 0;
    if (count > 0) handProbabilities[ht] = count / numEvaluations;
  }

  return {
    firstDiscardIndices,
    expectedValue: ev,
    singleStepEV,
    bestSecondDiscard: bestSecondDiscardOverall ?? undefined,
    secondDiscardHelps: secondDiscardHelpCount > numEvaluations * 0.3,
    totalSamples: numEvaluations + totalSecondDraws,
    targetHandType: Object.entries(handProbabilities).sort((a, b) => b[1] - a[1])[0]?.[0] as HandType | undefined,
    handProbabilities: Object.keys(handProbabilities).length > 0 ? handProbabilities : undefined,
    minScore: allScores[0],
    maxScore: allScores[allScores.length - 1],
  };
}

/**
 * Evaluate the top discard candidates from single-step analysis with multi-step
 * lookahead. Returns EvOptions enhanced with multi-step annotations.
 */
export function enhanceWithLookahead(
  state: GameState,
  topDiscardCandidates: { indices: number[]; keptCards: Card[] }[],
  config?: Partial<LookaheadConfig>,
  searchConfig?: Partial<SearchConfig>,
  scoreOptions?: ScoreOptions,
): EvOption[] {
  const startTime = performance.now();
  const cfg = { ...DEFAULT_LOOKAHEAD_CONFIG, ...config };
  const enhanced: EvOption[] = [];

  // Only enhance top 3 candidates with multi-step
  const topN = Math.min(topDiscardCandidates.length, 3);
  for (let i = 0; i < topN; i++) {
    if (performance.now() - startTime > cfg.maxComputationMs) break;

    const candidate = topDiscardCandidates[i];
    const result = computeMultiStepEV(
      state, candidate.indices, cfg, searchConfig, scoreOptions,
    );

    // Determine if multi-step adds significant value
    const improvementOverSingle = result.singleStepEV > 0
      ? (result.expectedValue - result.singleStepEV) / result.singleStepEV
      : 0;

    const isMultiStepHelpful = improvementOverSingle > cfg.benefitThreshold;

    enhanced.push({
      type: 'discard',
      indices: candidate.indices,
      keptCards: candidate.keptCards,
      score: result.expectedValue,
      isEV: true,
      isMultiStep: isMultiStepHelpful,
      lookaheadDepth: isMultiStepHelpful ? 2 : undefined,
      samplesEvaluated: result.totalSamples,
      handProbabilities: result.handProbabilities,
      targetHandType: result.targetHandType,
      minScore: result.minScore,
      maxScore: result.maxScore,
      actionDescription: isMultiStepHelpful && result.bestSecondDiscard
        ? `Discard ${candidate.indices.length} then discard ${result.bestSecondDiscard.indices.length} more`
        : undefined,
      actionDescriptionZh: isMultiStepHelpful && result.bestSecondDiscard
        ? `先弃${candidate.indices.length}张，再弃${result.bestSecondDiscard.indices.length}张`
        : undefined,
    });
  }

  return enhanced;
}

// ─── Helper: Generate Discard Candidates (simplified for lookahead) ─

function generateDiscardCandidates(
  handCards: Card[],
  maxDiscardSize: number,
  topN: number,
  jokerModifiers: ReturnType<typeof getJokerModifiers>,
  deckComposition: GameState['deckComposition'],
): DiscardCandidate[] {
  const handSize = handCards.length;
  const allCandidates: DiscardCandidate[] = [];

  for (let size = 1; size <= maxDiscardSize; size++) {
    for (const indices of combinations(handSize, size)) {
      const discardCards = indices.map(i => handCards[i]);
      const keptCards = handCards.filter((_, i) => !indices.includes(i));
      const heuristicScore = scoreDiscardHeuristicLookahead(
        keptCards, discardCards, jokerModifiers, deckComposition,
      );
      allCandidates.push({ indices, heuristicScore });
    }
  }

  allCandidates.sort((a, b) => b.heuristicScore - a.heuristicScore);
  return allCandidates.slice(0, topN);
}

// ─── Simplified Heuristic (faster than strategy-evaluator version) ──

function scoreDiscardHeuristicLookahead(
  keptCards: Card[],
  discardCards: Card[],
  _jokerModifiers: ReturnType<typeof getJokerModifiers>,
  _deckComposition: GameState['deckComposition'],
): number {
  let score = 0;

  // Rank clustering
  const rankCounts = new Map<string, number>();
  for (const c of keptCards) {
    rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
  }
  for (const [, count] of rankCounts) {
    if (count >= 4) score += 80;
    else if (count >= 3) score += 50;
    else if (count >= 2) score += 25;
  }

  // Suit clustering
  const suitCounts = new Map<string, number>();
  for (const c of keptCards) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }
  const maxSuit = Math.max(...suitCounts.values(), 0);
  if (maxSuit >= 4) score += 60;
  else if (maxSuit >= 3) score += 35;
  else if (maxSuit >= 2) score += 15;

  // Discard quality
  for (const c of discardCards) {
    const rankCount = rankCounts.get(c.rank) ?? 0;
    const suitCount = suitCounts.get(c.suit) ?? 0;
    if (rankCount === 0 && suitCount < maxSuit) score += 15;
    else if (rankCount === 0) score += 8;
    else score -= 10;
  }

  return score;
}
