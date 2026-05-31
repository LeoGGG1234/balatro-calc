import type {
  Card, GameState, JokerModifiers, DeckComposition,
} from './types';
import { HandType, Rank, Suit, isStone, ALL_RANKS, ALL_SUITS, ALL_HAND_TYPES, rankToChips } from './types';
import { recognizeHand } from './hand-evaluator';
import { getJokerModifiers } from './joker-data';
import { findOptimalPlays, type SearchConfig } from './search';
import type { ScoreOptions } from './scorer';
import { getHandBaseChips, getHandBaseMult, HAND_DEFINITIONS } from './constants';
import { combinations } from './combo-utils';
import { computeDiscardEV, buildAvailableCardPool } from './strategy-evaluator';

// ─── Types ──────────────────────────────────────────────────────

export interface DiscardOption {
  /** Indices of cards in the hand to discard */
  discardIndices: number[];
  /** Cards to discard (the actual cards) */
  discardCards: Card[];
  /** Cards kept after discard */
  keptCards: Card[];
  /** Best hand type achievable with kept cards alone */
  bestHandWithKept: HandType;
  /** Score of best play with kept cards */
  keptScore: number;
  /** Best hand type achievable with current hand (no discard) */
  currentBestHand: HandType;
  /** Estimated score after drawing replacements */
  estimatedScore: number;
  /** Estimated score improvement over current best play */
  improvement: number;
  /** What hand types become more likely with this discard */
  targetHandTypes: HandType[];
  /** Discard rationale (one-line summary) */
  rationale: string;
}

export interface DiscardResult {
  /** Baseline: best score with current hand (no discard) */
  baselineScore: number;
  baselineHand: HandType;
  /** All discard options, sorted by estimated improvement descending */
  options: DiscardOption[];
  /** Top 5 recommended discards */
  topRecommendations: DiscardOption[];
  /** Cards currently in hand */
  handCards: Card[];
  /** Discards remaining this round */
  discardsRemaining: number;
  /** Evaluation time in ms */
  evaluationTimeMs: number;
}

interface DiscardConfig {
  /** Maximum number of discard options to evaluate */
  maxOptions: number;
  /** Maximum cards to discard at once (default 5) */
  maxDiscardSize: number;
  /** Minimum cards to keep after discard */
  minKeptCards: number;
}

const DEFAULT_DISCARD_CONFIG: DiscardConfig = {
  maxOptions: 200,
  maxDiscardSize: 5,
  minKeptCards: 0,
};

// ─── Main Analysis Function ─────────────────────────────────────

export function analyzeDiscards(
  state: GameState,
  config: Partial<DiscardConfig> = {},
  searchConfig: Partial<SearchConfig> = {},
  scoreOptions: ScoreOptions = {}
): DiscardResult {
  const startTime = performance.now();
  const cfg = { ...DEFAULT_DISCARD_CONFIG, ...config };
  const jokerModifiers = getJokerModifiers(state.jokers);

  // Baseline: best score with current hand
  const baselineResult = findOptimalPlays(state, searchConfig, scoreOptions);
  const baselineScore = baselineResult.optimalPlay?.totalScore ?? 0;
  const baselineHand = baselineResult.optimalPlay?.handType ?? HandType.HighCard;

  // Enumerate discard subsets
  const handSize = state.handCards.length;
  const maxDiscard = Math.min(cfg.maxDiscardSize, handSize - cfg.minKeptCards);

  const options: DiscardOption[] = [];

  for (let size = 1; size <= maxDiscard; size++) {
    for (const discardIndices of combinations(handSize, size)) {
      if (options.length >= cfg.maxOptions) break;

      const discardCards = discardIndices.map(i => state.handCards[i]);
      const keptCards = state.handCards.filter((_, i) => !discardIndices.includes(i));

      // Score with kept cards only
      const keptState: GameState = {
        ...state,
        handCards: keptCards,
      };
      const keptResult = findOptimalPlays(keptState, searchConfig, scoreOptions);
      const keptScore = keptResult.optimalPlay?.totalScore ?? 0;
      const bestHandWithKept = keptResult.optimalPlay?.handType ?? HandType.HighCard;

      // Estimate score after drawing replacements
      const estimatedScore = estimateScoreAfterDraw(
        state, discardCards, keptCards, keptScore,
        bestHandWithKept, jokerModifiers
      );

      const improvement = estimatedScore - baselineScore;

      // Determine target hand types
      const targetHandTypes = identifyTargetHands(
        keptCards, jokerModifiers, state.deckComposition
      );

      // Generate rationale
      const rationale = buildRationale(
        discardCards, keptCards, bestHandWithKept,
        targetHandTypes, improvement, baselineHand
      );

      options.push({
        discardIndices,
        discardCards,
        keptCards,
        bestHandWithKept,
        keptScore,
        currentBestHand: baselineHand,
        estimatedScore,
        improvement,
        targetHandTypes,
        rationale,
      });
    }

    if (options.length >= cfg.maxOptions) break;
  }

  // Sort by estimated improvement descending
  options.sort((a, b) => b.improvement - a.improvement);

  // Deduplicate similar options (keep best per discard-size/target-hand)
  const deduped = deduplicateOptions(options);

  return {
    baselineScore,
    baselineHand,
    options: deduped,
    topRecommendations: deduped.slice(0, 5),
    handCards: state.handCards,
    discardsRemaining: state.roundState.maxDiscards - state.roundState.discardsUsed,
    evaluationTimeMs: performance.now() - startTime,
  };
}

