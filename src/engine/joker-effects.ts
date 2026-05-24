import type {
  JokerDefinition, Card,
} from './types';
import {
  JokerCategory, JokerRarity, Rank, Suit, HandType,
  isFaceCard, isStone,
} from './types';

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

function plusMult(
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

function xMult(
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

function retriggerJoker(
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

function handContainsChips(
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

// ─── ALL JOKER DEFINITIONS ─────────────────────────────────────

// === +Chips (Common) ===

// Sly Joker: +50 chips if played hand contains a Pair
registerJoker(handContainsChips('sly_joker', 'Sly Joker', 50, [
  HandType.Pair, HandType.TwoPair, HandType.ThreeOfAKind, HandType.FullHouse,
  HandType.FourOfAKind, HandType.FiveOfAKind, HandType.FlushHouse, HandType.FlushFive,
], JokerRarity.Common, 3));

// Wily Joker: +100 chips if played hand contains a Three of a Kind
registerJoker(handContainsChips('wily_joker', 'Wily Joker', 100, [
  HandType.ThreeOfAKind, HandType.FullHouse, HandType.FourOfAKind,
  HandType.FiveOfAKind, HandType.FlushHouse, HandType.FlushFive,
]));

// Clever Joker: +80 chips if played hand contains Two Pair
registerJoker(handContainsChips('clever_joker', 'Clever Joker', 80, [
  HandType.TwoPair, HandType.FourOfAKind, HandType.FiveOfAKind,
  HandType.FlushHouse, HandType.FlushFive,
]));

// Devious Joker: +100 chips if played hand contains a Four of a Kind
registerJoker(handContainsChips('devious_joker', 'Devious Joker', 100, [
  HandType.FourOfAKind, HandType.FiveOfAKind, HandType.FlushFive,
]));

// Crafty Joker: +80 chips if played hand contains a Flush
registerJoker(handContainsChips('crafty_joker', 'Crafty Joker', 80, [
  HandType.Flush, HandType.StraightFlush, HandType.RoyalFlush,
  HandType.FlushHouse, HandType.FlushFive,
]));

// Half Joker: +20 chips if hand contains 3 or fewer cards
registerJoker({
  id: 'half_joker', name: 'Half Joker',
  category: JokerCategory.Chips, rarity: JokerRarity.Common, cost: 5, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      if (ctx.playedCards.length <= 3) acc.chips += 20;
    },
  },
});

// Banner: +30 chips per remaining discard
registerJoker({
  id: 'banner', name: 'Banner',
  category: JokerCategory.Chips, rarity: JokerRarity.Common, cost: 5, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      acc.chips += 30 * ctx.roundState.discardsUsed; // remaining = used (we store used)
      // Note: we should pass remaining, not used. The roundState.discardsUsed stores
      // how many have been used, but for full accuracy we'd need maxDiscards.
      // For now, we assume user knows their remaining discards and can adjust.
    },
  },
});

// Blue Joker: +2 chips per remaining card in deck
registerJoker({
  id: 'blue_joker', name: 'Blue Joker',
  category: JokerCategory.Chips, rarity: JokerRarity.Common, cost: 5, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      acc.chips += 2 * ctx.deckComposition.totalCards;
    },
  },
});

// Scary Face: +30 chips per face card played
registerJoker({
  id: 'scary_face', name: 'Scary Face',
  category: JokerCategory.Chips, rarity: JokerRarity.Common, cost: 4, copyable: true,
  effect: {
    onCardScored: (ctx, acc) => {
      if (ctx.isFaceCard) acc.chips += 30;
    },
  },
});

// Scholar: +20 chips and +4 mult per Ace played
registerJoker({
  id: 'scholar', name: 'Scholar',
  category: JokerCategory.Chips, rarity: JokerRarity.Common, cost: 4, copyable: true,
  effect: {
    onCardScored: (ctx, acc) => {
      if (ctx.card.rank === Rank.Ace) { acc.chips += 20; acc.mult += 4; }
    },
  },
});

// Walkie Talkie: +10 chips and +4 mult per 10 or 4 played
registerJoker({
  id: 'walkie_talkie', name: 'Walkie Talkie',
  category: JokerCategory.Chips, rarity: JokerRarity.Common, cost: 4, copyable: true,
  effect: {
    onCardScored: (ctx, acc) => {
      if (ctx.card.rank === Rank.Ten || ctx.card.rank === Rank.Four) {
        acc.chips += 10; acc.mult += 4;
      }
    },
  },
});

// === +Mult (Common) ===

registerJoker(plusMult('joker', 'Joker', 4, JokerRarity.Common, 2));

// Suit-based +mult jokers
function suitMultJoker(id: string, name: string, suit: Suit): JokerDefinition {
  return {
    id, name, category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 5, copyable: true,
    effect: {
      onCardScored: (ctx, acc) => {
        if (ctx.card.suit === suit) acc.mult += 4;
      },
    },
  };
}

