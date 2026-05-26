import { describe, it, expect } from 'vitest';
import { decompressBalatroSave, SaveDecodeError } from '../src/engine/save-decoder';
import { parseLuaTableToJSON, LuaParser, LuaParseError } from '../src/engine/lua-parser';
import { SaveParseError } from '../src/engine/save-parser';

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Compress a text string into a deflate ArrayBuffer, mirroring what
 * Balatro does when writing .jkr save files.
 */
async function compressText(text: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const blob = new Blob([encoder.encode(text)]);
  const cs = new CompressionStream('deflate');
  const compressedStream = blob.stream().pipeThrough(cs);
  return new Response(compressedStream).arrayBuffer();
}

// ─── Stub: Realistic Balatro save Lua snapshot ────────────────────

/**
 * A realistic Balatro decompressed save text snapshot.
 * Used as the golden master for parser correctness verification.
 */
const BALATRO_SAVE_STUB = `return {
["STATE"]=3,
["cardAreas"]={
  ["deck"]={
    ["cards"]={
      [1]={["base"]={["suit"]="Hearts",["value"]="Ace"},["ability"]={["effect"]="Bonus",["set"]="Foil"},["seal"]="Red"},
      [2]={["base"]={["suit"]="Spades",["value"]="King"},["ability"]={["effect"]="Steel Card",["set"]="Polychrome"}},
      [3]={["base"]={["suit"]="Diamonds",["value"]="7"},["ability"]={["effect"]="Base",["set"]="Default"}},
      [4]={["base"]={["suit"]="Clubs",["value"]="10"},["ability"]={["effect"]="Lucky Card",["set"]="Holographic"},["seal"]="Blue"},
      [5]={["base"]={["suit"]="Hearts",["value"]="Queen"},["ability"]={["effect"]="Glass Card",["set"]="Negative"},["seal"]="Gold"},
      [6]={["base"]={["suit"]="Spades",["value"]="2"},["ability"]={["effect"]="Base",["set"]="Default"}}
    }
  },
  ["jokers"]={
    ["cards"]={
      [1]={["ability"]={["name"]="Joker",["set"]="Default",["extra_value"]=0}},
      [2]={["ability"]={["name"]="Blueprint",["set"]="Foil"}},
      [3]={["ability"]={["name"]="Scary Joker",["set"]="Polychrome",["extra_value"]=15}},
      [4]={["ability"]={["name"]="Hack",["set"]="Default"}},
      [5]={["ability"]={["name"]="Brainstorm",["set"]="Negative"}}
    }
  },
  ["hand"]={
    ["cards"]={
      [1]={["base"]={["suit"]="Hearts",["value"]="Ace"},["ability"]={["effect"]="Bonus",["set"]="Foil"},["seal"]="Red",["facing"]="front",["debuff"]=false},
      [2]={["base"]={["suit"]="Spades",["value"]="King"},["ability"]={["effect"]="Steel Card",["set"]="Polychrome"},["facing"]="front"}
    }
  }
},
["GAME"]={
  ["current_round"]={
    ["dollars"]=7,
    ["hands_played"]=2,
    ["discards_used"]=1,
    ["hands_left"]=2,
    ["discards_left"]=3,
    ["hand_size"]=8
  },
  ["round_resets"]={
    ["ante"]=4,
    ["blind"]={
      ["name"]="The Water",
      ["key"]="bl_water",
      ["chips"]=2400
    },
    ["blind_states"]={
      ["Small"]="Defeated",
      ["Big"]="Defeated",
      ["Boss"]="Upcoming"
    }
  },
  ["pseudorandom"]={
    ["seed"]="ALPHA123"
  }
}
}`;

// ═══════════════════════════════════════════════════════════════════
//  save-decoder.ts — Decompression Tests
// ═══════════════════════════════════════════════════════════════════

