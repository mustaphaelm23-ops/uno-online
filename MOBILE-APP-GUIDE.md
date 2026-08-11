# 📱 Atlas Arena — Mobile App (Capacitor) Guide

This wraps your **existing web app** (the `client/` folder — no rewrite) into a
real **Android (.apk/.aab)** and **iPhone (.ipa)** app for the Play Store and
App Store. The game logic stays on your Node server; the app is just the UI.

Already done for you:
- ✅ `capacitor.config.json` (appId `com.atlasarena.app`, webDir `client`)
- ✅ The client server URL is now configurable via `window.ATLAS_SERVER_URL`
- ✅ Server CORS is open (`*`) so the app can connect

---

## 0) Prerequisites
- **Node.js** (already installed ✅)
- **Android:** [Android Studio](https://developer.android.com/studio) (free, Windows/Mac/Linux)
- **iPhone:** a **Mac** with **Xcode** (Apple requirement — iOS can only be built on macOS)

---

## 1) Put your server online (one-time, important)
A published app can't talk to `localhost` or a temporary cloudflared link
(those change every restart). Host the Node server once at a permanent HTTPS URL:

- Easiest free options: **Render.com**, **Railway.app**, or **Fly.io**.
- Push this project, set the start command to `node server/index.js`, and add
  env vars `JWT_SECRET` (any long random string) and optionally `MONGODB_URI`.
- You'll get a URL like `https://atlas-arena.onrender.com`.

> For quick TESTING only, you can temporarily use your current cloudflared link.

## 2) Point the app at your server
Open `client/index.html`, find this line near the top and paste your URL:
```html
<script>window.ATLAS_SERVER_URL = "https://atlas-arena.onrender.com";</script>
```
(Leave it `""` for normal web use — only set it for the packaged app.)

## 3) Add Capacitor + the platforms
Run these in the project folder (or just double-click **`SETUP-MOBILE.bat`**):
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync
```
For iPhone (on a Mac):
```bash
npm install @capacitor/ios
npx cap add ios
npx cap sync
```

## 4) Build / run the app
**Android:**
```bash
npx cap open android
```
→ Android Studio opens. Press ▶️ to run on a phone/emulator, or
**Build → Build Bundle(s)/APK(s)** to get an installable file.

**iPhone (Mac):**
```bash
npx cap open ios
```
→ Xcode opens. Pick your device and press ▶️.

> Every time you change `client/`, run `npx cap sync` to copy the new files in.

## 5) Publish
- **Play Store:** create a Google Play Console account ($25 one-time), upload the
  `.aab`, fill the listing, submit.
- **App Store:** create an Apple Developer account ($99/year), upload via Xcode →
  App Store Connect, submit for review.

---

## Notes
- **App icon / splash:** drop your icon in Android Studio (`res/mipmap`) or use
  `@capacitor/assets` to auto-generate from one image.
- **Service Worker:** harmless inside the app (it only caches the local UI; API
  + socket calls go to your `ATLAS_SERVER_URL` and bypass it). If it ever causes
  a stale screen in the native build, you can skip SW registration when
  `window.ATLAS_SERVER_URL` is set.
- **Auto-landscape:** the app already locks to landscape via the manifest +
  the in-app rotation logic.
- You do **not** need React Native — this ships the same vanilla code to both stores.
