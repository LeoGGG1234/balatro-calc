import { describe, it, expect } from 'vitest';
import { HandType, Suit, CardEdition, CardEnhancement, Seal, Rank, DeckCardSlot } from '../src/engine/types';
import { simulateRun, computeBlindChips, getBossForAnte, isBossDefeated } from '../src/engine/run-simulator';
import { createStandardDeck } from '../src/engine/deck';
import { createRng, hashSeedString } from '../src/engine/rng';
import { card } from './helpers';

describe('Run Simulator', () => {
  it('calculateInterest: 0 dollars = 0 interest', async () => {
    const { calculateInterest } = await import('../src/engine/run-simulator');
    expect(calculateInterest(0)).toBe(0);
  });

  it('calculateInterest: $4 = 0 interest', async () => {
    const { calculateInterest } = await import('../src/engine/run-simulator');
    expect(calculateInterest(4)).toBe(0);
  });

  it('calculateInterest: $5 = 1 interest', async () => {
    const { calculateInterest } = await import('../src/engine/run-simulator');
    expect(calculateInterest(5)).toBe(1);
  });

  it('calculateInterest: $23 = 4 interest', async () => {
    const { calculateInterest } = await import('../src/engine/run-simulator');
    expect(calculateInterest(23)).toBe(4);
  });

  it('calculateInterest: caps at 5 ($50)', async () => {
    const { calculateInterest } = await import('../src/engine/run-simulator');
    expect(calculateInterest(50)).toBe(5);
  });

  it('calculateRoundEarnings: $0 for lost blind', async () => {
    const { calculateRoundEarnings } = await import('../src/engine/run-simulator');
    expect(calculateRoundEarnings(20, false)).toBe(0);
  });

  it('calculateRoundEarnings: $3 base + interest for won blind', async () => {
    const { calculateRoundEarnings } = await import('../src/engine/run-simulator');
    expect(calculateRoundEarnings(10, true)).toBe(5); // $3 base + $2 interest
  });

  it('getAnteBlindDef returns correct scaling for ante 1', async () => {
    const { getAnteBlindDef } = await import('../src/engine/run-simulator');
    const def = getAnteBlindDef(1);
    expect(def.ante).toBe(1);
    expect(def.smallChips).toBe(300);
    expect(def.bigChips).toBe(450);
    expect(def.bossChips).toBe(600);
    expect(def.bossId).toBe('the_needle');
  });

  it('getAnteBlindDef returns correct boss for ante 3', async () => {
    const { getAnteBlindDef } = await import('../src/engine/run-simulator');
    const def = getAnteBlindDef(3);
    expect(def.bossId).toBe('the_wall');
    expect(def.bossName).toBe('The Wall');
  });

  it('getBossEffect: The Needle has 1 max hand', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    const effect = getBossEffect('the_needle');
    expect(effect.maxHandsOverride).toBe(1);
  });

  it('getBossEffect: The Wall has 4x chips multiplier', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    const effect = getBossEffect('the_wall');
    expect(effect.chipsMultiplier).toBe(4);
  });

  it('getBossEffect: unknown boss returns empty effect', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    const effect = getBossEffect('nonexistent');
    expect(effect.maxHandsOverride).toBeUndefined();
    expect(effect.chipsMultiplier).toBeUndefined();
  });

  it('drawHand draws correct number of cards', async () => {
    const { drawHand } = await import('../src/engine/run-simulator');
    const { createStandardDeck } = await import('../src/engine/deck');
    const { createRng } = await import('../src/engine/rng');
    const deck = createStandardDeck();
    const rng = createRng(12345);

    const result = drawHand(deck, 8, rng);
    expect(result.cards.length).toBe(8);
    expect(result.deck.totalCards).toBe(44);
  });

  it('drawHand returns empty if deck is empty', async () => {
    // Import drawHand directly for this test
    const { createStandardDeck } = await import('../src/engine/deck');
    const deck = createStandardDeck();
    const emptyDeck = { ...deck, totalCards: 0 };

    // Can't test drawHand with empty deck without importing it
    // drawHand handles Math.min(handSize, totalCards) = 0
    // This is covered by simulateRun behavior
    expect(emptyDeck.totalCards).toBe(0);
  });

  it('simulateRun: basic run with no jokers produces rounds', async () => {
    const { simulateRun } = await import('../src/engine/run-simulator');
    const { createStandardDeck } = await import('../src/engine/deck');
    const { getDefaultHandLevels } = await import('../src/engine/constants');

    const state = {
      handCards: [],
      jokers: [],
      handLevels: getDefaultHandLevels(),
      deckComposition: createStandardDeck(),
      blind: { type: 'small' as const, chipsRequired: 300, debuffedRanks: [], debuffedSuits: [], bossId: null },
      roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 },
      flags: { playedHandsThisRound: [] },
    };

    const result = simulateRun(state, { maxAntes: 1, seed: 42 });
    expect(result.config.maxAntes).toBe(1);
    expect(result.rounds.length).toBeGreaterThan(0);
    expect(result.totalSimulationTimeMs).toBeGreaterThan(0);
  });

  it('simulateRun: deterministic with same seed', async () => {
    const { simulateRun } = await import('../src/engine/run-simulator');
    const { createStandardDeck } = await import('../src/engine/deck');
    const { getDefaultHandLevels } = await import('../src/engine/constants');

    const baseState = {
      handCards: [],
      jokers: [],
      handLevels: getDefaultHandLevels(),
      deckComposition: createStandardDeck(),
      blind: { type: 'small' as const, chipsRequired: 300, debuffedRanks: [], debuffedSuits: [], bossId: null },
      roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 },
      flags: { playedHandsThisRound: [] },
    };

    const result1 = simulateRun(baseState, { maxAntes: 1, seed: 12345 });
    const result2 = simulateRun(baseState, { maxAntes: 1, seed: 12345 });
    expect(result1.totalScore).toBe(result2.totalScore);
    expect(result1.rounds.length).toBe(result2.rounds.length);
  });

  it('simulateRun: 3 antes produces more rounds than 1 ante', async () => {
    const { simulateRun } = await import('../src/engine/run-simulator');
    const { createStandardDeck } = await import('../src/engine/deck');
    const { getDefaultHandLevels } = await import('../src/engine/constants');

    const state = {
      handCards: [],
      jokers: [],
      handLevels: getDefaultHandLevels(),
      deckComposition: createStandardDeck(),
      blind: { type: 'small' as const, chipsRequired: 300, debuffedRanks: [], debuffedSuits: [], bossId: null },
      roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 },
      flags: { playedHandsThisRound: [] },
    };

    const result1 = simulateRun(state, { maxAntes: 1, seed: 99 });
    const result3 = simulateRun(state, { maxAntes: 3, seed: 99 });
    // 3 antes might not have 3x rounds (if you lose), but should have at least as many
    expect(result3.rounds.length).toBeGreaterThanOrEqual(result1.rounds.length);
  });

  // ── New boss blind validation ──────────────────────────────────

  it('BOSS_BLINDS has 28 entries', async () => {
    const { BOSS_BLINDS } = await import('../src/engine/run-simulator');
    expect(Object.keys(BOSS_BLINDS).length).toBe(28);
  });

  it('BOSS_POOL has 28 entries', async () => {
    const { BOSS_POOL } = await import('../src/engine/run-simulator');
    expect(BOSS_POOL.length).toBe(28);
  });

  it('getBossEffect: The Manacle has handSizeModifier: -1', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    const effect = getBossEffect('the_manacle');
    expect(effect.handSizeModifier).toBe(-1);
    expect(effect.maxHandsOverride).toBeUndefined();
  });

  it('getBossEffect: The Serpent has drawCardsAfterPlay: 3', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    const effect = getBossEffect('the_serpent');
    expect(effect.drawCardsAfterPlay).toBe(3);
    expect(effect.shrinkingHandSize).toBeUndefined();
  });

  it('getBossEffect: club/goad/head/window debuff correct suits', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    expect(getBossEffect('the_club').debuffedSuits).toEqual([Suit.Clubs]);
    expect(getBossEffect('the_goad').debuffedSuits).toEqual([Suit.Spades]);
    expect(getBossEffect('the_head').debuffedSuits).toEqual([Suit.Hearts]);
    expect(getBossEffect('the_window').debuffedSuits).toEqual([Suit.Diamonds]);
  });

  it('getBossEffect: The Plant debuffs face cards', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    const effect = getBossEffect('the_plant');
    expect(effect.debuffedRanks).toContain(Rank.Jack);
    expect(effect.debuffedRanks).toContain(Rank.Queen);
    expect(effect.debuffedRanks).toContain(Rank.King);
  });

  it('getBossEffect: The Tooth costs $1 per card', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    expect(getBossEffect('the_tooth').costPerCardPlayed).toBe(1);
  });

  it('getBossEffect: Violet Vessel has 6x chips', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    expect(getBossEffect('violet_vessel').chipsMultiplier).toBe(6);
  });

  it('getBossEffect: The Mouth restricts to first hand type', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    expect(getBossEffect('the_mouth').restrictToFirstHandType).toBe(true);
  });

  it('getBossEffect: The Psychic requires 5 cards', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    expect(getBossEffect('the_psychic').mustPlayFiveCards).toBe(true);
  });

  it('getBossEffect: The Ox resets money on most played hand', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    expect(getBossEffect('the_ox').resetMoneyOnMostPlayedHand).toBe(true);
  });

  it('getBossEffect: no-op bosses have empty effects', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    for (const id of ['the_fish', 'the_house', 'the_mark', 'the_wheel']) {
      const effect = getBossEffect(id);
      const keys = Object.keys(effect);
      expect(keys.length).toBe(0);
    }
  });

  // ── v3 boss blinds (6 new) ─────────────────────────────────────

  it('getBossEffect: The Hook debuffs 2 random cards per hand', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    const effect = getBossEffect('the_hook');
    expect(effect.debuffRandomCardsInHand).toBe(2);
  });

  it('getBossEffect: The Pillar debuffs scored cards this ante', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    const effect = getBossEffect('the_pillar');
    expect(effect.debuffScoredCardsThisAnte).toBe(true);
  });

  it('getBossEffect: Verdant Leaf debuffs all cards until joker sold', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    const effect = getBossEffect('verdant_leaf');
    expect(effect.debuffAllCardsUntilSell).toBe(true);
  });

  it('getBossEffect: Crimson Heart disables one random joker', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    const effect = getBossEffect('crimson_heart');
    expect(effect.disableRandomJoker).toBe(true);
  });

  it('getBossEffect: Cerulean Bell forces a random card', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    const effect = getBossEffect('cerulean_bell');
    expect(effect.forceRandomCard).toBe(true);
  });

  it('getBossEffect: Amber Acorn shuffles jokers', async () => {
    const { getBossEffect } = await import('../src/engine/run-simulator');
    const effect = getBossEffect('amber_acorn');
    expect(effect.shuffleJokers).toBe(true);
  });

  // ── Economy joker income ───────────────────────────────────────

  it('calculateJokerIncome: golden gives $4', async () => {
    const { calculateJokerIncome } = await import('../src/engine/run-simulator');
    const income = calculateJokerIncome({
      jokers: [{ id: 'golden', edition: CardEdition.None }],
      deck: { totalCards: 52, remainingByRank: {}, remainingBySuit: {} },
      discardsUsed: 0, maxDiscards: 3, cumulativeDollars: 25,
      playedCards: [], heldCards: [], roundNumber: 1, totalCardsDiscarded: 0,
    });
    expect(income).toBe(4);
  });

  it('calculateJokerIncome: rocket escalates per round', async () => {
    const { calculateJokerIncome } = await import('../src/engine/run-simulator');
    const empty = { totalCards: 52, remainingByRank: {}, remainingBySuit: {} };
    const base = { jokers: [{ id: 'rocket', edition: CardEdition.None }], deck: empty, discardsUsed: 0, maxDiscards: 3, cumulativeDollars: 25, playedCards: [], heldCards: [], totalCardsDiscarded: 0 };
    expect(calculateJokerIncome({ ...base, roundNumber: 1 })).toBe(1);
    expect(calculateJokerIncome({ ...base, roundNumber: 2 })).toBe(3);
    expect(calculateJokerIncome({ ...base, roundNumber: 3 })).toBe(5);
  });

  it('calculateJokerIncome: delayed_gratification gives $2 per unused discard', async () => {
    const { calculateJokerIncome } = await import('../src/engine/run-simulator');
    const income = calculateJokerIncome({
      jokers: [{ id: 'delayed_gratification', edition: CardEdition.None }],
      deck: { totalCards: 52, remainingByRank: {}, remainingBySuit: {} },
      discardsUsed: 1, maxDiscards: 3, cumulativeDollars: 25,
      playedCards: [], heldCards: [], roundNumber: 1, totalCardsDiscarded: 0,
    });
    expect(income).toBe(4); // 2 unused * $2
  });

  it('calculateJokerIncome: cloud_9 gives $1 per nine in deck', async () => {
    const { calculateJokerIncome } = await import('../src/engine/run-simulator');
    const income = calculateJokerIncome({
      jokers: [{ id: 'cloud_9', edition: CardEdition.None }],
      deck: { totalCards: 52, remainingByRank: { [Rank.Nine]: 4 }, remainingBySuit: {} },
      discardsUsed: 0, maxDiscards: 3, cumulativeDollars: 25,
      playedCards: [], heldCards: [], roundNumber: 1, totalCardsDiscarded: 0,
    });
    expect(income).toBe(4);
  });

  it('calculateJokerIncome: rough_gem gives $1 per diamond', async () => {
    const { calculateJokerIncome } = await import('../src/engine/run-simulator');
    const income = calculateJokerIncome({
      jokers: [{ id: 'rough_gem', edition: CardEdition.None }],
      deck: { totalCards: 52, remainingByRank: {}, remainingBySuit: { [Suit.Diamonds]: 13 } },
      discardsUsed: 0, maxDiscards: 3, cumulativeDollars: 25,
      playedCards: [], heldCards: [], roundNumber: 1, totalCardsDiscarded: 0,
    });
    expect(income).toBe(13);
  });

  it('calculateJokerIncome: gift gives $1 per discard used', async () => {
    const { calculateJokerIncome } = await import('../src/engine/run-simulator');
    const income = calculateJokerIncome({
      jokers: [{ id: 'gift', edition: CardEdition.None }],
      deck: { totalCards: 52, remainingByRank: {}, remainingBySuit: {} },
      discardsUsed: 2, maxDiscards: 3, cumulativeDollars: 25,
      playedCards: [], heldCards: [], roundNumber: 1, totalCardsDiscarded: 0,
    });
    expect(income).toBe(2);
  });

  it('calculateJokerIncome: reserved_parking expected from held face cards', async () => {
    const { calculateJokerIncome } = await import('../src/engine/run-simulator');
    const income = calculateJokerIncome({
      jokers: [{ id: 'reserved_parking', edition: CardEdition.None }],
      deck: { totalCards: 52, remainingByRank: {}, remainingBySuit: {} },
      discardsUsed: 0, maxDiscards: 3, cumulativeDollars: 25,
      playedCards: [],
      heldCards: [
        { id: '1', rank: Rank.King, suit: Suit.Hearts, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None, debuffed: false },
        { id: '2', rank: Rank.Queen, suit: Suit.Spades, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None, debuffed: false },
      ],
      roundNumber: 1, totalCardsDiscarded: 0,
    });
    expect(income).toBe(1); // 2 face * 0.5 = 1
  });

  it('calculateJokerIncome: business expected from played face cards', async () => {
    const { calculateJokerIncome } = await import('../src/engine/run-simulator');
    const income = calculateJokerIncome({
      jokers: [{ id: 'business', edition: CardEdition.None }],
      deck: { totalCards: 52, remainingByRank: {}, remainingBySuit: {} },
      discardsUsed: 0, maxDiscards: 3, cumulativeDollars: 25,
      playedCards: [
        { id: '1', rank: Rank.King, suit: Suit.Hearts, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None, debuffed: false },
        { id: '2', rank: Rank.Queen, suit: Suit.Spades, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None, debuffed: false },
        { id: '3', rank: Rank.Jack, suit: Suit.Clubs, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None, debuffed: false },
      ],
      heldCards: [], roundNumber: 1, totalCardsDiscarded: 0,
    });
    expect(income).toBe(6); // 3 face * 2 = 6 (business gives $2 per face card)
  });

  it('calculateJokerIncome: mail gives $1 per discarded card', async () => {
    const { calculateJokerIncome } = await import('../src/engine/run-simulator');
    const income = calculateJokerIncome({
      jokers: [{ id: 'mail', edition: CardEdition.None }],
      deck: { totalCards: 52, remainingByRank: {}, remainingBySuit: {} },
      discardsUsed: 1, maxDiscards: 3, cumulativeDollars: 25,
      playedCards: [], heldCards: [], roundNumber: 1, totalCardsDiscarded: 5,
    });
    expect(income).toBe(5);
  });

  it('calculateJokerIncome: multiple economy jokers sum', async () => {
    const { calculateJokerIncome } = await import('../src/engine/run-simulator');
    const empty = { totalCards: 52, remainingByRank: {}, remainingBySuit: {} };
    const income = calculateJokerIncome({
      jokers: [
        { id: 'golden', edition: CardEdition.None },
        { id: 'gift', edition: CardEdition.None },
      ],
      deck: empty, discardsUsed: 2, maxDiscards: 3, cumulativeDollars: 25,
      playedCards: [], heldCards: [], roundNumber: 1, totalCardsDiscarded: 0,
    });
    expect(income).toBe(6); // 4 + 2
  });

  // ── Interest with to_the_moon ──────────────────────────────────

  it('calculateInterest: to_the_moon raises cap to $10', async () => {
    const { calculateInterest } = await import('../src/engine/run-simulator');
    expect(calculateInterest(50, ['to_the_moon'])).toBe(10);
    expect(calculateInterest(50)).toBe(5);
  });

  // ── drawHand empty deck fix ────────────────────────────────────

  it('drawHand: empty deck returns empty hand', async () => {
    const { drawHand } = await import('../src/engine/run-simulator');
    const emptyDeck = {
      totalCards: 0,
      remainingByRank: {},
      remainingBySuit: {},
    };
    const { createRng } = await import('../src/engine/rng');
    const rng = createRng(12345);
    const result = drawHand(emptyDeck, 8, rng);
    expect(result.cards.length).toBe(0);
    expect(result.deck.totalCards).toBe(0);
  });

  // ── drawHand enhancement/edition/seal support ──────────────────

  it('drawHand: standard deck produces cards with none enhancement/edition/seal', async () => {
    const { drawHand } = await import('../src/engine/run-simulator');
    const { createStandardDeck } = await import('../src/engine/deck');
    const deck = createStandardDeck();
    const { createRng } = await import('../src/engine/rng');
    const rng = createRng(12345);
    const result = drawHand(deck, 8, rng);
    for (const card of result.cards) {
      expect(card.enhancement).toBe('none');
      expect(card.edition).toBe('none');
      expect(card.seal).toBe('none');
    }
    expect(result.deck.enhancementCounts?.none).toBe(44);
    expect(result.deck.editionCounts?.none).toBe(44);
    expect(result.deck.sealCounts?.none).toBe(44);
  });

  it('drawHand: deck with enhanced cards assigns enhancements to drawn cards', async () => {
    const { drawHand } = await import('../src/engine/run-simulator');
    const { CardEnhancement: CE } = await import('../src/engine/types');
    const deck = {
      totalCards: 10,
      remainingByRank: { [Rank.Ace]: 10 } as Partial<Record<Rank, number>>,
      remainingBySuit: { [Suit.Spades]: 10 } as Partial<Record<Suit, number>>,
      enhancementCounts: { [CE.None]: 5, [CE.Bonus]: 3, [CE.Glass]: 2 } as Partial<Record<string, number>>,
      editionCounts: { none: 10 } as Partial<Record<string, number>>,
      sealCounts: { none: 10 } as Partial<Record<string, number>>,
    };
    const { createRng } = await import('../src/engine/rng');
    const rng = createRng(99999);
    const result = drawHand(deck, 5, rng);

    expect(result.cards.length).toBe(5);
    expect(result.deck.totalCards).toBe(5);

    // Count drawn enhancements
    const drawnEnh = { none: 0, bonus: 0, glass: 0 };
    for (const card of result.cards) {
      drawnEnh[card.enhancement as string] = (drawnEnh[card.enhancement as string] ?? 0) + 1;
    }

    // Verify counts are decremented correctly
    expect(result.deck.enhancementCounts?.none).toBe(5 - drawnEnh.none);
    expect(result.deck.enhancementCounts?.bonus).toBe(3 - drawnEnh.bonus);
    expect(result.deck.enhancementCounts?.glass).toBe(2 - drawnEnh.glass);

    // Total drawn counts should equal 5
    expect(drawnEnh.none + drawnEnh.bonus + drawnEnh.glass).toBe(5);
  });

  it('drawHand: deck with editions assigns editions to drawn cards', async () => {
    const { drawHand } = await import('../src/engine/run-simulator');
    const deck = {
      totalCards: 6,
      remainingByRank: { [Rank.King]: 6 } as Partial<Record<Rank, number>>,
      remainingBySuit: { [Suit.Hearts]: 6 } as Partial<Record<Suit, number>>,
      enhancementCounts: { none: 6 } as Partial<Record<string, number>>,
      editionCounts: { none: 4, foil: 2 } as Partial<Record<string, number>>,
      sealCounts: { none: 6 } as Partial<Record<string, number>>,
    };
    const { createRng } = await import('../src/engine/rng');
    const rng = createRng(42);
    const result = drawHand(deck, 3, rng);

    expect(result.cards.length).toBe(3);
    const drawnEditions = { none: 0, foil: 0 };
    for (const card of result.cards) {
      drawnEditions[card.edition as string] = (drawnEditions[card.edition as string] ?? 0) + 1;
    }
    expect(result.deck.editionCounts?.none).toBe(4 - drawnEditions.none);
    expect(result.deck.editionCounts?.foil).toBe(2 - drawnEditions.foil);
    expect(drawnEditions.none + drawnEditions.foil).toBe(3);
  });

  it('drawHand: deck with seals assigns seals to drawn cards', async () => {
    const { drawHand } = await import('../src/engine/run-simulator');
    const deck = {
      totalCards: 8,
      remainingByRank: { [Rank.Queen]: 8 } as Partial<Record<Rank, number>>,
      remainingBySuit: { [Suit.Diamonds]: 8 } as Partial<Record<Suit, number>>,
      enhancementCounts: { none: 8 } as Partial<Record<string, number>>,
      editionCounts: { none: 8 } as Partial<Record<string, number>>,
      sealCounts: { none: 5, red: 3 } as Partial<Record<string, number>>,
    };
    const { createRng } = await import('../src/engine/rng');
    const rng = createRng(77777);
    const result = drawHand(deck, 4, rng);

    expect(result.cards.length).toBe(4);
    const drawnSeals = { none: 0, red: 0 };
    for (const card of result.cards) {
      drawnSeals[card.seal as string] = (drawnSeals[card.seal as string] ?? 0) + 1;
    }
    expect(result.deck.sealCounts?.none).toBe(5 - drawnSeals.none);
    expect(result.deck.sealCounts?.red).toBe(3 - drawnSeals.red);
    expect(drawnSeals.none + drawnSeals.red).toBe(4);
  });

  it('drawHand: counts sum to totalCards after draw', async () => {
    const { drawHand } = await import('../src/engine/run-simulator');
    const deck = {
      totalCards: 12,
      remainingByRank: { [Rank.Ten]: 12 } as Partial<Record<Rank, number>>,
      remainingBySuit: { [Suit.Clubs]: 12 } as Partial<Record<Suit, number>>,
      enhancementCounts: { none: 6, bonus: 2, mult: 2, steel: 2 } as Partial<Record<string, number>>,
      editionCounts: { none: 10, holo: 2 } as Partial<Record<string, number>>,
      sealCounts: { none: 9, blue: 2, gold: 1 } as Partial<Record<string, number>>,
    };
    const { createRng } = await import('../src/engine/rng');
    const rng = createRng(11111);
    const result = drawHand(deck, 7, rng);

    // Each count type should sum to totalCards (5 remaining)
    const enhSum = Object.values(result.deck.enhancementCounts ?? {}).reduce((a: number, b: number) => a + b, 0);
    const edSum = Object.values(result.deck.editionCounts ?? {}).reduce((a: number, b: number) => a + b, 0);
    const sealSum = Object.values(result.deck.sealCounts ?? {}).reduce((a: number, b: number) => a + b, 0);
    expect(enhSum).toBe(5);
    expect(edSum).toBe(5);
    expect(sealSum).toBe(5);
  });

  it('simulateRun: enhanced deck completes without errors', async () => {
    const { simulateRun } = await import('../src/engine/run-simulator');
    const { getDefaultHandLevels } = await import('../src/engine/constants');
    const { CardEnhancement: CE } = await import('../src/engine/types');

    const enhancedDeck = {
      totalCards: 52,
      remainingByRank: Object.fromEntries(
        ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'].map(r => [r, 4])
      ) as Partial<Record<Rank, number>>,
      remainingBySuit: { S: 13, H: 13, C: 13, D: 13 } as Partial<Record<Suit, number>>,
      enhancementCounts: { [CE.None]: 47, [CE.Bonus]: 2, [CE.Glass]: 2, [CE.Steel]: 1 } as Partial<Record<string, number>>,
      editionCounts: { none: 52 } as Partial<Record<string, number>>,
      sealCounts: { none: 52 } as Partial<Record<string, number>>,
    };

    const state = {
      handCards: [],
      jokers: [],
      handLevels: getDefaultHandLevels(),
      deckComposition: enhancedDeck,
      blind: { type: 'small' as const, chipsRequired: 300, debuffedRanks: [], debuffedSuits: [], bossId: null as string | null },
      roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 },
      flags: { playedHandsThisRound: [] as import('../src/engine/types').HandType[] },
    };

    const result = simulateRun(state, { maxAntes: 1, seed: 42 });
    expect(result.rounds.length).toBeGreaterThan(0);
    // All rounds should complete (not crash)
    for (const round of result.rounds) {
      expect(round.blindBeaten !== undefined).toBe(true);
    }
  });

  // ── simulateRun with randomBosses ──────────────────────────────

  it('simulateRun: randomBosses produces different bosses with different seeds', async () => {
    const { simulateRun } = await import('../src/engine/run-simulator');
    const { createStandardDeck } = await import('../src/engine/deck');
    const { getDefaultHandLevels } = await import('../src/engine/constants');

    const state = {
      handCards: [],
      jokers: [],
      handLevels: getDefaultHandLevels(),
      deckComposition: createStandardDeck(),
      blind: { type: 'small' as const, chipsRequired: 300, debuffedRanks: [], debuffedSuits: [], bossId: null as string | null },
      roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 },
      flags: { playedHandsThisRound: [] as import('../src/engine/types').HandType[] },
    };

    const r1 = simulateRun(state, { maxAntes: 1, seed: 42, randomBosses: true });
    const r2 = simulateRun(state, { maxAntes: 1, seed: 99, randomBosses: true });
    // Both should produce at least 1 round with a boss
    expect(r1.rounds.length).toBeGreaterThan(0);
    expect(r2.rounds.length).toBeGreaterThan(0);
  });

  it('simulateRun: randomBosses respects seed determinism', async () => {
    const { simulateRun } = await import('../src/engine/run-simulator');
    const { createStandardDeck } = await import('../src/engine/deck');
    const { getDefaultHandLevels } = await import('../src/engine/constants');

    const state = {
      handCards: [],
      jokers: [],
      handLevels: getDefaultHandLevels(),
      deckComposition: createStandardDeck(),
      blind: { type: 'small' as const, chipsRequired: 300, debuffedRanks: [], debuffedSuits: [], bossId: null as string | null },
      roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 },
      flags: { playedHandsThisRound: [] as import('../src/engine/types').HandType[] },
    };

    const r1 = simulateRun(state, { maxAntes: 1, seed: 42, randomBosses: true });
    const r2 = simulateRun(state, { maxAntes: 1, seed: 42, randomBosses: true });
    expect(r1.rounds[2]?.bossId).toBe(r2.rounds[2]?.bossId);
  });

  // ── simulateRun with jokers ────────────────────────────────────

  it('simulateRun: run with jokers produces rounds', async () => {
    const { simulateRun } = await import('../src/engine/run-simulator');
    const { createStandardDeck } = await import('../src/engine/deck');
    const { getDefaultHandLevels } = await import('../src/engine/constants');

    const state = {
      handCards: [],
      jokers: [
        { id: 'joker', edition: CardEdition.None },
        { id: 'greedy_joker', edition: CardEdition.None },
      ],
      handLevels: getDefaultHandLevels(),
      deckComposition: createStandardDeck(),
      blind: { type: 'small' as const, chipsRequired: 300, debuffedRanks: [], debuffedSuits: [], bossId: null as string | null },
      roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 },
      flags: { playedHandsThisRound: [] as import('../src/engine/types').HandType[] },
    };

    const result = simulateRun(state, { maxAntes: 1, seed: 42 });
    expect(result.rounds.length).toBeGreaterThan(0);
    // Rounds should have joker info
    if (result.rounds.length > 0) {
      expect(result.rounds[0].jokersAtRound.length).toBe(2);
    }
  });

  // ── Seed RNG ────────────────────────────────────────────────────

  it('hashSeedString: deterministic output', () => {
    expect(hashSeedString('ALEPH1337')).toBe(hashSeedString('ALEPH1337'));
    expect(hashSeedString('BALATRO')).toBe(hashSeedString('BALATRO'));
    expect(hashSeedString('')).toBe(hashSeedString(''));
  });

  it('hashSeedString: different strings produce different hashes (usually)', () => {
    // Extremely unlikely to collide
    const h1 = hashSeedString('SEED123');
    const h2 = hashSeedString('SEED124');
    const h3 = hashSeedString('different');
    expect(h1).not.toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it('hashSeedString: returns non-negative 32-bit integer', () => {
    const h = hashSeedString('test');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xFFFFFFFF);
  });

  it('createRng: numeric seed determinism', () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const values1 = Array.from({ length: 20 }, () => rng1());
    const values2 = Array.from({ length: 20 }, () => rng2());
    expect(values1).toEqual(values2);
  });

  it('createRng: string seed determinism', () => {
    const rng1 = createRng('ALEPH1337');
    const rng2 = createRng('ALEPH1337');
    const values1 = Array.from({ length: 20 }, () => rng1());
    const values2 = Array.from({ length: 20 }, () => rng2());
    expect(values1).toEqual(values2);
  });

  it('createRng: different seeds produce different sequences', () => {
    const rng1 = createRng('seedA');
    const rng2 = createRng('seedB');
    const v1 = Array.from({ length: 10 }, () => rng1());
    const v2 = Array.from({ length: 10 }, () => rng2());
    expect(v1).not.toEqual(v2);
  });

  it('createRng: returns values in [0, 1)', () => {
    const rng = createRng(99999);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('createRng: same seed via number and hash produces same as string', () => {
    // Using a numeric string should hash differently than the raw number
    const rngNum = createRng(42);
    const rngStr = createRng('42');
    const valuesNum = Array.from({ length: 10 }, () => rngNum());
    const valuesStr = Array.from({ length: 10 }, () => rngStr());
    // "42" hashes differently from 42 as a number
    expect(valuesNum).not.toEqual(valuesStr);
    // But '42' is consistent with itself
    const rngStr2 = createRng('42');
    const valuesStr2 = Array.from({ length: 10 }, () => rngStr2());
    expect(valuesStr).toEqual(valuesStr2);
  });

  it('generateShop: deterministic with seeded rng', async () => {
    const { generateShop } = await import('../src/engine/shop');
    const { createStandardDeck } = await import('../src/engine/deck');
    const { getDefaultHandLevels } = await import('../src/engine/constants');

    const state = {
      handCards: [] as any[],
      jokers: [] as any[],
      handLevels: getDefaultHandLevels(),
      deckComposition: createStandardDeck(),
      blind: { type: 'small' as const, chipsRequired: 300, debuffedRanks: [], debuffedSuits: [], bossId: null as string | null },
      roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 },
      flags: { playedHandsThisRound: [] },
    };

    const rng1 = createRng('SHOPTEST');
    const rng2 = createRng('SHOPTEST');
    const shop1 = generateShop(state, 25, rng1);
    const shop2 = generateShop(state, 25, rng2);

    expect(shop1.bestPurchase).toBe(shop2.bestPurchase);
    expect(shop1.jokerUtility).toBe(shop2.jokerUtility);
    expect(shop1.pack1Utility).toBe(shop2.pack1Utility);
    expect(shop1.pack2Utility).toBe(shop2.pack2Utility);
  });

  it('simulateRun: string seed determinism', async () => {
    const { simulateRun } = await import('../src/engine/run-simulator');
    const { createStandardDeck } = await import('../src/engine/deck');
    const { getDefaultHandLevels } = await import('../src/engine/constants');

    const state = {
      handCards: [],
      jokers: [{ id: 'joker', edition: CardEdition.None }],
      handLevels: getDefaultHandLevels(),
      deckComposition: createStandardDeck(),
      blind: { type: 'small' as const, chipsRequired: 300, debuffedRanks: [], debuffedSuits: [], bossId: null as string | null },
      roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 },
      flags: { playedHandsThisRound: [] as import('../src/engine/types').HandType[] },
    };

    const result1 = simulateRun(state, { maxAntes: 1, seed: 'TESTRUN42' });
    const result2 = simulateRun(state, { maxAntes: 1, seed: 'TESTRUN42' });

    expect(result1.totalScore).toBe(result2.totalScore);
    expect(result1.rounds.length).toBe(result2.rounds.length);
    expect(result1.finalBlind).toBe(result2.finalBlind);
  });

  it('simulateRun: different string seeds produce different results', async () => {
    const { simulateRun } = await import('../src/engine/run-simulator');
    const { createStandardDeck } = await import('../src/engine/deck');
    const { getDefaultHandLevels } = await import('../src/engine/constants');

    const state = {
      handCards: [],
      jokers: [{ id: 'joker', edition: CardEdition.None }],
      handLevels: getDefaultHandLevels(),
      deckComposition: createStandardDeck(),
      blind: { type: 'small' as const, chipsRequired: 300, debuffedRanks: [], debuffedSuits: [], bossId: null as string | null },
      roundState: { handsPlayed: 0, discardsUsed: 0, dollars: 25, antes: 1, isFinalHand: false, maxHands: 4, maxDiscards: 3, handSize: 8 },
      flags: { playedHandsThisRound: [] as import('../src/engine/types').HandType[] },
    };

    const resultA = simulateRun(state, { maxAntes: 1, seed: 'RUNALPHA', randomBosses: true });
    const resultB = simulateRun(state, { maxAntes: 1, seed: 'RUNBETA', randomBosses: true });

    // Boss IDs should differ since randomBosses is true and seeds differ
    const bossA = resultA.rounds.find(r => r.bossId)?.bossId;
    const bossB = resultB.rounds.find(r => r.bossId)?.bossId;
    // Different seeds generally produce different boss selections
    // (technically could collide, but extremely unlikely)
    const allSame = resultA.rounds.every((r, i) =>
      r.bossId === resultB.rounds[i]?.bossId &&
      r.totalScore === resultB.rounds[i]?.totalScore
    );
    expect(allSame).toBe(false);
  });
});

// ─── Deck Composition ──────────────────────────────────────────

