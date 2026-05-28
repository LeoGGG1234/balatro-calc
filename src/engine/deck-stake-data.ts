// ─── Deck & Stake Definitions ──────────────────────────────────
// Maps every Balatro deck (15) and stake (8) to their mechanical
// effects on the calculator's form state.

/** Game deck identifier — the 15 starting decks in Balatro. */
export type DeckId =
  | 'red' | 'blue' | 'yellow' | 'green' | 'black'
  | 'magic' | 'nebula' | 'ghost' | 'abandoned' | 'checkered'
  | 'zodiac' | 'painted' | 'anaglyph' | 'plasma' | 'erratic';

/** Stake/difficulty identifier — the 8 difficulty levels. */
export type StakeId =
  | 'white' | 'red' | 'green' | 'black'
  | 'blue' | 'purple' | 'orange' | 'gold';

export interface DeckDef {
  id: DeckId;
  nameKey: string;
  descriptionKey: string;
  /** Override base max hands (default 4). */
  maxHandsBase?: number;
  /** Override base max discards (default 3). */
  maxDiscardsBase?: number;
  /** Override base hand size (default 8). */
  handSizeBase?: number;
  /** Starting dollars (default 4). */
  dollars?: number;
  /** Deck composition preset to apply. */
  deckPreset?: 'standard' | 'abandoned' | 'checkered';
  /** Vouchers the deck starts with. */
  activeVouchers?: string[];
  /** Maximum joker slots (default 7). */
  maxJokerSlots?: number;
}

export interface StakeDef {
  id: StakeId;
  nameKey: string;
  descriptionKey: string;
  /** Modifier applied on top of deck base discards (e.g. Blue Stake: -1). */
  maxDiscardsModifier?: number;
  /** Whether this stake increases ante scaling (affects blind chip formula). */
  increasedAnteScaling?: boolean;
}

// ─── All Decks ─────────────────────────────────────────────────

export const ALL_DECKS: DeckDef[] = [
  {
    id: 'red',
    nameKey: 'deck.names.red',
    descriptionKey: 'deck.descriptions.red',
    maxDiscardsBase: 4,
  },
  {
    id: 'blue',
    nameKey: 'deck.names.blue',
    descriptionKey: 'deck.descriptions.blue',
    maxHandsBase: 5,
  },
  {
    id: 'yellow',
    nameKey: 'deck.names.yellow',
    descriptionKey: 'deck.descriptions.yellow',
    dollars: 14, // $4 base + $10 bonus
  },
  {
    id: 'green',
    nameKey: 'deck.names.green',
    descriptionKey: 'deck.descriptions.green',
    // No interest, earns $2/remaining hand + $1/remaining discard at end of round
    // Base form fields unchanged; special mechanic is tracked by the player.
  },
  {
    id: 'black',
    nameKey: 'deck.names.black',
    descriptionKey: 'deck.descriptions.black',
    maxHandsBase: 3,
    maxJokerSlots: 8, // +1 joker slot (7 + 1)
  },
  {
    id: 'magic',
    nameKey: 'deck.names.magic',
    descriptionKey: 'deck.descriptions.magic',
    activeVouchers: ['crystal_ball'],
  },
  {
    id: 'nebula',
    nameKey: 'deck.names.nebula',
    descriptionKey: 'deck.descriptions.nebula',
    activeVouchers: ['telescope'],
  },
  {
    id: 'ghost',
    nameKey: 'deck.names.ghost',
    descriptionKey: 'deck.descriptions.ghost',
    activeVouchers: ['omen_globe'],
  },
  {
    id: 'abandoned',
    nameKey: 'deck.names.abandoned',
    descriptionKey: 'deck.descriptions.abandoned',
    deckPreset: 'abandoned',
  },
  {
    id: 'checkered',
    nameKey: 'deck.names.checkered',
    descriptionKey: 'deck.descriptions.checkered',
    deckPreset: 'checkered',
  },
  {
    id: 'zodiac',
    nameKey: 'deck.names.zodiac',
    descriptionKey: 'deck.descriptions.zodiac',
    activeVouchers: ['tarot_merchant', 'planet_merchant', 'overstock'],
  },
  {
    id: 'painted',
    nameKey: 'deck.names.painted',
    descriptionKey: 'deck.descriptions.painted',
    handSizeBase: 10, // 8 + 2
    maxJokerSlots: 6, // 7 - 1
  },
  {
    id: 'anaglyph',
    nameKey: 'deck.names.anaglyph',
    descriptionKey: 'deck.descriptions.anaglyph',
    activeVouchers: ['blank'],
    maxJokerSlots: 6, // 7 - 1
  },
  {
    id: 'plasma',
    nameKey: 'deck.names.plasma',
    descriptionKey: 'deck.descriptions.plasma',
    // Plasma scoring (balance chips/mult) is not yet implemented in the engine.
  },
  {
    id: 'erratic',
    nameKey: 'deck.names.erratic',
    descriptionKey: 'deck.descriptions.erratic',
    // Random starting deck — user configures manually.
  },
];

