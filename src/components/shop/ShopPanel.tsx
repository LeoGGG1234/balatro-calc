import { useState, useCallback, useEffect } from 'react';
import { useI18n } from '../../i18n/context';
import type { GameState, HandType } from '../../engine/types';
import { generateShop, BoosterType, TAROT_CARDS, PLANET_CARDS } from '../../engine/shop';
import type { GeneratedShop, BoosterSlot, ShopItem } from '../../engine/shop';
import type { Translations } from '../../i18n/types';

interface ShopPanelProps {
  gameState: GameState;
  dollars: number;
  onBuyJoker: (jokerId: string) => void;
  onUpgradeHand: (handType: HandType) => void;
  onBuyVoucher: (voucherId: string) => void;
  onDollarChange: (dollars: number) => void;
}

const BOOSTER_TYPE_NAMES: Record<BoosterType, { en: string; zh: string }> = {
  [BoosterType.Arcana]: { en: 'Arcana Pack', zh: '秘术包' },
  [BoosterType.Celestial]: { en: 'Celestial Pack', zh: '天体包' },
  [BoosterType.Spectral]: { en: 'Spectral Pack', zh: '光谱包' },
  [BoosterType.Standard]: { en: 'Standard Pack', zh: '标准包' },
  [BoosterType.Buffoon]: { en: 'Buffoon Pack', zh: '小丑包' },
};

