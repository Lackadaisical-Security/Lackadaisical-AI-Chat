
# Security Policy – Lackadaisical AI Chat

Lackadaisical AI Chat is designed and maintained with a security-first, privacy-by-default philosophy. We are committed to protecting user data and upholding the highest standards of cybersecurity.

---

## Reporting Vulnerabilities

If you discover a security vulnerability or suspect a privacy issue, please contact our security team immediately:
- [Report via website](https://lackadaisical-security.com/contact)
- Email: security@lackadaisical-security.com

We treat all reports with urgency and confidentiality. Responsible disclosure is appreciated and rewarded.

---

## Security Principles & Features

- **Local-First:** All user data and chat memory are stored and processed locally by default. No cloud, no telemetry, no third-party analytics.
- **Encryption:** Optional AES-256-GCM encryption for persistent storage (backend, via SQLCipher or similar).
- **Zero Trust:** No implicit trust in any external provider or plugin. All integrations are opt-in and sandboxed.
- **Minimal Attack Surface:** No unnecessary network exposure; strict CORS, rate limiting, and HTTP security headers (helmet) on backend APIs.
- **Open Source:** Code is auditable and open for review by the security community.
- **No Tracking:** We do not collect, sell, or share user data. No cookies, no beacons, no hidden calls.
- **Secure Defaults:** All features are secure by default; privacy and security are never opt-in.

---

## Commitment

Lackadaisical Security is dedicated to rapid response, transparency, and continuous improvement. We welcome audits, penetration tests, and responsible disclosure from the community.
