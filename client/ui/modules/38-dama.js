  /* ═══════════════════════════════════════════════════════════════════
     DAMA — Moroccan checkers (1v1). v2 — smooth, "alive".
     ───────────────────────────────────────────────────────────────────
     Design goals (vs the previous version, per user feedback):
       • Looks like a real checkers app, not a debug grid.
       • Pieces SLIDE between squares — they never teleport.
       • Wood-grain board + frame, classic red vs dark-navy pieces.
       • Tiny dots on legal destinations (chess.com / lichess style),
         not full-square colour washes.
       • Yellow selection ring matches the reference screenshot.
       • Reliable: never wipes state on re-render, so nothing flickers
         or jumps when dama:state arrives.

     ARCHITECTURE
       The board grid is built ONCE on enter. Pieces are absolutely-
       positioned divs keyed by their server-side piece id, kept in a
       persistent Map. On every dama:state we DIFF:
           • piece in new state, has DOM  → translate to new square
           • piece in new state, no DOM   → create + fade in
           • piece NOT in new state       → animate out + remove
       All CSS transitions handle the rest — no FLIP gymnastics needed.

     COORDS
       Logical coords are (row, col) where row 0 is black's back row.
       The board ALWAYS shows the local player's pieces at the bottom.
       For white, display row = logical row. For black, display row =
       7 − logical row (no CSS rotation; pieces stay upright).

     CAPTURE FLOW
       Server enforces mandatory + chain capture. Client just reads
       `state.legalMoves` to highlight destinations and sends one
       move per tap. When the chain continues, the engine returns a
       state with `pendingCapturer` set on the just-moved piece —
       we lock selection onto it automatically.
     ═══════════════════════════════════════════════════════════════════ */

  const Dama = {
    /* ── State ────────────────────────────────────────────────────── */
    state:           null,
    myColor:         null,
    myId:            null,
    isSpectator:     false,           // watching live, read-only (no moves)
    selected:        null,            // posKey of currently-selected own piece
    _wired:          false,
    _entered:        false,
    _stylesIn:       false,
    _helpShown:      false,
    _pieceElements:  new Map(),       // pieceId → DOM element
    _boardBuilt:     false,
    _lastBoardSig:   '',              // cache last board layout for fast diff

    /* ── Public lifecycle ─────────────────────────────────────────── */
    bindEvents(sk){
      if(!sk || this._wired) return;
      this._wired = true;
      sk.on('dama:state',      (s) => this._onState(s));
      sk.on('dama:turn',       (d) => this._onTurn(d));
      sk.on('dama:move',       (d) => this._onMove(d));
      sk.on('dama:match_over', (d) => this._onMatchOver(d));
      sk.on('dama:auto_start', (d) => {
        if(typeof _stopRankedSearch === 'function') _stopRankedSearch();
        if(d.botName) toast(`${d.botName} joined`, 'i');
      });
    },

    enter(){
      this._injectStyles();
      this._ensureRoot();
      document.body.classList.add('dama-active');
      this._entered = true;
      this.selected = null;
      this._lastBoardSig = '';
      this._applyEquippedBoard();
      // Listen-only voice the moment the player joins the board — hears
      // opponents' mics without needing to enable their own.
      try{ VoiceChat?.listen?.(); }catch(e){}
      if(!this._helpShown){
        this._helpShown = true;
        setTimeout(() => this.showHelp(), 350);
      }
      this._render();
      this._startCountdown();
    },

    // Read-only spectator entry. Board is fully public in Dama, so we
    // just enter with a fixed orientation (white at the bottom) and skip
    // the help popup + voice auto-listen. No move controls are wired.
    enterSpectator(){
      this.isSpectator = true;
      this.myId = null;
      this.myColor = 'white';        // fixed board orientation for watchers
      this._injectStyles();
      this._ensureRoot();
      document.body.classList.add('dama-active');
      this._entered = true;
      this.selected = null;
      this._lastBoardSig = '';
      this._applyEquippedBoard();
      try{ VoiceChat?.listen?.(); }catch(e){}
      this._showSpectatorBadge();
      this._render();
      this._startCountdown();
    },

    _showSpectatorBadge(){
      const root = document.getElementById('dama-root');
      if(!root || root.querySelector('.d-spectator-badge')) return;
      const b = document.createElement('div');
      b.className = 'd-spectator-badge';
      b.textContent = '👁️ SPECTATING';
      root.appendChild(b);
    },

    /* Paint .d-board-frame + .d-sq-light + .d-sq-dark from the user's
     * equipped DAMA board cosmetic. We expose three CSS custom props on
     * #dama-root so the stylesheet picks them up automatically (with
     * fallback to the original walnut design when nothing is equipped). */
    _applyEquippedBoard(){
      const root = document.getElementById('dama-root');
      if(!root) return;
      const C = window.Cosmetics;
      const id = S?.user?.equippedDamaBoard;
      if(!C || !id) return;
      const board = (C.damaBoards || []).find(b => b.id === id);
      if(!board) return;
      if(board.light) root.style.setProperty('--db-light', board.light);
      if(board.dark)  root.style.setProperty('--db-dark',  board.dark);
      if(board.frame) root.style.setProperty('--db-frame', board.frame);
    },

    exit(){
      document.body.classList.remove('dama-active');
      try{ VoiceChat?.leave?.(); }catch(e){}
      document.getElementById('dama-root')?.remove();
      document.querySelectorAll('.d-overlay').forEach(o => o.remove());
      this._entered    = false;
      this.isSpectator = false;
      this.myColor     = null;
      this.selected    = null;
      this._boardBuilt = false;
      this._pieceElements.clear();
      this._lastBoardSig    = '';
      this._matchStartLocal = null;
      this._stopCountdown();
    },

    /* ── Countdown timer (avatar ring + seconds) ─────────────────── */
    _startCountdown(){
      if(this._countdownInt) return;
      this._countdownInt = setInterval(() => this._tickCountdown(), 100);
      this._tickCountdown();
    },
    _stopCountdown(){
      if(this._countdownInt){ clearInterval(this._countdownInt); this._countdownInt = null; }
    },
    _tickCountdown(){
      const s = this.state;
      if(!s || s.phase !== 'playing') return;
      // Server-authoritative matchEndsAt is preferred; fall back to a
      // local timestamp captured the first time we saw 'playing' phase
      // (defends against stale servers without matchEndsAt).
      let endsAt = s.matchEndsAt;
      if(!endsAt && this._matchStartLocal){
        const total = s.matchTimeout || (5 * 60 * 1000);
        endsAt = this._matchStartLocal + total;
      }
      if(!endsAt) return;
      const mRem  = Math.max(0, endsAt - Date.now());
      const mSec  = Math.ceil(mRem / 1000);
      const mins  = Math.floor(mSec / 60);
      const secs2 = mSec % 60;
      const mc = document.getElementById('dMatchClock');
      if(!mc) return;
      const timeEl = mc.querySelector('.d-mc-time');
      if(timeEl) timeEl.textContent = `${mins}:${secs2.toString().padStart(2,'0')}`;
      mc.classList.toggle('d-mc-low', mSec <= 30);
    },

    /* ── Action bar ───────────────────────────────────────────────── */
    toggleMic(){
      if(typeof VoiceChat === 'undefined') return toast('Voice chat unavailable','e');
      VoiceChat.toggle();
      this._refreshMicButton();
    },
    showHelp(){ this._buildHelpOverlay(); },
    leaveGame(){
      // Spectators just stop watching — no forfeit, no confirm.
      if(this.isSpectator){
        this.exit();
        if(typeof doLeaveSpectate === 'function') doLeaveSpectate();
        else { S.roomId = null; S.isSpectator = false; if(typeof goLobby === 'function') goLobby(); }
        return;
      }
      if(!confirm('Leave the match? It will count as a forfeit.')) return;
      this.exit();
      if(S.socket && S.roomId) S.socket.emit('room:leave', {}, () => {
        S.roomId = null;
        S.currentRoomType = null;
        if(typeof goLobby === 'function') goLobby();
      });
    },

    /* ── Coordinate helpers ───────────────────────────────────────── */
    _toDisplay(row, col){
      return (this.myColor === 'black')
        ? { dRow: 7 - row, dCol: 7 - col }
        : { dRow: row,     dCol: col };
    },
    _toLogical(dRow, dCol){
      return (this.myColor === 'black')
        ? { row: 7 - dRow, col: 7 - dCol }
        : { row: dRow,     col: dCol };
    },

    /* ── Click handling ───────────────────────────────────────────── */
    onSquareTap(dRow, dCol){
      if(this.isSpectator) return;     // watchers can't move pieces
      const s = this.state;
      if(!s || s.phase !== 'playing')  return;
      const { row, col } = this._toLogical(dRow, dCol);
      const key   = `${row},${col}`;
      const piece = s.board[key];

      if(s.currentColor !== this.myColor){
        return toast("It's not your turn yet", 'i');
      }

      // If a piece is selected and the tap is on a legal destination → move.
      if(this.selected){
        const fromMoves = (s.legalMoves || {})[this.selected] || [];
        const dest = fromMoves.find(m => m.row === row && m.col === col);
        if(dest){
          const [fr, fc] = this.selected.split(',').map(Number);
          this._sendMove({ row:fr, col:fc }, { row, col });
          return;
        }
      }

      // Tap own piece → select it (if it has legal moves).
      if(piece && piece.color === this.myColor){
        const legals = (s.legalMoves || {})[key];
        if(!legals || !legals.length){
          if(s.pendingCapturer && s.pendingCapturer !== key){
            return toast('Continue your capture chain', 'w');
          }
          if(this._anyCaptureAvailable() && !this._pieceHasCapture(key)){
            return toast('A capture is available — you must take it', 'w');
          }
          return toast('This piece has no legal moves', 'i');
        }
        this.selected = key;
        this._refreshHighlights();
        return;
      }

      // Tap anywhere else → deselect.
      if(this.selected){
        this.selected = null;
        this._refreshHighlights();
      }
    },

    _anyCaptureAvailable(){
      const lm = this.state?.legalMoves || {};
      for(const arr of Object.values(lm)){
        if(arr.some(m => m.captured)) return true;
      }
      return false;
    },
    _pieceHasCapture(key){
      const arr = (this.state?.legalMoves || {})[key] || [];
      return arr.some(m => m.captured);
    },

    _sendMove(from, to){
      if(!S.socket?.connected) return toast('Not connected', 'e');
      this.selected = null;
      this._refreshHighlights();
      S.socket.emit('dama:make_move', { from, to }, (res) => {
        if(!res?.success){
          toast(res?.reason || 'Move rejected', 'e');
          this._refreshHighlights();
        }
      });
    },

    /* ── Server events ────────────────────────────────────────────── */
    _onState(s){
      this.state = s;
      // Spectator: never bind to a seat. Keep a fixed orientation and
      // route entry through enterSpectator() instead of enter().
      if(S.isSpectator){
        this.isSpectator = true;
        this.myId = null;
        if(!this.myColor) this.myColor = 'white';
        const onGameScreen = document.getElementById('game-screen')?.classList.contains('active');
        const rootLive     = !!document.getElementById('dama-root');
        if(s.phase === 'playing' && (!this._entered || !onGameScreen || !rootLive)){
          S.currentRoomType = 'DAMA';
          if(typeof _stopRankedSearch === 'function') _stopRankedSearch();
          if(typeof showScreen === 'function') showScreen('game-screen');
          this.enterSpectator();
        } else if(this._entered){
          this._render();
        }
        return;
      }
      if(S.user?.id){
        this.myId = S.user.id;
        const me = (s.players || []).find(p => p.id === S.user.id);
        if(me) this.myColor = me.color;
      }
      // Local fallback for the match clock — if the server happens to
      // be on an older build that doesn't send `matchEndsAt`, we mark
      // the local time at first 'playing' state and use that. This
      // keeps the clock ticking even across server-restart mismatches.
      if(s.phase === 'playing' && !this._matchStartLocal){
        this._matchStartLocal = Date.now();
      } else if(s.phase !== 'playing'){
        this._matchStartLocal = null;
      }
      // Robust transition (mirrors Ronda): enter whenever the match is
      // running and we're not actually on the game screen — guards
      // against a stale `_entered` flag or a missed screen switch that
      // would otherwise strand a player on the waiting screen.
      const onGameScreen = document.getElementById('game-screen')?.classList.contains('active');
      const rootLive     = !!document.getElementById('dama-root');
      if(s.phase === 'playing' && (!this._entered || !onGameScreen || !rootLive)){
        S.currentRoomType = 'DAMA';
        if(typeof _stopRankedSearch === 'function') _stopRankedSearch();
        if(typeof showScreen === 'function') showScreen('game-screen');
        this.enter();
        if(typeof addActivityMsg === 'function') addActivityMsg('♟️ Dama match started!','game');
        // VS face-off intro — 1v1 layout with both profiles in a
        // big "PLAYER vs OPPONENT" reveal + 3-2-1-GO countdown.
        if(typeof MatchIntro !== 'undefined'){
          try { MatchIntro.play({ ...s, roomType:'DAMA' }); } catch(_) {}
        }
      } else if(this._entered){
        // Drop selection if it became invalid.
        if(this.selected){
          const sp = s.board[this.selected];
          if(!sp || sp.color !== this.myColor || s.currentColor !== this.myColor){
            this.selected = null;
          }
        }
        // Chain capture: force-select the pending piece.
        if(s.pendingCapturer && s.currentColor === this.myColor){
          this.selected = s.pendingCapturer;
        }
        this._render();
      }
    },
    _onTurn(){ if(this._entered) this._refreshTurnPill(); },
    _onMove(d){
      // dama:state fires right after with the new board — that's what
      // actually moves the piece. Here we just add a tiny tap-feel on
      // the destination square + a sparkle on promotion.
      if(!this._entered) return;
      if(d.captured){ this._captureFlash(d.captured); }
      if(d.promoted){ this._promoteSparkle(d.to); toast('👑 Promoted to Dama!', 's'); }
    },
    _onMatchOver(d){ if(this._entered) this._showMatchOver(d); },

    /* ── DOM root ─────────────────────────────────────────────────── */
    _ensureRoot(){
      let root = document.getElementById('dama-root');
      if(root) return root;
      root = document.createElement('div');
      root.id = 'dama-root';
      root.className = 'd-root';
      root.innerHTML = `
        <div class="d-woodbg"></div>

        <!-- 5-min match clock — fixed top-right corner, always visible
             (portrait + landscape). Goes red+pulse under 30s. -->
        <div class="d-match-clock" id="dMatchClock">
          <span class="d-mc-icon">⏱</span>
          <span class="d-mc-time">5:00</span>
        </div>

        <div class="d-header">
          <div class="d-title">CHECKERS</div>
        </div>

        <div class="d-player d-player-top" id="dOpp"></div>

        <div class="d-board-wrap">
          <div class="d-board-frame">
            <div class="d-board" id="dBoard"></div>
          </div>
        </div>

        <div class="d-player d-player-bot" id="dMe"></div>

        <div class="d-turn" id="dTurn">Waiting…</div>

        <div class="d-actions">
          <button class="d-act d-act-mic"   id="dMicBtn"  onclick="Dama.toggleMic()" title="Voice chat">🎤</button>
          <button class="d-act"             onclick="Dama.showHelp()" title="How to play">❓</button>
          <button class="d-act d-act-leave" onclick="Dama.leaveGame()" title="Leave">🚪</button>
        </div>
      `;
      document.body.appendChild(root);
      this._refreshMicButton();
      return root;
    },

    _refreshMicButton(){
      // The unified VoiceChat._updateBtn() now drives #dMicBtn (icon +
      // .on / .listening classes) so we just delegate to it.
      if(typeof VoiceChat !== 'undefined' && VoiceChat._updateBtn) VoiceChat._updateBtn();
    },

    /* ── Render orchestration ─────────────────────────────────────── */
    _render(){
      const s = this.state;
      if(!s || !this._entered) return;
      this._buildBoardOnce();
      this._renderPlayers();
      this._refreshTurnPill();
      this._syncPieces();
      this._refreshHighlights();
    },

    _buildBoardOnce(){
      if(this._boardBuilt) return;
      const board = document.getElementById('dBoard');
      if(!board) return;
      let html = '';
      for(let dr = 0; dr < 8; dr++){
        for(let dc = 0; dc < 8; dc++){
          const { row, col } = this._toLogical(dr, dc);
          const dark = ((row + col) % 2) === 1;
          const cls = `d-sq ${dark ? 'd-sq-dark' : 'd-sq-light'}`;
          // The hint dot sits inside each square but only shows when
          // .d-dest is added by _refreshHighlights.
          html += `<div class="${cls}" data-drow="${dr}" data-dcol="${dc}"
                        onclick="Dama.onSquareTap(${dr},${dc})">
                     <div class="d-dot"></div>
                   </div>`;
        }
      }
      board.innerHTML = html;
      this._boardBuilt = true;
    },

    _syncPieces(){
      const board = document.getElementById('dBoard');
      if(!board || !this.state) return;
      const live = this.state.board || {};

      // 1) Build a quick map from server-piece-id → {row, col, piece}.
      const liveById = new Map();
      for(const [k, p] of Object.entries(live)){
        const [row, col] = k.split(',').map(Number);
        liveById.set(p.id, { row, col, piece: p });
      }

      // 2) Move / update existing piece DOM elements, OR remove if gone.
      for(const [pieceId, el] of this._pieceElements){
        const live = liveById.get(pieceId);
        if(!live){
          // Captured / removed — fade + scale out, then remove.
          el.classList.add('d-pc-leaving');
          setTimeout(() => {
            try { el.remove(); } catch(_) {}
          }, 280);
          this._pieceElements.delete(pieceId);
          continue;
        }
        const { dRow, dCol } = this._toDisplay(live.row, live.col);
        el.style.top  = `${dRow * 12.5}%`;
        el.style.left = `${dCol * 12.5}%`;
        // Toggle king class if it just got promoted.
        el.classList.toggle('d-pc-king', !!live.piece.isKing);
        el.dataset.row = live.row;
        el.dataset.col = live.col;
      }

      // 3) Add any new pieces (first render of the round, or rare edge).
      for(const [pieceId, info] of liveById){
        if(this._pieceElements.has(pieceId)) continue;
        const el = document.createElement('div');
        const colorCls = info.piece.color === 'white' ? 'd-pc-red' : 'd-pc-dark';
        el.className   = `d-pc ${colorCls} ${info.piece.isKing ? 'd-pc-king' : ''} d-pc-entering`;
        el.dataset.id  = pieceId;
        el.dataset.row = info.row;
        el.dataset.col = info.col;
        const { dRow, dCol } = this._toDisplay(info.row, info.col);
        el.style.top  = `${dRow * 12.5}%`;
        el.style.left = `${dCol * 12.5}%`;
        el.innerHTML  = `<div class="d-pc-face"></div><div class="d-pc-crown">♛</div>`;
        board.appendChild(el);
        this._pieceElements.set(pieceId, el);
        // Allow the next paint to register the entering state before we
        // remove the class — that's what triggers the fade-in transition.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => el.classList.remove('d-pc-entering'));
        });
      }
    },

    _refreshHighlights(){
      const s = this.state;
      const board = document.getElementById('dBoard');
      if(!s || !board) return;

      // Clear previous highlights.
      board.querySelectorAll('.d-dest, .d-dest-capture, .d-must-capture, .d-sel')
        .forEach(el => el.classList.remove('d-dest','d-dest-capture','d-must-capture','d-sel'));
      this._pieceElements.forEach(el => el.classList.remove('d-pc-selected','d-pc-must','d-pc-movable'));

      if(s.phase !== 'playing') return;

      // Mark pieces that MUST capture (red ring).
      const captureSources = new Set();
      for(const [from, ms] of Object.entries(s.legalMoves || {})){
        if(ms.some(m => m.captured)) captureSources.add(from);
      }
      const movable = new Set(Object.keys(s.legalMoves || {}));

      if(s.currentColor === this.myColor){
        for(const [pieceId, el] of this._pieceElements){
          const k = `${el.dataset.row},${el.dataset.col}`;
          if(captureSources.has(k)) el.classList.add('d-pc-must');
          if(movable.has(k))        el.classList.add('d-pc-movable');
        }
      }

      // Selected piece — yellow ring (on the piece) + halo (on the square).
      if(this.selected){
        const [sr, sc] = this.selected.split(',').map(Number);
        const { dRow, dCol } = this._toDisplay(sr, sc);
        const sqEl = board.querySelector(`.d-sq[data-drow="${dRow}"][data-dcol="${dCol}"]`);
        if(sqEl) sqEl.classList.add('d-sel');
        // Find the piece DOM element by current row/col.
        for(const el of this._pieceElements.values()){
          if(parseInt(el.dataset.row) === sr && parseInt(el.dataset.col) === sc){
            el.classList.add('d-pc-selected');
            break;
          }
        }
        // Legal destinations — green dot for moves, red ring around the
        // dot for captures.
        const moves = (s.legalMoves || {})[this.selected] || [];
        for(const m of moves){
          const { dRow: ddRow, dCol: ddCol } = this._toDisplay(m.row, m.col);
          const el = board.querySelector(`.d-sq[data-drow="${ddRow}"][data-dcol="${ddCol}"]`);
          if(el) el.classList.add(m.captured ? 'd-dest-capture' : 'd-dest');
        }
      }
    },

    _renderPlayers(){
      const s = this.state;
      const players = s.players || [];
      if(this.isSpectator){
        // No "me" — show both seated players by colour: white at the
        // bottom (matches the fixed spectator orientation), black on top.
        const white = players.find(p => p.color === 'white');
        const black = players.find(p => p.color === 'black');
        this._renderOnePlayer('dMe',  white, s, false);
        this._renderOnePlayer('dOpp', black, s, false);
        return;
      }
      const me  = players.find(p => p.id === this.myId);
      const opp = players.find(p => p.id !== this.myId);
      this._renderOnePlayer('dMe',  me,  s, true);
      this._renderOnePlayer('dOpp', opp, s, false);
    },

    _renderOnePlayer(elId, p, s, isMe){
      const el = document.getElementById(elId);
      if(!el) return;
      if(!p){
        el.innerHTML = '<div class="d-pl-name" style="opacity:.5">Waiting for opponent…</div>';
        return;
      }
      const isTurn = s.phase === 'playing' && s.currentColor === p.color;
      const pieces = s.pieceCount ? s.pieceCount[p.color] : 0;
      el.classList.toggle('is-turn', isTurn);
      const colorDotCls = p.color === 'white' ? 'd-pl-color-red' : 'd-pl-color-dark';
      const avStyle = (p.avatar && /^(https?:|data:|\/)/.test(p.avatar))
        ? `background-image:url('${esc(p.avatar)}')` : '';
      const initial = avStyle ? '' : esc((p.username || '?')[0]).toUpperCase();
      // Per-peer mute button — only on opponent (not me), not on bots,
      // and only when voice chat is on. Tap to silence on your end.
      const muteBtn = (!isMe && !p.isBot && typeof VoiceChat !== 'undefined' && VoiceChat.isOn)
        ? (() => {
            const muted = VoiceChat.mutedPeers?.has(p.id);
            return `<button class="d-mute-toggle ${muted?'muted':''}"
                            onclick="event.stopPropagation();VoiceChat.toggleMutePeer('${esc(p.id)}');Dama._render();"
                            title="${muted?'Unmute':'Mute'} ${esc(p.username)}'s mic">${muted?'🔇':'🔊'}</button>`;
          })()
        : '';
      // Profile card — no per-turn countdown (removed per user spec).
      // The yellow d-pl-turn-pulse dot is still rendered when it's
      // this player's turn so it reads at a glance who's moving.
      el.innerHTML = `
        ${muteBtn}
        <div class="d-pl-av" style="${avStyle}">${initial}</div>
        <div class="d-pl-meta">
          <div class="d-pl-name">${esc(p.username || 'Player')}${verifiedBadgeHTML(p.username,{isBot:p.isBot,size:'xs'})}${isMe ? ' <span class="d-pl-you">YOU</span>' : ''}</div>
          <div class="d-pl-sub">
            <span class="d-pl-color ${colorDotCls}"></span>
            <b>${pieces}</b> ${pieces === 1 ? 'piece' : 'pieces'}
          </div>
        </div>
        ${isTurn ? '<div class="d-pl-turn-pulse" aria-hidden="true"></div>' : ''}
      `;
    },

    _refreshTurnPill(){
      const s = this.state;
      const t = document.getElementById('dTurn');
      if(!t || !s) return;
      if(s.phase !== 'playing'){
        t.textContent = 'Waiting for opponent…';
        t.className = 'd-turn';
        return;
      }
      const myTurn = s.currentColor === this.myColor;
      if(myTurn){
        if(s.pendingCapturer){
          t.textContent = '⚡ Continue your chain!';
        } else if(this._anyCaptureAvailable()){
          t.textContent = '⚡ Your turn — capture available';
        } else {
          t.textContent = '⚡ Your turn — tap a piece';
        }
        t.className = 'd-turn on';
      } else {
        const opp = (s.players || []).find(p => p.id !== this.myId);
        t.textContent = `Waiting on ${opp?.username || 'opponent'}…`;
        t.className = 'd-turn';
      }
    },

    /* ── Move / capture feedback ───────────────────────────────────── */
    _captureFlash(key){
      const [r, c] = key.split(',').map(Number);
      const { dRow, dCol } = this._toDisplay(r, c);
      const sq = document.querySelector(`#dBoard .d-sq[data-drow="${dRow}"][data-dcol="${dCol}"]`);
      if(!sq) return;
      sq.classList.add('d-flash-capture');
      setTimeout(() => sq.classList.remove('d-flash-capture'), 500);
    },
    _promoteSparkle(key){
      const [r, c] = key.split(',').map(Number);
      const { dRow, dCol } = this._toDisplay(r, c);
      const sq = document.querySelector(`#dBoard .d-sq[data-drow="${dRow}"][data-dcol="${dCol}"]`);
      if(!sq) return;
      const star = document.createElement('div');
      star.className = 'd-sparkle';
      sq.appendChild(star);
      setTimeout(() => star.remove(), 1200);
    },

    /* ── Overlays ─────────────────────────────────────────────────── */
    _buildHelpOverlay(){
      document.getElementById('dHelpOv')?.remove();
      const ov = document.createElement('div');
      ov.id = 'dHelpOv';
      ov.className = 'd-overlay d-help';
      ov.innerHTML = `
        <div class="d-overlay-card d-help-card">
          <button class="d-overlay-x" onclick="document.getElementById('dHelpOv').remove()">×</button>
          <div class="d-help-eyebrow">CHECKERS · HOW TO PLAY</div>
          <div class="d-help-rules">
            <div class="d-rule"><span class="d-rule-num">1</span><div>Each side has <b>12 pieces</b>. The red player moves first.</div></div>
            <div class="d-rule"><span class="d-rule-num">2</span><div>Tap a piece → green dots show legal moves. Tap a dot to move.</div></div>
            <div class="d-rule"><span class="d-rule-num">3</span><div>Men move <b>1 diagonal square forward</b>. They can't move backward.</div></div>
            <div class="d-rule"><span class="d-rule-num">4</span><div><b>Capture</b> by jumping FORWARD over an adjacent enemy to the empty square behind. Men can only jump forward — backward jumps are reserved for Damas (kings).</div></div>
            <div class="d-rule"><span class="d-rule-num">5</span><div>If a capture exists, <b>you must take it</b> (red ring on the piece). After a capture, if more captures are possible with the same piece, you must continue the chain.</div></div>
            <div class="d-rule"><span class="d-rule-num">6</span><div>Reach the opposite back row → become a <b>Dama 👑</b>. Damas move <b>one square at a time</b> like men, but in <b>any diagonal direction</b> (forward AND backward).</div></div>
            <div class="d-rule"><span class="d-rule-num">7</span><div><b>5-minute match clock</b> — at the top-right. When it runs out, the player with <b>more remaining pieces wins</b> (equal pieces = draw).</div></div>
            <div class="d-rule"><span class="d-rule-num">8</span><div>Win by capturing all opponent pieces, leaving them with no legal move, or having more pieces when the 5-min timer runs out.</div></div>
          </div>
          <button class="d-help-btn d-help-go" onclick="document.getElementById('dHelpOv').remove()">Got it — let's play</button>
        </div>`;
      // Tap anywhere on the backdrop (the sides, outside the card) to close
      // and go back to the game — not just the × / Got it buttons.
      ov.onclick = (e) => { if(e.target === ov) ov.remove(); };
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('show'));
    },

    _showMatchOver(d){
      const ov = document.createElement('div');
      ov.className = 'd-overlay d-overlay-final';
      // Three outcomes:
      //   • winnerColor === null → draw (5-min timer with tied counts)
      //   • winnerColor === myColor → victory
      //   • otherwise → defeat
      let eyebrow, title;
      if(d.winnerColor === null){
        eyebrow = '🤝 DRAW';
        title   = "It's a tie!";
      } else if(this.isSpectator){
        // Neutral framing for watchers — name the winning side.
        const winner = (this.state?.players || []).find(p => p.color === d.winnerColor);
        eyebrow = '🏆 MATCH OVER';
        title   = `${winner ? esc(winner.username) : (d.winnerColor === 'white' ? 'Red' : 'Dark')} wins!`;
      } else if(d.winnerColor === this.myColor){
        eyebrow = '🏆 VICTORY';
        title   = 'You win!';
      } else {
        eyebrow = '💀 DEFEAT';
        title   = 'Better luck next time';
      }
      const reasonLabel =
        d.reason === 'no_pieces'     ? 'all opposing pieces captured' :
        d.reason === 'no_moves'      ? 'opponent has no legal moves' :
        d.reason === 'opponent_left' ? 'your opponent left the match' :
        d.reason === 'time_up'       ? (d.winnerColor === null
                                          ? '5 minutes up · equal pieces remaining'
                                          : '5 minutes up · most pieces remaining wins')
                                     : 'match over';
      ov.innerHTML = `
        <div class="d-overlay-card">
          <div class="d-mo-eyebrow">${eyebrow}</div>
          <div class="d-mo-title">${esc(title)}</div>
          <div class="d-mo-sub">${esc(reasonLabel)}</div>
          <button class="d-mo-btn" onclick="Dama._leave()">Back to Lobby</button>
        </div>`;
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('show'));
    },

    _leave(){
      const wasSpectator = this.isSpectator;
      document.querySelectorAll('.d-overlay').forEach(o => o.remove());
      this.exit();
      this.state = null;
      // Tell the server we stopped watching so the spectator count + room
      // membership clean up.
      if(wasSpectator && S.socket && S.roomId){
        S.socket.emit('room:spectate_leave', {}, () => {});
      }
      S.roomId = null;
      S.isSpectator = false;
      S.currentRoomType = null;
      if(typeof goLobby === 'function') goLobby();
    },

    /* ── Styles ───────────────────────────────────────────────────── */
    _injectStyles(){
      if(this._stylesIn) return;
      this._stylesIn = true;
      const s = document.createElement('style');
      s.textContent = `
        body.dama-active #game-screen > *:not(#dama-root){ visibility:hidden !important; }
        /* Grid layout — two presets via @media query:
             • Portrait/tall (default)     → single tidy centered column
             • Landscape phone (short)     → 3-column: opp left, board
                                              center, me/turn/actions right */
        .d-root{
          position:fixed; inset:0; z-index:50;
          display:grid;
          grid-template-areas:
            "header"
            "opp"
            "board"
            "me"
            "turn"
            "actions";
          grid-template-columns:1fr;
          grid-template-rows:auto auto 1fr auto auto auto;
          justify-items:center;
          gap:4px;
          padding:6px 8px 8px;
          font-family:'Outfit',sans-serif; color:#fff;
          overflow:hidden;
        }
        .d-root > .d-header     { grid-area:header; }
        .d-root > .d-player-top { grid-area:opp; }
        .d-root > .d-board-wrap { grid-area:board; }
        .d-root > .d-player-bot { grid-area:me; }
        .d-root > .d-turn       { grid-area:turn; }
        .d-root > .d-actions    { grid-area:actions; }
        /* Everything shares this width so the layout reads as one
           tidy column on portrait — no full-width strips. */
        .d-root > .d-header,
        .d-root > .d-player,
        .d-root > .d-board-wrap,
        .d-root > .d-turn,
        .d-root > .d-actions{
          width:100%;
          max-width:min(94vw, 540px);
        }

        /* ─ WOOD WALLPAPER ─ */
        .d-woodbg{
          position:absolute; inset:0; z-index:0;
          background:
            repeating-linear-gradient(90deg,
              rgba(0,0,0,.06) 0px, rgba(0,0,0,0) 1px, rgba(0,0,0,.04) 3px, rgba(0,0,0,0) 7px),
            repeating-linear-gradient(0deg,
              rgba(0,0,0,.04) 0px, rgba(0,0,0,0) 4px, rgba(0,0,0,.07) 9px, rgba(0,0,0,0) 16px),
            radial-gradient(ellipse at 50% 30%, #6b4220 0%, #3d2410 70%, #1f1106 100%);
        }

        /* ─ MATCH CLOCK ─ fixed top-right, always visible.
           This is the ONLY time indicator now — bigger + bolder so it
           reads at a glance. Counts down from 5:00 to 0:00. */
        .d-match-clock{
          position:fixed; top:10px; right:14px; z-index:55;
          display:flex; align-items:center; gap:8px;
          padding:9px 16px;
          background:rgba(0,0,0,.78);
          border:1.5px solid rgba(251,191,36,.45);
          border-radius:99px;
          font-family:'Outfit',sans-serif;
          box-shadow:0 6px 18px rgba(0,0,0,.5), 0 0 14px rgba(251,191,36,.2);
        }
        .d-mc-icon{ font-size:16px; }
        .d-mc-time{
          font-family:'Bangers',sans-serif;
          font-size:20px; letter-spacing:1.5px;
          color:#FBBF24;
          line-height:1;
          text-shadow:0 1px 3px rgba(0,0,0,.6);
        }
        .d-match-clock.d-mc-low{
          background:rgba(232,50,74,.25);
          border-color:rgba(232,50,74,.85);
          box-shadow:0 6px 18px rgba(232,50,74,.4), 0 0 18px rgba(232,50,74,.5);
          animation:dMcPulse 1s ease-in-out infinite;
        }
        .d-match-clock.d-mc-low .d-mc-time{ color:#FCA5A5; }
        @keyframes dMcPulse{ 50%{ transform:scale(1.06); } }
        /* Shrink slightly on small portrait phones so it doesn't crowd
           the title. */
        @media (max-width:480px) and (orientation:portrait){
          .d-match-clock{ padding:7px 13px; gap:6px; }
          .d-mc-time{ font-size:17px; letter-spacing:1.2px; }
          .d-mc-icon{ font-size:14px; }
        }

        /* ─ HEADER ─ */
        .d-header{
          position:relative; z-index:2;
          text-align:center; padding:8px 0 4px;
          flex-shrink:0;
        }
        .d-title{
          font-family:'Bangers',sans-serif;
          font-size:20px; letter-spacing:5px;
          color:#FFE8C2; text-shadow:0 2px 6px rgba(0,0,0,.6);
        }

        /* ─ PLAYER BARS ─ */
        .d-player{
          position:relative; z-index:2;
          display:flex; gap:12px; align-items:center;
          padding:8px 14px; margin:4px 0;
          background:linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.4));
          border:1px solid rgba(255,255,255,.07);
          border-radius:14px;
          transition:border-color .25s, box-shadow .25s;
          flex-shrink:0;
        }
        .d-player.is-turn{
          border-color:#FBBF24;
          box-shadow:0 0 22px rgba(251,191,36,.42);
        }
        .d-pl-turn-pulse{
          position:absolute; right:14px; top:50%; transform:translateY(-50%);
          width:10px; height:10px; border-radius:50%;
          background:#FBBF24;
          box-shadow:0 0 14px rgba(251,191,36,.9);
          animation:dPulseDot 1.1s ease-in-out infinite;
        }
        @keyframes dPulseDot{ 50%{ transform:translateY(-50%) scale(1.35); opacity:.7; } }
        /* Avatar — per-player countdown ring + seconds removed per user
           spec. Only the static disc remains; the only "whose turn?"
           cue on the bar is the small yellow .d-pl-turn-pulse dot. */
        .d-pl-av{
          width:44px; height:44px; border-radius:50%;
          background:linear-gradient(180deg, #7C3AED, #4C1D95);
          background-size:cover; background-position:center;
          border:2px solid rgba(255,255,255,.18);
          display:flex; align-items:center; justify-content:center;
          font-family:'Bangers',sans-serif; font-size:18px;
          flex-shrink:0;
        }
        .d-pl-meta{ flex:1; min-width:0; }
        .d-pl-name{
          font-size:14px; font-weight:800; letter-spacing:.5px;
          display:flex; align-items:center; gap:6px;
        }
        .d-pl-you{
          background:#FBBF24; color:#1A1A1A; font-size:9px;
          padding:1px 5px; border-radius:3px; letter-spacing:1px; font-weight:900;
        }
        .d-pl-sub{
          font-size:11px; opacity:.82; display:flex; align-items:center; gap:6px;
          margin-top:2px;
        }
        .d-pl-sub b{ color:#FFE8C2; }
        .d-pl-color{ width:11px; height:11px; border-radius:50%; display:inline-block; }
        .d-pl-color-red{
          background:radial-gradient(circle at 35% 30%, #FF6E5A 0%, #C8362B 60%, #6B0F0A 100%);
          border:1px solid #6B0F0A;
        }
        .d-pl-color-dark{
          background:radial-gradient(circle at 35% 30%, #4A6488 0%, #1E3A5F 60%, #0A1929 100%);
          border:1px solid #0A1929;
        }

        /* Mute-this-peer button on the opponent's profile card. */
        .d-mute-toggle{
          position:absolute; top:6px; right:6px;
          width:30px; height:30px; border-radius:50%;
          background:rgba(0,0,0,.55);
          border:1.5px solid rgba(255,255,255,.25);
          color:#fff; font-size:13px; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:transform .15s, background .2s, border-color .2s;
          z-index:5;
          box-shadow:0 2px 6px rgba(0,0,0,.4);
          -webkit-tap-highlight-color:transparent;
        }
        .d-mute-toggle:hover, .d-mute-toggle:active{
          transform:scale(1.12);
          background:rgba(0,0,0,.75);
        }
        .d-mute-toggle.muted{
          background:rgba(232,50,74,.88);
          border-color:rgba(232,50,74,.95);
          box-shadow:0 2px 8px rgba(232,50,74,.55);
        }

        /* ─ BOARD WRAP + WOOD FRAME ─ */
        .d-board-wrap{
          position:relative; z-index:2;
          flex:1; display:flex; align-items:center; justify-content:center;
          min-height:0; padding:4px 0;
        }
        .d-board-frame{
          position:relative;
          padding:12px;
          border-radius:12px;
          background:
            repeating-linear-gradient(0deg,
              rgba(0,0,0,.18) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.12) 5px, rgba(0,0,0,0) 10px),
            var(--db-frame, linear-gradient(160deg, #6B3A14 0%, #3F1F09 100%));
          box-shadow:
            0 18px 40px rgba(0,0,0,.6),
            inset 0 0 0 2px rgba(255,180,90,.18),
            inset 0 -6px 12px rgba(0,0,0,.45),
            inset 0 6px 10px rgba(255,200,140,.10);
        }
        /* Board sizing — the height cap (50vh) leaves room for both
           player bars + the turn pill + the action bar on every
           viewport. The width cap (calc(100vh - 360px)) keeps the
           board from overflowing the available vertical space on
           short / landscape screens. */
        .d-board{
          position:relative;
          width:min(86vw, 50vh, calc(100vh - 360px), 500px);
          aspect-ratio:1;
          display:grid;
          grid-template-columns:repeat(8, 1fr);
          grid-template-rows:repeat(8, 1fr);
          border-radius:4px;
          overflow:hidden;
          box-shadow:inset 0 0 14px rgba(0,0,0,.55);
        }
        .d-sq{
          position:relative;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer;
          touch-action:manipulation;   /* no 300ms tap delay on mobile */
          -webkit-tap-highlight-color:transparent;
        }
        /* Light squares — defaults to tan wood; cosmetic boards override
         * --db-light via #dama-root. The grain overlay rides on top so
         * every board still feels physical, not flat. */
        .d-sq-light{
          background:
            repeating-linear-gradient(70deg,
              rgba(0,0,0,.03) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.05) 5px, rgba(0,0,0,0) 9px),
            var(--db-light, linear-gradient(140deg, #F0CD8E, #D9A85E));
        }
        /* Dark squares — defaults to saddle brown; cosmetic boards
         * override --db-dark via #dama-root. */
        .d-sq-dark{
          background:
            repeating-linear-gradient(70deg,
              rgba(0,0,0,.08) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.12) 5px, rgba(0,0,0,0) 9px),
            var(--db-dark, linear-gradient(140deg, #7B4423, #4F2912));
        }

        /* Selection halo on the square the selected piece sits on. */
        .d-sq.d-sel::after{
          content:''; position:absolute; inset:6%;
          border:3px solid #FBBF24; border-radius:50%;
          box-shadow:0 0 16px rgba(251,191,36,.55);
          pointer-events:none;
          animation:dHaloPulse 1.4s ease-in-out infinite;
        }
        @keyframes dHaloPulse{ 50%{ box-shadow:0 0 26px rgba(251,191,36,.95); } }

        /* Move/capture dots — chess.com style. */
        .d-dot{
          width:28%; height:28%; border-radius:50%;
          background:transparent;
          transition:background .15s, transform .15s;
          pointer-events:none;
        }
        .d-sq.d-dest .d-dot{
          background:rgba(0,0,0,.34);
          box-shadow:inset 0 0 0 2px rgba(255,255,255,.1);
        }
        .d-sq.d-dest-capture .d-dot{
          width:78%; height:78%;
          background:transparent;
          border:4px solid rgba(232,50,74,.85);
          box-shadow:0 0 14px rgba(232,50,74,.45);
        }
        .d-sq.d-dest:hover .d-dot,
        .d-sq.d-dest-capture:hover .d-dot{ transform:scale(1.08); }

        /* Transient capture flash on the captured square. */
        .d-sq.d-flash-capture{
          animation:dFlash .5s ease-out;
        }
        @keyframes dFlash{
          0%   { box-shadow:inset 0 0 0 6px rgba(232,50,74,.7); }
          100% { box-shadow:inset 0 0 0 0px rgba(232,50,74,0); }
        }

        /* Sparkle effect for promotion. */
        .d-sparkle{
          position:absolute; inset:0;
          background:
            radial-gradient(circle at 30% 30%, #FBBF24 0%, transparent 4%),
            radial-gradient(circle at 70% 40%, #FFE8C2 0%, transparent 3%),
            radial-gradient(circle at 50% 70%, #FBBF24 0%, transparent 4%),
            radial-gradient(circle at 20% 60%, #FFE8C2 0%, transparent 3%);
          pointer-events:none;
          animation:dSparkle 1.1s ease-out forwards;
        }
        @keyframes dSparkle{
          0%   { opacity:0; transform:scale(.7); }
          25%  { opacity:1; transform:scale(1.1); }
          100% { opacity:0; transform:scale(1.6); }
        }

        /* ─ PIECES ─ */
        /* Pieces (and ALL their children) are click-transparent — every
           tap is handled by the .d-sq underneath. This is the bug fix
           for "I tap my piece and nothing happens". */
        .d-pc, .d-pc *{ pointer-events:none; }
        .d-pc{
          position:absolute;
          width:12.5%; height:12.5%;
          display:flex; align-items:center; justify-content:center;
          transition:
            top    .35s cubic-bezier(.5,.04,.44,1),
            left   .35s cubic-bezier(.5,.04,.44,1),
            transform .2s ease;
          will-change:top, left, transform;
        }
        .d-pc-face{
          position:relative;
          width:80%; height:80%; border-radius:50%;
          box-shadow:
            0 6px 10px rgba(0,0,0,.5),
            inset 0 -4px 8px rgba(0,0,0,.4),
            inset 0 3px 6px rgba(255,255,255,.22);
        }
        .d-pc-face::before{
          content:''; position:absolute; inset:18%;
          border-radius:50%;
          border:2px dashed rgba(255,255,255,.18);
        }
        .d-pc-red .d-pc-face{
          background:radial-gradient(circle at 35% 30%, #FF7A66 0%, #D43A2D 45%, #7A0F0A 100%);
          border:1.5px solid #5A0707;
        }
        .d-pc-dark .d-pc-face{
          background:radial-gradient(circle at 35% 30%, #5E80B0 0%, #2B4878 45%, #08152B 100%);
          border:1.5px solid #050C19;
        }
        .d-pc-crown{
          position:absolute; inset:0;
          display:flex; align-items:center; justify-content:center;
          font-size:clamp(14px, 3.4vw, 26px);
          color:#FBBF24;
          text-shadow:0 1px 2px rgba(0,0,0,.65);
          opacity:0;
          transform:scale(.6);
          transition:opacity .25s ease, transform .35s cubic-bezier(.18,.89,.32,1.4);
          pointer-events:none;
        }
        .d-pc.d-pc-king .d-pc-crown{ opacity:1; transform:scale(1); }
        .d-pc.d-pc-king.d-pc-red   .d-pc-crown{ color:#FFE8C2; }
        .d-pc.d-pc-king.d-pc-dark  .d-pc-crown{ color:#FBBF24; }

        /* Selected piece — yellow ring + tiny lift. */
        .d-pc.d-pc-selected{ transform:translateY(-3px) scale(1.04); }
        .d-pc.d-pc-selected .d-pc-face{
          box-shadow:
            0 10px 16px rgba(0,0,0,.55),
            0 0 0 4px rgba(251,191,36,.85),
            0 0 22px rgba(251,191,36,.6),
            inset 0 -4px 8px rgba(0,0,0,.4),
            inset 0 3px 6px rgba(255,255,255,.22);
        }
        /* Pieces that MUST capture — subtle red pulse ring. */
        .d-pc.d-pc-must .d-pc-face{
          box-shadow:
            0 6px 10px rgba(0,0,0,.5),
            0 0 0 3px rgba(232,50,74,.7),
            0 0 14px rgba(232,50,74,.45),
            inset 0 -4px 8px rgba(0,0,0,.4),
            inset 0 3px 6px rgba(255,255,255,.22);
          animation:dMustPulse 1.3s ease-in-out infinite;
        }
        @keyframes dMustPulse{ 50%{ box-shadow:
          0 6px 10px rgba(0,0,0,.5),
          0 0 0 5px rgba(232,50,74,.9),
          0 0 20px rgba(232,50,74,.65),
          inset 0 -4px 8px rgba(0,0,0,.4),
          inset 0 3px 6px rgba(255,255,255,.22); } }

        /* Pieces never intercept pointer events — they sit on top of
           their square but clicks pass through to the square's onclick
           handler. Hover-lift is driven by the parent square instead. */
        .d-pc.d-pc-movable{ cursor:pointer; }
        .d-sq:hover .d-pc.d-pc-movable{ transform:translateY(-2px) scale(1.02); }

        /* Fade-in for newly-placed pieces (start of round). */
        .d-pc.d-pc-entering{ opacity:0; transform:scale(.6); }
        .d-pc{ opacity:1; }

        /* Leave animation when captured. */
        .d-pc.d-pc-leaving{
          opacity:0;
          transform:scale(.4) rotate(-12deg);
          transition:opacity .28s ease, transform .28s ease;
        }

        /* ─ TURN PILL ─ */
        .d-turn{
          position:relative; z-index:2;
          align-self:center; margin:4px auto 0;
          padding:8px 20px; border-radius:99px;
          font-size:11px; font-weight:900; letter-spacing:1.6px;
          background:rgba(0,0,0,.45); color:rgba(255,255,255,.62);
          text-align:center; max-width:90vw;
        }
        .d-turn.on{
          background:linear-gradient(135deg, #FBBF24, #D97706);
          color:#1A1A1A;
          box-shadow:0 0 22px rgba(251,191,36,.55);
          animation:dPulsePill 1.5s ease-in-out infinite;
        }
        @keyframes dPulsePill{ 50%{ transform:scale(1.04); } }

        /* ─ ACTION BAR ─ */
        .d-actions{
          position:relative; z-index:2;
          display:flex; gap:10px; justify-content:center;
          padding:8px 12px 16px;
          background:linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.45));
        }
        .d-act{
          width:44px; height:44px; border-radius:50%;
          background:rgba(255,255,255,.08);
          border:1px solid rgba(255,255,255,.12);
          color:#fff; font-size:18px; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:transform .15s, background .2s;
        }
        .d-act:hover{ transform:scale(1.08); background:rgba(255,255,255,.15); }
        .d-act:active{ transform:scale(.92); }
        /* Mic — green when LIVE, blue when listening (connected+muted),
         * default (no colour) when not connected. */
        .d-act-mic.on{
          background:linear-gradient(135deg, #22C55E, #15803D);
          border-color:rgba(34,197,94,.7);
          box-shadow:0 0 14px rgba(34,197,94,.55);
        }
        .d-act-mic.listening{
          background:linear-gradient(135deg, #1E3A8A, #0C1E3E);
          border-color:rgba(96,165,250,.6);
          box-shadow:0 0 12px rgba(96,165,250,.4);
        }
        /* Spectator badge — pinned top-center so watchers always know
         * they're in read-only mode. */
        .d-spectator-badge{
          position:absolute; top:10px; left:50%; transform:translateX(-50%);
          z-index:20;
          padding:5px 14px; border-radius:99px;
          background:linear-gradient(135deg, rgba(232,50,74,.9), rgba(155,27,46,.9));
          color:#fff; font-family:'Outfit',sans-serif;
          font-size:11px; font-weight:900; letter-spacing:1.6px;
          box-shadow:0 4px 14px rgba(0,0,0,.5), 0 0 16px rgba(232,50,74,.4);
          pointer-events:none;
          animation:dSpecPulse 2s ease-in-out infinite;
        }
        @keyframes dSpecPulse{ 50%{ opacity:.7; } }
        .d-act-leave{
          background:rgba(232,50,74,.15); border-color:rgba(232,50,74,.4);
        }
        .d-act-leave:hover{ background:rgba(232,50,74,.30); }

        /* ─ OVERLAYS ─ */
        .d-overlay{
          position:fixed; inset:0; z-index:200;
          display:flex; align-items:center; justify-content:center;
          background:rgba(4,8,18,0); pointer-events:none;
          transition:background .35s;
        }
        .d-overlay.show{ background:rgba(4,8,18,.78); backdrop-filter:blur(10px); pointer-events:auto; }
        .d-overlay-card{
          padding:24px 22px; border-radius:18px;
          background:linear-gradient(180deg, #2a1810, #1A0F0A);
          border:1px solid rgba(255,255,255,.1);
          box-shadow:0 30px 80px rgba(0,0,0,.7);
          text-align:center; color:#fff;
          min-width:300px; max-width:90vw;
          /* Scroll the card itself when it's taller than the screen (long
             rules list on short phones) so nothing is cut off. */
          max-height:88vh; overflow-y:auto; -webkit-overflow-scrolling:touch;
          overscroll-behavior:contain;
          transform:scale(.85); opacity:0;
          transition:transform .35s cubic-bezier(.18,.89,.32,1.07), opacity .35s;
          position:relative;
        }
        .d-overlay.show .d-overlay-card{ transform:scale(1); opacity:1; }
        .d-overlay-x{
          position:absolute; top:10px; right:12px;
          background:none; border:none; color:rgba(255,255,255,.55);
          font-size:22px; cursor:pointer;
        }

        .d-help-card{ min-width:320px; max-width:440px; text-align:left; }
        .d-help-eyebrow{ font-size:10px; letter-spacing:3px; color:#FBBF24; font-weight:900; text-align:center; margin-bottom:14px; }
        .d-help-rules{ display:flex; flex-direction:column; gap:10px; }
        .d-rule{ display:flex; gap:10px; align-items:flex-start; }
        .d-rule div{ font-size:12px; line-height:1.45; opacity:.92; flex:1; }
        .d-rule b{ color:#FBBF24; }
        .d-rule-num{
          flex:0 0 22px; height:22px; border-radius:50%;
          background:linear-gradient(135deg, #FBBF24, #D97706); color:#1A1A1A;
          font-weight:900; font-size:11px;
          display:flex; align-items:center; justify-content:center;
          font-family:'Outfit',sans-serif;
        }
        .d-help-btn{
          margin-top:16px; width:100%; padding:12px;
          border:none; border-radius:10px; cursor:pointer;
          font-weight:800; font-size:12px; letter-spacing:1.5px;
        }
        .d-help-go{ background:linear-gradient(135deg, #FBBF24, #D97706); color:#1A1A1A; }

        .d-mo-eyebrow{ font-size:10px; font-weight:900; letter-spacing:3px; color:#FBBF24; margin-bottom:10px; }
        .d-mo-title{ font-family:'Bangers',sans-serif; font-size:28px; letter-spacing:1.5px; margin-bottom:6px; }
        .d-mo-sub{ font-size:11px; opacity:.75; letter-spacing:.5px; margin-bottom:18px; }
        .d-mo-btn{
          padding:10px 22px; border-radius:10px; border:none;
          background:linear-gradient(135deg, #FBBF24, #D97706); color:#1A1A1A;
          font-weight:900; letter-spacing:1.5px; font-size:12px; cursor:pointer;
        }

        /* Small portrait phones — tighten everything a touch. */
        @media (max-width:480px) and (orientation:portrait){
          .d-title{ font-size:17px; letter-spacing:3px; }
          .d-pl-av{ width:38px; height:38px; font-size:15px; }
          .d-pl-name{ font-size:12px; }
          .d-pl-sub{ font-size:10px; }
          .d-player{ padding:6px 10px; gap:8px; }
          .d-turn{ font-size:10px; letter-spacing:1.2px; padding:6px 14px; }
          .d-act{ width:40px; height:40px; font-size:16px; }
          .d-actions{ padding:6px 8px 12px; gap:8px; }
        }

        /* ════════════════════════════════════════════════════════════
           LANDSCAPE PHONE — 3-column layout.
             [ opponent | board | me + turn + actions ]
           Compact vertical profile cards (avatar on top, name +
           pieces beneath). The board takes the central column and
           grows to fill the available height.
           ════════════════════════════════════════════════════════════ */
        @media (orientation:landscape) and (max-height:600px){
          .d-root{
            grid-template-areas:
              "opp board me"
              "opp board turn"
              "opp board actions";
            grid-template-columns:minmax(120px, 1fr) auto minmax(120px, 1fr);
            grid-template-rows:auto 1fr auto;
            gap:8px;
            padding:8px 10px;
            align-items:center;
          }
          /* Disable the portrait width caps. */
          .d-root > .d-header,
          .d-root > .d-player,
          .d-root > .d-board-wrap,
          .d-root > .d-turn,
          .d-root > .d-actions{
            max-width:none;
            width:auto;
          }
          .d-header{ display:none; }

          /* Profile cards: stack avatar → meta vertically, narrow. */
          .d-player{
            flex-direction:column;
            text-align:center;
            padding:10px 8px;
            gap:6px;
            width:100%;
            max-width:160px;
            margin:0;
          }
          .d-player-top{ align-self:start;  justify-self:start; }
          .d-player-bot{ align-self:start;  justify-self:end; }
          .d-pl-meta{ text-align:center; width:100%; }
          .d-pl-name{ justify-content:center; font-size:12px; }
          .d-pl-sub{ justify-content:center; font-size:10px; }
          .d-pl-av{ width:42px; height:42px; font-size:16px; }
          .d-pl-turn-pulse{ right:auto; top:6px; transform:none; }

          /* Board fills the central column, height-constrained. */
          .d-board-wrap{ padding:0; }
          .d-board{
            width:min(94vh, 50vw, 480px);
          }
          .d-board-frame{ padding:10px; }

          /* Right-column rail items align right and stack. */
          .d-turn{
            justify-self:end;
            max-width:160px;
            padding:7px 14px;
            font-size:10px;
            letter-spacing:1.2px;
            margin:0;
          }
          .d-actions{
            justify-self:end;
            background:transparent;
            padding:0;
            gap:8px;
          }
          .d-act{ width:40px; height:40px; font-size:16px; }
        }
      `;
      document.head.appendChild(s);
    },
  };
  window.Dama = Dama;
