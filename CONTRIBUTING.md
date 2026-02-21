# 🤝 Contributing to Lackadaisical AI Chat

Thank you for your interest in contributing to Lackadaisical AI Chat! We're building the future of personal AI companionship together, and your contributions help make AI friends accessible to everyone.

## 🌟 Ways to Contribute

### 🐛 Report Bugs
Found something that doesn't work? Help us fix it!

- **Use GitHub Issues** to report bugs
- **Include details**: OS, Node.js version, steps to reproduce
- **Add screenshots** if applicable
- **Check existing issues** to avoid duplicates

### 💡 Suggest Features
Have ideas for new functionality?

- **Create feature requests** on GitHub
- **Explain the use case** - why would this be helpful?
- **Describe the expected behavior**
- **Consider implementation complexity**

### 🔌 Create Plugins
Extend the AI companion with new capabilities!

- **Follow the plugin architecture** in `/plugins/`
- **Add documentation** for your plugin
- **Include tests** for reliability
- **Share with the community**

### 📖 Improve Documentation
Help others get started and contribute!

- **Fix typos and errors**
- **Add examples and tutorials**
- **Translate to other languages**
- **Create video guides**

### 💻 Code Contributions
Improve the core application!

- **Fix bugs** and performance issues
- **Add new features** from the roadmap
- **Improve UI/UX** design
- **Optimize performance**
- **Enhance security**

## 🚀 Getting Started

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/Lackadaisical-Security/lackadaisical-ai-chat.git
   cd lackadaisical-ai-chat
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd backend && npm install && cd ..
   cd frontend && npm install && cd ..
   ```

3. **Setup Development Environment**
   ```bash
   # Copy environment template
   cp env.example .env
   
   # Install development tools
   npm run dev:setup
   ```

4. **Start Development Servers**
   ```bash
   # Start both backend and frontend in development mode
   npm run dev
   
   # Or start separately:
   cd backend && npm run dev &
   cd frontend && npm run dev &
   ```

5. **Verify Setup**
   - Backend: http://localhost:3001
   - Frontend: http://localhost:3000
   - Both should be running without errors

### Development Tools

**Code Quality:**
- **ESLint** - Code linting and style checking
- **Prettier** - Code formatting
- **TypeScript** - Type checking
- **Husky** - Pre-commit hooks

**Testing:**
- **Jest** - Unit testing framework
- **React Testing Library** - Frontend component testing
- **Supertest** - API endpoint testing

**Development:**
- **Nodemon** - Auto-restart backend on changes
- **Vite** - Fast frontend development server
- **VS Code settings** - Recommended extensions and settings

## 📋 Development Guidelines

### Code Style

**TypeScript/JavaScript:**
```typescript
// Use descriptive names
const userMessage = 'Hello AI friend';

// Use proper types
interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  role: 'user' | 'assistant';
}

// Use async/await over promises
async function sendMessage(message: string): Promise<ChatMessage> {
  const response = await aiService.generateResponse(message);
  return response;
}
```

**React Components:**
```tsx
// Use functional components with hooks
import React, { useState, useEffect } from 'react';

interface ChatProps {
  sessionId: string;
  onMessageSent: (message: string) => void;
}

export const Chat: React.FC<ChatProps> = ({ sessionId, onMessageSent }) => {
  const [message, setMessage] = useState('');
  
  return (
    <div className="chat-container">
      {/* Component JSX */}
    </div>
  );
};
```

**Backend Services:**
```typescript
// Use dependency injection
export class MemoryService {
  constructor(
    private db: DatabaseService,
    private logger: Logger
  ) {}
  
  async saveMemory(sessionId: string, content: string): Promise<void> {
    // Implementation
  }
}
```

### Git Workflow

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write clean, documented code
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   npm run test          # Run all tests
   npm run lint          # Check code style
   npm run type-check    # Verify TypeScript
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add new memory recall feature"
   ```

5. **Push and Create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Convention

We use conventional commits for clear history:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add voice chat functionality
fix: resolve memory leak in conversation service
docs: update installation guide for Windows
style: format code with prettier
refactor: improve database query performance
test: add unit tests for memory service
chore: update dependencies to latest versions
```

## 🔌 Plugin Development

### Plugin Structure

```
plugins/
├── your-plugin/
│   ├── index.ts          # Main plugin file
│   ├── package.json      # Plugin metadata
│   ├── README.md         # Plugin documentation
│   ├── config.json       # Plugin configuration
│   └── tests/           # Plugin tests
```

### Basic Plugin Template

```typescript
import { Plugin, PluginContext } from '../types/Plugin';

export default class YourPlugin implements Plugin {
  name = 'your-plugin';
  version = '1.0.0';
  description = 'Your plugin description';

  async initialize(context: PluginContext): Promise<void> {
    // Plugin initialization logic
  }

  async onMessage(message: string, context: PluginContext): Promise<string | null> {
    // Handle incoming messages
    if (message.includes('/your-command')) {
      return 'Your plugin response';
    }
    return null;
  }

