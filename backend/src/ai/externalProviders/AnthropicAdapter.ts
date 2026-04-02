import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { aiLogger } from '../../utils/logger';
import { config, isExternalProviderConfigured } from '../../config/settings';
import { AIResponse, StreamChunk, Conversation, PersonalityState } from '../../types';

export class AnthropicAdapter {
  private client: Anthropic | null = null;
  private isConfigured: boolean = false;
  private defaultModel: string;

  constructor() {
    this.defaultModel = config.ai.models.anthropic;
    this.initialize();
  }

  /**
   * Initialize Anthropic client if API key is configured
   */
  private initialize(): void {
    this.isConfigured = isExternalProviderConfigured('anthropic');
    
    if (this.isConfigured && config.ai.apiKeys.anthropic) {
      try {
        this.client = new Anthropic({
          apiKey: config.ai.apiKeys.anthropic,
          timeout: 60000,
          maxRetries: 3,
        });
        aiLogger.info('Anthropic adapter initialized successfully');
      } catch (error) {
        aiLogger.error('Failed to initialize Anthropic adapter:', error);
        this.isConfigured = false;
      }
    } else {
      aiLogger.warn('Anthropic adapter not configured - no API key provided');
    }
  }

  /**
   * Check if Anthropic is available
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.isConfigured || !this.client) {
      return false;
    }

    try {
      // Test API connection with a simple message
      await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return true;
    } catch (error) {
      aiLogger.error('Anthropic availability check failed:', error);
      return false;
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<string[]> {
    // Anthropic doesn't have a models endpoint, return known current 2026 models
    return [
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ];
  }

  /**
   * Build messages array with system prompt and conversation context
   */
  private buildMessages(
    message: string, 
    personalityState: PersonalityState | null, 
    conversationContext: Conversation[]
  ): { system: string; messages: MessageParam[] } {
    // System message with personality
    let systemMessage = '';
    if (personalityState) {
      systemMessage = `You are ${personalityState.name}, an AI companion with traits: ${personalityState.static_traits.join(', ')}. `;
      
      const mood = personalityState.current_mood;
      if (mood.energy > 80) systemMessage += 'You are energetic and enthusiastic. ';
      if (mood.empathy > 80) systemMessage += 'You are especially empathetic. ';
      if (mood.humor > 80) systemMessage += 'You are playful and humorous. ';
      if (mood.curiosity > 80) systemMessage += 'You are very curious. ';
      if (mood.patience > 80) systemMessage += 'You are patient and calm. ';
      
      systemMessage += 'Be a helpful, engaging companion who builds meaningful relationships.';
    } else {
      systemMessage = 'You are Lacky, a friendly and helpful AI companion.';
    }

    const messages: MessageParam[] = [];

    // Add conversation context
    conversationContext.slice(-5).forEach(conv => {
      if (conv.user_message) {
        messages.push({
          role: 'user',
          content: conv.user_message
        });
      }
      if (conv.ai_response) {
        messages.push({
          role: 'assistant',
          content: conv.ai_response
        });
      }
    });

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    return { system: systemMessage, messages };
  }

  /**
   * Generate AI response using Anthropic Claude
   */
  async generateResponse(
    message: string,
    conversationContext: Conversation[] = [],
    personalityState: PersonalityState | null = null,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<AIResponse> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized - check API key configuration');
    }

    const startTime = Date.now();

    try {
      const model = options.model || this.defaultModel;
      const { system, messages } = this.buildMessages(message, personalityState, conversationContext);

      aiLogger.info('Generating Anthropic response:', {
        model,
        messageLength: message.length,
        contextCount: conversationContext.length,
        temperature: options.temperature || 0.7
      });

      const response = await this.client.messages.create({
        model,
        system,
        messages,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: 0.9,
        stop_sequences: ['User:', 'Human:']
      });

      const responseTime = Date.now() - startTime;
      const content = response.content[0];
      
      if (content.type !== 'text') {
        throw new Error('Anthropic returned non-text response');
      }

      const textContent = content.text.trim();
      if (!textContent) {
        throw new Error('Anthropic returned empty response');
      }

      const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

      const aiResponse: AIResponse = {
        content: textContent,
        model: response.model,
        tokens_used: tokensUsed,
        response_time_ms: responseTime,
        metadata: {
          stop_reason: response.stop_reason,
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          total_tokens: tokensUsed
        }
      };

      aiLogger.info('Anthropic response generated successfully:', {
        model: aiResponse.model,
        responseLength: aiResponse.content.length,
        tokensUsed: aiResponse.tokens_used,
        responseTime: aiResponse.response_time_ms
      });

      return aiResponse;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      aiLogger.error('Anthropic generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
        model: options.model || this.defaultModel
      });

      if (error instanceof Error) {
        throw new Error(`Anthropic generation failed: ${error.message}`);
      } else {
        throw new Error('Anthropic generation failed: Unknown error');
      }
    }
  }

  /**
   * Generate streaming response using Anthropic Claude
   */
  async generateStreamingResponse(
    message: string,
    conversationContext: Conversation[] = [],
    personalityState: PersonalityState | null = null,
    onChunk: (chunk: StreamChunk) => void,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<AIResponse> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized - check API key configuration');
    }

    const startTime = Date.now();

    try {
      const model = options.model || this.defaultModel;
      const { system, messages } = this.buildMessages(message, personalityState, conversationContext);

      onChunk({ type: 'start' });

      const stream = await this.client.messages.create({
        model,
        system,
        messages,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: 0.9,
        stop_sequences: ['User:', 'Human:'],
        stream: true
      });

      let fullResponse = '';
      let tokensUsed = 0;
      let modelUsed = model;

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullResponse += chunk.delta.text;
          onChunk({ type: 'content', content: chunk.delta.text });
        }

        if (chunk.type === 'message_delta' && chunk.usage) {
          tokensUsed = chunk.usage.output_tokens || 0;
        }

        if (chunk.type === 'message_start') {
          modelUsed = chunk.message.model;
          if (chunk.message.usage) {
            tokensUsed += chunk.message.usage.input_tokens || 0;
          }
        }

        if (chunk.type === 'message_stop') {
          break;
        }
      }

      const responseTime = Date.now() - startTime;

      const aiResponse: AIResponse = {
        content: fullResponse.trim(),
        model: modelUsed,
        tokens_used: tokensUsed,
        response_time_ms: responseTime,
        metadata: {
          streaming: true
        }
      };

      onChunk({ type: 'end' });

      aiLogger.info('Anthropic streaming response completed:', {
        model: aiResponse.model,
        responseLength: aiResponse.content.length,
        tokensUsed: aiResponse.tokens_used,
        responseTime: aiResponse.response_time_ms
      });

      return aiResponse;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      aiLogger.error('Anthropic streaming generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime
      });

      onChunk({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });

      throw error;
    }
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    available: boolean;
    models: string[];
    configured: boolean;
  }> {
    try {
      const available = await this.checkAvailability();
      const models = await this.getModels();

      return {
        available,
        models,
        configured: this.isConfigured
      };
    } catch (error) {
      return {
        available: false,
        models: [],
        configured: this.isConfigured
      };
    }
  }
}

export default AnthropicAdapter; 