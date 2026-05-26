import { JokerCategory, JokerRarity, Rank, Suit, HandType, isStone } from '../types';
import { registerJoker, xMult } from './registry';
import { getJoker } from './registry';

// ─── ×Mult Jokers ───────────────────────────────────────────────

// Cavendish: ×3, 1/1000 destroy; only appears after Gros Michel destroyed
registerJoker(xMult('cavendish', 'Cavendish', 3, JokerRarity.Common, 4));

// Ramen: ×2, -0.01 per discard; Uncommon
registerJoker(xMult('ramen', 'Ramen', 2, JokerRarity.Uncommon, 6));

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
      if (ctx.flags.playedHandsThisRound.includes(ctx.handType)) {
        acc.mult *= 3;
      }
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

// Steel Joker: ×0.2 per Steel card in full deck
registerJoker({
  id: 'steel_joker', name: 'Steel Joker',
  category: JokerCategory.XMult, rarity: JokerRarity.Uncommon, cost: 7, copyable: true,
  hasState: true, defaultState: { steelCards: 0 },
  effect: {
    onJokerEvaluate: (_ctx, _acc) => {
      // User inputs current value
    },
  },
});

// Baseball Card: ×1.5 per Uncommon joker (including itself)
registerJoker({
  id: 'baseball_card', name: 'Baseball Card',
  category: JokerCategory.XMult, rarity: JokerRarity.Rare, cost: 8, copyable: true,
  effect: {
    onJokerEvaluate: (ctx, acc) => {
      let uncommons = 0;
      for (const j of ctx.allJokersWithEditions) {
        const def = getJoker(j.id);
        if (def && def.rarity === JokerRarity.Uncommon) uncommons++;
      }
      acc.mult *= Math.pow(1.5, uncommons);
    },
  },
});

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
