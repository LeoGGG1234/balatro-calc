import type { DeckComposition, DeckCardFilter, DeckCardSlot, DeckPreset } from './types';
import { CardEnhancement, CardEdition, Seal, Rank, Suit } from './types';
import { ALL_RANKS, ALL_SUITS, isFaceCard } from './types';

export type { DeckPreset } from './types';

// ─── Aggregate computation ─────────────────────────────────────

export function buildAggregateFromCards(cards: DeckCardSlot[]): {
  totalCards: number;
  remainingByRank: Partial<Record<Rank, number>>;
  remainingBySuit: Partial<Record<Suit, number>>;
  totalByRank: Partial<Record<Rank, number>>;
  totalBySuit: Partial<Record<Suit, number>>;
  enhancementCounts: Partial<Record<CardEnhancement, number>>;
  editionCounts: Partial<Record<CardEdition, number>>;
  sealCounts: Partial<Record<Seal, number>>;
} {
  const rankCounts: Partial<Record<Rank, number>> = {};
  const suitCounts: Partial<Record<Suit, number>> = {};
  const enhCounts: Partial<Record<CardEnhancement, number>> = {};
  const edCounts: Partial<Record<CardEdition, number>> = {};
  const sealCounts: Partial<Record<Seal, number>> = {};

  for (const c of cards) {
    rankCounts[c.rank] = (rankCounts[c.rank] ?? 0) + 1;
    suitCounts[c.suit] = (suitCounts[c.suit] ?? 0) + 1;
    enhCounts[c.enhancement] = (enhCounts[c.enhancement] ?? 0) + 1;
    edCounts[c.edition] = (edCounts[c.edition] ?? 0) + 1;
    sealCounts[c.seal] = (sealCounts[c.seal] ?? 0) + 1;
  }

  return {
    totalCards: cards.length,
    remainingByRank: rankCounts,
    remainingBySuit: suitCounts,
    totalByRank: { ...rankCounts },
    totalBySuit: { ...suitCounts },
    enhancementCounts: enhCounts,
    editionCounts: edCounts,
    sealCounts: sealCounts,
  };
}

// ─── Core deck operations ──────────────────────────────────────

export function createStandardDeck(): DeckComposition {
  const cards: DeckCardSlot[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      cards.push({
        rank,
        suit,
        enhancement: CardEnhancement.None,
        edition: CardEdition.None,
        seal: Seal.None,
      });
    }
  }
  return {
    ...buildAggregateFromCards(cards),
    cards,
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
  if (deck.cards) {
    const newCards = [...deck.cards, { rank, suit, enhancement, edition, seal }];
    return {
      ...buildAggregateFromCards(newCards),
      cards: newCards,
    };
  }

  // Fallback: aggregate-only
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
  enhancement?: CardEnhancement,
  edition?: CardEdition,
  seal?: Seal,
): DeckComposition {
  if (deck.cards) {
    const idx = deck.cards.findIndex(c =>
      c.rank === rank &&
      c.suit === suit &&
      (enhancement === undefined || c.enhancement === enhancement) &&
      (edition === undefined || c.edition === edition) &&
      (seal === undefined || c.seal === seal)
    );
    if (idx === -1) return deck;
    const newCards = [...deck.cards];
    newCards.splice(idx, 1);
    return {
      ...buildAggregateFromCards(newCards),
      cards: newCards,
    };
  }

  // Fallback: aggregate-only approximation
  const currentRank = deck.remainingByRank[rank] ?? 0;
  const currentSuit = deck.remainingBySuit[suit] ?? 0;
  if (currentRank <= 0 || currentSuit <= 0) return deck;

  const remainingByRank = { ...deck.remainingByRank, [rank]: currentRank - 1 };
  const remainingBySuit = { ...deck.remainingBySuit, [suit]: currentSuit - 1 };

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

// ─── Individual card manipulation ──────────────────────────────

export function updateDeckCard(
  deck: DeckComposition,
  slotIndex: number,
  updates: Partial<Pick<DeckCardSlot, 'enhancement' | 'edition' | 'seal'>>,
): DeckComposition {
  if (!deck.cards || slotIndex < 0 || slotIndex >= deck.cards.length) return deck;
  const newCards = deck.cards.map((c, i) =>
    i === slotIndex ? { ...c, ...updates } : c
  );
  return {
    ...buildAggregateFromCards(newCards),
    cards: newCards,
  };
}

export function batchUpdateDeckCards(
  deck: DeckComposition,
  filter: DeckCardFilter,
  updates: Partial<Pick<DeckCardSlot, 'enhancement' | 'edition' | 'seal'>>,
): DeckComposition {
  if (!deck.cards) return deck;
  const newCards = deck.cards.map(c => {
    const matches =
      (filter.suit === undefined || c.suit === filter.suit) &&
      (filter.rank === undefined || c.rank === filter.rank) &&
      (filter.enhancement === undefined || c.enhancement === filter.enhancement) &&
      (filter.edition === undefined || c.edition === filter.edition) &&
      (filter.seal === undefined || c.seal === filter.seal);
    return matches ? { ...c, ...updates } : c;
  });
  return {
    ...buildAggregateFromCards(newCards),
    cards: newCards,
  };
}

// ─── Deck presets ──────────────────────────────────────────────

export function applyDeckPreset(preset: DeckPreset): DeckComposition {
  switch (preset) {
    case 'standard':
      return createStandardDeck();
    case 'abandoned': {
      const standard = createStandardDeck();
      const cards = standard.cards!.filter(c => !isFaceCard(c.rank));
      return { ...buildAggregateFromCards(cards), cards };
    }
    case 'checkered': {
      const cards: DeckCardSlot[] = [];
      for (const suit of [Suit.Spades, Suit.Hearts]) {
        for (const rank of ALL_RANKS) {
          cards.push({ rank, suit, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None });
        }
      }
      return { ...buildAggregateFromCards(cards), cards };
    }
  }
}
