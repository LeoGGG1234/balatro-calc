import { useI18n } from '../../i18n/context';
import type { RoundResult } from '../../engine/run-simulator';
import { formatScore } from '../../engine/search';
import { CardComponent } from '../shared/CardComponent';
import { JokerBadge } from '../shared/JokerBadge';

interface RunRoundCardProps {
  round: RoundResult;
  index: number;
}

export function RunRoundCard({ round }: RunRoundCardProps) {
  const { t } = useI18n();
  const bossName = round.bossId ? (t.runSim.bossNames[round.bossId] ?? round.blindName) : round.blindName;

  return (
    <div className={`run-sim__round ${round.blindBeaten ? 'run-sim__round--beaten' : 'run-sim__round--lost'}`}>
      <div className="run-sim__round-header">
        <span className="run-sim__round-title">
          {t.runSim.round.header.replace('{ante}', String(round.ante)).replace('{blind}', bossName)}
        </span>
        <span className={`run-sim__round-status ${round.blindBeaten ? 'run-sim__round-status--win' : 'run-sim__round-status--loss'}`}>
          {round.blindBeaten ? t.runSim.round.blindBeaten : t.runSim.round.blindLost}
        </span>
      </div>

      <div className="run-sim__round-body">
        <div className="run-sim__round-score-bar">
          <div className="run-sim__round-score-bar-label">
            <span>{t.runSim.round.score}: {formatScore(round.totalScore)}</span>
            <span>{t.runSim.round.chipsRequired}: {formatScore(round.chipsRequired)}</span>
          </div>
          <div className="run-sim__round-bar">
            <div
              className={`run-sim__round-bar-fill ${round.blindBeaten ? 'run-sim__round-bar-fill--win' : 'run-sim__round-bar-fill--loss'}`}
              style={{ width: `${Math.min(100, (round.totalScore / round.chipsRequired) * 100)}%` }}
            />
          </div>
        </div>

        <div className="run-sim__round-info">
          <div className="run-sim__round-meta">
            <span>{t.runSim.round.handPlayed}: <strong>{t.handTypes[round.handTypePlayed]}</strong></span>
            <span>{t.runSim.round.handsUsed}: {round.handsUsed} | {t.runSim.round.discardsUsed}: {round.discardsUsed}</span>
            {round.roundEarnings > 0 && (
              <span className="run-sim__round-earnings">+${round.roundEarnings}</span>
            )}
            <span className="run-sim__round-dollars">${round.cumulativeDollars}</span>
          </div>
        </div>

        {round.cardsPlayed.length > 0 && (
          <div className="run-sim__round-section">
            <div className="run-sim__round-section-label">{t.results.playTheseCards}</div>
            <div className="run-sim__round-cards">
              {round.cardsPlayed.map(c => (
                <CardComponent key={c.id} card={c} size="sm" />
              ))}
            </div>
          </div>
        )}

        {round.cardsHeld.length > 0 && (
          <div className="run-sim__round-section">
            <div className="run-sim__round-section-label">{t.results.held}</div>
            <div className="run-sim__round-cards">
              {round.cardsHeld.map(c => (
                <CardComponent key={c.id} card={c} size="sm" />
              ))}
            </div>
          </div>
        )}

        <div className="run-sim__round-section">
          <div className="run-sim__round-section-label">{t.runSim.round.jokers} ({round.jokersAtRound.length})</div>
          <div className="run-sim__round-jokers">
            {round.jokersAtRound.map((j, i) => (
              <JokerBadge key={`${j.id}_${i}`} joker={j} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
