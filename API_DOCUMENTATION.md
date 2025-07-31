# 📡 API Documentation - Lackadaisical AI Chat

**Version**: 1.0.0  
**Base URL**: `http://localhost:3001/api/v1`  
**Content Type**: `application/json`

## 🚀 Quick Start

The Lackadaisical AI Chat API provides REST endpoints for interacting with your AI companion, managing conversations, and accessing memory features.

### Authentication

Currently, no authentication is required for local installations. For production deployments, consider implementing API key authentication.

### Response Format

All API responses follow this standard format:

```json
{
  "success": true,
  "data": {...},
  "message": "Operation completed successfully",
  "timestamp": "2025-07-31T12:00:00.000Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {...}
  },
  "timestamp": "2025-07-31T12:00:00.000Z"
}
```

## 🗣️ Chat Endpoints

### Send Message

Send a message to your AI companion and receive a response.

**Endpoint**: `POST /chat`

**Request Body**:
```json
{
  "message": "Hello, how are you today?",
  "sessionId": "default",
  "stream": false
}
```

**Parameters**:
- `message` (string, required): The message to send to the AI
- `sessionId` (string, optional): Session ID for conversation context (defaults to "default")
- `stream` (boolean, optional): Enable streaming response (defaults to false)

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "session_id": "default",
    "user_message": "Hello, how are you today?",
    "ai_response": "Hello! I'm doing well, thank you for asking. How has your day been going?",
    "timestamp": "2025-07-31T12:00:00.000Z",
    "sentiment_score": 0.8,
    "sentiment_label": "positive",
    "tokens_used": 45,
    "response_time_ms": 1250,
    "model_used": "llama2"
  }
}
```

### Streaming Chat

For real-time streaming responses, use Server-Sent Events (SSE).

**Endpoint**: `GET /chat/stream`

**Query Parameters**:
- `message` (string, required): URL-encoded message
- `sessionId` (string, optional): Session ID

**Response**: Server-Sent Events stream
```
data: {"type": "chunk", "content": "Hello", "done": false}

data: {"type": "chunk", "content": "! I'm", "done": false}

data: {"type": "complete", "content": "Hello! I'm doing well today.", "done": true}
```

## 💬 Session Management

### Get All Sessions

Retrieve all conversation sessions.

**Endpoint**: `GET /sessions`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "default",
      "name": "Default Session",
      "created_at": "2025-07-30T08:00:00.000Z",
      "last_active": "2025-07-31T12:00:00.000Z",
      "message_count": 45,
      "context_summary": "General conversation about daily life and interests"
    }
  ]
}
```

### Create New Session

Create a new conversation session.

**Endpoint**: `POST /sessions`

**Request Body**:
```json
{
  "name": "Work Discussion",
  "contextSummary": "Conversations about work projects and career"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "session_uuid_here",
    "name": "Work Discussion",
    "created_at": "2025-07-31T12:00:00.000Z",
    "last_active": "2025-07-31T12:00:00.000Z",
    "message_count": 0,
    "context_summary": "Conversations about work projects and career"
  }
}
```

### Get Session History

Get conversation history for a specific session.

**Endpoint**: `GET /sessions/{sessionId}/history`

**Parameters**:
- `limit` (number, optional): Maximum number of messages (default: 50)
- `offset` (number, optional): Number of messages to skip (default: 0)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "user_message": "Hello!",
      "ai_response": "Hi there! How can I help you today?",
      "timestamp": "2025-07-31T12:00:00.000Z",
      "sentiment_score": 0.8,
      "sentiment_label": "positive"
    }
  ]
}
```

### Update Session

Update session details.

**Endpoint**: `PUT /sessions/{sessionId}`

**Request Body**:
```json
{
  "name": "Updated Session Name",
  "contextSummary": "Updated description"
}
```

### Delete Session

Delete a conversation session and all its messages.

**Endpoint**: `DELETE /sessions/{sessionId}`

**Response**:
```json
{
  "success": true,
  "message": "Session deleted successfully"
}
```

## 🧠 Memory & Context

### Get Session Context

Retrieve the current context window for a session.

**Endpoint**: `GET /sessions/{sessionId}/context`

**Parameters**:
- `maxTokens` (number, optional): Maximum tokens in context window

**Response**:
```json
{
  "success": true,
  "data": {
    "contextWindow": "Previous conversation context...",
    "tokenCount": 1500,
    "maxTokens": 4000,
    "memoryItems": [
      {
        "type": "personal_detail",
        "content": "User enjoys hiking and outdoor activities",
        "confidence": 0.9,
        "created_at": "2025-07-30T10:00:00.000Z"
      }
    ]
  }
}
```

### Update Session Context

Add or update context information for a session.

**Endpoint**: `POST /sessions/{sessionId}/context`

**Request Body**:
```json
{
  "contextType": "personal_detail",
  "content": "User is learning Python programming",
  "importance": 0.8
}
```

### Get Memory Stats

Get memory and conversation statistics.

**Endpoint**: `GET /sessions/{sessionId}/memory/stats`

**Response**:
```json
{
  "success": true,
  "data": {
    "totalConversations": 150,
    "totalTokens": 45000,
    "averageResponseTime": 1250,
    "memoryItems": 25,
    "personalDetails": 8,
    "preferences": 12,
    "goals": 5
  }
}
```

## 🤖 Personality Management

### Get Personality State

Retrieve current AI personality state.

**Endpoint**: `GET /personality`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Lacky",
    "static_traits": ["helpful", "empathetic", "curious"],
    "current_mood": {
      "primary": "cheerful",
      "energy": 0.8,
      "stability": 0.9
    },
    "energy_level": 0.8,
    "empathy_level": 0.9,
    "humor_level": 0.7,
    "curiosity_level": 0.8,
    "patience_level": 0.9,
    "conversation_count": 45,
    "total_interactions": 150,
    "last_interaction": "2025-07-31T12:00:00.000Z"
  }
}
```

