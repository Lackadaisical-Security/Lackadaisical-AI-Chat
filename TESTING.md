# Testing Guide 🧪

> **Comprehensive testing strategies for Lackadaisical AI Chat**

This guide covers everything you need to know about testing the Lackadaisical AI Chat frontend, from unit tests to end-to-end testing, accessibility testing, and performance monitoring.

---

**🔍 Unit Testing • 🧩 Integration Testing • 🎯 Component Testing • ♿ Accessibility Testing • ⚡ Performance Testing**

---

## 🎯 **Testing Philosophy**

### **Why We Test**
- **Quality Assurance**: Ensure features work as expected
- **Regression Prevention**: Catch bugs before they reach users
- **Refactoring Confidence**: Make changes safely with test coverage
- **Documentation**: Tests serve as living documentation
- **User Experience**: Ensure accessibility and performance

### **Testing Principles**
- **Test Behavior, Not Implementation**: Focus on what the code does, not how
- **Fast and Reliable**: Tests should be quick and deterministic
- **Comprehensive Coverage**: Aim for 95%+ coverage on critical paths
- **Accessibility First**: Ensure all features are accessible
- **Performance Aware**: Monitor and test performance characteristics

---

## 🛠️ **Testing Stack**

### **Core Testing Tools**
- **Jest**: JavaScript testing framework for unit and integration tests
- **React Testing Library**: Component testing with user-centric approach
- **@testing-library/jest-dom**: Custom Jest matchers for DOM testing
- **@testing-library/user-event**: Advanced user interaction simulation
- **@testing-library/react-hooks**: Testing custom React hooks
- **MSW (Mock Service Worker)**: API mocking for integration tests

### **Additional Tools**
- **Playwright**: End-to-end testing for complete user workflows
- **Lighthouse CI**: Performance and accessibility testing
- **Storybook**: Component development and visual testing
- **Jest Coverage**: Code coverage reporting and analysis

---

## 🚀 **Quick Start**

### **Installation**
```bash
# Install dependencies
cd frontend
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- MessageBubble.test.tsx
```

### **Test Scripts**
```bash
# Development
npm run test:watch          # Watch mode for development
npm run test:coverage       # Coverage report
npm run test:update         # Update snapshots

# CI/CD
npm run test:ci            # CI-optimized test run
npm run test:coverage:ci   # Coverage for CI
npm run test:e2e           # End-to-end tests
npm run test:accessibility # Accessibility tests
```

---

## 📁 **Test Structure**

### **Directory Organization**
```
tests/
├── components/           # Component tests
│   ├── Chat/
│   │   ├── ChatInterface.test.tsx
│   │   ├── MessageBubble.test.tsx
│   │   ├── ChatInput.test.tsx
│   │   └── ChatSidebar.test.tsx
│   ├── Journal/
│   │   └── JournalInterface.test.tsx
│   ├── Plugins/
│   │   └── PluginInterface.test.tsx
│   ├── Settings/
│   │   └── SettingsInterface.test.tsx
│   └── ui/
│       └── Button.test.tsx
├── store/               # State management tests
│   ├── index.test.ts
│   ├── chat.test.ts
│   ├── journal.test.ts
│   └── plugins.test.ts
├── services/            # API and service tests
│   ├── api.test.ts
│   ├── websocket.test.ts
│   └── storage.test.ts
├── hooks/               # Custom hook tests
│   ├── useChat.test.ts
│   ├── useJournal.test.ts
│   └── usePlugins.test.ts
├── utils/               # Utility function tests
│   ├── cn.test.ts
│   ├── validation.test.ts
│   └── formatting.test.ts
├── integration/         # Integration tests
│   ├── chat-flow.test.ts
│   ├── journal-flow.test.ts
│   └── plugin-flow.test.ts
├── e2e/                 # End-to-end tests
│   ├── chat.spec.ts
│   ├── journal.spec.ts
│   └── settings.spec.ts
└── __mocks__/           # Mock files
    ├── api.ts
    ├── websocket.ts
    └── storage.ts
```

---

## 🧩 **Component Testing**

### **Testing Philosophy**
We use React Testing Library's guiding principle: **"The more your tests resemble the way your software is used, the more confidence they can give you."**

