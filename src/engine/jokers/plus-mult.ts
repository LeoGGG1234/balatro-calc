import { JokerCategory, JokerRarity, Rank, Suit, HandType, isStone, rankToChips } from '../types';
import { registerJoker, plusMult, suitMultJoker, handTypeMult } from './registry';

// ─── +Mult Jokers ───────────────────────────────────────────────

// Joker: +4 mult
registerJoker(plusMult('joker', 'Joker', 4, JokerRarity.Common, 2));

// Suit-based +mult jokers
registerJoker(suitMultJoker('greedy_joker', 'Greedy Joker', Suit.Diamonds));
registerJoker(suitMultJoker('lusty_joker', 'Lusty Joker', Suit.Hearts));
registerJoker(suitMultJoker('wrathful_joker', 'Wrathful Joker', Suit.Spades));
registerJoker(suitMultJoker('gluttonous_joker', 'Gluttonous Joker', Suit.Clubs));

// Hand-type conditional +Mult
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

// Misprint: +0-23 mult (random each hand); for optimal calc, use max
registerJoker({
  id: 'misprint', name: 'Misprint',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 4, copyable: true,
  effect: {
    onJokerEvaluate: (_ctx, acc) => { acc.mult += 23; },
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

// Raised Fist: adds double the rank of the lowest card in hand (held cards too)
registerJoker({
  id: 'raised_fist', name: 'Raised Fist',
  category: JokerCategory.PlusMult, rarity: JokerRarity.Common, cost: 5, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      const heldNonStone = ctx.heldInHandCards.filter(c => !isStone(c));
      if (heldNonStone.length > 0) {
        const ranks = [Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
                       Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten,
                       Rank.Jack, Rank.Queen, Rank.King, Rank.Ace];
        for (const r of ranks) {
          if (heldNonStone.some(c => c.rank === r)) {
            acc.mult += rankToChips(r) * 2;
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
