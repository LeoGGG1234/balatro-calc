import { useI18n } from '../../i18n/context';
import type { RunResult } from '../../engine/run-simulator';
import { formatScore } from '../../engine/search';

interface RunSummaryProps {
  result: RunResult;
}

export function RunSummary({ result }: RunSummaryProps) {
  const { t } = useI18n();

  return (
    <div className="run-sim__summary">
      <div className="run-sim__summary-stat">
        <span className="run-sim__summary-value">{result.antesCleared}/{result.config.maxAntes}</span>
        <span className="run-sim__summary-label">{t.runSim.summary.antesCleared}</span>
      </div>
      <div className="run-sim__summary-stat">
        <span className="run-sim__summary-value">{formatScore(result.totalScore)}</span>
        <span className="run-sim__summary-label">{t.runSim.summary.totalScore}</span>
      </div>
      <div className="run-sim__summary-stat">
        <span className="run-sim__summary-value">{result.roundsSurvived}</span>
        <span className="run-sim__summary-label">{t.runSim.summary.roundsSurvived}</span>
      </div>
      <div className="run-sim__summary-stat">
        <span className="run-sim__summary-value">${result.finalDollars}</span>
        <span className="run-sim__summary-label">{t.runSim.summary.finalDollars}</span>
      </div>
      <div className="run-sim__summary-stat">
        <span className="run-sim__summary-value">{(result.totalSimulationTimeMs / 1000).toFixed(2)}s</span>
        <span className="run-sim__summary-label">{t.runSim.summary.totalTime}</span>
      </div>
    </div>
  );
}
