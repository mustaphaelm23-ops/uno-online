# Cardora — deployment guide

Ordered steps from "runs on my PC" to "live on a domain". Do them in order;
each one stands on its own, so you can stop and resume any time.

---

## Step 1 — MongoDB (free, ~15 min) ← DO THIS FIRST

The current `MONGODB_URI` points at a cluster that no longer exists
(`DNS Status=3` = deleted/renamed), so the game is running on `users.json`.
That works, but it's local-only and won't survive a server move.

1. Go to <https://cloud.mongodb.com> → sign in → **Build a Database**
2. Pick **M0 / FREE**, region closest to your players (Europe → Paris/Frankfurt)
3. **Database Access** → Add user → username + a strong password (save it)
4. **Network Access** → Add IP → `0.0.0.0/0` (any IP)
   - Tighten this to your VPS IP once Step 2 is done.
5. **Connect → Drivers → Node.js** → copy the connection string
6. Put it in `.env` (replace `<password>` with the real password):
   ```
   MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/cardora
   ```
7. Restart the server. You should see:
   ```
   [DB] ✅ Connected to MongoDB (direct)
   ```
   and `/api/health` should report `"mongo": true`.

The 61 accounts currently in `users.json` stay as a backup — nothing is lost.

---

## Step 2 — Domain + VPS (~$15 total)

- **Domain** (~$10/yr): Namecheap / Cloudflare Registrar. e.g. `cardora.app`
- **VPS** (~€4–6/mo): Hetzner CX22 or DigitalOcean — **Ubuntu 22.04**, 2 vCPU / 4 GB
- Point the domain's **A record** at the VPS IP (Cloudflare DNS is free and
  adds DDoS protection — set the record to **DNS only** at first, not proxied,
  so WebSockets connect cleanly while you test).

> Do **not** run production out of the OneDrive folder — OneDrive locks files
> (we hit `EPERM` during development).

---

## Step 3 — Put the code on the server

```bash
ssh root@YOUR_SERVER_IP

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git caddy

# App
git clone YOUR_REPO_URL /opt/cardora     # or scp the folder up
cd /opt/cardora
npm install --omit=dev

# Secrets
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # → JWT_SECRET
nano .env        # paste MONGODB_URI + JWT_SECRET (a NEW one, not the dev value)
```

---

## Step 4 — HTTPS + keep-alive

```bash
# HTTPS (edit the domain inside the file first)
cp Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy

# Process manager (replaces start-server.bat)
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup          # run the command it prints

# Firewall
ufw allow 22,80,443/tcp && ufw enable
```

Check <https://yourdomain.com/api/health> → `{"ok":true,...,"mongo":true}`

---

## Step 5 — Monitoring + backups

- **UptimeRobot** (free): monitor `https://yourdomain.com/api/health` every 5 min,
  email alert on failure.
- Watch `loopLagMs` in that response: **under 50 = healthy**. Consistently
  over 100 means it's time to scale (see below).
- The server already snapshots accounts to `backups/` every ~6h (last 8 kept).
  Add a cron job to copy that folder off the machine (Google Drive / S3).

---

## Step 6 — Voice chat across mobile networks (optional)

Players on 4G/5G behind strict NAT may not hear each other with STUN alone.
Add a TURN relay — no code changes needed, the server already reads these:

```
TURN_URL=turn:your.turn.host:3478
TURN_USER=...
TURN_PASS=...
```

Free tier: <https://metered.ca>. Self-hosted: `apt install coturn`.

---

## Step 7 — App stores

Requirements already built into the app:
- ✅ In-app account deletion (Profile → Delete my account) — Apple 5.1.1(v)
- ✅ Privacy policy at `/privacy`, support page at `/support`

Still to do:
- Google Play Console ($25 one-time) · Apple Developer ($99/yr)
- Package with Capacitor (`npx cap init`, then `cap add android` / `cap add ios`)
- Age rating questionnaire — answer the "simulated gambling" question honestly
  (virtual coins, no cash-out)
- Google Play requires **12 testers for 14 days** on new developer accounts —
  plan for it.

---

## Scaling beyond one process

Current shape: **one Node process, all game state in memory**. That's good for
roughly **2,000–3,000 concurrent players** on the VPS above.

Blockers to going higher, in the order they'd need solving:

1. **Single core** — Node uses one CPU. Fix: PM2 cluster mode.
2. **All users loaded into RAM** at boot (`loadUsers()` does `find({})`).
   Fine to ~100k accounts; past that it needs a lazy/LRU cache.
3. **No Redis** — rooms live in one process's memory, so multiple processes
   can't see each other. Fix: Redis socket.io adapter + room affinity
   (each room pinned to one process). A card game shards cleanly this way.

Don't build any of this before the numbers demand it. `loopLagMs` is the signal.
