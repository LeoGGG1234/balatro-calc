import { Suit, Rank, BlindType } from './types';
import { getBlindBaseChips } from './constants';

// ─── Types ──────────────────────────────────────────────────────

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
  const idx = Math.min(ante, BOSS_ROTATION.length) - 1;
  const bossId = idx < BOSS_ROTATION.length
    ? BOSS_ROTATION[idx]
    : BOSS_POOL[Math.floor(Math.random() * BOSS_POOL.length)];
  const bossDef = BOSS_BLINDS[bossId];
  return {
    ante,
    smallChips: getBlindBaseChips(ante, BlindType.Small),
    bigChips: getBlindBaseChips(ante, BlindType.Big),
    bossChips: getBlindBaseChips(ante, BlindType.Boss),
    bossId,
    bossName: bossDef?.name ?? 'Unknown Boss',
  };
}

export function getBossEffect(bossId: string): BossEffect {
  return BOSS_BLINDS[bossId]?.effect ?? {};
}