registerJoker(suitMultJoker('greedy_joker', 'Greedy Joker', Suit.Diamonds));
registerJoker(suitMultJoker('lusty_joker', 'Lusty Joker', Suit.Hearts));
registerJoker(suitMultJoker('wrathful_joker', 'Wrathful Joker', Suit.Spades));
registerJoker(suitMultJoker('gluttonous_joker', 'Gluttonous Joker', Suit.Clubs));

// ─── Helper: hand-type conditional +Mult ──────────────────────

function handTypeMult(
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

// === Type-Mult Jokers (Common) ===

registerJoker(handTypeMult('jolly', 'Jolly Joker', 8, HandType.Pair, JokerRarity.Common, 3));
registerJoker(handTypeMult('zany', 'Zany Joker', 12, HandType.ThreeOfAKind, JokerRarity.Common, 4));
registerJoker(handTypeMult('mad', 'Mad Joker', 10, HandType.TwoPair, JokerRarity.Common, 4));
registerJoker(handTypeMult('crazy', 'Crazy Joker', 12, HandType.Straight, JokerRarity.Common, 4));
registerJoker(handTypeMult('droll', 'Droll Joker', 10, HandType.Flush, JokerRarity.Common, 4));

// Smiley Face: +5 mult per face card scored
registerJoker({
  id: 'smiley_face', name: 'Smiley Face',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 4, copyable: true,
  effect: {
    onCardScored: (ctx, acc) => {
      if (ctx.isFaceCard) acc.mult += 5;
    },
  },
});

// Ride the Bus: +1 mult per consecutive hand without face cards (user provides current value)
registerJoker({
  id: 'ride_the_bus', name: 'Ride the Bus',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 6, copyable: true,
  hasState: true, defaultState: { currentMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // Value is input by user
    },
  },
});

// Supernova: +1 mult per time this hand type has been played this run
registerJoker({
  id: 'supernova', name: 'Supernova',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 5, copyable: true,
  hasState: true, defaultState: { handsPlayedCount: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // Value is input by user
    },
  },
});

// Fortune Teller: +1 mult per tarot card used this run
registerJoker({
  id: 'fortune_teller', name: 'Fortune Teller',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 6, copyable: true,
  hasState: true, defaultState: { tarotsUsed: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // Value is input by user
    },
  },
});

// === Retrigger Jokers (Uncommon) ===

registerJoker(retriggerJoker(
  'sock_and_buskin', 'Sock and Buskin',
  (card, _handType, allCardsFace) => allCardsFace || isFaceCard(card.rank)
));

registerJoker(retriggerJoker(
  'hack', 'Hack',
  (card) => {
    if (card.rank === Rank.Ace) return false;
    const v = parseInt(card.rank);
    return [2, 3, 4, 5].includes(v);
  }
));

registerJoker({
  id: 'hanging_chad', name: 'Hanging Chad',
  category: JokerCategory.Retrigger, rarity: JokerRarity.Common, cost: 4, copyable: true,
  effect: {
    getRetriggers: (_card, _handType) => {
      // Hanging Chad retriggers the FIRST card played 2 additional times.
      // This is handled specially in the scorer, not here.
      return 0;
    },
  },
});

// Dusk: retrigger all cards on final hand
registerJoker({
  id: 'dusk', name: 'Dusk',
  category: JokerCategory.Retrigger, rarity: JokerRarity.Uncommon, cost: 5, copyable: true,
  effect: {
    getRetriggers: (_card, _handType) => {
      // Handled via flags.isFinalHand in scorer
      return 0;
    },
  },
});

// === ×Mult (Uncommon/Rare/Legendary) ===

// Joker Stencil: ×1 per empty joker slot (including itself's slot)
registerJoker({
  id: 'joker_stencil', name: 'Joker Stencil',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 8, copyable: true,
  hasState: true, defaultState: { emptySlots: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs empty slots count
    },
  },
});

// Blackboard: ×3 if all held cards are Spades or Clubs
registerJoker({
  id: 'blackboard', name: 'Blackboard',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      const held = ctx.heldInHandCards;
      if (held.length > 0 && held.every(c =>
        isStone(c) || c.suit === Suit.Spades || c.suit === Suit.Clubs
      )) {
        acc.mult *= 3;
      }
    },
  },
});

// Card Sharp: ×3 if hand type has already been played this round
registerJoker({
  id: 'card_sharp', name: 'Card Sharp',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      if (ctx.roundState.antes > 0 && ctx.flags.playedHandsThisRound.includes(ctx.handType)) {
        acc.mult *= 3;
      }
    },
  },
});

// Cavendish: ×3, 1/1000 destroy; only appears after Gros Michel destroyed
registerJoker(xMult('cavendish', 'Cavendish', 3, JokerRarity.Common, 4));

