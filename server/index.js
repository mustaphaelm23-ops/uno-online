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

function createUserRecord({ username, passwordHash }) {
  return {
    id:           uuidv4(),
    username,
    passwordHash,
    coins:        CONFIG.DEFAULT_COINS,
    avatar:       null,
    stats: { gamesPlayed: 0, gamesWon: 0, totalPoints: 0 },
    elo:          1000,
    createdAt:    Date.now(),
    lastLoginAt:  Date.now(),
  };
}

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
    },
    game:       null,
    playerIds:  [],
    spectators: new Set(), // userIds currently spectating this room
    spectatorChat: [],
    chat:       [],
    status:     'lobby',
    createdAt:  Date.now(),
    startedAt:  null,
  };
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
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username must be 3-20 characters' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const exists = [...usersDB.values()].find(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Username already taken' });

  const passwordHash = await bcrypt.hash(password, CONFIG.SALT_ROUNDS);
  const user = createUserRecord({ username, passwordHash });
  usersDB.set(user.id, user);
  saveUsers(); // ← FIX: save after registration

  const token = jwt.sign({ userId: user.id, username: user.username }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRES_IN });
  console.log(`[Auth] Registered: ${username}`);
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
  saveUsers();
  console.log(`[Coins] Instagram reward: +${CONFIG.INSTA_REWARD} for ${user.username}`);
  res.json({ coins: user.coins, earned: CONFIG.INSTA_REWARD });
});
// Admin: reset password
app.post('/api/auth/reset', async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword) return res.status(400).json({ error: 'Fill all fields' });
  const user = [...usersDB.values()].find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.passwordHash = await bcrypt.hash(newPassword, CONFIG.SALT_ROUNDS);
  saveUsers();
  res.json({ success: true, message: 'Password reset' });
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
    room.status = 'finished';
    const bet = room.settings.bet || 0;
    const winnerData = data.winners?.[0];
    // ELO calculation
    const winnerUser = winnerData ? usersDB.get(winnerData.id) : null;
    const loserUsers = data.players.filter(p => p.id !== winnerData?.id).map(p => usersDB.get(p.id)).filter(Boolean);
    if(winnerUser && loserUsers.length > 0) {
      const avgLoserElo = loserUsers.reduce((s,u) => s+(u.elo||1000), 0) / loserUsers.length;
      const { gain, loss } = calcELO(winnerUser.elo||1000, avgLoserElo);
      winnerUser.elo = Math.max(0, (winnerUser.elo||1000) + gain);
      loserUsers.forEach(u => { u.elo = Math.max(0, (u.elo||1000) - loss); });
    }

    data.players.forEach(playerData => {
      const user = usersDB.get(playerData.id);
      if (!user) return;
      user.stats.gamesPlayed++;
      if (winnerData && winnerData.id === playerData.id) {
        // Winner gets all the bet money from losers
        const totalWin = bet * (data.players.length - 1);
        user.coins += totalWin;
        user.stats.gamesWon++;
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
    const winner = usersDB.get(data.winnerId);
    const eloChange = winner ? Math.abs((winner.elo||1000) - 1000) : 16;
    io.to(roomId).emit('game:player_won', { ...data, eloChange: eloChange || 16 });
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

// Get all open tournaments
app.get('/api/tournaments', authMiddleware, (req, res) => {
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
