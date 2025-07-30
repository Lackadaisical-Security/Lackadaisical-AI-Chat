# 🔧 Troubleshooting Guide

Having issues with Lackadaisical AI Chat? This guide will help you resolve common problems and get your AI companion running smoothly.

## 🚨 Quick Fixes

### First Steps (Solve 80% of Issues)

1. **Restart Everything**
   ```bash
   # Stop all processes (Ctrl+C in terminals)
   # Then restart:
   npm run start
   ```

2. **Check if Ollama is Running**
   ```bash
   # Windows PowerShell
   ollama list
   
   # If not installed, visit: https://ollama.com/download
   ```

3. **Verify Node.js Version**
   ```bash
   node --version
   # Should be 16+ (recommended: 18+)
   ```

4. **Clear Cache and Reinstall**
   ```bash
   # Clean npm cache
   npm cache clean --force
   
   # Remove node_modules
   rm -rf node_modules frontend/node_modules backend/node_modules
   
   # Reinstall everything
   npm install
   cd backend && npm install && cd ..
   cd frontend && npm install && cd ..
   ```

## 🐛 Common Issues

### Installation Problems

#### Issue: "npm install" fails
**Symptoms:**
- Error messages during package installation
- Missing dependencies warnings
- Permission errors

**Solutions:**
```bash
# Solution 1: Use npm with legacy peer deps
npm install --legacy-peer-deps

# Solution 2: Clear npm cache
npm cache clean --force
npm install

# Solution 3: Use yarn instead
npm install -g yarn
yarn install

# Solution 4: Check Node.js version
node --version  # Should be 16+
```

#### Issue: Permission errors (Windows)
**Symptoms:**
- "EACCES" permission denied errors
- Cannot write to directories

**Solutions:**
```powershell
# Run PowerShell as Administrator
# Or set npm to use different directory:
npm config set cache C:\temp\npm-cache --global
npm config set prefix C:\temp\npm-global --global
```

#### Issue: Python/C++ build tools missing
**Symptoms:**
- "node-gyp" errors
- Missing Visual Studio build tools

**Solutions:**
```bash
# Install build tools
npm install -g windows-build-tools

# Or install Visual Studio Build Tools manually
# Visit: https://visualstudio.microsoft.com/downloads/
```

### Ollama Integration Issues

#### Issue: "Cannot connect to Ollama"
**Symptoms:**
- AI responses fail
- Connection timeout errors
- Backend logs show Ollama connection issues

**Solutions:**
```bash
# Check if Ollama is running
ollama list

# Start Ollama service
ollama serve

# Pull required model
ollama pull llama2

# Check Ollama status
curl http://localhost:11434/api/tags
```

#### Issue: Ollama model not found
**Symptoms:**
- "Model not found" errors
- Empty responses from AI

**Solutions:**
```bash
# List available models
ollama list

# Pull the default model
ollama pull llama2

# Or pull a specific model
ollama pull mistral
ollama pull codellama

# Update your .env file with correct model name
MODEL_NAME=llama2
```

#### Issue: Ollama slow responses
**Symptoms:**
- Very slow AI responses
- High CPU usage
- System freezing

**Solutions:**
```bash
# Use a smaller model
ollama pull llama2:7b
# Instead of llama2:13b or llama2:70b

# Reduce context length in .env
OLLAMA_CONTEXT_SIZE=2048
# Instead of 4096 or higher

# Check system resources
# Task Manager -> Performance
# Ensure you have enough RAM and CPU
```

### Database Issues

#### Issue: Database connection failed
**Symptoms:**
- "Database locked" errors
- Cannot create sessions
- Missing conversation history

**Solutions:**
```bash
# Check database file permissions
# Make sure chat.db is not open in another program

# Reset database (WARNING: Loses data)
npm run db:reset

# Or manually delete and recreate
rm database/chat.db backend/database/chat.db
npm run db:init
```

#### Issue: Missing database columns
**Symptoms:**
- "Column doesn't exist" errors
- Session creation fails
- 500 internal server errors

**Solutions:**
```bash
# Run database fix script
node scripts/fixAllDatabases.js

# Or manually recreate database
npm run db:reset
npm run db:init
```

#### Issue: Corrupted database
**Symptoms:**
- Random database errors
- Inconsistent data
- Cannot open database file

