import { useState, useCallback, useRef } from 'react';

export interface StreamChunk {
  type: 'start' | 'content' | 'end' | 'error' | 'metadata' | 'thinking_start' | 'thinking_content' | 'thinking_end';
  content?: string;
  error?: string;
  conversationId?: number;
  tokens?: number;
  responseTime?: number;
  model?: string;
  sentiment?: any;
  mood?: any;
  thinking?: string;
  thinkingDurationMs?: number;
}

export interface UseStreamingResponseOptions {
  onChunkReceived?: (chunk: StreamChunk) => void;
  onComplete?: (fullResponse: string, metadata: any) => void;
  onError?: (error: string) => void;
  onThinkingStart?: () => void;
  onThinkingContent?: (content: string) => void;
  onThinkingEnd?: (fullThinking: string, durationMs?: number) => void;
}

export function useStreamingResponse(options: UseStreamingResponseOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [thinkingContent, setThinkingContent] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStreaming = useCallback(async (
    message: string,
    sessionId: string,
    apiUrl: string = '/api/v1/chat'
  ) => {
    // Reset state
    setIsStreaming(true);
    setStreamContent('');
    setError(null);

    // Cancel any existing stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    try {
      // Create abort controller for the initial request
      abortControllerRef.current = new AbortController();

      // Send the initial request to start streaming
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          message,
          session_id: sessionId,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
        // No timeout here - let the request run for up to 5 minutes
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if the response is actually a stream
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('text/event-stream')) {
        throw new Error('Server did not return an event stream');
      }

      // Create EventSource-like reader from the response stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to read response stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let fullThinking = '';
      let metadata: any = {};

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                const chunk: StreamChunk = data;

                // Handle different chunk types
                switch (chunk.type) {
                  case 'start':
                    options.onChunkReceived?.(chunk);
                    break;

                  case 'thinking_start':
                    setIsThinking(true);
                    setThinkingContent('');
                    fullThinking = '';
                    options.onThinkingStart?.();
                    options.onChunkReceived?.(chunk);
                    break;

                  case 'thinking_content':
                    if (chunk.content) {
                      fullThinking += chunk.content;
                      setThinkingContent(fullThinking);
                      options.onThinkingContent?.(chunk.content);
                    }
                    options.onChunkReceived?.(chunk);
                    break;

                  case 'thinking_end':
                    setIsThinking(false);
                    options.onThinkingEnd?.(fullThinking, chunk.thinkingDurationMs);
                    options.onChunkReceived?.(chunk);
                    break;

                  case 'content':
                    if (chunk.content) {
                      fullResponse += chunk.content;
                      setStreamContent(fullResponse);
                      options.onChunkReceived?.(chunk);
                    }
                    break;

                  case 'metadata':
                    metadata = {
                      conversationId: chunk.conversationId,
                      tokens: chunk.tokens,
                      responseTime: chunk.responseTime,
                      model: chunk.model,
                      sentiment: chunk.sentiment,
                      mood: chunk.mood,
                      thinking: chunk.thinking || fullThinking || undefined,
                      thinkingDurationMs: chunk.thinkingDurationMs,
                    };
                    options.onChunkReceived?.(chunk);
                    break;

                  case 'end':
                    setIsStreaming(false);
                    setIsThinking(false);
                    options.onComplete?.(fullResponse, metadata);
                    options.onChunkReceived?.(chunk);
                    return { content: fullResponse, metadata };

                  case 'error':
                    const errorMsg = chunk.error || 'Stream error occurred';
                    setError(errorMsg);
                    setIsStreaming(false);
                    setIsThinking(false);
                    options.onError?.(errorMsg);
                    throw new Error(errorMsg);
                }
              } catch (parseError) {
                console.warn('Failed to parse stream chunk:', line, parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // If we get here without an 'end' chunk, something went wrong
      throw new Error('Stream ended unexpectedly');

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Stream was cancelled');
        return { content: streamContent, metadata: {} };
      }
      
      const errorMsg = err.message || 'Failed to start streaming';
      setError(errorMsg);
      setIsStreaming(false);
      options.onError?.(errorMsg);
      throw err;
    }
  }, [options]);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    stopStreaming();
  }, [stopStreaming]);

  return {
    isStreaming,
    streamContent,
    thinkingContent,
    isThinking,
    error,
    startStreaming,
    stopStreaming,
    cleanup,
  };
}

export default useStreamingResponse;
