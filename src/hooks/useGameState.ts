import { useReducer, useCallback, useMemo } from 'react';
import type {
  Card, JokerInstance, HandLevels, GameState,
  DeckComposition, RoundState, GameFlags,
} from '../engine/types';
import {
  HandType, CardEnhancement, CardEdition, Seal, Rank, Suit,
  BlindType,
} from '../engine/types';
import { getDefaultHandLevels } from '../engine/constants';
import { getJokerRoundModifiers, getJokerModifiers } from '../engine/joker-data';
import { createStandardDeck, addCardToDeck, removeCardFromDeck, updateDeckCard, batchUpdateDeckCards, applyDeckPreset } from '../engine/deck';
import type { DeckCardSlot, DeckCardFilter } from '../engine/types';
import type { DeckPreset } from '../engine/deck';
import { createRng } from '../engine/rng';
import { drawHand } from '../engine/run-simulator';
import { recognizeHand } from '../engine/hand-evaluator';

// ─── Voucher / Boss Modifier Presets ──────────────────────────

export interface VoucherDef {
  id: string;
  nameKey: string;
  hands?: number;
  discards?: number;
  handSize?: number;
}

export const ALL_VOUCHERS: VoucherDef[] = [
  { id: 'grabber', nameKey: 'shop.voucherNames.grabber', hands: 1 },
  { id: 'nacho_tong', nameKey: 'shop.voucherNames.nacho_tong', hands: 1 },
  { id: 'wasteful', nameKey: 'shop.voucherNames.wasteful', discards: 1 },
  { id: 'recyclomancy', nameKey: 'shop.voucherNames.recyclomancy', discards: 1 },
  { id: 'paint_brush', nameKey: 'shop.voucherNames.paint_brush', handSize: 1 },
  { id: 'palette', nameKey: 'shop.voucherNames.palette', handSize: 1 },
];

export interface BossEffectDef {
  id: string;
  nameKey: string;
  hands?: number;    // override value (e.g. The Needle: 1)
  discards?: number; // override value (e.g. The Water: 0)
}

export const ALL_BOSS_EFFECTS: BossEffectDef[] = [
  { id: 'none', nameKey: '-' },
  { id: 'the_water', nameKey: 'shop.bossEffectNames.the_water', discards: 0 },
  { id: 'the_needle', nameKey: 'shop.bossEffectNames.the_needle', hands: 1 },
  { id: 'the_eye', nameKey: 'shop.bossEffectNames.the_eye' },
  { id: 'the_mouth', nameKey: 'shop.bossEffectNames.the_mouth' },
  { id: 'the_arm', nameKey: 'shop.bossEffectNames.the_arm' },
  { id: 'the_wall', nameKey: 'shop.bossEffectNames.the_wall' },
  { id: 'the_wheel', nameKey: 'shop.bossEffectNames.the_wheel' },
  { id: 'the_fish', nameKey: 'shop.bossEffectNames.the_fish' },
  { id: 'the_house', nameKey: 'shop.bossEffectNames.the_house' },
  { id: 'the_mark', nameKey: 'shop.bossEffectNames.the_mark' },
  { id: 'the_head', nameKey: 'shop.bossEffectNames.the_head' },
  { id: 'the_tooth', nameKey: 'shop.bossEffectNames.the_tooth' },
  { id: 'the_ox', nameKey: 'shop.bossEffectNames.the_ox' },
  { id: 'the_serpent', nameKey: 'shop.bossEffectNames.the_serpent' },
  { id: 'the_club', nameKey: 'shop.bossEffectNames.the_club' },
  { id: 'the_window', nameKey: 'shop.bossEffectNames.the_window' },
  { id: 'the_plant', nameKey: 'shop.bossEffectNames.the_plant' },
  { id: 'the_hook', nameKey: 'shop.bossEffectNames.the_hook' },
  { id: 'the_psychic', nameKey: 'shop.bossEffectNames.the_psychic' },
  { id: 'the_goad', nameKey: 'shop.bossEffectNames.the_goad' },
  { id: 'the_pillar', nameKey: 'shop.bossEffectNames.the_pillar' },
  { id: 'the_flint', nameKey: 'shop.bossEffectNames.the_flint' },
  { id: 'the_manacle', nameKey: 'shop.bossEffectNames.the_manacle' },
  { id: 'violet_vessel', nameKey: 'shop.bossEffectNames.violet_vessel' },
  { id: 'verdant_leaf', nameKey: 'shop.bossEffectNames.verdant_leaf' },
  { id: 'crimson_heart', nameKey: 'shop.bossEffectNames.crimson_heart' },
  { id: 'cerulean_bell', nameKey: 'shop.bossEffectNames.cerulean_bell' },
  { id: 'amber_acorn', nameKey: 'shop.bossEffectNames.amber_acorn' },
];