// Ramen: ×2, -0.01 per discard; Uncommon
registerJoker(xMult('ramen', 'Ramen', 2, JokerRarity.Uncommon, 6));

// Abstract Joker: +3 mult per joker (including itself)
registerJoker({
  id: 'abstract_joker', name: 'Abstract Joker',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 4, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      acc.mult += 3 * ctx.totalJokers;
    },
  },
});

// Gros Michel: +15 mult, 1/6 destroy
registerJoker(plusMult('gros_michel', 'Gros Michel', 15, JokerRarity.Common, 5));

// Odd Todd: +31 chips per odd rank card played
registerJoker({
  id: 'odd_todd', name: 'Odd Todd',
  category: JokerCategory.Chips, rarity: JokerRarity.Common, cost: 4, copyable: true,
  effect: {
    onCardScored: (ctx, acc) => {
      const odd = [Rank.Ace, Rank.Three, Rank.Five, Rank.Seven, Rank.Nine];
      if (odd.includes(ctx.card.rank)) acc.chips += 31;
    },
  },
});

// Even Steven: +4 mult per even rank card played
registerJoker({
  id: 'even_steven', name: 'Even Steven',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 4, copyable: true,
  effect: {
    onCardScored: (ctx, acc) => {
      const even = [Rank.Two, Rank.Four, Rank.Six, Rank.Eight, Rank.Ten];
      if (even.includes(ctx.card.rank)) acc.mult += 4;
    },
  },
});

// The Duo: ×2 if hand contains a Pair
registerJoker({
  id: 'the_duo', name: 'The Duo',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 8, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      if ([HandType.Pair, HandType.TwoPair, HandType.ThreeOfAKind,
            HandType.FullHouse, HandType.FourOfAKind, HandType.FiveOfAKind,
            HandType.FlushHouse, HandType.FlushFive].includes(ctx.handType)) {
        acc.mult *= 2;
      }
    },
  },
});

// The Trio: ×3 if hand contains Three of a Kind
registerJoker({
  id: 'the_trio', name: 'The Trio',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 8, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      if ([HandType.ThreeOfAKind, HandType.FourOfAKind, HandType.FiveOfAKind,
            HandType.FullHouse, HandType.FlushHouse, HandType.FlushFive].includes(ctx.handType)) {
        acc.mult *= 3;
      }
    },
  },
});

// The Family: ×4 if hand contains Four of a Kind
registerJoker({
  id: 'the_family', name: 'The Family',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 8, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      if ([HandType.FourOfAKind, HandType.FiveOfAKind, HandType.FlushFive].includes(ctx.handType)) {
        acc.mult *= 4;
      }
    },
  },
});

// The Order: ×3 if hand contains Straight
registerJoker({
  id: 'the_order', name: 'The Order',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 8, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      if ([HandType.Straight, HandType.StraightFlush, HandType.RoyalFlush].includes(ctx.handType)) {
        acc.mult *= 3;
      }
    },
  },
});

// The Tribe: ×2 if hand contains Flush
registerJoker({
  id: 'the_tribe', name: 'The Tribe',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 8, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      if ([HandType.Flush, HandType.StraightFlush, HandType.RoyalFlush,
            HandType.FlushHouse, HandType.FlushFive].includes(ctx.handType)) {
        acc.mult *= 2;
      }
    },
  },
});

// Photograph: first face card gives ×2 mult
registerJoker({
  id: 'photograph', name: 'Photograph',
  category: JokerCategory.XMult, rarity: JokerRarity.Common, cost: 5, copyable: true,
  effect: {
    onCardScored: (ctx, acc) => {
      if (ctx.retriggerIndex === 0 && ctx.isFaceCard) {
        acc.mult *= 2;
      }
    },
  },
});

// Bloodstone: 1/2 chance hearts ×1.5; for optimal calc, assume triggers
registerJoker({
  id: 'bloodstone', name: 'Bloodstone',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 7, copyable: true,
  effect: {
    onCardScored: (ctx, acc) => {
      if (ctx.card.suit === Suit.Hearts) acc.mult *= 1.5;
    },
  },
});

// Baron: each King held in hand gives ×1.5
registerJoker({
  id: 'baron', name: 'Baron',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 8, copyable: true,
  effect: {
    onHeldInHand: (ctx, acc) => {
      for (const card of ctx.heldCards) {
        if (card.rank === Rank.King) acc.mult *= 1.5;
      }
    },
  },
});

// Shoot the Moon: +13 mult per Queen held in hand
registerJoker({
  id: 'shoot_the_moon', name: 'Shoot the Moon',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 5, copyable: true,
  effect: {
    onHeldInHand: (ctx, acc) => {
      for (const card of ctx.heldCards) {
        if (card.rank === Rank.Queen) acc.mult += 13;
      }
    },
  },
});

