
# Contributing to Lackadaisical AI Chat 🤝

> **Join us in building the future of privacy-first AI companionship**

We welcome contributions from developers, designers, security researchers, and community members! This guide will help you get started and ensure your contributions align with our project goals.

---

**🚀 Getting Started • 📝 Code Standards • 🧪 Testing • 🔒 Security • 🤝 Community**

---

## 🌟 **Why Contribute?**

### **Our Mission**
Lackadaisical AI Chat is more than just another chat application—it's a movement toward privacy-first, user-controlled AI experiences. By contributing, you're helping to:

- **🔒 Protect Privacy**: Ensure users maintain control over their data
- **🧠 Advance AI**: Build intelligent, personality-driven AI companions
- **🌐 Open Source**: Create accessible, transparent AI technology
- **🤝 Community**: Build a supportive, inclusive developer community
- **🔬 Innovation**: Push the boundaries of what's possible with local AI

### **What We Value**
- **Privacy First**: Every feature must respect user privacy
- **Quality Code**: Clean, maintainable, and well-tested code
- **User Experience**: Intuitive, accessible, and beautiful interfaces
- **Security**: Robust security practices and vulnerability prevention
- **Documentation**: Clear, comprehensive documentation
- **Inclusivity**: Welcoming environment for all contributors

---

## 🚀 **Getting Started**

### **Prerequisites**
- **Node.js** v18+ (LTS recommended)
- **npm** v9+ or **yarn** v1.22+
- **Git** for version control
- **Code Editor**: VS Code, WebStorm, or your preferred editor
- **Browser**: Chrome, Firefox, Safari, or Edge for testing

### **Development Setup**

1. **Fork the Repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/lackadaisical-ai-chat.git
   cd lackadaisical-ai-chat
   ```

2. **Set Up Development Environment**
   ```bash
   # Install dependencies
   cd frontend
   npm install
   
   cd ../backend
   npm install
   ```

3. **Configure Environment**
   ```bash
   # Copy environment files
   cp env.example .env
   cp frontend/.env.example frontend/.env
   
   # Edit configuration files
   # See env.example for required variables
   ```

4. **Start Development Servers**
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run dev
   
   # Terminal 2: Frontend
   cd frontend
   npm run dev
   ```

5. **Verify Setup**
   - Backend: http://localhost:3001/health
   - Frontend: http://localhost:5173
   - Tests: `npm test` (both directories)

---

## 📝 **Development Workflow**

### **Branch Strategy**
```bash
# Create feature branch
git checkout -b feature/amazing-feature

# Or for bug fixes
git checkout -b fix/bug-description

# Or for documentation
git checkout -b docs/update-readme
```

### **Commit Message Convention**
We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Feature
feat: add dark mode toggle to settings

# Bug fix
fix: resolve memory leak in chat interface

# Documentation
docs: update API documentation

# Style changes
style: format code with prettier

# Refactoring
refactor: extract chat logic into custom hook

# Performance
perf: optimize message rendering

# Test
test: add unit tests for message validation

# Chore
chore: update dependencies
```

### **Pull Request Process**

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write clean, well-documented code
   - Add tests for new functionality
   - Update documentation as needed
   - Follow our coding standards

3. **Test Your Changes**
   ```bash
   # Run all tests
   npm test
   
   # Run linting
   npm run lint
   
   # Check types
   npm run type-check
   
   # Build for production
   npm run build
   ```

4. **Commit and Push**
   ```bash
   git add .
   git commit -m "feat: add amazing new feature"
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**
   - Use our PR template
   - Describe your changes clearly
   - Link related issues
   - Request reviews from maintainers

---

## 🎨 **Code Standards**

### **TypeScript Guidelines**
```typescript
// ✅ Good: Clear types and interfaces
interface UserSettings {
  theme: 'light' | 'dark' | 'retro' | 'terminal' | 'matrix';
  autoSave: boolean;
  notifications: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

// ✅ Good: Proper error handling
const handleApiCall = async (): Promise<ApiResponse> => {
  try {
    const response = await api.getData();
    return { success: true, data: response };
  } catch (error) {
    logger.error('API call failed', { error });
    return { success: false, error: error.message };
  }
};

// ❌ Avoid: Any types
const processData = (data: any) => {
  // Implementation
};

// ✅ Good: Specific types
const processData = (data: UserData) => {
  // Implementation
};
```

### **React Component Standards**
```typescript
// ✅ Good: Functional components with hooks
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
}) => {
  const [message, setMessage] = useState('');
  const { isStreaming } = useAppStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="chat-input">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || isStreaming}
        className="input input-bordered w-full"
      />
      <button
        type="submit"
        disabled={disabled || isStreaming || !message.trim()}
        className="btn btn-primary"
      >
        Send
      </button>
    </form>
  );
};
```