// ─── Compute effective values from modifiers ──────────────────

function computeEffectiveMaxHands(
  base: number, vouchers: string[], bossEffect: string | null, jokers: JokerInstance[]
): number {
  let val = base;
  for (const vId of vouchers) {
    const v = ALL_VOUCHERS.find(v => v.id === vId);
    if (v?.hands) val += v.hands;
  }
  const jm = getJokerRoundModifiers(jokers);
  val += jm.maxHandsBonus;
  if (bossEffect) {
    const b = ALL_BOSS_EFFECTS.find(b => b.id === bossEffect);
    if (b?.hands !== undefined) val = b.hands;
  }
  return Math.max(1, val);
}

function computeEffectiveMaxDiscards(
  base: number, vouchers: string[], bossEffect: string | null, jokers: JokerInstance[]
): number {
  let val = base;
  for (const vId of vouchers) {
    const v = ALL_VOUCHERS.find(v => v.id === vId);
    if (v?.discards) val += v.discards;
  }
  const jm = getJokerRoundModifiers(jokers);
  val += jm.maxDiscardsBonus;
  if (bossEffect) {
    const b = ALL_BOSS_EFFECTS.find(b => b.id === bossEffect);
    if (b?.discards !== undefined) val = b.discards;
  }
  return Math.max(0, val);
}

function computeEffectiveHandSize(
  base: number, vouchers: string[], jokers: JokerInstance[]
): number {
  let val = base;
  for (const vId of vouchers) {
    const v = ALL_VOUCHERS.find(v => v.id === vId);
    if (v?.handSize) val += v.handSize;
  }
  const jm = getJokerRoundModifiers(jokers);
  val += jm.handSizeBonus;
  return Math.max(1, val);
}

// ─── Form State Type ───────────────────────────────────────────

export interface GameStateForm {
  handCards: Card[];
  jokers: JokerInstance[];
  handLevels: HandLevels;
  blindType: BlindType;
  blindChips: number;
  blindDebuffedRanks: Rank[];
  blindDebuffedSuits: Suit[];
  antes: number;
  handsPlayed: number;
  discardsUsed: number;
  isFinalHand: boolean;
  deckComposition: DeckComposition;
  dollars: number;
  // Round modifiers
  maxHandsBase: number;
  maxDiscardsBase: number;
  handSizeBase: number;
  activeVouchers: string[];
  activeBossEffect: string | null;
  /** Seeded RNG mode: when set, discard application draws from deck deterministically */
  seed: string | null;
  /** User-provided joker state override values (index → value). Auto-updated on discard. */
  jokerStateOverrides: Record<number, number>;
}

// ─── Actions ───────────────────────────────────────────────────

