import type {
  Card, GameState, JokerInstance, HandLevels,
  DeckComposition, ScoringBreakdown,
} from './types';
import { HandType, BlindType, Rank, Suit, ALL_RANKS, ALL_SUITS, CardEdition } from './types';
import { getBlindBaseChips } from './constants';
import { findOptimalPlay } from './search';
import type { SearchConfig } from './search';
import { quickDiscardTip } from './discard-analyzer';
import { generateShop } from './shop';
import { getJoker } from './joker-effects';

// ─── Types ──────────────────────────────────────────────────────

export interface RunConfig {
  maxAntes: number;
  enableShop: boolean;
  seed?: number;
  handSelectionStrategy: 'auto' | 'first';
  randomBosses?: boolean;
}

export interface RoundResult {
  ante: number;
  blindType: BlindType;
  blindName: string;
  bossId: string | null;
  chipsRequired: number;
  handTypePlayed: HandType;
  cardsPlayed: Card[];
  cardsHeld: Card[];
  totalScore: number;
  blindBeaten: boolean;
  handsUsed: number;
  discardsUsed: number;
  scoreBreakdown: ScoringBreakdown;
  jokersAtRound: JokerInstance[];
  handLevelsAtRound: HandLevels;
  roundEarnings: number;
  cumulativeDollars: number;
}

export interface RunResult {
  config: RunConfig;
  rounds: RoundResult[];
  totalScore: number;
  antesCleared: number;
  roundsSurvived: number;
  finalAnte: number;
  finalBlind: 'won' | 'lost' | 'in_progress';
  totalEarnings: number;
  finalDollars: number;
  startingState: GameState;
  endingState: GameState | null;
  totalSimulationTimeMs: number;
}

export interface BossEffect {
  maxHandsOverride?: number;
  maxDiscardsOverride?: number;
  chipsMultiplier?: number;
  debuffedSuits?: Suit[];
  debuffedRanks?: Rank[];
  noRepeatHandType?: boolean;
  halveBaseHand?: boolean;
  reduceHandLevel?: boolean;
  handSizeModifier?: number;
  drawCardsAfterPlay?: number;
  costPerCardPlayed?: number;
  restrictToFirstHandType?: boolean;
  mustPlayFiveCards?: boolean;
  resetMoneyOnMostPlayedHand?: boolean;
  debuffRandomCardsInHand?: number;
  debuffScoredCardsThisAnte?: boolean;
  disableRandomJoker?: boolean;
  shuffleJokers?: boolean;
  forceRandomCard?: boolean;
  debuffAllCardsUntilSell?: boolean;
}

export interface BossBlindDef {
  id: string;
  name: string;
  effect: BossEffect;
}

export interface AnteBlindDef {
  ante: number;
  smallChips: number;
  bigChips: number;
  bossChips: number;
  bossId: string;
  bossName: string;
}

// ─── Default Config ──────────────────────────────────────────────

const DEFAULT_RUN_CONFIG: RunConfig = {
  maxAntes: 3,
  enableShop: false,
  handSelectionStrategy: 'auto',
};

// ─── Seeded RNG (Linear Congruential) ────────────────────────────

function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ─── Boss Blind Definitions ──────────────────────────────────────

