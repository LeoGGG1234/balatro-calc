import { JokerCategory, JokerRarity } from '../types';
import { registerJoker } from './registry';

// ─── Economy Jokers ─────────────────────────────────────────────

// Delayed Gratification: $2 per discard at end of round
registerJoker({
  id: 'delayed_gratification', name: 'Delayed Gratification',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 4,
  copyable: false,
  effect: {},
});

// Egg: +$3 sell value per round
registerJoker({
  id: 'egg', name: 'Egg',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

// Golden Joker: +$4 at end of round
registerJoker({
  id: 'golden', name: 'Golden Joker',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 6, copyable: false,
  effect: {},
});

// Business Card: 1/2 chance $2 per face card played
registerJoker({
  id: 'business', name: 'Business Card',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

// Cloud 9: +$1 per 9 in full deck at end of round
registerJoker({
  id: 'cloud_9', name: 'Cloud 9',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 7, copyable: false,
  effect: {},
});

// Rough Gem: +$1 per diamond card in full deck at end of round
registerJoker({
  id: 'rough_gem', name: 'Rough Gem',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 7, copyable: false,
  effect: {},
});

// Credit Card: can go into debt up to -$20
registerJoker({
  id: 'credit_card', name: 'Credit Card',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 1, copyable: false,
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

// Golden Ticket: earn $ per hand played when you have $4 or less
registerJoker({
  id: 'ticket', name: 'Golden Ticket',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 5, copyable: false,
  effect: {},
});

// To-Do List: earn $ when hand matches current task, changes each round
registerJoker({
  id: 'todo_list', name: 'To-Do List',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

// Mail-In Rebate: earn $ per discarded card
registerJoker({
  id: 'mail', name: 'Mail-In Rebate',
  category: JokerCategory.Economy, rarity: JokerRarity.Uncommon, cost: 4, copyable: false,
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

// Reserved Parking: 1/2 chance each held face card gives $1
registerJoker({
  id: 'reserved_parking', name: 'Reserved Parking',
  category: JokerCategory.Economy, rarity: JokerRarity.Common, cost: 6, copyable: false,
  effect: {},
});
