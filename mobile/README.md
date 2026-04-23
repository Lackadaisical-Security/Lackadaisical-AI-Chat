# Lackadaisical AI Chat — Mobile App

A full-featured companion AI mobile application built with **Expo / React Native**, designed to connect to your self-hosted Lackadaisical AI Chat backend.

## Platform Priority

1. **Windows** (primary development + EAS build)
2. **Linux / macOS** (fully supported)
3. **Android** (primary device target)
4. **iOS** (supported via EAS Build + Apple Developer Program)

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18.0.0 | Required by Expo SDK 52 |
| npm / pnpm | latest | |
| Expo CLI | Latest via `npx expo` | No global install needed |
| EAS CLI | Latest | For device builds: `npm i -g eas-cli` |
| Android Studio | Latest | For Android emulator on Windows/Linux |
| Xcode | ≥ 15 | macOS only, for iOS simulator |

---

## Quick Start (Windows — Primary)

### 1. Install dependencies

```bat
cd mobile
npm install
```

### 2. Start the Expo dev server

```bat
npx expo start
```

This opens the Expo Developer Tools in your browser. From there:

- Press **`a`** to open an Android emulator (requires Android Studio)
- Press **`w`** to open a web preview
- Scan the QR code with **Expo Go** on your Android/iOS phone

### 3. Connect to your backend

Open the **Settings** tab in the app and set the **Backend URL** to your PC's local IP address:

```
http://192.168.1.100:3001
```

> **Windows Firewall**: Allow port 3001 through your firewall:
> ```powershell
> netsh advfirewall firewall add rule name="Lackadaisical AI" dir=in action=allow protocol=TCP localport=3001
> ```

---

## Quick Start (Linux / macOS)

```bash
cd mobile
npm install
npx expo start
```

---

## Building for Devices

### Android APK (recommended for testing)

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to Expo account
eas login

# Build a preview APK
eas build --platform android --profile preview
```

The resulting `.apk` can be installed directly on any Android phone.

### Android App Bundle (production)

```bash
eas build --platform android --profile production
```

### iOS (requires Apple Developer Program)

```bash
eas build --platform ios --profile production
```

---

## Project Structure

```
mobile/
├── App.tsx                    # Root component, loads settings
├── app.json                   # Expo project configuration
├── eas.json                   # EAS Build profiles
├── package.json
├── tsconfig.json
├── babel.config.js
├── assets/                    # Icons, splash screens
└── src/
    ├── types/index.ts         # Shared TypeScript types
    ├── services/
    │   ├── api.ts             # Full backend API client
    │   └── storage.ts        # Secure token + settings storage
    ├── store/index.ts         # Zustand global state
    ├── navigation/
    │   └── AppNavigator.tsx   # Bottom tab navigator
    ├── screens/
    │   ├── ChatScreen.tsx     # Full streaming chat UI
    │   ├── CompanionScreen.tsx # Companion mood & quick messages
    │   ├── SessionsScreen.tsx  # Session management
    │   ├── JournalScreen.tsx   # Personal journal
    │   └── SettingsScreen.tsx  # Model, API URL, preferences
    ├── components/
    │   ├── MessageBubble.tsx  # Chat message renderer
    │   └── ConnectionStatus.tsx # Health banner
    └── hooks/
        ├── useConnectionHealth.ts  # Polls /health every 30s
        └── useStreamingResponse.ts # SSE streaming via fetch POST
```

---

## Features

| Feature | Status |
|---------|--------|
| Real-time streaming chat (SSE) | ✅ |
| Non-streaming fallback | ✅ |
| Session management | ✅ |
| Conversation history loading | ✅ |
| Companion personality & mood display | ✅ |
| Journal (create / edit / delete) | ✅ |
| Model selector (Ollama + cloud) | ✅ |
| Temperature & max token controls | ✅ |
| Connection health monitoring | ✅ |
| Secure token storage (SecureStore) | ✅ |
| Dark / light / system theme | ✅ |
| Haptic feedback | ✅ |
| Clipboard copy for messages | ✅ |
| Uncensored mode toggle | ✅ |
| File attachments | 🔜 |
| Voice input | 🔜 |
| Push notifications | 🔜 |
| Offline mode | 🔜 |

---

## Streaming Architecture

The mobile app uses the **same POST-based SSE streaming** as the fixed web frontend:

```
POST /api/v1/chat
{
  "message": "...",
  "session_id": "...",
  "stream": true,
  "model": "gemma3:4b",
  "temperature": 0.7,
  "max_tokens": 4096
}
→ Content-Type: text/event-stream
data: {"type":"start"}
data: {"type":"content","content":"..."}
...
data: {"type":"end"}
data: {"type":"metadata","conversationId":42,...}
```

---

## Backend Connection

The mobile app connects to the same backend as the desktop web app. The backend URL defaults to `http://localhost:3001` but must be changed to your server's LAN IP when running on a physical device.

### Finding your Windows PC's IP

```powershell
ipconfig
# Look for IPv4 Address under your network adapter
# e.g., 192.168.1.100
```

Then set in Settings: `http://192.168.1.100:3001`

### Backend must allow CORS from your device

The backend `CORS_ORIGIN` setting may need to include your phone's network. For local development, the default permissive CORS config works. For production, add your app's origin.

---

## Environment Variables

The mobile app doesn't use `.env` files — all configuration is stored securely via `expo-secure-store` and managed through the Settings screen.

---

## Testing

```bash
npm test
```

Uses `jest-expo` preset. Test files go in `src/__tests__/` or alongside components as `*.test.tsx`.

---

## Type Checking

```bash
npm run type-check
```

---

## Troubleshooting

### "Connection refused" on physical device

- Ensure the backend is running: `npm run start` (from repo root)
- Use your PC's LAN IP, not `localhost`
- Check Windows Firewall (see Quick Start above)
- Ensure phone and PC are on the same WiFi network

### Expo Go QR code not working

- Try `npx expo start --tunnel` (requires `@expo/ngrok`)
- Or connect phone and PC to the same network and use LAN mode

### Build fails with "SDK not configured"

```bash
eas login
eas build:configure
```

### Android emulator not detected

- Open Android Studio → Device Manager → Start emulator
- Run `npx expo start` and press `a`
