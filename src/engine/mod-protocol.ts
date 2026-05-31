/**
 * Shared protocol types for the Balatro Calc mod bridge.
 * These types match the JSON messages exchanged between the Lua mod (HTTP server)
 * and the React web tool (HTTP client).
 */

import type { InjectedSaveData } from './save-parser';
import type { ScoreLogEntry } from '../hooks/useGameState';

// ─── Shop data (collected from G.shop) ──────────────────────────────

export interface ModShopJoker {
  id: string;
  price: number;
  edition: string;
}

export interface ModShopVoucher {
  id: string;
  price: number;
}

export interface ModShopBooster {
  type: string;
  price: number;
  size: number;
}

export interface ModShopConsumable {
  id: string;
  price: number;
}

export interface ModShopData {
  jokers?: ModShopJoker[];
  voucher?: ModShopVoucher;
  boosters?: ModShopBooster[];
  consumable?: ModShopConsumable;
  rerollCost?: number;
}

// ─── Held consumable (player's tarot/planet/spectral slots) ───────

export interface ModHeldConsumable {
  id: string;
  name: string;
  type: 'tarot' | 'planet' | 'spectral' | 'unknown';
  /** Whether this consumable is currently selected/highlighted in-game */
  highlighted: boolean;
  /** Sell cost (usually 1 for consumables) */
  sellCost: number;
}

// ─── Game → Tool (GET /api/state response) ─────────────────────────

export interface ModStateResponse extends InjectedSaveData {
  /** Cumulative score for the current round */
  roundScore: number;
  /** Per-hand score log for the current round */
  scoreLog: ScoreLogEntry[];
  /** Real shop data from the game (undefined when not in shop) */
  shop?: ModShopData;
  /** Player's held consumable cards (tarot/planet/spectral, up to 2 slots) */
  heldConsumables?: ModHeldConsumable[];
}

// ─── Tool → Game (POST /api/command body) ──────────────────────────

export interface ModHighlightPlayCommand {
  type: 'highlight_play';
  payload: { indices: number[] };
}

export interface ModHighlightDiscardCommand {
  type: 'highlight_discard';
  payload: { indices: number[] };
}

export interface ModClearHighlightsCommand {
  type: 'clear_highlights';
}

export type ModCommand =
  | ModHighlightPlayCommand
  | ModHighlightDiscardCommand
  | ModClearHighlightsCommand;

// ─── Connection status ─────────────────────────────────────────────

export type ModConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ─── Constants ─────────────────────────────────────────────────────

export const MOD_HOST = 'http://localhost:18888';
export const MOD_HEALTH_ENDPOINT = `${MOD_HOST}/api/health`;
export const MOD_STATE_ENDPOINT = `${MOD_HOST}/api/state`;
export const MOD_COMMAND_ENDPOINT = `${MOD_HOST}/api/command`;
export const POLL_INTERVAL_MS = 300;
export const HEALTH_CHECK_INTERVAL_MS = 2000;
export const REQUEST_TIMEOUT_MS = 1000;
