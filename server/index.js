'use strict';

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

// ─────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────

const CONFIG = Object.freeze({
  PORT:           process.env.PORT           || 8080,
  JWT_SECRET:     process.env.JWT_SECRET     || 'uno_dev_secret_change_in_prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGIN:    process.env.CORS_ORIGIN    || '*',
  SALT_ROUNDS:    10,
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

// ─────────────────────────────────────────
// IN-MEMORY DATABASE
// ─────────────────────────────────────────

const mongoose = require('mongoose');
const usersDB = new Map();

// MongoDB User Schema
const UserSchema = new mongoose.Schema({
  id: String,
  username: String,
  passwordHash: String,
  coins: { type: Number, default: 1000 },
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

async function loadUsers() {
  try {
    const uri = process.env.MONGODB_URI;
    if (uri) {
      await mongoose.connect(uri);
      console.log('[DB] Connected to MongoDB');
      const users = await UserModel.find({});
      users.forEach(u => usersDB.set(u.id, u.toObject()));
      console.log(`[DB] Loaded ${users.length} users from MongoDB`);
    } else {
      console.log('[DB] No MONGODB_URI — using in-memory only');
    }
  } catch(e) {
    console.log('[DB] MongoDB connection failed:', e.message);
  }
}

async function saveUsers() {
  try {
    if (!mongoose.connection.readyState) return;
    for (const [id, user] of usersDB) {
      await UserModel.findOneAndUpdate({ id }, user, { upsert: true });
    }
  } catch(e) {
    console.log('[DB] Save failed:', e.message);
  }
}
// One-time coin grants
(function grantCoins(){
  const grants = { 'mustapha': 50000, 'mustapha98': 100000, 'mustapha98_v2': 100000 };
  let changed = false;
  for (const [uname, amount] of Object.entries(grants)) {
    const user = [...usersDB.values()].find(u => u.username.toLowerCase() === uname);
    const realName = uname.replace('_v2','');
    const User = [...usersDB.values()].find(u => u.username.toLowerCase() === realName);
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
const voiceRooms = new Map(); // roomId -> Set<userId> currently in voice chat

// ─────────────────────────────────────────
// USER RECORD
// ─────────────────────────────────────────

// ── ELO & Leagues ──
const LEAGUES = [
  { name:'Bronze',  min:0,    max:999,  badge:'🥉', color:'#CD7F32' },
  { name:'Silver',  min:1000, max:1499, badge:'🥈', color:'#C0C0C0' },
  { name:'Gold',    min:1500, max:1999, badge:'🥇', color:'#FFD700' },
  { name:'Diamond', min:2000, max:9999, badge:'💎', color:'#B9F2FF' },
];

function getLeague(elo) {
  return LEAGUES.slice().reverse().find(l => elo >= l.min) || LEAGUES[0];
}

function calcELO(winnerElo, loserElo) {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const change = Math.round(K * (1 - expected));
  return { gain: Math.max(8, change), loss: Math.max(8, change) };
}

function createUserRecord({ username, passwordHash, email = null, isGuest = false }) {
  return {
    id:           uuidv4(),
    username,
    passwordHash,
    email:        email ? String(email).trim().toLowerCase() : null,
    isGuest:      !!isGuest,
    coins:        CONFIG.DEFAULT_COINS,
    avatar:       null,
    stats: { gamesPlayed: 0, gamesWon: 0, totalPoints: 0 },
    elo:          1000,
    createdAt:    Date.now(),
    lastLoginAt:  Date.now(),
  };
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

function createRoomRecord(hostId, settings = {}) {
  return {
    id:         uuidv4(),
    code:       generateRoomCode(),
    hostId,
    settings: {
      maxPlayers:   settings.maxPlayers    || 4,
      minPlayers:   settings.minPlayers    || 2,
      handSize:     settings.handSize      || 7,
      isPrivate:    settings.isPrivate     || false,
      password:     settings.password      || null,
      drawStacking: settings.drawStacking  || 'none',
      bet:          settings.bet           || 0,
      botDifficulty: settings.botDifficulty || 'medium',
    },
    game:       null,
    playerIds:  [],
    spectators: new Set(), // userIds currently spectating this room
    spectatorChat: [],
    spectatorVotes: new Map(), // spectatorUserId -> votedPlayerId
    chat:       [],
    status:     'lobby',
    createdAt:  Date.now(),
    startedAt:  null,
  };
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

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: false },
  pingTimeout:  10000,
  pingInterval: 5000,
  allowEIO3: true,
});

app.use(cors());
app.use(express.json({ limit: '5mb' }));

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
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim();
    const host  = String(req.headers['x-forwarded-host']  || req.headers.host || '').split(',')[0].trim();
    const base  = `${proto}://${host}`;
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
    }
    // Bypass ngrok's "Visit Site" warning page so link previews work
    res.setHeader('ngrok-skip-browser-warning', 'true');
  },
}));

// ─────────────────────────────────────────
// JWT AUTH
// ─────────────────────────────────────────

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], CONFIG.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function verifySocketToken(token) {
  try { return jwt.verify(token, CONFIG.JWT_SECRET); }
  catch { return null; }
}

