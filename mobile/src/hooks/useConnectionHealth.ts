import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import { api } from '../services/api';

/**
 * Polls /health every `intervalMs` ms and keeps the store up to date.
 */
export function useConnectionHealth(intervalMs = 30000): void {
  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    const start = Date.now();
    try {
      const res = await api.healthCheck();
      const latency = Date.now() - start;
      const ollamaUp = res?.health?.services?.ai_providers?.ollama === 'up';
      setConnectionStatus(true, ollamaUp, latency, null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setConnectionStatus(false, false, null, msg);
    }
  }, [setConnectionStatus]);

  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check, intervalMs]);
}