export const BOSS_BLINDS: Record<string, BossBlindDef> = {
  the_needle: {
    id: 'the_needle',
    name: 'The Needle',
    effect: { maxHandsOverride: 1 },
  },
  the_eye: {
    id: 'the_eye',
    name: 'The Eye',
    effect: { noRepeatHandType: true },
  },
  the_wall: {
    id: 'the_wall',
    name: 'The Wall',
    effect: { chipsMultiplier: 4 },
  },
  the_water: {
    id: 'the_water',
    name: 'The Water',
    effect: { maxDiscardsOverride: 0 },
  },
  the_arm: {
    id: 'the_arm',
    name: 'The Arm',
    effect: { reduceHandLevel: true },
  },
  the_flint: {
    id: 'the_flint',
    name: 'The Flint',
    effect: { halveBaseHand: true },
  },
  the_manacle: {
    id: 'the_manacle',
    name: 'The Manacle',
    effect: { handSizeModifier: -1 },
  },
  the_serpent: {
    id: 'the_serpent',
    name: 'The Serpent',
    effect: { drawCardsAfterPlay: 3 },
  },
  // Easy debuff blinds
  the_club: {
    id: 'the_club',
    name: 'The Club',
    effect: { debuffedSuits: [Suit.Clubs] },
  },
  the_goad: {
    id: 'the_goad',
    name: 'The Goad',
    effect: { debuffedSuits: [Suit.Spades] },
  },
  the_head: {
    id: 'the_head',
    name: 'The Head',
    effect: { debuffedSuits: [Suit.Hearts] },
  },
  the_window: {
    id: 'the_window',
    name: 'The Window',
    effect: { debuffedSuits: [Suit.Diamonds] },
  },
  the_plant: {
    id: 'the_plant',
    name: 'The Plant',
    effect: { debuffedRanks: [Rank.Jack, Rank.Queen, Rank.King] },
  },
  the_tooth: {
    id: 'the_tooth',
    name: 'The Tooth',
    effect: { costPerCardPlayed: 1 },
  },
  violet_vessel: {
    id: 'violet_vessel',
    name: 'Violet Vessel',
    effect: { chipsMultiplier: 6 },
  },
  // Medium complexity blinds
  the_mouth: {
    id: 'the_mouth',
    name: 'The Mouth',
    effect: { restrictToFirstHandType: true },
  },
  the_psychic: {
    id: 'the_psychic',
    name: 'The Psychic',
    effect: { mustPlayFiveCards: true },
  },
  the_ox: {
    id: 'the_ox',
    name: 'The Ox',
    effect: { resetMoneyOnMostPlayedHand: true },
  },
  // No-op blinds (face-down mechanics, no effect on perfect-information simulator)
  the_fish: {
    id: 'the_fish',
    name: 'The Fish',
    effect: {},
  },
  the_house: {
    id: 'the_house',
    name: 'The House',
    effect: {},
  },
  the_mark: {
    id: 'the_mark',
    name: 'The Mark',
    effect: {},
  },
  the_wheel: {
    id: 'the_wheel',
    name: 'The Wheel',
    effect: {},
  },
  the_hook: {
    id: 'the_hook',
    name: 'The Hook',
    effect: { debuffRandomCardsInHand: 2 },
  },
  the_pillar: {
    id: 'the_pillar',
    name: 'The Pillar',
    effect: { debuffScoredCardsThisAnte: true },
  },
  verdant_leaf: {
    id: 'verdant_leaf',
    name: 'Verdant Leaf',
    effect: { debuffAllCardsUntilSell: true },
  },
  crimson_heart: {
    id: 'crimson_heart',
    name: 'Crimson Heart',
    effect: { disableRandomJoker: true },
  },
  cerulean_bell: {
    id: 'cerulean_bell',
    name: 'Cerulean Bell',
    effect: { forceRandomCard: true },
  },
  amber_acorn: {
    id: 'amber_acorn',
    name: 'Amber Acorn',
    effect: { shuffleJokers: true },
  },
};

// Boss pool for random selection (all 28 implemented bosses)
export const BOSS_POOL: string[] = [
  'the_needle', 'the_eye', 'the_wall', 'the_water',
  'the_arm', 'the_flint', 'the_manacle', 'the_serpent',
  'the_club', 'the_goad', 'the_head', 'the_window',
  'the_plant', 'the_tooth', 'violet_vessel',
  'the_mouth', 'the_psychic', 'the_ox',
  'the_fish', 'the_house', 'the_mark', 'the_wheel',
  'the_hook', 'the_pillar', 'verdant_leaf',
  'crimson_heart', 'cerulean_bell', 'amber_acorn',
];

// Boss rotation per ante (index = ante-1)
const BOSS_ROTATION: string[] = [
  'the_needle',   // Ante 1
  'the_eye',      // Ante 2
  'the_wall',     // Ante 3
  'the_water',    // Ante 4
  'the_arm',      // Ante 5
  'the_flint',    // Ante 6
  'the_manacle',  // Ante 7
  'the_serpent',  // Ante 8
];

// ─── Ante/Blind Progression ──────────────────────────────────────

export function getAnteBlindDef(ante: number): AnteBlindDef {
  const bossId = BOSS_ROTATION[Math.min(ante, BOSS_ROTATION.length) - 1] ?? 'the_needle';
  const bossDef = BOSS_BLINDS[bossId];
  return {
    ante,
    smallChips: getBlindBaseChips(ante, 'small'),
    bigChips: getBlindBaseChips(ante, 'big'),
    bossChips: getBlindBaseChips(ante, 'boss'),
    bossId,
    bossName: bossDef?.name ?? 'Unknown Boss',
  };
}

