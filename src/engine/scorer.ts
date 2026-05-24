import type {
  Card, GameState, PlayCandidate, ScoringBreakdown, ScoreAccumulator,
  CardScoredContext, JokerEvaluateContext, HeldInHandContext,
  JokerInstance, JokerModifiers,
} from './types';
import {
  isFaceCard, isNumberCard, isStone,
} from './types';
import { getHandBaseChips, getHandBaseMult } from './constants';
import { applyEnhancementHeld, scoreCardTrigger } from './card-effects';
import { getJoker } from './joker-effects';
import { type JokerStateOverrides } from './joker-data';

// ─── Main Scoring Entry ─────────────────────────────────────────

export interface ScoreOptions {
  jokerStateOverrides?: JokerStateOverrides;
  jokerModifiers?: JokerModifiers;
}

export function scorePlay(
  state: GameState,
  candidate: PlayCandidate,
  options: ScoreOptions = {}
): ScoringBreakdown {
  const { playedCards, heldCards, handType, jokerOrder } = candidate;
  const { jokerModifiers } = options;
  const handLevel = state.handLevels[handType] ?? 1;

  const breakdown: ScoringBreakdown = {
    baseHand: {
      handType,
      level: handLevel,
      chips: getHandBaseChips(handType, handLevel),
      mult: getHandBaseMult(handType, handLevel),
    },
    cardScores: [],
    heldInHandMult: 1,
    jokerScores: jokerOrder.map(i => ({
      jokerId: state.jokers[i]?.id ?? 'empty',
      jokerIndex: i,
      chipsAdded: 0,
      plusMult: 0,
      xMult: 1,
    })),
    totalChips: 0,
    totalMult: 0,
    finalScore: 0,
  };

  const acc: ScoreAccumulator = {
    chips: breakdown.baseHand.chips,
    mult: breakdown.baseHand.mult,
  };

  // Resolve joker order for this candidate
  const orderedJokers = jokerOrder.map(i => state.jokers[i]);
  const allFace = jokerModifiers?.allCardsFace ?? false;

  // ─── Phase 1: Played Card Scoring ────────────────────────────
  for (const card of playedCards) {
    if (isStone(card)) continue; // stone cards don't score individually
    if (card.debuffed) continue; // debuffed by boss blind

    const retriggers = countCardRetriggers(card, state, candidate, orderedJokers, allFace);

    for (let t = 0; t < 1 + retriggers; t++) {
      const beforeChips = acc.chips;
      const beforeMult = acc.mult;

      // Card base chips + enhancement + edition
      scoreCardTrigger(card, acc, t > 0);

      // On-scored joker effects (all jokers with onCardScored, in joker order)
      const cardCtx: CardScoredContext = {
        card,
        isFaceCard: allFace || isFaceCard(card.rank),
        isNumberCard: isNumberCard(card.rank),
        handType,
        retriggerIndex: t,
        totalTriggers: 1 + retriggers,
      };

      for (const jokerInst of orderedJokers) {
        const def = getJoker(jokerInst.id);
        if (def?.effect.onCardScored) {
          def.effect.onCardScored(cardCtx, acc);
        }
      }

      breakdown.cardScores.push({
        cardId: card.id,
        triggerIndex: t,
        chipsContribution: acc.chips - beforeChips,
        multContribution: acc.mult - beforeMult,
      });
    }
  }

  // ─── Phase 2: Held-in-Hand Card Enhancement Effects ──────────
  // Steel cards apply x1.5 mult, Gold cards give $3, etc.
  // Mime re-triggers all held card enhancements
  const hasMime = orderedJokers.some(j => getJoker(j.id)?.effect.handlesHeldRetriggers);
  const heldPasses = hasMime ? 2 : 1;

  const multBeforeHeld = acc.mult;
  for (let pass = 0; pass < heldPasses; pass++) {
    for (const card of heldCards) {
      if (isStone(card)) continue;
      if (card.debuffed) continue; // debuffed by boss blind
      applyEnhancementHeld(card, acc);
    }
  }

  breakdown.heldInHandMult = multBeforeHeld > 0 ? acc.mult / multBeforeHeld : 1;

  // ─── Phase 3: Held-in-Hand Joker Effects (Baron, Shoot the Moon) ──
  const heldCtx: HeldInHandContext = {
    handType,
    heldCards,
    playedCards,
    allJokers: orderedJokers,
  };

  for (let pass = 0; pass < heldPasses; pass++) {
    for (const jokerInst of orderedJokers) {
      const def = getJoker(jokerInst.id);
      if (!def) continue;

      // Baron and Shoot the Moon trigger on held cards
      // During joker evaluation phase, but they operate on held cards
      if (def.effect.onHeldInHand && pass === 0) {
        def.effect.onHeldInHand(heldCtx, acc);
      }
      // Mime retriggers held card abilities in held-in-hand context
      if (def.effect.handlesHeldRetriggers && pass === 0) {
        // Mime's effect is the retrigger itself (captured in heldPasses)
      }
    }
  }

  // ─── Phase 4: Joker Evaluation (left to right) ───────────────
  const jokerEvalCtx: JokerEvaluateContext = {
    handType,
    playedCards,
    heldInHandCards: heldCards,
    handLevels: state.handLevels,
    roundState: state.roundState,
    flags: state.flags,
    deckComposition: state.deckComposition,
    blind: state.blind,
    currentScore: acc,
    allJokersWithEditions: orderedJokers,
    currentJokerIndex: 0,
    currentJokerId: '',
    totalJokers: orderedJokers.length,
  };

  for (let jIdx = 0; jIdx < orderedJokers.length; jIdx++) {
    const jokerInst = orderedJokers[jIdx];
    let effectiveJoker = jokerInst;

    // Resolve Blueprint/Brainstorm
    if (jokerInst.id === 'blueprint') {
      const target = resolveBlueprintCopy(orderedJokers, jIdx);
      if (target) effectiveJoker = target;
    } else if (jokerInst.id === 'brainstorm') {
      const target = resolveBrainstormCopy(orderedJokers);
      if (target) effectiveJoker = target;
    }

    const def = getJoker(effectiveJoker.id);
    if (!def) continue;

    const beforeEval = { chips: acc.chips, mult: acc.mult };

    // Apply joker effect (including joker's own edition — foil/holo/poly)
    jokerEvalCtx.currentJokerIndex = jIdx;
    jokerEvalCtx.currentJokerId = effectiveJoker.id;

    // Apply joker's effect
    if (def.effect.onJokerEvaluate) {
      def.effect.onJokerEvaluate(jokerEvalCtx, acc);
    }

    // Apply state-based overrides for state-driven jokers
    // (The joker's onJokerEvaluate may be a no-op; we apply user values here)
    if (options.jokerStateOverrides && def.hasState) {
      const override = options.jokerStateOverrides[jIdx];
      if (override !== undefined) {
        applyStateOverride(def, jokerInst, override, jokerEvalCtx, acc);
      }
    }

    // Joker edition (foil/holo/poly) — applies on top of the joker's effect
    // Note: For Blueprint/Brainstorm, the edition on the COPYING joker applies
    if (jokerInst.edition && jokerInst.edition !== 'none') {
      applyJokerEditionEffect(jokerInst, acc);
    }

    // Track contribution
    const entry = breakdown.jokerScores.find(
      js => js.jokerIndex === jIdx
    );
    if (entry) {
      entry.chipsAdded = acc.chips - beforeEval.chips;
      entry.plusMult = acc.mult - beforeEval.mult;
      // xMult is harder to track precisely, but we approximate
      if (beforeEval.mult > 0 && acc.mult !== beforeEval.mult) {
        entry.xMult = acc.mult / beforeEval.mult;
      }
    }
  }

  // Also apply editions for any jokers that have them but whose effect was already handled
  // (For non-Blueprint/Brainstorm jokers, edition is already handled above)

  // ─── Phase 5: Final Score ────────────────────────────────────
  breakdown.totalChips = acc.chips;
  breakdown.totalMult = acc.mult;
  breakdown.finalScore = acc.chips * acc.mult;

  return breakdown;
}