// ─── Score Estimation After Draw ─────────────────────────────────

function estimateScoreAfterDraw(
  state: GameState,
  _discardCards: Card[],
  keptCards: Card[],
  keptScore: number,
  bestHandWithKept: HandType,
  jokerModifiers: JokerModifiers
): number {
  // Base: score with just kept cards
  let estimatedScore = keptScore;

  // Estimate contribution of drawn cards
  const discardCount = state.handCards.length - keptCards.length;
  const deck = state.deckComposition;

  if (discardCount <= 0) return keptScore;

  // Average chips contributed by a drawn card
  const avgChips = estimateAverageDrawChips(deck);
  // Average mult boost from completing a hand
  const handBoost = estimateHandCompletionBoost(
    keptCards, bestHandWithKept, discardCount, state, jokerModifiers
  );

  // Rough estimate: kept score + draw contribution
  estimatedScore = Math.max(keptScore + avgChips * discardCount, handBoost);

  return estimatedScore;
}

function estimateAverageDrawChips(deck: DeckComposition): number {
  const remainingByRank = deck.remainingByRank;
  let totalChips = 0;
  let totalCards = 0;

  for (const rank of ALL_RANKS) {
    const count = remainingByRank[rank] ?? 0;
    totalCards += count;
    totalChips += rankToChips(rank) * count;
  }

  if (totalCards === 0) return 0;
  return totalChips / totalCards;
}

function estimateHandCompletionBoost(
  keptCards: Card[],
  currentBestHand: HandType,
  discardCount: number,
  state: GameState,
  jokerModifiers: JokerModifiers
): number {
  // Given kept cards, what better hands could be completed with favorable draws?
  // Check higher-tier hands and estimate probability of completing them

  const currentTier = ALL_HAND_TYPES.indexOf(currentBestHand);
  let bestEstimatedScore = 0;

  // Check higher-tier hands
  for (let tier = currentTier + 1; tier < ALL_HAND_TYPES.length; tier++) {
    const targetHand = ALL_HAND_TYPES[tier];
    const cardsNeeded = cardsNeededForHand(keptCards, targetHand, jokerModifiers);

    if (cardsNeeded <= discardCount && cardsNeeded > 0) {
      // This hand is achievable with favorable draws
      // Estimate score: use full hand scoring (simplified)
      const handChips = getHandBaseChips(targetHand, state.handLevels[targetHand] ?? 1);
      const handMult = getHandBaseMult(targetHand, state.handLevels[targetHand] ?? 1);
      const cardChips = estimateCardChipsFromKept(keptCards) + estimateAverageDrawChips(state.deckComposition) * cardsNeeded;
      const estimatedScore = (handChips + cardChips) * handMult;
      bestEstimatedScore = Math.max(bestEstimatedScore, estimatedScore);
    }
  }

  return bestEstimatedScore;
}

function estimateCardChipsFromKept(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + (isStone(c) ? 50 : rankToChips(c.rank)), 0);
}

