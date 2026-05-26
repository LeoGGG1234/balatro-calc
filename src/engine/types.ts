// ─── Primitives ────────────────────────────────────────────────

export enum Suit {
  Spades = 'S',
  Hearts = 'H',
  Clubs = 'C',
  Diamonds = 'D',
}

export enum Rank {
  Two = '2', Three = '3', Four = '4', Five = '5',
  Six = '6', Seven = '7', Eight = '8', Nine = '9',
  Ten = '10', Jack = 'J', Queen = 'Q', King = 'K', Ace = 'A',
}

export enum CardEnhancement {
  None = 'none',
  Bonus = 'bonus',      // +30 chips when scored
  Mult = 'mult',        // +4 mult when scored
  Wild = 'wild',        // counts as all suits simultaneously
  Glass = 'glass',      // x2 mult, 1/4 chance to destroy
  Steel = 'steel',      // x1.5 mult while held in hand
  Stone = 'stone',      // +50 chips, no rank/suit, not scored
  Gold = 'gold',        // $3 if held in hand at end of round
  Lucky = 'lucky',      // 1/5 chance +20 mult, 1/15 chance $20
}

export enum CardEdition {
  None = 'none',
  Foil = 'foil',           // +50 chips
  Holographic = 'holo',    // +10 mult
  Polychrome = 'poly',     // x1.5 mult
  Negative = 'negative',   // +1 joker slot (scoring irrelevant)
}

export enum Seal {
  None = 'none',
  Red = 'red',       // retrigger this card 1 extra time
  Blue = 'blue',     // create planet card at end of round if held
  Gold = 'gold',     // $3 when played and scored
  Purple = 'purple', // create tarot card when discarded
}

export enum HandType {
  HighCard = 'high_card',
  Pair = 'pair',
  TwoPair = 'two_pair',
  ThreeOfAKind = 'three_of_a_kind',
  Straight = 'straight',
  Flush = 'flush',
  FullHouse = 'full_house',
  FourOfAKind = 'four_of_a_kind',
  StraightFlush = 'straight_flush',
  RoyalFlush = 'royal_flush',
  FiveOfAKind = 'five_of_a_kind',
  FlushHouse = 'flush_house',
  FlushFive = 'flush_five',
}

export enum BlindType {
  Small = 'small',
  Big = 'big',
  Boss = 'boss',
}

export enum JokerCategory {
  Chips = 'chips',
  PlusMult = 'plus_mult',
  XMult = 'xmult',
  Retrigger = 'retrigger',
  Effect = 'effect',
  Economy = 'economy',
}

export enum JokerRarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
  Legendary = 'legendary',
}

// ─── Card ──────────────────────────────────────────────────────

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  enhancement: CardEnhancement;
  edition: CardEdition;
  seal: Seal;
  debuffed: boolean;
}

// ─── Joker ──────────────────────────────────────────────────────

export interface JokerInstance {
  id: string;           // registry key, e.g. "joker", "blueprint"
  edition: CardEdition; // foil/holo/poly on the joker itself (affects chips/mult/xmult)
}

export interface JokerDefinition {
  id: string;
  name: string;
  category: JokerCategory;
  rarity: JokerRarity;
  cost: number;
  effect: JokerEffect;
  copyable: boolean;     // can Blueprint/Brainstorm copy this?
  hasState?: boolean;
  defaultState?: Record<string, unknown>;
}

// ─── Joker Effect Model ────────────────────────────────────────

export interface ScoreAccumulator {
  chips: number;
  mult: number;
}

export interface CardScoredContext {
  card: Card;
  isFaceCard: boolean;
  isNumberCard: boolean;
  handType: HandType;
  retriggerIndex: number;  // 0 = original, 1+ = retrigger
  totalTriggers: number;   // 1 + all retriggers
}

export interface JokerEvaluateContext {
  handType: HandType;
  playedCards: Card[];
  heldInHandCards: Card[];
  handLevels: HandLevels;
  roundState: RoundState;
  flags: GameFlags;
  deckComposition: DeckComposition;
  blind: BlindInfo;
  currentScore: ScoreAccumulator;
  allJokersWithEditions: JokerInstance[];
  currentJokerIndex: number;
  currentJokerId: string;
  totalJokers: number;
}

export interface HeldInHandContext {
  handType: HandType;
  heldCards: Card[];
  playedCards: Card[];
  allJokers: JokerInstance[];
}

export type JokerEffect = {
  onCardScored?: (ctx: CardScoredContext, acc: ScoreAccumulator) => void;
  onJokerEvaluate?: (ctx: JokerEvaluateContext, acc: ScoreAccumulator) => void;
  onHeldInHand?: (ctx: HeldInHandContext, acc: ScoreAccumulator) => void;
  getRetriggers?: (card: Card, handType: HandType, allCardsFace?: boolean) => number;
  handlesHeldRetriggers?: boolean; // e.g. Mime re-triggers held effects
  resolvesDynamically?: boolean; // e.g. Blueprint/Brainstorm copy another joker
};

// ─── Hand Levels ───────────────────────────────────────────────

export type HandLevels = Record<HandType, number>; // level per hand type, default 1

// ─── Deck ──────────────────────────────────────────────────────

export interface DeckCardSlot {
  rank: Rank;
  suit: Suit;
  enhancement: CardEnhancement;
  edition: CardEdition;
  seal: Seal;
}

export interface DeckCardFilter {
  suit?: Suit;
  rank?: Rank;
  enhancement?: CardEnhancement;
  edition?: CardEdition;
  seal?: Seal;
}

