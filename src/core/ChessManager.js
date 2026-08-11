/**
 * ChessManager.js — server-authoritative chess engine.
 *
 * Deliberately mirrors DamaManager's shape (same constructor signature,
 * addPlayer/removePlayer/startGame/makeMove/forceWin/publicState, same
 * 'r,c' board keys, same event names with a chess: prefix) so it drops
 * straight into the existing room plumbing and the client can reuse the
 * Dama board-rendering approach.
 *
 * RULES — full standard chess:
 *  • Board 8×8, all squares playable. Row 0 = black's back rank (top),
 *    row 7 = white's back rank (bottom). White moves first.
 *  • Pieces: p(awn) n(knight) b(ishop) r(ook) q(ueen) k(ing).
 *  • Pawns: 1 step forward, 2 from their start row (path must be clear),
 *    capture diagonally, EN PASSANT, and PROMOTION on the far rank
 *    (defaults to queen; client may pass move.promotion = 'q'|'r'|'b'|'n').
 *  • Castling: king + rook unmoved, squares between empty, and the king
 *    is not in check / does not pass through or land on an attacked square.
 *  • A move is illegal if it leaves your own king in check.
 *  • Win: checkmate. Draw: stalemate, insufficient material, 50-move rule,
 *    threefold repetition.
 *
 *  EMITTED EVENTS
 *    chess:state       — full public state (on every change)
 *    chess:turn        — { color, endsAt }
 *    chess:move        — { from, to, piece, captured, promotion, castle,
 *                          enPassant, check, nextColor, san }
 *    chess:match_over  — { winnerColor, reason, finalBoard }
 */
'use strict';

const EventEmitter = require('events');

const PHASE = Object.freeze({ LOBBY:'lobby', PLAYING:'playing', FINISHED:'finished' });

// Time controls — each player gets their OWN clock that only runs on their
// turn (a real chess clock), plus an optional per-move increment (Fischer).
// `id` is what the client sends; unknown ids fall back to RAPID_10.
const TIME_CONTROLS = Object.freeze({
  BULLET_1:      { id:'BULLET_1',      label:'Bullet 1+0',    initial:  1*60_000, increment:     0, cls:'bullet' },
  BULLET_2_1:    { id:'BULLET_2_1',    label:'Bullet 2+1',    initial:  2*60_000, increment: 1_000, cls:'bullet' },
  BLITZ_3:       { id:'BLITZ_3',       label:'Blitz 3+0',     initial:  3*60_000, increment:     0, cls:'blitz'  },
  BLITZ_3_2:     { id:'BLITZ_3_2',     label:'Blitz 3+2',     initial:  3*60_000, increment: 2_000, cls:'blitz'  },
  BLITZ_5:       { id:'BLITZ_5',       label:'Blitz 5+0',     initial:  5*60_000, increment:     0, cls:'blitz'  },
  BLITZ_5_3:     { id:'BLITZ_5_3',     label:'Blitz 5+3',     initial:  5*60_000, increment: 3_000, cls:'blitz'  },
  RAPID_10:      { id:'RAPID_10',      label:'Rapid 10+0',    initial: 10*60_000, increment:     0, cls:'rapid'  },
  RAPID_10_5:    { id:'RAPID_10_5',    label:'Rapid 10+5',    initial: 10*60_000, increment: 5_000, cls:'rapid'  },
  RAPID_15_10:   { id:'RAPID_15_10',   label:'Rapid 15+10',   initial: 15*60_000, increment:10_000, cls:'rapid'  },
  CLASSICAL_30:  { id:'CLASSICAL_30',  label:'Classical 30+0',initial: 30*60_000, increment:     0, cls:'classic'},
  UNLIMITED:     { id:'UNLIMITED',     label:'No clock',      initial:          0, increment:     0, cls:'none'  },
});

const DEFAULT_SETTINGS = Object.freeze({
  turnTimeout:  0,                 // no per-turn limit — the chess clocks bound play
  botDelay:       700,
  maxPlayers:   2,
  botDifficulty: 'medium',         // 'easy' | 'medium' | 'hard'
  timeControl:  'RAPID_10',        // key of TIME_CONTROLS
});

const KNIGHT_DELTAS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING_DELTAS   = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const BISHOP_DIRS   = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ROOK_DIRS     = [[-1,0],[1,0],[0,-1],[0,1]];

