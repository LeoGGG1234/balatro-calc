import { describe, it, expect } from 'vitest';
import { Rank, Suit, CardEnhancement, CardEdition, Seal, DeckCardSlot, DeckCardFilter } from '../src/engine/types';
import { createStandardDeck, addCardToDeck, removeCardFromDeck, updateDeckCard, batchUpdateDeckCards, buildAggregateFromCards, applyDeckPreset } from '../src/engine/deck';
import { card } from './helpers';

describe('Deck Composition', () => {
  // ── buildAggregateFromCards ──────────────────────────────────

  describe('buildAggregateFromCards', () => {
    it('empty array returns all zeros', () => {
      const result = buildAggregateFromCards([]);
      expect(result.totalCards).toBe(0);
      expect(Object.values(result.remainingByRank).reduce((a: number, b: number) => a + b, 0)).toBe(0);
      expect(Object.values(result.remainingBySuit).reduce((a: number, b: number) => a + b, 0)).toBe(0);
      expect(Object.values(result.enhancementCounts).reduce((a: number, b: number) => a + b, 0)).toBe(0);
      expect(Object.values(result.editionCounts).reduce((a: number, b: number) => a + b, 0)).toBe(0);
      expect(Object.values(result.sealCounts).reduce((a: number, b: number) => a + b, 0)).toBe(0);
    });

    it('counts 52-card standard deck correctly', () => {
      const deck = createStandardDeck();
      const result = buildAggregateFromCards(deck.cards!);
      expect(result.totalCards).toBe(52);
      // 4 per rank, 13 per suit
      for (const rank of [Rank.Ace, Rank.King, Rank.Queen, Rank.Jack, Rank.Ten, Rank.Nine, Rank.Eight, Rank.Seven, Rank.Six, Rank.Five, Rank.Four, Rank.Three, Rank.Two]) {
        expect(result.remainingByRank[rank]).toBe(4);
      }
      expect(result.remainingBySuit[Suit.Spades]).toBe(13);
      expect(result.remainingBySuit[Suit.Hearts]).toBe(13);
      expect(result.remainingBySuit[Suit.Clubs]).toBe(13);
      expect(result.remainingBySuit[Suit.Diamonds]).toBe(13);
      // All None modifiers
      expect(result.enhancementCounts[CardEnhancement.None]).toBe(52);
      expect(result.editionCounts[CardEdition.None]).toBe(52);
      expect(result.sealCounts[Seal.None]).toBe(52);
    });

    it('counts mixed modifiers correctly', () => {
      const cards: DeckCardSlot[] = [
        { rank: Rank.Ace, suit: Suit.Spades, enhancement: CardEnhancement.Bonus, edition: CardEdition.Foil, seal: Seal.Red },
        { rank: Rank.Ace, suit: Suit.Hearts, enhancement: CardEnhancement.Bonus, edition: CardEdition.None, seal: Seal.None },
        { rank: Rank.King, suit: Suit.Spades, enhancement: CardEnhancement.Mult, edition: CardEdition.Holographic, seal: Seal.Blue },
        { rank: Rank.King, suit: Suit.Hearts, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.Gold },
        { rank: Rank.Queen, suit: Suit.Spades, enhancement: CardEnhancement.Glass, edition: CardEdition.Polychrome, seal: Seal.None },
        { rank: Rank.Queen, suit: Suit.Hearts, enhancement: CardEnhancement.Wild, edition: CardEdition.Foil, seal: Seal.Purple },
      ];
      const result = buildAggregateFromCards(cards);
      expect(result.totalCards).toBe(6);
      // Ranks
      expect(result.remainingByRank[Rank.Ace]).toBe(2);
      expect(result.remainingByRank[Rank.King]).toBe(2);
      expect(result.remainingByRank[Rank.Queen]).toBe(2);
      // Suits
      expect(result.remainingBySuit[Suit.Spades]).toBe(3);
      expect(result.remainingBySuit[Suit.Hearts]).toBe(3);
      // Enhancements
      expect(result.enhancementCounts[CardEnhancement.Bonus]).toBe(2);
      expect(result.enhancementCounts[CardEnhancement.Mult]).toBe(1);
      expect(result.enhancementCounts[CardEnhancement.None]).toBe(1);
      expect(result.enhancementCounts[CardEnhancement.Glass]).toBe(1);
      expect(result.enhancementCounts[CardEnhancement.Wild]).toBe(1);
      // Editions
      expect(result.editionCounts[CardEdition.Foil]).toBe(2);
      expect(result.editionCounts[CardEdition.None]).toBe(2);
      expect(result.editionCounts[CardEdition.Holographic]).toBe(1);
      expect(result.editionCounts[CardEdition.Polychrome]).toBe(1);
      // Seals
      expect(result.sealCounts[Seal.Red]).toBe(1);
      expect(result.sealCounts[Seal.None]).toBe(2);
      expect(result.sealCounts[Seal.Blue]).toBe(1);
      expect(result.sealCounts[Seal.Gold]).toBe(1);
      expect(result.sealCounts[Seal.Purple]).toBe(1);
    });
  });

  // ── createStandardDeck ───────────────────────────────────────

  describe('createStandardDeck', () => {
    it('returns 52 cards with None modifiers', () => {
      const deck = createStandardDeck();
      expect(deck.totalCards).toBe(52);
      expect(deck.cards).toHaveLength(52);
      for (const c of deck.cards!) {
        expect(c.enhancement).toBe(CardEnhancement.None);
        expect(c.edition).toBe(CardEdition.None);
        expect(c.seal).toBe(Seal.None);
      }
    });

    it('contains exactly one card per rank×suit combination', () => {
      const deck = createStandardDeck();
      const seen = new Set<string>();
      for (const c of deck.cards!) {
        const key = `${c.rank}_${c.suit}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
      expect(seen.size).toBe(52);
    });

    it('aggregates match cards array', () => {
      const deck = createStandardDeck();
      const aggs = buildAggregateFromCards(deck.cards!);
      expect(deck.totalCards).toBe(aggs.totalCards);
      expect(deck.remainingByRank).toEqual(aggs.remainingByRank);
      expect(deck.remainingBySuit).toEqual(aggs.remainingBySuit);
      expect(deck.enhancementCounts).toEqual(aggs.enhancementCounts);
      expect(deck.editionCounts).toEqual(aggs.editionCounts);
      expect(deck.sealCounts).toEqual(aggs.sealCounts);
    });
  });

  // ── addCardToDeck with cards ──────────────────────────────────

  describe('addCardToDeck (with cards)', () => {
    it('adds a card with default None modifiers', () => {
      const deck = createStandardDeck();
      const updated = addCardToDeck(deck, Rank.Ace, Suit.Spades);
      expect(updated.totalCards).toBe(53);
      expect(updated.cards).toHaveLength(53);
      expect(updated.remainingByRank[Rank.Ace]).toBe(5);
      expect(updated.remainingBySuit[Suit.Spades]).toBe(14);
      expect(updated.enhancementCounts![CardEnhancement.None]).toBe(53);
    });

    it('adds a card with specific modifiers', () => {
      const deck = createStandardDeck();
      const updated = addCardToDeck(deck, Rank.King, Suit.Hearts, CardEnhancement.Bonus, CardEdition.Foil, Seal.Red);
      expect(updated.totalCards).toBe(53);
      const bonusCards = updated.cards!.filter(c => c.enhancement === CardEnhancement.Bonus);
      expect(bonusCards).toHaveLength(1);
      expect(bonusCards[0].rank).toBe(Rank.King);
      expect(bonusCards[0].suit).toBe(Suit.Hearts);
      expect(bonusCards[0].edition).toBe(CardEdition.Foil);
      expect(bonusCards[0].seal).toBe(Seal.Red);
      expect(updated.enhancementCounts![CardEnhancement.Bonus]).toBe(1);
      expect(updated.editionCounts![CardEdition.Foil]).toBe(1);
      expect(updated.sealCounts![Seal.Red]).toBe(1);
    });

    it('fallback: works without cards array', () => {
      const deck = { totalCards: 10, remainingByRank: { [Rank.Ten]: 5 }, remainingBySuit: { [Suit.Clubs]: 5 } };
      const updated = addCardToDeck(deck, Rank.Ten, Suit.Clubs, CardEnhancement.Glass, CardEdition.Holographic, Seal.Blue);
      expect(updated.totalCards).toBe(11);
      expect(updated.remainingByRank[Rank.Ten]).toBe(6);
      expect(updated.remainingBySuit[Suit.Clubs]).toBe(6);
      expect(updated.enhancementCounts![CardEnhancement.Glass]).toBe(1);
      expect(updated.editionCounts![CardEdition.Holographic]).toBe(1);
      expect(updated.sealCounts![Seal.Blue]).toBe(1);
      expect(updated.cards).toBeUndefined();
    });
  });

  // ── removeCardFromDeck (precise) ──────────────────────────────

  describe('removeCardFromDeck (precise)', () => {
    it('removes the first matching card by rank+suit', () => {
      const deck = createStandardDeck();
      const updated = removeCardFromDeck(deck, Rank.Ace, Suit.Spades);
      expect(updated.totalCards).toBe(51);
      expect(updated.cards).toHaveLength(51);
      expect(updated.remainingByRank[Rank.Ace]).toBe(3);
      expect(updated.remainingBySuit[Suit.Spades]).toBe(12);
    });

    it('removes card with specific enhancement match', () => {
      // Create a deck and add a Glass King, then remove only the Glass one
      const deck = createStandardDeck();
      const withGlass = addCardToDeck(deck, Rank.King, Suit.Hearts, CardEnhancement.Glass);
      expect(withGlass.totalCards).toBe(53);
      expect(withGlass.enhancementCounts![CardEnhancement.Glass]).toBe(1);

      // Remove the Glass King specifically
      const removed = removeCardFromDeck(withGlass, Rank.King, Suit.Hearts, CardEnhancement.Glass);
      expect(removed.totalCards).toBe(52);
      expect(removed.enhancementCounts![CardEnhancement.Glass] ?? 0).toBe(0);
      // The normal King of Hearts should still be there
      const kingHearts = removed.cards!.filter(c => c.rank === Rank.King && c.suit === Suit.Hearts);
      expect(kingHearts).toHaveLength(1);
      expect(kingHearts[0].enhancement).toBe(CardEnhancement.None);
    });

    it('removing non-existent card returns deck unchanged', () => {
      const deck = createStandardDeck();
      const updated = removeCardFromDeck(deck, Rank.Ace, Suit.Spades, CardEnhancement.Bonus);
      expect(updated).toBe(deck);
    });

    it('removing when findIndex matches first occurrence only', () => {
      // Add two Ace of Spades: one Bonus, one Mult
      let deck = createStandardDeck();
      deck = addCardToDeck(deck, Rank.Ace, Suit.Spades, CardEnhancement.Bonus);
      deck = addCardToDeck(deck, Rank.Ace, Suit.Spades, CardEnhancement.Mult);

      // Remove without modifier filter — removes the first found (the original None Ace+S)
      const removed = removeCardFromDeck(deck, Rank.Ace, Suit.Spades);
      // 3 Ace+S before removal (1 original + 2 added), 2 remaining after remove
      const aceSpadesRemaining = removed.cards!.filter(c => c.rank === Rank.Ace && c.suit === Suit.Spades);
      expect(aceSpadesRemaining).toHaveLength(2);
      // The removed one was the original None card — Bonus and Mult remain
      const enhs = aceSpadesRemaining.map(c => c.enhancement).sort();
      expect(enhs).toEqual([CardEnhancement.Bonus, CardEnhancement.Mult]);
    });

    it('fallback: works without cards array', () => {
      const deck = {
        totalCards: 10,
        remainingByRank: { [Rank.Ace]: 3 },
        remainingBySuit: { [Suit.Spades]: 5 },
        enhancementCounts: { none: 10 } as Partial<Record<string, number>>,
        editionCounts: { none: 10 } as Partial<Record<string, number>>,
        sealCounts: { none: 10 } as Partial<Record<string, number>>,
      };
      const updated = removeCardFromDeck(deck, Rank.Ace, Suit.Spades);
      expect(updated.totalCards).toBe(9);
      expect(updated.remainingByRank[Rank.Ace]).toBe(2);
      expect(updated.cards).toBeUndefined();
    });
  });

  // ── updateDeckCard ───────────────────────────────────────────

  describe('updateDeckCard', () => {
    it('updates enhancement at a valid index', () => {
      const deck = createStandardDeck();
      const updated = updateDeckCard(deck, 0, { enhancement: CardEnhancement.Bonus });
      expect(updated.cards![0].enhancement).toBe(CardEnhancement.Bonus);
      expect(updated.enhancementCounts![CardEnhancement.Bonus]).toBe(1);
      expect(updated.enhancementCounts![CardEnhancement.None]).toBe(51);
    });

    it('updates edition at a valid index', () => {
      const deck = createStandardDeck();
      const updated = updateDeckCard(deck, 5, { edition: CardEdition.Foil });
      expect(updated.cards![5].edition).toBe(CardEdition.Foil);
      expect(updated.editionCounts![CardEdition.Foil]).toBe(1);
      expect(updated.editionCounts![CardEdition.None]).toBe(51);
    });

    it('updates seal at a valid index', () => {
      const deck = createStandardDeck();
      const updated = updateDeckCard(deck, 10, { seal: Seal.Red });
      expect(updated.cards![10].seal).toBe(Seal.Red);
      expect(updated.sealCounts![Seal.Red]).toBe(1);
      expect(updated.sealCounts![Seal.None]).toBe(51);
    });

    it('updates multiple modifiers at once', () => {
      const deck = createStandardDeck();
      const updated = updateDeckCard(deck, 20, {
        enhancement: CardEnhancement.Steel,
        edition: CardEdition.Polychrome,
        seal: Seal.Blue,
      });
      expect(updated.cards![20].enhancement).toBe(CardEnhancement.Steel);
      expect(updated.cards![20].edition).toBe(CardEdition.Polychrome);
      expect(updated.cards![20].seal).toBe(Seal.Blue);
    });

    it('negative index returns deck unchanged', () => {
      const deck = createStandardDeck();
      const updated = updateDeckCard(deck, -1, { enhancement: CardEnhancement.Bonus });
      expect(updated).toBe(deck);
    });

    it('out-of-bounds index returns deck unchanged', () => {
      const deck = createStandardDeck();
      const updated = updateDeckCard(deck, 999, { enhancement: CardEnhancement.Bonus });
      expect(updated).toBe(deck);
    });

    it('no cards array returns deck unchanged', () => {
      const deck = { totalCards: 10, remainingByRank: {}, remainingBySuit: {} };
      const updated = updateDeckCard(deck, 0, { enhancement: CardEnhancement.Bonus });
      expect(updated).toBe(deck);
    });
  });

  // ── batchUpdateDeckCards ──────────────────────────────────────

  describe('batchUpdateDeckCards', () => {
    it('filter by suit: updates all cards of that suit', () => {
      const deck = createStandardDeck();
      const updated = batchUpdateDeckCards(deck, { suit: Suit.Hearts }, { enhancement: CardEnhancement.Mult });
      const heartsCards = updated.cards!.filter(c => c.suit === Suit.Hearts);
      expect(heartsCards).toHaveLength(13);
      for (const c of heartsCards) {
        expect(c.enhancement).toBe(CardEnhancement.Mult);
      }
      // Other suits unaffected
      const spadesCards = updated.cards!.filter(c => c.suit === Suit.Spades);
      for (const c of spadesCards) {
        expect(c.enhancement).toBe(CardEnhancement.None);
      }
      expect(updated.enhancementCounts![CardEnhancement.Mult]).toBe(13);
      expect(updated.enhancementCounts![CardEnhancement.None]).toBe(39);
    });

    it('filter by rank: updates all cards of that rank', () => {
      const deck = createStandardDeck();
      const updated = batchUpdateDeckCards(deck, { rank: Rank.King }, { edition: CardEdition.Foil });
      const kings = updated.cards!.filter(c => c.rank === Rank.King);
      expect(kings).toHaveLength(4);
      for (const c of kings) {
        expect(c.edition).toBe(CardEdition.Foil);
      }
      expect(updated.editionCounts![CardEdition.Foil]).toBe(4);
    });

    it('filter by enhancement: updates matching cards', () => {
      // First make some cards Bonus
      let deck = createStandardDeck();
      deck = updateDeckCard(deck, 0, { enhancement: CardEnhancement.Bonus });
      deck = updateDeckCard(deck, 1, { enhancement: CardEnhancement.Bonus });
      deck = updateDeckCard(deck, 2, { enhancement: CardEnhancement.Bonus });
      // Now change all Bonus to Glass
      const updated = batchUpdateDeckCards(deck, { enhancement: CardEnhancement.Bonus }, { seal: Seal.Gold });
      expect(updated.cards![0].seal).toBe(Seal.Gold);
      expect(updated.cards![1].seal).toBe(Seal.Gold);
      expect(updated.cards![2].seal).toBe(Seal.Gold);
      expect(updated.cards![3].seal).toBe(Seal.None);
    });

    it('filter by multiple criteria', () => {
      const deck = createStandardDeck();
      const updated = batchUpdateDeckCards(
        deck,
        { suit: Suit.Spades, rank: Rank.Ace },
        { enhancement: CardEnhancement.Steel, edition: CardEdition.Holographic }
      );
      const aceSpades = updated.cards!.filter(c => c.rank === Rank.Ace && c.suit === Suit.Spades);
      expect(aceSpades).toHaveLength(1);
      expect(aceSpades[0].enhancement).toBe(CardEnhancement.Steel);
      expect(aceSpades[0].edition).toBe(CardEdition.Holographic);
      // Ace of Hearts unaffected
      const aceHearts = updated.cards!.find(c => c.rank === Rank.Ace && c.suit === Suit.Hearts)!;
      expect(aceHearts.enhancement).toBe(CardEnhancement.None);
    });

    it('empty filter updates all cards', () => {
      const deck = createStandardDeck();
      const updated = batchUpdateDeckCards(deck, {}, { seal: Seal.Blue });
      for (const c of updated.cards!) {
        expect(c.seal).toBe(Seal.Blue);
      }
      expect(updated.sealCounts![Seal.Blue]).toBe(52);
      expect(updated.sealCounts![Seal.None] ?? 0).toBe(0);
    });

    it('no cards array returns deck unchanged', () => {
      const deck = { totalCards: 10, remainingByRank: {}, remainingBySuit: {} };
      const updated = batchUpdateDeckCards(deck, { suit: Suit.Hearts }, { enhancement: CardEnhancement.Bonus });
      expect(updated).toBe(deck);
    });
  });

  // ── applyDeckPreset ──────────────────────────────────────────

  describe('applyDeckPreset', () => {
    it('standard: 52 cards, all None', () => {
      const deck = applyDeckPreset('standard');
      expect(deck.totalCards).toBe(52);
      expect(deck.cards).toHaveLength(52);
      for (const c of deck.cards!) {
        expect(c.enhancement).toBe(CardEnhancement.None);
        expect(c.edition).toBe(CardEdition.None);
        expect(c.seal).toBe(Seal.None);
      }
    });

    it('abandoned: 40 cards, no face cards', () => {
      const deck = applyDeckPreset('abandoned');
      expect(deck.totalCards).toBe(40);
      expect(deck.cards).toHaveLength(40);
      // No face cards (J, Q, K)
      const faceCards = deck.cards!.filter(c =>
        c.rank === Rank.Jack || c.rank === Rank.Queen || c.rank === Rank.King
      );
      expect(faceCards).toHaveLength(0);
      // Number cards + Aces should have 4 each
      const nonFaceRanks = [Rank.Ace, Rank.Ten, Rank.Nine, Rank.Eight, Rank.Seven, Rank.Six, Rank.Five, Rank.Four, Rank.Three, Rank.Two];
      for (const r of nonFaceRanks) {
        expect(deck.remainingByRank[r]).toBe(4);
      }
    });

    it('checkered: 26 cards, only Spades and Hearts', () => {
      const deck = applyDeckPreset('checkered');
      expect(deck.totalCards).toBe(26);
      expect(deck.cards).toHaveLength(26);
      // Only Spades and Hearts
      const clubs = deck.cards!.filter(c => c.suit === Suit.Clubs);
      const diamonds = deck.cards!.filter(c => c.suit === Suit.Diamonds);
      expect(clubs).toHaveLength(0);
      expect(diamonds).toHaveLength(0);
      // 13 Spades + 13 Hearts
      expect(deck.remainingBySuit[Suit.Spades]).toBe(13);
      expect(deck.remainingBySuit[Suit.Hearts]).toBe(13);
      expect(deck.remainingBySuit[Suit.Clubs]).toBeUndefined();
      expect(deck.remainingBySuit[Suit.Diamonds]).toBeUndefined();
    });

    it('checkered: all 13 ranks present', () => {
      const deck = applyDeckPreset('checkered');
      const allRanks = [Rank.Ace, Rank.King, Rank.Queen, Rank.Jack, Rank.Ten, Rank.Nine, Rank.Eight, Rank.Seven, Rank.Six, Rank.Five, Rank.Four, Rank.Three, Rank.Two];
      for (const r of allRanks) {
        expect(deck.remainingByRank[r]).toBe(2);
      }
    });
  });
});
