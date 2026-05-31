import type { GameState, DeckComposition } from './types';
import { HandType, CardEdition, Rank, CardEnhancement } from './types';
import { HAND_DEFINITIONS, getHandBaseChips, getHandBaseMult } from './constants';
import { findOptimalPlay } from './search';
import { getAllJokers } from './jokers/registry';
import type { ModShopData, ModHeldConsumable } from './mod-protocol';

// ─── Booster Pack Types ────────────────────────────────────────

export enum BoosterType {
  Arcana = 'arcana',       // Tarot cards (3-5 choices)
  Celestial = 'celestial', // Planet cards (3-5 choices)
  Spectral = 'spectral',   // Spectral cards (2 choices)
  Standard = 'standard',   // Playing cards (3 choices)
  Buffoon = 'buffoon',     // Joker cards (2 choices)
}

export interface BoosterSlot {
  type: BoosterType;
  price: number;
}

// ─── Shop Items ────────────────────────────────────────────────

export interface TarotItem {
  type: 'tarot';
  id: string;
  name: string;
  nameZh: string;
  price: number;
  effectDesc: string;
  effectDescZh: string;
  utilityFn: (state: GameState) => number;
}

export interface PlanetItem {
  type: 'planet';
  id: string;
  handType: HandType;
  name: string;
  nameZh: string;
  price: number;
  utilityFn: (state: GameState) => number;
}

export interface JokerShopItem {
  type: 'joker';
  jokerId: string;
  name: string;
  nameZh: string;
  price: number;
  utilityFn: (state: GameState) => number;
}

export interface VoucherItem {
  type: 'voucher';
  id: string;
  name: string;
  nameZh: string;
  price: number;
  utilityFn: (state: GameState) => number;
}

export interface CardShopItem {
  type: 'card';
  id: string;
  name: string;
  nameZh: string;
  price: number;
}

export type ShopItem = TarotItem | PlanetItem | JokerShopItem | VoucherItem | CardShopItem;

export interface ShopSlot {
  label: string;
  item: ShopItem | null;
  itemType: 'joker' | 'tarot' | 'planet' | 'card' | 'voucher' | 'pack';
  pack?: BoosterSlot;
}

export interface ShopState {
  slots: ShopSlot[];
  rerollCost: number;
}

// ─── Tarot Cards ────────────────────────────────────────────────

