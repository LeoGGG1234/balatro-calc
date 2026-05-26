import type { HandType, JokerRarity, CardEnhancement, CardEdition, Seal, BlindType } from '../engine/types';

export interface Translations {
  // App
  app: {
    title: string;
    subtitle: string;
    footer: string;
  };

  // Tabs
  tabs: {
    input: string;
    discard: string;
    results: string;
    shop: string;
    runSim: string;
  };

  // Buttons
  buttons: {
    compute: string;
    computing: string;
    backToInput: string;
    add: string;
    remove: string;
    reroll: string;
    buy: string;
  };

  // Sections
  sections: {
    handCards: string;
    jokers: string;
    handLevels: string;
    gameInfo: string;
    roundSettings: string;
    optimalPlay: string;
    scoringBreakdown: string;
    allHandsComparison: string;
  };

  // Fields
  fields: {
    blindType: string;
    chipsRequired: string;
    ante: string;
    handsPlayed: string;
    discardsUsed: string;
    deckRemaining: string;
    finalHand: string;
    maxHands: string;
    maxDiscards: string;
    handSize: string;
    activeVouchers: string;
    bossEffect: string;
    dollars: string;
  };

  // Blind types
  blindTypes: Record<BlindType, string>;

  // Hand type names
  handTypes: Record<HandType, string>;

  // Rarity labels
  rarities: Record<JokerRarity, string>;

  // Enhancement labels
  enhancements: Record<CardEnhancement, string>;
  enhancementsLong: Record<CardEnhancement, string>;

  // Edition labels
  editions: Record<CardEdition, string>;
  editionsLong: Record<CardEdition, string>;

  // Seal labels
  seals: Record<Seal, string>;
  sealsLong: Record<Seal, string>;

  // Joker names
  jokerNames: Record<string, string>;

  // Results
  results: {
    playTheseCards: string;
    held: string;
    jokerOrder: string;
    base: string;
    cards: string;
    jokers: string;
    rank: string;
    handType: string;
    bestScore: string;
    combinations: string;
    evaluated: string;
    in: string;
    vsBlind: string;
    score: string;
    handType2: string;
  };

  // States
  states: {
    computing: string;
    evaluating: string;
    noValidPlay: string;
    idleMessage: string;
    error: string;
    searchPlaceholder: string;
    emptySlots: string;
    level: string;
  };

  // Shop
  shop: {
    title: string;
    boosterPack: string;
    jokerSlot: string;
    tarotSlot: string;
    planetSlot: string;
    cardSlot: string;
    voucherSlot: string;
    utility: string;
    price: string;
    buyRecommendation: string;
    bestValue: string;
    goodValue: string;
    averageValue: string;
    packPreview: string;
    arcanaPack: string;
    celestialPack: string;
    spectralPack: string;
    standardPack: string;
    buffoonPack: string;
    voucherNames: Record<string, string>;
    bossEffectNames: Record<string, string>;
  };

  // Deck
  deck: {
    title: string;
    total: string;
    byRank: string;
    bySuit: string;
    specialCards: string;
    standardPreset: string;
    addCard: string;
    removeCard: string;
    quickMode: string;
    fullMode: string;
    visualMode: string;
    addSpecificCard: string;
    removeSpecificCard: string;
    enhancement: string;
    edition: string;
    seal: string;
    presetAbandoned: string;
    presetCheckered: string;
    batchApply: string;
    clearModifiers: string;
    addDuplicate: string;
    removeOne: string;
    noCards: string;
  };

  // Discard
  discard: {
    title: string;
    analyze: string;
    analyzing: string;
    currentBest: string;
    discardsRemaining: string;
    discardThese: string;
    keepThese: string;
    targetHand: string;
    improvement: string;
    noBeneficial: string;
    idleMessage: string;
  };

  // Run Sim
  runSim: {
    title: string;
    config: {
      maxAntes: string;
      enableShop: string;
      randomBosses: string;
      seed: string;
    };
    runButton: string;
    running: string;
    reset: string;
    idleMessage: string;
    summary: {
      antesCleared: string;
      totalScore: string;
      roundsSurvived: string;
      finalDollars: string;
      totalTime: string;
    };
    round: {
      header: string;
      blindBeaten: string;
      blindLost: string;
      handPlayed: string;
      score: string;
      chipsRequired: string;
      handsUsed: string;
      discardsUsed: string;
      earnings: string;
      jokers: string;
      handLevels: string;
    };
    bossNames: Record<string, string>;
  };
}
