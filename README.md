
# Lackadaisical AI Chat – Frontend 🎨

> **Beautiful, responsive, and privacy-first React interface for your AI companion**

A modern, feature-rich frontend built with React, TypeScript, and Tailwind CSS. This isn't just another chat interface—it's a complete AI companion experience with personality, memory, and extensibility.

---

**Lackadaisical AI Chat by Lackadaisical Security**  
**https://lackadaisical-security.com**  
**Built: 25/07/2025**

---

## ✨ Features That Matter

### 🎨 **Stunning User Interface**
- **5 Beautiful Themes**: Light, Dark, Retro, Terminal, and Matrix
- **Responsive Design**: Perfect on desktop, tablet, and mobile
- **Real-time Streaming**: Watch AI responses generate live
- **Smooth Animations**: Polished interactions and transitions
- **Accessibility**: WCAG AA compliant with keyboard navigation

### 🧠 **Intelligent Chat Experience**
- **Message Streaming**: Real-time AI response generation
- **Context Management**: View and control session memory
- **Sentiment Analysis**: See emotional intelligence in action
- **File Attachments**: Support for images, documents, and more
- **Voice Messages**: Record and send audio messages

### 📝 **Personal Journal System**
- **AI-Assisted Writing**: Get help with reflective journaling
- **Mood Tracking**: Automatic emotion and sentiment analysis
- **Tag Organization**: Easy categorization and search
- **Export Options**: JSON, CSV, TXT, and Markdown formats
- **Privacy Controls**: Choose what to keep private

### 🔌 **Plugin Ecosystem**
- **Built-in Plugins**: Weather, horoscope, poetry, and more
- **Plugin Management**: Enable, disable, and configure plugins
- **Real-time Execution**: Test plugins with live results
- **Usage Statistics**: Track plugin performance and usage
- **Custom Development**: Easy plugin creation and integration

### ⚙️ **Comprehensive Settings**
- **Theme Customization**: Choose from 5 beautiful themes
- **AI Configuration**: Manage API keys and providers
- **Privacy Controls**: Granular privacy and security settings
- **Import/Export**: Backup and restore your settings
- **Performance Tuning**: Optimize for your device

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ (LTS recommended)
- **npm** v9+ or **yarn** v1.22+
- **Backend Server** running (see main README)

### Installation

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure environment**
   ```bash
   # Create .env file
   cp .env.example .env
   
   # Edit .env with your backend URL
   VITE_API_URL=http://localhost:3001
   VITE_WS_HOST=localhost:3001
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` and start chatting!

---

## 🏗️ Architecture

### **Core Technologies**
- **React 18** with TypeScript for type safety
- **Vite** for lightning-fast development and builds
- **Tailwind CSS** + **DaisyUI** for beautiful, responsive UI
- **Zustand** for lightweight, powerful state management
- **React Router** for seamless navigation

### **State Management**
```typescript
// Zustand store with persistence
interface AppStore {
  // Chat state
  currentSession: ChatSession | null;
  messages: Message[];
  isStreaming: boolean;
  
  // Context/Memory
  contextWindow: any[] | null;
  contextLoading: boolean;
  
  // UI state
  theme: Theme;
  sidebarOpen: boolean;
  
  // Actions
  addMessage: (message: Message) => void;
  setTheme: (theme: Theme) => void;
  fetchContext: (sessionId: string) => Promise<void>;
}
```

### **Component Architecture**
```
src/
├── components/
│   ├── Chat/
│   │   ├── ChatInterface.tsx      # Main chat interface
│   │   ├── MessageBubble.tsx      # Individual message display
│   │   ├── ChatInput.tsx          # Message input with features
│   │   └── ChatSidebar.tsx        # Session management
│   ├── Journal/
│   │   └── JournalInterface.tsx   # Journal management
│   ├── Plugins/
│   │   └── PluginInterface.tsx    # Plugin management
│   ├── Settings/
│   │   └── SettingsInterface.tsx  # Settings panel
│   ├── Layout/
│   │   └── Layout.tsx             # Main layout wrapper
│   └── ui/
│       └── Button.tsx             # Reusable UI components
├── store/
│   └── index.ts                   # Zustand store configuration
├── services/
│   └── api.ts                     # API client and utilities
├── types/
│   └── index.ts                   # TypeScript type definitions
└── utils/
    └── cn.ts                      # Utility functions
```

