import type { GameState, DeckComposition } from './types';
import { HandType, CardEdition } from './types';
import { HAND_DEFINITIONS, getHandBaseChips, getHandBaseMult } from './constants';
import { findOptimalPlay } from './search';

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
      const unenhanced = s.deckComposition.enhancementCounts?.none ?? s.deckComposition.totalCards;
      return unenhanced > 10 ? 0.12 : 0.05;
    },
  },
  {
    type: 'tarot' as const, id: 'the_high_priestess', name: 'The High Priestess', nameZh: '女祭司',
    effectDesc: '+30 Chips (enhances 1 selected card)', effectDescZh: '强化1张牌为+30筹码',
    utilityFn: (s) => {
      const unenhanced = s.deckComposition.enhancementCounts?.none ?? s.deckComposition.totalCards;
      return unenhanced > 10 ? 0.12 : 0.05;
    },
  },
  {
    type: 'tarot' as const, id: 'the_empress', name: 'The Empress', nameZh: '女皇',
    effectDesc: '+4 Mult (enhances 1 selected card)', effectDescZh: '强化1张牌为+4倍率',
    utilityFn: (s) => {
      const unenhanced = s.deckComposition.enhancementCounts?.none ?? s.deckComposition.totalCards;
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
      const unenhanced = s.deckComposition.enhancementCounts?.none ?? s.deckComposition.totalCards;
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
      const unenhanced = s.deckComposition.enhancementCounts?.none ?? s.deckComposition.totalCards;
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
      const unenhanced = s.deckComposition.enhancementCounts?.none ?? s.deckComposition.totalCards;
      return unenhanced > 8 ? 0.08 : 0.03;
    },
  },
  {
    type: 'tarot' as const, id: 'the_tower', name: 'The Tower', nameZh: '塔',
    effectDesc: 'Enhances 1 card to Stone', effectDescZh: '强化1张牌为石头',
    utilityFn: (s) => {
      const unenhanced = s.deckComposition.enhancementCounts?.none ?? s.deckComposition.totalCards;
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
    const steelCount = deck.enhancementCounts?.steel ?? 0;
    const faceCount = (deck.remainingByRank?.['K'] ?? 0) + (deck.remainingByRank?.['Q'] ?? 0) + (deck.remainingByRank?.['J'] ?? 0);

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

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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

export function generateShop(gameState: GameState, dollars: number): GeneratedShop {
  // Pick 2 random booster pack types
  const packType1 = randomPick(ALL_BOOSTER_TYPES);
  let packType2 = randomPick(ALL_BOOSTER_TYPES);
  while (packType2 === packType1) {
    packType2 = randomPick(ALL_BOOSTER_TYPES);
  }

  const pack1: BoosterSlot = { type: packType1, price: BOOSTER_PRICES[packType1] };
  const pack2: BoosterSlot = { type: packType2, price: BOOSTER_PRICES[packType2] };

  // Random joker
  const jokerItem = randomPick(
    Array.from({ length: 5 }, () => randomPick(
      gameState.jokers.length > 0
        ? gameState.jokers.map(j => j.id)
        : ['joker', 'greedy_joker', 'sly_joker', 'smiley_face', 'scary_face']
    ))
  );

  // Random tarot
  const tarot = randomPick(TAROT_CARDS);
  // Random planet
  const planet = randomPick(PLANET_CARDS);
  // Random voucher
  const voucher = randomPick(VOUCHERS);

  // Compute utilities
  const jokerU = jokerItem ? getJokerUtility(jokerItem, gameState) : 0;
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
    { name: 'Joker', utility: jokerU, price: 5 },
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
      item: { type: 'joker', jokerId: jokerItem, name: jokerItem, nameZh: jokerItem, price: 5, utilityFn: () => jokerU },
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

// ─── Re-export tarot/planet data for UI ────────────────────────

export { TAROT_CARDS, PLANET_CARDS, VOUCHERS, BOOSTER_PRICES, ALL_BOOSTER_TYPES };