  async onShutdown(): Promise<void> {
    // Cleanup logic
  }
}
```

### Plugin Configuration

```json
{
  "name": "your-plugin",
  "version": "1.0.0",
  "description": "Your plugin description",
  "author": "Your Name",
  "license": "MIT",
  "main": "index.ts",
  "keywords": ["ai", "chat", "plugin"],
  "permissions": ["network", "storage"],
  "settings": {
    "apiKey": {
      "type": "string",
      "description": "API key for external service",
      "required": false
    }
  }
}
```

### Plugin Guidelines

1. **Follow naming conventions** - Use kebab-case for plugin names
2. **Include comprehensive documentation** - README with setup and usage
3. **Add error handling** - Graceful failure and recovery
4. **Respect user privacy** - No unauthorized data collection
5. **Test thoroughly** - Unit tests and integration tests
6. **Use semantic versioning** - Proper version management

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Writing Tests

**Unit Tests (Jest):**
```typescript
import { MemoryService } from '../src/services/MemoryService';
import { MockDatabaseService } from './mocks/DatabaseService';

describe('MemoryService', () => {
  let memoryService: MemoryService;
  let mockDb: MockDatabaseService;

  beforeEach(() => {
    mockDb = new MockDatabaseService();
    memoryService = new MemoryService(mockDb);
  });

  test('should save memory correctly', async () => {
    const sessionId = 'test-session';
    const content = 'Test memory content';

    await memoryService.saveMemory(sessionId, content);

    expect(mockDb.saveMemory).toHaveBeenCalledWith(sessionId, content);
  });
});
```

**React Component Tests:**
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Chat } from '../src/components/Chat';

describe('Chat Component', () => {
  test('sends message when button clicked', () => {
    const mockOnMessageSent = jest.fn();
    render(<Chat sessionId="test" onMessageSent={mockOnMessageSent} />);

    const input = screen.getByPlaceholderText('Type your message...');
    const button = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Hello AI' } });
    fireEvent.click(button);

    expect(mockOnMessageSent).toHaveBeenCalledWith('Hello AI');
  });
});
```

## 🎨 UI/UX Guidelines

### Design Principles

1. **User-Friendly** - Intuitive and accessible interface
2. **Privacy-Focused** - Clear privacy controls and indicators
3. **Responsive** - Works well on all device sizes
4. **Consistent** - Uniform design language throughout
5. **Accessible** - WCAG 2.1 AA compliance

### Component Guidelines

**Use Tailwind CSS classes:**
```tsx
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
    Chat with Your AI Friend
  </h2>
</div>
```

**Follow accessibility best practices:**
```tsx
<button
  className="btn btn-primary"
  aria-label="Send message to AI companion"
  disabled={!message.trim()}
>
  Send Message
</button>
```

**Use semantic HTML:**
```tsx
<main role="main">
  <section aria-labelledby="chat-heading">
    <h1 id="chat-heading">AI Companion Chat</h1>
    {/* Chat content */}
  </section>
</main>
```

## 📦 Release Process

### Version Management

We use semantic versioning (SemVer):
- **Major** (1.0.0) - Breaking changes
- **Minor** (1.1.0) - New features, backward compatible
- **Patch** (1.0.1) - Bug fixes, backward compatible

### Release Checklist

1. **Update version numbers** in package.json files
2. **Update CHANGELOG.md** with new features and fixes
3. **Run full test suite** and ensure all tests pass
4. **Update documentation** for any API changes
5. **Create release branch** and submit PR
6. **Tag release** after PR is merged
7. **Publish release** with detailed notes

## 🤝 Community Guidelines

### Code of Conduct

- **Be respectful** - Treat everyone with kindness and respect
- **Be inclusive** - Welcome contributors from all backgrounds
- **Be collaborative** - Work together toward common goals
- **Be constructive** - Provide helpful feedback and suggestions
- **Be patient** - Remember that everyone is learning

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and discussions
- **Discord Server** - Real-time community chat
- **Email** - Private or sensitive communications

### Recognition

We value all contributions! Contributors will be:

- **Listed in CONTRIBUTORS.md** - Recognition for all contributors
- **Mentioned in release notes** - Credit for significant contributions
- **Invited to maintainer team** - For ongoing, high-quality contributions
- **Featured in blog posts** - Highlighting community achievements

## 🎯 Current Priorities

### High Priority
- [ ] Plugin management UI
- [ ] Voice chat integration
- [ ] Mobile app development
- [ ] Performance optimizations
- [ ] Advanced memory features

### Medium Priority
- [ ] Multi-language support
- [ ] Advanced theming system
- [ ] Analytics dashboard
- [ ] Export/import features
- [ ] Community plugin marketplace

### Long Term
- [ ] Collaborative AI companions
- [ ] Custom AI model training
- [ ] Enterprise features
- [ ] Research partnerships

## 💝 Thank You

Every contribution, no matter how small, helps make AI companionship more accessible and privacy-respecting for everyone. Thank you for being part of this journey!

**Together, we're building the future of AI friendship.** 🤖❤️

---

## Quick Links

- 🏠 [Main README](README-RELEASE.md)
- 🔧 [Installation Guide](INSTALL.md)
- 🐛 [Troubleshooting](TROUBLESHOOTING.md)
- 📋 [Changelog](CHANGELOG.md)
- 📄 [License](LICENSE)
- 💬 [Discord Community](https://discord.gg/nyyXufEpeE)

**Questions?** Create an issue or join our Discord server!
