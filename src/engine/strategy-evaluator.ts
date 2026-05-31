/**
 * EV-Based Strategy Evaluator
 *
 * Upgrades the greedy "best play from current hand" approach to a proper
 * expected-value comparison: "should I play now, or discard to draw for
 * a better hand?"
 *
 * Core algorithm:
 * 1. Compute baseline (best play from current hand)
 * 2. Generate discard candidates with heuristic pre-filter
 * 3. Monte Carlo EV estimation for each discard candidate
 * 4. Compare EV(play) vs EV(best discard) → recommend
 */

import type { Card, GameState, DeckComposition } from './types';
import {
  HandType, Rank, Suit,
  CardEnhancement, CardEdition, Seal,
  ALL_RANKS, ALL_HAND_TYPES,
  isStone,
} from './types';
import { getJokerModifiers } from './joker-data';
import { findOptimalPlays, findBestScore, type SearchConfig } from './search';
import type { ScoreOptions } from './scorer';
import { combinations } from './combo-utils';
import { HAND_DEFINITIONS } from './constants';
import {
  applyConsumable, getTarotTargetSuggestions, canApplyConsumable,
} from './consumables';
import { enhanceWithLookahead } from './lookahead';
import { createRng, type RngFn } from './rng';

// ─── Types ──────────────────────────────────────────────────────

export interface EvOption {
  type: 'play' | 'discard' | 'consumable';
  /** Card indices in the hand (play: cards to play; discard: cards to discard) */
  indices: number[];
  /** Exact score for 'play', expected value for 'discard' */
  score: number;
  /** Whether score is an expected value (sampled) or exact */
  isEV: boolean;
  /** Cards kept after discard (only set for 'discard' type) */
  keptCards?: Card[];
  /** Target hand type (only set for 'discard' type) */
  targetHandType?: HandType;
  /** Number of MC samples evaluated (only for 'discard') */
  samplesEvaluated?: number;
  /** Hand type probability distribution after draw (only for 'discard') */
  handProbabilities?: Partial<Record<HandType, number>>;
  /** Min/max scores observed in sampling (only for 'discard') */
  minScore?: number;
  maxScore?: number;
  /** Consumable card ID (only for 'consumable' type) */
  consumableId?: string;
  /** Whether this is a multi-step lookahead result */
  isMultiStep?: boolean;
  /** Lookahead depth (for multi-step results) */
  lookaheadDepth?: number;
  /** Human-readable description of the action */
  actionDescription?: string;
  actionDescriptionZh?: string;
}

export interface StrategyRecommendation {
  /** Recommended action */
  action: 'play' | 'discard' | 'consumable';
  /** Card indices to play (if action='play') */
  playIndices?: number[];
  /** Expected score of the play */
  playScore?: number;
  /** Hand type of the play */
  playHandType?: HandType;
  /** Card indices to discard (if action='discard') */
  discardIndices?: number[];
  /** Expected value of discarding then playing */
  discardEV?: number;
  /** Target hand type for the discard */
  targetHandType?: HandType;
  /** Consumable card ID (if action='consumable') */
  consumableId?: string;
  /** Target indices for consumable */
  consumableIndices?: number[];
  /** Best score achievable by playing now (baseline) */
  baselineScore: number;
  /** Expected score of the recommended action */
  expectedScore: number;
  /** Improvement percentage over baseline */
  improvementPercent: number;
  /** All evaluated options, sorted by score descending */
  allOptions: EvOption[];
  /** Cards to save for future rounds (cross-round planning) */
  savedCards?: Card[];
  /** Cross-round planning rationale */
  crossRoundRationale?: string;
  /** Human-readable summaries */
  summary: string;
  summaryZh: string;
}

