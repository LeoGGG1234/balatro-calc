import type { Card, JokerModifiers } from './types';
import { HandType, Rank, Suit, CardEnhancement, isStone } from './types';
import { RANK_ORDER } from './constants';

// ─── Main Entry: Recognize Hand from Played Cards ──────────────

export function recognizeHand(playedCards: Card[], modifiers?: JokerModifiers): HandType {
  if (playedCards.length === 0) return HandType.HighCard;

  const minCards = modifiers?.fourFingers ? 4 : 5;

  // Separate stone cards — they don't contribute rank/suit but can be "filler"
  const scoringCards = playedCards.filter(c => !isStone(c));
  const stoneCount = playedCards.length - scoringCards.length;

  // Use scoring cards for evaluation; stone cards are just there
  const rankCounts = countRanks(scoringCards);
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const maxRank = counts[0] || 0;
  const secondRank = counts[1] || 0;

  const totalEffectiveCards = scoringCards.length + stoneCount;
  const isFlush = checkFlush(scoringCards, totalEffectiveCards, stoneCount, modifiers);
  const straightResult = checkStraight(scoringCards, stoneCount, modifiers);

  // Five of a Kind & Flush Five (need 5 cards, all same rank)
  if (totalEffectiveCards >= 5 && maxRank >= 5) {
    if (isFlush) return HandType.FlushFive;
    return HandType.FiveOfAKind;
  }

  // Flush House & Full House (3+2 same suit)
  if (totalEffectiveCards >= 5 && maxRank >= 3 && secondRank >= 2) {
    if (isFlush && scoringCards.length >= 5) return HandType.FlushHouse;
    return HandType.FullHouse;
  }

  // Royal Flush & Straight Flush
  if (totalEffectiveCards >= minCards && straightResult !== null && isFlush) {
    if (straightResult === 'royal') return HandType.RoyalFlush;
    return HandType.StraightFlush;
  }

  // Four of a Kind
  if (maxRank >= 4) return HandType.FourOfAKind;

  // Straight
  if (straightResult !== null && totalEffectiveCards >= minCards) return HandType.Straight;

  // Flush
  if (isFlush && totalEffectiveCards >= minCards) return HandType.Flush;

  // Full House (re-check without stone boost)
  if (maxRank >= 3 && secondRank >= 2) return HandType.FullHouse;

  // Three of a Kind
  if (maxRank >= 3) return HandType.ThreeOfAKind;

  // Two Pair
  if (maxRank >= 2 && secondRank >= 2) return HandType.TwoPair;

  // Pair
  if (maxRank >= 2) return HandType.Pair;

  // High Card
  return HandType.HighCard;
}

// ─── Rank Counting ─────────────────────────────────────────────

function countRanks(cards: Card[]): Partial<Record<Rank, number>> {
  const counts: Partial<Record<Rank, number>> = {};
  for (const card of cards) {
    if (isStone(card)) continue;
    counts[card.rank] = (counts[card.rank] ?? 0) + 1;
  }
  return counts;
}

function countSuits(cards: Card[]): Partial<Record<Suit, number>> {
  const counts: Partial<Record<Suit, number>> = {};
  for (const card of cards) {
    if (isStone(card)) continue;
    if (card.enhancement === CardEnhancement.Wild) {
      // Wild cards count for ALL suits
      for (const suit of [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds]) {
        counts[suit] = (counts[suit] ?? 0) + 1;
      }
    } else {
      counts[card.suit] = (counts[card.suit] ?? 0) + 1;
    }
  }
  return counts;
}

// ─── Flush Detection ───────────────────────────────────────────

function checkFlush(
  scoringCards: Card[],
  totalCards: number,
  _stoneCount: number,
  modifiers?: JokerModifiers
): boolean {
  const minCards = modifiers?.fourFingers ? 4 : 5;
  if (totalCards < minCards) return false;

  if (modifiers?.smeared) {
    // Hearts/Diamonds → red group, Spades/Clubs → black group
    let redCount = 0;
    let blackCount = 0;
    for (const card of scoringCards) {
      if (card.enhancement === CardEnhancement.Wild) {
        redCount++;
        blackCount++;
      } else if (card.suit === Suit.Hearts || card.suit === Suit.Diamonds) {
        redCount++;
      } else {
        blackCount++;
      }
    }
    return redCount >= minCards || blackCount >= minCards;
  }

  const suitCounts = countSuits(scoringCards);
  for (const suit of [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds]) {
    if ((suitCounts[suit] || 0) >= minCards) return true;
  }
  return false;
}

// ─── Straight Detection ────────────────────────────────────────

function checkStraight(
  scoringCards: Card[],
  _stoneCount: number,
  modifiers?: JokerModifiers
): 'royal' | 'normal' | null {
  const minCards = modifiers?.fourFingers ? 4 : 5;
  const maxGap = modifiers?.shortcut ? 2 : 1;

  if (scoringCards.length === 0) return null;

  // Get unique ranks sorted in order
  const ranks = [...new Set(scoringCards.map(c => c.rank))];
  const ordered = ranks.map(r => RANK_ORDER[r]).sort((a, b) => a - b);
  if (ordered.length < minCards) return null;

  // Check for Ace-low straight (A-2-3-4-5, or with shortcut e.g. A-3-5-7)
  const hasAce = ranks.includes(Rank.Ace);
  if (hasAce) {
    ordered.push(1); // Ace can be low (value 1)
  }

  const sortedUnique = [...new Set(ordered)].sort((a, b) => a - b);

  // Find longest consecutive run (with optional gap tolerance for Shortcut)
  let maxRun = 1;
  let currentRun = 1;
  let maxRunEnd = sortedUnique[0];

  for (let i = 1; i < sortedUnique.length; i++) {
    const diff = sortedUnique[i] - sortedUnique[i - 1];
    if (diff >= 1 && diff <= maxGap) {
      currentRun++;
    } else if (sortedUnique[i] !== sortedUnique[i - 1]) {
      currentRun = 1;
    }
    if (currentRun > maxRun) {
      maxRun = currentRun;
      maxRunEnd = sortedUnique[i];
    }
  }

  if (maxRun < minCards) return null;

  const highEnd = maxRunEnd;
  if (highEnd >= 14 && maxRun >= minCards) {
    // Check specifically for broadway (10,J,Q,K,A) coverage
    const broadwayRanks = [10, 11, 12, 13, 14];
    const haveRanks = new Set(sortedUnique);
    const missingBroadway = broadwayRanks.filter(r => !haveRanks.has(r)).length;
    if (missingBroadway === 0 && haveRanks.has(14)) return 'royal';
  }

  return 'normal';
}

// ─── Find Best Hand From Card Set (for search) ─────────────────

export interface HandMatch {
  handType: HandType;
  scoringCards: Card[];
  heldCards: Card[];
}

/**
 * Given a hand of cards and a subset to play, determine the hand type
 * and separate played vs held cards.
 */
export function evaluatePlay(
  handCards: Card[],
  playedIndices: number[],
  modifiers?: JokerModifiers
): HandMatch {
  const playedCards = playedIndices.map(i => handCards[i]);
  const heldCards = handCards.filter((_, i) => !playedIndices.includes(i));
  const handType = recognizeHand(playedCards, modifiers);
  return { handType, scoringCards: playedCards, heldCards };
}

