import { useState } from 'react';
import { useI18n } from '../../i18n/context';
import type { Card } from '../../engine/types';
import { CardComponent } from '../shared/CardComponent';
import { CardEditor } from './CardEditor';
import { CardNotationInput } from './CardNotationInput';

interface HandCardsInputProps {
  cards: Card[];
  onUpdateCard: (index: number, card: Card) => void;
  onParseNotation?: (cards: Card[]) => void;
}

type InputMode = 'grid' | 'notation';

export function HandCardsInput({ cards, onUpdateCard, onParseNotation }: HandCardsInputProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<InputMode>('grid');

  return (
    <div>
      <div className="hand-cards-header">
        <h3 className="section h3">{t.sections.handCards} ({cards.length})</h3>
        {onParseNotation && (
          <div className="hand-cards-mode-tabs">
            <button
              className={`hand-cards-mode-tab${mode === 'grid' ? ' hand-cards-mode-tab--active' : ''}`}
              onClick={() => setMode('grid')}
            >
              Grid
            </button>
            <button
              className={`hand-cards-mode-tab${mode === 'notation' ? ' hand-cards-mode-tab--active' : ''}`}
              onClick={() => setMode('notation')}
            >
              {t.notation.title}
            </button>
          </div>
        )}
      </div>

      {mode === 'notation' && onParseNotation ? (
        <CardNotationInput onParse={onParseNotation} />
      ) : cards.length === 0 ? (
        <div className="hand-cards-empty">No cards in hand. Add cards to your hand.</div>
      ) : (
        <div className="hand-cards-grid">
          {cards.map((card, i) => (
            <div key={`${card.id}_${i}`} className="hand-card-cell">
              <CardComponent card={card} size="sm" />
              <CardEditor card={card} onChange={(c) => onUpdateCard(i, c)} index={i} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
