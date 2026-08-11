  /* ═══════════════════════════════════════════════════════════════════
     CHESS — 1v1 standard chess. Built on the same architecture as the
     Dama module (38-dama.js) so both board games behave identically.

     ARCHITECTURE
       The 8×8 grid is built ONCE on enter. Pieces are absolutely-
       positioned divs keyed by their server-side piece id, held in a
       persistent Map. Every chess:state we DIFF:
           • piece in new state, has DOM  → translate to its new square
           • piece in new state, no DOM   → create + fade in
           • piece NOT in new state       → animate out + remove
       CSS transitions do the sliding — no teleporting, no flicker.

     COORDS
       Logical (row, col) with row 0 = black's back rank. The board
       ALWAYS shows the local player's pieces at the bottom: white sees
       display row = logical row, black sees 7 − logical row. Pieces
       stay upright (no CSS rotation).

     RULES
       100% server-authoritative. The client never validates a move — it
       reads `state.legalMoves` (from-square → destinations) purely to
       highlight, and sends one move per tap. Promotion opens a picker
       when the chosen destination carries a `promotion` flag.
     ═══════════════════════════════════════════════════════════════════ */

  const Chess = {
    /* ── State ────────────────────────────────────────────────────── */
    state:          null,
    myColor:        null,
    myId:           null,
    isSpectator:    false,
    selected:       null,          // posKey of the currently-selected piece
    _wired:         false,
    _entered:       false,
    _stylesIn:      false,
    _pieceElements: new Map(),     // pieceId → DOM element
    _boardBuilt:    false,
    _lastBoardSig:  '',
    _countdownInt:  null,
    _pendingPromo:  null,          // { from, to } awaiting a piece choice
    _flipped:       false,         // manual board flip (view from the other side)
    _showMoves:     false,         // notation panel visibility
    _premove:       null,          // {fromKey, to:{row,col}} queued during opp's turn
    _premoveSel:    null,          // fromKey while picking a pre-move destination
    _optimistic:    false,         // just applied my own move locally (skip its echo sound)

    // Pieces are INLINE SVG (never Unicode glyphs — iOS/Android colour those
    // with their own font and ignore CSS, so white pieces came out black).
    // Classic Staunton silhouettes, hand-built here (no third-party asset
    // licensing). 45×45 viewBox, each piece sitting on a tiered flared base.
    // Colour comes from .c-piece-white/.c-piece-black .c-svg { fill; stroke }.
    PIECE_SVG: {
      p: '<path d="M22.5 8.5a4.1 4.1 0 0 0-3.28 6.56 6 6 0 0 0-1.62 8.2c-3.02 1.6-5.6 5.5-5.6 11.24h20.99c0-5.74-2.58-9.64-5.6-11.24a6 6 0 0 0-1.62-8.2A4.1 4.1 0 0 0 22.5 8.5z"/>'
       + '<path d="M13.5 34.5h18l1.6 3.2H11.9zM11.4 37.7h22.2l1.4 2.8H10z"/>',
      r: '<path d="M11 9h4v2.6h4V9h5v2.6h4V9h4v6.2l-2.6 2.4v9.8l2.6 2.4v2.2H13.4v-2.2l2.6-2.4v-9.8L13.4 15.2z"/>'
       + '<path d="M15.5 27.8h14l1.3 3.4H14.2zM12.6 31.2h19.8l1.7 3.3H10.9zM10.6 34.5h23.8l1.6 3.2H9zM8.8 37.7h27.4l1.3 2.8H7.5z"/>',
      b: '<circle cx="22.5" cy="7.6" r="2.4"/>'
       + '<path d="M22.5 10.6c-.9 1.1-3.9 2-3.9 2 1.1 1.4 1 3.2.4 4.4-.9 1.8-3.9 3.4-3.9 6.6 0 2.9 2 4.6 3.4 5.5h7.9c1.5-.9 3.4-2.6 3.4-5.5 0-3.2-3-4.8-3.9-6.6-.6-1.2-.7-3 .4-4.4 0 0-2.9-.9-3.8-2z"/>'
       + '<path d="M22.5 15.4v6.4M19.6 18.6h5.8" class="c-slit"/>'
       + '<path d="M15.4 29.6h14.2l1.4 3.2H14zM12.8 32.8h19.4l1.6 3.3H11.2zM10.8 36.1h23.4l1.4 2.9H9.4z"/>',
      n: '<path d="M19 6.4c.8-1.2 2.5-1 3 .2l.5 1.1c3.6.4 7 2.4 9.2 5.6 2.4 3.5 3.3 7.8 3.3 12.8v3.3H13.6c-.2-4.8 1.4-7.6 3.8-9.9 1.8-1.7 3.8-3 3.8-3l-4.7 1.6c-1.4.5-2.8-.6-2.8-2 0-.6.2-1 .5-1.4l3-3.7c.7-.9 1-1.9 1-3z"/>'
       + '<circle cx="18.4" cy="14" r="1.3" class="c-eye"/>'
       + '<path d="M15 29.6h20l1.2 3.2H13.8zM12.8 32.8h24.4l1.4 3.3H11.4zM10.8 36.1h28.4l1.3 2.9H9.5z"/>',
      q: '<circle cx="8.8" cy="11.5" r="2.2"/><circle cx="15.4" cy="8.6" r="2.2"/><circle cx="22.5" cy="7.6" r="2.4"/>'
       + '<circle cx="29.6" cy="8.6" r="2.2"/><circle cx="36.2" cy="11.5" r="2.2"/>'
       + '<path d="M9 13.4l3.4 15.4h20.2L36 13.4l-6 6.6-3-9.2-3.4 9.6-3.6-10-3.6 10-3-9.6-3.4 9z"/>'
       + '<path d="M12 28.4h21l1.2 3.3H10.8zM10.4 31.7h24.2l1.5 3.2H8.9zM8.8 34.9h27.4l1.4 3.1H7.4z"/>',
      k: '<path d="M22.5 4.3v6.4M19.4 7.1h6.2" class="c-cross"/>'
       + '<path d="M22.5 11.3c-1.7 2.1-5.6 2.4-5.6 6.4 0 2 1.1 3.4 2.6 4.3l-5.6 4 2 3.7h13.2l2-3.7-5.6-4c1.5-.9 2.6-2.3 2.6-4.3 0-4-3.9-4.3-5.6-6.4z"/>'
       + '<path d="M13.4 29.7h18.2l1.4 3.2H12zM11 32.9h23l1.5 3.2H9.5zM9.2 36.1h26.6l1.4 2.9H7.8z"/>',
    },
    NAME:  { k:'King', q:'Queen', r:'Rook', b:'Bishop', n:'Knight', p:'Pawn' },

    /** One piece as a self-contained SVG (kept as a fallback if an image 404s). */
    pieceSVG(type, cls){
      const body = this.PIECE_SVG[type];
      if(!body) return '';
      return `<svg class="c-svg ${cls||''}" viewBox="0 0 45 45" aria-hidden="true">${body}</svg>`;
    },

    // Real 3D rendered piece (client/chesspieces/{w|b}{type}.png, extracted from
    // the user's art). Falls back to the SVG silhouette if the PNG can't load.
    pieceImg(color, type){
      const c = color === 'black' ? 'b' : 'w';
      const fallback = this.pieceSVG(type).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      return `<img class="c-pimg" src="/chesspieces/${c}${type}.png?v=2" alt=""`
           + ` onerror="this.outerHTML='${fallback}'">`;
    },

    /* ── Socket wiring ────────────────────────────────────────────── */
    bindEvents(sk){
      if(!sk || this._wired) return;
      this._wired = true;
      sk.on('chess:state',      (s) => this._onState(s));
      sk.on('chess:turn',       (d) => this._onTurn(d));
      sk.on('chess:move',       (d) => this._onMove(d));
      sk.on('chess:match_over', (d) => this._onMatchOver(d));
      sk.on('chess:auto_start', (d) => {
        if(typeof _stopRankedSearch === 'function') _stopRankedSearch();
        if(d.botName) toast(`${d.botName} joined`, 'i');
      });
      sk.on('chess:draw_offer',    (d) => this._onDrawOffer(d));
      sk.on('chess:draw_declined', (d) => {
        if(this._entered && d.by !== this.myColor) toast('Draw declined', 'i');
      });
      sk.on('chess:time_control',  (d) => {
        if(d?.timeControl) toast(`Time control: ${d.timeControl.label}`, 'i');
      });
    },

    /* ── Lifecycle ────────────────────────────────────────────────── */
    enter(){
      this._injectStyles();
      this._ensureRoot();
      document.body.classList.add('chess-active');
      try{ if(typeof MobileRotate !== 'undefined') MobileRotate.refresh(); }catch(e){}
      this._entered      = true;
      this.selected      = null;
      this._lastBoardSig = '';
      try{ VoiceChat?.listen?.(); }catch(e){}
      this._render();
      this._startCountdown();
    },

    enterSpectator(){
      this.isSpectator   = true;
      this.myId          = null;
      this.myColor       = 'white';       // fixed orientation for watchers
      this._injectStyles();
      this._ensureRoot();
      document.body.classList.add('chess-active');
      try{ if(typeof MobileRotate !== 'undefined') MobileRotate.refresh(); }catch(e){}
      this._entered      = true;
      this.selected      = null;
      this._lastBoardSig = '';
      try{ VoiceChat?.listen?.(); }catch(e){}
      const root = document.getElementById('chess-root');
      if(root && !root.querySelector('.c-spectator-badge')){
        const b = document.createElement('div');
        b.className = 'c-spectator-badge';
        b.textContent = '👁️ SPECTATING';
        root.appendChild(b);
      }
      this._render();
      this._startCountdown();
    },

    exit(){
      document.body.classList.remove('chess-active');
      try{ if(typeof MobileRotate !== 'undefined') MobileRotate.refresh(); }catch(e){}
      try{ VoiceChat?.leave?.(); }catch(e){}
      document.getElementById('chess-root')?.remove();
      document.querySelectorAll('.c-overlay').forEach(o => o.remove());
      this._entered     = false;
      this.isSpectator  = false;
      this.myColor      = null;
      this.selected     = null;
      this._boardBuilt  = false;
      this._pendingPromo = null;
      this._premove = null; this._premoveSel = null; this._optimistic = false;
      this._pieceElements.clear();
      this._lastBoardSig = '';
      this._stopCountdown();
    },

    leaveGame(){
      if(!confirm('Leave the match? Your opponent wins and you forfeit your entry.')) return;
      try{ S.socket?.emit('room:leave', {}); }catch(e){}
      this.exit();
      if(typeof goLobby === 'function') goLobby();
    },

    resign(){
      if(this.isSpectator) return;
      if(!confirm('Resign this game? Your opponent wins.')) return;
      S.socket?.emit('chess:resign', {}, (res) => {
        if(!res?.success) toast(res?.reason || 'Could not resign', 'e');
      });
    },

    toggleMic(){
      try{ if(typeof VoiceChat !== 'undefined') VoiceChat.toggle?.(); }catch(e){}
      this._refreshMicButton();
    },

    // Open a player's profile from their bar. My own → my profile card; the
    // opponent → the shared opponent-profile modal (stats + Add Friend + more),
    // the same one UNO/Ronda/Dama use, so it's consistent and professional.
    _viewProfile(id){
      if(!id) return;
      if(id === S.user?.id){
        if(typeof showProfile === 'function') return showProfile();
        return;
      }
      if(typeof showOpponentProfile === 'function') showOpponentProfile(id);
    },

    /** View the board from the other side — purely visual, no game effect. */
    flipBoard(){
      this._flipped = !this._flipped;
      this._boardBuilt = false;                 // square colours/coords re-derive
      const b = document.getElementById('c-board');
      if(b) b.innerHTML = '';
      this._pieceElements.clear();
      this._render();
    },

    toggleMoves(){
      this._showMoves = !this._showMoves;
      document.getElementById('chess-root')?.classList.toggle('c-moves-open', this._showMoves);
      this._refreshMoveList();
    },

    offerDraw(){
      if(this.isSpectator) return;
      const s = this.state;
      // If the opponent already offered, this button just accepts.
      if(s?.drawOffer && s.drawOffer !== this.myColor){
        S.socket?.emit('chess:respond_draw', { accept:true }, (r) => {
          if(!r?.success) toast(r?.reason || 'Could not accept', 'e');
        });
        return;
      }
      S.socket?.emit('chess:offer_draw', {}, (r) => {
        if(!r?.success) return toast(r?.reason || 'Could not offer', 'e');
        if(r.agreed) return;
        toast('Draw offered', 'i');
      });
    },

    _onDrawOffer(d){
      if(!this._entered || this.isSpectator) return;
      if(d.from === this.myColor) return;                 // my own offer
      document.getElementById('c-draw')?.remove();
      const ov = document.createElement('div');
      ov.id = 'c-draw';
      ov.className = 'c-overlay c-draw-ov';
      ov.innerHTML = `
        <div class="c-draw-box">
          <div class="c-draw-ic">🤝</div>
          <div class="c-draw-title">Draw offered</div>
          <div class="c-draw-sub">Your opponent offers a draw.</div>
          <div class="c-draw-row">
            <button class="c-draw-btn c-draw-no">Decline</button>
            <button class="c-draw-btn c-draw-yes">Accept</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      const respond = (accept) => {
        ov.remove();
        S.socket?.emit('chess:respond_draw', { accept }, (r) => {
          if(!r?.success) toast(r?.reason || 'Failed', 'e');
        });
      };
      ov.querySelector('.c-draw-yes').onclick = () => respond(true);
      ov.querySelector('.c-draw-no').onclick  = () => respond(false);
      requestAnimationFrame(() => ov.classList.add('show'));
    },

    /* ── Match clock ──────────────────────────────────────────────── */
    _startCountdown(){
      if(this._countdownInt) return;
      this._countdownInt = setInterval(() => this._tickCountdown(), 250);
    },
    _stopCountdown(){
      if(this._countdownInt){ clearInterval(this._countdownInt); this._countdownInt = null; }
    },
    /** Format ms as m:ss, or m:ss.t under 20s so bullet finishes read right. */
    _fmtClock(ms){
      if(ms === null || ms === undefined) return '∞';
      const t = Math.max(0, ms);
      const m = Math.floor(t / 60000);
      const s = Math.floor((t % 60000) / 1000);
      if(t < 20000) return `${m}:${String(s).padStart(2,'0')}.${Math.floor((t % 1000) / 100)}`;
      return `${m}:${String(s).padStart(2,'0')}`;
    },

    /** Each side's own clock, counting down locally between server states so
     *  the digits move smoothly (server value is the source of truth). */
    _tickCountdown(){
      const s = this.state;
      if(!s || !s.clock) return;
      const running = s.phase === 'playing' ? s.currentColor : null;
      for(const color of ['white','black']){
        const el = document.querySelector(`.c-clockbox[data-color="${color}"]`);
        if(!el) continue;
        const b = el.querySelector('b') || el;
        let ms = s.clock[color];
        if(ms !== null && ms !== undefined && color === running && s.turnStartedAt){
          // Interpolate from the last server snapshot.
          ms = Math.max(0, ms - (Date.now() - this._clockSyncedAt));
        }
        b.textContent = this._fmtClock(ms);
        el.classList.toggle('c-clock-low', ms !== null && ms < 30000);
        el.classList.toggle('c-clock-run', color === running);
      }
    },

    /* ── Coord mapping ────────────────────────────────────────────── */
    // Orientation = my colour, optionally inverted by the flip button.
    _viewBlack(){
      const base = this.myColor === 'black';
      return this._flipped ? !base : base;
    },
    _toDisplay(row, col){
      return this._viewBlack()
        ? { dRow: 7 - row, dCol: 7 - col }
        : { dRow: row,     dCol: col };
    },
    _toLogical(dRow, dCol){
      return this._viewBlack()
        ? { row: 7 - dRow, col: 7 - dCol }
        : { row: dRow,     col: dCol };
    },

    /* ── Tap handling ─────────────────────────────────────────────── */
    onSquareTap(dRow, dCol){
      if(this.isSpectator) return;
      const s = this.state;
      if(!s || s.phase !== 'playing') return;
      if(this._pendingPromo) return;              // picker is open
      const { row, col } = this._toLogical(dRow, dCol);
      const key   = `${row},${col}`;
      const piece = s.board[key];

      // ── NOT MY TURN → PRE-MOVE. Queue a move now; it fires the instant it
      //    becomes my turn (chess.com style). Re-selectable / cancellable. ──
      if(s.currentColor !== this.myColor){
        // Picking a destination for a pre-move already-selected piece.
        if(this._premoveSel){
          const [fr, fc] = this._premoveSel.split(',').map(Number);
          if(`${fr},${fc}` !== key){                       // not the same square
            this._premove = { fromKey: this._premoveSel, to:{ row, col } };
            this._premoveSel = null;
            this._refreshHighlights();
            return;
          }
        }
        // Tap my own piece → arm it as the pre-move origin.
        if(piece && piece.color === this.myColor){
          this._premoveSel = key;
          this._premove = null;
          this._refreshHighlights();
          return;
        }
        // Tap elsewhere → clear any queued pre-move.
        this._premoveSel = null; this._premove = null;
        this._refreshHighlights();
        return;
      }

      // Selected piece + tap on a legal destination → move.
      if(this.selected){
        const fromMoves = (s.legalMoves || {})[this.selected] || [];
        const dest = fromMoves.find(m => m.row === row && m.col === col);
        if(dest){
          const fromKey = this.selected;
          if(dest.promotion){
            const [fr, fc] = fromKey.split(',').map(Number);
            this._pendingPromo = { from:{ row:fr, col:fc }, to:{ row, col }, dest };
            this._showPromotionPicker();
            return;
          }
          this._playMove(fromKey, dest);
          return;
        }
      }

      // Tap own piece → select it.
      if(piece && piece.color === this.myColor){
        const legals = (s.legalMoves || {})[key];
        if(!legals || !legals.length){
          if(s.checkColor === this.myColor){
            return toast('You are in check — you must save your king', 'w');
          }
          return toast(`This ${this.NAME[piece.type] || 'piece'} has no legal moves`, 'i');
        }
        this.selected = key;
        this._refreshHighlights();
        return;
      }

      if(this.selected){
        this.selected = null;
        this._refreshHighlights();
      }
    },

    // Apply a legal move: move the piece LOCALLY first (instant, smooth) then
    // tell the server. The board mutation makes fast play feel fast — the
    // server broadcast reconciles (idempotent) right after.
    _playMove(fromKey, dest, promoType){
      const s = this.state;
      const b = s.board;
      const piece = b[fromKey];
      if(!piece){ return this._sendMove(fromKey, dest, promoType); }
      const toKey = `${dest.row},${dest.col}`;
      // optimistic board update
      delete b[fromKey];
      if(dest.captured) delete b[dest.captured];
      const moved = { ...piece };
      if(dest.promotion) moved.type = promoType || 'q';
      b[toKey] = moved;
      if(dest.castle){
        const home = piece.color === 'white' ? 7 : 0;
        if(dest.castle === 'k'){ b[`${home},5`] = b[`${home},7`]; delete b[`${home},7`]; }
        else                   { b[`${home},3`] = b[`${home},0`]; delete b[`${home},0`]; }
      }
      s.currentColor = piece.color === 'white' ? 'black' : 'white';
      s.legalMoves   = {};                          // not my turn until server confirms
      s.lastMove     = { from: fromKey, to: toKey };
      this.selected  = null;
      this._optimistic = true;                      // suppress the echo sound
      this._sound(dest.captured ? 'capture' : dest.castle ? 'castle' : 'move');
      this._render();
      this._sendMove(fromKey, dest, promoType);
    },

    _sendMove(fromKey, dest, promotion){
      if(!S.socket?.connected) return toast('Not connected', 'e');
      const [fr, fc] = (typeof fromKey === 'string')
        ? fromKey.split(',').map(Number) : [fromKey.row, fromKey.col];
      const from = { row: fr, col: fc };
      const to   = dest && typeof dest.row === 'number' ? { row: dest.row, col: dest.col } : dest;
      this.selected = null;
      this._refreshHighlights();
      S.socket.emit('chess:make_move', { from, to, promotion }, (res) => {
        if(!res?.success){
          toast(res?.reason || 'Move rejected', 'e');
          this._optimistic = false;
          // server rejected our optimistic move — ask for the authoritative state
          try{ S.socket.emit('chess:resync', {}); }catch(e){}
          this._refreshHighlights();
        }
      });
    },

    /* ── Promotion picker ─────────────────────────────────────────── */
    _showPromotionPicker(){
      document.getElementById('c-promo')?.remove();
      const color = this.myColor || 'white';
      const ov = document.createElement('div');
      ov.id = 'c-promo';
      ov.className = 'c-overlay c-promo-ov';
      ov.innerHTML = `
        <div class="c-promo-box">
          <div class="c-promo-title">Promote your pawn</div>
          <div class="c-promo-row">
            ${['q','r','b','n'].map(t => `
              <button class="c-promo-btn c-piece-${color}" data-t="${t}" title="${this.NAME[t]}">
                <span class="c-promo-glyph">${this.pieceImg(color, t)}</span>
                <span class="c-promo-lbl">${this.NAME[t]}</span>
              </button>`).join('')}
          </div>
        </div>`;
      document.body.appendChild(ov);
      const finish = (t) => {
        const p = this._pendingPromo;
        this._pendingPromo = null;
        ov.remove();
        if(p) this._playMove(`${p.from.row},${p.from.col}`, p.dest, t);
      };
      ov.querySelectorAll('.c-promo-btn').forEach(b => { b.onclick = () => finish(b.dataset.t); });
      // Tapping the backdrop = queen (the overwhelmingly common choice).
      ov.addEventListener('click', (e) => { if(e.target === ov) finish('q'); });
      requestAnimationFrame(() => ov.classList.add('show'));
    },

    /* ── Server events ────────────────────────────────────────────── */
    _onState(s){
      this.state = s;
      this._clockSyncedAt = Date.now();   // anchor for smooth local ticking

      if(S.isSpectator){
        this.isSpectator = true;
        this.myId = null;
        if(!this.myColor) this.myColor = 'white';
        const onGameScreen = document.getElementById('game-screen')?.classList.contains('active');
        const rootLive     = !!document.getElementById('chess-root');
        if(s.phase === 'playing' && (!this._entered || !onGameScreen || !rootLive)){
          S.currentRoomType = 'CHESS';
          if(typeof _stopRankedSearch === 'function') _stopRankedSearch();
          if(typeof showScreen === 'function') showScreen('game-screen');
          this.enterSpectator();
        }
      } else {
        if(S.user?.id){
          this.myId = S.user.id;
          const me = s.players?.find(p => p.id === this.myId);
          if(me) this.myColor = me.color;
        }
        const onGameScreen = document.getElementById('game-screen')?.classList.contains('active');
        const rootLive     = !!document.getElementById('chess-root');
        if(s.phase === 'playing' && (!this._entered || !onGameScreen || !rootLive)){
          S.currentRoomType = 'CHESS';
          if(typeof _stopRankedSearch === 'function') _stopRankedSearch();
          if(typeof showScreen === 'function') showScreen('game-screen');
          this.enter();
        }
      }
      if(this._entered) this._render();
      // A queued PRE-MOVE fires the instant it becomes my turn — if it's still
      // legal in the fresh position. Otherwise it's silently dropped.
      if(this._entered && !this.isSpectator && this._premove
         && s.phase === 'playing' && s.currentColor === this.myColor){
        const pm = this._premove; this._premove = null;
        const dests = (s.legalMoves || {})[pm.fromKey] || [];
        const dest = dests.find(d => d.row === pm.to.row && d.col === pm.to.col);
        if(dest){
          if(dest.promotion){ this._playMove(pm.fromKey, dest, 'q'); }   // premove auto-queens
          else              { this._playMove(pm.fromKey, dest); }
        } else {
          this._refreshHighlights();   // illegal now → clear the pre-move marks
        }
      }
    },

    _onTurn(){ if(this._entered) this._refreshTurnPill(); },

    _onMove(d){
      if(!this._entered) return;
      // The mover = opposite of nextColor. My OWN move already played its sound
      // optimistically in _playMove, so only sound the OPPONENT's move here (a
      // check always chimes, since that's news either way).
      const moverColor = d?.nextColor === 'white' ? 'black' : 'white';
      const mine = moverColor === this.myColor;
      if(d?.check)              this._sound('check');
      else if(mine && this._optimistic){ /* already sounded */ }
      else if(d?.captured)     this._sound('capture');
      else if(d?.castle)       this._sound('castle');
      else                     this._sound('move');
      this._optimistic = false;
      if(d?.check) toast('Check!', 'w');
    },

    _onMatchOver(d){ if(this._entered){ this._sound('end'); this._showMatchOver(d); } },

    /* ── Sound ────────────────────────────────────────────────────────
       Own WebAudio (the global SFX bus is hard-muted); respects a user
       `window.soundOn === false`. Short synthesised "thock"s — no assets. */
    _sound(kind){
      try{
        if(window.soundOn === false) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if(!AC) return;
        const ctx = this._actx || (this._actx = new AC());
        if(ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        const hit = (freq, dur, type, gain, delay=0) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = type; o.frequency.setValueAtTime(freq, now+delay);
          o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*0.6), now+delay+dur);
          g.gain.setValueAtTime(0.0001, now+delay);
          g.gain.exponentialRampToValueAtTime(gain, now+delay+0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, now+delay+dur);
          o.connect(g).connect(ctx.destination);
          o.start(now+delay); o.stop(now+delay+dur+0.02);
        };
        if(kind === 'capture'){ hit(320,0.10,'triangle',0.16); hit(150,0.13,'square',0.10,0.02); }
        else if(kind === 'check'){ hit(880,0.09,'triangle',0.14); hit(1180,0.10,'sine',0.10,0.05); }
        else if(kind === 'castle'){ hit(240,0.09,'square',0.12); hit(240,0.09,'square',0.12,0.10); }
        else if(kind === 'end'){ hit(520,0.14,'sine',0.15); hit(392,0.16,'sine',0.13,0.10); hit(659,0.22,'sine',0.13,0.20); }
        else { hit(260,0.08,'triangle',0.13); }   // plain move
      }catch(e){}
    },

    /* ── DOM ──────────────────────────────────────────────────────── */
    _ensureRoot(){
      if(document.getElementById('chess-root')) return;
      const host = document.getElementById('game-screen') || document.body;
      const root = document.createElement('div');
      root.id = 'chess-root';
      root.innerHTML = `
        <div class="c-topbar">
          <button class="c-icon-btn" onclick="Chess.leaveGame()" title="Leave match">✕</button>
          <div class="c-tclabel" id="c-tclabel"></div>
          <div class="c-topbar-right">
            <button class="c-icon-btn" onclick="Chess.flipBoard()" title="Flip board">⇅</button>
            <button class="c-icon-btn" onclick="Chess.toggleMoves()" title="Move list">📜</button>
            <button class="c-icon-btn" id="c-micbtn" onclick="Chess.toggleMic()" title="Microphone">🎙</button>
            <button class="c-icon-btn" onclick="Chess.offerDraw()" title="Offer draw">½</button>
            <button class="c-icon-btn c-resign" onclick="Chess.resign()" title="Resign">🏳</button>
          </div>
        </div>
        <div class="c-stage">
          <div class="c-board-frame c-area-board">
            <div class="c-board" id="c-board"></div>
          </div>
          <div class="c-playerbar c-playerbar-top c-area-opp" id="c-ptop"></div>
          <div class="c-movepanel c-area-moves" id="c-movepanel"><div class="c-movepanel-h">Moves</div><div class="c-movelist" id="c-movelist"></div></div>
          <div class="c-playerbar c-playerbar-bottom c-area-me" id="c-pbottom"></div>
          <div class="c-turnpill c-area-turn" id="c-turnpill"></div>
        </div>`;
      host.appendChild(root);
      this._ensureGradients();
    },

    // Document-global gradient defs the piece SVGs reference for a metallic,
    // 3D-carved look (light = polished gold, dark = gunmetal). Injected once.
    _ensureGradients(){
      if(document.getElementById('c-graddefs')) return;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      g.id = 'c-graddefs';
      g.setAttribute('width', '0'); g.setAttribute('height', '0');
      g.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      g.innerHTML = `<defs>
        <linearGradient id="cgLight" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stop-color="#FDEFC4"/>
          <stop offset="0.32" stop-color="#F0CD73"/>
          <stop offset="0.62" stop-color="#D9A83F"/>
          <stop offset="1" stop-color="#95661D"/>
        </linearGradient>
        <linearGradient id="cgDark" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stop-color="#6E6E7C"/>
          <stop offset="0.35" stop-color="#42424E"/>
          <stop offset="0.7" stop-color="#26262E"/>
          <stop offset="1" stop-color="#101015"/>
        </linearGradient>
      </defs>`;
      document.body.appendChild(g);
    },

    _refreshMicButton(){
      const b = document.getElementById('c-micbtn');
      if(!b) return;
      const on = !!(typeof VoiceChat !== 'undefined' && VoiceChat.micOn);
      b.classList.toggle('c-mic-on', on);
    },

    _render(){
      if(!this.state) return;
      this._ensureRoot();
      this._buildBoardOnce();
      this._syncPieces();
      this._refreshHighlights();
      this._refreshTurnPill();
      this._refreshPlayerBars();
      this._refreshMoveList();
      this._refreshTcLabel();
      this._tickCountdown();
    },

    _refreshTcLabel(){
      const el = document.getElementById('c-tclabel');
      const tc = this.state?.timeControl;
      if(!el) return;
      el.textContent = tc ? tc.label : '';
      el.className = 'c-tclabel' + (tc ? ' c-tc-' + tc.cls : '');
    },

    _refreshMoveList(){
      const box = document.getElementById('c-movelist');
      const rows = this.state?.moves || [];
      if(!box) return;
      box.innerHTML = rows.length
        ? rows.map(r => `<div class="c-mvrow"><span class="c-mvn">${r.n}.</span><span class="c-mv">${r.white||''}</span><span class="c-mv">${r.black||''}</span></div>`).join('')
        : '<div class="c-mv-empty">No moves yet</div>';
      box.scrollTop = box.scrollHeight;
    },

    _buildBoardOnce(){
      if(this._boardBuilt) return;
      const board = document.getElementById('c-board');
      if(!board) return;
      board.innerHTML = '';
      for(let dRow = 0; dRow < 8; dRow++){
        for(let dCol = 0; dCol < 8; dCol++){
          const sq = document.createElement('div');
          // Colour follows the LOGICAL square so the a1-dark rule holds
          // regardless of which side the player is viewing from.
          const { row, col } = this._toLogical(dRow, dCol);
          sq.className = 'c-sq ' + (((row + col) % 2 === 0) ? 'c-sq-light' : 'c-sq-dark');
          sq.dataset.d = `${dRow},${dCol}`;
          sq.style.left = (dCol * 12.5) + '%';
          sq.style.top  = (dRow * 12.5) + '%';
          sq.onclick = () => this.onSquareTap(dRow, dCol);
          // Coordinate labels on the outer files/ranks, chess.com style.
          if(dCol === 0){
            const r = document.createElement('span');
            r.className = 'c-coord c-coord-rank';
            r.textContent = String(8 - row);
            sq.appendChild(r);
          }
          if(dRow === 7){
            const f = document.createElement('span');
            f.className = 'c-coord c-coord-file';
            f.textContent = 'abcdefgh'[col];
            sq.appendChild(f);
          }
          board.appendChild(sq);
        }
      }
      this._boardBuilt = true;
    },

    _syncPieces(){
      const board = document.getElementById('c-board');
      const s = this.state;
      if(!board || !s?.board) return;

      const seen = new Set();
      for(const [key, piece] of Object.entries(s.board)){
        const [row, col] = key.split(',').map(Number);
        const { dRow, dCol } = this._toDisplay(row, col);
        seen.add(piece.id);
        let el = this._pieceElements.get(piece.id);
        if(!el){
          el = document.createElement('div');
          el.className = `c-piece c-piece-${piece.color}`;
          el.innerHTML = `<span class="c-glyph">${this.pieceImg(piece.color, piece.type)}</span>`;
          el.dataset.type = piece.type;
          board.appendChild(el);
          this._pieceElements.set(piece.id, el);
          requestAnimationFrame(() => el.classList.add('c-piece-in'));
        } else if(el.dataset.type !== piece.type){
          // Promotion — same piece id, new type.
          el.dataset.type = piece.type;
          el.innerHTML = `<span class="c-glyph">${this.pieceImg(piece.color, piece.type)}</span>`;
          el.classList.add('c-piece-promoted');
          setTimeout(() => el.classList.remove('c-piece-promoted'), 700);
        }
        el.style.left = (dCol * 12.5) + '%';
        el.style.top  = (dRow * 12.5) + '%';
        el.classList.toggle('c-piece-check',
          piece.type === 'k' && s.checkColor === piece.color);
      }

      // Captured pieces fade out and go.
      for(const [id, el] of this._pieceElements){
        if(seen.has(id)) continue;
        el.classList.add('c-piece-out');
        setTimeout(() => el.remove(), 260);
        this._pieceElements.delete(id);
      }
    },

    _refreshHighlights(){
      const board = document.getElementById('c-board');
      const s = this.state;
      if(!board || !s) return;
      board.querySelectorAll('.c-sq').forEach(sq => {
        sq.classList.remove('c-sel','c-dest','c-dest-cap','c-last','c-pre');
      });
      const sqAt = (row, col) => {
        const { dRow, dCol } = this._toDisplay(row, col);
        return board.querySelector(`.c-sq[data-d="${dRow},${dCol}"]`);
      };
      // Last move trail
      if(s.lastMove){
        for(const k of [s.lastMove.from, s.lastMove.to]){
          if(!k) continue;
          const [r, c] = k.split(',').map(Number);
          sqAt(r, c)?.classList.add('c-last');
        }
      }
      // PRE-MOVE marks (orange) — the queued origin, or the full from→to pair.
      if(this._premoveSel){
        const [r, c] = this._premoveSel.split(',').map(Number);
        sqAt(r, c)?.classList.add('c-pre');
      }
      if(this._premove){
        const [fr, fc] = this._premove.fromKey.split(',').map(Number);
        sqAt(fr, fc)?.classList.add('c-pre');
        sqAt(this._premove.to.row, this._premove.to.col)?.classList.add('c-pre');
      }
      if(!this.selected) return;
      const [sr, sc] = this.selected.split(',').map(Number);
      sqAt(sr, sc)?.classList.add('c-sel');
      const dests = (s.legalMoves || {})[this.selected] || [];
      for(const d of dests){
        const el = sqAt(d.row, d.col);
        if(!el) continue;
        el.classList.add(d.captured ? 'c-dest-cap' : 'c-dest');
      }
    },

    _refreshTurnPill(){
      const pill = document.getElementById('c-turnpill');
      const s = this.state;
      if(!pill || !s) return;
      if(s.phase !== 'playing'){ pill.textContent = ''; pill.className = 'c-turnpill'; return; }
      const mine = s.currentColor === this.myColor && !this.isSpectator;
      const inCheck = s.checkColor === s.currentColor;
      const who = this.isSpectator
        ? (s.currentColor === 'white' ? 'White to move' : 'Black to move')
        : (mine ? 'YOUR TURN' : "Opponent's turn");
      pill.textContent = inCheck ? `${who} — CHECK!` : who;
      pill.className = 'c-turnpill' + (mine ? ' c-turn-mine' : '') + (inCheck ? ' c-turn-check' : '');
    },

    _refreshPlayerBars(){
      const s = this.state;
      if(!s?.players) return;
      const meColor  = this.myColor || 'white';
      const oppColor = meColor === 'white' ? 'black' : 'white';
      const find = (c) => s.players.find(p => p.color === c);
      const capt = s.capturedBy || { white:[], black:[] };
      const mat  = s.material  || { white:0, black:0 };

      const bar = (p, color, taken) => {
        if(!p) return '';
        const av = (p.avatar && /^(\/|data:|https?:)/.test(p.avatar))
          ? `<span class="c-av" style="background-image:url('${p.avatar}')"></span>`
          : `<span class="c-av c-av-letter">${(p.username||'?').charAt(0).toUpperCase()}</span>`;
        // Captured pieces sorted heavy→light so the strip reads cleanly.
        const order = { q:0, r:1, b:2, n:3, p:4 };
        const sorted = (taken || []).slice().sort((a,b)=>(order[a]??9)-(order[b]??9));
        const glyphs = sorted.map(t => `<span class="c-taken">${this.pieceImg(color, t)}</span>`).join('');
        const diff = (mat[color] || 0) - (mat[color === 'white' ? 'black' : 'white'] || 0);
        const lead = diff > 0 ? `<span class="c-lead">+${Math.round(diff/100)}</span>` : '';
        const turn = s.currentColor === color && s.phase === 'playing' ? ' c-pb-turn' : '';
        const hasClock = s.clock && s.clock[color] !== null && s.clock[color] !== undefined;
        const clock = hasClock
          ? `<div class="c-clockbox" data-color="${color}"><span class="c-clock-ico">⏱</span><b>${this._fmtClock(s.clock[color])}</b></div>`
          : '';
        // Bots carry the same verified tick as humans so they blend in.
        const badge = (typeof verifiedBadgeHTML==='function') ? verifiedBadgeHTML(p.username,{size:'xs'}) : '';
        // The whole bar is tappable → opens that player's profile (view stats,
        // add friend, etc.). A tiny 👤 hint sits by the name.
        return `<div class="c-pb c-pb-tap${turn}" onclick="Chess._viewProfile('${esc(p.id)}')" title="View ${esc(p.username)}'s profile">
            <span class="c-pb-piecedot c-pdot-${color}"></span>
            ${av}
            <div class="c-pb-info">
              <div class="c-pb-namerow">
                <span class="c-pb-name">${typeof esc==='function'?esc(p.username):p.username}</span>${badge}
                <span class="c-pb-view">👤</span>
              </div>
              <div class="c-pb-taken">${glyphs || '<span class="c-taken-none">—</span>'}${lead}</div>
            </div>
            ${clock}
          </div>`;
      };
      const top = document.getElementById('c-ptop');
      const bot = document.getElementById('c-pbottom');
      // Opponent on top, me on the bottom — the pieces each has CAPTURED
      // are the opponent's colour, so swap the lists accordingly.
      if(top) top.innerHTML = bar(find(oppColor), oppColor, capt[oppColor]);
      if(bot) bot.innerHTML = bar(find(meColor),  meColor,  capt[meColor]);
    },

    /* ── Match over ───────────────────────────────────────────────── */
    _showMatchOver(d){
      document.getElementById('c-over')?.remove();
      const iWon  = !this.isSpectator && d.winnerColor && d.winnerColor === this.myColor;
      const draw  = !d.winnerColor;
      const REASON = {
        checkmate:             'Checkmate',
        stalemate:             'Stalemate',
        insufficient_material: 'Insufficient material',
        fifty_move:            'Fifty-move rule',
        threefold_repetition:  'Threefold repetition',
        resign:                    'Resignation',
        opponent_left:             'Opponent left',
        timeout:                   'Won on time',
        timeout_vs_insufficient:   'Time out — insufficient material',
        agreement:                 'Draw by agreement',
      };
      const title = draw ? 'DRAW' : (this.isSpectator
        ? (d.winnerColor === 'white' ? 'WHITE WINS' : 'BLACK WINS')
        : (iWon ? 'VICTORY' : 'DEFEAT'));
      const ov = document.createElement('div');
      ov.id = 'c-over';
      ov.className = 'c-overlay c-over-ov';
      ov.innerHTML = `
        <div class="c-over-box ${draw ? 'c-over-draw' : iWon ? 'c-over-win' : 'c-over-lose'}">
          <div class="c-over-ic">${draw ? '🤝' : iWon ? '👑' : '♟'}</div>
          <div class="c-over-title">${title}</div>
          <div class="c-over-reason">${REASON[d.reason] || d.reason || ''}</div>
          <button class="c-over-btn" onclick="Chess.exit(); if(typeof goLobby==='function') goLobby();">Back to Lobby</button>
        </div>`;
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('show'));
      try{ if(iWon && typeof confetti === 'function') confetti(); }catch(e){}
    },

    /* ── Styles ───────────────────────────────────────────────────── */
    _injectStyles(){
      if(this._stylesIn || document.getElementById('chessStyles')) return;
      this._stylesIn = true;
      const st = document.createElement('style');
      st.id = 'chessStyles';
      st.textContent = `
        body.chess-active #game-screen > *:not(#chess-root){ display:none !important; }
        /* ONE size variable drives the board, the player bars and the piece
           glyphs, so everything stays in proportion at any window size.
           The vertical budget is ~100vh minus topbar + 2 player bars + turn
           pill + gaps, hence the 78vh cap. */
        #chess-root{
          --c-board: min(96vw, 72vh);   /* portrait — fill the phone width */
          --c-gold: #C9A44A;
          position:absolute; inset:0; z-index:6;
          display:flex; align-items:center; justify-content:center;
          padding:46px 4px 6px;
          font-family:'Outfit',sans-serif; color:#fff;
          /* Warm wood wallpaper — same physical feel as the Dama board. */
          background:
            repeating-linear-gradient(90deg, rgba(0,0,0,.05) 0px, rgba(0,0,0,0) 1px, rgba(0,0,0,.035) 3px, rgba(0,0,0,0) 7px),
            repeating-linear-gradient(0deg, rgba(0,0,0,.035) 0px, rgba(0,0,0,0) 4px, rgba(0,0,0,.06) 9px, rgba(0,0,0,0) 16px),
            radial-gradient(ellipse at 50% 28%, #6b4220 0%, #3d2410 68%, #1f1106 100%);
        }
        /* STAGE — portrait: one centred column (opp · board · me · turn). */
        .c-stage{
          display:grid; gap:7px;
          grid-template-columns:min-content;
          grid-template-areas:"opp" "board" "me" "turn";
          justify-content:center; align-content:center;
        }
        .c-area-board{ grid-area:board; }
        .c-area-opp  { grid-area:opp; }
        .c-area-me   { grid-area:me; }
        .c-area-turn { grid-area:turn; justify-self:center; }
        .c-area-moves{ grid-area:moves; display:none; }
        /* WIDE / LANDSCAPE — board fills the height on the left, a side column
           (opponent · move list · me · turn) uses the horizontal space so the
           screen is filled edge-to-edge with no dead margin. */
        @media (min-width:680px) and (min-height:380px) and (min-aspect-ratio:1/1){
          #chess-root{ --c-side:clamp(190px, 21vw, 280px);
            /* fill the FULL height (topbar sits in a slim band) or the leftover
               width, whichever is smaller — biggest possible board, no dead space. */
            --c-board:min(calc(100vh - 40px), calc(100vw - var(--c-side) - 22px));
            padding:34px 10px 6px; align-items:center; }
          /* slimmer topbar so the board can claim more height */
          .c-topbar{ top:5px; }
          .c-icon-btn{ width:30px; height:30px; font-size:14px; }
          .c-stage{
            gap:8px 14px; height:100%;
            grid-template-columns:auto var(--c-side);
            grid-template-rows:auto minmax(0,1fr) auto;
            grid-template-areas:
              "board opp"
              "board moves"
              "board me";
            align-content:center;
          }
          .c-area-board{ align-self:center; }
          .c-area-turn{ display:none; }         /* the side "to move" cue is enough */
          .c-area-moves{ display:flex; }        /* move list always visible on the side */
          .c-playerbar{ width:var(--c-side); }
        }
        /* short landscape phones — same full-height fill, tighter chrome */
        @media (min-width:680px) and (min-height:380px) and (max-height:560px) and (min-aspect-ratio:1/1){
          #chess-root{ --c-side:clamp(180px, 22vw, 250px);
            --c-board:min(calc(100vh - 44px), calc(100vw - var(--c-side) - 24px)); padding:36px 10px 6px; }
        }
        /* top bar */
        .c-topbar{ position:absolute; top:8px; left:10px; right:10px;
          display:flex; align-items:center; justify-content:space-between; gap:8px; z-index:3; }
        .c-topbar-right{ display:flex; gap:6px; }
        .c-icon-btn{ width:36px; height:36px; border-radius:10px; cursor:pointer;
          background:linear-gradient(180deg, rgba(40,36,28,.8), rgba(22,20,15,.85));
          border:1px solid rgba(201,164,74,.22);
          color:#EBD9A8; font-size:16px; display:flex; align-items:center; justify-content:center;
          box-shadow:0 3px 8px rgba(0,0,0,.3); transition:background .18s, transform .12s, border-color .18s; }
        .c-icon-btn:hover{ background:linear-gradient(180deg, rgba(56,50,36,.9), rgba(30,27,20,.9));
          border-color:rgba(201,164,74,.5); }
        .c-icon-btn:active{ transform:scale(.92); }
        .c-icon-btn.c-resign{ color:#FCA5A5; border-color:rgba(248,113,113,.35); }
        .c-icon-btn.c-mic-on{ background:rgba(34,197,94,.25); border-color:rgba(34,197,94,.6); }
        /* time-control chip */
        .c-tclabel{ padding:4px 12px; border-radius:99px; font-size:10.5px; font-weight:900;
          letter-spacing:.8px; text-transform:uppercase;
          background:rgba(0,0,0,.4); border:1px solid rgba(255,255,255,.12); }
        .c-tclabel.c-tc-bullet { color:#FCA5A5; border-color:rgba(248,113,113,.4); }
        .c-tclabel.c-tc-blitz  { color:#FCD34D; border-color:rgba(251,191,36,.4); }
        .c-tclabel.c-tc-rapid  { color:#86EFAC; border-color:rgba(34,197,94,.4); }
        .c-tclabel.c-tc-classic{ color:#93C5FD; border-color:rgba(96,165,250,.4); }
        .c-tclabel.c-tc-none   { color:#CBD5E1; }
        /* per-player clock — the prominent block on the right, chess.com style */
        .c-clockbox{ margin-left:auto; display:flex; align-items:center; gap:5px; flex-shrink:0;
          padding:6px 13px; border-radius:9px;
          background:linear-gradient(180deg, rgba(20,18,14,.92), rgba(10,9,6,.95));
          border:1px solid rgba(255,255,255,.1);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.05); }
        .c-clockbox .c-clock-ico{ font-size:11px; opacity:.55; }
        .c-clockbox b{ font-weight:900; font-size:clamp(16px, 2.3vh, 21px);
          font-variant-numeric:tabular-nums; letter-spacing:.5px; }
        .c-clockbox.c-clock-run{ background:linear-gradient(180deg, #F5F1E6, #E4DFCF);
          border-color:#C9A44A; box-shadow:0 0 16px rgba(201,164,74,.35); }
        .c-clockbox.c-clock-run b, .c-clockbox.c-clock-run .c-clock-ico{ color:#1a1712; }
        .c-clockbox.c-clock-low{ color:#FCA5A5; }
        .c-clockbox.c-clock-low.c-clock-run{ background:linear-gradient(180deg,#FEE2E2,#FCA5A5);
          border-color:#EF4444; animation:cClockPulse .9s ease-in-out infinite; }
        .c-clockbox.c-clock-low.c-clock-run b{ color:#7F1D1D; }
        @keyframes cClockPulse{ 0%,100%{ box-shadow:0 0 10px rgba(239,68,68,.4); } 50%{ box-shadow:0 0 22px rgba(239,68,68,.85); } }
        /* move list */
        .c-movepanel{ flex-direction:column; border-radius:10px; min-height:0;
          background:rgba(0,0,0,.4); border:1px solid rgba(255,255,255,.1); overflow:hidden; }
        /* portrait: 📜 toggles the move list in as an extra row */
        @media (max-aspect-ratio:1/1), (max-width:899px){
          #chess-root.c-moves-open .c-stage{ grid-template-areas:"opp" "board" "me" "turn" "moves"; }
          #chess-root.c-moves-open .c-area-moves{ display:flex; height:120px; }
        }
        .c-movepanel-h{ padding:6px 10px; font-size:10px; font-weight:900; letter-spacing:1.4px;
          text-transform:uppercase; opacity:.7; border-bottom:1px solid rgba(255,255,255,.08); }
        .c-movelist{ flex:1; overflow-y:auto; padding:4px 6px; font-size:11.5px; }
        .c-mvrow{ display:grid; grid-template-columns:26px 1fr 1fr; gap:4px; padding:2px 0; }
        .c-mvn{ opacity:.5; font-weight:700; }
        .c-mv{ font-weight:800; font-variant-numeric:tabular-nums; }
        .c-mv-empty{ opacity:.45; font-size:11px; padding:8px 2px; }
        /* draw offer */
        .c-draw-box{ background:linear-gradient(180deg,#1E1834,#0E0B1A); border:1px solid rgba(255,255,255,.12);
          border-radius:18px; padding:22px 24px; text-align:center; box-shadow:0 24px 60px rgba(0,0,0,.6);
          transform:translateY(10px) scale(.97); transition:transform .3s cubic-bezier(.18,1.3,.4,1); }
        .c-overlay.show .c-draw-box{ transform:none; }
        .c-draw-ic{ font-size:38px; }
        .c-draw-title{ font-weight:900; font-size:17px; margin-top:4px; }
        .c-draw-sub{ font-size:12px; opacity:.7; margin-top:2px; }
        .c-draw-row{ display:flex; gap:10px; margin-top:16px; }
        .c-draw-btn{ flex:1; padding:10px 18px; border:none; border-radius:10px; cursor:pointer;
          font-family:'Outfit',sans-serif; font-weight:900; font-size:12.5px; }
        .c-draw-no{ background:rgba(255,255,255,.08); color:#fff; border:1px solid rgba(255,255,255,.14); }
        .c-draw-yes{ background:linear-gradient(135deg,#4ADE80,#22C55E); color:#052E14; }
        /* player bars — proper cards: colour tag · avatar · name+captured · clock.
           Portrait: match the board width. Landscape: the media query pins 300px. */
        .c-playerbar{ width:var(--c-board); max-width:100%; }
        .c-pb{ display:flex; align-items:center; gap:10px; padding:7px 12px; border-radius:12px;
          background:linear-gradient(180deg, rgba(40,36,28,.85), rgba(22,20,15,.9));
          border:1px solid rgba(201,164,74,.16);
          box-shadow:0 6px 18px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05); }
        .c-pb.c-pb-turn{ border-color:rgba(201,164,74,.7);
          box-shadow:0 0 0 1px rgba(201,164,74,.35), 0 6px 20px rgba(0,0,0,.4), 0 0 22px rgba(201,164,74,.22); }
        .c-pb-tap{ cursor:pointer; transition:transform .12s, border-color .18s; }
        .c-pb-tap:hover{ transform:translateY(-1px); border-color:rgba(201,164,74,.55); }
        .c-pb-tap:active{ transform:scale(.99); }
        .c-pb-view{ font-size:11px; opacity:.5; margin-left:2px; }
        .c-pb-tap:hover .c-pb-view{ opacity:.85; }
        .c-pb-piecedot{ width:12px; height:12px; border-radius:50%; flex-shrink:0;
          border:1.5px solid rgba(0,0,0,.55); box-shadow:0 1px 3px rgba(0,0,0,.4); }
        .c-pdot-white{ background:linear-gradient(180deg,#FBFAF6,#DDD8C8); }
        .c-pdot-black{ background:linear-gradient(180deg,#3A3A44,#181820); }
        .c-av{ width:38px; height:38px; border-radius:50%; flex-shrink:0;
          background-size:cover; background-position:center; border:2px solid rgba(201,164,74,.45);
          box-shadow:0 2px 6px rgba(0,0,0,.4); }
        .c-av-letter{ display:flex; align-items:center; justify-content:center; font-weight:900; font-size:16px;
          background:linear-gradient(135deg,#4C1D95,#7C3AED); }
        .c-pb-info{ display:flex; flex-direction:column; gap:2px; min-width:0; }
        .c-pb-namerow{ display:flex; align-items:center; gap:4px; }
        .c-pb-name{ font-weight:900; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:.2px; }
        .c-pb-taken{ display:flex; align-items:center; gap:1px; min-height:19px; line-height:1; }
        .c-taken{ width:18px; height:18px; display:flex; align-items:center; justify-content:center; }
        .c-taken .c-pimg{ width:100%; height:100%; object-fit:contain; }
        .c-taken .c-svg{ width:16px; height:16px; }
        .c-taken-none{ opacity:.3; font-size:12px; }
        .c-lead{ margin-left:7px; font-size:12px; font-weight:900; color:#86EFAC; align-self:center; }
        /* board — premium wood frame with grain + bevel (Dama-matched) */
        .c-board-frame{ position:relative; padding:12px; border-radius:12px;
          background:
            repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.12) 5px, rgba(0,0,0,0) 10px),
            linear-gradient(160deg,#6B3A14 0%,#3F1F09 100%);
          box-shadow:0 18px 40px rgba(0,0,0,.6), inset 0 0 0 2px rgba(255,180,90,.18),
                     inset 0 -6px 12px rgba(0,0,0,.45), inset 0 6px 10px rgba(255,200,140,.10); }
        .c-board{ position:relative; width:var(--c-board); height:var(--c-board);
          border-radius:4px; overflow:hidden; box-shadow:inset 0 0 14px rgba(0,0,0,.55); }
        .c-sq{ position:absolute; width:12.5%; height:12.5%; cursor:pointer; }
        /* A faint diagonal grain rides on top of each square so the board feels
           physical + smooth (never flat), exactly like the Dama board. */
        .c-sq-light{ background:
          repeating-linear-gradient(70deg, rgba(0,0,0,.025) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.04) 5px, rgba(0,0,0,0) 9px),
          linear-gradient(140deg, #EEEAD2, #DCD3B0); }
        .c-sq-dark{  background:
          repeating-linear-gradient(70deg, rgba(0,0,0,.05) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.09) 5px, rgba(0,0,0,0) 9px),
          linear-gradient(140deg, #7C9A56, #5E7C3E); }
        .c-coord{ position:absolute; font-size:calc(var(--c-board) / 8 * 0.19);
          font-weight:900; opacity:.55; pointer-events:none; }
        .c-coord-rank{ top:2px; left:3px; }
        .c-coord-file{ bottom:1px; right:3px; }
        .c-sq-light .c-coord{ color:#739552; }
        .c-sq-dark  .c-coord{ color:#EBECD0; }
        .c-sq.c-last{ box-shadow:inset 0 0 0 100px rgba(255,214,0,.30); }
        .c-sq.c-sel{  box-shadow:inset 0 0 0 100px rgba(255,214,0,.46); }
        /* pre-move squares — orange, so a queued move reads clearly apart from
           the yellow selection/last-move without interrupting play */
        .c-sq.c-pre{ box-shadow:inset 0 0 0 100px rgba(255,120,40,.55); }
        .c-sq.c-dest::after{ content:''; position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
          width:32%; height:32%; border-radius:50%; background:rgba(20,20,20,.32); pointer-events:none;
          transition:transform .12s; }
        .c-sq.c-dest:hover::after{ transform:translate(-50%,-50%) scale(1.25); }
        .c-sq.c-dest-cap::after{ content:''; position:absolute; inset:5%; border-radius:50%;
          border:6px solid rgba(20,20,20,.32); pointer-events:none; }
        /* pieces */
        .c-piece{ position:absolute; width:12.5%; height:12.5%;
          display:flex; align-items:center; justify-content:center;
          pointer-events:none; z-index:2;
          transition:left .16s cubic-bezier(.25,.85,.35,1), top .16s cubic-bezier(.25,.85,.35,1), opacity .16s, transform .16s;
          will-change:left, top;
          opacity:0; transform:scale(.7); }
        .c-piece.c-piece-in{ opacity:1; transform:scale(1); }
        .c-piece.c-piece-out{ opacity:0; transform:scale(.5); }
        /* Real 3D piece PNGs (taller than wide) — fill the square, keep aspect,
           anchored to the base so they sit ON the square. Ground shadow adds
           depth. The SVG fallback keeps the same box. */
        .c-glyph{ width:96%; height:96%; display:flex; align-items:flex-end; justify-content:center;
          filter:drop-shadow(0 calc(var(--c-board)/8*0.05) calc(var(--c-board)/8*0.045) rgba(0,0,0,.5)); }
        .c-pimg{ width:100%; height:100%; object-fit:contain; object-position:center bottom; display:block; }
        .c-svg{ width:88%; height:88%; display:block; overflow:visible;
          stroke-linejoin:round; stroke-linecap:round; }
        /* metallic 3D fill via the document gradients; a darker rim carves the
           silhouette so both colours pop on light AND green squares. */
        .c-piece-white .c-svg{ fill:url(#cgLight); stroke:#6B4A16; stroke-width:1.1; }
        .c-piece-black .c-svg{ fill:url(#cgDark);  stroke:#050509; stroke-width:1.1; }
        /* thin detail strokes ride on top of the body */
        .c-svg .c-slit, .c-svg .c-cross{ fill:none; stroke-width:2; }
        .c-piece-white .c-svg .c-slit, .c-piece-white .c-svg .c-cross{ stroke:#6B4A16; }
        .c-piece-black .c-svg .c-slit, .c-piece-black .c-svg .c-cross{ stroke:#9A9AA8; }
        .c-piece-white .c-svg .c-eye{ fill:#4A3110; stroke:none; }
        .c-piece-black .c-svg .c-eye{ fill:#C4C4D2; stroke:none; }
        .c-piece-check .c-glyph{ animation:cCheckPulse .8s ease-in-out infinite; }
        @keyframes cCheckPulse{
          0%,100%{ filter:drop-shadow(0 0 4px rgba(239,68,68,.9)); }
          50%    { filter:drop-shadow(0 0 14px rgba(239,68,68,1)); }
        }
        .c-piece-promoted .c-glyph{ animation:cPromo .7s ease; }
        @keyframes cPromo{ 0%{ transform:scale(.5) rotate(-20deg); } 60%{ transform:scale(1.25); } 100%{ transform:scale(1); } }
        /* turn pill */
        .c-turnpill{ padding:7px 20px; border-radius:99px; font-weight:900; font-size:12.5px; letter-spacing:1.4px;
          background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); text-transform:uppercase; }
        .c-turnpill:empty{ display:none; }
        .c-turnpill.c-turn-mine{ background:linear-gradient(135deg,#34D058,#15803D); border-color:transparent;
          box-shadow:0 4px 16px rgba(34,197,94,.4); animation:cTurnPulse 2s ease-in-out infinite; }
        @keyframes cTurnPulse{ 0%,100%{ box-shadow:0 4px 16px rgba(34,197,94,.4); } 50%{ box-shadow:0 4px 24px rgba(34,197,94,.7); } }
        .c-turnpill.c-turn-check{ background:linear-gradient(135deg,#EF4444,#991B1B); border-color:transparent;
          box-shadow:0 4px 18px rgba(239,68,68,.5); animation:none; }
        .c-spectator-badge{ position:absolute; top:52px; left:50%; transform:translateX(-50%);
          padding:4px 12px; border-radius:99px; font-size:10px; font-weight:900; letter-spacing:1.4px;
          background:rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.16); }
        /* overlays */
        .c-overlay{ position:fixed; inset:0; z-index:9700; display:flex; align-items:center; justify-content:center;
          background:rgba(4,3,10,.72); backdrop-filter:blur(7px); -webkit-backdrop-filter:blur(7px);
          opacity:0; transition:opacity .25s; padding:16px; }
        .c-overlay.show{ opacity:1; }
        .c-promo-box, .c-over-box{ background:linear-gradient(180deg,#1E1834,#0E0B1A);
          border:1px solid rgba(255,255,255,.12); border-radius:18px; padding:20px 22px; text-align:center;
          box-shadow:0 24px 60px rgba(0,0,0,.6); transform:translateY(10px) scale(.97); transition:transform .3s cubic-bezier(.18,1.3,.4,1); }
        .c-overlay.show .c-promo-box, .c-overlay.show .c-over-box{ transform:none; }
        .c-promo-title{ font-weight:900; font-size:15px; margin-bottom:14px; }
        .c-promo-row{ display:flex; gap:10px; }
        .c-promo-btn{ width:66px; padding:10px 4px; border-radius:12px; cursor:pointer;
          background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); color:#fff;
          display:flex; flex-direction:column; align-items:center; gap:4px; transition:background .18s, transform .12s; }
        .c-promo-btn:hover{ background:rgba(251,191,36,.18); transform:translateY(-2px); }
        .c-promo-glyph{ width:42px; height:42px; display:flex; align-items:flex-end; justify-content:center; }
        .c-promo-glyph .c-pimg{ width:100%; height:100%; object-fit:contain; object-position:center bottom; }
        .c-promo-btn .c-svg{ stroke-width:1.5; }
        .c-promo-btn.c-piece-white .c-svg{ fill:url(#cgLight); stroke:#6B4A16; }
        .c-promo-btn.c-piece-black .c-svg{ fill:url(#cgDark); stroke:#050509; }
        .c-promo-lbl{ font-size:9.5px; font-weight:800; opacity:.75; }
        .c-over-ic{ font-size:44px; line-height:1; }
        .c-over-title{ font-family:'Bangers','Outfit',sans-serif; font-size:34px; letter-spacing:2px; margin-top:6px; }
        .c-over-win  .c-over-title{ color:#FCD34D; }
        .c-over-lose .c-over-title{ color:#FCA5A5; }
        .c-over-draw .c-over-title{ color:#CBD5E1; }
        .c-over-reason{ font-size:12.5px; font-weight:700; opacity:.72; margin-top:2px; }
        .c-over-btn{ margin-top:16px; padding:11px 26px; border:none; border-radius:11px; cursor:pointer;
          font-family:'Outfit',sans-serif; font-weight:900; font-size:13px; color:#3A2606;
          background:linear-gradient(135deg,#FCD34D,#F59E0B); box-shadow:0 6px 18px rgba(245,158,11,.35); }
        /* short screens (phone landscape) */
        /* Short screens (phone landscape): the HUD shrinks so the board can
           claim nearly all the height — it stays the hero at any size. */
        @media (max-height:560px){
          #chess-root{
            --c-board: min(94vw, 78vh);
            padding:34px 6px 4px;
          }
          .c-stage{ gap:3px; }
          .c-topbar{ top:3px; }
          .c-icon-btn{ width:25px; height:25px; font-size:11px; }
          .c-clockbox{ font-size:12px; padding:2px 7px; margin-left:6px; }
          .c-tclabel{ font-size:8.5px; padding:2px 8px; }
          .c-movepanel{ width:108px; }
          .c-movepanel-h{ padding:4px 8px; font-size:9px; }
          .c-movelist{ font-size:10.5px; }
          .c-pb{ padding:4px 9px; gap:7px; border-radius:9px; }
          .c-pb-piecedot{ width:9px; height:9px; }
          .c-av{ width:28px; height:28px; }
          .c-av-letter{ font-size:13px; }
          .c-pb-name{ font-size:12.5px; }
          .c-pb-taken{ font-size:12.5px; min-height:13px; }
          .c-clockbox{ padding:4px 10px; }
          .c-clockbox b{ font-size:15px; }
          .c-turnpill{ padding:4px 14px; font-size:10px; letter-spacing:1px; }
          .c-board-frame{ padding:6px; }
          .c-board-frame::before{ inset:4px; }
        }
      `;
      document.head.appendChild(st);
    },
  };

  window.Chess = Chess;