### **Example Component Test**
```typescript
// MessageBubble.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageBubble from '../MessageBubble';

describe('MessageBubble', () => {
  const mockMessage = {
    id: '1',
    content: 'Hello, world!',
    role: 'user' as const,
    timestamp: '2025-01-25T10:00:00Z',
  };

  it('renders message content correctly', () => {
    render(<MessageBubble message={mockMessage} />);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('displays correct timestamp', () => {
    render(<MessageBubble message={mockMessage} />);
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
  });

  it('shows copy button on hover', async () => {
    const user = userEvent.setup();
    render(<MessageBubble message={mockMessage} />);
    
    const messageContainer = screen.getByRole('article');
    await user.hover(messageContainer);
    
    expect(screen.getByTitle('Copy message')).toBeInTheDocument();
  });

  it('copies message to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup();
    const mockCopy = jest.fn();
    Object.assign(navigator, { clipboard: { writeText: mockCopy } });
    
    render(<MessageBubble message={mockMessage} />);
    
    const messageContainer = screen.getByRole('article');
    await user.hover(messageContainer);
    
    const copyButton = screen.getByTitle('Copy message');
    await user.click(copyButton);
    
    expect(mockCopy).toHaveBeenCalledWith('Hello, world!');
  });

  it('displays sentiment analysis when available', () => {
    const messageWithSentiment = {
      ...mockMessage,
      sentiment: {
        score: 0.8,
        label: 'positive' as const,
        confidence: 0.95,
      },
    };

    render(<MessageBubble message={messageWithSentiment} />);
    expect(screen.getByText(/positive/)).toBeInTheDocument();
    expect(screen.getByText(/95%/)).toBeInTheDocument();
  });
});
```

### **Testing Best Practices**

#### **User-Centric Testing**
```typescript
// ❌ Don't test implementation details
expect(component.state.isOpen).toBe(true);

// ✅ Do test user behavior
expect(screen.getByText('Settings')).toBeVisible();
```

#### **Accessibility Testing**
```typescript
it('is accessible', () => {
  const { container } = render(<MessageBubble message={mockMessage} />);
  expect(container).toBeAccessible();
});

it('supports keyboard navigation', async () => {
  const user = userEvent.setup();
  render(<MessageBubble message={mockMessage} />);
  
  // Tab to interactive elements
  await user.tab();
  expect(screen.getByTitle('Copy message')).toHaveFocus();
});
```

#### **Error Handling**
```typescript
it('handles copy failure gracefully', async () => {
  const user = userEvent.setup();
  const mockCopy = jest.fn().mockRejectedValue(new Error('Copy failed'));
  Object.assign(navigator, { clipboard: { writeText: mockCopy } });
  
  render(<MessageBubble message={mockMessage} />);
  
  const messageContainer = screen.getByRole('article');
  await user.hover(messageContainer);
  
  const copyButton = screen.getByTitle('Copy message');
  await user.click(copyButton);
  
  // Should show error toast or handle gracefully
  expect(screen.getByText(/failed to copy/i)).toBeInTheDocument();
});
```

---

## 🏪 **Store Testing**

### **Zustand Store Testing**
```typescript
// store/index.test.ts
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '../store';

describe('App Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useAppStore.getState().clearAll();
    });
  });

  describe('Chat Actions', () => {
    it('adds a new message', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.addMessage({
          id: '1',
          content: 'Test message',
          role: 'user',
          timestamp: new Date().toISOString(),
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Test message');
    });

    it('updates assistant message content', () => {
      const { result } = renderHook(() => useAppStore());
      
      // Add user message
      act(() => {
        result.current.addMessage({
          id: '1',
          content: 'Hello',
          role: 'user',
          timestamp: new Date().toISOString(),
        });
      });

      // Add assistant message
      act(() => {
        result.current.addMessage({
          id: '2',
          content: '',
          role: 'assistant',
          timestamp: new Date().toISOString(),
        });
      });

      // Update assistant message
      act(() => {
        result.current.updateAssistantMessage('Hello there!');
      });

      expect(result.current.messages[1].content).toBe('Hello there!');
    });

    it('manages streaming state', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.setIsStreaming(true);
      });

      expect(result.current.isStreaming).toBe(true);

      act(() => {
        result.current.setIsStreaming(false);
      });

      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('Context Management', () => {
    it('fetches and stores context', async () => {
      const { result } = renderHook(() => useAppStore());
      
      // Mock API response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ context: ['test context'] }),
      });

      await act(async () => {
        await result.current.fetchContext('session-1');
      });

      expect(result.current.contextWindow).toEqual(['test context']);
      expect(result.current.contextLoading).toBe(false);
    });

    it('handles context fetch errors', async () => {
      const { result } = renderHook(() => useAppStore());
      
      // Mock API error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await result.current.fetchContext('session-1');
      });

      expect(result.current.contextError).toBe('Network error');
      expect(result.current.contextLoading).toBe(false);
    });
  });
});
```