export type DeckPreset = 'standard' | 'abandoned' | 'checkered';

export interface DeckComposition {
  totalCards: number;      // cards remaining in deck (not hand, not played this round)
  remainingByRank: Partial<Record<Rank, number>>;
  remainingBySuit: Partial<Record<Suit, number>>;
  /** Full-deck counts (including drawn/discarded/played cards). Used by Cloud 9, Rough Gem, etc. */
  totalByRank?: Partial<Record<Rank, number>>;
  totalBySuit?: Partial<Record<Suit, number>>;
  enhancementCounts?: Partial<Record<CardEnhancement, number>>;
  editionCounts?: Partial<Record<CardEdition, number>>;
  sealCounts?: Partial<Record<Seal, number>>;
  cards?: DeckCardSlot[];
}

// ─── Blind ──────────────────────────────────────────────────────

export interface BlindInfo {
  type: BlindType;
  chipsRequired: number;
  debuffedRanks: Rank[];
  debuffedSuits: Suit[];
  bossId?: string;
  forbiddenHandTypes?: HandType[];
  forcedHandType?: HandType;
  mustPlayFiveCards?: boolean;
  forcedCardId?: string;
}

// ─── Round State ────────────────────────────────────────────────

export interface RoundState {
  handsPlayed: number;     // how many hands played this round
  discardsUsed: number;
  dollars: number;
  antes: number;
  isFinalHand: boolean;    // last allowed hand for this blind
  maxHands: number;        // max hands allowed (default 4, modified by vouchers/boss)
  maxDiscards: number;     // max discards allowed (default 3, modified by vouchers/boss)
  handSize: number;        // current hand size (default 8, modified by vouchers/tarot cards)
}

export interface GameFlags {
  playedHandsThisRound: HandType[];
  hasDiscardedThisRound: boolean;
  firstHandThisRound: boolean;
}

// ─── Full Game State ────────────────────────────────────────────

export interface GameState {
  handCards: Card[];
  jokers: JokerInstance[];
  handLevels: HandLevels;
  deckComposition: DeckComposition;
  blind: BlindInfo;
  roundState: RoundState;
  flags: GameFlags;
}

// ─── Search & Results ──────────────────────────────────────────

export interface PlayCandidate {
  playedCards: Card[];
  heldCards: Card[];
  handType: HandType;
  jokerOrder: number[];
}

export interface ScoringBreakdown {
  baseHand: { handType: HandType; level: number; chips: number; mult: number };
  cardScores: CardScoreEntry[];
  heldInHandMult: number;
  jokerScores: JokerScoreEntry[];
  totalChips: number;
  totalMult: number;
  finalScore: number;
}

export interface CardScoreEntry {
  cardId: string;
  triggerIndex: number;
  chipsContribution: number;
  multContribution: number;
}

export interface JokerScoreEntry {
  jokerId: string;
  jokerIndex: number;
  chipsAdded: number;
  plusMult: number;
  xMult: number;
}

export interface ScoredPlay {
  playedCards: Card[];
  heldCards: Card[];
  handType: HandType;
  jokerOrder: number[];
  totalScore: number;
  breakdown: ScoringBreakdown;
}

export interface HandRanking {
  handType: HandType;
  bestScore: number;
  count: number;
}

export interface SearchResult {
  optimalPlay: ScoredPlay;
  allPlays: ScoredPlay[];
  rankedHands: HandRanking[];
  evaluationTimeMs: number;
  combinationsEvaluated: number;
  orderingsEvaluated: number;
}

export interface SearchConfig {
  includeJokerOrdering: boolean;
  maxComputationMs: number;
}

// ─── Joker Modifiers (non-scoring effects that change game rules) ──

export interface JokerModifiers {
  // Hand evaluation
  fourFingers: boolean;  // Flushes/Straights need only 4 cards
  smeared: boolean;      // Hearts≡Diamonds, Spades≡Clubs
  shortcut: boolean;     // Straights allow gaps of 1 rank
  // Scoring
  allCardsFace: boolean; // pareidolia — all cards count as face cards
}

// ─── Utility ───────────────────────────────────────────────────

export const FACE_RANKS: Rank[] = [Rank.Jack, Rank.Queen, Rank.King];
export const NUMBER_RANKS: Rank[] = [
  Rank.Two, Rank.Three, Rank.Four, Rank.Five,
  Rank.Six, Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten,
];

export const ALL_RANKS: Rank[] = [...NUMBER_RANKS, ...FACE_RANKS, Rank.Ace];
export const ALL_SUITS: Suit[] = [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds];

export const ALL_HAND_TYPES: HandType[] = [
  HandType.HighCard,
  HandType.Pair,
  HandType.TwoPair,
  HandType.ThreeOfAKind,
  HandType.Straight,
  HandType.Flush,
  HandType.FullHouse,
  HandType.FourOfAKind,
  HandType.StraightFlush,
  HandType.RoyalFlush,
  HandType.FiveOfAKind,
  HandType.FlushHouse,
  HandType.FlushFive,
];

export function isFaceCard(rank: Rank): boolean {
  return rank === Rank.Jack || rank === Rank.Queen || rank === Rank.King;
}

export function isNumberCard(rank: Rank): boolean {
  return rank !== Rank.Ace && !isFaceCard(rank);
}

export function rankToChips(rank: Rank): number {
  switch (rank) {
    case Rank.Ace: return 11;
    case Rank.King: case Rank.Queen: case Rank.Jack: return 10;
    default: return parseInt(rank);
  }
}

export function isStone(card: Card): boolean {
  return card.enhancement === CardEnhancement.Stone;
}
