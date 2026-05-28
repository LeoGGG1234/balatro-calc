import { useI18n } from '../../i18n/context';
import type { Card, SearchResult, ScoredPlay } from '../../engine/types';
import { HandType } from '../../engine/types';
import { formatScore } from '../../engine/search';
import { getJoker } from '../../engine/joker-effects';
import { CardComponent } from '../shared/CardComponent';

interface ResultsPanelProps {
  result: SearchResult;
  handCards?: Card[];
  handsRemaining?: number;
  onPlayHand?: (playedCardIndices: number[], score: number, handType: HandType) => void;
}

export function ResultsPanel({ result, handCards, handsRemaining, onPlayHand }: ResultsPanelProps) {
  const { t } = useI18n();

  if (!result.optimalPlay) {
    return (
      <div style={{ color: '#94a3b8', padding: '20px', textAlign: 'center' }}>
        {t.states.noValidPlay}
      </div>
    );
  }

  const play = result.optimalPlay;

  // Map played cards back to original handCards indices by matching card.id
  const playedIndices: number[] = [];
  if (handCards && onPlayHand) {
    const playedIds = new Set(play.playedCards.map(c => c.id));
    for (let i = 0; i < handCards.length; i++) {
      if (playedIds.has(handCards[i].id)) {
        playedIndices.push(i);
      }
    }
  }

  return (
    <div className="results">
      {/* Optimal Play Card */}
      <section className="results__optimal">
        <h2>{t.sections.optimalPlay}</h2>

        <div className="results__optimal-content">
          {/* Hand type + Score */}
          <div className="results__optimal-hand">
            <div className="results__hand-type">{t.results.handType}</div>
            <div className="results__hand-name">
              {t.handTypes[play.handType]}
            </div>
            <div className="results__score-label">{t.results.score}</div>
            <div className="results__score">
              {formatScore(play.totalScore)}
            </div>
            {result.rankedHands.length > 0 && (
              <div className="results__score-vs-blind">
                {t.results.vsBlind}: {formatScore(play.totalScore)}
              </div>
            )}
          </div>

          {/* Played Cards */}
          <div className="results__card-section">
            <div className="results__card-section-label">
              {t.results.playTheseCards} ({play.playedCards.length})
            </div>
            <div className="results__card-row">
              {play.playedCards.map(c => (
                <CardComponent key={c.id} card={c} size="sm" selected />
              ))}
            </div>
          </div>

          {/* Held Cards */}
          {play.heldCards.length > 0 && (
            <div className="results__card-section">
              <div className="results__card-section-label">
                {t.results.held} ({play.heldCards.length})
              </div>
              <div className="results__card-row">
                {play.heldCards.map(c => (
                  <CardComponent key={c.id} card={c} size="sm" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Joker Order */}
        {play.jokerOrder.length > 0 && (
          <div className="results__joker-order">
            <div className="results__joker-order-label">
              {t.results.jokerOrder}
            </div>
            <div className="results__joker-order-row">
              {play.jokerOrder.map((idx, pos) => {
                const entry = play.breakdown.jokerScores.find(js => js.jokerIndex === idx);
                const def = getJoker(entry?.jokerId ?? '');
                const name = def ? (t.jokerNames[def.id] ?? def.name) : (entry?.jokerId ?? '?');
                return (
                  <div key={pos} className="results__joker-order-item">
                    <span className="results__joker-order-num">{pos + 1}.</span>{' '}
                    {name}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Play Hand button */}
        {onPlayHand && (
          <div className="results__play-hand">
            <button
              className="btn-play-hand"
              disabled={!handsRemaining || handsRemaining <= 0}
              onClick={() => onPlayHand(playedIndices, play.totalScore, play.handType)}
            >
              Play This Hand ({t.handTypes[play.handType]}) →
            </button>
            {handsRemaining !== undefined && handsRemaining <= 0 && (
              <span className="results__no-hands">No hands remaining</span>
            )}
          </div>
        )}
      </section>

      {/* Scoring Breakdown */}
      <section className="results__breakdown">
        <h3>{t.sections.scoringBreakdown}</h3>
        <ScoringBreakdownView play={play} />
      </section>

      {/* All Hands Comparison */}
      <section className="results__table">
        <h3>{t.sections.allHandsComparison}</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.results.rank}</th>
              <th>{t.results.handType2}</th>
              <th>{t.results.bestScore}</th>
              <th>{t.results.combinations}</th>
            </tr>
          </thead>
          <tbody>
            {result.rankedHands.map((h, i) => (
              <tr key={h.handType}>
                <td>{i + 1}</td>
                <td>{t.handTypes[h.handType]}</td>
                <td style={{ fontFamily: 'monospace', color: '#f6e05e' }}>
                  {formatScore(h.bestScore)}
                </td>
                <td>{h.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Meta */}
      <div className="results__meta">
        {t.results.evaluated} {result.combinationsEvaluated} {t.results.combinations} {t.results.in}{' '}
        {result.evaluationTimeMs.toFixed(1)}ms
      </div>
    </div>
  );
}

// ─── Scoring Breakdown View ────────────────────────────────────

function ScoringBreakdownView({ play }: { play: ScoredPlay }) {
  const { t } = useI18n();
  const { breakdown } = play;

  return (
    <div className="breakdown">
      <div className="breakdown__base">
        {t.results.base}: {t.handTypes[breakdown.baseHand.handType]}{' '}
        ({t.states.level}.{breakdown.baseHand.level}):{' '}
        <span className="breakdown__base-value">
          {breakdown.baseHand.chips} chips × {breakdown.baseHand.mult} mult ={' '}
          {formatScore(breakdown.baseHand.chips * breakdown.baseHand.mult)}
        </span>
      </div>

      {breakdown.cardScores.length > 0 && (
        <div className="breakdown__card-triggers">
          {t.results.cards}: {breakdown.cardScores.length} triggers, total chips contribution
        </div>
      )}

      {breakdown.jokerScores.length > 0 && (
        <div className="breakdown__joker-list">
          <div className="breakdown__joker-label">{t.results.jokers}:</div>
          {breakdown.jokerScores.map(js => {
            const def = getJoker(js.jokerId);
            const name = def ? (t.jokerNames[def.id] ?? def.name) : js.jokerId;
            return (
              <div key={js.jokerIndex} className="breakdown__joker-row">
                <span className="breakdown__joker-name">
                  #{js.jokerIndex + 1} {name}
                </span>
                <span className="breakdown__joker-mod">
                  {js.chipsAdded > 0 ? `+${js.chipsAdded} chips` : ''}
                  {js.plusMult > 0 ? ` +${js.plusMult} mult` : ''}
                  {js.xMult > 1 && js.xMult !== js.plusMult ? ` ×${js.xMult.toFixed(1)}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="breakdown__total">
        {(breakdown.totalChips).toFixed(0)} chips × {(breakdown.totalMult).toFixed(1)} mult
        {' = '}
        {formatScore(breakdown.finalScore)}
      </div>
    </div>
  );
}
