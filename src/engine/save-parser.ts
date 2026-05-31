/**
 * Balatro Save File Parser (Zero-Dependency).
 *
 * Parses compressed Balatro save files (.jkr) into structured game state.
 * The save format is: raw-deflate-compressed Lua table serialization.
 *
 * Pipeline: ArrayBuffer → DecompressionStream('deflate') → Lua text → JS object → GameState
 */

import type {
  Card, JokerInstance, DeckComposition, DeckCardSlot, HandLevels,
} from './types';
import {
  Rank, Suit, CardEnhancement, CardEdition, Seal,
  BlindType,
} from './types';
import { getDefaultHandLevels } from './constants';
import { buildAggregateFromCards } from './deck';
import { decompressBalatroSave, SaveDecodeError } from './save-decoder';
import { LuaParser, LuaParseError } from './lua-parser';

// ─── Error types ─────────────────────────────────────────────────

export class SaveParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'SaveParseError';
  }
}

// ─── Injected save data (mapped to our domain) ───────────────────

export interface InjectedSaveData {
  handCards: Card[];
  jokers: JokerInstance[];
  handLevels: HandLevels;
  deckComposition: DeckComposition;
  dollars: number;
  antes: number;
  handsPlayed: number;
  discardsUsed: number;
  blindType: BlindType;
  blindChips: number;
  blindDebuffedRanks: Rank[];
  blindDebuffedSuits: Suit[];
  seed: string | null;
  jokerStateOverrides: Record<number, number>;
  /** Active voucher IDs extracted from save */
  activeVouchers?: string[];
  /** Active boss effect ID extracted from save */
  activeBossEffect?: string | null;
  /** Base max hands before voucher/boss/joker modifiers */
  maxHandsBase?: number;
  /** Base max discards before voucher/boss/joker modifiers */
  maxDiscardsBase?: number;
  /** Base hand size before voucher/joker modifiers */
  handSizeBase?: number;
  /** Cumulative round score (from mod live sync) */
  roundScore?: number;
  /** Per-hand score log (from mod live sync) */
  scoreLog?: import('../hooks/useGameState').ScoreLogEntry[];
  /** Real shop data (from mod live sync, only when in shop) */
  shop?: import('./mod-protocol').ModShopData;
  /** Player's held consumable cards (tarot/planet/spectral, from mod live sync) */
  heldConsumables?: import('./mod-protocol').ModHeldConsumable[];
}

// ─── Enhancement / Edition / Seal mapping tables ─────────────────

const EFFECT_TO_ENHANCEMENT: Record<string, CardEnhancement> = {
  'Base': CardEnhancement.None,
  'Bonus': CardEnhancement.Bonus,
  'Mult': CardEnhancement.Mult,
  'Wild Card': CardEnhancement.Wild,
  'Glass Card': CardEnhancement.Glass,
  'Steel Card': CardEnhancement.Steel,
  'Stone Card': CardEnhancement.Stone,
  'Gold Card': CardEnhancement.Gold,
  'Lucky Card': CardEnhancement.Lucky,
};

const SET_TO_EDITION: Record<string, CardEdition> = {
  'Default': CardEdition.None,
  'Foil': CardEdition.Foil,
  'Holographic': CardEdition.Holographic,
  'Polychrome': CardEdition.Polychrome,
  'Negative': CardEdition.Negative,
};

const SUIT_MAP: Record<string, Suit> = {
  'Hearts': Suit.Hearts,
  'Diamonds': Suit.Diamonds,
  'Clubs': Suit.Clubs,
  'Spades': Suit.Spades,
};

const RANK_MAP: Record<string, Rank> = {
  '2': Rank.Two, '3': Rank.Three, '4': Rank.Four, '5': Rank.Five,
  '6': Rank.Six, '7': Rank.Seven, '8': Rank.Eight, '9': Rank.Nine,
  '10': Rank.Ten, 'Jack': Rank.Jack, 'Queen': Rank.Queen,
  'King': Rank.King, 'Ace': Rank.Ace,
};

