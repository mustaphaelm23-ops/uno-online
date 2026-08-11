# Atlas Arena → Native App (Android + iOS) with Capacitor

Your project is already prepared for this:
- It's a **PWA** (`client/manifest.json` + `client/sw.js`).
- The client reads `window.ATLAS_SERVER_URL` (`client/ui/modules/06-core.js`) so a
  packaged app can point at a hosted backend instead of `localhost`.
- CORS is an **env-var allowlist** (`CORS_ORIGIN`) — no code change needed.

The app is **only the client**. The game + multiplayer run on the **server**, so the
first requirement is hosting the backend on a stable HTTPS URL.

---

## Phase 0 — Host the backend (required for any app)

1. **Pick a host with WebSocket support**: Railway, Render, Fly.io, or a small VPS
   (Hetzner / DigitalOcean). Socket.IO needs WebSockets — all of these support it.

2. **Use MongoDB for persistence.** On Railway/Render the filesystem is wiped on
   every redeploy, so `users.json` would not survive. The server already supports
   Mongo via `mongoose` — just set `MONGODB_URI` (MongoDB Atlas has a free tier).

3. **Set these environment variables on the host:**
   ```
   NODE_ENV=production
   JWT_SECRET=<a long random string, 32+ chars>
   MONGODB_URI=<your MongoDB Atlas connection string>
   CORS_ORIGIN=https://your-web-domain.com,capacitor://localhost,https://localhost
   ADMIN_USERS=mustapha
   PORT=8080
   ```
   - `capacitor://localhost` → the **iOS** app origin.
   - `https://localhost` → the **Android** app origin (Capacitor default).
   - Add your web domain too if you also serve the PWA from a browser.

4. Deploy and confirm `https://your-backend.com` loads the lobby over HTTPS.

---

## Phase 1 — Point the app at the backend

In `client/index.html` (line ~11) set:
```html
<script>window.ATLAS_SERVER_URL = "https://your-backend.com";</script>
```
> Leave it `""` for the browser/PWA build (it falls back to the page origin).
> Only the packaged Capacitor build needs the absolute URL. Best practice: keep a
> separate built copy of `client/` for the app with this value filled in.

---

## Phase 2 — Capacitor setup

From the project root:

```bash
# 1. Install Capacitor
npm install @capacitor/core
npm install -D @capacitor/cli

# 2. Initialise — webDir is your existing vanilla client folder
npx cap init "Atlas Arena" com.atlasarena.app --web-dir client

# 3. Add the platforms
npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios

# 4. Copy the web assets into the native projects
npx cap sync
```

This creates `android/` and `ios/` folders (native shells) + `capacitor.config.json`.

Re-run `npx cap sync` every time you change files in `client/`.

---

## Phase 3 — Build & test

**Android** (needs [Android Studio](https://developer.android.com/studio)):
```bash
npx cap open android      # opens Android Studio → Run on emulator/device
```

**iOS** (needs a **Mac** + Xcode):
```bash
npx cap open ios          # opens Xcode → Run on simulator/device
```

> ⚠️ iOS can **only** be built/published from a Mac. There is no way around this
> (Apple requirement). Android can be built from Windows.

---

## Phase 4 — Publish

| Store | Account | Cost |
|---|---|---|
| **Google Play** | Google Play Developer | **$25 one-time** |
| **Apple App Store** | Apple Developer Program | **$99 / year** |

- **Android**: in Android Studio → *Build → Generate Signed Bundle (AAB)* → upload
  to the Play Console.
- **iOS**: in Xcode → *Product → Archive* → upload to App Store Connect.

---

## Project-specific checklist

- [ ] Backend hosted on HTTPS + `MONGODB_URI` set (data survives redeploys).
- [ ] `CORS_ORIGIN` includes `capacitor://localhost` and `https://localhost`.
- [ ] `window.ATLAS_SERVER_URL` set to the backend URL in the packaged `client/`.
- [ ] `JWT_SECRET` is a real 32+ char secret on the host (sessions persist).
- [ ] Orientation is already `landscape` in `manifest.json` — Capacitor respects it,
      but also set it in each native project (Android `AndroidManifest.xml`
      `screenOrientation`, iOS *Deployment Info → Device Orientation*).
- [ ] App icons: you have `icon-192/512/maskable.png`. Generate the full native icon
      set with `npx @capacitor/assets generate` (put a 1024×1024 `icon.png` +
      `splash.png` in an `assets/` folder first).

---

## Optional native niceties (later)

- `@capacitor/push-notifications` — match invites / "your turn" pushes.
- `@capacitor/haptics` — vibrate on a card play / win.
- `@capacitor/status-bar` + `@capacitor/splash-screen` — polish the launch.
- `@capacitor/app` — handle Android back button (exit room vs. exit app).
