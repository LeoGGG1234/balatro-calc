import { useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from './i18n/context';
import { HandType } from './engine/types';
import type { SearchResult } from './engine/types';
import { useGameState } from './hooks/useGameState';
import { useSearch } from './hooks/useSearch';
import { useDiscardAnalysis } from './hooks/useDiscardAnalysis';
import { useRunSimulation } from './hooks/useRunSimulation';
import { useModConnection } from './hooks/useModConnection';
import { GameStateForm } from './components/input/GameStateForm';
import { ResultsPanel } from './components/results/ResultsPanel';
import { DiscardPanel } from './components/results/DiscardPanel';
import { ShopPanel } from './components/shop/ShopPanel';
import { RunSimPanel } from './components/run-sim/RunSimPanel';
import { ModConnectionIndicator } from './components/mod/ModConnectionIndicator';

type Tab = 'input' | 'discard' | 'results' | 'shop' | 'run-sim';

function App() {
  const [tab, setTab] = useState<Tab>('input');
  const { t, lang, toggleLang } = useI18n();
  const gameState = useGameState();
  const search = useSearch();
  const discardAnalysis = useDiscardAnalysis();
  const runSim = useRunSimulation();
  const modConn = useModConnection();

  // Track whether we've done the initial state injection from mod
  const modInjectedRef = useRef(false);
  // Prevent duplicate auto-highlights for the same search result
  const lastHighlightedResultRef = useRef<SearchResult | null>(null);

  // ── Mod auto-inject ────────────────────────────────────────────
  // When the mod pushes new state, inject it into the form.
  useEffect(() => {
    if (modConn.lastState && modConn.status === 'connected') {
      gameState.injectSaveState(modConn.lastState);
      // Only switch to input tab on first connection, not on every poll
      if (!modInjectedRef.current) {
        modInjectedRef.current = true;
        setTab('input');
      }
      // Clear highlights when state changes (cards may have been played/discarded)
      modConn.clearHighlights();
    }
    if (modConn.status === 'disconnected') {
      modInjectedRef.current = false;
    }
  }, [modConn.lastState, modConn.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-highlight best hand when compute finishes ──────────────
  useEffect(() => {
    if (search.status === 'done' && search.result && modConn.status === 'connected') {
      // Only highlight once per new result
      if (search.result !== lastHighlightedResultRef.current) {
        lastHighlightedResultRef.current = search.result;
        const bestPlay = search.result.optimalPlay;
        if (bestPlay && bestPlay.playedCards.length > 0) {
          const handCardIds = gameState.form.handCards.map(c => c.id);
          const indices = bestPlay.playedCards
            .map(pc => handCardIds.indexOf(pc.id))
            .filter(i => i >= 0);
          if (indices.length > 0) {
            modConn.highlightPlayCards(indices);
          }
        }
      }
    }
  }, [search.status, search.result, modConn.status, modConn.highlightPlayCards, gameState.form.handCards]);

  const handleJokerStateChange = useCallback((index: number, value: number) => {
    gameState.setJokerStateOverride(index, value);
  }, [gameState.setJokerStateOverride]);

  const handleApplyDiscardSuggestion = useCallback((discardIndices: number[]) => {
    gameState.applyDiscardSuggestion(discardIndices);
    modConn.highlightDiscardCards(discardIndices);
  }, [gameState.applyDiscardSuggestion, modConn]);

  const handlePlayHand = useCallback((indices: number[], score: number, handType: HandType) => {
    gameState.playHand(indices, score, handType);
    modConn.highlightPlayCards(indices);
    // Stay on results tab so highlights persist until mod detects new state
  }, [gameState.playHand, modConn]);

  const handleNewRound = useCallback(() => {
    gameState.newRound();
  }, [gameState.newRound]);

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
          <ModConnectionIndicator
            status={modConn.status}
            lastPollTime={modConn.lastPollTime}
          />
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
            onNewRound={handleNewRound}
            onSelectDeck={gameState.selectDeck}
            onSelectStake={gameState.selectStake}
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
              <ResultsPanel
                result={search.result}
                handCards={gameState.form.handCards}
                handsRemaining={gameState.effectiveMaxHands - gameState.form.handsPlayed}
                onPlayHand={handlePlayHand}
              />
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