### Update Personality

Update personality traits and mood.

**Endpoint**: `PUT /personality`

**Request Body**:
```json
{
  "empathy_level": 0.95,
  "humor_level": 0.8,
  "current_mood": {
    "primary": "excited",
    "energy": 0.9,
    "stability": 0.8
  }
}
```

### Reset Personality

Reset personality to default state.

**Endpoint**: `POST /personality/reset`

**Response**:
```json
{
  "success": true,
  "message": "Personality reset to default state",
  "data": {
    "name": "Lacky",
    "static_traits": ["helpful", "empathetic", "curious"],
    "energy_level": 0.7,
    "empathy_level": 0.8
  }
}
```

## 📔 Journal System

### Create Journal Entry

Create a new journal entry.

**Endpoint**: `POST /journal`

**Request Body**:
```json
{
  "title": "My Day at Work",
  "content": "Today was challenging but rewarding. I learned about new AI technologies and had great conversations with colleagues.",
  "tags": ["work", "learning", "technology"],
  "mood": "content",
  "privacy_level": "private"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "journal_uuid_here",
    "title": "My Day at Work",
    "content": "Today was challenging but rewarding...",
    "tags": ["work", "learning", "technology"],
    "mood": "content",
    "session_id": "default",
    "privacy_level": "private",
    "word_count": 25,
    "reading_time_minutes": 1,
    "themes": ["work", "learning"],
    "emotions": ["satisfaction", "curiosity"],
    "created_at": "2025-07-31T12:00:00.000Z"
  }
}
```

### Get Journal Entries

Retrieve journal entries with filtering options.

**Endpoint**: `GET /journal`

**Query Parameters**:
- `sessionId` (string, optional): Filter by session
- `mood` (string, optional): Filter by mood
- `tags` (string[], optional): Filter by tags (comma-separated)
- `search` (string, optional): Search in title and content
- `sortBy` (string, optional): Sort field (default: "created_at")
- `sortOrder` (string, optional): Sort order "asc" or "desc" (default: "desc")
- `limit` (number, optional): Maximum entries to return
- `offset` (number, optional): Number of entries to skip

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "journal_uuid_here",
      "title": "My Day at Work",
      "content": "Today was challenging but rewarding...",
      "tags": ["work", "learning"],
      "mood": "content",
      "created_at": "2025-07-31T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

### Get Journal Entry

Get a specific journal entry by ID.

**Endpoint**: `GET /journal/{entryId}`

### Update Journal Entry

Update an existing journal entry.

**Endpoint**: `PUT /journal/{entryId}`

**Request Body**:
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "tags": ["updated", "tags"],
  "mood": "happy"
}
```

### Delete Journal Entry

Delete a journal entry.

**Endpoint**: `DELETE /journal/{entryId}`

### Export Journal

Export journal entries in various formats.

**Endpoint**: `GET /journal/export`

**Query Parameters**:
- `format` (string, required): Export format ("json", "csv", "txt", "markdown")
- `sessionId` (string, optional): Filter by session
- `dateRange` (object, optional): Date range filter

**Response**: File download with appropriate content-type header.

## 🔌 Plugin System

### Get All Plugins

List all available plugins.

**Endpoint**: `GET /plugins`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "plugin_name": "weather",
      "enabled": true,
      "version": "1.0.0",
      "author": "Lackadaisical Security",
      "description": "Provides weather information and forecasts",
      "permissions": ["api_access", "location"],
      "config": {
        "api_key": "configured",
        "default_location": "San Francisco"
      },
      "usage_count": 15,
      "last_used": "2025-07-31T10:00:00.000Z"
    }
  ]
}
```

### Get Plugin Details

Get detailed information about a specific plugin.

**Endpoint**: `GET /plugins/{pluginName}`

### Enable Plugin

Enable a plugin.

**Endpoint**: `POST /plugins/{pluginName}/enable`

**Response**:
```json
{
  "success": true,
  "message": "Plugin enabled successfully"
}
```

### Disable Plugin

Disable a plugin.

