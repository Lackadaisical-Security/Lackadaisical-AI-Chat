import { useState, useCallback, useRef } from 'react';
import { StreamChunk } from '../types';
import { api } from '../services/api';

interface UseStreamOptions {
  onChunk?: (chunk: StreamChunk) => void;
  onComplete?: (content: string, metadata: unknown) => void;
  onError?: (error: string) => void;
}

export function useStreamingResponse(opts: UseStreamOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startStreaming = useCallback(
    async (
      message: string,
      sessionId: string,
      options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        useUncensored?: boolean;
        attachmentIds?: string[];
      }
    ) => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setIsStreaming(true);
      setStreamContent('');
      setError(null);

      let accumulated = '';
      let metadata: unknown = {};

      try {
        const result = await api.streamMessage(
          message,
          sessionId,
          (chunk) => {
            opts.onChunk?.(chunk);
            if (chunk.type === 'content' && chunk.content) {
              accumulated += chunk.content;
              setStreamContent(accumulated);
            } else if (chunk.type === 'metadata') {
              metadata = chunk;
            }
          },
          options,
          abortRef.current.signal
        );

        setIsStreaming(false);
        opts.onComplete?.(accumulated, metadata);
        return result;
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') {
          setIsStreaming(false);
          return;
        }
        const msg = err instanceof Error ? err.message : 'Streaming failed';
        setError(msg);
        setIsStreaming(false);
        opts.onError?.(msg);
        throw err;
      }
    },
    [opts]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  return { isStreaming, streamContent, error, startStreaming, stopStreaming };
}
