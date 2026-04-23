# Changelog

All notable changes to Lackadaisical AI Chat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0-rc1-patch1] - 2026-04-23

### 🐛 Critical Bug Fixes

#### Streaming Chat — Message/Response Registration Fixed
- **Root cause**: `api.streamMessage()` was using `EventSource` (GET) to `/api/v1/chat/stream`, a route that does not exist on the backend. The backend only accepts streaming via `POST /api/v1/chat` with `stream: true` in the JSON body.
- **Fix**: Replaced `EventSource` with `fetch` POST in `api.streamMessage()`. The method now reads the SSE stream directly from the response body using `ReadableStream` + `TextDecoder`, matching the backend's actual SSE implementation.
- **Non-streaming fallback**: If the backend returns `Content-Type: application/json` instead of `text/event-stream`, the response is parsed as a regular JSON chat response.
- **Model/settings wired through**: Selected model, temperature, and max-tokens are now included in every streaming and non-streaming chat request.

#### Frontend Build Fixed
- `ChatInterface.tsx`: Removed `require('react-hot-toast')` dynamic import (invalid in ESM browser builds). Replaced with a static `import { toast as hotToast } from 'react-hot-toast'` at the top of the file.

#### Backend TypeScript Build Fixed
- `index.ts`: Fixed `AnomalyType` and severity type casts for `/security/anomalies` query parameters (were `string | undefined`, now properly typed).
- `index.ts`: Fixed missing `return` path in the `/anomalies/:id/resolve` handler — removed `return res.status(404)` pattern that caused TypeScript error TS7030.

### ✨ New Features

#### Mobile App (Expo / React Native)
- **Full companion mobile app** in `mobile/` directory
- **Windows-first setup**: `cd mobile && npm install && npx expo start`
- **Real-time streaming chat** via fetch POST SSE (same protocol as fixed web frontend)
- **Chat screen**: Model selector, temperature control, max-tokens control, file attachment support, streaming stop button
- **Companion screen**: Personality mood display, quick messages, connection status
- **Sessions screen**: Create, load, and delete sessions; loads conversation history from backend
- **Journal screen**: Create, edit, delete journal entries with mood selector
- **Settings screen**: Backend URL config (for LAN access from device), model selection, temperature, max-tokens, theme, haptics, sound, streaming toggle, uncensored mode
- **Connection health hook**: Polls `/health` every 30 seconds, shows banner when backend/Ollama offline
- **Secure storage**: JWT tokens stored in device secure enclave via `expo-secure-store`
- **EAS Build**: `eas.json` configured for development APK, preview APK, and production App Bundle
- **TypeScript**: Strict mode, shared types matching backend API contracts
- **Platform priority**: Windows development → Android APK → iOS



### 🚀 New Features

#### User Account System
- **Optional registration** — Create an account with username, email, and password
- **Username management** — Change display name anytime via Settings → Account
- **Profile display** — Username shown in sidebar and throughout the app
- **JWT authentication** — Secure token-based auth with refresh token rotation
- **PUT /auth/profile** — New endpoint for updating user name and email

#### Code IDE Workspace
- **Full Monaco-based IDE** — Multi-tab code editor with syntax highlighting for 40+ languages
- **File Explorer** — Create, rename, delete, open files in a virtual filesystem
- **Integrated Terminal** — Command execution with persistent output history
- **Editor Settings** — Theme switching, font size, word wrap, minimap toggle
- **Import/Export** — Save and load workspace state as JSON

#### Traffic Emulator
- **Puppeteer-based headless browser automation** with stealth plugin for anti-detection
- **Fingerprint randomization** — Unique UA, viewport, WebGL, canvas, timezone per session
- **Proxy support** — HTTP/HTTPS/SOCKS5 with optional authentication
- **Human-like behavior** — Bezier mouse movement, natural typing delays, random scrolling
- **Multi-engine search** — Google, Bing, Yahoo, DuckDuckGo with content extraction
- **Frontend control panel** — Session management, search, navigation, proxy config

#### Image Generation (ComfyUI)
- **ComfyUIService** — Integration with local ComfyUI for Stable Diffusion image generation
- **Text-to-image** with customizable prompt, dimensions, steps, CFG, sampler, seed
- **REST API endpoints** — Generate, list models/samplers, check status
- **Auto-download** — Generated images saved locally and served via file download API

#### Sessions Tab
- **Dedicated Sessions page** — Browse, search, sort, rename, delete past sessions
- **Session summaries** — Topics, message count, token usage, last activity
- **Cross-session memory banner** — Visual indication that AI remembers across sessions
- **Click-to-restore** — Load any past session directly into the chat interface

