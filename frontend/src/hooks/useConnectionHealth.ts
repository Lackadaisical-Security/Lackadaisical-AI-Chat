import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

interface ConnectionStatus {
  isConnected: boolean;
  lastChecked: Date | null;
  latencyMs: number | null;
  ollamaAvailable: boolean;
  error: string | null;
}

/**
 * Enterprise-grade connection health monitor.
 * Periodically checks backend and Ollama connectivity,
 * with automatic reconnection detection.
 */
export function useConnectionHealth(intervalMs: number = 30000): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastChecked: null,
    latencyMs: null,
    ollamaAvailable: false,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    const start = Date.now();
    try {
      const response = await api.healthCheck();
      const latency = Date.now() - start;

      const ollamaUp = response?.health?.services?.ai_providers?.ollama === 'up';

      setStatus({
        isConnected: true,
        lastChecked: new Date(),
        latencyMs: latency,
        ollamaAvailable: ollamaUp,
        error: null,
      });
    } catch (err: any) {
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        lastChecked: new Date(),
        latencyMs: null,
        error: err.message || 'Connection failed',
      }));
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkHealth();

    // Set up periodic checks
    intervalRef.current = setInterval(checkHealth, intervalMs);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkHealth, intervalMs]);

  return status;
}

export default useConnectionHealth;
