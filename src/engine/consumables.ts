/**
 * Consumable Card Application Engine
 *
 * Pure-function utilities for applying tarot, planet, and spectral card effects
 * to a GameState. Used by the strategy engine to evaluate "use consumable first,
 * then play/discard" scenarios.
 *
 * All functions are immutable: they return a new GameState, never mutate the input.
 */

import type { GameState, DeckComposition, HeldConsumable } from './types';
import {
  HandType, Rank, Suit,
  CardEnhancement,
  ALL_RANKS,
} from './types';

// ─── Planet ID → HandType Mapping ─────────────────────────────────

const PLANET_TO_HAND: Record<string, HandType> = {
  pluto: HandType.HighCard,
  mercury: HandType.Pair,
  uranus: HandType.TwoPair,
  venus: HandType.ThreeOfAKind,
  saturn: HandType.Straight,
  jupiter: HandType.Flush,
  earth: HandType.FullHouse,
  mars: HandType.FourOfAKind,
  neptune: HandType.StraightFlush, // also RoyalFlush
  planet_x: HandType.FiveOfAKind,
  ceres: HandType.FlushHouse,
  eris: HandType.FlushFive,
};

// ─── Tarot Enhancement Mapping ─────────────────────────────────────

const TAROT_ENHANCEMENT: Record<string, CardEnhancement> = {
  the_magician: CardEnhancement.Mult,       // +5 Mult
  the_high_priestess: CardEnhancement.Bonus, // +30 Chips
  the_empress: CardEnhancement.Mult,         // +4 Mult (same as magician but different amount)
  the_lovers: CardEnhancement.Wild,
  the_chariot: CardEnhancement.Steel,
  justice: CardEnhancement.Glass,
  the_devil: CardEnhancement.Gold,
  the_tower: CardEnhancement.Stone,
};

// Tarot cards that change suit
const SUIT_TAROT: Record<string, Suit> = {
  the_star: Suit.Diamonds,
  the_moon: Suit.Clubs,
  the_sun: Suit.Hearts,
  the_world: Suit.Spades,
};

// ─── Result Types ──────────────────────────────────────────────────

export interface ConsumableResult {
  /** New game state after applying the consumable */
  newState: GameState;
  /** Human-readable description of what happened */
  description: string;
  descriptionZh: string;
}

// ─── Applicability Check ───────────────────────────────────────────

/**
 * Check if a consumable card can be applied meaningfully in the current state.
 * Some tarot cards (like Hermit/Temperance) don't affect scoring and
 * are excluded from strategy evaluation.
 */
export function canApplyConsumable(
  consumableId: string,
  type: 'tarot' | 'planet' | 'spectral',
): boolean {
  if (type === 'planet') {
    return consumableId in PLANET_TO_HAND;
  }
  if (type === 'tarot') {
    // Exclude tarot cards that don't affect scoring
    const unscoredTarots = new Set([
      'the_hermit', 'temperance', 'the_fool',
      'wheel_of_fortune', 'judgement',
    ]);
    if (unscoredTarots.has(consumableId)) return false;
    return true;
  }
  // Spectral cards not yet modeled
  return false;
}

/**
 * Get suggested target card indices in hand for a tarot's effect.
 * Returns the best candidate indices based on the card's effect.
 */
