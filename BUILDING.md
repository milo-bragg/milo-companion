# 🔨 Building Milo Companion for TestFlight

This guide walks you through building and distributing Milo Companion via TestFlight.

## Prerequisites

1. **Mac with Xcode** installed (latest version recommended)
2. **Apple Developer Account** — sign in at https://developer.apple.com
3. **EAS CLI** authenticated:
   ```bash
   npm install -g eas-cli
   eas login   # use milo.bragg.ai@gmail.com / #BOAZ4milo26
   ```
4. **Node.js 18+** and **npm**

## One-Time Setup

### 1. Install dependencies
```bash
cd milo-companion
npm install
```

### 2. Configure EAS project
```bash
eas build:configure
```
This will prompt for your Expo account and link the project.

### 3. Register your bundle ID with Apple
Log into https://developer.apple.com/account → Certificates, IDs & Profiles → Identifiers
Register `ai.openclaw.milo.companion` as an App ID.

---

## Build for TestFlight (Preview Build)

```bash
eas build --platform ios --profile preview
```

- This creates an `.ipa` and uploads it to EAS Build
- EAS will handle code signing automatically (you'll be prompted to create/use certs)
- Build takes ~10-15 minutes
- You'll get a download link when done

## Submit to TestFlight

After the build completes:
```bash
eas submit --platform ios --latest
```

Or manually:
1. Download the `.ipa` from the EAS Build dashboard
2. Open Xcode → Window → Organizer → Distribute App
3. Or use Transporter.app (free on Mac App Store)

## Development Build (with Expo Dev Client)

For a dev build you can run locally:
```bash
eas build --platform ios --profile development
```

Then install on your device and run:
```bash
npx expo start --dev-client
```

---

## Updating the App

For OTA updates (no App Store review needed for JS changes):
```bash
eas update --branch preview --message "Your update message"
```

This pushes updates to users who already have the TestFlight build installed.

---

## Environment Notes

- Bundle ID: `ai.openclaw.milo.companion`
- Expo slug: `milo-companion`
- Expo owner: `milo-bragg`
- Min iOS: 16.0 (set in Xcode project settings)

## After First TestFlight Install

1. Open the app
2. Go to **Settings** tab
3. Update the **Gateway URL** to the current Cloudflare Tunnel URL
   - Find it at: `/Users/openclaw/.openclaw/workspace/memory/tunnel-url.txt`
   - Or check the launchd service on the MacBook Air
4. Tap **Save & Connect**
5. The app will authenticate with the gateway automatically

## Troubleshooting

**"Device not approved"** — The gateway may require manual device approval. Check `~/.openclaw/openclaw.json` and ensure `gateway.nodes.autoApprove` is set.

**"Connection timeout"** — Verify the Cloudflare Tunnel is running on the MacBook Air:
```bash
launchctl list | grep cloudflared
```
If not running: `launchctl load ~/Library/LaunchAgents/com.cloudflare.cloudflared.plist`

**Voice input not working** — Voice input requires a custom dev client build (not Expo Go). Use the development profile to get full voice support.