const TAROT_CARDS: Omit<TarotItem, 'price'>[] = [
  {
    type: 'tarot' as const, id: 'the_fool', name: 'The Fool', nameZh: '愚者',
    effectDesc: 'Creates the last Tarot/Planet card used', effectDescZh: '复制最后使用的塔罗/星球牌',
    utilityFn: (_s) => 0.15,
  },
  {
    type: 'tarot' as const, id: 'the_magician', name: 'The Magician', nameZh: '魔术师',
    effectDesc: '+5 Mult (enhances 1 selected card)', effectDescZh: '强化1张牌为+5倍率',
    utilityFn: (s) => {
      const unenhanced = s.deckComposition.enhancementCounts?.[CardEnhancement.None] ?? s.deckComposition.totalCards;
      return unenhanced > 10 ? 0.12 : 0.05;
    },
  },
  {
    type: 'tarot' as const, id: 'the_high_priestess', name: 'The High Priestess', nameZh: '女祭司',
    effectDesc: '+30 Chips (enhances 1 selected card)', effectDescZh: '强化1张牌为+30筹码',
    utilityFn: (s) => {
      const unenhanced = s.deckComposition.enhancementCounts?.[CardEnhancement.None] ?? s.deckComposition.totalCards;
      return unenhanced > 10 ? 0.12 : 0.05;
    },
  },
  {
    type: 'tarot' as const, id: 'the_empress', name: 'The Empress', nameZh: '女皇',
    effectDesc: '+4 Mult (enhances 1 selected card)', effectDescZh: '强化1张牌为+4倍率',
    utilityFn: (s) => {
      const unenhanced = s.deckComposition.enhancementCounts?.[CardEnhancement.None] ?? s.deckComposition.totalCards;
      return unenhanced > 10 ? 0.15 : 0.06;
    },
  },
  {
    type: 'tarot' as const, id: 'the_emperor', name: 'The Emperor', nameZh: '皇帝',
    effectDesc: '+2 hand size for 1 round', effectDescZh: '当前回合手牌上限+2',
    utilityFn: (_s) => 0.18,
  },
  {
    type: 'tarot' as const, id: 'the_hierophant', name: 'The Hierophant', nameZh: '教皇',
    effectDesc: '+2 hand size for 1 round', effectDescZh: '当前回合手牌上限+2',
    utilityFn: (_s) => 0.18,
  },
  {
    type: 'tarot' as const, id: 'the_lovers', name: 'The Lovers', nameZh: '恋人',
    effectDesc: 'Enhances 1 card to Wild', effectDescZh: '强化1张牌为百搭',
    utilityFn: (s) => {
      const suitCounts = Object.values(s.deckComposition.remainingBySuit ?? {});
      const suitImbalance = suitCounts.length > 0 ? Math.max(...suitCounts) - Math.min(...suitCounts) : 0;
      return suitImbalance > 5 ? 0.15 : 0.08;
    },
  },
  {
    type: 'tarot' as const, id: 'the_chariot', name: 'The Chariot', nameZh: '战车',
    effectDesc: 'Enhances 1 card to Steel', effectDescZh: '强化1张牌为钢铁',
    utilityFn: (s) => {
      const unenhanced = s.deckComposition.enhancementCounts?.[CardEnhancement.None] ?? s.deckComposition.totalCards;
      const hasMime = s.jokers.some(j => j.id === 'mime');
      let util = 0.12 + (unenhanced > 15 ? 0.08 : unenhanced > 5 ? 0.04 : 0);
      if (hasMime) util += 0.1;
      return util;
    },
  },
  {
    type: 'tarot' as const, id: 'justice', name: 'Justice', nameZh: '正义',
    effectDesc: 'Enhances 1 card to Glass', effectDescZh: '强化1张牌为玻璃',
    utilityFn: (s) => {
      const unenhanced = s.deckComposition.enhancementCounts?.[CardEnhancement.None] ?? s.deckComposition.totalCards;
      return 0.12 + (unenhanced > 10 ? 0.10 : unenhanced > 3 ? 0.05 : 0);
    },
  },
  {
    type: 'tarot' as const, id: 'the_hermit', name: 'The Hermit', nameZh: '隐士',
    effectDesc: 'Doubles money (max $20)', effectDescZh: '金币翻倍（最多$20）',
    utilityFn: (_s) => 0.08,
  },
  {
    type: 'tarot' as const, id: 'wheel_of_fortune', name: 'Wheel of Fortune', nameZh: '命运之轮',
    effectDesc: '1/4 chance to add Foil/Holo/Poly to random joker', effectDescZh: '1/4概率给随机小丑牌添加版本',
    utilityFn: (_s) => 0.25,
  },
  {
    type: 'tarot' as const, id: 'strength', name: 'Strength', nameZh: '力量',
    effectDesc: 'Increases rank of 1 selected card by 1', effectDescZh: '将1张牌的点数+1',
    utilityFn: (_s) => 0.08,
  },
  {
    type: 'tarot' as const, id: 'the_hanged_man', name: 'The Hanged Man', nameZh: '倒吊人',
    effectDesc: 'Destroys 1 selected card', effectDescZh: '摧毁1张选中的牌',
    utilityFn: (_s) => 0.05,
  },
  {
    type: 'tarot' as const, id: 'death', name: 'Death', nameZh: '死神',
    effectDesc: 'Converts 1 card to copy of another', effectDescZh: '将1张牌复制为另一张',
    utilityFn: (_s) => 0.14,
  },
  {
    type: 'tarot' as const, id: 'temperance', name: 'Temperance', nameZh: '节制',
    effectDesc: 'Gives total sell value of all jokers (max $50)', effectDescZh: '获得所有小丑牌售价之和（最多$50）',
    utilityFn: (_s) => 0.06,
  },
  {
    type: 'tarot' as const, id: 'the_devil', name: 'The Devil', nameZh: '恶魔',
    effectDesc: 'Enhances 1 card to Gold', effectDescZh: '强化1张牌为黄金',
    utilityFn: (s) => {
      const unenhanced = s.deckComposition.enhancementCounts?.[CardEnhancement.None] ?? s.deckComposition.totalCards;
      return unenhanced > 8 ? 0.08 : 0.03;
    },
  },
  {
    type: 'tarot' as const, id: 'the_tower', name: 'The Tower', nameZh: '塔',
    effectDesc: 'Enhances 1 card to Stone', effectDescZh: '强化1张牌为石头',
    utilityFn: (s) => {
      const unenhanced = s.deckComposition.enhancementCounts?.[CardEnhancement.None] ?? s.deckComposition.totalCards;
      const hasStoneJoker = s.jokers.some(j => j.id === 'stone_joker');
      let util = unenhanced > 8 ? 0.10 : 0.04;
      if (hasStoneJoker) util += 0.12;
      return util;
    },
  },
  {
    type: 'tarot' as const, id: 'the_star', name: 'The Star', nameZh: '星星',
    effectDesc: 'Converts 1 card to Diamonds', effectDescZh: '将1张牌转为方块',
    utilityFn: (_s) => 0.08,
  },
  {
    type: 'tarot' as const, id: 'the_moon', name: 'The Moon', nameZh: '月亮',
    effectDesc: 'Converts 1 card to Clubs', effectDescZh: '将1张牌转为梅花',
    utilityFn: (_s) => 0.08,
  },
  {
    type: 'tarot' as const, id: 'the_sun', name: 'The Sun', nameZh: '太阳',
    effectDesc: 'Converts 1 card to Hearts', effectDescZh: '将1张牌转为红心',
    utilityFn: (_s) => 0.08,
  },
  {
    type: 'tarot' as const, id: 'judgement', name: 'Judgement', nameZh: '审判',
    effectDesc: 'Creates a random joker', effectDescZh: '随机生成一个小丑牌',
    utilityFn: (_s) => 0.30,
  },
  {
    type: 'tarot' as const, id: 'the_world', name: 'The World', nameZh: '世界',
    effectDesc: 'Converts 1 card to Spades', effectDescZh: '将1张牌转为黑桃',
    utilityFn: (_s) => 0.08,
  },
];

