import {
  Card, GameState, HandType, Suit, Rank,
  CardEnhancement, CardEdition, Seal,
} from '../src/engine/types';

// Import to trigger joker registration
import '../src/engine/joker-effects';

// ─── Helper: create a basic card ───────────────────────────────

let cardIdCounter = 0;

export function card(
  rank: Rank, suit: Suit,
  enh: CardEnhancement = CardEnhancement.None,
  edition: CardEdition = CardEdition.None,
  seal: Seal = Seal.None
): Card {
  return {
    id: `${rank}_${suit}_${++cardIdCounter}`,
    rank, suit, enhancement: enh, edition, seal,
    debuffed: false,
  };
}

// ─── Helper: create default game state ─────────────────────────

export function defaultState(handCards: Card[], jokerIds: string[] = []): GameState {
  const defaultLevels = {} as Record<HandType, number>;
  for (const ht of Object.values(HandType)) {
    defaultLevels[ht] = 1;
  }

  return {
    handCards,
    jokers: jokerIds.map((id) => ({ id, edition: CardEdition.None })),
    handLevels: defaultLevels,
    deckComposition: { totalCards: 52, remainingByRank: {}, remainingBySuit: {} },
    blind: { type: 'small' as const, chipsRequired: 300, debuffedRanks: [], debuffedSuits: [] },
    roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 0, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 },
    flags: { playedHandsThisRound: [], hasDiscardedThisRound: false, firstHandThisRound: true },
  };
}
