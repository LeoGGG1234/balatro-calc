import { useI18n } from '../../i18n/context';
import { HandType } from '../../engine/types';
import type { HandLevels } from '../../engine/types';
import { getHandBaseChips, getHandBaseMult } from '../../engine/constants';

const ALL_HANDS = [
  HandType.HighCard,
  HandType.Pair,
  HandType.TwoPair,
  HandType.ThreeOfAKind,
  HandType.Straight,
  HandType.Flush,
  HandType.FullHouse,
  HandType.FourOfAKind,
  HandType.StraightFlush,
  HandType.FiveOfAKind,
  HandType.FlushHouse,
  HandType.FlushFive,
];

interface HandLevelInputProps {
  levels: HandLevels;
  onChange: (handType: HandType, level: number) => void;
}

export function HandLevelInput({ levels, onChange }: HandLevelInputProps) {
  const { t } = useI18n();

  return (
    <div>
      <h3 className="section h3">{t.sections.handLevels}</h3>
      <div className="hand-levels-grid">
        {ALL_HANDS.map(ht => {
          const level = levels[ht] ?? 1;
          const chips = getHandBaseChips(ht, level);
          const mult = getHandBaseMult(ht, level);

          return (
            <div key={ht} className="hand-level-row">
              <span className="hand-level-label">
                {t.handTypes[ht]}
              </span>
              <input
                type="number"
                className="hand-level-input"
                min={1}
                max={100}
                value={level}
                aria-label={`${t.handTypes[ht]} level`}
                onChange={e => onChange(ht, Math.max(1, parseInt(e.target.value) || 1))}
              />
              <span className="hand-level-stats">
                {chips} × {mult}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
