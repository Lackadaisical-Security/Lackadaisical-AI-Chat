# 🏗️ Architecture Documentation - Lackadaisical AI Chat v2-Alpha

This document provides a comprehensive overview of the Lackadaisical AI Chat system architecture, including design decisions, data flow, and component interactions.

## 🎯 System Overview

Lackadaisical AI Chat is a privacy-first, locally-running AI companion system built with a modular architecture that emphasizes:

- **Privacy by Design**: All data processing happens locally
- **Modular Components**: Loosely coupled services with clear interfaces
- **Extensible Plugin System**: Easy to add new capabilities
- **Persistent Memory**: Conversations and context preserved across sessions
- **Real-time Interaction**: Streaming responses and live updates
- **Hot-Swappable AI**: Switch between providers without restart (v2-alpha)
- **Emotional Intelligence**: Genuine human connection (v2-alpha)
- **Cross-Session Memory**: Reference past conversations (v2-alpha)

## 🔧 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              Lackadaisical AI Chat v2-Alpha                      │
│                    System Architecture                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   AI Providers  │
│   (React)       │    │   (Express)     │    │   (Hot-Swap)    │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Components  │ │◄──►│ │   Routes    │ │◄──►│ │   Ollama    │ │
│ │ Services    │ │    │ │ Controllers │ │    │ │   OpenAI    │ │
│ │ Store       │ │    │ │ Middleware  │ │    │ │ Anthropic   │ │
│ └─────────────┘ │    │ │    Auth     │ │    │ │   Google    │ │
│                 │    │ └─────────────┘ │    │ │     xAI     │ │
│ ┌─────────────┐ │    │                 │    │ └─────────────┘ │
│ │    Hooks    │ │    │ ┌─────────────┐ │    └─────────────────┘
│ │   Utils     │ │    │ │  Services   │ │
│ └─────────────┘ │    │ │ Database    │ │    ┌─────────────────┐
└─────────────────┘    │ │   Memory    │ │    │   Database      │
                       │ │Personality  │ │    │   (SQLite)      │
┌─────────────────┐    │ │   Plugins   │ │    │                 │
│   v2-Alpha      │    │ │ ModelMgr    │ │    │ ┌─────────────┐ │
│   Services      │    │ │ WebFetcher  │ │    │ │11+ Tables   │ │
│                 │    │ │ EmotionalAI │ │    │ │Indexes      │ │
│ ┌─────────────┐ │    │ │ SmartAssist │ │    │ │Migrations   │ │
│ │ModelManager │ │    │ └─────────────┘ │    │ └─────────────┘ │
│ │ WebFetcher  │ │    └─────────────────┘    └─────────────────┘
│ │EmotionalAI  │ │
│ │EnhancedMem  │ │    ┌─────────────────┐
│ │ResourceOpt  │ │    │   Plugin        │
│ │ConvoManager │ │    │   System        │
│ │SmartAssist  │ │    │ ┌─────────────┐ │
│ │HealthSvc   │ │    │ │  Weather    │ │
│ └─────────────┘ │    │ │ Horoscope   │ │
└─────────────────┘    │ │   Poem      │ │
                       │ │  Custom     │ │
                       │ └─────────────┘ │
                       └─────────────────┘
```

## 🆕 v2-Alpha Services

### ModelManager
Manages hot-swappable AI models across all providers.

```typescript
class ModelManager {
  // Model registry with 15+ pre-configured models
  registerModel(model: ModelConfig): void
  
  // Hot-swap to different model without restart
  switchModel(modelId: string, provider: string): Promise<void>
  
  // Auto-select best model by criteria
  selectBestModel(criteria: 'quality' | 'speed' | 'capability'): Model
  
  // Health checks every 30 seconds
  checkModelHealth(): Promise<HealthStatus[]>
}
```

### WebFetcher
Real-time web search and content extraction.

```typescript
class WebFetcher {
  // Multiple search providers
  search(query: string, provider?: 'duckduckgo' | 'brave' | 'serpapi'): Promise<SearchResult[]>
  
  // URL content extraction with metadata
  fetchUrl(url: string): Promise<PageContent>
  
