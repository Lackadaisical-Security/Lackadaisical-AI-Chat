# 🔐 Data Privacy & Memory Management

Lackadaisical Security AI systems are memory-enabled by design.

## What Gets Stored?

- **User-entered context and summaries**
- **Persona preferences** (when explicitly provided)
- **Conversation tokens** for intent and consistency (only if memory is enabled)

We do **not collect**:
- PII (names, addresses, emails)
- Biometric or protected data
- Any network activity beyond agent prompts and responses

Memory is stored in `better-sqlite3` by default and is **local-only**. AES encryption is optionally available for local deployment but disabled by default to comply with U.S. export law (see `EXPORT_NOTICE.txt`).

## Privacy Features

- Memory decay or TTL can be configured (default: 30 days)
- Agent logs can be manually cleared (`/clear-memory` command)
- No telemetry or voiceprint data is ever transferred off-device

Using these tools implies you consent to local memory storage. Memory can be modified or wiped at any time via the UI or CLI.
