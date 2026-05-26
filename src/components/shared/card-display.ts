import { Suit } from '../../engine/types';

export const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Spades]: '♠',
  [Suit.Hearts]: '♥',
  [Suit.Clubs]: '♣',
  [Suit.Diamonds]: '♦',
};

export const SUIT_COLORS: Record<Suit, string> = {
  [Suit.Spades]: '#94a3b8',
  [Suit.Hearts]: '#f87171',
  [Suit.Clubs]: '#4ade80',
  [Suit.Diamonds]: '#fb923c',
};
