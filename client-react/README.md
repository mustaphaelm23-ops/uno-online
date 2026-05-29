# UNO Online Arena — React Frontend

Fresh React + Vite + Tailwind frontend, lives alongside the existing vanilla `client/`.
Both can be served against the same Express + Socket.io backend in `server/`.

## Dev

```bash
# Terminal 1 — backend (default :8080)
node server/index.js
# or your dev script

# Terminal 2 — React app
cd client-react
npm install
npm run dev    # opens http://localhost:5173
```

Vite proxies `/api/*` and `/socket.io/*` to `http://localhost:8080`, so the React app
talks to the existing backend without CORS gymnastics.

## What's shipped here (v0.1)

- Auth flow (sign in / register) against `/api/auth/*`
- Lobby:
  - Sidebar nav
  - Welcome card with player stats
  - Featured Public Rooms (CLASSIC / FUN / RANKED / CHILL)
  - Action tiles: Create Room + Quick Match
  - Right rail: Battle Pass card, Friends Online (with INVITE), World Chat, Special Offer
  - Bottom action nav (stubs)
- **Create Room** modal — theme, max players, entry fee, public/private + password
- **Friend invite** — per-friend INVITE in the friends rail (enabled only when host is in a room)
- Room page stub — seats, host start CTA, leave

## What's NOT here yet (next commits)

- In-game UI (hand, table, opponents, animations)
- Victory podium
- Battle Pass rewards modal
- Shop UI
- Settings / Profile / Friends panel / DMs / Quick-chat
- Migration of the vanilla client's audio (currently muted by absence)

The backend is unchanged — all features (rooms, BP, shop, DMs, quick-chat, friends, etc.)
remain reachable. The React UI is being layered on incrementally.
