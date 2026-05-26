import { useState, useCallback } from 'react';
import { useI18n } from './i18n/context';
import { useGameState } from './hooks/useGameState';
import { useSearch } from './hooks/useSearch';
import { useDiscardAnalysis } from './hooks/useDiscardAnalysis';
import { useRunSimulation } from './hooks/useRunSimulation';
import { GameStateForm } from './components/input/GameStateForm';
import { ResultsPanel } from './components/results/ResultsPanel';
import { DiscardPanel } from './components/results/DiscardPanel';
import { ShopPanel } from './components/shop/ShopPanel';
import { RunSimPanel } from './components/run-sim/RunSimPanel';

type Tab = 'input' | 'discard' | 'results' | 'shop' | 'run-sim';

function App() {
  const [tab, setTab] = useState<Tab>('input');
  const { t, lang, toggleLang } = useI18n();
  const gameState = useGameState();
  const search = useSearch();
  const discardAnalysis = useDiscardAnalysis();
  const runSim = useRunSimulation();

  const handleJokerStateChange = useCallback((index: number, value: number) => {
    gameState.setJokerStateOverride(index, value);
  }, [gameState.setJokerStateOverride]);

  const handleApplyDiscardSuggestion = useCallback((discardIndices: number[]) => {
    gameState.applyDiscardSuggestion(discardIndices);
  }, [gameState.applyDiscardSuggestion]);

  const handleCompute = useCallback(() => {
    search.search(gameState.form, {
      includeJokerOrdering: true,
      maxComputationMs: 10000,
    }, {
      jokerStateOverrides: gameState.form.jokerStateOverrides,
    });
    setTab('results');
  }, [gameState.form, search]);

  const handleAnalyzeDiscards = useCallback(() => {
    discardAnalysis.analyze(gameState.form, {
      includeJokerOrdering: true,
      maxComputationMs: 10000,
    }, {
      jokerStateOverrides: gameState.form.jokerStateOverrides,
    });
  }, [gameState.form, discardAnalysis]);

  const handleRunSimulation = useCallback((config: Parameters<typeof runSim.run>[1]) => {
    runSim.run(gameState.form, config);
  }, [gameState.form, runSim]);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div>
          <h1 className="app-header__title">{t.app.title}</h1>
          <span className="app-header__subtitle">{t.app.subtitle}</span>
        </div>
        <div className="app-header__actions">
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className={tab === 'input' ? 'tab-btn tab-btn--active' : 'tab-btn'}
              onClick={() => setTab('input')}
            >
              {t.tabs.input}
            </button>
            <button
              className={tab === 'discard' ? 'tab-btn tab-btn--active' : 'tab-btn'}
              onClick={() => setTab('discard')}
            >
              {t.tabs.discard}
              {discardAnalysis.status === 'computing' ? ' ...' : ''}
            </button>
            <button
              className={tab === 'results' ? 'tab-btn tab-btn--active' : 'tab-btn'}
              onClick={() => setTab('results')}
              disabled={search.status === 'idle'}
            >
              {t.tabs.results}
              {search.status === 'computing' ? ' ...' : ''}
            </button>
            <button
              className={tab === 'shop' ? 'tab-btn tab-btn--active' : 'tab-btn'}
              onClick={() => setTab('shop')}
            >
              {t.tabs.shop}
            </button>
            <button
              className={tab === 'run-sim' ? 'tab-btn tab-btn--active' : 'tab-btn'}
              onClick={() => setTab('run-sim')}
            >
              {t.tabs.runSim}
              {runSim.status === 'running' ? ' ...' : ''}
            </button>
          </div>
          <button
            className="lang-toggle"
            onClick={toggleLang}
            title={lang === 'en' ? 'Switch to Chinese' : '切换到英文'}
          >
            {lang === 'en' ? '中' : 'EN'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {tab === 'input' && (
          <GameStateForm
            form={gameState.form}
            effectiveMaxHands={gameState.effectiveMaxHands}
            effectiveMaxDiscards={gameState.effectiveMaxDiscards}
            effectiveHandSize={gameState.effectiveHandSize}
            onUpdateCard={gameState.setHandCard}
            onParseNotation={gameState.setHandCards}
            onInjectSave={gameState.injectSaveState}
            onAddJoker={gameState.addJoker}
            onRemoveJoker={gameState.removeJoker}
            onReorderJokers={gameState.reorderJokers}
            onSetHandLevel={gameState.setHandLevel}
            onUpdateField={gameState.updateField}
            onToggleVoucher={gameState.toggleVoucher}
            onSetBossEffect={gameState.setBossEffect}
            onCompute={handleCompute}
            computing={search.status === 'computing'}
            jokerStateOverrides={gameState.form.jokerStateOverrides}
            onJokerStateChange={handleJokerStateChange}
            onSetDeckComposition={gameState.setDeckComposition}
            onResetDeckToStandard={gameState.resetDeckToStandard}
            onAddCardToDeck={gameState.addCardToDeck}
            onRemoveCardFromDeck={gameState.removeCardFromDeck}
            onApplyDeckPreset={gameState.applyDeckPreset}
            onUpdateDeckCard={gameState.updateDeckCard}
            onBatchUpdateDeckCards={gameState.batchUpdateDeckCards}
          />
        )}

        {tab === 'discard' && (
          <DiscardPanel
            result={discardAnalysis.result}
            status={discardAnalysis.status}
            error={discardAnalysis.error}
            onAnalyze={handleAnalyzeDiscards}
            onApplyDiscard={handleApplyDiscardSuggestion}
            discardsLeft={gameState.effectiveMaxDiscards - gameState.form.discardsUsed}
            activeBossEffect={gameState.form.activeBossEffect}
          />
        )}

        {tab === 'results' && (
          <>
            {search.status === 'computing' && (
              <div className="computing-state">
                <div className="computing-state__title">{t.states.computing}</div>
                <div className="computing-state__subtitle">{t.states.evaluating}</div>
              </div>
            )}

            {search.status === 'done' && search.result && (
              <ResultsPanel result={search.result} />
            )}

            {search.status === 'error' && (
              <div className="error-state">
                {t.states.error}: {search.error}
              </div>
            )}

            {search.status === 'idle' && (
              <div className="idle-state">
                {t.states.idleMessage}
              </div>
            )}

            <button className="back-btn" onClick={() => setTab('input')}>
              {t.buttons.backToInput}
            </button>
          </>
        )}

        {tab === 'shop' && (
          <ShopPanel
            gameState={gameState.buildState()}
            dollars={gameState.form.dollars}
            onBuyJoker={(jokerId) => gameState.addJoker(jokerId)}
            onUpgradeHand={(handType) => {
              const currentLevel = gameState.form.handLevels[handType] ?? 1;
              gameState.setHandLevel(handType, currentLevel + 1);
            }}
            onBuyVoucher={(voucherId) => gameState.toggleVoucher(voucherId)}
            onDollarChange={(dollars) => gameState.updateField('dollars', dollars)}
          />
        )}

        {tab === 'run-sim' && (
          <RunSimPanel
            status={runSim.status}
            result={runSim.result}
            error={runSim.error}
            onRun={handleRunSimulation}
            onReset={runSim.reset}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        {t.app.footer}
      </footer>
    </div>
  );
}

export default App;
