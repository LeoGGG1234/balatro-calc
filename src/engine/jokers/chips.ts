import { JokerCategory, JokerRarity, Rank, Suit, HandType } from '../types';
import { registerJoker, handContainsChips } from './registry';

// ─── +Chips Jokers ──────────────────────────────────────────────

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
      acc.chips += 30 * (ctx.roundState.maxDiscards - ctx.roundState.discardsUsed);
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

// Stuntman: +250 chips, -2 hand size
registerJoker({
  id: 'stuntman', name: 'Stuntman',
  category: JokerCategory.Chips, rarity: JokerRarity.Rare, cost: 7, copyable: true,
  effect: {
    onJokerEvaluate: (_ctx, acc) => { acc.chips += 250; },
  },
});
