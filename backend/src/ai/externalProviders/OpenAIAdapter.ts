import OpenAI from 'openai';
import { aiLogger } from '../../utils/logger';
import { config, isExternalProviderConfigured } from '../../config/settings';
import { AIResponse, StreamChunk, Conversation, PersonalityState } from '../../types';

export class OpenAIAdapter {
  private client: OpenAI | null = null;
  private isConfigured: boolean = false;
  private defaultModel: string;

  constructor() {
    this.defaultModel = config.ai.models.openai;
    this.initialize();
  }

  /**
   * Initialize OpenAI client if API key is configured
   */
  private initialize(): void {
    this.isConfigured = isExternalProviderConfigured('openai');
    
    if (this.isConfigured && config.ai.apiKeys.openai) {
      try {
        this.client = new OpenAI({
          apiKey: config.ai.apiKeys.openai,
          timeout: 60000,
          maxRetries: 3,
        });
        aiLogger.info('OpenAI adapter initialized successfully');
      } catch (error) {
        aiLogger.error('Failed to initialize OpenAI adapter:', error);
        this.isConfigured = false;
      }
    } else {
      aiLogger.warn('OpenAI adapter not configured - no API key provided');
    }
  }

  /**
   * Check if OpenAI is available
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.isConfigured || !this.client) {
      return false;
    }

    try {
      // Test API connection with a simple model list request
      await this.client.models.list();
      return true;
    } catch (error) {
      aiLogger.error('OpenAI availability check failed:', error);
      return false;
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<string[]> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await this.client.models.list();
      return response.data
        .filter(model => model.id.includes('gpt') || model.id.startsWith('o'))
        .map(model => model.id)
        .sort();
    } catch (error) {
      aiLogger.error('Failed to get OpenAI models:', error);
      // Return known current models as fallback
      return [
        'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano',
        'gpt-5.2', 'gpt-5.1',
        'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
        'gpt-4o', 'gpt-4o-mini',
        'o4-mini', 'o3', 'o3-mini', 'o1', 'o1-mini',
      ];
    }
  }

  /**
   * Build messages array with system prompt and conversation context
   */
  private buildMessages(
    message: string, 
    personalityState: PersonalityState | null, 
    conversationContext: Conversation[]
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

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

    messages.push({
      role: 'system',
      content: systemMessage
    });

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

    return messages;
  }

  /**
   * Generate AI response using OpenAI
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
      throw new Error('OpenAI client not initialized - check API key configuration');
    }

    const startTime = Date.now();

    try {
      const model = options.model || this.defaultModel;
      const messages = this.buildMessages(message, personalityState, conversationContext);

      aiLogger.info('Generating OpenAI response:', {
        model,
        messageLength: message.length,
        contextCount: conversationContext.length,
        temperature: options.temperature || 0.7
      });

      const completion = await this.client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
        stop: ['User:', 'Human:']
      });

      const responseTime = Date.now() - startTime;
      const content = completion.choices[0]?.message?.content?.trim() || '';
      
      if (!content) {
        throw new Error('OpenAI returned empty response');
      }

      const tokensUsed = completion.usage?.total_tokens || 0;

      const aiResponse: AIResponse = {
        content,
        model: completion.model,
        tokens_used: tokensUsed,
        response_time_ms: responseTime,
        metadata: {
          finish_reason: completion.choices[0]?.finish_reason,
          prompt_tokens: completion.usage?.prompt_tokens,
          completion_tokens: completion.usage?.completion_tokens,
          total_tokens: completion.usage?.total_tokens
        }
      };

      aiLogger.info('OpenAI response generated successfully:', {
        model: aiResponse.model,
        responseLength: aiResponse.content.length,
        tokensUsed: aiResponse.tokens_used,
        responseTime: aiResponse.response_time_ms
      });

      return aiResponse;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      aiLogger.error('OpenAI generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
        model: options.model || this.defaultModel
      });

      if (error instanceof Error) {
        throw new Error(`OpenAI generation failed: ${error.message}`);
      } else {
        throw new Error('OpenAI generation failed: Unknown error');
      }
    }
  }

  /**
   * Generate streaming response using OpenAI
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
      throw new Error('OpenAI client not initialized - check API key configuration');
    }

    const startTime = Date.now();

    try {
      const model = options.model || this.defaultModel;
      const messages = this.buildMessages(message, personalityState, conversationContext);

      onChunk({ type: 'start' });

      const stream = await this.client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
        stop: ['User:', 'Human:'],
        stream: true
      });

      let fullResponse = '';
      let tokensUsed = 0;
      let modelUsed = model;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          fullResponse += delta.content;
          onChunk({ type: 'content', content: delta.content });
        }

        if (chunk.model) {
          modelUsed = chunk.model;
        }

        // Note: Token usage is not available in streaming mode for OpenAI
        // We'll estimate based on content length
        if (chunk.choices[0]?.finish_reason) {
          tokensUsed = Math.ceil((message.length + fullResponse.length) / 4);
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
          streaming: true,
          estimated_tokens: true
        }
      };

      onChunk({ type: 'end' });

      aiLogger.info('OpenAI streaming response completed:', {
        model: aiResponse.model,
        responseLength: aiResponse.content.length,
        estimatedTokens: aiResponse.tokens_used,
        responseTime: aiResponse.response_time_ms
      });

      return aiResponse;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      aiLogger.error('OpenAI streaming generation failed:', {
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
      const models = available ? await this.getModels().catch(() => []) : [];

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

export default OpenAIAdapter; 