/**
 * DamaManager.js — server-authoritative Moroccan Dama engine.
 *
 * RULES
 * ─────
 *  • Board: 8×8, dark squares only (where (row + col) is odd) are
 *    playable. 32 playable squares total.
 *  • Pieces: 12 per side. White starts on rows 5-7, black on rows 0-2.
 *    White's promotion row is 0 (top); black's is 7 (bottom).
 *  • Movement (Men): exactly one diagonal step FORWARD only.
 *  • Movement (Kings / "Dama"): exactly one diagonal step in ANY of
 *    the four diagonals (short king — only kings can step backward,
 *    and even kings only one square at a time).
 *  • Capture (Men): jump over an adjacent enemy piece to the empty
 *    square immediately behind it. Men can ONLY capture FORWARD.
 *  • Capture (Kings): same as men but in any of the four diagonals.
 *  • Mandatory capture: if ANY capture is available on the board for
 *    the player to move, they must take a capture (not a simple move).
 *  • Chain capture: after a capture, if the moving piece can capture
 *    again from its new square, it must — same player keeps the turn
 *    and must continue the chain. King promotion ends the chain
 *    (classic Moroccan rule).
 *  • Promotion: a man that lands on the opponent's back row is
 *    instantly promoted to King (Dama).
 *  • Win: opponent has no pieces, or opponent has no legal moves.
 *
 *  EMITTED EVENTS
 *    dama:state        — full public state (called on every change)
 *    dama:turn         — { color, endsAt }
 *    dama:move         — { from, to, captured, promoted, nextColor,
 *                          chainContinues }
 *    dama:match_over   — { winnerColor, reason, finalBoard }
 */
'use strict';

const EventEmitter = require('events');

const PHASE = Object.freeze({ LOBBY:'lobby', PLAYING:'playing', FINISHED:'finished' });

const DEFAULT_SETTINGS = Object.freeze({
  turnTimeout:  10_000,           // strict 10 s per turn — user spec
  matchTimeout: 5 * 60 * 1000,    // 5 minutes total match length
  botDelay:       850,            // human-feeling "thinking" beat
  maxPlayers:   2,
});

const DIAGONALS = [[-1,-1], [-1,1], [1,-1], [1,1]];

class DamaManager extends EventEmitter {
  constructor(roomId, settings = {}){
    super();
    this.roomId    = roomId;
    this.settings  = { ...DEFAULT_SETTINGS, ...settings };

    this._phase            = PHASE.LOBBY;
    this._players          = [];          // [{id, username, color, ...}]
    this._board            = {};          // { 'r,c': {color, isKing, id} }
    this._currentColor     = null;        // 'white' | 'black'
    this._pendingCapturer  = null;        // posKey of piece mid-chain
    this._moveHistory      = [];
    this._turnTimer        = null;
    this._turnEndsAt       = null;
    this._matchTimer       = null;        // total-match 5-min timer
    this._matchEndsAt      = null;
  }

  /* ── seating ────────────────────────────────────────────────────── */
  addPlayer(player){
    if (this._players.length >= 2)
      return { success:false, reason:'Room full' };
    if (this._players.some(p => p.id === player.id))
      return { success:false, reason:'Already seated' };
    const slot  = this._players.length;
    const color = slot === 0 ? 'white' : 'black';
    const seatedPlayer = {
      id:          player.id,
      username:    player.username,
      avatar:      player.avatar || null,
      isBot:       !!player.isBot,
      isHost:      !!player.isHost,
      isConnected: true,
      status:      'active',
      abandoned:   false,
      saidUno:     false,           // UNO compat — never used here
      handSize:    0,               // UNO compat
      slot,
      color,
      setConnected(socketId){ this.socketId = socketId; this.isConnected = true; this.status = 'active'; },
      setDisconnected(){ this.isConnected = false; this.status = 'disconnected'; },
      toPublicJSON(){
        return {
          id: this.id, username: this.username, avatar: this.avatar,
          isBot: this.isBot, isHost: this.isHost,
          isConnected: this.isConnected, status: this.status,
          slot: this.slot, color: this.color,
          abandoned: this.abandoned,
        };
      },
    };
    this._players.push(seatedPlayer);
    return { success:true, slot, color };
  }