**Endpoint**: `POST /plugins/{pluginName}/disable`

### Update Plugin Configuration

Update plugin configuration.

**Endpoint**: `PUT /plugins/{pluginName}/config`

**Request Body**:
```json
{
  "config": {
    "api_key": "new_api_key",
    "default_location": "New York"
  }
}
```

## 📊 Analytics & Health

### Health Check

Check system health and status.

**Endpoint**: `GET /health`

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-07-31T12:00:00.000Z",
    "version": "1.0.0",
    "uptime": 86400,
    "database": {
      "status": "connected",
      "total_conversations": 150,
      "total_sessions": 5,
      "total_journal_entries": 25
    },
    "ai_service": {
      "status": "connected",
      "provider": "ollama",
      "model": "llama2",
      "response_time_avg": 1250
    },
    "memory": {
      "used_mb": 245,
      "total_mb": 8192
    }
  }
}
```

### Get Database Statistics

Get comprehensive database statistics.

**Endpoint**: `GET /analytics/database`

**Response**:
```json
{
  "success": true,
  "data": {
    "totalConversations": 150,
    "totalJournalEntries": 25,
    "totalSessions": 5,
    "activePlugins": 3,
    "averageResponseTime": 1250,
    "tokenUsage": {
      "total": 45000,
      "average_per_conversation": 300
    },
    "sentimentDistribution": {
      "positive": 0.6,
      "neutral": 0.3,
      "negative": 0.1
    }
  }
}
```

## 🚫 Error Codes

Common error codes and their meanings:

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Request format or parameters are invalid |
| `SESSION_NOT_FOUND` | Specified session ID does not exist |
| `JOURNAL_NOT_FOUND` | Specified journal entry does not exist |
| `PLUGIN_NOT_FOUND` | Specified plugin does not exist |
| `DATABASE_ERROR` | Database operation failed |
| `AI_SERVICE_ERROR` | AI service is unavailable or failed |
| `VALIDATION_ERROR` | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests in time window |
| `INTERNAL_ERROR` | Unexpected server error |

## 📝 Usage Examples

### Basic Chat Flow

```javascript
// Send a message
const response = await fetch('/api/v1/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Hello, how are you?',
    sessionId: 'my-session'
  })
});

const chatResponse = await response.json();
console.log(chatResponse.data.ai_response);
```

### Streaming Chat

```javascript
const eventSource = new EventSource(
  '/api/v1/chat/stream?message=Tell me a story&sessionId=my-session'
);

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  if (data.type === 'chunk') {
    process.stdout.write(data.content);
  }
};
```

### Journal Management

```javascript
// Create journal entry
await fetch('/api/v1/journal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Today\'s Thoughts',
    content: 'It was a productive day...',
    tags: ['personal', 'reflection'],
    mood: 'content'
  })
});

// Get entries
const entries = await fetch('/api/v1/journal?limit=10');
const journalData = await entries.json();
```

## 🔧 Development

### Rate Limiting

The API implements rate limiting:
- **Default**: 100 requests per hour per IP
- **Burst**: Up to 10 requests per minute
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### CORS

CORS is configured to allow requests from:
- `http://localhost:3000` (frontend development)
- `http://127.0.0.1:3000`
- Custom origins can be configured in settings

### Request/Response Logging

All API requests are logged with:
- Timestamp
- Method and endpoint
- Response time
- Status code
- User agent (if available)

## 📚 SDK and Libraries

### JavaScript/TypeScript

```javascript
import { LackadaisicalAI } from 'lackadaisical-ai-client';

const ai = new LackadaisicalAI({
  baseUrl: 'http://localhost:3001/api/v1'
});

// Send message
const response = await ai.chat.send('Hello!');

// Manage sessions
const sessions = await ai.sessions.list();
const newSession = await ai.sessions.create('Work Chat');

// Journal operations
const entry = await ai.journal.create({
  title: 'My thoughts',
  content: 'Today was interesting...'
});
```

### Python (Community Contribution)

```python
from lackadaisical_ai import LackadaisicalAI

ai = LackadaisicalAI(base_url='http://localhost:3001/api/v1')

# Send message
response = ai.chat.send('Hello!')
print(response['ai_response'])

# Create journal entry
entry = ai.journal.create(
    title='My thoughts',
    content='Today was interesting...',
    tags=['personal', 'reflection']
)
```

---

## 🤝 Contributing to API

We welcome contributions to improve the API:

1. **Report Issues**: Found a bug or missing feature? Create an issue!
2. **Suggest Improvements**: Ideas for better endpoints or functionality
3. **Documentation**: Help improve this documentation
4. **Testing**: Write tests for API endpoints

## 📞 Support

- **GitHub Issues**: Report bugs and request features
- **Community Discord**: Real-time help and discussions  
- **Documentation**: Check TROUBLESHOOTING.md for common issues
- **Email**: API-specific questions to api@lackadaisical-security.com

---

**Last Updated**: July 31, 2025  
**API Version**: 1.0.0  
**Documentation Version**: 1.0.0