---

## 🎯 Key Components

### **ChatInterface**
The heart of the application, featuring:
- Real-time message streaming with Server-Sent Events
- Message history with infinite scroll
- Context window management
- Sentiment analysis display
- File attachment support
- Voice message recording

### **MessageBubble**
Individual message display with:
- User/assistant message styling
- Copy, edit, and delete actions
- Sentiment analysis indicators
- Message metadata (timestamp, tokens, response time)
- Accessibility features

### **ChatInput**
Advanced input component with:
- Auto-resizing textarea
- Character limit with validation
- File upload support
- Voice recording capability
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- Input composition handling

### **ChatSidebar**
Session management panel with:
- Session list with search and filtering
- Context window display and management
- Session creation, editing, and deletion
- Real-time session updates
- Mobile-responsive design

### **JournalInterface**
Complete journal management with:
- AI-assisted writing interface
- Mood and emotion tracking
- Tag-based organization
- Export functionality (JSON, CSV, TXT, Markdown)
- Analytics dashboard
- Privacy level controls

### **PluginInterface**
Plugin management system with:
- Plugin listing and status
- Enable/disable functionality
- Configuration management
- Real-time plugin execution
- Usage statistics and analytics
- Plugin development tools

### **SettingsInterface**
Comprehensive settings panel with:
- Theme selection and customization
- AI provider configuration
- Privacy and security controls
- Import/export functionality
- Performance and accessibility options

---

## 🎨 Theming System

### **Available Themes**
- **Light**: Clean, modern interface for daytime use
- **Dark**: Easy on the eyes for nighttime sessions
- **Retro**: Vintage computing aesthetic
- **Terminal**: Command-line inspired design
- **Matrix**: Cyberpunk green theme

### **Theme Customization**
```typescript
// Theme switching
const { theme, setTheme } = useAppStore();

// Apply theme
useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
}, [theme]);
```

### **Custom Theme Development**
```css
/* Custom theme variables */
[data-theme="custom"] {
  --primary: #your-color;
  --secondary: #your-color;
  --accent: #your-color;
  --neutral: #your-color;
  --base-100: #your-color;
  --base-200: #your-color;
  --base-300: #your-color;
}
```

---

## 🔌 Plugin Integration

### **Plugin System Architecture**
```typescript
interface PluginState {
  plugin_name: string;
  enabled: boolean;
  config: Record<string, any>;
  usage_count: number;
  last_used: string | null;
  version: string;
  description: string;
}

interface PluginResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}
```

### **Built-in Plugins**
- **Weather**: Real-time weather information
- **Horoscope**: Daily astrological insights
- **Poetry**: AI-generated creative content
- **Calculator**: Mathematical computations
- **Translator**: Multi-language translation

### **Plugin Development**
```typescript
// Example plugin
export default async function weatherPlugin(
  input: string, 
  context: any
): Promise<PluginResult> {
  const startTime = Date.now();
  
  try {
    const weather = await fetchWeather(input);
    return {
      success: true,
      data: weather,
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

---

## 🧪 Testing

### **Test Setup**
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- MessageBubble.test.tsx
```

### **Test Structure**
```
tests/
├── components/
│   ├── ChatInterface.test.tsx
│   ├── MessageBubble.test.tsx
│   └── ChatInput.test.tsx
├── store/
│   └── index.test.ts
├── services/
│   └── api.test.ts
└── utils/
    └── cn.test.ts
```

### **Testing Best Practices**
- **Component Testing**: Test user interactions and state changes
- **Store Testing**: Test Zustand store actions and state updates
- **API Testing**: Mock API calls and test error handling
- **Accessibility Testing**: Ensure keyboard navigation and screen reader support

