# 🃏 Balatro Calc

> **A High-Performance, Zero-Dependency, AI-Native Numerical Simulator for Balatro**
>
> *高精度、零依赖、AI 原生的《小丑牌》数值模拟器 — 穷举最优出牌、完美时序结算、确定性多轮推演。*

---

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646cff)](https://vite.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-4.1-6e9f2a)](https://vitest.dev/)
[![Tests](https://img.shields.io/badge/Tests-316%20passed-brightgreen)]()
[![License](https://img.shields.io/badge/License-MIT-yellow)]()

---

## English

### 🚀 Overview

**Balatro Calc** solves a hard numerical optimization problem hidden inside a poker roguelike: given up to 7 jokers with nonlinear stacking rules, 9 card enhancements, 5 editions, 5 seals, 13 hand types, 28 boss blinds, and a stateful deck of up to 52+ cards, what is the **provably optimal** set of cards to play — and in what joker order — to maximize your score?

The engine answers this question through exhaustive combinatorial search over all card subsets × all meaningful joker orderings, evaluating each candidate through a faithful five-phase scoring pipeline that reproduces Balatro's exact evaluation order: card scoring → held-in-hand enhancements → held-in-hand jokers → joker evaluation (left-to-right) → final score. Every retrigger, every Blueprint copy chain, every boss debuff, every Steel card held in hand is accounted for.

But the project goes beyond single-hand optimization. The **run simulator** plays through up to 8 antes (24 blinds), simulating every boss effect, every shop phase, and every draw from a dynamic deck — all driven by a deterministic Knuth LCG seeded for perfect reproducibility. The **discard analyzer** exhaustively enumerates discard subsets and estimates post-draw expected value using deck composition heuristics.

**Key design principle:** every scoring function is **pure**. `scorePlay()` never mutates its `GameState` argument. Identical inputs always produce identical outputs. This property makes the engine auditable, testable, and composable — you can fork search branches, inject hypothetical joker states via `jokerStateOverrides`, and compare results with zero cross-contamination.

---

### ⚡ Core Features

#### 1. Five-Phase Scoring Pipeline — Exact Evaluation Order

```
Phase 1: Card Scoring (per card, per trigger, with onCardScored joker callbacks)
   ↓
Phase 2: Held-in-Hand Enhancements (Steel ×1.5, Mime double-pass aware)
   ↓
Phase 3: Held-in-Hand Jokers (Baron ×1.5/King, Shoot the Moon +13/Queen)
   ↓
Phase 4: Joker Evaluation (left-to-right, Blueprint/Brainstorm resolved recursively)
   ↓
Phase 5: Final Score = totalChips × totalMult
```

Boss blind constraints (`mustPlayFiveCards`, `forbiddenHandTypes`, `forcedHandType`, `forcedCardId`) are enforced before scoring — violating plays return zero.

#### 2. Multi-Retrigger Nesting — The Full Combinatorics

Retriggers stack additively across five independent sources:
- **Red Seal** → +1 retrigger
- **Sock and Buskin** → +1 for face cards
- **Hack** → +1 for ranks 2–5
- **Seltzer** → +1 for all cards
- **Hanging Chad** → +2 on the first played card
- **Dusk** → +1 if this is the final hand

Each trigger fires `onCardScored` joker effects (Photograph ×2, Triboulet ×2, etc.) — meaning retrigger stacking is multiplicative with ×Mult jokers. The engine counts all trigger slots correctly and records per-trigger contributions in the `ScoringBreakdown`.

#### 3. Deterministic RNG & Pure-Function State Isolation

Every source of randomness — card draws, boss selection (random mode), Crimson Heart target selection, Amber Acorn shuffle, The Hook debuff targets — flows through a single `createRng(seed)` using Knuth's classic LCG (`s = (s × 1664525 + 1013904223) >>> 0`). String seeds are hashed via djb2.

**`jokerStateOverrides`** is the mechanism for injecting accumulated state into state-driven jokers (37 total). It operates as a `Record<number, number>` — joker index → override value — passed per-call to `scorePlay()`. Because `scorePlay()` is pure, calling it with different overrides on the same `GameState` produces **independent, non-interfering results**. This is formally verified in our test suite: back-to-back calls with different Obelisk ×Mult values produce exactly the expected scores with zero cross-contamination across 10 consecutive trials.

#### 4. Dynamic Deck Swelling — Real-Time Aggregate Propagation

When a DNA-like effect adds a card to the deck, `addCardToDeck()` atomically:
1. Pushes a `DeckCardSlot` to the `cards[]` array
2. Rebuilds ALL aggregates via `buildAggregateFromCards()`: `remainingByRank`, `remainingBySuit`, `totalByRank`, `totalBySuit`, `enhancementCounts`, `editionCounts`, `sealCounts`, `totalCards`

Economy jokers that depend on deck composition (Cloud 9 reads `totalByRank[Nine]`, Rough Gem reads `totalBySuit[Diamonds]`) immediately reflect the new card in `calculateJokerIncome()` — the aggregate rebuild is transactional and consistent by construction.

#### 5. Order-Sensitive Pipeline — Non-Commutative Joker Sequencing

`+10 mult then ×3` ≠ `×3 then +10 mult`. The engine respects this: `jokerOrder` is a parameter on every `PlayCandidate`, and the scorer evaluates jokers strictly left-to-right. Our smart ordering optimizer (`generateOptimalJokerOrderings()`) classifies jokers into `chips → +mult → ×mult → retrigger` categories and prunes the canonical order, while enumerating meaningful Blueprint/Brainstorm copy positions.

The Midas Mask → Vampire pipeline (Gold enhancement applied by Midas, then consumed by Vampire for ×0.1) is verified in tests: left-to-right evaluation order means Midas must appear BEFORE Vampire in the joker order for the synergy to work.

#### 6. Debuff Mechanics — Decoupled from Hand Recognition

Debuffed cards contribute **zero** chips and mult in scoring (Phase 1) and held-in-hand effects (Phase 2). However, they **still count** for hand type recognition in `recognizeHand()` — a debuffed King still counts toward a Pair of Kings. This mirrors Balatro's actual behavior where debuffs only affect scoring, not hand eligibility.

The Plasma Deck formula (`floor((chips + mult) / 2)^2`) is applied as a **final post-processing step** after the full scoring pipeline. The Flint halves hand levels BEFORE jokers contribute, as verified in tests.

#### 7. Smart Joker Ordering — Combinatorial Pruning

```
chips → plus_mult → xmult → retrigger → brainstorm → blueprint → other
```

For configurations without Blueprint/Brainstorm, the optimizer prunes to exactly 1 canonical ordering. With a single Blueprint, it enumerates `n` positions (left of each copyable joker + far right). This reduces the search space from `n!` to `O(n)` for typical configurations while still finding the optimal order.

#### 8. Run Simulator — 28/28 Boss Blinds, Full Shop Economy

The simulator plays through up to 8 antes with:
- **Complete boss blind enforcement** — 22 active effects + 6 face-down bosses catalogued
- **Shop phase** — utility-score-driven purchasing (jokers, planets, tarots, vouchers), 2 rerolls
- **Full economy** — interest ($1/$5, cap $5/$10 with To The Moon), 9 joker income formulas
- **Deterministic seeding** — Knuth LCG with djb2 string hash; same seed = byte-identical run

#### 9. Discard EV Analyzer with Draw Estimation

Exhaustively enumerates discard subsets (up to 200 options, ≤5 discard size), scores kept cards through the engine, and estimates post-draw improvement using:
- Average chip value of remaining deck cards
- Hand-completion probability heuristics (how many more cards of specific rank/suit do I need?)
- `estimatedScore = max(keptScore + avgChips × discardCount, handCompletionBoost)`

Runs in a Web Worker — UI stays responsive during analysis.

#### 10. Visual Deck Builder — 13×4 Grid with Batch Operations

Three-mode deck builder: Quick (count input) → List (card-by-card) → Visual (13 rows × 4 columns grid, per-cell enhancement/edition/seal indicators, batch filter-apply, 3 presets: Standard 52 / Abandoned 40 / Checkered 26).

---

### 🏗️ Architecture

```
balatro-calc/
├── src/
│   ├── engine/                          # ← Zero-dependency pure-TypeScript core
│   │   ├── types.ts                     #    All types, enums, interfaces (Card, GameState, JokerDefinition, etc.)
│   │   ├── constants.ts                 #    13 hand base values + scaling, ante chip formula
│   │   ├── hand-evaluator.ts            #    Hand recognition (13 types, 4 modifier jokers)
│   │   ├── scorer.ts                    # ★ 5-phase scoring pipeline (the heart of the engine)
│   │   ├── search.ts                    # ★ Exhaustive optimal play search + smart joker ordering
│   │   ├── card-effects.ts             #    Enhancement/edition/seal application on scored/held
│   │   ├── combo-utils.ts              #    Lexicographic combination generator
│   │   ├── joker-order.ts              #    Smart joker classification & canonical ordering
│   │   ├── joker-data.ts               #    Joker state inputs, modifiers (four_fingers/smeared/etc.), round modifiers
│   │   ├── joker-effects.ts            #    Re-export barrel for joker registry
│   │   ├── jokers/                     #    150 joker definitions in 6 category files
│   │   │   ├── registry.ts             #       registerJoker / getJoker / getAllJokers helpers
│   │   │   ├── plus-mult.ts            #       33 +Mult jokers (100% with real hooks)
│   │   │   ├── xmult.ts                #       35 ×Mult jokers (100% with real hooks)
│   │   │   ├── chips.ts                #       22 +Chips jokers (100% with real hooks)
│   │   │   ├── retrigger.ts            #       6 Retrigger jokers (100% with real hooks)
│   │   │   ├── economy.ts              #       20 Economy jokers (registered, income in economy.ts)
│   │   │   └── effect.ts               #       34 Effect jokers (Blueprint/Brainstorm real, 32 catalogued)
│   │   ├── deck.ts                      #    Deck operations: add/remove/update/batch/preset/buildAggregate
│   │   ├── rng.ts                       #    Knuth LCG + djb2 string hash
│   │   ├── economy.ts                   #    Interest, round earnings, 9 joker income formulas
│   │   ├── shop.ts                      #    Shop generation, item utility scoring, voucher definitions
│   │   ├── boss-data.ts                #    28 boss blind definitions + BossEffect interface
│   │   ├── discard-analyzer.ts         # ★ Discard subset enumeration + post-draw EV estimation
│   │   ├── run-simulator.ts            # ★ Multi-ante state machine: blinds → search → shop → repeat
│   │   ├── search-worker.ts            #    Web Worker: discard analysis off the main thread
│   │   ├── search-client.ts            #    Singleton worker manager with Promise-based API
│   │   └── index.ts                     #    Public API barrel export
│   │
│   ├── components/                      # React 18 UI layer
│   │   ├── input/
│   │   │   ├── GameStateForm.tsx        #    Main input form: hand, jokers, hand levels, round, deck
│   │   │   ├── HandCardsInput.tsx       #    8-card hand editor with CardComponent + CardEditor
│   │   │   ├── CardEditor.tsx           #    Per-card rank/suit/enhancement/edition/seal dropdowns
│   │   │   ├── JokerInput.tsx           #    Joker search (debounced fuzzy), reorder, state overrides
│   │   │   └── HandLevelInput.tsx       #    13 hand-type level grid with auto chips×mult display
│   │   ├── deck/
│   │   │   ├── DeckBuilder.tsx          #    3-mode deck builder (Quick / List / Visual)
│   │   │   └── DeckBuilderVisual.tsx    #    13×4 grid with enh/edition/seal indicators + batch ops
│   │   ├── results/
│   │   │   ├── ResultsPanel.tsx         #    Optimal play + scoring breakdown + hand-type comparison table
│   │   │   └── DiscardPanel.tsx         #    Discard recommendations: discard/keep cards, targets, rationale
│   │   ├── shop/
│   │   │   └── ShopPanel.tsx            #    Synthetic shop: 6 slots, utility bars, buy simulation
│   │   ├── run-sim/
│   │   │   ├── RunSimPanel.tsx          #    Config form: maxAnte, shop, randomBoss, seed
│   │   │   ├── RunSummary.tsx           #    5-stat dashboard: antes cleared, score, rounds, dollars, time
│   │   │   └── RunRoundCard.tsx         #    Per-round card: score bar, hand, jokers, cards played/held
│   │   └── shared/
│   │       ├── CardComponent.tsx        #    3-size card renderer with enh/edition/seal color indicators
│   │       ├── JokerBadge.tsx           #    Joker display with rarity color-coding + edition badge
│   │       └── card-display.ts          #    Suit symbols, colors, all visual constants
│   │
│   ├── hooks/                           # React state management
│   │   ├── useGameState.ts              #    21-action useReducer: hand, jokers, deck, round, vouchers, bosses
│   │   ├── useSearch.ts                 #    Async search with Web Worker, progress tracking
│   │   ├── useDiscardAnalysis.ts        #    Discard analysis with Web Worker delegation
│   │   └── useRunSimulation.ts          #    Run simulator lifecycle (idle → running → done/error)
│   │
│   ├── i18n/                            # Lightweight React Context i18n
│   │   ├── context.tsx                  #    I18nProvider + useI18n() hook
│   │   ├── types.ts                     #    Translation key type definitions
│   │   └── locales/
│   │       ├── en.ts                    #    English (primary) — 150+ joker names, all UI strings
│   │       └── zh-CN.ts                 #    Simplified Chinese — full parity
│   │
│   ├── App.tsx                          # 5-tab layout: Input / Discard / Results / Shop / Run Sim
│   └── main.tsx                         # React 18 createRoot entry
│
├── tests/                               # Vitest test suite — 15 files, 316 tests
│   ├── edge-cases.test.ts               #    15-dimension stress matrix (2,248 lines)
│   ├── helpers.ts                       #    card() factory + defaultState() builder
│   └── ... (13 more test files)         #    Joker tests, scoring tests, search tests, economy tests, etc.
│
├── .github/workflows/
│   └── build-macos.yml                  # Auto-build macOS DMG on push to main (Intel + Apple Silicon)
│
├── package.json                         # React 19 + Vite 8 + Vitest 4.1 + TypeScript 6.0
├── tsconfig.app.json                    # App TypeScript config (erasableSyntaxOnly disabled)
├── tsconfig.node.json                   # Vite config TypeScript
└── vite.config.ts                       # Vite + React plugin configuration
```

#### Key Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer (components/ + hooks/)                        │
│  useGameState → buildGameState() → GameState            │
│  useSearch → SearchClient → Web Worker → findOptimalPlays │
└───────────────────────┬─────────────────────────────────┘
                        │ GameState
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Engine Core (engine/)                                  │
│                                                         │
│  search.ts                                              │
│  ├── generateCardSubsets(handCards)    # combinations    │
│  ├── generateJokerOrderings(jokers)    # smart pruning   │
│  └── for each {subset × ordering}:                       │
│       └── scorePlay(state, candidate, options)           │
│             │                                            │
│             ▼                                            │
│  scorer.ts — The 5-Phase Pipeline                       │
│  ┌──────────────────────────────────────────────┐       │
│  │ Phase 1: for each card × retrigger:           │       │
│  │   scoreCardTrigger() + onCardScored jokers    │       │
│  │ Phase 2: Steel cards held, Mime double-pass   │       │
│  │ Phase 3: Baron/Shoot the Moon held-in-hand    │       │
│  │ Phase 4: Joker evaluate L→R                   │       │
│  │   ├── resolve Blueprint/Brainstorm copies     │       │
│  │   ├── apply onJokerEvaluate                  │       │
│  │   ├── apply jokerStateOverrides              │       │
│  │   └── apply joker edition (foil/holo/poly)   │       │
│  │ Phase 5: finalScore = chips × mult            │       │
│  └──────────────────────────────────────────────┘       │
│                                                         │
│  run-simulator.ts                                       │
│  └── for ante in 1..maxAntes:                           │
│       for blind in [Small, Big, Boss]:                  │
│         setupBlindContext → deal hand → apply boss      │
│         → play/discard loop (findOptimalPlay)           │
│         → record round → [shop phase]                   │
│                                                         │
│  discard-analyzer.ts                                    │
│  └── enumerate discard subsets → score kept cards       │
│       → estimate post-draw EV → rank options            │
└─────────────────────────────────────────────────────────┘
```

---

### 🛠️ Getting Started

#### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10

#### Installation

```bash
git clone https://github.com/your-org/balatro-calc.git
cd balatro-calc
npm install
```

#### Development

```bash
npm run dev
```

Opens `http://localhost:5173` with HMR. The engine rebuilds instantly on save — no compilation step needed for the TypeScript engine (Vite handles it transparently).

#### Production Build

```bash
npm run build
```

Outputs optimized static assets to `dist/`. The engine tree-shakes cleanly — only jokers referenced at runtime are included.

#### Cross-Compile Windows Executable

```bash
npm run build:win
```

Produces an NSIS installer + portable `.exe` via Tauri (requires Rust toolchain with `x86_64-pc-windows-gnu` target).

#### macOS DMG

Push to `main` — the GitHub Actions workflow in `.github/workflows/build-macos.yml` auto-builds a universal DMG (Intel + Apple Silicon).

#### Running Tests

```bash
npx vitest run
```

All **316 tests** pass across 15 test files. The test suite covers:

| Area | Tests | Highlights |
|------|-------|------------|
| Joker scoring | ~90 | All 98 non-stub jokers, state override correctness, category classification |
| Hand evaluation | ~30 | All 13 hand types, modifier jokers (Smeared, Four Fingers, Shortcut), Stone cards |
| Scoring pipeline | ~40 | Boss enforcement, edition/edition stacking, retrigger combinatorics, Blueprint/Brainstorm chains |
| Edge cases | ~60 | 15-dimension stress matrix: DNA deck inflation, state rollback isolation, The Hook RNG determinism, The Flint + Plasma timing, Midas + Vampire ordering, and more |
| Search & ordering | ~25 | Smart ordering correctness, combination generation, permutation enumeration |
| Economy | ~20 | Interest caps, 9 joker income formulas, deck-state-dependent counting |
| Run simulator | ~25 | Boss handling, shop purchasing, ante progression, seed determinism |
| Discard analysis | ~10 | Discard enumeration, post-draw estimation, quick discard tips |
| Deck operations | ~16 | addCardToDeck, removeCardToDeck, batchUpdateDeckCards, preset application, aggregate consistency |

Watch mode for development:

```bash
npx vitest
```

#### Linting

```bash
npm run lint
```

---

### 📐 Design Decisions

**Why pure functions?** Every `scorePlay()` call is deterministic. There is no shared mutable state, no class instances, no event emitters. This makes the engine trivially parallelizable (Web Workers), perfectly testable (no mocking needed), and auditable (you can trace any score back to its inputs). The `GameState` → `ScoringBreakdown` mapping is a mathematical function.

**Why `jokerStateOverrides` instead of mutable joker state?** State-driven jokers like Obelisk or Green Joker depend on accumulated game history (hands played, discards used, etc.). Rather than embedding that history into `GameState` and requiring the engine to maintain it, we inject the accumulated value as a call parameter. This decouples "what is the joker's current state?" from "how does that state affect scoring?" — the caller owns the history, the engine owns the formula.

**Why smart ordering instead of brute force?** 7 jokers = 5040 permutations, × up to 32 card subsets. Smart classification prunes to 1 ordering for typical configs and `O(n)` for Blueprint-inclusive configs, making the search tractable at interactive speeds (typically < 100ms for typical configs, < 2s for complex ones). The brute-force fallback (`generateAllPermutations`) is available for verification but disabled by default.

**Why Web Workers for discard analysis?** Enumerating 200 discard subsets, each requiring a full `findOptimalPlays()` call, can take several seconds. Offloading to a Worker keeps the UI at 60fps and allows progress reporting.

---

### 📊 State of Implementation

| System | Coverage | Detail |
|--------|----------|--------|
| Hand types | 13/13 (100%) | Full priority-ordered detection with 4 modifier jokers |
| Joker registry | 150/150 (100%) | 98 with real scoring hooks, 52 catalogued |
| Boss blinds | 28/28 (100%) | 22 active effects, 6 face-down bosses catalogued |
| Card enhancements | 9/9 (100%) | Bonus, Mult, Wild, Glass, Steel, Stone, Gold, Lucky |
| Card editions | 5/5 (100%) | Foil, Holographic, Polychrome, Negative (+ None) |
| Card seals | 5/5 (100%) | Red, Blue, Gold, Purple (+ None) |
| Deck presets | 3/3 (100%) | Standard 52, Abandoned 40, Checkered 26 |
| Vouchers | 8/8 engine, 6/6 UI (100%) | Hand/discard/size modifiers |
| Economy jokers | 9/20 income formulas | Rocket, Golden, Delayed Grat., Cloud 9, Rough Gem, Gift, Reserved Parking, Business, Mail |
| i18n | 2 locales (100%) | English + 简体中文, all 150+ joker names localized |

**Known gaps** (see CONTRIBUTING.md or Issues for roadmap):
- 52 jokers are registry-only (economy + utility jokers without scoring hooks)
- Tarot deck modification (The Magician, Strength, Hanged Man, etc.) is not simulated in the run simulator
- Spectral cards are not implemented
- Plasma Deck formula is applied as post-processing rather than integrated into the score pipeline

---

### 📄 License

MIT — do whatever you want, attribution appreciated.

---

### 🙏 Acknowledgements

- [LocalThunk](https://x.com/LocalThunk) for creating *Balatro*, a masterclass in game design
- The Balatro wiki community for exhaustive mechanics documentation
- The `balatro-docs` project for reference data

---

## 中文

### 🚀 项目概述

**Balatro Calc** 解决了一个隐藏于扑克 Roguelike 中的硬核数值优化问题：在最多 7 个小丑（具有非线性叠加规则）、9 种卡牌强化、5 种版本、5 种封印、13 种牌型、28 个 Boss 盲注以及包含 52+ 张牌的状态化牌库面前 —— **哪一组牌是最优出牌？小丑应以何种顺序排列才能最大化得分？**

引擎通过穷举组合搜索回答这个问题：枚举所有卡牌子集 × 所有有意义的小丑排列，将每个候选方案送入忠实复现的五阶段计分流水线（卡牌计分 → 手牌强化 → 手牌小丑 → 小丑评估 → 最终得分）。每一次重触发、每一层 Blueprint 复制链、每一个 Boss debuff、每一张握在手中的 Steel 牌，都会被精确计算。

但项目不止于单手优化。**对局模拟器**可推进最多 8 个 ante（24 个盲注），模拟每个 Boss 效果、每个商店阶段、每次从动态牌库中的抽牌 —— 全部由确定性 Knuth LCG 驱动，种子可重现。**弃牌分析器**穷举所有弃牌组合，利用牌库组成启发式算法估算补牌后预期价值。

**核心设计原则：** 每个计分函数都是**纯函数**。`scorePlay()` 绝不修改其 `GameState` 参数。相同输入永远产生相同输出。这一特性使引擎可审计、可测试、可组合 —— 你可以创建搜索分支、通过 `jokerStateOverrides` 注入假设的小丑状态，并在零交叉污染的情况下比较结果。

---

### ⚡ 核心特性

#### 1. 五阶段计分流水线 — 精确结算顺序

```
Phase 1: 卡牌计分（逐牌、逐触发、带 onCardScored 小丑回调）
   ↓
Phase 2: 手牌内强化（Steel ×1.5，Mime 双道次感知）
   ↓
Phase 3: 手牌内小丑（Baron ×1.5/King，Shoot the Moon +13/Queen）
   ↓
Phase 4: 小丑评估（从左到右，Blueprint/Brainstorm 递归解析）
   ↓
Phase 5: 最终得分 = totalChips × totalMult
```

Boss 盲注约束在计分前即强制执行 —— 违规出牌直接归零。

#### 2. 多重重触发嵌套 — 完整组合数学

重触发在五个独立来源间叠加：
- **Red Seal** → +1 重触发
- **Sock and Buskin** → 面牌 +1
- **Hack** → 2-5 rank +1
- **Seltzer** → 全牌 +1
- **Hanging Chad** → 首牌 +2
- **Dusk** → 最终手牌 +1

每次触发都会激活 `onCardScored` 小丑效果（Photograph ×2, Triboulet ×2 等）—— 即重触发叠加与 ×Mult 小丑构成乘法关系。引擎正确计算所有触发槽位，并在 `ScoringBreakdown` 中记录每次触发的贡献。

#### 3. 确定性 RNG 与纯函数状态隔离

所有随机源 —— 抽牌、Boss 选择（随机模式）、Crimson Heart 目标选择、Amber Acorn 洗牌、The Hook debuff 目标 —— 均通过单一 `createRng(seed)` 流转，使用 Knuth 经典 LCG (`s = (s × 1664525 + 1013904223) >>> 0`)。字符串种子通过 djb2 哈希。

**`jokerStateOverrides`** 是向状态驱动小丑（共 37 个）注入累积状态的机制。它作为 `Record<number, number>` 运作 —— 小丑索引 → 覆盖值 —— 每次调用 `scorePlay()` 时传递。由于 `scorePlay()` 是纯函数，在同一 `GameState` 上使用不同覆盖值调用会产生**独立、无干扰的结果**。这一特性已在我们测试套件中形式化验证：使用不同 Obelisk ×Mult 值的背靠背调用在 10 次连续试验中产生精确预期得分，零交叉污染。

#### 4. 动态牌库膨胀 — 实时聚合传导

当 DNA 类效果向牌库添加卡牌时，`addCardToDeck()` 原子性地：
1. 将 `DeckCardSlot` 推入 `cards[]` 数组
2. 通过 `buildAggregateFromCards()` 重建全部聚合数据：`remainingByRank`、`remainingBySuit`、`totalByRank`、`totalBySuit`、`enhancementCounts`、`editionCounts`、`sealCounts`、`totalCards`

依赖牌库组成的经济小丑（Cloud 9 读取 `totalByRank[Nine]`，Rough Gem 读取 `totalBySuit[Diamonds]`）在 `calculateJokerIncome()` 中立竿见影 —— 聚合重建本质上是事务性且一致的。

#### 5. 顺序敏感流水线 — 非交换律小丑排序

`+10 mult then ×3` ≠ `×3 then +10 mult`。引擎遵循这一原则：`jokerOrder` 是每个 `PlayCandidate` 上的参数，计分器严格从左到右评估小丑。我们的智能排序优化器将小丑分类为 `chips → +mult → ×mult → retrigger` 并剪枝规范顺序，同时在存在 Blueprint/Brainstorm 时枚举有意义的复制目标位置。

Midas Mask → Vampire 流水线（Midas 施加 Gold 强化 → Vampire 消耗获取 ×0.1）在测试中得到验证：左右评估顺序意味着 Midas 必须出现在 Vampire **之前**才能激发协同效应。

#### 6. Debuff 机制 — 与牌型识别解耦

被 Debuff 的卡牌在计分中贡献**零**筹码和倍率。但它们**仍然参与** `recognizeHand()` 中的牌型识别 —— 被 Debuff 的 King 仍然计入一对 King。这还原了 Balatro 的实际行为：debuff 仅影响计分，不影响牌型判定。

Plasma Deck 公式 (`floor((chips + mult) / 2)^2`) 作为最终后处理步骤在完整计分流水线之后应用。The Flint 在小丑贡献之前将牌型等级减半，测试已对此验证。

#### 7. 智能小丑排序 — 组合剪枝

```
chips → plus_mult → xmult → retrigger → brainstorm → blueprint → other
```

对于不含 Blueprint/Brainstorm 的配置，优化器剪枝至恰好 1 个规范顺序。对于单个 Blueprint，枚举 `n` 个位置。这将组合空间从 `n!` 降至典型配置的 `O(n)`，同时保证找到最优顺序。

#### 8. 对局模拟器 — 28/28 Boss 盲注，完整商店经济

模拟器推进最多 8 个 ante，包含：
- **完整的 Boss 盲注强制执行** — 22 个活跃效果 + 6 个面朝下 Boss 已编目
- **商店阶段** — 效用评分驱动的自动购买（小丑、星球、塔罗、凭证），2 次重掷
- **完整经济** — 利息（$1/$5，To The Moon 上限 $10），9 个小丑收入公式
- **确定性种子** — Knuth LCG + djb2 字符串哈希；相同种子 = 逐字节一致的对局

#### 9. 弃牌期望值分析器（含补牌估算）

穷举所有弃牌组合（最多 200 个选项，≤5 弃牌尺寸），通过引擎计分留牌，使用以下方法估算补牌后改进：
- 牌库剩余牌的平均筹码价值
- 手牌完成概率启发式（我还差几张特定 rank/花色的牌？）
- `estimatedScore = max(keptScore + avgChips × discardCount, handCompletionBoost)`

在 Web Worker 中运行 —— UI 在分析期间保持响应。

#### 10. 可视化牌库构建器 — 13×4 网格 + 批量操作

三种模式牌库构建器：Quick（计数输入）→ List（逐张牌管理）→ Visual（13 行 × 4 列网格，每格有强化/版本/封印指示器，支持批量条件筛选应用，3 种预设：Standard 52 / Abandoned 40 / Checkered 26）。

---

### 🏗️ 架构

```
balatro-calc/
├── src/
│   ├── engine/                          # ← 零依赖纯 TypeScript 核心
│   │   ├── types.ts                     #    所有类型、枚举、接口
│   │   ├── constants.ts                 #    13 种牌型基准值 + 升级公式、ante 筹码公式
│   │   ├── hand-evaluator.ts            #    手牌识别（13 种牌型 + 4 种小丑修改器）
│   │   ├── scorer.ts                    # ★ 五阶段计分流水线（引擎核心）
│   │   ├── search.ts                    # ★ 穷举最优出牌搜索 + 智能小丑排序
│   │   ├── card-effects.ts             #    强化/版本/封印在出牌/手牌内的应用
│   │   ├── combo-utils.ts              #    字典序组合生成器
│   │   ├── joker-order.ts              #    智能小丑分类与规范排序
│   │   ├── joker-data.ts               #    有状态小丑输入定义、修改器、回合修改器
│   │   ├── jokers/                     #    150 个小丑定义，按 6 个类别文件组织
│   │   ├── deck.ts                      #    牌库操作：增/删/改/批量/预设/聚合重建
│   │   ├── rng.ts                       #    Knuth LCG + djb2 字符串哈希
│   │   ├── economy.ts                   #    利息、回合收入、9 个小丑收入公式
│   │   ├── shop.ts                      #    商店生成、物品效用评分、凭证定义
│   │   ├── boss-data.ts                #    28 个 Boss 盲注定义 + BossEffect 接口
│   │   ├── discard-analyzer.ts         # ★ 弃牌枚举 + 补牌后 EV 估算
│   │   ├── run-simulator.ts            # ★ 多 ante 状态机：盲注 → 搜索 → 商店 → 循环
│   │   ├── search-worker.ts            #    Web Worker：弃牌分析离线运行
│   │   ├── search-client.ts            #    单例 Worker 管理器 + Promise API
│   │   └── index.ts                     #    公共 API 导出
│   │
│   ├── components/                      # React 18 UI 层
│   │   ├── input/                       #    输入组件（GameStateForm, CardEditor, JokerInput 等）
│   │   ├── deck/                        #    牌库组件（DeckBuilder, DeckBuilderVisual）
│   │   ├── results/                     #    结果组件（ResultsPanel, DiscardPanel）
│   │   ├── shop/                        #    商店组件（ShopPanel）
│   │   ├── run-sim/                     #    模拟器组件（RunSimPanel, RunSummary, RunRoundCard）
│   │   └── shared/                      #    共享组件（CardComponent, JokerBadge, card-display）
│   │
│   ├── hooks/                           # React 状态管理
│   │   ├── useGameState.ts              #    21-action useReducer 中央状态
│   │   ├── useSearch.ts                 #    异步搜索 + Web Worker + 进度追踪
│   │   ├── useDiscardAnalysis.ts        #    弃牌分析委托至 Worker
│   │   └── useRunSimulation.ts          #    模拟器生命周期管理
│   │
│   └── i18n/                            # 轻量 React Context 国际化
│       └── locales/{en,zh-CN}.ts        #    英文/简体中文，150+ 小丑名全本地化
│
└── tests/                               # Vitest 测试套件 — 15 文件 / 316 用例
```

---

### 🛠️ 使用指南

```bash
# 安装
npm install

# 启动开发服务器 (localhost:5173, HMR)
npm run dev

# 运行全部 316 个单元测试
npx vitest run

# 监听模式
npx vitest

# 生产构建 → dist/
npm run build

# 交叉编译 Windows .exe (需 Rust 工具链)
npm run build:win

# 代码检查
npm run lint
```

---

### 📊 实现状态

| 系统 | 覆盖率 | 详情 |
|------|--------|------|
| 牌型 | 13/13 (100%) | 优先级顺序检测 + 4 修改器小丑 |
| 小丑注册 | 150/150 (100%) | 98 个有实际计分钩子，52 个已编目 |
| Boss 盲注 | 28/28 (100%) | 22 个活跃效果，6 个面朝下已编目 |
| 卡牌强化 | 9/9 (100%) | Bonus/Mult/Wild/Glass/Steel/Stone/Gold/Lucky |
| 卡牌版本 | 5/5 (100%) | Foil/Holo/Poly/Negative + None |
| 卡牌封印 | 5/5 (100%) | Red/Blue/Gold/Purple + None |
| 牌组预设 | 3/3 (100%) | Standard 52 / Abandoned 40 / Checkered 26 |
| 凭证 | 8/8 引擎, 6/6 UI (100%) | 手牌/弃牌/手牌大小修改器 |
| 经济小丑 | 9/20 收入公式 | Rocket, Golden, Cloud 9, Rough Gem 等 |
| 国际化 | 2 种语言 (100%) | English + 简体中文 |

---

### 📄 许可证

MIT — 自由使用，署名感谢。