function cardsNeededForHand(
  keptCards: Card[],
  targetHand: HandType,
  jokerModifiers: JokerModifiers
): number {
  const scoringCards = keptCards.filter(c => !isStone(c));
  const stoneCount = keptCards.length - scoringCards.length;

  const totalEffectiveCards = keptCards.length;
  const minCards = jokerModifiers.fourFingers ? 4 : 5;

  if (totalEffectiveCards >= minCards) {
    const handType = recognizeHand(keptCards, jokerModifiers);
    if (handType === targetHand) return 0;
    // Higher-tier hand check
    if (ALL_HAND_TYPES.indexOf(handType) >= ALL_HAND_TYPES.indexOf(targetHand)) return 0;
  }

  // Estimate how many more cards needed
  // For flush/pair/two pair etc, count what we have and need
  const rankCounts = countRanksSimple(scoringCards);
  const suitCounts = countSuitsSimple(scoringCards);

  switch (targetHand) {
    case HandType.FlushFive:
      return Math.max(0, minCards - totalEffectiveCards, 5 - Math.max(...Object.values(suitCounts), 0), 5 - Math.max(...Object.values(rankCounts), 0));
    case HandType.FiveOfAKind:
      return Math.max(0, 5 - Math.max(...Object.values(rankCounts), 0) - stoneCount);
    case HandType.FlushHouse:
      return Math.max(0, minCards - totalEffectiveCards);
    case HandType.FourOfAKind:
      return Math.max(0, 4 - Math.max(...Object.values(rankCounts), 0) - stoneCount);
    case HandType.FullHouse: {
      const counts = Object.values(rankCounts).sort((a, b) => b - a);
      const maxR = counts[0] ?? 0;
      const secR = counts[1] ?? 0;
      return Math.max(0, 3 - maxR - stoneCount) + Math.max(0, 2 - secR);
    }
    case HandType.Flush:
      return Math.max(0, minCards - Math.max(...Object.values(suitCounts), 0) - stoneCount);
    case HandType.Straight:
      return Math.max(0, minCards - totalEffectiveCards);
    case HandType.ThreeOfAKind:
      return Math.max(0, 3 - Math.max(...Object.values(rankCounts), 0) - stoneCount);
    case HandType.TwoPair: {
      const counts = Object.values(rankCounts).sort((a, b) => b - a);
      const pairs = counts.filter(c => c >= 2).length;
      const maxR = counts[0] ?? 0;
      return Math.max(0, 2 - pairs) + Math.max(0, 2 - maxR);
    }
    case HandType.Pair:
      return Math.max(0, 2 - Math.max(...Object.values(rankCounts), 0) - stoneCount);
    default:
      return Math.max(0, minCards - totalEffectiveCards);
  }
}

function countRanksSimple(cards: Card[]): Partial<Record<Rank, number>> {
  const counts: Partial<Record<Rank, number>> = {};
  for (const c of cards) {
    if (isStone(c)) continue;
    counts[c.rank] = (counts[c.rank] ?? 0) + 1;
  }
  return counts;
}

function countSuitsSimple(cards: Card[]): Partial<Record<Suit, number>> {
  const counts: Partial<Record<Suit, number>> = {};
  for (const c of cards) {
    if (isStone(c)) continue;
    counts[c.suit] = (counts[c.suit] ?? 0) + 1;
  }
  return counts;
}

// ─── Target Hand Identification ─────────────────────────────────