export interface StrategyConfig {
  /** Number of top discard candidates to MC-evaluate */
  maxDiscardCandidates: number;
  /** Number of Monte Carlo samples per discard candidate */
  monteCarloSamples: number;
  /** Maximum computation time in ms */
  maxComputationMs: number;
  /** Minimum improvement % over baseline to recommend discarding */
  discardThreshold: number;
  /** Seeded RNG for deterministic Monte Carlo sampling (default: fixed seed) */
  rng?: RngFn;
  /** Progress callback */
  onProgress?: (evaluated: number, total: number) => void;
}

/** Fixed default seed for reproducible EV computation across sessions */
const DEFAULT_RNG_SEED = 'balatro-calc-ev-v2';

const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  maxDiscardCandidates: 15,
  monteCarloSamples: 60,
  maxComputationMs: 15000,
  discardThreshold: 0.05, // 5% improvement needed to prefer discard
};

// ─── Main Entry Point ───────────────────────────────────────────

export function evaluateStrategy(
  state: GameState,
  config?: Partial<StrategyConfig>,
  searchConfig?: Partial<SearchConfig>,
  scoreOptions?: ScoreOptions,
): StrategyRecommendation {
  const startTime = performance.now();
  const cfg = { ...DEFAULT_STRATEGY_CONFIG, ...config };
  const rng = cfg.rng ?? createRng(DEFAULT_RNG_SEED);

  const handSize = state.handCards.length;
  if (handSize === 0) {
    return {
      action: 'play', baselineScore: 0, expectedScore: 0,
      improvementPercent: 0, allOptions: [],
      summary: 'No cards in hand.', summaryZh: '手中无牌。',
    };
  }

  // ── 1. Baseline: best play from current hand ──────────────────
  const baselineResult = findOptimalPlays(state, searchConfig, scoreOptions);
  const baselinePlay = baselineResult.optimalPlay;
  const baselineScore = baselinePlay?.totalScore ?? 0;
  const baselineHand = baselinePlay?.handType ?? HandType.HighCard;

  // ── 2. Build draw pool from deck composition ──────────────────
  const pool = buildAvailableCardPool(state.deckComposition);
  const canDraw = pool.length > 0 && state.roundState.discardsUsed < state.roundState.maxDiscards;

  // ── 3. Generate play options (top-N from baseline search) ─────
  const playOptions: EvOption[] = [];
  const seenPlayIndices = new Set<string>();

  for (const play of baselineResult.allPlays) {
    if (playOptions.length >= 5) break;
    const key = [...play.playedCards.map(c => c.id)].sort().join(',');
    if (seenPlayIndices.has(key)) continue;
    seenPlayIndices.add(key);

    const indices = play.playedCards
      .map(pc => state.handCards.findIndex(hc => hc.id === pc.id))
      .filter(i => i >= 0);

    playOptions.push({
      type: 'play',
      indices,
      score: play.totalScore,
      isEV: false,
    });
  }

  // ── 4. Generate discard candidates (heuristic pre-filter) ─────
  const maxDiscardSize = Math.min(5, handSize - 1); // Must keep at least 1 card
  let discardCandidates: { indices: number[]; keptCards: Card[]; heuristicScore: number }[] = [];

  if (canDraw && maxDiscardSize >= 1) {
    const jokerModifiers = getJokerModifiers(state.jokers);

    for (let size = 1; size <= maxDiscardSize; size++) {
      if (discardCandidates.length >= cfg.maxDiscardCandidates * 2) break;

      const sizedCandidates: { indices: number[]; keptCards: Card[]; heuristicScore: number }[] = [];

      for (const indices of combinations(handSize, size)) {
        const discardCards = indices.map(i => state.handCards[i]);
        const keptCards = state.handCards.filter((_, i) => !indices.includes(i));

        // Heuristic: score how promising this discard is
        const heuristicScore = scoreDiscardHeuristic(
          keptCards, discardCards, jokerModifiers, state.deckComposition,
        );

        sizedCandidates.push({ indices, keptCards, heuristicScore });
      }

      // Keep top-N per discard size
      sizedCandidates.sort((a, b) => b.heuristicScore - a.heuristicScore);
      const topForSize = sizedCandidates.slice(0, Math.min(3, sizedCandidates.length));
      discardCandidates.push(...topForSize);
    }

    // Overall top-N across all sizes
    discardCandidates.sort((a, b) => b.heuristicScore - a.heuristicScore);
    discardCandidates = discardCandidates.slice(0, cfg.maxDiscardCandidates);
  }

  // ── 4.5 Generate consumable options ────────────────────────────
  const consumableOptions: EvOption[] = [];
  const heldConsumables = state.heldConsumables;
  if (heldConsumables && heldConsumables.length > 0) {
    for (const consumable of heldConsumables) {
      if (consumable.type === 'unknown') continue;
      if (!canApplyConsumable(consumable.id, consumable.type)) continue;

      if (consumable.type === 'planet') {
        // Planet: apply directly and score the modified state
        try {
          const result = applyConsumable(consumable, state);
          const modifiedScore = findBestScore(result.newState, searchConfig, scoreOptions);
          consumableOptions.push({
            type: 'consumable',
            indices: [],
            score: modifiedScore,
            isEV: false,
            consumableId: consumable.id,
            actionDescription: result.description,
            actionDescriptionZh: result.descriptionZh,
          });
        } catch { /* skip if application fails */ }
      } else if (consumable.type === 'tarot') {
        // Tarot: for each suggested target, apply and score
        const targetSets = getTarotTargetSuggestions(consumable.id, state, 3);
        for (const targets of targetSets) {
          if (performance.now() - startTime > cfg.maxComputationMs) break;
          try {
            const result = applyConsumable(consumable, state, targets);
            const modifiedScore = findBestScore(result.newState, searchConfig, scoreOptions);
            consumableOptions.push({
              type: 'consumable',
              indices: targets,
              score: modifiedScore,
              isEV: false,
              consumableId: consumable.id,
              actionDescription: result.description,
              actionDescriptionZh: result.descriptionZh,
            });
          } catch { /* skip if application fails */ }
        }
      }
    }
  }

  // ── 5. Monte Carlo EV for discard candidates ──────────────────
  const discardOptions: EvOption[] = [];
  const totalDiscardCandidates = discardCandidates.length;
  let mcEvaluated = 0;

  for (const candidate of discardCandidates) {
    if (performance.now() - startTime > cfg.maxComputationMs) break;

    const evResult = computeDiscardEV(
      state, candidate.indices, pool,
      cfg.monteCarloSamples, rng, searchConfig, scoreOptions,
    );

    // Identify most likely target hand type
    const targetHand = evResult.handProbabilities
      ? (Object.entries(evResult.handProbabilities) as [HandType, number][])
          .sort((a, b) => b[1] - a[1])[0]?.[0]
      : undefined;

    discardOptions.push({
      type: 'discard',
      indices: candidate.indices,
      keptCards: candidate.keptCards,
      score: evResult.expectedValue,
      isEV: true,
      samplesEvaluated: evResult.samplesEvaluated,
      handProbabilities: evResult.handProbabilities,
      targetHandType: targetHand,
      minScore: evResult.minScore,
      maxScore: evResult.maxScore,
    });

    mcEvaluated++;
    if (cfg.onProgress) {
      cfg.onProgress(mcEvaluated, totalDiscardCandidates);
    }
  }

  // ── 5.5 Multi-step lookahead for top discard candidates ──────
  const discsLeft = state.roundState.maxDiscards - state.roundState.discardsUsed;
  if (discsLeft >= 2 && discardOptions.length > 0) {
    // Extract top-3 discard candidates (by heuristic score) for lookahead
    const topDiscardForLookahead = discardCandidates
      .filter(dc => discardOptions.some(o => o.type === 'discard' && arraysEqual(o.indices, dc.indices)))
      .slice(0, 3);

    if (topDiscardForLookahead.length > 0) {
      const enhanced = enhanceWithLookahead(
        state, topDiscardForLookahead, { rng }, searchConfig, scoreOptions,
      );

      // Replace the corresponding single-step options with enhanced ones
      for (const e of enhanced) {
        const idx = discardOptions.findIndex(
          o => o.type === 'discard' && arraysEqual(o.indices, e.indices),
        );
        if (idx >= 0) {
          discardOptions[idx] = e; // Replace with multi-step version
        }
      }
    }
  }

  // ── 6. Combine and rank all options ───────────────────────────
  const allOptions = [...playOptions, ...consumableOptions, ...discardOptions];
  allOptions.sort((a, b) => b.score - a.score);

  const best = allOptions[0];
  const improvementPercent = baselineScore > 0
    ? ((best.score - baselineScore) / baselineScore) * 100
    : 0;

  // ── 7. Decide: play, discard, or consumable ──────────────────
  let action: 'play' | 'discard' | 'consumable';
  let expectedScore: number;

  if (best?.type === 'consumable' && improvementPercent > cfg.discardThreshold * 100) {
    action = 'consumable';
    expectedScore = best.score;
  } else if (best?.type === 'discard' && improvementPercent > cfg.discardThreshold * 100) {
    action = 'discard';
    expectedScore = best.score;
  } else if (best?.type === 'play') {
    action = 'play';
    expectedScore = best.score;
  } else {
    // Best is discard/consumable but improvement is marginal → play
    action = 'play';
    expectedScore = playOptions[0]?.score ?? baselineScore;
  }

  // ── 7.5 Cross-round planning: "good enough" check ─────────────
  let savedCards: Card[] | undefined;
  let crossRoundRationale: string | undefined;

  const blindChips = state.blind.chipsRequired;
  if (blindChips > 0 && action === 'play' && playOptions.length > 1) {
    // Find play options that are "good enough" to beat the blind
    const safeMargin = 1.15; // 15% safety margin over blind requirement
    const safeOptions = playOptions.filter(opt => opt.score >= blindChips * safeMargin);

    if (safeOptions.length > 0 && playOptions[0].score > safeOptions[0].score * 1.5) {
      // Best play is >50% overkill compared to a safe play
      const bestPlay = playOptions[0];
      const safePlay = safeOptions[0];

      // Cards that would be saved if using safePlay instead of bestPlay
      const safeCardIds = new Set(safePlay.indices.map(i => state.handCards[i]?.id).filter(Boolean));

      // Cards played in best but NOT in safe → these can be saved
      savedCards = bestPlay.indices
        .filter(i => !safeCardIds.has(state.handCards[i]?.id))
        .map(i => state.handCards[i])
        .filter(Boolean);

      const targetScore = Math.ceil(blindChips * safeMargin);
      crossRoundRationale = `Can beat blind with ${safePlay.indices.length} cards (${formatScoreForSummary(safePlay.score)} > ${formatScoreForSummary(targetScore)} needed). Consider saving stronger cards for future blinds.`;
    }
  }

  // ── 8. Generate summaries ──────────────────────────────────────
  const { summary, summaryZh } = buildSummaries(
    action, best, baselineScore, baselineHand,
    improvementPercent, handSize,
  );

  return {
    action,
    playIndices: action === 'play' ? best?.indices : playOptions[0]?.indices,
    playScore: action === 'play' ? best?.score : undefined,
    playHandType: action === 'play'
      ? baselineResult.allPlays.find(p =>
          p.playedCards.every((pc, i) => state.handCards[best?.indices?.[i] ?? -1]?.id === pc.id)
        )?.handType
      : undefined,
    discardIndices: action === 'discard' ? best?.indices : undefined,
    discardEV: action === 'discard' ? best?.score : undefined,
    targetHandType: action === 'discard' ? best?.targetHandType : undefined,
    consumableId: action === 'consumable' ? best?.consumableId : undefined,
    consumableIndices: action === 'consumable' ? best?.indices : undefined,
    baselineScore,
    expectedScore,
    improvementPercent,
    allOptions,
    savedCards: savedCards && savedCards.length > 0 ? savedCards : undefined,
    crossRoundRationale,
    summary,
    summaryZh,
  };
}