// Mime: retrigger all held-in-hand abilities
registerJoker({
  id: 'mime', name: 'Mime',
  category: JokerCategory.Retrigger, rarity: JokerRarity.Uncommon, cost: 5, copyable: true,
  effect: {
    handlesHeldRetriggers: true,
  },
});

// Steel Joker: ×0.2 per Steel card in full deck
registerJoker({
  id: 'steel_joker', name: 'Steel Joker',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 7, copyable: true,
  hasState: true, defaultState: { steelCards: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current value; this is a multiplicative scaling per steel card
    },
  },
});

// Baseball Card: ×1.5 per Uncommon joker (including itself)
registerJoker({
  id: 'baseball_card', name: 'Baseball Card',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 8, copyable: true,
  effect: {
    // Complex: needs to know rarity of all jokers. Handled separately in scorer.
    onJokerEvaluate: (_ctx, _acc) => {},
  },
});

// === Legendary Jokers ===

// Triboulet: played Kings and Queens each give ×2 mult
registerJoker({
  id: 'triboulet', name: 'Triboulet',
  category: JokerCategory.XMult, rarity: JokerRarity.Legendary, cost: 20, copyable: true,
  effect: {
    onCardScored: (ctx, acc) => {
      if (ctx.card.rank === Rank.King || ctx.card.rank === Rank.Queen) {
        acc.mult *= 2;
      }
    },
  },
});

// Canio: ×1 per face card destroyed (user provides current value)
registerJoker({
  id: 'canio', name: 'Canio',
  category: JokerCategory.XMult, rarity: JokerRarity.Legendary, cost: 20, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult value
    },
  },
});

// Yorick: ×1 per 23 cards discarded (user provides current value)
registerJoker({
  id: 'yorick', name: 'Yorick',
  category: JokerCategory.XMult, rarity: JokerRarity.Legendary, cost: 20, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult value
    },
  },
});

// Perkeo: creates negative copies of consumables; not score-relevant
registerJoker({
  id: 'perkeo', name: 'Perkeo',
  category: JokerCategory.Effect, rarity: JokerRarity.Legendary, cost: 20,
  copyable: false,
  effect: {},
});

// Chicot: disables boss blind effect; not score-relevant
registerJoker({
  id: 'chicot', name: 'Chicot',
  category: JokerCategory.Effect, rarity: JokerRarity.Legendary, cost: 20,
  copyable: false,
  effect: {},
});

// === Effect Jokers (Blueprint/Brainstorm) ===

registerJoker({
  id: 'blueprint', name: 'Blueprint',
  category: JokerCategory.Effect, rarity: JokerRarity.Rare, cost: 10, copyable: false,
  effect: { resolvesDynamically: true },
});

registerJoker({
  id: 'brainstorm', name: 'Brainstorm',
  category: JokerCategory.Effect, rarity: JokerRarity.Rare, cost: 10, copyable: false,
  effect: { resolvesDynamically: true },
});

// === More Common/Uncommon Jokers ===

// Misprint: +0-23 mult (random each hand); for optimal calc, use max
registerJoker({
  id: 'misprint', name: 'Misprint',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 4, copyable: true,
  effect: {
    onJokerEvaluate: (_ctx, acc) => { acc.mult += 23; }, // best case
  },
});

// Popcorn: +20 mult, decreases by 4 each round (user provides current)
registerJoker({
  id: 'popcorn', name: 'Popcorn',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 5, copyable: true,
  hasState: true, defaultState: { currentMult: 20 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current value
    },
  },
});

// Arrowhead: +50 chips per Spade card played
registerJoker({
  id: 'arrowhead', name: 'Arrowhead',
  category: JokerCategory.Chips, rarity: JokerRarity.Uncommon, cost: 7, copyable: true,
  effect: {
    onCardScored: (ctx, acc) => {
      if (ctx.card.suit === Suit.Spades) acc.chips += 50;
    },
  },
});

// Onyx Agate: +7 mult per Club card played
registerJoker({
  id: 'onyx_agate', name: 'Onyx Agate',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Uncommon, cost: 7, copyable: true,
  effect: {
    onCardScored: (ctx, acc) => {
      if (ctx.card.suit === Suit.Clubs) acc.mult += 7;
    },
  },
});

// Seeing Double: ×2 if hand contains both a Club and a non-Club card
registerJoker({
  id: 'seeing_double', name: 'Seeing Double',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      const playedCards = ctx.playedCards;
      const hasClub = playedCards.some(c => c.suit === Suit.Clubs);
      const hasNonClub = playedCards.some(c => c.suit !== Suit.Clubs && !isStone(c));
      if (hasClub && hasNonClub) acc.mult *= 2;
    },
  },
});

// Driver's License: ×3 if deck has 16+ enhanced cards
registerJoker({
  id: 'drivers_license', name: "Driver's License",
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 7, copyable: true,
  hasState: true, defaultState: { enhancedCards: 16 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User confirms if condition is met
    },
  },
});

