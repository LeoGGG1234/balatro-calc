/**
 * Shared protocol types for the Balatro Calc mod bridge.
 * These types match the JSON messages exchanged between the Lua mod (HTTP server)
 * and the React web tool (HTTP client).
 */

import type { InjectedSaveData } from './save-parser';
import type { ScoreLogEntry } from '../hooks/useGameState';

// ─── Game → Tool (GET /api/state response) ─────────────────────────

export interface ModStateResponse extends InjectedSaveData {
  /** Cumulative score for the current round */
  roundScore: number;
  /** Per-hand score log for the current round */
  scoreLog: ScoreLogEntry[];
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