  // Weather and time utilities
  getWeather(location: string): Promise<Weather>
  getTime(timezone: string): Promise<Time>
}
```

### EmotionalIntelligence
Genuine emotional support without restrictions.

```typescript
class EmotionalIntelligence {
  // Analyze emotional content
  analyzeEmotion(message: string): EmotionalContext
  
  // Generate supportive response
  generateSupport(emotion: Emotion, context: Context): SupportResponse
  
  // Learn user's emotional patterns
  learnPatterns(userId: string, interactions: Interaction[]): void
  
  // Remember significant moments
  recordSignificantMoment(moment: SignificantMoment): void
}
```

### EnhancedMemoryService
Cross-session memory with generous limits.

```typescript
class EnhancedMemoryService {
  // Generous limits
  MAX_MESSAGES = 1000
  MAX_TOKENS = 128_000
  CROSS_SESSION_BUDGET = 32_000
  
  // Cross-session features
  getSessionSummaries(): Promise<SessionSummary[]>
  searchAllSessions(query: string): Promise<SearchResult[]>
  buildCrossSessionContext(sessionId: string): Promise<Context>
  
  // User preferences
  getUserPreferences(): MemoryPreferences
  setUserPreferences(prefs: MemoryPreferences): void
}
```

### ResourceOptimizer
CPU/memory/disk load distribution.

```typescript
class ResourceOptimizer {
  // Monitor system resources
  getMetrics(): ResourceMetrics
  
  // Adaptive write batching
  queueWrite(data: any, priority: 'high' | 'normal' | 'low'): void
  
  // Optimization recommendations
  getRecommendations(): Recommendation[]
}
```

### ConversationManager
Complete conversation lifecycle management.

```typescript
class ConversationManager {
  // Session management
  createSession(name: string): Promise<Session>
  archiveSession(sessionId: string): Promise<void>
  
  // Turn recording with full context
  recordTurn(turn: ConversationTurn): Promise<void>
  
  // Analytics
  getSessionAnalytics(sessionId: string): Analytics
  getGlobalAnalytics(): GlobalAnalytics
}
```

### SmartAssistant
AI-powered conversation enhancement.

```typescript
class SmartAssistant {
  // Topic analysis
  analyzeTopics(messages: Message[]): Topic[]
  
  // Suggestions
  generateSuggestions(context: Context): Suggestion[]
  
  // User preference detection
  detectPreferences(interactions: Interaction[]): UserPreferences
}
```

## 🏛️ Architectural Patterns

### 1. Layered Architecture

The system follows a layered architecture pattern:

```
┌─────────────────────────────────────────┐
│           Presentation Layer            │  ← React Frontend
├─────────────────────────────────────────┤
│            API Layer                    │  ← Express Routes
├─────────────────────────────────────────┤
│          Business Logic Layer           │  ← Services
├─────────────────────────────────────────┤
│           Data Access Layer             │  ← Database Service
├─────────────────────────────────────────┤
│           Persistence Layer             │  ← SQLite Database
└─────────────────────────────────────────┘
```

**Benefits**:
- Clear separation of concerns
- Easy to test each layer independently
- Maintainable and scalable
- Well-defined interfaces between layers

### 2. Dependency Injection

Services are injected as dependencies to enable loose coupling:

```typescript
// Example of dependency injection pattern
class AIService {
  constructor(
    private database: DatabaseService,
    private memory: MemoryService,
    private personality: PersonalityService
  ) {}
}

// Routes receive dependencies
export function createChatRoutes(
  database: DatabaseService,
  aiService: AIService
): Router {
  // Route handlers use injected services
}
```

### 3. Repository Pattern

Database operations are abstracted through the repository pattern:

```typescript
interface IDatabaseAdapter {
  initialize(): Promise<void>;
  executeQuery<T>(query: string, params?: any[]): Promise<QueryResult<T>>;
  executeStatement(query: string, params?: any[]): Promise<QueryResult<void>>;
  transaction<T>(fn: () => T): () => T;
}

class DatabaseService implements IDatabaseAdapter {
  // Abstract database operations
  // Can swap SQLite for PostgreSQL without changing business logic
}
```

## 📊 Data Flow Architecture

### 1. Chat Message Flow

```
User Input → Frontend → API → Business Logic → AI Provider → Response
    ↓
Store in Database ← Memory Service ← Personality Update ← Context Analysis
    ↓