// ─── Deck Synergy Helper ──────────────────────────────────────

function getDeckPairPotential(deck: DeckComposition): number {
  const rankCounts = deck.remainingByRank;
  let pairBonus = 0;
  for (const count of Object.values(rankCounts)) {
    if (count >= 4) pairBonus += 0.08;
    else if (count >= 3) pairBonus += 0.05;
    else if (count >= 2) pairBonus += 0.03;
  }
  return Math.min(pairBonus, 0.2);
}

function getDeckFlushPotential(deck: DeckComposition): number {
  const suitCounts = deck.remainingBySuit;
  let maxSuit = 0;
  for (const count of Object.values(suitCounts)) {
    if (count > maxSuit) maxSuit = count;
  }
  return maxSuit >= 10 ? 0.15 : maxSuit >= 8 ? 0.08 : 0;
}

const PAIR_HANDS = new Set([HandType.Pair, HandType.TwoPair, HandType.ThreeOfAKind, HandType.FullHouse, HandType.FourOfAKind, HandType.FiveOfAKind]);
const FLUSH_HANDS = new Set([HandType.Flush, HandType.FlushHouse, HandType.FlushFive, HandType.StraightFlush, HandType.RoyalFlush]);

// ─── Planet Cards ───────────────────────────────────────────────

