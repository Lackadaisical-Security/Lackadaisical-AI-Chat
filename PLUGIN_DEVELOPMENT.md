# 🔌 Plugin Development Guide - Lackadaisical AI Chat

This comprehensive guide will help you create powerful plugins that extend your AI companion's capabilities. Plugins allow you to add custom functionality, integrate with external services, and create personalized experiences.

## 🚀 Quick Start

### Creating Your First Plugin

1. **Create Plugin Directory**
   ```bash
   mkdir plugins/my-awesome-plugin
   cd plugins/my-awesome-plugin
   ```

2. **Initialize Plugin Structure**
   ```bash
   # Create basic files
   touch index.ts package.json README.md config.json
   mkdir tests
   ```

3. **Basic Plugin Template**
   ```typescript
   // index.ts
   import { Plugin, PluginContext, PluginResult } from '../../types/Plugin';

   export default class MyAwesomePlugin implements Plugin {
     name = 'my-awesome-plugin';
     version = '1.0.0';
     description = 'An awesome plugin that does amazing things';
     author = 'Your Name';

     async initialize(context: PluginContext): Promise<void> {
       console.log(`${this.name} initialized!`);
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
             data: `Hello from ${this.name}!`,
             message: 'Greeting successful'
           };
         default:
           return {
             success: false,
             error: `Unknown command: ${command}`
           };
       }
     }

     async cleanup(): Promise<void> {
       console.log(`${this.name} cleaned up!`);
     }

     getCommands(): string[] {
       return ['greet'];
     }

     getDescription(): string {
       return this.description;
     }
   }
   ```

4. **Plugin Configuration**
   ```json
   {
     "name": "my-awesome-plugin",
     "version": "1.0.0",
     "description": "An awesome plugin that does amazing things",
     "main": "index.js",
     "author": "Your Name",
     "lackadaisical": {
       "permissions": ["api_access"],
       "commands": ["greet"],
       "config_schema": {
         "greeting_message": {
           "type": "string",
           "default": "Hello!",
           "description": "Default greeting message"
         }
       }
     }
   }
   ```

## 🏗️ Plugin Architecture

### Plugin Interface

All plugins must implement the `Plugin` interface:

```typescript
interface Plugin {
  // Plugin metadata
  name: string;
  version: string;
  description: string;
  author: string;

  // Lifecycle methods
  initialize(context: PluginContext): Promise<void>;
  execute(command: string, args: string[], context: PluginContext): Promise<PluginResult>;
  cleanup(): Promise<void>;

  // Information methods
  getCommands(): string[];
  getDescription(): string;
}
```

### Plugin Context

The `PluginContext` provides access to system services:

```typescript
interface PluginContext {
  // Core services
  database: DatabaseService;
  memory: MemoryService;
  personality: PersonalityService;

  // Plugin-specific data
  config: Record<string, any>;
  state: Record<string, any>;
  sessionId: string;

  // Utility functions
  log: (level: string, message: string, data?: any) => void;
  emit: (event: string, data: any) => void;
  
  // System access (if permissions allow)
  httpClient?: AxiosInstance;
  fileSystem?: FileSystemAccess;
}
```

### Plugin Result

All commands return a `PluginResult`:

```typescript
interface PluginResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}
```

## 📋 Plugin Types

### 1. Utility Plugins

Provide general utility functions.

**Example: Calculator Plugin**
```typescript
export default class CalculatorPlugin implements Plugin {
  name = 'calculator';
  
  async execute(command: string, args: string[]): Promise<PluginResult> {
    switch (command) {
      case 'add':
        const [a, b] = args.map(Number);
        return {
          success: true,
          data: a + b,
          message: `${a} + ${b} = ${a + b}`
        };
      
      case 'calculate':
        try {
          // Safe math expression evaluation
          const result = this.evaluateExpression(args[0]);
          return {
            success: true,
            data: result,
            message: `${args[0]} = ${result}`
          };
        } catch (error) {
          return {
            success: false,
            error: 'Invalid expression'
          };
        }
    }
  }
  
  getCommands(): string[] {
    return ['add', 'subtract', 'multiply', 'divide', 'calculate'];
  }
}
```

### 2. Data Plugins

Fetch and process external data.