Update UI State ← Stream Response ← Format Response ← Process Response
```

**Detailed Flow**:

1. **User Input**: User types message in React frontend
2. **Frontend Processing**: 
   - Validate input
   - Update UI state (show loading)
   - Send API request
3. **API Layer**:
   - Route to chat controller
   - Apply middleware (rate limiting, logging)
   - Pass to business logic
4. **Business Logic**:
   - Memory Service: Retrieve conversation context
   - Personality Service: Get current mood/traits
   - AI Service: Generate response with context
5. **AI Provider**:
   - Send prompt to Ollama/external API
   - Receive streaming or complete response
6. **Response Processing**:
   - Analyze sentiment
   - Update personality state
   - Store conversation in database
   - Return formatted response
7. **Frontend Update**:
   - Stream response chunks to UI
   - Update conversation history
   - Clear loading state

### 2. Memory System Flow

```
Conversation Input → Context Extraction → Importance Scoring → Storage
                                    ↓
Memory Retrieval ← Context Window ← Relevance Filtering ← Query Processing
```

**Memory Processing**:

1. **Context Extraction**: Extract meaningful information from conversations
2. **Importance Scoring**: Rate information importance (0.0 - 1.0)
3. **Storage**: Store in memory_contexts table with metadata
4. **Retrieval**: Query relevant memories based on current context
5. **Context Window**: Compile memories into AI prompt context

### 3. Plugin System Flow

```
User Command → Command Parser → Plugin Router → Plugin Execution → Result Integration
                                     ↓
AI Response ← Format Result ← Process Output ← Plugin State Update
```

## 🗂️ Component Architecture

### Backend Services

#### 1. DatabaseService
**Responsibility**: Data persistence and retrieval

```typescript
class DatabaseService {
  private adapter: IDatabaseAdapter;
  
  // Core CRUD operations
  async insertConversation(conversation: Conversation): Promise<number>
  async getConversationsBySession(sessionId: string): Promise<Conversation[]>
  async searchConversations(term: string): Promise<Conversation[]>
  
  // Memory operations
  async addMemoryContext(context: MemoryContext): Promise<string>
  async getRelevantMemories(sessionId: string): Promise<MemoryContext[]>
  
  // Session management
  async createSession(name: string): Promise<string>
  async updateSessionActivity(sessionId: string): Promise<void>
}
```

**Key Features**:
- Database abstraction (SQLite, PostgreSQL, MySQL ready)
- Prepared statements for security
- Transaction support
- Connection pooling ready
- Migration system

#### 2. AIService
**Responsibility**: AI provider management and response generation

```typescript
class AIService {
  private providers: Map<string, AIProvider>;
  
  async generateResponse(request: ChatRequest): Promise<AIResponse>
  async streamResponse(request: ChatRequest): AsyncGenerator<StreamChunk>
  private buildPrompt(message: string, context: Context): string
  private selectProvider(preferences: AIPreferences): AIProvider
}
```

**Provider Abstraction**:
- Uniform interface for all AI providers
- Automatic failover between providers
- Response streaming support
- Token usage tracking

#### 3. MemoryService
**Responsibility**: Conversation context and long-term memory

```typescript
class MemoryService {
  async addContext(sessionId: string, context: MemoryContext): Promise<void>
  async getContextWindow(sessionId: string, maxTokens: number): Promise<string>
  async extractImportantInfo(conversation: Conversation): Promise<MemoryContext[]>
  private calculateImportance(content: string): number
}
```

**Memory Types**:
- Personal details (name, preferences, goals)
- Emotional states and patterns
- Important events and milestones
- User interests and hobbies
- Conversation summaries

#### 4. PersonalityService
**Responsibility**: AI personality and mood management

```typescript
class PersonalityService {
  async getPersonalityState(): Promise<PersonalityState>
  async updateMood(moodUpdate: MoodUpdate): Promise<void>
  async generatePersonalityPrompt(): Promise<string>
  private evolveTrait(trait: string, influence: number): number
}
```

**Personality Dimensions**:
- Static traits (helpful, curious, empathetic)
- Dynamic mood (cheerful, contemplative, energetic)
- Skill levels (empathy, humor, patience)
- Adaptation based on user interactions

### Frontend Architecture

#### 1. State Management (Zustand)

```typescript
interface AppStore {
  // Chat state
  messages: Message[];
  currentSession: string;
  isStreaming: boolean;
  
