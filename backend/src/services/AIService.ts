import { AIResponse, StreamChunk, Conversation, PersonalityState, AIProviderType } from '../types';
import { aiLogger } from '../utils/logger';
import { config } from '../config/settings';
import OllamaWrapper from '../ai/ollama/customWrapper';
import { OpenAIAdapter } from '../ai/externalProviders/OpenAIAdapter';
import { AnthropicAdapter } from '../ai/externalProviders/AnthropicAdapter';
import { GoogleAdapter } from '../ai/externalProviders/GoogleAdapter';
import { xAIAdapter } from '../ai/externalProviders/xAIAdapter';
import { DatabaseService } from './DatabaseService';
import { MemoryService } from './MemoryService';
import { PersonalityService } from './PersonalityService';
import { analyzeSentiment } from '../middleware/sentiment_new';

interface AIServiceOptions {
  provider?: AIProviderType;
  model?: string;
  useUncensored?: boolean;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  usePersonality?: boolean;
  useMemory?: boolean;
}

export class AIService {
  private ollamaWrapper: OllamaWrapper;
  private openaiAdapter: OpenAIAdapter;
  private anthropicAdapter: AnthropicAdapter;
  private googleAdapter: GoogleAdapter;
  private xaiAdapter: xAIAdapter;
  private databaseService: DatabaseService;
  private memoryService: MemoryService;
  private personalityService: PersonalityService;
  private defaultProvider: AIProviderType;

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
    this.memoryService = new MemoryService(databaseService);
    this.personalityService = new PersonalityService(databaseService);
    this.ollamaWrapper = new OllamaWrapper();
    this.openaiAdapter = new OpenAIAdapter();
    this.anthropicAdapter = new AnthropicAdapter();
    this.googleAdapter = new GoogleAdapter();
    this.xaiAdapter = new xAIAdapter();
    this.defaultProvider = config.ai.primaryProvider as AIProviderType;