// ─────────────────────────────────────────
// REST: Auth
// ─────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username must be 3-20 characters' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const exists = [...usersDB.values()].find(u => u.username.toLowerCase() === username.toLowerCase());
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

  const token = jwt.sign({ userId: user.id, username: user.username }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRES_IN });
  console.log(`[Auth] Registered: ${username}${cleanEmail ? ' (' + cleanEmail + ')' : ''}`);
  res.status(201).json({ token, user: sanitizeUser(user) });
});

// Guest login — instant throwaway account, no credentials needed.
app.post('/api/auth/guest', async (req, res) => {
  let username, tries = 0;
  do {
    username = 'Guest' + Math.floor(1000 + Math.random() * 9000);
    tries++;
  } while ([...usersDB.values()].some(u => u.username.toLowerCase() === username.toLowerCase()) && tries < 60);

  const passwordHash = await bcrypt.hash(uuidv4(), CONFIG.SALT_ROUNDS);
  const user = createUserRecord({ username, passwordHash, isGuest: true });
  usersDB.set(user.id, user);
  saveUsers();

  const token = jwt.sign({ userId: user.id, username: user.username }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRES_IN });
  console.log(`[Auth] Guest created: ${username}`);
  res.status(201).json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = [...usersDB.values()].find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  // Daily login bonus — 1000 coins once per day
  const now = Date.now();
  const oneDay = 86400000;
  if (!user.lastLoginBonus || now - user.lastLoginBonus >= oneDay) {
    user.coins += CONFIG.DAILY_LOGIN_COINS;
    user.lastLoginBonus = now;
    console.log(`[Auth] Daily login bonus: +${CONFIG.DAILY_LOGIN_COINS} for ${username}`);
  }
  // One-time migration: give old players 1000 bonus
  if (!user.migrationBonus) {
    user.coins += 1000;
    user.migrationBonus = true;
    console.log(`[Auth] Migration bonus: +1000 for ${username}`);
  }
  user.lastLoginAt = now;
  saveUsers();

  const token = jwt.sign({ userId: user.id, username: user.username }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRES_IN });
  console.log(`[Auth] Login: ${username}`);
  res.json({ token, user: sanitizeUser(user) });
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

// ─────────────────────────────────────────
// REST: Rooms
// ─────────────────────────────────────────

app.get('/api/rooms', authMiddleware, (req, res) => {
  const all = [...roomsDB.values()].filter(r => !r.settings.isPrivate);
  const publicRooms = all
    .filter(r => r.status === 'lobby')
    .map(r => ({
      id: r.id, hostId: r.hostId, players: r.playerIds.length,
      maxPlayers: r.settings.maxPlayers, status: r.status,
      bet: r.settings.bet || 0,
      settings: { maxPlayers: r.settings.maxPlayers, drawStacking: r.settings.drawStacking },
    }));
  const liveGames = all
    .filter(r => r.status === 'playing')
    .map(r => ({
      id: r.id, players: r.playerIds.length,
      maxPlayers: r.settings.maxPlayers,
      bet: r.settings.bet || 0,
      spectators: r.spectators?.size || 0,
      playerNames: r.game.players.map(p => p.username),
    }));
  res.json({ rooms: publicRooms, liveGames });
});

app.post('/api/rooms', authMiddleware, (req, res) => {
  const { settings = {} } = req.body;
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const room = createRoomRecord(user.id, settings);
  room.game = new GameManager(room.id, room.settings);

  // ← FIX: attach game event listeners for normal rooms too
  attachGameListeners(room);

  const player = new Player(user.id, user.username, user.coins);
  player.avatar = user.avatar;
  player.isHost = true;

  const result = room.game.addPlayer(player);
  if (!result.success) return res.status(400).json({ error: result.reason });

  room.playerIds.push(user.id);
  roomsDB.set(room.id, room);

  console.log(`[Room] Created: ${room.id} by ${user.username} (bet: ${settings.bet || 0})`);
  res.status(201).json({ roomId: room.id, code: room.code, settings: room.settings });
});