function identifyTargetHands(
  keptCards: Card[],
  jokerModifiers: JokerModifiers,
  deckComposition: DeckComposition
): HandType[] {
  const targets: HandType[] = [];
  const scoringCards = keptCards.filter(c => !isStone(c));

  const suitCounts = countSuitsSimple(scoringCards);
  const rankCounts = countRanksSimple(scoringCards);
  const maxSuit = Math.max(...Object.values(suitCounts), 0);
  const maxRank = Math.max(...Object.values(rankCounts), 0);
  const totalEffective = keptCards.length;

  // Check flush potential
  if (maxSuit >= 3 && totalEffective >= 2) {
    const deckSuits = deckComposition.remainingBySuit;
    // Check if there are enough cards of this suit remaining to complete a flush
    for (const suit of ALL_SUITS) {
      const have = suitCounts[suit] ?? 0;
      const inDeck = deckSuits[suit] ?? 0;
      const minCards = jokerModifiers.fourFingers ? 4 : 5;
      if (have + inDeck >= minCards && have >= minCards - 2) {
        targets.push(HandType.Flush);
        break;
      }
    }
  }

  // Check straight potential
  if (scoringCards.length >= 3) {
    targets.push(HandType.Straight);
  }

  // Check pair/three/four of a kind
  if (maxRank >= 2) targets.push(HandType.Pair);
  if (maxRank >= 3) targets.push(HandType.ThreeOfAKind);
  if (maxRank >= 3) targets.push(HandType.FourOfAKind);

  // Full house
  if (maxRank >= 2) {
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    if ((counts[0] ?? 0) >= 2 && (counts[1] ?? 0) >= 1) {
      targets.push(HandType.FullHouse);
    }
  }

  return targets;
}

// ─── Rationale Generation ───────────────────────────────────────

function buildRationale(
  discardCards: Card[],
  keptCards: Card[],
  bestHandWithKept: HandType,
  targetHandTypes: HandType[],
  improvement: number,
  currentBestHand: HandType
): string {
  if (improvement <= 0) {
    return `Discarding ${discardCards.length} card(s) doesn't improve your hand. Keep current setup.`;
  }

  if (targetHandTypes.length > 0 && targetHandTypes[0] !== currentBestHand) {
    const targetName = HAND_DEFINITIONS[targetHandTypes[0]]?.name ?? targetHandTypes[0];
    return `Discard ${discardCards.length} card(s) to go for ${targetName}. Keeping ${keptCards.length} cards that contribute to this hand.`;
  }

  if (bestHandWithKept !== currentBestHand) {
    const keptName = HAND_DEFINITIONS[bestHandWithKept]?.name ?? bestHandWithKept;
    return `Discard ${discardCards.length} low-value cards. Best kept hand: ${keptName}.`;
  }

  return `Discard ${discardCards.length} card(s). Estimated improvement: +${Math.round(improvement)}.`;
}

// ─── Deduplication ──────────────────────────────────────────────

