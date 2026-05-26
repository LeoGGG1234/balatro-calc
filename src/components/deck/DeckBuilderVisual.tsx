import { Fragment, useState, useMemo } from 'react';
import { useI18n } from '../../i18n/context';
import type { DeckComposition, DeckCardSlot, DeckCardFilter } from '../../engine/types';
import { Rank, Suit, CardEnhancement, CardEdition, Seal, ALL_RANKS } from '../../engine/types';
import type { DeckPreset } from '../../engine/deck';
import { SUIT_SYMBOLS, SUIT_COLORS } from '../shared/card-display';

interface DeckBuilderVisualProps {
  deck: DeckComposition;
  onApplyPreset: (preset: DeckPreset) => void;
  onUpdateCard: (slotIndex: number, updates: Partial<Pick<DeckCardSlot, 'enhancement' | 'edition' | 'seal'>>) => void;
  onBatchUpdate: (filter: DeckCardFilter, updates: Partial<Pick<DeckCardSlot, 'enhancement' | 'edition' | 'seal'>>) => void;
  onAddCard: (rank: Rank, suit: Suit, enhancement?: CardEnhancement, edition?: CardEdition, seal?: Seal) => void;
  onRemoveCard: (rank: Rank, suit: Suit) => void;
}

// ─── Visual constants ──────────────────────────────────────────

const ENH_COLORS: Partial<Record<CardEnhancement, string>> = {
  [CardEnhancement.Bonus]: '#4a90d9',
  [CardEnhancement.Mult]: '#e04040',
  [CardEnhancement.Wild]: '#c084fc',
  [CardEnhancement.Glass]: '#fbbf24',
  [CardEnhancement.Steel]: '#64748b',
  [CardEnhancement.Stone]: '#a8a29e',
  [CardEnhancement.Gold]: '#f59e0b',
  [CardEnhancement.Lucky]: '#2dd4bf',
};

const EDITION_COLORS: Record<CardEdition, string> = {
  [CardEdition.None]: 'transparent',
  [CardEdition.Foil]: '#cbd5e1',
  [CardEdition.Holographic]: '#22d3ee',
  [CardEdition.Polychrome]: '#fbbf24',
  [CardEdition.Negative]: '#a78bfa',
};

const SEAL_COLORS: Record<Seal, string> = {
  [Seal.None]: 'transparent',
  [Seal.Red]: '#f87171',
  [Seal.Blue]: '#38bdf8',
  [Seal.Gold]: '#fbbf24',
  [Seal.Purple]: '#a78bfa',
};

const DISPLAY_RANKS: Rank[] = [...ALL_RANKS].reverse(); // A K Q J ... 2
const DISPLAY_SUITS: Suit[] = [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds];

// ─── Component ─────────────────────────────────────────────────