function makePlanetItem(handType: HandType): PlanetItem {
  const def = HAND_DEFINITIONS[handType];
  return {
    type: 'planet' as const,
    id: def.planetCard.toLowerCase().replace(' ', '_'),
    handType,
    name: def.planetCard,
    nameZh: def.planetCard,
    price: 3,
    utilityFn: (state: GameState) => {
      const currentLevel = state.handLevels[handType] ?? 1;
      const baseChips = getHandBaseChips(handType, currentLevel);
      const baseMult = getHandBaseMult(handType, currentLevel);
      const upgradedChips = getHandBaseChips(handType, currentLevel + 1);
      const upgradedMult = getHandBaseMult(handType, currentLevel + 1);
      const currentBase = baseChips * baseMult;
      const upgradedBase = upgradedChips * upgradedMult;
      if (currentBase === 0) return 0;
      const baseUtility = (upgradedBase - currentBase) / currentBase;

      // Deck synergy bonus
      const deck = state.deckComposition;
      let synergy = 0;
      if (PAIR_HANDS.has(handType)) {
        synergy = getDeckPairPotential(deck);
      } else if (FLUSH_HANDS.has(handType)) {
        synergy = getDeckFlushPotential(deck);
      }

      return baseUtility + synergy;
    },
  };
}

const PLANET_CARDS: PlanetItem[] = Object.values(HandType).map(makePlanetItem);

// ─── Vouchers ──────────────────────────────────────────────────

const VOUCHERS: VoucherItem[] = [
  {
    type: 'voucher', id: 'grabber', name: 'Grabber', nameZh: '抓取臂', price: 5,
    utilityFn: (_s) => 0.20,
  },
  {
    type: 'voucher', id: 'nacho_tong', name: 'Nacho Tong', nameZh: '纳乔钳', price: 5,
    utilityFn: (_s) => 0.20,
  },
  {
    type: 'voucher', id: 'wasteful', name: 'Wasteful', nameZh: '浪费', price: 5,
    utilityFn: (_s) => 0.15,
  },
  {
    type: 'voucher', id: 'recyclomancy', name: 'Recyclomancy', nameZh: '回收术', price: 5,
    utilityFn: (_s) => 0.15,
  },
  {
    type: 'voucher', id: 'paint_brush', name: 'Paint Brush', nameZh: '画笔', price: 5,
    utilityFn: (_s) => 0.25,
  },
  {
    type: 'voucher', id: 'palette', name: 'Palette', nameZh: '调色板', price: 5,
    utilityFn: (_s) => 0.25,
  },
  {
    type: 'voucher', id: 'overstock', name: 'Overstock', nameZh: '库存过剩', price: 5,
    utilityFn: (_s) => 0.10,
  },
  {
    type: 'voucher', id: 'clearance_sale', name: 'Clearance Sale', nameZh: '清仓大甩卖', price: 5,
    utilityFn: (_s) => 0.12,
  },
];

// ─── Joker Utility (simplified) ────────────────────────────────

function getJokerUtility(jokerId: string, state: GameState): number {
  // Try adding this joker and see how much score improves
  try {
    const originalResult = findOptimalPlay(state, { includeJokerOrdering: true, maxComputationMs: 5000 });
    if (!originalResult) return 0.1; // unknown, assume some value

    const testState: GameState = {
      ...state,
      jokers: [...state.jokers, { id: jokerId, edition: CardEdition.None }],
    };
    const testResult = findOptimalPlay(testState, { includeJokerOrdering: true, maxComputationMs: 5000 });

    if (!testResult || originalResult.totalScore === 0) return 0.1;
    let utility = (testResult.totalScore - originalResult.totalScore) / originalResult.totalScore;

    // Deck synergy bonuses
    const deck = state.deckComposition;
    const steelCount = deck.enhancementCounts?.[CardEnhancement.Steel] ?? 0;
    const faceCount = (deck.remainingByRank?.[Rank.King] ?? 0) + (deck.remainingByRank?.[Rank.Queen] ?? 0) + (deck.remainingByRank?.[Rank.Jack] ?? 0);

    if (jokerId === 'mime' && steelCount >= 3) utility += 0.15;
    if ((jokerId === 'bull' || jokerId === 'bootstrap') && state.roundState.dollars > 20) utility += 0.1;
    if ((jokerId === 'smiley_face' || jokerId === 'scary_face' || jokerId === 'sock_and_buskin' || jokerId === 'photograph') && faceCount >= 8) utility += 0.08;
    if (jokerId === 'erosion' && deck.totalCards < 40) utility += 0.1;
    if (jokerId === 'blue_joker' && deck.totalCards > 45) utility += 0.1;

    return utility;
  } catch {
    return 0.1;
  }
}

