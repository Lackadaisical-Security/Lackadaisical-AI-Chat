# 🤖**🎉 FREE OPEN SOURCE RELEASE - Build Your Own AI Friend!**

> **[🚀 GET STARTED NOW →](README-RELEASE.md)** | **[💾 Download Release](INSTALL.md)** | **[🤝 Contribute](CONTRIBUTING.md)** | **[🔒 Security](SECURITY.md)**

**⚠️ Export Control Notice:** This software is subject to US export controls. Not authorized for use in embargoed countries. See [SECURITY.md](SECURITY.md) for details.Lackadaisical AI Chat

> **Your privacy-first AI companion that grows with you**

**🎉 FREE OPEN SOURCE RELEASE - Build Your Own AI Friend!**

> **[� GET STARTED NOW →](README-RELEASE.md)** | **[� Download Release](INSTALL.md)** | **[🤝 Contribute](CONTRIBUTING.md)**

---

## ⚡ Quick Start

### Want to Use It?
**→ Read the [Complete Installation Guide](INSTALL.md)**

### Want to Contribute?
**→ Check the [Contributing Guide](CONTRIBUTING.md)**

### Having Issues?
**→ See the [Troubleshooting Guide](TROUBLESHOOTING.md)**

---

## 🌟 Why Lackadaisical AI Chat?

### 🛡️ **100% Privacy Focused**
- **Everything runs locally** - No cloud dependencies
- **Zero data collection** - Your conversations stay on your machine
- **Open source** - Verify exactly what the code does
- **Encrypted storage** - Optional AES-256 encryption for conversations

### 🧠 **True AI Companionship**
- **Persistent memory** - Remembers your conversations across sessions
- **Evolving personality** - Adapts and grows with your interactions
- **Emotional intelligence** - Understands context and mood
- **Local AI processing** - Works with Ollama and other local models

### 🔌 **Extensible Platform**
- **Plugin system** - Add weather, horoscopes, custom features
- **Multiple AI providers** - Ollama, OpenAI, Anthropic, Google, xAI
- **Modern tech stack** - React 18, Node.js, TypeScript, SQLite
- **Developer friendly** - Well-documented APIs and architecture

### 📄 **Dual License - Best of Both Worlds**
- **Free for personal use** - Use, modify, and share for non-commercial purposes
- **Commercial licensing available** - Fair pricing for business use
- **Open source community** - Contributions welcome and encouraged
- **Sustainable development** - Licensing supports continued development

---

## ✨ What Makes This Special?

### 🛡️ **Privacy by Design**
- **Zero Cloud Dependencies**: Everything runs locally on your machine
- **No Telemetry**: We don't collect, track, or sell your data
- **Encrypted Storage**: Optional AES-256 encryption for your conversations
- **Local Processing**: AI responses generated on your hardware

### 🧠 **Intelligent Memory System**
- **Persistent Context**: Your AI remembers conversations across sessions
- **Dynamic Personality**: AI personality evolves based on your interactions
- **Sentiment Analysis**: Real-time mood tracking and emotional intelligence
- **Cross-Session Recall**: Seamless conversation continuity

### 🎨 **Beautiful, Modern Interface**
- **5 Beautiful Themes**: Light, Dark, Retro, Terminal, and Matrix
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Real-time Streaming**: Watch AI responses generate in real-time
- **Intuitive Navigation**: Clean, accessible interface design

### 🔌 **Extensible Plugin System**
- **Weather Integration**: Get real-time weather updates
- **Horoscope Plugin**: Daily astrological insights
- **Poetry Generator**: AI-generated poems and creative content
- **Custom Plugins**: Easy to create and integrate your own

### 📝 **Personal Journal System**
- **Reflective Writing**: AI-assisted journaling with mood tracking
- **Analytics Dashboard**: Insights into your writing patterns
- **Export Options**: JSON, CSV, TXT, and Markdown formats
- **Privacy Controls**: Choose what to keep private or share

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ (LTS recommended)
- **npm** v9+ or **yarn** v1.22+
- **Git** for version control

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/lackadaisical-security/lackadaisical-ai-chat.git
   cd lackadaisical-ai-chat
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your preferred settings
   ```

3. **Install dependencies**
   ```bash
   # Backend dependencies
   cd backend
   npm install
   
   # Frontend dependencies
   cd ../frontend
   npm install
   ```

4. **Start the development servers**
   ```bash
   # Terminal 1: Start backend
   cd backend
   npm run dev
   
   # Terminal 2: Start frontend
   cd frontend
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173` and start chatting!

---

## 🏗️ Architecture

### **Frontend Stack**
- **React 18** with TypeScript for type safety
- **Vite** for lightning-fast development and builds
- **Tailwind CSS** + **DaisyUI** for beautiful, responsive UI
- **Zustand** for lightweight, powerful state management
- **React Router** for seamless navigation

### **Backend Stack**
- **Node.js** with **Express** and **TypeScript**
- **SQLite** (default) with optional **PostgreSQL**/**MySQL** support
- **better-sqlite3** for high-performance database operations
- **WebSocket** + **Server-Sent Events** for real-time communication

### **AI Integration**
- **Ollama** for local AI processing (recommended)
- **OpenAI** GPT models via API
- **Anthropic** Claude models via API
- **Google** Gemini models via API
- **xAI** Grok models via API

### **Security Features**
- **Optional SQLCipher** encryption for database
- **Rate limiting** and **CORS** protection
- **JWT** authentication with secure session management
- **Input validation** and **sanitization**

---

## 🎯 Key Features

### **Chat Interface**
- Real-time message streaming
- Message history with search
- Context window management
- Sentiment analysis display
- File attachment support
- Voice message recording

### **Session Management**
- Multiple concurrent chat sessions
- Session renaming and organization
- Context preservation across sessions
- Export conversation history
- Session analytics and insights

### **Personality Engine**
- Dynamic mood tracking
- Personality trait evolution
- Context-aware responses
- Emotional intelligence
- Learning from interactions

### **Journal System**
- AI-assisted reflective writing
- Mood and emotion tracking
- Tag-based organization
- Export in multiple formats
- Privacy level controls

### **Plugin Architecture**
- Hot-reloadable plugins
- Sandboxed execution
- Configuration management
- Usage statistics
- Custom plugin development

---

## 🔧 Configuration

### **Environment Variables**
```bash
# Server Configuration
PORT=3001
HOST=localhost
NODE_ENV=development