export type FormAction =
  | { type: 'SET_HAND_CARD'; index: number; card: Card }
  | { type: 'SET_HAND_CARDS'; cards: Card[] }
  | { type: 'ADD_JOKER'; jokerId: string }
  | { type: 'REMOVE_JOKER'; index: number }
  | { type: 'REORDER_JOKERS'; fromIndex: number; toIndex: number }
  | { type: 'SET_HAND_LEVEL'; handType: HandType; level: number }
  | { type: 'SET_BLIND_TYPE'; blindType: BlindType }
  | { type: 'SET_BLIND_CHIPS'; chips: number }
  | { type: 'SET_ANTES'; antes: number }
  | { type: 'SET_HANDS_PLAYED'; count: number }
  | { type: 'SET_DISCARDS_USED'; count: number }
  | { type: 'SET_IS_FINAL_HAND'; value: boolean }
  | { type: 'SET_DECK_COMPOSITION'; deck: DeckComposition }
  | { type: 'RESET_DECK_TO_STANDARD' }
  | { type: 'ADD_CARD_TO_DECK'; rank: Rank; suit: Suit; enhancement?: CardEnhancement; edition?: CardEdition; seal?: Seal }
  | { type: 'REMOVE_CARD_FROM_DECK'; rank: Rank; suit: Suit }
  | { type: 'SET_DOLLARS'; dollars: number }
  | { type: 'SET_MAX_HANDS_BASE'; value: number }
  | { type: 'SET_MAX_DISCARDS_BASE'; value: number }
  | { type: 'SET_HAND_SIZE_BASE'; value: number }
  | { type: 'TOGGLE_VOUCHER'; voucherId: string }
  | { type: 'SET_BOSS_EFFECT'; bossId: string | null }
  | { type: 'UPDATE_DECK_CARD'; slotIndex: number; updates: Partial<Pick<DeckCardSlot, 'enhancement' | 'edition' | 'seal'>> }
  | { type: 'BATCH_UPDATE_DECK_CARDS'; filter: DeckCardFilter; updates: Partial<Pick<DeckCardSlot, 'enhancement' | 'edition' | 'seal'>> }
  | { type: 'APPLY_DECK_PRESET'; preset: DeckPreset }
  | { type: 'SET_SEED'; seed: string | null }
  | { type: 'SET_JOKER_STATE_OVERRIDE'; index: number; value: number }
  | { type: 'APPLY_DISCARD_SUGGESTION'; discardIndices: number[] }
  | { type: 'RESET_FORM' };

// ─── Initial State ─────────────────────────────────────────────

function createEmptyCard(index: number): Card {
  return {
    id: `hand_${index}`,
    rank: Rank.Ace,
    suit: Suit.Spades,
    enhancement: CardEnhancement.None,
    edition: CardEdition.None,
    seal: Seal.None,
    debuffed: false,
  };
}

function createInitialState(): GameStateForm {
  return {
    handCards: Array.from({ length: 8 }, (_, i) => createEmptyCard(i)),
    jokers: [],
    handLevels: getDefaultHandLevels(),
    blindType: BlindType.Small,
    blindChips: 300,
    blindDebuffedRanks: [],
    blindDebuffedSuits: [],
    antes: 1,
    handsPlayed: 0,
    discardsUsed: 0,
    isFinalHand: false,
    deckComposition: { totalCards: 44, remainingByRank: {}, remainingBySuit: {} },
    dollars: 0,
    maxHandsBase: 4,
    maxDiscardsBase: 3,
    handSizeBase: 8,
    activeVouchers: [],
    activeBossEffect: null,
    seed: null,
    jokerStateOverrides: {},
  };
}

// ─── Fog Card Factory ──────────────────────────────────────────

let _fogIdCounter = 0;

function createFogCard(): Card {
  return {
    id: `fog_${_fogIdCounter++}`,
    rank: Rank.Two,
    suit: Suit.Spades,
    enhancement: CardEnhancement.None,
    edition: CardEdition.None,
    seal: Seal.None,
    debuffed: false,
    fog: true,
  };
}

// ─── Discard Joker State Auto-Update ───────────────────────────

/**
 * Compute joker state override deltas triggered by a discard action.
 * Returns updated overrides for discard-triggered jokers.
 */