export function DeckBuilderVisual({
  deck, onApplyPreset, onUpdateCard, onBatchUpdate, onAddCard, onRemoveCard,
}: DeckBuilderVisualProps) {
  const { t } = useI18n();

  const cards = deck.cards;

  // ---- Editor state ----
  const [editorRank, setEditorRank] = useState<Rank | null>(null);
  const [editorSuit, setEditorSuit] = useState<Suit | null>(null);
  const [editEnh, setEditEnh] = useState<CardEnhancement>(CardEnhancement.None);
  const [editEd, setEditEd] = useState<CardEdition>(CardEdition.None);
  const [editSeal, setEditSeal] = useState<Seal>(Seal.None);

  // ---- Batch state ----
  const [batchSuit, setBatchSuit] = useState<Suit | ''>('');
  const [batchRank, setBatchRank] = useState<Rank | ''>('');
  const [batchEnh, setBatchEnh] = useState<CardEnhancement>(CardEnhancement.None);
  const [batchEd, setBatchEd] = useState<CardEdition>(CardEdition.None);
  const [batchSeal, setBatchSeal] = useState<Seal>(Seal.None);

  // Index cards by [rank][suit] for fast lookup
  const cardIndex = useMemo(() => {
    if (!cards) return null;
    const idx: Record<string, Record<string, number[]>> = {};
    for (const r of DISPLAY_RANKS) {
      idx[r] = {};
      for (const s of DISPLAY_SUITS) {
        idx[r][s] = [];
      }
    }
    cards.forEach((c, i) => {
      idx[c.rank]?.[c.suit]?.push(i);
    });
    return idx;
  }, [cards]);

  const openEditor = (rank: Rank, suit: Suit) => {
    if (!cardIndex) return;
    const indices = cardIndex[rank][suit];
    if (indices.length === 0) {
      // Add new card to this slot
      onAddCard(rank, suit);
      return;
    }
    const slot = cards![indices[0]];
    setEditorRank(rank);
    setEditorSuit(suit);
    setEditEnh(slot.enhancement);
    setEditEd(slot.edition);
    setEditSeal(slot.seal);
  };

  const closeEditor = () => {
    setEditorRank(null);
    setEditorSuit(null);
  };

  const handleApply = () => {
    if (!cardIndex || !editorRank || !editorSuit) return;
    const indices = cardIndex[editorRank][editorSuit];
    if (indices.length === 0) return;
    onUpdateCard(indices[0], { enhancement: editEnh, edition: editEd, seal: editSeal });
    closeEditor();
  };

  const handleClearModifiers = () => {
    if (!cardIndex || !editorRank || !editorSuit) return;
    const indices = cardIndex[editorRank][editorSuit];
    if (indices.length === 0) return;
    onUpdateCard(indices[0], {
      enhancement: CardEnhancement.None,
      edition: CardEdition.None,
      seal: Seal.None,
    });
    closeEditor();
  };

  const handleAddDuplicate = () => {
    if (!editorRank || !editorSuit) return;
    onAddCard(editorRank, editorSuit, editEnh, editEd, editSeal);
  };

  const handleRemoveOne = () => {
    if (!cardIndex || !editorRank || !editorSuit) return;
    const indices = cardIndex[editorRank][editorSuit];
    if (indices.length === 0) return;
    onRemoveCard(editorRank, editorSuit);
    // If that was the last card, close editor
    if (indices.length <= 1) {
      closeEditor();
    }
  };

  const handleBatchApply = () => {
    const filter: DeckCardFilter = {};
    if (batchSuit !== '') filter.suit = batchSuit;
    if (batchRank !== '') filter.rank = batchRank;
    const updates: Partial<Pick<DeckCardSlot, 'enhancement' | 'edition' | 'seal'>> = {};
    if (batchEnh !== CardEnhancement.None) updates.enhancement = batchEnh;
    if (batchEd !== CardEdition.None) updates.edition = batchEd;
    if (batchSeal !== Seal.None) updates.seal = batchSeal;
    // Only apply if at least one modifier set
    if (Object.keys(updates).length > 0) {
      onBatchUpdate(filter, updates);
    }
  };

  const editorOpen = editorRank !== null && editorSuit !== null;
  const editorCardCount = editorOpen && cardIndex
    ? cardIndex[editorRank!][editorSuit!].length
    : 0;

  // Compute aggregate summary
  const summaryParts = useMemo(() => {
    const parts: string[] = [];
    if (deck.enhancementCounts) {
      for (const [k, v] of Object.entries(deck.enhancementCounts)) {
        if (k !== CardEnhancement.None && v > 0) {
          parts.push(`${t.enhancements[k as CardEnhancement]}:${v}`);
        }
      }
    }
    if (deck.editionCounts) {
      for (const [k, v] of Object.entries(deck.editionCounts)) {
        if (k !== CardEdition.None && v > 0) {
          parts.push(`${t.editions[k as CardEdition]}:${v}`);
        }
      }
    }
    if (deck.sealCounts) {
      for (const [k, v] of Object.entries(deck.sealCounts)) {
        if (k !== Seal.None && v > 0) {
          parts.push(`${t.seals[k as Seal]}:${v}`);
        }
      }
    }
    return parts;
  }, [deck.enhancementCounts, deck.editionCounts, deck.sealCounts, t]);

  if (!cards) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '12px' }}>
        Click "{t.deck.standardPreset}" to initialize the visual deck builder.
      </div>
    );
  }

  return (
    <div className="vis-deck-builder">
      {/* ── Toolbar ── */}
      <div className="vis-deck-builder__toolbar">
        <div className="vis-deck-builder__presets">
          <button className="vis-deck-builder__preset-btn" onClick={() => onApplyPreset('standard')}>
            {t.deck.standardPreset}
          </button>
          <button className="vis-deck-builder__preset-btn" onClick={() => onApplyPreset('abandoned')}>
            {t.deck.presetAbandoned}
          </button>
          <button className="vis-deck-builder__preset-btn" onClick={() => onApplyPreset('checkered')}>
            {t.deck.presetCheckered}
          </button>
        </div>

        <div className="vis-deck-builder__batch">
          <select className="vis-deck-builder__batch-select" value={batchSuit} onChange={e => setBatchSuit(e.target.value as Suit | '')}>
            <option value="">All Suits</option>
            {DISPLAY_SUITS.map(s => (
              <option key={s} value={s}>{SUIT_SYMBOLS[s]} {s}</option>
            ))}
          </select>
          <select className="vis-deck-builder__batch-select" value={batchRank} onChange={e => setBatchRank(e.target.value as Rank | '')}>
            <option value="">All Ranks</option>
            {DISPLAY_RANKS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select className="vis-deck-builder__batch-select" value={batchEnh} onChange={e => setBatchEnh(e.target.value as CardEnhancement)}>
            <option value={CardEnhancement.None}>Enh: -</option>
            {Object.entries(ENH_COLORS).map(([k]) => (
              <option key={k} value={k}>{t.enhancements[k as CardEnhancement] ?? k}</option>
            ))}
          </select>
          <select className="vis-deck-builder__batch-select" value={batchEd} onChange={e => setBatchEd(e.target.value as CardEdition)}>
            <option value={CardEdition.None}>Ed: -</option>
            <option value={CardEdition.Foil}>Foil</option>
            <option value={CardEdition.Holographic}>Holo</option>
            <option value={CardEdition.Polychrome}>Poly</option>
            <option value={CardEdition.Negative}>Negative</option>
          </select>
          <select className="vis-deck-builder__batch-select" value={batchSeal} onChange={e => setBatchSeal(e.target.value as Seal)}>
            <option value={Seal.None}>Seal: -</option>
            <option value={Seal.Red}>Red</option>
            <option value={Seal.Blue}>Blue</option>
            <option value={Seal.Gold}>Gold</option>
            <option value={Seal.Purple}>Purple</option>
          </select>
          <button className="vis-deck-builder__batch-btn" onClick={handleBatchApply}>
            {t.deck.batchApply}
          </button>
        </div>
      </div>

      {/* ── Summary ── */}
      {summaryParts.length > 0 && (
        <div className="vis-deck-builder__summary">
          {t.deck.total}: {deck.totalCards}
          {summaryParts.map((p, i) => (
            <span key={i} className="vis-deck-builder__summary-chip">{p}</span>
          ))}
        </div>
      )}

      {/* ── Grid ── */}
      <div className="vis-deck-builder__grid">
        {/* Header row: suit labels */}
        <div className="vis-deck-builder__corner" />
        {DISPLAY_SUITS.map(s => (
          <div key={s} className="vis-deck-builder__suit-header" style={{ color: SUIT_COLORS[s] }}>
            {SUIT_SYMBOLS[s]}
          </div>
        ))}

        {DISPLAY_RANKS.map(rank => (
          <Fragment key={`row-${rank}`}>
            <div className="vis-deck-builder__rank-header">{rank}</div>
            {DISPLAY_SUITS.map(suit => {
              const indices = cardIndex?.[rank]?.[suit] ?? [];
              const count = indices.length;
              const slot = count > 0 ? cards![indices[0]] : null;
              const isEmpty = count === 0;
              const isModified = slot && (
                slot.enhancement !== CardEnhancement.None ||
                slot.edition !== CardEdition.None ||
                slot.seal !== Seal.None
              );

              return (
                <div
                  key={`${rank}-${suit}`}
                  className={`vis-deck-builder__cell${isEmpty ? ' vis-deck-builder__cell--empty' : ''}${isModified ? ' vis-deck-builder__cell--modified' : ''}`}
                  onClick={() => openEditor(rank, suit)}
                  title={isEmpty ? t.deck.noCards : `${rank}${SUIT_SYMBOLS[suit]}${isModified ? ' *' : ''}`}
                >
                  {isEmpty ? (
                    <span className="vis-deck-builder__cell-empty-icon">+</span>
                  ) : (
                    <>
                      <span className="vis-deck-builder__cell-rank">{rank}</span>
                      <span className="vis-deck-builder__cell-suit" style={{ color: SUIT_COLORS[suit] }}>
                        {SUIT_SYMBOLS[suit]}
                      </span>
                      {slot!.enhancement !== CardEnhancement.None && (
                        <span
                          className="vis-deck-builder__cell-enh"
                          style={{ backgroundColor: ENH_COLORS[slot!.enhancement] }}
                        >
                          {t.enhancements[slot!.enhancement] ?? '-'}
                        </span>
                      )}
                      {slot!.edition !== CardEdition.None && (
                        <div
                          className="vis-deck-builder__cell-ed"
                          style={{ borderTopColor: EDITION_COLORS[slot!.edition] }}
                        />
                      )}
                      {slot!.seal !== Seal.None && (
                        <span
                          className="vis-deck-builder__cell-seal"
                          style={{ backgroundColor: SEAL_COLORS[slot!.seal] }}
                        />
                      )}
                      {count > 1 && (
                        <span className="vis-deck-builder__cell-count">{count}</span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      {/* ── Editor Overlay ── */}
      {editorOpen && (
        <div className="vis-deck-builder__overlay" onClick={closeEditor}>
          <div className="vis-deck-builder__editor" onClick={e => e.stopPropagation()}>
            <div className="vis-deck-builder__editor-title">
              {editorRank}
              <span style={{ color: SUIT_COLORS[editorSuit!], margin: '0 6px' }}>
                {SUIT_SYMBOLS[editorSuit!]}
              </span>
              ({editorCardCount} card{editorCardCount !== 1 ? 's' : ''})
            </div>

            <div className="vis-deck-builder__editor-row">
              <label className="vis-deck-builder__editor-label">{t.deck.enhancement}</label>
              <select className="vis-deck-builder__editor-select" value={editEnh} onChange={e => setEditEnh(e.target.value as CardEnhancement)}>
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

            <div className="vis-deck-builder__editor-row">
              <label className="vis-deck-builder__editor-label">{t.deck.edition}</label>
              <select className="vis-deck-builder__editor-select" value={editEd} onChange={e => setEditEd(e.target.value as CardEdition)}>
                <option value={CardEdition.None}>-</option>
                <option value={CardEdition.Foil}>Foil</option>
                <option value={CardEdition.Holographic}>Holo</option>
                <option value={CardEdition.Polychrome}>Poly</option>
                <option value={CardEdition.Negative}>Negative</option>
              </select>
            </div>

            <div className="vis-deck-builder__editor-row">
              <label className="vis-deck-builder__editor-label">{t.deck.seal}</label>
              <select className="vis-deck-builder__editor-select" value={editSeal} onChange={e => setEditSeal(e.target.value as Seal)}>
                <option value={Seal.None}>-</option>
                <option value={Seal.Red}>Red</option>
                <option value={Seal.Blue}>Blue</option>
                <option value={Seal.Gold}>Gold</option>
                <option value={Seal.Purple}>Purple</option>
              </select>
            </div>

            <div className="vis-deck-builder__editor-actions">
              <button className="vis-deck-builder__editor-btn vis-deck-builder__editor-btn--apply" onClick={handleApply}>
                {t.buttons.add}
              </button>
              <button className="vis-deck-builder__editor-btn vis-deck-builder__editor-btn--clear" onClick={handleClearModifiers}>
                {t.deck.clearModifiers}
              </button>
              <button className="vis-deck-builder__editor-btn vis-deck-builder__editor-btn--dup" onClick={handleAddDuplicate}>
                {t.deck.addDuplicate}
              </button>
              <button className="vis-deck-builder__editor-btn vis-deck-builder__editor-btn--remove" onClick={handleRemoveOne}>
                {t.deck.removeOne}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
