import { useI18n } from '../../i18n/context';
import { BlindType, HandType } from '../../engine/types';
import type { Card, DeckComposition, DeckCardSlot, DeckCardFilter } from '../../engine/types';
import { Rank, Suit, CardEnhancement, CardEdition, Seal } from '../../engine/types';
import type { GameStateForm as GSMForm } from '../../hooks/useGameState';
import type { DeckPreset } from '../../engine/deck';
import { ALL_VOUCHERS, ALL_BOSS_EFFECTS } from '../../hooks/useGameState';
import { HandCardsInput } from './HandCardsInput';
import { JokerInput } from './JokerInput';
import { HandLevelInput } from './HandLevelInput';
import { DeckBuilder } from '../deck/DeckBuilder';

interface GameStateFormProps {
  form: GSMForm;
  effectiveMaxHands: number;
  effectiveMaxDiscards: number;
  effectiveHandSize: number;
  onUpdateCard: (index: number, card: Card) => void;
  onAddJoker: (id: string) => void;
  onRemoveJoker: (index: number) => void;
  onReorderJokers: (from: number, to: number) => void;
  onSetHandLevel: (handType: HandType, level: number) => void;
  onUpdateField: <K extends keyof GSMForm>(field: K, value: GSMForm[K]) => void;
  onToggleVoucher: (voucherId: string) => void;
  onSetBossEffect: (bossId: string | null) => void;
  onCompute: () => void;
  computing: boolean;
  jokerStateOverrides: Record<number, number>;
  onJokerStateChange: (index: number, value: number) => void;
  // Deck builder
  onSetDeckComposition: (deck: DeckComposition) => void;
  onResetDeckToStandard: () => void;
  onAddCardToDeck: (rank: Rank, suit: Suit, enhancement?: CardEnhancement, edition?: CardEdition, seal?: Seal) => void;
  onRemoveCardFromDeck: (rank: Rank, suit: Suit) => void;
  // Visual deck builder
  onApplyDeckPreset?: (preset: DeckPreset) => void;
  onUpdateDeckCard?: (slotIndex: number, updates: Partial<Pick<DeckCardSlot, 'enhancement' | 'edition' | 'seal'>>) => void;
  onBatchUpdateDeckCards?: (filter: DeckCardFilter, updates: Partial<Pick<DeckCardSlot, 'enhancement' | 'edition' | 'seal'>>) => void;
}