export function computeDiscardJokerDeltas(
  state: GameStateForm,
  discardCards: Card[],
): Record<number, number> {
  const deltas: Record<number, number> = {};

  for (let i = 0; i < state.jokers.length; i++) {
    const joker = state.jokers[i];
    const currentOverride = state.jokerStateOverrides[i];

    switch (joker.id) {
      case 'castle': {
        // +3 chips per discard action
        const current = currentOverride ?? 0;
        deltas[i] = current + 3;
        break;
      }
      case 'green_joker': {
        // -1 mult per discard
        const current = currentOverride ?? 0;
        deltas[i] = Math.max(0, current - 1);
        break;
      }
      case 'faceless': {
        // +5 mult per face card discarded
        const faceCount = discardCards.filter(c =>
          c.rank === Rank.Jack || c.rank === Rank.Queen || c.rank === Rank.King
        ).length;
        if (faceCount > 0) {
          const current = currentOverride ?? 0;
          deltas[i] = current + faceCount * 5;
        }
        break;
      }
      case 'hit_the_road': {
        // +0.5 xMult per Jack discarded
        const jackCount = discardCards.filter(c => c.rank === Rank.Jack).length;
        if (jackCount > 0) {
          const current = currentOverride ?? 1;
          deltas[i] = current + jackCount * 0.5;
        }
        break;
      }
      case 'yorick': {
        // Track discarded cards: +1 xMult per 23 cards discarded
        const current = currentOverride ?? 1;
        const discarded = discardCards.length;
        deltas[i] = current + discarded; // raw count; scorer divides by 23
        break;
      }
      case 'burnt_joker': {
        // Burnt Joker is handled separately via hand level upgrade
        break;
      }
    }
  }

  return deltas;
}

/**
 * Check if Burnt Joker should trigger (first discard of round).
 * Returns the hand type to upgrade, or null.
 */
function resolveBurntJokerUpgrade(
  state: GameStateForm,
  discardCards: Card[],
): HandType | null {
  // Burnt Joker triggers on the FIRST discard of the round
  if (state.discardsUsed > 0) return null;

  const hasBurntJoker = state.jokers.some(j => j.id === 'burnt_joker');
  if (!hasBurntJoker) return null;

  // Determine hand type from discarded cards — Burnt Joker upgrades the level
  // of the hand type the discarded cards WOULD form
  const mods = getJokerModifiers(state.jokers);
  const handType = recognizeHand(discardCards, mods);
  return handType;
}

// ─── Helpers for computing effective values ────────────────────

export function getEffectiveMaxHands(form: GameStateForm): number {
  return computeEffectiveMaxHands(form.maxHandsBase, form.activeVouchers, form.activeBossEffect, form.jokers);
}

export function getEffectiveMaxDiscards(form: GameStateForm): number {
  return computeEffectiveMaxDiscards(form.maxDiscardsBase, form.activeVouchers, form.activeBossEffect, form.jokers);
}

export function getEffectiveHandSize(form: GameStateForm): number {
  return computeEffectiveHandSize(form.handSizeBase, form.activeVouchers, form.jokers);
}

// ─── Reducer ───────────────────────────────────────────────────