const SEAL_NAME_MAP: Record<string, Seal> = {
  'Red': Seal.Red,
  'Blue': Seal.Blue,
  'Gold': Seal.Gold,
  'Purple': Seal.Purple,
};

// Balatro internal boss keys → our engine blind type
const BOSS_KEY_TO_BLIND_TYPE: Record<string, BlindType> = {
  'bl_small': BlindType.Small,
  'bl_big': BlindType.Big,
};

// Default non-boss blinds map to Small/Big by name (fallback)
const BLIND_NAME_TO_TYPE: Record<string, BlindType> = {
  'Small Blind': BlindType.Small,
  'Big Blind': BlindType.Big,
  'Boss Blind': BlindType.Boss,
};

// Voucher center keys → our voucher IDs
const VOUCHER_KEY_MAP: Record<string, string> = {
  'v_grabber': 'grabber',
  'v_nacho_tong': 'nacho_tong',
  'v_wasteful': 'wasteful',
  'v_recyclomancy': 'recyclomancy',
  'v_paint_brush': 'paint_brush',
  'v_palette': 'palette',
};

// Boss blind keys → our boss effect IDs
const BOSS_KEY_MAP: Record<string, string> = {
  'bl_water': 'the_water',
  'bl_needle': 'the_needle',
  'bl_eye': 'the_eye',
  'bl_mouth': 'the_mouth',
  'bl_arm': 'the_arm',
  'bl_wall': 'the_wall',
  'bl_wheel': 'the_wheel',
  'bl_fish': 'the_fish',
  'bl_house': 'the_house',
  'bl_mark': 'the_mark',
  'bl_head': 'the_head',
  'bl_tooth': 'the_tooth',
  'bl_ox': 'the_ox',
  'bl_serpent': 'the_serpent',
  'bl_club': 'the_club',
  'bl_window': 'the_window',
  'bl_plant': 'the_plant',
  'bl_hook': 'the_hook',
  'bl_psychic': 'the_psychic',
  'bl_goad': 'the_goad',
  'bl_pillar': 'the_pillar',
  'bl_flint': 'the_flint',
  'bl_manacle': 'the_manacle',
  'bl_vessel': 'violet_vessel',
  'bl_leaf': 'verdant_leaf',
  'bl_heart': 'crimson_heart',
  'bl_bell': 'cerulean_bell',
  'bl_acorn': 'amber_acorn',
};

interface VoucherInfo { hands?: number; discards?: number; handSize?: number; }

const VOUCHER_INFO: Record<string, VoucherInfo> = {
  'grabber': { hands: 1 },
  'nacho_tong': { hands: 1 },
  'wasteful': { discards: 1 },
  'recyclomancy': { discards: 1 },
  'paint_brush': { handSize: 1 },
  'palette': { handSize: 1 },
};

// ─── Main API ────────────────────────────────────────────────────

export async function parseBalatroSave(fileBuffer: ArrayBuffer): Promise<InjectedSaveData> {
  // Step 1: Decompress
  let decompressedText: string;
  try {
    decompressedText = await decompressBalatroSave(fileBuffer);
  } catch (err) {
    if (err instanceof SaveDecodeError) {
      throw new SaveParseError(err.message, err.cause);
    }
    throw new SaveParseError('Failed to decompress save file. The file may be corrupted or not a valid Balatro save.', err);
  }

  if (!decompressedText.trim().startsWith('return ')) {
    throw new SaveParseError('Invalid save format: decompressed data does not start with "return". This file may not be a Balatro save.');
  }

  // Step 2: Parse Lua table into JS object
  let root: Record<string, unknown>;
  try {
    const parser = new LuaParser(decompressedText);
    const parsed = parser.parseRoot();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new SaveParseError('Invalid save format: expected a table at root level.');
    }
    root = parsed as Record<string, unknown>;
  } catch (err) {
    if (err instanceof SaveParseError) throw err;
    if (err instanceof LuaParseError) {
      throw new SaveParseError(err.message);
    }
    throw new SaveParseError('Failed to parse save file data structure.', err);
  }

  // Step 3: Map to our domain
  try {
    return mapSaveToGameState(root);
  } catch (err) {
    throw new SaveParseError('Failed to map save data to game state. The save may be from an unsupported game version.', err);
  }
}