export function getBossEffect(bossId: string): BossEffect {
  return BOSS_BLINDS[bossId]?.effect ?? {};
}

// ─── Hand Drawing ────────────────────────────────────────────────

export interface DrawResult {
  cards: Card[];
  deck: DeckComposition;
}

function pickRandomFromCounts<T extends string>(
  counts: Partial<Record<T, number>> | undefined,
  rng: () => number,
): T {
  if (!counts) return 'none' as T;
  const entries = Object.entries(counts) as [T, number][];
  const available = entries.filter(([, count]) => (count as number) > 0);
  if (available.length === 0) return 'none' as T;
  const totalWeight = available.reduce((sum, [, count]) => sum + (count as number), 0);
  let rand = rng() * totalWeight;
  for (const [key, count] of available) {
    rand -= count as number;
    if (rand <= 0) return key;
  }
  return available[available.length - 1][0];
}

export function drawHand(
  deck: DeckComposition,
  handSize: number,
  rng: () => number,
): DrawResult {
  const cards: Card[] = [];
  let remainingByRank = { ...deck.remainingByRank };
  let remainingBySuit = { ...deck.remainingBySuit };
  let enhancementCounts = { ...deck.enhancementCounts };
  let editionCounts = { ...deck.editionCounts };
  let sealCounts = { ...deck.sealCounts };
  let totalCards = deck.totalCards;

  const actualDraw = Math.min(handSize, totalCards);
  let cardCounter = 0;

  for (let i = 0; i < actualDraw; i++) {
    // Weighted random rank selection
    const rankEntries = ALL_RANKS.filter(r => (remainingByRank[r] ?? 0) > 0);
    if (rankEntries.length === 0) break;

    const rankWeights = rankEntries.map(r => remainingByRank[r] ?? 0);
    const totalRankWeight = rankWeights.reduce((a, b) => a + b, 0);
    let randRank = rng() * totalRankWeight;
    let selectedRank = rankEntries[0];
    for (let j = 0; j < rankEntries.length; j++) {
      randRank -= rankWeights[j];
      if (randRank <= 0) {
        selectedRank = rankEntries[j];
        break;
      }
    }

    // Select a suit that still has this rank available
    const suitEntries = ALL_SUITS.filter(s => (remainingBySuit[s] ?? 0) > 0);
    const suitWeights = suitEntries.map(s => remainingBySuit[s] ?? 0);
    const totalSuitWeight = suitWeights.reduce((a, b) => a + b, 0);
    let randSuit = rng() * totalSuitWeight;
    let selectedSuit = suitEntries[0];
    for (let j = 0; j < suitEntries.length; j++) {
      randSuit -= suitWeights[j];
      if (randSuit <= 0) {
        selectedSuit = suitEntries[j];
        break;
      }
    }

    const selectedEnhancement = pickRandomFromCounts(enhancementCounts, rng);
    const selectedEdition = pickRandomFromCounts(editionCounts, rng);
    const selectedSeal = pickRandomFromCounts(sealCounts, rng);

    cards.push({
      id: `sim_${selectedRank}_${selectedSuit}_${cardCounter++}`,
      rank: selectedRank,
      suit: selectedSuit,
      enhancement: selectedEnhancement,
      edition: selectedEdition,
      seal: selectedSeal,
      debuffed: false,
    });

    remainingByRank[selectedRank] = Math.max(0, (remainingByRank[selectedRank] ?? 0) - 1);
    remainingBySuit[selectedSuit] = Math.max(0, (remainingBySuit[selectedSuit] ?? 0) - 1);
    enhancementCounts[selectedEnhancement] = Math.max(0, (enhancementCounts[selectedEnhancement] ?? 0) - 1);
    editionCounts[selectedEdition] = Math.max(0, (editionCounts[selectedEdition] ?? 0) - 1);
    sealCounts[selectedSeal] = Math.max(0, (sealCounts[selectedSeal] ?? 0) - 1);
    totalCards--;
  }

  return {
    cards,
    deck: {
      ...deck,
      totalCards,
      remainingByRank,
      remainingBySuit,
      enhancementCounts,
      editionCounts,
      sealCounts,
    },
  };
}

// ─── Economics ───────────────────────────────────────────────────

export function calculateInterest(dollars: number, jokerIds?: string[]): number {
  const cap = jokerIds?.includes('to_the_moon') ? 10 : 5;
  return Math.min(cap, Math.floor(dollars / 5));
}

