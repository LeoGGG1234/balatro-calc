import type {
  Card, GameState, JokerInstance, HandLevels,
  DeckComposition, ScoringBreakdown,
} from './types';
import { HandType, BlindType, ALL_RANKS, ALL_SUITS, CardEdition } from './types';
import type { Rank, Suit } from './types';
import { findOptimalPlay } from './search';
import type { SearchConfig } from './search';
import { quickDiscardTip } from './discard-analyzer';
import { generateShop } from './shop';
import { getJoker } from './joker-effects';
import { createRng } from './rng';
import { buildAggregateFromCards } from './deck';
import type { DeckCardSlot } from './types';
import {
  getAnteBlindDef, getBossEffect, BOSS_BLINDS, BOSS_POOL,
} from './boss-data';
import type { BossEffect } from './boss-data';
import { calculateRoundEarnings, calculateJokerIncome } from './economy';

// Re-export extracted modules for backward compatibility
export { calculateInterest, calculateRoundEarnings, calculateJokerIncome } from './economy';
export type { JokerIncomeInput } from './economy';
export {
  getAnteBlindDef, getBossEffect, BOSS_BLINDS, BOSS_POOL,
} from './boss-data';
export type { BossEffect, BossBlindDef, AnteBlindDef } from './boss-data';

// ─── Types ──────────────────────────────────────────────────────

export interface RunConfig {
  maxAntes: number;
  enableShop: boolean;
  seed?: number | string;
  handSelectionStrategy: 'auto' | 'first';
  randomBosses?: boolean;
}

export interface RoundResult {
  ante: number;
  blindType: BlindType;
  blindName: string;
  bossId: string | null;
  chipsRequired: number;
  handTypePlayed: HandType;
  cardsPlayed: Card[];
  cardsHeld: Card[];
  totalScore: number;
  blindBeaten: boolean;
  handsUsed: number;
  discardsUsed: number;
  scoreBreakdown: ScoringBreakdown;
  jokersAtRound: JokerInstance[];
  handLevelsAtRound: HandLevels;
  roundEarnings: number;
  cumulativeDollars: number;
}

export interface RunResult {
  config: RunConfig;
  rounds: RoundResult[];
  totalScore: number;
  antesCleared: number;
  roundsSurvived: number;
  finalAnte: number;
  finalBlind: 'won' | 'lost' | 'in_progress';
  totalEarnings: number;
  finalDollars: number;
  startingState: GameState;
  endingState: GameState | null;
  totalSimulationTimeMs: number;
}

// ─── Default Config ──────────────────────────────────────────────

const DEFAULT_RUN_CONFIG: RunConfig = {
  maxAntes: 3,
  enableShop: false,
  handSelectionStrategy: 'auto',
};

// ─── Hand Drawing ────────────────────────────────────────────────

export interface DrawResult {
  cards: Card[];
  deck: DeckComposition;
}

/**
 * Partial Fisher-Yates shuffle: pick `count` random cards from the deck.cards
 * array without mutating the original. Returns drawn cards and updated deck.
 */
function drawHandFromCards(
  deck: DeckComposition,
  count: number,
  rng: () => number,
): DrawResult {
  const pool = [...deck.cards!];
  const drawn: DeckCardSlot[] = [];

  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    drawn.push(pool[i]);
  }

  const remaining = pool.slice(count);

  const cards: Card[] = drawn.map((c, i) => ({
    id: `sim_${c.rank}_${c.suit}_${i}`,
    rank: c.rank,
    suit: c.suit,
    enhancement: c.enhancement,
    edition: c.edition,
    seal: c.seal,
    debuffed: false,
  }));

  return {
    cards,
    deck: {
      ...buildAggregateFromCards(remaining),
      cards: remaining,
    },
  };
}

/**
 * Fallback: approximate draw from aggregate counts when deck.cards is unavailable.
 */