// ─── Shop Generation ──────────────────────────────────────────

const BOOSTER_PRICES: Record<BoosterType, number> = {
  [BoosterType.Arcana]: 4,
  [BoosterType.Celestial]: 4,
  [BoosterType.Spectral]: 5,
  [BoosterType.Standard]: 3,
  [BoosterType.Buffoon]: 5,
};

const ALL_BOOSTER_TYPES = [
  BoosterType.Arcana,
  BoosterType.Celestial,
  BoosterType.Spectral,
  BoosterType.Standard,
  BoosterType.Buffoon,
];

function randomPick<T>(arr: T[], rng?: () => number): T {
  const rand = rng ? rng() : Math.random();
  return arr[Math.floor(rand * arr.length)];
}

export interface GeneratedShop {
  state: ShopState;
  jokerUtility: number;
  tarotUtility: number;
  planetUtility: number;
  voucherUtility: number;
  pack1Utility: number;
  pack2Utility: number;
  bestPurchase: string;
}

export function generateShop(gameState: GameState, dollars: number, rng?: () => number): GeneratedShop {
  // Pick 2 random booster pack types
  const packType1 = randomPick(ALL_BOOSTER_TYPES, rng);
  let packType2 = randomPick(ALL_BOOSTER_TYPES, rng);
  while (packType2 === packType1) {
    packType2 = randomPick(ALL_BOOSTER_TYPES, rng);
  }

  const pack1: BoosterSlot = { type: packType1, price: BOOSTER_PRICES[packType1] };
  const pack2: BoosterSlot = { type: packType2, price: BOOSTER_PRICES[packType2] };

  // Random joker from full pool
  const allJokers = getAllJokers();
  const pickedJoker = allJokers.length > 0 ? randomPick(allJokers, rng) : null;
  const jokerItemId = pickedJoker?.id ?? 'joker';
  const jokerPrice = pickedJoker?.cost ?? 5;

  // Random tarot
  const tarot = randomPick(TAROT_CARDS, rng);
  // Random planet
  const planet = randomPick(PLANET_CARDS, rng);
  // Random voucher
  const voucher = randomPick(VOUCHERS, rng);

  // Compute utilities
  const jokerU = getJokerUtility(jokerItemId, gameState);
  const tarotU = tarot.utilityFn(gameState);
  const planetU = planet.utilityFn(gameState);
  const voucherU = voucher.utilityFn(gameState);

  // Pack utility = expected value of best card inside
  const pack1U = getBoosterPackUtility(packType1, gameState);
  const pack2U = getBoosterPackUtility(packType2, gameState);

  // Determine best purchase (highest utility per dollar)
  const purchases: { name: string; utility: number; price: number }[] = [
    { name: 'Pack 1', utility: pack1U, price: pack1.price },
    { name: 'Pack 2', utility: pack2U, price: pack2.price },
    { name: 'Joker', utility: jokerU, price: jokerPrice },
    { name: 'Tarot', utility: tarotU, price: 3 },
    { name: 'Planet', utility: planetU, price: 3 },
    { name: 'Voucher', utility: voucherU, price: voucher.price },
  ];

  const affordable = purchases.filter(p => p.price <= dollars);
  const best = affordable.length > 0
    ? affordable.reduce((a, b) => (a.utility / a.price) > (b.utility / b.price) ? a : b)
    : purchases[0];

  const slots: ShopSlot[] = [
    { label: 'Pack 1', item: null, itemType: 'pack', pack: pack1 },
    { label: 'Pack 2', item: null, itemType: 'pack', pack: pack2 },
    {
      label: 'Joker', itemType: 'joker',
      item: { type: 'joker', jokerId: jokerItemId, name: jokerItemId, nameZh: jokerItemId, price: jokerPrice, utilityFn: () => jokerU },
    },
    {
      label: 'Tarot', itemType: 'tarot',
      item: { ...tarot, price: 3 },
    },
    {
      label: 'Planet', itemType: 'planet',
      item: { ...planet, price: 3 },
    },
    {
      label: 'Card', itemType: 'card',
      item: { type: 'card', id: 'random_card', name: 'Playing Card', nameZh: '扑克牌', price: 1 },
    },
    {
      label: 'Voucher', itemType: 'voucher',
      item: { ...voucher, price: voucher.price },
    },
  ];

  return {
    state: { slots, rerollCost: 5 },
    jokerUtility: jokerU,
    tarotUtility: tarotU,
    planetUtility: planetU,
    voucherUtility: voucherU,
    pack1Utility: pack1U,
    pack2Utility: pack2U,
    bestPurchase: best.name,
  };
}