describe('save-decoder — decompressBalatroSave', () => {
  it('decompresses a valid deflate-compressed Balatro save buffer', async () => {
    const originalText = 'return {["key"]="value",["num"]=42}';
    const compressed = await compressText(originalText);
    const result = await decompressBalatroSave(compressed);
    expect(result).toBe(originalText);
  });

  it('decompresses the full Balatro save stub round-trip', async () => {
    const compressed = await compressText(BALATRO_SAVE_STUB);
    const result = await decompressBalatroSave(compressed);
    expect(result).toBe(BALATRO_SAVE_STUB);
  });

  it('decompresses an empty table save text', async () => {
    const text = 'return {}';
    const compressed = await compressText(text);
    const result = await decompressBalatroSave(compressed);
    expect(result).toBe(text);
  });

  it('throws INVALID_SAVE_STREAM on empty buffer', async () => {
    const empty = new ArrayBuffer(0);
    await expect(decompressBalatroSave(empty)).rejects.toThrow(SaveDecodeError);
    await expect(decompressBalatroSave(empty)).rejects.toThrow('INVALID_SAVE_STREAM');
    await expect(decompressBalatroSave(empty)).rejects.toThrow('Input buffer is empty');
  });

  it('throws INVALID_SAVE_STREAM on corrupted / random bytes', async () => {
    // Generate random non-deflate bytes
    const corrupted = new Uint8Array(64);
    for (let i = 0; i < corrupted.length; i++) {
      corrupted[i] = Math.floor(Math.random() * 256);
    }
    await expect(decompressBalatroSave(corrupted.buffer)).rejects.toThrow(SaveDecodeError);
    await expect(decompressBalatroSave(corrupted.buffer)).rejects.toThrow('INVALID_SAVE_STREAM');
  });

  it('throws INVALID_SAVE_STREAM on truncated deflate stream', async () => {
    // Compress then truncate the buffer
    const text = 'return {["data"]="important"}';
    const compressed = await compressText(text);
    const truncated = compressed.slice(0, compressed.byteLength - 4);
    await expect(decompressBalatroSave(truncated)).rejects.toThrow(SaveDecodeError);
  });

  it('SaveDecodeError is an instance of Error', () => {
    const err = new SaveDecodeError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('SaveDecodeError');
    expect(err.message).toBe('test');
  });

  it('SaveDecodeError preserves cause chain', () => {
    const cause = new Error('root cause');
    const err = new SaveDecodeError('outer error', cause);
    expect(err.cause).toBe(cause);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  lua-parser.ts — parseLuaTableToJSON convenience API
// ═══════════════════════════════════════════════════════════════════

describe('lua-parser — parseLuaTableToJSON', () => {
  it('parses a simple key-value table', () => {
    const result = parseLuaTableToJSON('return {["name"]="Balatro",["version"]=1}');
    expect(result).toEqual({ name: 'Balatro', version: 1 });
  });

  it('returns an empty object for empty table', () => {
    const result = parseLuaTableToJSON('return {}');
    expect(result).toEqual({});
  });

  it('parses nested tables', () => {
    const result = parseLuaTableToJSON(
      'return {["config"]={["hands"]=4,["discards"]=3},["tags"]={}}',
    ) as Record<string, unknown>;
    expect((result['config'] as Record<string, unknown>)['hands']).toBe(4);
    expect((result['config'] as Record<string, unknown>)['discards']).toBe(3);
    expect(Object.keys(result['tags'] as Record<string, unknown>)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  lua-parser — Core Parser (Value Types)
// ═══════════════════════════════════════════════════════════════════

describe('lua-parser — Value types', () => {
  it('parses string values', () => {
    const parser = new LuaParser('return {["a"]="hello",["b"]="world"}');
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result['a']).toBe('hello');
    expect(result['b']).toBe('world');
    expect(typeof result['a']).toBe('string');
  });

  it('parses integer numbers', () => {
    const parser = new LuaParser('return {["x"]=42,["y"]=0,["z"]=999}');
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result['x']).toBe(42);
    expect(result['y']).toBe(0);
    expect(result['z']).toBe(999);
  });

  it('parses negative numbers', () => {
    const parser = new LuaParser('return {["a"]=-5,["b"]=-100}');
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result['a']).toBe(-5);
    expect(result['b']).toBe(-100);
  });

  it('parses floating point numbers', () => {
    const parser = new LuaParser('return {["pi"]=3.14,["e"]=2.718}');
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result['pi']).toBe(3.14);
    expect(result['e']).toBe(2.718);
  });

  it('parses boolean true and false', () => {
    const parser = new LuaParser('return {["a"]=true,["b"]=false}');
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result['a']).toBe(true);
    expect(result['b']).toBe(false);
    expect(typeof result['a']).toBe('boolean');
    expect(typeof result['b']).toBe('boolean');
  });

  it('parses nil as null', () => {
    const parser = new LuaParser('return {["a"]=nil}');
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result['a']).toBeNull();
  });

  it('treats string "true"/"false" as string, not boolean', () => {
    const parser = new LuaParser('return {["a"]="true",["b"]="false"}');
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result['a']).toBe('true');
    expect(result['b']).toBe('false');
    expect(typeof result['a']).toBe('string');
  });

  it('parses escaped characters in strings', () => {
    const parser = new LuaParser('return {["msg"]="hello\\nworld\\t!",["path"]="C:\\\\Users"}');
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result['msg']).toBe('hello\nworld\t!');
    expect(result['path']).toBe('C:\\Users');
  });

  it('handles single-quoted strings', () => {
    const parser = new LuaParser("return {['key']='single quoted'}");
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result['key']).toBe('single quoted');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  lua-parser — Table Structures
// ═══════════════════════════════════════════════════════════════════

describe('lua-parser — Table structures', () => {
  it('parses bracket string keys: ["key"] = value', () => {
    const parser = new LuaParser('return {["suit"]="Hearts",["value"]="Ace"}');
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result['suit']).toBe('Hearts');
    expect(result['value']).toBe('Ace');
  });

  it('parses numeric bracket keys: [1] = value', () => {
    const parser = new LuaParser('return {[1]="first",[2]="second",[3]=42}');
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result[1]).toBe('first');
    expect(result[2]).toBe('second');
    expect(result[3]).toBe(42);
  });

  it('parses implicit array indices (no explicit key)', () => {
    const parser = new LuaParser('return {"alpha","beta","gamma"}');
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result[1]).toBe('alpha');
    expect(result[2]).toBe('beta');
    expect(result[3]).toBe('gamma');
  });

  it('parses bareword identifier keys', () => {
    const parser = new LuaParser('return {name="Balatro",hands=4}');
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result['name']).toBe('Balatro');
    expect(result['hands']).toBe(4);
  });

  it('parses deeply nested tables', () => {
    const parser = new LuaParser(
      'return {["a"]={["b"]={["c"]={["d"]="deep"}}}}',
    );
    const result = parser.parseRoot() as Record<string, unknown>;
    const a = result['a'] as Record<string, unknown>;
    const b = a['b'] as Record<string, unknown>;
    const c = b['c'] as Record<string, unknown>;
    expect(c['d']).toBe('deep');
  });

  it('allows trailing comma before closing brace', () => {
    const parser = new LuaParser('return {["a"]=1,["b"]=2,}');
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result['a']).toBe(1);
    expect(result['b']).toBe(2);
    expect(Object.keys(result)).toHaveLength(2);
  });

  it('ignores whitespace, newlines, and tabs gracefully', () => {
    const input = `return {
      ["x"]  =  100,
      [ "y" ] = 200
    }`;
    const parser = new LuaParser(input);
    const result = parser.parseRoot() as Record<string, unknown>;
    expect(result['x']).toBe(100);
    expect(result['y']).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  lua-parser — Error Handling
// ═══════════════════════════════════════════════════════════════════

describe('lua-parser — Error handling', () => {
  it('throws LuaParseError when input does not start with "return"', () => {
    expect(() => new LuaParser('not lua').parseRoot()).toThrow(LuaParseError);
    expect(() => new LuaParser('not lua').parseRoot()).toThrow("Expected 'return'");
  });

  it('throws LuaParseError for empty input', () => {
    expect(() => new LuaParser('').parseRoot()).toThrow(LuaParseError);
  });

  it('throws LuaParseError for unclosed table', () => {
    expect(() => new LuaParser('return {unclosed').parseRoot()).toThrow(LuaParseError);
    expect(() => new LuaParser('return {unclosed').parseRoot()).toThrow('Unterminated table');
  });

  it('throws LuaParseError for truncated nested table', () => {
    expect(() =>
      new LuaParser('return {["outer"]={["inner"]=42').parseRoot(),
    ).toThrow(LuaParseError);
  });

  it('throws LuaParseError on unexpected token in value position', () => {
    expect(() => new LuaParser('return {[').parseRoot()).toThrow(LuaParseError);
  });

  it('throws LuaParseError on malformed bracket key', () => {
    expect(() => new LuaParser('return {[=]}').parseRoot()).toThrow(LuaParseError);
  });

  it('LuaParseError is an instance of Error', () => {
    const err = new LuaParseError('test message');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('LuaParseError');
    expect(err.message).toBe('test message');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  lua-parser — Balatro Save Stub (Golden Master)
// ═══════════════════════════════════════════════════════════════════

describe('lua-parser — Balatro save stub (golden master)', () => {
  it('parses the full Balatro save stub into correct JS object', () => {
    const result = new LuaParser(BALATRO_SAVE_STUB).parseRoot() as Record<string, unknown>;

    // Top-level keys
    expect(result['STATE']).toBe(3);

    // cardAreas → deck → cards
    const cardAreas = result['cardAreas'] as Record<string, unknown>;
    const deck = cardAreas['deck'] as Record<string, unknown>;
    const deckCards = deck['cards'] as Record<string, unknown>;

    // Card 1: Ace of Hearts, Bonus + Foil + Red seal
    const card1 = deckCards[1] as Record<string, unknown>;
    const card1Base = card1['base'] as Record<string, unknown>;
    expect(card1Base['suit']).toBe('Hearts');
    expect(card1Base['value']).toBe('Ace');
    const card1Abi = card1['ability'] as Record<string, unknown>;
    expect(card1Abi['effect']).toBe('Bonus');
    expect(card1Abi['set']).toBe('Foil');
    expect(card1['seal']).toBe('Red');

    // Card 2: King of Spades, Steel + Polychrome (no seal)
    const card2 = deckCards[2] as Record<string, unknown>;
    const card2Base = card2['base'] as Record<string, unknown>;
    expect(card2Base['suit']).toBe('Spades');
    expect(card2Base['value']).toBe('King');
    const card2Abi = card2['ability'] as Record<string, unknown>;
    expect(card2Abi['effect']).toBe('Steel Card');
    expect(card2Abi['set']).toBe('Polychrome');

    // Card 3: 7 of Diamonds, no modifiers
    const card3 = deckCards[3] as Record<string, unknown>;
    const card3Base = card3['base'] as Record<string, unknown>;
    expect(card3Base['suit']).toBe('Diamonds');
    expect(card3Base['value']).toBe('7');

    // Card 4: 10 of Clubs, Lucky + Holo + Blue seal
    const card4 = deckCards[4] as Record<string, unknown>;
    const card4Abi = card4['ability'] as Record<string, unknown>;
    expect(card4Abi['effect']).toBe('Lucky Card');
    expect(card4Abi['set']).toBe('Holographic');
    expect(card4['seal']).toBe('Blue');

    // Card 5: Queen of Hearts, Glass + Negative + Gold seal
    const card5 = deckCards[5] as Record<string, unknown>;
    const card5Abi = card5['ability'] as Record<string, unknown>;
    expect(card5Abi['effect']).toBe('Glass Card');
    expect(card5Abi['set']).toBe('Negative');
    expect(card5['seal']).toBe('Gold');

    // Card 6: 2 of Spades, no modifiers
    const card6 = deckCards[6] as Record<string, unknown>;
    const card6Base = card6['base'] as Record<string, unknown>;
    expect(card6Base['value']).toBe('2');
    expect(card6Base['suit']).toBe('Spades');

    // Total card count
    expect(Object.keys(deckCards)).toHaveLength(6);
  });

  it('preserves all joker fields without loss or type shift', () => {
    const result = new LuaParser(BALATRO_SAVE_STUB).parseRoot() as Record<string, unknown>;
    const cardAreas = result['cardAreas'] as Record<string, unknown>;
    const jokers = cardAreas['jokers'] as Record<string, unknown>;
    const jokerCards = jokers['cards'] as Record<string, unknown>;

    expect(Object.keys(jokerCards)).toHaveLength(5);

    // Joker 1: base Joker with extra_value = 0
    const j1 = jokerCards[1] as Record<string, unknown>;
    const j1Abi = j1['ability'] as Record<string, unknown>;
    expect(j1Abi['name']).toBe('Joker');
    expect(j1Abi['set']).toBe('Default');
    expect(j1Abi['extra_value']).toBe(0);

    // Joker 2: Blueprint + Foil
    const j2 = jokerCards[2] as Record<string, unknown>;
    const j2Abi = j2['ability'] as Record<string, unknown>;
    expect(j2Abi['name']).toBe('Blueprint');
    expect(j2Abi['set']).toBe('Foil');

    // Joker 3: Scary Joker + Polychrome + extra_value 15
    const j3 = jokerCards[3] as Record<string, unknown>;
    const j3Abi = j3['ability'] as Record<string, unknown>;
    expect(j3Abi['name']).toBe('Scary Joker');
    expect(j3Abi['set']).toBe('Polychrome');
    expect(j3Abi['extra_value']).toBe(15);

    // Joker 4: Hack
    const j4 = jokerCards[4] as Record<string, unknown>;
    const j4Abi = j4['ability'] as Record<string, unknown>;
    expect(j4Abi['name']).toBe('Hack');
    expect(j4Abi['set']).toBe('Default');

    // Joker 5: Brainstorm + Negative
    const j5 = jokerCards[5] as Record<string, unknown>;
    const j5Abi = j5['ability'] as Record<string, unknown>;
    expect(j5Abi['name']).toBe('Brainstorm');
    expect(j5Abi['set']).toBe('Negative');
  });

  it('preserves GAME state fields with correct types', () => {
    const result = new LuaParser(BALATRO_SAVE_STUB).parseRoot() as Record<string, unknown>;
    const game = result['GAME'] as Record<string, unknown>;
    const curr = game['current_round'] as Record<string, unknown>;
    const resets = game['round_resets'] as Record<string, unknown>;

    // current_round
    expect(curr['dollars']).toBe(7);
    expect(typeof curr['dollars']).toBe('number');
    expect(curr['hands_played']).toBe(2);
    expect(curr['discards_used']).toBe(1);
    expect(curr['hands_left']).toBe(2);
    expect(curr['discards_left']).toBe(3);
    expect(curr['hand_size']).toBe(8);

    // round_resets
    expect(resets['ante']).toBe(4);
    const blind = resets['blind'] as Record<string, unknown>;
    expect(blind['name']).toBe('The Water');
    expect(blind['key']).toBe('bl_water');
    expect(blind['chips']).toBe(2400);

    // blind_states
    const blindStates = resets['blind_states'] as Record<string, unknown>;
    expect(blindStates['Small']).toBe('Defeated');
    expect(blindStates['Big']).toBe('Defeated');
    expect(blindStates['Boss']).toBe('Upcoming');

    // pseudorandom seed
    const pseudorandom = game['pseudorandom'] as Record<string, unknown>;
    expect(pseudorandom['seed']).toBe('ALPHA123');
  });

  it('preserves hand card fields including facing and debuff status', () => {
    const result = new LuaParser(BALATRO_SAVE_STUB).parseRoot() as Record<string, unknown>;
    const cardAreas = result['cardAreas'] as Record<string, unknown>;
    const hand = cardAreas['hand'] as Record<string, unknown>;
    const handCards = hand['cards'] as Record<string, unknown>;

    expect(Object.keys(handCards)).toHaveLength(2);

    // Hand card 1: full modifier set
    const hc1 = handCards[1] as Record<string, unknown>;
    expect(hc1['facing']).toBe('front');
    expect(hc1['debuff']).toBe(false);
    const hc1Base = hc1['base'] as Record<string, unknown>;
    expect(hc1Base['suit']).toBe('Hearts');
    expect(hc1Base['value']).toBe('Ace');

    // Hand card 2: minimal fields
    const hc2 = handCards[2] as Record<string, unknown>;
    const hc2Base = hc2['base'] as Record<string, unknown>;
    expect(hc2Base['suit']).toBe('Spades');
    expect(hc2Base['value']).toBe('King');
    expect(hc2['facing']).toBe('front');
  });

  it('parseLuaTableToJSON convenience function returns same result', () => {
    const viaFn = parseLuaTableToJSON(BALATRO_SAVE_STUB) as Record<string, unknown>;
    const viaParser = new LuaParser(BALATRO_SAVE_STUB).parseRoot() as Record<string, unknown>;
    expect(viaFn).toEqual(viaParser);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  lua-parser — Nested card array field integrity
// ═══════════════════════════════════════════════════════════════════

describe('lua-parser — Nested card array field integrity', () => {
  it('no field loss: all card fields survive round-trip', () => {
    // Dynamically generate a save stub and parse it back
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
    const values = ['Ace', 'King', 'Queen', 'Jack', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    const effects = ['Base', 'Bonus', 'Mult', 'Wild Card', 'Glass Card', 'Steel Card', 'Gold Card', 'Lucky Card'];
    const sets = ['Default', 'Foil', 'Holographic', 'Polychrome', 'Negative'];
    const seals = ['Red', 'Blue', 'Gold', 'Purple'];

    // Build a Lua table with 20 cards
    const cardLines: string[] = [];
    for (let i = 0; i < 20; i++) {
      const suit = suits[i % suits.length];
      const value = values[i % values.length];
      const effect = effects[i % effects.length];
      const set = sets[i % sets.length];
      const seal = seals[i % seals.length];
      cardLines.push(
        `[${i + 1}]={["base"]={["suit"]="${suit}",["value"]="${value}"},["ability"]={["effect"]="${effect}",["set"]="${set}"},["seal"]="${seal}"}`,
      );
    }

    const luaText = `return {["cards"]={${cardLines.join(',')}}}`;
    const result = new LuaParser(luaText).parseRoot() as Record<string, unknown>;
    const cards = result['cards'] as Record<string, unknown>;

    expect(Object.keys(cards)).toHaveLength(20);

    // Spot-check every card's fields
    for (let i = 0; i < 20; i++) {
      const card = cards[i + 1] as Record<string, unknown>;
      expect(card, `Card ${i + 1} should exist`).toBeDefined();

      const base = card['base'] as Record<string, unknown>;
      expect(base['suit'], `Card ${i + 1} suit`).toBe(suits[i % suits.length]);
      expect(base['value'], `Card ${i + 1} value`).toBe(values[i % values.length]);

      const ability = card['ability'] as Record<string, unknown>;
      expect(ability['effect'], `Card ${i + 1} effect`).toBe(effects[i % effects.length]);
      expect(ability['set'], `Card ${i + 1} edition`).toBe(sets[i % sets.length]);

      expect(card['seal'], `Card ${i + 1} seal`).toBe(seals[i % seals.length]);
    }
  });

  it('no type shift: numbers stay numbers, strings stay strings', () => {
    const luaText = `return {
      ["strField"]="42",
      ["numField"]=42,
      ["boolField"]=true,
      ["floatField"]=3.14,
      ["negField"]=-10,
      ["nilField"]=nil,
      ["nested"]={["inner"]=99}
    }`;
    const result = new LuaParser(luaText).parseRoot() as Record<string, unknown>;

    expect(typeof result['strField']).toBe('string');
    expect(typeof result['numField']).toBe('number');
    expect(typeof result['boolField']).toBe('boolean');
    expect(typeof result['floatField']).toBe('number');
    expect(typeof result['negField']).toBe('number');
    expect(result['nilField']).toBeNull();
    const nested = result['nested'] as Record<string, unknown>;
    expect(typeof nested['inner']).toBe('number');
    expect(nested['inner']).toBe(99);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Integration: save-decoder + lua-parser + save-parser
// ═══════════════════════════════════════════════════════════════════

describe('Integration — decompress + parse pipeline', () => {
  it('full round-trip: compress → decompress → parse → object', async () => {
    const luaText = `return {
      ["version"]="1.0",
      ["deck"]={[1]={["suit"]="Hearts",["rank"]="Ace"},[2]={["suit"]="Spades",["rank"]="King"}},
      ["round"]=3
    }`;

    // Step 1: Simulate saving (compress)
    const compressed = await compressText(luaText);

    // Step 2: Decompress (save-decoder)
    const decompressed = await decompressBalatroSave(compressed);
    expect(decompressed).toBe(luaText);

    // Step 3: Parse (lua-parser)
    const parsed = parseLuaTableToJSON(decompressed) as Record<string, unknown>;
    expect(parsed['version']).toBe('1.0');
    expect(parsed['round']).toBe(3);
    const deck = parsed['deck'] as Record<string, unknown>;
    const card1 = deck[1] as Record<string, unknown>;
    expect(card1['suit']).toBe('Hearts');
    expect(card1['rank']).toBe('Ace');
    const card2 = deck[2] as Record<string, unknown>;
    expect(card2['suit']).toBe('Spades');
    expect(card2['rank']).toBe('King');
  });

  it('SaveParseError wraps SaveDecodeError for corrupted data', async () => {
    const corrupted = new Uint8Array(32);
    for (let i = 0; i < corrupted.length; i++) corrupted[i] = Math.floor(Math.random() * 256);

    // Import parseBalatroSave dynamically to avoid top-level side effects
    const { parseBalatroSave } = await import('../src/engine/save-parser');
    await expect(parseBalatroSave(corrupted.buffer)).rejects.toThrow(SaveParseError);
  });

  it('SaveParseError wraps LuaParseError for invalid Lua', async () => {
    const badLua = 'not a save file content';
    const compressed = await compressText(badLua);
    const { parseBalatroSave } = await import('../src/engine/save-parser');
    await expect(parseBalatroSave(compressed)).rejects.toThrow(SaveParseError);
  });
});
