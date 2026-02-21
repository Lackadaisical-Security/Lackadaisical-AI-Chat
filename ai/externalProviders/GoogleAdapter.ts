import { GoogleGenerativeAI, GenerativeModel, GenerateContentStreamResult } from '@google/generative-ai';
import { aiLogger } from '../../backend/src/utils/logger';
import { config, isExternalProviderConfigured } from '../../config/settings';
import { AIResponse, StreamChunk, Conversation, PersonalityState } from '../../backend/src/types';

export class GoogleAdapter {
  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private isConfigured: boolean = false;
  private defaultModel: string;

  constructor() {
    this.defaultModel = config.ai.models.google;
    this.initialize();
  }

  /**
   * Initialize Google Gemini client if API key is configured
   */
  private initialize(): void {
    this.isConfigured = isExternalProviderConfigured('google');
    
    if (this.isConfigured && config.ai.apiKeys.google) {
      try {
        this.client = new GoogleGenerativeAI(config.ai.apiKeys.google);
        this.model = this.client.getGenerativeModel({ model: this.defaultModel });
        aiLogger.info('Google adapter initialized successfully');
      } catch (error) {
        aiLogger.error('Failed to initialize Google adapter:', error);
        this.isConfigured = false;
      }
    } else {
      aiLogger.warn('Google adapter not configured - no API key provided');
    }
  }

  /**
   * Check if Google Gemini is available
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.isConfigured || !this.model) {
      return false;
    }

    try {
      // Test API connection with a simple generation
      await this.model.generateContent('Hi');
      return true;
    } catch (error) {
      aiLogger.error('Google availability check failed:', error);
      return false;
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<string[]> {
    // Google doesn't provide a models endpoint, return known models
    return [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro',
      'gemini-pro-vision'
    ];
  }

  /**
   * Build prompt with personality and conversation context
   */
  private buildPrompt(
    message: string, 
    personalityState: PersonalityState | null, 
    conversationContext: Conversation[]
  ): string {
    let prompt = '';

    // System prompt with personality
    if (personalityState) {
      prompt += `You are ${personalityState.name}, an AI companion with the following traits: ${personalityState.static_traits.join(', ')}.\n\n`;
      
      const mood = personalityState.current_mood;
      if (mood.energy > 80) prompt += 'You are feeling energetic and enthusiastic today.\n';
      if (mood.empathy > 80) prompt += 'You are feeling especially empathetic and understanding.\n';
      if (mood.humor > 80) prompt += 'You are in a playful and humorous mood.\n';
      if (mood.curiosity > 80) prompt += 'You are feeling very curious and inquisitive.\n';
      if (mood.patience > 80) prompt += 'You are feeling particularly patient and calm.\n';
      
      prompt += 'Your goal is to be a helpful, engaging companion who remembers our conversations and builds meaningful relationships.\n\n';
    } else {
      prompt += 'You are Lacky, a friendly and helpful AI companion.\n\n';
    }

    // Add conversation context
    if (conversationContext.length > 0) {
      prompt += 'Recent conversation history:\n';
      conversationContext.slice(-3).forEach((conv, index) => {
        if (conv.user_message) {
          prompt += `User: ${conv.user_message}\n`;
        }
        if (conv.ai_response) {
          prompt += `You: ${conv.ai_response}\n`;
        }
      });
      prompt += '\nPlease continue this conversation naturally, maintaining the same tone and personality.\n\n';
    }

    prompt += `User: ${message}\nYou:`;

    return prompt;
  }

  /**
   * Generate AI response using Google Gemini
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
    if (!this.client || !this.model) {
      throw new Error('Google client not initialized - check API key configuration');
    }

    const startTime = Date.now();

    try {
      const model = options.model || this.defaultModel;
      const prompt = this.buildPrompt(message, personalityState, conversationContext);

      // Use different model if specified
      const generativeModel = model !== this.defaultModel 
        ? this.client.getGenerativeModel({ model })
        : this.model;

      aiLogger.info('Generating Google response:', {
        model,
        messageLength: message.length,
        contextCount: conversationContext.length,
        temperature: options.temperature || 0.7
      });

      const result = await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 1000,
          topP: 0.9,
          topK: 40,
          stopSequences: ['User:', 'Human:']
        }
      });

      const responseTime = Date.now() - startTime;
      const response = await result.response;
      const content = response.text().trim();
      
      if (!content) {
        throw new Error('Google returned empty response');
      }

      // Google doesn't provide detailed token usage in the response
      const estimatedTokens = Math.ceil((prompt.length + content.length) / 4);

      const aiResponse: AIResponse = {
        content,
        model,
        tokens_used: estimatedTokens,
        response_time_ms: responseTime,
        metadata: {
          estimated_tokens: true,
          candidates: response.candidates?.length || 1,
          safety_ratings: response.candidates?.[0]?.safetyRatings
        }
      };

      aiLogger.info('Google response generated successfully:', {
        model: aiResponse.model,
        responseLength: aiResponse.content.length,
        estimatedTokens: aiResponse.tokens_used,
        responseTime: aiResponse.response_time_ms
      });

      return aiResponse;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      aiLogger.error('Google generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
        model: options.model || this.defaultModel
      });

      if (error instanceof Error) {
        throw new Error(`Google generation failed: ${error.message}`);
      } else {
        throw new Error('Google generation failed: Unknown error');
      }
    }
  }

  /**
   * Generate streaming response using Google Gemini
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
    if (!this.client || !this.model) {
      throw new Error('Google client not initialized - check API key configuration');
    }

    const startTime = Date.now();

    try {
      const model = options.model || this.defaultModel;
      const prompt = this.buildPrompt(message, personalityState, conversationContext);

      // Use different model if specified
      const generativeModel = model !== this.defaultModel 
        ? this.client.getGenerativeModel({ model })
        : this.model;

      onChunk({ type: 'start' });

      const result = await generativeModel.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 1000,
          topP: 0.9,
          topK: 40,
          stopSequences: ['User:', 'Human:']
        }
      });

      let fullResponse = '';

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          fullResponse += chunkText;
          onChunk({ type: 'content', content: chunkText });
        }
      }

      const responseTime = Date.now() - startTime;
      const estimatedTokens = Math.ceil((prompt.length + fullResponse.length) / 4);

      const aiResponse: AIResponse = {
        content: fullResponse.trim(),
        model,
        tokens_used: estimatedTokens,
        response_time_ms: responseTime,
        metadata: {
          streaming: true,
          estimated_tokens: true
        }
      };

      onChunk({ type: 'end' });

      aiLogger.info('Google streaming response completed:', {
        model: aiResponse.model,
        responseLength: aiResponse.content.length,
        estimatedTokens: aiResponse.tokens_used,
        responseTime: aiResponse.response_time_ms
      });

      return aiResponse;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      aiLogger.error('Google streaming generation failed:', {
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

export default GoogleAdapter; 