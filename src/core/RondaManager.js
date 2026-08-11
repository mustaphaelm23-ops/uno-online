/**
 * RondaManager.js — server-authoritative Moroccan Ronda engine (2v2).
 *
 * RULES (per user spec)
 * ─────────────────────
 *  • 40-card Spanish deck — 4 suits (oros / espadas / copas / bastos)
 *    × 10 ranks each (1-7 + 10-12). No 8 and no 9.
 *  • 4 players in two teams of two (seats 0+2 vs 1+3). Partners sit
 *    across from each other.
 *  • First team to 41 points wins.
 *
 *  DEAL
 *    • Start of each round: 4 cards face-up on the table + 3 cards to
 *      each of the 4 players.
 *    • After every player empties their hand, re-deal 3 cards each from
 *      the deck (no new table cards). Repeat until the deck is empty.
 *    • Turn order: CLOCKWISE (each player passes to the player on their
 *      right). The dealer plays LAST each cycle. Dealer rotates one seat
 *      each round.
 *
 *  CAPTURE
 *    • A played card matches a table card of the same RANK → both go
 *      to the capturing PLAYER's pile (counted toward their TEAM).
 *    • Plus: chain consecutive HIGHER ranks still on the table (the
 *      chain treats 7 → 10 as consecutive — no 8/9 in this deck).
 *    • Example: play a 6 onto {6,7,10,11,12} → capture all five.
 *    • No match → played card joins the table.
 *
 *  SPECIAL SCORING (per dealt hand — initial + every re-deal)
 *    • Ronda  — 2 cards of the same rank in your fresh hand → team +1
 *    • Tringa — 3 cards of the same rank in your fresh hand → team +5
 *    • Tringa beats Ronda — if an OPPOSING team's Tringa is the same
 *      rank as your team's Ronda, your Ronda is cancelled.
 *
 *  MESA (sweep)
 *    • Clearing the table with a capture → that capture's team +1.
 *
  *  CLOSING THE ROUND (the dealer's final play, deck + all hands empty)
 *    • Bare placement (no capture) → opposing team +5.
 *    • Captured/hit with a 1 (Ace) → opposing team +5.
 *    • Captured/hit with a 12 → the player's OWN team +5 (reward).
 *    • Any other clean capture (rank 2-11) → no adjustment.
 *
 *  END OF ROUND (deck empty + every hand empty)
 *    • Leftover table cards go to the player who made the LAST capture.
 *    • Per-team captured count > 20 → +1 per card over 20 (split is
 *      irrelevant; team A captured = sum of seats 0+2's piles).
 *    • New round dealt; dealer rotates one seat.
 *
 *  EMITTED EVENTS
 *    ronda:state         — full public snapshot (every change)
 *    ronda:turn          — { playerId, seat, endsAt }
 *    ronda:deal          — { handCycle, isInitial }
 *    ronda:specials      — { detections: [{playerId, team, type, rank, points}] }
 *    ronda:play          — { playerId, card, tableSnap }
 *    ronda:capture       — { playerId, team, playedCard, capturedCards, mesa }
 *    ronda:round_over    — { round, teamResults, lastCapturerId }
 *    ronda:match_over    — { winnerTeam, finalTeamScores, players }
 */
'use strict';

const EventEmitter = require('events');

const PHASE = Object.freeze({ LOBBY:'lobby', PLAYING:'playing', FINISHED:'finished' });

