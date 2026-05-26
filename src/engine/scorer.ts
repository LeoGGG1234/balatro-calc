import type {
  Card, GameState, PlayCandidate, ScoringBreakdown, ScoreAccumulator,
  CardScoredContext, JokerEvaluateContext, HeldInHandContext,
  JokerInstance, JokerModifiers,
} from './types';
import {
  isFaceCard, isNumberCard, isStone, CardEdition, Seal,
} from './types';
import { getHandBaseChips, getHandBaseMult } from './constants';
import { applyEnhancementHeld, scoreCardTrigger, applyJokerEdition } from './card-effects';
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

  // Pre-resolve joker definitions for the scoring hot path
  const jokerDefs = new Map(state.jokers.map(j => [j.id, getJoker(j.id)] as const));
  const getDef = (id: string) => jokerDefs.get(id);

  // ─── Phase 1: Played Card Scoring ────────────────────────────
  for (const card of playedCards) {
    if (isStone(card)) {
      // Stone cards give flat 50 chips per trigger but don't trigger on-scored joker effects
      const stoneRetriggers = countCardRetriggers(card, state, candidate, orderedJokers, allFace, getDef);
      for (let t = 0; t < 1 + stoneRetriggers; t++) {
        acc.chips += 50;
        breakdown.cardScores.push({
          cardId: card.id,
          triggerIndex: t,
          chipsContribution: 50,
          multContribution: 0,
        });
      }
      continue;
    }
    if (card.debuffed) continue; // debuffed by boss blind

    const retriggers = countCardRetriggers(card, state, candidate, orderedJokers, allFace, getDef);

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
        const def = getDef(jokerInst.id);
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
  const hasMime = orderedJokers.some(j => getDef(j.id)?.effect.handlesHeldRetriggers);
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
      const def = getDef(jokerInst.id);
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
      const target = resolveBlueprintCopy(orderedJokers, jIdx, getDef);
      if (target) effectiveJoker = target;
    } else if (jokerInst.id === 'brainstorm') {
      const target = resolveBrainstormCopy(orderedJokers, getDef);
      if (target) effectiveJoker = target;
    }

    const def = getDef(effectiveJoker.id);
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
    if (jokerInst.edition && jokerInst.edition !== CardEdition.None) {
      applyJokerEdition(jokerInst.edition, acc, jokerInst.id);
    }

    // Track contribution (jokerScores is parallel to orderedJokers)
    const entry = breakdown.jokerScores[jIdx];
    if (entry) {
      entry.chipsAdded = acc.chips - beforeEval.chips;
      entry.plusMult = acc.mult - beforeEval.mult;
      // xMult is harder to track precisely, but we approximate
      if (beforeEval.mult > 0 && acc.mult !== beforeEval.mult) {
        entry.xMult = acc.mult / beforeEval.mult;
      }
    }
  }

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
  allCardsFace: boolean = false,
  getDef: (id: string) => ReturnType<typeof getJoker>,
): number {
  let retriggers = 0;

  // Red seal
  if (card.seal === Seal.Red) retriggers += 1;

  // Retrigger jokers
  for (const jokerInst of orderedJokers) {
    const def = getDef(jokerInst.id);
    if (!def) continue;

    if (def.effect.getRetriggers) {
      retriggers += def.effect.getRetriggers(card, candidate.handType, allCardsFace);
    }

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

function resolveBlueprintCopy(
  jokers: JokerInstance[],
  currentIndex: number,
  getDef: (id: string) => ReturnType<typeof getJoker>,
): JokerInstance | null {
  const targetIdx = currentIndex + 1;
  if (targetIdx >= jokers.length) return null;

  const target = jokers[targetIdx];
  const def = getDef(target.id);
  if (!def || !def.copyable) return null;

  if (target.id === 'blueprint') {
    return resolveBlueprintCopy(jokers, targetIdx, getDef);
  }

  return target;
}

function resolveBrainstormCopy(
  jokers: JokerInstance[],
  getDef: (id: string) => ReturnType<typeof getJoker>,
): JokerInstance | null {
  const leftmost = jokers[0];
  if (!leftmost) return null;

  if (leftmost.id === 'brainstorm') {
    const firstReal = jokers.find(j => j.id !== 'brainstorm');
    return firstReal || null;
  }

  const def = getDef(leftmost.id);
  if (!def || !def.copyable) return null;

  return leftmost;
}

// ─── State Override Application ────────────────────────────────

type OverrideOp = 'addMult' | 'mulMult' | 'addChips';

const OVERRIDE_OPS: Record<string, OverrideOp | null> = {
  ride_the_bus: 'addMult',
  supernova: 'addMult',
  fortune_teller: 'addMult',
  green_joker: 'addMult',
  popcorn: 'addMult',
  ceremonial_dagger: 'addMult',
  faceless: 'addMult',
  red_card: 'addMult',
  swashbuckler: 'addMult',
  flash: 'addMult',
  trousers: 'addMult',
  hologram: 'mulMult',
  constellation: 'mulMult',
  campfire: 'mulMult',
  canio: 'mulMult',
  yorick: 'mulMult',
  joker_stencil: 'mulMult',
  lucky_cat: 'mulMult',
  glass: 'mulMult',
  throwback: 'mulMult',
  hit_the_road: 'mulMult',
  obelisk: 'mulMult',
  ancient: 'mulMult',
  loyalty_card: 'mulMult',
  madness: 'mulMult',
  idol: 'mulMult',
  ice_cream: 'addChips',
  square: 'addChips',
  runner: 'addChips',
  castle: 'addChips',
  wee: 'addChips',
};

function applyStateOverride(
  def: { id: string },
  _jokerInst: JokerInstance,
  override: number,
  _ctx: JokerEvaluateContext,
  acc: ScoreAccumulator
): void {
  const op = OVERRIDE_OPS[def.id];
  switch (op) {
    case 'addMult': acc.mult += override; break;
    case 'mulMult': acc.mult *= override; break;
    case 'addChips': acc.chips += override; break;
  }

  // Jokers with formula-based overrides
  if (def.id === 'steel_joker') {
    acc.mult *= (1 + override * 0.2);
  } else if (def.id === 'drivers_license' && override >= 16) {
    acc.mult *= 3;
  } else if (def.id === 'stone') {
    acc.chips += 25 * override;
  } else if (def.id === 'hiker') {
    acc.chips += 5 * override;
  }
}

// ─── Baseball Card Handling ────────────────────────────────────

export function computeBaseballCardMult(
  orderedJokers: JokerInstance[],
  getDef: (id: string) => ReturnType<typeof getJoker> = getJoker,
): number {
  let uncommons = 0;
  for (const j of orderedJokers) {
    const def = getDef(j.id);
    if (def && def.rarity === 'uncommon') uncommons++;
  }
  return Math.pow(1.5, uncommons);
}

// ─── Re-export ─────────────────────────────────────────────────
export { getHandBaseChips, getHandBaseMult } from './constants';