// ─── Discard EV Computation ─────────────────────────────────────

interface DiscardEvResult {
  expectedValue: number;
  minScore: number;
  maxScore: number;
  samplesEvaluated: number;
  handProbabilities: Partial<Record<HandType, number>>;
}

export function computeDiscardEV(
  state: GameState,
  discardIndices: number[],
  pool: Card[],
  numSamples: number,
  rng: RngFn,
  searchConfig?: Partial<SearchConfig>,
  scoreOptions?: ScoreOptions,
): DiscardEvResult {
  const discardSet = new Set(discardIndices);
  const fogCount = discardIndices.length;

  // Draw samples from the pool (deterministic: seeded RNG)
  const draws = sampleDrawsWithoutReplacement(pool, fogCount, numSamples, rng);

  const scores: number[] = [];
  const handTypeCounts: Partial<Record<HandType, number>> = {};

  for (const drawnCards of draws) {
    // Build resolved hand: original kept cards + drawn cards
    const resolvedHand: Card[] = [];
    for (let i = 0; i < state.handCards.length; i++) {
      if (discardSet.has(i)) {
        // This slot gets a drawn card
        resolvedHand.push(drawnCards.shift()!);
      } else {
        resolvedHand.push(state.handCards[i]);
      }
    }

    const testState: GameState = {
      ...state,
      handCards: resolvedHand,
    };

    const score = findBestScore(testState, searchConfig, scoreOptions);
    scores.push(score);

    // Determine best hand type for this draw
    const bestResult = findOptimalPlays(testState, searchConfig, scoreOptions);
    const bestHand = bestResult.optimalPlay?.handType ?? HandType.HighCard;
    handTypeCounts[bestHand] = (handTypeCounts[bestHand] ?? 0) + 1;
  }

  scores.sort((a, b) => a - b);
  const ev = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Hand type probabilities
  const handProbabilities: Partial<Record<HandType, number>> = {};
  const total = draws.length;
  for (const ht of ALL_HAND_TYPES) {
    const count = handTypeCounts[ht] ?? 0;
    if (count > 0) handProbabilities[ht] = count / total;
  }

  return {
    expectedValue: ev,
    minScore: scores[0] ?? 0,
    maxScore: scores[scores.length - 1] ?? 0,
    samplesEvaluated: total,
    handProbabilities,
  };
}

