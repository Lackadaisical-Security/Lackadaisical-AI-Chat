# Lackadaisical AI Chat — Implementation Guide

**Version Target:** 2.0.0-rc1  
**Created:** 2026-04-21  
**Purpose:** Comprehensive guide for completing all pending features and removing all mock/placeholder code.

---

## Table of Contents

1. [Completed Items](#completed-items)
2. [Phase 1: Cleanup](#phase-1-cleanup)
3. [Phase 2: Code IDE Workspace](#phase-2-code-ide-workspace)
4. [Phase 3: Eliminate All Mock/Placeholder Code](#phase-3-eliminate-all-mockplaceholder-code)
5. [Phase 4: Traffic Emulator Service](#phase-4-traffic-emulator-service)
6. [Phase 5: Enhanced File Handling](#phase-5-enhanced-file-handling)
7. [Phase 6: Chain-of-Thought UI](#phase-6-chain-of-thought-ui)
8. [Phase 7: Ollama/Gemma 4 Integration](#phase-7-ollamagemma-4-integration)
9. [Phase 8: Version Bump & Documentation](#phase-8-version-bump--documentation)
10. [Architecture Notes](#architecture-notes)

---

## Completed Items

- [x] Repository folder cleanup — removed 26 redundant `.gitkeep` files and empty legacy directories
- [x] Monaco-based IDE workspace component created (`frontend/src/components/IDE/IDEWorkspace.tsx`)
- [x] @monaco-editor/react dependency installed in frontend

---

## Phase 1: Cleanup ✅

Removed unused folders:
- Root: `css/`, `enhanced-memory/`, `fonts/`, `journal/`, `webSearch/`, `backups/`
- Backend: `controllers/`, `database/`, `dist/`, `logs/`, `memory/`, `enhanced-memory/`, `middlewear/`, `models/`, `routes/`, `services/`, `tests/`, `utils/`
- Removed `.gitkeep` from: `ai/ollama/`, `logs/`, `modefiles/`, `backend/src/`, `frontend/`, `plugins/`, `scripts/`, `database/`

---

## Phase 2: Code IDE Workspace

### Files Created/Modified
- `frontend/src/components/IDE/IDEWorkspace.tsx` — Full Monaco-based IDE
- `frontend/src/App.tsx` — Add `/ide` route
- `frontend/src/components/Layout/Layout.tsx` — Add IDE nav link
- `backend/src/routes/ide.ts` — Backend file operations API
- `backend/src/services/IDEService.ts` — Sandboxed workspace manager

### IDE Features Implemented
- Multi-tab Monaco editor with syntax highlighting for 40+ languages
- File explorer with create/delete/rename/open
- Integrated terminal with command execution
- Real-time save with Ctrl+S
- Import/export workspace as JSON
- Editor settings (theme, font size, word wrap, minimap)
- Status bar with language, cursor position, encoding

### Remaining IDE Work
- Wire terminal to backend for real command execution via WebSocket
- Backend IDEService: sandboxed file system with workspace isolation
- Backend routes: `/api/v1/ide/files`, `/api/v1/ide/execute`, `/api/v1/ide/workspace`

---

## Phase 3: Eliminate All Mock/Placeholder Code

### 3.1 Auth Routes (`backend/src/routes/auth.ts`)
**Problem:** In-memory user store (`new Map()`) — comment says "In production, this would be replaced with database queries"
**Fix:** Replace with DatabaseService-backed user storage using the existing `users` table schema.

### 3.2 BackupService (`backend/src/services/BackupService.ts`)
**Problem:** Lines 363-390 — `exportDatabase` and `importDatabase` throw "not yet implemented" for PostgreSQL/MySQL
**Fix:** Implement using `child_process.execFile` to call `pg_dump`/`mysqldump`/`psql`/`mysql` with proper error handling. The SQLite path already works.

### 3.3 LoggingService (`backend/src/services/LoggingService.ts`)
**Problem:** Line 401 — `archiveLogs()` throws "not yet implemented - requires tar/archiver library"
**Fix:** Implement using Node.js built-in `zlib` + `tar` stream, or install `archiver` package.

### 3.4 AIService (`backend/src/services/AIService.ts`)
**Problem:** Lines 342, 481, 483 — default case throws "Provider X not yet implemented"
**Fix:** All 5 providers (ollama, openai, anthropic, google, xai) already have switch cases. The default case is a safety net. Change message to "Unsupported provider" (not "not yet").

### 3.5 API Documentation (`backend/src/index.ts`)
**Problem:** Line 219 — `documentation: 'API documentation would be available here'`
**Fix:** Serve actual API docs with full endpoint listing.

### 3.6 Weather Plugin (`plugins/weather/index.ts`)
**Problem:** Uses "simulated" weather data as fallback when no API key configured.
**Fix:** This is acceptable — it's a graceful degradation pattern. Rename to "demo data" for clarity.

### 3.7 IDE Terminal (`frontend/src/components/IDE/IDEWorkspace.tsx`)
**Problem:** Lines 707, 832 — "simulated" execution
**Fix:** Connect to backend execution endpoint or use in-browser JS execution with proper sandboxing.

---

## Phase 4: Traffic Emulator Service

### Architecture
```
backend/src/services/TrafficEmulatorService.ts  — Core service
backend/src/routes/emulator.ts                  — REST API routes
frontend/src/components/Emulator/EmulatorPanel.tsx — UI control panel
```

### Dependencies (backend)
- `puppeteer` or `puppeteer-core` — Headless Chrome automation
- `puppeteer-extra` — Plugin system
- `puppeteer-extra-plugin-stealth` — Anti-detection
- `proxy-chain` — Proxy management (optional)

### Features
1. **Browser Instance Management**
   - Launch multiple headless Chrome instances (multi-threaded via worker threads)
   - Each instance gets unique fingerprint (user-agent, viewport, WebGL, canvas, fonts)
   - Sandboxed browser contexts per thread

2. **Fingerprint Randomization**
   - User-Agent rotation from real browser UA database
   - Viewport/screen size randomization (common resolutions)
   - WebGL vendor/renderer spoofing
   - Canvas fingerprint noise
   - Navigator properties (hardwareConcurrency, deviceMemory, platform, language)
   - Timezone randomization matching IP geolocation

3. **Anti-Bot Behavior**
   - Human-like mouse movements (Bezier curves)
   - Random scroll patterns
   - Typing delays with natural variance
   - Random wait times between actions
   - Cookie acceptance handling
   - CAPTCHA detection (pause and alert)

4. **Proxy Support**
   - HTTP/HTTPS/SOCKS5 proxy configuration
   - Residential proxy rotation
   - Proxy health checking
   - Per-instance proxy assignment

5. **Search Engine Navigation**
   - Google, Bing, Yahoo, DuckDuckGo search
   - Click-through on results
   - Extract page content and return to caller

6. **API Endpoints**
   - `POST /api/v1/emulator/start` — Start emulator session
   - `GET /api/v1/emulator/status` — Get running sessions
   - `POST /api/v1/emulator/stop/:sessionId` — Stop session
   - `POST /api/v1/emulator/search` — Execute search query
   - `GET /api/v1/emulator/results/:sessionId` — Get results

---

## Phase 5: Enhanced File Handling

### 5.1 ZIP File Support
**File:** `backend/src/services/FileUploadService.ts`
- Add ZIP extraction using Node.js `zlib` + `yauzl` or `adm-zip`
- Extract ZIP contents, process each file individually
- Return aggregated file metadata and extracted text

### 5.2 Document Generation
**File:** `backend/src/services/DocumentGenerationService.ts`
- Generate documents from chat content (Markdown → PDF, DOCX, TXT)
- Use `pdfkit` for PDF generation
- Serve generated files via the existing file download endpoint

### 5.3 Image Viewing in Chat
**File:** `frontend/src/components/Chat/MessageBubble.tsx`
- Display uploaded images inline in chat bubbles
- Image preview with lightbox/modal on click
- Support for all common image formats

### 5.4 File Type Expansion
**File:** `frontend/src/components/Chat/ChatInput.tsx`
- Add `.zip`, `.tar.gz`, `.docx`, `.xlsx`, `.pptx` to accepted file types
- Multi-file upload support

---

## Phase 6: Chain-of-Thought UI

### Current State
- Backend `ExtendedThinkingService` already parses `<think>` blocks
- `MessageBubble.tsx` already has thinking toggle UI (lines 94-115)
- Chat route streams thinking content in SSE

### Needed Improvements
1. **Real-time thinking display during streaming**
   - Show thinking panel that updates live during SSE stream
   - Visual indicator (pulsing brain icon) while thinking is in progress
   - Separate thinking content from response content in real-time

2. **Thinking tab/panel**
   - Collapsible panel showing full reasoning chain
   - Syntax highlighting for code blocks within thinking
   - Duration and token count display

3. **SSE Stream Enhancement**
   - Send `thinking_start`, `thinking_content`, `thinking_end` event types
   - Frontend parses these to show thinking in separate panel

---

## Phase 7: Ollama/Gemma 4 Integration

### Latest Ollama API Features (2025-2026)
1. **Tool Calling** — `/api/chat` supports `tools` parameter
2. **Structured Outputs** — `format` parameter with JSON Schema
3. **Vision** — Base64 image inputs with multimodal models
4. **Streaming Tool Calls** — Real-time function invocation

### Updates Needed
1. **OllamaWrapper** — Update to use `/api/chat` endpoint (not just `/api/generate`)
   - Add `tools` parameter support
   - Add `format` parameter for structured outputs
   - Add `images` parameter for vision models (Gemma 4)

2. **Model Configuration**
   - Default model: `gemma3:4b` (for testing)
   - Vision model: `gemma4:e4b`
   - Update model list in ChatInterface

3. **Config Updates**
   - Add `gemma3:4b` to available models list
   - Update `.env` defaults

---

## Phase 8: Version Bump & Documentation

### Version Update
- All `package.json` files: `2.0.0-alpha` → `2.0.0-rc1`
- Footer in Layout.tsx
- API version in backend index
- CHANGELOG.md entry for RC1

### Documentation Updates
- README.md — Update feature list, add IDE and emulator sections
- CHANGELOG.md — Add RC1 entry with all changes
- API_DOCUMENTATION.md — Add new endpoints
- ARCHITECTURE.md — Update with new services

---

## Architecture Notes

### Tech Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS, Zustand, Monaco Editor, Vite
- **Backend:** Express.js, TypeScript, SQLite (primary), better-sqlite3
- **AI:** Ollama (local), OpenAI, Anthropic, Google, xAI (cloud providers)
- **Streaming:** SSE (Server-Sent Events)
- **Testing:** Jest (unit), Playwright (E2E)

### Key Patterns
- Dependency injection via constructor params (DatabaseService)
- Factory functions for route creation (`createChatRoutes(db, aiService)`)
- Zustand store with persist middleware
- CSS variables for theming via ThemeProvider

### File Structure
```
frontend/src/
├── components/
│   ├── Chat/          — ChatInterface, ChatInput, MessageBubble, ChatSidebar
│   ├── IDE/           — IDEWorkspace (new)
│   ├── Emulator/      — EmulatorPanel (new)
│   ├── Companion/     — CompanionDashboard, CompanionInterface
│   ├── Journal/       — JournalInterface
│   ├── Plugins/       — PluginInterface, PluginCard, PluginManager
│   ├── Settings/      — SettingsInterface
│   ├── Layout/        — Layout (navigation)
│   └── ui/            — Button, ThemeProvider, ThemeSwitcher, TypingIndicator
├── services/          — api.ts (ApiService)
├── store/             — index.ts (Zustand store)
├── hooks/             — useStreamingResponse
├── types/             — index.ts (all TypeScript types)
└── utils/             — cn.ts

backend/src/
├── ai/
│   ├── ollama/        — customWrapper.ts
│   └── externalProviders/ — OpenAI, Anthropic, Google, xAI adapters
├── services/          — All backend services (AI, Database, Memory, etc.)
├── routes/            — Express routes (chat, files, search, etc.)
├── middleware/        — Auth, rate limiter, error handler, sentiment
├── config/            — settings.ts
├── utils/             — logger, crypto, ApiError
└── types/             — Backend type definitions
```