export function calculateRoundEarnings(dollars: number, _handsUsed: number, blindBeaten: boolean, jokerIds?: string[]): number {
  if (!blindBeaten) return 0;
  const base = 3;
  const interest = calculateInterest(dollars, jokerIds);
  return base + interest;
}

export interface JokerIncomeInput {
  jokers: JokerInstance[];
  deck: DeckComposition;
  discardsUsed: number;
  maxDiscards: number;
  cumulativeDollars: number;
  playedCards: Card[];
  heldCards: Card[];
  roundNumber: number;
  totalCardsDiscarded: number;
}

export function calculateJokerIncome(input: JokerIncomeInput): number {
  let income = 0;

  for (const joker of input.jokers) {
    switch (joker.id) {
      case 'golden':
        income += 4;
        break;
      case 'rocket':
        income += 1 + (input.roundNumber - 1) * 2;
        break;
      case 'delayed_gratification':
        income += 2 * (input.maxDiscards - input.discardsUsed);
        break;
      case 'cloud_9': {
        const nineCount = input.deck.remainingByRank[Rank.Nine] ?? 0;
        income += nineCount;
        break;
      }
      case 'rough_gem': {
        const diamondCount = input.deck.remainingBySuit[Suit.Diamonds] ?? 0;
        income += diamondCount;
        break;
      }
      case 'gift':
        income += input.discardsUsed;
        break;
      case 'reserved_parking': {
        const heldFaceCards = input.heldCards.filter(c => c.rank === Rank.Jack || c.rank === Rank.Queen || c.rank === Rank.King).length;
        income += Math.round(heldFaceCards * 0.5);
        break;
      }
      case 'business': {
        const playedFaceCards = input.playedCards.filter(c => c.rank === Rank.Jack || c.rank === Rank.Queen || c.rank === Rank.King).length;
        income += Math.round(playedFaceCards * 0.5 * 2);
        break;
      }
      case 'mail':
        income += input.totalCardsDiscarded;
        break;
    }
  }

  return income;
}

// ─── State Cloning ──────────────────────────────────────────────

function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    handCards: state.handCards.map(c => ({ ...c })),
    jokers: state.jokers.map(j => ({ ...j })),
    handLevels: { ...state.handLevels },
    deckComposition: {
      ...state.deckComposition,
      remainingByRank: { ...state.deckComposition.remainingByRank },
      remainingBySuit: { ...state.deckComposition.remainingBySuit },
      enhancementCounts: { ...state.deckComposition.enhancementCounts },
      editionCounts: { ...state.deckComposition.editionCounts },
      sealCounts: { ...state.deckComposition.sealCounts },
    },
    blind: { ...state.blind },
    roundState: { ...state.roundState },
    flags: { ...state.flags, playedHandsThisRound: [...(state.flags.playedHandsThisRound ?? [])] },
  };
}

function cloneJokers(jokers: JokerInstance[]): JokerInstance[] {
  return jokers.map(j => ({ ...j }));
}

function cloneHandLevels(levels: HandLevels): HandLevels {
  return { ...levels };
}

// ─── Main Simulator ──────────────────────────────────────────────

