import { useState } from 'react';
import { useI18n } from '../../i18n/context';
import type { RunConfig, RunResult } from '../../engine/run-simulator';
import type { RunSimStatus } from '../../hooks/useRunSimulation';
import { RunSummary } from './RunSummary';
import { RunRoundCard } from './RunRoundCard';

interface RunSimPanelProps {
  status: RunSimStatus;
  result: RunResult | null;
  error: string | null;
  onRun: (config: Partial<RunConfig>) => void;
  onReset: () => void;
}

export function RunSimPanel({ status, result, error, onRun, onReset }: RunSimPanelProps) {
  const { t } = useI18n();
  const [maxAntes, setMaxAntes] = useState(3);
  const [enableShop, setEnableShop] = useState(false);
  const [randomBosses, setRandomBosses] = useState(false);
  const [seed, setSeed] = useState('');

  const handleRun = () => {
    onRun({ maxAntes, enableShop, randomBosses, seed: seed || undefined });
  };

  return (
    <div className="run-sim">
      <h2 className="run-sim__title">{t.runSim.title}</h2>

      {/* Config */}
      <div className="run-sim__config section">
        <div className="run-sim__config-row">
          <label className="run-sim__config-label">
            {t.runSim.config.maxAntes}
            <select
              className="input"
              value={maxAntes}
              onChange={e => setMaxAntes(Number(e.target.value))}
              disabled={status === 'running'}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="run-sim__config-label">
            <input
              type="checkbox"
              checked={enableShop}
              onChange={e => setEnableShop(e.target.checked)}
              disabled={status === 'running'}
            />
            {' '}{t.runSim.config.enableShop}
          </label>
          <label className="run-sim__config-label">
            <input
              type="checkbox"
              checked={randomBosses}
              onChange={e => setRandomBosses(e.target.checked)}
              disabled={status === 'running'}
            />
            {' '}{t.runSim.config.randomBosses}
          </label>
          <label className="run-sim__config-label">
            {t.runSim.config.seed}
            <input
              type="text"
              className="input"
              value={seed}
              onChange={e => setSeed(e.target.value)}
              disabled={status === 'running'}
              placeholder="e.g. ALEPH1337"
              style={{ width: 140 }}
            />
          </label>
        </div>
        <div className="run-sim__config-actions">
          <button
            className="compute-btn"
            onClick={handleRun}
            disabled={status === 'running'}
          >
            {status === 'running' ? t.runSim.running : t.runSim.runButton}
          </button>
          <button
            className="back-btn"
            onClick={onReset}
            disabled={status === 'running'}
          >
            {t.runSim.reset}
          </button>
        </div>
      </div>

      {/* Status-based rendering */}
      {status === 'idle' && (
        <div className="idle-state">{t.runSim.idleMessage}</div>
      )}

      {status === 'running' && (
        <div className="computing-state">
          <div className="computing-state__title">{t.runSim.running}</div>
        </div>
      )}

      {status === 'error' && (
        <div className="error-state">
          {t.states.error}: {error}
        </div>
      )}

      {/* Results */}
      {status === 'done' && result && (
        <>
          <RunSummary result={result} />

          <div className="run-sim__round-list">
            {result.rounds.map((round, i) => (
              <RunRoundCard key={i} round={round} />
            ))}
            {result.rounds.length === 0 && (
              <div className="idle-state">No rounds were simulated.</div>
            )}
          </div>

          {result.finalBlind === 'won' && (
            <div className="run-sim__final run-sim__final--won section section--green">
              All {result.config.maxAntes} antes cleared! Run complete.
            </div>
          )}
          {result.finalBlind === 'lost' && (
            <div className="run-sim__final run-sim__final--lost section">
              Run ended at Ante {result.finalAnte} — blind not beaten.
            </div>
          )}
        </>
      )}
    </div>
  );
}
