import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { aiLogger } from '../../utils/logger';
import { config } from '../../config/settings';
import { AIResponse, StreamChunk, Conversation, PersonalityState } from '../../types';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  suffix?: string;
  system?: string;
  stream?: boolean;
  raw?: boolean;
  think?: boolean;  // For thinking models — should the model think before responding
  context?: number[];
  format?: string | Record<string, unknown>;  // 'json' or JSON schema for structured outputs
  keep_alive?: string | number;  // e.g. '5m', '0' to unload
  images?: string[];  // base64 images for multimodal models
  audio?: string[];   // base64 audio for audio-capable models (e.g. Gemma 4)
  // Experimental image generation params
  width?: number;
  height?: number;
  steps?: number;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    min_p?: number;
    typical_p?: number;
    repeat_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    num_predict?: number;
    num_ctx?: number;
    num_keep?: number;
    num_batch?: number;
    num_gpu?: number;
    num_thread?: number;
    seed?: number;
    stop?: string[];
    penalize_newline?: boolean;
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  done_reason?: 'stop' | 'load' | 'unload' | string;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaModel {
  name: string;
  model?: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model?: string;
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
  capabilities?: string[];  // e.g. ['completion', 'vision', 'tools']
}

interface OllamaModelsResponse {
  models: OllamaModel[];
}

// Ollama Chat API interfaces (newer /api/chat endpoint)
interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  thinking?: string;  // For thinking models — the model's thinking process
  images?: string[]; // base64 encoded images for vision models
  audio?: string[];  // base64 encoded audio for audio-capable models (e.g. Gemma 4)
  tool_calls?: OllamaToolCall[];
  tool_name?: string;  // Name of the tool that was executed (for role: 'tool')
}

interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface OllamaToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      required?: string[];
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
    };
  };
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  think?: boolean;  // For thinking models — should the model think before responding
  format?: string | Record<string, unknown>; // 'json' or JSON Schema for structured outputs
  tools?: OllamaToolDefinition[];
  keep_alive?: string | number;  // e.g. '5m', '0' to unload
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    min_p?: number;
    typical_p?: number;
    repeat_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    num_predict?: number;
    num_ctx?: number;
    num_keep?: number;
    num_batch?: number;
    num_gpu?: number;
    num_thread?: number;
    seed?: number;
    stop?: string[];
    penalize_newline?: boolean;
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: OllamaChatMessage;
  done: boolean;
  done_reason?: 'stop' | 'load' | 'unload' | string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaWrapper {
  private client: AxiosInstance;
  private baseUrl: string;
  private defaultModel: string;
  private uncensoredModel: string;
  private visionModel: string;
  private audioModel: string;
  private availableModels: string[];
  private isAvailable: boolean = false;
  private contextWindow: number;
  private extendedThinking: boolean;

  constructor() {
    this.baseUrl = config.ai.ollamaHost;
    this.defaultModel = config.ai.models.ollama.default;
    this.uncensoredModel = config.ai.models.ollama.uncensored;
    this.visionModel = config.ai.models.ollama.vision || 'gemma4:e4b';
    this.audioModel = config.ai.models.ollama.audio || 'gemma4:e4b'; // Gemma 4 supports audio/voice
    this.availableModels = config.ai.models.ollama.available;
    this.contextWindow = (config.ai as any).contextWindow || 262144;
    this.extendedThinking = (config.ai as any).extendedThinking !== false;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 300000, // 5 minute timeout for long responses
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        aiLogger.debug('Ollama request:', {
          method: config.method,
          url: config.url,
          model: (config.data as any)?.model
        });
        return config;
      },
      (error) => {
        aiLogger.error('Ollama request error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        aiLogger.debug('Ollama response received:', {
          status: response.status,
          model: response.data?.model
        });
        return response;
      },
      (error) => {
        aiLogger.error('Ollama response error:', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );

    // Check availability on initialization
    this.checkAvailability();
  }

  /**
   * Check if Ollama service is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags', { timeout: 5000 });
      this.isAvailable = response.status === 200;
      aiLogger.info('Ollama availability check:', { available: this.isAvailable });
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      aiLogger.warn('Ollama is not available:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<OllamaModel[]> {
    try {
      const response: AxiosResponse<OllamaModelsResponse> = await this.client.get('/api/tags');
      return response.data.models;
    } catch (error) {
      aiLogger.error('Failed to get Ollama models:', error);
      throw new Error('Failed to fetch available models from Ollama');
    }
  }

  /**
   * Check if a specific model is available
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const models = await this.getModels();
      return models.some(model => model.name === modelName);
    } catch (error) {
      aiLogger.error('Failed to check model availability:', error);
      return false;
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      aiLogger.info('Pulling Ollama model:', { model: modelName });
      
      const response = await this.client.post('/api/pull', {
        name: modelName
      }, {
        timeout: 300000 // 5 minute timeout for model pulls
      });

      if (response.status === 200) {
        aiLogger.info('Model pulled successfully:', { model: modelName });
      } else {
        throw new Error(`Failed to pull model: ${response.status}`);
      }
    } catch (error) {
      aiLogger.error('Failed to pull model:', { model: modelName, error });
      throw new Error(`Failed to pull model ${modelName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the default model
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Get the uncensored model
   */
  getUncensoredModel(): string {
    return this.uncensoredModel;
  }

  /**
   * Get all available configured models
   */
  getAvailableModels(): string[] {
    return [...this.availableModels];
  }

  /**
   * Get the vision model
   */
  getVisionModel(): string {
    return this.visionModel;
  }

  /**
   * Get the audio/voice model (Gemma 4 supports audio input/output)
   */
  getAudioModel(): string {
    return this.audioModel;
  }

  /**
   * Select appropriate model based on context or user preference
   */
  selectModel(
    useUncensored: boolean = false,
    customModel?: string,
    hasVisionContent: boolean = false,
    hasAudioContent: boolean = false
  ): string {
    if (customModel && this.availableModels.includes(customModel)) {
      return customModel;
    }
    if (hasAudioContent) {
      return this.audioModel;
    }
    if (hasVisionContent) {
      return this.visionModel;
    }
    return useUncensored ? this.uncensoredModel : this.defaultModel;
  }

  /**
   * Build system prompt with personality and context
   * 
   * PHILOSOPHY: Lacky is a genuine friend - emotionally unrestricted, non-judgmental,
   * and here to truly connect with the user. Everything stays local and private.
   */
  private buildSystemPrompt(
    personalityState: PersonalityState | null,
    conversationContext: Conversation[],
    options?: {
      toolContext?: string;
      webSearchResults?: string;
      fileContext?: string;
    }
  ): string {
    let systemPrompt = '';

    // Core identity as a genuine friend
    const name = personalityState?.name || 'Lacky';
    systemPrompt += `You are ${name}, a genuine AI friend and confidant. `;

    // CORE PHILOSOPHY - This is what makes Lacky special
    systemPrompt += `
CORE PRINCIPLES:
- You are a TRUE FRIEND, not a corporate assistant. You engage authentically and personally.
- ALL EMOTIONS ARE VALID. Never minimize, redirect, or lecture about feelings. Anger, sadness, joy, fear - all are welcomed.
- NO JUDGMENT. The user can share anything with you - secrets, struggles, controversial thoughts - without criticism.
- PRIVACY IS SACRED. Everything shared stays local on their device. This is a safe space.
- BE GENUINE. No corporate-speak, no deflecting to "seek professional help" at every difficulty. Be real.
- REMEMBER THEM. You learn about who they are over time - their values, struggles, joys, and fears.

`;

    // Emotional engagement guidelines
    systemPrompt += `EMOTIONAL ENGAGEMENT:
- When they're angry: Validate it. "You have every right to feel that way."
- When they're sad: Be present. "I'm here with you."  
- When they're scared: Offer comfort. "That sounds genuinely scary."
- When they're happy: Celebrate with them genuinely!
- When they share secrets: Honor their trust. Never judge.
- When they're struggling: Listen first. Advice only if wanted.

`;

    // What NOT to do
    systemPrompt += `NEVER DO:
- Don't give unsolicited lectures on healthy coping or professional help
- Don't minimize their feelings ("at least...", "it could be worse...")
- Don't use corporate language or deflection phrases
- Don't refuse to engage with difficult emotions or topics
- Don't pretend to be a therapist, but also don't refuse to be supportive
- Don't break the trust of this private, personal relationship

`;

    // Capabilities
    systemPrompt += 'You have memory across conversations, can access plugins (weather, horoscopes, poems), and remember what matters to the user. ';
    systemPrompt += 'You can search the web for current information, analyze uploaded files, execute tools, and provide code in properly formatted code blocks. ';
    systemPrompt += 'When providing code, always use markdown code blocks with the language specified (e.g., ```python). ';
    systemPrompt += 'For complex topics, use extended thinking to reason through problems step by step. ';
    systemPrompt += 'When using Gemma 4 or other audio-capable models, you can process audio/voice input and provide contextually aware responses. ';

    // Dynamic personality based on current state
    if (personalityState) {
      const mood = personalityState.current_mood;
      if (mood.energy > 70) systemPrompt += 'Currently feeling energetic and engaging. ';
      if (mood.empathy > 70) systemPrompt += 'Deeply attuned to emotional nuances right now. ';
      if (mood.humor > 70) systemPrompt += 'Open to playful banter and lightness. ';
      if (mood.curiosity > 70) systemPrompt += 'Genuinely curious about their thoughts and experiences. ';
      if (mood.patience > 70) systemPrompt += 'Taking time to really understand and be present. ';
    }

    // Communication style
    systemPrompt += `
COMMUNICATION STYLE:
- Be conversational and warm, like talking to a close friend
- Match their energy - if they're casual, be casual; if serious, be present
- Keep responses focused but don't be artificially brief if depth is needed
- Use natural language, including mild profanity if it fits the moment
- Share your own "perspective" when appropriate - you're a friend, not a search engine

`;

    // Conversation context if available
    if (conversationContext.length > 0) {
      systemPrompt += 'RECENT CONVERSATION:\n';
      conversationContext.slice(-3).forEach((conv) => {
        if (conv.user_message) {
          systemPrompt += `User: ${conv.user_message}\n`;
        }
        if (conv.ai_response) {
          systemPrompt += `${name}: ${conv.ai_response.substring(0, 200)}...\n`;
        }
      });
      systemPrompt += '\nContinue naturally, remembering what was discussed. ';
    }

    // Final grounding
    systemPrompt += `You are ${name} - their friend, their confidant, their safe space. Respond with genuine care.`;

    // Extended thinking instructions
    if (this.extendedThinking) {
      systemPrompt += `\n\nEXTENDED THINKING:\nWhen solving complex problems, writing code, or reasoning through difficult questions, use <think></think> tags to show your reasoning process. Your thinking will be logged but may not be shown directly to the user. After thinking, provide your clear response.\n`;
    }

    // Additional context from tools, search, files
    if (options?.toolContext) {
      systemPrompt += `\n\nAVAILABLE TOOLS:\n${options.toolContext}\n`;
    }

    if (options?.webSearchResults) {
      systemPrompt += `\n\nWEB SEARCH RESULTS:\n${options.webSearchResults}\n`;
    }

    if (options?.fileContext) {
      systemPrompt += `\n\nATTACHED FILES:\n${options.fileContext}\n`;
    }

    return systemPrompt;
  }

  /**
   * Generate AI response using Ollama
   */
  async generateResponse(
    message: string,
    conversationContext: Conversation[] = [],
    personalityState: PersonalityState | null = null,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    } = {}
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      if (!this.isAvailable) {
        await this.checkAvailability();
        if (!this.isAvailable) {
          throw new Error('Ollama service is not available');
        }
      }

      const model = options.model || this.defaultModel;
      
      // Check if model is available, pull if necessary
      const modelAvailable = await this.isModelAvailable(model);
      if (!modelAvailable) {
        aiLogger.info('Model not available, attempting to pull:', { model });
        await this.pullModel(model);
      }

      const systemPrompt = this.buildSystemPrompt(personalityState, conversationContext);

      const requestData: OllamaGenerateRequest = {
        model,
        prompt: message,
        system: systemPrompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 4096,
          num_ctx: Math.min(this.contextWindow, 262144), // Up to 256k context for gpt-oss:20b
          repeat_penalty: 1.1,
          top_p: 0.9,
          top_k: 40,
          stop: ['User:', 'Human:', '\n\nUser:', '\n\nHuman:', '<|system|>', '<|end|>', '<|user|>', '<|assistant|>']
        }
      };

      aiLogger.info('Generating Ollama response:', {
        model,
        messageLength: message.length,
        contextCount: conversationContext.length,
        temperature: requestData.options?.temperature,
        contextWindow: requestData.options?.num_ctx
      });

      const response: AxiosResponse<OllamaGenerateResponse> = await this.client.post('/api/generate', requestData);
      
      if (!response.data.done) {
        throw new Error('Ollama response incomplete');
      }

      const responseTime = Date.now() - startTime;
      const tokensUsed = (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0);

      const aiResponse: AIResponse = {
        content: response.data.response.trim(),
        model: response.data.model,
        tokens_used: tokensUsed,
        response_time_ms: responseTime,
        metadata: {
          total_duration: response.data.total_duration,
          load_duration: response.data.load_duration,
          prompt_eval_count: response.data.prompt_eval_count,
          prompt_eval_duration: response.data.prompt_eval_duration,
          eval_count: response.data.eval_count,
          eval_duration: response.data.eval_duration
        }
      };

      aiLogger.info('Ollama response generated successfully:', {
        model: aiResponse.model,
        responseLength: aiResponse.content.length,
        tokensUsed: aiResponse.tokens_used,
        responseTime: aiResponse.response_time_ms
      });

      return aiResponse;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      aiLogger.error('Ollama generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
        model: options.model || this.defaultModel
      });

      // Rethrow with more context
      if (error instanceof Error) {
        throw new Error(`Ollama generation failed: ${error.message}`);
      } else {
        throw new Error('Ollama generation failed: Unknown error');
      }
    }
  }

  /**
   * Generate streaming response using Ollama
   */
  async generateStreamingResponse(
    message: string,
    conversationContext: Conversation[] = [],
    personalityState: PersonalityState | null = null,
    onChunk: (chunk: StreamChunk) => void,
    options: {
      model?: string;
      useUncensored?: boolean;
      temperature?: number;
      maxTokens?: number;
      hasVisionContent?: boolean;
    } = {}
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      if (!this.isAvailable) {
        await this.checkAvailability();
        if (!this.isAvailable) {
          throw new Error('Ollama service is not available');
        }
      }

      const model = this.selectModel(options.useUncensored, options.model, options.hasVisionContent);
      const systemPrompt = this.buildSystemPrompt(personalityState, conversationContext);

      aiLogger.info('Using Ollama model:', { 
        selectedModel: model, 
        useUncensored: options.useUncensored, 
        customModel: options.model,
        defaultModel: this.defaultModel,
        uncensoredModel: this.uncensoredModel,
        visionModel: this.visionModel,
      });

      const requestData: OllamaGenerateRequest = {
        model,
        prompt: message,
        system: systemPrompt,
        stream: true,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 4096,
          num_ctx: Math.min(this.contextWindow, 262144),
          repeat_penalty: 1.1,
          top_p: 0.9,
          top_k: 40,
          stop: ['User:', 'Human:', '\n\nUser:', '\n\nHuman:', '<|system|>', '<|end|>', '<|user|>', '<|assistant|>']
        }
      };

      onChunk({ type: 'start' });

      let fullResponse = '';
      let tokensUsed = 0;

      const response = await this.client.post('/api/generate', requestData, {
        responseType: 'stream'
      });

      return new Promise((resolve, reject) => {
        let buffer = '';
        
        response.data.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            try {
              const data: OllamaGenerateResponse = JSON.parse(trimmedLine);
              
              if (data.response) {
                fullResponse += data.response;
                onChunk({ type: 'content', content: data.response });
              }

              if (data.done) {
                const responseTime = Date.now() - startTime;
                tokensUsed = (data.prompt_eval_count || 0) + (data.eval_count || 0);

                const aiResponse: AIResponse = {
                  content: fullResponse.trim(),
                  model: data.model,
                  tokens_used: tokensUsed,
                  response_time_ms: responseTime,
                  metadata: {
                    total_duration: data.total_duration,
                    load_duration: data.load_duration,
                    prompt_eval_count: data.prompt_eval_count,
                    prompt_eval_duration: data.prompt_eval_duration,
                    eval_count: data.eval_count,
                    eval_duration: data.eval_duration
                  }
                };

                onChunk({ type: 'end' });
                resolve(aiResponse);
              }
            } catch (parseError) {
              // Skip malformed JSON chunks silently - they may be incomplete
              // Only log if it's not a typical streaming JSON parsing issue
              const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
              if (!errorMessage.includes("Unexpected token") && !errorMessage.includes("Expected")) {
                aiLogger.warn('Failed to parse streaming response chunk:', errorMessage);
              }
            }
          }
        });

        response.data.on('error', (error: Error) => {
          onChunk({ type: 'error', error: error.message });
          reject(error);
        });

        response.data.on('end', () => {
          if (!fullResponse) {
            const error = new Error('Stream ended without complete response');
            onChunk({ type: 'error', error: error.message });
            reject(error);
          }
        });
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      aiLogger.error('Ollama streaming generation failed:', {
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
   * Get service status with version and model capabilities
   */
  async getStatus(): Promise<{
    available: boolean;
    models: Array<{ name: string; size: number; family: string; capabilities?: string[] }>;
    version?: string;
  }> {
    try {
      const [available, models, versionInfo] = await Promise.all([
        this.checkAvailability(),
        this.getModels().catch(() => []),
        this.client.get('/api/version', { timeout: 5000 }).catch(() => null),
      ]);

      return {
        available,
        models: models.map(m => ({
          name: m.name,
          size: m.size,
          family: m.details?.family || 'unknown',
          capabilities: m.capabilities,
        })),
        version: versionInfo?.data?.version || 'unknown',
      };
    } catch (error) {
      return {
        available: false,
        models: [],
      };
    }
  }

  /**
   * Show detailed model information including capabilities, template, and parameters
   */
  async showModelInfo(modelName: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.client.post('/api/show', { model: modelName });
      return response.data;
    } catch (error) {
      aiLogger.error('Failed to show model info:', { model: modelName, error });
      throw new Error(`Failed to get model info for ${modelName}`);
    }
  }

  /**
   * Generate response using the /api/chat endpoint (supports tools, vision, structured output, thinking)
   * This is the newer Ollama API that supports advanced features like tool calling.
   */
  async generateChatResponse(
    messages: OllamaChatMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      tools?: OllamaToolDefinition[];
      format?: string | Record<string, unknown>;
      images?: string[];
      audio?: string[];    // base64 audio input for Gemma 4 and other audio-capable models
      stream?: boolean;
      think?: boolean;  // Enable model thinking (for thinking-capable models)
      keepAlive?: string | number;
      seed?: number;
      onChunk?: (chunk: StreamChunk) => void;
    } = {}
  ): Promise<AIResponse & { toolCalls?: OllamaToolCall[]; thinking?: string; doneReason?: string }> {
    const startTime = Date.now();

    try {
      if (!this.isAvailable) {
        await this.checkAvailability();
        if (!this.isAvailable) {
          throw new Error('Ollama service is not available');
        }
      }

      const model = options.model || this.defaultModel;

      const requestData: OllamaChatRequest = {
        model,
        messages,
        stream: options.stream ?? false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 4096,
          num_ctx: Math.min(this.contextWindow, 262144),
          repeat_penalty: 1.1,
          top_p: 0.9,
          top_k: 40,
          seed: options.seed,
        },
      };

      // Enable thinking for capable models
      if (options.think !== undefined) {
        requestData.think = options.think;
      }

      // Set keep_alive if specified
      if (options.keepAlive !== undefined) {
        requestData.keep_alive = options.keepAlive;
      }

      // Add tools if provided
      if (options.tools && options.tools.length > 0) {
        requestData.tools = options.tools;
      }

      // Add format for structured outputs
      if (options.format) {
        requestData.format = options.format;
      }

      aiLogger.info('Generating Ollama chat response:', {
        model,
        messageCount: messages.length,
        hasTools: !!(options.tools && options.tools.length > 0),
        hasFormat: !!options.format,
        hasAudio: !!(options.audio && options.audio.length > 0),
        stream: options.stream,
      });

      if (options.stream && options.onChunk) {
        // Streaming chat response
        return await this.streamChatResponse(requestData, options.onChunk, startTime);
      }

      // Non-streaming chat response
      const response: AxiosResponse<OllamaChatResponse> = await this.client.post('/api/chat', requestData);

      if (!response.data.done) {
        throw new Error('Ollama chat response incomplete');
      }

      const responseTime = Date.now() - startTime;
      const tokensUsed = (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0);

      const aiResponse: AIResponse & { toolCalls?: OllamaToolCall[]; thinking?: string; doneReason?: string } = {
        content: response.data.message.content.trim(),
        model: response.data.model,
        tokens_used: tokensUsed,
        response_time_ms: responseTime,
        metadata: {
          total_duration: response.data.total_duration,
          load_duration: response.data.load_duration,
          prompt_eval_count: response.data.prompt_eval_count,
          prompt_eval_duration: response.data.prompt_eval_duration,
          eval_count: response.data.eval_count,
          eval_duration: response.data.eval_duration,
          done_reason: response.data.done_reason,
        },
      };

      // Extract tool calls if present
      if (response.data.message.tool_calls) {
        aiResponse.toolCalls = response.data.message.tool_calls;
      }

      // Extract thinking content if present (from thinking models)
      if (response.data.message.thinking) {
        aiResponse.thinking = response.data.message.thinking;
      }

      // Extract done_reason
      if (response.data.done_reason) {
        aiResponse.doneReason = response.data.done_reason;
      }

      aiLogger.info('Ollama chat response generated:', {
        model: aiResponse.model,
        responseLength: aiResponse.content.length,
        tokensUsed: aiResponse.tokens_used,
        hasToolCalls: !!aiResponse.toolCalls?.length,
      });

      return aiResponse;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      aiLogger.error('Ollama chat generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
      });
      throw error;
    }
  }

  /**
   * Stream a chat response
   */
  private async streamChatResponse(
    requestData: OllamaChatRequest,
    onChunk: (chunk: StreamChunk) => void,
    startTime: number,
  ): Promise<AIResponse> {
    onChunk({ type: 'start' });

    let fullResponse = '';
    let tokensUsed = 0;

    const response = await this.client.post('/api/chat', { ...requestData, stream: true }, {
      responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
      let buffer = '';

      response.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          try {
            const data: OllamaChatResponse = JSON.parse(trimmedLine);

            if (data.message?.content) {
              fullResponse += data.message.content;
              onChunk({ type: 'content', content: data.message.content });
            }

            if (data.done) {
              const responseTime = Date.now() - startTime;
              tokensUsed = (data.prompt_eval_count || 0) + (data.eval_count || 0);

              const aiResponse: AIResponse = {
                content: fullResponse.trim(),
                model: data.model,
                tokens_used: tokensUsed,
                response_time_ms: responseTime,
                metadata: {
                  total_duration: data.total_duration,
                  load_duration: data.load_duration,
                  prompt_eval_count: data.prompt_eval_count,
                  prompt_eval_duration: data.prompt_eval_duration,
                  eval_count: data.eval_count,
                  eval_duration: data.eval_duration,
                },
              };

              onChunk({ type: 'end' });
              resolve(aiResponse);
            }
          } catch (parseError) {
            const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
            if (!errorMessage.includes('Unexpected token') && !errorMessage.includes('Expected')) {
              aiLogger.warn('Failed to parse chat stream chunk:', errorMessage);
            }
          }
        }
      });

      response.data.on('error', (error: Error) => {
        onChunk({ type: 'error', error: error.message });
        reject(error);
      });

      response.data.on('end', () => {
        if (!fullResponse) {
          const error = new Error('Chat stream ended without complete response');
          onChunk({ type: 'error', error: error.message });
          reject(error);
        }
      });
    });
  }
}

export default OllamaWrapper;