---

## 🔌 **Service Testing**

### **API Service Testing**
```typescript
// services/api.test.ts
import { apiService } from './api';

// Mock fetch globally
global.fetch = jest.fn();

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Chat Endpoints', () => {
    it('sends messages successfully', async () => {
      const mockResponse = {
        success: true,
        data: { id: '1', content: 'Response', role: 'assistant' },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiService.sendMessage('Hello', 'session-1');
      
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            message: 'Hello',
            session_id: 'session-1',
          }),
        })
      );
    });

    it('handles API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(apiService.sendMessage('Hello')).rejects.toThrow();
    });
  });

  describe('Session Management', () => {
    it('creates new sessions', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString(),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockSession }),
      });

      const result = await apiService.createSession('New Chat');
      
      expect(result.data).toEqual(mockSession);
    });
  });
});
```

---

## ♿ **Accessibility Testing**

### **Automated Accessibility Testing**
```typescript
// accessibility.test.ts
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ChatInterface from '../components/Chat/ChatInterface';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<ChatInterface />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);
    
    // Test tab navigation
    await user.tab();
    expect(screen.getByRole('textbox')).toHaveFocus();
    
    await user.tab();
    expect(screen.getByRole('button', { name: /send/i })).toHaveFocus();
  });

  it('announces dynamic content changes', () => {
    render(<ChatInterface />);
    
    // Test ARIA live regions
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toBeInTheDocument();
  });
});
```

### **Manual Accessibility Checklist**
- [ ] **Keyboard Navigation**: All interactive elements accessible via keyboard
- [ ] **Screen Reader Support**: Proper ARIA labels and semantic HTML
- [ ] **Color Contrast**: Sufficient contrast ratios (WCAG AA compliant)
- [ ] **Focus Management**: Clear focus indicators and logical tab order
- [ ] **Alternative Text**: Images have descriptive alt text
- [ ] **Form Labels**: All form inputs have associated labels
- [ ] **Error Messages**: Clear, accessible error messages
- [ ] **Dynamic Content**: ARIA live regions for dynamic updates

---

## ⚡ **Performance Testing**

### **Component Performance Testing**
```typescript
// performance.test.ts
import { render } from '@testing-library/react';
import { performance } from 'perf_hooks';
import ChatInterface from '../components/Chat/ChatInterface';

describe('Performance', () => {
  it('renders within performance budget', () => {
    const startTime = performance.now();
    
    render(<ChatInterface />);
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Should render in under 100ms
    expect(renderTime).toBeLessThan(100);
  });

  it('handles large message lists efficiently', () => {
    const largeMessageList = Array.from({ length: 1000 }, (_, i) => ({
      id: `msg-${i}`,
      content: `Message ${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      timestamp: new Date().toISOString(),
    }));

    const startTime = performance.now();
    
    render(<ChatInterface messages={largeMessageList} />);
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Should handle 1000 messages in under 500ms
    expect(renderTime).toBeLessThan(500);
  });
});
```

### **Bundle Size Testing**
```typescript
// bundle-size.test.ts
import { getBundleSize } from '../utils/bundle-analyzer';

describe('Bundle Size', () => {
  it('main bundle is under size limit', () => {
    const bundleSize = getBundleSize('main');
    expect(bundleSize).toBeLessThan(500 * 1024); // 500KB
  });

  it('vendor bundle is under size limit', () => {
    const bundleSize = getBundleSize('vendor');
    expect(bundleSize).toBeLessThan(1000 * 1024); // 1MB
  });
});
```

---

## 🔄 **Integration Testing**

### **Chat Flow Testing**
```typescript
// integration/chat-flow.test.ts
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '../../components/Chat/ChatInterface';