function getBoosterPackUtility(type: BoosterType, state: GameState): number {
  switch (type) {
    case BoosterType.Arcana: {
      const utils = TAROT_CARDS.map(t => t.utilityFn(state));
      return Math.max(...utils) * 0.7; // 3-5 choices, best pick
    }
    case BoosterType.Celestial: {
      const utils = PLANET_CARDS.map(p => p.utilityFn(state));
      return Math.max(...utils) * 0.7;
    }
    case BoosterType.Spectral:
      return 0.30; // Spectral cards are high variance
    case BoosterType.Standard:
      return 0.05; // Standard cards are low value
    case BoosterType.Buffoon:
      return 0.35; // Joker packs have high potential
  }
}

// ─── Real Shop Analysis (uses mod data, not random) ──────────────

export interface RealShopRecommendation {
  /** What to buy/use */
  label: string;
  /** Item type */
  itemType: 'joker' | 'tarot' | 'planet' | 'voucher' | 'pack' | 'held_tarot' | 'held_planet' | 'held_spectral';
  /** Item name */
  name: string;
  /** Item name in Chinese */
  nameZh: string;
  /** Cost in dollars (0 for held consumables) */
  price: number;
  /** Utility score (higher = better) */
  utility: number;
  /** Whether the player can afford this */
  canAfford: boolean;
  /** Utility-per-dollar ratio */
  valueRatio: number;
}

export interface RealShopAnalysis {
  /** Ranked list of recommendations (best first) */
  recommendations: RealShopRecommendation[];
  /** Best single action to take */
  bestAction: RealShopRecommendation | null;
  /** Summary text */
  summary: string;
  /** Summary in Chinese */
  summaryZh: string;
  /** Joker utility from real shop */
  jokerUtility: number;
  /** Tarot utility from real shop */
  tarotUtility: number;
  /** Planet utility from real shop */
  planetUtility: number;
  /** Voucher utility from real shop */
  voucherUtility: number;
  /** Best held consumable to use */
  bestHeldConsumable: RealShopRecommendation | null;
}

/**
 * Analyze the player's real shop data (from mod) and held consumables
 * to produce ranked, actionable recommendations.
 */
