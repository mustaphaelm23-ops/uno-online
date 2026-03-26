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
  PORT:           process.env.PORT           || 3001,
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

const usersDB = new Map();
const fs = require('fs');
const DB_FILE = './users-db.json';

function loadUsers() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      data.forEach(u => usersDB.set(u.id, u));
      console.log(`[DB] Loaded ${data.length} users`);
    }
  } catch(e) { console.log('[DB] No saved users'); }
}

function saveUsers() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify([...usersDB.values()], null, 2));
  } catch(e) { console.log('[DB] Save failed:', e.message); }
}

loadUsers();

const roomsDB = new Map();
const matchmakingQueue = [];
const socketToUser = new Map();

// ─────────────────────────────────────────
// USER RECORD
// ─────────────────────────────────────────

function createUserRecord({ username, passwordHash }) {
  return {
    id:           uuidv4(),
    username,
    passwordHash,
    coins:        CONFIG.DEFAULT_COINS,
    avatar:       null,
    stats: { gamesPlayed: 0, gamesWon: 0, totalPoints: 0 },
    createdAt:    Date.now(),
    lastLoginAt:  Date.now(),
  };
}

// ─────────────────────────────────────────
// ROOM RECORD
// ─────────────────────────────────────────

function createRoomRecord(hostId, settings = {}) {
  return {
    id:         uuidv4(),
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
app.use(express.json());

// Serve client files
const path = require('path');
app.use(express.static(path.join(__dirname, '../client')));

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
  const publicRooms = [...roomsDB.values()]
    .filter(r => !r.settings.isPrivate && r.status === 'lobby')
    .map(r => ({
      id: r.id, hostId: r.hostId, players: r.playerIds.length,
      maxPlayers: r.settings.maxPlayers, status: r.status,
      bet: r.settings.bet || 0,
      settings: { maxPlayers: r.settings.maxPlayers, drawStacking: r.settings.drawStacking },
    }));
  res.json({ rooms: publicRooms });
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
  res.status(201).json({ roomId: room.id, settings: room.settings });
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
    if (existingIdx !== -1) matchmakingQueue.splice(existingIdx, 1);
    matchmakingQueue.push({ userId, socketId: socket.id, settings, joinedAt: Date.now() });
    tryMatchmaking(io, usersDB, roomsDB);
    ack?.({ success: true, queueSize: matchmakingQueue.length });
    console.log(`[MM] ${socket.username} joined queue (${matchmakingQueue.length} waiting)`);
  });

  socket.on('matchmaking:leave', ({} = {}, ack) => {
    const idx = matchmakingQueue.findIndex(e => e.userId === userId);
    if (idx !== -1) matchmakingQueue.splice(idx, 1);
    ack?.({ success: true });
  });

  // ── Disconnect ──
  socket.on('disconnect', (reason) => {
    socketToUser.delete(socket.id);
    const roomId = socket.currentRoomId;
    if (roomId) handlePlayerLeave(socket, roomId);
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

  game.on('player:won', (data) => { io.to(roomId).emit('game:player_won', data); });
}

// ─────────────────────────────────────────
// MATCHMAKING
// ─────────────────────────────────────────

function tryMatchmaking(io, usersDB, roomsDB) {
  if (matchmakingQueue.length < 2) return;
  const toMatch = matchmakingQueue.splice(0, Math.min(4, matchmakingQueue.length));
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), rooms: roomsDB.size, users: usersDB.size, queue: matchmakingQueue.length });
});

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────

server.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════╗
║   UNO Online Server v2.1        ║
║   Port: ${CONFIG.PORT}                      ║
║   CORS: ${CONFIG.CORS_ORIGIN}               ║
╚══════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
