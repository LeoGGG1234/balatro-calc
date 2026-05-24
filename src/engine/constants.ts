import { HandType, Rank, type HandLevels } from './types';

// ─── Hand Base Values (at Level 1) & Planet Scaling ────────────

interface HandBase {
  chips: number;
  mult: number;
  chipsPerLevel: number;
  multPerLevel: number;
  maxPlayedCards: number;
  minPlayedCards: number;
  planetCard: string;
  name: string;
  nameZh: string;
}

export const HAND_DEFINITIONS: Record<HandType, HandBase> = {
  [HandType.HighCard]:      { chips: 5,   mult: 1,  chipsPerLevel: 10, multPerLevel: 1,  maxPlayedCards: 1, minPlayedCards: 1, planetCard: 'Pluto',   name: 'High Card',       nameZh: '高牌' },
  [HandType.Pair]:          { chips: 10,  mult: 2,  chipsPerLevel: 15, multPerLevel: 1,  maxPlayedCards: 2, minPlayedCards: 2, planetCard: 'Mercury',  name: 'Pair',            nameZh: '一对' },
  [HandType.TwoPair]:       { chips: 20,  mult: 2,  chipsPerLevel: 20, multPerLevel: 1,  maxPlayedCards: 4, minPlayedCards: 4, planetCard: 'Uranus',   name: 'Two Pair',        nameZh: '两对' },
  [HandType.ThreeOfAKind]:  { chips: 30,  mult: 3,  chipsPerLevel: 20, multPerLevel: 2,  maxPlayedCards: 3, minPlayedCards: 3, planetCard: 'Venus',    name: 'Three of a Kind', nameZh: '三条' },
  [HandType.Straight]:      { chips: 55,  mult: 4,  chipsPerLevel: 30, multPerLevel: 3,  maxPlayedCards: 5, minPlayedCards: 5, planetCard: 'Saturn',   name: 'Straight',        nameZh: '顺子' },
  [HandType.Flush]:         { chips: 35,  mult: 4,  chipsPerLevel: 15, multPerLevel: 2,  maxPlayedCards: 5, minPlayedCards: 5, planetCard: 'Jupiter',  name: 'Flush',           nameZh: '同花' },
  [HandType.FullHouse]:     { chips: 40,  mult: 4,  chipsPerLevel: 25, multPerLevel: 2,  maxPlayedCards: 5, minPlayedCards: 5, planetCard: 'Earth',    name: 'Full House',      nameZh: '葫芦' },
  [HandType.FourOfAKind]:   { chips: 60,  mult: 7,  chipsPerLevel: 30, multPerLevel: 3,  maxPlayedCards: 4, minPlayedCards: 4, planetCard: 'Mars',     name: 'Four of a Kind',  nameZh: '四条' },
  [HandType.StraightFlush]: { chips: 100, mult: 8,  chipsPerLevel: 40, multPerLevel: 4,  maxPlayedCards: 5, minPlayedCards: 5, planetCard: 'Neptune',  name: 'Straight Flush',  nameZh: '同花顺' },
  [HandType.RoyalFlush]:    { chips: 100, mult: 8,  chipsPerLevel: 40, multPerLevel: 4,  maxPlayedCards: 5, minPlayedCards: 5, planetCard: 'Neptune',  name: 'Royal Flush',     nameZh: '皇家同花顺' },
  [HandType.FiveOfAKind]:   { chips: 120, mult: 12, chipsPerLevel: 35, multPerLevel: 3,  maxPlayedCards: 5, minPlayedCards: 5, planetCard: 'Planet X', name: 'Five of a Kind',  nameZh: '五条' },
  [HandType.FlushHouse]:    { chips: 140, mult: 14, chipsPerLevel: 40, multPerLevel: 4,  maxPlayedCards: 5, minPlayedCards: 5, planetCard: 'Ceres',    name: 'Flush House',     nameZh: '同花葫芦' },
  [HandType.FlushFive]:     { chips: 160, mult: 16, chipsPerLevel: 50, multPerLevel: 3,  maxPlayedCards: 5, minPlayedCards: 5, planetCard: 'Eris',     name: 'Flush Five',      nameZh: '同花五条' },
};

// ─── Rank Chip Values ──────────────────────────────────────────

export const RANK_CHIP_VALUES: Record<Rank, number> = {
  [Rank.Two]: 2, [Rank.Three]: 3, [Rank.Four]: 4, [Rank.Five]: 5,
  [Rank.Six]: 6, [Rank.Seven]: 7, [Rank.Eight]: 8, [Rank.Nine]: 9,
  [Rank.Ten]: 10, [Rank.Jack]: 10, [Rank.Queen]: 10, [Rank.King]: 10,
  [Rank.Ace]: 11,
};

// ─── Rank Order (for straight detection) ───────────────────────

export const RANK_ORDER: Record<Rank, number> = {
  [Rank.Two]: 2, [Rank.Three]: 3, [Rank.Four]: 4, [Rank.Five]: 5,
  [Rank.Six]: 6, [Rank.Seven]: 7, [Rank.Eight]: 8, [Rank.Nine]: 9,
  [Rank.Ten]: 10, [Rank.Jack]: 11, [Rank.Queen]: 12, [Rank.King]: 13,
  [Rank.Ace]: 14, // Ace can also be low (1), handled in evaluator
};

// ─── Default Hand Levels ───────────────────────────────────────

export function getDefaultHandLevels(): HandLevels {
  const levels = {} as HandLevels;
  for (const ht of Object.values(HandType)) {
    levels[ht] = 1;
  }
  return levels;
}

// ─── Helpers ───────────────────────────────────────────────────

export function getHandBaseChips(handType: HandType, level: number): number {
  const def = HAND_DEFINITIONS[handType];
  return def.chips + (level - 1) * def.chipsPerLevel;
}

export function getHandBaseMult(handType: HandType, level: number): number {
  const def = HAND_DEFINITIONS[handType];
  return def.mult + (level - 1) * def.multPerLevel;
}

// ─── Blinds base chips (ante scaling) ──────────────────────────

export function getBlindBaseChips(ante: number, blindType: 'small' | 'big' | 'boss'): number {
  // Approximate scaling from Balatro wiki
  const base = 300 * Math.pow(1.6, ante - 1);
  switch (blindType) {
    case 'small': return Math.round(base);
    case 'big':   return Math.round(base * 1.5);
    case 'boss':  return Math.round(base * 2);
  }
}