export function analyzeRealShop(
  gameState: GameState,
  dollars: number,
  shopData: ModShopData | undefined,
  heldConsumables: ModHeldConsumable[],
): RealShopAnalysis {
  const recommendations: RealShopRecommendation[] = [];

  // ── 1. Evaluate real shop jokers ──────────────────────────────
  if (shopData?.jokers && shopData.jokers.length > 0) {
    for (const sj of shopData.jokers) {
      const util = getJokerUtility(sj.id, gameState);
      const canAfford = dollars >= sj.price;
      recommendations.push({
        label: 'Shop Joker',
        itemType: 'joker',
        name: sj.id,
        nameZh: sj.id,
        price: sj.price,
        utility: util,
        canAfford,
        valueRatio: sj.price > 0 ? util / sj.price : util,
      });
    }
  }

  // ── 2. Evaluate real shop tarot/consumable ────────────────────
  if (shopData?.consumable) {
    const cons = shopData.consumable;
    const tarotDef = TAROT_CARDS.find(t => t.id === cons.id);
    if (tarotDef) {
      const util = tarotDef.utilityFn(gameState);
      const canAfford = dollars >= cons.price;
      recommendations.push({
        label: 'Shop Card',
        itemType: 'tarot',
        name: tarotDef.name,
        nameZh: tarotDef.nameZh,
        price: cons.price,
        utility: util,
        canAfford,
        valueRatio: cons.price > 0 ? util / cons.price : util,
      });
    } else {
      // Unknown consumable (planet or spectral in shop slot)
      const planetDef = PLANET_CARDS.find(p => p.id === cons.id);
      const isPlanet = !!planetDef;
      const util = planetDef ? planetDef.utilityFn(gameState) : 0.08;
      const canAfford = dollars >= cons.price;
      recommendations.push({
        label: isPlanet ? 'Shop Planet' : 'Shop Card',
        itemType: isPlanet ? 'planet' : 'tarot',
        name: cons.id,
        nameZh: cons.id,
        price: cons.price,
        utility: util,
        canAfford,
        valueRatio: cons.price > 0 ? util / cons.price : util,
      });
    }
  }

  // ── 3. Evaluate real shop voucher ─────────────────────────────
  if (shopData?.voucher) {
    const v = shopData.voucher;
    const voucherDef = VOUCHERS.find(vd => vd.id === v.id);
    const util = voucherDef ? voucherDef.utilityFn(gameState) : 0.1;
    const canAfford = dollars >= v.price;
    recommendations.push({
      label: 'Shop Voucher',
      itemType: 'voucher',
      name: v.id,
      nameZh: v.id,
      price: v.price,
      utility: util,
      canAfford,
      valueRatio: v.price > 0 ? util / v.price : util,
    });
  }

  // ── 4. Evaluate booster packs ─────────────────────────────────
  if (shopData?.boosters && shopData.boosters.length > 0) {
    for (const bp of shopData.boosters) {
      let packUtil = 0.15; // default
      const bpType = bp.type?.toLowerCase() ?? '';
      if (bpType.includes('arcana') || bpType.includes('tarot')) {
        const utils = TAROT_CARDS.map(t => t.utilityFn(gameState));
        packUtil = Math.max(...utils) * 0.7;
      } else if (bpType.includes('celestial') || bpType.includes('planet')) {
        const utils = PLANET_CARDS.map(p => p.utilityFn(gameState));
        packUtil = Math.max(...utils) * 0.7;
      } else if (bpType.includes('spectral')) {
        packUtil = 0.30;
      } else if (bpType.includes('buffoon') || bpType.includes('joker')) {
        packUtil = 0.35;
      } else if (bpType.includes('standard')) {
        packUtil = 0.05;
      }
      const canAfford = dollars >= bp.price;
      recommendations.push({
        label: 'Booster Pack',
        itemType: 'pack',
        name: bp.type ?? 'Pack',
        nameZh: bp.type ?? '补充包',
        price: bp.price,
        utility: packUtil,
        canAfford,
        valueRatio: bp.price > 0 ? packUtil / bp.price : packUtil,
      });
    }
  }

  // ── 5. Evaluate held consumables (should I use one now?) ──────
  let bestHeldConsumable: RealShopRecommendation | null = null;
  for (const hc of heldConsumables) {
    let util = 0;
    let itemType: RealShopRecommendation['itemType'] = 'held_tarot';
    let name = hc.name;
    let nameZh = hc.name;

    if (hc.type === 'tarot') {
      itemType = 'held_tarot';
      const tarotDef = TAROT_CARDS.find(t => t.id === hc.id);
      if (tarotDef) {
        util = tarotDef.utilityFn(gameState);
        name = tarotDef.name;
        nameZh = tarotDef.nameZh;
      } else {
        util = 0.08; // unknown tarot
      }
      // Bonus: held tarot is "free" to use (already paid for)
      util *= 1.2;
    } else if (hc.type === 'planet') {
      itemType = 'held_planet';
      const planetDef = PLANET_CARDS.find(p => p.id === hc.id);
      if (planetDef) {
        util = planetDef.utilityFn(gameState);
        name = planetDef.name;
      } else {
        util = 0.10;
      }
      util *= 1.1;
    } else if (hc.type === 'spectral') {
      itemType = 'held_spectral';
      util = 0.25; // spectral cards are powerful but situational
      nameZh = '光谱牌';
    }

    const rec: RealShopRecommendation = {
      label: hc.highlighted ? 'Selected' : 'Held',
      itemType,
      name,
      nameZh,
      price: 0, // free to use (already owned)
      utility: util,
      canAfford: true,
      valueRatio: util, // infinite value ratio since free
    };
    recommendations.push(rec);

    if (!bestHeldConsumable || util > bestHeldConsumable.utility) {
      bestHeldConsumable = rec;
    }
  }

  // ── 6. Sort by value ratio (utility per dollar) ───────────────
  recommendations.sort((a, b) => {
    // Held consumables (price=0) always float to top
    if (a.price === 0 && b.price === 0) return b.utility - a.utility;
    if (a.price === 0) return -1;
    if (b.price === 0) return 1;
    return b.valueRatio - a.valueRatio;
  });

  const bestAction = recommendations.length > 0 ? recommendations[0] : null;

  // ── 7. Build summaries ────────────────────────────────────────
  const extractUtils = () => {
    const jUtil = shopData?.jokers?.length
      ? Math.max(...shopData.jokers.map(sj => getJokerUtility(sj.id, gameState)))
      : 0;
    const tUtil = recommendations.find(r => r.itemType === 'tarot')?.utility ?? 0;
    const pUtil = recommendations.find(r => r.itemType === 'planet')?.utility ?? 0;
    const vUtil = recommendations.find(r => r.itemType === 'voucher')?.utility ?? 0;
    return { jUtil, tUtil, pUtil, vUtil };
  };
  const utils = extractUtils();

  let summary = 'No shop data available.';
  let summaryZh = '无商店数据。';

  if (bestAction) {
    if (bestAction.itemType.startsWith('held_')) {
      summary = `Use your held "${bestAction.name}" — it's free and has high value.`;
      summaryZh = `使用手中的「${bestAction.nameZh}」—— 免费且价值高。`;
    } else if (bestAction.canAfford) {
      summary = `Buy "${bestAction.name}" ($${bestAction.price}) — best value at ${(bestAction.valueRatio * 100).toFixed(1)}% util/$.`;
      summaryZh = `购买「${bestAction.nameZh}」($${bestAction.price}) — 性价比最高，效用比 ${(bestAction.valueRatio * 100).toFixed(1)}%。`;
    } else {
      const affordable = recommendations.filter(r => r.canAfford && r.price > 0);
      if (affordable.length > 0) {
        summary = `Can't afford best pick. Buy "${affordable[0].name}" instead.`;
        summaryZh = `余额不足，改买「${affordable[0].nameZh}」。`;
      } else {
        summary = 'Not enough money for any shop item. Consider using held consumables.';
        summaryZh = '余额不足以购买任何商品，考虑使用手中消耗牌。';
      }
    }
  }

  return {
    recommendations,
    bestAction,
    summary,
    summaryZh,
    jokerUtility: utils.jUtil,
    tarotUtility: utils.tUtil,
    planetUtility: utils.pUtil,
    voucherUtility: utils.vUtil,
    bestHeldConsumable,
  };
}

// ─── Re-export tarot/planet data for UI ────────────────────────

export { TAROT_CARDS, PLANET_CARDS, VOUCHERS, BOOSTER_PRICES, ALL_BOOSTER_TYPES };