const PIECE_VALUE = { p:100, n:320, b:330, r:500, q:900, k:20000 };

// Piece-square tables (white's perspective, row 0 = black's back rank).
// Mirrored for black at lookup time. Values are small nudges in centipawns.
const PST = {
  p: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0],
  ],
  n: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  b: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  r: [
    [  0,  0,  0,  0,  0,  0,  0,  0],
    [  5, 10, 10, 10, 10, 10, 10,  5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [  0,  0,  0,  5,  5,  0,  0,  0],
  ],
  q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  k: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20],
  ],
};

const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const other    = (color) => (color === 'white' ? 'black' : 'white');

class ChessManager extends EventEmitter {
  constructor(roomId, settings = {}){
    super();
    this.roomId   = roomId;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };

    this._phase        = PHASE.LOBBY;
    this._players      = [];
    this._board        = {};        // 'r,c' -> { color, type, id }
    this._currentColor = null;
    this._moveHistory  = [];
    this._turnTimer    = null;
    this._turnEndsAt   = null;

    // ── chess clocks ──
    this._tc            = TIME_CONTROLS[this.settings.timeControl] || TIME_CONTROLS.RAPID_10;
    this._clock         = { white:this._tc.initial, black:this._tc.initial };
    this._turnStartedAt = null;      // ms timestamp the side-to-move's clock started
    this._flagTimer     = null;      // fires when the side to move runs out
    this._drawOffer     = null;      // color that has an open draw offer

    // Special-move bookkeeping
    this._enPassant    = null;      // 'r,c' square a pawn may capture onto
    this._castling     = { white:{ k:true, q:true }, black:{ k:true, q:true } };
    this._halfmove     = 0;         // plies since last capture/pawn move (50-move rule)
    this._positions    = {};        // repetition counter: posKey -> times seen
    this._lastMove     = null;      // { from, to } for client highlighting
    this._checkColor   = null;      // color currently in check (for client)
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
      // Bots can carry their own difficulty (set by the room filler).
      botDifficulty: player.botDifficulty || null,
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
    const backRank = ['r','n','b','q','k','b','n','r'];
    for (let col = 0; col < 8; col++){
      this._board[`0,${col}`] = { color:'black', type:backRank[col], id:`b${backRank[col]}${col}` };
      this._board[`1,${col}`] = { color:'black', type:'p',           id:`bp${col}` };
      this._board[`6,${col}`] = { color:'white', type:'p',           id:`wp${col}` };
      this._board[`7,${col}`] = { color:'white', type:backRank[col], id:`w${backRank[col]}${col}` };
    }

    this._currentColor = 'white';
    this._moveHistory  = [];
    this._enPassant    = null;
    this._castling     = { white:{ k:true, q:true }, black:{ k:true, q:true } };
    this._halfmove     = 0;
    this._positions    = {};
    this._lastMove     = null;
    this._checkColor   = null;
    this._phase        = PHASE.PLAYING;

    // Fresh clocks for the configured time control.
    this._tc    = TIME_CONTROLS[this.settings.timeControl] || TIME_CONTROLS.RAPID_10;
    this._clock = { white:this._tc.initial, black:this._tc.initial };
    this._drawOffer = null;

