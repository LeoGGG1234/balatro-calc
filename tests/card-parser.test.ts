import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseCardNotation, parseCardNotations, resetParserIdCounter,
  getNotationCheatSheet,
} from '../src/engine/card-parser';
import {
  Rank, Suit, CardEnhancement, CardEdition, Seal,
} from '../src/engine/types';

beforeEach(() => {
  resetParserIdCounter();
});

// ─── Basic rank+suit parsing ─────────────────────────────────────

describe('parseCardNotation — basic rank + suit', () => {
  const suits: [string, Suit, string][] = [
    ['s', Suit.Spades, 'Spades'],
    ['h', Suit.Hearts, 'Hearts'],
    ['c', Suit.Clubs, 'Clubs'],
    ['d', Suit.Diamonds, 'Diamonds'],
  ];

  const ranks: [string, Rank, string][] = [
    ['a', Rank.Ace, 'Ace'],
    ['k', Rank.King, 'King'],
    ['q', Rank.Queen, 'Queen'],
    ['j', Rank.Jack, 'Jack'],
    ['10', Rank.Ten, 'Ten'],
    ['9', Rank.Nine, 'Nine'],
    ['8', Rank.Eight, 'Eight'],
    ['7', Rank.Seven, 'Seven'],
    ['6', Rank.Six, 'Six'],
    ['5', Rank.Five, 'Five'],
    ['4', Rank.Four, 'Four'],
    ['3', Rank.Three, 'Three'],
    ['2', Rank.Two, 'Two'],
  ];

  for (const [rCode, rank, rLabel] of ranks) {
    for (const [sCode, suit, sLabel] of suits) {
      const notation = `${rCode}${sCode}`;
      it(`parses "${notation}" → ${rLabel} of ${sLabel}`, () => {
        const card = parseCardNotation(notation);
        expect(card).not.toBeNull();
        expect(card!.rank).toBe(rank);
        expect(card!.suit).toBe(suit);
        expect(card!.enhancement).toBe(CardEnhancement.None);
        expect(card!.edition).toBe(CardEdition.None);
        expect(card!.seal).toBe(Seal.None);
        expect(card!.debuffed).toBe(false);
      });
    }
  }
});

// ─── Case insensitivity ──────────────────────────────────────────

describe('parseCardNotation — case insensitivity', () => {
  it('parses uppercase AH', () => {
    const card = parseCardNotation('AH');
    expect(card!.rank).toBe(Rank.Ace);
    expect(card!.suit).toBe(Suit.Hearts);
  });

  it('parses mixed case Kd', () => {
    const card = parseCardNotation('Kd');
    expect(card!.rank).toBe(Rank.King);
    expect(card!.suit).toBe(Suit.Diamonds);
  });

  it('parses uppercase modifier codes', () => {
    const card = parseCardNotation('ah.G.F.R');
    expect(card!.enhancement).toBe(CardEnhancement.Glass);
    expect(card!.edition).toBe(CardEdition.Foil);
    expect(card!.seal).toBe(Seal.Red);
  });
});

// ─── Modifiers ───────────────────────────────────────────────────

describe('parseCardNotation — modifiers', () => {
  // Enhancement
  it('b → Bonus', () => {
    expect(parseCardNotation('ah.b')!.enhancement).toBe(CardEnhancement.Bonus);
  });
  it('m → Mult', () => {
    expect(parseCardNotation('ah.m')!.enhancement).toBe(CardEnhancement.Mult);
  });
  it('w → Wild', () => {
    expect(parseCardNotation('ah.w')!.enhancement).toBe(CardEnhancement.Wild);
  });
  it('g → Glass', () => {
    expect(parseCardNotation('ah.g')!.enhancement).toBe(CardEnhancement.Glass);
  });
  it('s → Steel', () => {
    expect(parseCardNotation('ah.s')!.enhancement).toBe(CardEnhancement.Steel);
  });
  it('o → Stone', () => {
    expect(parseCardNotation('3s.o')!.enhancement).toBe(CardEnhancement.Stone);
  });
  it('d → Gold', () => {
    expect(parseCardNotation('ah.d')!.enhancement).toBe(CardEnhancement.Gold);
  });
  it('l → Lucky', () => {
    expect(parseCardNotation('ah.l')!.enhancement).toBe(CardEnhancement.Lucky);
  });

  // Edition
  it('f → Foil', () => {
    expect(parseCardNotation('ah..f')!.edition).toBe(CardEdition.Foil);
  });
  it('h → Holographic', () => {
    expect(parseCardNotation('ah..h')!.edition).toBe(CardEdition.Holographic);
  });
  it('p → Polychrome', () => {
    expect(parseCardNotation('ah..p')!.edition).toBe(CardEdition.Polychrome);
  });
  it('n → Negative', () => {
    expect(parseCardNotation('ah..n')!.edition).toBe(CardEdition.Negative);
  });

  // Seal
  it('r → Red', () => {
    expect(parseCardNotation('ah...r')!.seal).toBe(Seal.Red);
  });
  it('b → Blue', () => {
    expect(parseCardNotation('ah...b')!.seal).toBe(Seal.Blue);
  });
  it('g → Gold seal', () => {
    expect(parseCardNotation('ah...g')!.seal).toBe(Seal.Gold);
  });
  it('p → Purple', () => {
    expect(parseCardNotation('ah...p')!.seal).toBe(Seal.Purple);
  });
});

// ─── Combined modifiers ──────────────────────────────────────────

