import { useMemo } from 'react';
import type { Card, JokerInstance } from '../../engine/types';
import { BlindType } from '../../engine/types';
import { useI18n } from '../../i18n/context';
import type { UseModConnectionReturn } from '../../hooks/useModConnection';
import type { GameStateForm } from '../../hooks/useGameState';
import { CardComponent } from '../shared/CardComponent';
import { formatScore } from '../../engine/search';
import { getJoker } from '../../engine/joker-effects';

interface ModDashboardProps {
  form: GameStateForm;
  effectiveHands: number;
  effectiveDiscards: number;
  effectiveHandSize: number;
  modConn: UseModConnectionReturn;
  computing: boolean;
  onCompute: () => void;
  onAnalyzeDiscards: () => void;
}

const BLIND_LABELS: Record<BlindType, string> = {
  [BlindType.Small]: 'Small Blind',
  [BlindType.Big]: 'Big Blind',
  [BlindType.Boss]: 'Boss Blind',
};

export function ModDashboard({
  form,
  effectiveHands,
  effectiveDiscards,
  effectiveHandSize,
  modConn,
  computing,
  onCompute,
  onAnalyzeDiscards,
}: ModDashboardProps) {
  const { t } = useI18n();

  const handsLeft = effectiveHands - form.handsPlayed;
  const discardsLeft = effectiveDiscards - form.discardsUsed;
  const blindProgress = form.blindChips > 0
    ? Math.min(100, Math.round(((form.roundScore ?? 0) / form.blindChips) * 100))
    : 0;

  // Compute effective joker values (base + state override) for display
  const jokerDisplay = useMemo(() => {
    return form.jokers.map((j: JokerInstance, idx: number) => {
      const def = getJoker(j.id);
      const name = def
        ? (t.jokerNames as Record<string, string>)[j.id] ?? j.id
        : j.id;
      const stateOverride = form.jokerStateOverrides?.[idx];
      return { name, edition: j.edition, stateOverride };
    });
  }, [form.jokers, form.jokerStateOverrides, t.jokerNames]);

  return (
    <div className="mod-dashboard">
      {/* ── Status bar ──────────────────────────────────────────── */}
      <div className="mod-dashboard__status-bar">
        <div className="mod-dashboard__status-item">
          <span className="mod-dashboard__status-label">Ante {form.antes}</span>
        </div>
        <div className="mod-dashboard__status-item">
          <span className="mod-dashboard__status-label">
            {BLIND_LABELS[form.blindType] ?? form.blindType}
          </span>
          <span className="mod-dashboard__status-value">{formatScore(form.blindChips)}</span>
        </div>
        <div className="mod-dashboard__status-item">
          <span className="mod-dashboard__status-label">$</span>
          <span className="mod-dashboard__status-value">{form.dollars}</span>
        </div>
        <div className="mod-dashboard__status-separator" />
        <div className="mod-dashboard__status-item">
          <span className="mod-dashboard__status-label">Hands</span>
          <span className="mod-dashboard__status-value">{handsLeft}/{effectiveHands}</span>
        </div>
        <div className="mod-dashboard__status-item">
          <span className="mod-dashboard__status-label">Discards</span>
          <span className="mod-dashboard__status-value">{discardsLeft}/{effectiveDiscards}</span>
        </div>
        <div className="mod-dashboard__status-item">
          <span className="mod-dashboard__status-label">HS</span>
          <span className="mod-dashboard__status-value">{form.handCards.length}/{effectiveHandSize}</span>
        </div>
        {blindProgress > 0 && (
          <div className="mod-dashboard__status-item mod-dashboard__status-item--wide">
            <div className="mod-dashboard__progress-bar">
              <div
                className={`mod-dashboard__progress-fill ${blindProgress >= 100 ? 'mod-dashboard__progress-fill--done' : ''}`}
                style={{ width: `${blindProgress}%` }}
              />
            </div>
            <span className="mod-dashboard__status-value">{blindProgress}%</span>
          </div>
        )}
      </div>

      {/* ── Main layout ─────────────────────────────────────────── */}
      <div className="mod-dashboard__main">
        {/* Left: Hand cards + Jokers */}
        <div className="mod-dashboard__left">
          {/* Hand cards */}
          <section className="mod-dashboard__section">
            <h3 className="mod-dashboard__section-title">Hand ({form.handCards.length})</h3>
            <div className="mod-dashboard__hand-cards">
              {form.handCards.map((card: Card, i: number) => (
                <CardComponent key={i} card={card} size="sm" />
              ))}
              {form.handCards.length === 0 && (
                <span className="mod-dashboard__empty">No hand cards</span>
              )}
            </div>
          </section>

          {/* Jokers */}
          <section className="mod-dashboard__section">
            <h3 className="mod-dashboard__section-title">Jokers</h3>
            <div className="mod-dashboard__jokers">
              {jokerDisplay.map((j, i) => (
                <div key={i} className="mod-dashboard__joker">
                  <span className="mod-dashboard__joker-name">{j.name}</span>
                  {j.edition !== 'none' && (
                    <span className="mod-dashboard__joker-edition">{j.edition}</span>
                  )}
                  {j.stateOverride !== undefined && (
                    <span className="mod-dashboard__joker-state">[{j.stateOverride}]</span>
                  )}
                </div>
              ))}
              {jokerDisplay.length === 0 && (
                <span className="mod-dashboard__empty">No jokers</span>
              )}
            </div>
          </section>

          {/* Vouchers */}
          {form.activeVouchers.length > 0 && (
            <section className="mod-dashboard__section">
              <h3 className="mod-dashboard__section-title">Vouchers</h3>
              <div className="mod-dashboard__tags">
                {form.activeVouchers.map((vId: string) => (
                  <span key={vId} className="mod-dashboard__tag">{vId}</span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right: Hand Levels + Actions */}
        <div className="mod-dashboard__right">
          {/* Hand levels */}
          <section className="mod-dashboard__section">
            <h3 className="mod-dashboard__section-title">Hand Levels</h3>
            <div className="mod-dashboard__hand-levels">
              {Object.entries(form.handLevels)
                .filter(([, lvl]) => lvl > 1)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([handType, lvl]) => (
                  <div key={handType} className="mod-dashboard__hand-level">
                    <span className="mod-dashboard__hand-level-name">
                      {handType.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="mod-dashboard__hand-level-lvl">Lv.{lvl as number}</span>
                  </div>
                ))}
              {Object.values(form.handLevels).every(l => l === 1) && (
                <span className="mod-dashboard__empty">All Lv.1</span>
              )}
            </div>
          </section>

          {/* Boss effect */}
          {form.activeBossEffect && (
            <section className="mod-dashboard__section">
              <h3 className="mod-dashboard__section-title">Boss</h3>
              <div className="mod-dashboard__tags">
                <span className="mod-dashboard__tag mod-dashboard__tag--boss">
                  {form.activeBossEffect}
                </span>
              </div>
            </section>
          )}

          {/* Debuffs */}
          {(form.blindDebuffedRanks.length > 0 || form.blindDebuffedSuits.length > 0) && (
            <section className="mod-dashboard__section">
              <h3 className="mod-dashboard__section-title">Debuffed</h3>
              <div className="mod-dashboard__tags">
                {form.blindDebuffedSuits.map((s: string) => (
                  <span key={s} className="mod-dashboard__tag mod-dashboard__tag--debuff">{s}</span>
                ))}
                {form.blindDebuffedRanks.map((r: string) => (
                  <span key={r} className="mod-dashboard__tag mod-dashboard__tag--debuff">{r}</span>
                ))}
              </div>
            </section>
          )}

          {/* Deck summary */}
          <section className="mod-dashboard__section">
            <h3 className="mod-dashboard__section-title">
              Deck ({form.deckComposition?.totalCards ?? '?'} cards)
            </h3>
          </section>

          {/* Shop (from mod) */}
          {form.shop && (
            <section className="mod-dashboard__section mod-dashboard__section--shop">
              <h3 className="mod-dashboard__section-title">Shop</h3>

              {form.shop.jokers && form.shop.jokers.length > 0 && (
                <div className="mod-dashboard__shop-category">
                  <span className="mod-dashboard__shop-label">Jokers:</span>
                  {form.shop.jokers.map((sj, i) => (
                    <div key={i} className="mod-dashboard__shop-item">
                      <span className="mod-dashboard__joker-name">{sj.id}</span>
                      {sj.edition !== 'none' && (
                        <span className="mod-dashboard__joker-edition">{sj.edition}</span>
                      )}
                      <span className="mod-dashboard__shop-price">${sj.price}</span>
                    </div>
                  ))}
                </div>
              )}

              {form.shop.voucher && (
                <div className="mod-dashboard__shop-item">
                  <span className="mod-dashboard__shop-label">Voucher:</span>
                  <span>{form.shop.voucher.id}</span>
                  <span className="mod-dashboard__shop-price">${form.shop.voucher.price}</span>
                </div>
              )}

              {form.shop.boosters && form.shop.boosters.length > 0 && (
                <div className="mod-dashboard__shop-category">
                  <span className="mod-dashboard__shop-label">Boosters:</span>
                  {form.shop.boosters.map((bp, i) => (
                    <div key={i} className="mod-dashboard__shop-item">
                      <span>{bp.type}</span>
                      <span className="mod-dashboard__shop-price">${bp.price}</span>
                    </div>
                  ))}
                </div>
              )}

              {form.shop.consumable && (
                <div className="mod-dashboard__shop-item">
                  <span className="mod-dashboard__shop-label">Card:</span>
                  <span>{form.shop.consumable.id}</span>
                  <span className="mod-dashboard__shop-price">${form.shop.consumable.price}</span>
                </div>
              )}

              {form.shop.rerollCost !== undefined && (
                <div className="mod-dashboard__shop-item">
                  <span className="mod-dashboard__shop-label">Reroll:</span>
                  <span className="mod-dashboard__shop-price">${form.shop.rerollCost}</span>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* ── Action buttons ──────────────────────────────────────────── */}
      <div className="mod-dashboard__actions">
        <button
          className="mod-dashboard__btn mod-dashboard__btn--primary"
          disabled={computing || form.handCards.length === 0}
          onClick={onCompute}
        >
          {computing ? 'Computing...' : 'Compute Best Play'}
        </button>
        <button
          className="mod-dashboard__btn mod-dashboard__btn--secondary"
          disabled={form.handCards.length === 0}
          onClick={onAnalyzeDiscards}
        >
          Analyze Discards
        </button>
        <span className="mod-dashboard__hint">
          Connected to Mod — {modConn.lastPollTime
            ? `Last update: ${new Date(modConn.lastPollTime).toLocaleTimeString()}`
            : 'Waiting for data...'}
        </span>
      </div>
    </div>
  );
}