// ─── Save → GameState Mapper ─────────────────────────────────────

function mapSaveToGameState(root: Record<string, unknown>): InjectedSaveData {
  const cardAreas = asRecord(root['cardAreas']);
  const game = asRecord(root['GAME']);

  // ── Deck cards ─────────────────────────────────────────────────
  const deckCardsRaw = asRecord(cardAreas?.['deck']) ?? {};
  const deckCards = asRecord(deckCardsRaw['cards']) ?? {};
  const deckSlots = parseDeckCards(deckCards);
  const deckComposition: DeckComposition = {
    ...buildAggregateFromCards(deckSlots),
    cards: deckSlots,
  };

  // ── Jokers ─────────────────────────────────────────────────────
  const jokersRaw = asRecord(cardAreas?.['jokers']) ?? {};
  const jokerCards = asRecord(jokersRaw['cards']) ?? {};
  const jokerList: JokerInstance[] = [];
  const jokerOverrides: Record<number, number> = {};

  for (const key of Object.keys(jokerCards).sort((a, b) => Number(a) - Number(b))) {
    const raw = asRecord(jokerCards[key]);
    if (!raw) continue;
    const ability = asRecord(raw['ability']) ?? {};
    const edition = mapJokerEdition(raw);
    const jokerId = mapJokerId(ability);

    jokerList.push({ id: jokerId, edition });

    // Extract counter state (for Castle, Green Joker, Yorick, etc.)
    const overrideVal = extractJokerOverride(ability, raw);
    if (overrideVal !== undefined) {
      jokerOverrides[jokerList.length - 1] = overrideVal;
    }
  }

  // ── Current hand cards ─────────────────────────────────────────
  const handRaw = asRecord(cardAreas?.['hand']) ?? {};
  const handCardsRaw = asRecord(handRaw['cards']) ?? {};
  const handCards = parseHandCards(handCardsRaw);

  // ── Round state ────────────────────────────────────────────────
  const currentRound = asRecord(game?.['current_round']) ?? {};
  const roundResets = asRecord(game?.['round_resets']) ?? {};
  const dollars = asNumber(currentRound['dollars'], 0);
  const handsPlayed = asNumber(currentRound['hands_played'], 0);
  const discardsUsed = asNumber(currentRound['discards_used'], 0);
  const ante = asNumber(roundResets['ante'], 1);

  // ── Blind info ─────────────────────────────────────────────────
  const blind = asRecord(roundResets['blind']) ?? {};
  const blindName = asString((blind as Record<string, unknown>)['name'], 'Small Blind');
  const blindKey = asString((blind as Record<string, unknown>)['key'], '');

  // Boss blinds are determined by checking blind_states
  const blindStates = asRecord(roundResets['blind_states']) ?? {};
  const currentBlindState = blindStates['Small'] ?? blindStates['Big'] ?? 'Upcoming';
  const isBoss = currentBlindState === 'Defeated' || blindName === 'Boss Blind';

  // Determine which blind is currently active based on states
  let blindType: BlindType;
  if (isBoss && (blindStates['Small'] === 'Defeated' && blindStates['Big'] === 'Defeated')) {
    blindType = BlindType.Boss;
  } else if (blindStates['Small'] === 'Defeated' && blindStates['Big'] !== 'Defeated') {
    blindType = BlindType.Big;
  } else if (blindStates['Small'] !== 'Defeated') {
    blindType = BlindType.Small;
  } else {
    blindType = BOSS_KEY_TO_BLIND_TYPE[blindKey] ?? BLIND_NAME_TO_TYPE[blindName] ?? BlindType.Small;
  }

  const blindChips = asNumber((blind as Record<string, unknown>)['chips'], 0);
  const debuff = ((blind as Record<string, unknown>)['debuff'] as Record<string, unknown> | undefined) ?? {};

  // Parse debuffed suits
  const debuffedSuits: Suit[] = [];
  const debuffSuit = debuff['suit'] as Record<string, unknown> | undefined;
  if (debuffSuit) {
    for (const sKey of Object.keys(debuffSuit)) {
      const suit = SUIT_MAP[sKey];
      if (suit) debuffedSuits.push(suit);
    }
  }

  // Parse debuffed ranks
  const debuffedRanks: Rank[] = [];
  const debuffRank = debuff['rank'] as Record<string, unknown> | undefined;
  if (debuffRank) {
    for (const rKey of Object.keys(debuffRank)) {
      const rank = RANK_MAP[rKey];
      if (rank) debuffedRanks.push(rank);
    }
  }

  // ── Hand levels ────────────────────────────────────────────────
  const handLevels = parseHandLevels(root);

  // ── Seed ───────────────────────────────────────────────────────
  const pseudorandom = asRecord(game?.['pseudorandom']) ?? {};
  const seed = asString(pseudorandom['seed'], null);

  // ── Vouchers ───────────────────────────────────────────────────
  const activeVouchers = extractActiveVouchers(currentRound);

  // ── Boss effect ────────────────────────────────────────────────
  const activeBossEffect = blindType === BlindType.Boss
    ? mapBossKeyToEffectId(blindKey)
    : null;

  // ── Base round params (back-calculated from effective values) ──
  const handsLeft = asNumber(currentRound['hands_left'], 0);
  const discardsLeft = asNumber(currentRound['discards_left'], 0);
  const handSize = asNumber(currentRound['hand_size'], 8);
  // Effective max = remaining + played. Base = effective - voucher bonuses.
  const effectiveMaxHands = handsLeft + handsPlayed;
  const effectiveMaxDiscards = discardsLeft + discardsUsed;
  const voucherHandBonus = activeVouchers.reduce((sum, vId) => {
    return sum + (VOUCHER_INFO[vId]?.hands ?? 0);
  }, 0);
  const voucherDiscardBonus = activeVouchers.reduce((sum, vId) => {
    return sum + (VOUCHER_INFO[vId]?.discards ?? 0);
  }, 0);
  const voucherHandSizeBonus = activeVouchers.reduce((sum, vId) => {
    return sum + (VOUCHER_INFO[vId]?.handSize ?? 0);
  }, 0);

  return {
    handCards,
    jokers: jokerList,
    handLevels,
    deckComposition,
    dollars,
    antes: ante,
    handsPlayed,
    discardsUsed,
    blindType,
    blindChips,
    blindDebuffedRanks: debuffedRanks,
    blindDebuffedSuits: debuffedSuits,
    seed,
    jokerStateOverrides: jokerOverrides,
    activeVouchers,
    activeBossEffect,
    maxHandsBase: Math.max(1, effectiveMaxHands - voucherHandBonus),
    maxDiscardsBase: Math.max(0, effectiveMaxDiscards - voucherDiscardBonus),
    handSizeBase: Math.max(5, handSize - voucherHandSizeBonus),
  };
}