**Example: Weather Plugin**
```typescript
export default class WeatherPlugin implements Plugin {
  name = 'weather';
  private apiKey: string;
  
  async initialize(context: PluginContext): Promise<void> {
    this.apiKey = context.config.api_key;
    if (!this.apiKey) {
      throw new Error('Weather API key not configured');
    }
  }
  
  async execute(command: string, args: string[], context: PluginContext): Promise<PluginResult> {
    switch (command) {
      case 'current':
        const location = args[0] || context.config.default_location;
        return await this.getCurrentWeather(location, context);
      
      case 'forecast':
        const forecastLocation = args[0] || context.config.default_location;
        const days = parseInt(args[1]) || 5;
        return await this.getForecast(forecastLocation, days, context);
    }
  }
  
  private async getCurrentWeather(location: string, context: PluginContext): Promise<PluginResult> {
    try {
      const response = await context.httpClient.get(
        `https://api.openweathermap.org/data/2.5/weather`,
        {
          params: {
            q: location,
            appid: this.apiKey,
            units: 'metric'
          }
        }
      );
      
      const weather = response.data;
      const description = `Current weather in ${weather.name}: ${weather.weather[0].description}, ${weather.main.temp}°C`;
      
      return {
        success: true,
        data: weather,
        message: description
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch weather for ${location}`
      };
    }
  }
}
```

### 3. Interactive Plugins

Provide interactive experiences and games.

**Example: Quiz Plugin**
```typescript
export default class QuizPlugin implements Plugin {
  name = 'quiz';
  private questions: QuizQuestion[] = [];
  
  async initialize(context: PluginContext): Promise<void> {
    this.questions = await this.loadQuestions(context);
  }
  
  async execute(command: string, args: string[], context: PluginContext): Promise<PluginResult> {
    switch (command) {
      case 'start':
        return await this.startQuiz(context);
      
      case 'answer':
        return await this.checkAnswer(args[0], context);
      
      case 'score':
        return await this.getScore(context);
    }
  }
  
  private async startQuiz(context: PluginContext): Promise<PluginResult> {
    const question = this.getRandomQuestion();
    
    // Store current question in plugin state
    await this.saveState(context, {
      currentQuestion: question,
      score: 0,
      questionCount: 0
    });
    
    return {
      success: true,
      data: {
        question: question.question,
        options: question.options
      },
      message: 'Quiz started! Answer with: /quiz answer <your_answer>'
    };
  }
}
```

### 4. Memory Plugins

Enhance the AI's memory and context understanding.

**Example: Note-Taking Plugin**
```typescript
export default class NotesPlugin implements Plugin {
  name = 'notes';
  
  async execute(command: string, args: string[], context: PluginContext): Promise<PluginResult> {
    switch (command) {
      case 'add':
        return await this.addNote(args.join(' '), context);
      
      case 'list':
        return await this.listNotes(context);
      
      case 'search':
        return await this.searchNotes(args.join(' '), context);
      
      case 'delete':
        return await this.deleteNote(args[0], context);
    }
  }
  
  private async addNote(content: string, context: PluginContext): Promise<PluginResult> {
    const noteId = Date.now().toString();
    const note = {
      id: noteId,
      content,
      created_at: new Date().toISOString(),
      session_id: context.sessionId
    };
    
    // Store in plugin state
    const state = await this.getState(context);
    state.notes = state.notes || [];
    state.notes.push(note);
    await this.saveState(context, state);
    
    // Also add to AI memory for context
    await context.memory.addContext(context.sessionId, {
      type: 'user_note',
      content: `User noted: ${content}`,
      importance: 0.7,
      created_at: new Date().toISOString()
    });
    
    return {
      success: true,
      data: note,
      message: `Note added: ${content.substring(0, 50)}...`
    };
  }
}
```

## ⚙️ Configuration System

### Plugin Configuration Schema

Define your plugin's configuration options:

```json
{
  "lackadaisical": {
    "config_schema": {
      "api_key": {
        "type": "string",
        "required": true,
        "description": "API key for external service",
        "sensitive": true
      },
      "default_location": {
        "type": "string",
        "default": "San Francisco",
        "description": "Default location for location-based queries"
      },
      "max_results": {
        "type": "number",
        "default": 10,
        "min": 1,
        "max": 100,
        "description": "Maximum number of results to return"
      },
      "enabled_features": {
        "type": "array",
        "items": { "type": "string" },
        "default": ["basic", "advanced"],
        "description": "List of enabled features"
      },
      "settings": {
        "type": "object",
        "properties": {
          "timeout": { "type": "number", "default": 5000 },
          "retries": { "type": "number", "default": 3 }
        }
      }
    }
  }
}
```

### Accessing Configuration

```typescript
export default class MyPlugin implements Plugin {
  async execute(command: string, args: string[], context: PluginContext): Promise<PluginResult> {
    // Access configuration values
    const apiKey = context.config.api_key;
    const maxResults = context.config.max_results || 10;
    const enabledFeatures = context.config.enabled_features || [];
    
    // Use configuration in your logic
    if (!apiKey) {
      return {
        success: false,
        error: 'API key not configured. Please set api_key in plugin settings.'
      };
    }
    
    // Proceed with configured values...
  }
}
```

## 🔐 Permissions System

### Available Permissions

```typescript
type PluginPermission = 
  | 'api_access'        // HTTP requests to external APIs
  | 'file_system'       // Read/write local files
  | 'database'          // Direct database access
  | 'memory_write'      // Write to AI memory
  | 'personality'       // Modify AI personality
  | 'user_data'         // Access user personal data
  | 'network'           // Network access beyond HTTP
  | 'system'            // System-level operations
  | 'plugin_state'      // Access other plugins' state
  | 'conversations';    // Access conversation history
```

### Declaring Permissions

```json
{
  "lackadaisical": {
    "permissions": [
      "api_access",
      "memory_write"
    ]
  }
}
```

### Permission Checks

The system automatically enforces permissions:

```typescript
// This will only work if plugin has 'api_access' permission
const response = await context.httpClient.get('https://api.example.com');

// This will only work if plugin has 'memory_write' permission
await context.memory.addContext(sessionId, memoryContext);

// This will only work if plugin has 'database' permission
const data = await context.database.executeQuery('SELECT * FROM conversations');
```

## 🗄️ State Management

### Plugin State

Each plugin has its own persistent state:

```typescript
export default class StatefulPlugin implements Plugin {
  name = 'stateful-plugin';
  
  async execute(command: string, args: string[], context: PluginContext): Promise<PluginResult> {
    // Get current state
    const state = await this.getState(context);
    
    // Modify state
    state.counter = (state.counter || 0) + 1;
    state.lastUsed = new Date().toISOString();
    
    // Save state
    await this.saveState(context, state);
    
    return {
      success: true,
      data: { counter: state.counter },
      message: `Command executed ${state.counter} times`
    };
  }
  
  private async getState(context: PluginContext): Promise<any> {
    return context.state || {};
  }
  
  private async saveState(context: PluginContext, state: any): Promise<void> {
    // The system handles state persistence automatically
    Object.assign(context.state, state);
  }
}
```

### Shared State

Plugins can share data through the database (with permission):

```typescript
// Write shared data
await context.database.executeStatement(
  'INSERT INTO plugin_shared_data (key, value, plugin_name) VALUES (?, ?, ?)',
  ['weather_cache', JSON.stringify(weatherData), this.name]
);

// Read shared data
const result = await context.database.executeQuery(
  'SELECT value FROM plugin_shared_data WHERE key = ?',
  ['weather_cache']
);
```

## 🧪 Testing Plugins

### Unit Testing

```typescript
// tests/calculator.test.ts
import CalculatorPlugin from '../index';
import { PluginContext } from '../../../types/Plugin';

describe('CalculatorPlugin', () => {
  let plugin: CalculatorPlugin;
  let mockContext: PluginContext;
  
  beforeEach(() => {
    plugin = new CalculatorPlugin();
    mockContext = {
      config: {},
      state: {},
      sessionId: 'test-session',
      log: jest.fn(),
      emit: jest.fn()
    } as any;
  });
  
  describe('add command', () => {
    it('should add two numbers correctly', async () => {
      const result = await plugin.execute('add', ['5', '3'], mockContext);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(8);
      expect(result.message).toBe('5 + 3 = 8');
    });
    
    it('should handle invalid input', async () => {
      const result = await plugin.execute('add', ['abc', '3'], mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
    });
  });
});
```

### Integration Testing

```typescript
// tests/integration.test.ts
import { PluginManager } from '../../../backend/src/services/PluginManager';
import { DatabaseService } from '../../../backend/src/services/DatabaseService';

describe('Plugin Integration', () => {
  let pluginManager: PluginManager;
  let database: DatabaseService;
  
  beforeEach(async () => {
    database = new DatabaseService();
    await database.initialize();
    
    pluginManager = new PluginManager(database);
    await pluginManager.loadPlugin('./plugins/my-plugin');
  });
  
  it('should execute plugin commands through the system', async () => {
    const result = await pluginManager.executeCommand(
      'my-plugin',
      'greet',
      [],
      {
        sessionId: 'test-session',
        userId: 'test-user'
      }
    );
    
    expect(result.success).toBe(true);
    expect(result.data).toContain('Hello');
  });
});
```

### Manual Testing

```bash
# Start the application in development mode
npm run dev

# In the chat interface, test your plugin
User: /my-plugin greet
AI: Hello from my-plugin!

User: /calculator add 5 3
AI: 5 + 3 = 8

User: /weather current London
AI: Current weather in London: clear sky, 18°C
```

## 📦 Plugin Packaging

### Directory Structure

```
my-awesome-plugin/
├── index.ts              # Main plugin file
├── package.json          # Plugin metadata and dependencies
├── README.md             # Plugin documentation
├── config.json           # Default configuration
├── LICENSE               # Plugin license
├── src/                  # Source code (if complex)
│   ├── commands/         # Command handlers
│   ├── utils/            # Utility functions
│   └── types.ts          # TypeScript types
├── tests/                # Test files
│   ├── unit/
│   └── integration/
├── docs/                 # Additional documentation
└── examples/             # Usage examples
```

### Package.json Requirements

```json
{
  "name": "my-awesome-plugin",
  "version": "1.0.0",
  "description": "An awesome plugin for Lackadaisical AI Chat",
  "main": "index.js",
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",
  "keywords": ["lackadaisical", "ai", "plugin", "chat"],
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/my-awesome-plugin.git"
  },
  "lackadaisical": {
    "version": "1.0.0",
    "permissions": ["api_access"],
    "commands": ["greet", "help"],
    "config_schema": {
      // Configuration schema here
    }
  },
  "dependencies": {
    // Plugin dependencies
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "typescript": "^4.8.0"
  }
}
```

### Building and Distribution

```bash
# Compile TypeScript to JavaScript
npx tsc index.ts --outDir dist --target es2020

# Create plugin package
tar -czf my-awesome-plugin-1.0.0.tgz .

# Or publish to npm
npm publish
```

## 🌐 Advanced Plugin Patterns

### Command Routing

```typescript
export default class AdvancedPlugin implements Plugin {
  private commands: Map<string, (args: string[], context: PluginContext) => Promise<PluginResult>>;
  
  constructor() {
    this.commands = new Map([
      ['greet', this.handleGreet.bind(this)],
      ['config', this.handleConfig.bind(this)],
      ['status', this.handleStatus.bind(this)],
      ['help', this.handleHelp.bind(this)]
    ]);
  }
  
  async execute(command: string, args: string[], context: PluginContext): Promise<PluginResult> {
    const handler = this.commands.get(command);
    if (!handler) {
      return {
        success: false,
        error: `Unknown command: ${command}. Use /help for available commands.`
      };
    }
    
    try {
      return await handler(args, context);
    } catch (error) {
      context.log('error', `Command ${command} failed`, error);
      return {
        success: false,
        error: `Command failed: ${error.message}`
      };
    }
  }
  
  private async handleGreet(args: string[], context: PluginContext): Promise<PluginResult> {
    const name = args[0] || 'friend';
    return {
      success: true,
      data: `Hello, ${name}!`,
      message: 'Greeting sent successfully'
    };
  }
}
```

### Async Operations

```typescript
export default class AsyncPlugin implements Plugin {
  name = 'async-plugin';
  
  async execute(command: string, args: string[], context: PluginContext): Promise<PluginResult> {
    switch (command) {
      case 'long-task':
        return await this.handleLongTask(context);
    }
  }
  
  private async handleLongTask(context: PluginContext): Promise<PluginResult> {
    // Emit progress updates
    context.emit('progress', { message: 'Starting long task...', progress: 0 });
    
    // Simulate long-running task with progress updates
    for (let i = 1; i <= 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      context.emit('progress', {
        message: `Processing step ${i}/10...`,
        progress: i * 10
      });
    }
    
    context.emit('progress', { message: 'Task completed!', progress: 100 });
    
    return {
      success: true,
      data: { result: 'Task completed successfully' },
      message: 'Long task finished'
    };
  }
}
```

### Error Handling

```typescript
export default class RobustPlugin implements Plugin {
  name = 'robust-plugin';
  
  async execute(command: string, args: string[], context: PluginContext): Promise<PluginResult> {
    try {
      // Validate input
      if (!this.validateInput(command, args)) {
        return {
          success: false,
          error: 'Invalid input provided'
        };
      }
      
      // Execute command with retry logic
      return await this.executeWithRetry(command, args, context);
      
    } catch (error) {
      // Log error for debugging
      context.log('error', `Plugin execution failed: ${error.message}`, {
        command,
        args,
        error
      });
      
      // Return user-friendly error
      return {
        success: false,
        error: 'An unexpected error occurred. Please try again.'
      };
    }
  }
  
  private async executeWithRetry(
    command: string,
    args: string[],
    context: PluginContext,
    maxRetries: number = 3
  ): Promise<PluginResult> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeCommand(command, args, context);
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          context.log('warn', `Attempt ${attempt} failed, retrying...`, error);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw lastError;
  }
  
  private validateInput(command: string, args: string[]): boolean {
    // Add your validation logic here
    return true;
  }
}
```

## 📚 Plugin Examples

### 1. Simple Greeting Plugin

```typescript
export default class GreetingPlugin implements Plugin {
  name = 'greeting';
  version = '1.0.0';
  description = 'Provides personalized greetings';
  author = 'Lackadaisical Security';
  
  async execute(command: string, args: string[], context: PluginContext): Promise<PluginResult> {
    const greetings = [
      'Hello there!',
      'Greetings!',
      'Hey!',
      'Hi there!',
      'Good to see you!'
    ];
    
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    const name = args[0] ? ` ${args[0]}` : '';
    
    return {
      success: true,
      data: `${randomGreeting}${name}`,
      message: 'Greeting generated'
    };
  }
  
  getCommands(): string[] {
    return ['greet'];
  }
  
  getDescription(): string {
    return 'Generate personalized greetings. Usage: /greeting greet [name]';
  }
}
```

### 2. Task Manager Plugin

```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  created_at: string;
  due_date?: string;
}

export default class TaskManagerPlugin implements Plugin {
  name = 'tasks';
  version = '1.0.0';
  description = 'Manage your tasks and todos';
  author = 'Lackadaisical Security';
  
  async execute(command: string, args: string[], context: PluginContext): Promise<PluginResult> {
    switch (command) {
      case 'add':
        return await this.addTask(args, context);
      case 'list':
        return await this.listTasks(context);
      case 'complete':
        return await this.completeTask(args[0], context);
      case 'delete':
        return await this.deleteTask(args[0], context);
      default:
        return {
          success: false,
          error: 'Unknown command. Available: add, list, complete, delete'
        };
    }
  }
  
  private async addTask(args: string[], context: PluginContext): Promise<PluginResult> {
    const title = args.join(' ');
    if (!title) {
      return {
        success: false,
        error: 'Please provide a task title'
      };
    }
    
    const task: Task = {
      id: Date.now().toString(),
      title,
      completed: false,
      created_at: new Date().toISOString()
    };
    
    const state = context.state;
    state.tasks = state.tasks || [];
    state.tasks.push(task);
    
    return {
      success: true,
      data: task,
      message: `Task added: ${title}`
    };
  }
  
  private async listTasks(context: PluginContext): Promise<PluginResult> {
    const tasks: Task[] = context.state.tasks || [];
    
    if (tasks.length === 0) {
      return {
        success: true,
        data: [],
        message: 'No tasks found. Add one with /tasks add <title>'
      };
    }
    
    const taskList = tasks
      .map(task => `${task.completed ? '✅' : '⭕'} ${task.title}`)
      .join('\n');
    
    return {
      success: true,
      data: tasks,
      message: `Your tasks:\n${taskList}`
    };
  }
  
  private async completeTask(taskId: string, context: PluginContext): Promise<PluginResult> {
    const tasks: Task[] = context.state.tasks || [];
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return {
        success: false,
        error: 'Task not found'
      };
    }
    
    task.completed = true;
    
    return {
      success: true,
      data: task,
      message: `Task completed: ${task.title}`
    };
  }
  
  getCommands(): string[] {
    return ['add', 'list', 'complete', 'delete'];
  }
  
  getDescription(): string {
    return 'Manage your tasks. Commands: add <title>, list, complete <id>, delete <id>';
  }
}
```

## 🚀 Publishing Plugins

### Plugin Registry (Future)

We're planning a plugin registry where you can:

- Publish plugins for others to discover
- Install plugins with one command
- Automatic updates and security scanning
- Community ratings and reviews

### Current Distribution

For now, share plugins via:

1. **GitHub repositories**
2. **npm packages**
3. **Direct file sharing**
4. **Community Discord**

### Plugin Submission Guidelines

When sharing plugins:

1. **Include comprehensive documentation**
2. **Add proper error handling**
3. **Write tests for your plugin**
4. **Follow security best practices**
5. **Use semantic versioning**
6. **Include usage examples**

## 🛡️ Security Best Practices

### Input Validation

```typescript
private validateInput(input: string): boolean {
  // Sanitize input
  const sanitized = input.trim();
  
  // Check length
  if (sanitized.length > 1000) {
    return false;
  }
  
  // Check for dangerous patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(sanitized));
}
```

### API Key Security

```typescript
// DON'T: Store API keys in code
const API_KEY = 'sk-1234567890abcdef';

// DO: Use configuration system
async execute(command: string, args: string[], context: PluginContext): Promise<PluginResult> {
  const apiKey = context.config.api_key;
  if (!apiKey) {
    return {
      success: false,
      error: 'API key not configured. Please configure api_key in plugin settings.'
    };
  }
  
  // Use the API key securely
}
```

### Safe External Requests

```typescript
private async makeSecureRequest(url: string, context: PluginContext): Promise<any> {
  // Validate URL
  if (!this.isValidUrl(url)) {
    throw new Error('Invalid URL provided');
  }
  
  // Set timeout and limits
  try {
    const response = await context.httpClient.get(url, {
      timeout: 10000,
      maxRedirects: 3,
      responseType: 'json'
    });
    
    return response.data;
  } catch (error) {
    // Log error securely (don't expose sensitive info)
    context.log('error', 'Request failed', {
      url: this.sanitizeUrl(url),
      error: error.message
    });
    throw error;
  }
}
```

## 🎯 Plugin Development Tips

### Performance Optimization

1. **Cache expensive operations**
2. **Use async/await properly**
3. **Avoid blocking operations**
4. **Implement proper cleanup**
5. **Monitor memory usage**

### User Experience

1. **Provide clear error messages**
2. **Include help commands**
3. **Show progress for long operations**
4. **Use consistent command patterns**
5. **Validate input thoroughly**

### Debugging

```typescript
export default class DebuggablePlugin implements Plugin {
  name = 'debuggable-plugin';
  
  async execute(command: string, args: string[], context: PluginContext): Promise<PluginResult> {
    // Log execution start
    context.log('debug', `Executing command: ${command}`, {
      args,
      sessionId: context.sessionId
    });
    
    try {
      const result = await this.processCommand(command, args, context);
      
      // Log successful execution
      context.log('debug', `Command executed successfully: ${command}`, {
        result: result.success
      });
      
      return result;
    } catch (error) {
      // Log error with context
      context.log('error', `Command execution failed: ${command}`, {
        error: error.message,
        stack: error.stack,
        args
      });
      
      throw error;
    }
  }
}
```

## 🤝 Contributing to Plugin Ecosystem

### Code Review Guidelines

When reviewing plugins:

1. **Security**: Check for vulnerabilities
2. **Performance**: Look for optimization opportunities
3. **Documentation**: Ensure proper documentation
4. **Testing**: Verify test coverage
5. **Standards**: Follow coding conventions

### Community Guidelines

1. **Be helpful and constructive**
2. **Share knowledge and examples**
3. **Report security issues responsibly**
4. **Respect different approaches**
5. **Help newcomers learn**

## 📞 Getting Help

- **GitHub Issues**: Report plugin-related bugs
- **GitHub Discussions**: Ask questions and share ideas
- **Discord Community**: Real-time plugin development help
- **Documentation**: Check existing guides and examples

---

**Happy plugin development!** 🚀

Create amazing extensions that make your AI companion even more powerful and personalized.

**Last Updated**: July 31, 2025  
**Plugin API Version**: 1.0.0
