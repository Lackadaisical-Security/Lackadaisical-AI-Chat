/**
 * ModelManager - Hot-swappable model management service
 * Provides real-time model switching, registry management, and automatic fallback
 */

import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import { aiLogger } from '../utils/logger';
import { config } from '../config/settings';
import { AIProviderType } from '../types';

// Model information interface
export interface ModelInfo {
  id: string;
  name: string;
  provider: AIProviderType;
  displayName: string;
  description: string;
  contextLength: number;
  maxOutputTokens: number;
  capabilities: ModelCapability[];
  pricing?: {
    inputPer1kTokens: number;
    outputPer1kTokens: number;
    currency: string;
  };
  isLocal: boolean;
  isAvailable: boolean;
  lastChecked: Date;
  averageLatency?: number;
  successRate?: number;
  tags: string[];
  parameters?: {
    temperature?: { min: number; max: number; default: number };
    topP?: { min: number; max: number; default: number };
    topK?: { min: number; max: number; default: number };
  };
}

// Model capabilities
export type ModelCapability = 
  | 'chat'
  | 'completion'
  | 'code'
  | 'vision'
  | 'function_calling'
  | 'json_mode'
  | 'streaming'
  | 'embeddings'
  | 'uncensored'
  | 'reasoning'
  | 'multilingual';

// Ollama endpoint configuration
export interface OllamaEndpoint {
  id: string;
  name: string;
  url: string;
  type: 'local' | 'cloud' | 'custom';
  priority: number;
  isHealthy: boolean;
  lastHealthCheck: Date;
  models: string[];
  latency?: number;
  apiKey?: string; // For authenticated cloud endpoints
}

// Model switch event
export interface ModelSwitchEvent {
  previousModel: string | null;
  newModel: string;
  provider: AIProviderType;
  reason: 'user_request' | 'fallback' | 'load_balance' | 'health_check';
  timestamp: Date;
}

// Model performance metrics
interface ModelMetrics {
  modelId: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  totalLatency: number;
  averageLatency: number;
  lastUsed: Date;
  errorTypes: Map<string, number>;
}

export class ModelManager extends EventEmitter {
  private modelRegistry: Map<string, ModelInfo> = new Map();
  private ollamaEndpoints: Map<string, OllamaEndpoint> = new Map();
  private currentModel: string | null = null;
  private currentProvider: AIProviderType = 'ollama';
  private modelMetrics: Map<string, ModelMetrics> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private axiosInstances: Map<string, AxiosInstance> = new Map();

  // Default models for each provider
  private readonly defaultModels: Record<AIProviderType, string> = {
    ollama: 'gpt-oss:20b',
    openai: 'gpt-5.4',
    anthropic: 'claude-sonnet-4-6',
    google: 'gemini-3.1-flash',
    xai: 'grok-4-1-fast-reasoning'
  };

  constructor() {
    super();
    this.initializeRegistry();
    this.initializeOllamaEndpoints();
    this.startHealthChecks();
    aiLogger.info('ModelManager initialized');
  }