function drawHandFromAggregates(
  deck: DeckComposition,
  actualDraw: number,
  rng: () => number,
): DrawResult {
  const cards: Card[] = [];
  let remainingByRank = { ...deck.remainingByRank };
  let remainingBySuit = { ...deck.remainingBySuit };
  let enhancementCounts = { ...deck.enhancementCounts };
  let editionCounts = { ...deck.editionCounts };
  let sealCounts = { ...deck.sealCounts };
  let totalCards = deck.totalCards;
  let cardCounter = 0;

  for (let i = 0; i < actualDraw; i++) {
    const rankEntries = ALL_RANKS.filter(r => (remainingByRank[r] ?? 0) > 0);
    if (rankEntries.length === 0) break;

    const rankWeights = rankEntries.map(r => remainingByRank[r] ?? 0);
    const totalRankWeight = rankWeights.reduce((a, b) => a + b, 0);
    let randRank = rng() * totalRankWeight;
    let selectedRank = rankEntries[0];
    for (let j = 0; j < rankEntries.length; j++) {
      randRank -= rankWeights[j];
      if (randRank <= 0) { selectedRank = rankEntries[j]; break; }
    }

    const suitEntries = ALL_SUITS.filter(s => (remainingBySuit[s] ?? 0) > 0);
    const suitWeights = suitEntries.map(s => remainingBySuit[s] ?? 0);
    const totalSuitWeight = suitWeights.reduce((a, b) => a + b, 0);
    let randSuit = rng() * totalSuitWeight;
    let selectedSuit = suitEntries[0];
    for (let j = 0; j < suitEntries.length; j++) {
      randSuit -= suitWeights[j];
      if (randSuit <= 0) { selectedSuit = suitEntries[j]; break; }
    }

    const enhEntries = Object.entries(enhancementCounts).filter(([, c]) => c > 0) as [string, number][];
    const enhTotal = enhEntries.reduce((s, [, c]) => s + c, 0);
    let randEnh = rng() * enhTotal;
    let selectedEnh = enhEntries[0]?.[0] ?? 'none';
    for (const [k, c] of enhEntries) { randEnh -= c; if (randEnh <= 0) { selectedEnh = k; break; } }

    const edEntries = Object.entries(editionCounts).filter(([, c]) => c > 0) as [string, number][];
    const edTotal = edEntries.reduce((s, [, c]) => s + c, 0);
    let randEd = rng() * edTotal;
    let selectedEd = edEntries[0]?.[0] ?? 'none';
    for (const [k, c] of edEntries) { randEd -= c; if (randEd <= 0) { selectedEd = k; break; } }

    const sealEntries = Object.entries(sealCounts).filter(([, c]) => c > 0) as [string, number][];
    const sealTotal = sealEntries.reduce((s, [, c]) => s + c, 0);
    let randSeal = rng() * sealTotal;
    let selectedSeal = sealEntries[0]?.[0] ?? 'none';
    for (const [k, c] of sealEntries) { randSeal -= c; if (randSeal <= 0) { selectedSeal = k; break; } }

    cards.push({
      id: `sim_${selectedRank}_${selectedSuit}_${cardCounter++}`,
      rank: selectedRank as Rank,
      suit: selectedSuit as Suit,
      enhancement: selectedEnh as Card['enhancement'],
      edition: selectedEd as Card['edition'],
      seal: selectedSeal as Card['seal'],
      debuffed: false,
    });

    remainingByRank[selectedRank as Rank] = Math.max(0, (remainingByRank[selectedRank as Rank] ?? 0) - 1);
    remainingBySuit[selectedSuit as Suit] = Math.max(0, (remainingBySuit[selectedSuit as Suit] ?? 0) - 1);
    enhancementCounts[selectedEnh as keyof typeof enhancementCounts] = Math.max(0, (enhancementCounts[selectedEnh as keyof typeof enhancementCounts] ?? 0) - 1);
    editionCounts[selectedEd as keyof typeof editionCounts] = Math.max(0, (editionCounts[selectedEd as keyof typeof editionCounts] ?? 0) - 1);
    sealCounts[selectedSeal as keyof typeof sealCounts] = Math.max(0, (sealCounts[selectedSeal as keyof typeof sealCounts] ?? 0) - 1);
    totalCards--;
  }

  return {
    cards,
    deck: { ...deck, totalCards, remainingByRank, remainingBySuit, enhancementCounts, editionCounts, sealCounts },
  };
}

