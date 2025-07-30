# 🚀 Installation Guide - Lackadaisical AI Chat

## Quick Setup Options

### 🪟 Windows (Super Easy - Recommended)

1. **Download the Project**
   - Download as ZIP from GitHub and extract
   - Or clone: `git clone https://github.com/Lackadaisical-Security/lackadaisical-ai-chat.git`

2. **Install Prerequisites**
   - **Node.js**: Download from [nodejs.org](https://nodejs.org/) (v18 or newer)
   - **Ollama** (optional): Download from [ollama.ai](https://ollama.ai/) for local AI

3. **One-Click Start**
   - Double-click `start-lackadaisical-ai.bat`
   - Wait for automatic setup (2-5 minutes first time)
   - Your browser will open to http://localhost:3000

That's it! Your AI companion is ready.

### 🍎 Mac / 🐧 Linux

1. **Install Prerequisites**
   ```bash
   # Install Node.js (if not installed)
   # Mac: brew install node
   # Ubuntu: sudo apt install nodejs npm
   # Or download from nodejs.org
   
   # Install Ollama (optional but recommended)
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Download and Setup**
   ```bash
   # Clone or download the project
   git clone https://github.com/Lackadaisical-Security/lackadaisical-ai-chat.git
   cd lackadaisical-ai-chat
   
   # Install dependencies
   npm install
   cd backend && npm install && cd ..
   cd frontend && npm install && cd ..
   ```

3. **Start the Application**
   ```bash
   # Option 1: Use npm script (recommended)
   npm run start:all
   
   # Option 2: Start manually in separate terminals
   cd backend && npm run dev &
   cd frontend && npm run dev &
   ```

4. **Open in Browser**
   - Go to http://localhost:3000
   - Start chatting with your AI companion!

## Detailed Setup Instructions

### System Requirements

**Minimum Requirements:**
- **RAM**: 4GB (8GB recommended)
- **Storage**: 2GB free space (more for AI models)
- **CPU**: Any modern processor
- **OS**: Windows 10+, macOS 10.15+, or Linux

**Recommended for Best Experience:**
- **RAM**: 8GB or more
- **Storage**: 10GB free space
- **CPU**: Multi-core processor
- **Internet**: For initial setup and AI model downloads

### Step-by-Step Installation

#### 1. Install Node.js

**Windows & Mac:**
1. Go to [nodejs.org](https://nodejs.org/)
2. Download the LTS version
3. Run the installer
4. Restart your computer

**Linux:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm

# CentOS/RHEL
sudo yum install nodejs npm

# Arch Linux
sudo pacman -S nodejs npm
```

Verify installation:
```bash
node --version  # Should show v18.0.0 or higher
npm --version   # Should show 9.0.0 or higher
```

#### 2. Install Ollama (Optional but Recommended)

Ollama provides local AI models for the best privacy and performance.

**Windows:**
1. Go to [ollama.ai](https://ollama.ai/)
2. Download Ollama for Windows
3. Run the installer
4. Open Command Prompt and run: `ollama serve`

**Mac:**
1. Go to [ollama.ai](https://ollama.ai/)
2. Download Ollama for Mac
3. Install and start Ollama
4. In Terminal: `ollama serve`

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve
```

#### 3. Download Lackadaisical AI Chat

**Option A: Download ZIP**
1. Go to the GitHub repository
2. Click "Code" → "Download ZIP"
3. Extract to your desired location

**Option B: Git Clone**
```bash
git clone https://github.com/Lackadaisical-Security/lackadaisical-ai-chat.git
cd lackadaisical-ai-chat
```

#### 4. Install Dependencies

**Windows (Using Batch Script):**
- Double-click `start-lackadaisical-ai.bat`
- The script will install everything automatically

**Mac/Linux (Manual):**
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

#### 5. Configure AI Provider

**Using Ollama (Recommended):**
1. Start Ollama: `ollama serve`
2. Download a model: `ollama pull llama2` (or your preferred model)
3. The app will automatically use Ollama

**Using External Providers:**
1. Copy `env.example` to `.env`
2. Add your API keys:
   ```env
   OPENAI_API_KEY=your_openai_key
   ANTHROPIC_API_KEY=your_anthropic_key
   GOOGLE_API_KEY=your_google_key
   XAI_API_KEY=your_xai_key
   ```

#### 6. Start the Application

**Windows:**
- Double-click `start-lackadaisical-ai.bat`

**Mac/Linux:**
```bash
# Option 1: Use npm script
npm run start:all

# Option 2: Start services separately
# Terminal 1 (Backend):
cd backend && npm run dev

# Terminal 2 (Frontend):
cd frontend && npm run dev
```

#### 7. Access Your AI Companion

1. Open your browser
2. Go to http://localhost:3000
3. Start chatting!

## Configuration Options

### Environment Variables

Create a `.env` file in the root directory:

```env
# AI Provider Settings
AI_PROVIDER=ollama              # ollama, openai, anthropic, google, xai
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# External AI Providers (optional)
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
XAI_API_KEY=your_key_here

# Database Settings
DATABASE_PATH=./database/chat.db
DATABASE_ENCRYPTION=false      # Set to true for encryption

# Server Settings
BACKEND_PORT=3001
FRONTEND_PORT=3000
CORS_ORIGIN=http://localhost:3000

# Memory Settings
MAX_MEMORY_CONTEXT=10000       # Max tokens in memory
MEMORY_RETENTION_DAYS=365      # How long to keep memories

# Logging
LOG_LEVEL=info                 # debug, info, warn, error
LOG_TO_FILE=true
```

### Custom Models

**Ollama Models:**
```bash
# Download different models
ollama pull llama2:7b          # Smaller, faster
ollama pull llama2:13b         # Balanced
ollama pull codellama          # Good for programming
ollama pull mistral            # Alternative model

# List available models
ollama list
```

**Configure Model in App:**
Edit `backend/src/config/settings.ts`:
```typescript
export const AI_CONFIG = {
  provider: 'ollama',
  model: 'llama2:7b',  // Change this to your preferred model
  // ...
};
```

## Troubleshooting

### Common Issues

**"Node.js not found"**
```bash
# Check if Node.js is installed
node --version

# If not found, download from nodejs.org
# Make sure to restart your terminal/computer after installation
```

**"Port already in use"**
```bash
# Find what's using the port
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Kill the process or change ports in the config
```

**"Cannot find module" errors**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json

# Reinstall
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

**"Ollama connection failed"**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve

# If still not working, use external AI provider
# Set AI_PROVIDER=openai in your .env file
```

**"Database errors"**
```bash
# Reset the database
rm database/chat.db

# Restart the application - it will recreate the database
```

### Performance Issues

**Slow AI Responses:**
1. **Use a smaller model**: `ollama pull llama2:7b`
2. **Increase RAM**: Close other applications
3. **Use SSD storage**: Move the app to an SSD if available
4. **Check CPU usage**: Ensure CPU isn't overloaded

**High Memory Usage:**
1. **Reduce context window**: Lower `MAX_MEMORY_CONTEXT` in `.env`
2. **Clear old conversations**: Use the cleanup tools in the app
3. **Restart periodically**: Restart the app to clear memory

### Getting Help

1. **Check the logs**:
   - Backend logs: Check the terminal running the backend
   - Frontend logs: Check browser developer console (F12)
   - Application logs: Check `logs/` directory

2. **Common log locations**:
   ```
   logs/app.log          # General application logs
   logs/error.log        # Error logs
   backend/logs/         # Backend-specific logs
   ```

3. **Create an issue on GitHub**:
   - Include your operating system
   - Include error messages
   - Include steps to reproduce

4. **Community support**:
   - Check existing GitHub issues
   - Join our Discord server
   - Read the FAQ

## Advanced Setup

### Docker Installation (Coming Soon)

```bash
# Build the Docker image
docker build -t lackadaisical-ai-chat .

# Run with Docker Compose
docker-compose up -d

# Access at http://localhost:3000
```

### Custom Deployment

**Nginx Reverse Proxy:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**PM2 Process Manager:**
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monitor
```

### Development Setup

For developers who want to contribute:

```bash
# Clone the repository
git clone https://github.com/your-username/lackadaisical-ai-chat.git
cd lackadaisical-ai-chat

# Install dependencies
npm install

# Install pre-commit hooks
npm run prepare

# Start in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Security Considerations

### Data Privacy
- All data is stored locally by default
- Enable database encryption in production
- Regular backups of your conversations
- Secure your API keys

### Network Security
- Use HTTPS in production
- Configure proper CORS settings
- Use environment variables for secrets
- Regular security updates

### Access Control
- Change default ports in production
- Use authentication if exposing to network
- Regular password updates for accounts
- Monitor access logs

## Next Steps

After installation:

1. **Start chatting** - Begin conversations with your AI companion
2. **Explore memory** - Test how it remembers conversations
3. **Try sessions** - Create different conversation contexts
4. **Customize settings** - Adjust the AI model and behavior
5. **Install plugins** - Add weather, horoscope, and other features
6. **Join the community** - Share your experience and get help

**Welcome to your new AI companion!** 🎉

---

**Need more help?** Check out:
- 🏠 [Main README](README-RELEASE.md)
- 🐛 [Troubleshooting Guide](TROUBLESHOOTING.md)
- 🤝 [Contributing Guide](CONTRIBUTING.md)
- � [Security Policy](SECURITY.md)
- �💬 [Community Discord](#)
- 📧 [Support Email](#)