  // UI state
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  
  // Actions
  sendMessage: (message: string) => Promise<void>;
  switchSession: (sessionId: string) => void;
  updateSettings: (settings: Partial<Settings>) => void;
}
```

**Store Organization**:
- Flat state structure for performance
- Actions co-located with state
- Computed values with selectors
- Persistence layer for settings

#### 2. Component Hierarchy

```
App
├── Sidebar
│   ├── SessionList
│   ├── PluginPanel
│   └── SettingsPanel
├── MainContent
│   ├── ChatArea
│   │   ├── MessageList
│   │   │   └── MessageBubble
│   │   └── InputArea
│   ├── JournalView
│   └── AnalyticsView
└── Modals
    ├── SessionCreateModal
    └── SettingsModal
```

**Component Patterns**:
- Container/Presenter separation
- Custom hooks for business logic
- Compound components for complex UI
- Render props for shared behavior

#### 3. API Client Architecture

```typescript
class ApiService {
  private baseURL: string;
  private client: AxiosInstance;
  
  // HTTP methods with error handling
  private async request<T>(config: RequestConfig): Promise<ApiResponse<T>>
  
  // Domain-specific methods
  async sendMessage(message: string, sessionId?: string): Promise<Message>
  async streamMessage(message: string): Promise<ReadableStream>
  async getSessions(): Promise<Session[]>
}
```

**Features**:
- Centralized error handling
- Request/response interceptors
- Automatic retry logic
- Response caching
- TypeScript interfaces

## 🔌 Plugin Architecture

### Plugin Interface

```typescript
interface Plugin {
  name: string;
  version: string;
  description: string;
  author: string;
  
  initialize(context: PluginContext): Promise<void>;
  execute(command: string, args: string[], context: PluginContext): Promise<PluginResult>;
  cleanup(): Promise<void>;
  
  getCommands(): string[];
  getDescription(): string;
}
```

### Plugin System Components

1. **PluginLoader**: Dynamically loads and initializes plugins
2. **PluginManager**: Manages plugin lifecycle and state
3. **CommandParser**: Routes user commands to appropriate plugins
4. **PluginContext**: Provides plugins access to system services

### Plugin Communication

```
User Command → Command Parser → Plugin Router → Plugin Execution
                                       ↓
System Services ← Plugin Context ← Permission Check ← Plugin Validation
```

**Security**:
- Sandboxed execution environment
- Permission-based access control
- Resource usage monitoring
- Input/output validation

## 🗄️ Database Architecture

### Schema Design

The database uses a normalized relational design with 11 core tables:

#### Core Tables

1. **conversations** - Message storage and metadata
2. **sessions** - Conversation session management
3. **memory_contexts** - Long-term memory storage
4. **personality_state** - AI personality tracking

#### Supporting Tables

5. **journal_entries** - User journal system
6. **memory_tags** - Memory categorization
7. **conversation_tags** - Message tagging system
8. **learning_data** - User feedback and preferences
9. **plugin_states** - Plugin configuration
10. **training_data** - Custom model training
11. **mood_snapshots** - Historical personality tracking

### Indexing Strategy

```sql
-- Performance indexes
CREATE INDEX idx_conversations_session_timestamp ON conversations(session_id, timestamp);
CREATE INDEX idx_memory_contexts_importance ON memory_contexts(importance_score DESC);
CREATE INDEX idx_journal_entries_created ON journal_entries(created_at DESC);

-- Search indexes
CREATE INDEX idx_conversations_text ON conversations(user_message, ai_response);
CREATE INDEX idx_memory_contexts_content ON memory_contexts(content);
```

**Index Benefits**:
- Fast conversation history retrieval
- Efficient memory searches
- Quick session switching
- Optimized analytics queries

### Data Relationships

```
sessions (1) ──────────────── (many) conversations
    │                                    │
    │                                    │
    └─────── (many) memory_contexts      │
                    │                    │
                    └── (many) memory_tags
                                         │
                              conversation_tags (many) ────┘

personality_state (1) ──── (many) mood_snapshots

