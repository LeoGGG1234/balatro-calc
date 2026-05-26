import type {
  JokerDefinition, JokerInstance, JokerModifiers,
} from './types';
import { JokerCategory, JokerRarity } from './types';
import { getJoker, getAllJokers, getJokersByCategory } from './joker-effects';

// ─── Exports from joker-effects ─────────────────────────────────

export { getJoker, getAllJokers, getJokersByCategory };

// ─── State-based Joker Override Definitions ────────────────────

/**
 * For jokers whose effect depends on accumulated state (e.g., Hologram's
 * xMult, Ride the Bus's +mult), users provide the current value directly.
 * This interface describes what value the user needs to input for a given joker.
 */
export interface JokerStateInput {
  jokerId: string;
  label: string;
  description: string;
  defaultValue: number;
  unit: string; // '+mult', 'xMult', '+chips', etc.
}

/**
 * Map of joker ID to its state input definition.
 * Only jokers with hasState: true need entries here.
 */
export const JOKER_STATE_INPUTS: Record<string, JokerStateInput> = {
  ride_the_bus: {
    jokerId: 'ride_the_bus',
    label: 'Current +Mult',
    description: 'Current accumulated mult (starts at 1)',
    defaultValue: 1,
    unit: '+mult',
  },
  supernova: {
    jokerId: 'supernova',
    label: 'Hands played',
    description: 'Number of times this hand type has been played this run',
    defaultValue: 0,
    unit: '+mult',
  },
  fortune_teller: {
    jokerId: 'fortune_teller',
    label: 'Tarot cards used',
    description: 'Number of tarot cards used this run',
    defaultValue: 0,
    unit: '+mult',
  },
  green_joker: {
    jokerId: 'green_joker',
    label: 'Current +Mult',
    description: 'Current accumulated mult: +1 per hand played, -1 per discard',
    defaultValue: 0,
    unit: '+mult',
  },
  popcorn: {
    jokerId: 'popcorn',
    label: 'Current +Mult',
    description: 'Current mult (starts at +20, decreases by 4 each round)',
    defaultValue: 20,
    unit: '+mult',
  },
  ceremonial_dagger: {
    jokerId: 'ceremonial_dagger',
    label: 'Current +Mult',
    description: 'Accumulated mult from destroyed jokers',
    defaultValue: 0,
    unit: '+mult',
  },
  faceless: {
    jokerId: 'faceless',
    label: 'Current +Mult',
    description: 'Mult gained from discarding face cards',
    defaultValue: 0,
    unit: '+mult',
  },
  hologram: {
    jokerId: 'hologram',
    label: 'Current ×Mult',
    description: 'Current xMult: starts at ×1, +×0.25 per card added',
    defaultValue: 1,
    unit: 'xMult',
  },
  constellation: {
    jokerId: 'constellation',
    label: 'Current ×Mult',
    description: 'Current xMult: starts at ×1, +×0.1 per planet card used',
    defaultValue: 1,
    unit: 'xMult',
  },
  campfire: {
    jokerId: 'campfire',
    label: 'Current ×Mult',
    description: 'Current xMult: ×0.5 per card sold this round',
    defaultValue: 1,
    unit: 'xMult',
  },
  canio: {
    jokerId: 'canio',
    label: 'Current ×Mult',
    description: 'Current xMult: ×1 per face card destroyed',
    defaultValue: 1,
    unit: 'xMult',
  },
  yorick: {
    jokerId: 'yorick',
    label: 'Current ×Mult',
    description: 'Current xMult: ×1 per 23 cards discarded',
    defaultValue: 1,
    unit: 'xMult',
  },
  steel_joker: {
    jokerId: 'steel_joker',
    label: 'Steel cards in deck',
    description: '+×0.2 per Steel card in full deck',
    defaultValue: 0,
    unit: 'xMult',
  },
  drivers_license: {
    jokerId: 'drivers_license',
    label: 'Enhanced cards',
    description: 'Total enhanced cards in deck (need 16+ for ×3)',
    defaultValue: 0,
    unit: 'cards',
  },
  joker_stencil: {
    jokerId: 'joker_stencil',
    label: 'Empty joker slots',
    description: 'Number of empty joker slots (×1 per empty slot)',
    defaultValue: 1,
    unit: 'xMult',
  },
  ice_cream: {
    jokerId: 'ice_cream',
    label: 'Current +Chips',
    description: 'Current chips (starts at 100, -5 per hand played)',
    defaultValue: 100,
    unit: '+chips',
  },
  square: {
    jokerId: 'square',
    label: 'Current +Chips',
    description: 'Current chips: +4 per hand played this run',
    defaultValue: 0,
    unit: '+chips',
  },
  runner: {
    jokerId: 'runner',
    label: 'Current +Chips',
    description: 'Current chips: +15 per Straight played this run',
    defaultValue: 0,
    unit: '+chips',
  },
  red_card: {
    jokerId: 'red_card',
    label: 'Current +Mult',
    description: 'Current mult: +3 per skipped booster pack this run',
    defaultValue: 3,
    unit: '+mult',
  },
  swashbuckler: {
    jokerId: 'swashbuckler',
    label: 'Sell value total',
    description: 'Total sell value of all current jokers',
    defaultValue: 0,
    unit: '+mult',
  },
  stone: {
    jokerId: 'stone',
    label: 'Stone cards',
    description: 'Number of Stone cards in deck (each adds +25 chips)',
    defaultValue: 0,
    unit: '+chips',
  },
  hiker: {
    jokerId: 'hiker',
    label: 'Hiked cards in hand',
    description: 'Number of hiked cards in current hand (each adds +5 chips)',
    defaultValue: 0,
    unit: '+chips',
  },
  flash: {
    jokerId: 'flash',
    label: 'Current +Mult',
    description: 'Current mult accumulated from shop rerolls (+2 per reroll)',
    defaultValue: 0,
    unit: '+mult',
  },
  trousers: {
    jokerId: 'trousers',
    label: 'Two Pair hands played',
    description: 'Total +Mult: 2 × number of Two Pair hands played this run',
    defaultValue: 0,
    unit: '+mult',
  },
  castle: {
    jokerId: 'castle',
    label: 'Current +Chips',
    description: 'Current chips: 3 × number of discards with this joker',
    defaultValue: 0,
    unit: '+chips',
  },
  lucky_cat: {
    jokerId: 'lucky_cat',
    label: 'Current ×Mult',
    description: 'Current xMult: starts at ×1, +×0.25 per Lucky card proc',
    defaultValue: 1,
    unit: 'xMult',
  },
  glass: {
    jokerId: 'glass',
    label: 'Current ×Mult',
    description: 'Current xMult: starts at ×1, +×0.5 per Glass card destroyed',
    defaultValue: 1,
    unit: 'xMult',
  },
  wee: {
    jokerId: 'wee',
    label: 'Current +Chips',
    description: 'Current chips: 2 × number of 2s scored this run',
    defaultValue: 0,
    unit: '+chips',
  },
  throwback: {
    jokerId: 'throwback',
    label: 'Current ×Mult',
    description: 'Current xMult: starts at ×1, +×0.25 per blind skipped',
    defaultValue: 1,
    unit: 'xMult',
  },
  hit_the_road: {
    jokerId: 'hit_the_road',
    label: 'Current ×Mult',
    description: 'Current xMult this round: starts at ×1, +×0.5 per Jack discarded',
    defaultValue: 1,
    unit: 'xMult',
  },
  turtle_bean: {
    jokerId: 'turtle_bean',
    label: 'Current hand size bonus',
    description: 'Current hand size bonus (starts at +5, -1 each round)',
    defaultValue: 5,
    unit: '+hands',
  },
  obelisk: {
    jokerId: 'obelisk',
    label: 'Current ×Mult',
    description: 'Current xMult: starts at ×1, +×0.2 per differing hand type played',
    defaultValue: 1,
    unit: 'xMult',
  },
  ancient: {
    jokerId: 'ancient',
    label: 'Current ×Mult',
    description: 'Current xMult: ×1.5 per card of the selected suit this round',
    defaultValue: 1,
    unit: 'xMult',
  },
  loyalty_card: {
    jokerId: 'loyalty_card',
    label: 'Current ×Mult',
    description: '×4 every 6 hands played, ×1 otherwise',
    defaultValue: 1,
    unit: 'xMult',
  },
  madness: {
    jokerId: 'madness',
    label: 'Current ×Mult',
    description: 'Current xMult: starts at ×1, +×0.5 per small/big blind selected',
    defaultValue: 1,
    unit: 'xMult',
  },
  idol: {
    jokerId: 'idol',
    label: 'Current ×Mult',
    description: 'Current xMult: ×1 per card of the selected rank in hand',
    defaultValue: 1,
    unit: 'xMult',
  },
};