    aiLogger.info('AI Service initialized', {
      defaultProvider: this.defaultProvider,
      ollamaConfigured: true,
      openaiConfigured: config.ai.apiKeys.openai ? true : false,
      anthropicConfigured: config.ai.apiKeys.anthropic ? true : false,
      googleConfigured: config.ai.apiKeys.google ? true : false,
      xaiConfigured: config.ai.apiKeys.xai ? true : false
    });
  }

  /**
   * Get available providers and their status
   */
  async getAvailableProviders(): Promise<{
    [key in AIProviderType]?: {
      available: boolean;
      models: string[];
      configured: boolean;
    }
  }> {
    const providers: any = {};

    try {
      // Check Ollama
      providers.ollama = await this.ollamaWrapper.getStatus();
    } catch (error) {
      aiLogger.error('Failed to get Ollama status:', error);
      providers.ollama = { available: false, models: [], configured: true };
    }

    try {
      // Check OpenAI
      providers.openai = await this.openaiAdapter.getStatus();
    } catch (error) {
      aiLogger.error('Failed to get OpenAI status:', error);
      providers.openai = { available: false, models: [], configured: false };
    }

    try {
      // Check Anthropic
      providers.anthropic = await this.anthropicAdapter.getStatus();
    } catch (error) {
      aiLogger.error('Failed to get Anthropic status:', error);
      providers.anthropic = { available: false, models: [], configured: false };
    }

    try {
      // Check Google
      providers.google = await this.googleAdapter.getStatus();
    } catch (error) {
      aiLogger.error('Failed to get Google status:', error);
      providers.google = { available: false, models: [], configured: false };
    }

    try {
      // Check xAI
      providers.xai = await this.xaiAdapter.getStatus();
    } catch (error) {
      aiLogger.error('Failed to get xAI status:', error);
      providers.xai = { available: false, models: [], configured: false };
    }

    return providers;
  }

  /**
   * Determine the best available provider
   */
  async determineBestProvider(preferredProvider?: AIProviderType): Promise<{
    provider: AIProviderType;
    available: boolean;
    reason: string;
  }> {
    const providers = await this.getAvailableProviders();

    // If a specific provider is requested, try it first
    if (preferredProvider && providers[preferredProvider]?.available) {
      return {
        provider: preferredProvider,
        available: true,
        reason: `User requested ${preferredProvider} and it's available`
      };
    }

    // Check default provider
    if (providers[this.defaultProvider]?.available) {
      return {
        provider: this.defaultProvider,
        available: true,
        reason: `Default provider ${this.defaultProvider} is available`
      };
    }

    // Fallback order: ollama -> openai -> others
    const fallbackOrder: AIProviderType[] = ['ollama', 'openai', 'anthropic', 'google', 'xai'];
    
    for (const provider of fallbackOrder) {
      if (providers[provider]?.available) {
        return {
          provider,
          available: true,
          reason: `Fallback to ${provider} - default provider unavailable`
        };
      }
    }

    // No providers available
    return {
      provider: this.defaultProvider,
      available: false,
      reason: 'No AI providers are currently available'
    };
  }

  /**
   * Get conversation context for AI generation
   */
  private async getConversationContext(sessionId: string, limit: number = 5): Promise<Conversation[]> {
    try {
      // Get conversation history from database directly
      // We need this as an array of Conversation objects for the AI adapters
      const result = await this.databaseService.executeQuery(`
        SELECT user_message, ai_response, timestamp, sentiment_score
        FROM conversations 
        WHERE session_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [sessionId, limit]);

      const conversations: Conversation[] = [];
      
      for (const row of result.data) {
        if (row.user_message) {
          conversations.push({
            id: row.id || Date.now(),
            session_id: sessionId,
            user_message: row.user_message,
            ai_response: row.ai_response || '',
            timestamp: row.timestamp,
            sentiment_score: row.sentiment_score,
            sentiment_label: 'neutral',
            context_tags: [],
            message_type: 'chat',
            tokens_used: 0,
            response_time_ms: 0,
            model_used: null,
            created_at: row.timestamp,
            updated_at: row.timestamp
          });
        }
      }

      return conversations.reverse(); // Return in chronological order
    } catch (error) {
      aiLogger.error('Failed to get conversation context:', error);
      return [];
    }
  }

  /**
   * Get personality state for context
   */
  private async getPersonalityState(): Promise<PersonalityState | null> {
    try {
      // Load personality using the new PersonalityService
      const personalityContext = await this.personalityService.loadPersonality('default');
      
      // Convert to the expected PersonalityState format
      // Map between different MoodState interfaces
      const mappedMood = {
        energy: personalityContext.currentMood.energy,
        empathy: personalityContext.currentMood.empathyLevel || 50,
        humor: personalityContext.currentMood.humorLevel || 50,
        curiosity: 50, // Default value
        patience: 50   // Default value
      };

      return {
        id: 1,
        name: 'AI Assistant',
        static_traits: Object.entries(personalityContext.traits).map(([key, value]) => `${key}:${value}`),
        current_mood: mappedMood,
        energy_level: mappedMood.energy,
        empathy_level: mappedMood.empathy,
        humor_level: mappedMood.humor,
        curiosity_level: mappedMood.curiosity,
        patience_level: mappedMood.patience,
        conversation_count: 0,
        total_interactions: 0,
        last_interaction: null,
        mood_history: [],
        learning_data: {},
        personality_version: '2.0.0-alpha',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      aiLogger.error('Failed to get personality state:', error);
      return null;
    }
  }

  /**
   * Generate AI response using the best available provider
   */
  async generateResponse(
    message: string,
    sessionId: string,
    options: AIServiceOptions = {}
  ): Promise<{
    response: AIResponse;
    provider: AIProviderType;
    providerReason: string;
  }> {
    const startTime = Date.now();

    try {
      // Determine provider
      const providerInfo = await this.determineBestProvider(options.provider);
      
      if (!providerInfo.available) {
        throw new Error(`No AI providers available: ${providerInfo.reason}`);
      }

      // Get context
      const [conversationContext, personalityState] = await Promise.all([
        this.getConversationContext(sessionId, 5),
        this.getPersonalityState()
      ]);

      aiLogger.info('Generating AI response:', {
        provider: providerInfo.provider,
        sessionId,
        messageLength: message.length,
        contextCount: conversationContext.length,
        reason: providerInfo.reason
      });

      let response: AIResponse;

      // Route to appropriate provider
      // Filter undefined values to satisfy exactOptionalPropertyTypes
      const providerOptions = {
        ...(options.model && { model: options.model }),
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens && { maxTokens: options.maxTokens })
      };

      switch (providerInfo.provider) {
        case 'ollama':
          response = await this.ollamaWrapper.generateResponse(
            message,
            conversationContext,
            personalityState,
            providerOptions
          );
          break;

        case 'openai':
          response = await this.openaiAdapter.generateResponse(
            message,
            conversationContext,
            personalityState,
            providerOptions
          );
          break;

        case 'anthropic':
          response = await this.anthropicAdapter.generateResponse(
            message,
            conversationContext,
            personalityState,
            providerOptions
          );
          break;

        case 'google':
          response = await this.googleAdapter.generateResponse(
            message,
            conversationContext,
            personalityState,
            providerOptions
          );
          break;

        case 'xai':
          response = await this.xaiAdapter.generateResponse(
            message,
            conversationContext,
            personalityState,
            providerOptions
          );
          break;

        default:
          throw new Error(`Unsupported AI provider: ${providerInfo.provider}. Supported providers: ollama, openai, anthropic, google, xai`);
      }

      const totalTime = Date.now() - startTime;

      aiLogger.info('AI response generated successfully:', {
        provider: providerInfo.provider,
        model: response.model,
        responseLength: response.content.length,
        tokensUsed: response.tokens_used,
        totalTime,
        providerTime: response.response_time_ms
      });

      return {
        response,
        provider: providerInfo.provider,
        providerReason: providerInfo.reason
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      aiLogger.error('AI response generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        totalTime,
        options
      });

      throw error;
    }
  }

  /**
   * Generate streaming AI response
   */
  async generateStreamingResponse(
    message: string,
    sessionId: string,
    onChunk: (chunk: StreamChunk) => void,
    options: AIServiceOptions = {}
  ): Promise<{
    response: AIResponse;
    provider: AIProviderType;
    providerReason: string;
  }> {
    const startTime = Date.now();

    try {
      // Determine provider
      const providerInfo = await this.determineBestProvider(options.provider);
      
      if (!providerInfo.available) {
        onChunk({ 
          type: 'error', 
          error: `No AI providers available: ${providerInfo.reason}` 
        });
        throw new Error(`No AI providers available: ${providerInfo.reason}`);
      }

      // Get context
      const [conversationContext, personalityState] = await Promise.all([
        this.getConversationContext(sessionId, 5),
        this.getPersonalityState()
      ]);

      aiLogger.info('Generating streaming AI response:', {
        provider: providerInfo.provider,
        sessionId,
        messageLength: message.length,
        contextCount: conversationContext.length,
        reason: providerInfo.reason
      });

      let response: AIResponse;

      // Route to appropriate provider
      // Filter undefined values to satisfy exactOptionalPropertyTypes
      const streamingOptions = {
        ...(options.model && { model: options.model }),
        ...(options.useUncensored !== undefined && { useUncensored: options.useUncensored }),
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens && { maxTokens: options.maxTokens })
      };

      switch (providerInfo.provider) {
        case 'ollama':
          response = await this.ollamaWrapper.generateStreamingResponse(
            message,
            conversationContext,
            personalityState,
            onChunk,
            streamingOptions
          );
          break;

        case 'openai':
          response = await this.openaiAdapter.generateStreamingResponse(
            message,
            conversationContext,
            personalityState,
            onChunk,
            streamingOptions
          );
          break;

        case 'anthropic':
          response = await this.anthropicAdapter.generateStreamingResponse(
            message,
            conversationContext,
            personalityState,
            onChunk,
            streamingOptions
          );
          break;

        case 'google':
          response = await this.googleAdapter.generateStreamingResponse(
            message,
            conversationContext,
            personalityState,
            onChunk,
            streamingOptions
          );
          break;

        case 'xai':
          response = await this.xaiAdapter.generateStreamingResponse(
            message,
            conversationContext,
            personalityState,
            onChunk,
            streamingOptions
          );
          break;

        default:
          onChunk({ 
            type: 'error', 
            error: `Unsupported AI provider: ${providerInfo.provider}. Supported providers: ollama, openai, anthropic, google, xai` 
          });
          throw new Error(`Unsupported AI provider: ${providerInfo.provider}. Supported providers: ollama, openai, anthropic, google, xai`);
      }

      const totalTime = Date.now() - startTime;

      aiLogger.info('Streaming AI response completed:', {
        provider: providerInfo.provider,
        model: response.model,
        responseLength: response.content.length,
        tokensUsed: response.tokens_used,
        totalTime,
        providerTime: response.response_time_ms
      });

      return {
        response,
        provider: providerInfo.provider,
        providerReason: providerInfo.reason
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      aiLogger.error('Streaming AI response generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        totalTime,
        options
      });

      throw error;
    }
  }

  /**
   * Test AI providers and return diagnostics
   */
  async testProviders(): Promise<{
    [key in AIProviderType]?: {
      available: boolean;
      testMessage?: string;
      testResponse?: string;
      error?: string;
      responseTime?: number;
    }
  }> {
    const results: any = {};
    const testMessage = "Hello! This is a test message. Please respond briefly.";

    // Test Ollama
    try {
      const startTime = Date.now();
      const response = await this.ollamaWrapper.generateResponse(testMessage, [], null, {
        temperature: 0.7,
        maxTokens: 50
      });
      results.ollama = {
        available: true,
        testMessage,
        testResponse: response.content,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      results.ollama = {
        available: false,
        testMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test OpenAI
    try {
      const startTime = Date.now();
      const response = await this.openaiAdapter.generateResponse(testMessage, [], null, {
        temperature: 0.7,
        maxTokens: 50
      });
      results.openai = {
        available: true,
        testMessage,
        testResponse: response.content,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      results.openai = {
        available: false,
        testMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test Anthropic
    try {
      const startTime = Date.now();
      const response = await this.anthropicAdapter.generateResponse(testMessage, [], null, {
        temperature: 0.7,
        maxTokens: 50
      });
      results.anthropic = {
        available: true,
        testMessage,
        testResponse: response.content,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      results.anthropic = {
        available: false,
        testMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test Google
    try {
      const startTime = Date.now();
      const response = await this.googleAdapter.generateResponse(testMessage, [], null, {
        temperature: 0.7,
        maxTokens: 50
      });
      results.google = {
        available: true,
        testMessage,
        testResponse: response.content,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      results.google = {
        available: false,
        testMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test xAI
    try {
      const startTime = Date.now();
      const response = await this.xaiAdapter.generateResponse(testMessage, [], null, {
        temperature: 0.7,
        maxTokens: 50
      });
      results.xai = {
        available: true,
        testMessage,
        testResponse: response.content,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      results.xai = {
        available: false,
        testMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return results;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    providers: { [key: string]: boolean };
    details: string;
  }> {
    try {
      const providers = await this.getAvailableProviders();
      const availableCount = Object.values(providers).filter(p => p?.available).length;
      const totalCount = Object.keys(providers).length;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      let details: string;

      if (availableCount === 0) {
        status = 'unhealthy';
        details = 'No AI providers are available';
      } else if (availableCount < totalCount) {
        status = 'degraded';
        details = `${availableCount}/${totalCount} AI providers available`;
      } else {
        status = 'healthy';
        details = `All ${totalCount} AI providers available`;
      }

      return {
        status,
        providers: Object.fromEntries(
          Object.entries(providers).map(([key, value]) => [key, value?.available || false])
        ),
        details
      };
    } catch (error) {
      aiLogger.error('Failed to get AI service health status:', error);
      return {
        status: 'unhealthy',
        providers: {},
        details: 'Failed to check AI service health'
      };
    }
  }
}

export default AIService; 