// ─── Draw Pool ──────────────────────────────────────────────────

export function buildAvailableCardPool(deck: DeckComposition): Card[] {
  const pool: Card[] = [];
  let idCounter = 0;

  if (deck.cards && deck.cards.length > 0) {
    for (const slot of deck.cards) {
      pool.push({
        id: `pool_${idCounter++}`,
        rank: slot.rank,
        suit: slot.suit,
        enhancement: slot.enhancement ?? CardEnhancement.None,
        edition: slot.edition ?? CardEdition.None,
        seal: slot.seal ?? Seal.None,
        debuffed: false,
      });
    }
    return pool;
  }

  // No precise deck card data available — cannot build an accurate pool.
  // Aggregate counts (remainingByRank / remainingBySuit) don't capture the
  // joint rank×suit distribution, so any pool built from them would be wrong
  // once cards are destroyed or added (e.g. Hanged Man, DNA).
  // The mod always sends deck.cards; manual-entry users should use the
  // CardEditor to build an explicit deck.
  console.warn(
    '[strategy-evaluator] buildAvailableCardPool: deck.cards is empty. ' +
    'Monte Carlo EV sampling will be skipped. Use the deck editor or mod ' +
    'to populate explicit card slots for accurate draw simulation.',
  );
  return pool;
}