// ─── User-Provided Joker State (for overriding dynamic values) ─

/**
 * Map from joker instance index (in the jokers array) to a numeric value.
 * Used by the scorer to apply state-based joker effects without tracking
 * the game's full state history.
 */
export type JokerStateOverrides = Record<number, number>;

/**
 * Resolve the effective numeric value for a state-based joker.
 */
export function resolveJokerState(
  jokerId: string,
  jokerIndex: number,
  overrides: JokerStateOverrides
): number {
  const input = JOKER_STATE_INPUTS[jokerId];
  if (!input) return 0;
  return overrides[jokerIndex] ?? input.defaultValue;
}

// ─── Joker Modifiers (non-scoring effects) ─────────────────────

export function getJokerModifiers(jokers: JokerInstance[]): JokerModifiers {
  const ids = new Set(jokers.map(j => j.id));
  return {
    fourFingers: ids.has('four_fingers'),
    smeared: ids.has('smeared'),
    shortcut: ids.has('shortcut'),
    allCardsFace: ids.has('pareidolia'),
  };
}

// ─── Joker Round Modifiers (hand size, discards, max hands) ──────

export interface JokerRoundModifiers {
  handSizeBonus: number;
  maxHandsBonus: number;
  maxDiscardsBonus: number;
}

/**
 * Compute round-state modifications from jokers.
 * Called by the UI layer to factor joker contributions into effective
 * hand size, max hands, and max discards.
 */