const SUITS = ['oros', 'espadas', 'copas', 'bastos'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const NEXT_RANK = Object.freeze({
  1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 10, 10: 11, 11: 12, 12: null,
});

const DEFAULT_SETTINGS = Object.freeze({
  targetScore:    41,
  // 12s per turn. The client draws a progress ring around the active
  // player's panel that fills over exactly this window; when it completes
  // the engine auto-plays a sensible move for them (see _onTurnTimeout).
  turnTimeout:    12_000,
  // Bot pace — slowed so humans can follow the play/capture animations
  // on the client (a fast bot would slap a card down before the prior
  // animation finished, which made the table feel chaotic).
  botDelay:       2_800,
  maxPlayers:     4,
  newRoundDelay:  5_000,
  // Time the client gets to animate the dealer-pick reveal before the
  // engine actually starts dealing cards.
  dealerPickDelay: 4_000,
  // Window per player to click their RONDA/TRINGA declaration button
  // after a deal cycle. Ronda undeclared in time → opponents +1.
  // Generous (30s) + no on-screen countdown — the button is meant to wait
  // for the player to PLAY a pair card, not to rush them on a clock.
  declareWindow:  30_000,
});

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

class RondaManager extends EventEmitter {
  constructor(roomId, settings = {}){
    super();
    this.roomId    = roomId;
    this.settings  = { ...DEFAULT_SETTINGS, ...settings };

    this._phase           = PHASE.LOBBY;
    this._players         = [];                  // up to 4
    this._teamScores      = [0, 0];              // [teamA, teamB]
    this._deck            = [];
    this._table           = [];
    this._currentPlayerId = null;
    this._lastCapturerId  = null;
    this._dealerSeat      = 0;
    this._round           = 0;
    this._handCycle       = 0;
    this._turnTimer       = null;
    this._botMoveTimer    = null;
    this._turnEndsAt      = null;
    this._roundTimer      = null;
  }

  /* ── seating ────────────────────────────────────────────────────── */
  addPlayer(player){
    if (this._players.length >= 4)                     return { success:false, reason:'Room full' };
    if (this._players.some(p => p.id === player.id))   return { success:false, reason:'Already seated' };
    const seat = this._players.length;                 // 0..3 in join order
    const team = seat % 2;                             // 0 = A (seats 0,2), 1 = B (seats 1,3)
    const seated = {
      id:          player.id,
      username:    player.username,
      avatar:      player.avatar || null,
      cardBackId:  player.cardBackId || 'cb_default',
      tableFelt:   player.tableFelt || null,
      isBot:       !!player.isBot,
      isHost:      !!player.isHost,
      isConnected: true,
      status:      'active',
      abandoned:   false,
      saidUno:     false,
      handSize:    0,
      seat,
      team,
      hand:        [],
      captured:    [],
      rondas:      [],
      tringas:     [],
      mesas:       0,
      setConnected(socketId){ this.socketId = socketId; this.isConnected = true; this.status = 'active'; },
      setDisconnected(){ this.isConnected = false; this.status = 'disconnected'; },
      toPublicJSON(){
        return {
          id: this.id, username: this.username, avatar: this.avatar,
          isBot: this.isBot, isHost: this.isHost,
          isConnected: this.isConnected, status: this.status,
          seat: this.seat, team: this.team,
          handSize: this.hand.length,
          capturedCount: this.captured.length,
          rondas: this.rondas, tringas: this.tringas, mesas: this.mesas,
          abandoned: this.abandoned,
        };
      },
    };
    this._players.push(seated);
    return { success:true, seat, team };
  }

  removePlayer(playerId){
    const i = this._players.findIndex(p => p.id === playerId);
    if (i === -1) return false;
    this._players.splice(i, 1);
    // Re-index seats/teams so the array stays {0,1,2,3} contiguous.
    this._players.forEach((p, idx) => { p.seat = idx; p.team = idx % 2; });
    return true;
  }

  /* ── start ──────────────────────────────────────────────────────── */
  startGame(){
    if (this._players.length !== 4)
      return { success:false, reason:`Need 4 players (have ${this._players.length})` };
    this._phase       = PHASE.PLAYING;
    this._teamScores  = [0, 0];
    this._round       = 0;
    // Initial dealer is decided by a "lowest card wins" mini-draw. The
    // result is emitted to the client so it can show the reveal
    // animation. After the reveal delay, the real round begins.
    const pick = this._pickInitialDealer();
    this._dealerSeat = pick.dealerSeat;
    this.emit('ronda:dealer_pick', pick);
    this.emit('ronda:state', this.publicState());
    setTimeout(() => {
      if (this._phase !== PHASE.PLAYING) return;     // forfeit/abort guard
      this._dealRound();
      this.emit('ronda:state', this.publicState());
      this._beginTurn();
    }, this.settings.dealerPickDelay);
    return { success:true };
  }

  /** Decide the first dealer by drawing one random rank per player.
   *  Lowest rank wins. On a tie, redraw ONLY for the tied seats; repeat
   *  until a single winner emerges. Returns { rounds, dealerSeat }
   *  where `rounds` is the sequence of draws so the client can animate
   *  the reveal (one round per tie-break iteration). */
  _pickInitialDealer(){
    let candidates = this._players.map(p => p.seat);
    const rounds = [];
    let guard = 0;
    while (candidates.length > 1 && guard++ < 30){
      const picks = candidates.map(seat => ({
        seat,
        rank: RANKS[Math.floor(Math.random() * RANKS.length)],
      }));
      rounds.push(picks);
      const minRank = Math.min(...picks.map(p => p.rank));
      candidates = picks.filter(p => p.rank === minRank).map(p => p.seat);
    }
    return { rounds, dealerSeat: candidates[0] };
  }

  /* Force the match to end. Used when one team has nobody left
   * (both partners abandoned). Idempotent. */
  forceWin(winnerTeam, reason = 'opponent_left'){
    if (this._phase === PHASE.FINISHED) return;
    this._phase = PHASE.FINISHED;
    this._clearTimers();
    this.emit('ronda:match_over', {
      winnerTeam,
      reason,
      finalTeamScores: [...this._teamScores],
      players: this._players.map(p => ({ id:p.id, seat:p.seat, team:p.team })),
    });
  }

  /* ── deck + dealing ─────────────────────────────────────────────── */
  _buildDeck(){
    const deck = [];
    for (const suit of SUITS){
      for (const rank of RANKS){
        deck.push({
          id:   `${suit}-${String(rank).padStart(2, '0')}`,
          suit, rank,
        });
      }
    }
    return shuffle(deck);
  }

  _dealRound(){
    this._deck           = this._buildDeck();
    this._table          = [];
    this._pending        = null;                // no derba carry-over
    this._lastPlay       = null;                // no consecutive-rank carry-over
    this._lastCapturerId = null;
    this._round         += 1;
    this._handCycle      = 0;
    for (const p of this._players){
      p.hand     = [];
      p.captured = [];
      p.rondas   = [];
      p.tringas  = [];
      p.mesas    = 0;
    }
    // Round-opening deal: 4 cards to each player, NO face-up table
    // cards. Per the user's spec — the dealer hands out 4×4 = 16 cards.
    // The two re-deals within the round will be 3×4 = 12 each
    // (16 + 12 + 12 = 40, the full Spanish deck).
    this._dealHand(true);
    // Turn order flows CLOCKWISE (to the right): each player passes to
    // the player on their right (seat - 1). The dealer plays LAST in the
    // cycle, so the starting player is the one whose turn lands the
    // dealer on the final play → startSeat = dealerSeat + 3 (= -1).
    const startSeat = (this._dealerSeat + 3) % 4;
    this._currentPlayerId = this._players[startSeat].id;
  }

  /** Deal one "hand cycle" — `isInitial` means the round-opener
   *  (4 cards/player), otherwise it's a mid-round re-deal (3/player).
   *  Resolves any pending declarations from the PREVIOUS cycle before
   *  opening a new declaration window for the freshly-dealt cards. */
  _dealHand(isInitial){
    // Settle the previous cycle's Ronda/Tringa scoring before starting
    // the new one so each cycle has a clean window.
    if (this._declareWindow) this._resolveDeclarations();

    // A derba/chain may ONLY form from consecutive plays WITHIN the same
    // dealt cards — never across a re-deal. Settle any still-open pending
    // (defensive — it's normally settled at cycle-end already) so its cards
    // aren't lost, then clear the "last play" marker so a freshly-dealt card
    // can't link back to the previous cycle's final play and (wrongly)
    // start/extend a derba on the next tfri9a.
    if (this._pending){
      const lingering = this._settlePending();
      if (lingering) this.emit('ronda:chain_settled', lingering);
    }
    this._lastPlay = null;

    this._handCycle += 1;
    const perPlayer = isInitial ? 4 : 3;
    for (let i = 0; i < perPlayer; i++){
      for (const p of this._players){
        if (this._deck.length === 0) break;
        p.hand.push(this._deck.pop());
      }
    }
    this.emit('ronda:deal', { handCycle: this._handCycle, isInitial: !!isInitial });
    this._detectSpecials();
  }

  /** Detect Rondas (2-of-a-kind) + Tringas (3-of-a-kind) per player.
   *  Instead of auto-scoring, we OFFER each player a declaration
   *  window: a small button next to their cards lets them claim the
   *  Ronda / Tringa within `settings.declareWindow` ms. After the
   *  timeout:
   *    - Undeclared RONDA  → opposing TEAM gets +1 (penalty)
   *    - Undeclared TRINGA → no penalty, no bonus (lost opportunity)
   *  Declared:
   *    - RONDA  → no points, but the call is visible to opponents
   *    - TRINGA → declarer's team +1 */
  /** Detect candidates per player from the freshly-dealt hand:
   *    TRINGA   → 3 (or 4) of one rank
   *    RONDA x2 → 2 pairs at distinct ranks
   *    RONDA    → exactly one pair
   *  Per the v4 spec the declaration button has NO 10-second timer —
   *  it stays visible until the player either:
   *    (a) clicks it to claim the win + publicize,
   *    (b) plays one of the cards that formed the pair (the candidate
   *        is silently retired, the player loses the right to win), or
   *    (c) the hand cycle ends.
   *  Undeclared candidates STILL count in the Ronda pool at resolution
   *  time — they just can't be the winner. */
  _detectSpecials(){
    const candidates = this._computeCandidates();
    const endsAt = Date.now() + (this.settings.declareWindow || 10_000);
    this._declareWindow = {
      handCycle:  this._handCycle,
      candidates,
      declared:   new Map(),
      closed:     false,
      endsAt,
    };
    // Hard 10s expiry — when the timer fires the window closes (buttons
    // disappear on the client) but the candidate data is preserved so
    // end-of-cycle resolution still credits / penalises correctly.
    clearTimeout(this._declareTimer);
    if (candidates.length){
      this._declareTimer = setTimeout(() => {
        if (this._declareWindow && this._declareWindow.handCycle === this._handCycle){
          this._declareWindow.closed = true;
          this.emit('ronda:declare_window_closed');
          this.emit('ronda:state', this.publicState());
        }
      }, this.settings.declareWindow || 10_000);
      this.emit('ronda:declare_window', {
        handCycle:  this._handCycle,
        candidates,
        endsAt,
      });
      // Bots declare their ronda / tringa just like a real player would — after
      // a short, human-like pause inside the window — so they're
      // indistinguishable from humans (and don't silently forfeit the bonus).
      const cycle = this._handCycle;
      for (const cand of candidates){
        const pl = this._players.find(p => p.id === cand.playerId);
        if (!pl || !pl.isBot) continue;
        const delay = 800 + Math.floor(Math.random() * 2600);   // 0.8–3.4s
        setTimeout(() => {
          try{
            const w = this._declareWindow;
            if (w && !w.closed && w.handCycle === cycle && this._handCycle === cycle
                && !w.declared.has(cand.playerId)){
              this.declare(cand.playerId, cand.type);
            }
          }catch(e){ try{ console.error('[Ronda] bot declare error:', e?.message); }catch(_){} }
        }, delay);
      }
    }
  }

  /** Pure helper — scan every player's hand and return the live list
   *  of declaration candidates. Used at deal time AND after every
   *  play to refresh which buttons are still showable. */
  _computeCandidates(){
    const out = [];
    for (const p of this._players){
      const counts = {};
      for (const c of p.hand) counts[c.rank] = (counts[c.rank] || 0) + 1;
      let tringaRank = null;
      const pairRanks = [];
      for (const [rankStr, n] of Object.entries(counts)){
        const rank = Number(rankStr);
        if (n >= 3) tringaRank = rank;
        else if (n === 2) pairRanks.push(rank);
      }
      if (tringaRank !== null){
        out.push({ playerId:p.id, team:p.team, type:'tringa', rank: tringaRank });
      } else if (pairRanks.length >= 2){
        const sorted = pairRanks.slice().sort((a, b) => b - a);
        out.push({
          playerId:p.id, team:p.team, type:'ronda_x2',
          rank: sorted[0], secondRank: sorted[1],
        });
      } else if (pairRanks.length === 1){
        out.push({ playerId:p.id, team:p.team, type:'ronda', rank: pairRanks[0] });
      }
    }
    return out;
  }

  /** Refresh the window's candidate list after a play. Once a player
   *  has played one of the cards from their pair, their candidate is
   *  silently retired (the BUTTON drops); any prior declaration they
   *  made is preserved. */
  _refreshDeclareCandidates(){
    if (!this._declareWindow) return;
    const live = this._computeCandidates();
    // Build a lookup of "still has the same candidate" per player.
    const liveByPid = new Map(live.map(c => [c.playerId, c]));
    this._declareWindow.candidates = this._declareWindow.candidates.filter(orig => {
      // If we already declared, keep the candidate so the resolution
      // step can still find it.
      if (this._declareWindow.declared.has(orig.playerId)) return true;
      const cur = liveByPid.get(orig.playerId);
      // Same type + same primary rank means the pair is still intact.
      return cur && cur.type === orig.type && cur.rank === orig.rank;
    });
  }

  /** A player taps their RONDA / RONDA x2 / TRINGA button. Records the
   *  declaration — actual scoring is deferred to the end of the current
   *  hand cycle (winner-takes-all + Tringa beats Ronda). */
  declare(playerId, type /*, rank — ignored, derived from candidates */){
    if (!this._declareWindow) return { success:false, reason:'No declaration window open' };
    if (this._declareWindow.closed)  return { success:false, reason:'Window closed' };
    const candidate = this._declareWindow.candidates.find(c =>
      c.playerId === playerId && c.type === type
    );
    if (!candidate) return { success:false, reason:'You have no such declaration' };
    if (this._declareWindow.declared.has(playerId)){
      return { success:false, reason:'Already declared' };
    }
    this._declareWindow.declared.set(playerId, {
      playerId,
      team:        candidate.team,
      type:        candidate.type,
      rank:        candidate.rank,
      secondRank:  candidate.secondRank,
    });
    const player = this._players.find(p => p.id === playerId);
    if (player){
      if (candidate.type === 'tringa') player.tringas.push({ rank: candidate.rank });
      else                              player.rondas.push({ rank: candidate.rank });
    }
    // Publicize — but DO NOT score yet. Scoring runs at hand-cycle end.
    this.emit('ronda:declared', { playerId, team: candidate.team, type: candidate.type, rank: candidate.rank });
    this.emit('ronda:state', this.publicState());
    return { success:true };
  }

  /* Legacy no-op — the declaration window no longer expires on a
   * timer (v4 spec: stays open until the candidate's pair gets played
   * or the cycle ends). Kept callable so old callsites don't blow up. */
  _closeDeclareWindow(){}

  /** Resolve at end of hand cycle. v4 rules:
   *    - ALL candidates (declared OR undeclared) count toward the pool
   *      so the winner takes everyone's value, declared or not.
   *    - Only DECLARED candidates can win — undeclared = forfeited claim.
   *    - Solo-undeclared Ronda: the lone-Ronda holder didn't tell anyone,
   *      so the opposing team is awarded the penalty +1.
   *    - Ronda contributes 1 unit, Ronda x2 = 2, Tringa = 5.
   *    - Among declared: any Tringa wins (highest rank). Else multiple
   *      Rondas → highest rank wins. Else a single declared one wins.
   */
  _resolveDeclarations(){
    const dw = this._declareWindow;
    if (!dw) return null;
    this._declareWindow = null;

    // ── Declaration rules (per user spec) ──
    //  • ONLY players who actually CLICKED their RONDA / TRINGA button count.
    //    A pair held but not declared is FORFEITED — it scores nothing for
    //    anyone, even if it's the only / biggest one. No opponent penalty.
    //  • All declared RONDAs are pooled; the player with the BIGGEST rank
    //    RONDA takes the WHOLE pool for their team.
    //  • A declared TRINGA beats every RONDA and takes 5 + the whole RONDA
    //    pool. Each declared TRINGA adds another 5 to the pot.
    //  • If two players both declared TRINGA (very rare — necessarily of
    //    different ranks), the SMALLEST rank TRINGA takes the total.
    const declared = Array.from(dw.declared.values());
    if (!declared.length) return null;     // nobody claimed → nothing happens

    const unitsOf = (d) => d.type === 'ronda_x2' ? 2 : 1;   // ronda pool units
    const isRonda = (d) => d.type === 'ronda' || d.type === 'ronda_x2';

    const dRondas   = declared.filter(isRonda);
    const dTringas  = declared.filter(c => c.type === 'tringa');
    const rondaPool = dRondas.reduce((s, c) => s + unitsOf(c), 0);

    let winner = null;
    let points = 0;
    if (dTringas.length){
      // TRINGA beats RONDA. The lone-tringa case is trivially "the tringa";
      // the rare two-tringa case awards to the SMALLEST rank.
      winner = dTringas.slice().sort((a, b) => a.rank - b.rank)[0];
      points = dTringas.length * 5 + rondaPool;
    } else {
      // Biggest declared RONDA takes the whole pool.
      winner = dRondas.slice().sort((a, b) => b.rank - a.rank)[0];
      points = rondaPool;
    }
    if (!winner) return null;
    this._teamScores[winner.team] += points;

    const payload = {
      handCycle: dw.handCycle,
      type:      'resolved',
      winner:    { playerId: winner.playerId, team: winner.team, type: winner.type, rank: winner.rank },
      points,
      rondaPool,
      declared:  declared.map(d => ({ playerId:d.playerId, team:d.team, type:d.type, rank:d.rank, secondRank:d.secondRank })),
    };
    this.emit('ronda:declarations_resolved', payload);
    this.emit('ronda:state', this.publicState());
    return payload;
  }

  /** Derba bonus for a given chain length. */
  _derbaBonus(chainLength){
    if (chainLength <= 1) return 1;
    if (chainLength === 2) return 5;
    return 10;
  }

  /** Move the current pending pile into its claimer's captured stack.
   *  v4: the bonus was already paid out when the chain formed /
   *  extended, so settlement just transfers cards (no extra score). */
  _settlePending(){
    const p = this._pending;
    if (!p) return null;
    this._pending = null;
    const claimer = this._players.find(pl => pl.id === p.claimerId);
    if (!claimer) return null;
    claimer.captured.push(...p.cards);
    // Pay the WHOLE reward now, ONCE, to the final collector (deferred from
    // when the chain formed/extended): the darba bonus by chain length + the
    // missa (+1) if the chain's capture had cleared the table. This is what
    // makes the points appear only AFTER the last player has played.
    const darba = this._derbaBonus(p.chainLength);
    this._teamScores[claimer.team] += darba;
    if (p.mesa){
      this._teamScores[claimer.team] += 1;
      claimer.mesas += 1;
    }
    return {
      playerId:    claimer.id,
      team:        claimer.team,
      chainRank:   p.chainRank,
      chainLength: p.chainLength,
      bonus:       darba + (p.mesa ? 1 : 0),
      mesa:        !!p.mesa,
      cards:       [...p.cards],
    };
  }

  /* ── capture chain ─────────────────────────────────────────────── */
  _findCaptureChain(card){
    const match = this._table.find(c => c.rank === card.rank);
    if (!match) return [];
    const out = [match];
    let nr = NEXT_RANK[card.rank];
    while (nr != null){
      const nx = this._table.find(c => c.rank === nr && !out.includes(c));
      if (!nx) break;
      out.push(nx);
      nr = NEXT_RANK[nr];
    }
    return out;
  }

  /* ── turn loop ─────────────────────────────────────────────────── */
  _beginTurn(){
    this._clearTurnTimer();
    if (this._phase !== PHASE.PLAYING) return;
    this._turnEndsAt = Date.now() + this.settings.turnTimeout;
    // Safety net: if the player on the clock (bot OR a stalled human) hasn't
    // moved by the timeout, the engine plays/recovers for them — the table can
    // NEVER freeze on someone's turn.
    this._turnTimer  = setTimeout(() => this._onTurnTimeout(), this.settings.turnTimeout);
    const cur = this._players.find(p => p.id === this._currentPlayerId);
    this.emit('ronda:turn', { playerId: this._currentPlayerId, seat: cur?.seat ?? -1, endsAt: this._turnEndsAt });
    if (cur && cur.isBot){
      const delay = this.settings.botDelay + Math.random() * 1_500;
      this._botMoveTimer = setTimeout(() => this._botTakeTurn(cur), delay);
    }
  }

  // A bot's scheduled move. Fully guarded: any thrown error or rejected move
  // falls back to trying every other card, then to a forced recovery — a bot
  // can never leave the table deadlocked.
  _botTakeTurn(bot){
    this._botMoveTimer = null;
    if (this._phase !== PHASE.PLAYING || this._currentPlayerId !== bot.id) return;
    try{
      if (this._playBestOrAnyCard(bot)) return;
    }catch(e){
      try{ console.error('[Ronda] bot move error:', e?.message); }catch(_){}
    }
    this._recoverStuckTurn(bot);
  }

  // Turn timeout — the ultimate backstop. Plays a sensible move for whoever is
  // on the clock (bot, or a disconnected/idle human) and, if that somehow
  // fails, force-recovers so the round always advances.
  _onTurnTimeout(){
    this._turnTimer = null;
    if (this._phase !== PHASE.PLAYING) return;
    const cur = this._players.find(p => p.id === this._currentPlayerId);
    if (!cur) return;
    try{
      if (cur.hand.length && this._playBestOrAnyCard(cur)) return;
    }catch(e){
      try{ console.error('[Ronda] turn-timeout error:', e?.message); }catch(_){}
    }
    this._recoverStuckTurn(cur);
  }

  // Try the SMART move first (best capture chain, else lowest card); if
  // makeMove rejects OR throws for that card, fall back to trying every other
  // card in hand. Returns true the moment a card is accepted.
  _playBestOrAnyCard(player){
    if (!player || !player.hand.length) return false;
    const ranked = player.hand
      .map(card => ({ card, chain: this._findCaptureChain(card).length }))
      .sort((a, b) => (b.chain - a.chain) || (a.card.rank - b.card.rank));
    for (const { card } of ranked){
      try{
        const res = this.makeMove(player.id, card.id);
        if (res && res.success) return true;
      }catch(e){
        try{ console.error('[Ronda] makeMove threw for card', card.id, '-', e?.message); }catch(_){}
        // keep trying the next card
      }
    }
    return false;
  }

  // Absolute last resort (should never run): no card could be played. Discard
  // one card to the felt without scoring and pass the turn so the game cannot
  // deadlock. Mirrors makeMove's end-of-hand handling so a re-deal / round end
  // still fires correctly.
  _recoverStuckTurn(player){
    if (this._phase !== PHASE.PLAYING || this._currentPlayerId !== player.id) return;
    try{ console.error('[Ronda] WATCHDOG force-recover — seat', player.seat); }catch(_){}
    if (player.hand.length){
      const card = player.hand.shift();
      this._table.push(card);
      this._lastPlay = { playerId: player.id, rank: card.rank, wasCapture: false };
      this.emit('ronda:play', { playerId: player.id, card, tableSnap: [...this._table] });
    }
    const allHandsEmpty = this._players.every(p => p.hand.length === 0);
    if (allHandsEmpty){
      if (this._deck.length === 0){ this._clearTurnTimer(); this._endRound(); return; }
      this._dealHand(false);
    }
    const nextSeat = (player.seat + 3) % 4;
    this._currentPlayerId = this._players[nextSeat].id;
    this.emit('ronda:state', this.publicState());
    this._beginTurn();
  }

  _clearTurnTimer(){
    if (this._turnTimer){ clearTimeout(this._turnTimer); this._turnTimer = null; }
    if (this._botMoveTimer){ clearTimeout(this._botMoveTimer); this._botMoveTimer = null; }
  }
  _clearTimers(){
    this._clearTurnTimer();
    if (this._roundTimer){ clearTimeout(this._roundTimer); this._roundTimer = null; }
    if (this._declareTimer){ clearTimeout(this._declareTimer); this._declareTimer = null; }
  }

  /* ── play one card ─────────────────────────────────────────────── */
  makeMove(playerId, cardId){
    if (this._phase !== PHASE.PLAYING)        return { success:false, reason:'Not playing' };
    if (this._currentPlayerId !== playerId)   return { success:false, reason:'Not your turn' };
    const player = this._players.find(p => p.id === playerId);
    if (!player)                              return { success:false, reason:'Not a player' };
    const idx = player.hand.findIndex(c => c.id === cardId);
    if (idx === -1)                           return { success:false, reason:'Card not in hand' };
    const card = player.hand.splice(idx, 1)[0];

    /* ── DERBA (chain capture, v4) ───────────────────────────────
     *  Derba ONLY triggers when the captured card was JUST laid down
     *  by the previous player (non-capturing play). A capture against
     *  a card that was already sitting on the table from an earlier
     *  cycle is a NORMAL capture — cards go straight to the pile, no
     *  pending, no bonus.
     *
     *  Bonus is paid IMMEDIATELY when the chain forms / extends so the
     *  scoreboard updates the moment the player taps the card:
     *      chain 1  → claimer team +1
     *      chain 2  → swap: -1 from old claimer, +5 to new claimer
     *      chain 3  → swap: -5 from old claimer, +10 to new claimer
     *  When the chain ENDS (next player doesn't match), the claimer
     *  just takes the cards — no extra payout (already paid).
     */
    let mesa = false;
    let chainExtended = false;
    let chainSettled  = null;
    const pending = this._pending;
    const lp      = this._lastPlay;   // { playerId, rank, wasCapture }

    // (a) Chain extension — current play matches the pending rank.
    // Refund the old bonus from the previous claimer's team, then
    // award the new bonus to the current player's team.
    if (pending && card.rank === pending.chainRank){
      // Chain extension — the pile (and its eventual darba + missa points)
      // now belongs to THIS player. NOTHING is scored yet: the whole reward
      // is paid once, to the FINAL collector, when the chain settles — so the
      // scoreboard never flickers before we know who ends the chain.
      pending.cards.push(card);
      pending.claimerId   = playerId;
      pending.team        = player.team;
      pending.chainLength = Math.min(pending.chainLength + 1, 3);
      this._lastCapturerId = playerId;
      chainExtended = true;
      this.emit('ronda:chain_extend', {
        playerId,
        team:          player.team,
        rank:          card.rank,
        chainLength:   pending.chainLength,
        pendingCount:  pending.cards.length,
      });
    } else {
      // (b) Settle the previous pending pile if it exists (cards to
      //     claimer, no extra bonus — already paid).
      if (pending){
        chainSettled = this._settlePending();
      }
      // Resolve THIS card against the real table.
      const captured = this._findCaptureChain(card);
      if (captured.length){
        for (const c of captured){
          const i = this._table.indexOf(c);
          if (i !== -1) this._table.splice(i, 1);
        }
        // Derba check: did the previous player JUST lay a non-captured
        // card of the same rank? Only then does this capture form a
        // pending pile + earn the derba bonus.
        const triggersDerba = lp && !lp.wasCapture && lp.rank === card.rank;
        const clearedTable  = this._table.length === 0;   // MESA when true
        if (triggersDerba){
          // Open a derba pending pile. The darba bonus AND the missa (if this
          // capture cleared the table) ride WITH the pile and are paid ONCE,
          // at settle, to whoever ENDS the chain — never mid-chain. So the
          // points appear only after the last player has had their turn.
          this._pending = {
            claimerId:   playerId,
            team:        player.team,
            chainRank:   card.rank,
            chainLength: 1,
            cards:       [card, ...captured],
            mesa:        clearedTable,
          };
          // (no score yet — deferred to _settlePending)
        } else {
          // Normal (non-chain) capture — cards go straight to the pile. A
          // table-clearing capture scores its missa right away since there's
          // no pending pile to defer it into.
          player.captured.push(card, ...captured);
          if (clearedTable){
            this._teamScores[player.team] += 1;
            player.mesas += 1;
            mesa = true;
          }
        }
        this._lastCapturerId = playerId;
        this.emit('ronda:capture', {
          playerId,
          team:           player.team,
          playedCard:     card,
          capturedCards:  captured,
          mesa,
          isDerba:        triggersDerba,
          tableSnap:      [...this._table],
        });
      } else {
        // Just place card on table — no capture.
        this._table.push(card);
        this.emit('ronda:play', { playerId, card, tableSnap: [...this._table] });
      }
    }

    // Remember this play so the NEXT player's makeMove can detect a
    // consecutive same-rank derba. wasCapture = the card didn't end
    // up sitting on the table (either captured into pending OR went
    // straight to the pile).
    const cardOnTable = this._table.some(c => c.id === card.id);
    this._lastPlay = { playerId, rank: card.rank, wasCapture: !cardOnTable };

    if (chainSettled){
      this.emit('ronda:chain_settled', chainSettled);
    }

    // Refresh declaration candidates — playing one of your pair cards
    // silently drops your RONDA/TRINGA button.
    this._refreshDeclareCandidates();

    /* ── DEALER END-OF-ROUND PENALTY ──────────────────────────────
     *  The dealer plays LAST every cycle (turn order = dealer+1 ...
     *  dealer). On the FINAL play of the round — dealer's last card,
     *  no more cards to deal — TWO situations cost the dealer's team
     *  5 points to the opposition:
     *
     *    (a) Bare placement — card just sits on the felt, no capture,
     *        no derba. Reason: 'dealer_idle_last_card'.
     *
     *    (b) Final card is rank 1 (Ace). Even if the Ace captures /
     *        sweeps the table, the dealer's team still loses 5 points
     *        to the opposition for closing the round on an Ace. The
     *        captured cards still go into the dealer's pile normally
     *        — only the 5-point penalty is added.
     *        Reason: 'dealer_ace_last_card'.
     *
     *  Anything else (capture with rank > 1, derba with rank > 1) is
     *  a clean finish and costs nothing. */
    const allHandsEmpty = this._players.every(p => p.hand.length === 0);
    const wasFinalDealerPlay = player.seat === this._dealerSeat
                            && allHandsEmpty
                            && this._deck.length === 0;
    const wasPlacement = !!this._table.find(c => c.id === card.id);
    if (wasFinalDealerPlay){
      const oppTeam = 1 - player.team;
      if (wasPlacement){
        // (a) Bare placement — didn't eat/hit with the last card → opp +5.
        this._teamScores[oppTeam] += 5;
        this.emit('ronda:dealer_penalty', {
          playerId, team: player.team, awardedTo: oppTeam, points: 5,
          reason: 'dealer_idle_last_card',
        });
      } else if (card.rank === 1){
        // (b) Captured but on an Ace — penalty regardless → opp +5.
        this._teamScores[oppTeam] += 5;
        this.emit('ronda:dealer_penalty', {
          playerId, team: player.team, awardedTo: oppTeam, points: 5,
          reason: 'dealer_ace_last_card',
        });
      } else if (card.rank === 12){
        // (c) NEW RULE — closed the round by capturing (eating / hitting)
        //     with a 12 → that player's OWN team is REWARDED +5.
        this._teamScores[player.team] += 5;
        this.emit('ronda:closing_bonus', {
          playerId, team: player.team, awardedTo: player.team, points: 5,
          reason: 'closing_twelve', rank: 12,
        });
      }
      // else (capture with rank 2-11) → clean finish, no adjustment.
    }

    if (this._teamScores.some(s => s >= this.settings.targetScore)){
      this._clearTurnTimer();
      this._endMatch();
      return { success:true };
    }

    // End-of-hand / end-of-round logic.
    if (allHandsEmpty){
      // A cycle just ended (everyone is out of cards). Settle any OPEN
      // derba pending RIGHT NOW — on the last card it counts as a finished
      // darba and the cards go straight into the collector's pile. They
      // must NOT linger on the table waiting for the next deal to (illegally)
      // steal them across the cycle boundary.
      if (this._pending){
        const settledEnd = this._settlePending();
        if (settledEnd) this.emit('ronda:chain_settled', settledEnd);
      }
      if (this._deck.length >= 12){           // need 12 to refill all 4 hands
        this._dealHand(false);
      } else if (this._deck.length === 0){
        this._clearTurnTimer();
        this._endRound();
        return { success:true };
      } else {
        // Defensive: not enough for a full re-deal — give what's left.
        this._dealHand(false);
      }
    }

    // Next player — CLOCKWISE (to the right). Each turn passes to the
    // seat on the player's right (seat - 1, i.e. +3 mod 4).
    const curSeat = player.seat;
    const nextSeat = (curSeat + 3) % 4;
    this._currentPlayerId = this._players[nextSeat].id;
    this.emit('ronda:state', this.publicState());
    this._beginTurn();
    return { success:true };
  }

  /* ── round / match end ─────────────────────────────────────────── */
  _endRound(){
    // Freeze the turn loop during the round→round transition: clear any pending
    // turn/bot timers and drop the current-player pointer so a stray bot move
    // or turn-timeout callback can't fire on a now-empty hand before the next
    // round is dealt. (Without this, an already-queued bot callback could land
    // on the just-emptied player and trip the watchdog.)
    this._clearTurnTimer();
    this._currentPlayerId = null;

    // Settle any leftover declarations from the final cycle of the round.
    if (this._declareWindow) this._resolveDeclarations();

    // Any open derba pending settles to its claimer with the chain bonus.
    const settled = this._settlePending();
    if (settled) this.emit('ronda:chain_settled', settled);

    // Last capturer sweeps the table — those cards go into their pile
    // so they count toward the per-round card-count bonus below. The swept
    // cards + recipient ride on round_over so the client can animate them
    // collecting toward that team before the result note.
    let sweptCards = [];
    let sweptToId  = null;
    let sweptTeam  = null;
    if (this._lastCapturerId && this._table.length){
      const last = this._players.find(p => p.id === this._lastCapturerId);
      if (last){
        sweptCards = this._table.slice();          // snapshot for the animation
        sweptToId  = last.id;
        sweptTeam  = last.team;
        last.captured.push(...this._table);
        this._table = [];
      }
    }
    // Per-team card-count bonus EACH ROUND: every captured card OVER 20
    // converts into +1 point for that team. (Restored per user's spec:
    // pure captures still don't score directly, but holding more than
    // 20 cards at round end does.)
    const teamCaptured = [0, 0];
    for (const p of this._players) teamCaptured[p.team] += p.captured.length;
    const bonuses = [0, 0];
    for (let t = 0; t < 2; t++){
      bonuses[t] = Math.max(0, teamCaptured[t] - 20);
      this._teamScores[t] += bonuses[t];
    }
    const teamResults = [0, 1].map(t => ({
      team:           t,
      capturedCount:  teamCaptured[t],
      bonus:          bonuses[t],
      totalScore:     this._teamScores[t],
    }));
    this.emit('ronda:round_over', {
      round:          this._round,
      lastCapturerId: this._lastCapturerId,
      sweptCards,                                   // leftover table cards…
      sweptToId,                                    // …swept to the LAST capturer…
      sweptTeam,                                    // …on this team.
      teamResults,
      perPlayer: this._players.map(p => ({
        id: p.id, capturedCount: p.captured.length,
        rondas: p.rondas, tringas: p.tringas, mesas: p.mesas,
      })),
    });

    if (this._teamScores.some(s => s >= this.settings.targetScore)){
      this._endMatch();
      return;
    }

    this._roundTimer = setTimeout(() => {
      // Dealer passes one seat each round, going to the player on the
      // current dealer's RIGHT (seat - 1). From a player's own view the
      // "D" badge travels right → top → left → bottom around the table.
      this._dealerSeat = (this._dealerSeat - 1 + 4) % 4;
      this._dealRound();
      this.emit('ronda:state', this.publicState());
      this._beginTurn();
    }, this.settings.newRoundDelay);
  }

  _endMatch(){
    this._phase = PHASE.FINISHED;
    this._clearTimers();
    const winnerTeam = this._teamScores[0] >= this._teamScores[1] ? 0 : 1;
    this.emit('ronda:match_over', {
      winnerTeam,
      finalTeamScores: [...this._teamScores],
      players: this._players.map(p => ({ id:p.id, seat:p.seat, team:p.team })),
    });
  }

  /* ── public state ──────────────────────────────────────────────── */
  publicState(){
    return {
      phase:           this._phase,
      players:         this._players.map(p => ({
        id: p.id, username: p.username, avatar: p.avatar,
        cardBackId: p.cardBackId || 'cb_default',
        tableFelt: p.tableFelt || null,
        isBot: p.isBot, isHost: !!p.isHost,
        isConnected: p.isConnected !== false,
        seat: p.seat, team: p.team,
        handSize: p.hand.length,
        capturedCount: p.captured.length,
        rondas: p.rondas, tringas: p.tringas, mesas: p.mesas,
        // Rank identity (set for ranked-fill pro bots) so the profile sheet
        // reads as a genuine high-rank opponent. Null for casual/normal seats.
        accountLevel: p.accountLevel || null,
        isElite: p.isElite || false,
        rankPoints: p.rankPoints || null,
        rankedTier: p.rankedTier || null,
        peakRankPoints: p.peakRankPoints || null,
      })),
      teamScores:      [...this._teamScores],
      teamCaptured:    (() => {
        // Cards are tallied ONLY once a capture is CONFIRMED — i.e. settled
        // into a player's pile. The OPEN derba `_pending` pile is deliberately
        // NOT counted yet, because it can still be stolen by the next player;
        // crediting it on a mere capture would be wrong. The cards land in the
        // count at the SAME moment as the points (both paid at settle).
        return [
          this._players.filter(p => p.team === 0).reduce((s, p) => s + p.captured.length, 0),
          this._players.filter(p => p.team === 1).reduce((s, p) => s + p.captured.length, 0),
        ];
      })(),
      table:           this._table.map(c => ({ id:c.id, suit:c.suit, rank:c.rank })),
      // Pending derba pile sits ON the felt visually — chainRank +
      // chainLength let the client show e.g. "x2" or "x3" stacked piles.
      pending: this._pending ? {
        claimerId:   this._pending.claimerId,
        team:        this._pending.team,
        chainRank:   this._pending.chainRank,
        chainLength: this._pending.chainLength,
        cards:       this._pending.cards.map(c => ({ id:c.id, suit:c.suit, rank:c.rank })),
      } : null,
      // Declaration window — players whose hand currently has a 2/3
      // of a kind can click their RONDA/TRINGA button until expiresAt.
      declareWindow: this._declareWindow ? {
        handCycle:        this._declareWindow.handCycle,
        candidates:       this._declareWindow.candidates,
        declaredPlayerIds: Array.from(this._declareWindow.declared.keys()),
        endsAt:           this._declareWindow.endsAt || 0,
        closed:           !!this._declareWindow.closed,
      } : null,
      currentPlayerId: this._currentPlayerId,
      lastCapturerId:  this._lastCapturerId,
      round:           this._round,
      handCycle:       this._handCycle,
      deckRemaining:   this._deck.length,
      targetScore:     this.settings.targetScore,
      turnEndsAt:      this._turnEndsAt,
      turnTimeout:     this.settings.turnTimeout,
      dealerSeat:      this._dealerSeat,
    };
  }

  privateStateFor(playerId){
    const me = this._players.find(p => p.id === playerId);
    return {
      ...this.publicState(),
      myHand: me ? me.hand.map(c => ({ id:c.id, suit:c.suit, rank:c.rank })) : [],
    };
  }

  get phase(){ return this._phase; }
  get players(){ return this._players; }
}

module.exports = { RondaManager, PHASE };