// Ceremonial Dagger: destroys right joker and gains its sell value as permanent +Mult
registerJoker({
  id: 'ceremonial_dagger', name: 'Ceremonial Dagger',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  hasState: true, defaultState: { currentMult: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current accumulated mult
    },
  },
});

// Constellation: ×0.1 per planet card used
registerJoker({
  id: 'constellation', name: 'Constellation',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult value
    },
  },
});

// Hologram: ×0.25 per playing card added to deck
registerJoker({
  id: 'hologram', name: 'Hologram',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 7, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult value
    },
  },
});

// Campfire: ×0.5 per card sold this round, resets each round
registerJoker({
  id: 'campfire', name: 'Campfire',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 9, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult value
    },
  },
});

// Acrobat: ×3 on final hand of round
registerJoker({
  id: 'acrobat', name: 'Acrobat',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      if (ctx.roundState.isFinalHand) acc.mult *= 3;
    },
  },
});

// Raised Fist: adds double the rank of the lowest card in hand (held cards too)
registerJoker({
  id: 'raised_fist', name: 'Raised Fist',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 5, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      // Lowest rank among remaining held cards after play
      const heldNonStone = ctx.heldInHandCards.filter(c => !isStone(c));
      if (heldNonStone.length > 0) {
        const ranks = [Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
                       Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten,
                       Rank.Jack, Rank.Queen, Rank.King, Rank.Ace];
        for (const r of ranks) {
          if (heldNonStone.some(c => c.rank === r)) {
            const chipVal = r === Rank.Ace ? 11 : r === Rank.King || r === Rank.Queen || r === Rank.Jack ? 10 : parseInt(r);
            acc.mult += chipVal * 2;
            break;
          }
        }
      }
    },
  },
});

// Faceless: +5 mult per face card discarded
registerJoker({
  id: 'faceless', name: 'Faceless',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 4, copyable: true,
  hasState: true, defaultState: { multGained: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current mult value
    },
  },
});

// Green Joker: +1 mult per hand played, -1 per discard
registerJoker({
  id: 'green_joker', name: 'Green Joker',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 4, copyable: true,
  hasState: true, defaultState: { currentMult: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current mult value
    },
  },
});

// Delayed Gratification: $2 per discard at end of round (economy, not score)
registerJoker({
  id: 'delayed_gratification', name: 'Delayed Gratification',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 4,
  copyable: false,
  effect: {},
});

// Splash: allows all cards to score; specialized joker not directly affecting score math
registerJoker({
  id: 'splash', name: 'Splash',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 3, copyable: false,
  effect: {},
});

// Burnt Joker: upgrades first discarded hand's level (not direct scoring)
registerJoker({
  id: 'burnt_joker', name: 'Burnt Joker',
  category: JokerCategory.Effect, rarity: JokerRarity.Rare, cost: 8, copyable: false,
  effect: {},
});

// Chaos the Clown: 1 free reroll per shop (not score)
registerJoker({
  id: 'chaos_the_clown', name: 'Chaos the Clown',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

// === Step 2: Simple numeric/effect jokers ===

// Juggler: +1 hand size
registerJoker({
  id: 'juggler', name: 'Juggler',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

// Drunkard: +1 discard
registerJoker({
  id: 'drunkard', name: 'Drunkard',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

// Egg: +$3 sell value per round (economy)
registerJoker({
  id: 'egg', name: 'Egg',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

// Ice Cream: +100 chips, -5 per hand played (user provides current)
registerJoker({
  id: 'ice_cream', name: 'Ice Cream',
  category: JokerCategory.Chips, rarity: JokerRarity.Common, cost: 5, copyable: true,
  hasState: true, defaultState: { currentChips: 100 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current chips value
    },
  },
});

// Golden Joker: +$4 at end of round (economy)
registerJoker({
  id: 'golden', name: 'Golden Joker',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 6, copyable: false,
  effect: {},
});

// Business Card: 1/2 chance $2 per face card played (economy, chance-based)
registerJoker({
  id: 'business', name: 'Business Card',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

// Square Joker: +4 chips per hand played (user provides current)
registerJoker({
  id: 'square', name: 'Square Joker',
  category: JokerCategory.Chips, rarity: JokerRarity.Common, cost: 4, copyable: true,
  hasState: true, defaultState: { currentChips: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current chips value
    },
  },
});

// Runner: +15 chips per Straight played (user provides current)
registerJoker({
  id: 'runner', name: 'Runner',
  category: JokerCategory.Chips, rarity: JokerRarity.Common, cost: 5, copyable: true,
  hasState: true, defaultState: { currentChips: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current chips value
    },
  },
});

// Red Card: +3 mult per skipped booster pack (user provides current)
registerJoker({
  id: 'red_card', name: 'Red Card',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 5, copyable: true,
  hasState: true, defaultState: { currentMult: 3 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current mult value
    },
  },
});

// Mystic Summit: +15 mult when 0 discards remaining
registerJoker({
  id: 'mystic_summit', name: 'Mystic Summit',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 5, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      if (ctx.roundState.discardsUsed === ctx.roundState.maxDiscards) acc.mult += 15;
    },
  },
});

// Superposition: creates Tarot card if hand contains Ace and Straight (not score)
registerJoker({
  id: 'superposition', name: 'Superposition',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

// Swashbuckler: +Mult equal to total sell value of all jokers (user provides)
registerJoker({
  id: 'swashbuckler', name: 'Swashbuckler',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 4, copyable: true,
  hasState: true, defaultState: { totalSellValue: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs total sell value of all jokers
    },
  },
});

// Bull: +2 Chips per dollar held
registerJoker({
  id: 'bull', name: 'Bull',
  category: JokerCategory.Chips, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      acc.chips += ctx.roundState.dollars * 2;
    },
  },
});

// Bootstraps: +2 Mult per $5 held
registerJoker({
  id: 'bootstraps', name: 'Bootstraps',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Uncommon, cost: 7, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      acc.mult += Math.floor(ctx.roundState.dollars / 5) * 2;
    },
  },
});

// Stone Joker: +25 Chips per Stone card in deck (user provides count)
registerJoker({
  id: 'stone', name: 'Stone Joker',
  category: JokerCategory.Chips, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  hasState: true, defaultState: { stoneCards: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs stone card count
    },
  },
});