export function formReducer(state: GameStateForm, action: FormAction): GameStateForm {
  switch (action.type) {
    case 'SET_HAND_CARD':
      return {
        ...state,
        handCards: state.handCards.map((c, i) =>
          i === action.index ? action.card : c
        ),
      };

    case 'SET_HAND_CARDS':
      return {
        ...state,
        handCards: action.cards,
      };

    case 'ADD_JOKER':
      if (state.jokers.length >= 7) return state;
      return {
        ...state,
        jokers: [...state.jokers, { id: action.jokerId, edition: CardEdition.None }],
      };

    case 'REMOVE_JOKER':
      return {
        ...state,
        jokers: state.jokers.filter((_, i) => i !== action.index),
      };

    case 'REORDER_JOKERS': {
      const newJokers = [...state.jokers];
      const [moved] = newJokers.splice(action.fromIndex, 1);
      newJokers.splice(action.toIndex, 0, moved);
      return { ...state, jokers: newJokers };
    }

    case 'SET_HAND_LEVEL':
      return {
        ...state,
        handLevels: { ...state.handLevels, [action.handType]: action.level },
      };

    case 'SET_BLIND_TYPE':
      return { ...state, blindType: action.blindType };

    case 'SET_BLIND_CHIPS':
      return { ...state, blindChips: action.chips };

    case 'SET_ANTES':
      return { ...state, antes: action.antes };

    case 'SET_HANDS_PLAYED':
      return { ...state, handsPlayed: action.count };

    case 'SET_DISCARDS_USED':
      return { ...state, discardsUsed: action.count };

    case 'SET_IS_FINAL_HAND':
      return { ...state, isFinalHand: action.value };

    case 'SET_DECK_COMPOSITION':
      return { ...state, deckComposition: action.deck };

    case 'RESET_DECK_TO_STANDARD':
      return { ...state, deckComposition: createStandardDeck() };

    case 'ADD_CARD_TO_DECK':
      return {
        ...state,
        deckComposition: addCardToDeck(
          state.deckComposition, action.rank, action.suit,
          action.enhancement, action.edition, action.seal,
        ),
      };

    case 'REMOVE_CARD_FROM_DECK':
      return {
        ...state,
        deckComposition: removeCardFromDeck(state.deckComposition, action.rank, action.suit),
      };

    case 'SET_DOLLARS':
      return { ...state, dollars: action.dollars };

    case 'SET_MAX_HANDS_BASE':
      return { ...state, maxHandsBase: Math.max(1, action.value) };

    case 'SET_MAX_DISCARDS_BASE':
      return { ...state, maxDiscardsBase: Math.max(0, action.value) };

    case 'SET_HAND_SIZE_BASE':
      return { ...state, handSizeBase: Math.max(5, action.value) };

    case 'TOGGLE_VOUCHER': {
      const has = state.activeVouchers.includes(action.voucherId);
      const nextVouchers = has
        ? state.activeVouchers.filter(v => v !== action.voucherId)
        : [...state.activeVouchers, action.voucherId];
      return { ...state, activeVouchers: nextVouchers };
    }

    case 'SET_BOSS_EFFECT':
      return { ...state, activeBossEffect: action.bossId === 'none' ? null : action.bossId };

    case 'UPDATE_DECK_CARD':
      return { ...state, deckComposition: updateDeckCard(state.deckComposition, action.slotIndex, action.updates) };

    case 'BATCH_UPDATE_DECK_CARDS':
      return { ...state, deckComposition: batchUpdateDeckCards(state.deckComposition, action.filter, action.updates) };

    case 'APPLY_DECK_PRESET':
      return { ...state, deckComposition: applyDeckPreset(action.preset) };

    case 'SET_SEED':
      return { ...state, seed: action.seed };

    case 'SET_JOKER_STATE_OVERRIDE':
      return {
        ...state,
        jokerStateOverrides: {
          ...state.jokerStateOverrides,
          [action.index]: action.value,
        },
      };

    case 'APPLY_DISCARD_SUGGESTION': {
      const effectiveDiscards = computeEffectiveMaxDiscards(
        state.maxDiscardsBase, state.activeVouchers, state.activeBossEffect, state.jokers,
      );
      const discardsLeft = effectiveDiscards - state.discardsUsed;
      if (discardsLeft <= 0) return state; // No discards left

      const indices = action.discardIndices;
      const discardCards = indices.map(i => state.handCards[i]).filter(Boolean);

      // ── Joker state auto-update ──────────────────────────────
      const jokerDeltas = computeDiscardJokerDeltas(state, discardCards);
      const newOverrides = { ...state.jokerStateOverrides, ...jokerDeltas };

      // ── Burnt Joker hand level upgrade ───────────────────────
      let newHandLevels = state.handLevels;
      const burntUpgrade = resolveBurntJokerUpgrade(state, discardCards);
      if (burntUpgrade) {
        newHandLevels = {
          ...state.handLevels,
          [burntUpgrade]: (state.handLevels[burntUpgrade] ?? 1) + 1,
        };
      }

      // ── Universe A: Seeded deterministic draw ────────────────
      if (state.seed) {
        const rng = createRng(state.seed + '_discard_' + state.discardsUsed);
        const { cards: drawnCards, deck: newDeck } = drawHand(
          state.deckComposition,
          discardCards.length,
          rng,
        );

        // Place kept cards in original positions, fill discard slots with drawn cards
        const newHandCards: Card[] = [];
        let drawnIdx = 0;
        for (let i = 0; i < state.handCards.length; i++) {
          if (indices.includes(i)) {
            newHandCards.push(drawnCards[drawnIdx] ?? createFogCard());
            drawnIdx++;
          } else {
            newHandCards.push(state.handCards[i]);
          }
        }

        return {
          ...state,
          handCards: newHandCards,
          discardsUsed: state.discardsUsed + 1,
          deckComposition: newDeck,
          handLevels: newHandLevels,
          jokerStateOverrides: newOverrides,
        };
      }

      // ── Universe B: Unseeded fog placeholders ────────────────
      const fogHandCards: Card[] = [];
      for (let i = 0; i < state.handCards.length; i++) {
        if (indices.includes(i)) {
          fogHandCards.push(createFogCard());
        } else {
          fogHandCards.push(state.handCards[i]);
        }
      }

      return {
        ...state,
        handCards: fogHandCards,
        discardsUsed: state.discardsUsed + 1,
        handLevels: newHandLevels,
        jokerStateOverrides: newOverrides,
      };
    }

    case 'RESET_FORM':
      return createInitialState();

    default:
      return state;
  }
}