export function getTarotTargetSuggestions(
  tarotId: string,
  state: GameState,
  maxTargets: number = 3,
): number[][] {
  const handCards = state.handCards;
  if (handCards.length === 0) return [];

  // Suit changers: target cards NOT of the target suit
  if (tarotId in SUIT_TAROT) {
    const targetSuit = SUIT_TAROT[tarotId];
    return handCards
      .map((c, i) => ({ i, suit: c.suit, isTargetSuit: c.suit === targetSuit }))
      .filter(c => !c.isTargetSuit)
      .slice(0, maxTargets)
      .map(c => [c.i]);
  }

  // Enhancement cards: target unenhanced cards
  if (tarotId in TAROT_ENHANCEMENT) {
    return handCards
      .map((c, i) => ({ i, enhanced: c.enhancement !== CardEnhancement.None }))
      .filter(c => !c.enhanced)
      .slice(0, maxTargets)
      .map(c => [c.i]);
  }

  // Strength: target non-Ace cards (rank up has meaning)
  if (tarotId === 'strength') {
    return handCards
      .map((c, i) => ({ i, rank: c.rank }))
      .filter(c => c.rank !== Rank.Ace) // Ace can't go higher
      .slice(0, maxTargets)
      .map(c => [c.i]);
  }

  // Death: need at least 2 cards — target[0] becomes copy of target[1]
  // Return pairs where the donor (target[1]) is a "good" card
  if (tarotId === 'death') {
    const suggestions: number[][] = [];
    for (let donor = 0; donor < handCards.length && suggestions.length < maxTargets; donor++) {
      const d = handCards[donor];
      // Prefer donors with enhancement/edition/seal
      const isGoodDonor = d.enhancement !== CardEnhancement.None ||
        d.edition !== 'none' || d.seal !== 'none';
      for (let target = 0; target < handCards.length && suggestions.length < maxTargets; target++) {
        if (target === donor) continue;
        const t = handCards[target];
        // Target cards that are "worse" than donor
        if (isGoodDonor && t.enhancement === CardEnhancement.None) {
          suggestions.push([target, donor]);
        }
      }
    }
    return suggestions;
  }

  // Hanged Man: target low-value singleton cards
  if (tarotId === 'the_hanged_man') {
    // Score cards by "expendability": low rank, no enhancement, singleton
    const scored = handCards.map((c, i) => {
      const rankIdx = ALL_RANKS.indexOf(c.rank);
      const rankCount = handCards.filter(hc => hc.rank === c.rank).length;
      let score = 0;
      // Low rank = higher score for destruction (less valuable)
      if (rankIdx <= 3) score += 3; // 2-5: most expendable
      else if (rankIdx <= 7) score += 2; // 6-9: somewhat expendable
      else score += 1; // 10-A: less expendable
      // Singleton = more expendable
      if (rankCount === 1) score += 2;
      // No enhancement = more expendable
      if (c.enhancement === CardEnhancement.None) score += 1;
      return { i, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxTargets).map(s => [s.i]);
  }

  // Emperor / Hierophant: affect hand size, no card target needed
  if (tarotId === 'the_emperor' || tarotId === 'the_hierophant') {
    return [[]]; // No target — applies globally
  }

  // Default: just return first N cards as single targets
  return handCards.slice(0, maxTargets).map((_, i) => [i]);
}

// ─── Application Functions ─────────────────────────────────────────

/**
 * Apply a tarot card to modify the game state.
 * Returns a NEW state — does not mutate the input.
 */
export function applyTarot(
  tarotId: string,
  state: GameState,
  targetCardIndices?: number[],
): ConsumableResult {
  const newState = cloneState(state);

  // ── Suit Changers ───────────────────────────────────
  if (tarotId in SUIT_TAROT) {
    const targetSuit = SUIT_TAROT[tarotId];
    const suitNames: Record<string, string> = {
      S: 'Spades', H: 'Hearts', C: 'Clubs', D: 'Diamonds',
    };
    const suitNamesZh: Record<string, string> = {
      S: '黑桃', H: '红心', C: '梅花', D: '方块',
    };
    const idx = targetCardIndices?.[0] ?? 0;
    if (idx < newState.handCards.length) {
      const oldSuit = newState.handCards[idx].suit;
      newState.handCards[idx] = {
        ...newState.handCards[idx],
        suit: targetSuit,
      };
      return {
        newState,
        description: `Convert hand card #${idx + 1} from ${oldSuit} to ${suitNames[targetSuit]}`,
        descriptionZh: `将手牌#${idx + 1}从${oldSuit}转为${suitNamesZh[targetSuit]}`,
      };
    }
  }

  // ── Enhancement Cards ───────────────────────────────
  if (tarotId in TAROT_ENHANCEMENT) {
    const enhancement = TAROT_ENHANCEMENT[tarotId];
    const enhNames: Record<string, string> = {
      [CardEnhancement.Mult]: '+Mult', [CardEnhancement.Bonus]: '+Chips',
      [CardEnhancement.Wild]: 'Wild', [CardEnhancement.Steel]: 'Steel',
      [CardEnhancement.Glass]: 'Glass', [CardEnhancement.Gold]: 'Gold',
      [CardEnhancement.Stone]: 'Stone', [CardEnhancement.Lucky]: 'Lucky',
    };
    const enhNamesZh: Record<string, string> = {
      [CardEnhancement.Mult]: '倍率', [CardEnhancement.Bonus]: '奖励',
      [CardEnhancement.Wild]: '百搭', [CardEnhancement.Steel]: '钢铁',
      [CardEnhancement.Glass]: '玻璃', [CardEnhancement.Gold]: '黄金',
      [CardEnhancement.Stone]: '石头', [CardEnhancement.Lucky]: '幸运',
    };
    const idx = targetCardIndices?.[0] ?? 0;
    if (idx < newState.handCards.length) {
      newState.handCards[idx] = {
        ...newState.handCards[idx],
        enhancement,
      };
      const ename = enhNames[enhancement] ?? enhancement;
      const enameZh = enhNamesZh[enhancement] ?? enhancement;
      return {
        newState,
        description: `Enhanced hand card #${idx + 1} with ${ename}`,
        descriptionZh: `将手牌#${idx + 1}强化为${enameZh}`,
      };
    }
  }

  // ── Strength (rank up) ──────────────────────────────
  if (tarotId === 'strength') {
    const idx = targetCardIndices?.[0] ?? 0;
    if (idx < newState.handCards.length) {
      const card = newState.handCards[idx];
      const rankIdx = ALL_RANKS.indexOf(card.rank);
      if (rankIdx >= 0 && rankIdx < ALL_RANKS.length - 1) {
        newState.handCards[idx] = {
          ...card,
          rank: ALL_RANKS[rankIdx + 1],
        };
        return {
          newState,
          description: `Increased rank of hand card #${idx + 1} from ${card.rank} to ${ALL_RANKS[rankIdx + 1]}`,
          descriptionZh: `将手牌#${idx + 1}点数从${card.rank}升为${ALL_RANKS[rankIdx + 1]}`,
        };
      }
    }
  }

  // ── Death (copy card) ────────────────────────────────
  if (tarotId === 'death') {
    const targetIdx = targetCardIndices?.[0] ?? 0;
    const donorIdx = targetCardIndices?.[1] ?? 0;
    if (targetIdx < newState.handCards.length && donorIdx < newState.handCards.length) {
      const donor = newState.handCards[donorIdx];
      newState.handCards[targetIdx] = {
        ...donor,
        id: newState.handCards[targetIdx].id, // Preserve original ID
      };
      return {
        newState,
        description: `Copied card #${donorIdx + 1} onto card #${targetIdx + 1}`,
        descriptionZh: `将手牌#${donorIdx + 1}复制到手牌#${targetIdx + 1}`,
      };
    }
  }

  // ── Hanged Man (destroy 1 card) ─────────────────────
  if (tarotId === 'the_hanged_man') {
    const idx = targetCardIndices?.[0] ?? 0;
    if (idx < newState.handCards.length) {
      const destroyed = newState.handCards[idx];
      newState.handCards = newState.handCards.filter((_, i) => i !== idx);
      // Also try to remove from deck composition
      if (newState.deckComposition.cards) {
        const deckIdx = newState.deckComposition.cards.findIndex(
          c => c.rank === destroyed.rank && c.suit === destroyed.suit,
        );
        if (deckIdx >= 0) {
          newState.deckComposition = {
            ...newState.deckComposition,
            cards: newState.deckComposition.cards.filter((_, i) => i !== deckIdx),
            totalCards: newState.deckComposition.totalCards - 1,
          };
        }
      }
      return {
        newState,
        description: `Destroyed hand card #${idx + 1} (${destroyed.rank}${destroyed.suit})`,
        descriptionZh: `摧毁了手牌#${idx + 1}（${destroyed.rank}${destroyed.suit}）`,
      };
    }
  }

  // ── Emperor / Hierophant (+2 hand size) ─────────────
  if (tarotId === 'the_emperor' || tarotId === 'the_hierophant') {
    newState.roundState = {
      ...newState.roundState,
      handSize: newState.roundState.handSize + 2,
    };
    return {
      newState,
      description: 'Hand size +2 for this round',
      descriptionZh: '本回合手牌上限+2',
    };
  }

  // Fallback: no change
  return {
    newState,
    description: `Applied ${tarotId} (no state change)`,
    descriptionZh: `使用了${tarotId}（无状态变化）`,
  };
}

/**
 * Apply a planet card to level up a hand type.
 */
export function applyPlanet(
  planetId: string,
  state: GameState,
): ConsumableResult {
  const handType = PLANET_TO_HAND[planetId.toLowerCase()];
  if (!handType) {
    return {
      newState: state,
      description: `Unknown planet: ${planetId}`,
      descriptionZh: `未知星球牌: ${planetId}`,
    };
  }

  const newState = cloneState(state);
  const currentLevel = newState.handLevels[handType] ?? 1;
  newState.handLevels = {
    ...newState.handLevels,
    [handType]: currentLevel + 1,
  };

  const htName = handType.replace(/_/g, ' ');
  return {
    newState,
    description: `Leveled up ${htName} to Lv.${currentLevel + 1}`,
    descriptionZh: `${htName} 升级至 Lv.${currentLevel + 1}`,
  };
}

/**
 * Apply any consumable (tarot or planet) to the game state.
 * Dispatches to applyTarot or applyPlanet based on type.
 */
export function applyConsumable(
  consumable: HeldConsumable,
  state: GameState,
  targetCardIndices?: number[],
): ConsumableResult {
  if (consumable.type === 'planet') {
    return applyPlanet(consumable.id, state);
  }
  if (consumable.type === 'tarot') {
    return applyTarot(consumable.id, state, targetCardIndices);
  }
  return {
    newState: state,
    description: `Consumable type ${consumable.type} not modeled`,
    descriptionZh: `消耗牌类型 ${consumable.type} 未建模`,
  };
}

// ─── State Cloning ─────────────────────────────────────────────────

/** Deep-ish clone of GameState for immutable state modification */
function cloneState(state: GameState): GameState {
  return {
    ...state,
    handCards: state.handCards.map(c => ({ ...c })),
    jokers: state.jokers.map(j => ({ ...j })),
    handLevels: { ...state.handLevels },
    deckComposition: cloneDeckComposition(state.deckComposition),
    blind: { ...state.blind },
    roundState: { ...state.roundState },
    flags: { ...state.flags },
    heldConsumables: state.heldConsumables ? [...state.heldConsumables] : undefined,
  };
}

function cloneDeckComposition(dc: DeckComposition): DeckComposition {
  return {
    ...dc,
    remainingByRank: { ...dc.remainingByRank },
    remainingBySuit: { ...dc.remainingBySuit },
    enhancementCounts: dc.enhancementCounts ? { ...dc.enhancementCounts } : undefined,
    cards: dc.cards ? dc.cards.map(c => ({ ...c })) : undefined,
  };
}

// ─── Re-export ─────────────────────────────────────────────────────

export { PLANET_TO_HAND };
