# 🐾 Milo Companion

A React Native + Expo iOS companion app for the [OpenClaw](https://github.com/milo-bragg) gateway — letting you chat directly with Milo (your AI assistant) from your iPhone.

## Features

- **Real-time chat** with Milo via WebSocket
- **OpenClaw v3 protocol** with Ed25519 device signing & pairing
- **Cloudflare Tunnel** support for remote access (not just LAN)
- **Session switcher** — switch between gateway sessions
- **Voice input** — mic button with speech recognition
- **Push notifications** when Milo responds in the background
- **Auto-reconnect** with exponential backoff
- **Dark mode** native UI

## Quick Start (Development)

```bash
npm install
npx expo start
```

Then scan the QR code with Expo Go on your iPhone, or press `i` for iOS simulator.

## Building for TestFlight

See [BUILDING.md](./BUILDING.md) for full instructions.

## Architecture

```
milo-companion/
  app/
    _layout.tsx          # Root layout, gateway context provider
    index.tsx            # Entry redirect
    (tabs)/
      _layout.tsx        # Tab navigator
      chat.tsx           # Main chat screen
      settings.tsx       # Gateway URL, device info, notifications
  components/
    ChatBubble.tsx       # Message bubble (user=blue/right, assistant=gray/left)
    VoiceButton.tsx      # Mic input button with pulse animation
    ConnectionStatus.tsx # Dot indicator (green/amber/red)
  lib/
    gateway.ts           # WebSocket client, OpenClaw v3 protocol
    crypto.ts            # Ed25519 keypair generation + signing (tweetnacl)
    storage.ts           # SecureStore wrappers for token, URL, session
    notifications.ts     # Expo push notifications setup
```

## OpenClaw Gateway Protocol (v3)

1. Server sends `connect.challenge` with a nonce
2. App generates Ed25519 keypair (stored in SecureStore), signs the payload
3. App sends `connect` request with signed device info
4. Server responds with `hello-ok` + `deviceToken` (saved for future connections)
5. App subscribes to chat session and starts receiving messages

## Cloudflare Tunnel

The gateway (localhost:18789) is exposed via Cloudflare Quick Tunnel. The URL changes on restart — update it in the Settings screen.

See tunnel URL: `/Users/openclaw/.openclaw/workspace/memory/tunnel-url.txt`

## Tech Stack

- Expo SDK 55
- React Native
- expo-router (file-based navigation)
- tweetnacl (Ed25519 signing, pure JS — no native modules)
- expo-secure-store (encrypted credential storage)
- expo-notifications (push notifications)
- expo-speech (TTS)