// ─── Build GameState from form ──────────────────────────────────

export function buildGameState(form: GameStateForm): GameState {
  const flags: GameFlags = {
    playedHandsThisRound: [],
    hasDiscardedThisRound: form.discardsUsed > 0,
    firstHandThisRound: form.handsPlayed === 0,
  };

  const roundState: RoundState = {
    handsPlayed: form.handsPlayed,
    discardsUsed: form.discardsUsed,
    dollars: form.dollars,
    antes: form.antes,
    isFinalHand: form.isFinalHand,
    maxHands: computeEffectiveMaxHands(form.maxHandsBase, form.activeVouchers, form.activeBossEffect, form.jokers),
    maxDiscards: computeEffectiveMaxDiscards(form.maxDiscardsBase, form.activeVouchers, form.activeBossEffect, form.jokers),
    handSize: computeEffectiveHandSize(form.handSizeBase, form.activeVouchers, form.jokers),
  };

  const deckComposition: DeckComposition = form.deckComposition;

  return {
    handCards: form.handCards,
    jokers: form.jokers,
    handLevels: form.handLevels,
    deckComposition,
    blind: {
      type: form.blindType,
      chipsRequired: form.blindChips,
      debuffedRanks: form.blindDebuffedRanks,
      debuffedSuits: form.blindDebuffedSuits,
    },
    roundState,
    flags,
  };
}

// ─── Hook ──────────────────────────────────────────────────────

