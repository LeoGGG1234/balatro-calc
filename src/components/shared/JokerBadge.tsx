import { useI18n } from '../../i18n/context';
import type { JokerInstance } from '../../engine/types';
import { getJoker } from '../../engine/joker-effects';
import { JOKER_STATE_INPUTS } from '../../engine/joker-data';

interface JokerBadgeProps {
  joker: JokerInstance;
  index: number;
  onRemove?: (index: number) => void;
  stateValue?: number;
}

const RARITY_BORDER_COLORS: Record<string, string> = {
  common: '#e2e8f0',
  uncommon: '#68d391',
  rare: '#fc8181',
  legendary: '#f6ad55',
};

export function JokerBadge({ joker, index, onRemove, stateValue }: JokerBadgeProps) {
  const { t } = useI18n();
  const def = getJoker(joker.id);
  const name = def ? (t.jokerNames[joker.id] ?? def.name) : 'Unknown Joker';
  const rarity = def?.rarity ?? 'common';
  const stateInput = JOKER_STATE_INPUTS[joker.id];
  const borderColor = RARITY_BORDER_COLORS[rarity] ?? '#e2e8f0';

  return (
    <div
      className="joker-badge"
      style={{ border: `2px solid ${borderColor}` }}
    >
      <span className="joker-badge__index">{index + 1}</span>
      <span className="joker-badge__name" style={{ color: borderColor }}>
        {name}
      </span>
      <span className="joker-badge__rarity">
        {t.rarities[rarity]}
      </span>
      {joker.edition && joker.edition !== 'none' && (
        <span className="joker-badge__edition">
          {t.editions[joker.edition]}
        </span>
      )}
      {stateInput && stateValue !== undefined && (
        <span className="joker-badge__state">
          {stateInput.unit}: {stateValue}
        </span>
      )}
      {onRemove && (
        <button
          className="joker-badge__remove"
          onClick={() => onRemove(index)}
          aria-label={`Remove ${name}`}
        >
          ×
        </button>
      )}
    </div>
  );
}