// Erosion: +4 Mult per card below 52 in deck
registerJoker({
  id: 'erosion', name: 'Erosion',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      acc.mult += Math.max(0, 52 - ctx.deckComposition.totalCards) * 4;
    },
  },
});

// Hiker: +5 Chips permanently to every scoring card played (user provides hiked count)
registerJoker({
  id: 'hiker', name: 'Hiker',
  category: JokerCategory.Chips, rarity: JokerRarity.Uncommon, cost: 5, copyable: true,
  hasState: true, defaultState: { hikedCards: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs number of hiked cards in hand
    },
  },
});

// Flash Card: +2 Mult per reroll in shop (user provides current mult)
registerJoker({
  id: 'flash', name: 'Flash Card',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Uncommon, cost: 5, copyable: true,
  hasState: true, defaultState: { currentMult: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs accumulated mult from rerolls
    },
  },
});

// Cloud 9: +$1 per 9 in full deck at end of round (economy)
registerJoker({
  id: 'cloud_9', name: 'Cloud 9',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 7, copyable: false,
  effect: {},
});

// === Step 3: Conditional / Accumulating Jokers ===

// Trousers: +2 mult per Two Pair hand played this run (user provides count)
registerJoker({
  id: 'trousers', name: 'Trousers',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  hasState: true, defaultState: { twoPairCount: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs accumulated +Mult from Two Pairs played
    },
  },
});

// Castle: +3 chips per discard when this joker is present (user provides total)
registerJoker({
  id: 'castle', name: 'Castle',
  category: JokerCategory.Chips, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  hasState: true, defaultState: { currentChips: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current chips from discards
    },
  },
});

// Lucky Cat: ×0.25 per Lucky card proc (user provides current ×Mult)
registerJoker({
  id: 'lucky_cat', name: 'Lucky Cat',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult value
    },
  },
});

// Glass Joker: ×0.5 per Glass card destroyed (user provides current ×Mult)
registerJoker({
  id: 'glass', name: 'Glass Joker',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult value
    },
  },
});

// Flower Pot: ×3 if hand contains all 4 suits (Diamond, Club, Heart, Spade)
registerJoker({
  id: 'flower_pot', name: 'Flower Pot',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      const suits = new Set(ctx.playedCards.map(c => c.suit));
      if (suits.has(Suit.Diamonds) && suits.has(Suit.Clubs) &&
          suits.has(Suit.Hearts) && suits.has(Suit.Spades)) {
        acc.mult *= 3;
      }
    },
  },
});

// Wee Joker: +2 chips per 2 scored this run (user provides current total)
registerJoker({
  id: 'wee', name: 'Wee Joker',
  category: JokerCategory.Chips, rarity: JokerRarity.Rare, cost: 8, copyable: true,
  hasState: true, defaultState: { currentChips: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current chips total
    },
  },
});

// Throwback: ×0.25 per blind skipped this run (user provides current ×Mult)
registerJoker({
  id: 'throwback', name: 'Throwback',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult value
    },
  },
});

// Hit the Road: ×0.5 per Jack discarded this round (user provides current ×Mult)
registerJoker({
  id: 'hit_the_road', name: 'Hit the Road',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 8, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult for this round
    },
  },
});

// Rough Gem: +$1 per diamond card in full deck at end of round (economy)
registerJoker({
  id: 'rough_gem', name: 'Rough Gem',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 7, copyable: false,
  effect: {},
});