export function getJokerRoundModifiers(jokers: JokerInstance[]): JokerRoundModifiers {
  let handSizeBonus = 0;
  let maxHandsBonus = 0;
  let maxDiscardsBonus = 0;

  for (const j of jokers) {
    switch (j.id) {
      case 'juggler':
        handSizeBonus += 1;
        break;
      case 'turtle_bean':
        handSizeBonus += 5;
        break;
      case 'troubadour':
        handSizeBonus += 2;
        maxHandsBonus -= 1;
        break;
      case 'merry_andy':
        handSizeBonus -= 1;
        maxDiscardsBonus += 3;
        break;
      case 'stuntman':
        handSizeBonus -= 2;
        break;
      case 'drunkard':
        maxDiscardsBonus += 1;
        break;
    }
  }

  return { handSizeBonus, maxHandsBonus, maxDiscardsBonus };
}

// ─── Joker Utility Functions ───────────────────────────────────

export function getJokerCategoryLabel(cat: JokerCategory): string {
  switch (cat) {
    case JokerCategory.Chips: return '+Chips';
    case JokerCategory.PlusMult: return '+Mult';
    case JokerCategory.XMult: return '×Mult';
    case JokerCategory.Retrigger: return 'Retrigger';
    case JokerCategory.Effect: return 'Effect';
    case JokerCategory.Economy: return 'Economy';
  }
}

export function getRarityLabel(rarity: JokerRarity): string {
  switch (rarity) {
    case JokerRarity.Common: return 'Common';
    case JokerRarity.Uncommon: return 'Uncommon';
    case JokerRarity.Rare: return 'Rare';
    case JokerRarity.Legendary: return 'Legendary';
  }
}

export function searchJokers(query: string): JokerDefinition[] {
  const q = query.toLowerCase();
  return getAllJokers().filter(j =>
    j.name.toLowerCase().includes(q) || j.id.toLowerCase().includes(q)
  );
}
