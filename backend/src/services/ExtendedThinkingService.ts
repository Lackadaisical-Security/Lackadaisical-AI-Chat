/**
 * ExtendedThinkingService - Handles extended/chain-of-thought thinking for AI models
 * Supports native thinking for models like Ollama gpt-oss and other reasoning models.
 * Parses thinking blocks from responses and stores them separately.
 */

import { aiLogger } from '../utils/logger';

export interface ThinkingBlock {
  content: string;
  durationMs?: number;
  tokenCount?: number;
}

export interface ExtendedThinkingResponse {
  thinking: ThinkingBlock | null;
  response: string;
  totalDurationMs: number;
  hasThinking: boolean;
}

// Regex patterns for detecting thinking blocks in model output
const THINKING_PATTERNS = [
  // <think>...</think> tags (Ollama/deepseek style)
  { start: /<think>/i, end: /<\/think>/i, regex: /<think>([\s\S]*?)<\/think>/gi },
  // <thinking>...</thinking> tags
  { start: /<thinking>/i, end: /<\/thinking>/i, regex: /<thinking>([\s\S]*?)<\/thinking>/gi },
  // [THINKING]...[/THINKING] markers
  { start: /\[THINKING\]/i, end: /\[\/THINKING\]/i, regex: /\[THINKING\]([\s\S]*?)\[\/THINKING\]/gi },
  // **Thinking:** blocks followed by **Response:** blocks
  { start: /\*\*Thinking:\*\*/i, end: /\*\*Response:\*\*/i, regex: /\*\*Thinking:\*\*\s*([\s\S]*?)\*\*Response:\*\*/gi },
];

export class ExtendedThinkingService {
  /**
   * Parse thinking content from a model's response
   * Separates thinking/reasoning from the actual response
   */
  parseThinkingFromResponse(rawResponse: string): ExtendedThinkingResponse {
    const startTime = Date.now();

    for (const pattern of THINKING_PATTERNS) {
      const match = pattern.regex.exec(rawResponse);
      if (match) {
        const thinkingContent = match[1]?.trim() || '';
        // Remove the thinking block from the response
        const response = rawResponse
          .replace(pattern.regex, '')
          .trim();

        return {
          thinking: thinkingContent ? {
            content: thinkingContent,
            durationMs: Date.now() - startTime,
            tokenCount: Math.ceil(thinkingContent.length / 4),
          } : null,
          response: response || rawResponse,
          totalDurationMs: Date.now() - startTime,
          hasThinking: !!thinkingContent,
        };
      }
      // Reset regex lastIndex for reuse
      pattern.regex.lastIndex = 0;
    }

    // No thinking block detected
    return {
      thinking: null,
      response: rawResponse,
      totalDurationMs: Date.now() - startTime,
      hasThinking: false,
    };
  }

  /**
   * Build system prompt additions for enabling extended thinking
   */
  buildThinkingPrompt(modelId: string): string {
    // Different models need different thinking prompts
    const thinkingModels: Record<string, string> = {
      'gpt-oss': `Before responding, think through your reasoning step by step inside <think></think> tags. Your thinking will not be shown to the user. After thinking, provide your response outside the tags.`,
      'deepseek': `Use <think></think> tags for internal reasoning before answering.`,
      'qwq': `Think step by step inside <think></think> tags before providing your answer.`,
    };

    // Check if this model supports extended thinking
    for (const [prefix, prompt] of Object.entries(thinkingModels)) {
      if (modelId.toLowerCase().includes(prefix)) {
        return prompt;
      }
    }

    // Default thinking prompt for unknown models
    return '';
  }

  /**
   * Check if a model supports native extended thinking
   */
  supportsExtendedThinking(modelId: string): boolean {
    const thinkingModels = [
      'gpt-oss', 'deepseek-r1', 'qwq', 'o1', 'o3',
      'claude-3.5-sonnet', 'gemini-2', 'thinking',
    ];

    return thinkingModels.some(m => modelId.toLowerCase().includes(m));
  }

  /**
   * Parse streaming thinking content
   * Handles the case where thinking comes in chunks during SSE streaming
   */
  createStreamingThinkingParser(): {
    processChunk: (chunk: string) => { thinking?: string; content?: string; isThinking: boolean };
    finalize: () => { thinking: string; content: string };
  } {
    let buffer = '';
    let thinkingContent = '';
    let responseContent = '';
    let isInThinking = false;
    let thinkingComplete = false;

    return {
      processChunk: (chunk: string) => {
        buffer += chunk;

        // Check for start of thinking
        if (!isInThinking && !thinkingComplete) {
          for (const pattern of THINKING_PATTERNS) {
            if (pattern.start.test(buffer)) {
              isInThinking = true;
              const startMatch = buffer.match(pattern.start);
              if (startMatch) {
                const startIndex = buffer.indexOf(startMatch[0]) + startMatch[0].length;
                // Anything before the thinking tag goes to response
                const beforeThinking = buffer.substring(0, buffer.indexOf(startMatch[0])).trim();
                if (beforeThinking) responseContent += beforeThinking;
                buffer = buffer.substring(startIndex);
              }
              break;
            }
          }
        }

        // Check for end of thinking
        if (isInThinking) {
          for (const pattern of THINKING_PATTERNS) {
            if (pattern.end.test(buffer)) {
              isInThinking = false;
              thinkingComplete = true;
              const endMatch = buffer.match(pattern.end);
              if (endMatch) {
                const endIndex = buffer.indexOf(endMatch[0]);
                thinkingContent += buffer.substring(0, endIndex);
                buffer = buffer.substring(endIndex + endMatch[0].length);
                // Remaining buffer is response content
                if (buffer.trim()) responseContent += buffer.trim();
                buffer = '';
              }
              return { thinking: thinkingContent, content: responseContent, isThinking: false };
            }
          }
          // Still in thinking - accumulate
          thinkingContent += chunk;
          return { thinking: chunk, isThinking: true };
        }

        // Not in thinking - this is response content
        responseContent += chunk;
        return { content: chunk, isThinking: false };
      },

      finalize: () => {
        // If we're still in thinking when stream ends, close it
        if (isInThinking) {
          thinkingContent += buffer;
        } else {
          responseContent += buffer;
        }
        return { thinking: thinkingContent.trim(), content: responseContent.trim() };
      },
    };
  }
}

export const extendedThinkingService = new ExtendedThinkingService();
export default extendedThinkingService;