export function GameStateForm({
  form, effectiveMaxHands, effectiveMaxDiscards, effectiveHandSize,
  onUpdateCard, onAddJoker, onRemoveJoker,
  onReorderJokers, onSetHandLevel, onUpdateField, onCompute,
  onToggleVoucher, onSetBossEffect,
  computing, jokerStateOverrides, onJokerStateChange,
  onSetDeckComposition, onResetDeckToStandard, onAddCardToDeck, onRemoveCardFromDeck,
  onApplyDeckPreset, onUpdateDeckCard, onBatchUpdateDeckCards,
}: GameStateFormProps) {
  const { t } = useI18n();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hand Cards Section */}
      <section className="section">
        <HandCardsInput cards={form.handCards} onUpdateCard={onUpdateCard} />
      </section>

      {/* Jokers Section */}
      <section className="section">
        <JokerInput
          jokers={form.jokers}
          onAdd={onAddJoker}
          onRemove={onRemoveJoker}
          onReorder={onReorderJokers}
          stateOverrides={jokerStateOverrides}
          onStateChange={onJokerStateChange}
        />
      </section>

      {/* Hand Levels Section */}
      <section className="section">
        <HandLevelInput levels={form.handLevels} onChange={onSetHandLevel} />
      </section>

      {/* Round Settings Section */}
      <section className="section" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <h3 className="section h3" style={{ width: '100%', margin: 0 }}>
          {t.sections.roundSettings}
        </h3>

        <Field label={t.fields.maxHands}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              min={1}
              max={10}
              className="input input--number"
              value={form.maxHandsBase}
              onChange={e => onUpdateField('maxHandsBase', parseInt(e.target.value) || 1)}
            />
            {effectiveMaxHands !== form.maxHandsBase && (
              <span className="field-modifier">→ {effectiveMaxHands}</span>
            )}
          </div>
        </Field>

        <Field label={t.fields.maxDiscards}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              min={0}
              max={10}
              className="input input--number"
              value={form.maxDiscardsBase}
              onChange={e => onUpdateField('maxDiscardsBase', parseInt(e.target.value) || 0)}
            />
            {effectiveMaxDiscards !== form.maxDiscardsBase && (
              <span className="field-modifier">→ {effectiveMaxDiscards}</span>
            )}
          </div>
        </Field>

        <Field label={t.fields.handSize}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              min={5}
              max={15}
              className="input input--number"
              value={form.handSizeBase}
              onChange={e => onUpdateField('handSizeBase', parseInt(e.target.value) || 5)}
            />
            {effectiveHandSize !== form.handSizeBase && (
              <span className="field-modifier">→ {effectiveHandSize}</span>
            )}
          </div>
        </Field>

        {/* Vouchers */}
        <Field label={t.fields.activeVouchers}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '320px' }}>
            {ALL_VOUCHERS.map(v => {
              const active = form.activeVouchers.includes(v.id);
              return (
                <button
                  key={v.id}
                  onClick={() => onToggleVoucher(v.id)}
                  title={t.shop.voucherNames[v.id] ?? v.id}
                  className={active ? 'voucher-toggle voucher-toggle--active' : 'voucher-toggle'}
                >
                  {t.shop.voucherNames[v.id] ?? v.id.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Boss Effect */}
        <Field label={t.fields.bossEffect}>
          <select
            className="input"
            value={form.activeBossEffect ?? 'none'}
            onChange={e => onSetBossEffect(e.target.value)}
          >
            <option value="none">-</option>
            {ALL_BOSS_EFFECTS.filter(b => b.id !== 'none').map(b => (
              <option key={b.id} value={b.id}>{t.shop.bossEffectNames[b.id] ?? b.id.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </Field>
      </section>

      {/* Deck Builder Section */}
      <section className="section">
        <DeckBuilder
          deck={form.deckComposition}
          onSetDeck={onSetDeckComposition}
          onResetToStandard={onResetDeckToStandard}
          onAddCard={onAddCardToDeck}
          onRemoveCard={onRemoveCardFromDeck}
          onApplyPreset={onApplyDeckPreset}
          onUpdateCard={onUpdateDeckCard}
          onBatchUpdate={onBatchUpdateDeckCards}
        />
      </section>

      {/* Game Info Section */}
      <section className="section" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <h3 className="section h3" style={{ width: '100%', margin: 0 }}>
          {t.sections.gameInfo}
        </h3>

        <Field label={t.fields.blindType}>
          <select
            className="input"
            value={form.blindType}
            onChange={e => onUpdateField('blindType', e.target.value as BlindType)}
          >
            <option value="small">{t.blindTypes.small}</option>
            <option value="big">{t.blindTypes.big}</option>
            <option value="boss">{t.blindTypes.boss}</option>
          </select>
        </Field>

        <Field label={t.fields.chipsRequired}>
          <input
            type="number"
            className="input"
            value={form.blindChips}
            onChange={e => onUpdateField('blindChips', parseInt(e.target.value) || 0)}
          />
        </Field>

        <Field label={t.fields.ante}>
          <input
            type="number"
            min={1}
            max={39}
            className="input"
            style={{ width: '64px' }}
            value={form.antes}
            onChange={e => onUpdateField('antes', parseInt(e.target.value) || 1)}
          />
        </Field>

        <Field label={t.fields.handsPlayed}>
          <input
            type="number"
            min={0}
            className="input"
            style={{ width: '64px' }}
            value={form.handsPlayed}
            onChange={e => onUpdateField('handsPlayed', parseInt(e.target.value) || 0)}
          />
        </Field>

        <Field label={t.fields.discardsUsed}>
          <input
            type="number"
            min={0}
            className="input"
            style={{ width: '64px' }}
            value={form.discardsUsed}
            onChange={e => onUpdateField('discardsUsed', parseInt(e.target.value) || 0)}
          />
        </Field>

        <Field label={t.fields.dollars}>
          <input
            type="number"
            min={0}
            max={999}
            className="input"
            style={{ width: '72px' }}
            value={form.dollars}
            onChange={e => onUpdateField('dollars', parseInt(e.target.value) || 0)}
          />
        </Field>

        <Field label={t.fields.finalHand}>
          <input
            type="checkbox"
            checked={form.isFinalHand}
            onChange={e => onUpdateField('isFinalHand', e.target.checked)}
            style={{ width: '20px', height: '20px', accentColor: '#48bb78' }}
          />
        </Field>
      </section>

      {/* Compute Button */}
      <button
        className="compute-btn"
        onClick={onCompute}
        disabled={computing}
      >
        {computing ? t.buttons.computing : t.buttons.compute}
      </button>
    </div>
  );
}

// ─── Field helper ──────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
