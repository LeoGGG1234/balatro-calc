import { useI18n } from '../../i18n/context';
import type { DiscardResult, DiscardOption } from '../../engine/discard-analyzer';
import type { DiscardStatus } from '../../hooks/useDiscardAnalysis';
import { CardComponent } from '../shared/CardComponent';
import { formatScore } from '../../engine/search';

interface DiscardPanelProps {
  result: DiscardResult | null;
  status: DiscardStatus;
  error: string | null;
  onAnalyze: () => void;
  onApplyDiscard?: (discardIndices: number[]) => void;
  discardsLeft?: number;
  activeBossEffect?: string | null;
}

export function DiscardPanel({ result, status, error, onAnalyze, onApplyDiscard, discardsLeft, activeBossEffect }: DiscardPanelProps) {
  const { t } = useI18n();

  // ─── Idle state ────────────────────────────────────────────
  if (status === 'idle') {
    return (
      <div className="discard-panel">
        <div className="discard-panel__idle">
          <p>{t.discard.idleMessage}</p>
          <button className="compute-btn" onClick={onAnalyze}>
            {t.discard.analyze}
          </button>
        </div>
      </div>
    );
  }

  // ─── Computing state ───────────────────────────────────────
  if (status === 'computing') {
    return (
      <div className="discard-panel">
        <div className="computing-state">
          <div className="computing-state__title">{t.discard.analyzing}</div>
          <div className="computing-state__subtitle">{t.states.evaluating}</div>
        </div>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="discard-panel">
        <div className="error-state">
          {t.states.error}: {error}
        </div>
        <button className="compute-btn" onClick={onAnalyze} style={{ marginTop: '16px' }}>
          {t.buttons.compute}
        </button>
      </div>
    );
  }

  // ─── Done state ────────────────────────────────────────────
  if (!result) return null;

  return (
    <div className="discard-panel">
      {/* Baseline info */}
      <div className="discard-panel__baseline">
        <div className="discard-panel__baseline-item">
          <span className="discard-panel__baseline-label">{t.discard.currentBest}</span>
          <span className="discard-panel__baseline-value">
            {t.handTypes[result.baselineHand]} — {formatScore(result.baselineScore)}
          </span>
        </div>
        <div className="discard-panel__baseline-item">
          <span className="discard-panel__baseline-label">{t.discard.discardsRemaining}</span>
          <span className="discard-panel__baseline-value">{result.discardsRemaining}</span>
        </div>
      </div>

      {/* Recommendations */}
      {result.topRecommendations.length > 0 ? (
        <div className="discard-panel__recommendations">
          <h3>{t.discard.title} ({result.topRecommendations.length})</h3>
          {result.topRecommendations.map((opt, i) => (
            <DiscardRecommendationCard
              key={i}
              option={opt}
              index={i}
              onApplyDiscard={onApplyDiscard}
              canApply={
                (discardsLeft ?? 0) > 0 &&
                activeBossEffect !== 'the_water'
              }
            />
          ))}
        </div>
      ) : (
        <div className="discard-panel__no-results">
          {t.discard.noBeneficial}
        </div>
      )}

      {/* Meta */}
      <div className="discard-panel__meta">
        {t.results.evaluated} {result.options.length} {t.results.combinations} {t.results.in}{' '}
        {result.evaluationTimeMs.toFixed(1)}ms
      </div>

      {/* Re-analyze button */}
      <button className="compute-btn" onClick={onAnalyze} style={{ marginTop: '12px' }}>
        {t.discard.analyze}
      </button>
    </div>
  );
}

// ─── Recommendation Card ────────────────────────────────────────

function DiscardRecommendationCard({
  option, index, onApplyDiscard, canApply,
}: {
  option: DiscardOption; index: number;
  onApplyDiscard?: (discardIndices: number[]) => void;
  canApply: boolean;
}) {
  const { t } = useI18n();
  const improvement = Math.round(option.improvement);
  const isPositive = improvement > 0;

  return (
    <div className="discard-panel__rec-card">
      <div className="discard-panel__rec-header">
        <span className="discard-panel__rec-index">#{index + 1}</span>
        <span className={`discard-panel__improvement ${isPositive ? 'discard-panel__improvement--positive' : 'discard-panel__improvement--negative'}`}>
          {isPositive ? '+' : ''}{improvement.toLocaleString()}
        </span>
      </div>

      {/* Card rows */}
      <div className="discard-panel__rec-cards">
        <div className="discard-panel__rec-row">
          <span className="discard-panel__rec-label discard-panel__rec-label--discard">
            {t.discard.discardThese} ({option.discardCards.length})
          </span>
          <div className="discard-panel__rec-card-row">
            {option.discardCards.map((c, i) => (
              <CardComponent key={i} card={c} size="sm" />
            ))}
          </div>
        </div>
        <div className="discard-panel__rec-row">
          <span className="discard-panel__rec-label discard-panel__rec-label--keep">
            {t.discard.keepThese} ({option.keptCards.length})
          </span>
          <div className="discard-panel__rec-card-row">
            {option.keptCards.map((c, i) => (
              <CardComponent key={i} card={c} size="sm" />
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="discard-panel__rec-stats">
        <span className="discard-panel__rec-target">
          {t.discard.targetHand}:{' '}
          <strong>{option.targetHandTypes.length > 0
            ? option.targetHandTypes.map(h => t.handTypes[h]).join(', ')
            : t.handTypes[option.bestHandWithKept]}
          </strong>
        </span>
      </div>

      {/* Rationale */}
      <div className="discard-panel__rationale">
        {option.rationale}
      </div>

      {/* Apply button */}
      {onApplyDiscard && (
        <button
          className="discard-panel__apply-btn"
          disabled={!canApply}
          title={!canApply ? t.discard.applyDisabled : t.discard.applyTooltip}
          onClick={() => onApplyDiscard(option.discardIndices)}
        >
          {t.discard.applySuggestion}
        </button>
      )}
    </div>
  );
}
