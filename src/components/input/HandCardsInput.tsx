import { useI18n } from '../../i18n/context';
import type { Card } from '../../engine/types';
import { CardComponent } from '../shared/CardComponent';
import { CardEditor } from './CardEditor';

interface HandCardsInputProps {
  cards: Card[];
  onUpdateCard: (index: number, card: Card) => void;
}

export function HandCardsInput({ cards, onUpdateCard }: HandCardsInputProps) {
  const { t } = useI18n();

  if (cards.length === 0) {
    return (
      <div>
        <h3 className="section h3">{t.sections.handCards} (0)</h3>
        <div className="hand-cards-empty">No cards in hand. Add cards to your hand.</div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="section h3">{t.sections.handCards} ({cards.length})</h3>
      <div className="hand-cards-grid">
        {cards.map((card, i) => (
          <div key={`${card.id}_${i}`} className="hand-card-cell">
            <CardComponent card={card} size="sm" />
            <CardEditor card={card} onChange={(c) => onUpdateCard(i, c)} index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}