# Database
DATABASE_URL=sqlite:./data/chat.db
DATABASE_ENCRYPTED=false
DATABASE_PASSPHRASE=your-secure-passphrase

# AI Providers
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Optional External APIs
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_API_KEY=your-google-key
XAI_API_KEY=your-xai-key

# Security
JWT_SECRET=your-jwt-secret
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

### **Personality Configuration**
Edit `config/personality.json` to customize your AI's base personality:
```json
{
  "name": "Lackadaisical",
  "baseTraits": ["curious", "empathetic", "creative"],
  "moodVolatility": 0.3,
  "empathyThreshold": 0.7,
  "learningRate": 0.1
}
```

---

## 🧪 Testing

### **Run All Tests**
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# End-to-end tests
npm run test:e2e
```

### **Test Coverage**
- **Unit Tests**: 95%+ coverage on core functionality
- **Integration Tests**: API endpoints and database operations
- **Component Tests**: React components and user interactions
- **Security Tests**: Authentication and authorization flows

---

## 🔌 Plugin Development

### **Creating a Custom Plugin**
```typescript
// plugins/my-plugin/index.ts
export interface PluginResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

export default async function myPlugin(input: string, context: any): Promise<PluginResult> {
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

### **Plugin Configuration**
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "author": "Your Name",
  "permissions": ["network", "filesystem"],
  "config": {
    "apiKey": "",
    "endpoint": "https://api.example.com"
  }
}
```

---

## 🚀 Deployment

### **Docker Deployment**
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build individual containers
docker build -t lackadaisical-ai-chat .
docker run -p 3001:3001 -p 5173:5173 lackadaisical-ai-chat
```

### **Production Build**
```bash
# Build frontend for production
cd frontend
npm run build

# Build backend for production
cd backend
npm run build

# Start production server
npm start
```

### **Environment-Specific Configs**
- **Development**: Hot reload, debug logging, local database
- **Staging**: Production-like environment with test data
- **Production**: Optimized builds, encrypted storage, monitoring

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](frontend/CONTRIBUTING.md) for details.

### **Development Setup**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### **Code Style**
- **TypeScript** for type safety
- **ESLint** + **Prettier** for code formatting
- **Conventional Commits** for commit messages
- **Jest** + **React Testing Library** for testing

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](frontend/LICENSE.md) file for details.

---

## 🛡️ Security

We take security seriously. Please review our [Security Policy](frontend/SECURITY.md) and report any vulnerabilities to security@lackadaisical-security.com.

### **Security Features**
- **Local Processing**: No data leaves your machine
- **Encrypted Storage**: Optional AES-256 encryption
- **Input Validation**: Comprehensive sanitization
- **Rate Limiting**: Protection against abuse
- **CORS Protection**: Secure cross-origin requests

---

## 📞 Support

### **Documentation**
- [User Guide](frontend/DOCUMENTATION.md)
- [API Reference](backend/README.md)
- [Plugin Development](frontend/CONTRIBUTING.md)

### **Community**
- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Community support and ideas
- **Security**: security@lackadaisical-security.com

### **Professional Support**
- **Enterprise**: Custom deployments and support
- **Consulting**: AI integration and customization
- **Training**: Workshops and tutorials

---

## 🙏 Acknowledgments

- **Ollama** for local AI processing capabilities
- **React** and **Vite** communities for excellent tooling
- **Tailwind CSS** for beautiful, utility-first styling
- **SQLite** for reliable, embedded database technology
- **Open Source Community** for inspiration and collaboration

---

**Built with ❤️ by [Lackadaisical Security](https://lackadaisical-security.com)**

*"Privacy isn't just a feature—it's the foundation."* 