app.get('/api/rooms/code/:code', authMiddleware, (req, res) => {
  const room = [...roomsDB.values()].find(r => r.code === req.params.code.toUpperCase());
  if(!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ roomId: room.id, settings: room.settings, players: room.game.players.map(p => p.toPublicJSON()) });
});

app.get('/api/rooms/:roomId', authMiddleware, (req, res) => {
  const room = roomsDB.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({
    id: room.id, status: room.status, settings: room.settings,
    players: room.game.players.map(p => p.toPublicJSON()),
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
const LEAGUE_BOT_NAMES = ['Karim','Nacer','Yassine','Hamza','Adam','Reda','Ilyas','Anas','Bilal','Mehdi','Othmane','Salim','Driss','Mounir'];
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
  userPlayer.avatar = user.avatar;
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

app.post('/api/profile/avatar', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { avatar } = req.body;
  if (typeof avatar !== 'string' || !avatar.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid avatar payload' });
  }
  if (avatar.length > 4 * 1024 * 1024) {
    return res.status(413).json({ error: 'Avatar too large (max ~3MB)' });
  }
  const now = Date.now();
  if (user.lastAvatarAt && now - user.lastAvatarAt < AVATAR_COOLDOWN_MS) {
    const left = AVATAR_COOLDOWN_MS - (now - user.lastAvatarAt);
    const days = Math.ceil(left / (24*60*60*1000));
    return res.status(429).json({ error: `You can change your avatar again in ${days} day${days===1?'':'s'}`, retryInDays: days });
  }
  user.avatar = avatar;
  user.lastAvatarAt = now;
  saveUsers();
  res.json({ avatar: user.avatar, lastAvatarAt: user.lastAvatarAt, cooldownDays: 10 });
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

// Admin: reset password
// Forgot password — verified by the recovery email set at registration.
app.post('/api/auth/reset', async (req, res) => {
  const { username, email, newPassword } = req.body;
  if (!username || !email || !newPassword) return res.status(400).json({ error: 'Fill all fields' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const user = [...usersDB.values()].find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'No account with that username' });
  if (!user.email) return res.status(400).json({ error: 'This account has no recovery email on file' });
  if (user.email !== String(email).trim().toLowerCase())
    return res.status(401).json({ error: 'Email does not match this account' });
  user.passwordHash = await bcrypt.hash(newPassword, CONFIG.SALT_ROUNDS);
  saveUsers();
  console.log(`[Auth] Password reset: ${user.username}`);
  res.json({ success: true, message: 'Password reset — you can now log in' });
});
app.post('/api/admin/add-coins', async (req, res) => {
  const { username, amount, secret } = req.body;
  if (secret !== 'uno_admin_2024') return res.status(403).json({ error: 'Forbidden' });
  const user = [...usersDB.values()].find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.coins += amount;
  saveUsers();
  res.json({ success: true, username: user.username, coins: user.coins });
});
// Friends: get list
app.get('/api/friends', authMiddleware, (req, res) => {
  const user = usersDB.get(req.user.userId);
  if(!user) return res.status(404).json({ error: 'User not found' });
  const friends = (user.friends || []).map(fid => {
    const f = usersDB.get(fid);
    if(!f) return null;
    const isOnline = [...socketToUser.values()].includes(fid);
    return { id: f.id, username: f.username, coins: f.coins, isOnline };
  }).filter(Boolean);
  res.json({ friends });
});

// Friends: send request
app.post('/api/friends/request', authMiddleware, (req, res) => {
  const { username } = req.body;
  const user = usersDB.get(req.user.userId);
  if(!user) return res.status(404).json({ error: 'User not found' });
  const target = [...usersDB.values()].find(u => u.username.toLowerCase() === username.toLowerCase());
  if(!target) return res.status(404).json({ error: 'User not found' });
  if(target.id === user.id) return res.status(400).json({ error: 'Cannot add yourself' });
  if((user.friends||[]).includes(target.id)) return res.status(400).json({ error: 'Already friends' });
  if(!target.friendRequests) target.friendRequests = [];
  if(target.friendRequests.includes(user.id)) return res.status(400).json({ error: 'Request already sent' });
  target.friendRequests.push(user.id);
  saveUsers();
  // Notify target if online
  const targetSock = findSocketByUserId(target.id);
  if(targetSock) targetSock.emit('friend:request', { from: { id: user.id, username: user.username } });
  res.json({ success: true });
});

// Friends: accept
app.post('/api/friends/accept', authMiddleware, (req, res) => {
  const { userId: fromId } = req.body;
  const user = usersDB.get(req.user.userId);
  if(!user) return res.status(404).json({ error: 'User not found' });
  const from = usersDB.get(fromId);
  if(!from) return res.status(404).json({ error: 'User not found' });
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
app.post('/api/friends/decline', authMiddleware, (req, res) => {
  const { userId: fromId } = req.body;
  const user = usersDB.get(req.user.userId);
  if(!user) return res.status(404).json({ error: 'User not found' });
  user.friendRequests = (user.friendRequests||[]).filter(id => id !== fromId);
  saveUsers();
  res.json({ success: true });
});

// Friends: remove
app.post('/api/friends/remove', authMiddleware, (req, res) => {
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
app.post('/api/friends/invite', authMiddleware, (req, res) => {
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

app.get('/api/leaderboard/ranked', (req, res) => {
  const top = [...usersDB.values()]
    .filter(u => u.elo)
    .sort((a, b) => (b.elo||1000) - (a.elo||1000))
    .slice(0, 20)
    .map((u, i) => {
      const league = getLeague(u.elo||1000);
      return {
        rank: i+1, username: u.username,
        elo: u.elo||1000, badge: league.badge,
        league: league.name, color: league.color,
        gamesWon: u.stats?.gamesWon||0,
      };
    });
  res.json({ leaderboard: top });
});
app.get('/api/leaderboard', (req, res) => {
  const top = [...usersDB.values()]
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
  socket.userId   = user.userId;
  socket.username = user.username;
  next();
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  socketToUser.set(socket.id, userId);
  console.log(`[Socket] Connected: ${socket.username} (${socket.id})`);

  // Wrap every socket handler so a thrown error is contained to this
  // event instead of crashing the whole server mid-game.
  const _rawOn = socket.on.bind(socket);
  socket.on = (event, handler) => _rawOn(event, (...args) => {
    try {
      return handler(...args);
    } catch (err) {
      console.error(`[CRASH-GUARD] Error in socket "${event}" from ${socket.username}:`);
      console.error(err && err.stack ? err.stack : err);
      const ack = args[args.length - 1];
      if (typeof ack === 'function') {
        try { ack({ success: false, reason: 'Server error — please retry' }); } catch (_) {}
      }
    }
  });

  // ── Room: Join ──
  socket.on('room:join', ({ roomId, password } = {}, ack) => {
    const room = roomsDB.get(roomId);
    const user = usersDB.get(userId);
    if (!room)  return ack?.({ success: false, reason: 'Room not found' });
    if (!user)  return ack?.({ success: false, reason: 'User not found' });
    if (room.status !== 'lobby') return ack?.({ success: false, reason: 'Game already started' });
    if (room.settings.password && room.settings.password !== password) return ack?.({ success: false, reason: 'Wrong password' });

    const alreadyInRoom = room.playerIds.includes(userId);
    if (!alreadyInRoom) {
      // Check if player has enough coins for the bet
      const bet = room.settings.bet || 0;
      if (bet > 0 && user.coins < bet) {
        return ack?.({ success: false, reason: `Not enough coins! You need ${bet} 🪙 (you have ${user.coins})` });
      }
      const player = new Player(user.id, user.username, user.coins);
      player.avatar = user.avatar;
      const result = room.game.addPlayer(player);
      if (!result.success) return ack?.({ success: false, reason: result.reason });
      room.playerIds.push(userId);
    }

    socket.join(roomId);
    socket.currentRoomId = roomId;

    const state = room.game._publicState();
    ack?.({ success: true, state });

    socket.emit('chat:history', { messages: (room.chat || []).slice(-50) });

    socket.to(roomId).emit('room:player_joined', {
      player: room.game.players.find(p => p.id === userId)?.toPublicJSON(),
    });
    console.log(`[Room] ${socket.username} joined ${roomId}`);
  });

  // ── Room: Leave ──
  socket.on('room:leave', ({} = {}, ack) => {
    const roomId = socket.currentRoomId;
    if (!roomId) return ack?.({ success: false });
    handlePlayerLeave(socket, roomId);
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

    if (!room.spectators) room.spectators = new Set();
    room.spectators.add(userId);
    socket.join(roomId);
    socket.currentRoomId = roomId;
    socket.isSpectator = true;

    socket.emit('chat:history', { messages: (room.chat || []).slice(-50) });
    socket.emit('chat:spectator_history', { messages: (room.spectatorChat || []).slice(-50) });
    socket.emit('game:spectator_state', room.game._spectatorState());
    socket.emit('vote:tally', { tally: computeVoteTally(room), my: room.spectatorVotes?.get(userId) || null });

    socket.to(roomId).emit('room:spectator_joined', {
      spectatorId: userId, username: socket.username, count: room.spectators.size,
    });
    ack?.({ success: true });
    console.log(`[Spectate] ${socket.username} watching ${roomId} (${room.spectators.size} watchers)`);
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

  socket.on('chat:spectator_send', ({ text } = {}, ack) => {
    try {
      const room = roomsDB.get(socket.currentRoomId);
      if (!room) return ack?.({ success: false, reason: 'Not in room' });
      if (!socket.isSpectator) return ack?.({ success: false, reason: 'Players use chat:send' });
      if (!text?.trim()) return ack?.({ success: false });
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

    const result = room.game.startGame(userId);
    if (!result.success) return ack?.({ success: false, reason: result.reason });

    room.status    = 'playing';
    room.startedAt = Date.now();

    room.playerIds.forEach(pid => {
      const player = room.game.players.find(p => p.id === pid);
      if (!player) return;
      const playerSocket = findSocketByUserId(pid);
      if (playerSocket) playerSocket.emit('game:state', room.game._playerState(player));
    });

    ack?.({ success: true });
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

  // ── Game: Choose Color ──
  socket.on('game:choose_color', ({ color } = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room) return ack?.({ success: false });
    const result = room.game.chooseColor(userId, color);
    if (result.success) {
      io.to(socket.currentRoomId).emit('game:color_chosen', { playerId: userId, color });
      broadcastPrivateStates(room);
    }
    ack?.(result);
  });

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
  socket.on('chat:send', ({ text } = {}, ack) => {
    try {
      const room = roomsDB.get(socket.currentRoomId);
      if (!room) return ack?.({ success: false, reason: 'Not in room' });
      if (!text?.trim()) return ack?.({ success: false });
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

  // ── Game: Emoji Reaction ──
  socket.on('game:reaction', ({ emoji } = {}) => {
    if(!emoji) return;
    const safe = String(emoji).slice(0,4);
    socket.to(socket.currentRoomId).emit('game:reaction', { playerId: userId, emoji: safe });
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
    if (!socket.currentRoomId || !to || !kind) return;
    const targetSock = findSocketByUserId(to);
    if (targetSock) {
      targetSock.emit('voice:signal', { from: userId, kind, payload });
    }
  });
  socket.on('voice:speaking', ({ speaking } = {}) => {
    if (!socket.currentRoomId) return;
    socket.to(socket.currentRoomId).emit('voice:speaking', { peerId: userId, speaking: !!speaking });
  });
  
  // ── Game: Challenge WD4 ──
  socket.on('game:challenge_wd4', ({} = {}, ack) => {
    const room = roomsDB.get(socket.currentRoomId);
    if (!room) return ack?.({ success: false });
    const result = room.game.challengeWildDraw4(userId);
    if (result.success) {
      io.to(socket.currentRoomId).emit('game:challenge_resolved', result.result);
      broadcastPrivateStates(room);
    }
    ack?.(result);
  });

  // ── Matchmaking ──
  socket.on('matchmaking:join', ({ settings = {} } = {}, ack) => {
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
    const user = usersDB.get(userId);
    if (!user) return ack?.({ success: false, reason: 'User not found' });
    if (!['easy', 'medium', 'hard'].includes(difficulty)) difficulty = 'medium';

    const room = createRoomRecord(user.id, { maxPlayers: 2, bet: 0, botDifficulty: difficulty });
    room.game = new GameManager(room.id, room.settings);
    room.isPractice = true;
    attachGameListeners(room);

    const player = new Player(user.id, user.username, user.coins);
    player.avatar = user.avatar;
    room.game.addPlayer(player);
    room.playerIds.push(user.id);

    const botName = { easy: 'Rookie Bot', medium: 'Veteran Bot', hard: 'Master Bot' }[difficulty];
    const bot = new Player('bot_' + Date.now(), botName, 0);
    bot.isBot = true;
    bot.isConnected = true;
    bot.status = 'active';
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
      if (!r || r.status !== 'lobby') return;
      const result = r.game.startGame(user.id);
      if (!result.success) return;
      r.status = 'playing';
      r.startedAt = Date.now();
      const p = r.game.players.find(pp => pp.id === user.id);
      const ps = findSocketByUserId(user.id);
      if (ps && p) ps.emit('game:state', r.game._playerState(p));
    }, 1500);
  });

  // ── Disconnect ──
  socket.on('disconnect', (reason) => {
    socketToUser.delete(socket.id);
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
        handlePlayerLeave(socket, roomId);
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

    data.players.forEach(playerData => {
      const user = usersDB.get(playerData.id);
      if (!user) return;
      user.stats.gamesPlayed++;
      // Match history (latest 20 per user) — feeds the League Hub
      if (!Array.isArray(user.matchHistory)) user.matchHistory = [];
      const won = winnerData && winnerData.id === playerData.id;
      const opponents = data.players.filter(p => p.id !== playerData.id).map(p => p.username);
      user.matchHistory.unshift({
        at: Date.now(),
        won,
        opponents,
        eloChange: won ? eloGain : -eloLoss,
        bet,
      });
      if (user.matchHistory.length > 20) user.matchHistory.length = 20;
      if (winnerData && winnerData.id === playerData.id) {
        // Winner gets all the bet money from losers
        const totalWin = bet * (data.players.length - 1);
        user.coins += totalWin;
        user.stats.gamesWon++;
        if (totalWin > 0) {
          logReward(user, '🪙', `Match win vs ${opponents.join(', ') || 'opponent'}`, totalWin);
        }
      } else {
        // Loser pays the bet
        user.coins = Math.max(0, user.coins - bet);
        // Broke system: give coins if player is at 0
        if (user.coins <= 0) {
          if (!user.brokeCount) user.brokeCount = 0;
          if (!user.lastBrokeAt) user.lastBrokeAt = 0;
          const gifts = CONFIG.BROKE_GIFTS;
          if (user.brokeCount < gifts.length) {
            user.coins = gifts[user.brokeCount];
            console.log(`[Coins] Broke gift #${user.brokeCount+1}: +${gifts[user.brokeCount]} for ${user.username}`);
            user.brokeCount++;
            user.lastBrokeAt = Date.now();
          } else if (user.instaFollowed) {
            // After insta: restart gift cycle
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
          // else: 0 coins, must follow insta or wait
        }
      }
    });
    saveUsers();
    io.to(roomId).emit('game:over', data);
    console.log(`[Game] Over in room ${roomId} (bet: ${bet})`);
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
    player.avatar = user.avatar;
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

const BOT_NAMES = ['UnoBot', 'PixelBot', 'NeoBot', 'CyberBot', 'AceBot', 'ZetaBot', 'NovaBot'];
function spawnBotMatch(entry) {
  const user = usersDB.get(entry.userId);
  if (!user) return;
  const sock = io.sockets.sockets.get(entry.socketId);
  if (!sock) return;

  const room = createRoomRecord(user.id, { maxPlayers: 2 });
  room.game = new GameManager(room.id, room.settings);
  attachGameListeners(room);

  const player = new Player(user.id, user.username, user.coins);
  player.avatar = user.avatar;
  room.game.addPlayer(player);
  room.playerIds.push(user.id);

  const bot = new Player('bot_' + Date.now(), BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)], 0);
  bot.isBot = true;
  bot.isConnected = true;
  bot.status = 'active';
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

function broadcastPrivateStates(room) {
  room.playerIds.forEach(pid => {
    const player = room.game.players.find(p => p.id === pid);
    const playerSock = findSocketByUserId(pid);
    if (player && playerSock) playerSock.emit('game:state_update', room.game._playerState(player));
  });
  // Spectators get the full state (with all hands visible)
  if (room.spectators && room.spectators.size > 0) {
    const specState = room.game._spectatorState();
    room.spectators.forEach(sid => {
      const sock = findSocketByUserId(sid);
      if (sock) sock.emit('game:spectator_state_update', specState);
    });
  }
}

// ← FIX: handlePlayerLeave now properly removes from playerIds
function handlePlayerLeave(socket, roomId) {
  const room = roomsDB.get(roomId);
  if (!room) return;

  // If game is playing — leaver forfeits, opponent wins
  if (room.status === 'playing' && room.game.phase === 'playing') {
    const bet = room.settings.bet || 0;
    const leaver = usersDB.get(socket.userId);
    const remainingIds = room.playerIds.filter(id => id !== socket.userId);

    if (leaver && bet > 0) {
      leaver.coins = Math.max(0, leaver.coins - bet);
    }

    // Give bet to remaining players (winner)
    remainingIds.forEach(pid => {
      const winner = usersDB.get(pid);
      if (winner) {
        winner.coins += bet;
        winner.stats.gamesWon = (winner.stats.gamesWon || 0) + 1;
      }
    });

    if (leaver) leaver.stats.gamesPlayed = (leaver.stats.gamesPlayed || 0) + 1;
    remainingIds.forEach(pid => {
      const u = usersDB.get(pid);
      if (u) u.stats.gamesPlayed = (u.stats.gamesPlayed || 0) + 1;
    });

    saveUsers();

    // Notify remaining players they won
    const winnerSocket = remainingIds.length > 0 ? findSocketByUserId(remainingIds[0]) : null;
    const winnerUser = remainingIds.length > 0 ? usersDB.get(remainingIds[0]) : null;

    io.to(roomId).emit('game:player_won', {
      winnerId: remainingIds[0],
      username: winnerUser?.username || 'Player',
      score: 0,
      coinsEarned: bet,
      bet,
      forfeit: true,
      quitter: socket.username,
    });

    room.status = 'finished';
    setTimeout(() => { roomsDB.delete(roomId); }, 10000);
    console.log(`[Game] ${socket.username} forfeited. ${winnerUser?.username} wins +${bet} coins`);
  }

  room.game.removePlayer(socket.userId);

  const pidIdx = room.playerIds.indexOf(socket.userId);
  if (pidIdx !== -1) room.playerIds.splice(pidIdx, 1);

  socket.leave(roomId);
  delete socket.currentRoomId;

  socket.to(roomId).emit('room:player_left', {
    playerId: socket.userId, username: socket.username,
  });

  if (room.playerIds.length === 0) {
    roomsDB.delete(roomId);
    console.log(`[Room] Deleted empty room: ${roomId}`);
  }
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  const league = getLeague(safe.elo||1000);
  safe.league = league;
  return safe;
}

// ─────────────────────────────────────────
// ROOM CLEANUP
// ─────────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of roomsDB) {
    if (room.status === 'finished' && now - (room.startedAt || room.createdAt) > 7200000) roomsDB.delete(roomId);
    if (room.status === 'lobby' && room.playerIds.length === 0 && now - room.createdAt > 1800000) roomsDB.delete(roomId);
  }
}, CONFIG.ROOM_CLEANUP_INTERVAL);

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// TOURNAMENTS
// ─────────────────────────────────────────

const tournamentsDB = new Map();

function createTournament({ name, maxPlayers, prizeCoins, secret }) {
  if(secret !== 'uno_admin_2024') return null;
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

// Admin: create tournament
app.post('/api/tournament/create', (req, res) => {
  const { name, maxPlayers, prizeCoins, secret } = req.body;
  if(secret !== 'uno_admin_2024') return res.status(403).json({ error: 'Forbidden' });
  const t = createTournament({ name, maxPlayers, prizeCoins, secret });
  if(!t) return res.status(400).json({ error: 'Failed' });
  console.log(`[Tournament] Created: ${t.name} (${t.id})`);
  io.emit('tournament:update', sanitizeTournament(t));
  res.json({ tournament: sanitizeTournament(t) });
});

// Always keep one open tournament available to join.
function ensureOpenTournament() {
  const open = [...tournamentsDB.values()].find(t => t.status === 'open');
  if (open) return open;
  const id = uuidv4();
  const t = {
    id, name: 'UNO Open Cup',
    maxPlayers: 8, prizeCoins: 5000,
    players: [], bracket: [], round: 0,
    status: 'open', createdAt: Date.now(), winner: null,
  };
  tournamentsDB.set(id, t);
  console.log(`[Tournament] Auto-seeded: ${t.name}`);
  return t;
}

// Get all open tournaments
app.get('/api/tournaments', authMiddleware, (req, res) => {
  ensureOpenTournament();
  const list = [...tournamentsDB.values()]
    .filter(t => t.status !== 'finished')
    .map(sanitizeTournament);
  res.json({ tournaments: list });
});

// Get single tournament
app.get('/api/tournaments/:id', authMiddleware, (req, res) => {
  const t = tournamentsDB.get(req.params.id);
  if(!t) return res.status(404).json({ error: 'Not found' });
  res.json({ tournament: sanitizeTournament(t) });
});

// Join tournament
app.post('/api/tournaments/:id/join', authMiddleware, (req, res) => {
  const t = tournamentsDB.get(req.params.id);
  const user = usersDB.get(req.user.userId);
  if(!t) return res.status(404).json({ error: 'Tournament not found' });
  if(!user) return res.status(404).json({ error: 'User not found' });
  if(t.status !== 'open') return res.status(400).json({ error: 'Tournament already started' });
  if(t.players.find(p => p.id === user.id)) return res.status(400).json({ error: 'Already registered' });
  if(t.players.length >= t.maxPlayers) return res.status(400).json({ error: 'Tournament full' });
  t.players.push({ id: user.id, username: user.username, elo: user.elo||1000 });
  console.log(`[Tournament] ${user.username} joined ${t.name}`);
  io.emit('tournament:update', sanitizeTournament(t));
  res.json({ success: true, tournament: sanitizeTournament(t) });
});

// Admin: start tournament
app.post('/api/tournaments/:id/start', (req, res) => {
  const { secret } = req.body;
  if(secret !== 'uno_admin_2024') return res.status(403).json({ error: 'Forbidden' });
  const t = tournamentsDB.get(req.params.id);
  if(!t) return res.status(404).json({ error: 'Not found' });
  if(t.players.length < 2) return res.status(400).json({ error: 'Need at least 2 players' });
  t.status = 'playing';
  t.round = 1;
  t.bracket = buildBracket(t.players);
  // Create rooms for each match
  t.bracket.forEach(match => {
    const room = createRoomRecord(match.p1.id, { maxPlayers: 2, tournamentId: t.id });
    room.game = new GameManager(room.id, room.settings);
    attachGameListeners(room);
    room.tournamentMatchId = `${t.id}:${match.p1.id}:${match.p2.id}`;
    roomsDB.set(room.id, room);
    match.roomId = room.id;
    // Notify players
    const s1 = findSocketByUserId(match.p1.id);
    const s2 = findSocketByUserId(match.p2.id);
    if(s1) { s1.emit('tournament:match_ready', { roomId: room.id, opponent: match.p2, tournamentName: t.name }); }
    if(s2) { s2.emit('tournament:match_ready', { roomId: room.id, opponent: match.p1, tournamentName: t.name }); }
  });
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
    // Tournament finished!
    t.status = 'finished';
    t.winner = winners[0];
    const winnerUser = usersDB.get(winners[0].id);
    if(winnerUser) {
      winnerUser.coins += t.prizeCoins;
      winnerUser.tournamentWins = (winnerUser.tournamentWins||0) + 1;
      logReward(winnerUser, '⚔️', `Tournament champion — ${t.name}`, t.prizeCoins);
      saveUsers();
    }
    const winnerSock = findSocketByUserId(winners[0].id);
    if(winnerSock) winnerSock.emit('tournament:won', { name: t.name, prize: t.prizeCoins });
    io.emit('tournament:finished', { tournamentId: t.id, winner: winners[0], prize: t.prizeCoins });
    console.log(`[Tournament] ${t.name} finished! Winner: ${winners[0].username} +${t.prizeCoins} coins`);
  } else {
    // Next round
    t.round++;
    t.bracket = buildBracket(winners);
    t.bracket.forEach(match => {
      const room = createRoomRecord(match.p1.id, { maxPlayers: 2, tournamentId: t.id });
      room.game = new GameManager(room.id, room.settings);
      attachGameListeners(room);
      roomsDB.set(room.id, room);
      match.roomId = room.id;
      const s1 = findSocketByUserId(match.p1.id);
      const s2 = findSocketByUserId(match.p2.id);
      if(s1) s1.emit('tournament:match_ready', { roomId: room.id, opponent: match.p2, tournamentName: t.name, round: t.round });
      if(s2) s2.emit('tournament:match_ready', { roomId: room.id, opponent: match.p1, tournamentName: t.name, round: t.round });
    });
    console.log(`[Tournament] ${t.name} — Round ${t.round}`);
  }
  io.emit('tournament:update', sanitizeTournament(t));
}

function sanitizeTournament(t) {
  return {
    id: t.id, name: t.name, maxPlayers: t.maxPlayers,
    prizeCoins: t.prizeCoins, players: t.players,
    bracket: t.bracket.map(m => ({
      p1: m.p1, p2: m.p2, winner: m.winner, roomId: m.roomId
    })),
    round: t.round, status: t.status, winner: t.winner,
  };
}
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), rooms: roomsDB.size, users: usersDB.size, queue: matchmakingQueue.length });
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

loadUsers().then(() => {
  server.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════╗
║   UNO Online Server v2.1        ║
║   Port: ${CONFIG.PORT}                      ║
║   CORS: ${CONFIG.CORS_ORIGIN}               ║
╚══════════════════════════════════╝
  `);
});
}).catch(err => {
  console.log('[DB] Starting without MongoDB:', err.message);
  server.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${CONFIG.PORT} (no DB)`);
  });
});
module.exports = { app, server, io };
