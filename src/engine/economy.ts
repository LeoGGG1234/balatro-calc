import type { JokerInstance, Card, DeckComposition } from './types';
import { Rank, Suit } from './types';

// ─── Interest & Round Earnings ───────────────────────────────────

export function calculateInterest(dollars: number, jokerIds?: string[]): number {
  const cap = jokerIds?.includes('to_the_moon') ? 10 : 5;
  return Math.min(cap, Math.floor(dollars / 5));
}

export function calculateRoundEarnings(
  dollars: number,
  blindBeaten: boolean,
  jokerIds?: string[],
): number {
  if (!blindBeaten) return 0;
  return 3 + calculateInterest(dollars, jokerIds);
}

// ─── Joker Income ────────────────────────────────────────────────

export interface JokerIncomeInput {
  jokers: JokerInstance[];
  deck: DeckComposition;
  discardsUsed: number;
  maxDiscards: number;
  cumulativeDollars: number;
  playedCards: Card[];
  heldCards: Card[];
  roundNumber: number;
  totalCardsDiscarded: number;
}

export function calculateJokerIncome(input: JokerIncomeInput): number {
  let income = 0;

  for (const joker of input.jokers) {
    switch (joker.id) {
      case 'golden':
        income += 4;
        break;
      case 'rocket':
        income += 1 + (input.roundNumber - 1) * 2;
        break;
      case 'delayed_gratification':
        income += 2 * (input.maxDiscards - input.discardsUsed);
        break;
      case 'cloud_9': {
        const nineCount = input.deck.totalByRank?.[Rank.Nine] ?? input.deck.remainingByRank[Rank.Nine] ?? 0;
        income += nineCount;
        break;
      }
      case 'rough_gem': {
        const diamondCount = input.deck.totalBySuit?.[Suit.Diamonds] ?? input.deck.remainingBySuit[Suit.Diamonds] ?? 0;
        income += diamondCount;
        break;
      }
      case 'gift':
        income += input.discardsUsed;
        break;
      case 'reserved_parking': {
        const heldFaceCards = input.heldCards.filter(
          c => c.rank === Rank.Jack || c.rank === Rank.Queen || c.rank === Rank.King,
        ).length;
        income += Math.round(heldFaceCards * 0.5);
        break;
      }
      case 'business': {
        const playedFaceCards = input.playedCards.filter(
          c => c.rank === Rank.Jack || c.rank === Rank.Queen || c.rank === Rank.King,
        ).length;
        income += playedFaceCards * 2;
        break;
      }
      case 'mail':
        income += input.totalCardsDiscarded;
        break;
    }
  }

  return income;
}
