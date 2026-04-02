import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import AIService from '../services/AIService';
import { ConversationManager } from '../services/ConversationManager';
import { ResourceOptimizer } from '../services/ResourceOptimizer';
import { EnhancedMemoryService } from '../services/EnhancedMemoryService';
import { sentimentMiddleware, createSentimentMiddleware, SentimentAnalyzer } from '../middleware/sentiment';
import { asyncHandler, createValidationError, createNotFoundError } from '../middleware/errorHandler';
import { endpointRateLimiter } from '../middleware/rateLimiter';
import { ChatRequest, ChatResponse, Conversation, StreamChunk } from '../types';
import { aiLogger, apiLogger } from '../utils/logger';
import { config } from '../config/settings';
import { v4 as uuidv4 } from 'uuid';

// Import new services
import { webSearchService } from '../services/WebSearchService';
import { toolExecutionService, ToolResult } from '../services/ToolExecutionService';
import { fileUploadService } from '../services/FileUploadService';
import { codeBlockService } from '../services/CodeBlockService';
import { extendedThinkingService } from '../services/ExtendedThinkingService';
import { messageLogService } from '../services/MessageLogService';

// Export a function that creates the router with dependencies
export default function createChatRoutes(db: DatabaseService, aiService: AIService): Router {
  const router = Router();

  // Initialize services for full context tracking
  const conversationManager = new ConversationManager(db);
  const sentimentAnalyzer = SentimentAnalyzer.getInstance(db);
  const resourceOptimizer = ResourceOptimizer.getInstance();
  const enhancedMemory = new EnhancedMemoryService(db);

  // Apply rate limiting to chat endpoints
  router.use(endpointRateLimiter('chat'));

  // Create sentiment middleware with database dependency
  const sentimentMiddlewareWithDB = createSentimentMiddleware(db);

  /**
   * Validate chat request
   */
  function validateChatRequest(body: any): ChatRequest {
    if (!body.message || typeof body.message !== 'string') {
      throw createValidationError('Message is required and must be a string');
    }

    if (body.message.trim().length === 0) {
      throw createValidationError('Message cannot be empty');
    }

  if (body.message.length > 10000) {
    throw createValidationError('Message too long (max 10,000 characters)');
  }

  if (body.session_id && typeof body.session_id !== 'string') {
    throw createValidationError('Session ID must be a string');
  }

  return {
    message: body.message.trim(),
    session_id: body.session_id || 'default',
    context: body.context || {},
    stream: body.stream === true,
    useUncensored: body.useUncensored === true
  };
}

/**
 * Parse tool calls from AI response content
 */
function parseToolCalls(content: string): Array<{ name: string; params: Record<string, unknown> }> {
  const toolCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const toolBlockRegex = /```tool\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = toolBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.tool && typeof parsed.tool === 'string') {
        toolCalls.push({ name: parsed.tool, params: parsed.params || {} });
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  return toolCalls;
}

/**
 * Process tool calls and build result context
 */
async function processToolCalls(
  toolCalls: Array<{ name: string; params: Record<string, unknown> }>,
  sessionId: string
): Promise<string> {
  if (toolCalls.length === 0) return '';

  let toolContext = '\n\nTool Results:\n';
  for (const call of toolCalls) {
    const result: ToolResult = await toolExecutionService.executeTool(call.name, call.params);
    toolContext += `\n**${call.name}**: ${result.output}\n`;

    // Log tool execution
    try {
      messageLogService.logToolExecution({
        sessionId,
        toolName: call.name,
        toolInput: call.params,
        toolOutput: result.data || result.output,
      });
    } catch (logError) {
      aiLogger.warn('Failed to log tool execution:', logError);
    }
  }
  return toolContext;
}

/**
 * Get conversation context for AI
 */
async function getConversationContext(sessionId: string, limit: number = 10): Promise<Conversation[]> {
  try {
    return await db.getConversationsBySession(sessionId, limit);
  } catch (error) {
    aiLogger.error('Failed to get conversation context:', error);
    return [];
  }
}

/**
 * Generate AI response using real AI integration
 */
async function generateAIResponse(
  message: string, 
  sessionId: string,
  context: Conversation[], 
  personalityState: any,
  streamCallback?: (chunk: StreamChunk) => void,
  useUncensored: boolean = true,
  additionalContext?: {
    webSearchResults?: string;
    fileContext?: string;
    toolContext?: string;
    attachmentIds?: string[];
  }
): Promise<{ content: string; model: string; tokens: number; responseTime: number; provider: string; thinking?: string }> {
  const startTime = Date.now();
  
  try {
    // Build enhanced message with additional context
    let enhancedMessage = message;

    // Prepend web search results if available
    if (additionalContext?.webSearchResults) {
      enhancedMessage = `[Web Search Results for context]\n${additionalContext.webSearchResults}\n\n[User Message]\n${message}`;
    }

    // Prepend file context if available
    if (additionalContext?.fileContext) {
      enhancedMessage = `${additionalContext.fileContext}\n\n${enhancedMessage}`;
    }

    // Prepend tool context
    if (additionalContext?.toolContext) {
      enhancedMessage = `${additionalContext.toolContext}\n\n${enhancedMessage}`;
    }

    // Log user message to message log DB
    try {
      messageLogService.logUserMessage({
        sessionId,
        content: message,
        attachments: additionalContext?.attachmentIds?.map(id => {
          const file = fileUploadService.getFile(id);
          return file ? { name: file.originalName, type: file.mimeType, size: file.size } : { name: id, type: 'unknown', size: 0 };
        }),
      });
    } catch (logError) {
      aiLogger.warn('Failed to log user message:', logError);
    }

    if (streamCallback) {
      // Use streaming AI generation
      const result = await aiService.generateStreamingResponse(
        enhancedMessage,
        sessionId,
        streamCallback,
        {
          useUncensored,
          temperature: 0.7,
          maxTokens: 4096
        }
      );

      // Parse extended thinking from response
      const thinkingResult = extendedThinkingService.parseThinkingFromResponse(result.response.content);
      const finalContent = thinkingResult.hasThinking ? thinkingResult.response : result.response.content;

      // Log assistant response to message log DB
      try {
        messageLogService.logAssistantResponse({
          sessionId,
          content: finalContent,
          thinking: thinkingResult.thinking?.content || null,
          thinkingDurationMs: thinkingResult.thinking?.durationMs,
          modelUsed: result.response.model,
          provider: result.provider as string,
          tokensInput: result.response.metadata?.prompt_eval_count as number || 0,
          tokensOutput: result.response.metadata?.eval_count as number || 0,
          tokensThinking: thinkingResult.thinking?.tokenCount || 0,
        });
      } catch (logError) {
        aiLogger.warn('Failed to log assistant response:', logError);
      }

      // Process code blocks in response
      let processedContent = finalContent;
      try {
        const processed = await codeBlockService.processResponse(finalContent, sessionId);
        if (processed.servedFiles.length > 0) {
          // Append download links to response
          processedContent += '\n\n📎 **Downloadable Files:**\n';
          for (const file of processed.servedFiles) {
            processedContent += `- [${file.filename}](${file.downloadUrl}) (${file.language})\n`;
          }
        }
      } catch (codeError) {
        aiLogger.warn('Code block processing failed:', codeError);
      }

      return {
        content: processedContent,
        model: result.response.model,
        tokens: result.response.tokens_used || 0,
        responseTime: result.response.response_time_ms || 0,
        provider: result.provider as string,
        thinking: thinkingResult.thinking?.content,
      };
    } else {
      // Use regular AI generation
      const result = await aiService.generateResponse(
        enhancedMessage,
        sessionId,
        {
          useUncensored,
          temperature: 0.7,
          maxTokens: 4096
        }
      );

      // Parse extended thinking
      const thinkingResult = extendedThinkingService.parseThinkingFromResponse(result.response.content);
      const finalContent = thinkingResult.hasThinking ? thinkingResult.response : result.response.content;

      // Log to message log DB
      try {
        messageLogService.logAssistantResponse({
          sessionId,
          content: finalContent,
          thinking: thinkingResult.thinking?.content || null,
          thinkingDurationMs: thinkingResult.thinking?.durationMs,
          modelUsed: result.response.model,
          provider: String(result.provider),
          tokensInput: result.response.metadata?.prompt_eval_count as number || 0,
          tokensOutput: result.response.metadata?.eval_count as number || 0,
          tokensThinking: thinkingResult.thinking?.tokenCount || 0,
        });
      } catch (logError) {
        aiLogger.warn('Failed to log assistant response:', logError);
      }

      // Process code blocks
      let processedContent = finalContent;
      try {
        const processed = await codeBlockService.processResponse(finalContent, sessionId);
        if (processed.servedFiles.length > 0) {
          processedContent += '\n\n📎 **Downloadable Files:**\n';
          for (const file of processed.servedFiles) {
            processedContent += `- [${file.filename}](${file.downloadUrl}) (${file.language})\n`;
          }
        }
      } catch (codeError) {
        aiLogger.warn('Code block processing failed:', codeError);
      }

      return {
        content: processedContent,
        model: result.response.model,
        tokens: result.response.tokens_used || 0,
        responseTime: result.response.response_time_ms || 0,
        provider: String(result.provider),
        thinking: thinkingResult.thinking?.content,
      };
    }

  } catch (error) {
    if (streamCallback) {
      streamCallback({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'AI generation failed'
      });
    }
    
    aiLogger.error('AI response generation failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId,
      messageLength: message.length,
      responseTime: Date.now() - startTime
    });
    
    throw error;
  }
}

/**
 * Save conversation to database with full context tracking
 */
async function saveConversation(
  sessionId: string,
  userMessage: string | null,
  aiResponse: string | null,
  sentimentData: any,
  contextTags: string[],
  tokensUsed: number,
  responseTime: number,
  model: string,
  provider: string = 'ollama'
): Promise<number> {
  // Record turn in ConversationManager for full context tracking
  if (userMessage && aiResponse) {
    await conversationManager.recordTurn(sessionId, userMessage, aiResponse, {
      sentimentScore: sentimentData?.score || 0,
      sentimentLabel: sentimentData?.label || 'neutral',
      tokensUsed,
      responseTimeMs: responseTime,
      modelUsed: model || 'unknown',
      provider,
      contextTags
    });
  }

  // Also save to database directly for immediate persistence
  return await db.insertConversation({
    session_id: sessionId,
    user_message: userMessage,
    ai_response: aiResponse,
    sentiment_score: sentimentData?.score || 0,
    sentiment_label: sentimentData?.label || 'neutral',
    context_tags: contextTags,
    message_type: 'chat',
    tokens_used: tokensUsed,
    response_time_ms: responseTime,
    model_used: model || 'unknown',
    timestamp: new Date().toISOString()
  });
}

/**
 * POST /chat - Send a chat message
 */
router.post('/', sentimentMiddlewareWithDB, asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Validate request
    const chatRequest = validateChatRequest(req.body);
    
    // Get sentiment analysis from middleware
    const sentimentAnalysis = (req as any).sentimentAnalysis;
    const updatedMood = (req as any).updatedMood;
    const contextTags = (req as any).contextTags || [];

    // Get conversation context
    const conversationContext = await getConversationContext(chatRequest.session_id!);
    
    // Get current personality state
    const personalityState = await db.getPersonalityState();

    aiLogger.info('Processing chat request', {
      sessionId: chatRequest.session_id,
      messageLength: chatRequest.message.length,
      sentiment: sentimentAnalysis?.label,
      contextCount: conversationContext.length,
      stream: chatRequest.stream
    });

    // Handle streaming response
    if (chatRequest.stream && config.ai.streamMode === 'sse') {
      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      let aiResponse = '';
      let responseMetadata: any = {};

      try {
        // Generate AI response with streaming
        const result = await generateAIResponse(
          chatRequest.message,
          chatRequest.session_id!,
          conversationContext,
          personalityState,
          (chunk: StreamChunk) => {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            if (chunk.type === 'content' && chunk.content) {
              aiResponse += chunk.content;
            }
          },
          chatRequest.useUncensored
        );

        responseMetadata = result;

        // Save conversation to database with full context tracking
        const conversationId = await saveConversation(
          chatRequest.session_id || 'default',
          chatRequest.message,
          aiResponse,
          sentimentAnalysis,
          contextTags,
          result.tokens,
          result.responseTime,
          result.model,
          result.provider
        );

        // Send end chunk to signal completion
        const endChunk: StreamChunk = {
          type: 'end'
        };
        res.write(`data: ${JSON.stringify(endChunk)}\n\n`);

        // Send final metadata
        const finalData = {
          type: 'metadata',
          conversationId,
          tokens: result.tokens,
          responseTime: result.responseTime,
          model: result.model,
          sentiment: sentimentAnalysis,
          mood: updatedMood
        };
        
        res.write(`data: ${JSON.stringify(finalData)}\n\n`);
        res.end();

        aiLogger.info('Streaming chat response completed', {
          sessionId: chatRequest.session_id,
          conversationId,
          responseLength: aiResponse.length,
          tokens: result.tokens,
          responseTime: result.responseTime
        });

      } catch (error) {
        const errorChunk: StreamChunk = {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
        res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
        res.end();
        throw error;
      }

    } else {
      // Non-streaming response
      const result = await generateAIResponse(
        chatRequest.message,
        chatRequest.session_id!,
        conversationContext,
        personalityState,
        undefined,
        chatRequest.useUncensored
      );

      // Save conversation to database with full context tracking
      const conversationId = await saveConversation(
        chatRequest.session_id!,
        chatRequest.message,
        result.content,
        sentimentAnalysis,
        contextTags,
        result.tokens,
        result.responseTime,
        result.model,
        result.provider
      );

      const totalTime = Date.now() - startTime;

      const response: ChatResponse = {
        response: result.content,
        session_id: chatRequest.session_id!,
        conversation_id: conversationId,
        model_used: result.model,
        tokens_used: result.tokens,
        response_time_ms: totalTime,
        sentiment: sentimentAnalysis,
        mood_update: updatedMood
      };

      aiLogger.info('Chat response completed', {
        sessionId: chatRequest.session_id,
        conversationId,
        responseLength: result.content.length,
        tokens: result.tokens,
        totalTime
      });

      res.json(response);
    }

  } catch (error) {
    aiLogger.error('Chat request failed:', error);
    throw error;
  }
}));

/**
 * GET /chat/history/:sessionId - Get conversation history
 */
router.get('/history/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  if (limit > 200) {
    throw createValidationError('Limit cannot exceed 200');
  }

  const conversations = await db.getConversationsBySession(sessionId, limit);

  res.json({
    session_id: sessionId,
    conversations: conversations.slice(offset),
    total: conversations.length,
    limit,
    offset
  });
}));

/**
 * GET /chat/search - Search conversations
 */
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const limit = parseInt(req.query.limit as string) || 20;

  if (!query || query.trim().length === 0) {
    throw createValidationError('Search query is required');
  }

  if (query.length < 3) {
    throw createValidationError('Search query must be at least 3 characters');
  }

  const results = await db.searchConversations(query.trim(), limit);

  res.json({
    query: query.trim(),
    results,
    total: results.length,
    limit
  });
}));

/**
 * DELETE /chat/history/:sessionId - Clear conversation history
 */
router.delete('/history/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;

  // Delete conversation history using database service
  const deletedCount = await db.deleteConversationHistory(sessionId);
  
  apiLogger.info('Conversation history deleted', {
    sessionId,
    deletedCount,
    requestedBy: req.ip
  });

  res.json({
    success: true,
    message: 'Conversation history cleared',
    session_id: sessionId,
    deleted_count: deletedCount,
    timestamp: new Date().toISOString()
  });
}));

/**
 * POST /chat/regenerate - Regenerate last AI response
 */
router.post('/regenerate', sentimentMiddlewareWithDB, asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.body.session_id || 'default';
  const conversationId = req.body.conversation_id;

  if (!conversationId) {
    throw createValidationError('Conversation ID is required for regeneration');
  }

  // Get the conversation to regenerate
  const conversations = await db.getConversationsBySession(sessionId, 10);
  const targetConversation = conversations.find(c => c.id === conversationId);

  if (!targetConversation || !targetConversation.user_message) {
    throw createNotFoundError('Conversation not found');
  }

  // Get conversation context (excluding the target conversation)
  const contextConversations = conversations.filter(c => c.id !== conversationId);
  
  // Get current personality state
  const personalityState = await db.getPersonalityState();

  // Ensure user_message is not null (we already checked above)
  const userMessage = targetConversation.user_message!;

  // Regenerate AI response
  const result = await generateAIResponse(
    userMessage,
    sessionId,
    contextConversations,
    personalityState,
    undefined,
    false // Default to censored for regeneration unless specified
  );

  // Update the conversation in the database (would need to implement update method)
  // For now, we'll create a new conversation entry
  const newConversationId = await saveConversation(
    sessionId,
    targetConversation.user_message,
    result.content,
    { score: targetConversation.sentiment_score, label: targetConversation.sentiment_label },
    targetConversation.context_tags,
    result.tokens,
    result.responseTime,
    result.model
  );

  aiLogger.info('Response regenerated', {
    originalConversationId: conversationId,
    newConversationId,
    sessionId
  });

  res.json({
    response: result.content,
    conversation_id: newConversationId,
    original_conversation_id: conversationId,
    session_id: sessionId,
    model_used: result.model,
    tokens_used: result.tokens,
    response_time_ms: result.responseTime
  });
}));

/**
 * GET /chat/stream - Server-Sent Events endpoint for streaming chat
 */
router.get('/stream', asyncHandler(async (req: Request, res: Response) => {
  const message = req.query.message as string;
  const sessionId = req.query.session_id as string || 'default';
  const useUncensored = req.query.useUncensored === 'true';

  if (!message || message.trim().length === 0) {
    throw createValidationError('Message is required');
  }

  if (message.length > 10000) {
    throw createValidationError('Message too long (max 10,000 characters)');
  }

  // Set up Server-Sent Events - FIXED headers for better compatibility
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': config.server.corsOrigin[0] || '*',
    'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  let conversationId: number;
  let aiResponse = '';

  try {
    aiLogger.info('Starting streaming chat response', {
      sessionId,
      messageLength: message.length
    });

    // Perform sentiment analysis on the user message
    const sentimentAnalysis = await sentimentAnalyzer.analyzeSentiment(message.trim());
    const contextTags = sentimentAnalyzer.generateContextTags(message.trim(), sentimentAnalysis);
    
    // Update mood based on sentiment
    await sentimentAnalyzer.updateMoodFromSentiment(sentimentAnalysis);

    // Get conversation context
    const conversationContext = await getConversationContext(sessionId);
    const personalityState = await db.getPersonalityState();

    // Send start event
    res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

    // Generate streaming response
    const result = await generateAIResponse(
      message.trim(),
      sessionId,
      conversationContext,
      personalityState,
      (chunk: StreamChunk) => {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (chunk.type === 'content' && chunk.content) {
          aiResponse += chunk.content;
        }
      },
      useUncensored
    );

    // Save conversation to database with sentiment analysis
    conversationId = await saveConversation(
      sessionId,
      message.trim(),
      aiResponse,
      { score: sentimentAnalysis.score, label: sentimentAnalysis.label },
      contextTags,
      result.tokens,
      result.responseTime,
      result.model
    );

    // Send final metadata including sentiment
    const metadata = {
      type: 'metadata',
      conversationId,
      tokens: result.tokens,
      responseTime: result.responseTime,
      model: result.model,
      sentiment: sentimentAnalysis
    };
    res.write(`data: ${JSON.stringify(metadata)}\n\n`);

    // Send end event
    res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
    res.end();

    aiLogger.info('Streaming response completed', {
      sessionId,
      conversationId,
      responseLength: aiResponse.length,
      tokens: result.tokens,
      sentiment: sentimentAnalysis.label
    });

  } catch (error) {
    aiLogger.error('Streaming response failed:', error);
    const errorChunk = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
    res.end();
  }
}));

/**
 * GET /chat/stats - Get chat statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  
  // Get database stats
  const dbStats = await db.getDatabaseStats();
  
  let sessionStats: {
    session_id: string;
    message_count: number;
    total_tokens: number;
    avg_response_time_ms: number;
    first_message: string | undefined;
    last_message: string | undefined;
  } | null = null;
  if (sessionId) {
    const conversations = await db.getConversationsBySession(sessionId);
    const totalTokens = conversations.reduce((sum, conv) => sum + (conv.tokens_used || 0), 0);
    const avgResponseTime = conversations.length > 0 ? 
      conversations.reduce((sum, conv) => sum + (conv.response_time_ms || 0), 0) / conversations.length : 0;
    
    sessionStats = {
      session_id: sessionId,
      message_count: conversations.length,
      total_tokens: totalTokens,
      avg_response_time_ms: Math.round(avgResponseTime),
      first_message: conversations[conversations.length - 1]?.timestamp,
      last_message: conversations[0]?.timestamp
    };
  }

  res.json({
    global: {
    total_conversations: dbStats.conversations,
    total_sessions: dbStats.sessions
  },
  session: sessionStats,
  timestamp: new Date().toISOString()
});
}));

/**
 * GET /chat/context/:sessionId - Get full context window for a session
 */
router.get('/context/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;
  const maxTokens = parseInt(req.query.maxTokens as string) || undefined;

  const contextWindow = await conversationManager.getConversationContext(sessionId, maxTokens);

  res.json({
    success: true,
    data: {
      sessionId,
      context: contextWindow,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * GET /chat/analytics/:sessionId - Get detailed session analytics
 */
router.get('/analytics/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;

  const analytics = await conversationManager.getSessionAnalytics(sessionId);

  res.json({
    success: true,
    data: analytics,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /chat/analytics/global - Get global analytics across all sessions
 */
router.get('/analytics/global', asyncHandler(async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;

  const analytics = await conversationManager.getGlobalAnalytics(days);

  res.json({
    success: true,
    data: analytics,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /chat/sessions/active - Get all active sessions
 */
router.get('/sessions/active', asyncHandler(async (req: Request, res: Response) => {
  const sessions = conversationManager.getActiveSessions();

  res.json({
    success: true,
    data: {
      sessions,
      count: sessions.length
    },
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /chat/resources - Get resource optimization status
 */
router.get('/resources', asyncHandler(async (req: Request, res: Response) => {
  const resourceStatus = conversationManager.getResourceStatus();
  const recommendations = resourceOptimizer.getOptimizationRecommendations();

  res.json({
    success: true,
    data: {
      ...resourceStatus,
      recommendations
    },
    timestamp: new Date().toISOString()
  });
}));

/**
 * POST /chat/flush - Force flush all pending data
 */
router.post('/flush', asyncHandler(async (req: Request, res: Response) => {
  await conversationManager.forceFlush();

  res.json({
    success: true,
    message: 'All pending data has been flushed',
    timestamp: new Date().toISOString()
  });
}));

// =============================================================================
// USER PREFERENCES & CROSS-SESSION MEMORY ENDPOINTS
// =============================================================================

/**
 * GET /chat/preferences - Get user memory preferences
 */
router.get('/preferences', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'default';
  
  const preferences = await enhancedMemory.getUserPreferences(userId);

  res.json({
    success: true,
    data: preferences,
    timestamp: new Date().toISOString()
  });
}));

/**
 * PUT /chat/preferences - Update user memory preferences
 */
router.put('/preferences', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.body.userId as string) || 'default';
  const {
    crossSessionEnabled,
    maxCrossSessionHistory,
    contextTokenLimit,
    maxContextMessages,
    autoSummarize,
    privacyLevel,
    summaryThreshold
  } = req.body;

  const updatedPrefs = await enhancedMemory.setUserPreferences(userId, {
    crossSessionEnabled,
    maxCrossSessionHistory,
    contextTokenLimit,
    maxContextMessages,
    autoSummarize,
    privacyLevel,
    summaryThreshold
  });

  apiLogger.info('User preferences updated', { userId, crossSessionEnabled });

  res.json({
    success: true,
    data: updatedPrefs,
    message: 'Preferences updated successfully',
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /chat/sessions/summaries - Get summaries of all past sessions
 */
router.get('/sessions/summaries', asyncHandler(async (req: Request, res: Response) => {
  const excludeSessionId = req.query.excludeSessionId as string;
  const limit = parseInt(req.query.limit as string) || 10;

  const summaries = await enhancedMemory.getSessionSummaries(excludeSessionId, limit);

  res.json({
    success: true,
    data: {
      summaries,
      count: summaries.length
    },
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /chat/search/all - Search across all sessions
 */
router.get('/search/all', asyncHandler(async (req: Request, res: Response) => {
  const query = req.query.q as string;
  
  if (!query || query.trim().length === 0) {
    throw createValidationError('Search query is required');
  }

  const excludeSessionId = req.query.excludeSessionId as string;
  const limit = parseInt(req.query.limit as string) || 50;
  const minRelevance = parseFloat(req.query.minRelevance as string) || 0.1;

  const results = await enhancedMemory.searchAllSessions(query, {
    excludeSessionId,
    limit,
    minRelevance
  });

  res.json({
    success: true,
    data: results,
    query,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /chat/context/full/:sessionId - Get full context window with cross-session support
 */
router.get('/context/full/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;
  const userId = req.query.userId as string || 'default';
  const includeCrossSession = req.query.crossSession !== 'false';
  const maxTokens = parseInt(req.query.maxTokens as string) || undefined;
  const query = req.query.query as string;

  const contextWindow = await enhancedMemory.getContextWindow(sessionId, maxTokens, {
    includeCrossSession,
    userId,
    query
  });

  res.json({
    success: true,
    data: {
      sessionId,
      contextWindow,
      crossSessionIncluded: includeCrossSession,
      config: {
        maxContextMessages: 1000,
        maxContextTokens: 128000,
        crossSessionTokenBudget: 32000
      }
    },
    timestamp: new Date().toISOString()
  });
}));

/**
 * POST /chat/preferences/toggle-cross-session - Quick toggle for cross-session access
 */
router.post('/preferences/toggle-cross-session', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.body.userId as string) || 'default';
  const enabled = req.body.enabled;

  if (typeof enabled !== 'boolean') {
    throw createValidationError('enabled must be a boolean');
  }

  const updatedPrefs = await enhancedMemory.setUserPreferences(userId, {
    crossSessionEnabled: enabled
  });

  apiLogger.info('Cross-session access toggled', { userId, enabled });

  res.json({
    success: true,
    data: {
      crossSessionEnabled: updatedPrefs.crossSessionEnabled
    },
    message: `Cross-session memory access ${enabled ? 'enabled' : 'disabled'}`,
    timestamp: new Date().toISOString()
  });
}));

return router;
}
