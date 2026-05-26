/**
 * Card shorthand notation parser.
 *
 * Notation: [rank][suit][.enhancement][.edition][.seal]
 *
 * rank:  a k q j 10 9 8 7 6 5 4 3 2 (case-insensitive)
 * suit:  s h c d
 * enh:   b(onus) m(ult) w(ild) g(lass) s(teel) o(stone) d(gold) l(ucky)
 * edi:   f(oil) h(olo) p(oly) n(egative)
 * seal:  r(ed) b(lue) g(old) p(urple)
 */

import type { Card } from './types';
import { Rank, Suit, CardEnhancement, CardEdition, Seal } from './types';

// ─── Lookup maps ─────────────────────────────────────────────────

const RANK_MAP: Record<string, Rank> = {
  a: Rank.Ace, k: Rank.King, q: Rank.Queen, j: Rank.Jack,
  '10': Rank.Ten, '9': Rank.Nine, '8': Rank.Eight, '7': Rank.Seven,
  '6': Rank.Six, '5': Rank.Five, '4': Rank.Four, '3': Rank.Three, '2': Rank.Two,
};

const SUIT_MAP: Record<string, Suit> = {
  s: Suit.Spades, h: Suit.Hearts, c: Suit.Clubs, d: Suit.Diamonds,
};

const ENH_MAP: Record<string, CardEnhancement> = {
  b: CardEnhancement.Bonus,
  m: CardEnhancement.Mult,
  w: CardEnhancement.Wild,
  g: CardEnhancement.Glass,
  s: CardEnhancement.Steel,
  o: CardEnhancement.Stone,
  d: CardEnhancement.Gold,
  l: CardEnhancement.Lucky,
};

const EDI_MAP: Record<string, CardEdition> = {
  f: CardEdition.Foil,
  h: CardEdition.Holographic,
  p: CardEdition.Polychrome,
  n: CardEdition.Negative,
};

const SEAL_MAP: Record<string, Seal> = {
  r: Seal.Red,
  b: Seal.Blue,
  g: Seal.Gold,
  p: Seal.Purple,
};

// ─── Public API ──────────────────────────────────────────────────

let _nextId = 0;

/** Reset the auto-ID counter (useful in tests). */
export function resetParserIdCounter(): void {
  _nextId = 0;
}

export interface ParseNotationResult {
  card: Card;
}

/**
 * Parse a single shorthand notation string into a Card.
 * Returns null if the notation is invalid.
 */
export function parseCardNotation(input: string): Card | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Extract multiplier (e.g. "3*ah") — strip it, handled by batch parser
  let notation = trimmed;
  const multMatch = notation.match(/^\d+\s*[*x]\s*/);
  if (multMatch) {
    notation = notation.slice(multMatch[0].length);
  }

  const parts = notation.split('.');
  const base = parts[0];
  if (!base) return null;

  // Parse base: rank + suit
  let rank: Rank;
  let suit: Suit;
  if (base.startsWith('10')) {
    rank = Rank.Ten;
    suit = SUIT_MAP[base.slice(2)];
  } else {
    rank = RANK_MAP[base[0]];
    suit = SUIT_MAP[base.slice(1)];
  }
  if (!rank || !suit) return null;

  // Parse modifiers (positional: enhancement, edition, seal)
  let enhancement = CardEnhancement.None;
  let edition = CardEdition.None;
  let seal = Seal.None;

  const mods = parts.slice(1);
  if (mods.length > 0 && mods[0]) {
    if (ENH_MAP[mods[0]]) enhancement = ENH_MAP[mods[0]];
    else return null; // invalid enhancement code
  }
  if (mods.length > 1 && mods[1]) {
    if (EDI_MAP[mods[1]]) edition = EDI_MAP[mods[1]];
    else return null;
  }
  if (mods.length > 2 && mods[2]) {
    if (SEAL_MAP[mods[2]]) seal = SEAL_MAP[mods[2]];
    else return null;
  }

  // Stone cards have no rank/suit in Balatro
  if (enhancement === CardEnhancement.Stone) {
    rank = Rank.Two;
    suit = Suit.Spades;
  }

  const id = `parsed_${_nextId++}`;
  return { id, rank, suit, enhancement, edition, seal, debuffed: false };
}