### **CSS/Styling Standards**
```css
/* ✅ Good: Use Tailwind CSS classes */
.chat-container {
  @apply flex flex-col h-full bg-base-100;
}

.message-bubble {
  @apply p-4 rounded-lg border border-base-300;
}

/* ✅ Good: Custom CSS when needed */
.custom-animation {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ❌ Avoid: Inline styles */
<div style={{ color: 'red', fontSize: '16px' }}>Text</div>

/* ✅ Good: Tailwind classes */
<div className="text-red-500 text-base">Text</div>
```

---

## 🧪 **Testing Standards**

### **Component Testing**
```typescript
// ✅ Good: Test user behavior, not implementation
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  it('sends message when form is submitted', async () => {
    const user = userEvent.setup();
    const mockOnSend = jest.fn();
    
    render(<ChatInput onSend={mockOnSend} />);
    
    const input = screen.getByRole('textbox');
    const button = screen.getByRole('button', { name: /send/i });
    
    await user.type(input, 'Hello, world!');
    await user.click(button);
    
    expect(mockOnSend).toHaveBeenCalledWith('Hello, world!');
  });

  it('disables input when streaming', () => {
    render(<ChatInput onSend={jest.fn()} disabled={true} />);
    
    const input = screen.getByRole('textbox');
    const button = screen.getByRole('button', { name: /send/i });
    
    expect(input).toBeDisabled();
    expect(button).toBeDisabled();
  });
});
```

### **Store Testing**
```typescript
// ✅ Good: Test store actions and state
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '../store';

describe('App Store', () => {
  beforeEach(() => {
    act(() => {
      useAppStore.getState().clearAll();
    });
  });

  it('adds message to store', () => {
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
});
```

### **API Testing**
```typescript
// ✅ Good: Mock API calls and test responses
import { apiService } from '../services/api';

// Mock fetch globally
global.fetch = jest.fn();

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles successful API calls', async () => {
    const mockResponse = { success: true, data: { id: '1' } };
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await apiService.sendMessage('Hello');
    expect(result).toEqual(mockResponse);
  });

  it('handles API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    await expect(apiService.sendMessage('Hello')).rejects.toThrow('Network error');
  });
});
```

---

## 🔒 **Security Guidelines**

### **Input Validation**
```typescript
// ✅ Good: Always validate and sanitize input
import DOMPurify from 'dompurify';

const validateMessage = (message: string): ValidationResult => {
  // Sanitize HTML
  const sanitized = DOMPurify.sanitize(message);
  
  // Check length
  if (sanitized.length > 4000) {
    return { isValid: false, error: 'Message too long' };
  }
  
  // Check for malicious patterns
  const maliciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];
  
  for (const pattern of maliciousPatterns) {
    if (pattern.test(sanitized)) {
      return { isValid: false, error: 'Invalid content detected' };
    }
  }
  
  return { isValid: true, sanitized };
};
```

### **Authentication & Authorization**
```typescript
// ✅ Good: Implement proper authentication checks
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ✅ Good: Role-based access control
const requireRole = (role: UserRole) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
```

### **Data Protection**
```typescript
// ✅ Good: Encrypt sensitive data
import crypto from 'crypto';

const encryptData = (data: string, key: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes-256-gcm', key);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

const decryptData = (encryptedData: string, key: string): string => {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipher('aes-256-gcm', key);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};
```

---

## 📚 **Documentation Standards**

### **Code Documentation**
```typescript
/**
 * Sends a message to the AI and streams the response
 * 
 * @param message - The user's message to send
 * @param sessionId - Optional session ID for conversation continuity
 * @param options - Additional options for the request
 * @returns Promise that resolves when the message is sent
 * 
 * @example
 * ```typescript
 * await sendMessage('Hello, AI!', 'session-123', {
 *   temperature: 0.7,
 *   maxTokens: 1000
 * });
 * ```
 * 
 * @throws {ApiError} When the API request fails
 * @throws {ValidationError} When the message is invalid
 */
export const sendMessage = async (
  message: string,
  sessionId?: string,
  options: MessageOptions = {}
): Promise<void> => {
  // Implementation
};
```

### **README Updates**
When adding new features, update the relevant documentation:

1. **Main README**: Update feature list and examples
2. **Component README**: Document new components
3. **API Documentation**: Update API endpoints
4. **User Guide**: Add usage instructions
5. **Changelog**: Document changes

---

## 🤝 **Community Guidelines**

### **Code of Conduct**
We are committed to providing a welcoming and inclusive environment for all contributors. By participating, you agree to:

- **Be Respectful**: Treat everyone with respect and dignity
- **Be Inclusive**: Welcome contributors from all backgrounds
- **Be Constructive**: Provide helpful, constructive feedback
- **Be Patient**: Understand that everyone learns at their own pace
- **Be Professional**: Maintain professional behavior in all interactions