export function simulateRun(
  startingState: GameState,
  config: Partial<RunConfig> = {},
): RunResult {
  const startTime = performance.now();
  const cfg = { ...DEFAULT_RUN_CONFIG, ...config };
  const rng = createRng(cfg.seed ?? Date.now());

  const searchConfig: Partial<SearchConfig> = {
    includeJokerOrdering: true,
    smartOrdering: true,
    maxComputationMs: 2000,
  };

  const rounds: RoundResult[] = [];
  let state = cloneGameState(startingState);
  let cumulativeDollars = state.roundState.dollars;
  const runHandCounts: Partial<Record<HandType, number>> = {};

  let finalAnte = 1;
  let finalBlind: 'won' | 'lost' | 'in_progress' = 'in_progress';
  let totalEarnings = 0;

  anteLoop:
  for (let ante = 1; ante <= cfg.maxAntes; ante++) {
    finalAnte = ante;
    const anteDef = getAnteBlindDef(ante);
    const cardsScoredThisAnte = new Set<string>();

    // Select boss: random from pool if configured, otherwise fixed rotation
    const bossId = cfg.randomBosses
      ? BOSS_POOL[Math.floor(rng() * BOSS_POOL.length)]
      : anteDef.bossId;

    const blinds: { type: BlindType; chips: number; bossId: string | null }[] = [
      { type: BlindType.Small, chips: anteDef.smallChips, bossId: null },
      { type: BlindType.Big, chips: anteDef.bigChips, bossId: null },
      { type: BlindType.Boss, chips: anteDef.bossChips, bossId },
    ];

    for (const blind of blinds) {
      if (state.deckComposition.totalCards <= 0) {
        finalBlind = 'lost';
        break anteLoop;
      }

      const bossEffect = blind.bossId ? getBossEffect(blind.bossId) : {};
      const bossMultiplier = bossEffect.chipsMultiplier ?? 1;
      const chipsRequired = Math.round(blind.chips * bossMultiplier);

      // Apply boss effect overrides
      const maxHands = bossEffect.maxHandsOverride ?? state.roundState.maxHands;
      const maxDiscards = bossEffect.maxDiscardsOverride ?? state.roundState.maxDiscards;
      let handSize = state.roundState.handSize;
      if (bossEffect.handSizeModifier) {
        handSize = Math.max(1, handSize + bossEffect.handSizeModifier);
      }
      let handsPlayed = 0;
      let discardsUsed = 0;
      let totalCardsDiscardedThisBlind = 0;
      let handLevels = cloneHandLevels(state.handLevels);
      const playedHandTypesThisBlind: HandType[] = [];

      // Deal hand
      const draw = drawHand(state.deckComposition, handSize, rng);
      let currentHandCards = draw.cards;
      let currentDeck = draw.deck;

      // Mark debuffed cards from boss effect (suit/rank debuffs)
      const debuffRanks = bossEffect.debuffedRanks;
      const debuffSuits = bossEffect.debuffedSuits;
      if (debuffRanks || debuffSuits || cardsScoredThisAnte.size > 0) {
        for (const card of currentHandCards) {
          if ((debuffRanks && debuffRanks.includes(card.rank)) ||
              (debuffSuits && debuffSuits.includes(card.suit)) ||
              cardsScoredThisAnte.has(card.id)) {
            card.debuffed = true;
          }
        }
      }

      // Boss effect: Verdant Leaf — all cards debuffed until joker sold
      let verdantDebuffActive = false;
      if (bossEffect.debuffAllCardsUntilSell) {
        if (state.jokers.length > 0) {
          // Auto-sell first joker to clear debuff
          const soldJoker = state.jokers.shift()!;
          const def = getJoker(soldJoker.id);
          const sellValue = def ? Math.floor(def.cost / 2) : 1;
          cumulativeDollars += sellValue;
        } else {
          verdantDebuffActive = true;
          for (const card of currentHandCards) {
            card.debuffed = true;
          }
        }
      }

      // Boss effect: Cerulean Bell — force a random card to always be selected
      let forcedCardId: string | undefined;
      if (bossEffect.forceRandomCard && currentHandCards.length > 0) {
        forcedCardId = currentHandCards[Math.floor(rng() * currentHandCards.length)].id;
      }

      let blindBeaten = false;
      let finalScoredPlay: ScoringBreakdown | null = null;
      let finalHandType = HandType.HighCard;
      let finalCardsPlayed: Card[] = [];
      let finalCardsHeld: Card[] = [];

      const jokersAtRound = cloneJokers(state.jokers);

      // Boss effect: Amber Acorn — shuffle jokers
      if (bossEffect.shuffleJokers && state.jokers.length > 1) {
        for (let i = state.jokers.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [state.jokers[i], state.jokers[j]] = [state.jokers[j], state.jokers[i]];
        }
      }

      // Boss effect: Crimson Heart — disable one random joker
      let disabledJokerIndex = -1;
      if (bossEffect.disableRandomJoker && state.jokers.length > 0) {
        disabledJokerIndex = Math.floor(rng() * state.jokers.length);
      }

      // Build effective jokers list (exclude disabled joker)
      const effectiveJokers = disabledJokerIndex >= 0
        ? state.jokers.filter((_, i) => i !== disabledJokerIndex)
        : state.jokers;

      // Apply halve base hand effect (The Flint)
      const effectiveHandLevels = cloneHandLevels(handLevels);
      if (bossEffect.halveBaseHand) {
        for (const ht of Object.values(HandType)) {
          effectiveHandLevels[ht] = Math.max(1, Math.floor(handLevels[ht] / 2));
        }
      }

      // Play/discard loop
      for (let handAttempt = 0; handAttempt < maxHands; handAttempt++) {
        if (currentHandCards.length === 0) break;

        const roundState = {
          ...state.roundState,
          handsPlayed,
          discardsUsed,
          maxHands,
          maxDiscards,
          handSize,
          isFinalHand: handAttempt === maxHands - 1,
        };

        const playState: GameState = {
          ...state,
          jokers: effectiveJokers,
          handCards: currentHandCards,
          deckComposition: currentDeck,
          handLevels: effectiveHandLevels,
          roundState,
          blind: {
            type: blind.type,
            chipsRequired,
            debuffedRanks: bossEffect.debuffedRanks ?? [],
            debuffedSuits: bossEffect.debuffedSuits ?? [],
            bossId: blind.bossId ?? undefined,
            forbiddenHandTypes: bossEffect.noRepeatHandType ? playedHandTypesThisBlind : undefined,
            forcedHandType: bossEffect.restrictToFirstHandType && playedHandTypesThisBlind.length > 0 ? playedHandTypesThisBlind[0] : undefined,
            mustPlayFiveCards: bossEffect.mustPlayFiveCards,
            forcedCardId,
          },
          flags: {
            ...state.flags,
            playedHandsThisRound: playedHandTypesThisBlind,
          },
        };

        const optimal = findOptimalPlay(playState, searchConfig);
        if (!optimal) {
          // No valid play found
          break;
        }

        finalScoredPlay = optimal.breakdown;
        finalHandType = optimal.handType;
        finalCardsPlayed = optimal.playedCards;
        finalCardsHeld = optimal.heldCards;

        const score = optimal.totalScore;

        // Check if blind is beaten
        if (score >= chipsRequired) {
          blindBeaten = true;
          break;
        }

        handsPlayed++;

        // Boss effect: The Eye - record played hand type for repeat check
        if (bossEffect.noRepeatHandType) {
          playedHandTypesThisBlind.push(optimal.handType);
        }

        // Boss effect: The Mouth - first hand type becomes the only allowed type
        if (bossEffect.restrictToFirstHandType && playedHandTypesThisBlind.length === 0) {
          playedHandTypesThisBlind.push(optimal.handType);
        }

        // Boss effect: The Arm - reduce hand level
        if (bossEffect.reduceHandLevel) {
          effectiveHandLevels[optimal.handType] = Math.max(1, effectiveHandLevels[optimal.handType] - 1);
        }

        // Boss effect: The Serpent - draw +3 cards after each hand played
        if (bossEffect.drawCardsAfterPlay && bossEffect.drawCardsAfterPlay > 0) {
          const extraDraw = drawHand(currentDeck, bossEffect.drawCardsAfterPlay, rng);
          if (verdantDebuffActive) {
            for (const card of extraDraw.cards) card.debuffed = true;
          }
          currentHandCards = [...currentHandCards, ...extraDraw.cards];
          currentDeck = extraDraw.deck;
        }

        // Boss effect: The Tooth - lose $1 per card played
        if (bossEffect.costPerCardPlayed) {
          cumulativeDollars = Math.max(0, cumulativeDollars - bossEffect.costPerCardPlayed * optimal.playedCards.length);
        }

        // Boss effect: The Ox - track hand type counts, reset money if playing most-used type
        if (bossEffect.resetMoneyOnMostPlayedHand) {
          runHandCounts[optimal.handType] = (runHandCounts[optimal.handType] ?? 0) + 1;
          let maxCount = 0;
          for (const count of Object.values(runHandCounts)) {
            if (count > maxCount) maxCount = count;
          }
          if ((runHandCounts[optimal.handType] ?? 0) >= maxCount && maxCount > 1) {
            cumulativeDollars = 0;
          }
        }

        // Boss effect: The Hook — debuff N random cards in hand after each play
        if (bossEffect.debuffRandomCardsInHand) {
          const remainingIndices = currentHandCards
            .map((c, i) => c.debuffed ? -1 : i)
            .filter(i => i >= 0);
          const count = Math.min(bossEffect.debuffRandomCardsInHand, remainingIndices.length);
          for (let h = 0; h < count; h++) {
            const pick = Math.floor(rng() * remainingIndices.length);
            currentHandCards[remainingIndices[pick]].debuffed = true;
            remainingIndices.splice(pick, 1);
          }
        }

        // Boss effect: The Pillar — record scored cards for ante-scope debuff
        if (bossEffect.debuffScoredCardsThisAnte) {
          for (const card of optimal.playedCards) {
            cardsScoredThisAnte.add(card.id);
          }
        }

        // Try discarding if available
        if (discardsUsed < maxDiscards) {
          const tip = quickDiscardTip(
            { ...playState, roundState: { ...roundState, handsPlayed, discardsUsed } },
          );
          if (tip && tip.discardIndices.length > 0) {
            totalCardsDiscardedThisBlind += tip.discardIndices.length;
            // Remove discarded cards
            const newHand = currentHandCards.filter((_, i) => !tip.discardIndices.includes(i));
            // Draw replacements
            const redraw = drawHand(currentDeck, handSize - newHand.length, rng);
            currentHandCards = [...newHand, ...redraw.cards];
            currentDeck = redraw.deck;
            // Mark newly drawn debuffed cards
            if (debuffRanks || debuffSuits || cardsScoredThisAnte.size > 0 || verdantDebuffActive) {
              for (const card of redraw.cards) {
                if (verdantDebuffActive ||
                    (debuffRanks && debuffRanks.includes(card.rank)) ||
                    (debuffSuits && debuffSuits.includes(card.suit)) ||
                    cardsScoredThisAnte.has(card.id)) {
                  card.debuffed = true;
                }
              }
            }
          }
          discardsUsed++;
        }
      }

      // Record round result
      if (finalScoredPlay) {
        const blindName = blind.bossId
          ? (BOSS_BLINDS[blind.bossId]?.name ?? 'Boss Blind')
          : (blind.type === BlindType.Small ? 'Small Blind' :
             blind.type === BlindType.Big ? 'Big Blind' : 'Boss Blind');

        const jokerIds = state.jokers.map(j => j.id);
        const baseEarnings = calculateRoundEarnings(cumulativeDollars, handsPlayed, blindBeaten, jokerIds);
        const jokerIncome = blindBeaten ? calculateJokerIncome({
          jokers: state.jokers,
          deck: currentDeck,
          discardsUsed,
          maxDiscards,
          cumulativeDollars,
          playedCards: finalCardsPlayed,
          heldCards: finalCardsHeld,
          roundNumber: ante,
          totalCardsDiscarded: totalCardsDiscardedThisBlind,
        }) : 0;
        const earnings = baseEarnings + jokerIncome;
        totalEarnings += earnings;
        cumulativeDollars += earnings;

        rounds.push({
          ante,
          blindType: blind.type,
          blindName,
          bossId: blind.bossId,
          chipsRequired,
          handTypePlayed: finalHandType,
          cardsPlayed: finalCardsPlayed,
          cardsHeld: finalCardsHeld,
          totalScore: finalScoredPlay.finalScore,
          blindBeaten,
          handsUsed: handsPlayed + 1,
          discardsUsed,
          scoreBreakdown: finalScoredPlay,
          jokersAtRound,
          handLevelsAtRound: cloneHandLevels(effectiveHandLevels),
          roundEarnings: earnings,
          cumulativeDollars,
        });

        if (!blindBeaten) {
          finalBlind = 'lost';
          break anteLoop;
        }
      } else {
        // No valid play at all
        rounds.push({
          ante,
          blindType: blind.type,
          blindName: blind.bossId ? (BOSS_BLINDS[blind.bossId]?.name ?? 'Boss Blind') : 'Small Blind',
          bossId: blind.bossId,
          chipsRequired,
          handTypePlayed: HandType.HighCard,
          cardsPlayed: [],
          cardsHeld: [],
          totalScore: 0,
          blindBeaten: false,
          handsUsed: 0,
          discardsUsed: 0,
          scoreBreakdown: { finalScore: 0 } as ScoringBreakdown,
          jokersAtRound,
          handLevelsAtRound: cloneHandLevels(effectiveHandLevels),
          roundEarnings: 0,
          cumulativeDollars,
        });
        finalBlind = 'lost';
        break anteLoop;
      }

      // Update state for next blind
      state.handLevels = effectiveHandLevels;
      state.deckComposition = currentDeck;
      state.roundState.dollars = cumulativeDollars;

      // Shop phase (only if blind beaten)
      if (blindBeaten && cfg.enableShop) {
        try {
          const shop = generateShop(state, cumulativeDollars);

          // Sort affordable (non-pack) items by utility/dollar
          const affordableItems = shop.state.slots
            .filter(s => s.item && s.item.price <= cumulativeDollars && s.itemType !== 'pack')
            .map(s => ({
              slot: s,
              utilityPerDollar: s.item!.price > 0
                ? ((s.item as { utilityFn?: (gs: GameState) => number }).utilityFn?.(state) ?? 0) / s.item!.price
                : 0,
            }))
            .sort((a, b) => b.utilityPerDollar - a.utilityPerDollar);

          // Reroll if no good items available and we have money
          let shopRerolls = 0;
          const MAX_REROLLS = 2;
          while (affordableItems.length === 0 && shopRerolls < MAX_REROLLS && cumulativeDollars >= shop.state.rerollCost + 3) {
            cumulativeDollars -= shop.state.rerollCost;
            shopRerolls++;
            const newShop = generateShop(state, cumulativeDollars);
            const newAffordable = newShop.state.slots
              .filter(s => s.item && s.item.price <= cumulativeDollars && s.itemType !== 'pack');
            affordableItems.push(...newAffordable.map(s => ({
              slot: s,
              utilityPerDollar: s.item!.price > 0
                ? ((s.item as { utilityFn?: (gs: GameState) => number }).utilityFn?.(state) ?? 0) / s.item!.price
                : 0,
            })));
            affordableItems.sort((a, b) => b.utilityPerDollar - a.utilityPerDollar);
          }

          // Buy best items (up to 3 purchases, keeping at least $5 reserve)
          const MAX_PURCHASES = 3;
          let purchases = 0;
          for (const item of affordableItems) {
            if (purchases >= MAX_PURCHASES) break;
            const price = item.slot.item!.price;
            if (price > cumulativeDollars - 5) continue; // Keep $5 reserve minimum

            cumulativeDollars -= price;
            purchases++;

            const slot = item.slot;
            if (slot.itemType === 'joker' && 'jokerId' in slot.item!) {
              if (state.jokers.length < 7) {
                state.jokers.push({ id: slot.item.jokerId, edition: CardEdition.None });
              }
            } else if (slot.itemType === 'planet' && 'handType' in slot.item!) {
              const handType = slot.item.handType;
              state.handLevels[handType] = (state.handLevels[handType] ?? 1) + 1;
              effectiveHandLevels[handType] = state.handLevels[handType];
            } else if (slot.itemType === 'tarot' && 'id' in slot.item!) {
              const tarotId = slot.item.id;
              if (tarotId === 'the_hermit') {
                cumulativeDollars += Math.min(cumulativeDollars, 20);
              } else if (tarotId === 'temperance') {
                // Total sell value of jokers (max $50)
                let sellValue = 0;
                for (const j of state.jokers) {
                  const def = getJoker(j.id);
                  if (def) sellValue += Math.floor(def.cost / 2);
                }
                cumulativeDollars += Math.min(sellValue, 50);
              }
              // Other tarot effects skipped (too complex for auto-sim)
            } else if (slot.itemType === 'voucher') {
              // Apply voucher effects
              const voucherId = ('id' in slot.item!) ? slot.item.id : '';
              switch (voucherId) {
                case 'grabber':
                case 'nacho_tong':
                  state.roundState.maxHands += 1;
                  break;
                case 'wasteful':
                case 'recyclomancy':
                  state.roundState.maxDiscards += 1;
                  break;
                case 'paint_brush':
                case 'palette':
                  state.roundState.handSize += 1;
                  break;
              }
            }
          }
          state.roundState.dollars = cumulativeDollars;
        } catch {
          // Shop generation may fail; skip
        }
      }

      // Reset for next blind
      state.handCards = [];
    }

    // All 3 blinds beaten for this ante
    finalBlind = 'won';
  }

  // Final state snapshot
  const endingState = cloneGameState(state);
  endingState.roundState.dollars = cumulativeDollars;

  // Calculate totals
  const totalScore = rounds.reduce((sum, r) => sum + r.totalScore, 0);
  const beatenRounds = rounds.filter(r => r.blindBeaten).length;
  const winningAntes = rounds.filter(r => r.blindBeaten && r.blindType === BlindType.Boss).length;

  return {
    config: cfg,
    rounds,
    totalScore,
    antesCleared: winningAntes,
    roundsSurvived: beatenRounds,
    finalAnte,
    finalBlind: finalBlind === 'won' ? 'won' : finalBlind,
    totalEarnings,
    finalDollars: cumulativeDollars,
    startingState,
    endingState,
    totalSimulationTimeMs: performance.now() - startTime,
  };
}