export function useGameState() {
  const [state, dispatch] = useReducer(formReducer, null, createInitialState);

  const setHandCard = useCallback((index: number, card: Card) => {
    dispatch({ type: 'SET_HAND_CARD', index, card });
  }, []);

  const setHandCards = useCallback((cards: Card[]) => {
    dispatch({ type: 'SET_HAND_CARDS', cards });
  }, []);

  const addJoker = useCallback((jokerId: string) => {
    dispatch({ type: 'ADD_JOKER', jokerId });
  }, []);

  const removeJoker = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_JOKER', index });
  }, []);

  const reorderJokers = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: 'REORDER_JOKERS', fromIndex, toIndex });
  }, []);

  const setHandLevel = useCallback((handType: HandType, level: number) => {
    dispatch({ type: 'SET_HAND_LEVEL', handType, level });
  }, []);

  const toggleVoucher = useCallback((voucherId: string) => {
    dispatch({ type: 'TOGGLE_VOUCHER', voucherId });
  }, []);

  const setBossEffect = useCallback((bossId: string | null) => {
    dispatch({ type: 'SET_BOSS_EFFECT', bossId });
  }, []);

  const updateField = useCallback(<K extends keyof GameStateForm>(
    field: K, value: GameStateForm[K]
  ) => {
    switch (field) {
      case 'blindType':
        dispatch({ type: 'SET_BLIND_TYPE', blindType: value as BlindType });
        break;
      case 'blindChips':
        dispatch({ type: 'SET_BLIND_CHIPS', chips: value as number });
        break;
      case 'antes':
        dispatch({ type: 'SET_ANTES', antes: value as number });
        break;
      case 'handsPlayed':
        dispatch({ type: 'SET_HANDS_PLAYED', count: value as number });
        break;
      case 'discardsUsed':
        dispatch({ type: 'SET_DISCARDS_USED', count: value as number });
        break;
      case 'isFinalHand':
        dispatch({ type: 'SET_IS_FINAL_HAND', value: value as boolean });
        break;
      case 'dollars':
        dispatch({ type: 'SET_DOLLARS', dollars: value as number });
        break;
      case 'maxHandsBase':
        dispatch({ type: 'SET_MAX_HANDS_BASE', value: value as number });
        break;
      case 'maxDiscardsBase':
        dispatch({ type: 'SET_MAX_DISCARDS_BASE', value: value as number });
        break;
      case 'handSizeBase':
        dispatch({ type: 'SET_HAND_SIZE_BASE', value: value as number });
        break;
    }
  }, []);

  const setDeckComposition = useCallback((deck: DeckComposition) => {
    dispatch({ type: 'SET_DECK_COMPOSITION', deck });
  }, []);

  const resetDeckToStandard = useCallback(() => {
    dispatch({ type: 'RESET_DECK_TO_STANDARD' });
  }, []);

  const addCardToDeckCb = useCallback((
    rank: Rank, suit: Suit,
    enhancement?: CardEnhancement, edition?: CardEdition, seal?: Seal,
  ) => {
    dispatch({ type: 'ADD_CARD_TO_DECK', rank, suit, enhancement, edition, seal });
  }, []);

  const removeCardFromDeckCb = useCallback((rank: Rank, suit: Suit) => {
    dispatch({ type: 'REMOVE_CARD_FROM_DECK', rank, suit });
  }, []);

  const updateDeckCardCb = useCallback((slotIndex: number, updates: Partial<Pick<DeckCardSlot, 'enhancement' | 'edition' | 'seal'>>) => {
    dispatch({ type: 'UPDATE_DECK_CARD', slotIndex, updates });
  }, []);

  const batchUpdateDeckCardsCb = useCallback((filter: DeckCardFilter, updates: Partial<Pick<DeckCardSlot, 'enhancement' | 'edition' | 'seal'>>) => {
    dispatch({ type: 'BATCH_UPDATE_DECK_CARDS', filter, updates });
  }, []);

  const applyDeckPresetCb = useCallback((preset: DeckPreset) => {
    dispatch({ type: 'APPLY_DECK_PRESET', preset });
  }, []);

  const setSeed = useCallback((seed: string | null) => {
    dispatch({ type: 'SET_SEED', seed });
  }, []);

  const setJokerStateOverride = useCallback((index: number, value: number) => {
    dispatch({ type: 'SET_JOKER_STATE_OVERRIDE', index, value });
  }, []);

  const applyDiscardSuggestion = useCallback((discardIndices: number[]) => {
    dispatch({ type: 'APPLY_DISCARD_SUGGESTION', discardIndices });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET_FORM' });
  }, []);

  const gameState = useMemo(() => buildGameState(state), [state]);
  const buildState = useCallback(() => gameState, [gameState]);

  return {
    form: state,
    effectiveMaxHands: getEffectiveMaxHands(state),
    effectiveMaxDiscards: getEffectiveMaxDiscards(state),
    effectiveHandSize: getEffectiveHandSize(state),
    setHandCard,
    setHandCards,
    addJoker,
    removeJoker,
    reorderJokers,
    setHandLevel,
    toggleVoucher,
    setBossEffect,
    updateField,
    setDeckComposition,
    resetDeckToStandard,
    addCardToDeck: addCardToDeckCb,
    removeCardFromDeck: removeCardFromDeckCb,
    updateDeckCard: updateDeckCardCb,
    batchUpdateDeckCards: batchUpdateDeckCardsCb,
    applyDeckPreset: applyDeckPresetCb,
    setSeed,
    setJokerStateOverride,
    applyDiscardSuggestion,
    reset,
    buildState,
  };
}