// ─── Voucher / Boss extraction helpers ───────────────────────────

function extractActiveVouchers(currentRound: Record<string, unknown>): string[] {
  const vouchers = asRecord(currentRound['vouchers']) ?? {};
  const ids: string[] = [];
  for (const key of Object.keys(vouchers)) {
    const mapped = VOUCHER_KEY_MAP[key];
    if (mapped) ids.push(mapped);
  }
  return ids;
}

function mapBossKeyToEffectId(blindKey: string): string | null {
  return BOSS_KEY_MAP[blindKey] ?? null;
}

// ─── Deck card parsing ───────────────────────────────────────────

function parseDeckCards(cards: Record<string | number, unknown>): DeckCardSlot[] {
  const slots: DeckCardSlot[] = [];

  for (const key of Object.keys(cards)) {
    const raw = asRecord(cards[key]);
    if (!raw) continue;

    const base = asRecord(raw['base']);
    if (!base) continue;

    const suitStr = asString(base['suit'], '');
    const valueStr = asString(base['value'], '');
    const suit = SUIT_MAP[suitStr];
    const rank = RANK_MAP[valueStr];

    if (!suit || !rank) continue;

    const ability = asRecord(raw['ability']);
    const effectStr = asString(ability?.['effect'], 'Base');
    const setStr = asString(ability?.['set'], 'Default');
    const enhancement = EFFECT_TO_ENHANCEMENT[effectStr] ?? CardEnhancement.None;
    const edition = SET_TO_EDITION[setStr] ?? CardEdition.None;

    // Seal can be in `ability.seal` or top-level `seal`
    let seal = Seal.None;
    const sealStr = asString(raw['seal'], '') || asString(ability?.['seal'], '');
    if (sealStr && sealStr !== 'None' && sealStr in SEAL_NAME_MAP) {
      seal = SEAL_NAME_MAP[sealStr];
    }

    slots.push({ rank, suit, enhancement, edition, seal });
  }

  return slots;
}