// ─── Retrigger Counting ────────────────────────────────────────

function countCardRetriggers(
  card: Card,
  state: GameState,
  candidate: PlayCandidate,
  orderedJokers: JokerInstance[],
  allCardsFace: boolean = false
): number {
  let retriggers = 0;

  // Red seal
  if (card.seal === 'red') retriggers += 1;

  // Retrigger jokers
  for (const jokerInst of orderedJokers) {
    const def = getJoker(jokerInst.id);
    if (!def) continue;

    if (def.effect.getRetriggers) {
      retriggers += def.effect.getRetriggers(card, candidate.handType, allCardsFace);
    }

    // Sock and Buskin: handled by getRetriggers
    // Hack: handled by getRetriggers

    // Hanging Chad: retriggers first card 2 extra times
    if (jokerInst.id === 'hanging_chad' && card === candidate.playedCards[0]) {
      retriggers += 2;
    }

    // Dusk: retrigger all on final hand
    if (jokerInst.id === 'dusk' && state.roundState.isFinalHand) {
      retriggers += 1;
    }
  }

  return retriggers;
}

// ─── Blueprint / Brainstorm Resolution ─────────────────────────

function resolveBlueprintCopy(jokers: JokerInstance[], currentIndex: number): JokerInstance | null {
  // Copy the joker immediately to the right
  const targetIdx = currentIndex + 1;
  if (targetIdx >= jokers.length) return null;

  const target = jokers[targetIdx];
  const def = getJoker(target.id);
  if (!def || !def.copyable) return null;

  // If target is itself Blueprint, resolve recursively
  if (target.id === 'blueprint') {
    return resolveBlueprintCopy(jokers, targetIdx);
  }

  return target;
}

