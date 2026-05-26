import type {
  JokerDefinition, Card,
} from '../types';
import {
  JokerCategory, JokerRarity, Suit, HandType,
} from '../types';

// ─── Registry ──────────────────────────────────────────────────

const jokerRegistry = new Map<string, JokerDefinition>();

export function registerJoker(def: JokerDefinition): void {
  jokerRegistry.set(def.id, def);
}

export function getJoker(id: string): JokerDefinition | undefined {
  return jokerRegistry.get(id);
}

export function getAllJokers(): JokerDefinition[] {
  return Array.from(jokerRegistry.values());
}

export function getJokersByCategory(cat: JokerCategory): JokerDefinition[] {
  return getAllJokers().filter(j => j.category === cat);
}

// ─── Helper: build simple +Mult joker ──────────────────────────

export function plusMult(
  id: string, name: string, mult: number,
  rarity: JokerRarity = JokerRarity.Common,
  cost: number = 4
): JokerDefinition {
  return {
    id, name, category: JokerCategory.PlusMult, rarity, cost, copyable: true,
    effect: {
      onJokerEvaluate: (_ctx, acc) => { acc.mult += mult; },
    },
  };
}

// ─── Helper: build simple ×Mult joker ──────────────────────────

export function xMult(
  id: string, name: string, factor: number,
  rarity: JokerRarity = JokerRarity.Common,
  cost: number = 5
): JokerDefinition {
  return {
    id, name, category: JokerCategory.XMult, rarity, cost, copyable: true,
    effect: {
      onJokerEvaluate: (_ctx, acc) => { acc.mult *= factor; },
    },
  };
}

// ─── Helper: retrigger joker ────────────────────────────────────

export function retriggerJoker(
  id: string, name: string,
  predicate: (card: Card, handType: HandType, allCardsFace?: boolean) => boolean,
  rarity: JokerRarity = JokerRarity.Uncommon,
  cost: number = 5
): JokerDefinition {
  return {
    id, name, category: JokerCategory.Retrigger, rarity, cost, copyable: true,
    effect: {
      getRetriggers: (card, handType, allCardsFace) => predicate(card, handType, allCardsFace) ? 1 : 0,
    },
  };
}

// ─── Helper: "hand contains X" conditional chips joker ──────────

export function handContainsChips(
  id: string, name: string, chips: number, hands: HandType[],
  rarity: JokerRarity = JokerRarity.Common, cost: number = 4
): JokerDefinition {
  const handSet = new Set(hands);
  return {
    id, name, category: JokerCategory.Chips, rarity, cost, copyable: true,
    effect: {
      onJokerEvaluate: (ctx, acc) => {
        if (handSet.has(ctx.handType)) acc.chips += chips;
      },
    },
  };
}

// ─── Helper: suit-based +Mult joker ────────────────────────────

export function suitMultJoker(id: string, name: string, suit: Suit): JokerDefinition {
  return {
    id, name, category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 5, copyable: true,
    effect: {
      onCardScored: (ctx, acc) => {
        if (ctx.card.suit === suit) acc.mult += 4;
      },
    },
  };
}

// ─── Helper: hand-type conditional +Mult ──────────────────────

export function handTypeMult(
  id: string, name: string, mult: number, handType: HandType,
  rarity: JokerRarity = JokerRarity.Common,
  cost: number = 4
): JokerDefinition {
  return {
    id, name, category: JokerCategory.PlusMult, rarity, cost, copyable: true,
    effect: {
      onJokerEvaluate: (ctx, acc) => {
        if (ctx.handType === handType) acc.mult += mult;
      },
    },
  };
}
