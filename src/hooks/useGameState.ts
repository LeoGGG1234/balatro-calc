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
import { getJokerRoundModifiers } from '../engine/joker-data';
import { createStandardDeck, addCardToDeck, removeCardFromDeck, updateDeckCard, batchUpdateDeckCards, applyDeckPreset } from '../engine/deck';
import type { DeckCardSlot, DeckCardFilter } from '../engine/types';
import type { DeckPreset } from '../engine/deck';

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
}

// ─── Actions ───────────────────────────────────────────────────

export type FormAction =
  | { type: 'SET_HAND_CARD'; index: number; card: Card }
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
  };
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

function formReducer(state: GameStateForm, action: FormAction): GameStateForm {
  switch (action.type) {
    case 'SET_HAND_CARD':
      return {
        ...state,
        handCards: state.handCards.map((c, i) =>
          i === action.index ? action.card : c
        ),
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
    reset,
    buildState,
  };
}