### **Communication Channels**
- **💬 Discussions**: [GitHub Discussions](https://github.com/lackadaisical-security/lackadaisical-ai-chat/discussions)
- **🐛 Issues**: [GitHub Issues](https://github.com/lackadaisical-security/lackadaisical-ai-chat/issues)
- **📧 Email**: contribute@lackadaisical-security.com
- **💻 Discord**: [Join our Discord server](https://discord.gg/lackadaisical)

### **Getting Help**
- **📖 Documentation**: Check our comprehensive documentation
- **🔍 Search**: Search existing issues and discussions
- **❓ Questions**: Ask questions in GitHub Discussions
- **🐛 Bugs**: Report bugs with detailed information
- **💡 Ideas**: Share feature ideas and improvements

---

## 🏆 **Recognition & Rewards**

### **Contributor Recognition**
- **🌟 Hall of Fame**: Featured contributors on our website
- **📜 Certificates**: Digital certificates for significant contributions
- **🎁 Swag**: Limited edition merchandise for top contributors
- **📢 Social Media**: Recognition on our social media channels
- **🤝 Networking**: Invitations to exclusive events and meetups

### **Contribution Levels**
- **🥉 Bronze**: 1-5 contributions
- **🥈 Silver**: 6-20 contributions
- **🥇 Gold**: 21-50 contributions
- **💎 Diamond**: 50+ contributions
- **👑 Legend**: Exceptional contributions and leadership

### **Special Recognition**
- **🔒 Security**: Security researchers and vulnerability reporters
- **📚 Documentation**: Documentation writers and maintainers
- **🎨 Design**: UI/UX designers and accessibility advocates
- **🧪 Testing**: Test writers and quality assurance contributors
- **🌐 Community**: Community organizers and mentors

---

## 📋 **Contribution Checklist**

### **Before Submitting**
- [ ] **Code Quality**: Code follows our standards and best practices
- [ ] **Testing**: All new code has appropriate tests
- [ ] **Documentation**: Code is well-documented
- [ ] **Security**: Security implications have been considered
- [ ] **Accessibility**: Features are accessible to all users
- [ ] **Performance**: Changes don't negatively impact performance
- [ ] **Compatibility**: Changes work across supported platforms

### **Pull Request Checklist**
- [ ] **Clear Description**: PR description explains the changes
- [ ] **Related Issues**: Links to related issues or discussions
- [ ] **Tests Pass**: All tests pass locally and in CI
- [ ] **Linting**: Code passes linting checks
- [ ] **Type Checking**: TypeScript compilation succeeds
- [ ] **Build Success**: Production build completes successfully
- [ ] **Screenshots**: UI changes include before/after screenshots

### **Review Process**
- [ ] **Self Review**: Review your own code before submitting
- [ ] **Peer Review**: Request reviews from team members
- [ ] **Address Feedback**: Respond to review comments
- [ ] **Update PR**: Make requested changes
- [ ] **Final Approval**: Get approval from maintainers
- [ ] **Merge**: Maintainers merge the PR

---

## 🚀 **Advanced Contributing**

### **Plugin Development**
```typescript
// Example plugin structure
export interface PluginResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

export default async function myPlugin(
  input: string,
  context: any
): Promise<PluginResult> {
  const startTime = Date.now();
  
  try {
    // Your plugin logic here
    const result = await processInput(input);
    
    return {
      success: true,
      data: result,
      executionTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      executionTime: Date.now() - startTime
    };
  }
}
```

### **Theme Development**
```css
/* Custom theme example */
[data-theme="custom"] {
  --primary: #6366f1;
  --primary-focus: #4f46e5;
  --primary-content: #ffffff;
  
  --secondary: #f59e0b;
  --secondary-focus: #d97706;
  --secondary-content: #ffffff;
  
  --accent: #10b981;
  --accent-focus: #059669;
  --accent-content: #ffffff;
  
  --neutral: #6b7280;
  --neutral-focus: #4b5563;
  --neutral-content: #ffffff;
  
  --base-100: #ffffff;
  --base-200: #f9fafb;
  --base-300: #f3f4f6;
  --base-content: #1f2937;
}
```

### **API Development**
```typescript
// Example API endpoint
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { message, sessionId, options } = req.body;
    
    // Validate input
    const validation = validateMessage(message);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }
    
    // Process message
    const response = await aiService.processMessage(
      validation.sanitized,
      sessionId,
      options
    );
    
    res.json({ success: true, data: response });
  } catch (error) {
    logger.error('Chat API error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## 📞 **Contact & Support**

### **Getting Help**
- **📧 Email**: contribute@lackadaisical-security.com
- **💬 Discord**: [Join our community](https://discord.gg/lackadaisical)
- **🐛 Issues**: [GitHub Issues](https://github.com/lackadaisical-security/lackadaisical-ai-chat/issues)
- **💭 Discussions**: [GitHub Discussions](https://github.com/lackadaisical-security/lackadaisical-ai-chat/discussions)

### **Mentorship Program**
- **👨‍🏫 Mentors**: Experienced contributors available for guidance
- **📚 Resources**: Learning materials and tutorials
- **🤝 Pair Programming**: Collaborative coding sessions
- **📖 Code Reviews**: Detailed feedback on your contributions

---

**Built with ❤️ by [Lackadaisical Security](https://lackadaisical-security.com)**

*"Together, we're building a more private, more intelligent future."*

---

**Last Updated**: July 25, 2025  
**Version**: 1.0.0  
**Next Review**: October 25, 2025