export function drawHand(
  deck: DeckComposition,
  handSize: number,
  rng: () => number,
): DrawResult {
  const actualDraw = Math.min(handSize, deck.totalCards);

  if (deck.cards && deck.cards.length >= actualDraw) {
    return drawHandFromCards(deck, actualDraw, rng);
  }

  return drawHandFromAggregates(deck, actualDraw, rng);
}

// ─── State Cloning ──────────────────────────────────────────────

function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    handCards: state.handCards.map(c => ({ ...c })),
    jokers: state.jokers.map(j => ({ ...j })),
    handLevels: { ...state.handLevels },
    deckComposition: {
      ...state.deckComposition,
      remainingByRank: { ...state.deckComposition.remainingByRank },
      remainingBySuit: { ...state.deckComposition.remainingBySuit },
      enhancementCounts: { ...state.deckComposition.enhancementCounts },
      editionCounts: { ...state.deckComposition.editionCounts },
      sealCounts: { ...state.deckComposition.sealCounts },
    },
    blind: { ...state.blind },
    roundState: { ...state.roundState },
    flags: { ...state.flags, playedHandsThisRound: [...(state.flags.playedHandsThisRound ?? [])] },
  };
}

function cloneJokers(jokers: JokerInstance[]): JokerInstance[] {
  return jokers.map(j => ({ ...j }));
}

function cloneHandLevels(levels: HandLevels): HandLevels {
  return { ...levels };
}

// ─── Main Simulator ──────────────────────────────────────────────

interface BlindContext {
  maxHands: number;
  maxDiscards: number;
  handSize: number;
  chipsRequired: number;
  debuffRanks: Rank[] | undefined;
  debuffSuits: Suit[] | undefined;
  bossEffect: BossEffect;
  blind: { type: BlindType; chips: number; bossId: string | null };
}

function setupBlindContext(
  blind: { type: BlindType; chips: number; bossId: string | null },
  state: GameState,
  bossEffect: BossEffect,
): BlindContext {
  const bossMultiplier = bossEffect.chipsMultiplier ?? 1;
  const maxHands = bossEffect.maxHandsOverride ?? state.roundState.maxHands;
  const maxDiscards = bossEffect.maxDiscardsOverride ?? state.roundState.maxDiscards;
  let handSize = state.roundState.handSize;
  if (bossEffect.handSizeModifier) handSize = Math.max(1, handSize + bossEffect.handSizeModifier);

  return {
    maxHands,
    maxDiscards,
    handSize,
    chipsRequired: Math.round(blind.chips * bossMultiplier),
    debuffRanks: bossEffect.debuffedRanks,
    debuffSuits: bossEffect.debuffedSuits,
    bossEffect,
    blind,
  };
}

function markDebuffedCards(
  cards: Card[],
  ctx: BlindContext,
  cardsScoredThisAnte: Set<string>,
) {
  const { debuffRanks, debuffSuits } = ctx;
  if (!debuffRanks && !debuffSuits && cardsScoredThisAnte.size === 0) return;
  for (const card of cards) {
    if ((debuffRanks?.includes(card.rank)) ||
        (debuffSuits?.includes(card.suit)) ||
        cardsScoredThisAnte.has(card.id)) {
      card.debuffed = true;
    }
  }
}