  removePlayer(playerId){
    const i = this._players.findIndex(p => p.id === playerId);
    if (i === -1) return false;
    this._players.splice(i, 1);
    this._players.forEach((p, idx) => {
      p.slot  = idx;
      p.color = idx === 0 ? 'white' : 'black';
    });
    return true;
  }

  /* ── start ──────────────────────────────────────────────────────── */
  startGame(){
    if (this._players.length !== 2)
      return { success:false, reason:`Need 2 players (have ${this._players.length})` };
    this._board = {};
    // Black on rows 0,1,2 — dark squares only.
    // White on rows 5,6,7 — dark squares only.
    for (let row = 0; row < 8; row++){
      for (let col = 0; col < 8; col++){
        if (((row + col) % 2) !== 1) continue;       // skip light squares
        if (row <= 2){
          this._board[`${row},${col}`] = { color:'black', isKing:false, id:`b${row}${col}` };
        } else if (row >= 5){
          this._board[`${row},${col}`] = { color:'white', isKing:false, id:`w${row}${col}` };
        }
      }
    }
    this._currentColor    = 'white';                 // white moves first
    this._pendingCapturer = null;
    this._moveHistory     = [];
    this._phase           = PHASE.PLAYING;
    // Arm the 5-minute match clock. If neither side has won by then,
    // _handleTimeUp picks the player with the most remaining pieces.
    this._matchEndsAt = Date.now() + this.settings.matchTimeout;
    this._matchTimer  = setTimeout(() => this._handleTimeUp(), this.settings.matchTimeout);
    this.emit('dama:state', this.publicState());
    this._beginTurn();
    return { success:true };
  }

  /* ── move enumeration ──────────────────────────────────────────── */
  /** Returns all CAPTURE moves available to `color` (or, when a chain
   *  is mid-flight, only the captures from `forceFromKey`). */
  _allCaptures(color, forceFromKey = null){
    const out = [];
    for (const [posKey, piece] of Object.entries(this._board)){
      if (piece.color !== color) continue;
      if (forceFromKey && posKey !== forceFromKey) continue;
      const [row, col] = posKey.split(',').map(Number);
      const caps = this._capturesFrom(row, col, piece);
      caps.forEach(c => out.push({ from: posKey, ...c }));
    }
    return out;
  }

  /** Returns all SIMPLE (non-capture) moves for `color`. */
  _allSimple(color){
    const out = [];
    for (const [posKey, piece] of Object.entries(this._board)){
      if (piece.color !== color) continue;
      const [row, col] = posKey.split(',').map(Number);
      const moves = this._simpleMovesFrom(row, col, piece);
      moves.forEach(m => out.push({ from: posKey, ...m }));
    }
    return out;
  }

  /** Returns legal moves for `color`, enforcing mandatory captures. */
  _legalMoves(color, forceFromKey = null){
    const caps = this._allCaptures(color, forceFromKey);
    if (caps.length) return caps;
    if (forceFromKey) return [];                    // in chain → only captures
    return this._allSimple(color);
  }