describe('Chat Flow Integration', () => {
  it('completes full chat interaction', async () => {
    const user = userEvent.setup();
    
    // Mock API responses
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'session-1', name: 'New Chat' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'msg-1', content: 'AI Response', role: 'assistant' },
        }),
      });

    render(<ChatInterface />);

    // Create new session
    const newChatButton = screen.getByRole('button', { name: /new chat/i });
    await user.click(newChatButton);

    // Type and send message
    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello, AI!');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    // Verify message appears
    await waitFor(() => {
      expect(screen.getByText('Hello, AI!')).toBeInTheDocument();
    });

    // Verify AI response
    await waitFor(() => {
      expect(screen.getByText('AI Response')).toBeInTheDocument();
    });
  });
});
```

---

## 🎭 **Mocking Strategies**

### **API Mocking**
```typescript
// __mocks__/api.ts
export const mockApiResponses = {
  chat: {
    success: {
      success: true,
      data: {
        id: 'msg-1',
        content: 'AI response',
        role: 'assistant',
        timestamp: new Date().toISOString(),
      },
    },
    error: {
      success: false,
      error: 'API Error',
    },
  },
  sessions: {
    list: {
      success: true,
      data: [
        { id: 'session-1', name: 'Chat 1', messages: [] },
        { id: 'session-2', name: 'Chat 2', messages: [] },
      ],
    },
  },
};

export const mockFetch = (response: any) => {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(response),
  });
};
```

### **WebSocket Mocking**
```typescript
// __mocks__/websocket.ts
export class MockWebSocket {
  public readyState = WebSocket.CONNECTING;
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string) {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 0);
  }

  send(data: string) {
    // Mock sending data
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

global.WebSocket = MockWebSocket as any;
```

---

## 📊 **Coverage Reporting**

### **Coverage Configuration**
```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
};
```

### **Coverage Analysis**
```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/lcov-report/index.html

# Check coverage thresholds
npm run test:coverage:check
```

---

## 🚀 **CI/CD Integration**

### **GitHub Actions Workflow**
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test:ci
    
    - name: Run coverage
      run: npm run test:coverage:ci
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

---

## 🐛 **Debugging Tests**

### **Common Issues and Solutions**

#### **Async Testing**
```typescript
// ❌ Don't forget to await
it('updates state', () => {
  act(() => {
    result.current.fetchData();
  });
  expect(result.current.data).toBeDefined(); // This might fail
});

// ✅ Do await properly
it('updates state', async () => {
  await act(async () => {
    await result.current.fetchData();
  });
  expect(result.current.data).toBeDefined();
});
```

#### **Mock Cleanup**
```typescript
// Always clean up mocks
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

#### **Testing User Interactions**
```typescript
// Use userEvent for realistic interactions
const user = userEvent.setup();

await user.click(button);
await user.type(input, 'text');
await user.keyboard('{Enter}');
```

---

## 📚 **Testing Resources**

### **Documentation**
- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Accessibility](https://testing-library.com/docs/guide-disability-testing/)
- [MSW Documentation](https://mswjs.io/docs/)

### **Best Practices**
- [Kent C. Dodds Testing Blog](https://kentcdodds.com/blog/write-tests)
- [Testing Library Guiding Principles](https://testing-library.com/docs/guiding-principles)
- [Accessibility Testing Guide](https://www.w3.org/WAI/ER/tools/)

---

## 🤝 **Contributing to Tests**

### **When Adding Tests**
1. **Write tests for new features** before or alongside implementation
2. **Update existing tests** when changing functionality
3. **Add integration tests** for complex user workflows
4. **Test error cases** and edge conditions
5. **Ensure accessibility** in all new components

### **Test Review Checklist**
- [ ] Tests are user-centric and test behavior, not implementation
- [ ] All code paths are covered (happy path, error cases, edge cases)
- [ ] Tests are fast and reliable (no flaky tests)
- [ ] Accessibility is tested for new components
- [ ] Performance is considered for complex operations
- [ ] Mocks are used appropriately and cleaned up

---

**Built with ❤️ by [Lackadaisical Security](https://lackadaisical-security.com)**

*"Quality is not an act, it is a habit."*
