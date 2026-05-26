import { JokerCategory, JokerRarity, isFaceCard } from '../types';
import { registerJoker, retriggerJoker } from './registry';

// ─── Retrigger Jokers ───────────────────────────────────────────

// Sock and Buskin: retrigger all face cards
registerJoker(retriggerJoker(
  'sock_and_buskin', 'Sock and Buskin',
  (card, _handType, allCardsFace) => allCardsFace || isFaceCard(card.rank)
));

// Hack: retrigger 2, 3, 4, 5
registerJoker(retriggerJoker(
  'hack', 'Hack',
  (card) => {
    if (card.rank === 'A') return false;
    const v = parseInt(card.rank);
    return [2, 3, 4, 5].includes(v);
  }
));

// Hanging Chad: retriggers first card played 2 additional times (handled in scorer)
registerJoker({
  id: 'hanging_chad', name: 'Hanging Chad',
  category: JokerCategory.Retrigger, rarity: JokerRarity.Common, cost: 4, copyable: true,
  effect: {
    getRetriggers: (_card, _handType) => {
      return 0;
    },
  },
});

// Dusk: retrigger all cards on final hand (handled via flags.isFinalHand in scorer)
registerJoker({
  id: 'dusk', name: 'Dusk',
  category: JokerCategory.Retrigger, rarity: JokerRarity.Uncommon, cost: 5, copyable: true,
  effect: {
    getRetriggers: (_card, _handType) => {
      return 0;
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

// Seltzer: retrigger all played cards for first 10 hands, then self-destructs
registerJoker({
  id: 'seltzer', name: 'Seltzer',
  category: JokerCategory.Retrigger, rarity: JokerRarity.Uncommon, cost: 6, copyable: true,
  effect: {
    getRetriggers: (_card, _handType) => 1,
  },
});