**Solutions:**
```bash
# Backup current database
cp database/chat.db database/chat.db.backup

# Try to repair
sqlite3 database/chat.db ".recover" > recovered.sql
rm database/chat.db
sqlite3 database/chat.db < recovered.sql

# If repair fails, reset database
npm run db:reset
```

### Server Issues

#### Issue: Backend won't start
**Symptoms:**
- Port 3001 already in use
- Backend crashes on startup
- Module not found errors

**Solutions:**
```bash
# Check what's using port 3001
netstat -ano | findstr :3001

# Kill process using port (replace PID)
taskkill /PID <process_id> /F

# Or use different port in backend/.env
PORT=3002

# Check for missing dependencies
cd backend
npm install
npm run build
npm start
```

#### Issue: Frontend won't start
**Symptoms:**
- Port 3000 already in use
- Vite build errors
- Cannot resolve modules

**Solutions:**
```bash
# Check what's using port 3000
netstat -ano | findstr :3000

# Use different port
cd frontend
npm run dev -- --port 3001

# Clear Vite cache
rm -rf frontend/.vite
cd frontend && npm run build

# Reinstall frontend dependencies
cd frontend
rm -rf node_modules
npm install
```

#### Issue: "Module not found" errors
**Symptoms:**
- Import/require errors
- TypeScript compilation errors
- Missing type definitions

**Solutions:**
```bash
# Install missing types
npm install -D @types/node @types/express

# Rebuild TypeScript
cd backend && npm run build
cd frontend && npm run build

# Check tsconfig.json paths
# Verify all imports use correct paths
```

### Memory and Performance

#### Issue: High memory usage
**Symptoms:**
- System running out of RAM
- Browser becoming unresponsive
- Node.js heap errors

**Solutions:**
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 backend/src/index.js

# Or set in package.json
"start": "node --max-old-space-size=4096 src/index.js"

# Reduce model context size
# In .env:
OLLAMA_CONTEXT_SIZE=1024

# Close unnecessary browser tabs
# Restart browser periodically
```

#### Issue: Memory leaks
**Symptoms:**
- Memory usage keeps increasing
- Performance degrades over time
- System becomes unstable

**Solutions:**
```bash
# Monitor memory usage
# Task Manager -> Details -> node.exe

# Restart services periodically
# Ctrl+C -> npm start

# Check for memory leaks in code
# Use Chrome DevTools -> Memory tab
# Profile Node.js with --inspect flag
```

### Network and Connectivity

#### Issue: Cannot reach backend from frontend
**Symptoms:**
- API calls fail
- Network errors in browser
- CORS errors

**Solutions:**
```bash
# Check backend is running
curl http://localhost:3001/api/health

# Verify CORS settings in backend
# Check backend/src/index.ts for CORS configuration

# Check firewall settings
# Allow Node.js through Windows Firewall

# Try different ports
# Backend: 3001 -> 3002
# Frontend: 3000 -> 3001
```

#### Issue: Streaming responses not working
**Symptoms:**
- AI responses appear all at once
- No real-time typing effect
- EventSource errors

**Solutions:**
```javascript
// Check EventSource connection in browser console
// Look for errors in Network tab

// Verify streaming endpoint
fetch('http://localhost:3001/api/chat/stream')

// Check backend streaming implementation
// Ensure proper headers are set:
'Content-Type': 'text/event-stream'
'Cache-Control': 'no-cache'
'Connection': 'keep-alive'
```

## 🔍 Debugging Tools

### Backend Debugging

```bash
# Start with debug mode
cd backend
npm run dev

# Enable detailed logging
LOG_LEVEL=debug npm start

# Use Node.js inspector
node --inspect src/index.js
# Then open Chrome -> chrome://inspect
```

### Frontend Debugging

```bash
# Start with debug info
cd frontend
npm run dev

# Open browser developer tools
# F12 -> Console tab
# Check for JavaScript errors

# Network tab shows API calls
# Sources tab for breakpoints
```

### Database Debugging

```bash
# Open database in SQLite browser
sqlite3 database/chat.db

# Check table structure
.schema

# View data
SELECT * FROM conversations LIMIT 10;