---

## 🚀 Performance Optimization

### **Build Optimization**
```bash
# Production build
npm run build

# Analyze bundle size
npm run build:analyze

# Preview production build
npm run preview
```

### **Performance Features**
- **Code Splitting**: Automatic route-based code splitting
- **Lazy Loading**: Components loaded on demand
- **Tree Shaking**: Unused code eliminated from bundle
- **Image Optimization**: Automatic image compression and optimization
- **Caching**: Efficient caching strategies for static assets

### **Performance Monitoring**
```typescript
// Performance monitoring
import { useEffect } from 'react';

useEffect(() => {
  // Monitor component render time
  const startTime = performance.now();
  
  return () => {
    const endTime = performance.now();
    console.log(`Component render time: ${endTime - startTime}ms`);
  };
}, []);
```

---

## 🔧 Configuration

### **Environment Variables**
```bash
# API Configuration
VITE_API_URL=http://localhost:3001
VITE_WS_HOST=localhost:3001

# Feature Flags
VITE_ENABLE_PLUGINS=true
VITE_ENABLE_JOURNAL=true
VITE_ENABLE_ANALYTICS=false

# Development
VITE_DEV_MODE=true
VITE_LOG_LEVEL=debug
```

### **Build Configuration**
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@headlessui/react', 'lucide-react'],
        },
      },
    },
  },
});
```

---

## 🛠️ Development

### **Development Scripts**
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run linter
npm run lint

# Run type checker
npm run type-check

# Format code
npm run format
```

### **Code Quality**
- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting
- **TypeScript**: Type safety and IntelliSense
- **Husky**: Git hooks for pre-commit checks
- **Commitlint**: Conventional commit message validation

### **Development Tools**
- **React DevTools**: Component inspection and debugging
- **Redux DevTools**: State management debugging
- **Vite DevTools**: Build and performance analysis
- **TypeScript**: Type checking and IntelliSense

---

## 📱 Mobile Support

### **Responsive Design**
- **Mobile-First**: Designed for mobile devices first
- **Touch-Friendly**: Optimized for touch interactions
- **Gesture Support**: Swipe gestures for navigation
- **Offline Support**: Works without internet connection
- **PWA Ready**: Progressive Web App capabilities

### **Mobile Features**
- **Sidebar Navigation**: Collapsible sidebar for mobile
- **Touch Gestures**: Swipe to navigate between sections
- **Voice Input**: Voice-to-text for message input
- **Mobile Keyboard**: Optimized for mobile keyboards
- **Battery Optimization**: Efficient power usage

---

## 🔒 Security & Privacy

### **Privacy Features**
- **Local Storage**: All data stored locally by default
- **No Telemetry**: Zero data collection or tracking
- **Encrypted Storage**: Optional encryption for sensitive data
- **Secure Communication**: HTTPS and secure WebSocket connections
- **Input Sanitization**: Protection against XSS attacks

### **Security Measures**
- **Content Security Policy**: Protection against code injection
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: Protection against abuse
- **CORS Protection**: Secure cross-origin requests
- **Secure Headers**: Security headers for all requests

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### **Development Setup**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### **Code Style**
- **TypeScript**: Use TypeScript for all new code
- **Functional Components**: Prefer functional components with hooks
- **Tailwind CSS**: Use Tailwind for styling
- **Testing**: Write tests for all new features
- **Documentation**: Update documentation for changes

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.

---

## 🛡️ Security

We take security seriously. Please review our [Security Policy](SECURITY.md) and report any vulnerabilities to security@lackadaisical-security.com.

---

## 📞 Support

### **Documentation**
- [User Guide](DOCUMENTATION.md)
- [API Reference](../backend/README.md)
- [Plugin Development](CONTRIBUTING.md)

### **Community**
- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Community support and ideas
- **Security**: security@lackadaisical-security.com

---

**Built with ❤️ by [Lackadaisical Security](https://lackadaisical-security.com)**

*"Beautiful interfaces shouldn't compromise on privacy."*
