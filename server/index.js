/*!
 * RONDAONE — Copyright © 2026 Mustapha. All rights reserved.
 * Proprietary and confidential. See the LICENSE file at the project root.
 * Unauthorized copying, modification, distribution, or use of this file or
 * any part of the RONDAONE source, via any medium, is strictly prohibited.
 */
'use strict';

// ── Minimal .env loader (zero dependency) ──
// The `dotenv` package was removed from node_modules, so process.env
// wasn't picking up the local .env (MONGODB_URI, JWT_SECRET, etc). This
// tiny loader parses .env at boot WITHOUT a dependency: KEY=VALUE lines,
// ignores blanks + #comments, never overwrites a var already set in the
// real environment (so prod/host env always wins).
(function loadDotEnv(){
  try{
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', '.env');
    if(!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for(const raw of lines){
      const line = raw.trim();
      if(!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if(eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      // Strip surrounding quotes if present.
      if((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))){
        val = val.slice(1, -1);
      }
      if(key && !(key in process.env)) process.env[key] = val;
    }
  }catch(e){ console.warn('[env] .env load failed:', e.message); }
})();

const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const cors         = require('cors');
const jwt          = require('jsonwebtoken');
const bcrypt       = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { GameManager, PHASE, EV } = require('../src/core/GameManager');
const GAME_EVENTS = EV;
const GAME_PHASE  = PHASE;
const { Player }                 = require('../src/core/Player');
const { DamaManager }            = require('../src/core/DamaManager');
const { ChessManager, TIME_CONTROLS: CHESS_TIME_CONTROLS } = require('../src/core/ChessManager');
const { RondaManager }           = require('../src/core/RondaManager');

// Picks the right engine for a room. DAMA rooms get the 8×8
// Moroccan Dama engine; RONDA rooms get the 40-card Spanish-deck
// engine; everything else falls back to the UNO engine.
function makeGameForRoom(roomId, settings, roomType){
  if (roomType === 'DAMA')  return new DamaManager(roomId, settings);
  if (roomType === 'CHESS') return new ChessManager(roomId, settings);
  if (roomType === 'RONDA') return new RondaManager(roomId, settings);
  return new GameManager(roomId, settings);
}

// ─────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────

// JWT secret — fail-secure boot.
// Old behaviour: if JWT_SECRET wasn't set, the server fell back to a
// hard-coded constant. That constant lived in this file (public repo),
// which meant ANYONE could forge tokens for ANYONE in any deployment
// that hadn't set the env var. Catastrophic.
//
// New behaviour:
//   • If JWT_SECRET is set → use it.
//   • If not set AND NODE_ENV=production → REFUSE TO START. Loud crash.
//   • If not set AND dev → generate a random 64-byte secret at boot,
//     log a warning, and continue. Tokens won't survive a restart, but
//     that's the correct semantic for an ephemeral dev secret.
function resolveJwtSecret(){
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('\n[FATAL] JWT_SECRET env var is required in production (and must be >= 32 chars).');
    console.error('[FATAL] Set JWT_SECRET to a long random string before starting the server.\n');
    process.exit(1);
  }
  const ephemeral = require('crypto').randomBytes(64).toString('hex');
  console.warn('[WARN] JWT_SECRET not set — generated an ephemeral secret for this run.');
  console.warn('[WARN] Tokens will be invalidated on every restart. Set JWT_SECRET in your env to persist sessions.');
  return ephemeral;
}

const CONFIG = Object.freeze({
  PORT:           process.env.PORT           || 8080,
  JWT_SECRET:     resolveJwtSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  // CORS — accept a comma-separated allowlist via env. `*` is allowed
  // outside production but will trigger a warning. In production, an
  // unset / wildcard origin makes the server refuse to start.
  CORS_ORIGIN:    process.env.CORS_ORIGIN    || '*',
  // bcrypt cost factor — 12 is the modern baseline (~250ms on a server
  // CPU). Was 10 (~75ms) which is now considered too cheap for offline
  // dictionary attacks against a stolen DB.
  SALT_ROUNDS:    12,
  ROOM_CLEANUP_INTERVAL: 60000,
  MAX_ROOMS_PER_USER:    3,
  DEFAULT_COINS:         1000,
  WIN_COINS_BASE:        100,
  LOSE_COINS:            20,
  BROKE_GIFTS:           [500, 200, 100],
  BROKE_COOLDOWN:        43200000,
  INSTA_REWARD:          1000,
  DAILY_LOGIN_COINS:     1000,
});

// CORS production sanity check.
if (process.env.NODE_ENV === 'production' && (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN.trim() === '*')) {
  console.error('\n[FATAL] CORS_ORIGIN must be set to an explicit origin (or comma-separated list) in production.');
  console.error('[FATAL] Wide-open CORS lets any site speak to this API on behalf of authenticated users.\n');
  process.exit(1);
}

// Parsed CORS allowlist — Set lookup is O(1) per request.
const CORS_ALLOWLIST = (() => {
  const raw = String(CONFIG.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  return new Set(raw);
})();
function isCorsOriginAllowed(origin){
  if (!origin) return true;                       // same-origin / curl
  if (CORS_ALLOWLIST.has('*')) return true;
  return CORS_ALLOWLIST.has(origin);
}

// ─────────────────────────────────────────
// IN-MEMORY DATABASE
// ─────────────────────────────────────────

const mongoose = require('mongoose');
const usersDB = new Map();

// MongoDB User Schema
const UserSchema = new mongoose.Schema({
  // INDEXED — every save goes through `{ id }` (bulkWrite/findOneAndUpdate) and
  // logins look up by username. Without these Mongo COLLECTION-SCANS the whole
  // users collection on every single write: fine at 100 accounts, fatal at
  // 50k. `id` is our real primary key, so it's unique too.
  id: { type: String, required: true, unique: true, index: true },
  username: { type: String, index: true },
  passwordHash: String,
  coins: { type: Number, default: 1000 },
  // Premium currency (GDD §6.1). New accounts start with 100. Existing
  // accounts get a one-time +100 grant on next server boot via
  // grantDiamondsV1() — gated by the grant_diamonds_v1 flag below.
  diamonds: { type: Number, default: 100 },
  grant_diamonds_v1: Boolean,
  avatar: String,
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
  },
  lastLoginAt: Number,
  lastDailyClaimAt: Number,
  lastLoginBonus: Number,
  migrationBonus: Boolean,
  instaFollowed: Boolean,
  brokeCount: Number,
  brokeCount2: Number,
  lastBrokeAt: Number,
  createdAt: Number,
}, { strict: false });

const UserModel = mongoose.model('User', UserSchema);

// ── World Chat persistence ─────────────────────────────────────────────
// Rolling window: keep last 200 messages persisted, show last 40 on connect.
// In-memory `worldChat` mirrors the DB tail so socket connects don't hit DB.
const WORLD_CHAT_CAP = 200;
const WORLD_CHAT_HISTORY = 40;
const WorldMessageSchema = new mongoose.Schema({
  id:      { type: String, required: true, unique: true, index: true },
  userId:  String,
  name:    String,
  avatar:  String,
  text:    String,
  at:      { type: Number, index: true },
}, { strict: false });
const WorldMessageModel = mongoose.model('WorldMessage', WorldMessageSchema);

// Admin audit log — persistent record of every privileged action so the
// trail survives server restarts (the in-memory ring buffer in CONFIG
// section is fast-path; THIS is the source of truth). Indexed on `at`
// for fast time-range queries during incident review.
const AdminAuditSchema = new mongoose.Schema({
  at:        { type: Number, required: true, index: true },
  actor:     { type: String, index: true },     // userId of the admin
  actorName: String,
  action:    { type: String, index: true },     // e.g. "admin.add_coins"
  ip:        String,
  ua:        String,
  details:   mongoose.Schema.Types.Mixed,
}, { strict: false });
const AdminAuditModel = mongoose.model('AdminAudit', AdminAuditSchema);

// Refresh-token registry — server-side state that lets us REVOKE
// sessions before their JWT naturally expires. Access tokens are now
// short-lived (15min); when they expire the client trades a refresh
// token for a fresh access token via /api/auth/refresh.
//
// Token rotation: each refresh issues a brand-new refresh token and
// flips the old one to `revoked`. If a stale refresh token is ever
// reused (someone stole it AND we already rotated), we treat it as
// a confirmed theft signal — revoke the whole user's session family.
const RefreshTokenSchema = new mongoose.Schema({
  id:           { type: String, required: true, unique: true, index: true },
  userId:       { type: String, required: true, index: true },
  family:       { type: String, required: true, index: true }, // shared across rotations of the same session
  tokenHash:    { type: String, required: true, index: true }, // sha256(plaintext)
  createdAt:    { type: Number, required: true },
  expiresAt:    { type: Number, required: true },
  revokedAt:    { type: Number, default: 0, index: true },
  rotatedToId:  { type: String, default: null }, // child token id after rotation (for theft detection)
  ip:           String,
  ua:           String,
  lastUsedAt:   Number,
}, { strict: false });
const RefreshTokenModel = mongoose.model('RefreshToken', RefreshTokenSchema);

async function loadWorldChat() {
  try {
    if (!mongoose.connection.readyState) return;
    const msgs = await WorldMessageModel.find({}).sort({ at: -1 }).limit(WORLD_CHAT_CAP).lean();
    msgs.reverse();                            // oldest first, so push order matches chat order
    worldChat.length = 0;
    msgs.forEach(m => worldChat.push({
      id: m.id, userId: m.userId, name: m.name, avatar: m.avatar, text: m.text, at: m.at,
    }));
    console.log(`[World] Loaded ${msgs.length} chat messages from MongoDB`);
  } catch (e) {
    console.log('[World] Failed to load chat from MongoDB:', e.message);
  }
}

async function saveWorldMessage(entry) {
  try {
    if (!mongoose.connection.readyState) return;
    await WorldMessageModel.create(entry);
  } catch (e) {
    // Don't crash the chat path on a single failed save — message is already broadcast.
    console.log('[World] saveWorldMessage failed:', e.message);
  }
}

async function pruneWorldMessages() {
  // Keep DB collection bounded at WORLD_CHAT_CAP. Probabilistic: only runs on
  // ~5% of sends so the chat path stays cheap.
  try {
    if (!mongoose.connection.readyState) return;
    const count = await WorldMessageModel.estimatedDocumentCount();
    if (count <= WORLD_CHAT_CAP + 20) return;     // small buffer to avoid per-msg pruning
    const cutoff = await WorldMessageModel
      .find({}).sort({ at: -1 }).skip(WORLD_CHAT_CAP).limit(1).lean();
    if (cutoff[0]) {
      await WorldMessageModel.deleteMany({ at: { $lt: cutoff[0].at } });
    }
  } catch (e) {
    console.log('[World] pruneWorldMessages failed:', e.message);
  }
}

// Single entry point for ALL game-reaction validation. Mirrors the world-chat
// moderation pattern so future filters (emoji allowlist, abuse patterns,
// per-user windowed throttle) plug in here without touching the socket
// handler. Hard server-side floor — the client also enforces a 5s UX
// cooldown but that can be bypassed by a tampered client; this can't.
function moderateGameReaction(rawEmoji, user, socket) {
  const emoji = String(rawEmoji || '').slice(0, 4);
  if (!emoji) return { ok: false, reason: 'empty' };

  // 1s per-socket throttle. Locked in as the hard cheat-resistant floor.
  const now = Date.now();
  if (socket._lastReaction && now - socket._lastReaction < 1000) {
    return { ok: false, reason: 'rate_limit' };
  }

  // ── Future moderation plugins (add here, no other changes needed) ──
  // if (!EMOJI_ALLOWLIST.has(emoji)) return { ok:false, reason:'not_allowed' };
  // if (perUserAbusePattern(user.id, emoji)) return { ok:false, reason:'abuse' };
  // ──────────────────────────────────────────────────────────────────

  return { ok: true, emoji };
}

// Single entry point for ALL world-chat message validation. Future filters
// (link blocker, profanity, per-user rate-limit window, spam patterns) plug
// in here without touching the socket handler. Always returns { ok, text?,
// reason? } — `reason` is a stable string code so the client can later
// surface specific feedback ("rate_limit", "links_blocked", etc.).
function moderateWorldMessage(rawText, user, socket) {
  const text = String(rawText || '').trim().slice(0, 200);
  if (!text) return { ok: false, reason: 'empty' };

  // Anti-spam throttle: 1.2s per socket between messages (preserved from prior logic).
  const now = Date.now();
  if (socket._lastWorldMsg && now - socket._lastWorldMsg < 1200) {
    return { ok: false, reason: 'rate_limit' };
  }

  // ── Future moderation plugins (add here, no other changes needed) ──
  // if (/(https?:\/\/|www\.)/i.test(text)) return { ok:false, reason:'links_blocked' };
  // if (containsProfanity(text)) return { ok:false, reason:'profanity' };
  // if (perUserRateExceeded(user.id)) return { ok:false, reason:'rate_limit_window' };
  // ──────────────────────────────────────────────────────────────────

  return { ok: true, text };
}

// ── Resilient Mongo connect (works around ISP DNS that blocks SRV) ──
// Many home/ISP networks refuse `mongodb+srv` SRV record lookups
// (querySrv ECONNREFUSED). We first try a normal connect; if that fails on an
// SRV URI we resolve the cluster's SRV + TXT records over DNS-over-HTTPS
// (port 443 — essentially never blocked), rebuild a standard `mongodb://`
// seed-list URI, and connect with that. A-record lookups for the seed hosts
// still use the system DNS (those are rarely blocked — only SRV usually is).
function _dohOnce(base, name, type){
  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.get(
      `${base}?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: 'application/dns-json' }, timeout: 8000 },
      (res) => { let s=''; res.on('data',c=>s+=c); res.on('end',()=>{
        try{ const j = JSON.parse(s); j._provider = base; resolve(j); }
        catch(e){ reject(new Error(`${base} HTTP ${res.statusCode} non-JSON`)); }
      }); }
    );
    req.on('error', (e) => reject(new Error(`${base} ${e.code || e.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error(`${base} timeout`)); });
  });
}
async function _dohResolve(name, type){
  const providers = ['https://dns.google/resolve', 'https://cloudflare-dns.com/dns-query'];
  let lastErr;
  for(const base of providers){
    try { return await _dohOnce(base, name, type); }
    catch(e){ lastErr = e; }
  }
  throw lastErr || new Error('all DoH providers failed');
}
async function _buildSeedlistFromSrv(uri){
  const m = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)(\/[^?]*)?(\?.*)?$/);
  if(!m) throw new Error('URI is not mongodb+srv');
  const [, user, pass, host, path = '/', query = ''] = m;
  const srv = await _dohResolve('_mongodb._tcp.' + host, 'SRV');
  const hosts = (srv.Answer || []).map(a => {
    const p = String(a.data).trim().split(/\s+/);          // priority weight port target
    return p[3].replace(/\.$/, '') + ':' + p[2];
  });
  if(!hosts.length) throw new Error(`no SRV hosts (via ${srv._provider||'DoH'}, DNS Status=${srv.Status}, ${(srv.Answer||[]).length} answers) — Status=3 means the cluster name is wrong/deleted; Status=0 with 0 answers means DNS interception`);
  const opts = new URLSearchParams(query.replace(/^\?/, ''));
  try {
    const txt = await _dohResolve(host, 'TXT');
    const txtStr = (txt.Answer || []).map(a => String(a.data).replace(/^"|"$/g,'').replace(/\\"/g,'')).join('&');
    for(const kv of txtStr.split('&')){ const i = kv.indexOf('='); if(i>0) opts.set(kv.slice(0,i), kv.slice(i+1)); }
  } catch(e){ /* TXT optional */ }
  opts.set('ssl', 'true');
  if(!opts.has('authSource')) opts.set('authSource', 'admin');
  return `mongodb://${user}:${pass}@${hosts.join(',')}${path}?${opts.toString()}`;
}
// Connection pool — the default (100) is far more than one game process
// needs and can exhaust an Atlas tier's connection budget once you run
// several processes. 20 sockets comfortably saturates our batched writes.
const MONGO_POOL = { maxPoolSize: 20, minPoolSize: 2, socketTimeoutMS: 45000 };
async function connectMongo(uri){
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000, ...MONGO_POOL });
    return 'direct';
  } catch(e1){
    const msg1 = (e1.message || '').split('\n')[0];
    if(/^mongodb\+srv:/.test(uri) && /querySrv|ENOTFOUND|ECONNREFUSED|ETIMEOUT|getaddrinfo/i.test(msg1)){
      console.log('[DB] SRV lookup blocked (' + msg1 + ') — trying DNS-over-HTTPS fallback…');
      const seed = await _buildSeedlistFromSrv(uri);
      await mongoose.connect(seed, { serverSelectionTimeoutMS: 12000, ...MONGO_POOL });
      return 'dns-over-https';
    }
    throw e1;
  }
}

async function loadUsers() {
  let dbStatus = 'in-memory (no MONGODB_URI set)';
  try {
    const uri = process.env.MONGODB_URI;
    if (uri) {
      const how = await connectMongo(uri);
      console.log(`[DB] ✅ Connected to MongoDB (${how})`);
      const users = await UserModel.find({});
      users.forEach(u => usersDB.set(u.id, u.toObject()));
      console.log(`[DB] Loaded ${users.length} users from MongoDB`);
      dbStatus = `CONNECTED via ${how} — loaded ${users.length} users`;
    } else {
      console.log('[DB] No MONGODB_URI — using in-memory only');
    }
  } catch(e) {
    const reason = (e.message||'').split('\n')[0];
    console.log('[DB] ⚠️  MongoDB connection failed — running in-memory. Reason:', reason);
    dbStatus = 'FAILED: ' + reason;
  }
  // Write the DB result to a file so it can be checked without hunting through
  // the server console window.
  try { require('fs').writeFileSync('db-status.txt', new Date().toISOString() + '\n' + dbStatus + '\n'); } catch(e){}

  // Local file persistence fallback — when Mongo is unreachable, load users
  // from users.json so progress (coins, inventory, titles…) survives restarts
  // anyway. Must run BEFORE the admin/avatar passes below (they iterate usersDB).
  if (!mongoose.connection.readyState) {
    try {
      const fs = require('fs');
      if (fs.existsSync('users.json')) {
        const arr = JSON.parse(fs.readFileSync('users.json', 'utf8'));
        let n = 0;
        arr.forEach(u => { if (u && u.id) { usersDB.set(u.id, u); n++; } });
        console.log(`[DB] Loaded ${n} users from users.json (local persistence)`);
      } else {
        console.log('[DB] No users.json yet — starting fresh (will be created on first save)');
      }
    } catch(e) { console.log('[DB] users.json load failed:', e.message); }
  }
  // Promote allow-listed accounts to admin. The list is taken from the
  // ADMIN_USERS env var (comma-separated usernames, case-insensitive).
  // Defaults to the single owner-account when the var is unset so the
  // game ships with a known admin without any hardcoded credential.
  const adminList = String(process.env.ADMIN_USERS || 'mustapha')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  let promoted = 0;
  for (const u of usersDB.values()) {
    const isAdmin = u && u.username && adminList.includes(String(u.username).toLowerCase());
    if (u.isAdmin !== isAdmin) {
      u.isAdmin = isAdmin;
      if (isAdmin) promoted++;
    }
  }
  if (promoted) console.log(`[Admin] Promoted ${promoted} account(s) from ADMIN_USERS`);

  // One-time avatar migration (v2). Replace every legacy avatar (null or
  // old emoji presets) with one of the new framed portrait images. Gated
  // by avatarMigratedV2 so a user's later pick from the new set sticks.
  let migrated = 0;
  for (const u of usersDB.values()) {
    if (!u || u.id?.startsWith('__')) continue;
    if (!u.avatarMigratedV2) {
      if (!AVATAR_PRESET_RE.test(u.avatar || '')) u.avatar = randomPresetAvatar();
      u.avatarMigratedV2 = true;
      migrated++;
    }
  }
  if (migrated) { console.log(`[Avatars] Migrated ${migrated} account(s) to the new portrait set`); saveUsers(); }

  // Showcase/dev account (Mustapha — shortId 951808283) ONLY. Scoped entirely
  // to this one account — the global level system is untouched (still max 500).
  // Re-applied on EVERY boot so it can never drift: Level 100 (shown as a maxed
  // bar via sanitizeUser) + Grandmaster (the top ranked tier).
  const BEST_ACCOUNT_LEVEL = 100;
  const BEST_ACCOUNT_SHORTIDS = new Set(['951808283']);   // dev/showcase accounts
  let bestPinned = false;
  for (const u of usersDB.values()) {
    if (!u || u.id?.startsWith('__')) continue;
    const isTarget = (u.username && u.username.toLowerCase() === 'mustapha')
                  || BEST_ACCOUNT_SHORTIDS.has(String(u.shortId));
    if (!isTarget) continue;
    ensureRankedFields(u);
    u.rankPoints            = 15000;                                 // top of Grandmaster
    u.peakRankPoints        = Math.max(u.peakRankPoints || 0, 15000);
    u.placementGamesPlayed  = Math.max(u.placementGamesPlayed || 0, 5);
    u.hasCompletedPlacement = true;
    u.rankedTier            = null;   // force a fresh recompute (was cached at Silver)
    u.accountXP             = (BEST_ACCOUNT_LEVEL - 1) * ACCOUNT_XP_PER_LEVEL + 500;  // → Level 100
    u.accountLevel          = BEST_ACCOUNT_LEVEL;
    u.grant_best_account_v1 = true;
    bestPinned = true;
    console.log(`[Grant] ${u.username} → Grandmaster + Level ${BEST_ACCOUNT_LEVEL} (best account, this account only)`);
  }
  if (bestPinned) saveUsers();
}

// Debounced local JSON write (coalesces the many saveUsers() calls into one
// disk write ~700ms after the last change — keeps disk churn low at scale).
let _jsonSaveTimer = null;
// Rotating safety net: every ~6h, snapshot the CURRENT (known-good) users.json
// into backups/ before overwriting it, keeping the last 8 snapshots. Protects
// every account against file corruption, a bad deploy, or an accidental wipe.
let _lastUsersBackupAt = 0;
function _maybeBackupUsers(fs){
  const now = Date.now();
  if (now - _lastUsersBackupAt < 6 * 3600 * 1000) return;
  _lastUsersBackupAt = now;
  try {
    if (!fs.existsSync('users.json')) return;
    if (!fs.existsSync('backups')) fs.mkdirSync('backups');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    fs.copyFileSync('users.json', `backups/users-${stamp}.json`);
    const old = fs.readdirSync('backups').filter(f => /^users-.*\.json$/.test(f)).sort();
    while (old.length > 8) fs.unlinkSync('backups/' + old.shift());
    console.log(`[DB] users.json backup → backups/users-${stamp}.json`);
  } catch(e) { console.log('[DB] backup failed (non-fatal):', e.message); }
}
function _flushUsersJson(){
  _jsonSaveTimer = null;
  try {
    const fs = require('fs');
    _maybeBackupUsers(fs);
    const data = JSON.stringify([...usersDB.values()]);
    // Atomic write: dump to a temp file, then rename over the live file.
    // rename() is atomic on the same volume, so a crash / kill / disk-full
    // mid-write can NEVER leave a truncated users.json (which would wipe every
    // account on the next boot). users.json stays valid until the final swap.
    fs.writeFileSync('users.json.tmp', data);
    fs.renameSync('users.json.tmp', 'users.json');
  } catch(e) { console.log('[DB] users.json save failed:', e.message); }
}
function _scheduleJsonSave(){
  if (_jsonSaveTimer) return;
  _jsonSaveTimer = setTimeout(_flushUsersJson, 700);
}

// Debounced, batched Mongo save. The old path looped EVERY user with a
// SERIAL findOneAndUpdate on EVERY saveUsers() call (each claim, each match
// end…) — thousands of blocking round-trips under load, stalling the whole
// server. Now: calls inside a 4s window coalesce into ONE unordered
// bulkWrite, and flushes never overlap (a call landing mid-flush simply
// re-arms one more flush).
let _mongoSaveTimer = null, _mongoSaveRunning = false, _mongoSaveAgain = false;
async function _flushUsersMongo(){
  _mongoSaveTimer = null;
  if (_mongoSaveRunning){ _mongoSaveAgain = true; return; }
  _mongoSaveRunning = true;
  try {
    const ops = [...usersDB.values()].map(u => ({
      replaceOne: { filter: { id: u.id }, replacement: u, upsert: true },
    }));
    if (ops.length) await UserModel.bulkWrite(ops, { ordered: false });
  } catch(e) {
    console.log('[DB] Mongo bulk save failed:', e.message);
  } finally {
    _mongoSaveRunning = false;
    if (_mongoSaveAgain){ _mongoSaveAgain = false; _scheduleMongoSave(); }
  }
}
function _scheduleMongoSave(){
  if (_mongoSaveTimer) return;
  _mongoSaveTimer = setTimeout(_flushUsersMongo, 4000);
}
async function saveUsers() {
  if (mongoose.connection.readyState) _scheduleMongoSave();
  else _scheduleJsonSave();      // Mongo offline → persist to users.json instead
}
// Flush pending local saves on graceful shutdown (Ctrl+C / SIGTERM). A forced
// taskkill can't be trapped on Windows, but the 700ms debounce caps the loss.
['SIGINT','SIGTERM'].forEach(sig => process.on(sig, () => {
  if (!mongoose.connection.readyState && _jsonSaveTimer) { try { _flushUsersJson(); } catch(e){} }
  process.exit(0);
}));
// One-time +100 diamond grant for every existing user (GDD §6.1 onboarding).
// Idempotent: gated by user.grant_diamonds_v1 so it runs exactly once per user
// regardless of how many times the server restarts. New accounts get diamonds
// via the UserSchema default (100), so this only catches accounts that existed
// before the diamonds field was added.
//
// IMPORTANT — this MUST run after loadUsers() resolves (so usersDB is populated),
// not as a top-level IIFE like the legacy grantCoins/grantMustaphaMillion functions
// below which run with an empty usersDB and effectively no-op. Wired into the
// loadUsers().then() chain near server.listen().
async function grantDiamondsV1(){
  let granted = 0;
  for (const user of usersDB.values()) {
    if (!user.grant_diamonds_v1) {
      user.diamonds = (user.diamonds || 0) + 100;
      user.grant_diamonds_v1 = true;
      granted++;
    }
  }
  if (granted) {
    console.log(`[Grant] +100 diamonds to ${granted} existing user(s)`);
    await saveUsers();
  }
}

// One-time coin grants
(function grantCoins(){
  const grants = { 'mustapha': 50000, 'mustapha98': 100000, 'mustapha98_v2': 100000 };
  let changed = false;
  for (const [uname, amount] of Object.entries(grants)) {
    const user = [...usersDB.values()].find(u => u.username && u.username.toLowerCase() === uname);
    const realName = uname.replace('_v2','');
    const User = [...usersDB.values()].find(u => u.username && u.username.toLowerCase() === realName);
    if (user && !user['grant_' + uname]) {
      user.coins += amount;
      user['grant_' + uname] = true;
      changed = true;
      console.log(`[Grant] +${amount} coins to ${user.username}`);
    }
  }
  if (changed) saveUsers();
})();

// One-time +1,000,000 grant for Mustapha
(function grantMustaphaMillion(){
  const u = [...usersDB.values()].find(x => x.username && x.username.toLowerCase() === 'mustapha');
  if (u && !u.grant_million_2026) {
    u.coins = (u.coins || 0) + 1000000;
    u.grant_million_2026 = true;
    saveUsers();
    console.log(`[Grant] +1,000,000 coins to ${u.username} (total: ${u.coins})`);
  }
})();

const roomsDB = new Map();
const matchmakingQueue = [];
const socketToUser = new Map();
// userId -> Set<socketId>. Lets us cap concurrent sockets per account so one
// client can't exhaust the server by opening thousands of connections.
const userSockets = new Map();
const MAX_SOCKETS_PER_USER = 8;   // generous: several tabs + devices
// ── Featured-room types ──────────────────────────────────────────────
// Single source of truth for the 4 mockup rooms (Classic / Fun / Ranked /
// Chill). RANKED gets a fixed badge that never moves; HOT is computed at
// request time as the most-populated NON-RANKED type. PRIVATE = ad-hoc
// rooms from the Create Room / Join by Code flow (no badge, not featured).
const ROOM_TYPES = {
  CLASSIC: { label: 'Classic Room', maxPlayers: 4, entryFee: 100, ranked: false, badge: null     },
  // RONDA is currently a LOBBY-ONLY tile (cosmetic slot). The engine is
  // being rebuilt step-by-step with the user; quick-join into RONDA falls
  // back to CLASSIC until the dedicated engine is wired back up.
  RONDA:       { label: 'Ronda',      maxPlayers: 4, entryFee: 200, ranked: false, badge: null, game: 'RONDA' },
  // CHESS — 1v1 standard chess. Full engine in ChessManager (replaced the
  // never-implemented TBA9_ZROUT placeholder on 2026-07-21).
  CHESS:       { label: 'Chess',      maxPlayers: 2, entryFee: 200, ranked: false, badge: null, game: 'CHESS' },
  // DAMA — 1v1 Moroccan Dama / checkers. Full engine in DamaManager.
  DAMA:        { label: 'Dama',       maxPlayers: 2, entryFee: 200, ranked: false, badge: null, game: 'DAMA' },
  // RANKED entry is dynamic per player tier (see RANKED_ENTRY_BY_TIER /
  // rankedEntryFor()). The `entryFee` here is only the room-level floor
  // (the lowest possible stake, paid by placement/Bronze players), so
  // legacy code that reads cfg.entryFee for budgeting / preflight
  // doesn't break. The actual per-player debit is computed at seat time.
  RANKED:  { label: 'Ranked Room',  maxPlayers: 4, entryFee: 500, ranked: true,  badge: 'RANKED' },
  CHILL:   { label: 'Chill Room',   maxPlayers: 4, entryFee: 100, ranked: false, badge: null     },
};

// Ranked entry fee climbs with the player's tier. Placement starts at the
// base stake; each promotion bumps to the next bracket so a Master room
// has serious skin in the game. Players in the same RANKED room can pay
// DIFFERENT amounts — pot is the sum, payouts share proportionally.
//
//   Placement (no tier yet) → 500
//   Bronze                  → 800
//   Silver                  → 1200
//   Gold                    → 1800
//   Platinum                → 2500
//   Diamond                 → 5000
//   Master                  → 10000
//   Grandmaster             → 25000
const RANKED_ENTRY_BY_TIER = {
  Placement:   500,
  Bronze:      800,
  Silver:      1200,
  Gold:        1800,
  Platinum:    2500,
  Diamond:     5000,
  Master:      10000,
  Grandmaster: 25000,
};
function rankedEntryFor(user){
  if(!user) return RANKED_ENTRY_BY_TIER.Placement;
  ensureRankedFields(user);
  if((user.placementGamesPlayed || 0) < 5) return RANKED_ENTRY_BY_TIER.Placement;
  const tier = getLeague(user.rankPoints || 0);
  return RANKED_ENTRY_BY_TIER[tier.name] || RANKED_ENTRY_BY_TIER.Bronze;
}
// CHESS took the slot TBA9_ZROUT held (it was never implemented; chess is
// a real playable engine). RANKED stays out of the featured tiles — it's
// reachable via the Ranked hub modal, Browse Rooms, and Quick Match.
const FEATURED_TYPE_ORDER = ['CLASSIC', 'RONDA', 'CHESS', 'DAMA'];
const QUICK_MATCH_POOL    = ['CLASSIC', 'CHILL'];            // RANKED excluded — risks rating

// ── In-App Purchase packages (GDD §6.2) ───────────────────────────────
// Single source of truth for what each USD package grants. The shop
// endpoints + client read from this; if pricing/contents change, edit
// here only. Bonus = the % "bonus" displayed in the UI (purely cosmetic;
// the coins/diamonds values already include it baked in per GDD spec).
// usd is in USD cents (49.99 -> 4999) to avoid float drift.
const IAP_PACKAGES = {
  starter:  { id:'starter',  label:'Starter',  coins:10000,  diamonds:100,  usd_cents:99,    bonus_pct:0  },
  value:    { id:'value',    label:'Value',    coins:55000,  diamonds:550,  usd_cents:499,   bonus_pct:10 },
  premium:  { id:'premium',  label:'Premium',  coins:120000, diamonds:1200, usd_cents:999,   bonus_pct:20 },
  mega:     { id:'mega',     label:'Mega',     coins:350000, diamonds:3500, usd_cents:2499,  bonus_pct:40 },
  ultimate: { id:'ultimate', label:'Ultimate', coins:800000, diamonds:8000, usd_cents:4999,  bonus_pct:60 },
};
const IAP_PACKAGE_ORDER = ['starter', 'value', 'premium', 'mega', 'ultimate'];
// 1 diamond → 100 coins (GDD §6.1). Non-refundable; the UI must show a
// confirmation dialog before each conversion (handled client-side in P4-D.4).
const DIAMOND_TO_COIN_RATE = 100;

// ── Pot economy (P4, GDD §2.2 / §6.3) ─────────────────────────────────
// Server keeps HOUSE_CUT of the pot off the top on every match payout.
// Single source of truth — adjust here only. 0.10 = 10% (GDD §2.2 Classic).
const HOUSE_CUT = 0.10;

// ── Quick Chat presets (GDD §7.5) ──────────────────────────────────────
// Pre-vetted phrases the client sends by ID (never raw text — prevents the
// quick-chat path from being abused as a free-form chat bypass). Keep the
// list short and broadly useful; this isn't a chat replacement, it's a
// social-presence channel during a match.
const QUICK_CHAT_PRESETS = {
  1:  '👋 Hi!',
  2:  '🎯 Nice play!',
  3:  '🤣 GG',
  4:  '😤 So close!',
  5:  '🙏 Sorry!',
  6:  '🎉 Cardora!',
  7:  '⚠️ Watch out!',
  8:  '🔥 Let\'s go!',
  9:  '😅 Oops',
  10: '🤝 Good luck!',
  11: '⏰ Hurry up!',
  12: '👏 Well played',
};

// ── Private DMs (GDD §7.5 B) ──────────────────────────────────────────
// Friends-only 1:1 messaging. Messages persisted to Mongo; the in-memory
// path is the canonical send/read flow during a session (Mongo is just
// durability so threads survive restart). 240-char cap and a 1.5s
// per-socket rate-limit protect against spam; client also enforces its
// own UI cooldown so honest players never hit the server floor.
const DM_MAX_LEN        = 240;
const DM_RATE_LIMIT_MS  = 1500;
const DM_THREAD_LIMIT   = 50;          // last N messages when a thread opens
const DirectMessageSchema = new mongoose.Schema({
  from:  { type: String, required: true, index: true },
  to:    { type: String, required: true, index: true },
  text:  { type: String, required: true },
  at:    { type: Number, index: true },
  read:  { type: Boolean, default: false },
}, { strict: false });
// Composite indexes for the two read paths:
//   thread fetch  → find by (from in {A,B}, to in {A,B}) sorted by at desc
//   unread count  → find by (to=me, read=false)
DirectMessageSchema.index({ from: 1, to: 1, at: -1 });
DirectMessageSchema.index({ to: 1, read: 1 });
const DirectMessageModel = mongoose.model('DirectMessage', DirectMessageSchema);

// Are A and B friends? Both directions checked (the friend lists should
// agree, but we don't want a stale half-write to expose a DM channel).
function areFriends(userA, userB){
  if(!userA || !userB) return false;
  const aHasB = (userA.friends || []).includes(userB.id);
  const bHasA = (userB.friends || []).includes(userA.id);
  return aHasB && bHasA;
}

// ── Ephemeral in-memory DM store (used when Mongo is offline) ──
// By design these messages are NOT durable: they exist only while the
// server runs, are only delivered to recipients who are currently in the
// game (online), and a player's conversations are WIPED the moment they go
// fully offline — unless a message is flagged `important`. This implements
// the "messages only reach you in-game, and vanish when you leave" rule.
const _memDMs = [];                 // { from, to, text, at, read, important }
const _MEM_DM_CAP = 4000;           // hard ceiling so memory can't grow unbounded
function _memThread(a, b){
  return _memDMs.filter(m =>
    (m.from === a && m.to === b) || (m.from === b && m.to === a));
}
// Drop every non-important message this user is part of (sent OR received).
// Called when they leave the whole game so they return to a clean slate.
function _wipeUserDMs(userId){
  let n = 0;
  for(let i = _memDMs.length - 1; i >= 0; i--){
    const m = _memDMs[i];
    if(!m.important && (m.from === userId || m.to === userId)){ _memDMs.splice(i, 1); n++; }
  }
  return n;
}

// Load the last N messages between two users (oldest first for natural
// chat-scroll rendering). Uses Mongo when available, else the ephemeral
// in-memory store.
async function fetchThread(userIdA, userIdB, limit = DM_THREAD_LIMIT){
  if(!mongoose.connection.readyState){
    return _memThread(userIdA, userIdB).slice(-limit);
  }
  try{
    const msgs = await DirectMessageModel.find({
      $or: [
        { from: userIdA, to: userIdB },
        { from: userIdB, to: userIdA },
      ],
    }).sort({ at: -1 }).limit(limit).lean();
    msgs.reverse();
    return msgs;
  }catch(e){
    console.error('[DM] fetchThread:', e.message);
    return [];
  }
}

// One row per friend with whom we have any DM history: last message + unread count.
async function fetchThreadList(userId){
  if(!mongoose.connection.readyState){
    const byPartner = new Map();
    // newest first so the first time we see a partner is their last message
    const recent = _memDMs.filter(m => m.from === userId || m.to === userId)
      .slice().sort((a, b) => b.at - a.at);
    for(const m of recent){
      const partnerId = m.from === userId ? m.to : m.from;
      if(!byPartner.has(partnerId)){
        byPartner.set(partnerId, { partnerId, lastText: m.text, lastAt: m.at, lastFromMe: m.from === userId, unread: 0 });
      }
      if(m.to === userId && !m.read) byPartner.get(partnerId).unread += 1;
    }
    return [...byPartner.values()];
  }
  try{
    // All DMs touching this user, newest first, capped — we only need the
    // tail to compute "last message per partner". 500 is plenty for any
    // realistic social graph here.
    const recent = await DirectMessageModel.find({
      $or: [{ from: userId }, { to: userId }],
    }).sort({ at: -1 }).limit(500).lean();
    const byPartner = new Map();
    for(const m of recent){
      const partnerId = m.from === userId ? m.to : m.from;
      if(!byPartner.has(partnerId)){
        byPartner.set(partnerId, { partnerId, lastText: m.text, lastAt: m.at, lastFromMe: m.from === userId, unread: 0 });
      }
      if(m.to === userId && !m.read) byPartner.get(partnerId).unread += 1;
    }
    return [...byPartner.values()];
  }catch(e){
    console.error('[DM] fetchThreadList:', e.message);
    return [];
  }
}

async function markThreadRead(meId, partnerId){
  if(!mongoose.connection.readyState){
    let n = 0;
    for(const m of _memDMs){
      if(m.from === partnerId && m.to === meId && !m.read){ m.read = true; n++; }
    }
    return n;
  }
  try{
    const res = await DirectMessageModel.updateMany(
      { from: partnerId, to: meId, read: false },
      { $set: { read: true } }
    );
    return res.modifiedCount || 0;
  }catch(e){
    console.error('[DM] markThreadRead:', e.message);
    return 0;
  }
}

// ── Ranked abandon penalty (P4-NEW.1b, GDD §5.5) ──────────────────────
// Applied ONLY when a human abandons a RANKED match (room.roomType === 'RANKED').
// The base ELO loss from the normal game:over branch still applies; this is
// an ADDITIONAL hit, plus a queue ban so a serial abandoner can't immediately
// re-queue and ruin the next match.
//
// Phase 4 — progressive penalty: a clean week wipes the counter, but back-to-
// back abandons stack toward heavier consequences. The first offense stays at
// the established 30-min / -50 numbers so a one-off rage-quit isn't punished
// disproportionately; repeat offenders escalate sharply.
const RANKED_ABANDON_ELO_PENALTY = 50;                      // legacy flat fallback
const RANKED_ABANDON_BAN_MS      = 30 * 60 * 1000;          // legacy flat fallback
const RANKED_ABANDON_DECAY_MS    = 7 * 24 * 60 * 60 * 1000; // 7 clean days resets the counter
// Escalating rage-quit ladder (softened 2026-07-22 — a 30-min first-offense ban
// was too harsh). `rank` is the flat RP tax that bypasses the tier shield; it is
// applied ON TOP of the normal match loss. Bans grow with repeat offenses so a
// one-off disconnect barely stings but a serial quitter is throttled.
const RANKED_ABANDON_LADDER = [
  { banMs:  5  * 60 * 1000, elo:  40, rank:  20 },          // 1st offense — light
  { banMs: 15  * 60 * 1000, elo:  60, rank:  35 },          // 2nd
  { banMs: 45  * 60 * 1000, elo:  90, rank:  55 },          // 3rd
  { banMs: 180 * 60 * 1000, elo: 130, rank:  80 },          // 4th+
];

function rankedAbandonTier(user){
  // Decay: if the last abandon was over a week ago, the slate is clean.
  const last = user.rankedLastAbandonAt || 0;
  if (last && Date.now() - last > RANKED_ABANDON_DECAY_MS) {
    user.rankedAbandonCount = 0;
  }
  const idx = Math.min(RANKED_ABANDON_LADDER.length - 1, user.rankedAbandonCount || 0);
  return RANKED_ABANDON_LADDER[idx];
}

// ── Account Level (GDD §7.2) ──────────────────────────────────────────
// Persistent account progression separate from the seasonal Battle Pass.
// Linear 1000-XP-per-level curve up to level 500. XP earned every match
// (won: 220, lost: 90 — same numbers as BP XP, granted alongside it).
// Each level-up grants 50 × level coins; every 10th level grants 10 diamonds.
const ACCOUNT_MAX_LEVEL = 500;
const ACCOUNT_XP_PER_LEVEL = 1000;

function getAccountLevel(xp){
  const x = Math.max(0, Math.floor(xp || 0));
  return Math.min(ACCOUNT_MAX_LEVEL, Math.floor(x / ACCOUNT_XP_PER_LEVEL) + 1);
}
function accountLevelProgress(xp){
  const x = Math.max(0, Math.floor(xp || 0));
  const level = getAccountLevel(xp);
  if (level >= ACCOUNT_MAX_LEVEL) return { level, into: 0, span: 1, pct: 100 };
  const into = x - (level - 1) * ACCOUNT_XP_PER_LEVEL;
  return { level, into, span: ACCOUNT_XP_PER_LEVEL, pct: Math.round(into / ACCOUNT_XP_PER_LEVEL * 100) };
}
function accountLevelReward(level){
  // Coins scale linearly with the new level so level 500 still feels like
  // a milestone. Every 10th level also drops 10 diamonds.
  const coins    = 50 * level;
  const diamonds = (level % 10 === 0) ? 10 : 0;
  return { coins, diamonds };
}
// Grants XP, detects level-ups (handles multi-level jumps from large XP
// gains), pushes rewards onto the user and emits 'account:levelup' so the
// client can show a toast / popup. Returns { gained, oldLevel, newLevel,
// totalRewards } so callers can log meaningfully.
function applyAccountXP(user, gain, reason){
  if (!user || !(gain > 0)) return { gained:0, oldLevel: getAccountLevel(user?.accountXP||0), newLevel: getAccountLevel(user?.accountXP||0), rewards:{coins:0,diamonds:0} };
  const oldXP    = user.accountXP || 0;
  const oldLevel = getAccountLevel(oldXP);
  user.accountXP = oldXP + gain;
  const newLevel = getAccountLevel(user.accountXP);
  let coins = 0, diamonds = 0;
  if (newLevel > oldLevel) {
    for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
      const r = accountLevelReward(lv);
      coins    += r.coins;
      diamonds += r.diamonds;
    }
    user.coins    = (user.coins    || 0) + coins;
    user.diamonds = (user.diamonds || 0) + diamonds;
    const sock = findSocketByUserId(user.id);
    if (sock) sock.emit('account:levelup', {
      oldLevel, newLevel,
      rewards: { coins, diamonds },
      accountXP: user.accountXP,
      reason: reason || 'match',
    });
    console.log(`[Account] ${user.username} ${oldLevel} -> ${newLevel} (+${coins} coins${diamonds?', +'+diamonds+' diamonds':''})`);
  }
  return { gained: gain, oldLevel, newLevel, rewards: { coins, diamonds } };
}

// ── Special Offers (GDD §3.3.I / §6.2.C) ──────────────────────────────
// One global offer at a time; the active id is whatever this server's
// current rotation is. Rolling 24h timer from server start — restart
// resets the countdown. Each user can claim once (tracked on user.claimed
// Offers[id]). Real-money/Stripe integration not in scope here — claim
// just grants coins + diamonds (DEMO MODE, same as the shop).
const SPECIAL_OFFERS = {
  starter_bonus: {
    id: 'starter_bonus',
    title: 'SPECIAL OFFER!',
    headline: '2,000 🪙 + 50 💎',
    sub: 'Limited-time welcome gift',
    coins: 2000,
    diamonds: 50,
    badge: '🎁',
  },
};
const SPECIAL_OFFER_ACTIVE_ID  = 'starter_bonus';
const SPECIAL_OFFER_DURATION_MS = 24 * 60 * 60 * 1000;  // 24h rolling
const SPECIAL_OFFER_ENDS_AT     = Date.now() + SPECIAL_OFFER_DURATION_MS;
const voiceRooms = new Map(); // roomId -> Set<userId> currently in voice chat
const worldChat = [];          // last ~60 global lobby messages

// ─────────────────────────────────────────
// USER RECORD
// ─────────────────────────────────────────

// ── ELO & Leagues ──
// ── Rank ladder (GDD §7.1) ────────────────────────────────────────────
// 7 named tiers; each tier (except Grandmaster) splits into I / II / III
// across its 1000-ELO span (333 per division, III lowest, I highest).
// Grandmaster is open-ended above 6000 with no sub-rank.
// Progressive tier boundaries — each gap is wider than the last so the
// climb feels harder the higher you go. Bronze→Silver is a quick taste
// of promotion (500 RP), Silver→Gold a real grind (800), Gold→Platinum
// significantly harder (1100), and Master→Grandmaster is gated for the
// top % of the player base (3000 RP gap). The numbers were tuned so a
// fresh placement (~1500 RP) lands a player mid-Silver, and a season of
// steady play (~30-50 ranked matches at +25 avg) takes a focused player
// from Silver to Diamond — but reaching Grandmaster requires sustained
// excellence across the full season.
const LEAGUES = [
  { name:'Bronze',      min:0,    max:499,   badge:'🥉', color:'#CD7F32' },  // 500 wide
  { name:'Silver',      min:500,  max:1299,  badge:'🥈', color:'#C0C0C0' },  // 800 wide
  { name:'Gold',        min:1300, max:2399,  badge:'🥇', color:'#FFD700' },  // 1100 wide
  { name:'Platinum',    min:2400, max:3899,  badge:'💠', color:'#E5E4E2' },  // 1500 wide
  { name:'Diamond',     min:3900, max:5999,  badge:'💎', color:'#B9F2FF' },  // 2100 wide
  { name:'Master',      min:6000, max:8999,  badge:'👑', color:'#9F70FD' },  // 3000 wide
  { name:'Grandmaster', min:9000, max:99999, badge:'🏆', color:'#FF6B6B' },  // gated — pros only
];

function getLeague(elo) {
  const e = Math.max(0, Math.floor(elo || 0));
  const tier = LEAGUES.slice().reverse().find(l => e >= l.min) || LEAGUES[0];
  if (tier.name === 'Grandmaster') {
    return { ...tier, division: null, label: tier.name };
  }
  // Tier widths now vary (progressive ladder). Split each tier's actual
  // span into thirds so III = bottom 1/3, II = middle 1/3, I = top 1/3.
  // Roman numerals stay the convention across ranked card games / FPS
  // ladders; III is the entry sub-rank, I is the next-tier doorstep.
  const span = Math.max(1, (tier.max + 1) - tier.min);
  const offset = e - tier.min;
  const division = offset >= (span * 2/3) ? 'I' : offset >= (span * 1/3) ? 'II' : 'III';
  return { ...tier, division, label: `${tier.name} ${division}` };
}

function calcELO(winnerElo, loserElo) {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const change = Math.round(K * (1 - expected));
  return { gain: Math.max(8, change), loss: Math.max(8, change) };
}

// ─────────────────────────────────────────
// RANKED MODE — placement-based + ELO-scaled rating
// ─────────────────────────────────────────
//
// UNO has luck involved → use placement, not pure win/loss. Each match
// produces a base score per placement (sums to 0 across the table), then
// scales by the expected vs actual result (ELO style) so beating higher-
// ranked opponents earns more points and losing to them costs less.
//
//   4P: 1st +25 · 2nd +10 · 3rd -10 · 4th -25
//   3P: 1st +20 · 2nd  0  · 3rd -20
//   2P: 1st +25 · 2nd -25  (standard 1v1 form)
//
// `K` is the league standard "step size". K_PLACEMENT > K_NORMAL so new
// players reach their true tier in ~5 matches instead of 20+.
const RANKED_BASE = {
  2: [25, -25],
  3: [20, 0, -20],
  4: [25, 10, -10, -25],
};
const K_NORMAL    = 1.0;
const K_PLACEMENT = 1.5;

// Tier-aware placement bases. This is the meat of the climb difficulty:
//   • Bronze/Silver/Gold: even 3rd place in a 4-player table earns RP,
//     so new players almost always feel forward progress. Losses cap
//     around -25 to -30 — they sting, but don't crush a session.
//   • Platinum+: symmetric ELO-style scoring (positives for top half,
//     negatives for bottom half). The climb seriously slows.
//   • Master / Grandmaster: every RP earned with sweat; losses bite.
//
// Indexed first by tier name, then by total players (2/3/4), then by
// 0-based placement. Used in place of RANKED_BASE for the actual delta
// math. RANKED_BASE stays around as the symmetric fallback if a tier
// somehow isn't listed.
const RANKED_BASE_BY_TIER = {
  // Low-tier band (Bronze/Silver/Gold) sticks close to the user's
  // promised numbers: winners around +120, mid-table still earns,
  // 4th place loses a flat -25 (gets shaped by hand-points later).
  // Gold is slightly tapered so the climb has a hint of difficulty
  // before the Platinum cliff.
  Bronze: {
    2: [120, -25],
    3: [ 90,  25, -25],
    4: [120,  60,  30, -25],
  },
  Silver: {
    2: [120, -25],
    3: [ 90,  25, -25],
    4: [120,  60,  30, -25],
  },
  Gold: {
    2: [110, -25],
    3: [ 80,  20, -25],
    4: [110,  55,  25, -25],
  },
  // The CLIFF — Platinum onwards is real ranked. Wins shrink, losses
  // grow, mid-table starts losing RP. Welcome to the grind.
  Platinum: {
    2: [ 60, -30],
    3: [ 45,  10, -30],
    4: [ 60,  25,   0, -30],
  },
  Diamond: {
    2: [ 35, -35],
    3: [ 25,   0, -35],
    4: [ 35,  15,  -5, -35],
  },
  Master: {
    2: [ 22, -40],
    3: [ 16,  -5, -40],
    4: [ 22,  10,  -8, -40],
  },
  Grandmaster: {
    2: [ 15, -45],
    3: [ 11,  -8, -45],
    4: [ 15,   6, -12, -45],
  },
};

// Per-tier max-loss clamps. Low tiers can never lose more than ~30 RP
// in a single match, no matter how badly things went; high tiers carry
// real risk (up to -90 at Grandmaster with a brick hand).
const RANKED_LOSS_CLAMP_BY_TIER = {
  Bronze:      30,
  Silver:      30,
  Gold:        30,
  Platinum:    55,
  Diamond:     70,
  Master:      80,
  Grandmaster: 90,
};

// Compute the rank-points delta for ONE player.
//   placement     — 1-based finishing position (1 = winner)
//   playerRank    — this player's current rankPoints
//   oppRanks      — array of all OTHER seated players' rankPoints
//   isPlacement   — true while this player is still in their 5-match window
//   handPoints    — UNO point-value of cards still in hand at match end
//                   (drives loser bleed; winner uses opponents' total)
//   oppHandPoints — total point-value of opponents' remaining cards
//                   (winner gets a bigger swing for beating a fat pot)
//   tierName      — current tier ("Bronze"/"Silver"/...); drives loss multiplier
//
// Returns an integer delta (can be positive or negative). Clamped to a
// sensible range so one outlier match can't swing more than ±80 points.
function rankedDelta({ placement, playerRank, oppRanks, isPlacement, totalPlayers, handPoints = 0, oppHandPoints = 0, tierName = 'Bronze' }, _out){
  const N = Math.max(2, Math.min(4, totalPlayers || (oppRanks?.length || 0) + 1));
  // Tier-aware base table. Bronze/Silver/Gold reward even mid-table
  // finishes; Platinum+ goes symmetric ELO; Master/GM is the grind.
  const tierBaseTable = RANKED_BASE_BY_TIER[tierName] || RANKED_BASE_BY_TIER.Bronze;
  const base = (tierBaseTable[N] || RANKED_BASE[N] || RANKED_BASE[4])[Math.max(0, Math.min(N-1, placement-1))];
  // Average expected score against this lobby. We use a single ELO-style
  // expected value (player vs avg-opponent) and ratio it to placement.
  const avgOpp = oppRanks?.length
    ? oppRanks.reduce((s,v)=>s+(v||1000),0) / oppRanks.length
    : 1000;
  const expected = 1 / (1 + Math.pow(10, (avgOpp - playerRank) / 400));
  // Place "1" maps to actual=1, last place maps to actual=0; middle slots
  // interpolate so the scaling is smooth across 4-player results.
  const actual = (N - placement) / (N - 1);
  const k = (isPlacement ? K_PLACEMENT : K_NORMAL);
  // Final scaled delta. base provides the floor magnitude (so even a
  // perfectly-expected win still feels worth +X); the ELO term boosts/
  // dampens it based on relative skill gap.
  // Lighter ELO sway than before — the tier-aware base now carries the
  // bulk of the magnitude, so the ELO term just nudges results based on
  // skill gap (±~16 instead of ±~32).
  const eloComponent = 16 * (actual - expected);
  let raw = (base + eloComponent) * k;
  if (raw < 0) {
    // Loss: scale only by THIS player's hand-points so the line reads
    // "I lost -25 RP because I held 4 cards, vs -30 because I held 14".
    // The points curve is now gentler at low tiers (the user wanted
    // -20 → -30 swings, not -10 → -80). We use a softer curve than
    // before so the visible loss stays in the natural per-tier band.
    //
    //   ≤ 15 pts  → 0.80x  ("I was about to win")
    //   ≤ 40 pts  → 1.00x  typical
    //   ≤ 80 pts  → 1.15x  heavy hand
    //   ≤ 150 pts → 1.30x  catastrophic
    //   > 150 pts → 1.45x  brick city
    const p = Math.max(0, Math.floor(handPoints || 0));
    let lossMult;
    if (p <= 15)       lossMult = 0.80;
    else if (p <= 40)  lossMult = 0.80 + (p - 15)  / 25  * 0.20;    // → 1.00
    else if (p <= 80)  lossMult = 1.00 + (p - 40)  / 40  * 0.15;    // → 1.15
    else if (p <= 150) lossMult = 1.15 + (p - 80)  / 70  * 0.15;    // → 1.30
    else               lossMult = 1.45;
    raw = raw * lossMult;
  } else if (raw > 0) {
    // Win: light pot scaling only (tier weight already in the base).
    // Crushing a fat table beats scraping a 25-pt table, but the swing
    // is gentler now (0.92x → 1.20x) so the headline number stays
    // close to the tier-target the player expects.
    //   ≤ 20 pts beat   → 0.92x
    //   ~50 pts beat    → 1.00x
    //   ~120 pts beat   → 1.10x
    //   200+ pts beat   → 1.20x
    const pot = Math.max(0, Math.floor(oppHandPoints || 0));
    let potMult;
    if (pot <= 20)       potMult = 0.92;
    else if (pot <= 50)  potMult = 0.92 + (pot - 20) / 30  * 0.08;     // → 1.00
    else if (pot <= 120) potMult = 1.00 + (pot - 50) / 70  * 0.10;     // → 1.10
    else if (pot <= 200) potMult = 1.10 + (pot - 120) / 80 * 0.10;     // → 1.20
    else                 potMult = 1.20;
    raw = raw * potMult;
  }
  // Per-tier loss clamp — Bronze/Silver/Gold never lose more than 30,
  // higher tiers carry real risk. Wins clamp at +180 (Bronze 4P winner
  // with placement + pot boosts) so the upside stays bounded too.
  const lossClamp = RANKED_LOSS_CLAMP_BY_TIER[tierName] || 30;
  const finalDelta = Math.max(-lossClamp, Math.min(180, Math.round(raw)));
  // Additive breakdown for the post-match cinematic — base (placement/result)
  // + skill (ELO gap vs the lobby) + margin (pot/hand-points multiplier + clamp).
  // The three ALWAYS sum to finalDelta so the UI can show exactly where each
  // RP came from.
  if (_out && typeof _out === 'object') {
    _out.base   = Math.round(base * k);
    _out.skill  = Math.round(eloComponent * k);
    _out.margin = finalDelta - _out.base - _out.skill;
  }
  // Debug log so the user can see exact tier + math at match end. If
  // they're STILL seeing the old numbers in their UI, this line not
  // appearing in the server console proves the old build is still
  // running (cached process, ngrok URL, separate terminal, etc.).
  console.log(`[Ranked] delta computed: ${finalDelta} (tier=${tierName}, place=${placement}/${N}, hand=${handPoints}pts, opp=${oppHandPoints}pts, base=${base}, raw=${raw.toFixed(1)})`);
  return finalDelta;
}

// ── RANKED MODE — Phase 3: seasons, soft reset, rewards ────────────────
// One ranked season = 4 weeks. End-of-season action:
//   1. Snapshot the top-10 leaderboard into seasonState.history
//   2. Pay tier-scaled rewards (coins + diamonds) to every player who
//      finished placement (placement-only players get nothing this season
//      but their progress carries into the next one).
//   3. Soft-reset every user's rankPoints toward 1000 with a 0.5 compression
//      (new = 1000 + (old - 1000) * 0.5) so Diamond players don't fall back
//      to Bronze, but Grandmasters can't coast on prior glory.
//   4. Reset placementGamesPlayed → 0 (everyone re-plays placement),
//      winStreak → 0, peakRankPoints → new rankPoints (peak is per-season),
//      and bump currentSeasonId.
//
// Storage uses the same sentinel-key trick as the football league:
// usersDB stores '__ranked_season__' which saveUsers() persists to Mongo.
const SEASON_LENGTH_MS = 30 * 24 * 60 * 60 * 1000;        // 30 days (monthly cadence)
// Every rollover lands every veteran (anyone who's completed placement
// at least once) at the Gold tier minimum — a fresh, level field for
// returning players. Bronze stays reserved for brand-new accounts that
// haven't earned a tier yet (they go through placement first).
const SEASON_RESET_RP = 1300;                              // Gold floor (see LEAGUES)
const SEASON_REWARDS = {
  Bronze:      { coins:    500, diamonds:   5 },
  Silver:      { coins:   1500, diamonds:  15 },
  Gold:        { coins:   3000, diamonds:  30 },
  Platinum:    { coins:   6000, diamonds:  60 },
  Diamond:     { coins:  12000, diamonds: 120 },
  Master:      { coins:  25000, diamonds: 250 },
  Grandmaster: { coins:  50000, diamonds: 500 },
};

let rankedSeasonState = null;

function getRankedSeasonState() {
  if (rankedSeasonState) return rankedSeasonState;
  const sentinel = usersDB.get('__ranked_season__');
  if (sentinel?.state) {
    rankedSeasonState = sentinel.state;
  } else {
    // In-memory only on first boot — we DELIBERATELY don't persist here.
    // Writing the sentinel into usersDB during boot pollutes user iteration
    // (login / register loops do `u.username.toLowerCase()` without a
    // guard), and we only need persistence once a real rollover happens.
    rankedSeasonState = {
      currentSeasonId: 1,
      startedAt:       Date.now(),
      lengthMs:        SEASON_LENGTH_MS,
      history:         [],
    };
  }
  return rankedSeasonState;
}

function saveRankedSeasonState() {
  if (!rankedSeasonState) return;
  usersDB.set('__ranked_season__', { id: '__ranked_season__', state: rankedSeasonState });
  saveUsers();
}

function maybeRolloverRankedSeason() {
  const s = getRankedSeasonState();
  const endsAt = s.startedAt + s.lengthMs;
  if (Date.now() < endsAt) return false;

  // 1. Snapshot top-10 (post-placement only) for history before reset.
  const standings = [...usersDB.values()]
    .filter(u => u.id && !String(u.id).startsWith('__') && (u.placementGamesPlayed || 0) >= 5)
    .sort((a, b) => (b.rankPoints || 0) - (a.rankPoints || 0))
    .slice(0, 10)
    .map((u, i) => ({
      rank:       i + 1,
      userId:     u.id,
      username:   u.username,
      rankPoints: u.rankPoints || 0,
      peakRank:   u.peakRankPoints || u.rankPoints || 0,
      tier:       getLeague(u.rankPoints || 0).label,
    }));

  // 2. Pay rewards + 3-4. Season reset.
  //
  // Reset rules:
  //   • Brand-new accounts (never completed placement, ever) keep their
  //     0 RP and will go through Bronze placement first time they queue.
  //   • Veterans (have completed placement at least once → sticky flag
  //     `hasCompletedPlacement = true`) reset to Gold floor and re-do
  //     placement to confirm their starting tier. They're never sent
  //     back to Bronze — that's reserved for newcomers.
  //
  // Rewards go to anyone who finished placement THIS season (so they
  // earned their tier honestly). A returning veteran who didn't play
  // this season earns nothing — fair.
  let rewardedCount = 0;
  for (const u of usersDB.values()) {
    if (!u.id || String(u.id).startsWith('__')) continue;   // skip sentinels
    ensureRankedFields(u);
    const finishedThisSeason = (u.placementGamesPlayed || 0) >= 5;
    if (finishedThisSeason) {
      const tier   = getLeague(u.rankPoints || 0);
      const reward = SEASON_REWARDS[tier.name];
      if (reward) {
        u.coins    = (u.coins    || 0) + reward.coins;
        u.diamonds = (u.diamonds || 0) + reward.diamonds;
        logReward(u, '🏆', `Season ${s.currentSeasonId} — ${tier.label}`, reward.coins);
        rewardedCount++;
      }
      // Sticky veteran flag — once true, never false again.
      u.hasCompletedPlacement = true;
    }
    // Reset RP based on whether they're a veteran or a newcomer.
    if (u.hasCompletedPlacement) {
      u.rankPoints = SEASON_RESET_RP;                       // Gold floor
    } else {
      u.rankPoints = 0;                                     // Bronze entry — placement awaits
    }
    u.peakRankPoints       = u.rankPoints;
    u.placementGamesPlayed = 5;   // no placement — ranked immediately each season
    u.hasCompletedPlacement = true;
    u.winStreak            = 0;
    u.currentSeasonId      = s.currentSeasonId + 1;
  }

  // Roll the season counter and archive the snapshot.
  s.history.unshift({
    id:        s.currentSeasonId,
    startedAt: s.startedAt,
    endedAt:   Date.now(),
    top10:     standings,
  });
  if (s.history.length > 12) s.history.length = 12;          // keep last year
  s.currentSeasonId += 1;
  s.startedAt = Date.now();
  s.lengthMs  = SEASON_LENGTH_MS;
  saveRankedSeasonState();

  console.log(`[Ranked] Season rolled over — new season ${s.currentSeasonId}, rewarded ${rewardedCount} players, snapshot ${standings.length} top players`);
  if (typeof io !== 'undefined' && io?.emit) {
    io.emit('ranked:season_rollover', {
      newSeasonId: s.currentSeasonId,
      startedAt:   s.startedAt,
      endsAt:      s.startedAt + s.lengthMs,
    });
  }
  return true;
}

// ── Short Friend ID ──
// 9-digit numeric ID players share to friend each other. Like the player
// IDs in Brawl Stars / PUBG / Clash Royale — short, easy to type, easy
// to read aloud. First digit is 1-9 (no leading zero) so the displayed
// length is always exactly 9 characters.
//
// Search space: 9 × 10^8 = 900 million IDs. Collision probability for
// a million users is < 0.06%; we still check + retry on collision.
const SHORT_ID_RE = /^[1-9][0-9]{8}$/;
function _genShortIdCandidate() {
  // First digit 1-9, then 8 more digits 0-9.
  let s = String(1 + Math.floor(Math.random() * 9));
  for (let i = 0; i < 8; i++) {
    s += String(Math.floor(Math.random() * 10));
  }
  return s;
}
function _isShortIdTaken(shortId) {
  for (const u of usersDB.values()) {
    if (u.shortId === shortId) return true;
  }
  return false;
}
function genShortId() {
  let tries = 0;
  let s;
  do {
    s = _genShortIdCandidate();
    tries++;
  } while (_isShortIdTaken(s) && tries < 60);
  return s;
}
// Backfill — every user.shortId getter routes through here so existing
// accounts (created before this commit) lazy-generate + persist one on
// next read. Returns the (possibly newly-created) shortId.
// Also REGENERATES the shortId if its format doesn't match the current
// 9-digit numeric pattern (covers users who got an old-style alphanumeric
// ID before we switched formats).
function ensureShortId(user) {
  if (!user) return null;
  if (typeof user.shortId === 'string' && SHORT_ID_RE.test(user.shortId)) {
    return user.shortId;
  }
  user.shortId = genShortId();
  saveUsers();
  return user.shortId;
}

// ── Bot level derivation ──
// Each bot's displayed level is rolled from a difficulty-bound range so
// "Easy" bots feel beatable while "Hard" bots project skill. Numbers are
// purely cosmetic — they drive nothing in the AI logic.
function botLevelFor(difficulty){
  const d = String(difficulty || 'medium').toLowerCase();
  if(d === 'easy')   return 1  + Math.floor(Math.random() * 5);    // 1..5
  if(d === 'hard')   return 25 + Math.floor(Math.random() * 16);   // 25..40
  return 10 + Math.floor(Math.random() * 11);                       // medium: 10..20
}
function decorateBot(bot, difficulty){
  bot.botDifficulty = String(difficulty || 'medium').toLowerCase();
  bot.accountLevel  = botLevelFor(difficulty);
  // Default to the BASIC look — premium card backs / shop avatars / fancy tables
  // are reserved for ELITE bots only (set earlier by makeBotIdentity, which
  // won't be overridden here). This stops a mid-rank bot from sporting expensive
  // cosmetics it shouldn't have; the top "drip" stays exclusive to Master/GM bots.
  if(!bot.cardBackId) bot.cardBackId = 'cb_default';
  if(!bot.isElite){
    bot.tableFelt = bot.tableFelt || 'tfp_green';
    if(!bot.avatar) bot.avatar = randomPresetAvatar();   // free preset, not a shop avatar
  }
  return bot;
}

// Preset avatar system. The client ships 36 framed portrait images under
// /avatars (av-m01..av-m20 Moroccan, av-f01..av-f16 fantasy). New accounts
// get a random one so the table is colourful out of the gate.
const AVATAR_PRESET_RE = /^\/avatars\/av-[fm]\d{2}\.webp$/;
const AVATAR_POOL = [
  ...Array.from({ length: 20 }, (_, i) => `/avatars/av-m${String(i + 1).padStart(2, '0')}.webp`),
  ...Array.from({ length: 16 }, (_, i) => `/avatars/av-f${String(i + 1).padStart(2, '0')}.webp`),
];
function randomPresetAvatar(){ return AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)]; }
// Give each bot a real card-back DESIGN (not the plain default) so every
// player around the table shows a distinct back — the same way a human player
// shows the design they equipped from their collection. (CARDBACK_CATALOG is
// defined below; this runs at game time, long after it's initialised.)
function randomBotCardBack(){
  const ids = CARDBACK_CATALOG.filter(c => c.id !== 'cb_default').map(c => c.id);
  return ids.length ? ids[Math.floor(Math.random() * ids.length)] : 'cb_default';
}

// ─────────────────────────────────────────
// PREMIUM SHOP AVATARS
// ─────────────────────────────────────────
// 34 hand-illustrated portraits sold in the Shop's "Avatars" tab. Unlike the
// free presets above, these must be bought (coins or diamonds) and then
// equipped. Price scales with how striking the art is:
//   common ≈ 3k coins · rare ≈ 8–9k coins · epic ≈ 45–70 💎 · legendary 120–260 💎
// Files live at /avatars/shop/sa01.webp .. sa34.webp.
const SHOP_AVATAR_RE = /^\/avatars\/shop\/sa\d{2}\.webp$/;
function _sa(n){ return `/avatars/shop/sa${String(n).padStart(2,'0')}.webp`; }
const PREMIUM_AVATAR_CATALOG = [
  // ── Cinematic set (sa01–sa09) ──
  { id:'sa01', name:'Desert Wanderer',   rarity:'rare',      currency:'coins',    price:8000  },
  { id:'sa02', name:'Neon Operative',    rarity:'epic',      currency:'diamonds', price:55    },
  { id:'sa03', name:'Steel Vanguard',    rarity:'rare',      currency:'coins',    price:9000  },
  { id:'sa04', name:'Inked Huntress',    rarity:'rare',      currency:'coins',    price:8500  },
  { id:'sa05', name:'Frostfang Jarl',    rarity:'epic',      currency:'diamonds', price:50    },
  { id:'sa06', name:'Nightblade',        rarity:'rare',      currency:'coins',    price:9000  },
  { id:'sa07', name:'Stormcaller',       rarity:'epic',      currency:'diamonds', price:60    },
  { id:'sa08', name:'Ember Witch',       rarity:'legendary', currency:'diamonds', price:120   },
  { id:'sa09', name:'Arcane Oracle',     rarity:'legendary', currency:'diamonds', price:140   },
  // ── Fantasy gold-framed set (sa10–sa34) ──
  { id:'sa10', name:'Black Knight',      rarity:'rare',      currency:'coins',    price:9000  },
  { id:'sa11', name:'Golden Queen',      rarity:'epic',      currency:'diamonds', price:55    },
  { id:'sa12', name:'The Old King',      rarity:'epic',      currency:'diamonds', price:50    },
  { id:'sa13', name:'Frost Prince',      rarity:'epic',      currency:'diamonds', price:65    },
  { id:'sa14', name:'Wraith Lord',       rarity:'legendary', currency:'diamonds', price:130   },
  { id:'sa15', name:'Ranger Aria',       rarity:'rare',      currency:'coins',    price:8000  },
  { id:'sa16', name:'Hooded Rogue',      rarity:'common',    currency:'coins',    price:3000  },
  { id:'sa17', name:'Crimson Scarf',     rarity:'rare',      currency:'coins',    price:8500  },
  { id:'sa18', name:'Wildwood Warden',   rarity:'rare',      currency:'coins',    price:9000  },
  { id:'sa19', name:'Dawn Paladin',      rarity:'epic',      currency:'diamonds', price:50    },
  { id:'sa20', name:'Orc Warlord',       rarity:'epic',      currency:'diamonds', price:60    },
  { id:'sa21', name:'Horned Enchantress',rarity:'legendary', currency:'diamonds', price:150   },
  { id:'sa22', name:'The Ronin',         rarity:'epic',      currency:'diamonds', price:55    },
  { id:'sa23', name:'Azure Mystic',      rarity:'rare',      currency:'coins',    price:9000  },
  { id:'sa24', name:'Highland Chief',    rarity:'common',    currency:'coins',    price:3500  },
  { id:'sa25', name:'Infernal Reaper',   rarity:'legendary', currency:'diamonds', price:240   },
  { id:'sa26', name:'Frostwolf Maiden',  rarity:'rare',      currency:'coins',    price:9000  },
  { id:'sa27', name:'Bloodfury',         rarity:'epic',      currency:'diamonds', price:70    },
  { id:'sa28', name:'Lion Emperor',      rarity:'legendary', currency:'diamonds', price:260   },
  { id:'sa29', name:'Spectral Empress',  rarity:'legendary', currency:'diamonds', price:140   },
  { id:'sa30', name:'Runebound Sage',    rarity:'epic',      currency:'diamonds', price:60    },
  { id:'sa31', name:'Veiled Saint',      rarity:'rare',      currency:'coins',    price:8500  },
  { id:'sa32', name:'Void Sentinel',     rarity:'legendary', currency:'diamonds', price:135   },
  { id:'sa33', name:'Crimson Vampire',   rarity:'legendary', currency:'diamonds', price:150   },
  { id:'sa34', name:'Hellforge Knight',  rarity:'legendary', currency:'diamonds', price:250   },
].map(a => ({ ...a, src:_sa(parseInt(a.id.slice(2),10)), unlock:{ kind:'shop', currency:a.currency, price:a.price } }));

// The free presets above (av-m##/av-f##) are also part of the collection.
// A handful are free-and-owned by everyone; the rest are cheap coin buys.
// Merging both into one catalog powers the Shop (unowned) + Collection (owned).
const PRESET_NAMES = {
  'av-m01':'Atlas Warrior','av-m02':'Crimson Veil','av-m03':'Old Sultan','av-m04':'Night Rogue',
  'av-m05':'Wildheart','av-m06':'Iron Guard','av-m07':'Azure Veil','av-m08':'Emerald Sheikh',
  'av-m09':'Desert Scout','av-m10':'White Sage','av-m11':'Free Spirit','av-m12':'Amethyst Prince',
  'av-m13':'Marked One','av-m14':'Veiled Sorceress','av-m15':'Corsair','av-m16':'Golden Mask',
  'av-m17':'War Queen','av-m18':'Sea Captain','av-m19':'Shadow Blade','av-m20':'Jeweled Lady',
  'av-f01':'Storm Knight','av-f02':'Shadow King','av-f03':'Frost Maiden','av-f04':'Ember Dragon',
  'av-f05':'High King','av-f06':'Red Samurai','av-f07':'Cyber Knight','av-f08':'Golden Elf',
  'av-f09':'Blood Lord','av-f10':'Panda Monk','av-f11':'Lava Golem','av-f12':'Dark Sorceress',
  'av-f13':'Gold Paladin','av-f14':'Forest Ranger','av-f15':'Night Demon','av-f16':'Sea Pirate',
};
const FREE_AVATAR_IDS = ['av-m01','av-m02','av-m03','av-m04','av-m05','av-m06'];
const _PRESET_RARE_RE = /King|Queen|Dragon|Lord|Paladin|Samurai|Sorceress|Sheikh|Prince|Sage|Sultan|Demon/i;
const PRESET_AVATAR_CATALOG = AVATAR_POOL.map(src => {
  const id   = src.replace('/avatars/','').replace('.webp','');   // e.g. av-m01
  const name = PRESET_NAMES[id] || 'Fighter';
  const free = FREE_AVATAR_IDS.includes(id);
  const rare = _PRESET_RARE_RE.test(name);
  const rarity = free ? 'common' : (rare ? 'rare' : 'common');
  const unlock = free ? { kind:'free' }
               : { kind:'shop', currency:'coins', price: rare ? 4000 : 1500 };
  return { id, name, src, rarity, currency:unlock.currency || 'coins', price:unlock.price || 0, unlock };
});

// Unified catalog: classic presets first, then premium illustrations.
const AVATAR_CATALOG = [...PRESET_AVATAR_CATALOG, ...PREMIUM_AVATAR_CATALOG];
const AVATAR_BY_SRC  = new Map(AVATAR_CATALOG.map(a => [a.src, a]));
const AVATAR_BY_ID   = new Map(AVATAR_CATALOG.map(a => [a.id, a]));

function randomFreeAvatar(){
  const id = FREE_AVATAR_IDS[Math.floor(Math.random() * FREE_AVATAR_IDS.length)];
  return AVATAR_BY_ID.get(id)?.src || AVATAR_POOL[0];
}

// Lazy-init avatar inventory. Everyone owns the free starters; we also
// grandfather whatever avatar the user currently wears (so existing picks and
// pre-economy accounts keep their portrait). favoriteAvatars backs the
// Collection's ⭐ tab.
function ensureAvatarFields(user){
  if(!user) return null;
  let touched = false;
  if(!Array.isArray(user.ownedAvatars)){ user.ownedAvatars = []; touched = true; }
  for(const id of FREE_AVATAR_IDS){
    if(!user.ownedAvatars.includes(id)){ user.ownedAvatars.push(id); touched = true; }
  }
  if(typeof user.avatar === 'string'){
    const cur = AVATAR_BY_SRC.get(user.avatar);
    if(cur && !user.ownedAvatars.includes(cur.id)){ user.ownedAvatars.push(cur.id); touched = true; }
  }
  if(!Array.isArray(user.favoriteAvatars)){ user.favoriteAvatars = []; touched = true; }
  if(touched) saveUsers();
  return user;
}

function createUserRecord({ username, passwordHash, email = null, isGuest = false }) {
  return {
    id:           uuidv4(),
    shortId:      genShortId(),
    username,
    passwordHash,
    email:        email ? String(email).trim().toLowerCase() : null,
    isGuest:      !!isGuest,
    // Session-revocation counter. Embedded in every JWT (`tv` claim) and
    // re-checked on every request/socket. Bump it (password change, "log out
    // everywhere") to instantly invalidate EVERY existing token — the lever
    // that kicks an account thief out even mid-session.
    tokenVersion: 0,
    coins:        CONFIG.DEFAULT_COINS,
    // Premium currency starting amount (GDD §6.1). Mongoose schema default
    // (100) won't apply on this path — users created here go straight into
    // usersDB.set() without passing through new UserModel(...).save(). So
    // we set the starting value explicitly, same way coins is set above.
    // Also stamps grant_diamonds_v1 = true so the boot-time grant doesn't
    // double up on accounts registered after this commit.
    diamonds:           100,
    grant_diamonds_v1:  true,
    avatar:       randomFreeAvatar(),
    ownedAvatars: [...FREE_AVATAR_IDS],
    favoriteAvatars: [],
    country:      'MA',            // drives the Morocco leaderboard (this is a Moroccan game)
    stats: { gamesPlayed: 0, gamesWon: 0, totalPoints: 0 },
    elo:          1000,
    // ── RANKED MODE (Phase 1) ──
    // rankPoints is the visible "Ranked Points" that drives tier+division
    // and the leaderboard. Distinct from `elo` (legacy) which stays as
    // hidden matchmaking signal that DOES keep updating, but isn't visible.
    // No placement: every new player starts ranked immediately at BRONZE
    // (0 RP) and climbs from there.
    rankPoints:           0,
    peakRankPoints:       0,
    placementGamesPlayed: 5,
    hasCompletedPlacement: true,
    rankedWins:           0,
    rankedLosses:         0,
    winStreak:            0,
    currentSeasonId:      1,
    createdAt:    Date.now(),
    lastLoginAt:  Date.now(),
  };
}

// Backfill — every read of user.rankPoints etc. routes through this so
// existing accounts (created before Phase 1) lazy-initialize the new
// fields without a one-shot migration job. Called from sanitizeUser()
// and any code path that touches rank fields.
function ensureRankedFields(user){
  if(!user) return null;
  let touched = false;
  if(typeof user.rankPoints !== 'number'){ user.rankPoints = 0; touched = true; }
  if(typeof user.peakRankPoints !== 'number'){ user.peakRankPoints = user.rankPoints; touched = true; }
  if(typeof user.placementGamesPlayed !== 'number'){ user.placementGamesPlayed = 5; touched = true; }
  if(typeof user.rankedWins   !== 'number'){ user.rankedWins   = 0; touched = true; }
  if(typeof user.rankedLosses !== 'number'){ user.rankedLosses = 0; touched = true; }
  if(typeof user.winStreak    !== 'number'){ user.winStreak    = 0; touched = true; }
  if(typeof user.currentSeasonId !== 'number'){ user.currentSeasonId = 1; touched = true; }
  // Phase 4 — progressive DC penalty + smurf flag
  if(typeof user.rankedAbandonCount   !== 'number'){ user.rankedAbandonCount   = 0; touched = true; }
  if(typeof user.rankedLastAbandonAt  !== 'number'){ user.rankedLastAbandonAt  = 0; touched = true; }
  if(typeof user.placementWins        !== 'number'){ user.placementWins        = 0; touched = true; }
  if(typeof user.placementCardsBeaten !== 'number'){ user.placementCardsBeaten = 0; touched = true; }
  if(typeof user.smurfFlagged         !== 'boolean'){ user.smurfFlagged         = false; touched = true; }
  if(typeof user.smurfScore           !== 'number'){ user.smurfScore           = 0; touched = true; }
  if(typeof user.hasCompletedPlacement!== 'boolean'){ user.hasCompletedPlacement = true; touched = true; }
  // Placement removed — anyone still mid-placement is dropped straight into
  // BRONZE (0 RP) and marked ranked, so nobody ever sees the 5-match gate.
  if((user.placementGamesPlayed || 0) < 5){
    user.rankPoints            = 0;
    user.peakRankPoints        = 0;
    user.placementGamesPlayed  = 5;
    user.hasCompletedPlacement = true;
    touched = true;
  }
  if(touched) saveUsers();
  return user;
}

// ─────────────────────────────────────────
// COSMETICS — card backs + table felts
// ─────────────────────────────────────────
//
// All visuals are pure CSS gradient strings so no image assets are
// shipped. Each entry has:
//   id        — stable handle saved on the user record
//   name      — display label
//   rarity    — common | rare | epic | legendary | seasonal
//   unlock    — { kind: 'free' | 'tier' | 'achievement' | 'season' | 'shop',
//                 ...kind-specific fields }
//   art       — CSS background to render the asset (gradient + decorative
//               radial spots, layered for depth)
//   accent    — secondary color used for thumbnails / glow / badges
//
// `unlock.tier` items auto-grant when the player crosses into that tier.
// `unlock.shop` items must be purchased via /api/cosmetics/buy.
// `unlock.season` items drop during a specific event window.

const CARDBACK_CATALOG = [
  // ── The ONE free starter every account owns. (All previous gradient backs
  //    were retired in favour of the painted image set below.) ──
  { id:'cb_default', name:'Classic', rarity:'common', unlock:{ kind:'free' }, accent:'#E8324A',
    art:'radial-gradient(circle at 50% 35%, #FFFBEB 0 18%, transparent 19%), linear-gradient(150deg,#FFFBEB 0%,#E8324A 60%,#7A1F2A 100%)' },

  // ══ EMBLEM set — geometric. Coins + diamonds mix. ══
  { id:'cb_g1', name:"Gold Sigil", rarity:'rare', unlock:{ kind:'shop', currency:'coins',    price:5000 }, accent:'#FBBF24', art:"#0a0a0a center/cover no-repeat url('/cards/cb_g1.webp')" },
  { id:'cb_g2', name:"Void Compass", rarity:'epic', unlock:{ kind:'shop', currency:'diamonds', price:60 }, accent:'#A855F7', art:"#0a0a0a center/cover no-repeat url('/cards/cb_g2.webp')" },
  { id:'cb_g3', name:"Crimson Fang", rarity:'rare', unlock:{ kind:'shop', currency:'coins',    price:7000 }, accent:'#DC2626', art:"#0a0a0a center/cover no-repeat url('/cards/cb_g3.webp')" },
  { id:'cb_g4', name:"Ivory Star", rarity:'rare', unlock:{ kind:'shop', currency:'coins',    price:6000 }, accent:'#E5E4E2', art:"#0a0a0a center/cover no-repeat url('/cards/cb_g4.webp')" },
  { id:'cb_g5', name:"Cyber Core", rarity:'epic', unlock:{ kind:'shop', currency:'diamonds', price:70 }, accent:'#22D3EE', art:"#0a0a0a center/cover no-repeat url('/cards/cb_g5.webp')" },
  { id:'cb_g6', name:"Azure Crest", rarity:'rare', unlock:{ kind:'shop', currency:'coins',    price:8000 }, accent:'#3B82F6', art:"#0a0a0a center/cover no-repeat url('/cards/cb_g6.webp')" },
  { id:'cb_g7', name:"Emerald Moon", rarity:'rare', unlock:{ kind:'shop', currency:'coins',    price:6000 }, accent:'#22C55E', art:"#0a0a0a center/cover no-repeat url('/cards/cb_g7.webp')" },
  { id:'cb_g8', name:"Frostflake", rarity:'epic', unlock:{ kind:'shop', currency:'diamonds', price:80 }, accent:'#7DD3FC', art:"#0a0a0a center/cover no-repeat url('/cards/cb_g8.webp')" },
  { id:'cb_g9', name:"Sun Dial", rarity:'rare', unlock:{ kind:'shop', currency:'coins',    price:9000 }, accent:'#F59E0B', art:"#0a0a0a center/cover no-repeat url('/cards/cb_g9.webp')" },

  // ══ MYTHIC set — fantasy. Coins + diamonds mix (pricier). ══
  { id:'cb_f1', name:"Excalibur", rarity:'epic', unlock:{ kind:'shop', currency:'diamonds', price:90 }, accent:'#D4AF37', art:"#0a0a0a center/cover no-repeat url('/cards/cb_f1.webp')" },
  { id:'cb_f2', name:"Mana Crystal", rarity:'rare', unlock:{ kind:'shop', currency:'coins',    price:10000 }, accent:'#38BDF8', art:"#0a0a0a center/cover no-repeat url('/cards/cb_f2.webp')" },
  { id:'cb_f3', name:"Dragon's Wrath", rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:150 }, accent:'#EF4444', art:"#0a0a0a center/cover no-repeat url('/cards/cb_f3.webp')" },
  { id:'cb_f4', name:"World Tree", rarity:'epic', unlock:{ kind:'shop', currency:'diamonds', price:100 }, accent:'#65A30D', art:"#0a0a0a center/cover no-repeat url('/cards/cb_f4.webp')" },
  { id:'cb_f5', name:"Clockwork", rarity:'rare', unlock:{ kind:'shop', currency:'coins',    price:12000 }, accent:'#B45309', art:"#0a0a0a center/cover no-repeat url('/cards/cb_f5.webp')" },
  { id:'cb_f6', name:"Neon City", rarity:'epic', unlock:{ kind:'shop', currency:'diamonds', price:120 }, accent:'#D946EF', art:"#0a0a0a center/cover no-repeat url('/cards/cb_f6.webp')" },
  { id:'cb_f7', name:"Reaper", rarity:'epic', unlock:{ kind:'shop', currency:'diamonds', price:130 }, accent:'#B91C1C', art:"#0a0a0a center/cover no-repeat url('/cards/cb_f7.webp')" },
  { id:'cb_f8', name:"Seraph", rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:160 }, accent:'#FCD34D', art:"#0a0a0a center/cover no-repeat url('/cards/cb_f8.webp')" },
  { id:'cb_f9', name:"Cosmos", rarity:'epic', unlock:{ kind:'shop', currency:'diamonds', price:140 }, accent:'#7C3AED', art:"#0a0a0a center/cover no-repeat url('/cards/cb_f9.webp')" },

  // ══ HERITAGE set — Moroccan. Diamonds ONLY, 300–500. ══
  { id:'cb_m1', name:"Zellij Red", rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:300 }, accent:'#B91C1C', art:"#0a0a0a center/cover no-repeat url('/cards/cb_m1.webp')" },
  { id:'cb_m2', name:"Marrakech Night", rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:340 }, accent:'#166534', art:"#0a0a0a center/cover no-repeat url('/cards/cb_m2.webp')" },
  { id:'cb_m3', name:"Moucharabieh", rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:360 }, accent:'#92400E', art:"#0a0a0a center/cover no-repeat url('/cards/cb_m3.webp')" },
  { id:'cb_m4', name:"Calligraphy", rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:400 }, accent:'#A8A29E', art:"#0a0a0a center/cover no-repeat url('/cards/cb_m4.webp')" },
  { id:'cb_m5', name:"Fanous", rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:380 }, accent:'#2563EB', art:"#0a0a0a center/cover no-repeat url('/cards/cb_m5.webp')" },
  { id:'cb_m6', name:"Najma", rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:420 }, accent:'#D4AF37', art:"#0a0a0a center/cover no-repeat url('/cards/cb_m6.webp')" },
  { id:'cb_m7', name:"Khamsa", rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:460 }, accent:'#CA8A04', art:"#0a0a0a center/cover no-repeat url('/cards/cb_m7.webp')" },
  { id:'cb_m8', name:"Berber Weave", rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:440 }, accent:'#D6B98C', art:"#0a0a0a center/cover no-repeat url('/cards/cb_m8.webp')" },
  { id:'cb_m9', name:"Atay", rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:500 }, accent:'#B45309', art:"#0a0a0a center/cover no-repeat url('/cards/cb_m9.webp')" },
];

const TABLEFELT_CATALOG = [
  // Two exclusive families only (old poker/fantasy sets removed 2026-07-18):
  //   • SHOP arenas — the premium 9-table set, deliberately pricey.
  //   • RANK arenas — earned by climbing, never sold.
  // Players with neither play on the default drawn table.

  // ── SHOP arenas (premium 9-set) — priced high on purpose ──
  { id:'tf_s1_crimson',  name:'Crimson Throne',  rarity:'epic',      unlock:{ kind:'shop', currency:'coins',    price:40000 }, accent:'#DC2626', art:"url('/tables/tf_s1_crimson.jpg') center/cover no-repeat #160406" },
  { id:'tf_s2_obsidian', name:'Obsidian Gold',   rarity:'epic',      unlock:{ kind:'shop', currency:'coins',    price:50000 }, accent:'#D4AF37', art:"url('/tables/tf_s2_obsidian.jpg') center/cover no-repeat #0a0a0a" },
  { id:'tf_s3_frost',    name:'Frost Sapphire',  rarity:'epic',      unlock:{ kind:'shop', currency:'coins',    price:60000 }, accent:'#38BDF8', art:"url('/tables/tf_s3_frost.jpg') center/cover no-repeat #060f1c" },
  { id:'tf_s4_amethyst', name:'Amethyst Court',  rarity:'epic',      unlock:{ kind:'shop', currency:'diamonds', price:150 },  accent:'#A855F7', art:"url('/tables/tf_s4_amethyst.jpg') center/cover no-repeat #100722" },
  { id:'tf_s5_ivory',    name:'Ivory Palace',    rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:220 },  accent:'#E5E4E2', art:"url('/tables/tf_s5_ivory.jpg') center/cover no-repeat #15171a" },
  { id:'tf_s6_emerald',  name:'Emerald Sanctum', rarity:'epic',      unlock:{ kind:'shop', currency:'diamonds', price:180 },  accent:'#22C55E', art:"url('/tables/tf_s6_emerald.jpg') center/cover no-repeat #04150c" },
  { id:'tf_s7_molten',   name:'Molten Obsidian', rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:260 },  accent:'#EA580C', art:"url('/tables/tf_s7_molten.jpg') center/cover no-repeat #150502" },
  { id:'tf_s8_cosmos',   name:'Astral Cosmos',   rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:320 },  accent:'#818CF8', art:"url('/tables/tf_s8_cosmos.jpg') center/cover no-repeat #080618" },
  { id:'tf_s9_abyss',    name:'Abyssal Tides',   rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:240 },  accent:'#2DD4BF', art:"url('/tables/tf_s9_abyss.jpg') center/cover no-repeat #03141a" },

  // ── PRESTIGE arenas (12-set) — the top shelf, priced accordingly ──
  { id:'tf_p2_sakura',   name:'Sakura Garden',   rarity:'epic',      unlock:{ kind:'shop', currency:'coins',    price:80000 },  accent:'#F9A8D4', art:"url('/tables/tf_p2_sakura.jpg') center/cover no-repeat #1c0f14" },
  { id:'tf_p5_frozen',   name:'Frozen Crown',    rarity:'epic',      unlock:{ kind:'shop', currency:'coins',    price:100000 }, accent:'#7DD3FC', art:"url('/tables/tf_p5_frozen.jpg') center/cover no-repeat #0a1420" },
  { id:'tf_p6_lagoon',   name:'Pearl Lagoon',    rarity:'epic',      unlock:{ kind:'shop', currency:'coins',    price:120000 }, accent:'#2DD4BF', art:"url('/tables/tf_p6_lagoon.jpg') center/cover no-repeat #06181c" },
  { id:'tf_p1_samurai',  name:'Samurai Legacy',  rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:400 },   accent:'#A855F7', art:"url('/tables/tf_p1_samurai.jpg') center/cover no-repeat #150a20" },
  { id:'tf_p7_neon',     name:'Neon Future',     rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:450 },   accent:'#E879F9', art:"url('/tables/tf_p7_neon.jpg') center/cover no-repeat #0e0616" },
  { id:'tf_p4_dragon',   name:"Dragon's Wrath",  rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:500 },   accent:'#DC2626', art:"url('/tables/tf_p4_dragon.jpg') center/cover no-repeat #170404" },
  { id:'tf_p8_moon',     name:'Moonlight Shrine',rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:550 },   accent:'#E2E8F0', art:"url('/tables/tf_p8_moon.jpg') center/cover no-repeat #10141e" },
  { id:'tf_p9_oni',      name:"Oni's Fury",      rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:600 },   accent:'#EF4444', art:"url('/tables/tf_p9_oni.jpg') center/cover no-repeat #1a0507" },
  { id:'tf_p3_eclipse',  name:'Solar Eclipse',   rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:650 },   accent:'#F59E0B', art:"url('/tables/tf_p3_eclipse.jpg') center/cover no-repeat #0d0714" },
  { id:'tf_p10_seraph',  name:"Seraph's Light",  rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:700 },   accent:'#FDE68A', art:"url('/tables/tf_p10_seraph.jpg') center/cover no-repeat #16141c" },
  { id:'tf_p11_wolf',    name:'Winter Wolf',     rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:800 },   accent:'#93C5FD', art:"url('/tables/tf_p11_wolf.jpg') center/cover no-repeat #0a101c" },
  { id:'tf_p12_zellige', name:'Zellige Royale',  rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:1000 },  accent:'#22C55E', art:"url('/tables/tf_p12_zellige.jpg') center/cover no-repeat #0a1410" },

  // ── MYTHIC arenas (anime-themed 8-set) — the most expensive tier in the game ──
  { id:'tf_a1_sharingan', name:'Cursed Eye',       rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:1200 }, accent:'#A855F7', art:"url('/tables/tf_a1_sharingan.jpg') center/cover no-repeat #140720" },
  { id:'tf_a2_goku',      name:'Awakened Spirit',  rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:1300 }, accent:'#38BDF8', art:"url('/tables/tf_a2_goku.jpg') center/cover no-repeat #060f1c" },
  { id:'tf_a3_akatsuki',  name:'Crimson Dawn',     rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:1400 }, accent:'#DC2626', art:"url('/tables/tf_a3_akatsuki.jpg') center/cover no-repeat #150406" },
  { id:'tf_a4_konoha',    name:'Golden Shinobi',   rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:1500 }, accent:'#F59E0B', art:"url('/tables/tf_a4_konoha.jpg') center/cover no-repeat #0f0d06" },
  { id:'tf_a5_deathnote', name:'Death Ledger',     rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:1600 }, accent:'#E879F9', art:"url('/tables/tf_a5_deathnote.jpg') center/cover no-repeat #0e0616" },
  { id:'tf_a6_titan',     name:'Wings of Freedom', rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:1700 }, accent:'#22C55E', art:"url('/tables/tf_a6_titan.jpg') center/cover no-repeat #08140c" },
  { id:'tf_a7_bleach',    name:'Hollow Mask',      rarity:'legendary', unlock:{ kind:'shop', currency:'diamonds', price:1800 }, accent:'#60A5FA', art:"url('/tables/tf_a7_bleach.jpg') center/cover no-repeat #060b18" },
  // Golden Guild (tf_a8_fairytail) removed on user request 2026-07-19.

  // ── RANK REWARD tables — one per ranked tier, FREE the moment you reach it
  //    (auto-granted by syncEarnedCosmetics + celebrated with the claim popup).
  //    Art = layered background: the tier's table image on top, a tier-coloured
  //    gradient behind it so the table still looks right if the image is absent.
  { id:'tf_rank_bronze',      name:'Bronze Arena',      rarity:'rare',      unlock:{ kind:'tier', tier:'Bronze'      }, accent:'#CD7F32', art:"url('/tables/tf_rank_bronze.jpg') center/cover no-repeat, linear-gradient(160deg,#3a2415,#140b06) #140b06" },
  { id:'tf_rank_silver',      name:'Silver Arena',      rarity:'rare',      unlock:{ kind:'tier', tier:'Silver'      }, accent:'#C0C0C0', art:"url('/tables/tf_rank_silver.jpg') center/cover no-repeat, linear-gradient(160deg,#2e3238,#101216) #101216" },
  { id:'tf_rank_gold',        name:'Gold Arena',        rarity:'epic',      unlock:{ kind:'tier', tier:'Gold'        }, accent:'#FFD700', art:"url('/tables/tf_rank_gold.jpg') center/cover no-repeat, linear-gradient(160deg,#3a2b09,#141005) #141005" },
  { id:'tf_rank_platinum',    name:'Platinum Arena',    rarity:'epic',      unlock:{ kind:'tier', tier:'Platinum'    }, accent:'#E5E4E2', art:"url('/tables/tf_rank_platinum.jpg') center/cover no-repeat, linear-gradient(160deg,#33383d,#15171a) #15171a" },
  { id:'tf_rank_diamond',     name:'Diamond Arena',     rarity:'epic',      unlock:{ kind:'tier', tier:'Diamond'     }, accent:'#38BDF8', art:"url('/tables/tf_rank_diamond.jpg') center/cover no-repeat, linear-gradient(160deg,#0b2b4a,#060f1c) #060f1c" },
  { id:'tf_rank_master',      name:'Master Arena',      rarity:'legendary', unlock:{ kind:'tier', tier:'Master'      }, accent:'#A855F7', art:"url('/tables/tf_rank_master.jpg') center/cover no-repeat, linear-gradient(160deg,#2b1245,#100722) #100722" },
  // GM uses the full-scene 1747×900 art (near-16:9) — cover fills the screen
  // with the whole table visible; the gradient only shows if the image is absent.
  { id:'tf_rank_grandmaster', name:'Grandmaster Arena', rarity:'legendary', unlock:{ kind:'tier', tier:'Grandmaster' }, accent:'#DC2626', art:"url('/tables/tf_rank_grandmaster.jpg') center/cover no-repeat, radial-gradient(ellipse at 50% 42%, #4a0d15 0%, #2a060a 55%, #160406 100%) #160406" },
];

// ── Bot tiers ───────────────────────────────────────────────────────
// Most opponents are ordinary players (free avatar, default card back +
// table, easy/medium play). But ~25% are ELITE "pro" bots: they wear the
// premium shop cosmetics (paid avatars, epic/legendary card backs + tables),
// project a high rank, and play HARD. They're rare on purpose — every so often
// you run into a sweat with full premium drip who actually beats you.
const ELITE_BOT_CHANCE   = 0.25;
const PREMIUM_CARDBACKS  = CARDBACK_CATALOG
  .filter(c => c.unlock?.kind === 'shop' && (c.rarity === 'epic' || c.rarity === 'legendary' || c.rarity === 'rare'))
  .map(c => c.id);
const PREMIUM_FELTS      = TABLEFELT_CATALOG
  .filter(c => c.rarity === 'epic' || c.rarity === 'legendary')
  .map(c => c.id);
const _pick = arr => arr[Math.floor(Math.random() * arr.length)] || null;
function _shopAvatar(){ return _sa(1 + Math.floor(Math.random() * 34)); }   // sa01..sa34 (paid)

// HIGH-STAKES TABLES: a room whose buy-in clears this many coins is filled
// EXCLUSIVELY with elite "pro" bots (premium avatars + cards, Master/GM rank,
// high level, HARD play) — so the richer you play, the fancier your opponents.
const ELITE_ONLY_BET = 25000;
function _roomWantsElite(room){
  if(!room) return false;
  if(room._forceElite) return true;          // high-stakes ambient table (>=10K) — always pro
  let stake = room.settings?.bet || 0;
  if(room.playerBets){ for(const v of Object.values(room.playerBets)){ if((v||0) > stake) stake = v; } }
  return stake >= ELITE_ONLY_BET;            // 25K chip and above → pro bots only
}
// A Master/Grandmaster ranked identity for a high-stakes pro bot — so the
// profile + panels read as a genuinely top-tier opponent.
function _eliteRank(){
  const rp = 6500 + Math.floor(Math.random() * 3300);          // Master..GM (6500..9800)
  let tier = null; try{ tier = getLeague(rp); }catch(e){}
  return { rankPoints: rp, rankedTier: tier, peakRankPoints: rp + 150 + Math.floor(Math.random() * 500) };
}
// A RANK-APPROPRIATE identity for a bot filling a RANKED room: its rank sits
// within ±300 of the human's, so a Diamond/Master player only ever meets
// Platinum→Grandmaster opponents. Platinum+ tables get the full premium look
// (shop avatar, epic card back, level 40–95, HARD play) + a real ranked tier so
// the profile reads as a genuine high-rank pro.
function _rankedBotIdentity(name, humanRank){
  // A genuine 0-RP player is a BRONZE beginner — `humanRank || 1000` used to
  // promote them to Gold, so their very first ranked games were matched way
  // above their level. Only fall back to 1000 when the rank is truly unknown.
  const base  = (typeof humanRank === 'number' && isFinite(humanRank) && humanRank >= 0) ? humanRank : 1000;
  // BAND-AWARE SPREAD — opponents come from your HALF of the ladder, split at
  // Diamond (3900), so the field feels fair but never a clone of your exact rank:
  //   • High players (Diamond+): only ever meet Diamond → Grandmaster.
  //   • Everyone below Diamond:  only ever meet Bronze  → Diamond.
  // Inside that band the rank is weighted toward the player (≈65% near ±500,
  // the rest spread across the whole band) so high/normal/easy matches mix
  // naturally without a Grandmaster ever landing against a Silver.
  const HI = base >= 3900;
  const floor = HI ? 3900 : 0;
  const ceil  = HI ? 11000 : 5999;          // Diamond→GM  vs  Bronze→Diamond
  const near = Math.random() < 0.65;
  let rp = near
    ? base + (Math.random() * 1000 - 500)               // tight cluster around the player
    : floor + Math.random() * (ceil - floor);           // anywhere in the player's band
  rp = Math.max(floor, Math.min(ceil, Math.round(rp)));
  let tier = null; try{ tier = getLeague(rp); }catch(e){}
  // LOOK follows the bot's own rank, like real players — but NOT everyone in a
  // tier looks the same (user request 2026-07-22): only ~30% of GOLD/PLATINUM
  // bots carry a premium card design/skin, so the field feels varied instead of
  // uniformly decked-out. Diamond+ are the genuine pros and mostly premium;
  // Bronze/Silver rarely.
  const elite = rp >= 3900 ? Math.random() < 0.82     // Diamond → GM: the elite
              : rp >= 1300 ? Math.random() < 0.30     // Gold / Platinum: ~30% skinned
              :              Math.random() < 0.12;     // Bronze / Silver: rare
  // PLAY STRENGTH is a STRICT ladder of the bot's own rank — studied, never
  // random at the top: Master/GM and Diamond ALWAYS play hard; Platinum mixes
  // hard/medium; Gold is solid medium; Silver/Bronze ease newcomers in.
  const difficulty = rp >= 3900 ? 'hard'
                   : rp >= 2400 ? (Math.random() < 0.4 ? 'hard' : 'medium')
                   : rp >= 1300 ? 'medium'
                   : rp >= 500  ? (Math.random() < 0.5 ? 'easy' : 'medium')
                   :              (Math.random() < 0.65 ? 'easy' : 'medium');
  return {
    name, isElite: elite,
    avatar:     elite ? _shopAvatar() : randomPresetAvatar(),
    profileBanner: _botBanner(),
    cardBackId: elite ? (_pick(PREMIUM_CARDBACKS) || randomBotCardBack()) : 'cb_default',
    tableFelt:  elite ? (_pick(PREMIUM_FELTS) || 'tfp_gold') : 'tfp_green',
    difficulty,
    rankPoints:     rp,
    rankedTier:     tier,
    peakRankPoints: rp + 100 + Math.floor(Math.random() * 400),
    // Level tracks rank (a 4000-RP bot ≈ level 70s, a 1600-RP one ≈ 30s).
    accountLevel:   Math.max(5, Math.min(96, Math.round(rp / 58 + 4 + Math.random() * 9))),
  };
}

// Build a complete, coherent identity for one bot. Pass a name from the
// Moroccan pool. `forceElite` (high-stakes rooms) guarantees the premium look.
function makeBotIdentity(name, forceElite){
  const elite = !!forceElite || (Math.random() < ELITE_BOT_CHANCE);
  if (elite){
    return {
      name, isElite: true,
      avatar:     _shopAvatar(),
      profileBanner: _botBanner(),
      cardBackId: _pick(PREMIUM_CARDBACKS) || randomBotCardBack(),
      tableFelt:  _pick(PREMIUM_FELTS) || 'tfp_gold',
      difficulty: 'hard',
    };
  }
  return {
    name, isElite: false,
    avatar:     randomPresetAvatar(),
    profileBanner: _botBanner(),
    cardBackId: 'cb_default',
    tableFelt:  'tfp_green',
    difficulty: Math.random() < 0.55 ? 'easy' : 'medium',
  };
}
// Stamp an identity onto a freshly created bot Player/object. `forceElite`
// (high-stakes room) gives the premium look AND a Master/GM-calibre level.
function applyBotIdentity(bot, name, forceElite){
  const id = makeBotIdentity(name, !!forceElite);
  bot.username   = name;
  bot.avatar     = id.avatar;
  bot.profileBanner = id.profileBanner;
  bot.cardBackId = id.cardBackId;
  bot.tableFelt  = id.tableFelt;
  bot.isElite    = id.isElite;
  bot.botDifficulty = id.difficulty;   // per-bot — the UNO AI reads this
  bot.accountLevel  = forceElite ? (55 + Math.floor(Math.random() * 41))   // 55..95 veteran
                                 : botLevelFor(id.difficulty);
  if(forceElite){
    const er = _eliteRank();
    bot.rankPoints = er.rankPoints; bot.rankedTier = er.rankedTier; bot.peakRankPoints = er.peakRankPoints;
  }
  return bot;
}

// ── Ghost top players ───────────────────────────────────────────────
// A persistent roster of believable ELITE players that populate the
// leaderboards so the game reads as established + competitive (instead of an
// empty board with one account). They're in-memory only (never saved, never
// log in) but have real, clickable profiles via /api/player/:id. Real players
// climb past them over time as they earn rank.
// Banners a bot can wear. Deliberately NOT tied to rank — like real players,
// a bot picks any banner it likes (a Grandmaster might rock the Master banner,
// etc.), so profiles feel personal instead of formulaic.
const BOT_BANNER_POOL = ['royal-gold', 'sapphire', 'royal-crimson', 'amethyst', 'inferno'];
function _botBanner(){ return BOT_BANNER_POOL[Math.floor(Math.random() * BOT_BANNER_POOL.length)]; }

const _GHOST_NAMES = [
  'RedOne', 'AtlasLion', 'MaghribKing', 'Casawi', '7mido', 'ZinoPro',
  'Cr7Maroc', 'DonHamza', 'TanjaBoy', 'ElMatador', 'GnawaBoy', 'FennecMa',
  'Younes_GOAT', 'DarbaMaster', 'Lwa7ch', 'BlackEagle', 'ChroniK', 'Sb3a',
  'RbatiBoy', 'KingReda', 'Dragon212', 'Mehdi212', 'ShadowMa', 'Bouhali',
  'SimoSniper', 'MarrakchiX', 'Ghosty212', 'NomadMa',
];
const GHOST_PLAYERS = _GHOST_NAMES.map((name, i) => {
  // Descending rank, all clearly ELITE: a couple of Grandmasters (9000+) at the
  // very top tapering down through Master to Diamond (floor 4200) — NEVER a low
  // tier. Real players climb up through Bronze→Platinum to reach them.
  const rp       = Math.max(4200, 9700 - i * 200 - Math.floor(Math.random() * 120));
  const played   = 650 + Math.floor(Math.random() * 1600);
  const winRate  = 0.60 + Math.random() * 0.14;
  const won      = Math.round(played * winRate);
  return {
    id:                    'ghost_' + (i + 1),
    shortId:               String(100000000 + Math.floor(Math.random() * 899999999)),
    username:              name,
    avatar:                _shopAvatar(),
    profileBanner:         _botBanner(),
    rankPoints:            rp,
    peakRankPoints:        rp + Math.floor(Math.random() * 320),
    stats:                 { gamesPlayed: played, gamesWon: won, totalPoints: won * 7 },
    rankedWins:            Math.round(won * 0.5),
    rankedLosses:          Math.round((played - won) * 0.4),
    winStreak:             Math.floor(Math.random() * 9),
    accountLevel:          70 + Math.floor(Math.random() * 31),
    coins:                 50000 + Math.floor(Math.random() * 3000000),
    diamonds:              Math.floor(Math.random() * 400),
    country:               'MA',
    isBot:                 true,
    isElite:               true,
    isGhost:               true,
    placementGamesPlayed:  5,
    hasCompletedPlacement: true,
    lastLoginAt:           Date.now() - Math.floor(Math.random() * 5400) * 1000,
    createdAt:             Date.now() - Math.floor(Math.random() * 220) * 86400000,
  };
});
// 20 MORE regulars on the mid-ladder (Gold → low Diamond) so the population
// reads as a full living community, not just an elite top-28. Their look
// follows their rank like real players: Platinum+ mostly wear premium designs
// (~80%), Gold sometimes (~30%). Fully resolvable profiles + friend-requestable.
const _GHOST_NAMES_MID = [
  'Amine07', 'YassirFlow', 'OujdaKing', 'Fassi_9dim', 'Bidaoui47',
  'TazaWolf', 'Rif_Lion', 'SoussLegend', 'HajarQueen', 'Salwa_MA',
  'AgadirSurf', 'MeknesPro', 'KechFalcon', 'Nador_Z', 'SafiStorm',
  'IlyasGG', 'WalidPro13', 'AsfiBoy', 'KhribgaCat', 'BeniMellal7',
];
_GHOST_NAMES_MID.forEach((name, i) => {
  const rp      = Math.max(1600, 4100 - i * 130 - Math.floor(Math.random() * 90));
  const premium = rp >= 2400 ? Math.random() < 0.8 : Math.random() < 0.3;
  const played  = 120 + Math.floor(Math.random() * 700);
  const winRate = 0.46 + Math.random() * 0.14;
  const won     = Math.round(played * winRate);
  GHOST_PLAYERS.push({
    id:                    'ghost_' + (GHOST_PLAYERS.length + 1),
    shortId:               String(100000000 + Math.floor(Math.random() * 899999999)),
    username:              name,
    avatar:                premium ? _shopAvatar() : randomPresetAvatar(),
    profileBanner:         _botBanner(),
    rankPoints:            rp,
    peakRankPoints:        rp + Math.floor(Math.random() * 260),
    stats:                 { gamesPlayed: played, gamesWon: won, totalPoints: won * 7 },
    rankedWins:            Math.round(won * 0.5),
    rankedLosses:          Math.round((played - won) * 0.4),
    winStreak:             Math.floor(Math.random() * 5),
    accountLevel:          Math.max(6, Math.min(78, Math.round(rp / 55 + Math.random() * 10))),
    coins:                 3000 + Math.floor(Math.random() * 400000),
    diamonds:              Math.floor(Math.random() * 120),
    country:               'MA',
    isBot:                 true,
    isElite:               premium,
    isGhost:               true,
    placementGamesPlayed:  5,
    hasCompletedPlacement: true,
    lastLoginAt:           Date.now() - Math.floor(Math.random() * 86400) * 1000,
    createdAt:             Date.now() - Math.floor(Math.random() * 300) * 86400000,
  });
});
// ── Full-ladder roster ──────────────────────────────────────────────
// 70 more believable players, TEN per tier (Bronze → Grandmaster), so every
// rung of the ladder is populated by a real-feeling crowd (not just an elite
// top). Crazy/pro gamer tags with a Moroccan flavour. Each wears ANY banner
// (not its rank's), a rank-appropriate look + difficulty, and is a fully
// clickable, friend-requestable profile like every other ghost.
const _GHOST_TIER_ROSTER = [
  { tier:'Bronze',      min:60,   max:470,  names:['ZawaliGamer','7amidoo','Terbiya3','CasaNoob','Bghrir212','L9rawi_','Sba3Star','MiloudX','DrariGaming','Twiza07'] },
  { tier:'Silver',      min:560,  max:1240, names:['RedaFlow','MehdiZzz','TangaWave','KenzaPlays','SifoTheKid','NassimGG','GhitaMA','Wa3raBnt','OumaymaWin','Bilal_47'] },
  { tier:'Gold',        min:1380, max:2320, names:['GoldenAmine','FassiFlex','RbatiFlow','MarraksGold','SoufianePro','LinaSniper','Chninwi','DarkAtlas','Yous3ZR','SaidTheBoss'] },
  { tier:'Platinum',    min:2480, max:3820, names:['PlatKiller','AchrafWave','ImadStorm','ZakariaX','SalmaPlays','NadaFire','OussamaGG','MehdiBlade','TariqZero','HibaAce'] },
  { tier:'Diamond',     min:3980, max:5900, names:['DiamondFennec','AymanRush','WalidBlaze','ChaimaPro','IliasKnight','SoukainaX','YassinFalcon','RedaVortex','NizarShadow','LamiaWolf'] },
  { tier:'Master',      min:6100, max:8800, names:['MasterZ3im','KhalidReaper','SaadTitan','MehdiVenom','GhaliOverlord','SamiaFrost','OthmaneGod','ZinebPhantom','AnasEmpire','LhajViper'] },
  { tier:'Grandmaster', min:9100, max:11200,names:['GM_Sultan','AtlasEmperor','MoradApex','LegendKarim','NadaNightmare','ImperialAdil','KenzaDivine','RedOneGOD','TheKingHamza','FinalBossMa'] },
];
_GHOST_TIER_ROSTER.forEach(band => {
  band.names.forEach(name => {
    const rp      = band.min + Math.floor(Math.random() * (band.max - band.min));
    const premium = rp >= 2400 ? Math.random() < 0.8 : rp >= 1300 ? Math.random() < 0.35 : Math.random() < 0.12;
    const played  = 80 + Math.floor(Math.random() * (rp >= 3900 ? 1500 : 600));
    const winRate = (rp >= 3900 ? 0.55 : 0.45) + Math.random() * 0.14;
    const won     = Math.round(played * winRate);
    GHOST_PLAYERS.push({
      id:                    'ghost_' + (GHOST_PLAYERS.length + 1),
      shortId:               String(100000000 + Math.floor(Math.random() * 899999999)),
      username:              name,
      avatar:                premium ? _shopAvatar() : randomPresetAvatar(),
      profileBanner:         _botBanner(),                 // ANY banner, not rank-locked
      rankPoints:            rp,
      peakRankPoints:        rp + Math.floor(Math.random() * 320),
      stats:                 { gamesPlayed: played, gamesWon: won, totalPoints: won * 7 },
      rankedWins:            Math.round(won * 0.5),
      rankedLosses:          Math.round((played - won) * 0.4),
      winStreak:             Math.floor(Math.random() * (rp >= 3900 ? 9 : 5)),
      accountLevel:          Math.max(5, Math.min(98, Math.round(rp / 55 + 4 + Math.random() * 10))),
      coins:                 3000 + Math.floor(Math.random() * (rp >= 3900 ? 3000000 : 400000)),
      diamonds:              Math.floor(Math.random() * (rp >= 3900 ? 400 : 120)),
      country:               'MA',
      isBot:                 true,
      isElite:               premium,
      isGhost:               true,
      placementGamesPlayed:  5,
      hasCompletedPlacement: true,
      lastLoginAt:           Date.now() - Math.floor(Math.random() * 86400) * 1000,
      createdAt:             Date.now() - Math.floor(Math.random() * 300) * 86400000,
    });
  });
});
// Real users + ghosts, for any leaderboard query.
function _rankablePlayers(){ return [...usersDB.values(), ...GHOST_PLAYERS]; }
function _findGhost(id){ return GHOST_PLAYERS.find(g => g.id === id) || null; }

// ── DAMA BOARDS ──
// DAMA is the Moroccan checkers variant. Where UNO has a "felt", DAMA has a
// board — an 8×8 checker pattern in two tones, often with a wooden frame.
//
// Per item:
//   • `light` / `dark` — paint applied to `.d-sq-light` / `.d-sq-dark` in
//     the live game (one square at a time). Can be any valid CSS background.
//   • `frame`          — background for `.d-board-frame` (the wooden border).
//   • `art`            — derived tiled checker pattern, used for the shop
//     thumbnail. Pre-built here so the catalog stays self-describing.
const _checker = (d, l) =>
  `conic-gradient(${d} 0 25%, ${l} 0 50%, ${d} 0 75%, ${l} 0) 0 0/26px 26px`;

const DAMABOARD_CATALOG = [
  { id:'db_classic',     name:'Classic Walnut',  rarity:'common',
    unlock:{ kind:'free' }, accent:'#92400E',
    light:'linear-gradient(140deg, #F0CD8E, #D9A85E)',
    dark: 'linear-gradient(140deg, #7B4423, #4F2912)',
    frame:'linear-gradient(160deg, #6B3A14 0%, #3F1F09 100%)',
    art: _checker('#5C2D0E', '#F4D9A8') },

  { id:'db_tourney',     name:'Tournament',      rarity:'common',
    unlock:{ kind:'tier', tier:'Bronze' }, accent:'#1F2937',
    light:'linear-gradient(140deg, #F8FAFC, #CBD5E1)',
    dark: 'linear-gradient(140deg, #1F2937, #0F172A)',
    frame:'linear-gradient(160deg, #111827 0%, #030712 100%)',
    art: _checker('#0F172A', '#F1F5F9') },

  { id:'db_eid_green',   name:'Eid Mubarak',     rarity:'rare',
    unlock:{ kind:'tier', tier:'Silver' }, accent:'#15803D',
    light:'linear-gradient(140deg, #F0FDF4, #BBF7D0)',
    dark: 'linear-gradient(140deg, #166534, #14532D)',
    frame:'linear-gradient(160deg, #052E18 0%, #021A0E 100%)',
    art: _checker('#14532D', '#F0FDF4') },

  { id:'db_mahogany',    name:'Mahogany Royal',  rarity:'rare',
    unlock:{ kind:'tier', tier:'Gold' }, accent:'#7C2D12',
    light:'linear-gradient(140deg, #D9B186, #B58A5E)',
    dark: 'linear-gradient(140deg, #4F1C04, #2A0F02)',
    frame:'linear-gradient(160deg, #3F1503 0%, #1A0B01 100%)',
    art: _checker('#3F1503', '#C8A578') },

  { id:'db_marble',      name:'Marble Royale',   rarity:'epic',
    unlock:{ kind:'tier', tier:'Platinum' }, accent:'#9CA3AF',
    light:'radial-gradient(ellipse at 30% 30%, #F8FAFC, #E5E7EB)',
    dark: 'radial-gradient(ellipse at 30% 30%, #374151, #0F172A)',
    frame:'linear-gradient(160deg, #4B5563 0%, #111827 100%)',
    art: _checker('#1F2937', '#E5E7EB') },

  { id:'db_atlas',       name:'Atlas Mosaic',    rarity:'epic',
    unlock:{ kind:'shop', currency:'diamonds', price:140 }, accent:'#C2410C',
    light:'linear-gradient(140deg, #FED7AA, #FB923C)',
    dark: 'linear-gradient(140deg, #7C2D12, #431407)',
    frame:'linear-gradient(160deg, #9A3412 0%, #431407 100%)',
    art: _checker('#7C2D12', '#FED7AA') },

  { id:'db_zellige',     name:'Zellige Mosaic',  rarity:'legendary',
    unlock:{ kind:'shop', currency:'diamonds', price:220 }, accent:'#0E7490',
    light:'linear-gradient(140deg, #FDE68A, #FBBF24)',
    dark: 'linear-gradient(140deg, #155E75, #083344)',
    frame:'linear-gradient(160deg, #155E75 0%, #042F2E 100%)',
    art: _checker('#155E75', '#FBBF24') },

  { id:'db_casino',      name:'Casino Plush',    rarity:'rare',
    unlock:{ kind:'shop', currency:'coins', price:5000 }, accent:'#B91C1C',
    light:'linear-gradient(140deg, #FECACA, #FCA5A5)',
    dark: 'linear-gradient(140deg, #7F1D1D, #450A0A)',
    frame:'linear-gradient(160deg, #7F1D1D 0%, #450A0A 100%)',
    art: _checker('#7F1D1D', '#FECACA') },

  { id:'db_sapphire',    name:'Sapphire Sea',    rarity:'epic',
    unlock:{ kind:'shop', currency:'diamonds', price:160 }, accent:'#1D4ED8',
    light:'linear-gradient(140deg, #DBEAFE, #93C5FD)',
    dark: 'linear-gradient(140deg, #1E3A8A, #0C1E3E)',
    frame:'linear-gradient(160deg, #1E40AF 0%, #0C1E3E 100%)',
    art: _checker('#1E3A8A', '#DBEAFE') },

  { id:'db_neon',        name:'Neon Cyber',      rarity:'epic',
    unlock:{ kind:'shop', currency:'diamonds', price:130 }, accent:'#06B6D4',
    light:'linear-gradient(140deg, #67E8F9, #06B6D4)',
    dark: 'linear-gradient(140deg, #1E0A2E, #0E1525)',
    frame:'linear-gradient(160deg, #1E0A2E 0%, #050912 100%)',
    art: _checker('#0E1525', '#06B6D4') },

  { id:'db_gold_master', name:'Gold Master',     rarity:'legendary',
    unlock:{ kind:'shop', currency:'diamonds', price:280 }, accent:'#FFD700',
    light:'linear-gradient(140deg, #FDE68A, #FBBF24)',
    dark: 'linear-gradient(140deg, #1A0F03, #050000)',
    frame:'linear-gradient(160deg, #2D1A04 0%, #050000 100%)',
    art: _checker('#1A0F03', '#FBBF24') },

  { id:'db_desert',      name:'Desert Dunes',    rarity:'rare',
    unlock:{ kind:'shop', currency:'coins', price:6500 }, accent:'#A16207',
    light:'linear-gradient(140deg, #FEF3C7, #FDE68A)',
    dark: 'linear-gradient(140deg, #78350F, #3F1505)',
    frame:'linear-gradient(160deg, #78350F 0%, #3F1505 100%)',
    art: _checker('#78350F', '#FDE68A') },

  { id:'db_grand_champ', name:'Grand Champion',  rarity:'legendary',
    unlock:{ kind:'achievement', achievement:'wins_100' }, accent:'#FBBF24',
    light:'linear-gradient(140deg, #FBBF24, #D97706)',
    dark: 'linear-gradient(140deg, #1F1F1F, #050505)',
    frame:'linear-gradient(160deg, #2D2D2D 0%, #050505 100%)',
    art: _checker('#1F1F1F', '#FFD700') },
];

// User backfill — runs from the same lazy path as ensureRankedFields.
function ensureCosmeticFields(user){
  if(!user) return null;
  let touched = false;
  if(!Array.isArray(user.ownedCardBacks)){
    user.ownedCardBacks = ['cb_default'];
    touched = true;
  } else if(!user.ownedCardBacks.includes('cb_default')){
    user.ownedCardBacks.unshift('cb_default');
    touched = true;
  }
  if(!Array.isArray(user.ownedTableFelts)){
    user.ownedTableFelts = ['tfp_green'];
    touched = true;
  } else if(!user.ownedTableFelts.includes('tfp_green')){
    user.ownedTableFelts.unshift('tfp_green');
    touched = true;
  }
  if(!Array.isArray(user.ownedDamaBoards)){
    user.ownedDamaBoards = ['db_classic'];
    touched = true;
  } else if(!user.ownedDamaBoards.includes('db_classic')){
    user.ownedDamaBoards.unshift('db_classic');
    touched = true;
  }
  if(typeof user.equippedCardBack   !== 'string'){ user.equippedCardBack   = 'cb_default'; touched = true; }
  if(typeof user.equippedTableFelt  !== 'string'){ user.equippedTableFelt  = 'tfp_green'; touched = true; }
  if(typeof user.equippedDamaBoard  !== 'string'){ user.equippedDamaBoard  = 'db_classic'; touched = true; }
  // Collection ⭐ favourites (parallel to the avatar favourites).
  if(!Array.isArray(user.favoriteCardBacks)){  user.favoriteCardBacks  = []; touched = true; }
  if(!Array.isArray(user.favoriteTableFelts)){ user.favoriteTableFelts = []; touched = true; }
  if(!Array.isArray(user.favoriteDamaBoards)){ user.favoriteDamaBoards = []; touched = true; }
  if(touched) saveUsers();
  return user;
}

// Tier ordinals for cosmetic gating (Bronze < Silver < ... < Grandmaster).
const COSMETIC_TIER_RANK = { Bronze:1, Silver:2, Gold:3, Platinum:4, Diamond:5, Master:6, Grandmaster:7 };

// Returns the list of cosmetic IDs the user qualifies to own based on
// their current tier + achievements. Called from the unlock pass below
// and from the catalog endpoint so the UI can render "Unlock at Silver"
// hints without re-deriving the rules.
function getEligibleCosmetics(user){
  if(!user) return { cardBacks:[], tableFelts:[], damaBoards:[] };
  ensureRankedFields(user);
  const tier = user.hasCompletedPlacement
    ? getLeague(user.rankPoints || 0).name
    : null;
  const userRank = tier ? COSMETIC_TIER_RANK[tier] : 0;

  const eligible = (catalog) => catalog
    .filter(item => {
      const u = item.unlock;
      if(u.kind === 'free')        return true;
      if(u.kind === 'tier')        return userRank >= (COSMETIC_TIER_RANK[u.tier] || 99);
      if(u.kind === 'achievement') return _checkAchievement(user, u.achievement);
      // season + shop items are NOT auto-granted; they must be claimed/bought.
      return false;
    })
    .map(item => item.id);

  return {
    cardBacks:  eligible(CARDBACK_CATALOG),
    tableFelts: eligible(TABLEFELT_CATALOG),
    damaBoards: eligible(DAMABOARD_CATALOG),
  };
}

function _checkAchievement(user, achId){
  const w = user.rankedWins || user.stats?.gamesWon || 0;
  switch(achId){
    case 'wins_100':         return w >= 100;
    case 'wins_1000':        return w >= 1000;
    case 'streak_10':        return (user.winStreak || 0) >= 10;
    case 'tournament_win_1': return (user.tournamentWins || 0) >= 1;
    default:                 return false;
  }
}

// Auto-grant any newly-eligible cosmetics into the user's collection.
// Called after every ranked match end (so tier-crossings auto-drop the
// new card back) and at boot for backfill.
function syncEarnedCosmetics(user){
  if(!user) return [];
  ensureCosmeticFields(user);
  const owned = {
    cardBacks:  new Set(user.ownedCardBacks),
    tableFelts: new Set(user.ownedTableFelts),
    damaBoards: new Set(user.ownedDamaBoards),
  };
  const granted = [];
  const elig = getEligibleCosmetics(user);
  elig.cardBacks.forEach(id => {
    if(!owned.cardBacks.has(id)){
      user.ownedCardBacks.push(id);
      const item = CARDBACK_CATALOG.find(c => c.id === id);
      if(item) granted.push({ type:'cardBack', ...item });
    }
  });
  elig.tableFelts.forEach(id => {
    if(!owned.tableFelts.has(id)){
      user.ownedTableFelts.push(id);
      const item = TABLEFELT_CATALOG.find(c => c.id === id);
      if(item) granted.push({ type:'tableFelt', ...item });
    }
  });
  elig.damaBoards.forEach(id => {
    if(!owned.damaBoards.has(id)){
      user.ownedDamaBoards.push(id);
      const item = DAMABOARD_CATALOG.find(c => c.id === id);
      if(item) granted.push({ type:'damaBoard', ...item });
    }
  });
  if(granted.length) saveUsers();
  return granted;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─────────────────────────────────────────
// ROOM RECORD
// ─────────────────────────────────────────

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}

function createRoomRecord(hostId, settings = {}, roomType = 'PRIVATE') {
  return {
    id:         uuidv4(),
    code:       generateRoomCode(),
    hostId,
    roomType,                                              // 'CLASSIC'|'FUN'|'RANKED'|'CHILL'|'PRIVATE'
    settings: {
      maxPlayers:   settings.maxPlayers    || 4,
      minPlayers:   settings.minPlayers    || 2,
      handSize:     settings.handSize      || 7,
      isPrivate:    settings.isPrivate     || false,
      password:     settings.password      || null,
      drawStacking: settings.drawStacking  || 'none',
      bet:          settings.bet           || 0,
      botDifficulty: settings.botDifficulty || 'medium',
      ranked:       settings.ranked         || false,   // RANKED RONDA (matchmaking-only)
      mode:         settings.mode           || null,    // Cardora play-mode: '1v1' | '2v2' | 'ffa'
      teamMode:     settings.teamMode       || false,   // 2v2 — two players share one hand (engine: next build)
      timeControl:  settings.timeControl     || 'RAPID_10',  // CHESS clocks (ignored by other engines)
    },
    game:       null,
    playerIds:  [],
    /* Per-player bet pool. Each seated player picks their own buy-in
       (≥ settings.bet, which is now the room's floor). On game start the
       pot = sum of these. Defaults to the floor when a player first
       sits down. Cleared if they leave before start. */
    playerBets: {},        // userId -> chosen bet amount
    spectators: new Set(), // userIds currently spectating this room
    spectatorChat: [],
    spectatorVotes: new Map(), // spectatorUserId -> votedPlayerId
    chat:       [],
    status:     'lobby',
    createdAt:  Date.now(),
    startedAt:  null,
  };
}

// Returns open rooms of a given featured type, sorted most-populated first.
function _openRoomsOfType(type) {
  return [...roomsDB.values()]
    .filter(r => r.roomType === type
              && r.status === 'lobby'
              && r.playerIds.length < r.settings.maxPlayers)
    .sort((a, b) => b.playerIds.length - a.playerIds.length);
}

// Quick Match: server-picked type, never RANKED. Prefer most-populated
// across the non-ranked pool (funnels players into rooms about to fill);
// fall back to random only when ALL pool types are empty / equal at 0.
function pickQuickMatchType() {
  let bestType = null, bestPop = -1;
  for (const t of QUICK_MATCH_POOL) {
    const top = _openRoomsOfType(t)[0];
    const pop = top ? top.playerIds.length : 0;
    if (pop > bestPop) { bestPop = pop; bestType = t; }
  }
  if (bestPop <= 0) {
    return QUICK_MATCH_POOL[Math.floor(Math.random() * QUICK_MATCH_POOL.length)];
  }
  return bestType;
}

// ── RANKED MODE — Phase 2: MMR matchmaking helpers ─────────────────────
// MMR window starts tight, widens linearly with queue age, capped at a
// max gap. Placement players (placementGamesPlayed < 5) skip the filter
// entirely — we don't know their skill yet, so wedging them into the
// nearest open ranked seat keeps queues short and lets the placement
// scoring sort them out across 5 games.
const RANKED_MMR_INITIAL  = 200;        // ± points at room age 0
const RANKED_MMR_PER_15S  = 150;        // widen by this every 15s of room age
const RANKED_MMR_MAX      = 1200;       // hard ceiling so queues always resolve
const RANKED_FILL_DELAY_MS = 10 * 1000; // auto-fill with bots after 10s — was 30s, faster start for solo queue

function rankedMmrWindow(room) {
  const ageMs   = Date.now() - (room.createdAt || Date.now());
  const steps   = ageMs / 15000;
  const window  = RANKED_MMR_INITIAL + steps * RANKED_MMR_PER_15S;
  return Math.min(RANKED_MMR_MAX, Math.max(RANKED_MMR_INITIAL, window));
}

function rankedRoomAnchor(room) {
  if (!room.game) return 1000;
  const ranks = room.game.players
    .filter(p => !p.isBot)
    .map(p => {
      const u = usersDB.get(p.id);
      return u ? (u.rankPoints || 0) : 0;
    });
  if (!ranks.length) return 1000;
  return ranks.reduce((s, v) => s + v, 0) / ranks.length;
}

function isUserInPlacement(user) {
  return (user?.placementGamesPlayed || 0) < 5;
}

// Bot difficulty scaled to the room's anchor rank — keeps filler bots
// from steamrolling Bronze players and from being target practice for
// Diamond+ players. Boundaries are intentionally generous since UNO
// has heavy luck; the goal is "feels fair", not perfect calibration.
function botDifficultyForRank(anchor) {
  if (anchor >= 2500) return 'hard';
  if (anchor >= 1500) return 'medium';
  return 'easy';
}

// Find the most-populated open room of `type`, or spawn a fresh instance
// using the type's config. Adds `user` to the room as a player (host iff
// the room was created in this call). Returns { room, created }.
function findOrCreateRoomOfType(type, user, mode, betOverride) {
  const cfg = ROOM_TYPES[type];
  if (!cfg) throw new Error('Unknown room type: ' + type);

  if (type === 'RANKED') return findOrCreateRankedRoom(user);

  // Cardora play-mode (UNO-like only): 1v1 → 2-seat room, ffa → 4-seat solo,
  // 2v2 → 4-seat team room. A room with no `mode` tag is treated as ffa, so
  // legacy rooms still match. Other game types ignore `mode` entirely.
  const modeKey  = (UNO_LIKE_TYPES.has(type) && (mode === '1v1' || mode === '2v2' || mode === 'ffa')) ? mode : null;
  const modeMax  = modeKey === '1v1' ? 2 : 4;
  const teamMode = modeKey === '2v2';
  const matchMode = (r) => modeKey ? ((r.settings.mode || 'ffa') === modeKey) : true;

  // Casual must never land in a RANKED room (ranked rooms are roomType
  // 'RONDA' too, flagged settings.ranked) — they're matchmaking-only.
  // A high-stakes join must SPAWN a fresh room at that stake, never merge into
  // an existing low-stakes table, so only match a room with the same bet.
  const betFor = (typeof betOverride === 'number' && betOverride > 0) ? betOverride : cfg.entryFee;
  const matchBet = (r) => !(betOverride > 0) || (r.settings.bet || 0) === betOverride;
  let room    = _openRoomsOfType(type).find(r => !r.settings.ranked && matchMode(r) && matchBet(r)) || null;
  let created = false;

  if (!room) {
    room = createRoomRecord(user.id, {
      maxPlayers: modeKey ? modeMax : cfg.maxPlayers,
      bet:        betFor,
      mode:       modeKey || undefined,
      teamMode:   teamMode || undefined,
    }, type);
    // Factory: DAMA uses the dedicated 8×8 engine; everything else
    // stays on the UNO engine. attachDamaListeners wires the engine's
    // EventEmitter to the socket flow.
    room.game = makeGameForRoom(room.id, room.settings, type);
    if      (type === 'DAMA')  attachDamaListeners(room);
    else if (type === 'CHESS') attachChessListeners(room);
    else if (type === 'RONDA') attachRondaListeners(room);
    else                       attachGameListeners(room);
    roomsDB.set(room.id, room);
    created = true;
    console.log(`[Room] Spawned ${type} (${room.id}) for ${user.username}`);
  }

  if (!room.playerIds.includes(user.id)) {
    const player = new Player(user.id, user.username, user.coins);
    player.avatar = user.avatar; player.cardBackId = user.equippedCardBack || 'cb_default';
    player.tableFelt = user.equippedTableFelt || 'tfp_green';
    player.isHost = created;                                // host only when we just spawned it
    const result = room.game.addPlayer(player);
    if (!result.success) throw new Error('addPlayer failed: ' + result.reason);
    room.playerIds.push(user.id);
  }

  // DAMA / RONDA / UNO-like: arm a bot-fill timer so a lonely player
  // can play solo without sitting in an empty lobby. Idempotent.
  if (type === 'DAMA')           scheduleDamaFill(room);
  else if (type === 'CHESS')     scheduleChessFill(room);
  else if (type === 'RONDA')     scheduleRondaFill(room);
  else if (UNO_LIKE_TYPES.has(type)) scheduleUnoFill(room);

  return { room, created };
}

// ── Bot identities ──────────────────────────────────────────────────
// One shared pool so every bot (UNO / RONDA / Dama / league / tournament /
// ambient lobby) reads like a real Moroccan player: a mix of genuine first
// names AND the kind of gamer nicknames Moroccans actually pick (darija, city
// tags, the 212 country code, a little leetspeak). Drawn from at fill time so
// opponents revealed in the match-found screen look 100% human.
const MOROCCAN_BOT_NAMES = [
  // real first names (m)
  'Mehdi', 'Younes', 'Ayoub', 'Zakaria', 'Hamza', 'Bilal', 'Anas', 'Reda',
  'Achraf', 'Soufiane', 'Oussama', 'Yassine', 'Ilyas', 'Marwane', 'Adam',
  'Nizar', 'Walid', 'Amine', 'Ismail', 'Othmane', 'Saad', 'Karim', 'Hicham',
  'Badr', 'Taha', 'Mouad', 'Imad', 'Nabil', 'Khalil', 'Anouar', 'Tarik',
  'Rachid', 'Omar', 'Sami', 'Mounir', 'Driss', 'Nacer', 'Salim',
  // real first names (f)
  'Salma', 'Hiba', 'Imane', 'Nada', 'Aya', 'Sara', 'Maryam', 'Ghita', 'Doha',
  'Wiam', 'Lina', 'Yasmine', 'Nadia', 'Manal', 'Ines', 'Chaimae', 'Houda',
  'Oumaima', 'Rim', 'Asmae', 'Hajar',
  // Moroccan-style gamer nicknames
  'RedOne', 'Za3im', 'AtlasLion', 'Cr7Maroc', 'Simo07', 'Casawi', 'TanjaBoy',
  '7mido', 'MaghribKing', 'Sniper07', 'ChroniK', 'Ghosty212', 'DarkAmine',
  'ZinoPro', 'BladiGamer', 'DonHamza', 'KingReda', 'Dragon212', 'ShadowMa',
  'ElMatador', 'RedZone', 'FennecMa', 'AtlasWolf', 'MrCasa', 'Younes_GOAT',
  'GnawaBoy', 'ChaabiKing', 'Lkhdar', 'Bachir07', 'Mehdi212', 'RbatiBoy',
  'MarrakchiX', 'NomadMa', 'BlackEagle', 'SimoSniper', 'Sb3a', 'Lwa7ch',
  'Casa_Boy', 'DarbaMaster', '3awtani', 'Bouhali', 'Hayloul', 'Reda_212',
];

const DAMA_FILL_DELAY_MS = 8 * 1000;
const DAMA_BOT_NAMES = MOROCCAN_BOT_NAMES;

// Auto-fill a DAMA room with one bot if the second seat is still
// empty after DAMA_FILL_DELAY_MS. Then debit the human's entry fee
// (bot plays free) and start the match. The dama:* event funnel
// in attachDamaListeners drives both clients from there.
function scheduleDamaFill(room){
  if (!room || room.roomType !== 'DAMA') return;
  // RE-ARMABLE (real players first): a 2nd human joining resets the timer, so a
  // real opponent is matched before falling back to a bot.
  if (room.damaFillTimer){ clearTimeout(room.damaFillTimer); room.damaFillTimer = null; }
  room.damaFillTimer = setTimeout(() => {
    room.damaFillTimer = null;
    const r = roomsDB.get(room.id);
    if (!r || r.status !== 'lobby') return;
    const open = (r.settings.maxPlayers || 2) - r.playerIds.length;
    // Need ≥1 real human. If a REAL opponent already filled the seat (open<=0),
    // skip the bot and go straight to the start — real players never wait.
    if (!r.playerIds.some(pid => { const u = usersDB.get(pid); return u && !u.isBot; })) return;

    let botName = 'real opponent';
    if (open > 0){
      const botId   = 'bot_dama_' + Date.now();
      botName       = DAMA_BOT_NAMES[Math.floor(Math.random() * DAMA_BOT_NAMES.length)];
      const _bid    = makeBotIdentity(botName);   // ~25% elite → premium look + HARD
      const result  = r.game.addPlayer({
        id: botId, username: botName, avatar: _bid.avatar, cardBackId: _bid.cardBackId, isBot: true, isHost: false,
      });
      if (!result.success){
        console.error(`[Dama] bot-fill addPlayer failed: ${result.reason}`);
        return;
      }
      r.playerIds.push(botId);
      const _bp = r.game.players.find(p => p.id === botId);
      if (_bp){ _bp.isElite = _bid.isElite; _bp.tableFelt = _bid.tableFelt; _bp.botDifficulty = _bid.difficulty; _bp.accountLevel = botLevelFor(_bid.difficulty); }

      // Reveal window — surface the now-full lobby so the player sees the
      // opponent resolve (avatar + name), then start after a beat.
      try { io.to(r.id).emit('room:player_joined', { player: { username: botName, isBot: true } }); } catch (e) {}
    }

    setTimeout(() => {
      const rr = roomsDB.get(room.id);
      if (!rr || rr.status !== 'lobby') return;
      if (!rr.playerIds.some(pid => { const u = usersDB.get(pid); return u && !u.isBot; })) return;

      // Debit per-human entry. Bot plays free.
      const fee = safeInt(rr.settings.bet || 0, MAX_BET_AMOUNT);
      if (fee > 0){
        let pot = 0;
        for (const pid of rr.playerIds){
          const u = usersDB.get(pid);
          if (!u) continue;
          const have  = safeCoins(u);
          const debit = Math.min(fee, have);
          u.coins = have - debit;
          pot += debit;
          const sock = findSocketByUserId(pid);
          if (sock) sock.emit('match:debited', { entryFee: debit, coins: u.coins });
        }
        rr.pot = Math.min(pot, MAX_POT_AMOUNT);
        saveUsers();
      }

      const start = rr.game.startGame();
      if (!start.success){
        console.error(`[Dama] auto-start failed in ${rr.id}: ${start.reason}`);
        return;
      }
      rr.status    = 'playing';
      rr.startedAt = Date.now();
      io.to(rr.id).emit('dama:auto_start', { reason:'bot_fill', botName });
      console.log(`[Dama] auto-started ${rr.id} — filled with bot ${botName}`);
    }, BOT_FILL_REVEAL_MS);
  }, _randomFillDelay());
}

// Mirrors scheduleDamaFill for CHESS (also 1v1). Same re-armable
// "real players first" behaviour: a human opponent always beats the bot.
function scheduleChessFill(room){
  if (!room || room.roomType !== 'CHESS') return;
  if (room.chessFillTimer){ clearTimeout(room.chessFillTimer); room.chessFillTimer = null; }
  room.chessFillTimer = setTimeout(() => {
    room.chessFillTimer = null;
    const r = roomsDB.get(room.id);
    if (!r || r.status !== 'lobby') return;
    const open = (r.settings.maxPlayers || 2) - r.playerIds.length;
    if (!r.playerIds.some(pid => { const u = usersDB.get(pid); return u && !u.isBot; })) return;

    let botName = 'real opponent';
    if (open > 0){
      const botId  = 'bot_chess_' + Date.now();
      botName      = DAMA_BOT_NAMES[Math.floor(Math.random() * DAMA_BOT_NAMES.length)];
      const _bid   = makeBotIdentity(botName);
      const result = r.game.addPlayer({
        id: botId, username: botName, avatar: _bid.avatar, cardBackId: _bid.cardBackId,
        isBot: true, isHost: false, botDifficulty: _bid.difficulty,
      });
      if (!result.success){
        console.error(`[Chess] bot-fill addPlayer failed: ${result.reason}`);
        return;
      }
      r.playerIds.push(botId);
      const _bp = r.game.players.find(p => p.id === botId);
      if (_bp){
        _bp.isElite = _bid.isElite; _bp.tableFelt = _bid.tableFelt;
        _bp.botDifficulty = _bid.difficulty; _bp.accountLevel = botLevelFor(_bid.difficulty);
      }
      try { io.to(r.id).emit('room:player_joined', { player: { username: botName, isBot: true } }); } catch (e) {}
    }

    setTimeout(() => {
      const rr = roomsDB.get(room.id);
      if (!rr || rr.status !== 'lobby') return;
      if (!rr.playerIds.some(pid => { const u = usersDB.get(pid); return u && !u.isBot; })) return;

      const fee = safeInt(rr.settings.bet || 0, MAX_BET_AMOUNT);
      if (fee > 0){
        let pot = 0;
        for (const pid of rr.playerIds){
          const u = usersDB.get(pid);
          if (!u) continue;
          const have  = safeCoins(u);
          const debit = Math.min(fee, have);
          u.coins = have - debit;
          pot += debit;
          const sock = findSocketByUserId(pid);
          if (sock) sock.emit('match:debited', { entryFee: debit, coins: u.coins });
        }
        rr.pot = Math.min(pot, MAX_POT_AMOUNT);
        saveUsers();
      }

      const start = rr.game.startGame();
      if (!start.success){
        console.error(`[Chess] auto-start failed in ${rr.id}: ${start.reason}`);
        return;
      }
      rr.status    = 'playing';
      rr.startedAt = Date.now();
      io.to(rr.id).emit('chess:auto_start', { reason:'bot_fill', botName });
      console.log(`[Chess] auto-started ${rr.id} — filled with bot ${botName}`);
    }, BOT_FILL_REVEAL_MS);
  }, _randomFillDelay());
}

// Mirrors scheduleDamaFill but for RONDA (also 1v1, same 8 s timer).
const RONDA_FILL_DELAY_MS = 8 * 1000;
const RONDA_BOT_NAMES = MOROCCAN_BOT_NAMES;

function scheduleRondaFill(room){
  if (!room || room.roomType !== 'RONDA') return;
  // RE-ARMABLE: every real player who joins RESETS this timer, so the lobby
  // waits ~10–20s after the LAST human before falling back to bots. Real
  // players online at the same time get first priority to match each other.
  if (room.rondaFillTimer){ clearTimeout(room.rondaFillTimer); room.rondaFillTimer = null; }
  room.rondaFillTimer = setTimeout(() => {
    room.rondaFillTimer = null;
    const r = roomsDB.get(room.id);
    if (!r || r.status !== 'lobby') return;
    const open = (r.settings.maxPlayers || 4) - r.playerIds.length;
    // Need at least one real human (never start a fully-bot lobby). If the room
    // already filled with REAL players (open<=0), the loop below adds no bots and
    // we go straight to the start — real players never get stuck waiting.
    if (!r.playerIds.some(pid => { const u = usersDB.get(pid); return u && !u.isBot; })) return;

    // Fill EVERY empty seat with a unique bot so the 2v2 game starts. In RANKED
    // rooms the bots are RANK-MATCHED to the human (Diamond/Master player → only
    // Platinum→GM opponents) and wear the full premium pro look.
    const isRanked  = !!r.settings.ranked;
    const humanRank = isRanked ? rankedRoomAnchor(r) : 0;
    const usedNames = new Set(r.game.players.map(p => p.username));
    const addedBots = [];
    for (let i = 0; i < open; i++){
      let name;
      for (let tries = 0; tries < 20; tries++){
        const cand = RONDA_BOT_NAMES[Math.floor(Math.random() * RONDA_BOT_NAMES.length)];
        if (!usedNames.has(cand)){ name = cand; break; }
      }
      if (!name) name = `Bot ${i + 1}`;
      usedNames.add(name);
      const botId = 'bot_ronda_' + Date.now() + '_' + i;
      const _bid  = isRanked ? _rankedBotIdentity(name, humanRank) : makeBotIdentity(name);
      const result = r.game.addPlayer({ id: botId, username: name, avatar: _bid.avatar, cardBackId: _bid.cardBackId, isBot: true, isHost: false });
      if (!result.success){
        console.error(`[Ronda] bot-fill addPlayer failed: ${result.reason}`);
        continue;
      }
      r.playerIds.push(botId);
      const _bp = r.game.players.find(p => p.id === botId);
      if (_bp){
        _bp.isElite = _bid.isElite; _bp.tableFelt = _bid.tableFelt; _bp.botDifficulty = _bid.difficulty;
        _bp.accountLevel = _bid.accountLevel || botLevelFor(_bid.difficulty);
        if (isRanked){ _bp.rankPoints = _bid.rankPoints; _bp.rankedTier = _bid.rankedTier; _bp.peakRankPoints = _bid.peakRankPoints; }
      }
      addedBots.push(name);
    }
    // Proceed to start whether we added bots OR the room is already full of real
    // players (addedBots empty in that case).
    const botName = addedBots.length ? addedBots.join(', ') : 'real players';

    // Reveal window — surface the now-full lobby so the player sees every
    // opponent resolve (avatar + name), then start the 2v2 after a beat. Only
    // emit when we actually added a bot.
    if (addedBots.length){
      try { io.to(r.id).emit('room:player_joined', { player: { username: addedBots[addedBots.length - 1], isBot: true } }); } catch (e) {}
    }

    setTimeout(() => {
      const rr = roomsDB.get(room.id);
      if (!rr || rr.status !== 'lobby') return;
      if (!rr.playerIds.some(pid => { const u = usersDB.get(pid); return u && !u.isBot; })) return;

      // Debit per-human entry. Bot plays free.
      const fee = safeInt(rr.settings.bet || 0, MAX_BET_AMOUNT);
      if (fee > 0){
        let pot = 0;
        for (const pid of rr.playerIds){
          const u = usersDB.get(pid);
          if (!u) continue;
          const have  = safeCoins(u);
          const debit = Math.min(fee, have);
          u.coins = have - debit;
          pot += debit;
          const sock = findSocketByUserId(pid);
          if (sock) sock.emit('match:debited', { entryFee: debit, coins: u.coins });
        }
        rr.pot = Math.min(pot, MAX_POT_AMOUNT);
        saveUsers();
      }

      const start = rr.game.startGame();
      if (!start.success){
        console.error(`[Ronda] auto-start failed in ${rr.id}: ${start.reason}`);
        return;
      }
      rr.status    = 'playing';
      rr.startedAt = Date.now();
      io.to(rr.id).emit('ronda:auto_start', { reason:'bot_fill', botName });
      console.log(`[Ronda] auto-started ${rr.id} — filled with bot ${botName}`);
    }, BOT_FILL_REVEAL_MS);
  }, _randomFillDelay());
}

/* ── UNO-engine room bot-fill (CLASSIC / CHILL / PRIVATE / UNO) ────
 *  After 10 s of waiting alone, top up the empty seats with bots and
 *  start the match. Same shape as the Ronda fill above. */
const UNO_FILL_DELAY_MS = 10 * 1000;
// After bots are seated we hold the lobby for a beat so the player's
// "match found" screen resolves its spinning seats into the real opponents
// (avatar + name) before the live game starts. Shared by UNO/Dama/Ronda fill.
const BOT_FILL_REVEAL_MS = 2600;
// Each search takes a believable, VARYING amount of time (~10–20s) so the
// "searching" timer counts up to a different total every match — feels like a
// real matchmaking queue, not a fixed countdown. Used by all bot-fills
// (Cardora / Ronda / Dama / Ranked).
function _randomFillDelay(){ return 10000 + Math.floor(Math.random() * 10001); }   // 10–20s
const UNO_LIKE_TYPES    = new Set(['CLASSIC', 'CHILL', 'PRIVATE', 'UNO']);
// Realistic player names so filler bots are indistinguishable from real
// opponents — no "Bot" in the name, no difficulty tell.
const UNO_BOT_NAMES     = MOROCCAN_BOT_NAMES;
function scheduleUnoFill(room){
  if (!room || !UNO_LIKE_TYPES.has(room.roomType)) return;
  // RE-ARMABLE (real players first): each human who joins resets the timer, so
  // the room waits ~10–20s after the LAST human before bots fill the rest.
  if (room.unoFillTimer){ clearTimeout(room.unoFillTimer); room.unoFillTimer = null; }
  room.unoFillTimer = setTimeout(() => {
    room.unoFillTimer = null;
    const r = roomsDB.get(room.id);
    if (!r || r.status !== 'lobby') return;
    const open = (r.settings.maxPlayers || 4) - r.playerIds.length;
    // Need ≥1 real human. If the room already filled with REAL players (open<=0),
    // the loop adds no bots and we go straight to the start — humans never wait.
    if (!r.playerIds.some(pid => { const u = usersDB.get(pid); return u && !u.isBot; })) return;

    const used = new Set(r.game.players.map(p => p.username));
    const added = [];
    for (let i = 0; i < open; i++){
      let name;
      for (let t = 0; t < 20; t++){
        const cand = UNO_BOT_NAMES[Math.floor(Math.random() * UNO_BOT_NAMES.length)];
        if (!used.has(cand)){ name = cand; break; }
      }
      if (!name) name = `Bot ${i + 1}`;
      used.add(name);
      const bot = new Player('bot_uno_' + Date.now() + '_' + i, name, 0);
      bot.isBot       = true;
      bot.isConnected = true;
      bot.status      = 'active';
      applyBotIdentity(bot, name);   // ~25% elite → premium look + HARD play
      const result = r.game.addPlayer(bot);
      if (!result.success){
        console.error(`[UNO] bot-fill addPlayer failed: ${result.reason}`);
        continue;
      }
      r.playerIds.push(bot.id);
      added.push(name);
    }
    // proceed to start whether bots were added or the room is already full

    // ── Match-found reveal window ──
    // The lobby is now full. Nudge the human(s) to refresh so the "match
    // found" screen's spinning seats resolve into the real opponents (avatar +
    // name); hold a beat so they can see who they're up against, THEN debit +
    // start + push the live game. Only emit when we actually added a bot.
    if (added.length){
      try { io.to(r.id).emit('room:player_joined', { player: { username: added[added.length - 1], isBot: true } }); } catch (e) {}
    }

    setTimeout(() => {
      const rr = roomsDB.get(room.id);
      if (!rr || rr.status !== 'lobby') return;                 // left / already started
      if (!rr.playerIds.some(pid => { const u = usersDB.get(pid); return u && !u.isBot; })) return;  // no humans left

      // Debit per-human entry fee (bots play free).
      const fee = safeInt(rr.settings.bet || 0, MAX_BET_AMOUNT);
      if (fee > 0){
        let pot = 0;
        for (const pid of rr.playerIds){
          const u = usersDB.get(pid);
          if (!u) continue;
          const have  = safeCoins(u);
          const debit = Math.min(fee, have);
          u.coins = have - debit;
          pot += debit;
          const sock = findSocketByUserId(pid);
          if (sock) sock.emit('match:debited', { entryFee: debit, coins: u.coins });
        }
        rr.pot = Math.min(pot, MAX_POT_AMOUNT);
        saveUsers();
      }

      const start = rr.game.startGame(rr.hostId);
      if (!start.success){
        console.error(`[UNO] auto-start failed in ${rr.id}: ${start.reason}`);
        return;
      }
      rr.status      = 'playing';
      rr.startedAt   = Date.now();
      rr.game.pot    = rr.pot || 0;

      // Push the initial state to every seated socket exactly like the
      // regular game:start socket handler does — wrap with
      // decorateRankedState so the client gets the same shape it expects
      // (matters for both ranked + casual rooms; passthrough for casual).
      rr.playerIds.forEach(pid => {
        const p  = rr.game.players.find(pp => pp.id === pid);
        if (!p) return;
        if (p.isBot) return;        // skip bot seats — no real socket to push to
        const sk = findSocketByUserId(pid);
        if (sk) {
          sk.join(rr.id);
          sk.currentRoomId = rr.id;
          const state = decorateRankedState(rr, rr.game._playerState(p));
          sk.emit('game:state', state);
          console.log(`[UNO/bot-fill] emitted game:state to ${p.username} (sock=${sk.id})`);
        } else {
          console.warn(`[UNO/bot-fill] no socket for ${p.username} (pid=${pid})`);
        }
      });
      io.to(rr.id).emit('ranked:auto_start', { reason:'bot_fill', botName: added.join(', ') });
      console.log(`[UNO] auto-started ${rr.id} — filled ${added.length} bot(s): ${added.join(', ')}`);
    }, BOT_FILL_REVEAL_MS);
  }, _randomFillDelay());
}

// ── Staggered fill for CREATED PUBLIC rooms ─────────────────────────
// When a player creates a PUBLIC room and no humans join, opponents trickle in
// one at a time with realistic, uneven gaps (≈7s, then +5s, +4s…) — so it
// reads like real players finding the room, not a batch of bots appearing at
// once. PRIVATE rooms get nothing (only invited friends). When the room fills,
// it auto-starts (the host can also Start early via their button).
const STAGGER_GAPS_MS = [7000, 5000, 4000, 4000, 3500, 3000];
function scheduleStaggeredFill(room){
  if (!room || room.settings.isPrivate || room.settings.ranked) return;   // private/ranked: no trickle
  if (room._staggerArmed) return;
  room._staggerArmed = true;
  let i = 0;
  const addOne = () => {
    const r = roomsDB.get(room.id);
    if (!r || r.status !== 'lobby') return;                  // started / gone / host left
    const max = r.settings.maxPlayers || 4;
    if (r.playerIds.length >= max) return;                   // already full
    // Seat ONE bot with a fresh Moroccan name.
    const used = new Set(r.game.players.map(p => p.username));
    let name = null;
    for (let t = 0; t < 25; t++){
      const c = MOROCCAN_BOT_NAMES[Math.floor(Math.random() * MOROCCAN_BOT_NAMES.length)];
      if (!used.has(c)){ name = c; break; }
    }
    if (name && _seatOneBot(r, name)){
      try { io.to(r.id).emit('room:player_joined', { player: { username: name, isBot: true } }); } catch (e) {}
    }
    i++;
    if (r.playerIds.length < max){
      room._staggerTimer = setTimeout(addOne, STAGGER_GAPS_MS[Math.min(i, STAGGER_GAPS_MS.length - 1)]);
    } else {
      _autoStartFullRoom(r);   // room full → start (after a short ready beat)
    }
  };
  room._staggerTimer = setTimeout(addOne, STAGGER_GAPS_MS[0]);   // first opponent ≈7s in
}

// Start a full lobby room (engine-aware) after a short "get ready" beat. Used
// when a created room fills via the staggered trickle.
function _autoStartFullRoom(room){
  const rid = room.id;
  setTimeout(() => {
    const r = roomsDB.get(rid);
    if (!r || r.status !== 'lobby') return;
    if (!r.playerIds.some(pid => { const u = usersDB.get(pid); return u && !u.isBot; })) return;   // no humans left
    // Debit per-human entry fee (bots play free).
    const fee = safeInt(r.settings.bet || 0, MAX_BET_AMOUNT);
    if (fee > 0){
      let pot = 0;
      for (const pid of r.playerIds){
        const u = usersDB.get(pid); if (!u) continue;
        const have = safeCoins(u); const debit = Math.min(fee, have);
        u.coins = have - debit; pot += debit;
        const sock = findSocketByUserId(pid);
        if (sock) sock.emit('match:debited', { entryFee: debit, coins: u.coins });
      }
      r.pot = Math.min(pot, MAX_POT_AMOUNT); saveUsers();
    }
    const isUno = UNO_LIKE_TYPES.has(r.roomType) || r.roomType === 'PRIVATE';
    const start = isUno ? r.game.startGame(r.hostId) : r.game.startGame();
    if (!start || !start.success){ console.error(`[Stagger] start failed in ${r.id}: ${start?.reason}`); return; }
    r.status = 'playing'; r.startedAt = Date.now(); r.game.pot = r.pot || 0;
    if (isUno){
      r.playerIds.forEach(pid => {
        const p = r.game.players.find(pp => pp.id === pid);
        if (!p || p.isBot) return;
        const sk = findSocketByUserId(pid);
        if (sk){ sk.join(r.id); sk.currentRoomId = r.id; sk.emit('game:state', decorateRankedState(r, r.game._playerState(p))); }
      });
    }
    io.to(r.id).emit('ranked:auto_start', { reason: 'room_filled' });
    console.log(`[Stagger] auto-started ${r.id} (full)`);
  }, BOT_FILL_REVEAL_MS);
}

// RANKED-specific path: pick the most populated open ranked room whose
// MMR window is wide enough to admit `user` (and vice-versa — symmetric:
// the joining user's own tight window must also accept the room's anchor
// when the user is post-placement). If nothing fits, spawn fresh and arm
// the bot-fill timer so the player isn't stranded.
// RANKED = the full RONDA game (2v2) with rank points on top. The room is a
// real RONDA room (roomType 'RONDA', so EVERYTHING — engine, card movements,
// mic, rules, abandon handling — works natively) flagged settings.ranked=true.
// Players are matched with other ranked players inside the MMR window; if none
// fit, a fresh ranked room is spawned and bot-filled. Free entry (no coin pot).
function findOrCreateRankedRoom(user) {
  ensureRankedFields(user);
  // Phase 4 — flagged smurfs in fresh placement get bumped to an effective
  // rank of 2000 (Gold floor) for matchmaking purposes only.
  const inPlacement = isUserInPlacement(user);
  const baseRank    = user.rankPoints || 0;
  const myRank      = (user.smurfFlagged && inPlacement) ? Math.max(baseRank, 2000) : baseRank;

  // Match ONLY other open RANKED RONDA rooms within the MMR window.
  const candidates = _openRoomsOfType('RONDA').filter(r => {
    if (!r.settings.ranked) return false;
    // REAL PLAYERS FIRST: any open ranked room that ALREADY holds a real human is
    // joinable regardless of MMR — two players online at the same time must
    // ALWAYS meet instead of each spawning a separate bot lobby. (The rank-delta
    // math keeps RP fair across a gap.) Empty / bot-only rooms still honour the
    // strict MMR window so a lone searcher doesn't anchor a wildly-off lobby.
    if (r.game.players.some(p => !p.isBot && usersDB.get(p.id))) return true;
    const anchor  = rankedRoomAnchor(r);
    const roomWin = rankedMmrWindow(r);
    if (Math.abs(myRank - anchor) > roomWin) return false;
    const enforceTightOnPlacement = inPlacement && user.smurfFlagged;
    if ((!inPlacement || enforceTightOnPlacement) && Math.abs(myRank - anchor) > RANKED_MMR_INITIAL && roomWin <= RANKED_MMR_INITIAL) {
      return false;
    }
    return true;
  });
  // Prefer the room with the MOST real humans, then the CLOSEST rank, so online
  // players cluster into the same match (and into the most rank-appropriate one).
  candidates.sort((a, b) => {
    const ha = a.game.players.filter(p => !p.isBot).length;
    const hb = b.game.players.filter(p => !p.isBot).length;
    if (hb !== ha) return hb - ha;
    return Math.abs(myRank - rankedRoomAnchor(a)) - Math.abs(myRank - rankedRoomAnchor(b));
  });

  let room    = candidates[0] || null;
  let created = false;

  if (!room) {
    room = createRoomRecord(user.id, { maxPlayers: 4, bet: 0, ranked: true }, 'RONDA');
    room.game = new RondaManager(room.id, room.settings);
    attachRondaListeners(room);
    roomsDB.set(room.id, room);
    created = true;
    console.log(`[RankedRonda] Spawned room ${room.id} for ${user.username} (rank ${myRank}${inPlacement ? ', placement' : ''})`);
  }

  if (!room.playerIds.includes(user.id)) {
    const result = room.game.addPlayer({
      id: user.id, username: user.username, avatar: user.avatar,
      cardBackId: user.equippedCardBack || 'cb_default',
      tableFelt: user.equippedTableFelt || 'tfp_green', isBot: false, isHost: created,
    });
    if (!result.success) throw new Error('addPlayer failed: ' + result.reason);
    room.playerIds.push(user.id);
  }

  scheduleRondaFill(room);   // existing RONDA bot-fill + auto-start (bet 0 → no pot)
  return { room, created };
}

// Arm (or re-use) the bot-fill timer. Fires once after RANKED_FILL_DELAY_MS;
// if the room is still in lobby with empty seats, fills with rank-scaled
// bots and auto-starts. If the room fills naturally / starts / dies first,
// the timer is a no-op. Idempotent — safe to call on every new join.
function scheduleRankedFill(room) {
  if (!room || room.roomType !== 'RANKED') return;
  if (room.rankedFillTimer) return;                          // already armed
  room.rankedFillTimer = setTimeout(() => {
    room.rankedFillTimer = null;
    const r = roomsDB.get(room.id);
    if (!r || r.status !== 'lobby') return;
    const seatsOpen = r.settings.maxPlayers - r.playerIds.length;
    if (seatsOpen <= 0) return;
    const anchor   = rankedRoomAnchor(r);
    const diff     = botDifficultyForRank(anchor);
    const _botBase = Math.floor(Math.random() * UNO_BOT_NAMES.length);
    for (let i = 0; i < seatsOpen; i++) {
      const bot = new Player('bot_' + Date.now() + '_' + i,
        UNO_BOT_NAMES[(_botBase + i) % UNO_BOT_NAMES.length],
        0);
      bot.isBot = true;
      bot.isConnected = true;
      bot.status = 'active';
      decorateBot(bot, diff);
      r.game.addPlayer(bot);
      r.playerIds.push(bot.id);
    }
    // Auto-start the match. Host is the first human seated (room.hostId).
    const result = r.game.startGame(r.hostId);
    if (!result.success) {
      console.error(`[Ranked] auto-start failed in ${r.id}: ${result.reason}`);
      return;
    }
    r.status    = 'playing';
    r.startedAt = Date.now();
    r.playerIds.forEach(pid => {
      const p  = r.game.players.find(pp => pp.id === pid);
      if (!p) return;
      const sk = findSocketByUserId(pid);
      if (sk) sk.emit('game:state', decorateRankedState(r, r.game._playerState(p)));
    });
    io.to(r.id).emit('ranked:auto_start', { reason: 'bot_fill', anchor: Math.round(anchor), botDifficulty: diff, botCount: seatsOpen });
    console.log(`[Ranked] auto-started ${r.id} — filled ${seatsOpen} ${diff} bot${seatsOpen>1?'s':''} (anchor ${Math.round(anchor)})`);
  }, RANKED_FILL_DELAY_MS);
}

// ── RANKED RONDA scoring ───────────────────────────────────────────────
// Width of the tier a given RP sits in (Grandmaster is open-ended → a wide
// nominal value). All RP swings are a % of this so every match fills a real
// slice of the bar and absolute points grow naturally toward Grandmaster.
function tierWidthFor(rankPoints){
  const lg = getLeague(rankPoints || 0);
  const width = (lg.name === 'Grandmaster') ? 3000 : ((lg.max + 1) - lg.min);
  return Math.max(300, width);
}

// Per-tier win/loss swing as a fraction of the tier bar. Designed so the climb
// is FAST at the bottom (new players feel instant progress), turns into real
// competition from Diamond, and Grandmaster is about *holding* your rank.
// `shield: true` tiers can never demote below their current tier floor.
// STUDIED RANK CURVE (rebalanced 2026-07-22). Each value is a fraction of the
// tier's RP width; the score margin slides between [min,max]. Design intent —
// verified by simulation (net RP / 100 games at each win-rate):
//   • Bronze→Gold: forgiving. Big wins, tiny losses, SHIELDED (can't drop below
//     the tier floor). New/weak players climb to their true rank fast and are
//     barely punished for early losses.
//   • Platinum: wins still beat losses, but the gap narrows; shielded.
//   • Diamond: symmetric — pure skill. ~50% win-rate ≈ hold; above it you climb.
//   • Master: net-negative at 50% — you must be clearly better than the field to
//     hold; losses bite harder than wins reward.
//   • Grandmaster: strong negative pressure — only a sustained >60% win-rate
//     defends the throne. Climbing gets harder and falling faster the higher you
//     go, exactly the "the top is earned every game" mentality.
// Losing NEVER drops a Bronze→Platinum player below their tier floor (shield);
// Diamond+ CAN be demoted. Score margin (41-40 nail-biter → 41-≤15 blow-out)
// scales both gains and losses, so HOW you win/lose matters, never random.
const RANK_PROGRESSION = {
  Bronze:      { win:[0.26, 0.40], loss:[0.02, 0.05], shield:true  },
  Silver:      { win:[0.20, 0.32], loss:[0.04, 0.08], shield:true  },
  Gold:        { win:[0.15, 0.25], loss:[0.07, 0.13], shield:true  },
  Platinum:    { win:[0.12, 0.20], loss:[0.10, 0.17], shield:true  },
  Diamond:     { win:[0.10, 0.16], loss:[0.10, 0.16], shield:false },
  Master:      { win:[0.08, 0.14], loss:[0.11, 0.17], shield:false },
  Grandmaster: { win:[0.06, 0.12], loss:[0.12, 0.19], shield:false },
};

// Win-streak momentum multiplier (applied to a winning swing).
function rankStreakBonus(streakAfterWin){
  if (streakAfterWin >= 8) return 0.30;
  if (streakAfterWin >= 5) return 0.20;
  if (streakAfterWin >= 3) return 0.10;
  if (streakAfterWin >= 2) return 0.05;
  return 0;
}

// RP delta (signed) for one player in a ranked RONDA match. The SCORE MARGIN
// (RONDA plays to 41) picks where inside the tier's win/loss range you land — a
// 41-40 nail-biter sits at the low end, a 41-≤15 blow-out at the high end —
// then the win-streak + MVP bonuses are layered on top of a WIN.
function rankedRondaTeamDelta({ won, tierName, tierWidth, loserScore, winStreak = 0, isMvp = false, targetScore = 41 }, _out){
  const cfg = RANK_PROGRESSION[tierName] || RANK_PROGRESSION.Bronze;
  // 0 at a 41-40 nail-biter → 1 once the loser is ≤ 15 (a blow-out).
  const marginNorm = Math.max(0, Math.min(1, (targetScore - Math.max(0, loserScore || 0)) / Math.max(1, targetScore - 15)));
  if (won){
    const winBase   = tierWidth * cfg.win[0];
    const marginAdd = tierWidth * (cfg.win[1] - cfg.win[0]) * marginNorm;
    const preStreak = winBase + marginAdd;
    const sb        = rankStreakBonus((winStreak || 0) + 1);
    const streakAdd = preStreak * sb;
    const preMvp    = preStreak * (1 + sb);
    const mvpAdd    = isMvp ? preMvp * 0.05 : 0;
    const total     = Math.max(1, Math.round(preMvp + mvpAdd));
    if (_out){
      _out.win    = Math.round(winBase);
      _out.margin = Math.round(marginAdd);
      _out.streak = Math.round(streakAdd);
      _out.mvp    = total - _out.win - _out.margin - _out.streak;   // remainder = MVP + rounding
    }
    return total;
  }
  const lossBase  = tierWidth * cfg.loss[0];
  const marginAdd = tierWidth * (cfg.loss[1] - cfg.loss[0]) * marginNorm;
  const total     = -Math.round((lossBase + marginAdd) * (isMvp ? 0.95 : 1));
  if (_out){
    _out.win    = -Math.round(lossBase);
    _out.margin = -Math.round(marginAdd);
    _out.streak = 0;
    _out.mvp    = total - _out.win - _out.margin;                   // remainder = MVP softening + rounding
  }
  return total;
}

// Rage-quit penalty for HUMANS who walk out of a live ranked match. This is a
// flat tax ON TOP of the normal loss delta (their team forfeits, so the loss is
// applied separately by applyRondaRankedResult). Crucially it BYPASSES the tier
// shield (floors at 0, not at the tier min) so quitting ALWAYS visibly stings —
// even a shielded Bronze player who'd otherwise lose 0 RP feels the tax.
//
// Applies whether the opponents were humans or bots: in ranked the player can't
// tell, and quitting must never be consequence-free (ranked integrity). The RP
// hit + ban escalate with repeat offenses (RANKED_ABANDON_LADDER).
function applyRankedAbandonPenalties(room){
  if (!room || !room.settings?.ranked) return;
  const humans = (room.game?.players || []).filter(p => !p.isBot && usersDB.get(p.id));
  humans.forEach(gp => {
    if (!gp.abandoned) return;
    const u = usersDB.get(gp.id);
    if (!u) return;
    ensureRankedFields(u);
    const tier = rankedAbandonTier(u);
    u.rankedAbandonCount  = (u.rankedAbandonCount || 0) + 1;
    u.rankedLastAbandonAt = Date.now();
    u.rankedBanUntil      = Date.now() + tier.banMs;
    u.elo                 = Math.max(0, (u.elo || 1000) - tier.elo);
    u.rankPoints          = Math.max(0, (u.rankPoints || 0) - tier.rank);   // bypasses the tier shield on purpose
    console.log(`[RankedRonda] ${u.username} rage-quit — -${tier.rank} RP, ban ${Math.round(tier.banMs/60000)}m (offense #${u.rankedAbandonCount})`);
    const sock = findSocketByUserId(u.id);
    if (sock) sock.emit('ranked:penalty', {
      elo:-tier.elo, rankPoints:-tier.rank, bannedUntil:u.rankedBanUntil,
      offenseCount:u.rankedAbandonCount, tier:Math.min(RANKED_ABANDON_LADDER.length, u.rankedAbandonCount), reason:'abandon',
    });
  });
}

// Apply rank-point changes for every HUMAN in a finished ranked RONDA match
// and return the per-player change list (for the win screen). Bots skipped.
function applyRondaRankedResult(room, d){
  const game = room.game;
  const changes = [];
  // Score margin (how decisive the match was) — shared by everyone in the match.
  const targetScore = room.game?.settings?.targetScore || 41;
  const fts         = Array.isArray(d.finalTeamScores) ? d.finalTeamScores : null;
  const loserTeam   = 1 - d.winnerTeam;
  const loserScore  = fts ? Math.max(0, fts[loserTeam] || 0) : Math.round(targetScore * 0.55);
  // MVP = the human who captured the most cards this match (gets a small bonus).
  let mvpId = null, mvpCap = -1;
  game.players.forEach(p => {
    if (!usersDB.get(p.id)) return;                 // humans only
    const c = (p.captured && p.captured.length) || 0;
    if (c > mvpCap){ mvpCap = c; mvpId = p.id; }
  });
  game.players.forEach(p => {
    const u = usersDB.get(p.id);
    if (!u) return;
    ensureRankedFields(u);
    const won        = (p.team === d.winnerTeam);
    const before     = u.rankPoints || 0;
    const beforeTier = getLeague(before);
    const tierWidth  = tierWidthFor(before);
    const _bd        = {};
    const rawDelta   = rankedRondaTeamDelta({
      won, tierName: beforeTier.name, tierWidth, loserScore,
      winStreak: u.winStreak || 0, isMvp: (p.id === mvpId), targetScore,
    }, _bd);
    let after = Math.max(0, before + rawDelta);
    // RANK PROTECTION — Bronze→Platinum can never fall below their tier floor.
    if (RANK_PROGRESSION[beforeTier.name]?.shield && rawDelta < 0){
      after = Math.max(after, beforeTier.min);
    }
    const delta = after - before;                   // the REAL change (after the shield)
    u.rankPoints = after;
    if (u.rankPoints > (u.peakRankPoints || 0)) u.peakRankPoints = u.rankPoints;
    u.placementGamesPlayed = Math.min(5, (u.placementGamesPlayed || 0) + 1);
    if (u.placementGamesPlayed >= 5 && !u.hasCompletedPlacement) u.hasCompletedPlacement = true;
    if (won){ u.rankedWins = (u.rankedWins || 0) + 1; u.winStreak = (u.winStreak || 0) + 1; }
    else    { u.rankedLosses = (u.rankedLosses || 0) + 1; u.winStreak = 0; }
    // Hidden MMR (elo) moves modestly — capped so the big visible RP swings
    // don't destabilise matchmaking.
    u.elo = Math.max(0, (u.elo || 1000) + Math.max(-40, Math.min(40, Math.round(delta * 0.08))));
    const newTier = getLeague(u.rankPoints);
    changes.push({
      playerId: p.id, before, oldRank: before, after: u.rankPoints, newRank: u.rankPoints,
      delta, won, isPlacement: false, placementGamesPlayed: u.placementGamesPlayed,
      rankedTier: newTier, mvp: (p.id === mvpId), winStreak: u.winStreak,
      streak: u.winStreak, breakdown: _bd, peakRank: u.peakRankPoints,
    });
    // Live update so the player's S.user (hub bar, streak pill) reflects the new
    // RP instantly, and the win-screen promotion/demotion banner can fire.
    const sock = findSocketByUserId(p.id);
    if (sock) sock.emit('ranked:rating_update', {
      delta, newRank: u.rankPoints, peakRank: u.peakRankPoints, isPlacement: false,
      placementGamesPlayed: u.placementGamesPlayed, rankedTier: newTier,
    });
    // Tier-crossing rewards (rank tables, card backs) — this was ONLY wired on
    // the UNO ranked path before, but real RANKED is RONDA, so tier cosmetics
    // never dropped live. Grant + celebrate here too.
    const granted = syncEarnedCosmetics(u);
    if (granted.length && sock) sock.emit('cosmetics:unlocked', { items: granted });
  });
  saveUsers();
  return changes;
}

// Records a prize/reward in the user's trophy log (latest 40 kept).
function logReward(user, icon, label, amount) {
  if (!user) return;
  if (!Array.isArray(user.rewards)) user.rewards = [];
  user.rewards.unshift({ icon, label, amount, at: Date.now() });
  if (user.rewards.length > 40) user.rewards.length = 40;
}

// ─────────────────────────────────────────
// APP SETUP
// ─────────────────────────────────────────

const app    = express();
const server = http.createServer(app);

// Socket.IO CORS — drives off the same allowlist as the HTTP server.
// The function form runs per-connection so origin gating stays dynamic
// (no need to restart the server when the env var changes between
// staging / prod deploys).
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => cb(null, isCorsOriginAllowed(origin)),
    methods: ['GET', 'POST'],
    credentials: false,
  },
  pingTimeout:  10000,
  pingInterval: 5000,
  allowEIO3: true,
  // Cap per-message size. The largest legitimate payload is a WebRTC SDP
  // offer for voice (~10KB) or a chat line (200 chars); everything else is
  // tiny. 100KB is comfortably above that but 10× below the 1MB default, so
  // a tampered client can't flood the server with huge frames.
  maxHttpBufferSize: 1e5,
});

// Don't advertise that we're an Express server — Express/X-Powered-By
// hands an attacker version-specific fingerprinting for free.
app.disable('x-powered-by');

// Honour reverse-proxy headers so rate limiting / HSTS / IP-based
// throttling see the REAL client IP, not the proxy's. Required when
// fronted by Render / Heroku / nginx / Cloudflare.
app.set('trust proxy', 1);

// gzip/deflate every compressible response (HTML/JS/CSS/JSON) — cuts the
// shell download + API payloads ~70% so many concurrent players cost far
// less bandwidth + connection time. Registered FIRST so it wraps every
// route below (index shell included). Guarded so a missing module can
// never stop the server from booting.
try { app.use(require('compression')({ threshold: 1024 })); }
catch (e) { console.log('[Perf] compression middleware unavailable — skipping'); }

// HTTP CORS — same allowlist as Socket.IO. The function form rejects
// requests from unknown origins with a 403 instead of silently echoing
// '*' back, which is what `app.use(cors())` (the old call) used to do.
app.use(cors({
  origin: (origin, cb) => {
    if (isCorsOriginAllowed(origin)) return cb(null, origin || true);
    return cb(new Error('Not allowed by CORS'), false);
  },
  credentials: false,
}));
// JSON body limit — kept at 5mb for avatar uploads, but per-route
// stricter caps are applied where appropriate (chat messages, etc).
// Tight body cap: every legit API payload is tiny (creds, a bet, a packageId,
// a preset-avatar PATH — never an uploaded image). 256kb leaves a huge margin
// over the largest real call while denying a 5mb JSON-parse DoS on any route.
app.use(express.json({ limit: '256kb' }));

// ─────────────────────────────────────────
// PER-IP HTTP RATE LIMIT — global /api/ guard
// ─────────────────────────────────────────
// Caps total API requests per client IP over a rolling minute. Generous on
// purpose: normal use (5s lobby polling across a few endpoints, even with
// 2-3 tabs) stays well under it; it only trips on hammering / scripted abuse.
// `trust proxy` is set above, so req.ip is the REAL client IP through the
// tunnel — each player is limited separately, not all behind one tunnel IP.
const _httpHits        = new Map();   // ip -> { count, windowStart }
const HTTP_RATE_MAX    = 600;         // requests / window / IP
const HTTP_RATE_WINDOW = 60_000;      // 1 minute
setInterval(() => {
  const cutoff = Date.now() - HTTP_RATE_WINDOW;
  for (const [ip, e] of _httpHits) if (e.windowStart < cutoff) _httpHits.delete(ip);
}, HTTP_RATE_WINDOW);
app.use('/api/', (req, res, next) => {
  const ip = req.ip || 'unknown';
  // Never throttle the server itself / local dev.
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
  const now = Date.now();
  let e = _httpHits.get(ip);
  if (!e || now - e.windowStart >= HTTP_RATE_WINDOW) { e = { count: 0, windowStart: now }; _httpHits.set(ip, e); }
  if (++e.count > HTTP_RATE_MAX) {
    res.setHeader('Retry-After', Math.ceil((e.windowStart + HTTP_RATE_WINDOW - now) / 1000));
    return res.status(429).json({ error: 'Too many requests — please slow down.' });
  }
  next();
});

// ─────────────────────────────────────────
// SECURITY HEADERS — production-ready defaults
// ─────────────────────────────────────────
//
// Rolled manually (vs Helmet) to avoid adding a dependency. Headers
// chosen to harden against:
//   • Clickjacking (X-Frame-Options, frame-ancestors)
//   • MIME-type sniffing (X-Content-Type-Options)
//   • Cross-site referrer leaks (Referrer-Policy)
//   • XSS via inline injection (Content-Security-Policy)
//   • Mixed content / downgrade attacks (Strict-Transport-Security)
//   • Camera/mic abuse from embedded contexts (Permissions-Policy)
//
// CSP intentionally allows 'unsafe-inline' for scripts + styles because
// the client uses inline event handlers (onclick attributes) — a full
// nonce-based CSP would require refactoring every onclick to an event
// listener. Future work: tighten to script-src 'self' + nonces.
app.use((req, res, next) => {
  // Clickjacking — refuse to be framed by any other origin.
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Defense against MIME-sniff-driven XSS.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Don't leak the full URL to outbound links (e.g. Instagram promo).
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Lock down powerful APIs unless we explicitly need them.
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(self), geolocation=(), payment=(), interest-cohort=()');
  // HSTS only meaningful over HTTPS — emit when the request arrived
  // encrypted (handles ngrok / proxy-terminated TLS via x-forwarded-proto).
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim();
  if (proto === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // CSP — apply only to HTML so static assets (CSS/JS/img/manifest) aren't
  // double-policed. Frame-ancestors enforces the same protection as
  // X-Frame-Options across modern browsers.
  if (req.method === 'GET' && (
        req.path === '/' || req.path.endsWith('.html') || req.path === '/index.html')) {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      // GSAP + WebAudio etc are pulled from cdnjs in 15-cinematic.js
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
      // Fonts.googleapis is referenced for the Bangers / Outfit typefaces
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      // WebSocket — same-origin or any ws/wss for the socket connection
      "connect-src 'self' ws: wss: https:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '));
  }
  next();
});

// Serve client files
const path = require('path');
const fs = require('fs');
const _indexPath = path.join(__dirname, '../client/index.html');
let _indexHtmlCache = null;

// Dynamically render index.html so Open Graph meta tags (og:image, og:url)
// resolve against whatever host the request came in on — works for
// localhost, ngrok, and any future deploy without code changes.
app.get(['/', '/index.html'], (req, res, next) => {
  try {
    if (!_indexHtmlCache || process.env.NODE_ENV !== 'production') {
      _indexHtmlCache = fs.readFileSync(_indexPath, 'utf8');
    }
    const rawProto = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim();
    const rawHost  = String(req.headers['x-forwarded-host']  || req.headers.host || '').split(',')[0].trim();
    // Sanitize before reflecting into the OG/Twitter <meta> tags: only a valid
    // host:port is allowed. Blocks Host-header injection (reflected markup /
    // cache poisoning). Anything malformed falls back to a relative base.
    const proto = rawProto === 'https' ? 'https' : 'http';
    const host  = /^[a-zA-Z0-9.\-:]{1,253}$/.test(rawHost) ? rawHost : '';
    const base  = host ? `${proto}://${host}` : '';
    const out = _indexHtmlCache.replace(/__OG_BASE__/g, base);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache');
    res.send(out);
  } catch (e) {
    next();
  }
});

app.use(express.static(path.join(__dirname, '../client'), {
  setHeaders(res, filePath) {
    // Service worker and manifest must always revalidate so updates roll out
    if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (/\.(png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(filePath)) {
      // Artwork (ranks, banners, cards, tables, avatars) never changes without
      // a new filename — let browsers keep it a week instead of re-asking on
      // every load. Massive request-count cut with many players online.
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
    // Bypass ngrok's "Visit Site" warning page so link previews work
    res.setHeader('ngrok-skip-browser-warning', 'true');
  },
}));

// Ops heartbeat — watch this while scaling (uptime, memory, event-loop lag,
// live socket + room counts). No auth (it leaks nothing personal) so an
// uptime monitor / load balancer can poll it cheaply.
let _elLagMs = 0;
{ let last = Date.now();
  setInterval(() => { const now = Date.now(); _elLagMs = Math.max(0, now - last - 1000); last = now; }, 1000).unref?.(); }
app.get('/api/health', (req, res) => {
  res.json({
    ok:        true,
    uptimeSec: Math.round(process.uptime()),
    rssMb:     Math.round(process.memoryUsage().rss / 1048576),
    loopLagMs: _elLagMs,
    sockets:   socketToUser ? socketToUser.size : 0,
    rooms:     roomsDB.size,
    mongo:     !!(typeof mongoose !== 'undefined' && mongoose.connection?.readyState),
  });
});

// ── ICE config for voice chat ─────────────────────────────────────────────
// The client fetches this on voice connect. STUN covers most home networks;
// set TURN_URL / TURN_USER / TURN_PASS in .env on the production server and
// mobile-carrier NAT users get relayed too — no code change needed at deploy.
// Auth-gated so the TURN credentials aren't world-readable.
app.get('/api/voice/ice', authMiddleware, (req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
  if (process.env.TURN_URL && process.env.TURN_USER && process.env.TURN_PASS) {
    iceServers.push({ urls: process.env.TURN_URL, username: process.env.TURN_USER, credential: process.env.TURN_PASS });
  }
  res.json({ iceServers });
});

// ── Public legal pages (App Store + Play Store require live URLs) ─────────
const _legalPage = (title, body) => `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Cardora</title>
<style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0d0a1a;color:#e5e1f0;max-width:760px;margin:0 auto;padding:40px 22px;line-height:1.7}
h1{color:#FBBF24;font-size:26px}h2{color:#C4B5FD;font-size:18px;margin-top:28px}a{color:#7ee787}
.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:18px 22px;margin:14px 0}
footer{margin-top:36px;font-size:12px;color:#8b86a0}</style></head><body>
<h1>🎴 Cardora — ${title}</h1>${body}
<footer>Cardora · <a href="/privacy">Privacy Policy</a> · <a href="/support">Support</a></footer></body></html>`;

app.get('/privacy', (req, res) => {
  res.type('html').send(_legalPage('Privacy Policy', `
<p><i>Last updated: July 2026</i></p>
<div class="card"><h2>What we collect</h2>
<p>• A username you choose (required) and an email address (optional, for account recovery).<br>
• Gameplay data: match results, rank points, virtual coins, cosmetic items, friends list.<br>
• Basic technical data needed to run the service (connection/session information).</p></div>
<div class="card"><h2>What we DON'T do</h2>
<p>• We never sell your data or share it with advertisers.<br>
• Voice chat is transmitted peer-to-peer between players in your table and is <b>never recorded or stored</b>.<br>
• Coins and diamonds are virtual play currency only — they have no cash value and can never be exchanged for real money.</p></div>
<div class="card"><h2>Permissions</h2>
<p>• <b>Microphone</b> — used only when you tap "Tap to Talk" for in-game voice chat with your table. Never accessed outside a match.</p></div>
<div class="card"><h2>Your rights</h2>
<p>• You can delete your account at any time from <b>Settings → Delete Account</b> inside the app. This permanently erases your profile, stats, coins and friends list from our servers.<br>
• For any data request, contact us at the address below.</p></div>
<div class="card"><h2>Contact</h2><p>Email: <a href="mailto:dedjiremix@gmail.com">dedjiremix@gmail.com</a></p></div>`));
});

app.get('/support', (req, res) => {
  res.type('html').send(_legalPage('Support', `
<div class="card"><h2>Need help?</h2>
<p>Questions, bug reports, account issues — email us and we'll get back to you:</p>
<p style="font-size:19px">📧 <a href="mailto:dedjiremix@gmail.com">dedjiremix@gmail.com</a></p></div>
<div class="card"><h2>Delete your account</h2>
<p>Open the app → Settings (⚙️) → <b>Delete Account</b>. Deletion is immediate and permanent.</p></div>`));
});

// ─────────────────────────────────────────
// RATE LIMITING — defense layer for abusive traffic
// ─────────────────────────────────────────
//
// Token-bucket-ish in-memory rate limiter. Keyed by arbitrary string (IP,
// userId, socket.id+event), records the timestamps of the last N hits in
// a fixed window. Cheap (single Map lookup + array slice) and good
// enough for everything short of distributed scale. When we move to
// multi-process, swap the backing store for Redis without changing the
// call sites.
const _rateBuckets = new Map();
// Periodic GC so the map doesn't grow forever from one-shot keys (login
// attempts from random IPs etc). Runs every 5 minutes; keys idle for
// > 30 minutes get evicted.
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, hits] of _rateBuckets) {
    if (!hits.length || hits[hits.length - 1] < cutoff) _rateBuckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

// Returns true when the caller is UNDER the limit (and records the hit),
// false when they've exceeded it. `windowMs` is the trailing window;
// `limit` is the max number of hits in that window. Memory cost per key
// is roughly `limit * 8 bytes`.
function rateCheck(key, limit, windowMs) {
  const now = Date.now();
  const hits = _rateBuckets.get(key) || [];
  // Drop expired hits.
  while (hits.length && now - hits[0] > windowMs) hits.shift();
  if (hits.length >= limit) {
    _rateBuckets.set(key, hits);
    return false;
  }
  hits.push(now);
  _rateBuckets.set(key, hits);
  return true;
}

// Inspect the time until the next allowed hit, in ms. Useful when we want
// to surface Retry-After to the client without admitting them a hit.
function rateRetryMs(key, limit, windowMs) {
  const now = Date.now();
  const hits = _rateBuckets.get(key) || [];
  while (hits.length && now - hits[0] > windowMs) hits.shift();
  if (hits.length < limit) return 0;
  return windowMs - (now - hits[0]);
}

// ─────────────────────────────────────────
// TOTP — RFC 6238 (compatible with Google Authenticator, Authy, 1Password)
// ─────────────────────────────────────────
//
// Implemented from scratch on top of Node's built-in crypto so we don't
// add a runtime dependency just for 2FA. Two public helpers:
//
//   generateTotpSecret()  → returns a fresh base32-encoded secret
//                           suitable for storing on a user record.
//   verifyTotpCode(s, c)  → returns true if `c` matches the current
//                           30-second window for secret `s` (with a
//                           one-step grace window on either side to
//                           absorb clock skew). Constant-time compare.
//   totpProvisioningUri(secret, label, issuer)
//                         → otpauth:// URI you hand to the user's
//                           authenticator app via QR code or copy.
const _crypto = require('crypto');
const _B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function _b32encode(buf){
  let bits = 0, value = 0, out = '';
  for (const b of buf){
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5){
      out += _B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += _B32[(value << (5 - bits)) & 31];
  return out;
}
function _b32decode(str){
  const clean = String(str).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const c of clean){
    const v = _B32.indexOf(c);
    if (v < 0) throw new Error('Invalid base32 character');
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8){
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function generateTotpSecret(bytes = 20){
  // 20 bytes (160 bits) is the RFC 4226 recommendation for HOTP/TOTP.
  return _b32encode(_crypto.randomBytes(bytes));
}
function _totpAtCounter(secret, counter){
  const key = _b32decode(secret);
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter.
  for (let i = 7; i >= 0; i--){
    buf[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hmac = _crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset]     & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) <<  8) |
    ( hmac[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, '0');
}
function verifyTotpCode(secret, code, window = 1){
  if (!secret || typeof code !== 'string' || !/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(Date.now() / 30_000);
  for (let w = -window; w <= window; w++){
    const expected = _totpAtCounter(secret, counter + w);
    const a = Buffer.from(expected);
    const b = Buffer.from(code);
    if (a.length === b.length && _crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}
function totpProvisioningUri(secret, label, issuer){
  const params = new URLSearchParams({
    secret,
    issuer:    issuer || 'AtlasArena',
    algorithm: 'SHA1',
    digits:    '6',
    period:    '30',
  });
  return `otpauth://totp/${encodeURIComponent(issuer || 'AtlasArena')}:${encodeURIComponent(label || 'admin')}?${params.toString()}`;
}
// Generate 10 single-use backup codes (8 chars each, base32 charset).
// Stored on the user record as bcrypt hashes so the plaintext never
// touches disk; we show them ONCE at setup and never again.
function generateBackupCodes(n = 10){
  return Array.from({ length: n }, () => {
    const buf = _crypto.randomBytes(5);   // 5 bytes = 8 base32 chars
    return _b32encode(buf).slice(0, 8);
  });
}

// Generate a real, valid bcrypt hash of a throw-away password at boot.
// Used by the login flow's timing-equaliser: when the supplied username
// doesn't exist we still bcrypt-compare against THIS hash so the
// response time matches a successful lookup → no user-enumeration via
// timing side channel.
//
// The old code used a hard-coded 58-char string (`$2b$10$abc...`) which
// is malformed (real bcrypt hashes are 60 chars). bcrypt.compare()
// threw immediately, the .catch() swallowed the throw, and the timing
// "protection" provided zero protection. Generated at the real cost
// factor so the timing actually matches.
const TIMING_DUMMY_HASH = bcrypt.hashSync('timing_equaliser_padding_string', CONFIG.SALT_ROUNDS);

// Express middleware factory. `keyFn(req)` defaults to IP; override for
// per-user limits. Sets a Retry-After header and replies 429 on overflow.
function rateLimit({ limit, windowMs, keyFn, label = 'rl' }) {
  return (req, res, next) => {
    const k = `${label}:${(keyFn || (r => r.ip))(req)}`;
    if (!rateCheck(k, limit, windowMs)) {
      const retry = rateRetryMs(k, limit, windowMs);
      res.setHeader('Retry-After', Math.ceil(retry / 1000));
      return res.status(429).json({
        error: 'Too many requests — slow down',
        retryAfter: Math.ceil(retry / 1000),
      });
    }
    next();
  };
}

// ─────────────────────────────────────────
// CURRENCY SANITY — hard caps + safe coercion
// ─────────────────────────────────────────
//
// Defends against integer overflow, NaN/Infinity injection, and absurd
// values from a tampered client. Used at every bet-set + payout site.
// Cap is set well below Number.MAX_SAFE_INTEGER (9.007e15) — at 1 billion
// coins per single bet, a legitimate player never hits it.
const MAX_BET_AMOUNT = 1_000_000_000;    // 1 billion — hard ceiling per bet
const MAX_POT_AMOUNT = 4_000_000_000;    // 4 billion — sum-of-bets ceiling

// Coerce arbitrary input to a non-negative safe integer, clamped to the
// supplied max. Returns 0 for NaN, Infinity, negatives, or non-numeric.
// All currency math should pipe through this function.
function safeInt(v, max = Number.MAX_SAFE_INTEGER) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

// Read a user's coin balance and ensure it's a safe non-negative integer.
// Repairs corruption in-place (e.g. coins set to a string by a buggy
// migration) so the next save persists a valid value.
function safeCoins(user) {
  const n = safeInt(user.coins, Number.MAX_SAFE_INTEGER);
  if (user.coins !== n) user.coins = n;
  return n;
}

// Account-lockout for repeated login failures. Tracks per-username
// failure count + window; locks the account for `LOCKOUT_MS` once the
// threshold hits. Successful logins clear the counter.
const _loginFailures = new Map(); // username.toLowerCase() -> {count, firstAt, lockedUntil}
const LOGIN_FAIL_THRESHOLD = 8;
const LOGIN_FAIL_WINDOW_MS = 10 * 60 * 1000;  // 10 min
const LOGIN_LOCKOUT_MS     = 15 * 60 * 1000;  // 15 min
function noteLoginFailure(username) {
  const key = String(username || '').toLowerCase();
  if (!key) return;
  const now = Date.now();
  const e = _loginFailures.get(key) || { count: 0, firstAt: now, lockedUntil: 0 };
  if (now - e.firstAt > LOGIN_FAIL_WINDOW_MS) { e.count = 0; e.firstAt = now; }
  e.count++;
  if (e.count >= LOGIN_FAIL_THRESHOLD) {
    e.lockedUntil = now + LOGIN_LOCKOUT_MS;
    console.warn(`[Auth] Account locked for ${LOGIN_LOCKOUT_MS / 60000}min: ${key}`);
  }
  _loginFailures.set(key, e);
}
function clearLoginFailures(username) {
  _loginFailures.delete(String(username || '').toLowerCase());
}
function loginLockoutMs(username) {
  const e = _loginFailures.get(String(username || '').toLowerCase());
  if (!e || !e.lockedUntil) return 0;
  const left = e.lockedUntil - Date.now();
  return left > 0 ? left : 0;
}

/* ── Unified request-body validation ──────────────────────────────────
 * Tiny, dependency-free, zod-style schema validator used as middleware:
 *   validateBody({ id:{ type:'string', required:true, max:64 } })
 * It rejects malformed / oversized / out-of-range input with one consistent
 * 400 BEFORE the handler ever runs — a single guard shared across the API.
 * Supported rule keys: type ('string'|'int'|'number'|'bool'), required,
 * min, max, enum, pattern, trim. */
function validateBody(schema){
  return (req, res, next) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    for (const field in schema){
      const rule = schema[field];
      let v = body[field];
      if (v === undefined || v === null || v === ''){
        if (rule.required) return res.status(400).json({ error: `Missing required field: ${field}` });
        continue;
      }
      if (rule.type === 'string'){
        if (typeof v !== 'string') return res.status(400).json({ error: `${field} must be text` });
        if (rule.trim) v = v.trim();
        if (rule.min != null && v.length < rule.min) return res.status(400).json({ error: `${field} is too short` });
        if (rule.max != null && v.length > rule.max) return res.status(400).json({ error: `${field} is too long` });
        if (rule.enum && !rule.enum.includes(v)) return res.status(400).json({ error: `${field} is not allowed` });
        if (rule.pattern && !rule.pattern.test(v)) return res.status(400).json({ error: `${field} has invalid characters` });
      } else if (rule.type === 'int' || rule.type === 'number'){
        const n = Number(v);
        if (!Number.isFinite(n)) return res.status(400).json({ error: `${field} must be a number` });
        if (rule.type === 'int' && !Number.isInteger(n)) return res.status(400).json({ error: `${field} must be a whole number` });
        if (rule.min != null && n < rule.min) return res.status(400).json({ error: `${field} is too small` });
        if (rule.max != null && n > rule.max) return res.status(400).json({ error: `${field} is too large` });
      } else if (rule.type === 'bool'){
        if (typeof v !== 'boolean') return res.status(400).json({ error: `${field} must be true or false` });
      }
    }
    next();
  };
}

// Prune stale login-failure entries every 10 min so the map can't grow
// unbounded from random-username brute-force spam (memory hygiene).
const _loginFailPrune = setInterval(() => {
  const now = Date.now();
  for (const [k, e] of _loginFailures) {
    if ((now - e.firstAt > LOGIN_FAIL_WINDOW_MS) && (!e.lockedUntil || e.lockedUntil < now)) {
      _loginFailures.delete(k);
    }
  }
}, 10 * 60 * 1000);
if (_loginFailPrune.unref) _loginFailPrune.unref();

// ─────────────────────────────────────────
// JWT AUTH
// ─────────────────────────────────────────

// Pin the signing algorithm everywhere — never accept `alg:none` or let an
// attacker swap to a different algorithm (HS/RS confusion). All tokens are
// HS256 (see JWT_SIGN_OPTS), so verification must only ever accept HS256.
const JWT_VERIFY_OPTS = { algorithms: ['HS256'] };
const JWT_SIGN_OPTS   = { algorithm: 'HS256', expiresIn: CONFIG.JWT_EXPIRES_IN };

// Reject a token whose session-version no longer matches the account's — this
// is how a revoked/stolen token stops working the instant tokenVersion is
// bumped (password change / "log out everywhere"). Missing `tv` (pre-feature
// tokens) is treated as 0 so the rollout doesn't force-logout everyone.
function tokenSessionValid(decoded) {
  if (!decoded || !decoded.userId) return false;
  const u = usersDB.get(decoded.userId);
  if (!u) return false;
  return (decoded.tv || 0) === (u.tokenVersion || 0);
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], CONFIG.JWT_SECRET, JWT_VERIFY_OPTS);
    if (!tokenSessionValid(decoded)) return res.status(401).json({ error: 'Session expired — please log in again', code: 'session_revoked' });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function verifySocketToken(token) {
  try { return jwt.verify(token, CONFIG.JWT_SECRET, JWT_VERIFY_OPTS); }
  catch { return null; }
}

// ─────────────────────────────────────────
// REST: Auth
// ─────────────────────────────────────────

// Registration is rate-limited by IP: 5 new accounts per 30 minutes.
// This blocks easy mass-account scripting without inconveniencing real
// users (5 sign-ups from one household / corporate NAT is plenty).
app.post('/api/auth/register',
  rateLimit({ limit: 5, windowMs: 30 * 60 * 1000, label: 'reg' }),
  validateBody({ username:{ type:'string', required:true, min:3, max:20 }, password:{ type:'string', required:true, min:6, max:128 }, email:{ type:'string', max:254 } }),
  async (req, res) => {
  const { username, password, email } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username must be 3-20 characters' });
  // Username charset — letters, digits, underscore, dash. Stops:
  //   • impersonation via lookalike characters (Cyrillic 'а' vs Latin 'a')
  //   • HTML / JS injection via < > / quote characters
  //   • shell / SQL injection chars sliding into log lines or queries
  //   • whitespace tricks that make two visually identical names compare unequal
  if (!/^[A-Za-z0-9_-]+$/.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, _ and -' });
  }
  // Reserved names: stop trivial impersonation of "system" / "admin"
  // accounts and bot prefixes we use internally.
  const reserved = ['admin', 'administrator', 'system', 'mod', 'moderator', 'support', 'owner', 'staff', 'bot', 'guest'];
  if (reserved.some(r => username.toLowerCase() === r) || /^t?bot[_-]/i.test(username)) {
    return res.status(400).json({ error: 'That username is reserved' });
  }
  if (password.length < 6 || password.length > 128) return res.status(400).json({ error: 'Password must be 6-128 characters' });

  const exists = [...usersDB.values()].find(u => u.username && u.username.toLowerCase() === username.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Username already taken' });

  // Email is optional, but if given it must be valid and unused — it's the
  // recovery key for "forgot password".
  let cleanEmail = null;
  if (email && String(email).trim()) {
    cleanEmail = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Invalid email address' });
    const emailTaken = [...usersDB.values()].find(u => u.email && u.email === cleanEmail);
    if (emailTaken) return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, CONFIG.SALT_ROUNDS);
  const user = createUserRecord({ username, passwordHash, email: cleanEmail });
  usersDB.set(user.id, user);
  saveUsers(); // ← FIX: save after registration

  const token = jwt.sign({ userId: user.id, username: user.username, tv: user.tokenVersion || 0 }, CONFIG.JWT_SECRET, JWT_SIGN_OPTS);
  console.log(`[Auth] Registered: ${username}${cleanEmail ? ' (' + cleanEmail + ')' : ''}`);
  res.status(201).json({ token, user: sanitizeUser(user) });
});

// Guest login — instant throwaway account, no credentials needed. Rate-limited
// per IP so one network can't mass-spawn guests to farm coins / stuff queues.
app.post('/api/auth/guest',
  rateLimit({ limit: 10, windowMs: 60 * 60 * 1000, label: 'guest' }),
  async (req, res) => {
  let username, tries = 0;
  do {
    username = 'Guest' + Math.floor(1000 + Math.random() * 9000);
    tries++;
  } while ([...usersDB.values()].some(u => u.username && u.username.toLowerCase() === username.toLowerCase()) && tries < 60);

  const passwordHash = await bcrypt.hash(uuidv4(), CONFIG.SALT_ROUNDS);
  const user = createUserRecord({ username, passwordHash, isGuest: true });
  usersDB.set(user.id, user);
  saveUsers();

  const token = jwt.sign({ userId: user.id, username: user.username, tv: user.tokenVersion || 0 }, CONFIG.JWT_SECRET, JWT_SIGN_OPTS);
  console.log(`[Auth] Guest created: ${username}`);
  res.status(201).json({ token, user: sanitizeUser(user) });
});

// Login: rate-limited by IP (20 attempts / 5 min) AND by account
// (LOGIN_FAIL_THRESHOLD failures → temp lock). Two layers so neither a
// per-IP scanner nor a per-username scanner gets through.
app.post('/api/auth/login',
  rateLimit({ limit: 20, windowMs: 5 * 60 * 1000, label: 'login_ip' }),
  validateBody({ username:{ type:'string', required:true, max:64 }, password:{ type:'string', required:true, max:128 } }),
  async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  // Account-level lockout check (cheap — single Map lookup).
  const lockMs = loginLockoutMs(username);
  if (lockMs > 0) {
    res.setHeader('Retry-After', Math.ceil(lockMs / 1000));
    return res.status(429).json({
      error: `Account temporarily locked — try again in ${Math.ceil(lockMs / 60000)} min`,
      retryAfter: Math.ceil(lockMs / 1000),
    });
  }

  const user = [...usersDB.values()].find(u => u.username && u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    // Record the failure under the supplied username so attackers can't
    // bypass the lockout by typo'ing usernames. Bcrypt-compare against
    // a REAL hash (generated at boot, matches the live cost factor) so
    // the response timing for "unknown user" matches "wrong password".
    // Prevents user enumeration via response-time side channel.
    await bcrypt.compare(password, TIMING_DUMMY_HASH).catch(()=>{});
    noteLoginFailure(username);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    noteLoginFailure(username);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  clearLoginFailures(username);

  // ── 2FA gate ──
  // If this account has TOTP enabled, the second factor is required to
  // complete login. Two paths:
  //   • Client sent `code` in the body alongside username/password —
  //     verify and continue.
  //   • Client sent `backupCode` — consume one backup code and continue.
  //   • Neither — respond 200 with { twoFactorRequired:true } and DON'T
  //     issue a token. Client prompts for code, then re-submits this
  //     endpoint with username+password+code.
  let twoFactorCleared = false;
  if (user.twoFactorEnabled && user.twoFactorSecret){
    const { code, backupCode } = req.body || {};
    if (code && verifyTotpCode(user.twoFactorSecret, String(code))){
      twoFactorCleared = true;
    } else if (backupCode){
      // Constant-time check across each remaining backup-code bcrypt hash.
      const codes = Array.isArray(user.twoFactorBackupCodes) ? user.twoFactorBackupCodes : [];
      let matchIdx = -1;
      for (let i = 0; i < codes.length; i++){
        if (await bcrypt.compare(String(backupCode), codes[i])) { matchIdx = i; break; }
      }
      if (matchIdx >= 0){
        // Single-use — consume by splicing the hash out.
        codes.splice(matchIdx, 1);
        user.twoFactorBackupCodes = codes;
        saveUsers();
        twoFactorCleared = true;
      }
    }
    if (!twoFactorCleared){
      return res.json({ twoFactorRequired: true, hasBackupCodes: (user.twoFactorBackupCodes || []).length > 0 });
    }
  }

  // NOTE: there is deliberately NO automatic "coins just for logging in" grant
  // anymore. Handing coins out on every fresh login let players farm them by
  // leaving and re-entering (and by spinning up throwaway accounts). Daily coins
  // now come ONLY from the explicit, server-gated Daily Rewards calendar
  // (/api/rewards/daily/claim) — one claim per calendar day, no exceptions.
  const now = Date.now();
  // One-time migration: give old players 1000 bonus
  if (!user.migrationBonus) {
    user.coins += 1000;
    user.migrationBonus = true;
    console.log(`[Auth] Migration bonus: +1000 for ${username}`);
  }
  // One-time +1,000,000 grant for Mustapha1 & Mustapha2
  if (['mustapha1', 'mustapha2'].includes(username.toLowerCase()) && !user.grant_million_may2026) {
    user.coins = (user.coins || 0) + 1000000;
    user.grant_million_may2026 = true;
    console.log(`[Grant] +1,000,000 coins to ${user.username} (total: ${user.coins})`);
  }
  user.lastLoginAt = now;
  // New-device / new-network sign-in detection — a classic account-theft
  // signal. Keep a small ring of recently-seen IPs; the first time a brand-new
  // one appears (for an account that already had history) we flag it so the
  // client can warn ("New login from a new device — secure your account").
  const loginIp  = req.ip || 'unknown';
  const knownIps = Array.isArray(user.knownIps) ? user.knownIps : [];
  const isNewDevice = knownIps.length > 0 && !knownIps.includes(loginIp);
  if (!knownIps.includes(loginIp)) user.knownIps = [loginIp, ...knownIps].slice(0, 5);
  user.lastIp = loginIp;
  if (isNewDevice) console.warn(`[Auth] New-device login: ${user.username} from ${loginIp}`);
  saveUsers();

  // Embed 2FA proof in the JWT — isAdminRequest() reads this claim to
  // gate admin endpoints. Falsy for accounts without 2FA enabled.
  const claims = { userId: user.id, username: user.username, tv: user.tokenVersion || 0 };
  if (twoFactorCleared) claims.adm2fa = true;
  const token = jwt.sign(claims, CONFIG.JWT_SECRET, JWT_SIGN_OPTS);
  console.log(`[Auth] Login: ${username}${twoFactorCleared ? ' (+2FA)' : ''}`);
  res.json({ token, user: sanitizeUser(user), newDevice: isNewDevice });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: sanitizeUser(user) });
});

// ─────────────────────────────────────────
// REST: Coins
// ─────────────────────────────────────────

app.get('/api/coins', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ coins: user.coins });
});

app.post('/api/coins/claim-daily', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const now = Date.now(), oneDay = 86400000, lastClaim = user.lastDailyClaimAt || 0;
  if (now - lastClaim < oneDay) return res.status(429).json({ error: 'Daily reward already claimed', nextClaimAt: lastClaim + oneDay });

  const reward = 100;
  user.coins += reward;
  user.lastDailyClaimAt = now;
  logReward(user, '🎁', 'Daily Reward', reward);
  saveUsers(); // ← FIX: save after claiming
  res.json({ coins: user.coins, earned: reward });
});

/* ════════════════════════════════════════════════════════════════
   DAILY REWARDS CALENDAR  — 7-day escalating login streak
   ----------------------------------------------------------------
   Anti-abuse design: the ONLY way to earn the daily coins is to press
   CLAIM, and a claim is allowed at most once per UTC calendar day. We
   key the gate on the day number (floor(now/DAY)), not on a sliding
   timer the client could nudge — so leaving/re-entering the game, or
   relogging, grants nothing. Miss a day and the streak resets to Day 1.
   ════════════════════════════════════════════════════════════════ */
const DAY_MS = 86400000;
// "Pack" days in the mockup are paid out as diamonds (a real currency),
// the Day-7 "chest" is the big coins+diamonds payout.
const DAILY_CALENDAR = [
  { day: 1, coins: 100,  diamonds: 0,  kind: 'coins' },
  { day: 2, coins: 200,  diamonds: 0,  kind: 'coins' },
  { day: 3, coins: 300,  diamonds: 0,  kind: 'coins' },
  { day: 4, coins: 0,    diamonds: 10, kind: 'pack'  },
  { day: 5, coins: 500,  diamonds: 0,  kind: 'coins' },
  { day: 6, coins: 0,    diamonds: 15, kind: 'pack'  },
  { day: 7, coins: 1000, diamonds: 25, kind: 'chest' },
];

function epochDay(ts){ return Math.floor(ts / DAY_MS); }

// Normalise + return the calendar state for a user without mutating streak.
function dailyCalState(user){
  const today = epochDay(Date.now());
  const dc = (user.dailyCal && typeof user.dailyCal === 'object')
    ? user.dailyCal
    : { lastDay: 0, lastClaimDay: -1, streak: 0 };
  const claimedToday = dc.lastClaimDay === today;
  let currentDay, streak;
  if (claimedToday){
    currentDay = dc.lastDay || 1;       // the day they just claimed
    streak     = dc.streak || 1;
  } else if (dc.lastClaimDay === today - 1){
    // Consecutive day → advance (wrapping 7 → 1 to start a fresh cycle).
    currentDay = (dc.lastDay % 7) + 1;
    streak     = (dc.streak || 0) + 1;
  } else {
    // First ever, or a missed day → reset to the start of the calendar.
    currentDay = 1;
    streak     = 1;
  }
  return { today, dc, claimedToday, currentDay, streak };
}

function buildDailyPayload(user){
  const { today, claimedToday, currentDay, streak } = dailyCalState(user);
  const days = DAILY_CALENDAR.map(r => {
    let state;
    if (claimedToday) state = r.day <= currentDay ? 'claimed' : 'locked';
    else              state = r.day <  currentDay ? 'claimed'
                            : r.day === currentDay ? 'ready' : 'locked';
    return { ...r, state };
  });
  return {
    days,
    currentDay,
    streak,
    canClaim: !claimedToday,
    // When the next claim unlocks: start of the next UTC day.
    nextClaimAt: claimedToday ? (today + 1) * DAY_MS : Date.now(),
  };
}

app.get('/api/rewards/daily', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(buildDailyPayload(user));
});

app.post('/api/rewards/daily/claim', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { today, dc, claimedToday, currentDay, streak } = dailyCalState(user);
  if (claimedToday){
    return res.status(429).json({
      error: 'Already claimed today',
      nextClaimAt: (today + 1) * DAY_MS,
    });
  }

  const reward = DAILY_CALENDAR[currentDay - 1] || DAILY_CALENDAR[0];
  user.coins    = (user.coins    || 0) + (reward.coins    || 0);
  user.diamonds = (user.diamonds || 0) + (reward.diamonds || 0);
  user.dailyCal = { lastDay: currentDay, lastClaimDay: today, streak };
  // Legacy field some other code still reads — keep it roughly in sync.
  user.lastDailyClaimAt = Date.now();
  logReward(user, reward.kind === 'chest' ? '🎁' : '🪙',
            `Daily Reward · Day ${currentDay}`, reward.coins || 0);
  saveUsers();

  res.json({
    earned: { coins: reward.coins || 0, diamonds: reward.diamonds || 0 },
    day: currentDay,
    streak,
    coins: user.coins,
    diamonds: user.diamonds,
    ...buildDailyPayload(user),
  });
});

/* ════════════════════════════════════════════════════════════════
   DAILY SPIN WHEEL
   Once-per-24h prize wheel: weighted random reward chosen server-side
   so the client's animation just has to land on the chosen index. The
   wheel order is shared with the client via /api/spin/status; both must
   match for the visual to read correctly.
   ════════════════════════════════════════════════════════════════ */
const SPIN_REWARDS = [
  { type: 'coins',    amount: 100,   weight: 30, label: '+100',   color: '#94A3B8' },
  { type: 'coins',    amount: 250,   weight: 22, label: '+250',   color: '#22D3EE' },
  { type: 'diamonds', amount: 5,     weight: 14, label: '+5 💎',   color: '#60A5FA' },
  { type: 'coins',    amount: 500,   weight: 14, label: '+500',   color: '#A78BFA' },
  { type: 'coins',    amount: 1000,  weight: 10, label: '+1K',    color: '#F472B6' },
  { type: 'diamonds', amount: 15,    weight: 6,  label: '+15 💎',  color: '#3B82F6' },
  { type: 'coins',    amount: 2500,  weight: 3,  label: '+2.5K',  color: '#FBBF24' },
  { type: 'jackpot',  amount: 5000,  weight: 1,  label: 'JACKPOT', color: '#E8324A' },
];
const SPIN_COOLDOWN_MS = 86400000;        // 24h between spins

app.get('/api/spin/status', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const now  = Date.now();
  const last = user.lastSpinAt || 0;
  const ready = !last || now - last >= SPIN_COOLDOWN_MS;
  res.json({
    ready,
    rewards: SPIN_REWARDS,
    nextSpinAt: ready ? now : last + SPIN_COOLDOWN_MS,
  });
});

app.post('/api/spin/wheel', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const now  = Date.now();
  const last = user.lastSpinAt || 0;
  if (last && now - last < SPIN_COOLDOWN_MS) {
    return res.status(429).json({ error: 'Spin not ready', nextSpinAt: last + SPIN_COOLDOWN_MS });
  }

  // Weighted pick. Returns BOTH the reward AND its index so the client
  // can animate the wheel to stop at exactly that segment.
  const totalWeight = SPIN_REWARDS.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosenIndex = 0;
  for (let i = 0; i < SPIN_REWARDS.length; i++) {
    roll -= SPIN_REWARDS[i].weight;
    if (roll <= 0) { chosenIndex = i; break; }
  }
  const chosen = SPIN_REWARDS[chosenIndex];

  // Grant the reward
  if (chosen.type === 'coins' || chosen.type === 'jackpot') {
    user.coins = (user.coins || 0) + chosen.amount;
  } else if (chosen.type === 'diamonds') {
    user.diamonds = (user.diamonds || 0) + chosen.amount;
  }
  user.lastSpinAt = now;
  saveUsers();
  console.log(`[Spin] ${user.username} won ${chosen.label} (${chosen.type})`);

  res.json({
    success: true,
    reward: chosen,
    rewardIndex: chosenIndex,
    coins: user.coins,
    diamonds: user.diamonds,
    nextSpinAt: now + SPIN_COOLDOWN_MS,
  });
});

// ─────────────────────────────────────────
// AMBIENT LOBBY POPULATION
// ─────────────────────────────────────────
// A brand-new lobby with no real players online looks dead. To make the game
// feel alive we surface (a) a believable, slowly-drifting "players online"
// count and (b) a handful of SIMULATED public rooms hosted by bot "players".
// These are display-only and only shown to TOP UP a sparse lobby (a busy
// server hides them). Joining one drops the player into a real quick-match of
// that game type — the client routes `ambient_<TYPE>_*` ids to quick-join —
// so the engine is never touched until a real player actually acts.
let _ambientOnline = 70 + Math.floor(Math.random() * 60);   // 70..129 at boot
function displayOnlineCount() {
  // Real connected users + the ambient baseline. Admin/stats endpoints keep
  // using onlinePlayerCount() so internal numbers stay truthful.
  return onlinePlayerCount() + _ambientOnline;
}
setInterval(() => {
  // Gentle random walk, biased a touch toward the evening "prime time".
  const hour = new Date().getHours();
  const peak = (hour >= 18 && hour <= 23) ? 3 : 0;
  _ambientOnline = Math.max(48, Math.min(240, _ambientOnline + Math.round((Math.random() - 0.5) * 14) + peak));
  try { broadcastOnlineCount(); } catch (e) {}
}, 40 * 1000).unref?.();

// Bot types used for ambient rooms — single-word only so the client can parse
// the type back out of the room id (`ambient_<TYPE>_<SEATED>_<BET>_<rand>`).
const AMBIENT_ROOM_TYPES = ['CLASSIC', 'CLASSIC', 'RONDA', 'CHILL', 'DAMA', 'CHESS'];
const AMBIENT_BETS       = [100, 200, 250, 500, 500, 750, 1000, 1500, 2000, 3000, 5000];   // everyday stakes
// HIGH-ROLLER tables — only pro (elite, HARD) bots host/fill these. Rare on
// purpose so seeing a 100K table feels like an event. `_roomWantsElite` fires
// at >= ELITE_ONLY_BET (25K); 10K rooms are flagged high-stakes explicitly.
const AMBIENT_HIGH_BETS  = [10000, 25000, 50000, 100000];
const AMBIENT_HIGH_CHANCE = 0.22;                       // ~1 in 5 rooms is a whale table
let _ambientRooms = [];
function _ambientPlayer(forceElite) {
  const elite = forceElite || (Math.random() < ELITE_BOT_CHANCE);
  const name  = UNO_BOT_NAMES[Math.floor(Math.random() * UNO_BOT_NAMES.length)];
  return { name, username: name, avatar: elite ? _shopAvatar() : randomPresetAvatar(), isElite: elite };
}
function _spawnAmbientRoom() {
  const type       = AMBIENT_ROOM_TYPES[Math.floor(Math.random() * AMBIENT_ROOM_TYPES.length)];
  // Exact seat counts: DAMA and CHESS are 1v1 (2). Everything else — Cardora
  // (CLASSIC / CHILL) and RONDA — is a 4-player table. Never anything else.
  const maxPlayers = (type === 'DAMA' || type === 'CHESS') ? 2 : 4;
  // High-stakes rooms are hosted + filled ONLY by elite pro bots (they play
  // hard when a real player joins — high-stakes must never be an easy table).
  const highStakes = Math.random() < AMBIENT_HIGH_CHANCE;
  const bet = highStakes
    ? AMBIENT_HIGH_BETS[Math.floor(Math.random() * AMBIENT_HIGH_BETS.length)]
    : AMBIENT_BETS[Math.floor(Math.random() * AMBIENT_BETS.length)];
  const host       = _ambientPlayer(highStakes);
  const seated     = 1 + Math.floor(Math.random() * Math.max(1, maxPlayers - 1));  // 1..max-1
  const seats      = [host];
  while (seats.length < seated) seats.push(_ambientPlayer(highStakes));
  return {
    // id carries BOTH the seated count (so joining pre-seats seated-1 bots) and
    // the bet (so the created room inherits the stake → high-stakes rooms get
    // elite HARD bots via _roomWantsElite / the joined-room flag).
    id: `ambient_${type}_${seated}_${bet}_${Math.random().toString(36).slice(2, 8)}`,
    roomType: type, maxPlayers, players: seated, bet, highStakes,
    hostUsername: host.username, hostAvatar: host.avatar,
    seats,
    createdAt: Date.now() - Math.floor(Math.random() * 80 * 1000),   // up to 80s old
    _bornAt: Date.now(),
  };
}
function _maintainAmbientRooms() {
  const now = Date.now();
  // Rooms age out on their own (~50–110s life) so the pool churns naturally.
  _ambientRooms = _ambientRooms.filter(r =>
    (now - r._bornAt) < (50 * 1000 + Math.random() * 60 * 1000));
  // Keep a big, lively pool — 28–34 rooms so the browse list always looks busy.
  const target = 28 + Math.floor(Math.random() * 7);
  while (_ambientRooms.length < target) _ambientRooms.push(_spawnAmbientRoom());
}
// Every ~60s, force-rotate MOST of the pool (retire ~65% of the oldest rooms)
// so the lobby visibly refreshes to new rooms roughly every minute.
function _rotateAmbientRooms() {
  if (!_ambientRooms.length) return;
  _ambientRooms.sort((a, b) => a._bornAt - b._bornAt);         // oldest first
  const cut = Math.floor(_ambientRooms.length * (0.6 + Math.random() * 0.15));
  _ambientRooms = _ambientRooms.slice(cut);                    // drop the oldest ~60–75%
  _maintainAmbientRooms();                                     // refill to target with fresh rooms
}
setInterval(_maintainAmbientRooms, 15 * 1000).unref?.();
setInterval(_rotateAmbientRooms, 60 * 1000).unref?.();
_maintainAmbientRooms();
// Serialise ambient rooms into the same shape /api/rooms emits for real ones.
function _ambientRoomsForList(count) {
  return _ambientRooms.slice(0, Math.max(0, count)).map(r => ({
    id: r.id, hostId: null, players: r.players, maxPlayers: r.maxPlayers,
    status: 'lobby', bet: r.bet, roomType: r.roomType, highStakes: !!r.highStakes,
    hostUsername: r.hostUsername, hostAvatar: r.hostAvatar,
    createdAt: r.createdAt,
    ageSec: Math.max(0, Math.floor((Date.now() - r.createdAt) / 1000)),
    seats: r.seats.map(s => ({ name: s.username || s.name, avatar: s.avatar || null })),
    settings: { maxPlayers: r.maxPlayers, drawStacking: false },
    ambient: true,
  }));
}

// ─────────────────────────────────────────
// REST: Rooms
// ─────────────────────────────────────────

app.get('/api/rooms', authMiddleware, (req, res) => {
  // Ranked rooms are matchmaking-only — never list them as joinable public rooms.
  const all = [...roomsDB.values()].filter(r => !r.settings.isPrivate && !r.settings.ranked);
  const publicRooms = all
    .filter(r => r.status === 'lobby')
    .map(r => {
      // Resolve host info so the browse list can render avatar + name.
      const host = usersDB.get(r.hostId);
      const createdAtMs = r.createdAt || Date.now();
      return {
        id: r.id, hostId: r.hostId, players: r.playerIds.length,
        maxPlayers: r.settings.maxPlayers, status: r.status,
        bet: r.settings.bet || 0,
        roomType: r.roomType || 'CLASSIC',   // so the browse card can show the game type
        hostUsername: host?.username || 'Host',
        hostAvatar: host?.avatar || null,
        createdAt: createdAtMs,
        ageSec: Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000)),
        seats: (r.game?.players || []).map(p => ({ name: p.username, avatar: p.avatar || null })),
        settings: { maxPlayers: r.settings.maxPlayers, drawStacking: r.settings.drawStacking },
      };
    })
    // Newest-first so freshly-created rooms surface at the top of the list.
    .sort((a, b) => b.createdAt - a.createdAt);
  // "Live Games" are for watching FRIENDS only — you can't spectate strangers'
  // (or bot-filled) matches. Show a playing room only if a friend is seated.
  const _me        = usersDB.get(req.user.userId);
  const _friendSet = new Set(_me?.friends || []);
  const liveGames = all
    .filter(r => r.status === 'playing')
    .filter(r => r.playerIds.some(pid => _friendSet.has(pid)))
    .map(r => ({
      id: r.id, players: r.playerIds.length,
      maxPlayers: r.settings.maxPlayers,
      bet: r.settings.bet || 0,
      spectators: r.spectators?.size || 0,
      playerNames: r.game.players.map(p => p.username),
      seats: (r.game?.players || []).map(p => ({ name: p.username, avatar: p.avatar || null })),
    }));
  // Fill the lobby with simulated bot-hosted rooms so it always looks busy
  // (~27 cards total). Real rooms come first; ambient tops it up to the target.
  const AMBIENT_TARGET_SHOWN = 27;
  const ambient = _ambientRoomsForList(Math.max(0, AMBIENT_TARGET_SHOWN - publicRooms.length));
  res.json({ rooms: [...publicRooms, ...ambient], liveGames, onlineCount: displayOnlineCount() });
});

// ── Featured rooms (4-card lobby) ─────────────────────────────────────
// One card per featured type, in fixed order. Each card represents the
// MOST-POPULATED open instance of that type (or empty if none exist).
// Server computes `hotType` = the most-populated non-RANKED card so the
// client can highlight the busiest casual room. RANKED keeps its fixed
// badge always; HOT goes only to Classic / Fun / Chill.
app.get('/api/rooms/featured', authMiddleware, (req, res) => {
  const cards = [];
  let hotType = null;
  let hotPlayers = 0;

  for (const type of FEATURED_TYPE_ORDER) {
    const cfg = ROOM_TYPES[type];
    const top = _openRoomsOfType(type)[0] || null;
    const players = top ? top.playerIds.length : 0;
    cards.push({
      type,
      label:      cfg.label,
      maxPlayers: cfg.maxPlayers,
      entryFee:   cfg.entryFee,
      badge:      cfg.badge,                                 // RANKED fixed, others null
      ranked:     cfg.ranked,
      players,
      instanceId: top ? top.id : null,
      seats:      top ? (top.game?.players || []).map(p => ({
        name: p.username, avatar: p.avatar || null,
      })) : [],
    });
    if (type !== 'RANKED' && players > hotPlayers) {
      hotPlayers = players;
      hotType    = type;
    }
  }
  // No HOT badge when every casual room is empty (avoid a false-positive HOT).
  if (hotPlayers <= 0) hotType = null;

  const onlineCount = displayOnlineCount();
  // buildNum lets the client surface a "server is stale, restart needed"
  // warning when the order on screen doesn't match what was just edited.
  res.json({ rooms: cards, onlineCount, hotType, buildNum: 292 });
});

// ── Quick-join into a featured type ───────────────────────────────────
// Body: { type: 'CLASSIC'|'FUN'|'RANKED'|'CHILL'|'QUICK_MATCH' }
//   * Named type   -> joins most-populated open instance of that type, or
//                     spawns a fresh one if none exist.
//   * QUICK_MATCH  -> server picks the busiest non-RANKED type (random
//                     fallback only if every casual pool is empty).
//
// Returns { roomId, code, created, roomType }. The existing socket
// 'room:join' flow handles the actual seating from the client side.
//
// NOTE (P4 economy): entry-fee debit deliberately deferred to match-start,
// not to join-time. See comment block where the debit will live.
// Seat ONE engine-aware bot into a lobby room (UNO/Cardora, RONDA or DAMA).
function _seatOneBot(room, name){
  const type  = room.roomType;
  const elite = _roomWantsElite(room);                 // high-stakes → pro bots only
  const botId = 'bot_pre_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
  const bid   = makeBotIdentity(name, elite);
  if (UNO_LIKE_TYPES.has(type)){
    const bot = new Player(botId, name, 0);
    bot.isBot = true; bot.isConnected = true; bot.status = 'active';
    applyBotIdentity(bot, name, elite);
    if (!room.game.addPlayer(bot).success) return false;
  } else {
    if (!room.game.addPlayer({ id: botId, username: name, avatar: bid.avatar, cardBackId: bid.cardBackId, isBot: true, isHost: false }).success) return false;
    const bp = room.game.players.find(p => p.id === botId);
    if (bp){ bp.isElite = bid.isElite; bp.tableFelt = bid.tableFelt; bp.botDifficulty = bid.difficulty;
             bp.accountLevel = elite ? (55 + Math.floor(Math.random() * 41)) : botLevelFor(bid.difficulty);
             if(elite){ const er = _eliteRank(); bp.rankPoints = er.rankPoints; bp.rankedTier = er.rankedTier; bp.peakRankPoints = er.peakRankPoints; } }
  }
  if (elite) console.log(`[Elite] high-stakes room ${room.id} (bet ${room.settings?.bet}) → pro bot ${name}`);
  room.playerIds.push(botId);
  return true;
}
// Pre-populate a freshly-spawned room with `count` bots (leaving ≥1 open seat
// for the bot-fill reveal) so a player who tapped an "N/M" lobby card lands in
// a room that already shows those N seated — not a lonely empty table.
function preseatBots(room, count){
  const max = room.settings?.maxPlayers || 4;
  count = Math.max(0, Math.min(Math.floor(Number(count) || 0), max - room.playerIds.length - 1));
  const used = new Set(room.game.players.map(p => p.username));
  let seated = 0;
  for (let i = 0; i < count; i++){
    let name = null;
    for (let t = 0; t < 25; t++){
      const c = MOROCCAN_BOT_NAMES[Math.floor(Math.random() * MOROCCAN_BOT_NAMES.length)];
      if (!used.has(c)){ name = c; break; }
    }
    if (!name) break;
    used.add(name);
    if (_seatOneBot(room, name)) seated++;
  }
  return seated;
}

app.post('/api/rooms/quick-join', authMiddleware,
  // Per-user cap: matchmaking/join is a click action — 30/min is generous for
  // real play but stops a script from spawning rooms+bots+timers in a loop.
  rateLimit({ limit: 30, windowMs: 60 * 1000, label: 'quick_join', keyFn: req => req.user?.userId || req.ip }),
  validateBody({ type:{ type:'string', required:true, max:32 }, preseat:{ type:'int', min:0, max:3 }, mode:{ type:'string', max:8 }, bet:{ type:'int', min:0, max:100000 } }), (req, res) => {
  let { type, preseat, mode, bet } = req.body || {};
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (type === 'QUICK_MATCH') type = pickQuickMatchType();
  if (!ROOM_TYPES[type]) return res.status(400).json({ error: 'Unknown room type' });

  // ── P4-NEW.1b: Ranked abandon queue ban ──
  // Reject RANKED joins while the user's lockout window is still active.
  // Other types (Classic / Fun / Chill / pickQuickMatchType output) are
  // unaffected — the ban only applies to ranked queueing.
  if (type === 'RANKED' && user.rankedBanUntil && user.rankedBanUntil > Date.now()) {
    const remainingMs = user.rankedBanUntil - Date.now();
    return res.status(403).json({
      error: 'Ranked locked — abandon penalty',
      bannedUntil: user.rankedBanUntil,
      remainingMs,
    });
  }

  // RANKED RONDA is a free ladder game — no coin entry gate. (The abandon
  // queue ban above still applies.)

  // ── P4 HOOK: entry-fee debit will live here on match start, not join.
  // const cfg = ROOM_TYPES[type];
  // if ((user.coins || 0) < cfg.entryFee) {
  //   return res.status(402).json({ error: 'Not enough coins', need: cfg.entryFee });
  // }

  // Whitelist the stake so a tampered client can't set an arbitrary bet — must
  // be one of the real ambient stakes. High stakes (>=10K) mark the room so the
  // fill/preseat uses elite HARD pro bots (not anyone can play for big money).
  const _ALLOWED_BETS = new Set([...AMBIENT_BETS, ...AMBIENT_HIGH_BETS]);
  const betOverride = _ALLOWED_BETS.has(Number(bet)) ? Number(bet) : 0;

  try {
    const { room, created } = findOrCreateRoomOfType(type, user, mode, betOverride);
    // A high-stakes table forces elite pro bots — flag it so preseat + the live
    // bot-fill both wear the premium look AND play HARD.
    if (created && betOverride >= 10000) room._forceElite = true;
    // If this came from an ambient "N/M" lobby card, pre-seat bots so the room
    // already shows those players seated. Only on a freshly-spawned room.
    if (created && Number(preseat) > 0 && room.status === 'lobby' && type !== 'RANKED'){
      preseatBots(room, preseat);
      // The player JOINED a room "owned" by one of these players — so they are
      // NOT the host: they must not see the host-only Start button (the match
      // auto-starts via the bot-fill). Hand the host role to a bot — UNO's
      // startGame needs a host with isHost:true; Dama/Ronda don't need one.
      const _userPl = room.game.players.find(p => p.id === user.id);
      const _botPl  = room.game.players.find(p => p.isBot);
      if (_userPl) _userPl.isHost = false;
      if (_botPl){ _botPl.isHost = true; room.hostId = _botPl.id; }
    }
    res.json({
      roomId:        room.id,
      code:          room.code,
      created,
      roomType:      type,
      // Surface ranked-search context so the client can render the radar
      // overlay: when the room was spawned (for the bot-fill countdown),
      // and a default fill delay so the client doesn't need to hard-code
      // the constant in two places.
      roomCreatedAt: room.createdAt || Date.now(),
      maxPlayers:    room.settings?.maxPlayers || 4,
      botFillMs:     type === 'RANKED' ? RONDA_FILL_DELAY_MS : (UNO_LIKE_TYPES.has(type) ? UNO_FILL_DELAY_MS : null),
    });
  } catch (e) {
    console.error('[quick-join]', e);
    res.status(500).json({ error: e.message || 'Quick join failed' });
  }
});

// Room creation rate-limited per user: 10 rooms / minute. Stops a
// malicious client from spawning thousands of phantom rooms to bloat
// the lobby list or evict legitimate ones via memory pressure.
app.post('/api/rooms',
  authMiddleware,
  rateLimit({ limit: 10, windowMs: 60 * 1000, label: 'room_create',
              keyFn: req => req.user?.userId || req.ip }),
  (req, res) => {
  const { settings = {} } = req.body;
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Defense-in-depth: cap how many OPEN lobby rooms one account can host at
  // once. Even under the 10/min rate limit, a script could otherwise pile up
  // game engines + bot timers faster than the 5-min reaper clears them.
  let _openMine = 0;
  for (const r of roomsDB.values()){ if (r.hostId === user.id && r.status === 'lobby') _openMine++; }
  if (_openMine >= 6) return res.status(429).json({ error: 'You have too many open rooms — start or close one first' });

  // Accept an optional roomType (UNO | DAMA | CHESS | RONDA) and
  // route to the matching engine via makeGameForRoom. Unimplemented
  // game types are rejected here so the client doesn't end up with a
  // broken room. PRIVATE is the legacy default (UNO).
  const requested = String(settings.roomType || 'PRIVATE').toUpperCase();
  const PLAYABLE_TYPES = new Set(['UNO', 'DAMA', 'CHESS', 'RONDA', 'PRIVATE', 'CLASSIC', 'CHILL']);
  if (!PLAYABLE_TYPES.has(requested)) {
    return res.status(400).json({ error: `${requested} — coming soon!` });
  }
  // Chess time control — validate against the engine's table so an unknown
  // id can never reach the engine (it would silently fall back anyway).
  if (requested === 'CHESS'){
    const tc = String(settings.timeControl || 'RAPID_10').toUpperCase();
    settings.timeControl = CHESS_TIME_CONTROLS[tc] ? tc : 'RAPID_10';
  }
  // Map UNO → PRIVATE so the existing UNO codepath keeps working
  // unchanged. DAMA / RONDA get their own dedicated engines + listeners.
  const roomType = requested === 'UNO' ? 'PRIVATE' : requested;

  const room = createRoomRecord(user.id, settings, roomType);
  room.game = makeGameForRoom(room.id, room.settings, roomType);

  if      (roomType === 'DAMA')  attachDamaListeners(room);
  else if (roomType === 'CHESS') attachChessListeners(room);
  else if (roomType === 'RONDA') attachRondaListeners(room);
  else                           attachGameListeners(room);

  const player = new Player(user.id, user.username, user.coins);
  player.avatar = user.avatar; player.cardBackId = user.equippedCardBack || 'cb_default';
  player.tableFelt = user.equippedTableFelt || 'tfp_green';
  player.isHost = true;

  const result = room.game.addPlayer(player);
  if (!result.success) return res.status(400).json({ error: result.reason });

  room.playerIds.push(user.id);
  roomsDB.set(room.id, room);

  // PUBLIC room → opponents trickle in one at a time (≈7s, +5s, +4s…) so it
  // feels like real players finding it. PRIVATE rooms stay invite-only (no bots).
  if (!room.settings.isPrivate) scheduleStaggeredFill(room);

  console.log(`[Room] Created: ${room.id} by ${user.username} (type: ${roomType}, bet: ${settings.bet || 0}, ${room.settings.isPrivate ? 'PRIVATE' : 'PUBLIC'})`);
  res.status(201).json({ roomId: room.id, code: room.code, settings: room.settings, roomType });
});

function _pubPlayer(p){
  if (!p) return null;
  return (typeof p.toPublicJSON === 'function') ? p.toPublicJSON() : p;
}

app.get('/api/rooms/code/:code', authMiddleware,
  // Brute-force guard: private-room codes are 6 chars from a 32-char set —
  // unguessable at 15 tries/min, and the cap also stops the O(rooms) scan
  // from being spammed as a CPU drain.
  rateLimit({ limit: 15, windowMs: 60 * 1000, label: 'room_code', keyFn: req => req.user?.userId || req.ip }),
  (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) return res.status(404).json({ error: 'Room not found' });   // malformed = same answer (no oracle)
  const room = [...roomsDB.values()].find(r => r.code === code);
  if(!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ roomId: room.id, settings: room.settings, players: room.game.players.map(_pubPlayer) });
});

app.get('/api/rooms/:roomId', authMiddleware, (req, res) => {
  const room = roomsDB.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({
    id: room.id, status: room.status, settings: room.settings,
    players: room.game.players.map(_pubPlayer),
  });
});

// ─────────────────────────────────────────
// REST: Shop (Diamonds + IAP packages, P4-D.2)
// ─────────────────────────────────────────
// Three endpoints backing the shop UI:
//   GET  /api/shop/packages        -> the 5 IAP packages from IAP_PACKAGES.
//   POST /api/shop/purchase        -> SIMULATED purchase. Grants the package
//                                      contents instantly + returns updated user.
//                                      The `simulated:true` flag on the response
//                                      is the marker for swapping to a real
//                                      payment provider later (Stripe / PayPal /
//                                      Google Play / App Store) without changing
//                                      the response shape on the client.
//   POST /api/shop/convert-diamonds-> Diamonds -> coins at DIAMOND_TO_COIN_RATE.
//                                      Non-refundable (GDD §6.1). The client
//                                      MUST show a confirm dialog before calling
//                                      this (handled in P4-D.4).

app.get('/api/shop/packages', authMiddleware, (req, res) => {
  const packages = IAP_PACKAGE_ORDER.map(id => {
    const p = IAP_PACKAGES[id];
    return {
      id: p.id, label: p.label,
      coins: p.coins, diamonds: p.diamonds,
      usd_cents: p.usd_cents, bonus_pct: p.bonus_pct,
    };
  });
  // demo_mode:true is the client's signal to show the "DEMO MODE — no real
  // money charged" banner on the shop. Flip this to false at the same time
  // we flip the purchase handler from simulated to real-provider.
  res.json({ packages, demo_mode: true, diamond_to_coin_rate: DIAMOND_TO_COIN_RATE });
});

app.post('/api/shop/purchase', authMiddleware, validateBody({ packageId:{ type:'string', required:true, max:64 } }), async (req, res) => {
  const { packageId } = req.body || {};
  const pkg = packageId ? IAP_PACKAGES[packageId] : null;
  if (!pkg) return res.status(400).json({ error: 'Unknown package' });

  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // SIMULATED purchase — grants instantly. Real-provider integration will
  // replace this body with: verify provider receipt -> grant -> log txn id.
  // The response shape stays identical so the client doesn't need to know.
  user.coins    = (user.coins    || 0) + pkg.coins;
  user.diamonds = (user.diamonds || 0) + pkg.diamonds;

  console.log(`[IAP] ${user.username} purchased '${pkg.id}' (simulated): +${pkg.coins} coins, +${pkg.diamonds} diamonds`);
  auditEconomy(user, 'iap.purchase', { packageId: pkg.id, coins: pkg.coins, diamonds: pkg.diamonds, usd_cents: pkg.usd_cents, simulated: true });
  await saveUsers();

  res.json({
    success: true,
    simulated: true,                                // flip to false when real provider lands
    package: { id: pkg.id, coins: pkg.coins, diamonds: pkg.diamonds, usd_cents: pkg.usd_cents },
    user: sanitizeUser(user),
  });
});

// ── Special Offers ───────────────────────────────────────────────────
// GET  /api/offers/current — returns the active offer + endsAt + whether
//                            the caller has already claimed it. The banner
//                            hides itself when alreadyClaimed:true or
//                            endsAt < Date.now().
// POST /api/offers/claim/:id — one-time grant of coins + diamonds. Marks
//                              user.claimedOffers[id] = timestamp so subsequent
//                              calls return 409. Demo-mode parallel of /api/shop/purchase.
app.get('/api/offers/current', authMiddleware, (req, res) => {
  const offer = SPECIAL_OFFERS[SPECIAL_OFFER_ACTIVE_ID];
  if (!offer) return res.json({ offer: null, demo_mode: true });
  const user = usersDB.get(req.user.userId);
  const claimedAt = user?.claimedOffers?.[offer.id] || null;
  res.json({
    offer: {
      id:       offer.id,
      title:    offer.title,
      headline: offer.headline,
      sub:      offer.sub,
      coins:    offer.coins,
      diamonds: offer.diamonds,
      badge:    offer.badge,
    },
    endsAt:         SPECIAL_OFFER_ENDS_AT,
    alreadyClaimed: !!claimedAt,
    claimedAt,
    demo_mode:      true,
  });
});

app.post('/api/offers/claim/:id', authMiddleware, async (req, res) => {
  const offerId = req.params.id;
  const offer = SPECIAL_OFFERS[offerId];
  if (!offer) return res.status(400).json({ error: 'Unknown offer' });
  if (offerId !== SPECIAL_OFFER_ACTIVE_ID) return res.status(410).json({ error: 'Offer no longer active' });
  if (Date.now() > SPECIAL_OFFER_ENDS_AT) return res.status(410).json({ error: 'Offer expired' });

  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.claimedOffers) user.claimedOffers = {};
  if (user.claimedOffers[offerId]) {
    return res.status(409).json({ error: 'Already claimed', claimedAt: user.claimedOffers[offerId] });
  }

  user.coins    = (user.coins    || 0) + offer.coins;
  user.diamonds = (user.diamonds || 0) + offer.diamonds;
  user.claimedOffers[offerId] = Date.now();
  console.log(`[Offer] ${user.username} claimed '${offer.id}' (demo): +${offer.coins} coins, +${offer.diamonds} diamonds`);
  await saveUsers();

  res.json({
    success:   true,
    simulated: true,
    offer:     { id: offer.id, coins: offer.coins, diamonds: offer.diamonds },
    user:      sanitizeUser(user),
  });
});

app.post('/api/shop/convert-diamonds', authMiddleware, validateBody({ amount:{ type:'int', required:true, min:1, max:1000000 } }), async (req, res) => {
  const raw = req.body?.amount;
  const diamonds = Number.parseInt(raw, 10);
  if (!Number.isFinite(diamonds) || diamonds <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const have = user.diamonds || 0;
  if (have < diamonds) {
    return res.status(402).json({ error: 'Not enough diamonds', have, need: diamonds });
  }

  const coinsGranted = diamonds * DIAMOND_TO_COIN_RATE;
  user.diamonds = have - diamonds;
  user.coins    = (user.coins || 0) + coinsGranted;

  console.log(`[IAP] ${user.username} converted ${diamonds} diamonds -> ${coinsGranted} coins`);
  auditEconomy(user, 'convert.diamonds_to_coins', { diamonds, coinsGranted });
  await saveUsers();

  res.json({
    success: true,
    converted: { diamonds, coins: coinsGranted },
    user: sanitizeUser(user),
  });
});

// ─────────────────────────────────────────
// REST: Leaderboard
// ─────────────────────────────────────────
// Instagram follow reward
const AVATAR_COOLDOWN_MS = 10 * 24 * 60 * 60 * 1000;
// ─────────────────────────────────────────
// LA LIGA — personal season vs 12 bots, round-robin, P/W/D/L/PTS
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// LA LIGA v2 — fixed schedule, best-of-2 rounds, scheduled times
// ─────────────────────────────────────────
//
// 12 players total: the user + 11 bots named User1..User11.
// Every player plays every other once — 11 matchdays.
// Each match = best of 2 rounds:
//   2-0 / 2-1 → win, 3 points
//   1-1       → draw, 1 point each
//   0-2 / 1-2 → loss, 0 points
// Matches happen at fixed scheduled times. Real player gets a 10-minute
// window to show up; if they don't, a bot plays in their place. Bot-vs-bot
// fixtures simulate themselves when their scheduled time arrives so the
// table fills in over the season instead of all at once.

// SHARED LEAGUE — one global table that every real user joins. 14 slots,
// initially all bots. When a real user logs in for the first time, they
// take a random bot's slot (keeping its standings). New users keep
// replacing bots until the table is full of humans.
const LEAGUE_BOT_NAMES = MOROCCAN_BOT_NAMES;
const LEAGUE_TOTAL_PLAYERS = 14;
// 14 players × double round-robin = 26 fixtures per player.
// Each player gets 2 fixtures per day → 13-day season.
const LEAGUE_DAYS_PER_SEASON = 13;
const LEAGUE_FIXTURES_PER_DAY = 2;
// Real cycle: 24-hour days, fixture 1 at +20h, fixture 2 at +21h
// (so they line up with 20:00 / 21:00 local once startedAt is aligned
// to the start of the day). Override with env LEAGUE_DAY_MS for testing.
const LEAGUE_DAY_MS = parseInt(process.env.LEAGUE_DAY_MS) || 24 * 60 * 60 * 1000;
const LEAGUE_FIXTURE_SLOT_OFFSETS_MS = (process.env.LEAGUE_DAY_MS && parseInt(process.env.LEAGUE_DAY_MS) < 3600000)
  ? [0, parseInt(process.env.LEAGUE_DAY_MS) / 2]    // dev: split the short day in half
  : [20 * 60 * 60 * 1000, 21 * 60 * 60 * 1000];     // prod: 20:00 + 21:00 from day start
const LEAGUE_NO_SHOW_GRACE_MS = 10 * 60 * 1000; // play window before bot takes over
const LEAGUE_SEASON_BREAK_MS = 3 * 60 * 60 * 1000; // 3-hour break (3 days in prod)
const LEAGUE_PRIZES = { 1:10000, 2:9000, 3:8000, 4:7000, 5:6000, 6:5000, 7:4000, 8:3000, 9:1000 };

// A "slot" is a permanent seat in the league. slotId never changes; the
// userId field decides whether the slot is currently a bot or a real
// user. Stats stay attached to the slot, so when a user takes a bot's
// slot they inherit its standings.
function newLeagueSlot(slotId, name, opts = {}) {
  return {
    slotId,
    userId: opts.userId || null,
    name,
    avatar: opts.avatar || null,
    skill: opts.skill ?? 0.5,
    isBot: opts.userId ? false : true,
    played: 0, wins: 0, draws: 0, losses: 0,
    goalsFor: 0, goalsAgainst: 0,
    points: 0,
    last5: [], // most recent first: 'W'|'D'|'L'
  };
}

// Global singleton — every real user shares this league
let globalLeague = null;

function initGlobalLeague() {
  if (globalLeague && Array.isArray(globalLeague.schedule)) {
    processDueMatchesGlobal();
    maybeFinishSeasonGlobal();
    return globalLeague;
  }
  const slots = LEAGUE_BOT_NAMES.slice(0, LEAGUE_TOTAL_PLAYERS).map((n, i) =>
    newLeagueSlot('s_' + (i + 1), n, { skill: 0.30 + Math.random() * 0.55 })
  );
  const startedAt = Date.now();
  const schedule = generateLeagueSchedule(slots, startedAt);
  globalLeague = {
    seasonNumber: 1,
    season: 'S1',
    startedAt,
    slots,
    schedule,
    finishedAt: null,
    nextSeasonAt: null,
    podium: null,
    previousSeasonPodium: null,
    prizesPaid: false,
  };
  processDueMatchesGlobal();
  return globalLeague;
}

// Whenever a real user shows up, make sure they hold a slot in the
// shared league. If they don't, they take a random bot's seat — keeping
// that seat's existing standings, schedule, history. Returns the slot
// they own (or null if the table is somehow full of other humans).
function ensureUserInLeague(user) {
  const lg = initGlobalLeague();
  // Already seated?
  let mine = lg.slots.find(s => s.userId === user.id);
  if (mine) {
    // Make sure the slot's display matches the user's current avatar/name
    mine.name = user.username;
    mine.avatar = user.avatar || null;
    return mine;
  }
  // Find a random bot to replace
  const bots = lg.slots.filter(s => !s.userId);
  if (bots.length === 0) return null; // table is full of humans
  const target = bots[Math.floor(Math.random() * bots.length)];
  target.userId = user.id;
  target.isBot = false;
  target.name = user.username;
  target.avatar = user.avatar || null;
  // Keep stats — user inherits the bot's run so far
  console.log(`[League] ${user.username} took ${target.slotId}'s seat (was a bot)`);
  return target;
}

// Build the season schedule:
//   1. Double round-robin via circle method = 26 single-round-robin rounds
//   2. Pair consecutive rounds into 13 days; each day has 2 fixture
//      slots (20:00 and 21:00 in prod). Every player plays exactly
//      one fixture in each slot.
function generateLeagueSchedule(slots, startTime, seasonNumber = 1) {
  const arr = [...slots];
  if (arr.length % 2 === 1) arr.push({ slotId: 'BYE' });
  const N = arr.length;
  const halfN = N / 2;
  // First leg
  const firstLeg = [];
  let ring = arr.slice();
  for (let r = 0; r < N - 1; r++) {
    const pairs = [];
    for (let i = 0; i < halfN; i++) {
      const a = ring[i];
      const b = ring[N - 1 - i];
      if (a.slotId === 'BYE' || b.slotId === 'BYE') continue;
      pairs.push({ p1: a.slotId, p2: b.slotId });
    }
    firstLeg.push(pairs);
    // Rotate (keep ring[0] fixed)
    const fixed = ring[0];
    const rest = ring.slice(1);
    rest.unshift(rest.pop());
    ring = [fixed, ...rest];
  }
  const secondLeg = firstLeg.map(round => round.map(pair => ({ p1: pair.p2, p2: pair.p1 })));
  const allRounds = firstLeg.concat(secondLeg); // 26 rounds total
  const out = [];
  // Pair consecutive rounds into days: day 1 = rounds 0+1, day 2 = 2+3...
  for (let d = 0; d < LEAGUE_DAYS_PER_SEASON; d++) {
    for (let slot = 0; slot < LEAGUE_FIXTURES_PER_DAY; slot++) {
      const roundIdx = d * LEAGUE_FIXTURES_PER_DAY + slot;
      const pairs = allRounds[roundIdx] || [];
      const slotOffset = LEAGUE_FIXTURE_SLOT_OFFSETS_MS[slot] || 0;
      const scheduledAt = startTime + d * LEAGUE_DAY_MS + slotOffset;
      pairs.forEach((pair, idx) => {
        out.push({
          id: `s${seasonNumber}_d${d+1}_t${slot+1}_f${idx}`,
          p1: pair.p1, p2: pair.p2, // these are slotIds
          day: d + 1,
          slot: slot + 1, // 1 = "20:00 game", 2 = "21:00 game"
          scheduledAt,
          status: 'scheduled',
          rounds: [],
          result: null,
        });
      });
    }
  }
  return out;
}

// When the global season ends, pay every real user their prize, build
// the podium, and queue the next season.
function maybeFinishSeasonGlobal() {
  if (!globalLeague) return;
  const lg = globalLeague;
  if (lg.finishedAt) {
    if (lg.nextSeasonAt && Date.now() >= lg.nextSeasonAt) {
      startNewSeasonGlobal();
    }
    return;
  }
  const allDone = lg.schedule.every(m => m.status === 'finished');
  if (!allDone) return;
  const standings = getLeagueStandings(lg);
  if (!lg.prizesPaid) {
    standings.forEach((slot, i) => {
      const finish = i + 1;
      const prize = LEAGUE_PRIZES[finish] || 0;
      if (slot.userId && prize > 0) {
        const u = usersDB.get(slot.userId);
        if (u) {
          u.coins = (u.coins || 0) + prize;
          const medal = finish === 1 ? '🏆' : finish === 2 ? '🥈' : finish === 3 ? '🥉' : '🎖️';
          logReward(u, medal, `La Liga S${lg.seasonNumber || 1} — finished #${finish}`, prize);
          console.log(`[League] ${u.username} finished #${finish} → +${prize} coins`);
        }
      }
    });
    lg.prizesPaid = true;
  }
  lg.finishedAt = Date.now();
  lg.nextSeasonAt = lg.finishedAt + LEAGUE_SEASON_BREAK_MS;
  lg.podium = standings.slice(0, 3).map((slot, i) => ({
    slotId: slot.slotId, userId: slot.userId,
    name: slot.name, avatar: slot.avatar, isBot: slot.isBot,
    points: slot.points,
    prize: LEAGUE_PRIZES[i + 1] || 0,
  }));
  saveLeague();
}

function startNewSeasonGlobal() {
  const old = globalLeague;
  if (!old) return;
  // Top 9 keep their seats (with stats reset), bottom 5 get fresh bots
  const standings = getLeagueStandings(old);
  const carry = standings.slice(0, 9).map((slot, i) => newLeagueSlot(
    's_' + (i + 1), slot.name,
    { userId: slot.userId, avatar: slot.avatar, skill: slot.skill }
  ));
  const newBots = LEAGUE_BOT_NAMES.slice(0, 5).map((n, i) =>
    newLeagueSlot('s_' + (10 + i), n + ' II', { skill: 0.30 + Math.random() * 0.55 })
  );
  const slots = carry.concat(newBots).slice(0, LEAGUE_TOTAL_PLAYERS);
  const seasonNumber = old.seasonNumber + 1;
  const startedAt = Date.now();
  const schedule = generateLeagueSchedule(slots, startedAt, seasonNumber);
  globalLeague = {
    seasonNumber,
    season: 'S' + seasonNumber,
    startedAt,
    slots,
    schedule,
    finishedAt: null,
    nextSeasonAt: null,
    podium: null,
    previousSeasonPodium: old.podium,
    prizesPaid: false,
  };
  console.log(`[League] New season ${globalLeague.season} started`);
  saveLeague();
}

function simulateRound(p1, p2) {
  // Single round outcome. ~7% draw chance, otherwise weighted by skill.
  if (Math.random() < 0.07) return 'draw';
  const total = (p1.skill || 0.5) + (p2.skill || 0.5);
  return Math.random() < (p1.skill || 0.5) / total ? 'p1' : 'p2';
}

function recordMatchResult(league, match) {
  const p1 = league.slots.find(s => s.slotId === match.p1);
  const p2 = league.slots.find(s => s.slotId === match.p2);
  if (!p1 || !p2) return;
  let p1Goals = 0, p2Goals = 0;
  match.rounds.forEach(r => {
    if (r === 'draw') { p1Goals++; p2Goals++; }
    else if (r === 'p1') p1Goals++;
    else if (r === 'p2') p2Goals++;
  });
  p1.played++; p2.played++;
  p1.goalsFor += p1Goals; p1.goalsAgainst += p2Goals;
  p2.goalsFor += p2Goals; p2.goalsAgainst += p1Goals;
  if (p1Goals > p2Goals) {
    match.result = 'p1';
    p1.wins++; p2.losses++;
    p1.points += 3;
    pushLast5(p1, 'W'); pushLast5(p2, 'L');
  } else if (p2Goals > p1Goals) {
    match.result = 'p2';
    p2.wins++; p1.losses++;
    p2.points += 3;
    pushLast5(p2, 'W'); pushLast5(p1, 'L');
  } else {
    match.result = 'draw';
    p1.draws++; p2.draws++;
    p1.points++; p2.points++;
    pushLast5(p1, 'D'); pushLast5(p2, 'D');
  }
  match.status = 'finished';
}

function pushLast5(player, mark) {
  if (!Array.isArray(player.last5)) player.last5 = [];
  player.last5.unshift(mark);
  if (player.last5.length > 5) player.last5.length = 5;
}

// Walk the schedule and resolve any match whose scheduled time has passed.
// Both bots, or a missing real user past their grace window, get simulated.
// If a slot belongs to a real user who's currently in a live league room
// (room.leagueMatchId === match.id), we don't auto-resolve; that match is
// being played live.
function processDueMatchesGlobal() {
  if (!globalLeague) return;
  const now = Date.now();
  let changed = false;
  for (const match of globalLeague.schedule) {
    if (match.status === 'finished') continue;
    if (match.status === 'live') continue; // someone is playing it right now
    if (match.scheduledAt > now) break; // schedule is in chronological order
    const s1 = globalLeague.slots.find(s => s.slotId === match.p1);
    const s2 = globalLeague.slots.find(s => s.slotId === match.p2);
    if (!s1 || !s2) { match.status = 'finished'; continue; }
    const involvesUser = s1.userId || s2.userId;
    if (involvesUser && now < match.scheduledAt + LEAGUE_NO_SHOW_GRACE_MS) {
      continue; // grace window — let the user show up
    }
    while (match.rounds.length < 2) {
      match.rounds.push(simulateRound(s1, s2));
    }
    recordMatchResult(globalLeague, match);
    changed = true;
  }
  if (changed) saveLeague();
}

function getLeagueStandings(league) {
  return [...league.slots].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });
}

// League state lives in memory + (best-effort) on disk via the same
// users-db.json mechanism users use. We don't have a separate store yet;
// for now persistence happens through saveUsers via globalLeague being
// referenced from a sentinel "league" key in usersDB.
function saveLeague() {
  // Tag the league onto a sentinel key so saveUsers serializes it
  if (globalLeague) usersDB.set('__league__', { id: '__league__', league: globalLeague });
  saveUsers();
}
// Restore on boot if present
(function restoreLeague() {
  const sentinel = usersDB.get('__league__');
  if (sentinel?.league?.schedule) globalLeague = sentinel.league;
})();

// Periodic global catch-up: bot fixtures auto-resolve, prizes pay out
// when the season ends, and the next season auto-starts after the break.
setInterval(() => {
  if (!globalLeague) return;
  processDueMatchesGlobal();
  maybeFinishSeasonGlobal();
}, 60 * 1000);

// Ranked seasons run on their own 4-week cadence — checked hourly. The
// rollover is idempotent (it bails when Date.now() < endsAt) so the
// interval can fire whenever; we also call it once on boot below so a
// long downtime doesn't push the rollover past its window.
setInterval(() => { try { maybeRolloverRankedSeason(); } catch(e){ console.error('[Ranked] rollover failed:', e); } }, 60 * 60 * 1000);

app.get('/api/league/me', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const league = initGlobalLeague();
  const mySlot = ensureUserInLeague(user);
  saveLeague();
  const now = Date.now();
  const standings = getLeagueStandings(league).map((slot, i) => {
    const rank = i + 1;
    const zone = rank <= 4 ? 'champions' : rank <= 8 ? 'europa' : rank === 9 ? 'safe' : 'relegation';
    return {
      rank, zone,
      slotId: slot.slotId, name: slot.name, avatar: slot.avatar,
      isMe: slot.userId === user.id,
      isBot: !slot.userId,
      isOtherUser: !!slot.userId && slot.userId !== user.id,
      played: slot.played, wins: slot.wins, draws: slot.draws, losses: slot.losses,
      goalsFor: slot.goalsFor, goalsAgainst: slot.goalsAgainst,
      goalDifference: slot.goalsFor - slot.goalsAgainst,
      points: slot.points,
      last5: slot.last5 || [],
    };
  });
  const mySlotId = mySlot?.slotId;
  const myMatches = mySlotId ? league.schedule
    .filter(m => m.p1 === mySlotId || m.p2 === mySlotId)
    .map(m => {
      const isP1 = m.p1 === mySlotId;
      const oppSlot = league.slots.find(s => s.slotId === (isP1 ? m.p2 : m.p1));
      const userResult = m.status === 'finished'
        ? (m.result === 'draw' ? 'D' : (m.result === (isP1 ? 'p1' : 'p2') ? 'W' : 'L'))
        : null;
      const myGoals = m.rounds.filter(r => r === 'draw' ? true : r === (isP1 ? 'p1' : 'p2')).length;
      const oppGoals = m.rounds.filter(r => r === 'draw' ? true : r === (isP1 ? 'p2' : 'p1')).length;
      const inWindow = now >= m.scheduledAt && now < m.scheduledAt + LEAGUE_NO_SHOW_GRACE_MS;
      const upcoming = now < m.scheduledAt;
      const startsIn = upcoming ? m.scheduledAt - now : 0;
      return {
        id: m.id,
        day: m.day,
        slot: m.slot,
        scheduledAt: m.scheduledAt,
        status: m.status,
        result: userResult,
        score: m.status === 'finished' ? `${myGoals}-${oppGoals}` : null,
        opponent: oppSlot ? {
          slotId: oppSlot.slotId, name: oppSlot.name, avatar: oppSlot.avatar,
          isBot: !oppSlot.userId,
        } : null,
        playable: m.status === 'scheduled' && inWindow,
        upcoming,
        startsIn,
      };
    }) : [];
  res.json({
    season: league.season,
    seasonNumber: league.seasonNumber || 1,
    startedAt: league.startedAt,
    daysPerSeason: LEAGUE_DAYS_PER_SEASON,
    fixturesPerDay: LEAGUE_FIXTURES_PER_DAY,
    totalPlayers: LEAGUE_TOTAL_PLAYERS,
    finishedAt: league.finishedAt || null,
    nextSeasonAt: league.nextSeasonAt || null,
    podium: league.podium || null,
    previousSeasonPodium: league.previousSeasonPodium || null,
    prizes: LEAGUE_PRIZES,
    mySlotId,
    serverNow: now,
    standings,
    myMatches,
  });
});

app.post('/api/league/match/:matchId/start', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const league = initGlobalLeague();
  const mySlot = ensureUserInLeague(user);
  if (!mySlot) return res.status(400).json({ error: 'No league seat available' });
  const match = league.schedule.find(m => m.id === req.params.matchId);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (match.status === 'finished') return res.status(400).json({ error: 'Already played' });
  if (match.p1 !== mySlot.slotId && match.p2 !== mySlot.slotId) return res.status(400).json({ error: 'Not your match' });
  const now = Date.now();
  if (now < match.scheduledAt) {
    const minsLeft = Math.ceil((match.scheduledAt - now) / 60000);
    return res.status(400).json({ error: `Match starts in ${minsLeft}m` });
  }
  if (now >= match.scheduledAt + LEAGUE_NO_SHOW_GRACE_MS) {
    return res.status(400).json({ error: 'Window expired — bot already played for you' });
  }

  const oppSlotId = match.p1 === mySlot.slotId ? match.p2 : match.p1;
  const oppSlot = league.slots.find(s => s.slotId === oppSlotId);
  if (!oppSlot) return res.status(500).json({ error: 'Opponent not found' });

  const room = createRoomRecord(user.id, { maxPlayers: 2, bet: 0 });
  room.game = new GameManager(room.id, room.settings);
  room.leagueMatchId = match.id;
  room.leagueOwnerId = user.id;
  attachGameListeners(room);

  const userPlayer = new Player(user.id, user.username, user.coins);
  userPlayer.avatar = user.avatar; userPlayer.cardBackId = user.equippedCardBack || 'cb_default';
  room.game.addPlayer(userPlayer);
  room.playerIds.push(user.id);

  // Opponent: always AI in the live match (even if their slot belongs to
  // another real user — they'll see the result async). Phase 2 = live PvP.
  const oppPlayer = new Player(oppSlot.slotId, oppSlot.name, 0);
  oppPlayer.isBot = true;
  oppPlayer.isConnected = true;
  oppPlayer.status = 'active';
  oppPlayer.avatar = oppSlot.avatar;
  room.game.addPlayer(oppPlayer);
  room.playerIds.push(oppSlot.slotId);

  match.status = 'live';
  roomsDB.set(room.id, room);
  saveLeague();

  res.json({ roomId: room.id, opponent: oppSlot.name });
});

// League Hub — returns the user's full ranking context: their ELO,
// their league, their rank in the global classement, neighbours
// around them (5 above, 5 below), top 10, and their last matches.
app.get('/api/competitions/me', authMiddleware, (req, res) => {
  const me = usersDB.get(req.user.userId);
  if (!me) return res.status(404).json({ error: 'User not found' });
  const all = [...usersDB.values()]
    .filter(u => u.username && u.id && !String(u.id).startsWith('__'))
    .map(u => ({
      id: u.id, username: u.username, avatar: u.avatar,
      elo: u.elo || 1000,
      gamesPlayed: u.stats?.gamesPlayed || 0,
      gamesWon: u.stats?.gamesWon || 0,
    }))
    .sort((a, b) => b.elo - a.elo);
  const rank = all.findIndex(u => u.id === me.id) + 1;
  const myEntry = all[rank - 1];
  const start = Math.max(0, rank - 6);
  const end = Math.min(all.length, rank + 5);
  const neighbours = all.slice(start, end).map((u, i) => ({ ...u, rank: start + i + 1 }));
  const top = all.slice(0, 10).map((u, i) => ({ ...u, rank: i + 1 }));
  const league = getLeague(me.elo || 1000);
  // progress to next league
  const nextLeague = LEAGUES.find(l => l.min > league.min) || null;
  const progress = nextLeague
    ? Math.min(100, Math.round(((me.elo - league.min) / (nextLeague.min - league.min)) * 100))
    : 100;
  res.json({
    me: { ...myEntry, rank, league, nextLeague, progress },
    neighbours,
    top,
    matchHistory: (me.matchHistory || []).slice(0, 10),
    totalPlayers: all.length,
  });
});

app.post('/api/profile/avatar', authMiddleware, validateBody({ avatar:{ type:'string', required:true, max:512 } }), (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { avatar } = req.body;
  if (typeof avatar !== 'string' || !avatar.trim()) {
    return res.status(400).json({ error: 'Invalid avatar' });
  }
  const a = avatar.trim();
  // Allowed avatar forms — nothing else (no data: URIs, no external URLs →
  // blocks XSS / SSRF / hot-linking):
  //   1. Any catalog avatar (preset or premium) the user OWNS.
  //   2. A short emoji/initial string (legacy), ≤ 16 chars.
  const catItem = AVATAR_BY_SRC.get(a);
  if (catItem) {
    ensureAvatarFields(user);
    if (!user.ownedAvatars.includes(catItem.id)) {
      return res.status(403).json({ error: 'You do not own this avatar' });
    }
    user.avatar = a;
    saveUsers();
    return res.json({ avatar: user.avatar });
  }
  const isShortText = !/^(data:|https?:|\/)/i.test(a) && a.length <= 16;
  if (!isShortText) {
    return res.status(400).json({ error: 'Only owned avatars are allowed' });
  }
  user.avatar = a;
  saveUsers();
  res.json({ avatar: user.avatar });
});

// Profile banner — ornate frame plaque behind the profile header. Banners are
// RANKED REWARDS: royal-gold is free for everyone, the rest unlock once the
// player's PEAK rank reaches the matching ranked tier (RP thresholds mirror the
// LEAGUES ladder). Peak is used so a banner, once earned, is kept forever.
const BANNER_MIN_RP = {
  'royal-gold':    0,      // everyone (default)
  'sapphire':      2400,   // Platinum
  'royal-crimson': 3900,   // Diamond
  'amethyst':      6000,   // Master
  'inferno':       9000,   // Grandmaster
};
function bannerPeakRP(user){ return Math.max(user.peakRankPoints || 0, user.rankPoints || 0); }

app.post('/api/profile/banner', authMiddleware, validateBody({ banner:{ type:'string', required:true, max:32 } }), (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const banner = String(req.body?.banner || '').trim();
  const min = BANNER_MIN_RP[banner];
  if (min === undefined) return res.status(400).json({ error: 'Unknown banner' });
  if (bannerPeakRP(user) < min) return res.status(403).json({ error: 'Banner locked — reach the required rank first' });
  user.profileBanner = banner;
  saveUsers();
  res.json({ success: true, profileBanner: banner });
});

// Toggle an avatar Collection favourite (⭐).
app.post('/api/avatars/favorite', authMiddleware, (req, res) => {
  const { id, on } = req.body || {};
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  ensureAvatarFields(user);
  if (!AVATAR_BY_ID.has(id)) return res.status(404).json({ error: 'Unknown avatar' });
  const set = new Set(user.favoriteAvatars);
  if (on) set.add(id); else set.delete(id);
  user.favoriteAvatars = [...set];
  saveUsers();
  res.json({ success: true, favorites: user.favoriteAvatars });
});

// Profile Showcase — set the displayed Title (must be one the player earned).
app.post('/api/profile/title', authMiddleware, validateBody({ title:{ type:'string', max:64 } }), (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const title = req.body?.title;
  if (title === null || title === '') { user.activeTitle = null; saveUsers(); return res.json({ success: true, activeTitle: null }); }
  if (typeof title !== 'string') return res.status(400).json({ error: 'Invalid title' });
  if (!Array.isArray(user.titles) || !user.titles.includes(title)) return res.status(403).json({ error: "You haven't earned this title" });
  user.activeTitle = title;
  saveUsers();
  res.json({ success: true, activeTitle: title });
});

// Toggle a cosmetic (card back / felt / dama board) Collection favourite.
app.post('/api/cosmetics/favorite', authMiddleware, (req, res) => {
  const { type, id, on } = req.body || {};
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  ensureCosmeticFields(user);
  const key = type === 'cardBack'  ? 'favoriteCardBacks'
            : type === 'tableFelt' ? 'favoriteTableFelts'
            : type === 'damaBoard' ? 'favoriteDamaBoards'
            : null;
  if (!key) return res.status(400).json({ error: 'Bad type' });
  const set = new Set(user[key]);
  if (on) set.add(id); else set.delete(id);
  user[key] = [...set];
  saveUsers();
  res.json({ success: true, favorites: user[key] });
});

app.delete('/api/profile/avatar', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.avatar = null;
  saveUsers();
  res.json({ success: true });
});

app.post('/api/coins/insta-reward', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.instaFollowed) return res.status(400).json({ error: 'Already claimed Instagram reward' });
  user.instaFollowed = true;
  user.coins += CONFIG.INSTA_REWARD;
  user.brokeCount2 = 0;
  logReward(user, '📸', 'Instagram Follow Bonus', CONFIG.INSTA_REWARD);
  saveUsers();
  console.log(`[Coins] Instagram reward: +${CONFIG.INSTA_REWARD} for ${user.username}`);
  res.json({ coins: user.coins, earned: CONFIG.INSTA_REWARD });
});
// Trophy Cabinet — every prize the user has won, newest first
app.get('/api/rewards', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const rewards = Array.isArray(user.rewards) ? user.rewards : [];
  const totalWon = rewards.reduce((s, r) => s + (r.amount || 0), 0);
  res.json({ rewards, totalWon, count: rewards.length });
});

// ─────────────────────────────────────────
// BATTLE PASS
// ─────────────────────────────────────────
function buildBPTiers() {
  const rar = ['common','common','rare','common','rare','epic','common','rare','common','epic',
               'rare','common','epic','rare','common','epic','rare','legendary','rare','legendary'];
  const tiers = [];
  for (let i = 0; i < 20; i++) {
    const lvl = i + 1;
    const freeAmt = 150 + i * 50;
    const premAmt = 500 + i * 220;
    // GDD §6.2 — premium track gets DIAMOND bonuses every 5 tiers (T5/T10/T15/T20).
    // The big finish tiers (T20 = legendary) get extra. Free track stays coins-only
    // (premium 2x multiplier on free claims is applied in /api/battlepass/claim).
    let premReward;
    if (lvl % 5 === 0) {
      const dia = lvl === 20 ? 200 : 50 + (lvl / 5 - 1) * 25;     // T5=50, T10=75, T15=100, T20=200
      premReward = {
        type:'diamonds', amount:dia, rarity: lvl === 20 ? 'legendary' : 'epic',
        icon:'💎', label:`${dia}`,
      };
    } else {
      premReward = {
        type:'coins', amount:premAmt, rarity:rar[i]||'rare',
        icon: rar[i]==='legendary'?'💎':rar[i]==='epic'?'🔥':'🪙',
        label: `${premAmt}`,
      };
    }
    tiers.push({
      free: { type:'coins', amount:freeAmt, rarity:'common', icon:'🪙', label:`${freeAmt}` },
      prem: premReward,
    });
  }
  return tiers;
}
const BP_SEASON = {
  number: 1,
  name: 'Season 1 · Neon Rush',
  endsAt: new Date('2026-06-17T20:00:00Z').getTime(),
  xpPerTier: 1000,
  premiumPrice: 20000,
  tiers: buildBPTiers(),
};
function ensureBP(user) {
  if (!user.bp || user.bp.season !== BP_SEASON.number) {
    user.bp = { season: BP_SEASON.number, xp: 0, claimed: [], premium: false };
  }
  if (!Array.isArray(user.bp.claimed)) user.bp.claimed = [];
  return user.bp;
}
function bpLevel(bp) {
  return Math.min(BP_SEASON.tiers.length, Math.floor(bp.xp / BP_SEASON.xpPerTier));
}

app.get('/api/battlepass', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const bp = ensureBP(user);
  saveUsers();
  res.json({
    season: BP_SEASON.number, name: BP_SEASON.name, endsAt: BP_SEASON.endsAt,
    xpPerTier: BP_SEASON.xpPerTier, premiumPrice: BP_SEASON.premiumPrice,
    tiers: BP_SEASON.tiers,
    xp: bp.xp, level: bpLevel(bp), claimed: bp.claimed, premium: !!bp.premium,
    coins: user.coins,
  });
});

app.post('/api/battlepass/claim', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const bp = ensureBP(user);
  const tier = parseInt(req.body?.tier, 10);          // 1-based tier number
  const track = req.body?.track === 'prem' ? 'prem' : 'free';
  if (!(tier >= 1 && tier <= BP_SEASON.tiers.length)) return res.status(400).json({ error: 'Bad tier' });
  if (bpLevel(bp) < tier) return res.status(400).json({ error: 'Tier not reached yet' });
  if (track === 'prem' && !bp.premium) return res.status(403).json({ error: 'Premium pass required' });
  const key = `${tier}:${track}`;
  if (bp.claimed.includes(key)) return res.status(400).json({ error: 'Already claimed' });
  const reward = BP_SEASON.tiers[tier - 1][track];
  bp.claimed.push(key);

  // GDD §6.2 — actual granted amount can differ from the tier's listed amount:
  //   * Free track + premium owned -> 2x multiplier (premium perk)
  //   * Diamonds reward (premium-only) -> goes to user.diamonds, not coins
  let grantedCoins    = 0;
  let grantedDiamonds = 0;
  if (reward.type === 'coins') {
    grantedCoins = reward.amount;
    if (track === 'free' && bp.premium) grantedCoins *= 2;       // premium 2x perk
    user.coins += grantedCoins;
    logReward(user, track==='prem'?'👑':'🎟️',
      `Battle Pass T${tier} — ${BP_SEASON.name}${(track==='free' && bp.premium)?' (premium 2x)':''}`,
      grantedCoins);
  } else if (reward.type === 'diamonds') {
    grantedDiamonds = reward.amount;
    user.diamonds = (user.diamonds || 0) + grantedDiamonds;
    logReward(user, '💎', `Battle Pass T${tier} — ${BP_SEASON.name}`, grantedDiamonds);
  }
  saveUsers();
  // Echo what actually landed so the client can show the right toast and
  // animate both pills (the existing client read d.coins only — it now also
  // reads d.diamonds).
  res.json({
    success:  true,
    coins:    user.coins,
    diamonds: user.diamonds || 0,
    claimed:  bp.claimed,
    reward,
    granted:  { coins: grantedCoins, diamonds: grantedDiamonds, multiplied: track==='free' && bp.premium && reward.type==='coins' },
  });
});

app.post('/api/battlepass/unlock', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const bp = ensureBP(user);
  if (bp.premium) return res.status(400).json({ error: 'Already unlocked' });
  if ((user.coins || 0) < BP_SEASON.premiumPrice)
    return res.status(400).json({ error: `Need ${BP_SEASON.premiumPrice.toLocaleString()} coins` });
  user.coins -= BP_SEASON.premiumPrice;
  bp.premium = true;
  saveUsers();
  res.json({ success:true, coins:user.coins, premium:true });
});

// GDD §6.2 — alt premium unlock paid in diamonds (parallel to the coin path).
// $9.99 in real money would be ~1000 simulated diamonds; we use 200 for trial
// usability so testers can actually try the path without grinding.
const BP_PREMIUM_DIAMOND_PRICE = 200;
app.post('/api/battlepass/unlock-diamonds', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const bp = ensureBP(user);
  if (bp.premium) return res.status(400).json({ error: 'Already unlocked' });
  if ((user.diamonds || 0) < BP_PREMIUM_DIAMOND_PRICE)
    return res.status(402).json({ error: `Need ${BP_PREMIUM_DIAMOND_PRICE} diamonds`, need: BP_PREMIUM_DIAMOND_PRICE, have: user.diamonds || 0 });
  user.diamonds -= BP_PREMIUM_DIAMOND_PRICE;
  bp.premium = true;
  saveUsers();
  res.json({ success:true, coins:user.coins, diamonds:user.diamonds, premium:true });
});

// GDD §6.2 — "Skip to tier" instant buy. The GDD spec is "skip to tier 50 for
// $4.99"; we only have 20 tiers, so the trial equivalent is "skip 10 tiers for
// 50 diamonds". Adds 10×xpPerTier XP, capped at the season's tier ceiling, so
// users at low levels jump roughly half the pass and high-level users get
// clamped without losing diamonds (refunds if they're already at max).
const BP_SKIP_DIAMOND_PRICE = 50;
const BP_SKIP_TIERS         = 10;
app.post('/api/battlepass/skip', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const bp = ensureBP(user);
  if ((user.diamonds || 0) < BP_SKIP_DIAMOND_PRICE)
    return res.status(402).json({ error: `Need ${BP_SKIP_DIAMOND_PRICE} diamonds`, need: BP_SKIP_DIAMOND_PRICE, have: user.diamonds || 0 });
  const currentLevel = bpLevel(bp);
  if (currentLevel >= BP_SEASON.tiers.length) {
    return res.status(400).json({ error: 'Already at max tier' });
  }
  user.diamonds -= BP_SKIP_DIAMOND_PRICE;
  bp.xp += BP_SKIP_TIERS * BP_SEASON.xpPerTier;
  // Cap at the season ceiling so we don't grow xp beyond the highest tier.
  const maxXP = BP_SEASON.tiers.length * BP_SEASON.xpPerTier;
  if (bp.xp > maxXP) bp.xp = maxXP;
  const newLevel = bpLevel(bp);
  saveUsers();
  console.log(`[BP] ${user.username} skipped ${BP_SKIP_TIERS} tiers (${currentLevel} -> ${newLevel}) for ${BP_SKIP_DIAMOND_PRICE} 💎`);
  res.json({
    success:true,
    coins: user.coins, diamonds: user.diamonds,
    bp: { xp: bp.xp, level: newLevel, premium: !!bp.premium, claimed: bp.claimed },
    jumped: { from: currentLevel, to: newLevel },
  });
});

// ─────────────────────────────────────────
// SEASONAL EVENTS — temporary live overlays layered ABOVE the base themes.
// An event is a time-boxed layer: decorations, particles, missions and a
// featured reward. Activate/deactivate purely by editing startsAt/endsAt —
// no code path changes. getActiveEvent() picks whichever window covers now.
// ─────────────────────────────────────────
const EVENTS = [
  // Grand Anniversary event removed per user request.
  {
    id: 'halloween',
    name: 'Halloween Nights',
    tagline: 'The tables turn dark — spooky rewards await',
    icon: '🎃', logo: '🎃',
    color: '#FF7518', color2: '#7B2CBF',
    prop: 'pumpkin',
    startsAt: new Date('2026-10-24T00:00:00Z').getTime(),
    endsAt:   new Date('2026-11-02T23:59:59Z').getTime(),
    announcements: [
      '🎃 Halloween Nights has crept in — spooky rewards await',
      '👻 Win games to earn the Haunted card back',
      '🦇 Limited-time — the dark tables fade after November 2',
    ],
    featured: { icon:'🦇', name:'Haunted Card Back', desc:'Glowing purple card skin', rarity:'epic' },
    missions: [
      { id:'login', icon:'🕯️', name:'Enter the Haunt', desc:'Log in during the event', stat:'login',  target:1, reward:800 },
      { id:'play',  icon:'🎮', name:'Trick or Treat',  desc:'Play 6 games',           stat:'played', target:6, reward:1200 },
      { id:'win',   icon:'👻', name:'Ghost Hunter',    desc:'Win 4 games',            stat:'won',    target:4, reward:2600 },
    ],
  },
  {
    id: 'newyear',
    name: 'New Year Countdown',
    tagline: 'Ring in the new year — fireworks & fortune',
    icon: '🎆', logo: '🎆',
    color: '#7DF9FF', color2: '#F59E0B',
    prop: 'firework',
    startsAt: new Date('2026-12-28T00:00:00Z').getTime(),
    endsAt:   new Date('2027-01-03T23:59:59Z').getTime(),
    announcements: [
      '🎆 New Year Countdown — fireworks light up the lobby',
      '🥂 Complete missions before midnight for bonus fortune',
      '✨ A fresh year, a fresh stack of rewards',
    ],
    featured: { icon:'🎇', name:'Fireworks Emote', desc:'Celebratory in-game emote', rarity:'epic' },
    missions: [
      { id:'login', icon:'🎇', name:'Happy New Year',   desc:'Log in during the event', stat:'login',  target:1, reward:2027 },
      { id:'play',  icon:'🎮', name:'Countdown Begins', desc:'Play 5 games',           stat:'played', target:5, reward:1500 },
      { id:'win',   icon:'🥂', name:'Toast to Victory', desc:'Win 3 games',            stat:'won',    target:3, reward:3000 },
    ],
  },
];

function getActiveEvent(now = Date.now()) {
  return EVENTS.find(e => now >= e.startsAt && now <= e.endsAt) || null;
}

function ensureEventState(user, ev) {
  // Snapshot the player's stats when they first see an event so mission
  // progress is scoped to the event window, not their lifetime totals.
  if (!user.eventState || user.eventState.id !== ev.id) {
    user.eventState = {
      id: ev.id,
      claimed: [],
      base: { played: user.stats?.gamesPlayed || 0, won: user.stats?.gamesWon || 0 },
      joinedAt: Date.now(),
    };
  }
  if (!Array.isArray(user.eventState.claimed)) user.eventState.claimed = [];
  return user.eventState;
}

function eventMissionProgress(user, m) {
  const base = user.eventState?.base || { played: 0, won: 0 };
  if (m.stat === 'login')  return 1;
  if (m.stat === 'played') return Math.max(0, (user.stats?.gamesPlayed || 0) - (base.played || 0));
  if (m.stat === 'won')    return Math.max(0, (user.stats?.gamesWon || 0) - (base.won || 0));
  return 0;
}

app.get('/api/event', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const ev = getActiveEvent();
  if (!ev) return res.json({ active: false });
  const st = ensureEventState(user, ev);
  saveUsers();
  const missions = ev.missions.map(m => {
    const cur = eventMissionProgress(user, m);
    return {
      id: m.id, icon: m.icon, name: m.name, desc: m.desc, target: m.target, reward: m.reward,
      current: Math.min(cur, m.target),
      complete: cur >= m.target,
      claimed: st.claimed.includes(m.id),
    };
  });
  res.json({
    active: true,
    id: ev.id, name: ev.name, tagline: ev.tagline, icon: ev.icon, logo: ev.logo,
    color: ev.color, color2: ev.color2, prop: ev.prop,
    startsAt: ev.startsAt, endsAt: ev.endsAt,
    announcements: ev.announcements,
    featured: ev.featured,
    missions,
    coins: user.coins,
  });
});

app.post('/api/event/claim', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const ev = getActiveEvent();
  if (!ev) return res.status(400).json({ error: 'No active event' });
  const st = ensureEventState(user, ev);
  const m = ev.missions.find(x => x.id === String(req.body?.mission || ''));
  if (!m) return res.status(400).json({ error: 'Unknown mission' });
  if (st.claimed.includes(m.id)) return res.status(400).json({ error: 'Already claimed' });
  if (eventMissionProgress(user, m) < m.target) return res.status(400).json({ error: 'Mission not complete' });
  st.claimed.push(m.id);
  user.coins += m.reward;
  logReward(user, ev.icon, `${ev.name} — ${m.name}`, m.reward);
  saveUsers();
  res.json({ success: true, coins: user.coins, reward: m.reward, mission: m.id });
});

// ─────────────────────────────────────────
// DAILY QUESTS + STREAK  — "Road to Champion" daily loop
// ─────────────────────────────────────────
// Always-on engagement: 3 quests refresh every UTC day; each grants coins +
// Battle Pass XP (so daily play levels the pass). A consecutive-day streak
// pays milestone bonuses. Progress is derived from gamesPlayed/gamesWon
// deltas snapshotted at the start of each day (same pattern as events) — no
// per-game hook required.
const QUEST_POOL = {
  play3: { icon:'🎮', name:'Warm Up',   desc:'Play 3 games', stat:'played', target:3, coins:300,  xp:150 },
  play5: { icon:'🎯', name:'On a Roll',  desc:'Play 5 games', stat:'played', target:5, coins:500,  xp:250 },
  play8: { icon:'🔥', name:'Grinder',    desc:'Play 8 games', stat:'played', target:8, coins:800,  xp:400 },
  win1:  { icon:'🏆', name:'First Win',  desc:'Win 1 game',   stat:'won',    target:1, coins:400,  xp:200 },
  win2:  { icon:'⚔️', name:'Double Up',  desc:'Win 2 games',  stat:'won',    target:2, coins:700,  xp:350 },
  win3:  { icon:'👑', name:'Champion',   desc:'Win 3 games',  stat:'won',    target:3, coins:1000, xp:500 },
};
const DAILY_COMBOS = [
  ['play3','win1','win2'],
  ['play5','win1','win3'],
  ['play3','win2','play8'],
  ['play5','win2','win1'],
  ['play8','win1','win3'],
];
const STREAK_MILESTONES = [
  { day:3,  coins:500,  diamonds:0,  icon:'🔥' },
  { day:7,  coins:1500, diamonds:10, icon:'⭐' },
  { day:14, coins:3000, diamonds:25, icon:'💎' },
  { day:30, coins:7000, diamonds:60, icon:'👑' },
];
function _utcDay(ts = Date.now()){ return Math.floor(ts / 86400000); }
function ensureDaily(user){
  const today = _utcDay();
  if(!user.daily){
    user.daily = {
      day: today, streak: 1,
      base: { played: user.stats?.gamesPlayed||0, won: user.stats?.gamesWon||0 },
      claimed: [], streakClaimed: [],
    };
    saveUsers();
    return user.daily;
  }
  if(user.daily.day !== today){
    user.daily.streak = (user.daily.day === today - 1) ? (user.daily.streak||1) + 1 : 1;
    user.daily.day = today;
    user.daily.base = { played: user.stats?.gamesPlayed||0, won: user.stats?.gamesWon||0 };
    user.daily.claimed = [];
    if(user.daily.streak === 1) user.daily.streakClaimed = [];   // broke → milestones reset
    saveUsers();
  }
  if(!Array.isArray(user.daily.claimed)) user.daily.claimed = [];
  if(!Array.isArray(user.daily.streakClaimed)) user.daily.streakClaimed = [];
  return user.daily;
}
function _dailyQuestIds(day){ return DAILY_COMBOS[((day % DAILY_COMBOS.length) + DAILY_COMBOS.length) % DAILY_COMBOS.length]; }
function _questProgress(user, q){
  const base = user.daily?.base || { played:0, won:0 };
  const cur = q.stat === 'won' ? (user.stats?.gamesWon||0) - (base.won||0)
                               : (user.stats?.gamesPlayed||0) - (base.played||0);
  return Math.max(0, cur);
}

app.get('/api/daily', authMiddleware,
  rateLimit({ limit: 90, windowMs: 60 * 1000, label: 'daily_get', keyFn: req => req.user?.userId || req.ip }),
  (req, res) => {
  const user = usersDB.get(req.user.userId);
  if(!user) return res.status(404).json({ error:'User not found' });
  const d = ensureDaily(user);
  const quests = _dailyQuestIds(d.day).map(id => {
    const q = QUEST_POOL[id];
    const cur = _questProgress(user, q);
    return { id, icon:q.icon, name:q.name, desc:q.desc, target:q.target, coins:q.coins, xp:q.xp,
             current: Math.min(cur, q.target), complete: cur >= q.target, claimed: d.claimed.includes(id) };
  });
  const milestones = STREAK_MILESTONES.map(m => ({
    day:m.day, coins:m.coins, diamonds:m.diamonds, icon:m.icon,
    reached: d.streak >= m.day, claimed: d.streakClaimed.includes(m.day),
  }));
  res.json({
    streak: d.streak,
    quests, milestones,
    nextResetAt: (d.day + 1) * 86400000,
    bpXp: (user.bp?.xp) || 0, bpLevel: user.bp ? bpLevel(user.bp) : 0, xpPerTier: BP_SEASON.xpPerTier,
    coins: user.coins, diamonds: user.diamonds || 0,
  });
});

app.post('/api/daily/claim', authMiddleware,
  rateLimit({ limit: 40, windowMs: 60 * 1000, label: 'daily_claim', keyFn: req => req.user?.userId || req.ip }),
  validateBody({ quest:{ type:'string', required:true, max:64 } }), (req, res) => {
  const user = usersDB.get(req.user.userId);
  if(!user) return res.status(404).json({ error:'User not found' });
  const d = ensureDaily(user);
  const id = String(req.body?.quest || '');
  if(!_dailyQuestIds(d.day).includes(id)) return res.status(400).json({ error:'Not a quest today' });
  const q = QUEST_POOL[id];
  if(d.claimed.includes(id)) return res.status(400).json({ error:'Already claimed' });
  if(_questProgress(user, q) < q.target) return res.status(400).json({ error:'Quest not complete' });
  d.claimed.push(id);
  user.coins += q.coins;
  user.dailyQuestsClaimedTotal = (user.dailyQuestsClaimedTotal || 0) + 1;   // Social contract metric
  const bp = ensureBP(user); bp.xp += q.xp;
  logReward(user, '🎯', `Daily Quest — ${q.name}`, q.coins);
  saveUsers();
  res.json({ success:true, coins:user.coins, xpGained:q.xp, bpXp:bp.xp, bpLevel:bpLevel(bp), claimed:d.claimed });
});

app.post('/api/daily/claim-streak', authMiddleware,
  rateLimit({ limit: 40, windowMs: 60 * 1000, label: 'streak_claim', keyFn: req => req.user?.userId || req.ip }),
  (req, res) => {
  const user = usersDB.get(req.user.userId);
  if(!user) return res.status(404).json({ error:'User not found' });
  const d = ensureDaily(user);
  const day = parseInt(req.body?.milestone, 10);
  const m = STREAK_MILESTONES.find(x => x.day === day);
  if(!m) return res.status(400).json({ error:'Unknown milestone' });
  if(d.streak < m.day) return res.status(400).json({ error:'Streak not reached yet' });
  if(d.streakClaimed.includes(m.day)) return res.status(400).json({ error:'Already claimed' });
  d.streakClaimed.push(m.day);
  user.coins += m.coins;
  if(m.diamonds) user.diamonds = (user.diamonds||0) + m.diamonds;
  logReward(user, m.icon, `${m.day}-Day Streak Reward`, m.coins);
  saveUsers();
  res.json({ success:true, coins:user.coins, diamonds:user.diamonds||0, streakClaimed:d.streakClaimed });
});

// ─────────────────────────────────────────
// SEASON CONTRACTS — pick a path, chase its objectives, earn a Title
// ─────────────────────────────────────────
// Unlike one-pass-for-all, the player chooses a Contract that matches how they
// like to play. Each has 3 escalating objectives (coins + Battle Pass XP) and a
// completion reward (coins + diamonds + a permanent Title). "delta" objectives
// snapshot a base when the contract is picked; "state" objectives read a live
// total (avatars owned, favourites, daily-quests claimed).
const CONTRACTS = [
  {
    id:'competitor', name:'Competitor', icon:'⚔️', color:'#E8324A',
    tagline:'Win, climb, dominate.', title:'Gladiator', reward:{ coins:2000, diamonds:50 },
    objectives:[
      { id:'c1', desc:'Win 10 games',       type:'delta', stat:'won',        target:10, coins:800,  xp:200 },
      { id:'c2', desc:'Win 5 ranked games', type:'delta', stat:'rankedWins', target:5,  coins:1500, xp:400 },
      { id:'c3', desc:'Win 30 games',       type:'delta', stat:'won',        target:30, coins:2500, xp:700 },
    ],
  },
  {
    id:'collector', name:'Collector', icon:'🎴', color:'#A855F7',
    tagline:'Build the ultimate vault.', title:'Curator', reward:{ coins:2000, diamonds:40 },
    objectives:[
      { id:'c1', desc:'Own 12 avatars',   type:'state', stat:'avatars',   target:12, coins:800,  xp:200 },
      { id:'c2', desc:'Favorite 6 items', type:'state', stat:'favorites', target:6,  coins:1200, xp:300 },
      { id:'c3', desc:'Own 24 avatars',   type:'state', stat:'avatars',   target:24, coins:1800, xp:400 },
    ],
  },
  {
    id:'social', name:'Social', icon:'🎉', color:'#22C55E',
    tagline:'Play, day after day.', title:'Socialite', reward:{ coins:2000, diamonds:40 },
    objectives:[
      { id:'c1', desc:'Play 15 games',        type:'delta', stat:'played',      target:15, coins:700,  xp:200 },
      { id:'c2', desc:'Claim 8 daily quests', type:'state', stat:'dailyClaims', target:8,  coins:1500, xp:400 },
      { id:'c3', desc:'Play 40 games',        type:'delta', stat:'played',      target:40, coins:2000, xp:500 },
    ],
  },
];
const CONTRACT_BY_ID = new Map(CONTRACTS.map(c => [c.id, c]));
function _statVal(user, stat){
  switch(stat){
    case 'won':         return user.stats?.gamesWon || 0;
    case 'played':      return user.stats?.gamesPlayed || 0;
    case 'rankedWins':  return user.rankedWins || 0;
    case 'avatars':     return (user.ownedAvatars || []).length;
    case 'favorites':   return (user.favoriteAvatars||[]).length + (user.favoriteCardBacks||[]).length
                              + (user.favoriteTableFelts||[]).length + (user.favoriteDamaBoards||[]).length;
    case 'dailyClaims': return user.dailyQuestsClaimedTotal || 0;
    default:            return 0;
  }
}
function ensureContract(user){
  if(user.contract && !CONTRACT_BY_ID.has(user.contract.id)) user.contract = null;
  return user.contract || null;
}
function _objProgress(user, o){
  if(o.type === 'state') return _statVal(user, o.stat);
  const base = user.contract?.base?.[o.stat] || 0;
  return Math.max(0, _statVal(user, o.stat) - base);
}

app.get('/api/contracts', authMiddleware,
  rateLimit({ limit: 90, windowMs: 60 * 1000, label: 'contracts_get', keyFn: req => req.user?.userId || req.ip }),
  (req, res) => {
  const user = usersDB.get(req.user.userId); if(!user) return res.status(404).json({ error:'User not found' });
  ensureAvatarFields(user); ensureCosmeticFields(user);
  const active = ensureContract(user);
  const contracts = CONTRACTS.map(c => {
    const selected = !!active && active.id === c.id;
    const objectives = c.objectives.map(o => {
      const cur = selected ? _objProgress(user, o) : 0;
      return { id:o.id, desc:o.desc, target:o.target, coins:o.coins, xp:o.xp,
               current: Math.min(cur, o.target), complete: selected && cur >= o.target,
               claimed: selected && (active.claimed||[]).includes(o.id) };
    });
    return { id:c.id, name:c.name, icon:c.icon, color:c.color, tagline:c.tagline, title:c.title, reward:c.reward,
             selected, objectives, allDone: selected && objectives.every(o=>o.complete),
             rewardClaimed: selected && !!active.completed };
  });
  res.json({ active: active?active.id:null, contracts, coins:user.coins, diamonds:user.diamonds||0,
             titles:user.titles||[], activeTitle:user.activeTitle||null });
});

app.post('/api/contracts/select', authMiddleware,
  rateLimit({ limit: 40, windowMs: 60 * 1000, label: 'contract_select', keyFn: req => req.user?.userId || req.ip }),
  validateBody({ id:{ type:'string', required:true, max:64 } }), (req, res) => {
  const user = usersDB.get(req.user.userId); if(!user) return res.status(404).json({ error:'User not found' });
  const c = CONTRACT_BY_ID.get(String(req.body?.id||'')); if(!c) return res.status(400).json({ error:'Unknown contract' });
  if(user.contract && user.contract.id === c.id) return res.json({ success:true, active:c.id });
  user.contract = {
    id:c.id, completed:false, claimed:[],
    base:{ won:user.stats?.gamesWon||0, played:user.stats?.gamesPlayed||0, rankedWins:user.rankedWins||0 },
  };
  saveUsers();
  res.json({ success:true, active:c.id });
});

app.post('/api/contracts/claim', authMiddleware,
  rateLimit({ limit: 40, windowMs: 60 * 1000, label: 'contract_claim', keyFn: req => req.user?.userId || req.ip }),
  validateBody({ objective:{ type:'string', required:true, max:64 } }), (req, res) => {
  const user = usersDB.get(req.user.userId); if(!user) return res.status(404).json({ error:'User not found' });
  const active = ensureContract(user); if(!active) return res.status(400).json({ error:'No contract selected' });
  const c = CONTRACT_BY_ID.get(active.id);
  const o = c.objectives.find(x => x.id === String(req.body?.objective||'')); if(!o) return res.status(400).json({ error:'Unknown objective' });
  if(!Array.isArray(active.claimed)) active.claimed = [];
  if(active.claimed.includes(o.id)) return res.status(400).json({ error:'Already claimed' });
  if(_objProgress(user, o) < o.target) return res.status(400).json({ error:'Objective not complete' });
  active.claimed.push(o.id);
  user.coins += o.coins;
  const bp = ensureBP(user); bp.xp += o.xp;
  logReward(user, c.icon, `Contract — ${o.desc}`, o.coins);
  saveUsers();
  res.json({ success:true, coins:user.coins, xpGained:o.xp, claimed:active.claimed });
});

app.post('/api/contracts/claim-reward', authMiddleware,
  rateLimit({ limit: 40, windowMs: 60 * 1000, label: 'contract_reward', keyFn: req => req.user?.userId || req.ip }),
  (req, res) => {
  const user = usersDB.get(req.user.userId); if(!user) return res.status(404).json({ error:'User not found' });
  const active = ensureContract(user); if(!active) return res.status(400).json({ error:'No contract selected' });
  const c = CONTRACT_BY_ID.get(active.id);
  if(active.completed) return res.status(400).json({ error:'Already claimed' });
  if(!c.objectives.every(o => _objProgress(user, o) >= o.target)) return res.status(400).json({ error:'Complete all objectives first' });
  active.completed = true;
  user.coins += c.reward.coins;
  if(c.reward.diamonds) user.diamonds = (user.diamonds||0) + c.reward.diamonds;
  if(!Array.isArray(user.titles)) user.titles = [];
  if(!user.titles.includes(c.title)) user.titles.push(c.title);
  user.activeTitle = c.title;
  logReward(user, '👑', `Contract complete — ${c.name} · "${c.title}"`, c.reward.coins);
  saveUsers();
  res.json({ success:true, coins:user.coins, diamonds:user.diamonds||0, title:c.title, titles:user.titles, activeTitle:user.activeTitle });
});

// ─────────────────────────────────────────
// LEADERBOARDS — Global · Morocco · Weekly · Monthly · All-Time
// ─────────────────────────────────────────
// Weekly/Monthly track wins inside the current period (incremented at the win
// hook, read read-only: a stale period reads 0 until the player wins again).
function _weekId(ts = Date.now()){ return Math.floor((ts/86400000 + 4) / 7); }   // ISO-ish week index (epoch Thu → +4)
function _monthId(d = new Date()){ return d.getUTCFullYear()*12 + d.getUTCMonth(); }
function ensureLbFields(user){
  if(!user.lb) user.lb = { weekId:_weekId(), weekWins:0, monthId:_monthId(), monthWins:0 };
  if(user.lb.weekId  !== _weekId()){  user.lb.weekId  = _weekId();  user.lb.weekWins  = 0; }
  if(user.lb.monthId !== _monthId()){ user.lb.monthId = _monthId(); user.lb.monthWins = 0; }
  return user.lb;
}
function weekWinsOf(u){  return (u.lb && u.lb.weekId  === _weekId())  ? (u.lb.weekWins  || 0) : 0; }
function monthWinsOf(u){ return (u.lb && u.lb.monthId === _monthId()) ? (u.lb.monthWins || 0) : 0; }

app.get('/api/leaderboard/board', authMiddleware, (req, res) => {
  const me = usersDB.get(req.user.userId);
  const type = String(req.query.type || 'global');
  const all = _rankablePlayers().filter(u => u.username && u.id && !String(u.id).startsWith('__'));

  let scored;
  let metric = 'pts';
  if(type === 'weekly'){
    metric = 'wins';
    scored = all.map(u => ({ u, val: weekWinsOf(u) })).filter(x => x.val > 0).sort((a,b) => b.val - a.val);
  } else if(type === 'monthly'){
    metric = 'wins';
    scored = all.map(u => ({ u, val: monthWinsOf(u) })).filter(x => x.val > 0).sort((a,b) => b.val - a.val);
  } else if(type === 'alltime'){
    metric = 'wins';
    scored = all.map(u => ({ u, val: u.stats?.gamesWon || 0 })).filter(x => x.val > 0).sort((a,b) => b.val - a.val);
  } else { // global | morocco — competitive rank points
    let pool = all;
    if(type === 'morocco') pool = all.filter(u => (u.country || 'MA') === 'MA');
    scored = pool.map(u => ({ u, val: u.rankPoints || 0 })).sort((a,b) => b.val - a.val);
  }

  const ranked = (type === 'global' || type === 'morocco');
  const entries = scored.slice(0, 50).map((x, i) => {
    const lg = ranked ? getLeague(x.u.rankPoints || 0) : null;
    return {
      rank: i + 1, id: x.u.id, username: x.u.username, avatar: x.u.avatar || null,
      value: x.val, isMe: x.u.id === me?.id,
      tier: lg ? { name: lg.name, badge: lg.badge, color: lg.color } : null,
    };
  });
  const idx = me ? scored.findIndex(x => x.u.id === me.id) : -1;
  res.json({
    type, metric, total: scored.length,
    entries,
    me: idx >= 0 ? { rank: idx + 1, value: scored[idx].val } : { rank: null, value: 0 },
    online: new Set([...socketToUser.values()]).size,
  });
});

// Admin: reset password
// Forgot password — verified by the recovery email set at registration.
app.post('/api/auth/reset',
  // Rate-limit by IP (5 / 15 min) — without this an attacker who knows a
  // username could brute-force the recovery email to take over the account,
  // or spam-reset to lock people out.
  rateLimit({ limit: 5, windowMs: 15 * 60 * 1000, label: 'reset_ip' }),
  async (req, res) => {
  const { username, email, newPassword } = req.body;
  if (!username || !email || !newPassword) return res.status(400).json({ error: 'Fill all fields' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const user = [...usersDB.values()].find(u => u.username && u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'No account with that username' });
  if (!user.email) return res.status(400).json({ error: 'This account has no recovery email on file' });
  if (user.email !== String(email).trim().toLowerCase())
    return res.status(401).json({ error: 'Email does not match this account' });
  user.passwordHash = await bcrypt.hash(newPassword, CONFIG.SALT_ROUNDS);
  // Revoke EVERY existing session — if someone had hijacked the account, the
  // password reset instantly logs the intruder out everywhere.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  saveUsers();
  console.log(`[Auth] Password reset: ${user.username} (sessions revoked)`);
  res.json({ success: true, message: 'Password reset — all other sessions were logged out. Log in again.' });
});

// Log out everywhere — revoke every OTHER session for this account (phones,
// old browsers, a thief's stolen token) while keeping THIS one alive via a
// freshly-minted token. The lever a worried player pulls after a scare.
app.post('/api/auth/logout-all', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  saveUsers();
  // Drop any live sockets that were riding the now-revoked tokens (except the
  // caller's — their client will reconnect with the new token).
  for (const [sid, uid] of socketToUser) {
    if (uid !== user.id) continue;
    const sock = io.sockets.sockets.get(sid);
    if (sock) { try { sock.emit('session:revoked'); sock.disconnect(true); } catch(_){} }
  }
  const token = jwt.sign({ userId: user.id, username: user.username, tv: user.tokenVersion }, CONFIG.JWT_SECRET, JWT_SIGN_OPTS);
  console.log(`[Auth] ${user.username} logged out all other sessions`);
  res.json({ success: true, token, message: 'All other devices have been logged out.' });
});

// ── Account deletion (App Store guideline 5.1.1(v) — REQUIRED in-app) ──
// Permanently erases the account: user record (memory + Mongo), presence in
// other players' social graphs, any live room seat, and every session token
// (usersDB removal makes tokenSessionValid fail). Registered accounts confirm
// with their password; guests (no password) just double-confirm client-side.
app.post('/api/account/delete',
  authMiddleware,
  rateLimit({ limit: 3, windowMs: 60 * 60 * 1000, label: 'acct_del', keyFn: req => req.user?.userId || req.ip }),
  async (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  // Guests carry an isGuest flag (their passwordHash is a random uuid they
  // never knew) — they just double-confirm client-side, no password gate.
  const isGuest = !!user.isGuest || !user.passwordHash;
  if (!isGuest){
    const pw = String(req.body?.password || '');
    if (!pw) return res.status(400).json({ error: 'Password required to delete your account' });
    const ok = await bcrypt.compare(pw, user.passwordHash || '');
    if (!ok) return res.status(401).json({ error: 'Wrong password' });
  }
  const uid = user.id;
  // Pull them out of any live room so no seat is left hanging.
  try {
    for (const r of roomsDB.values()){
      if (r.playerIds?.includes(uid)){
        try { r.game?.removePlayer?.(uid); } catch(e){}
        const i = r.playerIds.indexOf(uid); if (i !== -1) r.playerIds.splice(i, 1);
        if (r.playerBets) delete r.playerBets[uid];
        try { io.to(r.id).emit('room:player_left', { playerId: uid, username: user.username }); } catch(e){}
      }
    }
  } catch(e){}
  // Erase them from every other account's social graph.
  for (const other of usersDB.values()){
    if (other.id === uid) continue;
    if (Array.isArray(other.friends)){
      const i = other.friends.indexOf(uid); if (i !== -1) other.friends.splice(i, 1);
    }
    if (Array.isArray(other.friendRequests)){
      const i = other.friendRequests.indexOf(uid); if (i !== -1) other.friendRequests.splice(i, 1);
    }
  }
  usersDB.delete(uid);
  try { const s = findSocketByUserId(uid); if (s) s.disconnect(true); } catch(e){}
  try { if (mongoose.connection.readyState) await UserModel.deleteOne({ id: uid }); } catch(e){}
  saveUsers();
  console.log(`[Account] Deleted permanently: ${user.username} (${uid})`);
  res.json({ success: true });
});
app.post('/api/admin/add-coins', authMiddleware, async (req, res) => {
  if(!isAdminRequest(req)) {
    auditAdmin(req, 'admin.add_coins.denied', { reason: 'not_admin' });
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { username, amount } = req.body || {};
  if (typeof amount !== 'number' || !Number.isFinite(amount) || Math.abs(amount) > 1_000_000_000) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  const user = [...usersDB.values()].find(u => u.username && u.username.toLowerCase() === String(username||'').toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });
  const before = user.coins || 0;
  user.coins = Math.max(0, before + amount);
  saveUsers();
  auditAdmin(req, 'admin.add_coins', {
    target: user.id, targetName: user.username, delta: amount, before, after: user.coins,
  });
  res.json({ success: true, username: user.username, coins: user.coins });
});

// Admin Analytics — live snapshot: users, active (DAU/WAU/MAU), games, economy.
// True cohort retention needs a time-series store (MongoDB) — out of scope while
// the DB connection is blocked; these instantaneous metrics work on in-memory data.
app.get('/api/admin/analytics', authMiddleware, (req, res) => {
  if(!isAdminRequest(req)){ auditAdmin(req, 'admin.analytics.denied', { reason: 'not_admin' }); return res.status(403).json({ error: 'Forbidden' }); }
  const now = Date.now(), DAY = 86400000;
  const users = [...usersDB.values()].filter(u => u.username && u.id && !String(u.id).startsWith('__'));
  const within = (ts, ms) => ts && (now - ts) <= ms;
  let dau=0, wau=0, mau=0, newToday=0, playerGames=0, wins=0, coins=0, diamonds=0, premium=0, titles=0, guests=0;
  for(const u of users){
    if(within(u.lastLoginAt, DAY)) dau++;
    if(within(u.lastLoginAt, 7*DAY)) wau++;
    if(within(u.lastLoginAt, 30*DAY)) mau++;
    if(within(u.createdAt, DAY)) newToday++;
    playerGames += u.stats?.gamesPlayed || 0;
    wins        += u.stats?.gamesWon || 0;
    coins       += u.coins || 0;
    diamonds    += u.diamonds || 0;
    if(u.bp?.premium) premium++;
    titles += (u.titles||[]).length;
    if(u.isGuest) guests++;
  }
  res.json({
    generatedAt: now,
    users:    { total: users.length, registered: users.length - guests, guests, newToday, online: new Set([...socketToUser.values()]).size },
    activity: { dau, wau, mau, stickiness: mau ? Math.round((dau/mau)*100) : 0 },
    games:    { playerGames, wins, liveRooms: roomsDB.size },
    economy:  { coinsInCirculation: coins, diamondsInCirculation: diamonds, premiumPasses: premium, titlesEarned: titles },
  });
});

// Read the audit log. Admin-only. Prefers the durable Mongo store so
// the trail survives restarts; falls back to the in-memory ring buffer
// when Mongo is offline. Supports filtering by actor + action + time
// window, and a configurable result cap (max 500 per call).
app.get('/api/admin/audit', authMiddleware, async (req, res) => {
  if(!isAdminRequest(req)) {
    auditAdmin(req, 'admin.audit.denied', { reason: 'not_admin' });
    return res.status(403).json({ error: 'Forbidden' });
  }
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 100));
  const since = parseInt(req.query.since, 10);
  const actor = req.query.actor ? String(req.query.actor).slice(0, 64) : null;
  const action = req.query.action ? String(req.query.action).slice(0, 64) : null;
  const category = req.query.category ? String(req.query.category).slice(0, 16) : null;   // 'admin' | 'economy'
  // Mongo path — source of truth.
  if (mongoose.connection.readyState === 1) {
    try {
      const q = {};
      if (Number.isFinite(since)) q.at = { $gte: since };
      if (actor)  q.actor  = actor;
      if (action) q.action = action;
      const rows = await AdminAuditModel.find(q).sort({ at: -1 }).limit(limit).lean();
      const total = await AdminAuditModel.estimatedDocumentCount();
      return res.json({ audit: rows, total, source: 'mongo' });
    } catch(e) {
      console.warn('[AUDIT] mongo read failed, falling back to memory:', e?.message);
      // fall through to memory
    }
  }
  // Durable on-disk log — the persistent store when Mongo is offline (the
  // app's normal mode). Unlike the in-memory buffer it survives restarts AND
  // includes ECONOMY events. Read newest-first, stop once we have `limit`.
  try {
    const fs = require('fs');
    if (fs.existsSync('audit.log')) {
      const lines = fs.readFileSync('audit.log', 'utf8').split('\n');
      const out = [];
      for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        let e; try { e = JSON.parse(line); } catch(_) { continue; }
        if (actor    && e.actor    !== actor)    continue;
        if (action   && e.action   !== action)   continue;
        if (category && e.category !== category) continue;
        if (Number.isFinite(since) && !(e.at >= since)) continue;
        out.push(e);
      }
      return res.json({ audit: out, total: out.length, source: 'file' });
    }
  } catch(e) { console.warn('[AUDIT] file read failed, falling back to memory:', e?.message); }
  // Last-resort in-memory fallback (admin-only ring buffer).
  let mem = ADMIN_AUDIT;
  if (actor)    mem = mem.filter(e => e.actor === actor);
  if (action)   mem = mem.filter(e => e.action === action);
  if (category) mem = mem.filter(e => e.category === category);
  if (Number.isFinite(since)) mem = mem.filter(e => e.at >= since);
  res.json({ audit: mem.slice(-limit).reverse(), total: ADMIN_AUDIT.length, source: 'memory' });
});

// ─────────────────────────────────────────
// 2FA — TOTP setup / verify / disable
// ─────────────────────────────────────────
// Flow:
//   1. Admin opens settings, calls /api/admin/2fa/setup → server
//      generates a fresh TOTP secret, stores it as PENDING (not yet
//      live), and returns the secret + an otpauth:// URI for QR.
//   2. Admin scans the QR with Google Authenticator / Authy / 1Password,
//      reads the 6-digit code, calls /api/admin/2fa/verify with it.
//   3. If the code matches, the secret graduates from pending → enabled
//      and the server returns 10 single-use backup codes (shown ONCE).
//      Future logins require a TOTP code OR a backup code.
//   4. To turn it off (if compromised or needed for staff change), the
//      admin calls /api/admin/2fa/disable with their current password
//      AND a fresh TOTP code.
//
// Note: setup REQUIRES the caller is already a 2FA-cleared admin if the
// account has 2FA on (prevents an attacker with a stolen pre-2FA token
// from quietly resetting the second factor).

app.post('/api/admin/2fa/setup', authMiddleware, (req, res) => {
  const u = usersDB.get(req.user.userId);
  if (!u || !u.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  // If 2FA already on, the session must have proved the second factor
  // before we'll let them rotate it.
  if (u.twoFactorEnabled && req.user.adm2fa !== true) {
    return res.status(401).json({ error: 'Re-login with current 2FA code first' });
  }
  const secret = generateTotpSecret();
  // PENDING — only persists fully when /verify confirms the code below.
  u.twoFactorPendingSecret = secret;
  u.twoFactorPendingAt     = Date.now();
  saveUsers();
  const uri = totpProvisioningUri(secret, u.username, 'AtlasArena');
  auditAdmin(req, 'admin.2fa.setup_initiated');
  res.json({ secret, otpauthUri: uri });
});

app.post('/api/admin/2fa/verify', authMiddleware, (req, res) => {
  const u = usersDB.get(req.user.userId);
  if (!u || !u.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const { code } = req.body || {};
  // Verify against the PENDING secret. Window of 5min so the user has
  // time to scan + type without us rotating the pending state.
  const pendingSecret = u.twoFactorPendingSecret;
  const pendingAt = u.twoFactorPendingAt || 0;
  if (!pendingSecret) return res.status(400).json({ error: 'No pending setup — call /setup first' });
  if (Date.now() - pendingAt > 5 * 60 * 1000) {
    u.twoFactorPendingSecret = null;
    u.twoFactorPendingAt = 0;
    saveUsers();
    return res.status(400).json({ error: 'Setup expired — try again' });
  }
  if (!verifyTotpCode(pendingSecret, String(code || ''))){
    return res.status(401).json({ error: 'Invalid code' });
  }
  // Promote pending → enabled. Generate + bcrypt-hash 10 backup codes.
  u.twoFactorSecret = pendingSecret;
  u.twoFactorPendingSecret = null;
  u.twoFactorPendingAt = 0;
  u.twoFactorEnabled = true;
  const plainBackup = generateBackupCodes(10);
  u.twoFactorBackupCodes = plainBackup.map(c => bcrypt.hashSync(c, 10));
  saveUsers();
  auditAdmin(req, 'admin.2fa.enabled');
  // backupCodes shown ONCE — UI must persist before the modal closes.
  res.json({ success: true, backupCodes: plainBackup });
});

app.post('/api/admin/2fa/disable', authMiddleware, async (req, res) => {
  const u = usersDB.get(req.user.userId);
  if (!u || !u.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  if (!u.twoFactorEnabled) return res.status(400).json({ error: '2FA is not enabled' });
  const { password, code } = req.body || {};
  // BOTH factors required to disable — same standard as the bank/email
  // services. Stops a stolen-session takeover from quietly removing
  // the second factor.
  if (!password || !await bcrypt.compare(String(password), u.passwordHash)){
    return res.status(401).json({ error: 'Invalid password' });
  }
  if (!verifyTotpCode(u.twoFactorSecret, String(code || ''))){
    return res.status(401).json({ error: 'Invalid 2FA code' });
  }
  u.twoFactorEnabled = false;
  u.twoFactorSecret = null;
  u.twoFactorBackupCodes = [];
  saveUsers();
  auditAdmin(req, 'admin.2fa.disabled');
  res.json({ success: true });
});

// Status — tells the client whether 2FA is on so the UI can show the
// right banner / button. Always cheap, never reveals the secret.
app.get('/api/admin/2fa/status', authMiddleware, (req, res) => {
  const u = usersDB.get(req.user.userId);
  if (!u || !u.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  res.json({
    enabled: !!u.twoFactorEnabled,
    sessionCleared: req.user.adm2fa === true,
    backupCodesRemaining: (u.twoFactorBackupCodes || []).length,
    required: ADMIN_REQUIRE_2FA,
  });
});
// Public player profile — used by the in-game "tap opponent → see profile"
// flow. Returns the same shape as sanitizeUser() but stripped of private
// fields (no email, no password hash). 404 for unknown IDs; bot IDs
// (prefix `bot_`/`tbot_`) are rejected so the client falls back to the
// in-game state for bot display.
app.get('/api/player/:id', authMiddleware, (req, res) => {
  const id = String(req.params.id || '');
  if(/^t?bot[_-]/i.test(id)){
    // In-game bots get REAL-looking profiles like everyone else — served from
    // their live room identity with stable pseudo-stats (hashed from the name
    // so repeat views match). NEVER answer with a "Bot" marker.
    for (const r of roomsDB.values()){
      const p = r.game?.players?.find?.(x => x.id === id) || r.game?._players?.find?.(x => x.id === id);
      if (p){
        let h = 0; const s = String(p.username || id);
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        const rp = p.rankPoints || (p.isElite ? 4200 + (h % 2400) : 40 + (h % 2200));
        const played = (p.isElite ? 180 : 35) + (h % 220);
        const wr = (p.isElite ? 0.58 : 0.44) + ((h % 15) / 100);
        const won = Math.round(played * wr);
        let tier = null; try { tier = getLeague(rp); } catch (e) {}
        return res.json({ user: {
          id, username: p.username, avatar: p.avatar || null,
          profileBanner: p.profileBanner || BOT_BANNER_POOL[h % BOT_BANNER_POOL.length],
          accountLevel: p.accountLevel || (p.isElite ? 60 : 12),
          accountLevelProgress: { into: h % 80, span: 100, pct: h % 80 },
          rankPoints: rp, peakRankPoints: p.peakRankPoints || rp + 120 + (h % 300), rankedTier: tier,
          stats: { gamesPlayed: played, gamesWon: won, totalPoints: won * 7 },
          rankedWins: Math.round(won * 0.5), rankedLosses: Math.round((played - won) * 0.4),
          winStreak: h % 5, country: 'MA',
          createdAt: Date.now() - ((h % 320) + 30) * 86400000,
        }});
      }
    }
    return res.status(404).json({ error: 'Player not found' });   // generic — no tell
  }
  const u = usersDB.get(id) || _findGhost(id);   // ghosts have real, clickable profiles
  if(!u) return res.status(404).json({ error: 'Player not found' });
  // Sanitize but drop sensitive fields that aren't relevant to a public
  // profile (e.g., email, lastLoginAt).
  const safe = sanitizeUser(u);
  // sanitizeUser derives accountLevel from XP — ghosts have no XP, so restore
  // their intended high level/rank so the profile reads as a real pro.
  if(u.isGhost){
    safe.accountLevel = u.accountLevel;
    safe.accountLevelProgress = { into: 0, span: 100, pct: 100 };
    safe.rankPoints = u.rankPoints; safe.peakRankPoints = u.peakRankPoints;
    safe.stats = u.stats;
  }
  // Drop everything that isn't meant for a STRANGER viewing your profile:
  // contact info, social graph, and fields that would let someone enumerate
  // admins / 2FA status / DC-ban progress on other accounts.
  delete safe.email;
  delete safe.passwordHash;
  delete safe.friendRequests;
  delete safe.friends;
  delete safe.blockedUsers;
  delete safe.eventState;
  delete safe.isAdmin;
  delete safe.twoFactorEnabled;
  delete safe.rankedAbandonCount;
  delete safe.rankedLastAbandonAt;
  delete safe.lastLoginAt;
  delete safe.lastIp;
  // Never mark simulated players on the wire — profiles must read identically
  // for everyone (a devtools user should see no difference).
  delete safe.isBot;
  delete safe.isGhost;
  delete safe.smurfScore;
  delete safe.smurfFlagged;
  res.json({ user: safe });
});

// Friends: get list
app.get('/api/friends', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if(!user) return res.status(404).json({ error: 'User not found' });
  const friends = (user.friends || []).map(fid => {
    const f = usersDB.get(fid);
    if(!f) return null;
    const isOnline = [...socketToUser.values()].includes(fid);
    // Surface room presence so the lobby friends rail can show "In Match"
    // / "In Lobby" status + a JOIN button (vs the bare INVITE-when-host).
    // Looks up the friend's socket → currentRoomId → room.status. Public
    // info only (room id + status), so a tampered client can't read
    // anything they couldn't query via /api/rooms anyway.
    let status = isOnline ? 'online' : 'offline';
    let currentRoom = null;
    if (isOnline) {
      const friendSock = findSocketByUserId(fid);
      const rid = friendSock?.currentRoomId;
      const room = rid ? roomsDB.get(rid) : null;
      if (room && !room.settings.isPrivate) {
        currentRoom = { id: room.id, code: room.code, status: room.status };
        if (room.status === 'playing') status = 'in_match';
        else if (room.status === 'lobby') status = 'in_lobby';
      }
    }
    return { id: f.id, shortId: ensureShortId(f),
             username: f.username, coins: f.coins, avatar: f.avatar || null,
             isOnline, status, currentRoom };
  }).filter(Boolean);
  res.json({ friends });
});

// Incoming friend requests — resolves user.friendRequests IDs into the
// {id, username, avatar} the client needs to render an accept/decline row.
// Mirrors the GET /api/friends shape so callers can treat both lists the same.
app.get('/api/friends/requests', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if(!user) return res.status(404).json({ error: 'User not found' });
  const requests = (user.friendRequests || []).map(fid => {
    const f = usersDB.get(fid);
    if(!f) return { id: fid, username: 'Unknown' };
    return { id: f.id, shortId: ensureShortId(f),
             username: f.username, avatar: f.avatar || null };
  });
  res.json({ requests });
});

// Friends: live player search — partial / fuzzy username match + exact ID.
// Powers the add-friend box's autocomplete so typing a name surfaces the
// players who have (or are close to) that name, and a full ID jumps straight
// to that player. Returns the best few matches, ranked.
function _subseqMatch(needle, hay){
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++){
    if (hay[j] === needle[i]) i++;
  }
  return i === needle.length;
}
app.get('/api/friends/search', authMiddleware, (req, res) => {
  const me = usersDB.get(req.user.userId);
  if (!me) return res.status(404).json({ error: 'User not found' });
  const raw = String(req.query.q || '').trim();
  if (raw.length < 1) return res.json({ results: [] });
  const q = raw.toLowerCase();
  const friendSet = new Set(me.friends || []);
  const reqSet    = new Set(me.friendRequests || []);
  const out = [];
  for (const u of usersDB.values()){
    if (!u || !u.username || u.isBot) continue;
    if (u.id === me.id || String(u.id).startsWith('__')) continue;
    const name = u.username.toLowerCase();
    const sid  = String(u.shortId || '');
    let score = 0;
    if      (sid && sid === raw)            score = 1000;                 // exact ID
    else if (name === q)                    score = 900;                  // exact name
    else if (name.startsWith(q))            score = 600 - name.length;    // prefix
    else if (name.includes(q))              score = 300 - name.indexOf(q);// substring
    else if (sid.startsWith(raw))           score = 150;                  // ID prefix
    else if (q.length >= 2 && _subseqMatch(q, name)) score = 60;          // loose fuzzy
    if (score <= 0) continue;
    out.push({ score, u });
  }
  out.sort((a, b) => b.score - a.score);
  const results = out.slice(0, 12).map(({ u }) => ({
    id:        u.id,
    shortId:   ensureShortId(u),
    username:  u.username,
    avatar:    u.avatar || null,
    isFriend:  friendSet.has(u.id),
    incoming:  reqSet.has(u.id),                              // they already asked me
    outgoing:  (u.friendRequests || []).includes(me.id),     // I already asked them
  }));
  res.json({ results });
});

// Friends: send request
// Per-user friend list cap. Surfaced as a 400 with a clear message on
// both /request and /accept so the UI can render it as a toast.
const MAX_FRIENDS = 250;

// Friend requests rate-limited per user: 20 / minute. Stops mass
// friend-request harassment + protects targets' notification surface.
app.post('/api/friends/request',
  authMiddleware,
  rateLimit({ limit: 20, windowMs: 60 * 1000, label: 'friend_req',
              keyFn: req => req.user?.userId || req.ip }),
  (req, res) => {
  const { username, userId: bodyUserId, shortId: bodyShortId } = req.body;
  const user = usersDB.get(req.user.userId);
  if(!user) return res.status(404).json({ error: 'User not found' });
  // Accept username, short ID (9-char share ID), or internal UUID.
  // Lookup order: shortId (case-insensitive) → userId → username.
  let target = null;
  const shortQuery = String(bodyShortId || '').trim().toUpperCase();
  if(shortQuery){
    target = [...usersDB.values()].find(u =>
      (u.shortId || '').toUpperCase() === shortQuery
    );
  }
  if(!target){
    const idQuery = String(bodyUserId || '').trim();
    if(idQuery){
      target = usersDB.get(idQuery)
            || [...usersDB.values()].find(u => u.id === idQuery);
    }
  }
  if(!target){
    const nameQuery = String(username || '').trim();
    if(nameQuery){
      target = [...usersDB.values()].find(u => u.username && u.username.toLowerCase() === nameQuery.toLowerCase());
    }
  }
  if(!target){
    // BOTS FEEL REAL — a request aimed at an in-game bot or a ghost pro must
    // return the exact same "request sent" a real player gets, never a
    // "User not found" tell. (Real accounts are matched above and always win.)
    const rawId   = String(bodyUserId || '').trim();
    const rawName = String(username || '').trim().toLowerCase();
    const isBotId   = /^(t?bot[_-]|ghost_)/i.test(rawId);
    const isGhost   = !!_findGhost(rawId) || (rawName && GHOST_PLAYERS.some(g => g.username.toLowerCase() === rawName));
    const isBotName = rawName && MOROCCAN_BOT_NAMES.some(n => String(n).toLowerCase() === rawName);
    if(isBotId || isGhost || isBotName){
      return res.json({ success: true });          // indistinguishable from a real send
    }
  }
  if(!target) return res.status(404).json({ error: 'User not found' });
  if(target.id === user.id) return res.status(400).json({ error: 'Cannot add yourself' });
  if((user.friends||[]).includes(target.id)) return res.status(400).json({ error: 'Already friends' });
  if((user.friends||[]).length   >= MAX_FRIENDS) return res.status(400).json({ error: `Your friends list is full (max ${MAX_FRIENDS}).` });
  if((target.friends||[]).length >= MAX_FRIENDS) return res.status(400).json({ error: `${target.username}'s friends list is full.` });
  if(!target.friendRequests) target.friendRequests = [];
  if(target.friendRequests.includes(user.id)) return res.status(400).json({ error: 'Request already sent' });
  // Bound the pending-request queue so a swarm of accounts can't grow it
  // without limit (memory + notification-surface protection).
  if(target.friendRequests.length >= 300) return res.status(400).json({ error: 'This user has too many pending requests right now.' });
  target.friendRequests.push(user.id);
  saveUsers();
  // Notify target if online
  const targetSock = findSocketByUserId(target.id);
  if(targetSock) targetSock.emit('friend:request', { from: { id: user.id, username: user.username } });
  res.json({ success: true });
});

// Friends: accept
app.post('/api/friends/accept', authMiddleware, validateBody({ userId:{ type:'string', required:true, max:64 } }), (req, res) => {
  const { userId: fromId } = req.body;
  const user = usersDB.get(req.user.userId);
  if(!user) return res.status(404).json({ error: 'User not found' });
  const from = usersDB.get(fromId);
  if(!from) return res.status(404).json({ error: 'User not found' });
  // Cap check at accept time (the requester might have been at 249 when
  // they sent the request and is now at 250 from another accept).
  if((user.friends||[]).length >= MAX_FRIENDS) return res.status(400).json({ error: `Your friends list is full (max ${MAX_FRIENDS}).` });
  if((from.friends||[]).length >= MAX_FRIENDS) return res.status(400).json({ error: `${from.username}'s friends list is full.` });
  user.friendRequests = (user.friendRequests||[]).filter(id => id !== fromId);
  if(!user.friends) user.friends = [];
  if(!from.friends) from.friends = [];
  if(!user.friends.includes(fromId)) user.friends.push(fromId);
  if(!from.friends.includes(user.id)) from.friends.push(user.id);
  saveUsers();
  const fromSock = findSocketByUserId(fromId);
  if(fromSock) fromSock.emit('friend:accepted', { by: { id: user.id, username: user.username } });
  res.json({ success: true });
});

// Friends: decline
app.post('/api/friends/decline', authMiddleware, validateBody({ userId:{ type:'string', required:true, max:64 } }), (req, res) => {
  const { userId: fromId } = req.body;
  const user = usersDB.get(req.user.userId);
  if(!user) return res.status(404).json({ error: 'User not found' });
  user.friendRequests = (user.friendRequests||[]).filter(id => id !== fromId);
  saveUsers();
  res.json({ success: true });
});

// Friends: remove
app.post('/api/friends/remove', authMiddleware, validateBody({ userId:{ type:'string', required:true, max:64 } }), (req, res) => {
  const { userId: friendId } = req.body;
  const user = usersDB.get(req.user.userId);
  const friend = usersDB.get(friendId);
  if(!user) return res.status(404).json({ error: 'User not found' });
  user.friends = (user.friends||[]).filter(id => id !== friendId);
  if(friend) friend.friends = (friend.friends||[]).filter(id => id !== user.id);
  saveUsers();
  res.json({ success: true });
});

// Friends: invite to room
app.post('/api/friends/invite', authMiddleware, validateBody({ friendId:{ type:'string', required:true, max:64 }, roomId:{ type:'string', required:true, max:64 } }), (req, res) => {
  const { friendId, roomId } = req.body;
  const user = usersDB.get(req.user.userId);
  if(!user) return res.status(404).json({ error: 'User not found' });
  const room = roomsDB.get(roomId);
  if(!room) return res.status(404).json({ error: 'Room not found' });
  const friendSock = findSocketByUserId(friendId);
  if(!friendSock) return res.status(400).json({ error: 'Friend is offline' });
  friendSock.emit('friend:invite', { from: { id: user.id, username: user.username }, roomId, code: room.code });
  res.json({ success: true });
});

// ── Emotes (extra cosmetic reactions) ─────────────────────────────────
// The in-game ReactionsPanel already ships with 12 free basic emojis;
// EMOTES are EXTRA expressions players collect and unlock to broaden
// their reactions catalogue. Same paid / gated unlock paths as card backs.
// `kind` for gates matches the cardBackProgressFor() helper below.
const EMOTES = [
  { id:'mind_blown',  emoji:'🤯', name:'Mind Blown',  rarity:'common',
    cost:500,  requires:null,
    desc:'For the wild plays.' },
  { id:'rocket',      emoji:'🚀', name:'Rocket',      rarity:'common',
    cost:500,  requires:null,
    desc:'Blast off.' },
  { id:'cool_shades', emoji:'🕶️', name:'Too Cool',    rarity:'rare',
    cost:1500, requires:null,
    desc:'Played it ice-cold.' },
  { id:'trophy',      emoji:'🏆', name:'Victor',      rarity:'rare',
    cost:0,    requires:{ kind:'wins',  value:25 },
    desc:'Earned with 25 match wins.' },
  { id:'crown',       emoji:'👑', name:'Royalty',     rarity:'epic',
    cost:3000, requires:null,
    desc:'Rule the table.' },
  { id:'money_bag',   emoji:'💰', name:'Big Stack',   rarity:'epic',
    cost:0,    requires:{ kind:'coins', value:100000 },
    desc:'Unlocks at 100,000 coins.' },
  { id:'fairy',       emoji:'🧚', name:'Magic',       rarity:'epic',
    cost:0,    requires:{ kind:'bp_premium', value:1 },
    desc:'Owning the Battle Pass unlocks this.' },
  { id:'dragon',      emoji:'🐉', name:'Dragon',      rarity:'legendary',
    cost:0,    requires:{ kind:'wins',  value:100 },
    desc:'Earned with 100 match wins.' },
  { id:'gem',         emoji:'💎', name:'Diamond',     rarity:'legendary',
    cost:0,    requires:{ kind:'elo',   value:1500 },
    desc:'Earned at 1500 rating.' },
  { id:'star_struck', emoji:'🤩', name:'Star-Struck', rarity:'legendary',
    cost:0,    requires:{ kind:'level', value:25 },
    desc:'Earned at account level 25.' },
];

function emoteProgressFor(user, req) {
  if (!req) return { current: 1, target: 1, met: true };
  if (req.kind === 'wins')       return progressFor(user.stats?.gamesWon || 0, req.value);
  if (req.kind === 'elo')        return progressFor(user.elo || 1000, req.value);
  if (req.kind === 'coins')      return progressFor(user.coins || 0, req.value);
  if (req.kind === 'level')      return progressFor(accountLevelProgress(user.accountXP || 0).level, req.value);
  if (req.kind === 'bp_premium') return progressFor(user.bp?.premium ? 1 : 0, req.value);
  return { current: 0, target: req.value || 1, met: false };
}
function progressFor(cur, target) {
  return { current: cur, target, met: cur >= target };
}

function ensureEmotes(user) {
  if (!Array.isArray(user.ownedEmotes)) user.ownedEmotes = [];
  return user;
}

app.get('/api/emotes', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  ensureEmotes(user);
  const items = EMOTES.map(e => {
    const progress = emoteProgressFor(user, e.requires);
    return {
      id: e.id, emoji: e.emoji, name: e.name, rarity: e.rarity,
      desc: e.desc, cost: e.cost, requires: e.requires,
      progress,
      owned: user.ownedEmotes.includes(e.id),
    };
  });
  res.json({ items, owned: user.ownedEmotes });
});

app.post('/api/emotes/unlock', authMiddleware, validateBody({ id:{ type:'string', required:true, max:64 } }), (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  ensureEmotes(user);
  const id = String(req.body?.id || '');
  const e  = EMOTES.find(x => x.id === id);
  if (!e) return res.status(400).json({ error: 'Unknown emote' });
  if (user.ownedEmotes.includes(id)) return res.status(400).json({ error: 'Already owned' });
  if (e.requires) {
    const p = emoteProgressFor(user, e.requires);
    if (!p.met) return res.status(400).json({ error: 'Requirement not met', progress: p });
  } else if (e.cost > 0) {
    if ((user.coins || 0) < e.cost) return res.status(400).json({ error: `Need ${e.cost.toLocaleString()} coins` });
    user.coins -= e.cost;
    logReward(user, '😎', `Emote — ${e.name}`, -e.cost);
  }
  user.ownedEmotes.push(e.id);
  saveUsers();
  res.json({ success: true, coins: user.coins, ownedEmotes: user.ownedEmotes, id: e.id });
});

// ── Card-back Collection ──────────────────────────────────────────────
// Cosmetic catalogue. Each entry has a visual config (palette + accent +
// label) so the client can render the back deterministically from the id
// without a separate asset pipeline. Unlock conditions follow the same
// getValue(user) pattern as ACHIEVEMENTS so a player auto-qualifies for
// any condition they've already met. `default` is owned by everyone.
//
// rarity: common | rare | epic | legendary — drives the React modal's
// border tint and the sort order.
const CARD_BACKS = [
  { id:'default',     name:'Classic',       rarity:'common',
    visual:{ bg:'#b91c1c', bg2:'#7f1d1d', accent:'#fbbf24', label:'Cardora' },
    cost:0,    requires:null,
    desc:'The original. Owned by everyone.' },
  { id:'midnight',    name:'Midnight',      rarity:'common',
    visual:{ bg:'#1e293b', bg2:'#0f172a', accent:'#a78bfa', label:'Cardora' },
    cost:500,  requires:null,
    desc:'Slate gradient with violet glow.' },
  { id:'emerald',     name:'Emerald',       rarity:'rare',
    visual:{ bg:'#047857', bg2:'#064e3b', accent:'#34d399', label:'Cardora' },
    cost:1500, requires:null,
    desc:'Deep emerald — clean and bright.' },
  { id:'ocean',       name:'Ocean',         rarity:'rare',
    visual:{ bg:'#1e40af', bg2:'#1e3a8a', accent:'#7dd3fc', label:'Cardora' },
    cost:1500, requires:null,
    desc:'Deep ocean blue with sky highlights.' },
  { id:'gold',        name:'Gold',          rarity:'epic',
    visual:{ bg:'#a16207', bg2:'#854d0e', accent:'#fde047', label:'Cardora' },
    cost:5000, requires:null,
    desc:'Royal gold — for the rich and famous.' },
  { id:'royal',       name:'Royal',         rarity:'epic',
    visual:{ bg:'#7c3aed', bg2:'#5b21b6', accent:'#facc15', label:'Cardora' },
    cost:5000, requires:null,
    desc:'Premium violet — fit for a champion.' },
  { id:'champion',    name:'Champion',      rarity:'legendary',
    visual:{ bg:'#9a3412', bg2:'#7c2d12', accent:'#fbbf24', label:'Cardora' },
    cost:0,    requires:{ kind:'wins',  value:50 },
    desc:'Earned by winning 50 matches.' },
  { id:'legendary',   name:'Legendary',     rarity:'legendary',
    visual:{ bg:'#0f172a', bg2:'#020617', accent:'#f43f5e', label:'Cardora' },
    cost:0,    requires:{ kind:'elo',   value:2000 },
    desc:'Forged at 2000 rating.' },
];

function cardBackProgressFor(user, req) {
  if (!req) return { current: 1, target: 1, met: true };
  if (req.kind === 'wins') {
    const cur = user.stats?.gamesWon || 0;
    return { current: cur, target: req.value, met: cur >= req.value };
  }
  if (req.kind === 'elo') {
    const cur = user.elo || 1000;
    return { current: cur, target: req.value, met: cur >= req.value };
  }
  return { current: 0, target: req.value || 1, met: false };
}

function ensureCollection(user) {
  if (!Array.isArray(user.ownedBacks)) user.ownedBacks = ['default'];
  if (!user.ownedBacks.includes('default')) user.ownedBacks.unshift('default');
  if (!user.equippedBack) user.equippedBack = 'default';
  return user;
}

app.get('/api/collection', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  ensureCollection(user);
  const items = CARD_BACKS.map(cb => {
    const progress = cardBackProgressFor(user, cb.requires);
    return {
      id: cb.id, name: cb.name, rarity: cb.rarity, visual: cb.visual,
      desc: cb.desc, cost: cb.cost, requires: cb.requires,
      progress,
      owned:    user.ownedBacks.includes(cb.id),
      equipped: user.equippedBack === cb.id,
    };
  });
  res.json({ items, equipped: user.equippedBack });
});

app.post('/api/collection/unlock', authMiddleware, validateBody({ id:{ type:'string', required:true, max:64 } }), (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  ensureCollection(user);
  const id = String(req.body?.id || '');
  const cb = CARD_BACKS.find(x => x.id === id);
  if (!cb) return res.status(400).json({ error: 'Unknown back' });
  if (user.ownedBacks.includes(id)) return res.status(400).json({ error: 'Already owned' });
  // Two unlock paths:
  //   • Requirement-gated (free) — must meet the condition; e.g. champion (50 wins)
  //   • Coin purchase            — cost-gated, currency check
  if (cb.requires) {
    const p = cardBackProgressFor(user, cb.requires);
    if (!p.met) return res.status(400).json({ error: 'Requirement not met', progress: p });
  } else if (cb.cost > 0) {
    if ((user.coins || 0) < cb.cost) return res.status(400).json({ error: `Need ${cb.cost.toLocaleString()} coins` });
    user.coins -= cb.cost;
    logReward(user, '🎴', `Card back — ${cb.name}`, -cb.cost);
  }
  user.ownedBacks.push(cb.id);
  saveUsers();
  res.json({ success: true, coins: user.coins, ownedBacks: user.ownedBacks, id: cb.id });
});

app.post('/api/collection/equip', authMiddleware, validateBody({ id:{ type:'string', required:true, max:64 } }), (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  ensureCollection(user);
  const id = String(req.body?.id || '');
  if (!CARD_BACKS.find(x => x.id === id)) return res.status(400).json({ error: 'Unknown back' });
  if (!user.ownedBacks.includes(id))      return res.status(400).json({ error: 'Not owned' });
  user.equippedBack = id;
  saveUsers();
  res.json({ success: true, equipped: id });
});

// ── Achievements (trophy collection) ──────────────────────────────────
// Server-owned catalog. Each entry has a getValue(user) that derives the
// player's current progress from the user object — so a new server release
// can change targets/rewards without a per-user migration, and players
// "unlock" achievements they qualified for at any prior time.
// Claimed IDs persist on user.achievementsClaimed[].
const ACHIEVEMENTS = [
  { id:'first_win',    icon:'🥇', name:'First Victory',  desc:'Win your first match',                  target:1,      reward:200,
    getValue:(u) => u.stats?.gamesWon || 0 },
  { id:'ten_wins',     icon:'🏆', name:'Hot Streak',      desc:'Win 10 matches',                        target:10,     reward:500,
    getValue:(u) => u.stats?.gamesWon || 0 },
  { id:'fifty_wins',   icon:'👑', name:'Champion',        desc:'Win 50 matches',                        target:50,     reward:2500,
    getValue:(u) => u.stats?.gamesWon || 0 },
  { id:'hundred_wins', icon:'🌟', name:'Master',          desc:'Win 100 matches',                       target:100,    reward:5000,
    getValue:(u) => u.stats?.gamesWon || 0 },
  { id:'veteran',      icon:'🎖️', name:'Veteran',         desc:'Play 50 matches',                       target:50,     reward:500,
    getValue:(u) => u.stats?.gamesPlayed || 0 },
  { id:'centurion',    icon:'💯', name:'Centurion',       desc:'Play 100 matches',                      target:100,    reward:1000,
    getValue:(u) => u.stats?.gamesPlayed || 0 },
  { id:'social_5',     icon:'🤝', name:'Friend Club',     desc:'Add 5 friends',                         target:5,      reward:300,
    getValue:(u) => (u.friends || []).length },
  { id:'social_20',    icon:'👥', name:'Networker',       desc:'Add 20 friends',                        target:20,     reward:1000,
    getValue:(u) => (u.friends || []).length },
  { id:'bp_premium',   icon:'🎟️', name:'Pass Holder',     desc:'Own the premium Battle Pass',           target:1,      reward:500,
    getValue:(u) => u.bp?.premium ? 1 : 0 },
  { id:'bp_max',       icon:'📈', name:'Season Climber',  desc:'Reach Battle Pass tier 20',             target:20,     reward:2000,
    getValue:(u) => u.bp ? bpLevel(u.bp) : 0 },
  { id:'level_10',     icon:'⭐', name:'Rising Star',      desc:'Reach account level 10',                target:10,     reward:500,
    getValue:(u) => accountLevelProgress(u.accountXP || 0).level },
  { id:'level_50',     icon:'🚀', name:'Skyrocket',       desc:'Reach account level 50',                target:50,     reward:2500,
    getValue:(u) => accountLevelProgress(u.accountXP || 0).level },
  { id:'ranked_1500',  icon:'💎', name:'Diamond Mind',    desc:'Climb to 1500 rating',                  target:1500,   reward:1000,
    getValue:(u) => u.elo || 1000 },
  { id:'ranked_2000',  icon:'🔥', name:'Legendary',       desc:'Climb to 2000 rating',                  target:2000,   reward:3000,
    getValue:(u) => u.elo || 1000 },
  { id:'rich_50k',     icon:'💰', name:'Big Pocket',      desc:'Hold 50,000 coins',                     target:50000,  reward:500,
    getValue:(u) => u.coins || 0 },
  { id:'rich_500k',    icon:'🤑', name:'Tycoon',          desc:'Hold 500,000 coins',                    target:500000, reward:5000,
    getValue:(u) => u.coins || 0 },
];

function ensureAchievements(user) {
  if (!Array.isArray(user.achievementsClaimed)) user.achievementsClaimed = [];
  return user.achievementsClaimed;
}

app.get('/api/achievements', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const claimed = ensureAchievements(user);
  const items = ACHIEVEMENTS.map(a => {
    const current = a.getValue(user);
    return {
      id: a.id, icon: a.icon, name: a.name, desc: a.desc,
      target: a.target, reward: a.reward,
      current: Math.min(current, a.target),
      complete: current >= a.target,
      claimed:  claimed.includes(a.id),
    };
  });
  const earned = items.filter(i => i.complete).length;
  res.json({ achievements: items, total: ACHIEVEMENTS.length, earned });
});

app.post('/api/achievements/claim', authMiddleware, validateBody({ id:{ type:'string', required:true, max:64 } }), (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const claimed = ensureAchievements(user);
  const id = String(req.body?.id || '');
  const a  = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return res.status(400).json({ error: 'Unknown achievement' });
  if (claimed.includes(a.id)) return res.status(400).json({ error: 'Already claimed' });
  if (a.getValue(user) < a.target) return res.status(400).json({ error: 'Not complete yet' });
  claimed.push(a.id);
  user.coins = (user.coins || 0) + a.reward;
  logReward(user, a.icon, `Achievement — ${a.name}`, a.reward);
  saveUsers();
  res.json({ success: true, coins: user.coins, reward: a.reward, id: a.id });
});

app.get('/api/leaderboard/ranked', (req, res) => {
  // Phase 3: leaderboard now reads rankPoints (legacy elo kept as the
  // hidden matchmaking signal). Placement-stage players are excluded
  // since their rank isn't trustworthy yet (avoids new accounts with
  // a single lucky win pinning the top of the ladder).
  const top = _rankablePlayers()
    .filter(u => u.id && !String(u.id).startsWith('__'))
    .filter(u => (u.placementGamesPlayed || 0) >= 5)
    .sort((a, b) => (b.rankPoints || 0) - (a.rankPoints || 0))
    .slice(0, 20)
    .map((u, i) => {
      const league = getLeague(u.rankPoints || 0);
      return {
        rank:        i + 1,
        id:          u.id,                       // so the client can open the player's profile
        username:    u.username,
        rankPoints:  u.rankPoints || 0,
        peakRank:    u.peakRankPoints || u.rankPoints || 0,
        badge:       league.badge,
        league:      league.name,
        division:    league.division,
        label:       league.label,
        color:       league.color,
        gamesWon:    u.rankedWins || 0,
        gamesLost:   u.rankedLosses || 0,
        winStreak:   u.winStreak || 0,
      };
    });
  const season = getRankedSeasonState();
  res.json({
    leaderboard: top,
    seasonId:    season.currentSeasonId,
    endsAt:      season.startedAt + season.lengthMs,
  });
});

// ── /api/ranked/season ─────────────────────────────────────────────────
// Lightweight read-only endpoint the client can hit to render a season
// countdown, a "current season" pill on the ranked tile, or a small
// "previous winners" carousel. Returns the active season's metadata
// plus the last few archived snapshots from history.
app.get('/api/ranked/season', (req, res) => {
  const s = getRankedSeasonState();
  res.json({
    seasonId:  s.currentSeasonId,
    startedAt: s.startedAt,
    endsAt:    s.startedAt + s.lengthMs,
    lengthMs:  s.lengthMs,
    history:   (s.history || []).slice(0, 4),
  });
});

// ─────────────────────────────────────────
// COSMETICS — endpoints
// ─────────────────────────────────────────
// GET  /api/cosmetics            → catalog + which IDs the player owns + what's equipped.
// POST /api/cosmetics/equip      → { type, id }   equip an owned cosmetic.
// POST /api/cosmetics/buy        → { id }         purchase a shop cosmetic.
//
// The catalog includes a "status" flag per item so the client can render
// owned / locked / equipped states without a second lookup.
app.get('/api/cosmetics', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  ensureCosmeticFields(user);
  ensureAvatarFields(user);
  // Sync earned (tier + achievement) drops so the player ALWAYS sees
  // their tier card back unlocked when they open the panel.
  syncEarnedCosmetics(user);

  const decorate = (catalog, ownedSet, equippedId, favSet) => catalog.map(item => ({
    ...item,
    owned:    ownedSet.has(item.id),
    equipped: item.id === equippedId,
    favorite: favSet ? favSet.has(item.id) : false,
  }));

  // Avatars equip by image src (user.avatar), not by id like other cosmetics.
  ensureAvatarFields(user);
  const ownedAv = new Set(user.ownedAvatars);
  const favAv   = new Set(user.favoriteAvatars || []);
  const avatars = AVATAR_CATALOG.map(item => ({
    ...item,
    owned:    ownedAv.has(item.id),
    equipped: item.src === user.avatar,
    favorite: favAv.has(item.id),
  }));

  res.json({
    cardBacks:  decorate(CARDBACK_CATALOG,   new Set(user.ownedCardBacks),  user.equippedCardBack,  new Set(user.favoriteCardBacks)),
    tableFelts: decorate(TABLEFELT_CATALOG,  new Set(user.ownedTableFelts), user.equippedTableFelt, new Set(user.favoriteTableFelts)),
    damaBoards: decorate(DAMABOARD_CATALOG,  new Set(user.ownedDamaBoards), user.equippedDamaBoard, new Set(user.favoriteDamaBoards)),
    avatars,
    currency:   { coins: user.coins || 0, diamonds: user.diamonds || 0 },
  });
});

app.post('/api/cosmetics/equip', authMiddleware, validateBody({ type:{ type:'string', required:true, enum:['cardBack','tableFelt','damaBoard'] }, id:{ type:'string', required:true, max:64 } }), (req, res) => {
  const { type, id } = req.body || {};
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  ensureCosmeticFields(user);
  // Free items (unlock.kind === 'free') are equippable by everyone — grant
  // them on first equip so ownership stays consistent with the catalog.
  const _isFree = (cat, cid) => { const it = cat.find(c => c.id === cid); return it && it.unlock && it.unlock.kind === 'free'; };
  if (type === 'cardBack') {
    if (!CARDBACK_CATALOG.find(c => c.id === id)) return res.status(404).json({ error: 'Unknown cosmetic' });
    if (!user.ownedCardBacks.includes(id)) {
      if (_isFree(CARDBACK_CATALOG, id)) user.ownedCardBacks.push(id);
      else return res.status(403).json({ error: 'You do not own this card back' });
    }
    user.equippedCardBack = id;
  } else if (type === 'tableFelt') {
    if (!TABLEFELT_CATALOG.find(c => c.id === id)) return res.status(404).json({ error: 'Unknown cosmetic' });
    if (!user.ownedTableFelts.includes(id)) {
      if (_isFree(TABLEFELT_CATALOG, id)) user.ownedTableFelts.push(id);
      else return res.status(403).json({ error: 'You do not own this felt' });
    }
    user.equippedTableFelt = id;
  } else if (type === 'damaBoard') {
    if (!DAMABOARD_CATALOG.find(c => c.id === id)) return res.status(404).json({ error: 'Unknown cosmetic' });
    if (!user.ownedDamaBoards.includes(id)) {
      if (_isFree(DAMABOARD_CATALOG, id)) user.ownedDamaBoards.push(id);
      else return res.status(403).json({ error: 'You do not own this board' });
    }
    user.equippedDamaBoard = id;
  } else {
    return res.status(400).json({ error: 'Bad type' });
  }
  saveUsers();
  res.json({
    success: true,
    equippedCardBack:  user.equippedCardBack,
    equippedTableFelt: user.equippedTableFelt,
    equippedDamaBoard: user.equippedDamaBoard,
  });
});

app.post('/api/cosmetics/buy', authMiddleware, validateBody({ id:{ type:'string', required:true, max:64 } }), (req, res) => {
  const { id } = req.body || {};
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  ensureCosmeticFields(user);

  // ── Premium avatars take their own branch (owned by id, equipped by src) ──
  const av = AVATAR_CATALOG.find(a => a.id === id);
  if (av) {
    ensureAvatarFields(user);
    if (user.ownedAvatars.includes(id)) return res.status(400).json({ error: 'Already owned' });
    const { currency, price } = av.unlock;
    const have = (currency === 'diamonds') ? (user.diamonds || 0) : (user.coins || 0);
    if (have < price) {
      return res.status(402).json({ error: `Not enough ${currency} — need ${price}, you have ${have}`, need: price, have });
    }
    if (currency === 'diamonds') user.diamonds = (user.diamonds || 0) - price;
    else                         user.coins    = (user.coins    || 0) - price;
    user.ownedAvatars.push(id);
    logReward(user, '🧑', `Bought ${av.name}`, -price);
    auditEconomy(user, 'avatar.buy', { id, name: av.name, currency, price });
    saveUsers();
    return res.json({
      success:  true,
      type:     'avatar',
      id,
      src:      av.src,
      name:     av.name,
      coins:    user.coins,
      diamonds: user.diamonds,
      owned:    user.ownedAvatars,
    });
  }

  const cb = CARDBACK_CATALOG.find(c => c.id === id);
  const tf = TABLEFELT_CATALOG.find(c => c.id === id);
  const db = DAMABOARD_CATALOG.find(c => c.id === id);
  const item = cb || tf || db;
  if (!item) return res.status(404).json({ error: 'Unknown cosmetic' });
  if (item.unlock.kind !== 'shop') return res.status(400).json({ error: 'Not a shop item' });
  const ownedList = cb ? user.ownedCardBacks
                  : tf ? user.ownedTableFelts
                  : user.ownedDamaBoards;
  if (ownedList.includes(id)) return res.status(400).json({ error: 'Already owned' });

  const { currency, price } = item.unlock;
  const have = (currency === 'diamonds') ? (user.diamonds || 0) : (user.coins || 0);
  if (have < price) {
    return res.status(402).json({ error: `Not enough ${currency} — need ${price}, you have ${have}`, need: price, have });
  }
  if (currency === 'diamonds') user.diamonds = (user.diamonds || 0) - price;
  else                         user.coins    = (user.coins    || 0) - price;
  ownedList.push(id);
  const icon = cb ? '🎴' : tf ? '🟩' : '⛂';
  logReward(user, icon, `Bought ${item.name}`, -price);
  auditEconomy(user, 'cosmetic.buy', { id, name: item.name, currency, price });
  saveUsers();
  res.json({
    success:   true,
    type:      cb ? 'cardBack' : tf ? 'tableFelt' : 'damaBoard',
    id,
    name:      item.name,
    coins:     user.coins,
    diamonds:  user.diamonds,
    owned:     ownedList,
  });
});
app.get('/api/leaderboard', (req, res) => {
  const top = _rankablePlayers()
    .filter(u => u.username && u.stats && u.id && !String(u.id).startsWith('__'))
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 20)
    .map((u, i) => ({ rank: i + 1, username: u.username, coins: u.coins, gamesWon: u.stats.gamesWon, gamesPlayed: u.stats.gamesPlayed }));
  res.json({ leaderboard: top });
});

// ─────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const user  = verifySocketToken(token);
  if (!user) return next(new Error('Authentication failed'));
  // Same session-revocation gate as the HTTP side — a stolen/old token can't
  // open a live socket after its tokenVersion was bumped.
  if (!tokenSessionValid(user)) return next(new Error('Session revoked'));
  socket.userId   = user.userId;
  socket.username = user.username;
  next();
});

// Presence helper — fan out a friend:online / friend:offline event to all
// sockets belonging to the given user's friends. Idempotent on the
// client (the dot just flips state); honest clients also re-poll every
// few seconds so a missed event isn't permanent.
function emitPresenceToFriends(userId, payload) {
  const u = usersDB.get(userId);
  if (!u) return;
  const friendIds = u.friends || [];
  if (!friendIds.length) return;
  for (const [sid, uid] of socketToUser) {
    if (!friendIds.includes(uid)) continue;
    const sock = io.sockets.sockets.get(sid);
    if (sock) sock.emit('friend:presence', payload);
  }
}

// Unique signed-in users currently connected (multi-tab counts once).
function onlinePlayerCount(){ return new Set([...socketToUser.values()]).size; }
let _lastOnlineBroadcast = -1;
function broadcastOnlineCount(){
  const n = displayOnlineCount();               // real + ambient baseline
  if (n === _lastOnlineBroadcast) return;       // skip redundant emits
  _lastOnlineBroadcast = n;
  io.emit('online:count', { count: n });
}
app.get('/api/online', (req, res) => res.json({ count: displayOnlineCount() }));

// Max socket events a single connection may fire per second before its excess
// gets dropped. Normal play (card plays, chat, voice ICE) stays far under this;
// it's a guard against a malicious/buggy client flooding the event loop.
const SOCKET_EVENTS_PER_SEC = 120;

io.on('connection', (socket) => {
  const userId = socket.userId;
  socketToUser.set(socket.id, userId);
  // ── Per-user connection cap ── one account can't open unlimited sockets.
  // Track this socket; if the account is over the cap, drop its OLDEST socket
  // (so a fresh tab still works, but a connection-bomb can't pile up).
  let _set = userSockets.get(userId);
  if (!_set) { _set = new Set(); userSockets.set(userId, _set); }
  _set.add(socket.id);
  while (_set.size > MAX_SOCKETS_PER_USER) {
    const oldest = _set.values().next().value;
    _set.delete(oldest);
    const victim = io.sockets.sockets.get(oldest);
    if (victim) { try { victim.disconnect(true); } catch (_) {} }
    console.warn(`[Socket] ${socket.username} over ${MAX_SOCKETS_PER_USER} sockets — dropped oldest ${oldest}`);
  }
  console.log(`[Socket] Connected: ${socket.username} (${socket.id})`);
  // Tell this user's friends they're online. The check before emit is
  // implicit — we always emit on connect, even if another tab is already
  // online for them; clients treat online:true as idempotent.
  emitPresenceToFriends(userId, { userId, online: true });
  broadcastOnlineCount();

  // Per-socket flood-guard state (sliding 1s window).
  let _evtWindow = Date.now(), _evtCount = 0, _floodStrikes = 0;

  // Wrap every socket handler with (1) a FLOOD GUARD so one client can't pin
  // the server by spamming events, and (2) a CRASH GUARD so a thrown error is
  // contained to this event instead of killing Node for everyone mid-game.
  const _rawOn = socket.on.bind(socket);
  socket.on = (event, handler) => _rawOn(event, (...args) => {
    // ── Flood guard ──
    const now = Date.now();
    if (now - _evtWindow >= 1000) {
      // New second. A clean prior window forgives a strike (so brief bursts
      // — e.g. WebRTC ICE negotiation — never escalate to a disconnect).
      if (_evtCount <= SOCKET_EVENTS_PER_SEC) _floodStrikes = Math.max(0, _floodStrikes - 1);
      _evtWindow = now; _evtCount = 0;
    }
    if (++_evtCount > SOCKET_EVENTS_PER_SEC) {
      // Egregious, sustained flood (4× the cap for 3 seconds) → drop them.
      if (_evtCount === SOCKET_EVENTS_PER_SEC * 4 + 1 && ++_floodStrikes >= 3) {
        console.warn(`[FLOOD] disconnecting ${socket.username || '?'} (${socket.id}) — sustained event flood`);
        try { socket.disconnect(true); } catch (_) {}
      }
      const ackF = args[args.length - 1];
      if (typeof ackF === 'function') { try { ackF({ success: false, reason: 'Too many requests — slow down' }); } catch (_) {} }
      return; // drop this event — handler never runs
    }
    // ── Crash guard ──
    try {
      return handler(...args);
    } catch (err) {
      console.error(`\n╔══════════════════════════════════════════════════╗`);
      console.error(`║ [CRASH-GUARD] Error in socket "${event}"`);
      console.error(`║ User: ${socket.username || '?'} (${socket.userId || '?'})`);
      console.error(`║ Args: ${JSON.stringify(args.filter(a => typeof a !== 'function')).slice(0, 200)}`);
      console.error(`║ Error: ${err?.message || err}`);
      console.error(`╚══════════════════════════════════════════════════╝`);
      if (err && err.stack) console.error(err.stack);
      const ack = args[args.length - 1];
      if (typeof ack === 'function') {
        try { ack({ success: false, reason: `Server: ${err?.message || 'unknown error'}` }); } catch (_) {}
      }
    }
  });

  // ── Room: Join ──
  socket.on('room:join', ({ roomId, password } = {}, ack) => {
    const room = roomsDB.get(roomId);
    const user = usersDB.get(userId);
    console.log(`[room:join] user=${user?.username} roomId=${roomId} roomType=${room?.roomType} status=${room?.status}`);
    if (!room)  return ack?.({ success: false, reason: 'Room not found' });
    if (!user)  return ack?.({ success: false, reason: 'User not found' });
    if (room.status !== 'lobby') return ack?.({ success: false, reason: 'Game already started' });
    if (room.settings.password && room.settings.password !== password) return ack?.({ success: false, reason: 'Wrong password' });

    const alreadyInRoom = room.playerIds.includes(userId);
    if (!alreadyInRoom) {
      // RANKED rooms charge a tier-scaled entry: placement = 500, climbing
      // up to 25 000 at Grandmaster. Casual rooms use the room floor as
      // before (each player can raise via room:set_bet). For ranked the
      // entry is locked — the per-player cost IS their tier amount, so
      // set_bet is ignored later in the flow.
      const isRanked  = room.roomType === 'RANKED';
      const myStake   = isRanked ? rankedEntryFor(user) : (room.settings.bet || 0);
      if (myStake > 0 && user.coins < myStake) {
        return ack?.({ success: false, reason: `Not enough coins! You need ${myStake} 🪙 (you have ${user.coins})` });
      }
      // HUMANS > BOTS: a real player (e.g. a friend) must never be locked out of
      // a bot-filled lobby — if the room is full, bump one bot to free a seat.
      // Prefer a NON-host bot so the room keeps its host; if we have to bump the
      // host bot, the joining human inherits the host role.
      const maxP = room.settings.maxPlayers || 4;
      if (room.playerIds.length >= maxP){
        const bot = room.game.players.find(p => p.isBot && p.id !== room.hostId)
                 || room.game.players.find(p => p.isBot);
        if (bot){
          if (bot.id === room.hostId) room.hostId = userId;
          room.game.removePlayer(bot.id);
          const bi = room.playerIds.indexOf(bot.id);
          if (bi !== -1) room.playerIds.splice(bi, 1);
          if (room.playerBets) delete room.playerBets[bot.id];
          io.to(roomId).emit('room:player_left', { playerId: bot.id, username: bot.username || 'Player' });
          console.log(`[room:join] bumped bot ${bot.username || bot.id} so ${user.username} could join ${roomId}`);
        }
      }
      const player = new Player(user.id, user.username, user.coins);
      if (room.hostId === userId) player.isHost = true;
      player.avatar = user.avatar; player.cardBackId = user.equippedCardBack || 'cb_default';
    player.tableFelt = user.equippedTableFelt || 'tfp_green';
      const result = room.game.addPlayer(player);
      if (!result.success) return ack?.({ success: false, reason: result.reason });
      room.playerIds.push(userId);
      // Stake recorded on the player's bet slot. Casual lets them raise
      // it before start via room:set_bet; ranked locks it to the tier amount.
      if (!room.playerBets) room.playerBets = {};
      room.playerBets[userId] = myStake;
    }

    socket.join(roomId);
    socket.currentRoomId = roomId;

    // P4-NEW.1a — if this user was in a 30s grace window after a disconnect,
    // clear the pending abandon timer (they reconnected in time). Also flip
    // their player object back to connected so the bot stops playing their
    // seat. The abandoned flag is sticky for the match — if they reconnect
    // AFTER the grace already fired, isConnected goes true but abandoned
    // stays true (pot payout still excludes them per GDD forfeit).
    if (room.graceTimers && room.graceTimers.has(userId)) {
      clearTimeout(room.graceTimers.get(userId));
      room.graceTimers.delete(userId);
      console.log(`[Grace] ${user.username} reconnected to ${roomId} in time`);
    }
    const reconnectedPlayer = room.game.players.find(p => p.id === userId);
    if (reconnectedPlayer && reconnectedPlayer.isConnected === false && typeof reconnectedPlayer.setConnected === 'function') {
      reconnectedPlayer.setConnected(socket.id);
      socket.to(roomId).emit('player:reconnected', {
        playerId: userId, username: socket.username,
        abandoned: !!reconnectedPlayer.abandoned,
      });
    }

    // Engine polymorphism — UNO exposes _publicState(), DamaManager
    // exposes publicState(). Pick whichever the engine has.
    const state = (typeof room.game._publicState === 'function')
      ? room.game._publicState()
      : (typeof room.game.publicState === 'function' ? room.game.publicState() : {});
    ack?.({ success: true, state });

    socket.emit('chat:history', { messages: (room.chat || []).slice(-50) });

    socket.to(roomId).emit('room:player_joined', {
      player: (() => {
        const p = room.game.players.find(x => x.id === userId);
        if (!p) return null;
        return (typeof p.toPublicJSON === 'function') ? p.toPublicJSON() : p;
      })(),
    });
    // Push the current per-player bet pool so everyone (the new joiner
    // included) sees who's betting what + computes the live pot total.
    io.to(roomId).emit('room:bets', {
      minBet: room.settings.bet || 0,
      playerBets: room.playerBets || {},
    });
    console.log(`[Room] ${socket.username} joined ${roomId}`);
  });

  // ── Room: Set per-player bet ──
  // A seated player picks their own buy-in (≥ room.settings.bet floor,
  // ≤ their wallet). Broadcast updates so the waiting screen shows live
  // bets + pot total. Only valid while the room is still in 'lobby'.
  // Rate-limited per socket: 12 changes / 3 seconds. Stops a malicious
  // client from flooding every other seat with a million bet-pool
  // broadcasts per second.
  socket.on('room:set_bet', ({ amount } = {}, ack) => {
    const roomId = socket.currentRoomId;
    const room = roomsDB.get(roomId);
    const user = usersDB.get(userId);
    if (!room || !user) return ack?.({ success: false, reason: 'Not in a room' });
    if (room.status !== 'lobby') return ack?.({ success: false, reason: 'Game already started' });
    if (!room.playerIds.includes(userId)) return ack?.({ success: false, reason: 'Not seated' });
    if (!rateCheck(`bet:${socket.id}`, 12, 3000)) {
      return ack?.({ success: false, reason: 'Too many bet changes — slow down' });
    }

    // Ranked entry is locked to the player's tier — set_bet is a no-op
    // here so a Diamond player can't lowball their stake to placement
    // levels and a Bronze can't volunteer above their tier.
    if (room.roomType === 'RANKED') {
      return ack?.({ success: false, reason: 'Ranked entry is locked to your tier' });
    }

    const amt   = safeInt(amount, MAX_BET_AMOUNT);
    const floor = safeInt(room.settings.bet || 0, MAX_BET_AMOUNT);
    const coins = safeCoins(user);
    if (amt < floor) return ack?.({ success: false, reason: `Minimum bet is ${floor.toLocaleString()} 🪙` });
    if (amt > coins) return ack?.({ success: false, reason: `Not enough coins (you have ${coins.toLocaleString()} 🪙)` });
    if (amt > MAX_BET_AMOUNT) return ack?.({ success: false, reason: `Bet exceeds maximum allowed` });

    if (!room.playerBets) room.playerBets = {};
    room.playerBets[userId] = amt;
    io.to(roomId).emit('room:bets', { minBet: floor, playerBets: room.playerBets });
    ack?.({ success: true });
  });

  // ── Room: Kick ──
  // Host-only action in the waiting room. Removes a seated non-host player
  // before the game starts. The kicked socket is forced to leave the room
  // and pushed back to the lobby; remaining players see room:player_left.
  // Refuses outside lobby phase (can't kick mid-match) and from non-host.
  socket.on('room:kick', ({ playerId } = {}, ack) => {
    const roomId = socket.currentRoomId;
    const room = roomsDB.get(roomId);
    if (!room) return ack?.({ success: false, reason: 'Not in a room' });
    if (room.status !== 'lobby') return ack?.({ success: false, reason: 'Game already started' });
    if (room.hostId !== userId) return ack?.({ success: false, reason: 'Only the host can remove players' });
    if (!playerId || playerId === userId) return ack?.({ success: false, reason: 'Cannot remove the host' });
    if (!room.playerIds.includes(playerId)) return ack?.({ success: false, reason: 'Player is not in this room' });

    const targetUser = usersDB.get(playerId);
    const targetSocket = findSocketByUserId(playerId);

    // Splice the target out of the room state.
    room.game.removePlayer(playerId);
    const idx = room.playerIds.indexOf(playerId);
    if (idx !== -1) room.playerIds.splice(idx, 1);
    if (room.playerBets) delete room.playerBets[playerId];

    // Boot the kicked socket from the room channel + notify them.
    if (targetSocket) {
      try { targetSocket.leave(roomId); } catch(e) {}
      delete targetSocket.currentRoomId;
      targetSocket.emit('room:kicked', {
        roomId,
        by: socket.username || 'Host',
        reason: 'Removed by host',
      });
    }
    // Tell the remaining seated players so the row disappears live.
    io.to(roomId).emit('room:player_left', {
      playerId, username: targetUser?.username || 'Player',
    });
    io.to(roomId).emit('room:bets', {
      minBet: room.settings.bet || 0,
      playerBets: room.playerBets || {},
    });
    console.log(`[Room] ${socket.username} kicked ${targetUser?.username || playerId} from ${roomId}`);
    ack?.({ success: true });
  });

  // ── Room: Leave ──
  // Voluntary exit. During a live match, this is "abandon immediately" —
  // no 30s grace, no bot-to-rescue. The player chose to quit.
  socket.on('room:leave', ({} = {}, ack) => {
    const roomId = socket.currentRoomId;
    if (!roomId) return ack?.({ success: false });
    handlePlayerLeave(socket, roomId, { voluntary: true });
    ack?.({ success: true });
  });

  // ── Spectator: join an in-progress room as a watcher (read-only) ──
  socket.on('room:spectate', ({ roomId } = {}, ack) => {
    if (!roomId) return ack?.({ success: false, reason: 'Missing roomId' });
    const room = roomsDB.get(roomId);
    if (!room) return ack?.({ success: false, reason: 'Room not found' });
    if (room.status !== 'playing') return ack?.({ success: false, reason: 'Game not running yet' });
    if (room.playerIds.includes(userId)) {
      return ack?.({ success: false, reason: 'You are already a player in this room' });
    }
    // Spectating is FRIENDS-ONLY — you can only watch a match one of your
    // friends is playing in (not strangers' / bot-filled games).
    const _spec = usersDB.get(userId);
    const _frnd = new Set(_spec?.friends || []);
    if (!room.playerIds.some(pid => _frnd.has(pid))) {
      return ack?.({ success: false, reason: 'You can only watch your friends’ games' });
    }

    if (!room.spectators) room.spectators = new Set();
    room.spectators.add(userId);
    socket.join(roomId);
    socket.currentRoomId = roomId;
    socket.isSpectator = true;

    socket.emit('chat:history', { messages: (room.chat || []).slice(-50) });
    socket.emit('chat:spectator_history', { messages: (room.spectatorChat || []).slice(-50) });

    // Send the right initial state for the game type. The spectator is
    // now in the socket.io room, so they'll keep receiving the live
    // broadcasts (ronda:state / dama:state / game:state) automatically.
    //   • UNO   → _spectatorState() (all hands revealed for watchers)
    //   • RONDA → publicState() (table, plays, scores — hands stay hidden)
    //   • DAMA  → publicState() (board is fully public anyway)
    // The old code unconditionally called _spectatorState() which only
    // exists on the UNO engine, so watching a Ronda/Dama game threw and
    // the spectator saw nothing.
    const gt = room.roomType;
    try {
      if (gt === 'RONDA' && typeof room.game.publicState === 'function') {
        socket.emit('ronda:state', room.game.publicState());
      } else if (gt === 'DAMA' && typeof room.game.publicState === 'function') {
        socket.emit('dama:state', room.game.publicState());
      } else if (gt === 'CHESS' && typeof room.game.publicState === 'function') {
        socket.emit('chess:state', room.game.publicState());
      } else if (typeof room.game._spectatorState === 'function') {
        socket.emit('game:spectator_state', room.game._spectatorState());
        socket.emit('vote:tally', { tally: computeVoteTally(room), my: room.spectatorVotes?.get(userId) || null });
      }
    } catch (e) {
      console.error('[Spectate] state emit failed:', e.message);
    }

    socket.to(roomId).emit('room:spectator_joined', {
      spectatorId: userId, username: socket.username, count: room.spectators.size,
    });
    ack?.({ success: true, roomType: gt });
    console.log(`[Spectate] ${socket.username} watching ${roomId} (${gt}, ${room.spectators.size} watchers)`);
  });

  socket.on('room:spectate_leave', ({} = {}, ack) => {
    const roomId = socket.currentRoomId;
    if (!roomId) return ack?.({ success: false });
    const room = roomsDB.get(roomId);
    if (room?.spectators) {
      room.spectators.delete(userId);
      socket.to(roomId).emit('room:spectator_left', {
        spectatorId: userId, count: room.spectators.size,
      });
    }
    socket.leave(roomId);
    delete socket.currentRoomId;
    socket.isSpectator = false;
    ack?.({ success: true });
  });

  // Spectator chat — separate from player chat. Players only see it if
  // they explicitly toggle the panel; spectators see both their own
  // channel and the player chat for context.
  // Spectator voting — watchers cheer for a player, tallies broadcast
  // back to all watchers in the room. Players never see the votes
  // (no pressure, no leaks) until the game-over crowd favorite reveal.
  socket.on('vote:spectator', ({ playerId } = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room) return ack?.({ success: false, reason: 'Not in room' });
    if (!socket.isSpectator) return ack?.({ success: false, reason: 'Players cannot vote' });
    const valid = room.game.players.some(p => p.id === playerId);
    if (!valid) return ack?.({ success: false, reason: 'Invalid player' });
    if (!room.spectatorVotes) room.spectatorVotes = new Map();
    room.spectatorVotes.set(userId, playerId);
    const tally = computeVoteTally(room);
    // Broadcast to spectators only — keep it out of the player UI
    room.spectators.forEach(sid => {
      const sock = findSocketByUserId(sid);
      if (sock) sock.emit('vote:tally', { tally, my: playerId });
    });
    ack?.({ success: true });
  });

  // Spectator chat — same 5/4s floor as room chat. Stops watcher
  // griefing in popular matches with high spectator counts.
  socket.on('chat:spectator_send', ({ text } = {}, ack) => {
    try {
      const room = roomsDB.get(socket.currentRoomId);
      if (!room) return ack?.({ success: false, reason: 'Not in room' });
      if (!socket.isSpectator) return ack?.({ success: false, reason: 'Players use chat:send' });
      if (!text?.trim()) return ack?.({ success: false });
      if (!rateCheck(`spec:${socket.id}`, 5, 4000)) {
        socket.emit('chat:throttled', { ms: 2000 });
        return ack?.({ success: false, reason: 'rate_limit' });
      }
      const clean = text.trim().slice(0, 200);
      const msg = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
        roomId: room.id, userId,
        username: socket.username, text: clean, createdAt: Date.now(),
      };
      if (!room.spectatorChat) room.spectatorChat = [];
      room.spectatorChat.push(msg);
      if (room.spectatorChat.length > 100) room.spectatorChat.shift();
      // Broadcast to everyone in the room — players will only render
      // it if they have the spectator-chat panel open
      io.to(room.id).emit('chat:spectator_message', msg);
      ack?.({ success: true });
    } catch(e) {
      console.error('[SpecChat] Error:', e.message);
      ack?.({ success: false });
    }
  });

  // ── Game: Start ──
  socket.on('game:start', ({} = {}, ack) => {
    const roomId = socket.currentRoomId;
    const room   = roomsDB.get(roomId);
    if (!room) return ack?.({ success: false, reason: 'Room not found' });

    // ── P4: per-player entry-fee debit at match start ──────────────────
    // Each human player chose their own bet via room:set_bet (defaulting
    // to settings.bet floor). Pre-flight: verify every human can pay
    // their own declared bet BEFORE touching any balance. If any can't,
    // start fails atomically. Bots still play free.
    //
    // Hardening (currency atomicity):
    //   • All inputs piped through safeInt() — defends against NaN /
    //     Infinity / negative / string injection from a tampered client.
    //   • safeCoins() repairs corrupted balances in-place on read.
    //   • Per-bet cap (MAX_BET_AMOUNT) + total-pot cap (MAX_POT_AMOUNT)
    //     prevent integer overflow and absurd payouts.
    //   • Pre-flight + debit run in a single synchronous block — Node's
    //     event loop guarantees no interleaving with other socket events.
    const floor = safeInt(room.settings.bet || 0, MAX_BET_AMOUNT);
    const humansToDebit = [];   // [{ user, bet }]
    let preflightPot = 0;
    for (const pid of room.playerIds) {
      const u = usersDB.get(pid);
      if (!u) continue;                                  // bots → skipped
      const declared = Math.max(floor, safeInt(room.playerBets?.[pid] || 0, MAX_BET_AMOUNT));
      const balance  = safeCoins(u);
      if (balance < declared) {
        return ack?.({
          success: false,
          reason: `${u.username} needs ${declared.toLocaleString()} 🪙 (has ${balance.toLocaleString()})`,
        });
      }
      preflightPot += declared;
      if (preflightPot > MAX_POT_AMOUNT) {
        return ack?.({ success: false, reason: 'Total pot exceeds maximum allowed' });
      }
      humansToDebit.push({ user: u, bet: declared });
    }

    const result = room.game.startGame(userId);
    if (!result.success) return ack?.({ success: false, reason: result.reason });

    // Start succeeded — debit each human their own bet and seed the pot
    // as the sum. Single saveUsers call at the end batches the disk write.
    let totalPot = 0;
    humansToDebit.forEach(({ user: u, bet }) => {
      if (bet > 0) {
        // Re-read balance under safeCoins so we never underflow even if
        // the user's coins were touched by another flow between pre-flight
        // and debit (defense in depth — shouldn't happen in single-threaded
        // Node, but cheap insurance).
        const current = safeCoins(u);
        const debit   = Math.min(bet, current);          // clamp at balance
        u.coins = current - debit;
        totalPot += debit;
      }
    });
    room.pot = Math.min(totalPot, MAX_POT_AMOUNT);
    room.game.pot = room.pot;                            // GameManager broadcasts this in _publicState
    if (totalPot > 0) saveUsers();

    // Push the new balance + the per-player bet they paid so the header
    // pill stays in sync and the client can show "you bet X" feedback.
    humansToDebit.forEach(({ user: u, bet }) => {
      const sock = findSocketByUserId(u.id);
      if (sock) sock.emit('match:debited', { entryFee: bet, coins: u.coins });
    });
    if (totalPot > 0) console.log(`[Pot] Match started in ${roomId}: pot=${totalPot} from ${humansToDebit.length} players`);

    room.status    = 'playing';
    room.startedAt = Date.now();

    room.playerIds.forEach(pid => {
      const player = room.game.players.find(p => p.id === pid);
      if (!player) return;
      const playerSocket = findSocketByUserId(pid);
      if (playerSocket) playerSocket.emit('game:state', decorateRankedState(room, room.game._playerState(player)));
    });

    // Return the HOST's own state in the ack too — a guaranteed delivery path so
    // the host can flip to the game screen even if their broadcast game:state
    // raced/dropped (was the only path before, leaving the host stuck on the lobby).
    const _hostP = room.game.players.find(p => p.id === userId);
    ack?.({ success: true, state: _hostP ? decorateRankedState(room, room.game._playerState(_hostP)) : undefined });
    console.log(`[Game] Started in room ${roomId}`);
  });

  // ── Game: Play Card ──
  socket.on('game:play_card', ({ cardId, chosenColor } = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room) return ack?.({ success: false, reason: 'Not in a room' });

    const result = room.game.playCard(userId, cardId, chosenColor);
    if (!result.success) return ack?.({ success: false, reason: result.reason });

    io.to(socket.currentRoomId).emit('game:card_played', result.eventData);
    broadcastPrivateStates(room);
    ack?.({ success: true });
  });

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ DAMA SOCKET HANDLERS — Moroccan checkers (1v1).             ║
  // ║                                                              ║
  // ║ Flow:                                                        ║
  // ║   1. Player joins via the standard quick-join flow (sets     ║
  // ║      room.roomType = 'DAMA', room.game = DamaManager).       ║
  // ║   2. Host taps START → `dama:start_match`. Server debits     ║
  // ║      entries and engine starts. attachDamaListeners pushes   ║
  // ║      dama:state to both sockets.                             ║
  // ║   3. Each move emits `dama:make_move`. Engine validates.     ║
  // ║   4. dama:move + dama:state stream live; dama:match_over     ║
  // ║      pays out the pot to the winner.                         ║
  // ╚══════════════════════════════════════════════════════════════╝

  socket.on('dama:start_match', ({} = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room || room.roomType !== 'DAMA') return ack?.({ success:false, reason:'Not in a Dama room' });
    if (room.status !== 'lobby')            return ack?.({ success:false, reason:'Match already started' });
    if (!room.playerIds.includes(userId))   return ack?.({ success:false, reason:'Not seated in this room' });
    if (room.hostId !== userId)             return ack?.({ success:false, reason:'Only the host can start' });
    if (room.playerIds.length !== 2)        return ack?.({ success:false, reason:`Need 2 players (have ${room.playerIds.length})` });

    const fee = safeInt(room.settings.bet || 0, MAX_BET_AMOUNT);
    if (fee > 0){
      for (const pid of room.playerIds){
        const u = usersDB.get(pid);
        if (!u) continue;
        if (safeCoins(u) < fee){
          return ack?.({ success:false, reason:`${u.username} needs ${fee.toLocaleString()} 🪙` });
        }
      }
      let pot = 0;
      for (const pid of room.playerIds){
        const u = usersDB.get(pid);
        if (!u) continue;
        const have  = safeCoins(u);
        const debit = Math.min(fee, have);
        u.coins = have - debit;
        pot += debit;
        const sock = findSocketByUserId(pid);
        if (sock) sock.emit('match:debited', { entryFee: debit, coins: u.coins });
      }
      room.pot = Math.min(pot, MAX_POT_AMOUNT);
      saveUsers();
    }

    // Cancel the bot-fill timer — host beat it to start.
    if (room.damaFillTimer){ clearTimeout(room.damaFillTimer); room.damaFillTimer = null; }

    const r = room.game.startGame();
    if (!r.success) return ack?.({ success:false, reason: r.reason });
    room.status    = 'playing';
    room.startedAt = Date.now();
    console.log(`[Dama] Match started in ${room.id} — pot ${room.pot || 0}`);
    ack?.({ success:true });
  });

  socket.on('dama:make_move', ({ from, to } = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room || room.roomType !== 'DAMA') return ack?.({ success:false, reason:'Not in a Dama room' });
    if (room.status !== 'playing')         return ack?.({ success:false, reason:'Match not running' });
    const r = room.game.makeMove(userId, { from, to });
    if (!r.success) return ack?.({ success:false, reason: r.reason });
    ack?.({ success:true });
  });

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ CHESS SOCKET HANDLERS — 1v1 standard chess (ChessManager).   ║
  // ║ Mirrors the Dama flow exactly: host starts, entries are      ║
  // ║ debited into the pot, then each move streams through the     ║
  // ║ engine which validates every rule server-side.               ║
  // ╚══════════════════════════════════════════════════════════════╝
  socket.on('chess:start_match', ({} = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room || room.roomType !== 'CHESS') return ack?.({ success:false, reason:'Not in a Chess room' });
    if (room.status !== 'lobby')            return ack?.({ success:false, reason:'Match already started' });
    if (!room.playerIds.includes(userId))   return ack?.({ success:false, reason:'Not seated in this room' });
    if (room.hostId !== userId)             return ack?.({ success:false, reason:'Only the host can start' });
    if (room.playerIds.length !== 2)        return ack?.({ success:false, reason:`Need 2 players (have ${room.playerIds.length})` });

    const fee = safeInt(room.settings.bet || 0, MAX_BET_AMOUNT);
    if (fee > 0){
      for (const pid of room.playerIds){
        const u = usersDB.get(pid);
        if (!u) continue;
        if (safeCoins(u) < fee){
          return ack?.({ success:false, reason:`${u.username} needs ${fee.toLocaleString()} 🪙` });
        }
      }
      let pot = 0;
      for (const pid of room.playerIds){
        const u = usersDB.get(pid);
        if (!u) continue;
        const have  = safeCoins(u);
        const debit = Math.min(fee, have);
        u.coins = have - debit;
        pot += debit;
        const sock = findSocketByUserId(pid);
        if (sock) sock.emit('match:debited', { entryFee: debit, coins: u.coins });
      }
      room.pot = Math.min(pot, MAX_POT_AMOUNT);
      saveUsers();
    }

    if (room.chessFillTimer){ clearTimeout(room.chessFillTimer); room.chessFillTimer = null; }

    const r = room.game.startGame();
    if (!r.success) return ack?.({ success:false, reason: r.reason });
    room.status    = 'playing';
    room.startedAt = Date.now();
    console.log(`[Chess] Match started in ${room.id} — pot ${room.pot || 0}`);
    ack?.({ success:true });
  });

  socket.on('chess:make_move', ({ from, to, promotion } = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room || room.roomType !== 'CHESS') return ack?.({ success:false, reason:'Not in a Chess room' });
    if (room.status !== 'playing')          return ack?.({ success:false, reason:'Match not running' });
    const r = room.game.makeMove(userId, { from, to, promotion });
    if (!r.success) return ack?.({ success:false, reason: r.reason });
    ack?.({ success:true });
  });

  // Client asks for the authoritative board (e.g. after an optimistic move the
  // server rejected in a rare race) — just re-push the current state.
  socket.on('chess:resync', ({} = {}) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (room && room.roomType === 'CHESS' && typeof room.game?.publicState === 'function') {
      socket.emit('chess:state', room.game.publicState());
    }
  });

  // Resign — hands the win to the opponent (standard chess courtesy).
  socket.on('chess:resign', ({} = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room || room.roomType !== 'CHESS') return ack?.({ success:false, reason:'Not in a Chess room' });
    if (room.status !== 'playing')          return ack?.({ success:false, reason:'Match not running' });
    const me = room.game.players.find(p => p.id === userId);
    if (!me) return ack?.({ success:false, reason:'Not a player' });
    room.game.forceWin(me.color === 'white' ? 'black' : 'white', 'resign');
    ack?.({ success:true });
  });

  // Draw offers — offer, then the opponent accepts or declines.
  socket.on('chess:offer_draw', ({} = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room || room.roomType !== 'CHESS') return ack?.({ success:false, reason:'Not in a Chess room' });
    if (room.status !== 'playing')          return ack?.({ success:false, reason:'Match not running' });
    ack?.(room.game.offerDraw(userId));
  });

  socket.on('chess:respond_draw', ({ accept } = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room || room.roomType !== 'CHESS') return ack?.({ success:false, reason:'Not in a Chess room' });
    if (room.status !== 'playing')          return ack?.({ success:false, reason:'Match not running' });
    ack?.(room.game.respondDraw(userId, !!accept));
  });

  // Host picks the time control while the room is still in the lobby.
  socket.on('chess:set_time_control', ({ id } = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room || room.roomType !== 'CHESS') return ack?.({ success:false, reason:'Not in a Chess room' });
    if (room.status !== 'lobby')            return ack?.({ success:false, reason:'Match already started' });
    if (room.hostId !== userId)             return ack?.({ success:false, reason:'Only the host can change this' });
    if (!CHESS_TIME_CONTROLS[id])           return ack?.({ success:false, reason:'Unknown time control' });
    room.settings.timeControl = id;
    room.game.settings.timeControl = id;
    io.to(room.id).emit('chess:time_control', { timeControl: CHESS_TIME_CONTROLS[id] });
    ack?.({ success:true, timeControl: CHESS_TIME_CONTROLS[id] });
  });

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ RONDA SOCKET HANDLERS — Moroccan 40-card Spanish deck (1v1).║
  // ║                                                              ║
  // ║ Flow:                                                        ║
  // ║   1. Player joins via the standard quick-join flow (sets     ║
  // ║      room.roomType = 'RONDA', room.game = RondaManager).     ║
  // ║   2. Host taps START → `ronda:start_match`. Server debits    ║
  // ║      entries and engine starts.                              ║
  // ║   3. Each card play → `ronda:play_card`. Engine validates    ║
  // ║      + emits ronda:capture / ronda:play / ronda:mesa.        ║
  // ║   4. ronda:round_over and ronda:match_over fire automatic    ║
  // ║      payout (winner takes the pot, draws refund equally).    ║
  // ╚══════════════════════════════════════════════════════════════╝
  socket.on('ronda:start_match', ({} = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room || room.roomType !== 'RONDA') return ack?.({ success:false, reason:'Not in a Ronda room' });
    if (room.status !== 'lobby')            return ack?.({ success:false, reason:'Match already started' });
    if (!room.playerIds.includes(userId))   return ack?.({ success:false, reason:'Not seated in this room' });
    if (room.hostId !== userId)             return ack?.({ success:false, reason:'Only the host can start' });
    if (room.playerIds.length !== 4)        return ack?.({ success:false, reason:`Need 4 players (have ${room.playerIds.length})` });

    const fee = safeInt(room.settings.bet || 0, MAX_BET_AMOUNT);
    if (fee > 0){
      for (const pid of room.playerIds){
        const u = usersDB.get(pid);
        if (!u) continue;
        if (safeCoins(u) < fee){
          return ack?.({ success:false, reason:`${u.username} needs ${fee.toLocaleString()} 🪙` });
        }
      }
      let pot = 0;
      for (const pid of room.playerIds){
        const u = usersDB.get(pid);
        if (!u) continue;
        const have  = safeCoins(u);
        const debit = Math.min(fee, have);
        u.coins = have - debit;
        pot += debit;
        const sock = findSocketByUserId(pid);
        if (sock) sock.emit('match:debited', { entryFee: debit, coins: u.coins });
      }
      room.pot = Math.min(pot, MAX_POT_AMOUNT);
      saveUsers();
    }

    if (room.rondaFillTimer){ clearTimeout(room.rondaFillTimer); room.rondaFillTimer = null; }

    const r = room.game.startGame();
    if (!r.success) return ack?.({ success:false, reason: r.reason });
    room.status    = 'playing';
    room.startedAt = Date.now();
    console.log(`[Ronda] Match started in ${room.id} — pot ${room.pot || 0}`);
    ack?.({ success:true });
  });

  socket.on('ronda:play_card', ({ cardId } = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room || room.roomType !== 'RONDA') return ack?.({ success:false, reason:'Not in a Ronda room' });
    if (room.status !== 'playing')          return ack?.({ success:false, reason:'Match not running' });
    const r = room.game.makeMove(userId, cardId);
    if (!r.success) return ack?.({ success:false, reason: r.reason });
    ack?.({ success:true });
  });

  // ── Ronda: RESYNC ──
  // Recovery for a seated player whose private hand state went missing (a
  // dropped ronda:private_state, a stale currentRoomId, etc.) — the client
  // calls this when it's mid-match with an empty hand. Re-bind the socket to
  // its live RONDA room and re-push BOTH the public state and the private hand,
  // so a player can never get stuck looking at the table with no cards.
  socket.on('ronda:resync', () => {
    // Throttle: rebuilding public+private state is not free — 1 resync per
    // 1.5s per socket is plenty for the legitimate self-heal (450ms debounce,
    // ≤6 tries) and blunts any resync-spam CPU attack.
    const now = Date.now();
    if (socket._lastResyncAt && now - socket._lastResyncAt < 1500) return;
    socket._lastResyncAt = now;
    let room = roomsDB.get(socket.currentRoomId);
    if (!room || room.roomType !== 'RONDA' || !room.playerIds?.includes(userId)){
      room = null;
      for (const r of roomsDB.values()){
        if (r.roomType === 'RONDA' && r.status !== 'lobby' && r.playerIds?.includes(userId)){ room = r; break; }
      }
    }
    if (!room || !room.game) return;
    socket.join(room.id);
    socket.currentRoomId = room.id;
    try { socket.emit('ronda:state', room.game.publicState()); } catch (e) {}
    try { socket.emit('ronda:private_state', room.game.privateStateFor(userId)); } catch (e) {}
    console.log(`[Ronda] resync → ${userId} re-pushed state for ${room.id}`);
  });

  // ── Ronda: Declare RONDA / TRINGA ──
  // Player clicks their declaration button. Engine validates that the
  // caller actually holds the candidate and applies scoring (Tringa
  // = +1 to declarer's team; Ronda = neutral, just publicized so the
  // 10s penalty timer for opponents doesn't fire on this candidate).
  socket.on('ronda:declare', ({ type, rank } = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room || room.roomType !== 'RONDA') {
      return ack?.({ success:false, reason:'Not in a Ronda room' });
    }
    if (type !== 'ronda' && type !== 'ronda_x2' && type !== 'tringa') {
      return ack?.({ success:false, reason:'Bad declaration type' });
    }
    const result = room.game.declare(userId, type, Number(rank));
    if (!result.success) return ack?.({ success:false, reason: result.reason });
    ack?.({ success:true });
  });

  // ── Game: Draw Card ──
  socket.on('game:draw_card', ({} = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room) return ack?.({ success: false, reason: 'Not in a room' });

    const result = room.game.drawCard(userId);
    if (!result.success) return ack?.({ success: false, reason: result.reason });

    if (result.wasStack) {
      // ← FIX: send proper cards array for stack draw
      socket.emit('game:drew_card', {
        card:    result.cards?.[0]?.toJSON() || null,
        cards:   (result.cards || []).map(c => c.toJSON()),
        count:   result.count,
        canPlay: false,
        wasStack: true,
      });
      socket.to(socket.currentRoomId).emit('game:player_drew', {
        playerId: userId, count: result.count, wasStack: true,
      });
      broadcastPrivateStates(room);
    } else if (result.card) {
      socket.emit('game:drew_card', {
        card: result.card.toJSON(), canPlay: result.canPlay, wasStack: false,
      });
      socket.to(socket.currentRoomId).emit('game:player_drew', {
        playerId: userId, count: 1,
      });
    }

    ack?.({ success: true });
  });

  // ── Game: Pass Turn ──
  socket.on('game:pass', ({} = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room) return ack?.({ success: false });
    const result = room.game.passTurn(userId);
    if (result.success) {
      io.to(socket.currentRoomId).emit('game:turn_passed', { playerId: userId });
      broadcastPrivateStates(room);
    }
    ack?.(result);
  });

  // ── Game: Choose Color ── REMOVED in P3.1 audit ──
  // This handler bypassed turn / ownership validation: any player could emit
  // game:choose_color and overwrite the top wild's chosenColor at any time
  // (server only checked "player exists" + "valid color"). Client never used
  // this event — the legitimate path is playCard(cardId, chosenColor) which
  // validates correctly at GameManager.js:164-169. Removing this orphan
  // socket entry point closes the side-channel without affecting gameplay.
  //
  // The chooseColor() method on GameManager remains but has no callers; left
  // in place as harmless dead code (can be cleaned up in a later sweep).

  // ── Game: Call UNO ──
  socket.on('game:call_uno', ({} = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room) return ack?.({ success: false });
    const result = room.game.callUno(userId);
    if (result.success) {
      io.to(socket.currentRoomId).emit('game:uno_called', { playerId: userId, username: socket.username });
    }
    ack?.(result);
  });

  // ── Game: Catch UNO ──
  socket.on('game:catch_uno', ({ targetId } = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room) return ack?.({ success: false });
    const result = room.game.catchUno(userId, targetId);
    if (result.success) {
      io.to(socket.currentRoomId).emit('game:uno_caught', { catcherId: userId, targetId, penaltyCards: result.penaltyCards });
      broadcastPrivateStates(room);
    }
    ack?.(result);
  });

  // ── Chat (SINGLE handler — FIX: removed duplicate) ──
  // Rate-limited per socket: 5 messages / 4 seconds. Stops table-flooding
  // without inconveniencing fast typers (the client UI further softens
  // the experience with a "slow down" hint when the throttled event fires).
  socket.on('chat:send', ({ text } = {}, ack) => {
    try {
      const room = roomsDB.get(socket.currentRoomId);
      if (!room) return ack?.({ success: false, reason: 'Not in room' });
      if (!text?.trim()) return ack?.({ success: false });
      if (!rateCheck(`chat:${socket.id}`, 5, 4000)) {
        socket.emit('chat:throttled', { ms: 2000 });
        return ack?.({ success: false, reason: 'rate_limit' });
      }
      const clean = text.trim().slice(0, 200);
      const msg = {
        id: Date.now().toString(36), roomId: room.id, userId,
        username: socket.username, text: clean, createdAt: Date.now(),
      };
      if (!room.chat) room.chat = [];
      room.chat.push(msg);
      if (room.chat.length > 50) room.chat.shift();
      io.to(room.id).emit('chat:message', msg);
      ack?.({ success: true });
    } catch(e) {
      console.error('[Chat] Error:', e.message);
      ack?.({ success: false });
    }
  });

  // ── Quick Chat (GDD §7.5) ──
  // Pre-vetted phrases for in-match social. Client sends an ID; server looks
  // up the actual text from QUICK_CHAT_PRESETS (defined at module scope) so
  // a tampered client can't inject custom text. 2s per-socket rate-limit
  // floor; client also enforces its own UI cooldown.
  socket.on('chat:quick', ({ id } = {}, ack) => {
    const presetId = parseInt(id, 10);
    const text = QUICK_CHAT_PRESETS[presetId];
    if (!text) return ack?.({ success: false, reason: 'unknown_preset' });
    const roomId = socket.currentRoomId;
    if (!roomId) return ack?.({ success: false, reason: 'not_in_room' });
    const now = Date.now();
    if (socket._lastQuickChat && now - socket._lastQuickChat < 2000) {
      socket.emit('chat:quick_throttled', { ms: 2000 });
      return ack?.({ success: false, reason: 'rate_limit' });
    }
    socket._lastQuickChat = now;
    io.to(roomId).emit('chat:quick', {
      playerId: socket.userId,
      username: socket.username,
      id: presetId,
      text,
    });
    ack?.({ success: true });
  });

  // ── Private DMs (GDD §7.5 B) ──
  // Friends-only 1:1. Server validates relationship, length, and rate.
  // Persists to Mongo so threads survive restart, then emits dm:incoming
  // to both ends (recipient AND sender's other tabs) — the sender's own
  // socket also gets dm:sent_ack via the callback so the open thread can
  // append immediately without a round-trip render lag.
  socket.on('dm:send', async ({ toUserId, text } = {}, ack) => {
    try{
      if(!socket.userId) return ack?.({ success: false, reason: 'unauth' });
      const me = usersDB.get(socket.userId);
      const other = toUserId && usersDB.get(toUserId);
      if(!me || !other)               return ack?.({ success: false, reason: 'unknown_user' });
      if(me.id === other.id)          return ack?.({ success: false, reason: 'self_dm' });
      if(!areFriends(me, other))      return ack?.({ success: false, reason: 'not_friends' });
      const clean = (typeof text === 'string' ? text : '').trim().slice(0, DM_MAX_LEN);
      if(!clean)                      return ack?.({ success: false, reason: 'empty' });
      const now = Date.now();
      if(socket._lastDM && now - socket._lastDM < DM_RATE_LIMIT_MS){
        return ack?.({ success: false, reason: 'rate_limit' });
      }
      socket._lastDM = now;
      const doc = { from: me.id, to: other.id, text: clean, at: now, read: false, important: false };
      const recvSock = findSocketByUserId(other.id);
      const recipientOnline = !!recvSock;
      if(mongoose.connection.readyState){
        // Durable mode (Mongo up): persist normally.
        try{ await DirectMessageModel.create(doc); }catch(e){ console.error('[DM] persist:', e.message); }
      } else if(recipientOnline || doc.important){
        // Ephemeral mode (Mongo down): a DM only "lands" if the recipient is
        // currently IN THE GAME. If they've left, the message doesn't reach
        // them and isn't stored (unless flagged important). Kept in memory so
        // the live conversation is visible during the session, then wiped when
        // the recipient leaves the game (_wipeUserDMs on disconnect).
        _memDMs.push(doc);
        if(_memDMs.length > _MEM_DM_CAP) _memDMs.splice(0, _memDMs.length - _MEM_DM_CAP);
      }
      const payload = { ...doc, fromName: me.username, toName: other.username };
      // Deliver live to the recipient only if they're online (in-game).
      if(recvSock) recvSock.emit('dm:incoming', payload);
      ack?.({ success: true, message: payload, delivered: recipientOnline });
    }catch(e){
      console.error('[DM] send:', e.message);
      ack?.({ success: false, reason: 'server_error' });
    }
  });

  // Open a thread → returns last 50 messages + auto-marks them read.
  socket.on('dm:thread', async ({ withUserId } = {}, ack) => {
    try{
      if(!socket.userId) return ack?.({ success: false, reason: 'unauth' });
      const me = usersDB.get(socket.userId);
      const other = withUserId && usersDB.get(withUserId);
      if(!me || !other)          return ack?.({ success: false, reason: 'unknown_user' });
      if(!areFriends(me, other)) return ack?.({ success: false, reason: 'not_friends' });
      const messages = await fetchThread(me.id, other.id, DM_THREAD_LIMIT);
      const marked = await markThreadRead(me.id, other.id);
      if(marked > 0){
        // Tell the sender (other) that the recipient (me) saw the messages
        // so their read-receipt UI can update without a refetch.
        const otherSock = findSocketByUserId(other.id);
        if(otherSock) otherSock.emit('dm:read_by', { byUserId: me.id });
        socket.emit('dm:thread_marked_read', { withUserId: other.id, count: marked });
      }
      ack?.({ success: true, messages, partner: { id: other.id, username: other.username, avatar: other.avatar } });
    }catch(e){
      console.error('[DM] thread:', e.message);
      ack?.({ success: false, reason: 'server_error' });
    }
  });

  // List threads (inbox).
  socket.on('dm:threads', async (_payload, ack) => {
    try{
      if(!socket.userId) return ack?.({ success: false, reason: 'unauth' });
      const threads = await fetchThreadList(socket.userId);
      // Decorate with usernames + avatars so client can render without
      // a second round-trip.
      const decorated = threads.map(t => {
        const u = usersDB.get(t.partnerId);
        return {
          ...t,
          partnerName: u?.username || 'Unknown',
          partnerAvatar: u?.avatar || '',
        };
      }).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
      ack?.({ success: true, threads: decorated });
    }catch(e){
      console.error('[DM] threads:', e.message);
      ack?.({ success: false, reason: 'server_error' });
    }
  });

  // Explicit "mark read" (e.g. user closes the thread without scrolling).
  socket.on('dm:read', async ({ withUserId } = {}, ack) => {
    try{
      if(!socket.userId) return ack?.({ success: false, reason: 'unauth' });
      const marked = await markThreadRead(socket.userId, withUserId);
      if(marked > 0){
        const otherSock = findSocketByUserId(withUserId);
        if(otherSock) otherSock.emit('dm:read_by', { byUserId: socket.userId });
      }
      ack?.({ success: true, count: marked });
    }catch(e){
      console.error('[DM] read:', e.message);
      ack?.({ success: false, reason: 'server_error' });
    }
  });

  // ── Game: Emoji Reaction ──
  // All validation flows through moderateGameReaction (length cap +
  // 1s server throttle, locked in as the hard cheat-resistant floor).
  // The client already enforces a 5s UX cooldown for honest play — the
  // server floor catches tampered clients that bypass the local timer.
  // Future moderation plugs in at one site without touching this handler.
  socket.on('game:reaction', ({ emoji } = {}) => {
    const user = usersDB.get(userId);
    if (!user) return;
    const result = moderateGameReaction(emoji, user, socket);
    if (!result.ok) {
      // Tell sender we throttled them so the client can surface a hint.
      // Honest clients (5s UX cooldown) will never hit this in practice.
      if (result.reason === 'rate_limit') socket.emit('game:reaction_throttled', { ms: 1000 });
      return;
    }
    socket._lastReaction = Date.now();
    // Broadcast to others in the room. Sender already animates locally
    // via showReactionFly(isMine=true) when sendReaction() emits, so we
    // intentionally use socket.to (excludes sender) — keeps the 50ms
    // network roundtrip from causing a duplicate animation on the sender.
    socket.to(socket.currentRoomId).emit('game:reaction', { playerId: userId, emoji: result.emoji });
  });

  // ── Voice chat: WebRTC signaling (offer/answer/ICE relay) ──
  // Audio itself never touches the server — these events only let peers
  // discover each other and exchange SDP/ICE so they can talk P2P.
  // Server tracks voice participants per room so the new joiner knows
  // exactly who to initiate offers to (avoids SDP glare from both sides
  // trying to be the caller simultaneously).
  socket.on('voice:join', () => {
    const rid = socket.currentRoomId;
    if (!rid) return;
    // Sender must actually belong to this room — a seated player OR a
    // spectator. NOTE the real room shape: seats live in `room.playerIds`
    // (an array of user-id strings) and spectators in `room.spectators`
    // (a Set). The earlier check used `room.players` (doesn't exist) +
    // `.some()` on the Set (not a method) so it silently rejected
    // EVERYONE — which is why nobody could hear anybody.
    const room = roomsDB.get(rid);
    if (!room) return;
    const isSeated    = Array.isArray(room.playerIds) && room.playerIds.includes(userId);
    const isSpectator = room.spectators instanceof Set && room.spectators.has(userId);
    if (!isSeated && !isSpectator) return;
    // Anti-flap: at most 6 voice:join calls per socket per 10s window
    // (a mic-on rebuild does leave+join, so allow a little headroom).
    if (!rateCheck(`vjoin:${socket.id}`, 6, 10_000)) return;
    if (!voiceRooms.has(rid)) voiceRooms.set(rid, new Set());
    const set = voiceRooms.get(rid);
    const existing = [...set].filter(id => id !== userId);
    // Tell the new joiner who's already in voice — they'll send offers
    socket.emit('voice:peers', { peers: existing });
    set.add(userId);
    // Notify others that a new peer joined (they wait for the offer)
    socket.to(rid).emit('voice:peer_joined', { peerId: userId });
  });
  socket.on('voice:leave', () => {
    const rid = socket.currentRoomId;
    if (!rid) return;
    voiceRooms.get(rid)?.delete(userId);
    if (voiceRooms.get(rid)?.size === 0) voiceRooms.delete(rid);
    socket.to(rid).emit('voice:peer_left', { peerId: userId });
  });
  socket.on('voice:signal', ({ to, kind, payload } = {}) => {
    // Hardened relay. Without these checks a malicious client could:
    //   • Spam SDP offers at any other user, bypassing room scope
    //   • Inject huge payloads to amplify bandwidth use
    //   • Send unknown `kind` values to probe behaviour
    const rid = socket.currentRoomId;
    if (!rid || !to || typeof to !== 'string') return;
    // Sender + target MUST both be in the voice participant set for
    // this room. voice:join populates voiceRooms; without that the
    // relay is rejected silently.
    const vroom = voiceRooms.get(rid);
    if (!vroom || !vroom.has(userId) || !vroom.has(to)) return;
    // Validate signal kind so we only relay genuine WebRTC traffic.
    const VALID_KINDS = new Set(['offer', 'answer', 'ice']);
    if (!VALID_KINDS.has(kind)) return;
    // Spectators are LISTEN-ONLY. Never relay an SDP from a spectator that
    // would let them SEND audio to the table. Honest spectator clients stay
    // recvonly; this drops a TAMPERED spectator that tries to transmit.
    if (socket.isSpectator && (kind === 'offer' || kind === 'answer')) {
      const sdp = (payload && typeof payload.sdp === 'string') ? payload.sdp : '';
      if (/m=audio[\s\S]*?a=(sendrecv|sendonly)/.test(sdp)) {
        return;   // spectator may only RECEIVE audio
      }
    }
    // Cap payload size — biggest legit signaling object (SDP offer)
    // is ~6KB. 32KB is a generous ceiling that still kills the
    // amplification angle.
    try {
      if (payload && JSON.stringify(payload).length > 32 * 1024) return;
    } catch(_) { return; }
    // Per-socket signal rate cap — even legit clients only emit a
    // handful of signals per peer connection setup. 60/sec is well
    // above that while throttling any flood.
    if (!rateCheck(`vsig:${socket.id}`, 60, 1000)) return;
    const targetSock = findSocketByUserId(to);
    if (targetSock) {
      targetSock.emit('voice:signal', { from: userId, kind, payload });
    }
  });
  socket.on('voice:speaking', ({ speaking } = {}) => {
    if (!socket.currentRoomId) return;
    socket.to(socket.currentRoomId).emit('voice:speaking', { peerId: userId, speaking: !!speaking });
  });
  
  // ── Game: Challenge WD4 ── REMOVED in P3.1 audit ──
  // This handler called room.game.challengeWildDraw4(userId), a method that
  // doesn't exist on GameManager. Every emit produced a TypeError (caught by
  // Socket.IO so the server didn't crash, but logged each time). Client never
  // wired the event either — the WD4 challenge mechanic was scaffolded and
  // never finished. Removing the dead handler. If we want the challenge
  // feature later (player can challenge "did you really have no matching
  // color?"), it's a future feature add, not a bug fix.

  // ── Matchmaking ──
  socket.on('matchmaking:join', ({ settings = {} } = {}, ack) => {
    // Anti-flood: each join enqueues + arms a 10s bot-spawn timer, so a
    // client spamming this could churn rooms/bots. Cap at 6 / 10s per socket.
    if (!rateCheck(`mm:${socket.id}`, 6, 10000)) {
      return ack?.({ success: false, reason: 'Slow down — too many matchmaking requests' });
    }
    const existingIdx = matchmakingQueue.findIndex(e => e.userId === userId);
    if (existingIdx !== -1) {
      const old = matchmakingQueue.splice(existingIdx, 1)[0];
      if (old?.botTimer) clearTimeout(old.botTimer);
    }
    const entry = { userId, socketId: socket.id, settings, joinedAt: Date.now(), botTimer: null };
    matchmakingQueue.push(entry);
    tryMatchmaking(io, usersDB, roomsDB);
    // If still waiting after 10s, drop in a bot opponent
    entry.botTimer = setTimeout(() => {
      const idx = matchmakingQueue.findIndex(e => e.userId === userId);
      if (idx === -1) return;
      const e = matchmakingQueue.splice(idx, 1)[0];
      spawnBotMatch(e);
    }, 10000);
    ack?.({ success: true, queueSize: matchmakingQueue.length });
    console.log(`[MM] ${socket.username} joined queue (${matchmakingQueue.length} waiting)`);
  });

  socket.on('matchmaking:leave', ({} = {}, ack) => {
    const idx = matchmakingQueue.findIndex(e => e.userId === userId);
    if (idx !== -1) {
      const e = matchmakingQueue.splice(idx, 1)[0];
      if (e?.botTimer) clearTimeout(e.botTimer);
    }
    ack?.({ success: true });
  });

  // ── Training Ground — instant solo match vs a difficulty-scaled bot ──
  socket.on('practice:start', ({ difficulty = 'medium' } = {}, ack) => {
    // Anti-flood: each call spins up a fresh room + bot. Cap at 5 / 15s.
    if (!rateCheck(`practice:${socket.id}`, 5, 15000)) {
      return ack?.({ success: false, reason: 'Slow down' });
    }
    const user = usersDB.get(userId);
    if (!user) return ack?.({ success: false, reason: 'User not found' });
    if (!['easy', 'medium', 'hard'].includes(difficulty)) difficulty = 'medium';

    const room = createRoomRecord(user.id, { maxPlayers: 2, bet: 0, botDifficulty: difficulty });
    room.game = new GameManager(room.id, room.settings);
    room.isPractice = true;
    attachGameListeners(room);

    const player = new Player(user.id, user.username, user.coins);
    player.avatar = user.avatar; player.cardBackId = user.equippedCardBack || 'cb_default';
    player.tableFelt = user.equippedTableFelt || 'tfp_green';
    room.game.addPlayer(player);
    room.playerIds.push(user.id);

    const botName = UNO_BOT_NAMES[Math.floor(Math.random() * UNO_BOT_NAMES.length)];
    const bot = new Player('bot_' + Date.now(), botName, 0);
    bot.isBot = true;
    bot.isConnected = true;
    bot.status = 'active';
    bot.avatar = randomPresetAvatar();
    decorateBot(bot, difficulty);
    room.game.addPlayer(bot);
    room.playerIds.push(bot.id);

    roomsDB.set(room.id, room);
    socket.join(room.id);
    socket.currentRoomId = room.id;
    console.log(`[Practice] ${user.username} vs ${difficulty} bot in ${room.id}`);

    ack?.({ success: true, roomId: room.id });

    // Auto-start after a short beat so the transition feels smooth
    setTimeout(() => {
      const r = roomsDB.get(room.id);
      if (!r) {
        io.to(room.id).emit('practice:error', { reason: 'Match room expired' });
        return;
      }
      if (r.status === 'lobby') {
        const result = r.game.startGame(user.id);
        if (!result.success) {
          console.error(`[Practice] startGame failed for ${user.username}: ${result.reason}`);
          io.to(room.id).emit('practice:error', { reason: result.reason || 'Could not start match' });
          return;
        }
        r.status = 'playing';
        r.startedAt = Date.now();
      }
      const p = r.game.players.find(pp => pp.id === user.id);
      if (!p) return;
      const state = r.game._playerState(p);
      // Emit to the room (the player's socket joined it) — reliable even if
      // the socket id changed. Also hit the live socket directly as a backup.
      io.to(room.id).emit('game:state', state);
      const ps = findSocketByUserId(user.id);
      if (ps && !ps.rooms?.has(room.id)) ps.emit('game:state', state);
    }, 1200);
  });

  // ── World Chat — global lobby chat ──
  // History: send the most recent WORLD_CHAT_HISTORY (40) on connect.
  socket.emit('world:history', worldChat.slice(-WORLD_CHAT_HISTORY));
  socket.on('world:send', async ({ text } = {}) => {
    const user = usersDB.get(userId);
    if (!user) return;
    // All validation flows through moderateWorldMessage so future filters
    // (link blocker, profanity, per-user windows) plug in at one site.
    const result = moderateWorldMessage(text, user, socket);
    if (!result.ok) {
      // Tell the sender we throttled them so the UI can show a hint; ignored
      // silently by clients that don't bind this event yet.
      if (result.reason === 'rate_limit') socket.emit('world:throttled', { ms: 1200 });
      return;
    }
    socket._lastWorldMsg = Date.now();
    const entry = {
      id: 'w' + Date.now() + Math.random().toString(36).slice(2, 6),
      userId: user.id, name: user.username, avatar: user.avatar || null,
      text: result.text, at: Date.now(),
    };
    worldChat.push(entry);
    if (worldChat.length > WORLD_CHAT_CAP) worldChat.shift();
    io.emit('world:msg', entry);
    // Persist + bounded prune. Prune is probabilistic (~5%) so we don't pay
    // the count/delete cost on every message.
    saveWorldMessage(entry);
    if (Math.random() < 0.05) pruneWorldMessages();
  });

  // ── Disconnect ──
  socket.on('disconnect', (reason) => {
    socketToUser.delete(socket.id);
    // Drop this socket from the per-user connection set (and the whole entry
    // when it was their last one) so the cap map can't grow unbounded.
    const _us = userSockets.get(userId);
    if (_us) { _us.delete(socket.id); if (!_us.size) userSockets.delete(userId); }
    // Only emit offline if this was the LAST socket for this user (multi-tab
    // edge case — if another tab is still connected, the friend should still
    // see them online).
    const stillOnline = [...socketToUser.values()].includes(userId);
    if (!stillOnline) {
      emitPresenceToFriends(userId, { userId, online: false });
      // They've left the whole game (no sockets left) — wipe their ephemeral
      // DMs (everything except important) so they come back to a clean inbox.
      if (!mongoose.connection.readyState) {
        const wiped = _wipeUserDMs(userId);
        if (wiped) console.log(`[DM] wiped ${wiped} ephemeral message(s) for ${socket.username} on leave`);
      }
    }
    broadcastOnlineCount();
    const roomId = socket.currentRoomId;
    // Drop from voice room if applicable so peers can clean up
    if (roomId && voiceRooms.has(roomId)) {
      voiceRooms.get(roomId).delete(userId);
      if (voiceRooms.get(roomId).size === 0) voiceRooms.delete(roomId);
      socket.to(roomId).emit('voice:peer_left', { peerId: userId });
    }
    if (roomId) {
      const room = roomsDB.get(roomId);
      if (socket.isSpectator && room?.spectators) {
        room.spectators.delete(userId);
        socket.to(roomId).emit('room:spectator_left', {
          spectatorId: userId, count: room.spectators.size,
        });
      } else {
        // Involuntary disconnect — 30s grace before abandon (GDD §5.5).
        handlePlayerLeave(socket, roomId, { voluntary: false });
      }
    }
    const idx = matchmakingQueue.findIndex(e => e.userId === userId);
    if (idx !== -1) matchmakingQueue.splice(idx, 1);
    console.log(`[Socket] Disconnected: ${socket.username} (${reason})`);
  });
});

// ─────────────────────────────────────────
// GAME EVENT LISTENERS
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// DAMA — server-authoritative game listeners
// ─────────────────────────────────────────
// Mirrors attachGameListeners but for the 8×8 board engine. Both
// players see the same public state (the board is fully public —
// no hidden information). dama:match_over triggers the pot payout.
function attachDamaListeners(room){
  const game = room.game, roomId = room.id;

  const broadcast = () => io.to(roomId).emit('dama:state', game.publicState());

  game.on('dama:state',      () => broadcast());
  game.on('dama:turn',       (d) => io.to(roomId).emit('dama:turn',  d));
  game.on('dama:move',       (d) => { io.to(roomId).emit('dama:move', d); broadcast(); });
  game.on('dama:match_over', (d) => {
    io.to(roomId).emit('dama:match_over', d);
    try {
      const pot = room.pot || 0;
      if (pot > 0){
        if (d.winnerColor === null){
          // DRAW (5-min timer with equal piece counts) — refund every
          // human their entry fee. Bots play free, so they take nothing.
          const humans = game.players.filter(p => !p.isBot);
          if (humans.length){
            const refund = Math.floor(pot / humans.length);
            humans.forEach(p => {
              const u = usersDB.get(p.id);
              if (!u) return;
              u.coins = (u.coins || 0) + refund;
              const sock = findSocketByUserId(p.id);
              if (sock) sock.emit('match:payout', { coins:u.coins, gained:refund, reason:'dama_draw', pot, houseCut:0 });
            });
          }
        } else {
          // Outright winner takes the whole pot.
          const winner = game.players.find(p => p.color === d.winnerColor && !p.isBot);
          if (winner){
            const u = usersDB.get(winner.id);
            if (u){
              u.coins = (u.coins || 0) + pot;
              const sock = findSocketByUserId(winner.id);
              if (sock) sock.emit('match:payout', { coins:u.coins, gained:pot, reason:'dama_win', pot, houseCut:0 });
            }
          }
        }
        room.pot = 0;
      }
      saveUsers();
    } catch(e){ console.error('[Dama] payout failed:', e.message); }
    setTimeout(() => { roomsDB.delete(roomId); console.log(`[Room] Dama room cleaned: ${roomId}`); }, 30_000);
  });
}

// ─────────────────────────────────────────
// CHESS — server-authoritative game listeners
// ─────────────────────────────────────────
// Same shape as attachDamaListeners: the board is fully public, so one
// broadcast serves both players. chess:match_over triggers the payout —
// a decisive result pays the winner, any draw refunds the humans.
function attachChessListeners(room){
  const game = room.game, roomId = room.id;

  const broadcast = () => io.to(roomId).emit('chess:state', game.publicState());

  game.on('chess:state',        () => broadcast());
  game.on('chess:turn',         (d) => io.to(roomId).emit('chess:turn',  d));
  game.on('chess:move',         (d) => { io.to(roomId).emit('chess:move', d); broadcast(); });
  game.on('chess:draw_offer',   (d) => io.to(roomId).emit('chess:draw_offer', d));
  game.on('chess:draw_declined',(d) => io.to(roomId).emit('chess:draw_declined', d));
  game.on('chess:match_over', (d) => {
    io.to(roomId).emit('chess:match_over', d);
    try {
      const pot = room.pot || 0;
      if (pot > 0){
        if (d.winnerColor === null){
          // Draw (stalemate / insufficient material / 50-move / repetition
          // / equal material on the clock) — refund each human their entry.
          const humans = game.players.filter(p => !p.isBot);
          if (humans.length){
            const refund = Math.floor(pot / humans.length);
            humans.forEach(p => {
              const u = usersDB.get(p.id);
              if (!u) return;
              u.coins = (u.coins || 0) + refund;
              const sock = findSocketByUserId(p.id);
              if (sock) sock.emit('match:payout', { coins:u.coins, gained:refund, reason:'chess_draw', pot, houseCut:0 });
            });
          }
        } else {
          const winner = game.players.find(p => p.color === d.winnerColor && !p.isBot);
          if (winner){
            const u = usersDB.get(winner.id);
            if (u){
              u.coins = (u.coins || 0) + pot;
              const sock = findSocketByUserId(winner.id);
              if (sock) sock.emit('match:payout', { coins:u.coins, gained:pot, reason:'chess_win', pot, houseCut:0 });
            }
          }
        }
        room.pot = 0;
      }
      saveUsers();
    } catch(e){ console.error('[Chess] payout failed:', e.message); }
    setTimeout(() => { roomsDB.delete(roomId); console.log(`[Room] Chess room cleaned: ${roomId}`); }, 30_000);
  });
}

// RONDA listeners — mirrors attachDamaListeners. Broadcasts a public
// state plus per-player private state (so each player only sees their
// own hand). Pays out the pot on ronda:match_over.
function attachRondaListeners(room){
  const game = room.game, roomId = room.id;
  const broadcast = () => {
    io.to(roomId).emit('ronda:state', game.publicState());
    // Direct `private_state` pushes bypass socket.io rooms, so we must
    // check the socket is STILL associated with this room — otherwise a
    // player who left voluntarily keeps receiving private state from the
    // old match and the client re-enters them when they try to play
    // somewhere else. Skip disconnected players too: their seat exists
    // for the match economy but they don't need a state stream.
    room.playerIds.forEach(pid => {
      const sock = findSocketByUserId(pid);
      if (!sock) return;
      if (sock.currentRoomId !== roomId) return;
      sock.emit('ronda:private_state', game.privateStateFor(pid));
    });
  };

  game.on('ronda:state',           () => broadcast());
  game.on('ronda:turn',            (d) => io.to(roomId).emit('ronda:turn', d));
  game.on('ronda:deal',            (d) => { io.to(roomId).emit('ronda:deal', d); broadcast(); });
  game.on('ronda:specials',        (d) => io.to(roomId).emit('ronda:specials', d));
  game.on('ronda:play',            (d) => { io.to(roomId).emit('ronda:play', d); broadcast(); });
  game.on('ronda:capture',         (d) => { io.to(roomId).emit('ronda:capture', d); broadcast(); });
  game.on('ronda:round_over',      (d) => { io.to(roomId).emit('ronda:round_over', d); broadcast(); });
  // New: dealer pick reveal (initial), declaration window/results,
  // and chain-capture (derba) events.
  game.on('ronda:dealer_pick',     (d) => io.to(roomId).emit('ronda:dealer_pick', d));
  game.on('ronda:declare_window',          (d) => io.to(roomId).emit('ronda:declare_window', d));
  game.on('ronda:declared',                (d) => io.to(roomId).emit('ronda:declared', d));
  game.on('ronda:declare_expired',         (d) => io.to(roomId).emit('ronda:declare_expired', d));
  game.on('ronda:declare_window_closed',   (d) => io.to(roomId).emit('ronda:declare_window_closed', d));
  game.on('ronda:declarations_resolved',   (d) => io.to(roomId).emit('ronda:declarations_resolved', d));
  game.on('ronda:chain_extend',    (d) => io.to(roomId).emit('ronda:chain_extend', d));
  game.on('ronda:chain_settled',   (d) => io.to(roomId).emit('ronda:chain_settled', d));
  game.on('ronda:dealer_penalty',  (d) => io.to(roomId).emit('ronda:dealer_penalty', d));
  game.on('ronda:match_over', (d) => {
    // RANKED RONDA — rage-quitters take the abandon ladder FIRST, then everyone's
    // team win/loss delta is computed and attached so the win screen can show it.
    try {
      if (room.settings?.ranked) {
        applyRankedAbandonPenalties(room);
        d.rankedChanges = applyRondaRankedResult(room, d);
      }
    } catch(e){ console.error('[RankedRonda] scoring failed:', e.message); }
    io.to(roomId).emit('ronda:match_over', d);
    try {
      const pot = room.pot || 0;
      if (pot > 0){
        // Winning TEAM splits the pot among its human members.
        // Bots take nothing.
        const winners = game.players.filter(p => p.team === d.winnerTeam && !p.isBot);
        if (winners.length){
          const share = Math.floor(pot / winners.length);
          winners.forEach(p => {
            const u = usersDB.get(p.id);
            if (!u) return;
            u.coins = (u.coins || 0) + share;
            const sock = findSocketByUserId(p.id);
            if (sock) sock.emit('match:payout', { coins:u.coins, gained:share, reason:'ronda_win', pot, houseCut:0 });
          });
        }
        room.pot = 0;
      }
      saveUsers();
    } catch(e){ console.error('[Ronda] payout failed:', e.message); }
    setTimeout(() => { roomsDB.delete(roomId); console.log(`[Room] Ronda room cleaned: ${roomId}`); }, 30_000);
  });
}

function attachGameListeners(room) {
  const game = room.game, roomId = room.id;

  game.on('game:over', (data) => {
    const bet = room.settings.bet || 0;
    const winnerData = data.winners?.[0];

    // ── La Liga best-of-2: handle round 1 end BEFORE the room is
    //    finalized. We bail out without flipping room.status, without
    //    paying coins, without emitting game:over to clients. The room
    //    stays alive, the GameManager resets, and round 2 begins fresh
    //    in the same room with the same players. ──
    if (room.leagueMatchId && globalLeague && winnerData) {
      const match = globalLeague.schedule.find(m => m.id === room.leagueMatchId);
      if (match && match.status !== 'finished' && match.rounds.length === 0) {
        const ownerSlot = globalLeague.slots.find(s => s.userId === room.leagueOwnerId);
        const winnerSlotId = winnerData.id === room.leagueOwnerId
          ? (ownerSlot?.slotId || null)
          : winnerData.id;
        const r1 = winnerSlotId === match.p1 ? 'p1'
                 : winnerSlotId === match.p2 ? 'p2'
                 : 'draw';
        match.rounds.push(r1);
        saveLeague();

        io.to(roomId).emit('league:round_ended', {
          round: 1,
          winnerSlotId,
          nextRoundIn: 4500,
        });

        setTimeout(() => {
          const r = roomsDB.get(roomId);
          if (!r || !r.game) return;
          r.game.resetForNextGame();
          const start = r.game.startGame(r.playerIds[0]);
          if (!start.success) {
            console.warn('[League] Round 2 start failed:', start.reason);
            return;
          }
          r.playerIds.forEach(pid => {
            const player = r.game.players.find(p => p.id === pid);
            if (!player) return;
            const sock = findSocketByUserId(pid);
            if (sock) sock.emit('game:state', r.game._playerState(player));
          });
          if (r.spectators?.size) {
            const specState = r.game._spectatorState();
            r.spectators.forEach(sid => {
              const sock = findSocketByUserId(sid);
              if (sock) sock.emit('game:spectator_state', specState);
            });
          }
          io.to(roomId).emit('league:round_started', { round: 2 });
        }, 4500);

        return; // skip the rest of the normal game-over flow
      }
    }

    // From here on: this is a real game ending (non-league or league
    // round 2 finishing). Mark the room finished and run the usual flow.
    room.status = 'finished';

    // Round 2 of a league match — record the second result + finalize
    if (room.leagueMatchId && globalLeague && winnerData) {
      const match = globalLeague.schedule.find(m => m.id === room.leagueMatchId);
      if (match && match.status !== 'finished' && match.rounds.length === 1) {
        const ownerSlot = globalLeague.slots.find(s => s.userId === room.leagueOwnerId);
        const winnerSlotId = winnerData.id === room.leagueOwnerId
          ? (ownerSlot?.slotId || null)
          : winnerData.id;
        const r2 = winnerSlotId === match.p1 ? 'p1'
                 : winnerSlotId === match.p2 ? 'p2'
                 : 'draw';
        match.rounds.push(r2);
        recordMatchResult(globalLeague, match);
        saveLeague();
      }
    }
    // ELO calculation
    const winnerUser = winnerData ? usersDB.get(winnerData.id) : null;
    const loserUsers = data.players.filter(p => p.id !== winnerData?.id).map(p => usersDB.get(p.id)).filter(Boolean);
    let eloGain = 0, eloLoss = 0;
    if(winnerUser && loserUsers.length > 0) {
      const avgLoserElo = loserUsers.reduce((s,u) => s+(u.elo||1000), 0) / loserUsers.length;
      const elo = calcELO(winnerUser.elo||1000, avgLoserElo);
      eloGain = elo.gain; eloLoss = elo.loss;
      winnerUser.elo = Math.max(0, (winnerUser.elo||1000) + eloGain);
      loserUsers.forEach(u => { u.elo = Math.max(0, (u.elo||1000) - eloLoss); });
    }

    // Per-player stats / match history / BP XP. Entry fees were ALREADY
    // debited at match start (P4 socket.on('game:start')), so we deliberately
    // do NOT touch user.coins for losers here — they paid up front.
    data.players.forEach(playerData => {
      const user = usersDB.get(playerData.id);
      if (!user) return;                                 // bots not in usersDB
      user.stats.gamesPlayed++;
      if (!Array.isArray(user.matchHistory)) user.matchHistory = [];
      const won = winnerData && winnerData.id === playerData.id;
      ensureBP(user);
      const matchXP = won ? 220 : 90;
      user.bp.xp += matchXP;
      // GDD §7.2 — persistent account XP runs in parallel with seasonal BP XP.
      // Same numbers; level-ups grant coins (+50×level) and diamonds every 10th
      // level via account:levelup events the client toasts.
      applyAccountXP(user, matchXP, 'match');
      const opponents = data.players.filter(p => p.id !== playerData.id).map(p => p.username);
      // Compute the rp delta for this user from rankedChanges (populated
      // earlier in the same handler for RANKED rooms; null otherwise).
      // Surfacing it on matchHistory lets the Ranked Hub render a tidy
      // recent-matches strip without a second API round-trip.
      const myRankedChange = (data.rankedChanges || []).find(rc => rc.playerId === playerData.id);
      user.matchHistory.unshift({
        at: Date.now(),
        won,
        opponents,
        eloChange: won ? eloGain : -eloLoss,
        rpChange:  myRankedChange ? myRankedChange.delta : null,
        roomType:  room.roomType || null,
        bet,
      });
      if (user.matchHistory.length > 20) user.matchHistory.length = 20;
      if (won) { user.stats.gamesWon++; const _lb = ensureLbFields(user); _lb.weekWins++; _lb.monthWins++; }
      // Broke gift only fires for losers who are now at 0 — entry fee
      // already came off their balance at start, so this catches the case
      // where the fee took them to zero. Same gift logic as before.
      if (!won && user.coins <= 0) {
        if (!user.brokeCount) user.brokeCount = 0;
        if (!user.lastBrokeAt) user.lastBrokeAt = 0;
        const gifts = CONFIG.BROKE_GIFTS;
        if (user.brokeCount < gifts.length) {
          user.coins = gifts[user.brokeCount];
          console.log(`[Coins] Broke gift #${user.brokeCount+1}: +${gifts[user.brokeCount]} for ${user.username}`);
          user.brokeCount++;
          user.lastBrokeAt = Date.now();
        } else if (user.instaFollowed) {
          if (!user.brokeCount2) user.brokeCount2 = 0;
          const gifts2 = [500, 200, 100];
          if (user.brokeCount2 < gifts2.length) {
            user.coins = gifts2[user.brokeCount2];
            user.brokeCount2++;
          } else if (Date.now() - user.lastBrokeAt >= CONFIG.BROKE_COOLDOWN) {
            user.coins = CONFIG.DAILY_LOGIN_COINS;
            user.brokeCount2 = 1;
            user.lastBrokeAt = Date.now();
          }
        }
      }
    });

    // ── P4: Pot distribution (+ P4-NEW.1a abandoned forfeit) ──────────
    // Pot was collected at match start. Server keeps HOUSE_CUT; the rest
    // goes to the winner. Three cases:
    //   1. Winner is a NON-abandoned human  -> they get the full payout.
    //   2. Winner is a bot OR an abandoned human -> they forfeit; split
    //      the payout equally among remaining NON-abandoned humans.
    //   3. No non-abandoned humans remaining -> pot stays with the house.
    // Per-recipient 'match:payout' events push the new balance to each
    // affected socket so the client doesn't need to mirror balances.
    const winnerPlayer = winnerData
      ? room.game?.players?.find(p => p.id === winnerData.id)
      : null;
    const winnerAbandoned = !!winnerPlayer?.abandoned;
    // potEligibleHumans: humans who DIDN'T win and DIDN'T abandon. Used for
    // the bot/abandoned-winner redistribute. Kept separate from loserUsers
    // (which drives ELO) so abandoned players still lose ELO normally.
    const potEligibleHumans = data.players
      .filter(p => p.id !== winnerData?.id)
      .map(p => {
        const gp = room.game?.players?.find(rp => rp.id === p.id);
        if (gp?.abandoned) return null;                  // abandoned humans don't get pot share
        return usersDB.get(p.id);
      })
      .filter(Boolean);

    const pot = room.pot || 0;
    let houseCut = 0, payout = 0;
    if (pot > 0) {
      houseCut = Math.floor(pot * HOUSE_CUT);
      payout   = pot - houseCut;
      const winnerUser = (winnerData && !winnerAbandoned) ? usersDB.get(winnerData.id) : null;
      if (winnerUser) {
        winnerUser.coins += payout;
        logReward(winnerUser, '🪙', `Match win — pot ${pot} (−${houseCut} fee)`, payout);
        const sock = findSocketByUserId(winnerUser.id);
        if (sock) sock.emit('match:payout', { coins: winnerUser.coins, gained: payout, reason: 'win', pot, houseCut });
      } else if (potEligibleHumans.length > 0) {
        // Bot won OR human winner abandoned — split among non-abandoned humans.
        const share = Math.floor(payout / potEligibleHumans.length);
        const reason = winnerAbandoned ? 'abandoned_split' : 'bot_split';
        if (share > 0) {
          potEligibleHumans.forEach(u => {
            u.coins += share;
            logReward(u, '🪙', `${winnerAbandoned ? 'Opponent abandoned' : 'Bot win'} — pot split (${potEligibleHumans.length} ways)`, share);
            const sock = findSocketByUserId(u.id);
            if (sock) sock.emit('match:payout', { coins: u.coins, gained: share, reason, pot, houseCut });
          });
        }
        // Integer-division remainder stays with the house (rare, ≤ #humans).
      }
      // else: no non-abandoned humans at all → pot kept by house.
      room.pot = 0;
      if (room.game) room.game.pot = 0;
    }
    data.pot      = pot;
    data.houseCut = houseCut;
    data.payout   = payout;
    data.winnerAbandoned = winnerAbandoned;              // client can show "opponent abandoned" copy

    // ── Ranked abandon penalty (P4-NEW.1b + Phase 4 progressive ladder) ──
    // Penalty only applies when REAL OPPONENTS were inconvenienced. If
    // the room was filled by the bot-fill timer (no humans other than
    // the abandoner), nobody's session got ruined — no penalty, no ban,
    // no RP / ELO loss. Players who genuinely walked out on other
    // people still get the tier-scaled punishment (7-day decay to
    // first-offense tier, per-user ranked:penalty event etc).
    if (room.roomType === 'RANKED') {
      const humanCount = (room.game?.players || []).filter(p => !p.isBot && usersDB.get(p.id)).length;
      const otherHumansAtSeat = humanCount > 1;
      data.players.forEach(playerData => {
        const gp = room.game?.players?.find(p => p.id === playerData.id);
        if (!gp?.abandoned) return;
        const u = usersDB.get(playerData.id);
        if (!u) return;                                  // bots not in usersDB → skipped
        ensureRankedFields(u);
        if (!otherHumansAtSeat) {
          // Solo-vs-bots ranked room → walking out hurts nobody. Skip
          // the penalty entirely so the player can immediately re-queue.
          console.log(`[Ranked] ${u.username} abandoned solo-vs-bots match — no penalty applied`);
          return;
        }
        const tier = rankedAbandonTier(u);              // may also decay the counter
        u.rankedAbandonCount   = (u.rankedAbandonCount || 0) + 1;
        u.rankedLastAbandonAt  = Date.now();
        u.rankedBanUntil       = Date.now() + tier.banMs;
        u.elo                  = Math.max(0, (u.elo || 1000) - tier.elo);
        u.rankPoints           = Math.max(0, (u.rankPoints || 0) - tier.rank);
        console.log(`[Ranked] ${u.username} abandoned in ${roomId} — offense #${u.rankedAbandonCount}: -${tier.elo} ELO / -${tier.rank} RP / ${Math.round(tier.banMs/60000)}min ban`);
        const sock = findSocketByUserId(u.id);
        if (sock) sock.emit('ranked:penalty', {
          elo:           -tier.elo,
          rankPoints:    -tier.rank,
          bannedUntil:   u.rankedBanUntil,
          offenseCount:  u.rankedAbandonCount,
          tier:          Math.min(RANKED_ABANDON_LADDER.length, u.rankedAbandonCount),
          reason:        'abandon',
        });
      });
    }

    // ── RANKED MODE — Phase 1: per-player rankPoints deltas ────────────
    // Runs ONLY for RANKED rooms. Builds a placement table from finalHand
    // (winner = 1st, then ascending cards-left = better placement), calls
    // rankedDelta() per human (bots have no usersDB entry so they skip),
    // updates rankPoints + peak + W/L + streak + placementGamesPlayed,
    // also keeps user.elo trending (Option A: hidden matchmaking signal),
    // and attaches data.rankedChanges[] so the client win-screen can show
    // the rank-change badge / placement counter.
    if (room.roomType === 'RANKED') {
      const statsById = new Map();
      (data.stats || []).forEach(s => statsById.set(s.id, s));
      const order = data.players
        .map(p => ({
          id: p.id,
          username: p.username,
          isWinner: !!(winnerData && winnerData.id === p.id),
          finalHand:  statsById.get(p.id)?.finalHand  ?? 99,
          handPoints: statsById.get(p.id)?.handPoints ?? 0,
        }))
        // Winner first, then by cards left ascending (fewer = better)
        .sort((a, b) => {
          if (a.isWinner && !b.isWinner) return -1;
          if (b.isWinner && !a.isWinner) return  1;
          return a.finalHand - b.finalHand;
        });
      const totalPlayers = order.length;
      const rankSnapshots = order.map(o => {
        const u = usersDB.get(o.id);
        return u ? (ensureRankedFields(u), u.rankPoints || 0) : 0;
      });

      const rankedChanges = [];
      order.forEach((o, idx) => {
        const u = usersDB.get(o.id);
        if (!u) return;                                    // bot — skip
        const placement   = idx + 1;
        const isPlacement = (u.placementGamesPlayed || 0) < 5;
        const playerRank  = u.rankPoints || 0;
        const oppRanks    = rankSnapshots.filter((_, i) => i !== idx);

        // Math inputs:
        //   • handPoints     — this player's own remaining UNO points
        //     (drives their loss bleed; ignored on a win).
        //   • oppHandPoints  — total points across the OTHER seats
        //     (drives the winner's gain — bigger pot = bigger swing).
        //   • tierName       — gates the loss multiplier (low tiers
        //     forgiving, high tiers brutal).
        const currentTier = (isPlacement || playerRank < (LEAGUES[0]?.max || 499))
          ? 'Bronze'
          : getLeague(playerRank).name;
        const oppHandPoints = order
          .filter((_, i) => i !== idx)
          .reduce((s, x) => s + (x.handPoints || 0), 0);
        const _bd = {};
        const delta = rankedDelta({
          placement,
          playerRank,
          oppRanks,
          isPlacement,
          totalPlayers,
          handPoints:    o.handPoints,
          oppHandPoints,
          tierName:      currentTier,
        }, _bd);

        u.rankPoints = Math.max(0, playerRank + delta);
        if (u.rankPoints > (u.peakRankPoints || 0)) u.peakRankPoints = u.rankPoints;
        const wasPlacement = isPlacement;
        u.placementGamesPlayed = Math.min(5, (u.placementGamesPlayed || 0) + 1);
        // Sticky veteran flag — once a player completes 5 placement games
        // they're forever a "ranked player". Next season's rollover will
        // reset them to Gold, never back to Bronze (Bronze is for fresh
        // accounts only).
        if (u.placementGamesPlayed >= 5 && !u.hasCompletedPlacement) {
          u.hasCompletedPlacement = true;
        }
        if (placement === 1) {
          u.rankedWins   = (u.rankedWins   || 0) + 1;
          u.winStreak    = (u.winStreak    || 0) + 1;
        } else {
          u.rankedLosses = (u.rankedLosses || 0) + 1;
          u.winStreak    = 0;
        }

        // Phase 4 — anti-smurf signal accumulated across placement games.
        // We track wins + total cards-in-opponents'-hands (a proxy for
        // dominance — beating a 4-card hand is normal, beating two 14-card
        // hands suggests skill). When the 5th placement game completes we
        // score the player and flag suspected smurfs.
        if (wasPlacement) {
          if (placement === 1) u.placementWins = (u.placementWins || 0) + 1;
          if (placement === 1) {
            const beaten = (data.stats || [])
              .filter(s => s.id !== u.id)
              .reduce((sum, s) => sum + (s.finalHand || 0), 0);
            u.placementCardsBeaten = (u.placementCardsBeaten || 0) + beaten;
          }
          // Score + flag at the moment placement completes
          if (u.placementGamesPlayed >= 5) {
            const wins   = u.placementWins || 0;
            const beaten = u.placementCardsBeaten || 0;
            const accountAgeDays = u.createdAt
              ? (Date.now() - u.createdAt) / (24 * 60 * 60 * 1000)
              : 999;
            // Heuristic: 5/5 wins → 50 base, +avg cards beaten, age penalty
            // for accounts younger than 7 days. Flag at ≥80 score.
            let score = wins * 10;
            score += Math.min(40, beaten / Math.max(1, wins) * 2);
            if (accountAgeDays < 7) score += 20;
            if (wins >= 4) score += 15;
            u.smurfScore   = Math.round(score);
            u.smurfFlagged = u.smurfScore >= 80;
            if (u.smurfFlagged) {
              console.log(`[Smurf] ${u.username} flagged after placement (score ${u.smurfScore}, ${wins}/5 wins, ${beaten} cards beaten, ${accountAgeDays.toFixed(1)}d old)`);
            }
          }
        }

        const tier = (u.placementGamesPlayed >= 5) ? getLeague(u.rankPoints) : null;
        rankedChanges.push({
          playerId:             u.id,
          placement,
          delta,
          newRank:              u.rankPoints,
          peakRank:             u.peakRankPoints,
          isPlacement,
          placementGamesPlayed: u.placementGamesPlayed,
          rankedTier:           tier,
          // Math breakdown surfaced for the post-match cinematic so the
          // player can SEE why they earned/lost what they did — turns the
          // RP swing from arbitrary into transparent UNO math.
          handPoints:           o.handPoints,
          oppHandPoints,
          finalHand:            o.finalHand,
          tierName:             currentTier,
          // Premium ranked-result panel inputs:
          oldRank:              playerRank,
          breakdown:            _bd,                 // { base, skill, margin } → sums to delta
          streak:               u.winStreak || 0,    // current win streak (already updated above)
        });

        const sock = findSocketByUserId(u.id);
        if (sock) sock.emit('ranked:rating_update', {
          delta,
          newRank:              u.rankPoints,
          peakRank:             u.peakRankPoints,
          placement,
          totalPlayers,
          isPlacement,
          placementGamesPlayed: u.placementGamesPlayed,
          rankedTier:           tier,
        });
      });
      data.rankedChanges = rankedChanges;

      // Cosmetics: auto-grant any tier / achievement cosmetic the
      // player just earned, and tell their socket so the client can
      // pop a "🎴 New Card Back Unlocked!" toast.
      rankedChanges.forEach(rc => {
        const u = usersDB.get(rc.playerId);
        if (!u) return;
        const granted = syncEarnedCosmetics(u);
        if (granted.length){
          const sock = findSocketByUserId(u.id);
          if (sock) sock.emit('cosmetics:unlocked', { items: granted });
        }
      });
    }

    // P5 — let the client know which featured type this was so the
    // 'Play Again' button on the victory podium can route back into
    // the same Classic / Fun / Ranked / Chill pool. Falls back to
    // QUICK_MATCH client-side if missing (e.g. legacy / private rooms).
    data.roomType = room.roomType || null;

    // P4-NEW.1a — clear any pending grace timers; match is done.
    if (room.graceTimers) {
      for (const handle of room.graceTimers.values()) clearTimeout(handle);
      room.graceTimers.clear();
    }

    saveUsers();
    io.to(roomId).emit('game:over', data);
    console.log(`[Game] Over in room ${roomId} (pot:${pot} payout:${payout} house:${houseCut})`);
    setTimeout(() => { roomsDB.delete(roomId); console.log(`[Room] Cleaned: ${roomId}`); }, 30000);
  });

  game.on('direction:changed', (data) => { io.to(roomId).emit('game:direction_changed', data); });
  game.on('game:auto_played', (data) => { io.to(roomId).emit('game:auto_played', data); broadcastPrivateStates(room); });

  game.on('turn:changed', (data) => {
    io.to(roomId).emit('turn:changed', data);
    if (!data.afterDraw) broadcastPrivateStates(room);
  });

  game.on('player:won', (data) => {
    // Suppress the win modal at the end of round 1 of a league match —
    // the match isn't really over until both rounds are played.
    if (room.leagueMatchId && globalLeague) {
      const match = globalLeague.schedule.find(m => m.id === room.leagueMatchId);
      if (match && match.rounds.length === 0) return;
    }
    const winner = usersDB.get(data.winnerId);
    const eloChange = winner ? Math.abs((winner.elo||1000) - 1000) : 16;
    const crowdFavorite = pickCrowdFavorite(room);
    io.to(roomId).emit('game:player_won', { ...data, eloChange: eloChange || 16, crowdFavorite });
    // Tournament result
    if(room.settings?.tournamentId) {
      const loserId = room.game.players.find(p => p.id !== data.winnerId)?.id;
      if(loserId) reportTournamentResult(room.settings.tournamentId, data.winnerId, loserId);
    }
  });
}

// ─────────────────────────────────────────
// MATCHMAKING
// ─────────────────────────────────────────

function tryMatchmaking(io, usersDB, roomsDB) {
  if (matchmakingQueue.length < 2) return;
  const toMatch = matchmakingQueue.splice(0, Math.min(4, matchmakingQueue.length));
  // Cancel any pending bot timers for these entries
  toMatch.forEach(e => { if (e.botTimer) { clearTimeout(e.botTimer); e.botTimer = null; } });
  const hostEntry = toMatch[0];
  const host = usersDB.get(hostEntry.userId);
  if (!host) return;

  const room = createRoomRecord(host.id, { maxPlayers: 4 });
  room.game = new GameManager(room.id, room.settings);
  attachGameListeners(room);

  toMatch.forEach(entry => {
    const user = usersDB.get(entry.userId);
    if (!user) return;
    const player = new Player(user.id, user.username, user.coins);
    player.avatar = user.avatar; player.cardBackId = user.equippedCardBack || 'cb_default';
    player.tableFelt = user.equippedTableFelt || 'tfp_green';
    room.game.addPlayer(player);
    room.playerIds.push(user.id);
    const sock = io.sockets.sockets.get(entry.socketId);
    if (sock) {
      sock.join(room.id);
      sock.currentRoomId = room.id;
      sock.emit('matchmaking:matched', { roomId: room.id, players: room.game.players.map(p => p.toPublicJSON()) });
    }
  });

  roomsDB.set(room.id, room);
  console.log(`[MM] Matched ${toMatch.length} players in room ${room.id}`);
}

const BOT_NAMES = MOROCCAN_BOT_NAMES;
function spawnBotMatch(entry) {
  const user = usersDB.get(entry.userId);
  if (!user) return;
  const sock = io.sockets.sockets.get(entry.socketId);
  if (!sock) return;

  const room = createRoomRecord(user.id, { maxPlayers: 2 });
  room.game = new GameManager(room.id, room.settings);
  attachGameListeners(room);

  const player = new Player(user.id, user.username, user.coins);
  player.avatar = user.avatar; player.cardBackId = user.equippedCardBack || 'cb_default';
  player.tableFelt = user.equippedTableFelt || 'tfp_green';
  room.game.addPlayer(player);
  room.playerIds.push(user.id);

  const bot = new Player('bot_' + Date.now(), BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)], 0);
  bot.isBot = true;
  bot.isConnected = true;
  bot.status = 'active';
  decorateBot(bot, room.settings?.botDifficulty || 'medium');
  room.game.addPlayer(bot);
  room.playerIds.push(bot.id);

  sock.join(room.id);
  sock.currentRoomId = room.id;
  sock.emit('matchmaking:matched', { roomId: room.id, players: room.game.players.map(p => p.toPublicJSON()) });

  roomsDB.set(room.id, room);
  console.log(`[MM] Bot match: ${user.username} vs ${bot.username} in ${room.id}`);

  // Auto-start the game after a short beat so the player sees the room first
  setTimeout(() => {
    const r = roomsDB.get(room.id);
    if (!r || r.status !== 'lobby') return;
    const result = r.game.startGame(user.id);
    if (!result.success) return;
    r.status = 'playing';
    r.startedAt = Date.now();
    r.playerIds.forEach(pid => {
      const p = r.game.players.find(pp => pp.id === pid);
      if (!p) return;
      const ps = findSocketByUserId(pid);
      if (ps) ps.emit('game:state', r.game._playerState(p));
    });
  }, 2200);
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function findSocketByUserId(userId) {
  for (const [socketId, uid] of socketToUser) {
    if (uid === userId) return io.sockets.sockets.get(socketId);
  }
  return null;
}

function computeVoteTally(room) {
  const tally = {};
  if (!room.spectatorVotes) return tally;
  for (const pid of room.spectatorVotes.values()) {
    tally[pid] = (tally[pid] || 0) + 1;
  }
  return tally;
}

function pickCrowdFavorite(room) {
  const tally = computeVoteTally(room);
  const entries = Object.entries(tally);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const [topId, topVotes] = entries[0];
  const player = room.game.players.find(p => p.id === topId);
  if (!player) return null;
  const total = entries.reduce((s, [, n]) => s + n, 0);
  return {
    id: player.id,
    username: player.username,
    avatar: player.avatar,
    votes: topVotes,
    total,
  };
}

// Phase-5 polish: in RANKED rooms we want each opponent panel to surface
// the player's rankedTier badge so the in-game seat reads as competitive.
// We decorate state.players AFTER the base public state is built — that
// keeps the GameManager / Player files completely unaware of rank stuff
// (no cross-cutting churn) and means casual rooms still pay zero cost.
function decorateRankedState(room, state){
  if (!state || !state.players || room?.roomType !== 'RANKED') return state;
  state.roomType = 'RANKED';
  state.players = state.players.map(p => {
    if (p.isBot) {
      // Bots fake a tier based on their difficulty so the seat doesn't
      // show an empty badge — visually consistent with the rest of the lobby.
      const fake = p.botDifficulty === 'hard'   ? { name:'Diamond',  badge:'💎', color:'#B9F2FF', label:'Diamond' }
                 : p.botDifficulty === 'medium' ? { name:'Gold',     badge:'🥇', color:'#FFD700', label:'Gold'    }
                 :                                { name:'Silver',   badge:'🥈', color:'#C0C0C0', label:'Silver'  };
      return { ...p, rankedTier: fake, rankPoints: null };
    }
    const u = usersDB.get(p.id);
    if (!u) return p;
    const inPlace = (u.placementGamesPlayed || 0) < 5;
    return {
      ...p,
      rankedTier:  inPlace ? null : getLeague(u.rankPoints || 0),
      rankPoints:  inPlace ? null : (u.rankPoints || 0),
      isPlacement: inPlace,
    };
  });
  return state;
}

function broadcastPrivateStates(room) {
  room.playerIds.forEach(pid => {
    const player = room.game.players.find(p => p.id === pid);
    const playerSock = findSocketByUserId(pid);
    if (player && playerSock && typeof room.game._playerState === 'function') {
      const state = decorateRankedState(room, room.game._playerState(player));
      playerSock.emit('game:state_update', state);
    }
  });
  // Spectators get the full state (with all hands visible)
  if (room.spectators && room.spectators.size > 0) {
    const specState = decorateRankedState(room, room.game._spectatorState());
    room.spectators.forEach(sid => {
      const sock = findSocketByUserId(sid);
      if (sock) sock.emit('game:spectator_state_update', specState);
    });
  }
}

// ← FIX: handlePlayerLeave now properly removes from playerIds
// P4-NEW.1a — Mark a player as abandoned (GDD §5.5). Idempotent.
//
// Behaviour: their TURNS are auto-skipped on entry (see GameManager
// _setTurn: abandoned-human branch); no bot plays their seat. In a
// 1v1 / last-survivor scenario, this function fires _handleWin for
// the only active human so the match ends immediately rather than
// limping on with one player skipping forever. At match-end, abandoned
// players are excluded from pot payouts in the game:over handler.
function markAbandoned(room, userId) {
  if (!room || !room.game) return;
  const player = room.game.players.find(p => p.id === userId);
  if (!player || player.abandoned) return;
  player.abandoned = true;
  io.to(room.id).emit('player:abandoned', {
    playerId: userId,
    username: player.username,
  });
  console.log(`[Abandoned] ${player.username} in ${room.id}`);

  if (room.game.phase !== 'playing') return;

  // ── DAMA (1v1) — any leave instantly ends the match. The remaining
  // player wins the whole pot; the leaver forfeits their stake.
  // attachDamaListeners handles the payout off the dama:match_over event.
  if (room.roomType === 'DAMA' || room.roomType === 'CHESS') {
    const tag       = room.roomType === 'CHESS' ? 'Chess' : 'Dama';
    const remaining = room.game.players.filter(p => !p.abandoned);
    if (remaining.length >= 1 && typeof room.game.forceWin === 'function') {
      const winner = remaining[0];
      console.log(`[Abandoned/${tag}] auto-win to ${winner.username} (color ${winner.color}) — opponent left`);
      try {
        room.game.forceWin(winner.color, 'opponent_left');
      } catch (e) {
        console.error(`[Abandoned/${tag}] forceWin failed:`, e.message);
      }
    }
    return;
  }

  // RONDA (2v2) — forfeit when an entire TEAM is gone (both partners
  // abandoned). The other team auto-wins. forceWin takes the winner
  // team index (0 or 1).
  if (room.roomType === 'RONDA') {
    if (typeof room.game.forceWin !== 'function') return;
    // A player who LEAVES forfeits for their WHOLE team — the opposing team
    // wins immediately and the match is over. (Quitter loses, the players
    // against them win.) Previously the match only ended when an ENTIRE team
    // was gone, so a single leaver left everyone stuck playing on.
    const quitter = room.game.players.find(p => p.id === userId);
    if (quitter && (quitter.team === 0 || quitter.team === 1)){
      const winTeam = 1 - quitter.team;
      console.log(`[Abandoned/Ronda] team ${winTeam === 0 ? 'A' : 'B'} wins — ${quitter.username} left`);
      try { room.game.forceWin(winTeam, 'opponent_left'); }
      catch (e) { console.error('[Abandoned/Ronda] forceWin failed:', e.message); }
    }
    return;
  }

  // ── UNO survivors check. When only ONE active human remains (1v1 quit
  // or last-player-standing in a multi-table), that player wins
  // immediately. Avoids the awkward "alone with bots" mode where the
  // human plays solo until the game burns itself out.
  const activeHumans = room.game.players.filter(p => !p.isBot && !p.abandoned);
  if (activeHumans.length === 1) {
    const winner = activeHumans[0];
    console.log(`[Abandoned] auto-win to ${winner.username} — last human standing`);
    try {
      // Drive GameManager's normal win path so all the downstream
      // events fire (game:over → ranked deltas → rewards). The win
      // card emitted is synthetic but the receiving handler doesn't
      // care; only winner identity matters for our purposes.
      if (typeof room.game._handleWin === 'function') {
        // Pick any card-like object as the "lastCard" — server's
        // game-over flow uses it for ELO/league lookup only.
        const top = room.game._deck?.top?.() || { toJSON: () => null };
        room.game._handleWin(winner, top);
      }
    } catch (e) {
      console.error('[Abandoned] auto-win failed:', e.message);
    }
  }
}

const GRACE_MS = 30 * 1000;                              // GDD §5.5 reconnect window

function handlePlayerLeave(socket, roomId, opts = {}) {
  const { voluntary = false } = opts;
  const room = roomsDB.get(roomId);
  if (!room) return;

  // ── Lobby phase / non-playing room — same instant cleanup as before ──
  // No grace needed; the player wasn't in a live match.
  if (room.status !== 'playing' || room.game?.phase !== 'playing') {
    room.game.removePlayer(socket.userId);
    const pidIdx = room.playerIds.indexOf(socket.userId);
    if (pidIdx !== -1) room.playerIds.splice(pidIdx, 1);
    if (room.playerBets) delete room.playerBets[socket.userId];
    socket.leave(roomId);
    delete socket.currentRoomId;
    socket.to(roomId).emit('room:player_left', {
      playerId: socket.userId, username: socket.username,
    });
    // Broadcast the updated bet pool so leaving updates the pot in real time.
    io.to(roomId).emit('room:bets', {
      minBet: room.settings.bet || 0,
      playerBets: room.playerBets || {},
    });
    if (room.playerIds.length === 0) {
      roomsDB.delete(roomId);
      console.log(`[Room] Deleted empty room: ${roomId}`);
    }
    return;
  }

  // ── Match in progress — GDD §5.5 grace model ──
  // Mark the player as disconnected and broadcast. Do NOT splice
  // playerIds — they're still a seat; the room economy depends on it.
  // Voluntary quitters are eliminated on the spot: in 1v1 the opponent
  // wins immediately, in 3p/4p the table keeps going with their seat
  // auto-skipped (no bot pretending to be them).
  const player = room.game.players.find(p => p.id === socket.userId);
  if (!player) {
    socket.leave(roomId);
    delete socket.currentRoomId;
    return;
  }
  player.setDisconnected();

  socket.leave(roomId);
  delete socket.currentRoomId;

  // Tell remaining players about the DC so the UI can show the right state.
  socket.to(roomId).emit('player:disconnected', {
    playerId: socket.userId,
    username: socket.username,
    voluntary,
    graceMs: voluntary ? 0 : GRACE_MS,
  });

  if (voluntary) {
    // Quit = eliminate. markAbandoned fires the auto-win path when
    // only one active human remains (1v1 quit, or last-survivor in
    // a 3+ player table); otherwise it just flags the seat so future
    // turns get skipped by GameManager._setTurn / _startTurnTimer.
    markAbandoned(room, socket.userId);
    // If the match is still running (multi-player table where others
    // are still in), make sure the table doesn't stall on the
    // quitter's turn. Force-advance ONLY when we're sitting on
    // their dead seat right now — _setTurn will then see abandoned
    // (we set it above) and skip cleanly without inviting a bot.
    if (room.game?.phase === 'playing' && room.game.current?.id === socket.userId) {
      try { room.game._clearTimers(); } catch(e){}
      room.game._drawnCard = null;
      room.game._drawnBy   = null;
      try { room.game._forceAdvance(); } catch(e){}
    }
    // Fully detach the quitter from the room so nothing lingers and they can
    // immediately start or join another game (the old seat no longer counts).
    const qIdx = room.playerIds.indexOf(socket.userId);
    if (qIdx !== -1) room.playerIds.splice(qIdx, 1);
    if (room.playerBets) delete room.playerBets[socket.userId];
    socket.to(roomId).emit('room:player_left', { playerId: socket.userId, username: socket.username });
    // If no real human players remain, the match is OVER — close the room.
    // (Previously a solo human quitting a bot-filled table left the bots
    // playing to themselves forever and the room never cleaned up.)
    const humansLeft = room.game.players.filter(p => !p.isBot && !p.abandoned);
    if (humansLeft.length === 0) {
      try { room.game._clearTimers && room.game._clearTimers(); } catch(e){}
      if (room.graceTimers){ for (const t of room.graceTimers.values()) clearTimeout(t); room.graceTimers.clear(); }
      roomsDB.delete(roomId);
      console.log(`[Room] Closed ${roomId} — no humans left after ${socket.username} quit`);
    }
    return;
  }

  // If this disconnect leaves NO connected human in the room, the match is
  // effectively over — close the room IMMEDIATELY instead of keeping a
  // bot-only / empty table alive through the grace window. (player was just
  // setDisconnected() above, so the .isConnected check already excludes them.)
  const stillHuman = room.game.players.some(p => !p.isBot && !p.abandoned && p.isConnected);
  if (!stillHuman) {
    try { room.game._clearTimers && room.game._clearTimers(); } catch(e){}
    if (room.graceTimers){ for (const t of room.graceTimers.values()) clearTimeout(t); room.graceTimers.clear(); }
    const i = room.playerIds.indexOf(socket.userId);
    if (i !== -1) room.playerIds.splice(i, 1);
    if (room.playerIds.length === 0 || !room.playerIds.some(pid => { const p = room.game.players.find(x => x.id === pid); return p && !p.isBot; })) {
      roomsDB.delete(roomId);
      console.log(`[Room] Closed ${roomId} — last human (${socket.username}) left`);
    }
    return;
  }

  // Involuntary DC — start the 30s grace window. If they reconnect via
  // room:join before the timer fires, the handler clears this; otherwise
  // markAbandoned() runs and (per the new behaviour) the seat is auto-
  // skipped from then on instead of being bot-played.
  if (room.game.current?.id === socket.userId) {
    try { room.game._clearTimers(); } catch(e){}
    room.game._drawnCard = null;
    room.game._drawnBy   = null;
    try { room.game._forceAdvance(); } catch(e){}
  }
  if (!room.graceTimers) room.graceTimers = new Map();
  const existing = room.graceTimers.get(socket.userId);
  if (existing) clearTimeout(existing);
  const handle = setTimeout(() => {
    if (!room.graceTimers) return;
    room.graceTimers.delete(socket.userId);
    if (room.game?.phase === 'playing') markAbandoned(room, socket.userId);
    // After abandon, if no connected human remains, close the dead room so
    // it doesn't linger in the browse list / block a clean re-entry.
    const anyHuman = room.game?.players?.some(p => !p.isBot && !p.abandoned && p.isConnected);
    if (!anyHuman) {
      try { room.game._clearTimers && room.game._clearTimers(); } catch(e){}
      roomsDB.delete(roomId);
      console.log(`[Room] Closed ${roomId} — grace expired, no humans left`);
    }
  }, GRACE_MS);
  room.graceTimers.set(socket.userId, handle);
  console.log(`[Grace] ${socket.username} disconnected from ${roomId} — ${GRACE_MS/1000}s reconnect window`);
}

function sanitizeUser(user) {
  // Strip EVERY server-only secret here so it can never reach any client —
  // the owner's own session included. The TOTP secret + backup-code hashes
  // are used purely server-side; the QR/secret is shown exactly once via the
  // dedicated /api/admin/2fa/setup response, never through this object.
  // (Previously only passwordHash was removed, so /api/player/:id leaked the
  //  victim's twoFactorSecret to anyone who viewed their profile.)
  const {
    passwordHash,
    twoFactorSecret,
    twoFactorPendingSecret,
    twoFactorBackupCodes,
    knownIps,                 // server-only security telemetry — never ship IPs
    lastIp,
    ...safe
  } = user;
  // isAdmin is a server-only flag (set at boot from ADMIN_USERS env).
  // Exposed to the OWNER of the session so the lobby can choose to
  // show the admin menu entry — but it has zero authorisation power
  // on the client; every admin endpoint re-checks server-side.
  safe.isAdmin = !!user.isAdmin;
  const league = getLeague(safe.elo||1000);
  safe.league = league;
  // GDD §7.2 — surface accountXP / level / progress so every client display
  // (lobby pill, profile, podium) can read them from the user object directly.
  const lvl = accountLevelProgress(safe.accountXP || 0);
  safe.accountXP    = safe.accountXP || 0;
  safe.accountLevel = lvl.level;
  safe.accountLevelProgress = { into: lvl.into, span: lvl.span, pct: lvl.pct };
  // Showcase/dev account (951808283) ONLY: pin the display to a maxed Level 100
  // bar. Scoped to this one account — no effect on the global level system.
  if (String(user.shortId) === '951808283' || (user.username || '').toLowerCase() === 'mustapha') {
    safe.accountLevel = 100;
    safe.accountLevelProgress = { into: 0, span: 1, pct: 100 };
  }
  // Lazy-backfill short-ID for accounts created before the feature shipped.
  // The 9-char short ID is what the client surfaces as "YOUR ID" in the
  // Friends panel — much friendlier than the full UUID for sharing.
  safe.shortId = ensureShortId(user);
  // Ensure ranked Phase 1 fields exist on every read.
  ensureRankedFields(user);
  safe.rankPoints           = user.rankPoints;
  safe.peakRankPoints       = user.peakRankPoints;
  safe.placementGamesPlayed = user.placementGamesPlayed;
  safe.rankedWins           = user.rankedWins;
  safe.rankedLosses         = user.rankedLosses;
  safe.winStreak            = user.winStreak;
  safe.currentSeasonId      = user.currentSeasonId;
  // Compute visible ranked tier from rankPoints (separate from existing
  // `league` which uses elo). Stays null during placement so the UI shows
  // "Placement X/5" instead of a real tier.
  safe.rankedTier = (user.placementGamesPlayed || 0) >= 5
    ? getLeague(user.rankPoints || 0)
    : null;
  // Phase 4 — surface DC offense counter so the client can warn
  // ("2 of 3 — next abandon = 2hr ban") before someone walks away.
  safe.rankedAbandonCount  = user.rankedAbandonCount || 0;
  safe.rankedLastAbandonAt = user.rankedLastAbandonAt || 0;
  // Tier-scaled ranked entry fee. Client uses this on the Ranked Hub to
  // show "Entry: 1,200 🪙" so the player knows what they're risking
  // before they hit Play.
  safe.rankedEntryFee = rankedEntryFor(user);
  // Cosmetics — owned list + equipped IDs so the client can render
  // the right card back / felt without a second round-trip. Catalog
  // is fetched on-demand from /api/cosmetics.
  ensureCosmeticFields(user);
  safe.ownedCardBacks    = user.ownedCardBacks;
  safe.ownedTableFelts   = user.ownedTableFelts;
  safe.ownedDamaBoards   = user.ownedDamaBoards;
  safe.equippedCardBack  = user.equippedCardBack;
  safe.equippedTableFelt = user.equippedTableFelt;
  safe.equippedDamaBoard = user.equippedDamaBoard;
  return safe;
}

// ─────────────────────────────────────────
// ROOM CLEANUP
// ─────────────────────────────────────────

// True if at least one NON-bot player (or spectator) in the room still has a
// live socket. Used to reap genuinely-abandoned rooms without killing a game
// during a brief reconnect.
function _roomHasConnectedHuman(room) {
  try {
    const players = (room.game && room.game.players) || [];
    for (const p of players) {
      if (p && !p.isBot && p.id && findSocketByUserId(p.id)) return true;
    }
    if (room.spectators && room.spectators.size) {
      for (const sid of room.spectators) { if (findSocketByUserId(sid)) return true; }
    }
    return false;
  } catch (_) { return true; }   // on any doubt, keep the room (never reap blindly)
}

setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of roomsDB) {
    let kill = false;
    if (room.status === 'finished' && now - (room.startedAt || room.createdAt) > 7200000) {
      kill = true;                                            // finished > 2h
    } else if (room.status === 'lobby' && room.playerIds.length === 0 && now - room.createdAt > 1800000) {
      kill = true;                                            // empty lobby > 30m
    } else {
      // Any other state (playing / waiting): if NO human has been connected
      // for a grace period, the game is abandoned — reap it. The timestamp is
      // cleared the moment a human is seen, so a quick disconnect/reconnect
      // never trips this.
      if (_roomHasConnectedHuman(room)) {
        room._emptyHumanSince = 0;
      } else {
        if (!room._emptyHumanSince) room._emptyHumanSince = now;
        else if (now - room._emptyHumanSince > 5 * 60 * 1000) kill = true;   // 5m abandoned
      }
    }
    if (kill) {
      // ALWAYS clear the game's timers before dropping the room — otherwise
      // its turn/deal/declare timers keep firing against a dead room (CPU +
      // memory leak).
      try { room.game && room.game._clearTimers && room.game._clearTimers(); } catch (_) {}
      roomsDB.delete(roomId);
      console.log(`[Room] swept ${roomId} (status=${room.status})`);
    }
  }
}, CONFIG.ROOM_CLEANUP_INTERVAL);

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// TOURNAMENTS
// ─────────────────────────────────────────

const tournamentsDB = new Map();

// Server-side admin gate. The old secret-string check leaked the secret
// to every browser session, so anyone reading the bundled JS could elevate
// privileges. Replaced with a check against the authenticated user's
// `isAdmin` flag (set on specific accounts at boot from ADMIN_USERS env)
// + the privileged jwt claim. Returns true ONLY for a valid authenticated
// session belonging to an admin.
//
// 2FA enforcement:
//   • Admin accounts that have TOTP enabled must have proven possession
//     of the second factor THIS session. The login flow embeds an
//     `adm2fa: true` claim into the JWT when the TOTP code is accepted,
//     so we check that claim here.
//   • Admin accounts WITHOUT TOTP enabled (haven't completed setup yet)
//     can still authenticate normally — they just see a banner nudging
//     them to enable. The /setup endpoint is reachable so they can
//     bootstrap themselves. In production you'd flip ADMIN_REQUIRE_2FA
//     env var to make 2FA mandatory for ALL admins.
const ADMIN_REQUIRE_2FA = String(process.env.ADMIN_REQUIRE_2FA || 'false').toLowerCase() === 'true';
function isAdminRequest(req){
  const uid = req.user?.userId;
  if(!uid) return false;
  const u = usersDB.get(uid);
  if(!u || u.isAdmin !== true) return false;
  // If 2FA is set up on this account, the current session must have
  // proved it (login put the adm2fa claim in the JWT). Sessions issued
  // BEFORE 2FA was enabled won't have the claim → must re-login.
  if (u.twoFactorEnabled && req.user.adm2fa !== true) return false;
  // Stricter mode — require 2FA across the board.
  if (ADMIN_REQUIRE_2FA && req.user.adm2fa !== true) return false;
  return true;
}

// Append-only admin audit log.
//
// Two-layer storage:
//   • In-memory ring buffer (ADMIN_AUDIT) for fast reads + crash-window
//     observability if Mongo is unreachable.
//   • MongoDB collection (AdminAuditModel) as the durable source of
//     truth — survives restarts, queryable across the full history.
//
// Both layers write under the same call; reads go to Mongo when the DB
// is connected, otherwise fall back to the in-memory buffer. Persistence
// is fire-and-forget so an audit DB outage never blocks the admin
// action that triggered it.
const ADMIN_AUDIT = [];
const ADMIN_AUDIT_CAP = 2000;

// Durable, append-only audit trail on disk (one JSON line per event). This
// is the PERSISTENT store for sensitive actions — it survives restarts even
// when Mongo is offline (the app's normal mode). Fire-and-forget: an audit
// write must never throw out of the privileged action it records.
function _writeAuditFile(entry){
  try { require('fs').appendFile('audit.log', JSON.stringify(entry) + '\n', () => {}); } catch(_){}
}

// Keep the on-disk audit trail from growing without bound. When the active log
// passes the cap, rotate it to audit.log.1 (one backup, older one overwritten)
// and start fresh — so disk use stays bounded at ~2× the cap. The in-memory
// ADMIN_AUDIT ring (capped at 2000) remains the primary read source.
const AUDIT_MAX_BYTES = 5 * 1024 * 1024;       // 5 MB
function _rotateAuditIfBig(){
  try {
    const fs = require('fs');
    if (!fs.existsSync('audit.log')) return;
    const sz = fs.statSync('audit.log').size;
    if (sz > AUDIT_MAX_BYTES) {
      try { fs.renameSync('audit.log', 'audit.log.1'); } catch(_){}
      console.log(`[Audit] rotated audit.log (${Math.round(sz / 1024)}KB) → audit.log.1`);
    }
  } catch(_){}
}
setInterval(_rotateAuditIfBig, 10 * 60 * 1000); // check every 10 min

function auditAdmin(req, action, details){
  try{
    const entry = {
      at:     Date.now(),
      category: 'admin',
      actor:  req.user?.userId || null,
      actorName: req.user?.username || null,
      action: String(action || 'unknown').slice(0, 64),
      ip:     String(req.ip || '').slice(0, 64),
      ua:     String(req.headers?.['user-agent'] || '').slice(0, 200),
      details: details && typeof details === 'object' ? details : {},
    };
    ADMIN_AUDIT.push(entry);
    if (ADMIN_AUDIT.length > ADMIN_AUDIT_CAP) ADMIN_AUDIT.shift();
    console.log(`[AUDIT] ${entry.actorName || entry.actor} ${entry.action}`, entry.details);
    _writeAuditFile(entry);                       // durable on-disk trail
    // Persist to Mongo too. Fire-and-forget — must NEVER throw out of an
    // audit hook (it would mask the privileged action's response).
    if (mongoose.connection.readyState === 1){
      AdminAuditModel.create(entry).catch(e => {
        console.warn('[AUDIT] persist failed:', e?.message);
      });
    }
  }catch(e){ /* never throw out of an audit hook */ }
}

// Economy audit — records every coin/diamond mutation worth tracking
// (purchases, cosmetic buys, diamond→coin conversions) to the same durable
// audit.log, with the resulting balance for reconciliation.
function auditEconomy(user, action, details){
  try{
    const entry = {
      at:     Date.now(),
      category: 'economy',
      actor:  user?.id || null,
      actorName: user?.username || null,
      action: String(action || 'unknown').slice(0, 64),
      details: details && typeof details === 'object' ? details : {},
      balance: { coins: user?.coins ?? null, diamonds: user?.diamonds ?? null },
    };
    console.log(`[ECON] ${entry.actorName || entry.actor} ${entry.action}`, entry.details);
    _writeAuditFile(entry);
  }catch(e){ /* never throw out of an audit hook */ }
}

function createTournament({ name, maxPlayers, prizeCoins }) {
  const id = uuidv4();
  const t = {
    id, name: name || 'UNO Tournament',
    maxPlayers: maxPlayers || 8,
    prizeCoins: prizeCoins || 5000,
    players: [], bracket: [], round: 0,
    status: 'open', createdAt: Date.now(),
    winner: null,
  };
  tournamentsDB.set(id, t);
  return t;
}

function buildBracket(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const matches = [];
  for(let i = 0; i < shuffled.length; i += 2) {
    if(shuffled[i+1]) matches.push({ p1: shuffled[i], p2: shuffled[i+1], winner: null, roomId: null });
  }
  return matches;
}

// Admin: create tournament. Now JWT-gated — only accounts flagged
// isAdmin=true server-side can call this. No leaked secret.
app.post('/api/tournament/create', authMiddleware, (req, res) => {
  if(!isAdminRequest(req)) {
    auditAdmin(req, 'tournament.create.denied', { reason: 'not_admin' });
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { name, maxPlayers, prizeCoins } = req.body || {};
  const t = createTournament({ name, maxPlayers, prizeCoins });
  if(!t) return res.status(400).json({ error: 'Failed' });
  auditAdmin(req, 'tournament.create', { tournamentId: t.id, name: t.name, maxPlayers: t.maxPlayers, prizeCoins: t.prizeCoins });
  io.emit('tournament:update', sanitizeTournament(t));
  res.json({ tournament: sanitizeTournament(t) });
});

// Get all open/playing tournaments
app.get('/api/tournaments', authMiddleware, (req, res) => {
  const list = [...tournamentsDB.values()]
    .filter(t => t.status !== 'finished')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(sanitizeTournament);
  res.json({ tournaments: list });
});

const TOURNAMENT_BOT_NAMES = MOROCCAN_BOT_NAMES;

function _makeTournamentBots(n) {
  const pool = [...TOURNAMENT_BOT_NAMES].sort(() => Math.random() - 0.5);
  const bots = [];
  for (let i = 0; i < n; i++) {
    bots.push({
      id: 'tbot_' + uuidv4().slice(0, 8),
      username: pool[i % pool.length],
      elo: 850 + Math.floor(Math.random() * 550),
      avatar: randomPresetAvatar(),
      isBot: true,
    });
  }
  return bots;
}

function _eloPick(p1, p2) {
  const e1 = p1.elo || 1000, e2 = p2.elo || 1000;
  const prob = 1 / (1 + Math.pow(10, (e2 - e1) / 400));
  return Math.random() < prob ? p1 : p2;
}

// Set up one bracket match: bot-vs-bot auto-resolves after a short beat;
// any match involving a human gets a live room with a bot opponent ready.
function setupTournamentMatch(t, match) {
  const { p1, p2 } = match;
  const b1 = !!p1.isBot, b2 = !!p2.isBot;
  if (b1 && b2) {
    setTimeout(() => {
      const w = _eloPick(p1, p2);
      const l = w === p1 ? p2 : p1;
      reportTournamentResult(t.id, w.id, l.id);
    }, 2500 + Math.random() * 1500);
    return;
  }
  const hostP = b1 ? p2 : p1;
  const room = createRoomRecord(hostP.id, { maxPlayers: 2, tournamentId: t.id });
  room.game = new GameManager(room.id, room.settings);
  attachGameListeners(room);
  room.tournamentMatchId = `${t.id}:${p1.id}:${p2.id}`;
  [p1, p2].forEach(p => {
    const u = p.isBot ? null : usersDB.get(p.id);
    const player = new Player(p.id, p.username, u?.coins || 0);
    if (p.isBot) {
      player.isBot = true; player.isConnected = true; player.status = 'active';
      decorateBot(player, p.botDifficulty || 'medium');
    }
    else if (u) { player.avatar = u.avatar; player.cardBackId = u.equippedCardBack || 'cb_default'; }
    room.game.addPlayer(player);
    room.playerIds.push(p.id);
  });
  roomsDB.set(room.id, room);
  match.roomId = room.id;
  // Tell each human to enter
  [p1, p2].forEach(p => {
    if (p.isBot) return;
    const opp = p === p1 ? p2 : p1;
    const sock = findSocketByUserId(p.id);
    if (sock) {
      sock.join(room.id);
      sock.currentRoomId = room.id;
      sock.emit('tournament:match_ready', { roomId: room.id, opponent: opp, tournamentName: t.name });
    }
  });
  // Kick off the game so the human only has to play
  setTimeout(() => {
    const r = roomsDB.get(room.id);
    if (!r || r.status !== 'lobby') return;
    const result = r.game.startGame(hostP.id);
    if (!result.success) return;
    r.status = 'playing'; r.startedAt = Date.now();
    r.playerIds.forEach(pid => {
      if (pid.startsWith('tbot_') || pid.startsWith('bot_')) return;
      const ps = findSocketByUserId(pid);
      const player = r.game.players.find(pp => pp.id === pid);
      if (ps && player) ps.emit('game:state', r.game._playerState(player));
    });
  }, 1800);
}

// Player-created tournament — creator stakes the prize, players pay the entry fee.
app.post('/api/tournaments/create', authMiddleware, validateBody({ name:{ type:'string', required:true, min:3, max:30 }, maxPlayers:{ type:'int', min:2, max:64 }, prizeCoins:{ type:'int', min:0, max:100000000 }, entryFee:{ type:'int', min:0, max:100000000 } }), (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { name, maxPlayers, prizeCoins, entryFee } = req.body;
  const n = String(name || '').trim();
  if (n.length < 3 || n.length > 30) return res.status(400).json({ error: 'Name must be 3-30 characters' });
  const max = [2, 4, 8, 16].includes(parseInt(maxPlayers, 10)) ? parseInt(maxPlayers, 10) : 4;
  const prize = Math.max(0, parseInt(prizeCoins, 10) || 0);
  const fee = Math.max(0, parseInt(entryFee, 10) || 0);
  if (prize > 0) {
    if ((user.coins || 0) < prize) return res.status(400).json({ error: 'Not enough coins to stake this prize' });
    user.coins -= prize;
  }
  const id = uuidv4();
  const t = {
    id, name: n, maxPlayers: max, prizeCoins: prize,
    entryFee: fee, pot: prize,
    players: [{ id: user.id, username: user.username, elo: user.elo || 1000 }],
    bracket: [], round: 0,
    status: 'open', createdAt: Date.now(), winner: null,
    creatorId: user.id,
  };
  tournamentsDB.set(id, t);
  saveUsers();
  console.log(`[Tournament] ${user.username} created: ${n} (prize: ${prize}, fee: ${fee}, max: ${max})`);
  io.emit('tournament:update', sanitizeTournament(t));
  res.json({ tournament: sanitizeTournament(t), coins: user.coins });
});

// Get single tournament
app.get('/api/tournaments/:id', authMiddleware, (req, res) => {
  const t = tournamentsDB.get(req.params.id);
  if(!t) return res.status(404).json({ error: 'Not found' });
  res.json({ tournament: sanitizeTournament(t) });
});

// Join tournament — entry fee (if any) is charged and added to the pot.
app.post('/api/tournaments/:id/join', authMiddleware, (req, res) => {
  const t = tournamentsDB.get(req.params.id);
  const user = usersDB.get(req.user.userId);
  if(!t) return res.status(404).json({ error: 'Tournament not found' });
  if(!user) return res.status(404).json({ error: 'User not found' });
  if(t.status !== 'open') return res.status(400).json({ error: 'Tournament already started' });
  if(t.players.find(p => p.id === user.id)) return res.status(400).json({ error: 'Already registered' });
  if(t.players.length >= t.maxPlayers) return res.status(400).json({ error: 'Tournament full' });
  const fee = t.entryFee || 0;
  if (fee > 0) {
    if ((user.coins || 0) < fee) return res.status(400).json({ error: `Entry fee is ${fee}🪙 — not enough coins` });
    user.coins -= fee;
    t.pot = (t.pot || 0) + fee;
  }
  t.players.push({ id: user.id, username: user.username, elo: user.elo||1000 });
  saveUsers();
  console.log(`[Tournament] ${user.username} joined ${t.name} (fee: ${fee})`);
  io.emit('tournament:update', sanitizeTournament(t));
  res.json({ success: true, tournament: sanitizeTournament(t), coins: user.coins });
});

// Start tournament — admin (secret) OR the creator can start once ≥2 joined.
// Empty slots get filled with AI bots so the bracket always runs to completion.
app.post('/api/tournaments/:id/start', authMiddleware, (req, res) => {
  const t = tournamentsDB.get(req.params.id);
  if(!t) return res.status(404).json({ error: 'Not found' });
  const admin = isAdminRequest(req);
  const isCreator = t.creatorId && t.creatorId === req.user?.userId;
  if(!admin && !isCreator) return res.status(403).json({ error: 'Only the creator can start this tournament' });
  if(t.status !== 'open') return res.status(400).json({ error: 'Tournament already started' });
  if(t.players.length < 2) return res.status(400).json({ error: 'Need at least 2 players' });
  // Top up empty slots with bots
  const missing = t.maxPlayers - t.players.length;
  if (missing > 0) {
    t.players.push(..._makeTournamentBots(missing));
    console.log(`[Tournament] ${t.name}: filled ${missing} bot slots`);
  }
  t.status = 'playing';
  t.round = 1;
  t.bracket = buildBracket(t.players);
  t.bracket.forEach(match => setupTournamentMatch(t, match));
  console.log(`[Tournament] Started: ${t.name} — Round ${t.round}`);
  io.emit('tournament:update', sanitizeTournament(t));
  res.json({ success: true, tournament: sanitizeTournament(t) });
});

// Report match result (called internally after game:over)
function reportTournamentResult(tournamentId, winnerId, loserId) {
  const t = tournamentsDB.get(tournamentId);
  if(!t) return;
  const match = t.bracket.find(m => (m.p1.id === winnerId || m.p1.id === loserId) && (m.p2.id === winnerId || m.p2.id === loserId));
  if(!match || match.winner) return;
  match.winner = winnerId;
  const allDone = t.bracket.every(m => m.winner);
  if(!allDone) { io.emit('tournament:update', sanitizeTournament(t)); return; }
  // All matches done — check if final
  const winners = t.bracket.map(m => t.players.find(p => p.id === m.winner)).filter(Boolean);
  if(winners.length === 1) {
    // Tournament finished — pay the full pot (prize + entry fees) to a real winner.
    t.status = 'finished';
    t.winner = winners[0];
    const payout = t.pot || t.prizeCoins || 0;
    const winnerUser = usersDB.get(winners[0].id);
    if(winnerUser) {
      winnerUser.coins += payout;
      winnerUser.tournamentWins = (winnerUser.tournamentWins||0) + 1;
      logReward(winnerUser, '⚔️', `Tournament champion — ${t.name}`, payout);
      saveUsers();
      const winnerSock = findSocketByUserId(winners[0].id);
      if(winnerSock) winnerSock.emit('tournament:won', { name: t.name, prize: payout });
    }
    io.emit('tournament:finished', { tournamentId: t.id, winner: winners[0], prize: payout });
    console.log(`[Tournament] ${t.name} finished! Winner: ${winners[0].username} +${payout} coins`);
  } else {
    // Next round
    t.round++;
    t.bracket = buildBracket(winners);
    t.bracket.forEach(match => setupTournamentMatch(t, match));
    console.log(`[Tournament] ${t.name} — Round ${t.round}`);
  }
  io.emit('tournament:update', sanitizeTournament(t));
}

function sanitizeTournament(t) {
  return {
    id: t.id, name: t.name, maxPlayers: t.maxPlayers,
    prizeCoins: t.prizeCoins,
    entryFee: t.entryFee || 0,
    pot: t.pot || t.prizeCoins || 0,
    players: t.players,
    bracket: t.bracket.map(m => ({
      p1: m.p1, p2: m.p2, winner: m.winner, roomId: m.roomId
    })),
    round: t.round, status: t.status, winner: t.winner,
    creatorId: t.creatorId || null,
  };
}
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), rooms: roomsDB.size, users: usersDB.size, queue: matchmakingQueue.length });
});

// ── Unknown API route → clean JSON 404 (don't fall through to the SPA). ──
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler — the last line of defence. Any error thrown in a
// route lands here: we log the REAL stack server-side but return only a
// generic message, so internals / stack traces never reach the client. ──
app.use((err, req, res, next) => {              // eslint-disable-line no-unused-vars
  console.error('[ErrorHandler]', req.method, req.originalUrl, '—', (err && err.stack) ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status((err && err.status) || 500).json({ error: 'Server error' });
});

// ─────────────────────────────────────────
// CRASH GUARDS
// Keep the server alive if a single game / socket handler throws.
// Without these, one bad event mid-game kills Node for *everyone*
// (the classic "server drops mid-match → ngrok ERR_NGROK_8012").
// ─────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('\n[CRASH-GUARD] Uncaught exception — server kept alive:');
  console.error(err && err.stack ? err.stack : err);
  console.error('');
});
process.on('unhandledRejection', (reason) => {
  console.error('\n[CRASH-GUARD] Unhandled promise rejection — server kept alive:');
  console.error(reason && reason.stack ? reason.stack : reason);
  console.error('');
});

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────

// Custom image uploads are forbidden — strip any that exist from old data.
// Only data:/http(s) blobs are "custom"; bundled /avatars/... assets (free
// presets + premium shop avatars) are allowed and must be preserved.
function purgeImageAvatars() {
  let purged = 0;
  for (const u of usersDB.values()) {
    if (typeof u.avatar === 'string' && /^(data:|https?:)/i.test(u.avatar)) {
      u.avatar = null; purged++;
    }
  }
  if (purged) { saveUsers(); console.log(`[Avatar] Cleared ${purged} custom image avatar(s)`); }
}

loadUsers().then(async () => {
  await loadWorldChat();                              // rolling 200-msg history populated before server.listen
  await grantDiamondsV1();                            // one-time +100 diamonds for existing users (P4-D.1)
  purgeImageAvatars();
  // Boot-time check so downtime longer than a season immediately rolls
  // it over instead of waiting up to an hour for the cron tick.
  try { getRankedSeasonState(); maybeRolloverRankedSeason(); }
  catch(e){ console.error('[Ranked] boot rollover check failed:', e); }
  // One-time amnesty: the abandon penalty rule changed (solo-vs-bots no
  // longer incurs a ban). Lift every active ban on boot so players who
  // were locked under the old rule can re-queue right away. Idempotent —
  // it just walks the user map and zeroes any future rankedBanUntil.
  try {
    let cleared = 0;
    for (const u of usersDB.values()) {
      if (!u || !u.id || String(u.id).startsWith('__')) continue;
      if (u.rankedBanUntil && u.rankedBanUntil > Date.now()) {
        u.rankedBanUntil = 0;
        cleared++;
      }
    }
    if (cleared) {
      console.log(`[Ranked] Boot amnesty: cleared ${cleared} active abandon ban${cleared>1?'s':''}`);
      saveUsers();
    }
  } catch(e){ console.error('[Ranked] amnesty pass failed:', e); }
  server.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════╗
║   UNO Online Server v2.1        ║
║   Port: ${CONFIG.PORT}                      ║
║   CORS: ${CONFIG.CORS_ORIGIN}               ║
║ ★★ BUILD-335 — auto bot-fill ★★║
╚══════════════════════════════════╝

[Ranked] Active tier ladder (1v1 winner / 4P bases):
  Bronze       : +120 win  · 4P [+120, +60, +30, -25] · max loss -30
  Silver       : +120 win  · 4P [+120, +60, +30, -25] · max loss -30
  Gold         : +110 win  · 4P [+110, +55, +25, -25] · max loss -30
  Platinum     : +60  win  · 4P [+60,  +25,  0,  -30] · max loss -55
  Diamond      : +35  win  · 4P [+35,  +15,  -5, -35] · max loss -70
  Master       : +22  win  · 4P [+22,  +10,  -8, -40] · max loss -80
  Grandmaster  : +15  win  · 4P [+15,   +6,-12, -45] · max loss -90

[Rooms] Active types: ${Object.keys(ROOM_TYPES).join(', ')}
  `);
});
}).catch(err => {
  console.log('[DB] Starting without MongoDB:', err.message);
  purgeImageAvatars();
  server.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${CONFIG.PORT} (no DB)`);
  });
});
module.exports = { app, server, io };
