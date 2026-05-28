import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ModCommand, ModConnectionStatus, ModStateResponse,
} from '../engine/mod-protocol';
import {
  MOD_HEALTH_ENDPOINT, MOD_STATE_ENDPOINT, MOD_COMMAND_ENDPOINT,
  POLL_INTERVAL_MS, HEALTH_CHECK_INTERVAL_MS, REQUEST_TIMEOUT_MS,
} from '../engine/mod-protocol';

export interface UseModConnectionReturn {
  status: ModConnectionStatus;
  lastState: ModStateResponse | null;
  lastPollTime: number | null;
  error: string | null;
  sendCommand: (cmd: ModCommand) => Promise<void>;
  highlightPlayCards: (indices: number[]) => Promise<void>;
  highlightDiscardCards: (indices: number[]) => Promise<void>;
  clearHighlights: () => Promise<void>;
}

export function useModConnection(): UseModConnectionReturn {
  const [status, setStatus] = useState<ModConnectionStatus>('disconnected');
  const [lastState, setLastState] = useState<ModStateResponse | null>(null);
  const [lastPollTime, setLastPollTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusRef = useRef<ModConnectionStatus>('disconnected');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const healthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStateRef = useRef<string | null>(null);  // JSON string for delta detection

  // ── State polling ───────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(MOD_STATE_ENDPOINT, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!res.ok) return;

        const state: ModStateResponse = await res.json();
        const stateJson = JSON.stringify(state);

        // Delta detection: only update if state actually changed
        if (stateJson !== prevStateRef.current) {
          prevStateRef.current = stateJson;
          setLastState(state);
          setLastPollTime(Date.now());
        }
      } catch {
        // Individual poll failure is OK; we rely on health check for disconnect
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // ── Health check (connection detection) ──────────────────────────

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(MOD_HEALTH_ENDPOINT, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (res.ok) {
          if (statusRef.current !== 'connected') {
            statusRef.current = 'connected';
            setStatus('connected');
            setError(null);
            startPolling();
          }
        } else if (statusRef.current === 'connected') {
          // Server responded but not ok — treat as disconnected
          statusRef.current = 'disconnected';
          setStatus('disconnected');
          stopPolling();
          prevStateRef.current = null;
        }
      } catch {
        if (statusRef.current === 'connected') {
          statusRef.current = 'disconnected';
          setStatus('disconnected');
          stopPolling();
          prevStateRef.current = null;
        }
      }
    };

    // Initial check
    checkHealth();

    // Periodic health check
    healthTimerRef.current = setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      if (healthTimerRef.current) clearInterval(healthTimerRef.current);
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  // ── Command sending ──────────────────────────────────────────────

  const sendCommand = useCallback(async (cmd: ModCommand): Promise<void> => {
    const res = await fetch(MOD_COMMAND_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { message?: string }).message ?? `Command failed: ${res.status}`);
    }
  }, []);

  const highlightPlayCards = useCallback(
    (indices: number[]) => sendCommand({ type: 'highlight_play', payload: { indices } }),
    [sendCommand],
  );

  const highlightDiscardCards = useCallback(
    (indices: number[]) => sendCommand({ type: 'highlight_discard', payload: { indices } }),
    [sendCommand],
  );

  const clearHighlights = useCallback(
    () => sendCommand({ type: 'clear_highlights' }),
    [sendCommand],
  );

  return {
    status,
    lastState,
    lastPollTime,
    error,
    sendCommand,
    highlightPlayCards,
    highlightDiscardCards,
    clearHighlights,
  };
}