sessions (1) ─────────── (many) journal_entries
```

## 🔄 Communication Patterns

### 1. Request-Response (REST)

Standard HTTP REST API for CRUD operations:

```
Frontend → HTTP Request → Express Router → Controller → Service → Database
Frontend ← HTTP Response ← JSON Serializer ← Business Logic ← Data Layer
```

### 2. Server-Sent Events (SSE)

Real-time streaming for AI responses:

```
Frontend → EventSource Connection → Express SSE Route → AI Service
Frontend ← Stream Chunks ← SSE Response ← AI Provider Response
```

### 3. Plugin Communication

Event-driven plugin system:

```
User Command → Event Emitter → Plugin Registry → Plugin Handler
System Response ← Result Formatter ← Plugin Response ← Plugin Execution
```

## 🛡️ Security Architecture

### 1. Data Privacy

- **Local-First**: All sensitive data stored locally
- **Encryption**: Optional database encryption with AES-256
- **No Telemetry**: Zero data collection or external transmission
- **User Control**: Complete data ownership and export

### 2. Input Validation

```typescript
// Example validation pipeline
const validateChatMessage = (input: unknown): ChatMessage => {
  const schema = Joi.object({
    message: Joi.string().min(1).max(10000).required(),
    sessionId: Joi.string().uuid().optional()
  });
  
  const { error, value } = schema.validate(input);
  if (error) throw new ValidationError(error.message);
  
  return value as ChatMessage;
};
```

### 3. Rate Limiting

```typescript
// Rate limiting middleware
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
```

### 4. Error Handling

```typescript
// Centralized error handling
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
  }
}

// Global error handler
app.use((error: AppError, req: Request, res: Response, next: NextFunction) => {
  logger.error('Application error:', error);
  
  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message
    }
  });
});
```

## 📈 Performance Architecture

### 1. Database Optimization

- **Connection Pooling**: Reuse database connections
- **Prepared Statements**: Pre-compiled SQL queries
- **Query Optimization**: Efficient indexing and query patterns
- **Pagination**: Limit result sets for large datasets

### 2. Memory Management

```typescript
// Memory context window management
class MemoryService {
  private readonly MAX_CONTEXT_TOKENS = 4000;
  
  async getContextWindow(sessionId: string): Promise<string> {
    const memories = await this.getRelevantMemories(sessionId);
    const sortedMemories = memories.sort((a, b) => b.importance - a.importance);
    
    let context = '';
    let tokenCount = 0;
    
    for (const memory of sortedMemories) {
      const memoryTokens = this.estimateTokens(memory.content);
      if (tokenCount + memoryTokens > this.MAX_CONTEXT_TOKENS) break;
      
      context += memory.content + '\n';
      tokenCount += memoryTokens;
    }
    
    return context;
  }
}
```

### 3. Frontend Performance

- **Code Splitting**: Lazy load routes and components
- **Virtual Scrolling**: Handle large message lists
- **Debounced Input**: Reduce API calls for real-time features
- **Optimistic Updates**: Update UI before API confirmation

### 4. Caching Strategy

```typescript
// In-memory caching for frequently accessed data
class CacheService {
  private cache = new LRU<string, any>({ max: 1000, ttl: 1000 * 60 * 10 }); // 10 min TTL
  
  async get<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached) return cached;
    
    const value = await factory();
    this.cache.set(key, value);
    return value;
  }
}
```

## 🔮 Scalability Considerations

### 1. Horizontal Scaling

**Current Architecture**: Single-instance local deployment

**Future Scaling Options**:
- Multi-user support with user isolation
- Distributed database (PostgreSQL cluster)
- Microservices decomposition
- Container orchestration (Kubernetes)

### 2. Plugin Ecosystem

**Plugin Registry**: Centralized plugin marketplace
```typescript
interface PluginRegistry {
  search(query: string): Promise<PluginInfo[]>;
  install(pluginId: string): Promise<void>;
  update(pluginId: string): Promise<void>;
  uninstall(pluginId: string): Promise<void>;
}
```

### 3. AI Provider Scaling

**Load Balancing**: Distribute requests across multiple AI providers
```typescript
class LoadBalancer {
  private providers: AIProvider[] = [];
  private currentIndex = 0;
  