// ─── All Stakes ────────────────────────────────────────────────

export const ALL_STAKES: StakeDef[] = [
  {
    id: 'white',
    nameKey: 'stake.names.white',
    descriptionKey: 'stake.descriptions.white',
  },
  {
    id: 'red',
    nameKey: 'stake.names.red',
    descriptionKey: 'stake.descriptions.red',
  },
  {
    id: 'green',
    nameKey: 'stake.names.green',
    descriptionKey: 'stake.descriptions.green',
    increasedAnteScaling: true,
  },
  {
    id: 'black',
    nameKey: 'stake.names.black',
    descriptionKey: 'stake.descriptions.black',
  },
  {
    id: 'blue',
    nameKey: 'stake.names.blue',
    descriptionKey: 'stake.descriptions.blue',
    maxDiscardsModifier: -1,
  },
  {
    id: 'purple',
    nameKey: 'stake.names.purple',
    descriptionKey: 'stake.descriptions.purple',
    increasedAnteScaling: true,
  },
  {
    id: 'orange',
    nameKey: 'stake.names.orange',
    descriptionKey: 'stake.descriptions.orange',
  },
  {
    id: 'gold',
    nameKey: 'stake.names.gold',
    descriptionKey: 'stake.descriptions.gold',
  },
];

// ─── Composite Computations ────────────────────────────────────

const DEFAULT_MAX_HANDS = 4;
const DEFAULT_MAX_DISCARDS = 3;
const DEFAULT_HAND_SIZE = 8;
const DEFAULT_DOLLARS = 4;
const DEFAULT_MAX_JOKER_SLOTS = 7;

/**
 * Compute the effective form-field defaults for a given deck + stake
 * combination. Used by both SELECT_DECK and SELECT_STAKE reducers
 * so they stay consistent.
 */
export function computeDeckStakeBase(
  deckId: DeckId | null | undefined,
  stakeId: StakeId | null | undefined,
): {
  maxHandsBase: number;
  maxDiscardsBase: number;
  handSizeBase: number;
  dollars: number;
  activeVouchers: string[];
  maxJokerSlots: number;
} {
  const deck = deckId ? ALL_DECKS.find(d => d.id === deckId) : undefined;
  const stake = stakeId ? ALL_STAKES.find(s => s.id === stakeId) : undefined;

  const baseHands = deck?.maxHandsBase ?? DEFAULT_MAX_HANDS;
  const baseDiscards = deck?.maxDiscardsBase ?? DEFAULT_MAX_DISCARDS;
  const baseSize = deck?.handSizeBase ?? DEFAULT_HAND_SIZE;
  const baseDollars = deck?.dollars ?? DEFAULT_DOLLARS;
  const baseVouchers = deck?.activeVouchers ?? [];
  const baseJokerSlots = deck?.maxJokerSlots ?? DEFAULT_MAX_JOKER_SLOTS;

  const discardsModifier = stake?.maxDiscardsModifier ?? 0;

  return {
    maxHandsBase: baseHands,
    maxDiscardsBase: Math.max(0, baseDiscards + discardsModifier),
    handSizeBase: baseSize,
    dollars: baseDollars,
    activeVouchers: baseVouchers,
    maxJokerSlots: baseJokerSlots,
  };
}
