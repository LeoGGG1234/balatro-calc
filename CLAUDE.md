# Balatro Calc

Optimal play calculator for Balatro card game. Pure-TypeScript engine + React 18 UI.

## Commands
- `npm run dev` — start Vite dev server
- `npm run build` — production build to `dist/`
- `npm run build:win` — cross-compile Windows .exe (NSIS installer + portable binary)
- `npx vitest run` — run 502 unit tests (engine core)
- `.github/workflows/build-macos.yml` — auto-build macOS DMG on push to main (Intel + Apple Silicon)
- `npx vitest` — watch mode tests

## Architecture

```
src/engine/        → Zero-dependency TypeScript: types, hand evaluation, joker effects (150/150 jokers), scoring, search, shop, discard analyzer, run simulator (28/28 boss blinds, economy jokers, improved shop, enhanced card drawing), fog-card EV engine, save file decoder (deflate decompression), Lua table parser (recursive descent), card notation parser, save file parser
src/components/    → React UI: input forms, results panel, discard panel, shop panel, run sim panel, shared components
src/hooks/         → useGameState (useReducer-based form state + voucher/boss auto-computation), useSearch, useDiscardAnalysis, useRunSimulation
src/i18n/          → Lightweight React Context: context.tsx, types.ts, locales/en.ts, locales/zh-CN.ts
tests/             → Vitest unit tests for engine (18 files, 502 tests)
```

## Key conventions
- Engine files use `import type` for types, value imports for enums (erasableSyntaxOnly disabled)
- `JokerCategory`/`JokerRarity`/`HandType` etc. are enums (runtime values)
- Jokers registered via `registerJoker()` in `joker-effects.ts`, state-based params in `joker-data.ts`
- i18n: `useI18n()` returns `{ t, lang, setLang }`, no third-party lib
- `tsconfig.app.json` — app source; `tsconfig.node.json` — vite config only
- `RoundState` fields: `maxHands`, `maxDiscards`, `handSize` (effective values after voucher/boss modifiers)
