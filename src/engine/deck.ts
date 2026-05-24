import type { DeckComposition } from './types';
import { Rank, Suit, CardEnhancement, CardEdition, Seal } from './types';
import { ALL_RANKS, ALL_SUITS } from './types';

export function createStandardDeck(): DeckComposition {
  const remainingByRank: Record<string, number> = {};
  const remainingBySuit: Record<string, number> = {};
  for (const r of ALL_RANKS) remainingByRank[r] = 4;
  for (const s of ALL_SUITS) remainingBySuit[s] = 13;

  return {
    totalCards: 52,
    remainingByRank,
    remainingBySuit,
    enhancementCounts: { [CardEnhancement.None]: 52 },
    editionCounts: { [CardEdition.None]: 52 },
    sealCounts: { [Seal.None]: 52 },
  };
}

export function addCardToDeck(
  deck: DeckComposition,
  rank: Rank,
  suit: Suit,
  enhancement: CardEnhancement = CardEnhancement.None,
  edition: CardEdition = CardEdition.None,
  seal: Seal = Seal.None,
): DeckComposition {
  const remainingByRank = { ...deck.remainingByRank, [rank]: (deck.remainingByRank[rank] ?? 0) + 1 };
  const remainingBySuit = { ...deck.remainingBySuit, [suit]: (deck.remainingBySuit[suit] ?? 0) + 1 };

  const enhancementCounts = { ...deck.enhancementCounts };
  enhancementCounts[enhancement] = (enhancementCounts[enhancement] ?? 0) + 1;

  const editionCounts = { ...deck.editionCounts };
  editionCounts[edition] = (editionCounts[edition] ?? 0) + 1;

  const sealCounts = { ...deck.sealCounts };
  sealCounts[seal] = (sealCounts[seal] ?? 0) + 1;

  return {
    totalCards: deck.totalCards + 1,
    remainingByRank,
    remainingBySuit,
    enhancementCounts,
    editionCounts,
    sealCounts,
  };
}

export function removeCardFromDeck(
  deck: DeckComposition,
  rank: Rank,
  suit: Suit,
): DeckComposition {
  const currentRank = deck.remainingByRank[rank] ?? 0;
  const currentSuit = deck.remainingBySuit[suit] ?? 0;
  if (currentRank <= 0 || currentSuit <= 0) return deck;

  const remainingByRank = { ...deck.remainingByRank, [rank]: currentRank - 1 };
  const remainingBySuit = { ...deck.remainingBySuit, [suit]: currentSuit - 1 };

  // We don't know the enhancement/edition/seal of the removed card,
  // so decrement the "None" count (most common case) as approximation
  const enhancementCounts = { ...deck.enhancementCounts };
  const noneEnh = enhancementCounts[CardEnhancement.None] ?? 0;
  if (noneEnh > 0) enhancementCounts[CardEnhancement.None] = noneEnh - 1;

  const editionCounts = { ...deck.editionCounts };
  const noneEd = editionCounts[CardEdition.None] ?? 0;
  if (noneEd > 0) editionCounts[CardEdition.None] = noneEd - 1;

  const sealCounts = { ...deck.sealCounts };
  const noneSeal = sealCounts[Seal.None] ?? 0;
  if (noneSeal > 0) sealCounts[Seal.None] = noneSeal - 1;

  return {
    totalCards: deck.totalCards - 1,
    remainingByRank,
    remainingBySuit,
    enhancementCounts,
    editionCounts,
    sealCounts,
  };
}

