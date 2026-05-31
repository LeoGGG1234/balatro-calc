# Balatro Calc

Optimal play calculator for Balatro card game. Pure-TypeScript engine + React 18 UI.

## Commands
- `npm run dev` — start Vite dev server
- `npm run build` — production build to `dist/`
- `npm run build:win` — cross-compile Windows .exe (NSIS installer + portable binary)
- `npx vitest run` — run 531 unit tests (engine core)
- `.github/workflows/build-macos.yml` — auto-build macOS DMG on push to main (Intel + Apple Silicon)
- `npx vitest` — watch mode tests

## Architecture

```
src/engine/        → Zero-dependency TypeScript: types, hand evaluation, joker effects (150/150 jokers), scoring, search, shop, discard analyzer, run simulator (28/28 boss blinds, economy jokers, improved shop, enhanced card drawing), EV strategy engine (multi-step lookahead, consumable synergy, cross-round planning), save file decoder (deflate decompression), Lua table parser (recursive descent), card notation parser, save file parser, deck & stake presets (15 decks × 8 stakes with auto field mapping), mod-protocol (shared types for mod↔tool bridge)
src/components/    → React UI: input forms (GameStateForm, HandCardsInput, JokerInput, HandLevelInput, CardEditor, CardNotationInput, RoundHUD), results panel, discard panel, shop panel, run sim panel, deck builder, mod connection indicator, shared components
src/hooks/         → useGameState (25-action useReducer: form state + voucher/boss auto-computation + round session tracker + deck/stake selection), useSearch, useDiscardAnalysis, useRunSimulation, useModConnection (HTTP polling + delta detection + command sending)
src/i18n/          → Lightweight React Context: context.tsx, types.ts, locales/en.ts, locales/zh-CN.ts
mod/balatro-calc/  → Steammodded Lua mod: HTTP server (luasocket, non-blocking TCP), game state collector (G.hand/G.jokers/G.deck/G.GAME), card highlighter (love.graphics overlays), command dispatcher, pure-Lua JSON codec
tests/             → Vitest unit tests for engine (20 files, 531 tests)
```

## Key conventions
- Engine files use `import type` for types, value imports for enums (erasableSyntaxOnly disabled)
- `JokerCategory`/`JokerRarity`/`HandType` etc. are enums (runtime values)
- Jokers registered via `registerJoker()` in `joker-effects.ts`, state-based params in `joker-data.ts`
- i18n: `useI18n()` returns `{ t, lang, setLang }`, no third-party lib
- `tsconfig.app.json` — app source; `tsconfig.node.json` — vite config only
- `RoundState` fields: `maxHands`, `maxDiscards`, `handSize` (effective values after voucher/boss modifiers)
- Round session tracker: `PLAY_HAND` replaces played cards with fog placeholders, decrements counter, accumulates score; `NEW_ROUND` resets per-round counters only
- Deck & stake presets: `SELECT_DECK` / `SELECT_STAKE` auto-fill maxHands/maxDiscards/handSize/dollars/vouchers/jokerSlots via `computeDeckStakeBase()`
- Mod bridge: Lua HTTP server on `localhost:18888` (port fallback 18889–18893), web tool polls `/api/state` every 300ms, delta detection via JSON string compare, commands POST to `/api/command`. Card indices are 0-based in protocol, 1-based in Lua.
- Mod state injection: `INJECT_SAVE_STATE` reducer maps `ModStateResponse` (extends `InjectedSaveData` with `roundScore` + `scoreLog`)
- Auto-highlight: `useEffect` watches `search.status === 'done'`, derives card indices from `optimalPlay.playedCards[].id` matched against `handCards[].id`, then calls `modConn.highlightPlayCards(indices)`. Highlights clear when new mod state arrives.