    this._recordPosition();
    this.emit('chess:state', this.publicState());
    this._beginTurn();
    return { success:true };
  }

  /* ── move generation ───────────────────────────────────────────── */
  /** Every move `color` could make ignoring self-check. */
  _pseudoMoves(color, board = this._board, castling = this._castling, ep = this._enPassant){
    const out = [];
    for (const [key, piece] of Object.entries(board)){
      if (piece.color !== color) continue;
      const [r, c] = key.split(',').map(Number);

      const push = (tr, tc, extra) => {
        if (!inBounds(tr, tc)) return false;
        const target = board[`${tr},${tc}`];
        if (target && target.color === color) return false;      // own piece blocks
        out.push({ from:key, to:{ row:tr, col:tc }, piece:piece.type, captured: target ? `${tr},${tc}` : null, ...extra });
        return !target;                                          // can slide further only if empty
      };

      const slide = (dirs) => {
        for (const [dr, dc] of dirs){
          let tr = r + dr, tc = c + dc;
          while (push(tr, tc)){ tr += dr; tc += dc; }
        }
      };

      switch (piece.type){
        case 'p': {
          const dir      = color === 'white' ? -1 : 1;
          const startRow = color === 'white' ? 6 : 1;
          const promoRow = color === 'white' ? 0 : 7;
          const one = `${r + dir},${c}`;
          if (inBounds(r + dir, c) && !board[one]){
            const isPromo = (r + dir) === promoRow;
            out.push({ from:key, to:{ row:r+dir, col:c }, piece:'p', captured:null, promotion: isPromo ? 'q' : null });
            // double step only from the start row and only over empty squares
            const two = `${r + 2*dir},${c}`;
            if (r === startRow && !board[two]){
              out.push({ from:key, to:{ row:r+2*dir, col:c }, piece:'p', captured:null, double:true });
            }
          }
          for (const dc of [-1, 1]){
            const tr = r + dir, tc = c + dc;
            if (!inBounds(tr, tc)) continue;
            const targetKey = `${tr},${tc}`;
            const target    = board[targetKey];
            if (target && target.color !== color){
              const isPromo = tr === promoRow;
              out.push({ from:key, to:{ row:tr, col:tc }, piece:'p', captured:targetKey, promotion: isPromo ? 'q' : null });
            } else if (!target && ep === targetKey){
              // En passant — the captured pawn sits BESIDE us, not on the target.
              out.push({ from:key, to:{ row:tr, col:tc }, piece:'p', captured:`${r},${tc}`, enPassant:true });
            }
          }
          break;
        }
        case 'n':
          for (const [dr, dc] of KNIGHT_DELTAS) push(r + dr, c + dc);
          break;
        case 'b': slide(BISHOP_DIRS); break;
        case 'r': slide(ROOK_DIRS);   break;
        case 'q': slide(BISHOP_DIRS); slide(ROOK_DIRS); break;
        case 'k': {
          for (const [dr, dc] of KING_DELTAS) push(r + dr, c + dc);
          // Castling — legality (not moving through check) is verified in _legalMoves.
          const homeRow = color === 'white' ? 7 : 0;
          const rights  = castling[color] || {};
          if (r === homeRow && c === 4){
            if (rights.k && !board[`${homeRow},5`] && !board[`${homeRow},6`]
                && board[`${homeRow},7`]?.type === 'r' && board[`${homeRow},7`]?.color === color){
              out.push({ from:key, to:{ row:homeRow, col:6 }, piece:'k', captured:null, castle:'k' });
            }
            if (rights.q && !board[`${homeRow},3`] && !board[`${homeRow},2`] && !board[`${homeRow},1`]
                && board[`${homeRow},0`]?.type === 'r' && board[`${homeRow},0`]?.color === color){
              out.push({ from:key, to:{ row:homeRow, col:2 }, piece:'k', captured:null, castle:'q' });
            }
          }
          break;
        }
      }
    }
    return out;
  }

  /** Is (row,col) attacked by any `byColor` piece on `board`? */
  _isAttacked(row, col, byColor, board = this._board){
    // Pawns (attack toward their moving direction)
    const pawnDir = byColor === 'white' ? -1 : 1;
    for (const dc of [-1, 1]){
      const p = board[`${row - pawnDir},${col + dc}`];
      if (p && p.color === byColor && p.type === 'p') return true;
    }
    // Knights
    for (const [dr, dc] of KNIGHT_DELTAS){
      const p = board[`${row + dr},${col + dc}`];
      if (p && p.color === byColor && p.type === 'n') return true;
    }
    // King (adjacent)
    for (const [dr, dc] of KING_DELTAS){
      const p = board[`${row + dr},${col + dc}`];
      if (p && p.color === byColor && p.type === 'k') return true;
    }
    // Sliding pieces
    const rays = [
      { dirs: BISHOP_DIRS, types: ['b','q'] },
      { dirs: ROOK_DIRS,   types: ['r','q'] },
    ];
    for (const { dirs, types } of rays){
      for (const [dr, dc] of dirs){
        let tr = row + dr, tc = col + dc;
        while (inBounds(tr, tc)){
          const p = board[`${tr},${tc}`];
          if (p){
            if (p.color === byColor && types.includes(p.type)) return true;
            break;                                   // blocked
          }
          tr += dr; tc += dc;
        }
      }
    }
    return false;
  }

  _findKing(color, board = this._board){
    for (const [key, p] of Object.entries(board)){
      if (p.color === color && p.type === 'k') return key;
    }
    return null;
  }

  _inCheck(color, board = this._board){
    const k = this._findKing(color, board);
    if (!k) return false;
    const [r, c] = k.split(',').map(Number);
    return this._isAttacked(r, c, other(color), board);
  }

  /** Apply a move to a COPY of the board — used for legality testing and search. */
  _applyToBoard(board, move){
    const next = { ...board };
    const piece = { ...next[move.from] };
    delete next[move.from];
    if (move.captured) delete next[move.captured];
    if (move.promotion) piece.type = move.promotion;
    next[`${move.to.row},${move.to.col}`] = piece;
    if (move.castle){
      const homeRow = piece.color === 'white' ? 7 : 0;
      if (move.castle === 'k'){
        next[`${homeRow},5`] = next[`${homeRow},7`];
        delete next[`${homeRow},7`];
      } else {
        next[`${homeRow},3`] = next[`${homeRow},0`];
        delete next[`${homeRow},0`];
      }
    }
    return next;
  }

  /** Fully legal moves for `color` — pseudo moves minus self-check, plus
   *  castling squares verified as un-attacked. */
  _legalMoves(color, board = this._board, castling = this._castling, ep = this._enPassant){
    const pseudo = this._pseudoMoves(color, board, castling, ep);
    const legal  = [];
    for (const m of pseudo){
      if (m.castle){
        // King must not be in check, nor pass through / land on an attacked square.
        const homeRow = color === 'white' ? 7 : 0;
        const pathCols = m.castle === 'k' ? [4,5,6] : [4,3,2];
        let ok = true;
        for (const col of pathCols){
          if (this._isAttacked(homeRow, col, other(color), board)){ ok = false; break; }
        }
        if (!ok) continue;
      }
      const nextBoard = this._applyToBoard(board, m);
      if (!this._inCheck(color, nextBoard)) legal.push(m);
    }
    return legal;
  }

  /* ── making a move ─────────────────────────────────────────────── */
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
    const legal   = this._legalMoves(this._currentColor);
    // Match on from/to; promotion choice comes from the client when offered.
    const candidates = legal.filter(lm =>
      lm.from === fromKey && lm.to.row === move.to.row && lm.to.col === move.to.col);
    if (!candidates.length){
      return { success:false, reason: this._inCheck(this._currentColor) ? 'You are in check' : 'Illegal move' };
    }
    let match = candidates[0];
    if (match.promotion){
      const want = String(move.promotion || 'q').toLowerCase();
      match = { ...match, promotion: ['q','r','b','n'].includes(want) ? want : 'q' };
    }

    // ── charge the mover's clock, then hand it over (Fischer increment) ──
    if (this._tc.initial > 0 && this._turnStartedAt){
      const spent = Date.now() - this._turnStartedAt;
      this._clock[this._currentColor] = Math.max(0, this._clock[this._currentColor] - spent);
      if (this._clock[this._currentColor] <= 0){
        // Flagged mid-move — the flag timer may not have fired yet.
        this._handleFlag(this._currentColor);
        return { success:false, reason:'Out of time' };
      }
      this._clock[this._currentColor] += this._tc.increment;
    }

    const piece        = this._board[fromKey];
    const movedType    = piece.type;
    const wasCapture   = !!match.captured;
    // SAN needs the pre-move board to disambiguate, so compute it here.
    const sanPartial   = this._sanFor(match, piece);
    // Read the victim BEFORE the board mutates — the HUD's captured strip
    // needs its type, and after _applyToBoard it's gone.
    const capturedType = match.captured ? (this._board[match.captured]?.type || null) : null;

    // Apply to the real board.
    this._board = this._applyToBoard(this._board, match);

    // ── castling rights ──
    const rights = this._castling[this._currentColor];
    if (movedType === 'k'){ rights.k = false; rights.q = false; }
    if (movedType === 'r'){
      const homeRow = this._currentColor === 'white' ? 7 : 0;
      if (fromKey === `${homeRow},7`) rights.k = false;
      if (fromKey === `${homeRow},0`) rights.q = false;
    }
    // Capturing a rook on its home square kills that side's right too.
    if (match.captured){
      const oppHome = this._currentColor === 'white' ? 0 : 7;
      const opp     = this._castling[other(this._currentColor)];
      if (match.captured === `${oppHome},7`) opp.k = false;
      if (match.captured === `${oppHome},0`) opp.q = false;
    }

    // ── en passant square (only right after a double pawn step) ──
    this._enPassant = null;
    if (movedType === 'p' && Math.abs(move.to.row - move.from.row) === 2){
      const midRow = (move.to.row + move.from.row) / 2;
      this._enPassant = `${midRow},${move.to.col}`;
    }

    // ── halfmove clock (50-move rule) ──
    this._halfmove = (movedType === 'p' || wasCapture) ? 0 : this._halfmove + 1;

    this._currentColor = other(this._currentColor);
    this._lastMove     = { from: fromKey, to: `${move.to.row},${move.to.col}` };
    const givesCheck   = this._inCheck(this._currentColor);
    this._checkColor   = givesCheck ? this._currentColor : null;

    // Finish the SAN now that we know whether it gives check/mate.
    const noReply = this._legalMoves(this._currentColor).length === 0;
    const san = sanPartial + (givesCheck ? (noReply ? '#' : '+') : '');

    this._moveHistory.push({
      from: fromKey, to: `${move.to.row},${move.to.col}`,
      piece: movedType, captured: match.captured || null, capturedType,
      promotion: match.promotion || null, castle: match.castle || null,
      byColor: player.color, san,
      clock: this._tc.initial > 0 ? this._clock[player.color] : null,
    });
    this._recordPosition();
    // Any move silently withdraws a pending draw offer from the mover.
    if (this._drawOffer === player.color) this._drawOffer = null;

    this.emit('chess:move', {
      from:      fromKey,
      to:        `${move.to.row},${move.to.col}`,
      piece:     movedType,
      captured:  match.captured || null,
      promotion: match.promotion || null,
      castle:    match.castle || null,
      enPassant: !!match.enPassant,
      check:     givesCheck,
      nextColor: this._currentColor,
    });
    this.emit('chess:state', this.publicState());

    const over = this._checkGameOver();
    if (over){
      this._phase = PHASE.FINISHED;
      this._clearTimer();
      this._clearMatchTimer();
      this.emit('chess:match_over', {
        winnerColor: over.winner,
        reason:      over.reason,
        finalBoard:  { ...this._board },
      });
    } else {
      this._beginTurn();
    }
    return { success:true };
  }

  /** Standard algebraic notation for a move, computed BEFORE it is applied
   *  (disambiguation needs the original board). Check/mate suffix is added
   *  by the caller once the resulting position is known. */
  _sanFor(move, piece){
    const sq = (r, c) => 'abcdefgh'[c] + (8 - r);
    if (move.castle) return move.castle === 'k' ? 'O-O' : 'O-O-O';
    const [fr, fc] = move.from.split(',').map(Number);
    const dest     = sq(move.to.row, move.to.col);
    if (piece.type === 'p'){
      const body = move.captured ? `${'abcdefgh'[fc]}x${dest}` : dest;
      return body + (move.promotion ? '=' + move.promotion.toUpperCase() : '');
    }
    // Disambiguate against same-type pieces that could also reach the target.
    const rivals = this._legalMoves(piece.color).filter(m =>
      m.piece === piece.type && m.from !== move.from &&
      m.to.row === move.to.row && m.to.col === move.to.col);
    let hint = '';
    if (rivals.length){
      const sameFile = rivals.some(m => Number(m.from.split(',')[1]) === fc);
      const sameRank = rivals.some(m => Number(m.from.split(',')[0]) === fr);
      if (!sameFile)      hint = 'abcdefgh'[fc];
      else if (!sameRank) hint = String(8 - fr);
      else                hint = 'abcdefgh'[fc] + (8 - fr);
    }
    return piece.type.toUpperCase() + hint + (move.captured ? 'x' : '') + dest;
  }

  /** A compact position signature for threefold repetition. */
  _positionKey(){
    const squares = Object.keys(this._board).sort()
      .map(k => `${k}:${this._board[k].color[0]}${this._board[k].type}`).join('|');
    const cr = `${this._castling.white.k?'K':''}${this._castling.white.q?'Q':''}` +
               `${this._castling.black.k?'k':''}${this._castling.black.q?'q':''}`;
    return `${squares}#${this._currentColor}#${cr}#${this._enPassant || '-'}`;
  }

  _recordPosition(){
    const key = this._positionKey();
    this._positions[key] = (this._positions[key] || 0) + 1;
  }

  /** Only kings, or king+minor vs king → nobody can force mate. */
  _insufficientMaterial(){
    const pieces = Object.values(this._board);
    if (pieces.length > 4) return false;
    const nonKings = pieces.filter(p => p.type !== 'k');
    if (nonKings.length === 0) return true;                              // K vs K
    if (nonKings.length === 1 && ['n','b'].includes(nonKings[0].type)) return true;  // K+minor vs K
    if (nonKings.length === 2 && nonKings.every(p => p.type === 'b')){
      // K+B vs K+B — drawn only when both bishops share a square colour.
      const squares = Object.entries(this._board)
        .filter(([, p]) => p.type === 'b')
        .map(([k]) => { const [r,c] = k.split(',').map(Number); return (r + c) % 2; });
      if (squares.length === 2 && squares[0] === squares[1]) return true;
    }
    return false;
  }

  /** null when the game continues, else { winner, reason }. */
  _checkGameOver(){
    const moves = this._legalMoves(this._currentColor);
    if (moves.length === 0){
      if (this._inCheck(this._currentColor)){
        return { winner: other(this._currentColor), reason:'checkmate' };
      }
      return { winner: null, reason:'stalemate' };
    }
    if (this._insufficientMaterial()) return { winner: null, reason:'insufficient_material' };
    if (this._halfmove >= 100)        return { winner: null, reason:'fifty_move' };
    if ((this._positions[this._positionKey()] || 0) >= 3)
      return { winner: null, reason:'threefold_repetition' };
    return null;
  }

  /** Force the match to end (opponent quit, clock ran out). null = draw. */
  forceWin(winnerColor, reason = 'opponent_left'){
    if (this._phase === PHASE.FINISHED) return;
    this._phase = PHASE.FINISHED;
    this._clearTimer();
    this._clearMatchTimer();
    this.emit('chess:match_over', {
      winnerColor,
      reason,
      finalBoard: { ...this._board },
    });
  }

  _clearMatchTimer(){
    if (this._flagTimer){ clearTimeout(this._flagTimer); this._flagTimer = null; }
  }

  /** Live remaining time for a colour — the running side's clock counts down
   *  from the moment their turn began. */
  _remaining(color){
    if (this._tc.initial <= 0) return null;                 // no-clock mode
    let ms = this._clock[color];
    if (this._phase === PHASE.PLAYING && color === this._currentColor && this._turnStartedAt){
      ms -= (Date.now() - this._turnStartedAt);
    }
    return Math.max(0, ms);
  }

  _armFlagTimer(){
    if (this._flagTimer){ clearTimeout(this._flagTimer); this._flagTimer = null; }
    if (this._tc.initial <= 0) return;                      // unlimited
    const left = Math.max(0, this._clock[this._currentColor]);
    this._flagTimer = setTimeout(() => this._handleFlag(this._currentColor), left);
  }

  /** A player's clock hit zero. They lose — unless the opponent has no mating
   *  material, in which case FIDE scores it a draw. */
  _handleFlag(color){
    if (this._phase !== PHASE.PLAYING) return;
    if (color !== this._currentColor) return;               // stale timer
    this._clock[color] = 0;
    const opp = other(color);
    // Opponent can't possibly mate (bare king / K+minor) → draw, not a win.
    const oppPieces = Object.values(this._board).filter(p => p.color === opp && p.type !== 'k');
    const cantMate  = oppPieces.length === 0 ||
                      (oppPieces.length === 1 && ['n','b'].includes(oppPieces[0].type));
    this.forceWin(cantMate ? null : opp, cantMate ? 'timeout_vs_insufficient' : 'timeout');
  }

  /* ── draw offers ───────────────────────────────────────────────── */
  offerDraw(playerId){
    if (this._phase !== PHASE.PLAYING) return { success:false, reason:'Not playing' };
    const p = this._players.find(x => x.id === playerId);
    if (!p) return { success:false, reason:'Not a player' };
    if (this._drawOffer === p.color) return { success:false, reason:'Offer already pending' };
    // Accepting by offering back is the natural shortcut.
    if (this._drawOffer && this._drawOffer !== p.color){
      this.forceWin(null, 'agreement');
      return { success:true, agreed:true };
    }
    this._drawOffer = p.color;
    this.emit('chess:draw_offer', { from: p.color });
    this.emit('chess:state', this.publicState());
    return { success:true };
  }

  respondDraw(playerId, accept){
    if (this._phase !== PHASE.PLAYING) return { success:false, reason:'Not playing' };
    const p = this._players.find(x => x.id === playerId);
    if (!p) return { success:false, reason:'Not a player' };
    if (!this._drawOffer || this._drawOffer === p.color)
      return { success:false, reason:'No offer to answer' };
    if (accept){
      this.forceWin(null, 'agreement');
      return { success:true, agreed:true };
    }
    this._drawOffer = null;
    this.emit('chess:draw_declined', { by: p.color });
    this.emit('chess:state', this.publicState());
    return { success:true };
  }

  /* ── turn loop ─────────────────────────────────────────────────── */
  _beginTurn(){
    this._clearTimer();
    if (this._phase !== PHASE.PLAYING) return;
    // Start the side-to-move's clock and arm a flag timer for exactly the
    // time they have left. Any move clears it and re-arms for the opponent.
    this._turnStartedAt = Date.now();
    this._armFlagTimer();
    this._turnEndsAt = this._tc.initial > 0
      ? this._turnStartedAt + this._clock[this._currentColor]
      : null;
    this.emit('chess:turn', {
      color: this._currentColor,
      endsAt: this._turnEndsAt,
      clock: { ...this._clock },
    });
    const cur = this._players.find(p => p.color === this._currentColor);
    if (cur && cur.isBot){
      const delay = this.settings.botDelay + Math.random() * 700;
      setTimeout(() => this._botPlay(cur), delay);
    }
  }

  /* ── bot ───────────────────────────────────────────────────────── */
  /** Static evaluation from WHITE's perspective (centipawns). */
  _evaluate(board){
    let score = 0;
    for (const [key, p] of Object.entries(board)){
      const [r, c] = key.split(',').map(Number);
      const val    = PIECE_VALUE[p.type] || 0;
      // PST is written from white's view; mirror the row for black.
      const table  = PST[p.type];
      const pst    = table ? (table[p.color === 'white' ? r : 7 - r]?.[c] || 0) : 0;
      score += (p.color === 'white' ? 1 : -1) * (val + pst);
    }
    return score;
  }

  /** Negamax with alpha-beta. Returns a score from `color`'s perspective. */
  _search(board, castling, ep, color, depth, alpha, beta){
    if (depth === 0){
      const s = this._evaluate(board);
      return color === 'white' ? s : -s;
    }
    const moves = this._legalMoves(color, board, castling, ep);
    if (!moves.length){
      // Mate is far worse than any material loss; stalemate is neutral.
      if (this._inCheck(color, board)) return -100000 - depth;
      return 0;
    }
    // Captures first — big alpha-beta win.
    moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));
    let best = -Infinity;
    for (const m of moves){
      const nextBoard = this._applyToBoard(board, m);
      // Castling rights/en-passant inside the search are approximated: we
      // disable further castling for the side that just moved and clear ep.
      const nextCastling = {
        white: { ...castling.white },
        black: { ...castling.black },
      };
      if (m.piece === 'k'){ nextCastling[color].k = false; nextCastling[color].q = false; }
      const score = -this._search(nextBoard, nextCastling, null, other(color), depth - 1, -beta, -alpha);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;                       // cutoff
    }
    return best;
  }

  _botPlay(bot){
    if (this._phase !== PHASE.PLAYING)    return;
    if (bot.color !== this._currentColor) return;
    const moves = this._legalMoves(this._currentColor);
    if (!moves.length) return;

    const level = bot.botDifficulty || this.settings.botDifficulty || 'medium';

    let chosen;
    if (level === 'easy'){
      // Mostly random, but still grabs a free capture about half the time.
      const caps = moves.filter(m => m.captured);
      chosen = (caps.length && Math.random() < 0.5)
        ? caps[Math.floor(Math.random() * caps.length)]
        : moves[Math.floor(Math.random() * moves.length)];
    } else {
      const depth = level === 'hard' ? 3 : 2;
      let best = -Infinity, bestMoves = [];
      for (const m of moves){
        const nextBoard = this._applyToBoard(this._board, m);
        const nextCastling = { white:{ ...this._castling.white }, black:{ ...this._castling.black } };
        if (m.piece === 'k'){ nextCastling[bot.color].k = false; nextCastling[bot.color].q = false; }
        const score = -this._search(nextBoard, nextCastling, null, other(bot.color), depth - 1, -Infinity, Infinity);
        if (score > best){ best = score; bestMoves = [m]; }
        else if (score === best) bestMoves.push(m);
      }
      chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)] || moves[0];
    }

    const [fr, fc] = chosen.from.split(',').map(Number);
    this.makeMove(bot.id, {
      from: { row: fr, col: fc },
      to:   chosen.to,
      promotion: chosen.promotion || 'q',
    });
  }

  _clearTimer(){
    if (this._turnTimer){ clearTimeout(this._turnTimer); this._turnTimer = null; }
  }

  /* ── public state ──────────────────────────────────────────────── */
  /** from-square -> [{row, col, captured, promotion, castle}] for the side to move,
   *  so the client can highlight destinations without re-implementing chess. */
  _legalMoveMap(){
    if (this._phase !== PHASE.PLAYING) return {};
    const map = {};
    for (const m of this._legalMoves(this._currentColor)){
      if (!map[m.from]) map[m.from] = [];
      map[m.from].push({
        row: m.to.row, col: m.to.col,
        captured: m.captured || null,
        promotion: m.promotion || null,
        castle: m.castle || null,
      });
    }
    return map;
  }

  /** Material still on the board, for the client's captured-pieces strip. */
  _material(){
    const out = { white:0, black:0 };
    for (const p of Object.values(this._board)){
      if (p.type === 'k') continue;
      out[p.color] += PIECE_VALUE[p.type] || 0;
    }
    return out;
  }

  publicState(){
    const board = {};
    for (const [k, p] of Object.entries(this._board || {})){
      board[k] = { color: p.color, type: p.type, id: p.id };
    }
    return {
      phase:        this._phase,
      players:      this._players.map(p => ({
        id: p.id, username: p.username, avatar: p.avatar,
        slot: p.slot, color: p.color, isBot: p.isBot,
        isHost: !!p.isHost,
        isConnected: p.isConnected !== false,
        handSize: 0,
      })),
      board,
      currentColor: this._currentColor,
      legalMoves:   this._legalMoveMap(),
      lastMove:     this._lastMove,
      checkColor:   this._checkColor,
      material:     this._material(),
      capturedBy:   this._capturedList(),
      turnEndsAt:   this._turnEndsAt,
      turnTimeout:  this.settings.turnTimeout,
      moveCount:    this._moveHistory.length,
      halfmove:     this._halfmove,
      // ── clocks + options ──
      timeControl:  { id:this._tc.id, label:this._tc.label, initial:this._tc.initial,
                      increment:this._tc.increment, cls:this._tc.cls },
      clock:        { white:this._remaining('white'), black:this._remaining('black') },
      turnStartedAt:this._turnStartedAt,
      drawOffer:    this._drawOffer,
      // Compact move list for the notation panel: [{n, white, black}]
      moves:        this._sanPairs(),
    };
  }

  /** Move history grouped into numbered pairs for the notation panel. */
  _sanPairs(){
    const rows = [];
    for (let i = 0; i < this._moveHistory.length; i += 2){
      rows.push({
        n:     (i / 2) + 1,
        white: this._moveHistory[i]?.san || '',
        black: this._moveHistory[i + 1]?.san || '',
      });
    }
    return rows;
  }

  /** Pieces each side has captured, derived from history (for the HUD). */
  _capturedList(){
    const out = { white:[], black:[] };
    for (const mv of this._moveHistory){
      if (!mv.captured || !mv.capturedType) continue;
      (mv.byColor === 'white' ? out.white : out.black).push(mv.capturedType);
    }
    return out;
  }

  get phase(){ return this._phase; }
  get players(){ return this._players; }
}

module.exports = { ChessManager, PHASE, TIME_CONTROLS };