function resolveBrainstormCopy(jokers: JokerInstance[]): JokerInstance | null {
  // Copy the leftmost joker
  const leftmost = jokers[0];
  if (!leftmost) return null;

  // Brainstorm can't copy itself
  if (leftmost.id === 'brainstorm') {
    // Find the first non-brainstorm joker to copy
    const firstReal = jokers.find(j => j.id !== 'brainstorm');
    // Actually, Brainstorm copies the LEFTMOST joker. If the leftmost is
    // Brainstorm itself, it won't find anything useful unless there's another.
    // In the game, Brainstorm cannot copy itself.
    return firstReal || null;
  }

  const def = getJoker(leftmost.id);
  if (!def || !def.copyable) return null;

  return leftmost;
}

// ─── State Override Application ────────────────────────────────

function applyStateOverride(
  def: { id: string; category: string },
  _jokerInst: JokerInstance,
  override: number,
  _ctx: JokerEvaluateContext,
  acc: ScoreAccumulator
): void {
  switch (def.id) {
    case 'ride_the_bus':
      acc.mult += override;
      break;
    case 'supernova':
      // override = number of times this hand type played this run
      acc.mult += override;
      break;
    case 'fortune_teller':
      acc.mult += override;
      break;
    case 'green_joker':
      acc.mult += override;
      break;
    case 'popcorn':
      acc.mult += override;
      break;
    case 'ceremonial_dagger':
      acc.mult += override;
      break;
    case 'faceless':
      acc.mult += override;
      break;
    case 'hologram':
      acc.mult *= override;
      break;
    case 'constellation':
      acc.mult *= override;
      break;
    case 'campfire':
      acc.mult *= override;
      break;
    case 'canio':
      acc.mult *= override;
      break;
    case 'yorick':
      acc.mult *= override;
      break;
    case 'steel_joker':
      acc.mult *= (1 + override * 0.2);
      break;
    case 'drivers_license':
      if (override >= 16) acc.mult *= 3;
      break;
    case 'joker_stencil':
      acc.mult *= override; // override = number of empty slots
      break;
    case 'ice_cream':
      acc.chips += override;
      break;
    case 'square':
      acc.chips += override;
      break;
    case 'runner':
      acc.chips += override;
      break;
    case 'red_card':
      acc.mult += override;
      break;
    case 'swashbuckler':
      acc.mult += override;
      break;
    case 'stone':
      acc.chips += 25 * override;
      break;
    case 'hiker':
      acc.chips += 5 * override;
      break;
    case 'flash':
      acc.mult += override;
      break;
    case 'trousers':
      acc.mult += override;
      break;
    case 'castle':
      acc.chips += override;
      break;
    case 'lucky_cat':
      acc.mult *= override;
      break;
    case 'glass':
      acc.mult *= override;
      break;
    case 'wee':
      acc.chips += override;
      break;
    case 'throwback':
      acc.mult *= override;
      break;
    case 'hit_the_road':
      acc.mult *= override;
      break;
    case 'obelisk':
      acc.mult *= override;
      break;
    case 'ancient':
      acc.mult *= override;
      break;
    case 'loyalty_card':
      acc.mult *= override;
      break;
    case 'madness':
      acc.mult *= override;
      break;
    case 'idol':
      acc.mult *= override;
      break;
  }
}

function applyJokerEditionEffect(jokerInst: JokerInstance, acc: ScoreAccumulator): void {
  switch (jokerInst.edition) {
    case 'foil':
      acc.chips += 50;
      break;
    case 'holo':
      acc.mult += 10;
      break;
    case 'poly':
      acc.mult *= 1.5;
      break;
  }
}

// ─── Baseball Card Handling ────────────────────────────────────

export function computeBaseballCardMult(orderedJokers: JokerInstance[]): number {
  let uncommons = 0;
  for (const j of orderedJokers) {
    const def = getJoker(j.id);
    if (def && def.rarity === 'uncommon') uncommons++;
  }
  return Math.pow(1.5, uncommons);
}

// ─── Re-export ─────────────────────────────────────────────────
export { getHandBaseChips, getHandBaseMult } from './constants';
