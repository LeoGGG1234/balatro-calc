import { useState } from 'react';
import { useI18n } from '../../i18n/context';
import type { DeckComposition, DeckCardSlot, DeckCardFilter } from '../../engine/types';
import { Rank, Suit, CardEnhancement, CardEdition, Seal, ALL_RANKS, ALL_SUITS } from '../../engine/types';
import type { DeckPreset } from '../../engine/deck';
import { DeckBuilderVisual } from './DeckBuilderVisual';
import { SUIT_SYMBOLS, SUIT_COLORS } from '../shared/card-display';

type DeckMode = 'quick' | 'list' | 'visual';

interface DeckBuilderProps {
  deck: DeckComposition;
  onSetDeck: (deck: DeckComposition) => void;
  onResetToStandard: () => void;
  onAddCard: (rank: Rank, suit: Suit, enhancement?: CardEnhancement, edition?: CardEdition, seal?: Seal) => void;
  onRemoveCard: (rank: Rank, suit: Suit) => void;
  // Visual mode callbacks
  onApplyPreset?: (preset: DeckPreset) => void;
  onUpdateCard?: (slotIndex: number, updates: Partial<Pick<DeckCardSlot, 'enhancement' | 'edition' | 'seal'>>) => void;
  onBatchUpdate?: (filter: DeckCardFilter, updates: Partial<Pick<DeckCardSlot, 'enhancement' | 'edition' | 'seal'>>) => void;
}