// Marble Joker: adds 1 stone card to deck when blind selected (effect, non-scoring)
registerJoker({
  id: 'marble', name: 'Marble Joker',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  effect: {},
});

// Seltzer: retrigger all played cards for first 10 hands, then self-destructs
registerJoker({
  id: 'seltzer', name: 'Seltzer',
  category: JokerCategory.Retrigger, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  effect: {
    getRetriggers: (_card, _handType) => 1,
  },
});

// Pareidolia: all cards are considered face cards
registerJoker({
  id: 'pareidolia', name: 'Pareidolia',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 5, copyable: false,
  effect: {},
});

// Oops! All 6s: doubles all listed probabilities
registerJoker({
  id: 'oops_all_6s', name: 'Oops! All 6s',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 4, copyable: false,
  effect: {},
});

// Turtle Bean: +5 hand size, decreases by 1 each round
registerJoker({
  id: 'turtle_bean', name: 'Turtle Bean',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  hasState: true, defaultState: { handSizeBonus: 5 },
  effect: {},
});

// Credit Card: can go into debt up to -$20
registerJoker({
  id: 'credit_card', name: 'Credit Card',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 1, copyable: false,
  effect: {},
});

// Space Joker: 1 in 4 chance to upgrade played hand level
registerJoker({
  id: 'space', name: 'Space Joker',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 5, copyable: false,
  effect: {},
});

// Gift Joker: earn $ per discard at end of round
registerJoker({
  id: 'gift', name: 'Gift Joker',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  effect: {},
});

// Rocket: +$1 at end of round, gains +$2 each round
registerJoker({
  id: 'rocket', name: 'Rocket',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  effect: {},
});

// To the Moon: interest cap increases, extra $1 per interest dollar
registerJoker({
  id: 'to_the_moon', name: 'To the Moon',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 5, copyable: false,
  effect: {},
});

// Ticket: earn $ per hand played when you have $4 or less
registerJoker({
  id: 'ticket', name: 'Golden Ticket',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 5, copyable: false,
  effect: {},
});

// === Batch 5: 10 Economy/Effect Jokers ===

// To-Do List: earn $ when hand matches current task, changes each round
registerJoker({
  id: 'todo_list', name: 'To-Do List',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

// Hallucination: 1 in 2 chance to create a Tarot card when blind selected
registerJoker({
  id: 'hallucination', name: 'Hallucination',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

// Ring Master: Joker, Polychrome, Holo, Foil editions appear 3x more often
registerJoker({
  id: 'ring_master', name: 'Showman',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 5, copyable: false,
  effect: {},
});

// Mail-In Rebate: earn $ per discarded card
registerJoker({
  id: 'mail', name: 'Mail-In Rebate',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 4, copyable: false,
  effect: {},
});

// Seance: if hand is a Straight Flush, create a Spectral card
registerJoker({
  id: 'seance', name: 'Seance',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  effect: {},
});

// Sixth Sense: when blind selected, create a Spectral card
registerJoker({
  id: 'sixth_sense', name: 'Sixth Sense',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  effect: {},
});

// Satellite: +$ at end of round per unique planet card used this run
registerJoker({
  id: 'satellite', name: 'Satellite',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  effect: {},
});

// Cartomancer: when blind selected, create a Tarot card
registerJoker({
  id: 'cartomancer', name: 'Cartomancer',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  effect: {},
});

// Astronomer: planet cards and planet packs in shop are free
registerJoker({
  id: 'astronomer', name: 'Astronomer',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 8, copyable: false,
  effect: {},
});

// Diet Cola: sell to create a Double Tag
registerJoker({
  id: 'diet_cola', name: 'Diet Cola',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  effect: {},
});

// === Batch 6: 10 Mixed Jokers (130→140/150) ===

// Trading: sell to remove a card from deck
registerJoker({
  id: 'trading', name: 'Trading',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  effect: {},
});

// Matador: +$ when boss blind ability triggers
registerJoker({
  id: 'matador', name: 'Matador',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 7, copyable: false,
  effect: {},
});

// Mr. Bones: prevents death if chips scored >= 25% of required score
registerJoker({
  id: 'mr_bones', name: 'Mr. Bones',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 5, copyable: false,
  effect: {},
});

// Certificate: when blind selected, add a random seal to each card in hand
registerJoker({
  id: 'certificate', name: 'Certificate',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  effect: {},
});

// Merry Andy: +3 discards, -1 hand size
registerJoker({
  id: 'merry_andy', name: 'Merry Andy',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 7, copyable: false,
  effect: {},
});

// Stuntman: +250 chips, -2 hand size
registerJoker({
  id: 'stuntman', name: 'Stuntman',
  category: JokerCategory.Chips, rarity: JokerRarity.Rare, cost: 7, copyable: true,
  effect: {
    onJokerEvaluate: (_ctx, acc) => { acc.chips += 250; },
  },
});

// Troubadour: +2 hand size
registerJoker({
  id: 'troubadour', name: 'Troubadour',
  category: JokerCategory.Effect, rarity: JokerRarity.Rare, cost: 6, copyable: false,
  effect: {},
});

// Luchador: sell to disable current boss blind
registerJoker({
  id: 'luchador', name: 'Luchador',
  category: JokerCategory.Effect, rarity: JokerRarity.Rare, cost: 5, copyable: false,
  effect: {},
});

// Midas Mask: face cards become Gold cards when scored
registerJoker({
  id: 'midas_mask', name: 'Midas Mask',
  category: JokerCategory.Effect, rarity: JokerRarity.Rare, cost: 7, copyable: false,
  effect: {},
});

// DNA: copy first card in hand when only 1 hand played this round
registerJoker({
  id: 'dna', name: 'DNA',
  category: JokerCategory.Effect, rarity: JokerRarity.Rare, cost: 8, copyable: false,
  effect: {},
});

// === Batch 7: Final 10 Jokers (140→150/150) ===

// Four Fingers: Straights and Flushes can be made with 4 cards
registerJoker({
  id: 'four_fingers', name: 'Four Fingers',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 7, copyable: false,
  effect: {},
});

// Smeared Joker: Hearts/Diamonds count as same suit, Spades/Clubs count as same suit
registerJoker({
  id: 'smeared', name: 'Smeared Joker',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 7, copyable: false,
  effect: {},
});

// Shortcut: Straights can be made with gaps of 1 rank
registerJoker({
  id: 'shortcut', name: 'Shortcut',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 7, copyable: false,
  effect: {},
});

// Vagabond: create a Tarot card when hand played with $4 or less
registerJoker({
  id: 'vagabond', name: 'Vagabond',
  category: JokerCategory.Effect, rarity: JokerRarity.Rare, cost: 8, copyable: false,
  effect: {},
});

// Invisible Joker: sell to duplicate a random joker
registerJoker({
  id: 'invisible', name: 'Invisible Joker',
  category: JokerCategory.Effect, rarity: JokerRarity.Rare, cost: 8, copyable: false,
  effect: {},
});

// Obelisk: x0.2 mult per consecutive hand NOT your most played hand type
registerJoker({
  id: 'obelisk', name: 'Obelisk',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 8, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult value
    },
  },
});

// Ancient Joker: x1.5 mult per card of selected suit, suit changes each round
registerJoker({
  id: 'ancient', name: 'Ancient Joker',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 8, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult value
    },
  },
});

