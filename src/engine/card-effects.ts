import type { Card, ScoreAccumulator } from './types';
import { CardEnhancement, CardEdition, Seal, rankToChips, isStone } from './types';

// ─── Card Base Chips ───────────────────────────────────────────

export function getCardBaseChips(card: Card): number {
  if (isStone(card)) return 50; // Stone cards give flat 50 chips
  return rankToChips(card.rank);
}

// ─── Enhancement Effects (on scored) ────────────────────────────

export function applyEnhancementOnScored(
  card: Card,
  acc: ScoreAccumulator,
  _isRetrigger: boolean
): void {
  switch (card.enhancement) {
    case CardEnhancement.Bonus:
      acc.chips += 30;
      break;
    case CardEnhancement.Mult:
      acc.mult += 4;
      break;
    case CardEnhancement.Glass:
      acc.mult *= 2;
      break;
    case CardEnhancement.Lucky:
      // For optimal calculation, assume lucky triggers (best case)
      acc.mult += 20;
      break;
    case CardEnhancement.Stone:
      // Stone already gives 50 chips via getCardBaseChips
      break;
    default:
      break;
  }
}

// ─── Enhancement Effects (held in hand) ─────────────────────────

export function applyEnhancementHeld(
  card: Card,
  acc: ScoreAccumulator
): void {
  switch (card.enhancement) {
    case CardEnhancement.Steel:
      acc.mult *= 1.5;
      break;
    default:
      break;
  }
}

// ─── Edition Effects (on joker) ─────────────────────────────────

export function applyJokerEdition(
  edition: CardEdition,
  acc: ScoreAccumulator,
  _jokerId: string
): void {
  switch (edition) {
    case CardEdition.Foil:
      acc.chips += 50;
      break;
    case CardEdition.Holographic:
      acc.mult += 10;
      break;
    case CardEdition.Polychrome:
      acc.mult *= 1.5;
      break;
    default:
      break;
  }
}

// ─── Seal Effects ──────────────────────────────────────────────

export function getSealRetriggers(seal: Seal): number {
  return seal === Seal.Red ? 1 : 0;
}

// ─── Card Scoring (all effects for one trigger) ────────────────

export function scoreCardTrigger(
  card: Card,
  acc: ScoreAccumulator,
  isRetrigger: boolean
): void {
  // Base chips from rank (or stone)
  acc.chips += getCardBaseChips(card);

  // Enhancement
  applyEnhancementOnScored(card, acc, isRetrigger);

  // Card edition (applies to jokers, but cards with Poly/etc. are from mods; Balatro base game cards don't have editions)
  // In vanilla, editions only apply to jokers. Skipping card editions.
}

// ─── Held-in-hand Scoring ──────────────────────────────────────

export function scoreHeldCard(card: Card, acc: ScoreAccumulator): void {
  // Only Steel cards (and Gold for $, which doesn't affect score) have held effects
  applyEnhancementHeld(card, acc);

  // Baron joker is handled separately as a joker effect, because it requires joker presence.
  // Steel enhancement is an inherent card property.
}