function runShopPhase(
  state: GameState,
  cumulativeDollars: number,
  rng: () => number,
  effectiveHandLevels: HandLevels,
): number {
  try {
    const shop = generateShop(state, cumulativeDollars, rng);

    const collectAffordable = (slots: typeof shop.state.slots) =>
      slots
        .filter(s => s.item && s.item.price <= cumulativeDollars && s.itemType !== 'pack')
        .map(s => ({
          slot: s,
          utilityPerDollar: s.item!.price > 0
            ? ((s.item as { utilityFn?: (gs: GameState) => number }).utilityFn?.(state) ?? 0) / s.item!.price
            : 0,
        }))
        .sort((a, b) => b.utilityPerDollar - a.utilityPerDollar);

    const affordableItems = collectAffordable(shop.state.slots);

    // Reroll up to 2 times if no good items
    let shopRerolls = 0;
    while (affordableItems.length === 0 && shopRerolls < 2 && cumulativeDollars >= shop.state.rerollCost + 3) {
      cumulativeDollars -= shop.state.rerollCost;
      shopRerolls++;
      const newShop = generateShop(state, cumulativeDollars, rng);
      affordableItems.push(...collectAffordable(newShop.state.slots));
      affordableItems.sort((a, b) => b.utilityPerDollar - a.utilityPerDollar);
    }

    // Buy best items (up to 3, keeping $5 reserve)
    let purchases = 0;
    for (const item of affordableItems) {
      if (purchases >= 3) break;
      const price = item.slot.item!.price;
      if (price > cumulativeDollars - 5) continue;

      cumulativeDollars -= price;
      purchases++;

      const slot = item.slot;
      if (slot.itemType === 'joker' && 'jokerId' in slot.item!) {
        if (state.jokers.length < 7) {
          state.jokers.push({ id: slot.item.jokerId, edition: CardEdition.None });
        }
      } else if (slot.itemType === 'planet' && 'handType' in slot.item!) {
        const handType = slot.item.handType;
        state.handLevels[handType] = (state.handLevels[handType] ?? 1) + 1;
        effectiveHandLevels[handType] = state.handLevels[handType];
      } else if (slot.itemType === 'tarot' && 'id' in slot.item!) {
        if (slot.item.id === 'the_hermit') {
          cumulativeDollars += Math.min(cumulativeDollars, 20);
        } else if (slot.item.id === 'temperance') {
          let sellValue = 0;
          for (const j of state.jokers) {
            const def = getJoker(j.id);
            if (def) sellValue += Math.floor(def.cost / 2);
          }
          cumulativeDollars += Math.min(sellValue, 50);
        }
      } else if (slot.itemType === 'voucher') {
        const voucherId = ('id' in slot.item!) ? slot.item.id : '';
        switch (voucherId) {
          case 'grabber': case 'nacho_tong':
            state.roundState.maxHands += 1; break;
          case 'wasteful': case 'recyclomancy':
            state.roundState.maxDiscards += 1; break;
          case 'paint_brush': case 'palette':
            state.roundState.handSize += 1; break;
        }
      }
    }
    state.roundState.dollars = cumulativeDollars;
  } catch {
    // Shop generation may fail; skip
  }
  return cumulativeDollars;
}