# Check for errors
PRAGMA integrity_check;
```

### Log Analysis

```bash
# Check backend logs
cat backend/logs/app.log
cat backend/logs/error.log

# Check recent errors
tail -f backend/logs/error.log

# Search for specific errors
grep "ERROR" backend/logs/app.log
```

## 📊 Health Checks

### System Health

```bash
# Check all services
npm run health

# Manual checks:
curl http://localhost:3001/api/health
curl http://localhost:3000

# Check Ollama
ollama list
curl http://localhost:11434/api/tags
```

### Database Health

```bash
# Test database connection
node -e "
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('database/chat.db');
db.get('SELECT COUNT(*) as count FROM conversations', (err, row) => {
  console.log(err ? 'Database Error:' + err : 'Database OK: ' + row.count + ' conversations');
  db.close();
});
"
```

### Model Health

```bash
# Test AI model
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "llama2", "prompt": "Hello", "stream": false}'
```

## 🆘 Getting Help

### Before Asking for Help

1. **Check this troubleshooting guide**
2. **Search existing GitHub issues**
3. **Try the quick fixes above**
4. **Gather system information**

### System Information to Include

```bash
# Node.js version
node --version

# npm version
npm --version

# Operating system
# Windows: systeminfo | findstr /C:"OS Name"
# Linux: uname -a
# Mac: sw_vers

# Ollama version
ollama --version

# Available models
ollama list
```

### Error Information to Include

- **Exact error message** (copy/paste full text)
- **Steps to reproduce** the issue
- **What you expected** to happen
- **Screenshots** if applicable
- **Log files** (backend/logs/error.log)
- **Browser console errors** (F12 -> Console)

### Where to Get Help

1. **GitHub Issues** - <https://github.com/your-repo/issues>
   - Bug reports and feature requests
   - Search before creating new issue

2. **GitHub Discussions** - Community Q&A
   - General questions
   - Usage help
   - Ideas and feedback

3. **Discord Server** - Real-time help
   - Quick questions
   - Community support
   - Developer chat

4. **Email** - For private issues
   - Security concerns
   - Account problems

## 🔧 Advanced Troubleshooting

### Clean Reinstall

```bash
# Complete clean installation
rm -rf node_modules frontend/node_modules backend/node_modules
rm package-lock.json frontend/package-lock.json backend/package-lock.json
npm cache clean --force

# Delete databases (WARNING: Loses data)
rm database/chat.db backend/database/chat.db

# Reinstall everything
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Recreate database
npm run db:init

# Start fresh
npm run start
```

### Environment Reset

```bash
# Reset environment variables
cp env.example .env
cp backend/env.example backend/.env

# Edit .env files with your settings
# Restart services after changes
```

### Port Conflicts

```bash
# Find processes using ports
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :11434

# Kill processes (replace PID)
taskkill /PID <process_id> /F

# Or use different ports in .env files
```

### Performance Optimization

```bash
# Monitor system resources
# Task Manager -> Performance

# Close unnecessary programs
# Ensure adequate RAM (8GB+ recommended)
# Use SSD for better performance

# Optimize Node.js
node --max-old-space-size=4096 backend/src/index.js

# Use production builds
cd frontend && npm run build
cd backend && npm run build
```

## ✅ Verification Checklist

After fixing issues, verify everything works:

- [ ] Backend starts without errors (http://localhost:3001)
- [ ] Frontend loads properly (http://localhost:3000)
- [ ] Can create new chat session
- [ ] AI responds to messages
- [ ] Messages are saved to database
- [ ] Can switch between sessions
- [ ] Settings can be changed
- [ ] No console errors in browser
- [ ] No errors in backend logs

---

## 🎯 Still Having Issues?

If you're still experiencing problems after trying these solutions:

1. **Create a GitHub issue** with detailed information
2. **Join our Discord** for real-time help
3. **Check our FAQ** for additional answers
4. **Consider professional support** for enterprise users

**We're here to help make your AI companion experience amazing!** 🤖❤️

---

## Quick Links

- 🏠 [Main README](README-RELEASE.md)
- 🔧 [Installation Guide](INSTALL.md)
- 🤝 [Contributing Guide](CONTRIBUTING.md)
- 📋 [Changelog](CHANGELOG.md)
- 📄 [License](LICENSE)