  /** Returns single-jump captures available from (row, col) for `piece`.
   *  Both men and kings now use the SAME single-step jump (over an
   *  adjacent enemy to the empty square immediately behind). The only
   *  difference: men are restricted to forward diagonals, kings can
   *  use all four diagonals (short king rule). */
  _capturesFrom(row, col, piece){
    const out = [];
    const forwardRow = piece.color === 'white' ? -1 : 1;
    const dirs = piece.isKing
      ? DIAGONALS                                    // king: all 4 diagonals
      : DIAGONALS.filter(([dr]) => dr === forwardRow); // man: forward only

    for (const [dr, dc] of dirs){
      const mr = row + dr,   mc = col + dc;
      const tr = row + 2*dr, tc = col + 2*dc;
      if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) continue;
      const midKey = `${mr},${mc}`;
      const tKey   = `${tr},${tc}`;
      const mid    = this._board[midKey];
      if (!mid || mid.color === piece.color) continue;
      if (this._board[tKey]) continue;
      out.push({ to:{ row:tr, col:tc }, captured: midKey });
    }
    return out;
  }

  /** Returns simple (non-capture) moves for a piece at (row, col).
   *  Both men and kings move exactly one diagonal step (short king
   *  rule). Men are forward-only; kings can step in any of the four
   *  diagonals. */
  _simpleMovesFrom(row, col, piece){
    const out = [];
    const forwardRow = piece.color === 'white' ? -1 : 1;
    const dirs = piece.isKing
      ? DIAGONALS
      : [[forwardRow, -1], [forwardRow, 1]];

    for (const [dr, dc] of dirs){
      const r = row + dr, c = col + dc;
      if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
      if (this._board[`${r},${c}`]) continue;
      out.push({ to:{ row:r, col:c }, captured:null });
    }
    return out;
  }

  /* ── move execution ────────────────────────────────────────────── */
  makeMove(playerId, move){
    if (this._phase !== PHASE.PLAYING)
      return { success:false, reason:'Not playing' };
    const player = this._players.find(p => p.id === playerId);
    if (!player)
      return { success:false, reason:'Not a player' };
    if (player.color !== this._currentColor)
      return { success:false, reason:'Not your turn' };
    if (!move || !move.from || !move.to)
      return { success:false, reason:'Malformed move' };
    const fromKey = `${move.from.row},${move.from.col}`;
    if (this._pendingCapturer && this._pendingCapturer !== fromKey)
      return { success:false, reason:'Must continue capture chain with the same piece' };

    const legal = this._legalMoves(this._currentColor, this._pendingCapturer);
    const match = legal.find(lm =>
      lm.from === fromKey &&
      lm.to.row === move.to.row &&
      lm.to.col === move.to.col
    );
    if (!match){
      const onlyCaps = this._pendingCapturer
        ? 'You must continue the capture chain'
        : (this._allCaptures(this._currentColor).length
            ? 'A capture is available — you must take it'
            : 'Illegal move');
      return { success:false, reason: onlyCaps };
    }

    const piece = this._board[fromKey];
    delete this._board[fromKey];
    const toKey = `${move.to.row},${move.to.col}`;
    this._board[toKey] = piece;
    if (match.captured) delete this._board[match.captured];

    // Promotion — happens INSTANTLY on landing on opponent's back row.
    const promotionRow = piece.color === 'white' ? 0 : 7;
    let justPromoted = false;
    if (move.to.row === promotionRow && !piece.isKing){
      piece.isKing = true;
      justPromoted = true;
    }

    // Chain check: still captures available from new square AND we
    // actually captured something on this move AND we didn't just
    // promote (classic Moroccan rule: promotion ends the chain).
    let chainContinues = false;
    if (match.captured && !justPromoted){
      const more = this._capturesFrom(move.to.row, move.to.col, piece);
      if (more.length){
        this._pendingCapturer = toKey;
        chainContinues = true;
      }
    }

    if (!chainContinues){
      this._pendingCapturer = null;
      this._currentColor    = this._currentColor === 'white' ? 'black' : 'white';
    }

    this._moveHistory.push({ from: fromKey, to: toKey, captured: match.captured, promoted: justPromoted });

    this.emit('dama:move', {
      from:           fromKey,
      to:             toKey,
      captured:       match.captured,
      promoted:       justPromoted,
      chainContinues,
      nextColor:      this._currentColor,
    });
    this.emit('dama:state', this.publicState());

    const winner = this._checkGameOver();
    if (winner){
      this._phase = PHASE.FINISHED;
      this._clearTimer();
      this._clearMatchTimer();
      const reason = (Object.values(this._board).filter(p => p.color !== winner).length === 0)
        ? 'no_pieces'
        : 'no_moves';
      this.emit('dama:match_over', {
        winnerColor: winner,
        reason,
        finalBoard:  { ...this._board },
      });
    } else {
      this._beginTurn();
    }
    return { success:true };
  }

  _checkGameOver(){
    const whites = Object.values(this._board).filter(p => p.color === 'white').length;
    const blacks = Object.values(this._board).filter(p => p.color === 'black').length;
    if (whites === 0) return 'black';
    if (blacks === 0) return 'white';
    const movesForCurrent = this._legalMoves(this._currentColor, this._pendingCapturer);
    if (movesForCurrent.length === 0)
      return this._currentColor === 'white' ? 'black' : 'white';
    return null;
  }

  /** Force the match to end with a given winner. Used when the other
   *  player quits or disconnects past the grace window, OR when the
   *  5-minute match clock runs out. `winnerColor` of `null` = draw.
   *  Idempotent — a second call after FINISHED is a no-op. */
  forceWin(winnerColor, reason = 'opponent_left'){
    if (this._phase === PHASE.FINISHED) return;
    this._phase = PHASE.FINISHED;
    this._clearTimer();
    this._clearMatchTimer();
    this.emit('dama:match_over', {
      winnerColor,
      reason,
      finalBoard: { ...this._board },
    });
  }

  _clearMatchTimer(){
    if (this._matchTimer){ clearTimeout(this._matchTimer); this._matchTimer = null; }
  }

  /** Fires when the 5-minute match clock expires. The player with MORE
   *  remaining pieces wins; equal counts → draw (null winner). */
  _handleTimeUp(){
    if (this._phase !== PHASE.PLAYING) return;
    const whites = Object.values(this._board).filter(p => p.color === 'white').length;
    const blacks = Object.values(this._board).filter(p => p.color === 'black').length;
    let winnerColor = null;
    if (whites > blacks) winnerColor = 'white';
    else if (blacks > whites) winnerColor = 'black';
    this.forceWin(winnerColor, 'time_up');
  }

  /* ── turn loop ─────────────────────────────────────────────────── */
  _beginTurn(){
    this._clearTimer();
    if (this._phase !== PHASE.PLAYING) return;
    // Per-turn time limit was removed per user spec — players can
    // think as long as they like, bounded only by the total 5-minute
    // match clock. _turnTimer / _turnEndsAt stay nulled so the client
    // hides the avatar countdown ring.
    this._turnEndsAt = null;
    this._turnTimer  = null;
    this.emit('dama:turn', { color: this._currentColor, endsAt: null });
    const cur = this._players.find(p => p.color === this._currentColor);
    if (cur && cur.isBot){
      const delay = this.settings.botDelay + Math.random() * 600;
      setTimeout(() => this._botPlay(cur), delay);
    }
  }

  _autoForfeit(){
    if (this._phase !== PHASE.PLAYING) return;
    const moves = this._legalMoves(this._currentColor, this._pendingCapturer);
    if (!moves.length) return;
    const m   = moves[0];
    const cur = this._players.find(p => p.color === this._currentColor);
    if (!cur) return;
    this.makeMove(cur.id, {
      from: { row: parseInt(m.from.split(',')[0]), col: parseInt(m.from.split(',')[1]) },
      to:   m.to,
    });
  }

  _botPlay(bot){
    if (this._phase !== PHASE.PLAYING)        return;
    if (bot.color !== this._currentColor)     return;
    const moves = this._legalMoves(this._currentColor, this._pendingCapturer);
    if (!moves.length) return;

    // Heuristic scoring — captures > king > advance > random tie-break.
    const enemyColor = bot.color === 'white' ? 'black' : 'white';
    const scored = moves.map(m => {
      let score = 0;
      // Captures hugely valuable; kings worth even more.
      if (m.captured){
        const cap = this._board[m.captured];
        score += 100 + (cap?.isKing ? 60 : 0);
      }
      const fromRow = parseInt(m.from.split(',')[0]);
      const piece   = this._board[m.from];
      if (piece){
        // Reward promotions.
        const promoRow = piece.color === 'white' ? 0 : 7;
        if (m.to.row === promoRow && !piece.isKing) score += 70;
        // Reward forward progress.
        const advance = piece.color === 'white'
          ? (fromRow - m.to.row)
          : (m.to.row - fromRow);
        score += Math.max(0, advance) * 2;
        // Slight penalty for landing in a square that's immediately
        // attackable by an opponent (very rough check — only counts
        // adjacent enemies that could capture us next turn).
        for (const [dr, dc] of DIAGONALS){
          const er = m.to.row + dr, ec = m.to.col + dc;
          const lr = m.to.row + 2*dr, lc = m.to.col + 2*dc;
          if (lr < 0 || lr >= 8 || lc < 0 || lc >= 8) continue;
          const enemy = this._board[`${er},${ec}`];
          if (enemy && enemy.color === enemyColor){
            // Make sure landing square would actually be empty (us is
            // no longer on `from` after the move).
            const wouldBeBlockedByUs = (lr === parseInt(m.from.split(',')[0]) && lc === parseInt(m.from.split(',')[1]));
            if (!this._board[`${lr},${lc}`] && !wouldBeBlockedByUs){
              score -= 25;
            }
          }
        }
      }
      score += Math.random() * 3;
      return { ...m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    this.makeMove(bot.id, {
      from: { row: parseInt(best.from.split(',')[0]), col: parseInt(best.from.split(',')[1]) },
      to:   best.to,
    });
  }

  _clearTimer(){
    if (this._turnTimer){ clearTimeout(this._turnTimer); this._turnTimer = null; }
  }

  /* ── public state ──────────────────────────────────────────────── */
  /** Pre-computed legal-move map for the CURRENT player. Lets the
   *  client highlight legal destinations without re-implementing rules. */
  _legalMoveMap(){
    if (this._phase !== PHASE.PLAYING) return {};
    const map = {};
    const moves = this._legalMoves(this._currentColor, this._pendingCapturer);
    for (const m of moves){
      if (!map[m.from]) map[m.from] = [];
      map[m.from].push({ row: m.to.row, col: m.to.col, captured: m.captured });
    }
    return map;
  }

  publicState(){
    const board = {};
    for (const [k, p] of Object.entries(this._board || {})){
      board[k] = { color: p.color, isKing: p.isKing, id: p.id };
    }
    const whiteCount = Object.values(board).filter(p => p.color === 'white').length;
    const blackCount = Object.values(board).filter(p => p.color === 'black').length;
    return {
      phase:           this._phase,
      players:         this._players.map(p => ({
        id: p.id, username: p.username, avatar: p.avatar,
        slot: p.slot, color: p.color, isBot: p.isBot,
        isHost: !!p.isHost,
        isConnected: p.isConnected !== false,
        handSize: 0,
      })),
      board,
      currentColor:    this._currentColor,
      pendingCapturer: this._pendingCapturer,
      legalMoves:      this._legalMoveMap(),
      pieceCount:      { white: whiteCount, black: blackCount },
      turnEndsAt:      this._turnEndsAt,
      turnTimeout:     this.settings.turnTimeout,
      matchEndsAt:     this._matchEndsAt,
      matchTimeout:    this.settings.matchTimeout,
      moveCount:       this._moveHistory.length,
    };
  }

  get phase(){ return this._phase; }
  get players(){ return this._players; }
}

module.exports = { DamaManager, PHASE };
