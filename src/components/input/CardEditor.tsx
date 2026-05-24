import { useI18n } from '../../i18n/context';
import type { Card } from '../../engine/types';
import {
  Rank, Suit, CardEnhancement, Seal, CardEdition,
  ALL_RANKS, ALL_SUITS,
} from '../../engine/types';

const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Spades]: '♠',
  [Suit.Hearts]: '♥',
  [Suit.Clubs]: '♣',
  [Suit.Diamonds]: '♦',
};

interface CardEditorProps {
  card: Card;
  onChange: (card: Card) => void;
  index: number;
}

export function CardEditor({ card, onChange, index }: CardEditorProps) {
  const { t } = useI18n();

  const updateField = <K extends keyof Card>(field: K, value: Card[K]) => {
    onChange({ ...card, [field]: value });
  };

  const isStone = card.enhancement === CardEnhancement.Stone;

  const ENHANCEMENTS: { value: CardEnhancement; label: string }[] = [
    { value: CardEnhancement.None, label: t.enhancementsLong.none },
    { value: CardEnhancement.Bonus, label: t.enhancementsLong.bonus },
    { value: CardEnhancement.Mult, label: t.enhancementsLong.mult },
    { value: CardEnhancement.Wild, label: t.enhancementsLong.wild },
    { value: CardEnhancement.Glass, label: t.enhancementsLong.glass },
    { value: CardEnhancement.Steel, label: t.enhancementsLong.steel },
    { value: CardEnhancement.Stone, label: t.enhancementsLong.stone },
    { value: CardEnhancement.Gold, label: t.enhancementsLong.gold },
    { value: CardEnhancement.Lucky, label: t.enhancementsLong.lucky },
  ];

  const SEALS: { value: Seal; label: string }[] = [
    { value: Seal.None, label: t.sealsLong.none },
    { value: Seal.Red, label: t.sealsLong.red },
    { value: Seal.Blue, label: t.sealsLong.blue },
    { value: Seal.Gold, label: t.sealsLong.gold },
    { value: Seal.Purple, label: t.sealsLong.purple },
  ];

  const EDITIONS: { value: CardEdition; label: string }[] = [
    { value: CardEdition.None, label: t.editionsLong.none },
    { value: CardEdition.Foil, label: t.editionsLong.foil },
    { value: CardEdition.Holographic, label: t.editionsLong.holo },
    { value: CardEdition.Polychrome, label: t.editionsLong.poly },
    { value: CardEdition.Negative, label: t.editionsLong.negative },
  ];

  return (
    <div className="card-editor">
      <span className="card-editor__index">#{index + 1}</span>

      {!isStone && (
        <>
          <select
            className="card-editor-select"
            aria-label="Rank"
            value={card.rank}
            onChange={e => updateField('rank', e.target.value as Rank)}
          >
            {ALL_RANKS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            className="card-editor-select"
            aria-label="Suit"
            value={card.suit}
            onChange={e => updateField('suit', e.target.value as Suit)}
          >
            {ALL_SUITS.map(s => (
              <option key={s} value={s}>{SUIT_SYMBOLS[s]} {s}</option>
            ))}
          </select>
        </>
      )}

      <select
        className="card-editor-select"
        aria-label="Enhancement"
        value={card.enhancement}
        onChange={e => updateField('enhancement', e.target.value as CardEnhancement)}
      >
        {ENHANCEMENTS.map(e => (
          <option key={e.value} value={e.value}>{e.label}</option>
        ))}
      </select>

      <select
        className="card-editor-select"
        aria-label="Edition"
        value={card.edition ?? CardEdition.None}
        onChange={e => updateField('edition', e.target.value as CardEdition)}
      >
        {EDITIONS.map(e => (
          <option key={e.value} value={e.value}>{e.label}</option>
        ))}
      </select>

      <select
        className="card-editor-select"
        aria-label="Seal"
        value={card.seal}
        onChange={e => updateField('seal', e.target.value as Seal)}
      >
        {SEALS.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}
