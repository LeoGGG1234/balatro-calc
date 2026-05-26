import { describe, it, expect } from 'vitest';
import { formReducer, buildGameState } from '../src/hooks/useGameState';
import { buildAggregateFromCards } from '../src/engine/deck';
import {
  CardEnhancement, CardEdition, Seal, Rank, Suit,
  BlindType,
} from '../src/engine/types';
import { getDefaultHandLevels } from '../src/engine/constants';
import type { InjectedSaveData } from '../src/engine/save-parser';
import { LuaParser, SaveParseError, LuaParseError } from '../src/engine/save-parser';

// ─── Stub: Simulated decompressed Balatro Lua save text ──────────

function makeSaveLuaText(cards: Array<{
  suit: string; value: string; effect: string; set: string; seal?: string;
}>, jokers: Array<{
  name: string; set: string; extra?: number;
}> = []): string {
  const cardEntries = cards.map((c, i) => {
    const sealPart = c.seal ? `,["seal"]="${c.seal}"` : '';
    return `[${i + 1}]={["base"]={["suit"]="${c.suit}",["value"]="${c.value}",["name"]="${c.value} of ${c.suit}"},["ability"]={["effect"]="${c.effect}",["set"]="${c.set}",["name"]="Default Base"}${sealPart}}`;
  }).join(',');

  const jokerEntries = jokers.map((j, i) => {
    const extraPart = j.extra !== undefined ? `,["extra_value"]=${j.extra}` : '';
    return `[${i + 1}]={["ability"]={["name"]="${j.name}",["set"]="${j.set}"${extraPart}}}`;
  }).join(',');

  return `return {["STATE"]=3,["cardAreas"]={["deck"]={["cards"]={${cardEntries}}},["jokers"]={["cards"]={${jokerEntries}}},["hand"]={["cards"]={}}},["GAME"]={["current_round"]={["dollars"]=5,["hands_played"]=2,["discards_used"]=1,["discards_left"]=2},["round_resets"]={["ante"]=3,["blind"]={["name"]="Small Blind",["key"]="bl_small",["chips"]=300},["blind_states"]={["Small"]="Upcoming",["Big"]="Upcoming",["Boss"]="Upcoming"}}},["pseudorandom"]={["seed"]="TESTS33D"}}}`;
}

// ─── Tests ───────────────────────────────────────────────────────