  /**
   * Initialize the model registry with known models
   */
  private initializeRegistry(): void {
    // ==================== OLLAMA MODELS ====================
    this.registerModel({
      id: 'gpt-oss:20b',
      name: 'gpt-oss:20b',
      provider: 'ollama',
      displayName: 'GPT-OSS 20B',
      description: 'OpenAI open-source reasoning model with 256k context, tool use, and extended thinking',
      contextLength: 262144,
      maxOutputTokens: 16384,
      capabilities: ['chat', 'completion', 'code', 'function_calling', 'streaming', 'reasoning'],
      isLocal: true,
      isAvailable: false,
      lastChecked: new Date(),
      tags: ['reasoning', 'local', 'flagship', 'open-source', 'tool-use']
    });

    this.registerModel({
      id: 'gemma4:e4b',
      name: 'gemma4:e4b',
      provider: 'ollama',
      displayName: 'Gemma 4 E4B (Vision)',
      description: 'Google Gemma 4 with vision capabilities for image understanding',
      contextLength: 131072,
      maxOutputTokens: 8192,
      capabilities: ['chat', 'completion', 'vision', 'streaming'],
      isLocal: true,
      isAvailable: false,
      lastChecked: new Date(),
      tags: ['vision', 'local', 'multimodal']
    });

    this.registerModel({
      id: 'lackadaisical-uncensored:latest',
      name: 'lackadaisical-uncensored',
      provider: 'ollama',
      displayName: 'Lackadaisical Uncensored',
      description: 'Custom uncensored model for unrestricted conversations',
      contextLength: 8192,
      maxOutputTokens: 4096,
      capabilities: ['chat', 'completion', 'streaming', 'uncensored'],
      isLocal: true,
      isAvailable: false,
      lastChecked: new Date(),
      tags: ['uncensored', 'local', 'custom']
    });

    this.registerModel({
      id: 'llama3.3:latest',
      name: 'llama3.3',
      provider: 'ollama',
      displayName: 'Llama 3.3',
      description: 'Meta Llama 3.3 for general conversation and coding',
      contextLength: 128000,
      maxOutputTokens: 4096,
      capabilities: ['chat', 'completion', 'code', 'streaming', 'reasoning'],
      isLocal: true,
      isAvailable: false,
      lastChecked: new Date(),
      tags: ['latest', 'local', 'reasoning']
    });

    this.registerModel({
      id: 'mistral:latest',
      name: 'mistral',
      provider: 'ollama',
      displayName: 'Mistral 7B',
      description: 'Efficient and capable Mistral model',
      contextLength: 32768,
      maxOutputTokens: 4096,
      capabilities: ['chat', 'completion', 'code', 'streaming'],
      isLocal: true,
      isAvailable: false,
      lastChecked: new Date(),
      tags: ['efficient', 'local']
    });

    this.registerModel({
      id: 'codellama:latest',
      name: 'codellama',
      provider: 'ollama',
      displayName: 'Code Llama',
      description: 'Specialized model for code generation',
      contextLength: 16384,
      maxOutputTokens: 4096,
      capabilities: ['chat', 'completion', 'code', 'streaming'],
      isLocal: true,
      isAvailable: false,
      lastChecked: new Date(),
      tags: ['code', 'local', 'specialized']
    });

    this.registerModel({
      id: 'phi4:latest',
      name: 'phi4',
      provider: 'ollama',
      displayName: 'Phi-4',
      description: 'Microsoft Phi-4 lightweight reasoning model',
      contextLength: 16384,
      maxOutputTokens: 4096,
      capabilities: ['chat', 'completion', 'code', 'streaming', 'reasoning'],
      isLocal: true,
      isAvailable: false,
      lastChecked: new Date(),
      tags: ['lightweight', 'local', 'reasoning']
    });

    // ==================== OPENAI MODELS ====================
    this.registerModel({
      id: 'gpt-5.4',
      name: 'gpt-5.4',
      provider: 'openai',
      displayName: 'GPT-5.4',
      description: 'OpenAI flagship model - top-tier reasoning, coding, and agentic workflows',
      contextLength: 400000,
      maxOutputTokens: 16384,
      capabilities: ['chat', 'completion', 'code', 'vision', 'function_calling', 'json_mode', 'streaming', 'reasoning'],
      pricing: { inputPer1kTokens: 0.005, outputPer1kTokens: 0.015, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.openai,
      lastChecked: new Date(),
      tags: ['flagship', 'cloud', 'reasoning', 'multimodal']
    });

    this.registerModel({
      id: 'gpt-5.4-mini',
      name: 'gpt-5.4-mini',
      provider: 'openai',
      displayName: 'GPT-5.4 Mini',
      description: 'Fast, cost-effective variant of GPT-5.4',
      contextLength: 400000,
      maxOutputTokens: 16384,
      capabilities: ['chat', 'completion', 'code', 'vision', 'function_calling', 'json_mode', 'streaming'],
      pricing: { inputPer1kTokens: 0.0005, outputPer1kTokens: 0.0015, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.openai,
      lastChecked: new Date(),
      tags: ['fast', 'cloud', 'budget']
    });

    this.registerModel({
      id: 'gpt-4.1',
      name: 'gpt-4.1',
      provider: 'openai',
      displayName: 'GPT-4.1',
      description: 'Long context model with up to 1M token window',
      contextLength: 1000000,
      maxOutputTokens: 32768,
      capabilities: ['chat', 'completion', 'code', 'vision', 'function_calling', 'json_mode', 'streaming'],
      pricing: { inputPer1kTokens: 0.002, outputPer1kTokens: 0.008, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.openai,
      lastChecked: new Date(),
      tags: ['long-context', 'cloud', 'multimodal']
    });

    this.registerModel({
      id: 'o4-mini',
      name: 'o4-mini',
      provider: 'openai',
      displayName: 'O4 Mini',
      description: 'Latest lightweight reasoning model for math, science, and multi-step logic',
      contextLength: 200000,
      maxOutputTokens: 65536,
      capabilities: ['chat', 'completion', 'code', 'function_calling', 'streaming', 'reasoning'],
      pricing: { inputPer1kTokens: 0.0011, outputPer1kTokens: 0.0044, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.openai,
      lastChecked: new Date(),
      tags: ['reasoning', 'cloud', 'budget']
    });

    this.registerModel({
      id: 'o3',
      name: 'o3',
      provider: 'openai',
      displayName: 'O3',
      description: 'Advanced balanced reasoning model',
      contextLength: 200000,
      maxOutputTokens: 65536,
      capabilities: ['chat', 'completion', 'code', 'function_calling', 'streaming', 'reasoning'],
      pricing: { inputPer1kTokens: 0.002, outputPer1kTokens: 0.008, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.openai,
      lastChecked: new Date(),
      tags: ['reasoning', 'cloud']
    });

    this.registerModel({
      id: 'gpt-4o',
      name: 'gpt-4o',
      provider: 'openai',
      displayName: 'GPT-4o (Legacy)',
      description: 'Multimodal model with vision and audio support',
      contextLength: 128000,
      maxOutputTokens: 4096,
      capabilities: ['chat', 'completion', 'code', 'vision', 'function_calling', 'json_mode', 'streaming'],
      pricing: { inputPer1kTokens: 0.0025, outputPer1kTokens: 0.01, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.openai,
      lastChecked: new Date(),
      tags: ['legacy', 'cloud', 'multimodal']
    });

    // ==================== ANTHROPIC MODELS ====================
    this.registerModel({
      id: 'claude-opus-4-6',
      name: 'claude-opus-4-6',
      provider: 'anthropic',
      displayName: 'Claude Opus 4.6',
      description: 'Anthropic flagship - deep reasoning, coding, agentic workflows (1M context)',
      contextLength: 1000000,
      maxOutputTokens: 128000,
      capabilities: ['chat', 'completion', 'code', 'vision', 'streaming', 'reasoning'],
      pricing: { inputPer1kTokens: 0.015, outputPer1kTokens: 0.075, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.anthropic,
      lastChecked: new Date(),
      tags: ['flagship', 'cloud', 'reasoning']
    });

    this.registerModel({
      id: 'claude-sonnet-4-6',
      name: 'claude-sonnet-4-6',
      provider: 'anthropic',
      displayName: 'Claude Sonnet 4.6',
      description: 'Balanced intelligence and speed - agents, coding, business workflows (1M context)',
      contextLength: 1000000,
      maxOutputTokens: 64000,
      capabilities: ['chat', 'completion', 'code', 'vision', 'streaming', 'reasoning'],
      pricing: { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.anthropic,
      lastChecked: new Date(),
      tags: ['balanced', 'cloud', 'agents']
    });

    this.registerModel({
      id: 'claude-haiku-4-5-20251001',
      name: 'claude-haiku-4-5',
      provider: 'anthropic',
      displayName: 'Claude Haiku 4.5',
      description: 'Fastest Claude - low-latency for high-volume tasks (200K context)',
      contextLength: 200000,
      maxOutputTokens: 64000,
      capabilities: ['chat', 'completion', 'code', 'vision', 'streaming'],
      pricing: { inputPer1kTokens: 0.001, outputPer1kTokens: 0.005, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.anthropic,
      lastChecked: new Date(),
      tags: ['fast', 'cloud', 'budget']
    });

    // ==================== GOOGLE MODELS ====================
    this.registerModel({
      id: 'gemini-3.1-pro',
      name: 'gemini-3.1-pro',
      provider: 'google',
      displayName: 'Gemini 3.1 Pro',
      description: 'Google flagship - top reasoning and 2M token context',
      contextLength: 2000000,
      maxOutputTokens: 32768,
      capabilities: ['chat', 'completion', 'code', 'vision', 'function_calling', 'streaming', 'reasoning'],
      pricing: { inputPer1kTokens: 0.00125, outputPer1kTokens: 0.005, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.google,
      lastChecked: new Date(),
      tags: ['flagship', 'cloud', 'long-context', 'reasoning']
    });

    this.registerModel({
      id: 'gemini-3.1-flash',
      name: 'gemini-3.1-flash',
      provider: 'google',
      displayName: 'Gemini 3.1 Flash',
      description: 'High-speed multimodal model for balanced intelligence and throughput',
      contextLength: 1000000,
      maxOutputTokens: 16384,
      capabilities: ['chat', 'completion', 'code', 'vision', 'function_calling', 'streaming'],
      pricing: { inputPer1kTokens: 0.000075, outputPer1kTokens: 0.0003, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.google,
      lastChecked: new Date(),
      tags: ['fast', 'cloud', 'multimodal']
    });

    this.registerModel({
      id: 'gemini-2.5-pro',
      name: 'gemini-2.5-pro',
      provider: 'google',
      displayName: 'Gemini 2.5 Pro',
      description: 'Highly capable agentic reasoning with 1M context',
      contextLength: 1000000,
      maxOutputTokens: 16384,
      capabilities: ['chat', 'completion', 'code', 'vision', 'function_calling', 'streaming', 'reasoning'],
      pricing: { inputPer1kTokens: 0.00125, outputPer1kTokens: 0.005, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.google,
      lastChecked: new Date(),
      tags: ['reasoning', 'cloud', 'agentic']
    });

    // ==================== XAI MODELS ====================
    this.registerModel({
      id: 'grok-4.20-beta',
      name: 'grok-4.20-beta',
      provider: 'xai',
      displayName: 'Grok 4.20 Beta',
      description: 'xAI flagship multi-agent model with 2M context and low hallucination',
      contextLength: 2000000,
      maxOutputTokens: 32768,
      capabilities: ['chat', 'completion', 'code', 'function_calling', 'streaming', 'reasoning'],
      pricing: { inputPer1kTokens: 0.002, outputPer1kTokens: 0.006, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.xai,
      lastChecked: new Date(),
      tags: ['flagship', 'cloud', 'multi-agent', 'reasoning']
    });

    this.registerModel({
      id: 'grok-4-1-fast-reasoning',
      name: 'grok-4-1-fast-reasoning',
      provider: 'xai',
      displayName: 'Grok 4.1 Fast (Reasoning)',
      description: 'Fast, cost-effective with 2M context and reasoning mode',
      contextLength: 2000000,
      maxOutputTokens: 16384,
      capabilities: ['chat', 'completion', 'code', 'function_calling', 'streaming', 'reasoning'],
      pricing: { inputPer1kTokens: 0.0002, outputPer1kTokens: 0.0005, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.xai,
      lastChecked: new Date(),
      tags: ['fast', 'cloud', 'reasoning', 'budget']
    });

    this.registerModel({
      id: 'grok-3',
      name: 'grok-3',
      provider: 'xai',
      displayName: 'Grok 3',
      description: 'Enterprise-grade reasoning and data extraction',
      contextLength: 131072,
      maxOutputTokens: 8192,
      capabilities: ['chat', 'completion', 'code', 'function_calling', 'streaming', 'reasoning'],
      pricing: { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.xai,
      lastChecked: new Date(),
      tags: ['enterprise', 'cloud', 'reasoning']
    });

    this.registerModel({
      id: 'grok-code-fast-1',
      name: 'grok-code-fast-1',
      provider: 'xai',
      displayName: 'Grok Code Fast',
      description: 'Optimized for agentic code workflows with 256K context',
      contextLength: 262144,
      maxOutputTokens: 16384,
      capabilities: ['chat', 'completion', 'code', 'function_calling', 'streaming'],
      pricing: { inputPer1kTokens: 0.0002, outputPer1kTokens: 0.0015, currency: 'USD' },
      isLocal: false,
      isAvailable: !!config.ai.apiKeys.xai,
      lastChecked: new Date(),
      tags: ['code', 'cloud', 'agentic']
    });

    aiLogger.info(`Model registry initialized with ${this.modelRegistry.size} models`);
  }

  /**
   * Initialize Ollama endpoints (local and cloud)
   */
  private initializeOllamaEndpoints(): void {
    // Local Ollama instance
    this.addOllamaEndpoint({
      id: 'local',
      name: 'Local Ollama',
      url: config.ai.ollamaHost,
      type: 'local',
      priority: 1,
      isHealthy: false,
      lastHealthCheck: new Date(),
      models: []
    });

    // Check for additional Ollama endpoints from environment
    const cloudEndpoints = process.env.OLLAMA_CLOUD_ENDPOINTS;
    if (cloudEndpoints) {
      try {
        const endpoints = JSON.parse(cloudEndpoints) as Array<{
          name: string;
          url: string;
          apiKey?: string;
        }>;
        
        endpoints.forEach((endpoint, index) => {
          this.addOllamaEndpoint({
            id: `cloud-${index}`,
            name: endpoint.name,
            url: endpoint.url,
            type: 'cloud',
            priority: 10 + index,
            isHealthy: false,
            lastHealthCheck: new Date(),
            models: [],
            apiKey: endpoint.apiKey
          });
        });
      } catch (error) {
        aiLogger.warn('Failed to parse OLLAMA_CLOUD_ENDPOINTS:', error);
      }
    }

    aiLogger.info(`Ollama endpoints initialized: ${this.ollamaEndpoints.size} endpoints`);
  }

  /**
   * Add an Ollama endpoint
   */
  addOllamaEndpoint(endpoint: OllamaEndpoint): void {
    this.ollamaEndpoints.set(endpoint.id, endpoint);
    
    // Create axios instance for this endpoint
    const instance = axios.create({
      baseURL: endpoint.url,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(endpoint.apiKey ? { 'Authorization': `Bearer ${endpoint.apiKey}` } : {})
      }
    });
    
    this.axiosInstances.set(endpoint.id, instance);
    this.emit('endpoint:added', endpoint);
  }

  /**
   * Remove an Ollama endpoint
   */
  removeOllamaEndpoint(endpointId: string): boolean {
    const removed = this.ollamaEndpoints.delete(endpointId);
    this.axiosInstances.delete(endpointId);
    if (removed) {
      this.emit('endpoint:removed', endpointId);
    }
    return removed;
  }

  /**
   * Register a new model
   */
  registerModel(model: ModelInfo): void {
    this.modelRegistry.set(model.id, model);
    this.emit('model:registered', model);
  }

  /**
   * Unregister a model
   */
  unregisterModel(modelId: string): boolean {
    const removed = this.modelRegistry.delete(modelId);
    if (removed) {
      this.emit('model:unregistered', modelId);
    }
    return removed;
  }

  /**
   * Get all registered models
   */
  getModels(): ModelInfo[] {
    return Array.from(this.modelRegistry.values());
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider: AIProviderType): ModelInfo[] {
    return this.getModels().filter(m => m.provider === provider);
  }

  /**
   * Get available models (health check passed)
   */
  getAvailableModels(): ModelInfo[] {
    return this.getModels().filter(m => m.isAvailable);
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): ModelInfo | undefined {
    return this.modelRegistry.get(modelId);
  }

  /**
   * Get current model
   */
  getCurrentModel(): { model: string | null; provider: AIProviderType } {
    return {
      model: this.currentModel,
      provider: this.currentProvider
    };
  }

  /**
   * Hot-swap to a different model
   */
  async switchModel(modelId: string, reason: ModelSwitchEvent['reason'] = 'user_request'): Promise<{
    success: boolean;
    previousModel: string | null;
    newModel: string;
    provider: AIProviderType;
    error?: string;
  }> {
    const previousModel = this.currentModel;
    const model = this.modelRegistry.get(modelId);

    if (!model) {
      return {
        success: false,
        previousModel,
        newModel: modelId,
        provider: this.currentProvider,
        error: `Model ${modelId} not found in registry`
      };
    }

    // Check if model is available
    if (!model.isAvailable) {
      // Try to make it available
      const available = await this.checkModelAvailability(modelId);
      if (!available) {
        return {
          success: false,
          previousModel,
          newModel: modelId,
          provider: model.provider,
          error: `Model ${modelId} is not available`
        };
      }
    }

    // Perform the switch
    this.currentModel = modelId;
    this.currentProvider = model.provider;

    const event: ModelSwitchEvent = {
      previousModel,
      newModel: modelId,
      provider: model.provider,
      reason,
      timestamp: new Date()
    };

    this.emit('model:switched', event);

    aiLogger.info('Model switched:', {
      from: previousModel,
      to: modelId,
      provider: model.provider,
      reason
    });

    return {
      success: true,
      previousModel,
      newModel: modelId,
      provider: model.provider
    };
  }

  /**
   * Check if a specific model is available
   */
  async checkModelAvailability(modelId: string): Promise<boolean> {
    const model = this.modelRegistry.get(modelId);
    if (!model) return false;

    try {
      if (model.provider === 'ollama') {
        // Check across all healthy Ollama endpoints
        for (const [endpointId, endpoint] of this.ollamaEndpoints) {
          if (!endpoint.isHealthy) continue;
          
          const instance = this.axiosInstances.get(endpointId);
          if (!instance) continue;

          try {
            const response = await instance.get('/api/tags', { timeout: 5000 });
            const models = response.data?.models || [];
            const available = models.some((m: any) => 
              m.name === model.name || m.name === modelId
            );
            
            if (available) {
              model.isAvailable = true;
              model.lastChecked = new Date();
              return true;
            }
          } catch (error) {
            // Continue to next endpoint
          }
        }
        model.isAvailable = false;
      } else {
        // For cloud providers, check if API key is configured
        model.isAvailable = this.isProviderConfigured(model.provider);
      }

      model.lastChecked = new Date();
      return model.isAvailable;
    } catch (error) {
      aiLogger.error(`Failed to check availability for model ${modelId}:`, error);
      model.isAvailable = false;
      model.lastChecked = new Date();
      return false;
    }
  }

  /**
   * Check if a provider is configured
   */
  private isProviderConfigured(provider: AIProviderType): boolean {
    switch (provider) {
      case 'ollama':
        return true;
      case 'openai':
        return !!config.ai.apiKeys.openai;
      case 'anthropic':
        return !!config.ai.apiKeys.anthropic;
      case 'google':
        return !!config.ai.apiKeys.google;
      case 'xai':
        return !!config.ai.apiKeys.xai;
      default:
        return false;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    // Check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000);

    // Initial check
    this.performHealthChecks();
  }

  /**
   * Perform health checks on all endpoints and models
   */
  async performHealthChecks(): Promise<void> {
    // Check Ollama endpoints
    for (const [endpointId, endpoint] of this.ollamaEndpoints) {
      await this.checkOllamaEndpointHealth(endpointId);
    }

    // Update model availability based on endpoint health
    for (const model of this.modelRegistry.values()) {
      if (model.provider === 'ollama') {
        await this.checkModelAvailability(model.id);
      }
    }

    this.emit('health:checked', {
      timestamp: new Date(),
      endpoints: Array.from(this.ollamaEndpoints.values()).map(e => ({
        id: e.id,
        name: e.name,
        isHealthy: e.isHealthy
      })),
      availableModels: this.getAvailableModels().map(m => m.id)
    });
  }

  /**
   * Check health of an Ollama endpoint
   */
  async checkOllamaEndpointHealth(endpointId: string): Promise<boolean> {
    const endpoint = this.ollamaEndpoints.get(endpointId);
    if (!endpoint) return false;

    const instance = this.axiosInstances.get(endpointId);
    if (!instance) return false;

    const startTime = Date.now();

    try {
      const response = await instance.get('/api/tags', { timeout: 5000 });
      
      if (response.status === 200) {
        endpoint.isHealthy = true;
        endpoint.latency = Date.now() - startTime;
        endpoint.models = (response.data?.models || []).map((m: any) => m.name);
        endpoint.lastHealthCheck = new Date();

        // Register any new models from this endpoint
        for (const modelData of response.data?.models || []) {
          if (!this.modelRegistry.has(modelData.name)) {
            this.registerModel({
              id: modelData.name,
              name: modelData.name.split(':')[0],
              provider: 'ollama',
              displayName: modelData.name,
              description: `${modelData.details?.family || 'Unknown'} model`,
              contextLength: 8192, // Default
              maxOutputTokens: 4096,
              capabilities: ['chat', 'completion', 'streaming'],
              isLocal: endpoint.type === 'local',
              isAvailable: true,
              lastChecked: new Date(),
              tags: [endpoint.type, modelData.details?.family || 'unknown'].filter(Boolean)
            });
          } else {
            // Update availability
            const existing = this.modelRegistry.get(modelData.name);
            if (existing) {
              existing.isAvailable = true;
              existing.lastChecked = new Date();
            }
          }
        }

        return true;
      }
    } catch (error) {
      endpoint.isHealthy = false;
      endpoint.lastHealthCheck = new Date();
      aiLogger.debug(`Ollama endpoint ${endpoint.name} is not healthy:`, 
        error instanceof Error ? error.message : 'Unknown error');
    }

    return false;
  }

  /**
   * Get the best available endpoint for Ollama
   */
  getBestOllamaEndpoint(): OllamaEndpoint | null {
    const healthyEndpoints = Array.from(this.ollamaEndpoints.values())
      .filter(e => e.isHealthy)
      .sort((a, b) => {
        // Sort by priority first, then by latency
        if (a.priority !== b.priority) return a.priority - b.priority;
        return (a.latency || Infinity) - (b.latency || Infinity);
      });

    return healthyEndpoints[0] || null;
  }

  /**
   * Get axios instance for the best Ollama endpoint
   */
  getOllamaClient(): AxiosInstance | null {
    const endpoint = this.getBestOllamaEndpoint();
    if (!endpoint) return null;
    return this.axiosInstances.get(endpoint.id) || null;
  }

  /**
   * Pull a model on an Ollama endpoint
   */
  async pullModel(modelName: string, endpointId?: string): Promise<{
    success: boolean;
    endpoint: string;
    error?: string;
  }> {
    const targetEndpoint = endpointId 
      ? this.ollamaEndpoints.get(endpointId)
      : this.getBestOllamaEndpoint();

    if (!targetEndpoint) {
      return {
        success: false,
        endpoint: endpointId || 'unknown',
        error: 'No healthy Ollama endpoint available'
      };
    }

    const instance = this.axiosInstances.get(targetEndpoint.id);
    if (!instance) {
      return {
        success: false,
        endpoint: targetEndpoint.id,
        error: 'No axios instance for endpoint'
      };
    }

    try {
      aiLogger.info(`Pulling model ${modelName} on ${targetEndpoint.name}`);
      
      const response = await instance.post('/api/pull', {
        name: modelName,
        stream: false
      }, { timeout: 600000 }); // 10 minute timeout for model pulls

      if (response.status === 200) {
        // Re-check health to update model list
        await this.checkOllamaEndpointHealth(targetEndpoint.id);
        
        return {
          success: true,
          endpoint: targetEndpoint.id
        };
      }
    } catch (error) {
      return {
        success: false,
        endpoint: targetEndpoint.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return {
      success: false,
      endpoint: targetEndpoint.id,
      error: 'Unknown error'
    };
  }

  /**
   * Record model usage metrics
   */
  recordUsage(modelId: string, success: boolean, latency: number, errorType?: string): void {
    let metrics = this.modelMetrics.get(modelId);
    
    if (!metrics) {
      metrics = {
        modelId,
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        totalLatency: 0,
        averageLatency: 0,
        lastUsed: new Date(),
        errorTypes: new Map()
      };
      this.modelMetrics.set(modelId, metrics);
    }

    metrics.requestCount++;
    metrics.totalLatency += latency;
    metrics.averageLatency = metrics.totalLatency / metrics.requestCount;
    metrics.lastUsed = new Date();

    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
      if (errorType) {
        metrics.errorTypes.set(errorType, (metrics.errorTypes.get(errorType) || 0) + 1);
      }
    }

    // Update model info with metrics
    const model = this.modelRegistry.get(modelId);
    if (model) {
      model.averageLatency = metrics.averageLatency;
      model.successRate = metrics.requestCount > 0 
        ? metrics.successCount / metrics.requestCount 
        : undefined;
    }
  }

  /**
   * Get metrics for a model
   */
  getMetrics(modelId: string): ModelMetrics | undefined {
    return this.modelMetrics.get(modelId);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): ModelMetrics[] {
    return Array.from(this.modelMetrics.values());
  }

  /**
   * Select the best model based on criteria
   */
  selectBestModel(criteria: {
    capabilities?: ModelCapability[];
    preferLocal?: boolean;
    maxLatency?: number;
    minSuccessRate?: number;
    provider?: AIProviderType;
  } = {}): ModelInfo | null {
    let candidates = this.getAvailableModels();

    // Filter by provider
    if (criteria.provider) {
      candidates = candidates.filter(m => m.provider === criteria.provider);
    }

    // Filter by capabilities
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      candidates = candidates.filter(m =>
        criteria.capabilities!.every(cap => m.capabilities.includes(cap))
      );
    }

    // Filter by local preference
    if (criteria.preferLocal) {
      const localModels = candidates.filter(m => m.isLocal);
      if (localModels.length > 0) {
        candidates = localModels;
      }
    }

    // Filter by latency
    if (criteria.maxLatency) {
      candidates = candidates.filter(m => 
        !m.averageLatency || m.averageLatency <= criteria.maxLatency!
      );
    }

    // Filter by success rate
    if (criteria.minSuccessRate) {
      candidates = candidates.filter(m =>
        !m.successRate || m.successRate >= criteria.minSuccessRate!
      );
    }

    // Sort by success rate, then latency
    candidates.sort((a, b) => {
      const aScore = (a.successRate || 1) * 100 - (a.averageLatency || 0) / 100;
      const bScore = (b.successRate || 1) * 100 - (b.averageLatency || 0) / 100;
      return bScore - aScore;
    });

    return candidates[0] || null;
  }

  /**
   * Get Ollama endpoints
   */
  getOllamaEndpoints(): OllamaEndpoint[] {
    return Array.from(this.ollamaEndpoints.values());
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.removeAllListeners();
    aiLogger.info('ModelManager destroyed');
  }
}

// Export singleton instance
export const modelManager = new ModelManager();
export default ModelManager;
