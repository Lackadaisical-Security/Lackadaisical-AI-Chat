# 🚀 Installation Guide - Lackadaisical AI Chat v2.0.0-rc1

## Quick Setup Options

### 🪟 Windows (Super Easy - Recommended)

1. **Download the Project**
   - Download as ZIP from GitHub and extract
   - Or clone: `git clone https://github.com/Lackadaisical-Security/Lackadaisical-AI-Chat.git`

2. **Install Prerequisites**
   - **Node.js**: Download from [nodejs.org](https://nodejs.org/) (v18 or newer)
   - **Ollama** (optional): Download from [ollama.ai](https://ollama.ai/) for local AI

3. **Run Initial Setup (first time only)**
   - Double-click `setup-lackadaisical-ai.bat`
   - This installs all Node.js dependencies, creates required directories, sets up your `.env` config, and initializes the SQLite database
   - Only needs to be run once

4. **Start the Application**
   - Double-click `start-lackadaisical-ai.bat`
   - Your browser will open to http://localhost:3000

5. **Stop the Application**
   - Double-click `stop-lackadaisical-ai.bat`

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

2. **Download and Run Setup (first time only)**
   ```bash
   # Clone or download the project
   git clone https://github.com/Lackadaisical-Security/Lackadaisical-AI-Chat.git
   cd Lackadaisical-AI-Chat
   
   # Run the one-time setup script
   chmod +x setup-lackadaisical-ai.sh
   ./setup-lackadaisical-ai.sh
   ```

   The setup script installs all dependencies, creates required directories (`database/`, `logs/`, `uploads/`), copies `env.example` to `backend/.env`, and initializes the database.

3. **Start the Application**
   ```bash
   # Option 1: Use the start script (recommended)
   ./start-lackadaisical-ai.sh
   
   # Option 2: Use npm (starts both frontend + backend)
   npm run dev
   
   # Option 3: Start services separately
   # Terminal 1 (Backend):
   cd backend && npm run dev
   # Terminal 2 (Frontend):
   cd frontend && npm run dev
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
- **Node.js**: v18+ required

**Recommended for Best Experience:**
- **RAM**: 8GB or more
- **Storage**: 10GB free space
- **CPU**: Multi-core processor
- **Internet**: For initial setup and AI model downloads

### Step-by-Step Installation

#### 1. Install Node.js

**Windows & Mac:**
1. Go to [nodejs.org](https://nodejs.org/)
2. Download the LTS version (v18+)
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

**All Platforms (Recommended — using the setup script):**
```bash
# Windows:
setup-lackadaisical-ai.bat

# Mac/Linux:
chmod +x setup-lackadaisical-ai.sh
./setup-lackadaisical-ai.sh
```

The setup script handles all of the following automatically:
- Creates `database/`, `logs/`, `uploads/` directories
- Copies `env.example` → `backend/.env` (if not present)
- Installs root, backend, and frontend `node_modules`
- Initializes the SQLite database (`database/chat.db`)

**Manual Alternative (Mac/Linux):**
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

# Create required directories
mkdir -p database logs uploads

# Copy env template (edit as needed)
cp env.example backend/.env

# Initialize the database
npm run init:db
```

#### 5. Configure AI Provider

**Using Ollama (Recommended — default):**
1. Start Ollama: `ollama serve`
2. Download a model: `ollama pull gemma3:4b` (lightweight) or `ollama pull gemma4:e4b` (multimodal: vision + audio)
3. The app uses Ollama by default — no config changes needed

**Using External Providers (optional):**
1. Edit `backend/.env` (created by the setup script, or copy from `env.example`)
2. Set your preferred provider and API key:
   ```env
   # Choose your default provider
   AI_PRIMARY_PROVIDER=ollama    # ollama, openai, anthropic, google, xai
   
   # Ollama Settings (defaults — no changes needed for local use)
   OLLAMA_HOST=http://localhost:11434
   OLLAMA_DEFAULT_MODEL=gemma3:4b
   OLLAMA_VISION_MODEL=gemma4:e4b
   OLLAMA_AUDIO_MODEL=gemma4:e4b
   
   # External AI Providers (optional — add any you have)
   # OPENAI_API_KEY=your_openai_key
   # ANTHROPIC_API_KEY=your_anthropic_key
   # GOOGLE_API_KEY=your_google_key
   # XAI_API_KEY=your_xai_key
   
   # Security (CHANGE THESE for production)
   JWT_SECRET=your_secure_random_string_at_least_32_chars
   SESSION_SECRET=another_secure_random_string_at_least_32_chars
   ```

#### 6. Start the Application

**Windows:**
- Double-click `start-lackadaisical-ai.bat`

**Mac/Linux:**
```bash
# Option 1: Use start script
./start-lackadaisical-ai.sh

# Option 2: Use npm dev mode (starts both frontend + backend)
npm run dev

# Option 3: Start services separately
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

The environment file is located at `backend/.env`. The setup script creates it from `env.example` if it doesn't exist. Key settings:

```env
# AI Provider Settings (hot-swap between providers at runtime)
AI_PRIMARY_PROVIDER=ollama       # ollama, openai, anthropic, google, xai
OLLAMA_HOST=http://localhost:11434
OLLAMA_DEFAULT_MODEL=gemma3:4b
OLLAMA_VISION_MODEL=gemma4:e4b
OLLAMA_AUDIO_MODEL=gemma4:e4b

# External AI Providers (optional — configure any you have)
# OPENAI_API_KEY=your_key_here
# ANTHROPIC_API_KEY=your_key_here
# GOOGLE_API_KEY=your_key_here
# XAI_API_KEY=your_key_here

# Database Settings
DB_TYPE=sqlite
DB_PATH=./database/chat.db
DB_ENCRYPTED=false

# Server Settings
BACKEND_PORT=3001
FRONTEND_PORT=3000
CORS_ORIGIN=http://localhost:3000

# Security (CHANGE THESE for production!)
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters
SESSION_SECRET=another_super_secret_key_for_sessions

# Context & Memory
AI_CONTEXT_WINDOW=262144          # 256K tokens
EXTENDED_THINKING=true

# Features
FEATURE_JOURNALING=true
FEATURE_WEB_SEARCH=true
FEATURE_FILE_UPLOAD=true
FEATURE_CODE_BLOCKS=true
FEATURE_EXTENDED_THINKING=true

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

### Custom Models

**Ollama Models:**
```bash
# Recommended models
ollama pull gemma3:4b             # Lightweight, fast (default)
ollama pull gemma4:e4b            # Multimodal: vision + audio
ollama pull llama3.2:latest       # Meta's latest
ollama pull mistral:latest        # Good general-purpose
ollama pull codellama:latest      # Optimized for code

# List downloaded models
ollama list
```

**Hot-Swap Models at Runtime:**
You can switch models at runtime without restart:
- Use Settings → AI Settings in the UI
- Or call `POST /api/models/switch` API

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

# Re-run the setup script (simplest approach)
# Windows: setup-lackadaisical-ai.bat
# Mac/Linux: ./setup-lackadaisical-ai.sh

# Or reinstall manually
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
npm run reset:db

# Or manually delete and re-init
rm database/chat.db
npm run init:db
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
- JWT-based authentication built-in (optional — accounts not required)
- Rate limiting on auth endpoints (5 per 15 min)
- Change default ports in production
- Use authentication if exposing to network
- Monitor access logs

## Next Steps

After installation:

1. **Start chatting** - Begin conversations with your AI companion
2. **Explore emotional support** - Lacky is a friend who understands ALL emotions
3. **Try hot-swap models** - Switch between AI providers on the fly
4. **Enable cross-session memory** - Let Lacky remember past conversations
5. **Customize settings** - Adjust AI model, memory limits, and behavior
6. **Install plugins** - Add weather, horoscope, and other features
7. **Try web search** - Ask Lacky about current events
8. **Use the IDE** - Code with Monaco Editor and AI assistance
9. **Create an account** - Optional — add a username via Settings → Account
10. **Join the community** - Share your experience and get help

**Welcome to your new AI companion!** 🎉

---

**Need more help?** Check out:
- 🏠 [Main README](README.md)
- 📖 [Developer Guide](DEVELOPER_GUIDE.md)
- 🚀 [Deployment Guide](DEPLOYMENT.md)
- 🐛 [Troubleshooting Guide](TROUBLESHOOTING.md)
- 🤝 [Contributing Guide](CONTRIBUTING.md)
- 🔒 [Security Policy](SECURITY.md)