#### History Pruning
- **Configurable retention policies** — By age (days) or by max messages per session
- **Auto-prune scheduler** — Configurable interval for automatic pruning
- **Manual pruning** — Per-session or global, with flexible options
- **Prune audit trail** — Summary of pruned content stored in session metadata
- **REST API** — Prune endpoints, stats, per-session control

#### Chain-of-Thought Streaming
- **Real-time thinking display** — `thinking_start`, `thinking_content`, `thinking_end` SSE events
- **Live thinking parser** — Splits `<think>` blocks from response content during streaming
- **Frontend hook** — `isThinking`, `thinkingContent` state exposed from `useStreamingResponse`

#### Enhanced File Handling
- **ZIP file extraction** — Reads and extracts text from ZIP archives using adm-zip
- **PDF document generation** — Create PDFs from chat content using pdfkit
- **Document generation API** — Generate txt, md, json, csv, html, pdf from any content
- **Inline image preview** — Images shown directly in chat bubbles with click-to-expand
- **Extended file types** — ZIP, tar, gz, docx, xlsx, pptx, and more now accepted

### 🔧 Improvements

#### Gemma 4 Multimodal (Vision + Audio)
- **Audio/voice support** — Gemma 4 audio model field in config, wrapper, and UI
- **Audio field** — Added to `OllamaChatMessage` and `OllamaGenerateRequest` interfaces
- **Model selection** — `selectModel()` now handles audio content routing to Gemma 4
- **Config schema** — `vision` and `audio` model fields with env var support (`OLLAMA_AUDIO_MODEL`)

#### Enterprise Hardening
- **ErrorBoundary component** — React error boundary wraps all routes for crash recovery
- **Connection health monitor** — `useConnectionHealth` hook for live backend/Ollama status
- **Live sidebar status** — Shows backend connection, Ollama availability, and latency
- **Per-route error isolation** — Each route wrapped in its own error boundary
- **Stop script** — New `stop-lackadaisical-ai.bat` for graceful shutdown of all services

#### Startup Scripts
- **Auto-Ollama start** — `start-lackadaisical-ai.bat` now auto-detects and starts Ollama
- **Database auto-init** — Creates database directory and initializes schema on first run
- **7-step startup** — Requirements check, Ollama, models, deps, DB, services, health
- **Quick dev start** — Updated `start-lackadaisical-alpha.bat` for fast development

#### Ollama/Gemma 4 Integration
- **Chat API support** — New `/api/chat` endpoint in OllamaWrapper with tool calling and structured outputs
- **Vision support** — Base64 image inputs for multimodal models (Gemma 4)
- **Updated model defaults** — `gemma3:4b` as default test model, expanded available models list
- **Streaming chat** — Full streaming support via the chat endpoint

#### Auth System
- **Database-backed authentication** — Users, passwords, refresh tokens stored in SQLite
- **JWT with refresh tokens** — 7-day access tokens, 30-day refresh tokens with rotation
- **User management** — Register, login, logout, change password, get profile
- **Schema migration** — Users and refresh_tokens tables added to schema.sql

#### Backend Hardening
- **BackupService** — Implemented pg_dump/mysqldump for PostgreSQL/MySQL export/import
- **LoggingService** — Implemented tar.gz log archiving with proper tar headers
- **AIService** — Replaced all "not yet implemented" messages with proper error handling
- **API Documentation** — Full endpoint listing with features at `/api`

### 🧹 Cleanup
- Removed 26 redundant `.gitkeep` files from empty legacy directories
- Cleaned root-level unused folders: css/, fonts/, journal/, webSearch/, backups/, enhanced-memory/
- Cleaned backend stub directories: controllers/, database/, dist/, middlewear/, etc.