/**
 * Parse a batch notation string (space/comma/newline separated) into Cards.
 * Supports multipliers: "3*ah", "ah*3", "3x ah", "3 ah".
 */
export function parseCardNotations(input: string): Card[] {
  const cards: Card[] = [];
  const tokens = input.split(/[\s,]+/).filter(Boolean);
  let pendingMultiplier = 1;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].trim().toLowerCase();
    if (!t) continue;

    // Standalone multiplier token: "3" in "3 ah" or "3x" in "3x ah"
    const standaloneMult = t.match(/^(\d+)\s*[*x]?$/);
    if (standaloneMult && i + 1 < tokens.length) {
      pendingMultiplier = parseInt(standaloneMult[1], 10);
      continue;
    }

    // Inline prefix multiplier: "3*ah" (single token)
    const prefMatch = t.match(/^(\d+)\s*[*x]\s*(.+)/);
    if (prefMatch) {
      const count = parseInt(prefMatch[1], 10);
      const notation = prefMatch[2];
      for (let j = 0; j < count; j++) {
        const card = parseCardNotation(notation);
        if (card) cards.push(card);
      }
      continue;
    }

    // Suffix multiplier: "ah*3"
    const suffMatch = t.match(/^(.+?)\s*[*x]\s*(\d+)$/);
    if (suffMatch) {
      const notation = suffMatch[1];
      const count = parseInt(suffMatch[2], 10);
      for (let j = 0; j < count; j++) {
        const card = parseCardNotation(notation);
        if (card) cards.push(card);
      }
      continue;
    }

    // Plain notation — apply pending multiplier
    for (let j = 0; j < pendingMultiplier; j++) {
      const card = parseCardNotation(t);
      if (card) cards.push(card);
    }
    pendingMultiplier = 1;
  }

  return cards;
}

// ─── Cheat Sheet ─────────────────────────────────────────────────

export interface NotationCheatSheet {
  ranks: { code: string; label: string }[];
  suits: { code: string; label: string; symbol: string }[];
  enhancements: { code: string; label: string }[];
  editions: { code: string; label: string }[];
  seals: { code: string; label: string }[];
}

export function getNotationCheatSheet(): NotationCheatSheet {
  return {
    ranks: [
      { code: 'a', label: 'Ace' }, { code: 'k', label: 'King' }, { code: 'q', label: 'Queen' },
      { code: 'j', label: 'Jack' }, { code: '10', label: '10' }, { code: '9', label: '9' },
      { code: '8', label: '8' }, { code: '7', label: '7' }, { code: '6', label: '6' },
      { code: '5', label: '5' }, { code: '4', label: '4' }, { code: '3', label: '3' },
      { code: '2', label: '2' },
    ],
    suits: [
      { code: 's', label: 'Spades', symbol: '♠' },
      { code: 'h', label: 'Hearts', symbol: '♥' },
      { code: 'c', label: 'Clubs', symbol: '♣' },
      { code: 'd', label: 'Diamonds', symbol: '♦' },
    ],
    enhancements: [
      { code: 'b', label: 'Bonus (+30 chips)' },
      { code: 'm', label: 'Mult (+4 mult)' },
      { code: 'w', label: 'Wild' },
      { code: 'g', label: 'Glass (\xd72 mult)' },
      { code: 's', label: 'Steel (\xd71.5 held)' },
      { code: 'o', label: 'Stone (+50 chips)' },
      { code: 'd', label: 'Gold ($3 held)' },
      { code: 'l', label: 'Lucky' },
    ],
    editions: [
      { code: 'f', label: 'Foil (+50 chips)' },
      { code: 'h', label: 'Holographic (+10 mult)' },
      { code: 'p', label: 'Polychrome (\xd71.5 mult)' },
      { code: 'n', label: 'Negative (+1 slot)' },
    ],
    seals: [
      { code: 'r', label: 'Red (retrigger)' },
      { code: 'b', label: 'Blue (planet)' },
      { code: 'g', label: 'Gold ($3)' },
      { code: 'p', label: 'Purple (tarot)' },
    ],
  };
}