// ─── Hand card parsing ───────────────────────────────────────────

function parseHandCards(cards: Record<string | number, unknown>): Card[] {
  const handCards: Card[] = [];
  let idCounter = 0;

  for (const key of Object.keys(cards).sort((a, b) => Number(a) - Number(b))) {
    const raw = asRecord(cards[key]);
    if (!raw) continue;

    const base = asRecord(raw['base']);
    if (!base) continue;

    const suitStr = asString(base['suit'], '');
    const valueStr = asString(base['value'], '');
    const suit = SUIT_MAP[suitStr];
    const rank = RANK_MAP[valueStr];

    if (!suit || !rank) continue;

    const ability = asRecord(raw['ability']);
    const effectStr = asString(ability?.['effect'], 'Base');
    const setStr = asString(ability?.['set'], 'Default');
    const enhancement = EFFECT_TO_ENHANCEMENT[effectStr] ?? CardEnhancement.None;
    const edition = SET_TO_EDITION[setStr] ?? CardEdition.None;

    let seal = Seal.None;
    const sealStr = asString(raw['seal'], '') || asString(ability?.['seal'], '');
    if (sealStr && sealStr !== 'None' && sealStr in SEAL_NAME_MAP) {
      seal = SEAL_NAME_MAP[sealStr];
    }

    // Determine debuff status
    const debuffed = asBoolean(raw['debuff'], false);

    // Check if card is face-down (not yet revealed)
    const facing = asString(raw['facing'], 'front');

    handCards.push({
      id: `save_hand_${idCounter++}`,
      rank,
      suit,
      enhancement,
      edition,
      seal,
      debuffed,
      // If facing is 'back', card info is unreliable; mark as fog
      fog: facing === 'back' ? true : undefined,
    });
  }

  return handCards;
}

// ─── Joker helpers ───────────────────────────────────────────────

function mapJokerId(ability: Record<string, unknown>): string {
  const name = asString(ability['name'], 'joker');
  // Balatro internal IDs use "j_" prefix, e.g. "j_joker", "j_blueprint"
  // Try to get the center key if available, otherwise fall back to name
  const rawKey = asString(ability['key'], '');
  if (rawKey && rawKey.startsWith('j_')) {
    return rawKey.slice(2);
  }
  // Fallback: derive from display name
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'joker';
}

function mapJokerEdition(raw: Record<string, unknown>): CardEdition {
  const ability = asRecord(raw['ability']);
  const setStr = asString(ability?.['set'], 'Default');
  return SET_TO_EDITION[setStr] ?? CardEdition.None;
}