function deduplicateOptions(options: DiscardOption[]): DiscardOption[] {
  const seen = new Set<string>();
  const result: DiscardOption[] = [];

  for (const opt of options) {
    // Key by discard size + target hand type
    const key = `${opt.discardIndices.length}_${opt.targetHandTypes[0] ?? 'none'}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(opt);
    }
  }

  return result;
}

// ─── MC-EV Refined Discard Analysis ─────────────────────────────

export interface MCDiscardOption extends DiscardOption {
  /** Monte Carlo estimated expected value (accurate, replaces heuristic estimatedScore) */
  mcExpectedValue: number;
  /** Number of MC samples used */
  mcSamples: number;
  /** Hand type probabilities from MC sampling */
  mcHandProbabilities: Partial<Record<HandType, number>>;
  /** Min/max scores observed in MC */
  mcMinScore: number;
  mcMaxScore: number;
}

/**
 * Enhanced discard analysis: runs the existing heuristic analysis first,
 * then refines the top candidates with Monte Carlo EV estimation using
 * actual deck composition sampling.
 */
export function analyzeDiscardsMC(
  state: GameState,
  config?: {
    maxOptions?: number;
    maxDiscardSize?: number;
    minKeptCards?: number;
    /** Number of top heuristic candidates to refine with MC EV */
    mcRefineCount?: number;
    /** Number of MC samples per candidate */
    mcSamples?: number;
  },
  searchConfig?: Partial<SearchConfig>,
  scoreOptions?: ScoreOptions,
): MCDiscardOption[] {
  // Step 1: Run heuristic analysis
  const heuristic = analyzeDiscards(state, config, searchConfig, scoreOptions);

  // Step 2: Build draw pool
  const pool = buildAvailableCardPool(state.deckComposition);
  if (pool.length === 0) {
    return heuristic.options.slice(0, config?.mcRefineCount ?? 5).map(opt => ({
      ...opt,
      mcExpectedValue: opt.estimatedScore,
      mcSamples: 0,
      mcHandProbabilities: {},
      mcMinScore: opt.keptScore,
      mcMaxScore: opt.estimatedScore,
    }));
  }

  // Step 3: Refine top candidates with MC EV
  const refineCount = config?.mcRefineCount ?? 5;
  const mcSamples = config?.mcSamples ?? 50;
  const topCandidates = heuristic.options.slice(0, refineCount);

  const refined: MCDiscardOption[] = [];

  for (const candidate of topCandidates) {
    const evResult = computeDiscardEV(
      state, candidate.discardIndices, pool,
      mcSamples, searchConfig, scoreOptions,
    );

    // Determine most likely target hand
    const topHand = (Object.entries(evResult.handProbabilities) as [HandType, number][])
      .sort((a, b) => b[1] - a[1])[0];

    refined.push({
      ...candidate,
      mcExpectedValue: evResult.expectedValue,
      mcSamples: evResult.samplesEvaluated,
      mcHandProbabilities: evResult.handProbabilities,
      mcMinScore: evResult.minScore,
      mcMaxScore: evResult.maxScore,
      estimatedScore: evResult.expectedValue, // override heuristic with real EV
      improvement: evResult.expectedValue - heuristic.baselineScore,
      targetHandTypes: topHand ? [topHand[0], ...candidate.targetHandTypes] : candidate.targetHandTypes,
      rationale: topHand
        ? `${candidate.rationale} (MC-EV: ${formatScoreBrief(evResult.expectedValue)}, ` +
          `${(topHand[1] * 100).toFixed(0)}% chance of ${HAND_DEFINITIONS[topHand[0]]?.name ?? topHand[0]})`
        : `${candidate.rationale} (MC-EV: ${formatScoreBrief(evResult.expectedValue)})`,
    });
  }

  refined.sort((a, b) => b.mcExpectedValue - a.mcExpectedValue);
  return refined;
}

function formatScoreBrief(score: number): string {
  if (!Number.isFinite(score)) return score.toString();
  if (score < 1000) return score.toFixed(0);
  if (score < 1_000_000) return (score / 1000).toFixed(1) + 'K';
  if (score < 1_000_000_000) return (score / 1_000_000).toFixed(1) + 'M';
  return (score / 1_000_000_000).toFixed(1) + 'B';
}

// ─── Quick Discard Suggestion ───────────────────────────────────

export interface QuickDiscardSuggestion {
  discardIndices: number[];
  discardCards: Card[];
  reason: string;
}

/**
 * Fast discard recommendation without full analysis.
 * Useful for UI quick tips.
 */
export function quickDiscardTip(
  state: GameState,
  jokerModifiers?: JokerModifiers
): QuickDiscardSuggestion | null {
  const mods = jokerModifiers ?? getJokerModifiers(state.jokers);
  const cards = state.handCards;
  if (cards.length === 0) return null;

  // Identify the best hand type possible
  const bestHand = recognizeHand(cards, mods);
  const scoringCards = cards.filter(c => !isStone(c));

  // If we already have a good hand (four of a kind or better), suggest keeping it
  const highTierHands: HandType[] = [
    HandType.FourOfAKind, HandType.StraightFlush, HandType.RoyalFlush,
    HandType.FiveOfAKind, HandType.FlushHouse, HandType.FlushFive,
  ];

  if (highTierHands.includes(bestHand)) {
    return null; // Hand is already excellent
  }

  // Find "bad" cards to discard: low-rank non-scoring cards
  const lowValueIndices: number[] = [];
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (isStone(c)) continue; // Keep stones
    // Discard cards that don't contribute to pairs/flushes (including enhanced/sealed/editioned)
    const sameRankCount = scoringCards.filter(sc => sc.rank === c.rank).length;
    if (sameRankCount < 2) {
      lowValueIndices.push(i);
    }
  }

  if (lowValueIndices.length === 0) return null;

  // Take the worst few cards (lowest chips value)
  const discardSorted = lowValueIndices
    .sort((a, b) => rankToChips(cards[a].rank) - rankToChips(cards[b].rank))
    .slice(0, Math.min(5, lowValueIndices.length));

  return {
    discardIndices: discardSorted,
    discardCards: discardSorted.map(i => cards[i]),
    reason: `Discard ${discardSorted.length} low-value card(s) to draw for a better hand.`,
  };
}