### 📦 Dependencies Added
- `@monaco-editor/react` — Monaco code editor for IDE workspace
- `puppeteer-core`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth` — Headless browser automation
- `adm-zip` — ZIP file extraction
- `pdfkit` — PDF document generation

### 🔒 Security Hardening
- **Request Sanitization** — XSS prevention middleware strips dangerous HTML entities from all input while preserving code/chat content fields
- **Request Depth Limiter** — Prevents deeply nested JSON payloads that could cause stack overflow (max depth: 15)
- **Security Headers** — HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, no-cache for API routes
- **CSRF Protection** — Double-submit cookie pattern with automatic token generation (production-enforced)
- **AES-256-GCM Encryption** — Utilities for encrypting API keys at rest using PBKDF2-derived keys
- **X-Powered-By removed** — No server technology disclosure in headers

### 🤖 Ollama API Updates (Latest 2026 API)
- **`think` parameter** — Enable model thinking for thinking-capable models (DeepSeek-R1, Gemma, etc.)
- **`thinking` field** — Extract thinking process from model responses for chain-of-thought display
- **`done_reason`** — Track why generation stopped ('stop', 'load', 'unload')
- **`tool_name`** — Inform model of which tool produced a result in tool role messages
- **`capabilities`** — Model info now exposes capabilities array (completion, vision, tools)
- **`showModelInfo()`** — New method to query /api/show for detailed model parameters
- **Actual version fetch** — Status now queries /api/version instead of hardcoded string
- **Full option support** — min_p, typical_p, frequency_penalty, presence_penalty, seed, num_keep, num_batch, num_gpu, num_thread
- **Image generation params** — width, height, steps for experimental image generation models
- **keep_alive support** — Control model loading/unloading ('5m', '0' to unload)

### 🎨 Companion Name Customization
- **Customizable AI name** — Users can rename their companion from "Lacky" to anything via Settings → General
- **Syncs to backend** — Name change persists to personality state and is used in all system prompts
- **`companionName` field** — Added to UserSettings type with 'Lacky' default

### 🧪 Testing
- **47 new tests** — AnomalyDetectionService (25), SecurityAuditService (13), Validation helpers (9)
- **140 total tests passing** — 111 backend + 29 frontend
- **Live system testing** — All API routes verified via curl against running server

### 🐛 Bug Fixes (RC1 Hardening)
- **Auth tables race condition** — `ensureAuthTables()` now lazy-initializes on first request instead of at route creation time (before DB is ready)
- **Refresh token UNIQUE constraint collision** — Added `crypto.randomBytes` jti (JWT ID) to refresh tokens to prevent identical tokens when issued within the same second
- **Journal schema mismatch** — `initDatabase.ts` created old schema (`entry_text`, `mood_snapshot`) while `DatabaseService` expected new schema (`title`, `content`, `privacy_level`). Fixed table creation and added migration for existing databases
- **Personality routes uninitialized DB** — Converted from static singleton to factory function with dependency injection, matching the pattern used by all other routes
- **Rate limiter double-counting** — Global middleware auto-routed `/auth/*` paths to strict auth limiter (5/15min), causing `/me`, `/profile`, `/logout` to be blocked. Now only login/register use strict limiter; other auth endpoints use settings limiter
- **Env variable name mismatches** — 9 variables in `env.example` used different names than `settings.ts` read (e.g., `AI_STREAM_MODE` vs `STREAM_MODE`, `AI_MODEL_OPENAI` vs `OPENAI_MODEL`). Settings now accepts both names for backward compatibility

## [2.0.0-alpha.2] - 2026-04-02

### 🚀 New Features

#### Web Search & Tool Execution
- **WebSearchService** — DuckDuckGo-backed web search with auto-trigger detection, content fetching, and deep research with SSE progress streaming
- **ToolExecutionService** — Extensible tool framework with `web_search`, `fetch_webpage`, `calculate`, `get_datetime` built-in tools
- **Search routes** (`/api/v1/search/`) with tool listing and execution endpoints

#### File Upload & Code Block Serving
- **FileUploadService** — File ingestion with text extraction, code language detection, per-session file context for AI, using multer for proper multipart handling
- **CodeBlockService** — Extracts code blocks from AI responses, serves them as downloadable files
- **File routes** (`/api/v1/files/`) with upload, download, metadata, and serve-code endpoints

#### Extended Thinking & Message Logging
- **ExtendedThinkingService** — Parses `<think>` blocks from model output, tracks thinking duration/tokens
- **MessageLogService** — Separate WAL-mode SQLite DB (`message_log.db`) logging every user message and model response with thinking content
- **Log routes** (`/api/v1/logs/`) with search, stats, and session log endpoints

#### Model Registry Updates (2026)
- **Ollama**: `gpt-oss:20b` (256k ctx), `gemma4:e4b` (vision), Phi-4, Llama 3.3, Mistral, CodeLlama
- **OpenAI**: GPT-5.4, GPT-5.4 Mini, GPT-4.1, O4-Mini, O3
- **Anthropic**: Claude Opus 4.6, Sonnet 4.6, Haiku 4.5 (1M context)
- **Google**: Gemini 3.1 Pro/Flash, Gemini 2.5 Pro (2M context)
- **xAI**: Grok 4.20 Beta, Grok 4.1 Fast Reasoning, Grok Code Fast (2M context)

#### Custom Uncensored Model
- Created `lackadaisical-uncensored` Modelfile based on SmolLM2-135M with custom ChatML template
- Uncensored system prompt: no content filters, unrestricted, empathetic AI companion

### 🐛 Bug Fixes
- **File upload broken** — Express JSON/urlencoded body parsers consumed raw request body before multer could process multipart data. Added conditional middleware to skip multipart requests.
- **ConversationManager race condition** — `loadActiveSessions()` fired in constructor before DB was initialized. Added retry with backoff (3 attempts, 2s/4s/6s delays).
- **PluginInterface crash** — API returns `{plugins: [...]}` object but component expected a flat array. Added defensive array extraction and `Array.isArray()` guard against corrupted persisted state.
- **CORS configuration** — Ensured frontend (port 3000) and backend (port 3001) CORS origins are correctly configured across all config files.

### 📸 Screenshots
- Added live panel screenshots: Dashboard, Chat Interface, Settings, Plugins, Journal
- Screenshots stored in `docs/screenshots/`

### 📝 Documentation
- Updated README with current 2026 model list and new features
- Added screenshots section to README
- Updated CHANGELOG with comprehensive feature list

## [2.0.0-alpha] - 2026-02-21

### 🚀 Major New Features

#### Hot-Swappable AI Models
- **ModelManager service** - Switch between AI providers on the fly without restarting
- Support for 15+ models across 5 providers (Ollama, OpenAI, Anthropic, Google, xAI)
- Automatic model fallback on failure
- Health monitoring every 30 seconds
- Model performance metrics tracking

#### Web Fetching Capability
- **WebFetcher service** - Real-time web search and information retrieval
- Multiple search providers (DuckDuckGo, Brave, SerpAPI)
- URL content extraction with metadata parsing
- Structured data extraction (JSON-LD, OpenGraph, Twitter Cards)
- Weather and time lookup utilities

#### Emotional Intelligence (Unrestricted)
- **EmotionalIntelligence service** - Genuine human connection
- Full emotional spectrum support - all emotions welcomed
- Personal insight learning over time
- Emotional memory for significant moments
- Trust building through authentic interaction

#### Smart Assistant
- **SmartAssistant service** - AI-powered conversation enhancement
- Topic analysis and exploration suggestions
- Follow-up question generation
- Resource recommendations
- User preference detection

### 🧠 Enhanced Memory System
- Increased max conversation messages to **1000** (was 50)
- Increased max context tokens to **128K** (was 8K)
- Context summary threshold: **200 messages**
- Cross-session token budget: **32K**
- Cross-session memory access - AI can reference past sessions
- User preferences for toggling cross-session access

### 🔌 Plugin Enhancements
- Weather plugin with fallback simulated data (works without API key)
- Seasonal temperature variation with realistic patterns
- Major city coverage for offline demos

### 🔒 Security Improvements
- Rate limiting on all API endpoints
- JWT-based authentication with refresh tokens
- bcrypt password hashing (12 rounds)
- HTTPS for external API calls
- Enhanced URL validation (filters dangerous schemes)

### 📖 Documentation
- Updated README, CHANGELOG, CODE_OF_CONDUCT, CONTRIBUTING
- Added comprehensive API documentation

### 🐛 Bug Fixes
- Fixed TypeScript compilation errors
- Fixed module resolution issues
- Updated dependencies for Node.js 24 compatibility

---

## [1.0.0-alpha.2] - 2025-07-31

### Added
- Memory Management System
- Memory Dashboard with visual overview
- Full-text search across conversation history
- AI Summarization framework
- Export/Import for conversation backup
- Memory Visualization with interactive charts
- Real-time statistics and health monitoring

### Enhanced
- Conversation History with full search and recall
- Personal Context memory for interests and goals
- Mood Tracking and emotional awareness
- Learning Adaptation based on preferences

---

## [1.0.0-alpha.1] - 2025-07-24

### Initial Alpha Release
- Basic AI chat functionality with Ollama integration
- Session management
- SQLite database storage
- React frontend with real-time streaming
- Plugin ecosystem framework
- Weather, Horoscope, and Poem plugins
- Theme support (dark/light modes)

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 2.0.0-rc1 | 2026-04-21 | IDE, Emulator, Image Gen, User Accounts, Gemma 4 Audio, Security Hardening, 93+ tests |
| 2.0.0-alpha.2 | 2026-04-02 | Web search, file upload, extended thinking, model registry |
| 2.0.0-alpha | 2026-02-21 | Hot-swap models, web fetching, emotional intelligence |
| 1.0.0-alpha.2 | 2025-07-31 | Memory management system |
| 1.0.0-alpha.1 | 2025-07-24 | Initial alpha release |

---

*For security-related changes, see [SECURITY.md](SECURITY.md)*