function extractJokerOverride(ability: Record<string, unknown>, raw: Record<string, unknown>): number | undefined {
  // Some jokers store state in extra_value, others in a counter field
  const extra = ability['extra_value'];
  if (typeof extra === 'number') return extra;

  const counter = ability['counter'];
  if (typeof counter === 'number') return counter;

  const config = asRecord(raw['config']);
  const configExtra = config?.['extra'];
  if (typeof configExtra === 'number') return configExtra;

  return undefined;
}

// ─── Hand levels parsing ─────────────────────────────────────────

function parseHandLevels(root: Record<string, unknown>): HandLevels {
  const handLevels = getDefaultHandLevels();
  const game = asRecord(root['GAME']);

  // Hand levels may be stored in GAME.abilities or planet-card records
  // Try GAME.hand_usage for which hands have been played/levelled
  const handUsage = asRecord(game?.['hand_usage']);
  if (!handUsage) return handLevels;

  // Balatro's internal hand type names → our HandType enum
  const BALATRO_HAND_TO_OURS: Record<string, string> = {
    'High Card': 'HighCard',
    'Pair': 'Pair',
    'Two Pair': 'TwoPair',
    'Three of a Kind': 'ThreeOfAKind',
    'Straight': 'Straight',
    'Flush': 'Flush',
    'Full House': 'FullHouse',
    'Four of a Kind': 'FourOfAKind',
    'Straight Flush': 'StraightFlush',
    'Royal Flush': 'RoyalFlush',
    'Five of a Kind': 'FiveOfAKind',
    'Flush House': 'FlushHouse',
    'Flush Five': 'FlushFive',
  };

  // Look for level info in cardAreas.consumeables or planet-based abilities
  const cardAreas = asRecord(root['cardAreas']);
  const consumables = asRecord(cardAreas?.['consumeables']);
  const consumableCards = asRecord(consumables?.['cards']) ?? {};

  // Check for planet cards in consumables area
  for (const key of Object.keys(consumableCards)) {
    const raw = asRecord(consumableCards[key]);
    if (!raw) continue;
    const ability = asRecord(raw['ability']);
    const abilityName = asString(ability?.['name'], '');
    const config = asRecord(raw['config']);
    const handTypeStr = asString(config?.['hand_type'], '');

    // Planet names map to hand types
    const PLANET_TO_HAND: Record<string, string> = {
      'Pluto': 'HighCard', 'Mercury': 'Pair', 'Uranus': 'TwoPair',
      'Saturn': 'Straight', 'Jupiter': 'Flush', 'Venus': 'ThreeOfAKind',
      'Earth': 'FullHouse', 'Mars': 'FourOfAKind', 'Neptune': 'StraightFlush',
      'Planet X': 'FiveOfAKind', 'Ceres': 'FlushHouse', 'Eris': 'FlushFive',
    };

    const planetName = abilityName || '';
    const handKey = PLANET_TO_HAND[planetName] || BALATRO_HAND_TO_OURS[handTypeStr];
    if (!handKey) continue;

    // Level is stored in ability.level or config.level
    const level = asNumber(ability?.['level'], 1);
    handLevels[handKey as keyof HandLevels] = level;
  }

  return handLevels;
}

// ─── Type-safe accessors ─────────────────────────────────────────

function asRecord(val: unknown): Record<string, unknown> | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && !Array.isArray(val)) return val as Record<string, unknown>;
  return null;
}

function asString(val: unknown, defaultVal: string): string;
function asString(val: unknown, defaultVal: null): string | null;
function asString(val: unknown, defaultVal: string | null): string | null {
  if (typeof val === 'string') return val;
  return defaultVal;
}

function asNumber(val: unknown, defaultVal: number): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? defaultVal : n;
  }
  return defaultVal;
}

function asBoolean(val: unknown, defaultVal: boolean): boolean {
  if (typeof val === 'boolean') return val;
  return defaultVal;
}

// Re-export Lua parser for backward compatibility
export { LuaParser, LuaParseError } from './lua-parser';