  getNextProvider(): AIProvider {
    const provider = this.providers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.providers.length;
    return provider;
  }
}
```

## 🎯 Design Decisions

### 1. Why SQLite?

**Pros**:
- Zero configuration setup
- File-based (easy backup and portability)
- Excellent performance for single-user scenarios
- ACID compliance
- Wide platform support

**Cons**:
- Limited concurrent write access
- Not suitable for multi-user scenarios
- File size limitations (though very high)

**Decision**: Perfect for privacy-first, local-only architecture

### 2. Why Express.js?

**Pros**:
- Mature and stable ecosystem
- Flexible middleware system
- Excellent TypeScript support
- Large community and documentation
- Easy to extend and customize

**Alternatives Considered**:
- Fastify (performance)
- Koa.js (modern async/await)
- NestJS (enterprise features)

**Decision**: Express provides the best balance of simplicity and functionality

### 3. Why React + Zustand?

**React Pros**:
- Component-based architecture
- Excellent ecosystem
- Strong TypeScript integration
- Wide community support

**Zustand Pros**:
- Lightweight (2.2kb)
- No boilerplate
- TypeScript-first
- DevTools support
- Easy testing

**Alternatives Considered**:
- Redux Toolkit (more complex)
- Jotai (atomic state)
- Valtio (proxy-based)

**Decision**: Best combination of simplicity and power

### 4. Why TypeScript?

**Benefits**:
- Type safety and error prevention
- Better IDE support and autocomplete
- Self-documenting code
- Easier refactoring
- Improved team collaboration

**Trade-offs**:
- Slightly longer development time
- Learning curve for team members
- Additional build step

**Decision**: Type safety is crucial for a complex system with multiple components

## 📚 Future Architecture Evolution

### Phase 1: Enhanced Privacy (v1.1)
- Database encryption at rest
- Optional cloud backup with E2E encryption
- Advanced privacy controls
- Audit logging

### Phase 2: Multi-User Support (v1.2)
- User authentication and authorization
- Per-user data isolation
- Shared conversation spaces
- Admin management interface

### Phase 3: Distributed Architecture (v2.0)
- Microservices decomposition
- Event-driven architecture
- API gateway
- Service mesh

### Phase 4: AI Enhancement (v2.1)
- Custom model training
- Federated learning
- Advanced reasoning capabilities
- Multi-modal interactions (voice, images)

## ✅ v2-Alpha Architecture Changes

The following architectural changes were made in v2-alpha:

### New Services Added
- **ModelManager**: Hot-swappable AI model management
- **WebFetcher**: Real-time web search and content extraction
- **EmotionalIntelligence**: Unrestricted emotional support
- **EnhancedMemoryService**: Cross-session memory with 128K token context
- **ConversationManager**: Complete conversation lifecycle
- **ResourceOptimizer**: CPU/memory/disk load balancing
- **SmartAssistant**: AI-powered conversation enhancement
- **HealthService**: Multi-service health monitoring

### Authentication Layer
- JWT-based authentication with access/refresh tokens
- Rate limiting middleware (rate-limiter-flexible)
- Auth routes with bcrypt password hashing

### Memory System Upgrades
- Max messages: 50 → 1000
- Max tokens: 8K → 128K
- Cross-session token budget: 32K
- Adaptive write batching based on system load

### AI Provider Integration
- 5 providers: Ollama, OpenAI, Anthropic, Google, xAI
- Hot-swap without restart
- Automatic failover
- Health monitoring

## 🤝 Contributing to Architecture

We welcome architectural discussions and improvements:

1. **Create RFC (Request for Comments)** for major changes
2. **Discuss in GitHub Issues** for smaller improvements
3. **Join Discord** for real-time architecture discussions
4. **Review Pull Requests** that affect system architecture

### Architecture Decision Records (ADRs)

We maintain decision records for major architectural choices:

- ADR-001: Database Choice (SQLite vs PostgreSQL)
- ADR-002: State Management (Zustand vs Redux)
- ADR-003: AI Provider Architecture
- ADR-004: Plugin System Design
- ADR-005: Hot-Swap Model Management (v2-alpha)
- ADR-006: Cross-Session Memory Architecture (v2-alpha)
- ADR-007: Emotional Intelligence Design (v2-alpha)

---

This architecture documentation is a living document that evolves with the system. Please help us keep it current by submitting updates and improvements.

**Last Updated**: February 2026  
**Architecture Version**: 2.0-alpha  
**System Version**: 2.0.0-rc1