export function ShopPanel({ gameState, dollars, onBuyJoker, onUpgradeHand, onBuyVoucher, onDollarChange }: ShopPanelProps) {
  const { t, lang } = useI18n();
  const [shop, setShop] = useState<GeneratedShop | null>(null);
  const [rerollCount, setRerollCount] = useState(0);

  const generate = useCallback(() => {
    setShop(generateShop(gameState, dollars));
  }, [gameState, dollars]);

  const handleReroll = useCallback(() => {
    const cost = 5 + rerollCount * 2;
    if (dollars >= cost) {
      onDollarChange(dollars - cost);
      setRerollCount(c => c + 1);
      generate();
    }
  }, [dollars, rerollCount, onDollarChange, generate]);

  // Auto-generate on mount and when gameState/dollars change
  useEffect(() => {
    setShop(generateShop(gameState, dollars));
    setRerollCount(0);
  }, [gameState, dollars]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="shop-header">
        <h2>{t.shop.title}</h2>
        <div className="shop-dollars">
          <span className="shop-dollars__amount">
            ${dollars}
          </span>
          <button className="shop-reroll-btn" onClick={handleReroll}>
            {t.buttons.reroll}
          </button>
        </div>
      </div>

      {shop && (
        <>
          {/* Best Purchase Recommendation */}
          <div className="shop-recommendation">
            <span className="shop-recommendation__label">
              {t.shop.buyRecommendation}:
            </span>
            <span className="shop-recommendation__item">
              {shop.bestPurchase}
            </span>
          </div>

          {/* Shop Slots */}
          <div className="shop-grid">
            {shop.state.slots.map((slot, i) => (
              <ShopSlotCard
                key={i}
                slot={slot}
                lang={lang}
                t={t}
                dollars={dollars}
                utility={
                  i === 0 ? shop.pack1Utility :
                  i === 1 ? shop.pack2Utility :
                  i === 2 ? shop.jokerUtility :
                  i === 3 ? shop.tarotUtility :
                  i === 4 ? shop.planetUtility :
                  i === 5 ? 0 :
                  shop.voucherUtility
                }
                onBuyJoker={onBuyJoker}
                onUpgradeHand={onUpgradeHand}
                onBuyVoucher={onBuyVoucher}
                onDollarChange={onDollarChange}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="shop-legend">
            <span>{t.shop.utility}: Expected score improvement</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Shop Slot Card ──────────────────────────────────────────

function ShopSlotCard({
  slot, lang, t, dollars, utility,
  onBuyJoker, onUpgradeHand, onBuyVoucher, onDollarChange,
}: {
  slot: { label: string; item: ShopItem | null; itemType: string; pack?: BoosterSlot };
  lang: string;
  t: Translations;
  dollars: number;
  utility: number;
  onBuyJoker: (id: string) => void;
  onUpgradeHand: (ht: HandType) => void;
  onBuyVoucher: (id: string) => void;
  onDollarChange: (d: number) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);

  const name = (item: ShopItem | null) => {
    if (!item) return '';
    return lang === 'zh-CN' ? (item.nameZh ?? item.name) : item.name;
  };
  const packName = slot.pack
    ? (lang === 'zh-CN' ? BOOSTER_TYPE_NAMES[slot.pack.type].zh : BOOSTER_TYPE_NAMES[slot.pack.type].en)
    : '';

  const price = slot.pack
    ? slot.pack.price
    : slot.item?.price ?? 0;

  const canAfford = dollars >= price;

  const utilityColor = utility > 0.25 ? '#48bb78' : utility > 0.12 ? '#f6e05e' : '#94a3b8';
  const utilityLabel = utility > 0.25 ? t.shop.bestValue : utility > 0.12 ? t.shop.goodValue : t.shop.averageValue;
  const utilityBadgeBg = utility > 0.25 ? '#14532d' : utility > 0.12 ? '#713f12' : '#334155';

  const handleBuy = () => {
    if (!canAfford) return;
    onDollarChange(dollars - price);

    if (slot.itemType === 'joker' && slot.item) {
      onBuyJoker((slot.item as import('../../engine/shop').JokerShopItem).jokerId);
    } else if (slot.itemType === 'planet' && slot.item) {
      onUpgradeHand((slot.item as import('../../engine/shop').PlanetItem).handType);
    } else if (slot.itemType === 'voucher' && slot.item) {
      onBuyVoucher((slot.item as import('../../engine/shop').VoucherItem).id);
    }
  };

  return (
    <div className={canAfford ? 'shop-slot' : 'shop-slot shop-slot--unaffordable'}>
      {/* Label + type */}
      <div className="shop-slot__header">
        <span className="shop-slot__label">{slot.label}</span>
        <span className="shop-slot__type">
          {slot.pack ? packName : slot.itemType}
        </span>
      </div>

      {/* Item name */}
      <div className="shop-slot__name">
        {slot.pack ? packName : name(slot.item)}
      </div>

      {/* Price + Buy */}
      <div className="shop-slot__footer">
        <span className="shop-slot__price">${price}</span>
        <button
          className="shop-slot__buy-btn"
          onClick={handleBuy}
          disabled={!canAfford}
        >
          {t.buttons.buy}
        </button>
      </div>

      {/* Utility bar */}
      <div className="shop-slot__utility">
        <div className="shop-slot__utility-bar">
          <div
            className="shop-slot__utility-fill"
            style={{
              width: `${Math.min(100, utility * 200)}%`,
              backgroundColor: utilityColor,
            }}
          />
        </div>
        <span className="shop-slot__utility-text" style={{ color: utilityColor }}>
          {(utility * 100).toFixed(1)}%
        </span>
        <span
          className="shop-slot__utility-badge"
          style={{ backgroundColor: utilityBadgeBg, color: utilityColor }}
        >
          {utilityLabel}
        </span>
      </div>

      {/* Pack preview toggle */}
      {slot.pack && (
        <button
          className="shop-slot__preview-toggle"
          onClick={() => setShowPreview(!showPreview)}
        >
          {t.shop.packPreview} {showPreview ? '▲' : '▼'}
        </button>
      )}

      {/* Pack preview content */}
      {slot.pack && showPreview && (
        <PackPreview type={slot.pack.type} lang={lang} />
      )}
    </div>
  );
}

// ─── Pack Preview ────────────────────────────────────────────

function PackPreview({ type, lang }: { type: BoosterType; lang: string }) {
  if (type === BoosterType.Arcana) {
    const samples = TAROT_CARDS.slice(0, 5);
    return (
      <div className="shop-slot__pack-preview">
        {samples.map(t => (
          <div key={t.id}>{lang === 'zh-CN' ? t.nameZh : t.name}</div>
        ))}
        <div>...</div>
      </div>
    );
  }
  if (type === BoosterType.Celestial) {
    const samples = PLANET_CARDS.slice(0, 5);
    return (
      <div className="shop-slot__pack-preview">
        {samples.map(p => (
          <div key={p.id}>{p.name}</div>
        ))}
        <div>...</div>
      </div>
    );
  }
  if (type === BoosterType.Buffoon) {
    return (
      <div className="shop-slot__pack-preview">
        2 random jokers to choose from
      </div>
    );
  }
  if (type === BoosterType.Spectral) {
    return (
      <div className="shop-slot__pack-preview">
        2 spectral cards (powerful effects, often with costs)
      </div>
    );
  }
  return (
    <div className="shop-slot__pack-preview">
      3 random playing cards to choose from
    </div>
  );
}
