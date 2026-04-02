/**
 * ToolExecutionService - Extensible tool use framework for AI chat
 * Provides a registry of tools the AI can invoke during conversation,
 * including web search, code execution, file operations, and more.
 */

import { aiLogger } from '../utils/logger';
import { WebSearchService, WebSearchResponse } from './WebSearchService';
import { WebFetcher, FetchedContent } from './WebFetcher';

// Tool definition interface
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
    }>;
    required: string[];
  };
  handler: (params: Record<string, unknown>) => Promise<ToolResult>;
}

// Tool execution result
export interface ToolResult {
  success: boolean;
  output: string;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
  metadata?: Record<string, unknown>;
}

// Tool call from AI
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export class ToolExecutionService {
  private tools: Map<string, ToolDefinition> = new Map();
  private webSearchService: WebSearchService;
  private webFetcher: WebFetcher;

  constructor() {
    this.webSearchService = new WebSearchService();
    this.webFetcher = new WebFetcher();
    this.registerDefaultTools();
  }

  /**
   * Register all default tools
   */
  private registerDefaultTools(): void {
    // Web Search Tool
    this.registerTool({
      name: 'web_search',
      description: 'Search the web for current information, news, documentation, or any topic. Returns search results with snippets and URLs.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          max_results: { type: 'number', description: 'Maximum number of results (1-20)', default: 5 },
          time_range: {
            type: 'string',
            description: 'Time range filter for results',
            enum: ['day', 'week', 'month', 'year', 'all'],
            default: 'all',
          },
        },
        required: ['query'],
      },
      handler: async (params) => {
        const startTime = Date.now();
        try {
          const results = await this.webSearchService.search(
            params.query as string,
            {
              maxResults: Math.min((params.max_results as number) || 5, 20),
              timeRange: (params.time_range as 'day' | 'week' | 'month' | 'year' | 'all') || 'all',
            }
          );

          const formattedResults = results.results
            .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
            .join('\n\n');

          return {
            success: true,
            output: formattedResults || 'No results found.',
            data: results,
            executionTimeMs: Date.now() - startTime,
            metadata: {
              provider: results.provider,
              totalResults: results.totalResults,
            },
          };
        } catch (error) {
          return {
            success: false,
            output: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error: error instanceof Error ? error.message : 'Unknown error',
            executionTimeMs: Date.now() - startTime,
          };
        }
      },
    });

    // Fetch Web Page Tool
    this.registerTool({
      name: 'fetch_webpage',
      description: 'Fetch and extract the main content from a web page URL. Returns cleaned text content.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch' },
          max_length: { type: 'number', description: 'Maximum content length in characters', default: 5000 },
        },
        required: ['url'],
      },
      handler: async (params) => {
        const startTime = Date.now();
        try {
          const content = await this.webFetcher.fetchUrl(params.url as string, {
            extractMainContent: true,
            maxContentLength: (params.max_length as number) || 5000,
            timeout: 15000,
          });

          if (!content) {
            return {
              success: false,
              output: 'Failed to fetch page content',
              executionTimeMs: Date.now() - startTime,
            };
          }

          return {
            success: true,
            output: `**${content.title}**\n\n${content.content}`,
            data: content,
            executionTimeMs: Date.now() - startTime,
            metadata: {
              url: content.url,
              title: content.title,
              wordCount: content.metadata.wordCount,
              readingTime: content.metadata.readingTimeMinutes,
            },
          };
        } catch (error) {
          return {
            success: false,
            output: `Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error: error instanceof Error ? error.message : 'Unknown error',
            executionTimeMs: Date.now() - startTime,
          };
        }
      },
    });

    // Calculate Tool
    this.registerTool({
      name: 'calculate',
      description: 'Perform mathematical calculations. Supports basic arithmetic, percentages, and common math functions.',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(144)", "15% of 200")' },
        },
        required: ['expression'],
      },
      handler: async (params) => {
        const startTime = Date.now();
        try {
          const expr = (params.expression as string)
            .replace(/\^/g, '**')
            .replace(/(\d+)%\s*of\s*(\d+)/gi, '($1/100)*$2')
            .replace(/sqrt\(/gi, 'Math.sqrt(')
            .replace(/abs\(/gi, 'Math.abs(')
            .replace(/ceil\(/gi, 'Math.ceil(')
            .replace(/floor\(/gi, 'Math.floor(')
            .replace(/round\(/gi, 'Math.round(')
            .replace(/log\(/gi, 'Math.log(')
            .replace(/sin\(/gi, 'Math.sin(')
            .replace(/cos\(/gi, 'Math.cos(')
            .replace(/tan\(/gi, 'Math.tan(')
            .replace(/pi/gi, 'Math.PI')
            .replace(/e(?![a-z])/gi, 'Math.E');

          // Validate: only allow numbers, operators, Math functions, parentheses, and spaces
          if (!/^[\d\s+\-*/().%,MatheEPIsqrtabceilflooroundlogsincotan*]+$/.test(expr)) {
            return {
              success: false,
              output: 'Invalid expression: contains disallowed characters',
              executionTimeMs: Date.now() - startTime,
            };
          }

          // Use Function constructor for controlled math evaluation
          // This only allows Math-related operations
          const fn = new Function(`"use strict"; return (${expr});`);
          const result = fn();

          return {
            success: true,
            output: `${params.expression} = ${result}`,
            data: { expression: params.expression, result },
            executionTimeMs: Date.now() - startTime,
          };
        } catch (error) {
          return {
            success: false,
            output: `Calculation error: ${error instanceof Error ? error.message : 'Invalid expression'}`,
            error: error instanceof Error ? error.message : 'Invalid expression',
            executionTimeMs: Date.now() - startTime,
          };
        }
      },
    });

    // Current DateTime Tool
    this.registerTool({
      name: 'get_datetime',
      description: 'Get the current date and time information.',
      parameters: {
        type: 'object',
        properties: {
          timezone: { type: 'string', description: 'Timezone (e.g., "America/New_York", "UTC")', default: 'UTC' },
          format: { type: 'string', description: 'Output format', enum: ['full', 'date', 'time', 'iso'], default: 'full' },
        },
        required: [],
      },
      handler: async (params) => {
        const startTime = Date.now();
        const now = new Date();
        const tz = (params.timezone as string) || 'UTC';
        const format = (params.format as string) || 'full';

        let output: string;
        try {
          switch (format) {
            case 'date':
              output = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
              break;
            case 'time':
              output = now.toLocaleTimeString('en-US', { timeZone: tz, hour12: true });
              break;
            case 'iso':
              output = now.toISOString();
              break;
            default:
              output = now.toLocaleString('en-US', {
                timeZone: tz,
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              });
          }
        } catch {
          output = now.toISOString();
        }

        return {
          success: true,
          output,
          data: { iso: now.toISOString(), timezone: tz },
          executionTimeMs: Date.now() - startTime,
        };
      },
    });

    aiLogger.info(`ToolExecutionService: ${this.tools.size} tools registered`);
  }

  /**
   * Register a new tool
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    aiLogger.info(`Tool registered: ${tool.name}`);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get all registered tool definitions (for AI function calling)
   */
  getToolDefinitions(): Array<{
    name: string;
    description: string;
    parameters: ToolDefinition['parameters'];
  }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        output: `Unknown tool: ${name}`,
        error: `Tool "${name}" is not registered`,
        executionTimeMs: 0,
      };
    }

    aiLogger.info(`Executing tool: ${name}`, { params });

    try {
      const result = await tool.handler(params);
      aiLogger.info(`Tool execution complete: ${name}`, {
        success: result.success,
        timeMs: result.executionTimeMs,
      });
      return result;
    } catch (error) {
      aiLogger.error(`Tool execution failed: ${name}`, error);
      return {
        success: false,
        output: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: 0,
      };
    }
  }

  /**
   * Execute multiple tool calls in sequence
   */
  async executeToolCalls(calls: ToolCall[]): Promise<Map<string, ToolResult>> {
    const results = new Map<string, ToolResult>();

    for (const call of calls) {
      const result = await this.executeTool(call.name, call.arguments);
      results.set(call.id, result);
    }

    return results;
  }

  /**
   * Get list of available tool names
   */
  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Build a tool context string for including in AI prompts
   */
  buildToolContextForPrompt(): string {
    const tools = this.getToolDefinitions();
    let context = 'You have access to the following tools:\n\n';

    for (const tool of tools) {
      context += `**${tool.name}**: ${tool.description}\n`;
      context += `Parameters: ${JSON.stringify(tool.parameters.properties, null, 2)}\n\n`;
    }

    context += '\nTo use a tool, respond with a JSON block like:\n';
    context += '```tool\n{"tool": "tool_name", "params": {"param1": "value1"}}\n```\n';
    context += '\nYou can use multiple tools in sequence. Results will be provided back to you.\n';

    return context;
  }
}

export const toolExecutionService = new ToolExecutionService();
export default toolExecutionService;