export function DeckBuilder({
  deck, onSetDeck, onResetToStandard, onAddCard, onRemoveCard,
  onApplyPreset, onUpdateCard, onBatchUpdate,
}: DeckBuilderProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<DeckMode>('quick');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRemoveForm, setShowRemoveForm] = useState(false);

  // Add form state
  const [addRank, setAddRank] = useState<Rank>(Rank.Ace);
  const [addSuit, setAddSuit] = useState<Suit>(Suit.Spades);
  const [addEnhancement, setAddEnhancement] = useState<CardEnhancement>(CardEnhancement.None);
  const [addEdition, setAddEdition] = useState<CardEdition>(CardEdition.None);
  const [addSeal, setAddSeal] = useState<Seal>(Seal.None);

  // Remove form state
  const [removeRank, setRemoveRank] = useState<Rank>(Rank.Ace);
  const [removeSuit, setRemoveSuit] = useState<Suit>(Suit.Spades);

  const handleQuickTotalChange = (total: number) => {
    onSetDeck({ totalCards: total, remainingByRank: {}, remainingBySuit: {} });
  };

  const handleStandardPreset = () => {
    onResetToStandard();
  };

  const handleAddCard = () => {
    onAddCard(addRank, addSuit, addEnhancement, addEdition, addSeal);
  };

  const handleRemoveCard = () => {
    onRemoveCard(removeRank, removeSuit);
  };

  const hasDetailedData = (deck.remainingByRank && Object.keys(deck.remainingByRank).length > 0) ||
    (deck.remainingBySuit && Object.keys(deck.remainingBySuit).length > 0);

  return (
    <div className="deck-builder">
      {/* Header */}
      <div className="deck-builder__header">
        <h3>{t.deck.title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="deck-builder__total">{deck.totalCards}</span>
          <div className="deck-builder__mode-tabs">
            {(['quick', 'list', 'visual'] as const).map(m => (
              <button
                key={m}
                className={`deck-builder__mode-tab${mode === m ? ' deck-builder__mode-tab--active' : ''}`}
                onClick={() => setMode(m)}
              >
                {m === 'quick' ? t.deck.quickMode : m === 'list' ? t.deck.fullMode : t.deck.visualMode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Mode */}
      {mode === 'quick' && (
        <div className="deck-builder__quick">
          <input
            type="number"
            min={0}
            max={52}
            className="deck-builder__quick-input"
            value={deck.totalCards}
            onChange={e => handleQuickTotalChange(parseInt(e.target.value) || 0)}
            aria-label={t.fields.deckRemaining}
          />
          <button className="deck-builder__preset-btn" onClick={handleStandardPreset}>
            {t.deck.standardPreset}
          </button>
        </div>
      )}

      {/* List Mode */}
      {mode === 'list' && (
        <>
          {/* Action Bar */}
          <div className="deck-builder__actions">
            <button className="deck-builder__preset-btn" onClick={handleStandardPreset}>
              {t.deck.standardPreset}
            </button>
            <button
              className={showAddForm ? 'deck-builder__action-btn deck-builder__action-btn--active' : 'deck-builder__action-btn'}
              onClick={() => { setShowAddForm(!showAddForm); setShowRemoveForm(false); }}
            >
              {t.deck.addCard}
            </button>
            <button
              className={showRemoveForm ? 'deck-builder__action-btn deck-builder__action-btn--active' : 'deck-builder__action-btn'}
              onClick={() => { setShowRemoveForm(!showRemoveForm); setShowAddForm(false); }}
            >
              {t.deck.removeCard}
            </button>
          </div>

          {/* Add Card Form */}
          {showAddForm && (
            <div className="deck-builder__add-form">
              <div className="deck-builder__form-group">
                <span className="deck-builder__form-label">Rank</span>
                <select className="deck-builder__form-select" value={addRank} onChange={e => setAddRank(e.target.value as Rank)}>
                  {ALL_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="deck-builder__form-group">
                <span className="deck-builder__form-label">Suit</span>
                <select className="deck-builder__form-select" value={addSuit} onChange={e => setAddSuit(e.target.value as Suit)}>
                  {ALL_SUITS.map(s => <option key={s} value={s}>{SUIT_SYMBOLS[s]} {s}</option>)}
                </select>
              </div>
              <div className="deck-builder__form-group">
                <span className="deck-builder__form-label">{t.deck.enhancement}</span>
                <select className="deck-builder__form-select" value={addEnhancement} onChange={e => setAddEnhancement(e.target.value as CardEnhancement)}>
                  <option value={CardEnhancement.None}>-</option>
                  <option value={CardEnhancement.Bonus}>Bonus</option>
                  <option value={CardEnhancement.Mult}>Mult</option>
                  <option value={CardEnhancement.Wild}>Wild</option>
                  <option value={CardEnhancement.Glass}>Glass</option>
                  <option value={CardEnhancement.Steel}>Steel</option>
                  <option value={CardEnhancement.Stone}>Stone</option>
                  <option value={CardEnhancement.Gold}>Gold</option>
                  <option value={CardEnhancement.Lucky}>Lucky</option>
                </select>
              </div>
              <div className="deck-builder__form-group">
                <span className="deck-builder__form-label">{t.deck.edition}</span>
                <select className="deck-builder__form-select" value={addEdition} onChange={e => setAddEdition(e.target.value as CardEdition)}>
                  <option value={CardEdition.None}>-</option>
                  <option value={CardEdition.Foil}>Foil</option>
                  <option value={CardEdition.Holographic}>Holo</option>
                  <option value={CardEdition.Polychrome}>Poly</option>
                  <option value={CardEdition.Negative}>Negative</option>
                </select>
              </div>
              <div className="deck-builder__form-group">
                <span className="deck-builder__form-label">{t.deck.seal}</span>
                <select className="deck-builder__form-select" value={addSeal} onChange={e => setAddSeal(e.target.value as Seal)}>
                  <option value={Seal.None}>-</option>
                  <option value={Seal.Red}>Red</option>
                  <option value={Seal.Blue}>Blue</option>
                  <option value={Seal.Gold}>Gold</option>
                  <option value={Seal.Purple}>Purple</option>
                </select>
              </div>
              <button className="deck-builder__form-btn deck-builder__form-btn--add" onClick={handleAddCard}>
                {t.deck.addSpecificCard}
              </button>
            </div>
          )}

          {/* Remove Card Form */}
          {showRemoveForm && (
            <div className="deck-builder__add-form">
              <div className="deck-builder__form-group">
                <span className="deck-builder__form-label">Rank</span>
                <select className="deck-builder__form-select" value={removeRank} onChange={e => setRemoveRank(e.target.value as Rank)}>
                  {ALL_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="deck-builder__form-group">
                <span className="deck-builder__form-label">Suit</span>
                <select className="deck-builder__form-select" value={removeSuit} onChange={e => setRemoveSuit(e.target.value as Suit)}>
                  {ALL_SUITS.map(s => <option key={s} value={s}>{SUIT_SYMBOLS[s]} {s}</option>)}
                </select>
              </div>
              <button className="deck-builder__form-btn deck-builder__form-btn--remove" onClick={handleRemoveCard}>
                {t.deck.removeSpecificCard}
              </button>
            </div>
          )}

          {/* Rank + Suit Grid */}
          {hasDetailedData && (
            <div className="deck-builder__grid">
              {/* By Rank */}
              <div className="deck-builder__column">
                <h4>{t.deck.byRank}</h4>
                <div className="deck-builder__rank-grid">
                  {ALL_RANKS.map(r => (
                    <div key={r} className="deck-builder__rank-cell">
                      <div className="deck-builder__rank-label">{r}</div>
                      <div className="deck-builder__rank-count">{deck.remainingByRank[r] ?? 0}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Suit */}
              <div className="deck-builder__column">
                <h4>{t.deck.bySuit}</h4>
                <div className="deck-builder__suit-grid">
                  {ALL_SUITS.map(s => (
                    <div key={s} className="deck-builder__suit-cell">
                      <span className="deck-builder__suit-label" style={{ color: SUIT_COLORS[s] }}>
                        {SUIT_SYMBOLS[s]}
                      </span>
                      <span className="deck-builder__suit-count">{deck.remainingBySuit[s] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Special Cards */}
          {(deck.enhancementCounts || deck.editionCounts || deck.sealCounts) && (
            <div className="deck-builder__special">
              <h4>{t.deck.specialCards}</h4>

              {deck.enhancementCounts && (
                <div className="deck-builder__special-row">
                  {Object.entries(deck.enhancementCounts)
                    .filter(([key]) => key !== CardEnhancement.None)
                    .map(([key, count]) => (
                      <span key={key} className="deck-builder__special-chip">
                        {t.enhancementsLong[key as CardEnhancement] ?? key}: {count}
                      </span>
                    ))}
                </div>
              )}

              {deck.editionCounts && (
                <div className="deck-builder__special-row">
                  {Object.entries(deck.editionCounts)
                    .filter(([key]) => key !== CardEdition.None)
                    .map(([key, count]) => (
                      <span key={key} className="deck-builder__special-chip">
                        {t.editionsLong[key as CardEdition] ?? key}: {count}
                      </span>
                    ))}
                </div>
              )}

              {deck.sealCounts && (
                <div className="deck-builder__special-row">
                  {Object.entries(deck.sealCounts)
                    .filter(([key]) => key !== Seal.None)
                    .map(([key, count]) => (
                      <span key={key} className="deck-builder__special-chip">
                        {t.sealsLong[key as Seal] ?? key}: {count}
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}

          {!hasDetailedData && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '12px' }}>
              Click "{t.deck.standardPreset}" to initialize detailed deck tracking, or add/remove cards manually.
            </div>
          )}
        </>
      )}

      {/* Visual Mode */}
      {mode === 'visual' && onApplyPreset && onUpdateCard && onBatchUpdate && (
        <DeckBuilderVisual
          deck={deck}
          onApplyPreset={onApplyPreset}
          onUpdateCard={onUpdateCard}
          onBatchUpdate={onBatchUpdate}
          onAddCard={onAddCard}
          onRemoveCard={onRemoveCard}
        />
      )}
    </div>
  );
}