// Loyalty Card: x4 mult every 6 hands played
registerJoker({
  id: 'loyalty_card', name: 'Loyalty Card',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 5, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs x4 or x1 depending on hand count
    },
  },
});

// Madness: gain x0.5 mult when small/big blind selected
registerJoker({
  id: 'madness', name: 'Madness',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 7, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult value
    },
  },
});

// Idol: x1 mult per card of selected rank in hand
registerJoker({
  id: 'idol', name: 'Idol',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 6, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult value
    },
  },
});

// === Batch 8: Missing Jokers from official 150 (145→150/150) ===

// 8 Ball: 1/4 chance to create a Tarot card when any played 8 is scored (economy)
registerJoker({
  id: 'eight_ball', name: '8 Ball',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 5, copyable: false,
  effect: {},
});

// Burglar: +3 hands, lose all discards when Blind selected (effect)
registerJoker({
  id: 'burglar', name: 'Burglar',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  effect: {},
});

// Fibonacci: +8 Mult per Ace, 2, 3, 5, or 8 scored
registerJoker({
  id: 'fibonacci', name: 'Fibonacci',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Uncommon, cost: 7, copyable: true,
  effect: {
    onCardScored: (ctx, acc) => {
      const fibRanks = [Rank.Ace, Rank.Two, Rank.Three, Rank.Five, Rank.Eight];
      if (fibRanks.includes(ctx.card.rank)) acc.mult += 8;
    },
  },
});

// Reserved Parking: 1/2 chance each held face card gives $1 (economy)
registerJoker({
  id: 'reserved_parking', name: 'Reserved Parking',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 6, copyable: false,
  effect: {},
});

// Riff-Raff: when Blind selected, create 2 Common Jokers (effect)
registerJoker({
  id: 'riff_raff', name: 'Riff-Raff',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 5, copyable: false,
  effect: {},
});

// Vampire: removes enhancement from scored cards, gains +0.1X Mult per enhancement removed
registerJoker({
  id: 'vampire', name: 'Vampire',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 7, copyable: true,
  hasState: true, defaultState: { xMult: 1 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current xMult value from enhancements consumed
    },
  },
});

export function initJokerRegistry(): void {
  // Registry is populated via registerJoker calls above when the module loads.
}