export function simulateRun(
  startingState: GameState,
  config: Partial<RunConfig> = {},
): RunResult {
  const startTime = performance.now();
  const cfg = { ...DEFAULT_RUN_CONFIG, ...config };
  const rng = createRng(cfg.seed ?? Date.now());

  const searchConfig: Partial<SearchConfig> = {
    includeJokerOrdering: true,
    smartOrdering: true,
    maxComputationMs: 2000,
  };

  const rounds: RoundResult[] = [];
  let state = cloneGameState(startingState);
  let cumulativeDollars = state.roundState.dollars;
  const runHandCounts: Partial<Record<HandType, number>> = {};

  let finalAnte = 1;
  let finalBlind: 'won' | 'lost' | 'in_progress' = 'in_progress';
  let totalEarnings = 0;

  anteLoop:
  for (let ante = 1; ante <= cfg.maxAntes; ante++) {
    finalAnte = ante;
    const anteDef = getAnteBlindDef(ante);
    const cardsScoredThisAnte = new Set<string>();

    // Select boss: random from pool if configured, otherwise fixed rotation
    const bossId = cfg.randomBosses
      ? BOSS_POOL[Math.floor(rng() * BOSS_POOL.length)]
      : anteDef.bossId;

    const blinds: { type: BlindType; chips: number; bossId: string | null }[] = [
      { type: BlindType.Small, chips: anteDef.smallChips, bossId: null },
      { type: BlindType.Big, chips: anteDef.bigChips, bossId: null },
      { type: BlindType.Boss, chips: anteDef.bossChips, bossId },
    ];

    for (const blind of blinds) {
      if (state.deckComposition.totalCards <= 0) {
        finalBlind = 'lost';
        break anteLoop;
      }

      const bossEffect = blind.bossId ? getBossEffect(blind.bossId) : {};
      const bctx = setupBlindContext(blind, state, bossEffect);
      let handsPlayed = 0;
      let discardsUsed = 0;
      let totalCardsDiscardedThisBlind = 0;
      let handLevels = cloneHandLevels(state.handLevels);
      const playedHandTypesThisBlind: HandType[] = [];

      // Deal hand
      const draw = drawHand(state.deckComposition, bctx.handSize, rng);
      let currentHandCards = draw.cards;
      let currentDeck = draw.deck;

      markDebuffedCards(currentHandCards, bctx, cardsScoredThisAnte);

      // Boss effect: Verdant Leaf — all cards debuffed until joker sold
      let verdantDebuffActive = false;
      if (bossEffect.debuffAllCardsUntilSell) {
        if (state.jokers.length > 0) {
          // Auto-sell first joker to clear debuff
          const soldJoker = state.jokers.shift()!;
          const def = getJoker(soldJoker.id);
          const sellValue = def ? Math.floor(def.cost / 2) : 1;
          cumulativeDollars += sellValue;
        } else {
          verdantDebuffActive = true;
          for (const card of currentHandCards) {
            card.debuffed = true;
          }
        }
      }

      // Boss effect: Cerulean Bell — force a random card to always be selected
      let forcedCardId: string | undefined;
      if (bossEffect.forceRandomCard && currentHandCards.length > 0) {
        forcedCardId = currentHandCards[Math.floor(rng() * currentHandCards.length)].id;
      }

      let blindBeaten = false;
      let finalScoredPlay: ScoringBreakdown | null = null;
      let finalHandType = HandType.HighCard;
      let finalCardsPlayed: Card[] = [];
      let finalCardsHeld: Card[] = [];

      const jokersAtRound = cloneJokers(state.jokers);

      // Boss effect: Amber Acorn — shuffle jokers
      if (bossEffect.shuffleJokers && state.jokers.length > 1) {
        for (let i = state.jokers.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [state.jokers[i], state.jokers[j]] = [state.jokers[j], state.jokers[i]];
        }
      }

      // Boss effect: Crimson Heart — disable one random joker
      let disabledJokerIndex = -1;
      if (bossEffect.disableRandomJoker && state.jokers.length > 0) {
        disabledJokerIndex = Math.floor(rng() * state.jokers.length);
      }

      // Build effective jokers list (exclude disabled joker)
      const effectiveJokers = disabledJokerIndex >= 0
        ? state.jokers.filter((_, i) => i !== disabledJokerIndex)
        : state.jokers;

      // Apply halve base hand effect (The Flint)
      const effectiveHandLevels = cloneHandLevels(handLevels);
      if (bossEffect.halveBaseHand) {
        for (const ht of Object.values(HandType)) {
          effectiveHandLevels[ht] = Math.max(1, Math.floor(handLevels[ht] / 2));
        }
      }

      // Play/discard loop
      for (let handAttempt = 0; handAttempt < bctx.maxHands; handAttempt++) {
        if (currentHandCards.length === 0) break;

        const roundState = {
          ...state.roundState,
          handsPlayed,
          discardsUsed,
          maxHands: bctx.maxHands,
          maxDiscards: bctx.maxDiscards,
          handSize: bctx.handSize,
          isFinalHand: handAttempt === bctx.maxHands - 1,
        };

        const playState: GameState = {
          ...state,
          jokers: effectiveJokers,
          handCards: currentHandCards,
          deckComposition: currentDeck,
          handLevels: effectiveHandLevels,
          roundState,
          blind: {
            type: blind.type,
            chipsRequired: bctx.chipsRequired,
            debuffedRanks: bossEffect.debuffedRanks ?? [],
            debuffedSuits: bossEffect.debuffedSuits ?? [],
            bossId: blind.bossId ?? undefined,
            forbiddenHandTypes: bossEffect.noRepeatHandType ? playedHandTypesThisBlind : undefined,
            forcedHandType: bossEffect.restrictToFirstHandType && playedHandTypesThisBlind.length > 0 ? playedHandTypesThisBlind[0] : undefined,
            mustPlayFiveCards: bossEffect.mustPlayFiveCards,
            forcedCardId,
          },
          flags: {
            ...state.flags,
            playedHandsThisRound: playedHandTypesThisBlind,
          },
        };

        const optimal = findOptimalPlay(playState, searchConfig);
        if (!optimal) {
          // No valid play found
          break;
        }

        finalScoredPlay = optimal.breakdown;
        finalHandType = optimal.handType;
        finalCardsPlayed = optimal.playedCards;
        finalCardsHeld = optimal.heldCards;

        const score = optimal.totalScore;

        // Check if blind is beaten
        if (score >= bctx.chipsRequired) {
          blindBeaten = true;
          break;
        }

        handsPlayed++;

        // Boss effect: The Eye - record played hand type for repeat check
        if (bossEffect.noRepeatHandType) {
          playedHandTypesThisBlind.push(optimal.handType);
        }

        // Boss effect: The Mouth - first hand type becomes the only allowed type
        if (bossEffect.restrictToFirstHandType && playedHandTypesThisBlind.length === 0) {
          playedHandTypesThisBlind.push(optimal.handType);
        }

        // Boss effect: The Arm - reduce hand level
        if (bossEffect.reduceHandLevel) {
          effectiveHandLevels[optimal.handType] = Math.max(1, effectiveHandLevels[optimal.handType] - 1);
        }

        // Boss effect: The Serpent - draw +3 cards after each hand played
        if (bossEffect.drawCardsAfterPlay && bossEffect.drawCardsAfterPlay > 0) {
          const extraDraw = drawHand(currentDeck, bossEffect.drawCardsAfterPlay, rng);
          if (verdantDebuffActive) {
            for (const card of extraDraw.cards) card.debuffed = true;
          }
          currentHandCards = [...currentHandCards, ...extraDraw.cards];
          currentDeck = extraDraw.deck;
        }

        // Boss effect: The Tooth - lose $1 per card played
        if (bossEffect.costPerCardPlayed) {
          cumulativeDollars = Math.max(0, cumulativeDollars - bossEffect.costPerCardPlayed * optimal.playedCards.length);
        }

        // Boss effect: The Ox - track hand type counts, reset money if playing most-used type
        if (bossEffect.resetMoneyOnMostPlayedHand) {
          runHandCounts[optimal.handType] = (runHandCounts[optimal.handType] ?? 0) + 1;
          let maxCount = 0;
          for (const count of Object.values(runHandCounts)) {
            if (count > maxCount) maxCount = count;
          }
          if ((runHandCounts[optimal.handType] ?? 0) >= maxCount && maxCount > 1) {
            cumulativeDollars = 0;
          }
        }

        // Boss effect: The Hook — debuff N random cards in hand after each play
        if (bossEffect.debuffRandomCardsInHand) {
          const remainingIndices = currentHandCards
            .map((c, i) => c.debuffed ? -1 : i)
            .filter(i => i >= 0);
          const count = Math.min(bossEffect.debuffRandomCardsInHand, remainingIndices.length);
          for (let h = 0; h < count; h++) {
            const pick = Math.floor(rng() * remainingIndices.length);
            currentHandCards[remainingIndices[pick]].debuffed = true;
            remainingIndices.splice(pick, 1);
          }
        }

        // Boss effect: The Pillar — record scored cards for ante-scope debuff
        if (bossEffect.debuffScoredCardsThisAnte) {
          for (const card of optimal.playedCards) {
            cardsScoredThisAnte.add(card.id);
          }
        }

        // Try discarding if available
        if (discardsUsed < bctx.maxDiscards) {
          const tip = quickDiscardTip(
            { ...playState, roundState: { ...roundState, handsPlayed, discardsUsed } },
          );
          if (tip && tip.discardIndices.length > 0) {
            totalCardsDiscardedThisBlind += tip.discardIndices.length;
            // Remove discarded cards
            const newHand = currentHandCards.filter((_, i) => !tip.discardIndices.includes(i));
            // Draw replacements
            const redraw = drawHand(currentDeck, bctx.handSize - newHand.length, rng);
            currentHandCards = [...newHand, ...redraw.cards];
            currentDeck = redraw.deck;
            // Mark newly drawn debuffed cards
            if (bctx.debuffRanks || bctx.debuffSuits || cardsScoredThisAnte.size > 0 || verdantDebuffActive) {
              for (const card of redraw.cards) {
                if (verdantDebuffActive ||
                    (bctx.debuffRanks && bctx.debuffRanks.includes(card.rank)) ||
                    (bctx.debuffSuits && bctx.debuffSuits.includes(card.suit)) ||
                    cardsScoredThisAnte.has(card.id)) {
                  card.debuffed = true;
                }
              }
            }
          }
          discardsUsed++;
        }
      }

      // Record round result
      if (finalScoredPlay) {
        const blindName = blind.bossId
          ? (BOSS_BLINDS[blind.bossId]?.name ?? 'Boss Blind')
          : (blind.type === BlindType.Small ? 'Small Blind' :
             blind.type === BlindType.Big ? 'Big Blind' : 'Boss Blind');

        const jokerIds = state.jokers.map(j => j.id);
        const baseEarnings = calculateRoundEarnings(cumulativeDollars, blindBeaten, jokerIds);
        const jokerIncome = blindBeaten ? calculateJokerIncome({
          jokers: state.jokers,
          deck: currentDeck,
          discardsUsed,
          maxDiscards: bctx.maxDiscards,
          cumulativeDollars,
          playedCards: finalCardsPlayed,
          heldCards: finalCardsHeld,
          roundNumber: ante,
          totalCardsDiscarded: totalCardsDiscardedThisBlind,
        }) : 0;
        const earnings = baseEarnings + jokerIncome;
        totalEarnings += earnings;
        cumulativeDollars += earnings;

        rounds.push({
          ante,
          blindType: blind.type,
          blindName,
          bossId: blind.bossId,
          chipsRequired: bctx.chipsRequired,
          handTypePlayed: finalHandType,
          cardsPlayed: finalCardsPlayed,
          cardsHeld: finalCardsHeld,
          totalScore: finalScoredPlay.finalScore,
          blindBeaten,
          handsUsed: blindBeaten ? handsPlayed + 1 : handsPlayed,
          discardsUsed,
          scoreBreakdown: finalScoredPlay,
          jokersAtRound,
          handLevelsAtRound: cloneHandLevels(effectiveHandLevels),
          roundEarnings: earnings,
          cumulativeDollars,
        });

        if (!blindBeaten) {
          finalBlind = 'lost';
          break anteLoop;
        }
      } else {
        // No valid play at all
        rounds.push({
          ante,
          blindType: blind.type,
          blindName: blind.bossId ? (BOSS_BLINDS[blind.bossId]?.name ?? 'Boss Blind') : 'Small Blind',
          bossId: blind.bossId,
          chipsRequired: bctx.chipsRequired,
          handTypePlayed: HandType.HighCard,
          cardsPlayed: [],
          cardsHeld: [],
          totalScore: 0,
          blindBeaten: false,
          handsUsed: 0,
          discardsUsed: 0,
          scoreBreakdown: { finalScore: 0 } as ScoringBreakdown,
          jokersAtRound,
          handLevelsAtRound: cloneHandLevels(effectiveHandLevels),
          roundEarnings: 0,
          cumulativeDollars,
        });
        finalBlind = 'lost';
        break anteLoop;
      }

      // Update state for next blind
      state.handLevels = effectiveHandLevels;
      state.deckComposition = currentDeck;
      state.roundState.dollars = cumulativeDollars;

      // Shop phase (only if blind beaten)
      if (blindBeaten && cfg.enableShop) {
        cumulativeDollars = runShopPhase(state, cumulativeDollars, rng, effectiveHandLevels);
      }

      // Reset for next blind
      state.handCards = [];
    }

    // All 3 blinds beaten for this ante
    finalBlind = 'won';
  }

  // Final state snapshot
  const endingState = cloneGameState(state);
  endingState.roundState.dollars = cumulativeDollars;

  // Calculate totals
  const totalScore = rounds.reduce((sum, r) => sum + r.totalScore, 0);
  const beatenRounds = rounds.filter(r => r.blindBeaten).length;
  const winningAntes = rounds.filter(r => r.blindBeaten && r.blindType === BlindType.Boss).length;

  return {
    config: cfg,
    rounds,
    totalScore,
    antesCleared: winningAntes,
    roundsSurvived: beatenRounds,
    finalAnte,
    finalBlind: finalBlind === 'won' ? 'won' : finalBlind,
    totalEarnings,
    finalDollars: cumulativeDollars,
    startingState,
    endingState,
    totalSimulationTimeMs: performance.now() - startTime,
  };
}