// ─── Monte Carlo Sampling ───────────────────────────────────────

export function sampleDrawsWithoutReplacement(
  pool: Card[],
  count: number,
  numSamples: number,
  rng: RngFn,
): Card[][] {
  if (pool.length === 0 || count <= 0) return [];

  const actualSamples = Math.min(numSamples, binomial(pool.length, count));
  const result: Card[][] = [];
  const usedKeys = new Set<string>();

  // Shuffle indices using seeded RNG for deterministic sampling
  const indices = pool.map((_, i) => i);

  for (let s = 0; s < actualSamples; s++) {
    // Partial Fisher-Yates shuffle (only need first `count` elements)
    for (let i = indices.length - 1; i >= indices.length - count; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const drawIndices = indices.slice(indices.length - count);
    const key = [...drawIndices].sort((a, b) => a - b).join(',');

    if (usedKeys.has(key)) continue;
    usedKeys.add(key);

    result.push(drawIndices.map(i => ({ ...pool[i] })));
  }

  return result;
}

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

// ─── Heuristic Discard Scoring ──────────────────────────────────

/**
 * Assign a heuristic score to a discard candidate. Higher = more promising.
 * Used to pre-filter discard candidates before expensive MC evaluation.
 *
 * Factors:
 * - Cards kept that form pairs/flushes score higher (keep structures)
 * - Discarding low-value singletons scores higher than discarding paired cards
 * - Synergy with joker preferences (e.g., keep hearts with Bloodstone)
 */
function scoreDiscardHeuristic(
  keptCards: Card[],
  discardCards: Card[],
  jokerModifiers: ReturnType<typeof getJokerModifiers>,
  deckComposition: DeckComposition,
): number {
  let score = 0;

  const scoringKept = keptCards.filter(c => !isStone(c));
  const stoneCount = keptCards.length - scoringKept.length;

  // ── Rank clustering (keep pairs, three-of-a-kind, etc.) ───
  const rankCounts = new Map<Rank, number>();
  for (const c of scoringKept) {
    rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
  }
  for (const [, count] of rankCounts) {
    if (count >= 4) score += 80;
    else if (count >= 3) score += 50;
    else if (count >= 2) score += 25;
  }

  // ── Suit clustering (keep same suit for flush potential) ──
  const suitCounts = new Map<Suit, number>();
  for (const c of scoringKept) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }
  const maxSuit = Math.max(...suitCounts.values(), 0);
  if (maxSuit >= 4) score += 60;
  else if (maxSuit >= 3) score += 35;
  else if (maxSuit >= 2) score += 15;

  // ── Straight potential (adjacent ranks) ──
  const keptRanks = [...new Set(scoringKept.map(c => c.rank))];
  if (keptRanks.length >= 3) {
    const rankOrder = ALL_RANKS;
    const rankIndices = keptRanks
      .map(r => rankOrder.indexOf(r))
      .filter(i => i >= 0)
      .sort((a, b) => a - b);
    let maxConsecutive = 1;
    let current = 1;
    for (let i = 1; i < rankIndices.length; i++) {
      if (rankIndices[i] === rankIndices[i - 1] + 1) {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 1;
      }
    }
    if (maxConsecutive >= 4) score += 55;
    else if (maxConsecutive >= 3) score += 30;
    else if (maxConsecutive >= 2) score += 10;
  }

  // ── Discard quality: discarding low-value singletons is good ──
  for (const c of discardCards) {
    if (isStone(c)) {
      score -= 20; // Bad to discard stone cards
      continue;
    }
    const rankCount = rankCounts.get(c.rank) ?? 0;
    const suitCount = suitCounts.get(c.suit) ?? 0;

    // Good to discard cards that don't match kept pairs/flushes
    if (rankCount === 0 && suitCount < maxSuit) {
      score += 15; // Discarding a singleton
    } else if (rankCount === 0) {
      score += 8;
    } else {
      score -= 10; // Discarding a card that matches kept rank → bad
    }
  }

  // ── Deck support: can we complete the hand? ──
  const minForFlush = jokerModifiers.fourFingers ? 4 : 5;
  if (maxSuit >= 3) {
    const deckSuits = deckComposition.remainingBySuit;
    for (const [suit, count] of suitCounts) {
      const inDeck = deckSuits[suit] ?? 0;
      if (count + inDeck >= minForFlush) {
        score += 20; // Flush completable from deck
        break;
      }
    }
  }

  // Bonus for keeping enhanced/edition/seal cards
  for (const c of keptCards) {
    if (c.enhancement && c.enhancement !== CardEnhancement.None) score += 5;
    if (c.edition && c.edition !== CardEdition.None) score += 8;
    if (c.seal && c.seal !== Seal.None) score += 10;
  }

  // Stone cards effectively add to any hand
  score += stoneCount * 10;

  return score;
}