describe('parseCardNotation — combined modifiers', () => {
  it('enhancement + edition: kd.g.f', () => {
    const card = parseCardNotation('kd.g.f');
    expect(card!.rank).toBe(Rank.King);
    expect(card!.suit).toBe(Suit.Diamonds);
    expect(card!.enhancement).toBe(CardEnhancement.Glass);
    expect(card!.edition).toBe(CardEdition.Foil);
    expect(card!.seal).toBe(Seal.None);
  });

  it('enhancement + edition + seal: ah.b.f.r', () => {
    const card = parseCardNotation('ah.b.f.r');
    expect(card!.enhancement).toBe(CardEnhancement.Bonus);
    expect(card!.edition).toBe(CardEdition.Foil);
    expect(card!.seal).toBe(Seal.Red);
  });

  it('skip enhancement, only edition: 10s..p', () => {
    const card = parseCardNotation('10s..p');
    expect(card!.enhancement).toBe(CardEnhancement.None);
    expect(card!.edition).toBe(CardEdition.Polychrome);
    expect(card!.seal).toBe(Seal.None);
  });

  it('skip enhancement + edition, only seal: qc...r', () => {
    const card = parseCardNotation('qc...r');
    expect(card!.enhancement).toBe(CardEnhancement.None);
    expect(card!.edition).toBe(CardEdition.None);
    expect(card!.seal).toBe(Seal.Red);
  });

  it('skip enhancement, edition + seal: jh..p.r', () => {
    const card = parseCardNotation('jh..p.r');
    expect(card!.enhancement).toBe(CardEnhancement.None);
    expect(card!.edition).toBe(CardEdition.Polychrome);
    expect(card!.seal).toBe(Seal.Red);
  });
});

// ─── Stone cards ─────────────────────────────────────────────────

describe('parseCardNotation — stone cards', () => {
  it('stone cards reset rank/suit', () => {
    const card = parseCardNotation('ah.o');
    expect(card!.enhancement).toBe(CardEnhancement.Stone);
    expect(card!.rank).toBe(Rank.Two);
    expect(card!.suit).toBe(Suit.Spades);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────

describe('parseCardNotation — edge cases', () => {
  it('returns null for empty input', () => {
    expect(parseCardNotation('')).toBeNull();
    expect(parseCardNotation('   ')).toBeNull();
  });

  it('returns null for invalid rank', () => {
    expect(parseCardNotation('xh')).toBeNull();
    expect(parseCardNotation('1h')).toBeNull();
  });

  it('returns null for invalid suit', () => {
    expect(parseCardNotation('ax')).toBeNull();
  });

  it('returns null for invalid enhancement code', () => {
    expect(parseCardNotation('ah.x')).toBeNull();
  });

  it('returns null for invalid edition code', () => {
    expect(parseCardNotation('ah..x')).toBeNull();
  });

  it('returns null for invalid seal code', () => {
    expect(parseCardNotation('ah...x')).toBeNull();
  });

  it('handles extra whitespace around notation', () => {
    const card = parseCardNotation('  ah  ');
    expect(card!.rank).toBe(Rank.Ace);
    expect(card!.suit).toBe(Suit.Hearts);
  });

  it('assigns sequential ids', () => {
    const c1 = parseCardNotation('ah');
    const c2 = parseCardNotation('ks');
    expect(c1!.id).toBe('parsed_0');
    expect(c2!.id).toBe('parsed_1');
  });
});

// ─── Batch parsing ───────────────────────────────────────────────

describe('parseCardNotations — batch', () => {
  it('parses space-separated cards', () => {
    const cards = parseCardNotations('ah ks qd');
    expect(cards).toHaveLength(3);
    expect(cards[0].rank).toBe(Rank.Ace);
    expect(cards[1].rank).toBe(Rank.King);
    expect(cards[2].rank).toBe(Rank.Queen);
  });

  it('parses comma-separated cards', () => {
    const cards = parseCardNotations('ah,ks,qd');
    expect(cards).toHaveLength(3);
  });

  it('parses newline-separated cards', () => {
    const cards = parseCardNotations('ah\nks\nqd');
    expect(cards).toHaveLength(3);
  });

  it('expands prefix multiplier: 3*ah', () => {
    const cards = parseCardNotations('3*ah');
    expect(cards).toHaveLength(3);
  });

  it('expands suffix multiplier: ah*3', () => {
    const cards = parseCardNotations('ah*3');
    expect(cards).toHaveLength(3);
  });

  it('expands multiplier with x: 3x ah', () => {
    const cards = parseCardNotations('3x ah');
    expect(cards).toHaveLength(3);
  });

  it('mixed multipliers and plain', () => {
    const cards = parseCardNotations('3*ah ks*2 10d');
    expect(cards).toHaveLength(6);
  });

  it('handles modifiers in batch', () => {
    const cards = parseCardNotations('ah.b ks.d.f qd...r');
    expect(cards).toHaveLength(3);
    expect(cards[0].enhancement).toBe(CardEnhancement.Bonus);
    expect(cards[1].enhancement).toBe(CardEnhancement.Gold);
    expect(cards[2].seal).toBe(Seal.Red);
  });

  it('returns empty when all invalid', () => {
    const cards = parseCardNotations('xx yy zz');
    expect(cards).toHaveLength(0);
  });

  it('skips invalid tokens, keeps valid ones', () => {
    const cards = parseCardNotations('ah xx ks');
    expect(cards).toHaveLength(2);
  });
});

// ─── Cheat Sheet ─────────────────────────────────────────────────

describe('getNotationCheatSheet', () => {
  it('returns all five categories', () => {
    const cs = getNotationCheatSheet();
    expect(cs.ranks.length).toBe(13);
    expect(cs.suits.length).toBe(4);
    expect(cs.enhancements.length).toBe(8);
    expect(cs.editions.length).toBe(4);
    expect(cs.seals.length).toBe(4);
  });
});
