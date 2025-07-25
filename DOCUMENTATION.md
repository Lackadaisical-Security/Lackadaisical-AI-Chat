# Lackadaisical AI Chat – Documentation

**By Lackadaisical Security 2025**  
https://lackadaisical-security.com  
**Built:** 25/07/2025

---

## Overview
Lackadaisical AI Chat is a privacy-first, local-first AI chat platform with persistent memory, personality, journaling, plugin support, and advanced context management. All data is processed and stored locally by default, with optional encrypted storage and external AI provider integration.

---

## Features
- Local chat sessions and memory (Zustand + localStorage, or encrypted SQLite backend)
- Modern, responsive UI (React + Tailwind CSS)
- Journal, plugins, and settings panels
- No cloud required: all state is local by default
- Optional external AI providers (Ollama, OpenAI, Anthropic, Google, xAI)
- Advanced context/memory window per session
- Sentiment analysis and mood tracking
- Plugin system (weather, horoscope, poem-of-the-day, and more)
- Security: optional SQLCipher encryption, no telemetry, local validation

---

## Architecture
- **Frontend:** React + TypeScript + Zustand + Tailwind CSS (Vite)
- **Backend:** Node.js + Express + TypeScript + better-sqlite3 (or PostgreSQL/MySQL)
- **State Management:** Zustand (frontend), MemoryService (backend)
- **Database:** SQLite (default), with schema for conversations, sessions, personality, journal, plugins, tags
- **AI Providers:** Modular adapters for Ollama, OpenAI, Anthropic, Google, xAI
- **Streaming:** Server-Sent Events (SSE) and WebSocket support
- **Security:** Optional encryption, JWT/session secrets, rate limiting, CORS, helmet

---

## Project Structure
- `src/components/` – UI components
- `src/store/` – Zustand state management
- `src/types/` – TypeScript types
- `src/services/` – API and utility functions
- `src/pages/` – Page-level components
- `src/hooks/` – Custom React hooks
- `src/utils/` – Utility functions
- `themes/` – Theme and style files
- `tests/` – Unit and integration tests

---

## State & Memory Management
- **Frontend:** Zustand store with localStorage persistence for sessions, messages, context window, and settings.
- **Backend:** MemoryService for encrypted context window per session, using AES-256-GCM.
- **API:** REST endpoints for session context (GET/POST/DELETE), journal, plugins, and chat streaming.

---

## Testing
- **Frameworks:** Jest, React Testing Library, @testing-library/react-hooks
- **How to Run:**
  1. `cd frontend`
  2. `npm install`
  3. `npm test` or `npx jest`
- **Coverage:**
  - `tests/App.test.tsx`: App render
  - `tests/store.test.ts`: Zustand store logic
  - Add more tests in `tests/` as needed

---

## Security & Privacy
- All state is local by default; no cloud or telemetry
- Optional encryption for persistent storage (backend)
- No third-party analytics or tracking
- Rate limiting, CORS, and helmet for backend

---

## License
MIT

---
© 2025 Lackadaisical Security. All rights reserved.