// ─── Summary Generation ─────────────────────────────────────────

function buildSummaries(
  action: 'play' | 'discard' | 'consumable',
  best: EvOption | undefined,
  baselineScore: number,
  baselineHand: HandType,
  improvementPercent: number,
  _handSize: number,
): { summary: string; summaryZh: string } {
  if (!best) {
    return {
      summary: 'No viable options found. Play the best hand you can.',
      summaryZh: '未找到可行策略，请尽量打出最佳牌型。',
    };
  }

  const baselineName = HAND_DEFINITIONS[baselineHand]?.name ?? baselineHand;

  if (action === 'play') {
    const handName = HAND_DEFINITIONS[baselineHand]?.name ?? baselineHand;
    const scoreStr = formatScoreForSummary(baselineScore);
    const summary = `Play ${handName} for ${scoreStr}. No discard needed.`;
    const summaryZh = `推荐出牌: ${handName}，得分 ${scoreStr}。无需弃牌。`;
    return { summary, summaryZh };
  }

  if (action === 'consumable') {
    const desc = best.actionDescription ?? `Use ${best.consumableId}`;
    const descZh = best.actionDescriptionZh ?? `使用${best.consumableId}`;
    const scoreStr = formatScoreForSummary(best.score);
    const baselineStr = formatScoreForSummary(baselineScore);
    const pctStr = improvementPercent > 0 ? `+${improvementPercent.toFixed(0)}%` : '';
    const summary = `${desc}, then play best hand. Expected: ${scoreStr} (vs. ${baselineStr} playing ${baselineName} now, ${pctStr}).`;
    const summaryZh = `${descZh}后再出牌。期望得分: ${scoreStr}（当前最佳出牌 ${baselineName}: ${baselineStr}，${pctStr}）。`;
    return { summary, summaryZh };
  }

  // Discard recommendation
  const targetName = best.targetHandType
    ? (HAND_DEFINITIONS[best.targetHandType]?.name ?? best.targetHandType)
    : 'better hand';
  const evStr = formatScoreForSummary(best.score);
  const baselineStr = formatScoreForSummary(baselineScore);
  const pctStr = improvementPercent > 0 ? `+${improvementPercent.toFixed(0)}%` : '';

  const summary = `Discard ${best.indices.length} card(s) to go for ${targetName}. ` +
    `Expected: ${evStr} (vs. ${baselineStr} playing ${baselineName} now, ${pctStr}).`;

  const summaryZh = `推荐弃 ${best.indices.length} 张牌冲${targetName}。` +
    `期望得分: ${evStr}（当前最佳出牌 ${baselineName}: ${baselineStr}，${pctStr}）。`;

  return { summary, summaryZh };
}

function formatScoreForSummary(score: number): string {
  if (!Number.isFinite(score)) return score.toString();
  if (score < 1_000) return score.toFixed(0);
  if (score < 1_000_000) return (score / 1_000).toFixed(1) + 'K';
  if (score < 1_000_000_000) return (score / 1_000_000).toFixed(1) + 'M';
  return (score / 1_000_000_000).toFixed(1) + 'B';
}

// ─── Quick Re-export ────────────────────────────────────────────

export { getJokerModifiers } from './joker-data';

// ─── Utility ──────────────────────────────────────────────────────

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}