describe('Save Parser — INJECT_SAVE_STATE reducer', () => {
  it('injects complete save data into empty form state', () => {
    const saveData: InjectedSaveData = {
      handCards: [
        { id: 'h1', rank: Rank.Ace, suit: Suit.Hearts, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None, debuffed: false },
        { id: 'h2', rank: Rank.King, suit: Suit.Spades, enhancement: CardEnhancement.Bonus, edition: CardEdition.Foil, seal: Seal.Red, debuffed: false },
      ],
      jokers: [
        { id: 'joker', edition: CardEdition.None },
        { id: 'blueprint', edition: CardEdition.Foil },
      ],
      handLevels: { ...getDefaultHandLevels(), Flush: 3, Pair: 2 },
      deckComposition: {
        totalCards: 52,
        remainingByRank: { [Rank.Ace]: 4, [Rank.King]: 4 },
        remainingBySuit: { [Suit.Hearts]: 13, [Suit.Spades]: 13 },
        cards: [
          { rank: Rank.Ace, suit: Suit.Hearts, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
          { rank: Rank.King, suit: Suit.Spades, enhancement: CardEnhancement.Bonus, edition: CardEdition.Foil, seal: Seal.Red },
          { rank: Rank.Ace, suit: Suit.Spades, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
        ],
      },
      dollars: 10,
      antes: 4,
      handsPlayed: 2,
      discardsUsed: 1,
      blindType: BlindType.Big,
      blindChips: 450,
      blindDebuffedRanks: [Rank.King],
      blindDebuffedSuits: [Suit.Hearts],
      seed: 'TESTS33D',
      jokerStateOverrides: { 0: 10, 1: 0 },
    };

    // Create a minimal initial state via reducer dispatch
    const initial = formReducer(null!, { type: 'RESET_FORM' } as never);
    const result = formReducer(initial, { type: 'INJECT_SAVE_STATE', data: saveData });

    // Check all fields are injected correctly
    expect(result.handCards).toHaveLength(2);
    expect(result.handCards[0].rank).toBe(Rank.Ace);
    expect(result.handCards[1].enhancement).toBe(CardEnhancement.Bonus);
    expect(result.handCards[1].edition).toBe(CardEdition.Foil);
    expect(result.handCards[1].seal).toBe(Seal.Red);

    expect(result.jokers).toHaveLength(2);
    expect(result.jokers[0].id).toBe('joker');
    expect(result.jokers[1].id).toBe('blueprint');
    expect(result.jokers[1].edition).toBe(CardEdition.Foil);

    expect(result.handLevels['Flush']).toBe(3);
    expect(result.handLevels['Pair']).toBe(2);

    expect(result.dollars).toBe(10);
    expect(result.antes).toBe(4);
    expect(result.handsPlayed).toBe(2);
    expect(result.discardsUsed).toBe(1);

    expect(result.blindType).toBe(BlindType.Big);
    expect(result.blindChips).toBe(450);
    expect(result.blindDebuffedRanks).toEqual([Rank.King]);
    expect(result.blindDebuffedSuits).toEqual([Suit.Hearts]);

    expect(result.seed).toBe('TESTS33D');
    expect(result.jokerStateOverrides).toEqual({ 0: 10, 1: 0 });
    expect(result.isFinalHand).toBe(false); // Reset on inject

    // Deck composition rebuilt with aggregate
    expect(result.deckComposition.totalCards).toBe(3);
    expect(result.deckComposition.cards).toHaveLength(3);
  });

  it('rebuilds aggregate from empty deck cards array', () => {
    const saveData: InjectedSaveData = {
      handCards: [],
      jokers: [],
      handLevels: getDefaultHandLevels(),
      deckComposition: { totalCards: 0, remainingByRank: {}, remainingBySuit: {}, cards: [] },
      dollars: 0,
      antes: 1,
      handsPlayed: 0,
      discardsUsed: 0,
      blindType: BlindType.Small,
      blindChips: 300,
      blindDebuffedRanks: [],
      blindDebuffedSuits: [],
      seed: null,
      jokerStateOverrides: {},
    };

    const initial = formReducer(null!, { type: 'RESET_FORM' } as never);
    const result = formReducer(initial, { type: 'INJECT_SAVE_STATE', data: saveData });

    expect(result.deckComposition.totalCards).toBe(0);
    expect(result.deckComposition.cards).toEqual([]);
  });

  it('handles deck without cards array (aggregate-only)', () => {
    const saveData: InjectedSaveData = {
      handCards: [],
      jokers: [],
      handLevels: getDefaultHandLevels(),
      deckComposition: {
        totalCards: 44,
        remainingByRank: { [Rank.Ace]: 4 },
        remainingBySuit: { [Suit.Spades]: 11 },
      },
      dollars: 0,
      antes: 1,
      handsPlayed: 0,
      discardsUsed: 0,
      blindType: BlindType.Small,
      blindChips: 300,
      blindDebuffedRanks: [],
      blindDebuffedSuits: [],
      seed: null,
      jokerStateOverrides: {},
    };

    const initial = formReducer(null!, { type: 'RESET_FORM' } as never);
    const result = formReducer(initial, { type: 'INJECT_SAVE_STATE', data: saveData });

    expect(result.deckComposition.totalCards).toBe(44);
    expect(result.deckComposition.remainingByRank[Rank.Ace]).toBe(4);
  });
});

describe('buildAggregateFromCards — Deck consistency', () => {
  it('correctly counts enhancements, editions, and seals', () => {
    const cards = [
      { rank: Rank.Ace, suit: Suit.Hearts, enhancement: CardEnhancement.Bonus, edition: CardEdition.Foil, seal: Seal.Red },
      { rank: Rank.King, suit: Suit.Spades, enhancement: CardEnhancement.Mult, edition: CardEdition.Holographic, seal: Seal.Blue },
      { rank: Rank.Queen, suit: Suit.Clubs, enhancement: CardEnhancement.Glass, edition: CardEdition.Polychrome, seal: Seal.Gold },
      { rank: Rank.Jack, suit: Suit.Diamonds, enhancement: CardEnhancement.Steel, edition: CardEdition.Negative, seal: Seal.Purple },
      { rank: Rank.Ten, suit: Suit.Hearts, enhancement: CardEnhancement.Stone, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Nine, suit: Suit.Spades, enhancement: CardEnhancement.Gold, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Eight, suit: Suit.Clubs, enhancement: CardEnhancement.Lucky, edition: CardEdition.None, seal: Seal.None },
    ];

    const agg = buildAggregateFromCards(cards);

    expect(agg.totalCards).toBe(7);
    expect(agg.enhancementCounts?.[CardEnhancement.Bonus]).toBe(1);
    expect(agg.enhancementCounts?.[CardEnhancement.Mult]).toBe(1);
    expect(agg.enhancementCounts?.[CardEnhancement.Glass]).toBe(1);
    expect(agg.enhancementCounts?.[CardEnhancement.Steel]).toBe(1);
    expect(agg.enhancementCounts?.[CardEnhancement.Stone]).toBe(1);
    expect(agg.enhancementCounts?.[CardEnhancement.Gold]).toBe(1);
    expect(agg.enhancementCounts?.[CardEnhancement.Lucky]).toBe(1);

    expect(agg.editionCounts?.[CardEdition.Foil]).toBe(1);
    expect(agg.editionCounts?.[CardEdition.Holographic]).toBe(1);
    expect(agg.editionCounts?.[CardEdition.Polychrome]).toBe(1);
    expect(agg.editionCounts?.[CardEdition.Negative]).toBe(1);
    expect(agg.editionCounts?.[CardEdition.None]).toBe(3);

    expect(agg.sealCounts?.[Seal.Red]).toBe(1);
    expect(agg.sealCounts?.[Seal.Blue]).toBe(1);
    expect(agg.sealCounts?.[Seal.Gold]).toBe(1);
    expect(agg.sealCounts?.[Seal.Purple]).toBe(1);
    expect(agg.sealCounts?.[Seal.None]).toBe(3);
  });

  it('matching aggregate totals equal totalCards', () => {
    const cards = [
      { rank: Rank.Ace, suit: Suit.Hearts, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
      { rank: Rank.Ace, suit: Suit.Spades, enhancement: CardEnhancement.Bonus, edition: CardEdition.Foil, seal: Seal.Red },
      { rank: Rank.King, suit: Suit.Hearts, enhancement: CardEnhancement.Mult, edition: CardEdition.Holographic, seal: Seal.Blue },
    ];

    const agg = buildAggregateFromCards(cards);

    // Sum of rank counts should equal total
    const rankSum = Object.values(agg.remainingByRank).reduce((s, v) => s + (v ?? 0), 0);
    const suitSum = Object.values(agg.remainingBySuit).reduce((s, v) => s + (v ?? 0), 0);
    const enhSum = Object.values(agg.enhancementCounts ?? {}).reduce((s, v) => s + (v ?? 0), 0);
    const edSum = Object.values(agg.editionCounts ?? {}).reduce((s, v) => s + (v ?? 0), 0);
    const sealSum = Object.values(agg.sealCounts ?? {}).reduce((s, v) => s + (v ?? 0), 0);

    expect(rankSum).toBe(3);
    expect(suitSum).toBe(3);
    expect(enhSum).toBe(3);
    expect(edSum).toBe(3);
    expect(sealSum).toBe(3);
  });
});

describe('Save Parser — Edge cases', () => {
  it('handles NULL seed correctly', () => {
    const saveData: InjectedSaveData = {
      handCards: [],
      jokers: [],
      handLevels: getDefaultHandLevels(),
      deckComposition: { totalCards: 0, remainingByRank: {}, remainingBySuit: {} },
      dollars: 0, antes: 1, handsPlayed: 0, discardsUsed: 0,
      blindType: BlindType.Small, blindChips: 300,
      blindDebuffedRanks: [], blindDebuffedSuits: [],
      seed: null,
      jokerStateOverrides: {},
    };

    const initial = formReducer(null!, { type: 'RESET_FORM' } as never);
    const result = formReducer(initial, { type: 'INJECT_SAVE_STATE', data: saveData });
    expect(result.seed).toBeNull();
  });

  it('handles empty joker list', () => {
    const saveData: InjectedSaveData = {
      handCards: [],
      jokers: [],
      handLevels: getDefaultHandLevels(),
      deckComposition: { totalCards: 0, remainingByRank: {}, remainingBySuit: {} },
      dollars: 0, antes: 1, handsPlayed: 0, discardsUsed: 0,
      blindType: BlindType.Small, blindChips: 300,
      blindDebuffedRanks: [], blindDebuffedSuits: [],
      seed: null,
      jokerStateOverrides: {},
    };

    const initial = formReducer(null!, { type: 'RESET_FORM' } as never);
    const result = formReducer(initial, { type: 'INJECT_SAVE_STATE', data: saveData });
    expect(result.jokers).toEqual([]);
    expect(result.jokerStateOverrides).toEqual({});
  });

  it('handles max joker count', () => {
    const sevenJokers = Array.from({ length: 7 }, (_, i) => ({
      id: 'joker',
      edition: CardEdition.None,
    }));

    const saveData: InjectedSaveData = {
      handCards: [],
      jokers: sevenJokers,
      handLevels: getDefaultHandLevels(),
      deckComposition: { totalCards: 0, remainingByRank: {}, remainingBySuit: {} },
      dollars: 0, antes: 1, handsPlayed: 0, discardsUsed: 0,
      blindType: BlindType.Small, blindChips: 300,
      blindDebuffedRanks: [], blindDebuffedSuits: [],
      seed: null,
      jokerStateOverrides: {},
    };

    const initial = formReducer(null!, { type: 'RESET_FORM' } as never);
    const result = formReducer(initial, { type: 'INJECT_SAVE_STATE', data: saveData });
    expect(result.jokers).toHaveLength(7);
  });

  it('generates valid GameState after injection', () => {
    const saveData: InjectedSaveData = {
      handCards: [
        { id: 'h1', rank: Rank.Ace, suit: Suit.Hearts, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None, debuffed: false },
      ],
      jokers: [{ id: 'joker', edition: CardEdition.None }],
      handLevels: getDefaultHandLevels(),
      deckComposition: {
        totalCards: 52,
        remainingByRank: { [Rank.Ace]: 4 },
        remainingBySuit: { [Suit.Hearts]: 13 },
        cards: [
          { rank: Rank.Ace, suit: Suit.Hearts, enhancement: CardEnhancement.None, edition: CardEdition.None, seal: Seal.None },
        ],
      },
      dollars: 5, antes: 2, handsPlayed: 1, discardsUsed: 0,
      blindType: BlindType.Small, blindChips: 300,
      blindDebuffedRanks: [], blindDebuffedSuits: [],
      seed: null,
      jokerStateOverrides: {},
    };

    const initial = formReducer(null!, { type: 'RESET_FORM' } as never);
    const state = formReducer(initial, { type: 'INJECT_SAVE_STATE', data: saveData });
    const gameState = buildGameState(state);

    expect(gameState.handCards).toHaveLength(1);
    expect(gameState.jokers).toHaveLength(1);
    expect(gameState.roundState.dollars).toBe(5);
    expect(gameState.roundState.antes).toBe(2);
    expect(gameState.roundState.handsPlayed).toBe(1);
    expect(gameState.roundState.discardsUsed).toBe(0);
    expect(gameState.blind.type).toBe(BlindType.Small);
    expect(gameState.flags.hasDiscardedThisRound).toBe(false);
  });

  it('INJECT_SAVE_STATE sets hasDiscardedThisRound correctly', () => {
    const saveData: InjectedSaveData = {
      handCards: [],
      jokers: [],
      handLevels: getDefaultHandLevels(),
      deckComposition: { totalCards: 0, remainingByRank: {}, remainingBySuit: {} },
      dollars: 0, antes: 1, handsPlayed: 0, discardsUsed: 3,
      blindType: BlindType.Small, blindChips: 300,
      blindDebuffedRanks: [], blindDebuffedSuits: [],
      seed: null,
      jokerStateOverrides: {},
    };

    const initial = formReducer(null!, { type: 'RESET_FORM' } as never);
    const state = formReducer(initial, { type: 'INJECT_SAVE_STATE', data: saveData });
    const gameState = buildGameState(state);

    expect(gameState.flags.hasDiscardedThisRound).toBe(true);
  });
});

describe('Save Parser — Invalid / corrupted input', () => {
  it('buildGameState handles empty injected data gracefully', () => {
    const saveData: InjectedSaveData = {
      handCards: [],
      jokers: [],
      handLevels: getDefaultHandLevels(),
      deckComposition: { totalCards: 0, remainingByRank: {}, remainingBySuit: {} },
      dollars: 0, antes: 1, handsPlayed: 0, discardsUsed: 0,
      blindType: BlindType.Small, blindChips: 0,
      blindDebuffedRanks: [], blindDebuffedSuits: [],
      seed: null,
      jokerStateOverrides: {},
    };

    const initial = formReducer(null!, { type: 'RESET_FORM' } as never);
    const state = formReducer(initial, { type: 'INJECT_SAVE_STATE', data: saveData });
    const gameState = buildGameState(state);

    expect(gameState.handCards).toHaveLength(0);
    expect(gameState.deckComposition.totalCards).toBe(0);
    expect(gameState.roundState.dollars).toBe(0);
  });
});

describe('Lua Parser — Core tokenizer & parser', () => {
  it('parses nested tables with string keys', () => {
    const input = `return {
      ["name"]="Blue Deck",
      ["config"]={["hands"]=1,["discards"]=3},
      ["tags"]={},
    }`;
    const parser = new LuaParser(input);
    const result = parser.parseRoot() as Record<string, unknown>;

    expect(result['name']).toBe('Blue Deck');
    expect((result['config'] as Record<string, unknown>)['hands']).toBe(1);
    expect((result['config'] as Record<string, unknown>)['discards']).toBe(3);
    expect(Object.keys(result['tags'] as Record<string, unknown>)).toHaveLength(0);
  });

  it('parses numeric keys and mixed arrays', () => {
    const input = `return {
      [1]="first",
      [2]={["suit"]="Hearts",["value"]="Ace"},
      [3]=42,
      ["meta"]={["version"]=1},
    }`;
    const parser = new LuaParser(input);
    const result = parser.parseRoot() as Record<string, unknown>;

    expect(result[1]).toBe('first');
    const card2 = result[2] as Record<string, unknown>;
    expect(card2['suit']).toBe('Hearts');
    expect(card2['value']).toBe('Ace');
    expect(result[3]).toBe(42);
    expect((result['meta'] as Record<string, unknown>)['version']).toBe(1);
  });

  it('parses booleans and numbers correctly', () => {
    const input = `return {["a"]=true,["b"]=false,["c"]=123,["d"]=-5,["e"]=3.14,["f"]="true"}`;
    const parser = new LuaParser(input);
    const result = parser.parseRoot() as Record<string, unknown>;

    expect(result['a']).toBe(true);
    expect(result['b']).toBe(false);
    expect(result['c']).toBe(123);
    expect(result['d']).toBe(-5);
    expect(result['e']).toBe(3.14);
    expect(result['f']).toBe('true'); // String, not boolean
  });

  it('handles escaped characters in strings', () => {
    const input = `return {["msg"]="hello\\nworld\\t!",["path"]="C:\\\\Users"}`;
    const parser = new LuaParser(input);
    const result = parser.parseRoot() as Record<string, unknown>;

    expect(result['msg']).toBe('hello\nworld\t!');
    expect(result['path']).toBe('C:\\Users');
  });

  it('throws LuaParseError for invalid input', () => {
    expect(() => new LuaParser('not a valid lua table').parseRoot()).toThrow(LuaParseError);
    expect(() => new LuaParser('return {unclosed').parseRoot()).toThrow(LuaParseError);
    expect(() => new LuaParser('').parseRoot()).toThrow(LuaParseError);
  });

  it('parses Balatro-style save text with nested jokers and cards', () => {
    const input = `return {
      ["cardAreas"]={
        ["jokers"]={
          ["cards"]={
            [1]={["ability"]={["name"]="Joker",["set"]="Default",["extra_value"]=0}},
            [2]={["ability"]={["name"]="Blueprint",["set"]="Foil"}},
          },
        },
        ["deck"]={
          ["cards"]={
            [1]={["base"]={["suit"]="Hearts",["value"]="Ace"},["ability"]={["effect"]="Bonus",["set"]="Foil"},["seal"]="Red"},
            [2]={["base"]={["suit"]="Spades",["value"]="King"},["ability"]={["effect"]="Steel Card",["set"]="Polychrome"}},
          },
        },
      },
      ["GAME"]={
        ["current_round"]={["dollars"]=7,["hands_played"]=1,["discards_used"]=2},
        ["round_resets"]={["ante"]=3,["blind"]={["name"]="Big Blind",["key"]="bl_big",["chips"]=450}},
      },
    }`;
    const parser = new LuaParser(input);
    const result = parser.parseRoot() as Record<string, unknown>;

    const cardAreas = result['cardAreas'] as Record<string, unknown>;
    const jokers = cardAreas['jokers'] as Record<string, unknown>;
    const jokerCards = jokers['cards'] as Record<string, unknown>;
    const joker1 = jokerCards[1] as Record<string, unknown>;
    const joker1Abi = joker1['ability'] as Record<string, unknown>;
    expect(joker1Abi['name']).toBe('Joker');
    expect(joker1Abi['set']).toBe('Default');
    expect(joker1Abi['extra_value']).toBe(0);

    const joker2 = jokerCards[2] as Record<string, unknown>;
    const joker2Abi = joker2['ability'] as Record<string, unknown>;
    expect(joker2Abi['name']).toBe('Blueprint');
    expect(joker2Abi['set']).toBe('Foil');

    const deck = cardAreas['deck'] as Record<string, unknown>;
    const deckCards = deck['cards'] as Record<string, unknown>;
    const card1 = deckCards[1] as Record<string, unknown>;
    const card1Base = card1['base'] as Record<string, unknown>;
    expect(card1Base['suit']).toBe('Hearts');
    expect(card1Base['value']).toBe('Ace');
    const card1Abi = card1['ability'] as Record<string, unknown>;
    expect(card1Abi['effect']).toBe('Bonus');
    expect(card1Abi['set']).toBe('Foil');
    expect(card1['seal']).toBe('Red');

    const card2 = deckCards[2] as Record<string, unknown>;
    const card2Abi = card2['ability'] as Record<string, unknown>;
    expect(card2Abi['effect']).toBe('Steel Card');
    expect(card2Abi['set']).toBe('Polychrome');

    const game = result['GAME'] as Record<string, unknown>;
    const curr = game['current_round'] as Record<string, unknown>;
    expect(curr['dollars']).toBe(7);

    const resets = game['round_resets'] as Record<string, unknown>;
    expect(resets['ante']).toBe(3);
    const blind = resets['blind'] as Record<string, unknown>;
    expect(blind['name']).toBe('Big Blind');
    expect(blind['chips']).toBe(450);
  });
});
