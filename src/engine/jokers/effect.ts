import { JokerCategory, JokerRarity } from '../types';
import { registerJoker } from './registry';

// ─── Effect Jokers (non-scoring) ────────────────────────────────

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

// Blueprint: copies ability of joker to the right
registerJoker({
  id: 'blueprint', name: 'Blueprint',
  category: JokerCategory.Effect, rarity: JokerRarity.Rare, cost: 10, copyable: false,
  effect: { resolvesDynamically: true },
});

// Brainstorm: copies ability of leftmost joker
registerJoker({
  id: 'brainstorm', name: 'Brainstorm',
  category: JokerCategory.Effect, rarity: JokerRarity.Rare, cost: 10, copyable: false,
  effect: { resolvesDynamically: true },
});

// Splash: allows all cards to score
registerJoker({
  id: 'splash', name: 'Splash',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 3, copyable: false,
  effect: {},
});

// Burnt Joker: upgrades first discarded hand's level
registerJoker({
  id: 'burnt_joker', name: 'Burnt Joker',
  category: JokerCategory.Effect, rarity: JokerRarity.Rare, cost: 8, copyable: false,
  effect: {},
});

// Chaos the Clown: 1 free reroll per shop
registerJoker({
  id: 'chaos_the_clown', name: 'Chaos the Clown',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

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

// Superposition: creates Tarot card if hand contains Ace and Straight
registerJoker({
  id: 'superposition', name: 'Superposition',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

// Marble Joker: adds 1 stone card to deck when blind selected
registerJoker({
  id: 'marble', name: 'Marble Joker',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  effect: {},
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

// Space Joker: 1 in 4 chance to upgrade played hand level
registerJoker({
  id: 'space', name: 'Space Joker',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 5, copyable: false,
  effect: {},
});

// Hallucination: 1 in 2 chance to create a Tarot card when blind selected
registerJoker({
  id: 'hallucination', name: 'Hallucination',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 4, copyable: false,
  effect: {},
});

// Showman: Joker, Polychrome, Holo, Foil editions appear 3x more often
registerJoker({
  id: 'ring_master', name: 'Showman',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 5, copyable: false,
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

// 8 Ball: 1/4 chance to create a Tarot card when any played 8 is scored
registerJoker({
  id: 'eight_ball', name: '8 Ball',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 5, copyable: false,
  effect: {},
});

// Burglar: +3 hands, lose all discards when Blind selected
registerJoker({
  id: 'burglar', name: 'Burglar',
  category: JokerCategory.Effect, rarity: JokerRarity.Uncommon, cost: 6, copyable: false,
  effect: {},
});

// Riff-Raff: when Blind selected, create 2 Common Jokers
registerJoker({
  id: 'riff_raff', name: 'Riff-Raff',
  category: JokerCategory.Effect, rarity: JokerRarity.Common, cost: 5, copyable: false,
  effect: {},
});
