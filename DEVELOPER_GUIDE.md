# 🛠️ Developer Guide - Lackadaisical AI Chat

Welcome to the Lackadaisical AI Chat development guide! This document will help you understand the codebase, set up your development environment, and contribute effectively to the project.

## 📋 Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Project Architecture](#project-architecture)
- [Core Services](#core-services)
- [Database Schema](#database-schema)
- [API Development](#api-development)
- [Frontend Development](#frontend-development)
- [Plugin Development](#plugin-development)
- [Testing Guide](#testing-guide)
- [Deployment](#deployment)
- [Best Practices](#best-practices)

## 🚀 Development Environment Setup

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher  
- **Git**: For version control
- **Ollama**: (Optional) For local AI models
- **VS Code**: (Recommended) With suggested extensions

### Quick Setup

1. **Clone and Run Setup**
   ```bash
   git clone https://github.com/Lackadaisical-Security/Lackadaisical-AI-Chat.git
   cd Lackadaisical-AI-Chat
   
   # Option A: Use the setup script (recommended — handles deps, env, db)
   chmod +x setup-lackadaisical-ai.sh
   ./setup-lackadaisical-ai.sh
   
   # Option B: Manual steps
   npm run install:all
   cp env.example backend/.env
   npm run init:db
   ```

2. **Environment Configuration**
   ```bash
   # Edit backend/.env with your configuration (created by setup script)
   # At minimum, change JWT_SECRET and SESSION_SECRET for production
   ```

3. **Start Development Servers**
   ```bash
   npm run dev
   ```

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "christian-kohler.path-intellisense"
  ]
}
```

## 🏗️ Project Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                 Lackadaisical AI Chat                   │
│                   System Architecture                   │
└─────────────────────────────────────────────────────────┘

Frontend (React)              Backend (Express)
├── Components                ├── Routes
├── Services (API)            ├── Services
├── Store (Zustand)           ├── Middleware  
├── Hooks                     ├── Utils
└── Types                     └── Database

                Database (SQLite)
                ├── 11 Core Tables
                ├── Indexes
                └── Migrations
```

### Directory Structure

```
lackadaisical-ai-chat/
├── backend/                  # Express.js backend
│   ├── src/
│   │   ├── index.ts         # Server entry point
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic services
│   │   ├── middleware/      # Express middleware
│   │   ├── types/           # TypeScript type definitions
│   │   └── utils/           # Utility functions
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── services/        # API client and utilities
│   │   ├── store/           # Zustand state management
│   │   ├── hooks/           # Custom React hooks
│   │   └── types/           # TypeScript type definitions
│   ├── package.json
│   └── vite.config.ts
├── ai/                      # AI provider adapters
│   ├── ollama/              # Ollama integration
│   └── externalProviders/   # External AI providers
├── config/                  # Configuration files
├── database/                # SQLite database files
├── plugins/                 # Plugin system
├── scripts/                 # Utility scripts
└── docs/                    # Documentation
```

## 🔧 Core Services

### DatabaseService

The `DatabaseService` is the central data access layer that handles all database operations.

**Location**: `backend/src/services/DatabaseService.ts`

**Key Features**:
- SQLite adapter with better-sqlite3
- Prepared statements for security
- Transaction support
- Migration system
- Connection pooling ready

**Usage Example**:
```typescript
import { DatabaseService } from '../services/DatabaseService';

const database = new DatabaseService();
await database.initialize();

// Insert a conversation
const conversationId = await database.insertConversation({
  session_id: 'default',
  user_message: 'Hello',
  ai_response: 'Hi there!',
  timestamp: new Date().toISOString(),
  // ... other fields
});
```

### AIService

Manages AI providers and response generation.

**Location**: `backend/src/services/AIService.ts`

**Supported Providers**:
- Ollama (local)
- OpenAI GPT models
- Anthropic Claude
- Google Gemini
- xAI Grok

**Usage Example**:
```typescript
import { AIService } from '../services/AIService';

const aiService = new AIService(databaseService);

const response = await aiService.generateResponse({
  message: 'Hello!',
  sessionId: 'default',
  options: {
    model: 'llama2',
    temperature: 0.7,
    maxTokens: 1000
  }
});
```

### MemoryService

Handles conversation context and long-term memory.

**Location**: `backend/src/services/MemoryService.ts`

**Features**:
- Context window management
- Memory importance scoring
- Automatic summarization
- Personal detail extraction

**Usage Example**:
```typescript
import { MemoryService } from '../services/MemoryService';

const memoryService = new MemoryService(databaseService);

// Add memory context
await memoryService.addContext(sessionId, {
  type: 'personal_detail',
  content: 'User likes hiking',
  importance: 0.8
});

// Get context for AI
const context = await memoryService.getContextWindow(sessionId, 4000);
```

### PersonalityService

Manages AI personality traits and mood.

**Location**: `backend/src/services/PersonalityService.ts`

**Features**:
- Dynamic personality traits
- Mood tracking and evolution
- Empathy level adjustment
- Conversation history influence

**Usage Example**:
```typescript
import { PersonalityService } from '../services/PersonalityService';

const personalityService = new PersonalityService(databaseService);

// Update mood based on conversation
await personalityService.updateMood({
  primary: 'cheerful',
  energy: 0.8,
  stability: 0.9
});

// Get personality context for AI
const personalityPrompt = await personalityService.getPersonalityPrompt();
```

## 🗄️ Database Schema

### Core Tables

The database consists of 11 interconnected tables:

1. **conversations** - All chat messages and responses
2. **sessions** - Conversation sessions and context
3. **memory_contexts** - Long-term memory storage  
4. **personality_state** - AI personality and mood
5. **journal_entries** - User journal entries
6. **memory_tags** - Categorization system
7. **conversation_tags** - Many-to-many relationships
8. **learning_data** - User preferences and feedback
9. **plugin_states** - Plugin configuration and data
10. **training_data** - Custom model training data
11. **mood_snapshots** - Historical mood tracking

### Schema Diagram

```sql
-- Core conversation flow
conversations
├── id (PRIMARY KEY)
├── session_id (FOREIGN KEY → sessions.id)
├── user_message
├── ai_response
├── timestamp
├── sentiment_score
└── context_tags (JSON)

sessions
├── id (PRIMARY KEY)
├── name
├── created_at
├── last_active
├── context_summary
└── message_count

-- Memory and personality
memory_contexts
├── id (PRIMARY KEY)
├── session_id (FOREIGN KEY → sessions.id)
├── context_type
├── content
├── importance_score
└── created_at

personality_state
├── id (PRIMARY KEY)
├── name
├── static_traits (JSON)
├── current_mood (JSON)
├── empathy_level
└── last_updated
```

### Indexes for Performance

```sql
-- Critical indexes for query performance
CREATE INDEX idx_conversations_session_id ON conversations(session_id);
CREATE INDEX idx_conversations_timestamp ON conversations(timestamp);
CREATE INDEX idx_memory_contexts_session_id ON memory_contexts(session_id);
CREATE INDEX idx_memory_contexts_type ON memory_contexts(context_type);
CREATE INDEX idx_journal_entries_session_id ON journal_entries(session_id);
```

## 🌐 API Development

### Route Structure

API routes are organized by feature area:

```
/api/v1/
├── /chat                    # Chat endpoints
├── /sessions               # Session management
├── /personality            # Personality management
├── /journal               # Journal operations
├── /plugins               # Plugin management
├── /analytics             # Analytics and stats
└── /health                # Health checks
```

### Creating New Routes

1. **Create Route Handler**

```typescript
// backend/src/routes/myFeature.ts
import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';

export function createMyFeatureRoutes(database: DatabaseService): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      // Your logic here
      const data = await database.getSomeData();
      
      res.json({
        success: true,
        data,
        message: 'Data retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: error.message
        }
      });
    }
  });

  return router;
}
```

2. **Register Route in Main Server**

```typescript
// backend/src/index.ts
import { createMyFeatureRoutes } from './routes/myFeature';

// In setupRoutes() method
this.app.use(`${apiBase}/my-feature`, createMyFeatureRoutes(this.database));
```

### Middleware Usage

Common middleware patterns:

```typescript
// Rate limiting
import { rateLimiter } from '../middleware/rateLimiter';
router.use(rateLimiter);

// Request validation
import { validateRequest } from '../middleware/validation';
router.post('/', validateRequest(schema), handler);

// Error handling (automatic)
// Errors are caught by global error handler
```

### Response Standards

All API responses should follow this format:

```typescript
// Success response
{
  success: true,
  data: any,
  message?: string,
  pagination?: {
    total: number,
    limit: number,
    offset: number,
    hasMore: boolean
  }
}

// Error response
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```

## 💻 Frontend Development

### State Management with Zustand

The frontend uses Zustand for state management:

**Location**: `frontend/src/store/index.ts`

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AppState {
  // Chat state
  messages: Message[];
  currentSession: string;
  isLoading: boolean;
  
  // Actions
  sendMessage: (message: string) => Promise<void>;
  setCurrentSession: (sessionId: string) => void;
  addMessage: (message: Message) => void;
}

export const useAppStore = create<AppState>()(
  devtools((set, get) => ({
    messages: [],
    currentSession: 'default',
    isLoading: false,
    
    sendMessage: async (message: string) => {
      set({ isLoading: true });
      try {
        const response = await apiService.sendMessage(message);
        // Handle response
      } finally {
        set({ isLoading: false });
      }
    },
    
    setCurrentSession: (sessionId: string) => {
      set({ currentSession: sessionId });
    },
    
    addMessage: (message: Message) => {
      set(state => ({
        messages: [...state.messages, message]
      }));
    }
  }))
);
```

### Component Development

**Best Practices**:

1. **Use TypeScript for all components**
2. **Follow the component structure**:

```typescript
// frontend/src/components/MyComponent.tsx
import React from 'react';
import { useAppStore } from '../store';

interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ 
  title, 
  onAction 
}) => {
  const { messages, sendMessage } = useAppStore();

  const handleClick = () => {
    sendMessage('Hello!');
    onAction?.();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>
      <button 
        onClick={handleClick}
        className="btn btn-primary mt-4"
      >
        Send Message
      </button>
    </div>
  );
};
```

### API Client Usage

The frontend uses a centralized API service:

```typescript
// frontend/src/services/api.ts usage
import { apiService } from '../services/api';

// In components or store actions
const response = await apiService.sendMessage('Hello!');
const sessions = await apiService.getSessions();
const journalEntries = await apiService.getJournalEntries({
  limit: 10,
  sortBy: 'created_at'
});
```

### Styling with Tailwind CSS

Use Tailwind CSS classes for styling:

```tsx
<div className="max-w-4xl mx-auto p-6">
  <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg">
    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Chat Interface
      </h1>
    </div>
    <div className="p-6 space-y-4">
      {/* Content */}
    </div>
  </div>
</div>
```

## 🔌 Plugin Development

### Plugin Architecture

Plugins extend the AI companion's capabilities. Each plugin is a self-contained module.

**Plugin Structure**:
```
plugins/
├── weather/
│   ├── index.ts              # Main plugin file
│   ├── package.json          # Plugin metadata  
│   ├── README.md             # Plugin documentation
│   ├── config.json           # Default configuration
│   └── tests/                # Plugin tests
```

### Creating a Plugin

1. **Basic Plugin Template**:

```typescript
// plugins/my-plugin/index.ts
import { Plugin, PluginContext, PluginResult } from '../../types/Plugin';

export default class MyPlugin implements Plugin {
  name = 'my-plugin';
  version = '1.0.0';
  description = 'My awesome plugin';
  author = 'Your Name';

  private config: any = {};

  async initialize(context: PluginContext): Promise<void> {
    this.config = context.config || {};
    console.log(`${this.name} plugin initialized`);
  }

  async execute(
    command: string, 
    args: string[], 
    context: PluginContext
  ): Promise<PluginResult> {
    
    switch (command) {
      case 'greet':
        return {
          success: true,
          data: `Hello from ${this.name} plugin!`,
          message: 'Greeting executed successfully'
        };
        
      default:
        return {
          success: false,
          error: `Unknown command: ${command}`
        };
    }
  }

  async cleanup(): Promise<void> {
    console.log(`${this.name} plugin cleaned up`);
  }

  getCommands(): string[] {
    return ['greet'];
  }

  getDescription(): string {
    return this.description;
  }
}
```

2. **Plugin Configuration**:

```json
// plugins/my-plugin/package.json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "main": "index.js",
  "author": "Your Name",
  "lackadaisical": {
    "permissions": ["api_access"],
    "commands": ["greet"],
    "config_schema": {
      "greeting": {
        "type": "string",
        "default": "Hello!",
        "description": "Default greeting message"
      }
    }
  }
}
```

### Plugin Integration

Plugins are loaded and managed by the PluginService:

```typescript
// Using a plugin in the AI service
const pluginResult = await this.pluginService.executeCommand(
  'weather', 
  'current', 
  ['San Francisco'],
  { sessionId, userId: 'default' }
);

if (pluginResult.success) {
  // Use plugin data in AI response
  const weatherData = pluginResult.data;
}
```

## 🧪 Testing Guide

### Backend Testing

**Test Structure**:
```
backend/
├── src/
└── tests/
    ├── unit/              # Unit tests
    ├── integration/       # Integration tests
    └── fixtures/          # Test data
```

**Example Unit Test**:
```typescript
// backend/tests/unit/services/DatabaseService.test.ts
import { DatabaseService } from '../../../src/services/DatabaseService';

describe('DatabaseService', () => {
  let database: DatabaseService;

  beforeEach(async () => {
    database = new DatabaseService();
    await database.initialize();
  });

  afterEach(async () => {
    await database.close();
  });

  describe('insertConversation', () => {
    it('should insert a conversation successfully', async () => {
      const conversation = {
        session_id: 'test-session',
        user_message: 'Hello',
        ai_response: 'Hi there!',
        timestamp: new Date().toISOString(),
        sentiment_score: 0.8,
        sentiment_label: 'positive',
        context_tags: [],
        message_type: 'chat',
        tokens_used: 10,
        response_time_ms: 1000,
        model_used: 'test-model'
      };

      const id = await database.insertConversation(conversation);
      expect(id).toBeGreaterThan(0);
    });
  });
});
```

**Running Tests**:
```bash
# Run all backend tests
cd backend && npm test

# Run specific test file
cd backend && npm test -- DatabaseService.test.ts

# Run tests with coverage
cd backend && npm run test:coverage
```

### Frontend Testing

**Example Component Test**:
```typescript
// frontend/tests/components/Chat.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Chat } from '../../src/components/Chat';

describe('Chat Component', () => {
  it('renders chat interface', () => {
    render(<Chat />);
    
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('sends message when button clicked', async () => {
    const mockSendMessage = jest.fn();
    render(<Chat onSendMessage={mockSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const button = screen.getByText('Send');
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(button);
    
    expect(mockSendMessage).toHaveBeenCalledWith('Test message');
  });
});
```

### Integration Testing

**API Integration Test**:
```typescript
// backend/tests/integration/api.test.ts
import request from 'supertest';
import { app } from '../../src/index';

describe('Chat API', () => {
  it('POST /api/v1/chat should send message', async () => {
    const response = await request(app)
      .post('/api/v1/chat')
      .send({
        message: 'Hello!',
        sessionId: 'test-session'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.ai_response).toBeDefined();
    expect(response.body.data.user_message).toBe('Hello!');
  });
});
```

## 🚀 Deployment

### Development Deployment

```bash
# Start development servers
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Docker Deployment

**Dockerfile**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm run install:all

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  lackadaisical-ai:
    build: .
    ports:
      - "3001:3001"
    volumes:
      - ./database:/app/database
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/database/chat.db
    restart: unless-stopped
```

### Production Considerations

1. **Environment Variables**:
   ```env
   NODE_ENV=production
   DATABASE_PATH=/app/data/chat.db
   LOG_LEVEL=info
   RATE_LIMIT_ENABLED=true
   ```

2. **Process Management**:
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

3. **Reverse Proxy (Nginx)**:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## 💡 Best Practices

### Code Quality

1. **TypeScript Everywhere**
   - Use strict TypeScript configuration
   - Define interfaces for all data structures
   - Avoid `any` type usage

2. **Error Handling**
   ```typescript
   // Always wrap async operations
   try {
     const result = await someAsyncOperation();
     return { success: true, data: result };
   } catch (error) {
     logger.error('Operation failed:', error);
     throw new AppError('OPERATION_FAILED', error.message);
   }
   ```

3. **Logging**
   ```typescript
   import { logger } from '../utils/logger';
   
   // Use appropriate log levels
   logger.info('User action completed', { userId, action });
   logger.warn('Unusual activity detected', { details });
   logger.error('Database connection failed', error);
   ```

### Performance

1. **Database Queries**
   - Use prepared statements
   - Add appropriate indexes
   - Limit result sets
   - Use transactions for multiple operations

2. **API Responses**
   - Implement pagination
   - Use compression middleware
   - Cache frequently accessed data
   - Stream large responses

3. **Frontend Optimization**
   - Lazy load components
   - Debounce user input
   - Virtualize long lists
   - Optimize bundle size

### Security

1. **Input Validation**
   ```typescript
   import Joi from 'joi';
   
   const messageSchema = Joi.object({
     message: Joi.string().min(1).max(1000).required(),
     sessionId: Joi.string().uuid().optional()
   });
   ```

2. **Data Sanitization**
   - Escape HTML content
   - Validate all inputs
   - Use parameterized queries
   - Implement rate limiting

3. **Error Information**
   - Don't expose internal errors to clients
   - Log detailed errors server-side
   - Return generic error messages

### Documentation

1. **Code Comments**
   ```typescript
   /**
    * Generates AI response based on user message and conversation context
    * @param message - User's input message
    * @param sessionId - Conversation session identifier
    * @param options - Configuration options for AI generation
    * @returns Promise containing AI response and metadata
    */
   async generateResponse(
     message: string,
     sessionId: string,
     options: AIOptions = {}
   ): Promise<AIResponse> {
     // Implementation...
   }
   ```

2. **API Documentation**
   - Document all endpoints
   - Include example requests/responses
   - Specify error codes
   - Update with changes

3. **README Files**
   - Each major component should have documentation
   - Include setup instructions
   - Provide usage examples
   - Document configuration options

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** following the guidelines above
4. **Write tests** for new functionality
5. **Update documentation** as needed
6. **Submit a pull request**

### Pull Request Guidelines

- **Clear description** of changes
- **Link to related issues**
- **Include test coverage**
- **Update documentation**
- **Follow coding standards**

## 📞 Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Discord Community**: Real-time help and collaboration
- **Documentation**: Check existing docs first
- **Code Comments**: Look for inline documentation

---

**Happy coding!** 🚀

This developer guide is a living document. Please help us improve it by submitting updates and corrections.

**Last Updated**: July 31, 2025  
**Version**: 1.0.0
