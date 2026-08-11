  /* ═══════════════════════════════════════════════════════════════════
     RONDA — Moroccan 40-card Spanish-deck game (2v2 · 4 players).
     ───────────────────────────────────────────────────────────────────
     UX/UI built to the user's spec:
       • Player understands the screen in under 10 seconds.
       • 4-seat layout: ME bottom, PARTNER top, opponents left/right.
       • Table cards in the center — the largest visual area.
       • Captured piles on the left/right sides (team A vs team B).
       • Score always at the top.

       Interaction model: tap a card to SELECT (lifts visually) → tap
       the table or hit "Play" to confirm. Tapping another card in your
       hand swaps the selection.

       Animations:
         • Smooth dealing (cards fly one-by-one with 120 ms stagger).
         • Selected card lifts; last played card has a soft halo.
         • Capture: cards glow then fly toward the captor's pile.
         • Floating text for RONDA / TRINGA / MESA.

       Sound: any `SFX.play(name)` hook from 04-voice-sound.js is used
       opportunistically — degrades to silent if SFX is unavailable.

     SERVER → CLIENT EVENTS
       ronda:state / ronda:private_state   — refresh
       ronda:turn                          — turn changes
       ronda:deal                          — new hand cycle
       ronda:specials                      — Ronda / Tringa announcements
       ronda:play                          — opponent dropped a card
       ronda:capture                       — capture happened
       ronda:round_over                    — show round result modal
       ronda:match_over                    — winner overlay
     ═══════════════════════════════════════════════════════════════════ */

  const Ronda = {
    /* ── State ────────────────────────────────────────────────────── */
    state:        null,
    myHand:       [],
    myId:         null,
    mySeat:       -1,
    myTeam:       -1,
    isSpectator:  false,          // watching live, read-only (no plays)
    selectedId:   null,
    _captureFreeze: false,
    _endSweepHold:  false,    // hold the felt for the end-of-round leftover sweep
    _roundSweepFlight: false, // a round_over sweep is mid-flight
    _pendingMatchOver: null,  // match_over deferred until the sweep finishes
    _lastPlayedId: null,
    _lastPlayedBy: null,
    _wired:       false,
    _entered:     false,
    _stylesIn:    false,
    _helpShown:   false,
    _lastDealCycle: -1,

    /* ── Lifecycle ────────────────────────────────────────────────── */
    bindEvents(sk){
      if(!sk || this._wired) return;
      this._wired = true;
      sk.on('ronda:state',           (s) => this._onState(s, false));
      sk.on('ronda:private_state',   (s) => this._onState(s, true));
      sk.on('ronda:turn',            ()  => this._render());
      sk.on('ronda:deal',            (d) => this._onDeal(d));
      sk.on('ronda:specials',        (d) => this._onSpecials(d));
      sk.on('ronda:play',            (d) => this._onPlay(d));
      sk.on('ronda:capture',         (d) => this._onCapture(d));
      sk.on('ronda:round_over',      (d) => this._onRoundOver(d));
      sk.on('ronda:match_over',      (d) => this._onMatchOver(d));
      sk.on('ronda:dealer_pick',     (d) => this._onDealerPick(d));
      sk.on('ronda:declare_window',           (d) => this._onDeclareWindow(d));
      sk.on('ronda:declared',                 (d) => this._onDeclared(d));
      sk.on('ronda:declare_expired',          (d) => this._onDeclareExpired(d));
      sk.on('ronda:declare_window_closed',    ()  => this._render());
      sk.on('ronda:declarations_resolved',    (d) => this._onDeclareResolved(d));
      sk.on('ronda:chain_extend',    (d) => this._onChainExtend(d));
      sk.on('ronda:chain_settled',   (d) => this._onChainSettled(d));
      sk.on('ronda:dealer_penalty',  (d) => this._onDealerPenalty(d));
      sk.on('ronda:closing_bonus',   (d) => this._onClosingBonus(d));
      // Spectator voting — who will win. Server broadcasts the live tally to
      // watchers only; we re-render the seats so the counts + my pick show.
      sk.on('vote:tally', (d) => { this._voteTally = d?.tally || {}; this._myVote = d?.my || null; if(this.isSpectator && this._entered) this._render(); });
      sk.on('ronda:auto_start',      (d) => {
        if(d.botName) toast(`${d.botName} joined`, 'i');
        // Match just auto-started (bots filled the table). Tear down the
        // matchmaking search radar immediately so it can't linger on the
        // waiting screen; the ronda:state that follows flips us into the
        // game via the robust _onState transition.
        if(typeof _stopRankedSearch === 'function') _stopRankedSearch();
      });
    },

    enter(){
      this._injectStyles();
      this._ensureRoot();
      document.body.classList.add('ronda-active');
      this._entered = true;
      this._leftVoluntarily = false;
      this._handResyncTries = 0;            // fresh match → allow hand self-heal
      if(!this._matchT0) this._matchT0 = Date.now();   // match duration for the result header
      // My equipped RANK ARENA table → swap the drawn oval for the real table
      // artwork (full-scene backdrop, exactly like the reward image). Any other
      // felt keeps the classic drawn table. Catalog may still be loading on a
      // hard refresh straight into a game — retry once when it lands.
      this._applyMyArenaFelt();
      this.selectedId = null;
      // Surface the in-game floating buttons (chat fab + emoji + MIC)
      // exactly the way UNO does on game-screen entry. showChatFab(true)
      // adds the .visible class to #micBtn so the voice chat toggle
      // appears at the bottom-right corner during the match.
      if(typeof showChatFab === 'function') showChatFab(true);
      // Listen-only voice the moment the player sits down at the felt —
      // they hear everyone else's mic without having to turn on theirs.
      try{ VoiceChat?.listen?.(); }catch(e){}
      this._render();
      // A deal that landed before the screen was ready → run its face-down
      // ceremony now (otherwise the opening hand would just appear face-up).
      if(this._pendingDeal){ const pd = this._pendingDeal; this._pendingDeal = null; this._onDeal(pd); }
    },

    // Read-only spectator entry. Anchors the layout on seat 0 (rendered
    // at the bottom) with the other three players around the felt. No
    // hand interaction, no declaration buttons — just watch the play.
    enterSpectator(){
      this.isSpectator = true;
      this.myId = null;
      this.myTeam = -1;
      this.mySeat = 0;             // anchor seat (bottom of the table)
      this._specFeltApplied = null;   // re-resolve the watched table felt
      this._injectStyles();
      this._ensureRoot();
      document.body.classList.add('ronda-active');
      this._entered = true;
      this._leftVoluntarily = false;
      this.selectedId = null;
      if(typeof showChatFab === 'function') showChatFab(true);
      try{ VoiceChat?.listen?.(); }catch(e){}
      this._showSpectatorBadge();
      this._render();
    },

    _showSpectatorBadge(){
      const root = document.getElementById('ronda-root');
      if(!root || root.querySelector('.r-spectator-badge')) return;
      const b = document.createElement('div');
      b.className = 'r-spectator-badge';
      b.textContent = '👁️ SPECTATING';
      root.appendChild(b);
    },

    exit(){
      document.body.classList.remove('ronda-active');
      document.getElementById('ronda-root')?.remove();
      document.querySelectorAll('.r-overlay, .r-bigtoast, .r-float').forEach(o => o.remove());
      this._matchT0 = null;                 // next match gets a fresh duration clock
      document.body.classList.remove('ronda-felt-art');   // arena backdrop off outside the game
      // Hide the chat fab / mic / emoji floating buttons + drop the
      // voice channel if we were live.
      if(typeof showChatFab === 'function') showChatFab(false);
      try{ VoiceChat?.leave?.(); }catch(e){}
      this._entered = false;
      // Clear the "left voluntarily" guard on teardown. If it stayed true, the
      // NEXT match's ronda:state was ignored forever (the _onState guard blocks
      // on it), leaving the player stuck on the "Game Room" screen until a
      // refresh. Stray events from the OLD room are still blocked by !S.roomId.
      this._leftVoluntarily = false;
      this.isSpectator = false;
      this.state    = null;
      this.myHand   = [];
      this.selectedId = null;
      this._lastPlayedId = null;
      this._lastPlayedBy = null;
      this._captureFreeze = false;
      this._endSweepHold = false;
      this._roundSweepFlight = false;
      this._pendingMatchOver = null;
      this._dealingInProgress = false;
      this._pendingDeal = null;
      clearTimeout(this._lpTimer);
      clearTimeout(this._capTimer);
      clearTimeout(this._chainSettleTimer);
      clearTimeout(this._dealRevealTimer);
      clearTimeout(this._dealSafetyTimer);
      clearTimeout(this._resultTimer);
      if(this._declTickTimer){ clearInterval(this._declTickTimer); this._declTickTimer = null; }
      this._lastDealCycle = -1;
    },

    /* ── Action bar ───────────────────────────────────────────────── */
    showHelp(){ this._buildHelpOverlay(); },
    leaveGame(){
      // Spectators just stop watching — no forfeit, no confirm dialog.
      if(this.isSpectator){
        this._leftVoluntarily = true;
        const sock = S.socket;
        this.exit();
        if(sock && S.roomId) sock.emit('room:spectate_leave', {}, () => {});
        S.roomId = null;
        S.isSpectator = false;
        S.currentRoomType = null;
        if(typeof goLobby === 'function') goLobby();
        return;
      }
      if(!confirm('Leave the match? It will count as a forfeit.')) return;
      // Mark "left voluntarily" + drop room state IMMEDIATELY so:
      //   1. Stragglier ronda:state events arriving before the server
      //      processes our leave are ignored (see _onState guard).
      //   2. A socket reconnect after we left can't auto-rejoin the
      //      room via the connect handler (it keys off S.roomId).
      this._leftVoluntarily = true;
      const sock  = S.socket;
      const roomId = S.roomId;
      S.roomId = null;
      S.currentRoomType = null;
      this.exit();
      if(sock && roomId) sock.emit('room:leave', { roomId }, () => {});
      if(typeof goLobby === 'function') goLobby();
    },

    /* ── Player input — two-step tap-select then tap-play ────────── */
    tapCard(cardId){
      if(this.isSpectator) return;          // watchers can't play
      const s = this.state;
      if(!s || s.phase !== 'playing') return;
      if(s.currentPlayerId !== this.myId){
        return toast("It's not your turn", 'i');
      }
      // Tapping the already-selected card plays it.
      if(this.selectedId === cardId){
        this._sendPlay(cardId);
        return;
      }
      this.selectedId = cardId;
      this._renderHand();
      this._renderTable();   // refresh "tap-to-play" hint on the table
      try { typeof SFX !== 'undefined' && SFX.play && SFX.play('click'); } catch(_){}
    },

    tapTable(){
      if(this.isSpectator) return;          // watchers can't play
      const s = this.state;
      if(!s || s.phase !== 'playing') return;
      if(!this.selectedId) return;
      if(s.currentPlayerId !== this.myId) return;
      this._sendPlay(this.selectedId);
    },

    _sendPlay(cardId){
      if(!S.socket?.connected) return toast('Not connected', 'e');
      const id = cardId;
      this.selectedId = null;
      // OPTIMISTIC removal — drop the played card from my hand the instant I
      // play it, then let the server's ronda:private_state confirm (or restore
      // below if it's rejected). Without this, right at the start of a match
      // the reduced-hand private_state can lag the public state, so the card I
      // just dropped on the table still lingers face-up in my hand. Mirrors the
      // chess optimistic-move pattern.
      let restoreHand = null;
      if(Array.isArray(this.myHand)){
        const after = this.myHand.filter(c => c.id !== id);
        if(after.length !== this.myHand.length){
          restoreHand  = this.myHand;
          this.myHand  = after;
          this._renderHand();
        }
      }
      S.socket.emit('ronda:play_card', { cardId: id }, (res) => {
        if(!res?.success){
          if(restoreHand) this.myHand = restoreHand;   // rejected → put the card back
          toast(res?.reason || 'Could not play', 'e');
          this._render();
        }
      });
    },

    /** Player taps RONDA / RONDA x2 / TRINGA. Server reads the player's
     *  candidate list to pick the rank — we don't need to send it. */
    declareSpecial(type){
      if(this.isSpectator) return;          // watchers can't declare
      if(!S.socket?.connected) return toast('Not connected', 'e');
      if(!['ronda','ronda_x2','tringa'].includes(type)) return;
      S.socket.emit('ronda:declare', { type }, (res) => {
        if(!res?.success) toast(res?.reason || 'Could not declare', 'e');
      });
    },

    /** Spectator-only: vote which player (their team) will win. */
    voteFor(playerId){
      if(!this.isSpectator || !S.socket?.connected || !playerId) return;
      this._myVote = playerId;
      S.socket.emit('vote:spectator', { playerId }, (res) => {
        if(!res?.success) toast(res?.reason || 'Vote failed', 'e');
      });
      this._render();
    },

    /** A small vote button shown on each player (spectators only): the live
     *  vote count + whether this is my pick. */
    _voteBtnHTML(playerId){
      if(!this.isSpectator || !playerId) return '';
      const count = (this._voteTally && this._voteTally[playerId]) || 0;
      const mine  = this._myVote === playerId;
      return `<button class="r-vote-btn ${mine ? 'is-mine' : ''}"
                      onclick="event.stopPropagation();Ronda.voteFor('${esc(playerId)}')"
                      title="${mine ? 'Your pick to win' : 'Vote this player to win'}">${mine ? '⭐' : '🗳️'} ${count}</button>`;
    },

    /* ── Event handlers ───────────────────────────────────────────── */
    _onState(s, isPrivate){
      // GUARD — if we explicitly left the room (or we're not in any room
      // anymore), drop straggler state events. Without this the next
      // ronda:state pushed by the server right around the leave moment
      // would re-trigger enter() and yank the player back into the match.
      if(this._leftVoluntarily || !S.roomId){
        return;
      }
      this.state = s;
      const spectating = !!S.isSpectator;
      if(spectating){
        // Watcher: never bind to a seat. Anchor on seat 0 (bottom) and
        // route entry through enterSpectator().
        this.isSpectator = true;
        this.myId = null;
        this.myTeam = -1;
        this.mySeat = 0;
      } else {
        if(isPrivate && Array.isArray(s.myHand)) this.myHand = s.myHand;
        if(S.user?.id){
          this.myId = S.user.id;
          const me = s.players?.find(p => p.id === this.myId);
          if(me){ this.mySeat = me.seat; this.myTeam = me.team; }
        }
        // Keep MY equipped arena table applied through every state update
        // (incl. RANKED matches) — idempotent + resilient to late catalog load.
        this._applyMyArenaFelt();
      }
      // SELF-HEAL: drop a stuck deal flag so my real cards show face-up. Fires
      // when it's MY turn (must never be on-turn with a hidden hand), OR once
      // the deal ceremony's normal time has comfortably elapsed — so a lost
      // reveal can never leave the hand face-down/empty.
      if(!spectating && s.phase === 'playing' && this._dealingInProgress
         && Array.isArray(this.myHand) && this.myHand.length
         && (s.currentPlayerId === this.myId
             || (Date.now() - (this._dealStartedAt || 0)) > 4500)){
        this._dealingInProgress = false;
        clearTimeout(this._dealSafetyTimer);
      }
      // SELF-HEAL: I'm a seated player mid-match but my HAND is empty (a dropped
      // ronda:private_state). Ask the server to re-push it — a player must NEVER
      // sit at the table with no cards. Capped retries; resets when it reappears.
      if(!spectating && s.phase === 'playing'){
        const meSeat = s.players?.find(p => p.id === this.myId);
        const handMissing = meSeat && (meSeat.handSize||0) > 0
                         && (!Array.isArray(this.myHand) || this.myHand.length === 0);
        if(handMissing){
          if((this._handResyncTries||0) < 6){
            this._handResyncTries = (this._handResyncTries||0) + 1;
            clearTimeout(this._handResyncTimer);
            this._handResyncTimer = setTimeout(()=>{ try{ S.socket?.emit('ronda:resync'); }catch(e){} }, 450);
          }
        } else {
          this._handResyncTries = 0;
        }
      }
      if(s.phase === 'playing'){
        // Transition is robust against a stale `_entered` flag or a
        // missed screen switch: if the match is running but we're NOT
        // actually showing the Ronda game screen, (re)enter. This is
        // what fixes "my friend entered but I stayed on the waiting
        // screen" — the host's state arrived but the screen never
        // flipped, and the old `!this._entered` guard skipped re-entry.
        const onGameScreen = document.getElementById('game-screen')?.classList.contains('active');
        const rootLive     = !!document.getElementById('ronda-root');
        if(!this._entered || !onGameScreen || !rootLive){
          S.currentRoomType = 'RONDA';
          // Kill the matchmaking search radar if it's still up.
          if(typeof _stopRankedSearch === 'function') _stopRankedSearch();
          if(typeof showScreen === 'function') showScreen('game-screen');
          if(spectating) this.enterSpectator();
          else {
            this.enter();
            if(typeof addActivityMsg === 'function') addActivityMsg('🃏 Ronda match started!', 'game');
          }
        } else {
          this._render();
        }
      } else if(this._entered){
        this._render();
      }
    },

    _onDeal(d){
      // The first deal of a match can arrive BEFORE enter() has built the
      // screen. Dropping it here is what made the opening hand pop in face-up
      // with no ceremony — stash it and run it the moment we're entered.
      if(!this._entered){ this._pendingDeal = d; return; }
      if(d.handCycle && d.handCycle !== this._lastDealCycle){
        this._lastDealCycle = d.handCycle;
        this._playDealSound();
        // CEREMONY: card backs fly from deck → each seat, one at a time.
        //   • My hand stays FACE-DOWN through the entire ceremony so I
        //     can't see what's coming. After the last flier lands I
        //     flip them all face-up in a clean "reveal" animation.
        //   • Opponent hands always render as backs anyway.
        const perPlayer = d.isInitial ? 4 : 3;
        this._dealingInProgress = true;
        this._dealStartedAt = Date.now();
        // HARD SAFETY — independent of the ceremony's reveal timer. If that
        // timer is ever lost/cleared (or the ceremony stalls), this forces the
        // hand face-up so the player's cards can NEVER stay hidden after a deal.
        clearTimeout(this._dealSafetyTimer);
        this._dealSafetyTimer = setTimeout(() => {
          if(this._dealingInProgress){
            this._dealingInProgress = false;
            this._render();
          }
        }, 6000);
        // Each seat reveals its card backs ONE BY ONE as the fliers land
        // (instead of all 3 appearing at once). _dealShown[seat] = how many
        // have landed so far; _runDealCeremony bumps it per card.
        this._dealShown = {};
        this._render();   // force my hand to re-render face-down NOW
        // Wait until the felt/deck is actually laid out before flying cards —
        // on the FIRST deal the game screen has only just appeared, so the
        // deck measures 0px and the ceremony would silently no-op (cards just
        // pop in). Retrying across frames also lets a freshly-arrived state
        // position the deck first.
        this._startDealWhenReady(perPlayer, !!d.isInitial);
      }
    },

    _startDealWhenReady(perPlayer, isInitial, attempt = 0){
      this._renderDeckPosition();   // position the deck if state is ready
      const deckEl = document.getElementById('rDeck');
      const ready  = deckEl && deckEl.getBoundingClientRect().width > 0;
      if(!ready && attempt < 16){
        return void requestAnimationFrame(() => this._startDealWhenReady(perPlayer, isInitial, attempt + 1));
      }
      this._runDealCeremony(perPlayer);
      // Hold the "dealing" state until the LAST card has flown in AND landed,
      // so every seat's one-by-one reveal finishes before the face-up flip.
      const STAGGER = 180, FLIGHT = 600;
      const ceremonyMs = (perPlayer * 4 - 1) * STAGGER + FLIGHT + 220;
      clearTimeout(this._dealRevealTimer);
      this._dealRevealTimer = setTimeout(() => {
        this._dealingInProgress = false;
        this._dealingAnimation(isInitial);
        this._render();   // flip my hand face-up
      }, ceremonyMs);
    },

    /** Render flying card-backs from the deck pile out to every seat
     *  around the table — the visible "tfri9a" / dealing ceremony.
     *  Cards sweep me → left → top → right around the table, starting
     *  from the seat after the dealer. */
    _runDealCeremony(perPlayer){
      const fx     = document.getElementById('rFx');
      const deckEl = document.getElementById('rDeck');
      if(!fx || !deckEl || !this.state) return;
      const deckRect = deckEl.getBoundingClientRect();
      if(deckRect.width === 0) return;   // deck hidden — no animation

      const me = this.state.players?.find(p => p.id === this.myId);
      if(!me || typeof this.state.dealerSeat !== 'number') return;

      // Resolve each player's target DOM area so cards land at the
      // right seat. The sweep rotates in INCREASING off-from-me order
      // (me → left → top → right) starting after the dealer.
      const startSeat = (this.state.dealerSeat + 1) % 4;
      const targetEl = (offFromMe) => {
        if(offFromMe === 0) return document.getElementById('rMyHand');
        if(offFromMe === 1) return document.getElementById('rSeatLeft');
        if(offFromMe === 2) return document.getElementById('rSeatTop');
        return                document.getElementById('rSeatRight');
      };
      const order = [];
      const orderSeats = [];
      for(let i = 0; i < 4; i++){
        const seat = (startSeat + i) % 4;
        const off  = (seat - me.seat + 4) % 4;
        order.push(targetEl(off));
        orderSeats.push(seat);
      }

      const STAGGER = 180;       // ms between consecutive deals
      const FLIGHT  = 600;       // ms per card's flight
      const dealerArt = this._dealerCardBackArt();   // every flier uses it
      let cardIdx = 0;
      for(let round = 0; round < perPlayer; round++){
        for(let k = 0; k < order.length; k++){
          const tgt  = order[k];
          const seat = orderSeats[k];
          if(!tgt){ cardIdx++; continue; }
          const tRect = tgt.getBoundingClientRect();
          const dx = (tRect.left + tRect.width  / 2) - (deckRect.left + deckRect.width  / 2);
          const dy = (tRect.top  + tRect.height / 2) - (deckRect.top  + deckRect.height / 2);

          const flier = document.createElement('div');
          flier.className = 'r-deal-flier';
          flier.style.left   = deckRect.left + 'px';
          flier.style.top    = deckRect.top  + 'px';
          flier.style.width  = deckRect.width  + 'px';
          flier.style.height = deckRect.height + 'px';
          flier.style.setProperty('--dx', dx + 'px');
          flier.style.setProperty('--dy', dy + 'px');
          flier.style.animationDelay = (cardIdx * STAGGER) + 'ms';
          // Every flier carries the DEALER's design — they're all dealt from
          // the dealer's deck (falls back to the default back if none equipped).
          if(dealerArt){
            flier.style.background = dealerArt;
            flier.style.backgroundSize = 'cover';
            flier.style.backgroundPosition = 'center';
          }
          fx.appendChild(flier);

          // Remove after the flight finishes so the FX layer stays clean.
          setTimeout(() => flier.remove(), cardIdx * STAGGER + FLIGHT + 100);

          // The MOMENT this card lands, reveal one more back at that seat so
          // the hand visibly grows one card at a time (the "tfri9a" feel).
          const landMs = cardIdx * STAGGER + FLIGHT * 0.82;
          setTimeout(() => {
            if(!this._dealingInProgress) return;
            this._dealShown[seat] = (this._dealShown[seat] || 0) + 1;
            this._renderSeats();
            this._renderHand();
          }, landMs);
          cardIdx++;
        }
      }
    },

    _onSpecials(d){
      if(!this._entered || !d.detections?.length) return;
      for(const det of d.detections){
        const mine  = det.team === this.myTeam;
        const label = det.type === 'tringa'
          ? `TRINGA +${det.points}`
          : `RONDA +${det.points}`;
        this._floatText(label, mine ? 'win' : 'loss');
        this._playSpecialSound(det.type);
      }
    },

    _onPlay(d){
      if(!this._entered) return;
      this._playCardDropSound();
      // Track WHICH player threw the card so its land animation can fly
      // from THEIR side (bottom for me, top for partner, left/right for
      // opponents). The card lands without any yellow halo — yellow is
      // reserved for capture (eat/hit) only.
      this._lastPlayedId = d.card?.id || null;
      this._lastPlayedBy = d.playerId || null;
      // Animation lifetime ~1.6s — just long enough to follow the path.
      clearTimeout(this._lpTimer);
      this._lpTimer = setTimeout(() => {
        this._lastPlayedId = null;
        this._lastPlayedBy = null;
        this._render();
      }, 1700);
    },

    /** Slow, realistic capture sequence (~2.6 s total):
     *    PHASE 1 — DROP   (0–.9s): played card flies in and lands in slot.
     *    PHASE 2 — TARGET (.9–1.6s): captured cards pulse + glow one by
     *              one, telegraphing the chain (attack feel).
     *    PHASE 3 — FLY    (1.6–2.6s): played + captured cards travel
     *              together toward the captor's seat side and fade.
     *    PHASE 4 — SYNC   (2.6s+): unfreeze + re-render the table.
     *
     *  The flyout direction matches the captor's slot relative to me:
     *    me=bottom · partner=top · seat+1=left · seat+3=right
     *  so the cards visibly leave toward the player who took them. */
    _onCapture(d){
      if(!this._entered) return;
      const mine   = d.team === this.myTeam;
      const me     = this.state.players.find(p => p.id === this.myId);
      const cap    = this.state.players.find(p => p.id === d.playerId);
      // Direction the captured cards should fly toward.
      let dir = 'bottom';
      if(me && cap){
        const off = ((cap.seat - me.seat + 4) % 4);
        dir = off === 0 ? 'bottom' : off === 1 ? 'left' : off === 2 ? 'top' : 'right';
      }
      this._playCaptureSound();

      // Freeze table re-render while the cards play out their animation.
      this._captureFreeze = true;
      this._lastPlayedId = d.playedCard?.id || null;
      this._lastPlayedBy = d.playerId || null;
      const allIds = [d.playedCard?.id, ...(d.capturedCards || []).map(c => c.id)].filter(Boolean);
      const tbl = document.getElementById('rTable');

      // PHASE 1 — inject the played card into its rank slot so the user
      // sees it land on the table BEFORE the capture sequence. The card
      // travels FROM the captor's side (sx/sy CSS vars).
      if(tbl && d.playedCard){
        const slot = tbl.querySelector(`.r-tslot[data-rank="${d.playedCard.rank}"]`);
        if(slot){
          slot.classList.remove('r-tslot-empty');
          slot.classList.add('is-target');
          const dirV = this._getPlayerDirection(d.playerId);
          const wrapper = document.createElement('div');
          wrapper.className = 'r-tcard r-card-just-played r-card-capturing-played';
          wrapper.style.setProperty('--n', slot.querySelectorAll('.r-tcard').length);
          wrapper.style.setProperty('--sx', `${dirV.sx}px`);
          wrapper.style.setProperty('--sy', `${dirV.sy}px`);
          wrapper.style.setProperty('--srot', `${dirV.rot}deg`);
          wrapper.innerHTML = this._tableCardHTML(d.playedCard);
          slot.appendChild(wrapper);
        }
      }

      // PHASE 2 — pulse captured cards one at a time (staggered).
      const pulseClass = mine ? 'r-card-capturing-mine' : 'r-card-capturing-opp';
      // After the played card lands (~700ms), start pulsing target chain.
      setTimeout(() => {
        (d.capturedCards || []).forEach((c, i) => {
          setTimeout(() => {
            const el = tbl?.querySelector(`.r-tcard [data-cid="${CSS.escape(c.id)}"]`)?.parentElement;
            if(el) el.classList.add(pulseClass);
          }, i * 220);
        });
        // Also pulse the played card alongside the chain.
        setTimeout(() => {
          const pel = tbl?.querySelector(`.r-tcard [data-cid="${CSS.escape(d.playedCard.id)}"]`)?.parentElement;
          if(pel) pel.classList.add(pulseClass);
        }, ((d.capturedCards?.length || 0)) * 220);
      }, 700);

      // Capture text + burst removed per user spec — animations + sound
      // are enough; no overlay text on routine captures.

      if(d.mesa){
        setTimeout(() => {
          this._floatText(`MESA +1`, mine ? 'win' : 'loss');
          this._playSpecialSound('mesa');
        }, 1400);
      }

      // PHASE 3 — fly off the captured cards UNLESS this was a derba.
      // For derba the cards stay on the felt as the pending pile —
      // they only fly when the chain settles (the next player plays a
      // different rank). See _onChainSettled.
      const pulseDuration = 700 + ((d.capturedCards?.length || 0) + 1) * 220 + 200;
      if (d.isDerba){
        // Just unfreeze after the pulse so _renderTable picks up the
        // pending pile + paints it stacked in the same rank slot.
        clearTimeout(this._capTimer);
        this._capTimer = setTimeout(() => {
          this._captureFreeze = false;
          this._lastPlayedId = null;
          this._lastPlayedBy = null;
          this._render();
        }, pulseDuration + 100);
        return;
      }
      const flyClass = `r-card-flyout-${dir}`;
      const flyStart = pulseDuration;
      setTimeout(() => {
        for(const id of allIds){
          const el = tbl?.querySelector(`.r-tcard [data-cid="${CSS.escape(id)}"]`)?.parentElement;
          if(el) el.classList.add(flyClass);
        }
      }, flyStart);

      // PHASE 4 — unfreeze + re-sync after the longest path completes.
      const total = flyStart + 1100;   // 1.1s for the fly transition
      clearTimeout(this._capTimer);
      this._capTimer = setTimeout(() => {
        this._captureFreeze = false;
        this._render();
      }, total);
    },

    _onRoundOver(d){
      if(!this._entered) return;
      // HOLD the felt right away so the state broadcast that follows can't wipe
      // the leftover table cards before we animate them sweeping to the last
      // capturer. (Cleared at the end of the sweep.)
      this._endSweepHold   = true;
      this._roundSweepFlight = true;
      // Don't slam the result up the instant the round ends — wait for the
      // closing play's animation to settle (so players SEE the last card +
      // whether it captured), THEN sweep the leftover cards, THEN the note.
      this._afterFinalPlay(() => {
        if(!this._entered){ this._endSweepHold = false; this._roundSweepFlight = false; return; }
        this._sweepLeftover(d, () => {
          this._roundSweepFlight = false;
          if(!this._entered) return;
          // Final round → go straight to the match result (skip the round
          // note so only ONE panel shows). Otherwise show the round note.
          if(this._pendingMatchOver){
            const md = this._pendingMatchOver; this._pendingMatchOver = null;
            this._showMatchOver(md);
          } else {
            this._showRoundOver(d);
          }
        });
      });
    },

    _onMatchOver(d){
      if(!this._entered) return;
      // If a round-over sweep is in flight (normal match end), let THAT flow
      // show the match note once the leftover cards finish sweeping — avoids a
      // double panel + the "too fast" feel. A forfeit (opponent left) skips
      // round_over entirely, so show it directly after the usual settle.
      if(this._roundSweepFlight){ this._pendingMatchOver = d; return; }
      this._afterFinalPlay(() => { if(this._entered) this._showMatchOver(d); });
    },

    /** End of round: the cards still on the felt go to whoever made the LAST
     *  capture. Pulse them, then fly them to that team's side, THEN run `done`.
     *  Re-renders nothing until it's finished (felt is held). */
    _sweepLeftover(d, done){
      const swept = d.sweptCards || [];
      const tbl   = document.getElementById('rTable');
      const finish = () => {
        clearTimeout(this._capTimer);
        this._capTimer = setTimeout(() => {
          this._endSweepHold = false;
          this._render();
          done();
        }, 80);
      };
      if(!swept.length || !tbl){ finish(); return; }
      // Existing on-screen card elements for the leftover cards…
      const els = swept
        .map(c => tbl.querySelector(`.r-tcard [data-cid="${CSS.escape(c.id)}"]`)?.parentElement)
        .filter(Boolean);
      // …and re-inject any that aren't on the felt (defensive — a state push
      // may have slipped through and cleared them) so the sweep ALWAYS plays.
      if(els.length < swept.length){
        const have = new Set(els.map(el => el.querySelector('[data-cid]')?.getAttribute('data-cid')));
        swept.forEach(c => {
          if(have.has(String(c.id))) return;
          const slot = tbl.querySelector(`.r-tslot[data-rank="${c.rank}"]`);
          if(!slot) return;
          slot.classList.remove('r-tslot-empty');
          const wrap = document.createElement('div');
          wrap.className = 'r-tcard';
          wrap.style.setProperty('--n', slot.querySelectorAll('.r-tcard').length);
          wrap.innerHTML = this._tableCardHTML(c);
          slot.appendChild(wrap);
          els.push(wrap);
        });
      }
      if(!els.length){ finish(); return; }
      // Direction toward the last capturer's seat.
      const me  = this.state?.players?.find(p => p.id === this.myId);
      const cap = this.state?.players?.find(p => p.id === d.sweptToId);
      let dir = 'bottom';
      if(me && cap){
        const off = ((cap.seat - me.seat + 4) % 4);
        dir = off === 0 ? 'bottom' : off === 1 ? 'left' : off === 2 ? 'top' : 'right';
      }
      const mine = d.sweptTeam === this.myTeam;
      const pulseClass = mine ? 'r-card-capturing-mine' : 'r-card-capturing-opp';
      const flyClass   = `r-card-flyout-${dir}`;
      this._playCaptureSound();
      this._floatText('LAST CARDS', mine ? 'win' : 'loss');
      els.forEach((el, i) => setTimeout(() => el.classList.add(pulseClass), i * 110));
      const flyStart = els.length * 110 + 560;
      setTimeout(() => els.forEach(el => el.classList.add(flyClass)), flyStart);
      clearTimeout(this._capTimer);
      this._capTimer = setTimeout(() => {
        this._endSweepHold = false;
        this._render();
        done();
      }, flyStart + 1150);
    },

    /** Run `cb` once the closing play's animation has settled. Waits for
     *  any in-flight capture / chain-settle / deal animation to finish
     *  (so the final move is fully visible), with a guaranteed minimum
     *  pause so it never feels rushed and a hard cap so it never hangs. */
    _afterFinalPlay(cb){
      const start = Date.now();
      const MIN_WAIT = 1900;   // always pause at least this long (see the last card)
      const MAX_WAIT = 3800;   // but never wait longer than this
      clearTimeout(this._resultTimer);
      const tick = () => {
        const elapsed = Date.now() - start;
        const busy = this._captureFreeze || this._dealingInProgress;
        if(elapsed < MIN_WAIT || (busy && elapsed < MAX_WAIT)){
          this._resultTimer = setTimeout(tick, 150);
          return;
        }
        cb();
      };
      this._resultTimer = setTimeout(tick, 150);
    },

    /* ── NEW Ronda events (dealer pick, declarations, chain) ────── */

    /** Show a brief banner naming the round-1 dealer + the rank they
     *  drew. Skips the multi-round tie-break animation for now; the
     *  game state moves to the deal once the engine's pick delay
     *  elapses (4s). */
    _onDealerPick(d){
      if(!this._entered || !d?.rounds?.length) return;
      const me = this.state?.players?.find(p => p.id === this.myId);
      const dealer = this.state?.players?.find(p => p.seat === d.dealerSeat);
      if(!dealer) return;
      const final = d.rounds.at(-1).find(r => r.seat === d.dealerSeat);
      const label = (dealer.id === this.myId) ? 'YOU DEAL' : `${dealer.username.toUpperCase()} DEALS`;
      this._floatText(`${label} · drew ${final?.rank}`, 'win');
    },

    /** Engine opened the declaration window. If we have a candidate
     *  in our hand, render the RONDA / TRINGA buttons with a 10s
     *  countdown. Public state already has `declareWindow` — render
     *  goes through _renderDeclareButtons(). */
    _onDeclareWindow(d){
      if(!this._entered) return;
      this._render();
    },

    /** Someone (maybe me) just clicked their button. A short badge pops up
     *  right AT the declaring player's profile so EVERYONE at the table
     *  instantly sees WHO called RONDA / TRINGA. */
    _onDeclared(d){
      if(!this._entered) return;
      const mine = d.team === this.myTeam;
      const player = this.state?.players?.find(p => p.id === d.playerId);
      const who = player?.id === this.myId ? 'YOU' : (player?.username || 'PLAYER');
      let kind = 'RONDA';
      if (d.type === 'tringa')        kind = 'TRINGA';
      else if (d.type === 'ronda_x2') kind = 'RONDA x2';
      this._declareBanner({ playerId: d.playerId, name: who, kind, mine });
      this._render();
    },

    /** Resolve the on-screen element where a given player is shown:
     *  my own hand (bottom) or one of the three opponent seats. */
    _seatElForPlayer(playerId){
      const s = this.state;
      const me = s?.players?.find(p => p.id === this.myId);
      const pl = s?.players?.find(p => p.id === playerId);
      if(!me || !pl || typeof me.seat !== 'number' || typeof pl.seat !== 'number') return null;
      const off = (pl.seat - me.seat + 4) % 4;
      if(off === 0) return document.getElementById('rMyHand');
      if(off === 1) return document.getElementById('rSeatLeft');
      if(off === 2) return document.getElementById('rSeatTop');
      return document.getElementById('rSeatRight');
    },

    // Declaration badge — pops ABOVE the declaring player's profile so the
    // whole table sees who called it (anchored to their seat, or to my own
    // hand when it's me). Auto-clears after ~3s.
    _declareBanner({ playerId, name, kind, mine }){
      const fx = document.getElementById('rFx');
      if(!fx) return;
      const root = document.getElementById('ronda-root') || document.body;
      const rootRect = root.getBoundingClientRect();
      const seatEl = this._seatElForPlayer(playerId);
      let x = 70, y = rootRect.height - 120;          // fallback: bottom-left
      if(seatEl){
        const r = seatEl.getBoundingClientRect();
        if(r.width){
          x = (r.left - rootRect.left) + r.width / 2;
          y = (r.top  - rootRect.top) - 6;            // just above the profile
        }
      }
      const el = document.createElement('div');
      el.className = `r-seat-ronda r-seat-ronda-${kind === 'TRINGA' ? 'tringa' : 'ronda'} ${mine ? 'is-mine' : ''}`;
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      el.innerHTML = `
        <span class="r-seat-ronda-kind">${esc(kind)}!</span>
        <span class="r-seat-ronda-who">${esc(name)}</span>`;
      fx.appendChild(el);
      this._playSpecialSound(kind === 'TRINGA' ? 'tringa' : 'ronda');
      setTimeout(() => { el.classList.add('out'); }, 2700);
      setTimeout(() => { el.remove(); }, 3050);
    },

    /** End of hand cycle — winning declaration gets all the points. */
    _onDeclareResolved(d){
      if(!this._entered) return;
      const mine = d.winner.team === this.myTeam;
      const winnerPlayer = this.state?.players?.find(p => p.id === d.winner.playerId);
      const who = winnerPlayer?.id === this.myId ? 'YOU' : (winnerPlayer?.username || 'PLAYER').toUpperCase();
      let kind = 'RONDA';
      if (d.winner.type === 'tringa')        kind = 'TRINGA';
      else if (d.winner.type === 'ronda_x2') kind = 'RONDA x2';
      this._floatText(`${who} wins ${kind} · +${d.points}`, mine ? 'win' : 'loss');
      this._playSpecialSound(d.winner.type === 'tringa' ? 'tringa' : 'ronda');
    },

    /** 10s ran out. Any unclaimed Ronda hands the opposing team +1.
     *  Show a single grouped float so the table understands the
     *  penalty wave. */
    _onDeclareExpired(d){
      if(!this._entered || !d?.penalties?.length) return;
      const myTeamPenalty = d.penalties.filter(p => p.awardedTo === this.myTeam).length;
      const oppTeamPenalty = d.penalties.length - myTeamPenalty;
      if(myTeamPenalty)  this._floatText(`+${myTeamPenalty} missed Ronda`, 'win');
      if(oppTeamPenalty) this._floatText(`-${oppTeamPenalty} missed Ronda`, 'loss');
      this._render();
    },

    /** Chain extended — next player matched the pending rank. The new
     *  card joins the pending pile (stays stacked on the felt). Show a
     *  small "CHAIN ×N" float so the table sees the chain growing, but
     *  the cards themselves don't move — they just pulse briefly so
     *  the eye catches the addition. */
    _onChainExtend(d){
      if(!this._entered) return;
      const mine = d.team === this.myTeam;
      this._floatText(`CHAIN ×${d.chainLength}`, mine ? 'win' : 'loss');
      // Pulse the pending pile so it's clear "another one joined".
      const tbl = document.getElementById('rTable');
      if(tbl){
        const pulseClass = mine ? 'r-card-capturing-mine' : 'r-card-capturing-opp';
        tbl.querySelectorAll('.r-tcard-pending').forEach(el => {
          el.classList.add(pulseClass);
          setTimeout(() => el.classList.remove(pulseClass), 900);
        });
      }
    },

    /** Chain settled — the next player played a different rank, so the
     *  pending pile now belongs to the previous claimer for keeps. The
     *  whole pile lifts together, then visibly flies as a STACK toward
     *  the claimer's actual seat (or my hand if I'm the claimer), the
     *  same way a regular eaten card travels to its captor. */
    _onChainSettled(d){
      if(!this._entered) return;
      const mine = d.team === this.myTeam;
      this._floatText(`DERBA +${d.bonus}`, mine ? 'win' : 'loss');
      this._playSpecialSound('tringa');

      // Find the live DOM destination — the claimer's seat bubble, OR
      // my hand area when I'm the claimer.
      const me      = this.state.players.find(p => p.id === this.myId);
      const claimer = this.state.players.find(p => p.id === d.playerId);
      let targetEl = null;
      if(me && claimer){
        if(claimer.id === this.myId){
          targetEl = document.getElementById('rMyHand');
        } else {
          const off = ((claimer.seat - me.seat + 4) % 4);
          const seatId = off === 1 ? 'rSeatLeft'
                       : off === 2 ? 'rSeatTop'
                       : 'rSeatRight';
          targetEl = document.getElementById(seatId);
        }
      }
      const tbl = document.getElementById('rTable');
      const pendingEls = tbl ? Array.from(tbl.querySelectorAll('.r-tcard-pending')) : [];
      if(!tbl || !targetEl || !pendingEls.length) return;

      this._captureFreeze = true;
      const pulseClass = mine ? 'r-card-capturing-mine' : 'r-card-capturing-opp';

      // Phase 1 — quick lift / pulse so the pile reads as "active".
      pendingEls.forEach(el => el.classList.add(pulseClass));

      // Phase 2 — compute the per-card translate to the claimer's seat
      // and commit it as an inline transition. Each card uses its own
      // start rect, so a 3-card stack travels as a tight bundle (no card
      // peels off in the wrong direction).
      setTimeout(() => {
        const target = targetEl.getBoundingClientRect();
        const tx = target.left + target.width  / 2;
        const ty = target.top  + target.height / 2;
        pendingEls.forEach((el, i) => {
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width  / 2;
          const cy = r.top  + r.height / 2;
          const dx = tx - cx;
          const dy = ty - cy;
          // Stagger a touch so the stack arrives like a fan, not a
          // single dot — looks deliberate, not snap-disappear.
          const delay = i * 60;
          el.style.transition = `transform .85s cubic-bezier(.5,.05,.6,.4) ${delay}ms,
                                 opacity .85s ease-in ${delay}ms`;
          el.style.transform  = `translate(${dx}px, ${dy}px) scale(.32) rotate(${(i % 2 ? 14 : -14)}deg)`;
          el.style.opacity    = '0';
        });
      }, 280);

      // Phase 3 — once the slowest card has landed, unfreeze the table
      // so the next render shows the cleaned-up felt. Use its OWN timer
      // so a follow-up capture animation can't cancel it mid-flight.
      clearTimeout(this._chainSettleTimer);
      this._chainSettleTimer = setTimeout(() => {
        this._captureFreeze = false;
        this._render();
      }, 280 + 850 + (pendingEls.length - 1) * 60 + 80);
    },

    /** Dealer's last play of the round either (a) was a bare placement
     *  with no capture/no derba, or (b) was rank 1 (Ace). Either way
     *  the opposing team picks up +5. */
    _onDealerPenalty(d){
      if(!this._entered) return;
      const mineLost = d.team === this.myTeam;
      const label = d.reason === 'dealer_ace_last_card'
        ? `ACE FINISH · +${d.points}`
        : `DEALER IDLE · +${d.points}`;
      this._floatText(label, mineLost ? 'loss' : 'win');
      this._playSpecialSound('tringa');
    },

    /** NEW RULE — a player closed the final round by capturing with a
     *  rank-12 card → their OWN team is rewarded +5. */
    _onClosingBonus(d){
      if(!this._entered) return;
      const mine = d.team === this.myTeam;
      this._floatText(`12 FINISH · +${d.points}`, mine ? 'win' : 'loss');
      this._playSpecialSound('tringa');
    },

    /* ── DOM root ─────────────────────────────────────────────────── */
    _ensureRoot(){
      let root = document.getElementById('ronda-root');
      if(root) return root;
      root = document.createElement('div');
      root.id = 'ronda-root';
      root.className = 'r-root';
      // Casino-style layout — clean oval felt center, 4 seats around it,
      // score + menu pushed into the corners so the eye lands on the table.
      root.innerHTML = `
        <div class="r-bg"></div>

        <!-- Score board (top-left) — points + captured cards per team -->
        <div class="r-corner r-corner-tl">
          <div class="r-scoreboard" id="rScoreboard">
            <div class="r-sb-row r-sb-us">
              <span class="r-sb-tag">YOU</span>
              <span class="r-sb-pts" id="rSbUsPts">0</span>
              <span class="r-sb-cards"><span class="r-sb-card-ic"></span><span id="rSbUsCards">0</span></span>
            </div>
            <div class="r-sb-row r-sb-opp">
              <span class="r-sb-tag">OPP</span>
              <span class="r-sb-pts" id="rSbOppPts">0</span>
              <span class="r-sb-cards"><span class="r-sb-card-ic"></span><span id="rSbOppCards">0</span></span>
            </div>
            <div class="r-sb-target">→ 41</div>
          </div>
        </div>

        <!-- Corner buttons (top-right) -->
        <div class="r-corner r-corner-tr">
          <button class="r-corner-btn r-corner-mic" id="rCornerMic" onclick="VoiceChat.toggle()" title="Microphone">🎤</button>
          <button class="r-corner-btn" onclick="Ronda.showHelp()" title="How to play">❓</button>
          <button class="r-corner-btn r-corner-leave" onclick="Ronda.leaveGame()" title="Leave">×</button>
        </div>


        <!-- Felt table — the visual centerpiece -->
        <div class="r-felt-wrap">
          <div class="r-felt">
            <div class="r-felt-inner">
              <!-- Partner — across the table -->
              <div class="r-seat r-seat-pos r-seat-top" id="rSeatTop"></div>

              <!-- Left opponent -->
              <div class="r-seat r-seat-pos r-seat-left" id="rSeatLeft"></div>

              <!-- Right opponent -->
              <div class="r-seat r-seat-pos r-seat-right" id="rSeatRight"></div>

              <!-- Table cards (the played pile) + deck back -->
              <div class="r-table" id="rTable" onclick="Ronda.tapTable()"></div>
              <div class="r-deck" id="rDeck" title="Deck"><span id="rDeckCnt">0</span></div>
            </div>
          </div>
        </div>

        <!-- Declaration bar — RONDA / TRINGA buttons (when applicable) -->
        <div class="r-declare-bar" id="rDeclareBar"></div>

        <!-- My hand only (no profile — opponents see mine, not me) -->
        <div class="r-bottom">
          <div class="r-turn-cue" id="rTurnCue">▶ YOUR TURN</div>
          <div class="r-hand" id="rMyHand"></div>
        </div>

        <!-- Layer for floating texts / capture bursts (MESA/RONDA/TRINGA) -->
        <div class="r-fx" id="rFx"></div>
      `;
      document.body.appendChild(root);
      return root;
    },

    /* ── Render orchestration ─────────────────────────────────────── */
    _render(){
      const s = this.state;
      if(!s || !this._entered) return;
      if(this.isSpectator) this._applySpectatorFelt();
      this._renderScores();
      this._renderSeats();
      this._renderTable();
      this._renderHand();
      this._renderDeckPosition();
      this._renderDeclareButtons();
    },

    /** Spectators watch on the WATCHED player's table felt — show the anchor
     *  (seat-0) player's felt, or any non-default felt at the table, so the
     *  watcher sees a real table rather than their own default. */
    // Resolve + apply MY equipped felt as the arena backdrop (rank tables
    // only). Retries once after 1.2s in case the cosmetics catalog is still
    // loading on a cold start.
    _applyMyArenaFelt(){
      try{
        // EVERY catalog table is a full-scene arena (rank + shop + prestige):
        // if the equipped felt resolves, its art becomes the room. This runs
        // on enter() AND every state sync, so RANKED matches (and reconnects)
        // always show the player's own table.
        const mine = (S.user && S.user.equippedTableFelt) || '';
        if(!mine){ document.body.classList.remove('ronda-felt-art'); return; }
        const ok = (typeof Cosmetics !== 'undefined' && Cosmetics.applyFeltId) ? Cosmetics.applyFeltId(mine) : false;
        if(ok){ document.body.classList.add('ronda-felt-art'); return; }
        // Not resolvable YET — usually the catalog hasn't landed (deep-link
        // straight into a ranked match). Force-hydrate it ourselves, then
        // re-apply; keep the timed retry as a belt-and-braces fallback.
        if(typeof Cosmetics !== 'undefined' && typeof Cosmetics.load === 'function'
           && !(Cosmetics.tableFelts || []).length && !this._feltLoadKicked){
          this._feltLoadKicked = true;                       // one forced load per session
          Cosmetics.load().then(()=>{ if(this._entered) this._applyMyArenaFelt(); }).catch(()=>{});
          return;
        }
        if(!this._feltRetry){
          this._feltRetry = true;
          setTimeout(()=>{ this._feltRetry = false; if(this._entered) this._applyMyArenaFelt(); }, 1200);
        } else {
          document.body.classList.remove('ronda-felt-art');   // legacy/unknown id → drawn table
        }
      }catch(e){}
    },

    _applySpectatorFelt(){
      if(typeof Cosmetics === 'undefined' || !Cosmetics.applyFeltId) return;
      const players = this.state?.players || [];
      const real = (f) => f && f !== 'tfp_green';
      const anchor = players.find(p => p.seat === 0);
      const feltId = (anchor && real(anchor.tableFelt)) ? anchor.tableFelt
                   : (players.find(p => real(p.tableFelt))?.tableFelt)
                   || anchor?.tableFelt;
      if(feltId && feltId !== this._specFeltApplied){
        if(Cosmetics.applyFeltId(feltId)){
          this._specFeltApplied = feltId;
          document.body.classList.add('ronda-felt-art');   // any resolvable felt = arena art
        }
      }
    },

    /** Render the player's declaration button(s) — at most ONE per
     *  candidate type they hold. v4: no countdown, no expiry pill.
     *  The button auto-disappears the moment the engine notices that
     *  the player has played one of the pair cards (re-emitted state
     *  drops the candidate from declareWindow.candidates).
     *  Also suppressed while the deal ceremony is still running so the
     *  player isn't asked to declare before they've even seen their
     *  cards (the buttons appear the moment cards flip face-up). */
    _renderDeclareButtons(){
      const host = document.getElementById('rDeclareBar');
      if(!host) return;
      const s = this.state;
      const w = s?.declareWindow;
      // Build the EXACT HTML the player should see right now: a button only
      // if I personally still hold a live, undeclared candidate in the OPEN
      // window (and we're not mid-deal). Anything else → empty.
      let html = '';
      if(w && !w.closed && !this._dealingInProgress){
        const alreadyDeclared = new Set(w.declaredPlayerIds || []);
        const visible = (w.candidates || [])
          .filter(c => c.playerId === this.myId && !alreadyDeclared.has(c.playerId));
        html = visible.map(c => {
          let label, cls, type;
          if (c.type === 'tringa')        { label = 'TRINGA';   cls = 'r-declare r-declare-tringa';  type = 'tringa'; }
          else if (c.type === 'ronda_x2') { label = 'RONDA x2'; cls = 'r-declare r-declare-rondax2'; type = 'ronda_x2'; }
          else                             { label = 'RONDA';    cls = 'r-declare r-declare-ronda';    type = 'ronda'; }
          return `<button class="${cls}" onclick="Ronda.declareSpecial('${type}')"><span class="r-declare-lbl">${label}</span></button>`;
        }).join('');
      }
      // Only touch the DOM when the content ACTUALLY differs. This keeps the
      // live button (and its tap handler) intact between identical renders —
      // so taps never get swallowed mid-rebuild — but ALWAYS clears it the
      // instant I no longer hold a valid candidate. Fixes both "RONDA didn't
      // respond" AND "RONDA button shows when I have no pair".
      if(host.innerHTML !== html) host.innerHTML = html;
    },

    /** Park the deck pile next to the current dealer's seat — so the
     *  player whose turn it is to deal "holds" the deck visually.
     *  Slot resolved by their seat-offset from me:
     *    me      → bottom-center (below my hand)
     *    partner → top-center    (above partner's bubble)
     *    left    → left-mid
     *    right   → right-mid
     */
    _renderDeckPosition(){
      const s = this.state;
      const deck = document.getElementById('rDeck');
      if(!deck || !s) return;
      // Deck empty → nothing left to deal (last round). Drop the dealer
      // attribute so the pile hides entirely (.r-deck:not([data-dealer])
      // is display:none) — the dealing cards no longer linger on the table.
      if(!s.deckRemaining){ deck.removeAttribute('data-dealer'); return; }
      const me = s.players?.find(p => p.id === this.myId);
      let iAmDealer = false;
      if(me && typeof s.dealerSeat === 'number'){
        const off = (s.dealerSeat - me.seat + 4) % 4;
        deck.dataset.dealer = ['me','left','top','right'][off];
        iAmDealer = (off === 0);
      }
      // When I'M the dealer, park the deck in the empty space RIGHT BESIDE my
      // hand. My hand lives OUTSIDE the felt (the deck lives inside it), so the
      // felt's CSS coords can't reach it — pin the deck with fixed screen
      // coords taken from the hand's on-screen box instead. Other dealers keep
      // the CSS data-dealer placement inside the felt.
      if(iAmDealer){
        const handEl = document.getElementById('rMyHand');
        const hr = handEl && handEl.getBoundingClientRect();
        if(hr){
          const dr = deck.getBoundingClientRect();
          const dw = dr.width  || 54;
          const dh = dr.height || 78;
          // Anchor beside where the FULL hand sits (its centre + expected
          // width) — NOT the current width — so it stays put while the hand
          // is still being dealt and never overlaps the cards.
          const cardW = 104, gap = 6, cardH = 158;
          const N = Math.max((this.myHand && this.myHand.length) || 0, 3);
          const halfHand = (N * cardW + (N - 1) * gap) / 2;
          const centerX  = hr.width ? (hr.left + hr.width / 2) : hr.left;
          const boxTop   = hr.height ? hr.top : (hr.bottom - cardH);
          let left = centerX - halfHand - dw - 14;     // in the gap to the LEFT
          if(left < 8) left = centerX + halfHand + 14;  // no room → go RIGHT
          // Vertically centre on the cards, but NEVER let the pile clip past
          // the bottom edge — the hand sits low (often partly off-screen), so
          // clamp the deck to stay 100% visible.
          let top = boxTop + (cardH - dh) / 2;
          top = Math.max(8, Math.min(top, window.innerHeight - dh - 14));
          deck.style.position = 'fixed';
          deck.style.left   = Math.max(8, left) + 'px';
          deck.style.top    = top + 'px';
          deck.style.right  = 'auto';
          deck.style.bottom = 'auto';
        }
      } else {
        // Restore CSS-driven (felt-relative) placement for the other seats.
        deck.style.position = '';
        deck.style.left = ''; deck.style.top = '';
        deck.style.right = ''; deck.style.bottom = '';
      }
      // Stack thickness scales with how many cards are left — a fat pile at
      // the start of the round that visibly thins each deal until it's gone
      // (deckRemaining 0 hides it entirely → players see it was the last deal).
      const frac = Math.max(0, Math.min(1, (s.deckRemaining || 0) / 40));
      deck.style.setProperty('--sd', (2 + frac * 11).toFixed(1) + 'px');
      // The deck pile shows the CURRENT dealer's own card-back design (it's
      // their deck they're dealing from). Falls back to the CSS default back
      // when the dealer has none equipped.
      const cbArt = this._seatCardBackArt(s.dealerSeat);
      if(cbArt){
        deck.style.background = cbArt;
        deck.style.backgroundSize = 'cover';
        deck.style.backgroundPosition = 'center';
      } else {
        deck.style.background = '';
        deck.style.backgroundSize = '';
        deck.style.backgroundPosition = '';
      }
    },

    /** Direction the played card should travel FROM (the player's side).
     *    me      → from below the felt (sy positive)
     *    partner → from above (sy negative)
     *    left    → from the left (sx negative)
     *    right   → from the right (sx positive)
     *  Returns CSS-var values for the rCardLand keyframe to consume. */
    _getPlayerDirection(playerId){
      const pl = this.state?.players?.find(p => p.id === playerId);
      if(!pl) return { sx: 0, sy: -220 };
      // Anchor seat = my seat for players, seat 0 for spectators.
      const anchorSeat = this.isSpectator
        ? 0
        : (this.state?.players?.find(p => p.id === this.myId)?.seat);
      if(anchorSeat == null || anchorSeat < 0) return { sx: 0, sy: -220 };
      const off = ((pl.seat - anchorSeat + 4) % 4);
      if(off === 0) return { sx: 0,    sy:  240, rot:  -8 };  // me     → bottom
      if(off === 1) return { sx: -300, sy:  0,   rot: -18 };  // left   → left
      if(off === 2) return { sx: 0,    sy: -240, rot:   8 };  // partner→ top
      return                { sx:  300, sy:  0,   rot:  18 };  // right  → right
    },

    /** Scoreboard shows points + captured-card count for both teams.
     *  Card count matters because >20 captured = +1 per card at round end. */
    _renderScores(){
      const s = this.state;
      let us;
      if(this.isSpectator){
        // Anchor "us" on the bottom (seat-0) player's team and relabel
        // the scoreboard so there's no misleading "YOU".
        const anchor = (s.players || []).find(p => p.seat === 0);
        us = anchor ? anchor.team : 0;
        const usTag  = document.querySelector('#rScoreboard .r-sb-us .r-sb-tag');
        const oppTag = document.querySelector('#rScoreboard .r-sb-opp .r-sb-tag');
        if(usTag)  usTag.textContent  = 'TEAM A';
        if(oppTag) oppTag.textContent = 'TEAM B';
      } else {
        us = this.myTeam === 0 ? 0 : 1;
      }
      const opp = 1 - us;
      const $ = (id) => document.getElementById(id);
      // Points + captured counts reveal with a deliberate ~2s pause, then the
      // number ROLLS up to its new value — so a capture/derba doesn't snap the
      // score instantly; it lands a beat later, professionally.
      this._scoreNum('rSbUsPts',    s.teamScores[us]    || 0);
      this._scoreNum('rSbOppPts',   s.teamScores[opp]   || 0);
      this._scoreNum('rSbUsCards',  s.teamCaptured[us]  || 0);
      this._scoreNum('rSbOppCards', s.teamCaptured[opp] || 0);
      const deckCnt = $('rDeckCnt');
      if(deckCnt) deckCnt.textContent = s.deckRemaining || 0;   // deck count is live
    },

    /** Reveal a scoreboard number with a 2s suspense delay, then roll it from
     *  the old value up/down to the new one. First paint sets it instantly. */
    _scoreNum(id, target){
      const el = document.getElementById(id);
      if(!el) return;
      target = target || 0;
      if(el._scoreTarget === target) return;     // already heading there
      el._scoreTarget = target;
      // First time we see this element → no animation, just seed it.
      if(el._scoreShown == null){
        el._scoreShown = target;
        el.textContent = String(target);
        return;
      }
      clearTimeout(el._scoreTimer);
      el._scoreTimer = setTimeout(() => {
        if(el._scoreTarget !== target) return;   // superseded by a newer value
        const from = el._scoreShown;
        const start = performance.now(), dur = 650;
        const tick = (t) => {
          if(el._scoreTarget !== target) return; // superseded mid-roll
          const p = Math.min(1, (t - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          const val = Math.round(from + (target - from) * eased);
          el.textContent = String(val);
          el._scoreShown = val;
          if(p < 1) requestAnimationFrame(tick);
          else { el._scoreShown = target; el.textContent = String(target); el.classList.remove('r-sb-bump'); }
        };
        el.classList.add('r-sb-bump');
        requestAnimationFrame(tick);
      }, 2000);
    },

    _renderSeats(){
      const s = this.state;
      if(!s.players) return;
      // Anchor seat = the player rendered at the BOTTOM. For a seated
      // player that's their own seat; for a spectator we anchor on seat 0
      // and render that player at the bottom via _renderHand.
      const anchorSeat = this.isSpectator
        ? 0
        : (s.players.find(p => p.id === this.myId)?.seat);
      if(anchorSeat == null || anchorSeat < 0) return;
      const at = (offset) => s.players.find(p =>
        ((p.seat - anchorSeat + 4) % 4) === offset
      );
      // partner/across=+2 (top), +1 (left), +3 (right).
      this._renderSeat('top',   at(2));
      this._renderSeat('left',  at(1));
      this._renderSeat('right', at(3));
    },

    _renderSeat(slot, player){
      const el = document.getElementById(`rSeat${slot[0].toUpperCase()}${slot.slice(1)}`);
      if(!el) return;
      if(!player){
        el.onclick = null;
        el.innerHTML = `<div class="r-pp r-pp-empty"><div class="r-pp-head"><div class="r-pp-av">?</div><div class="r-pp-name">Waiting…</div></div></div>`;
        el.classList.remove('is-turn', 'is-partner');
        return;
      }
      const s = this.state;
      const isTurn    = s.currentPlayerId === player.id;
      const isPartner = player.team === this.myTeam;
      const isDealer  = s.dealerSeat === player.seat;
      el.classList.toggle('is-turn', isTurn);
      el.classList.toggle('is-partner', isPartner);
      el.classList.toggle('is-dealer', isDealer);
      const avStyle = (player.avatar && /^(https?:|data:|\/)/.test(player.avatar))
        ? `background-image:url('${esc(player.avatar)}')` : '';
      const initial = avStyle ? '' : esc((player.username || '?')[0]).toUpperCase();
      // During the deal ceremony show only the backs that have LANDED so far
      // (one-by-one reveal); otherwise the player's real hand size.
      const fullN = player.handSize || 0;
      const handN = this._dealingInProgress
        ? Math.min(fullN, (this._dealShown && this._dealShown[player.seat]) || 0)
        : fullN;
      // Tapping the seat opens the FULL player profile (avatar, stats,
      // Add Friend / Invite / Message …) — same rich sheet as the lobby /
      // leaderboard, not the old limited mini-modal.
      el.onclick = () => {
        if(typeof showOpponentProfile === 'function') showOpponentProfile(player.id);
        else this.showProfile(player.id);
      };
      el.innerHTML = this._playerPanelHTML(player, { isTurn, isPartner, isDealer, handN, avStyle, initial });
    },

    /** Resolve a player's equipped card-back art (a CSS background shorthand)
     *  from the broadcast cardBackId via the locally-loaded cosmetics catalog.
     *  Returns '' for unknown/default so the back falls back to its plain look. */
    _cardBackArt(id){
      if(!id || id === 'cb_default') return '';
      try{ return (window.Cosmetics?.cardBacks || []).find(c => c.id === id)?.art || ''; }
      catch(_){ return ''; }
    },
    /** Equipped card-back art for the player seated at `seat`. */
    _seatCardBackArt(seat){
      const p = (this.state?.players || []).find(pl => pl.seat === seat);
      return this._cardBackArt(p?.cardBackId);
    },
    /** The DEALER's equipped card-back art. During a deal EVERY card back —
     *  the deck, the fliers, my face-down hand, the opponents' backs — shows
     *  the dealer's design (they're dealing from their own deck). Next round's
     *  dealer deals with their own design. */
    _dealerCardBackArt(){
      const seat = this.state?.dealerSeat;
      return (typeof seat === 'number') ? this._seatCardBackArt(seat) : '';
    },

    /** ONE unified player panel used for EVERY player around the table (and
     *  the spectator's bottom seat) so all four read identically:
     *    ┌─────────────────────────────┐
     *    │ (avatar) Name ▶   🎤  [vote] │   ← header row
     *    │ 🂠 🂠 🂠            X cards    │   ← cards + count below
     *    └─────────────────────────────┘ */
    _playerPanelHTML(player, o){
      const { isTurn, isPartner, isDealer, handN, avStyle, initial } = o;
      // DURING the deal every back shows the DEALER's design (cards are coming
      // off the dealer's deck). Once the deal is done, each player's seat shows
      // THEIR OWN equipped design so everyone sees the back they picked.
      const cbArt   = this._dealingInProgress
        ? this._dealerCardBackArt()
        : this._cardBackArt(player.cardBackId);
      const cbStyle = cbArt ? `background:${cbArt};` : '';
      // Show the backs SEPARATED (each its own card, with a gap — not a glued
      // stack). No "X cards" text — just the cards, clearly visible.
      const backs   = Array.from({ length: Math.min(handN, 4) }).map((_, i) =>
        `<div class="r-cardback ${cbArt ? 'has-cb' : ''}" style="--n:${i};${cbStyle}"></div>`
      ).join('');
      const isMuted  = (typeof VoiceChat !== 'undefined' && VoiceChat.mutedPeers?.has(player.id));
      const micBtn   = `<button class="r-pp-mic ${isMuted ? 'is-muted' : ''}" title="${isMuted ? 'Unmute' : 'Mute'} this player on your end" onclick="event.stopPropagation();Ronda.toggleMutePeer('${player.id}')">${isMuted ? '🔇' : '🎤'}</button>`;
      const turnArrow = isTurn ? '<span class="r-pturn" title="Their turn">▶</span>' : '';
      const dealer    = isDealer ? '<span class="r-pp-dealer" title="Dealer">D</span>' : '';
      const pt        = isPartner ? ' <span class="r-pa">PT</span>' : '';
      // Verification seal in front of the name (gold for the dev/showcase
      // account, blue for everyone else; bots get none).
      const verified  = player.isBot ? ''
        : `<span class="profile-v4-verified r-pp-verified${(player.username||'').toLowerCase()==='mustapha' ? ' is-gold' : ''}" title="Verified">✓</span>`;
      // Turn-timer ring — fills around the frame over the server's turn
      // window (turnTimeout), synced to turnEndsAt so it shows the REAL time
      // left. When it completes a full lap the engine auto-plays (bot move).
      let ppStyle = '';
      if(isTurn){
        const s2 = this.state || {};
        const dur = s2.turnTimeout || 12000;
        // Sweep the gold ring from the TOP (0°) all the way around the frame
        // over the turn window. Sync to the real time left — BUT if turnEndsAt
        // is stale or missing (which made the ring start from the middle of the
        // frame, or stay fully yellow), start cleanly from 0 instead.
        const remain  = s2.turnEndsAt ? (s2.turnEndsAt - Date.now()) : 0;
        const elapsed = (remain > 0 && remain < dur) ? (dur - remain) : 0;
        ppStyle = `--turn-dur:${dur}ms;--turn-delay:-${elapsed}ms;`;
      }
      return `
        <div class="r-pp ${isTurn ? 'is-turn' : ''}${isPartner ? ' is-partner' : ''}" style="${ppStyle}">
          <div class="r-pp-head">
            <div class="r-pp-av" style="${avStyle}">${initial}</div>
            <div class="r-pp-name">${esc(player.username || 'Player')}${verified}${pt}${turnArrow}</div>
            ${dealer}${micBtn}${this._voteBtnHTML(player.id)}
          </div>
          <div class="r-pp-cards">${backs}</div>
        </div>`;
    },

    // Toggle local mute on a specific seat — also forces an immediate
    // seat re-render so the icon flips before the next state push.
    toggleMutePeer(peerId){
      if(typeof VoiceChat === 'undefined') return;
      VoiceChat.toggleMutePeer(peerId);
      this._renderSeats();
    },

    /** Rank-sorted table grid. Two rows, 5 columns each:
     *    Row 1: ranks 1 2 3 4 5
     *    Row 2: ranks 6 7 10 11 12
     *  Same-rank cards stack with a small offset (so you can see the
     *  count). Empty rank slots stay blank — the grid keeps positions
     *  stable across moves so the eye never has to re-find a card. */
    _renderTable(){
      const s = this.state;
      const tbl = document.getElementById('rTable');
      if(!tbl) return;
      // If we're in the middle of a capture animation OR holding the felt for
      // the end-of-round leftover sweep, do NOT re-render yet — the cards need
      // to stay put so they can pulse + fly to the last capturer first.
      if(this._captureFreeze || this._endSweepHold) return;

      const canPlay = s.currentPlayerId === this.myId && this.selectedId && s.phase === 'playing';
      tbl.classList.toggle('r-table-target', !!canPlay);

      // Cards visible on the felt = regular table cards PLUS pending
      // (derba) cards. The pending pile sits ON the felt visually until
      // the chain resolves — that's what gives the "card on top of card,
      // waiting to see if the next player will hit too" feel.
      const cards = s.table || [];
      const pending = (s.pending && s.pending.cards) || [];
      const pendingIds = new Set(pending.map(c => c.id));
      const byRank = {};
      for(const c of cards){
        (byRank[c.rank] = byRank[c.rank] || []).push({ card:c, pending:false });
      }
      for(const c of pending){
        // Pending cards always stack on TOP of any plain table card in
        // the same rank slot — they're the "freshest" play.
        (byRank[c.rank] = byRank[c.rank] || []).push({ card:c, pending:true });
      }
      // Compute the travel-from direction once if we have a recent play.
      const lpDir = this._lastPlayedId && this._lastPlayedBy
        ? this._getPlayerDirection(this._lastPlayedBy)
        : null;
      const ORDER = [1,2,3,4,5,6,7,10,11,12];
      const slots = ORDER.map(rank => {
        const inSlot = byRank[rank] || [];
        if(!inSlot.length){
          return `<div class="r-tslot r-tslot-empty" data-rank="${rank}"></div>`;
        }
        // Slot gets a "pending" badge when ANY card in it is in derba
        // limbo — keeps the visual cue tied to the whole pile, not just
        // one card.
        const slotHasPending = inSlot.some(x => x.pending);
        const stacked = inSlot.map((x, i) => {
          const c = x.card;
          const isLP = c.id === this._lastPlayedId;
          let cls = 'r-tcard';
          if (isLP) cls += ' r-card-just-played';
          if (x.pending) cls += ' r-tcard-pending';
          const style = isLP && lpDir
            ? `--n:${i}; --sx:${lpDir.sx}px; --sy:${lpDir.sy}px; --srot:${lpDir.rot}deg`
            : `--n:${i}`;
          return `<div class="${cls}" style="${style}">${this._tableCardHTML(c)}</div>`;
        }).join('');
        const slotCls = `r-tslot${slotHasPending ? ' r-tslot-pending' : ''}`;
        return `<div class="${slotCls}" data-rank="${rank}">${stacked}</div>`;
      }).join('');
      tbl.innerHTML = slots;
    },

    _tableCardHTML(card){
      const num = String(card.rank).padStart(2, '0');
      const src = `/cards/${card.suit}-${num}.webp`;
      return `<div class="r-card r-card-table" data-cid="${esc(card.id)}">
        <img src="${src}" alt="${card.suit} ${card.rank}" draggable="false" loading="lazy"/>
      </div>`;
    },

    _renderHand(){
      const handEl = document.getElementById('rMyHand');
      if(!handEl) return;
      const s = this.state;
      // Spectator: the bottom slot shows the anchor (seat-0) player as a
      // read-only seat — face-down card backs + their name + count +
      // turn cue. No interactive hand.
      if(this.isSpectator){
        const anchor = (s?.players || []).find(p => p.seat === 0);
        handEl.classList.remove('is-turn', 'is-dealing');
        if(!anchor){ handEl.innerHTML = ''; return; }
        const fullN = anchor.handSize || 0;
        const n = this._dealingInProgress
          ? Math.min(fullN, (this._dealShown && this._dealShown[anchor.seat]) || 0)
          : fullN;
        const isTurn = s.currentPlayerId === anchor.id;
        const avStyle = (anchor.avatar && /^(https?:|data:|\/)/.test(anchor.avatar))
          ? `background-image:url('${esc(anchor.avatar)}')` : '';
        const initial = avStyle ? '' : esc((anchor.username || '?')[0]).toUpperCase();
        handEl.onclick = () => { if(typeof showOpponentProfile === 'function') showOpponentProfile(anchor.id); };
        handEl.innerHTML = this._playerPanelHTML(anchor, {
          isTurn, isPartner:false, isDealer: s.dealerSeat === anchor.seat,
          handN:n, avStyle, initial,
        });
        return;
      }
      // While the deal ceremony is running, render my cards FACE-DOWN
      // — the player shouldn't peek at their hand until every flier
      // has landed. The reveal flip happens when _dealingInProgress
      // flips back to false at the end of the ceremony.
      const dealing = !!this._dealingInProgress;
      const myTurn = s && s.phase === 'playing' && s.currentPlayerId === this.myId && !dealing;
      handEl.classList.toggle('is-turn', !!myTurn);
      handEl.classList.toggle('is-dealing', dealing);
      // "YOUR TURN" cue right above my hand so I notice it's my move.
      const cue = document.getElementById('rTurnCue');
      if(cue) cue.classList.toggle('show', !!myTurn);
      if(dealing){
        // Deal phase → face-DOWN backs (the DEALER's design) build up one by
        // one right here in my hand, so I see the design as it's dealt. They
        // are placeholders driven by the landed-card COUNT — NOT by my real
        // hand (which may still be in flight from the server). Appended
        // incrementally so already-dealt backs don't re-animate as each new
        // one lands. They flip face-up only once the WHOLE deal has finished
        // (the reveal in _startDealWhenReady).
        const mySeat = s?.players?.find(p => p.id === this.myId)?.seat;
        const shown  = (this._dealShown && this._dealShown[mySeat]) || 0;
        const dealerArt = this._dealerCardBackArt();
        const cbStyle   = dealerArt ? `;background:${dealerArt};background-size:cover;background-position:center` : '';
        if(handEl.querySelectorAll('.r-card').length > shown) handEl.innerHTML = '';   // new cycle reset
        for(let i = handEl.querySelectorAll('.r-card').length; i < shown; i++){
          const d = document.createElement('div');
          d.className = 'r-card face-down';
          d.style.cssText = `--i:0${cbStyle}`;
          handEl.appendChild(d);
        }
        return;
      }
      // Normal play → my real hand, face-up.
      handEl.innerHTML = (this.myHand || []).map((c, i) =>
        this._cardHTML(c, { faceUp:true, tappable: myTurn, selected: this.selectedId === c.id, idx:i })
      ).join('');
    },

    /** Render a single Spanish card by suit/rank. With `tappable=true`
     *  the card lifts and the click handler is wired. `idx` drives the
     *  CSS `--i` variable used for staggered animations. */
    _cardHTML(card, opts = {}){
      const num = String(card.rank).padStart(2, '0');
      const src = `/cards/${card.suit}-${num}.webp`;
      const click = opts.tappable ? ` onclick="event.stopPropagation();Ronda.tapCard('${esc(card.id)}')"` : '';
      const cls = [
        'r-card',
        opts.tappable ? 'tappable' : '',
        opts.selected ? 'selected' : '',
        opts.faceUp   ? '' : 'face-down',
        opts.table    ? 'r-card-table' : '',
      ].filter(Boolean).join(' ');
      const i = opts.idx ?? -1;
      return `<div class="${cls}" data-cid="${esc(card.id)}" data-idx="${i}" style="--i:${i}"${click}>
        <img src="${src}" alt="${card.suit} ${card.rank}" draggable="false" loading="lazy"/>
      </div>`;
    },

    /* ── Dealing animation — slow casino-style stagger ───────────── */
    _dealingAnimation(isInitial){
      // Casino-style: each card visibly arrives one at a time. The CSS
      // animation timing-delay = i * 280ms, so 3 cards = ~840ms of deal
      // before the player can move. Initial deal also lays the 4 table
      // cards with the same stagger, after the hand.
      const STAGGER = 280;       // ms between consecutive cards
      const DUR     = 950;       // ms each card spends animating
      requestAnimationFrame(() => {
        document.querySelectorAll('#rMyHand .r-card').forEach((el, i) => {
          el.style.setProperty('--i', i);
          el.classList.add('r-deal-in');
          setTimeout(() => el.classList.remove('r-deal-in'), DUR + i * STAGGER);
        });
        if(isInitial){
          // Table cards arrive AFTER the hand finishes — like the dealer
          // first hands you yours then lays the felt cards.
          const handOffset = (this.myHand?.length || 3) * STAGGER;
          document.querySelectorAll('#rTable .r-tcard').forEach((el, i) => {
            el.style.setProperty('--i', i + (handOffset / STAGGER));
            el.classList.add('r-deal-in');
            setTimeout(() => el.classList.remove('r-deal-in'), DUR + handOffset + i * STAGGER);
          });
        }
      });
    },

    /* ── Floating text + bursts ──────────────────────────────────── */
    _floatText(text, kind){
      const fx = document.getElementById('rFx');
      if(!fx) return;
      const el = document.createElement('div');
      el.className = `r-float ${kind === 'win' ? 'r-float-win' : 'r-float-loss'}`;
      el.textContent = text;
      fx.appendChild(el);
      setTimeout(() => el.remove(), 1700);
    },

    _captureBurst(count, mine){
      const fx = document.getElementById('rFx');
      const tbl = document.getElementById('rTable');
      if(!fx || !tbl) return;
      // Brief glow on the table area.
      tbl.classList.add(mine ? 'r-capture-flash-mine' : 'r-capture-flash-opp');
      setTimeout(() => tbl.classList.remove('r-capture-flash-mine', 'r-capture-flash-opp'), 600);
      const burst = document.createElement('div');
      burst.className = 'r-burst' + (mine ? ' r-burst-mine' : ' r-burst-opp');
      burst.innerHTML = `<span>+${count}</span><small>captured</small>`;
      fx.appendChild(burst);
      setTimeout(() => burst.remove(), 1400);
    },

    /* ── Sounds (opportunistic) ──────────────────────────────────── */
    _playDealSound(){     try { typeof SFX !== 'undefined' && SFX.play && SFX.play('open'); } catch(_){} },
    _playCardDropSound(){ try { typeof SFX !== 'undefined' && SFX.play && SFX.play('play'); } catch(_){} },
    _playCaptureSound(){  try { typeof SFX !== 'undefined' && SFX.play && SFX.play('draw'); } catch(_){} },
    _playSpecialSound(t){
      try {
        if(typeof SFX === 'undefined' || !SFX.play) return;
        if(t === 'tringa' || t === 'mesa') SFX.play('uno');
        else                                SFX.play('win');
      } catch(_){}
    },

    /* ── Profile mini-modal (tap a seat) ──────────────────────────── */
    showProfile(playerId){
      const p = this.state?.players?.find(pp => pp.id === playerId);
      if(!p) return;
      // No profile for yourself — your seat is hidden anyway.
      if(p.id === this.myId) return;
      document.getElementById('rProfOv')?.remove();
      const ov = document.createElement('div');
      ov.id = 'rProfOv';
      ov.className = 'r-overlay r-prof-ov';
      ov.onclick = (e) => { if(e.target === ov) ov.remove(); };
      const avStyle = (p.avatar && /^(https?:|data:|\/)/.test(p.avatar))
        ? `background-image:url('${esc(p.avatar)}')` : '';
      const initial = avStyle ? '' : esc((p.username || '?')[0]).toUpperCase();
      const isPartner = p.team === this.myTeam;
      const teamTag = isPartner
        ? '<span class="r-prof-tag r-prof-tag-pt">🤝 PARTNER</span>'
        : '<span class="r-prof-tag r-prof-tag-opp">⚔️ OPPONENT</span>';
      const botBadge = '';   // bots blend in as real players — no BOT badge
      ov.innerHTML = `
        <div class="r-prof-card" onclick="event.stopPropagation()">
          <button class="r-overlay-x" onclick="document.getElementById('rProfOv').remove()">×</button>
          <div class="r-prof-av" style="${avStyle}">${initial}</div>
          <div class="r-prof-name">${esc(p.username || 'Player')}${verifiedBadgeHTML(p.username,{isBot:p.isBot,size:'sm'})}</div>
          <div class="r-prof-tags">${teamTag}${botBadge}</div>
          <div class="r-prof-stats">
            <div><div class="r-prof-stat-n">${p.handSize || 0}</div><div class="r-prof-stat-l">in hand</div></div>
            <div><div class="r-prof-stat-n">${p.capturedCount || 0}</div><div class="r-prof-stat-l">captured</div></div>
            <div><div class="r-prof-stat-n">${(p.rondas?.length || 0) + (p.tringas?.length || 0)}</div><div class="r-prof-stat-l">specials</div></div>
          </div>
          <div class="r-prof-actions">
            <button class="r-prof-btn r-prof-btn-like"
                    onclick="Ronda._likePlayer('${esc(p.id)}', this)"
                    ${p.isBot ? 'disabled' : ''}>
              ❤️ Like
            </button>
            <button class="r-prof-btn r-prof-btn-friend"
                    onclick="Ronda._inviteFriend('${esc(p.id)}', this)"
                    ${p.isBot ? 'disabled' : ''}>
              ➕ Add friend
            </button>
            <button class="r-prof-btn r-prof-btn-view"
                    onclick="Ronda._viewFullProfile('${esc(p.id)}')"
                    ${p.isBot ? 'disabled' : ''}>
              👤 View profile
            </button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('show'));
    },

    /** Best-effort hook into the existing friend system. Falls back to a
     *  generic socket emit so this still does something even if the
     *  Friends module is on a different code path. */
    _inviteFriend(playerId, btn){
      if(!S.socket?.connected) return toast?.('Not connected', 'e');
      const done = (ok, msg) => {
        if(btn){
          btn.disabled = true;
          btn.textContent = ok ? '✓ Sent' : (msg || 'Failed');
        }
        toast?.(ok ? 'Friend request sent' : (msg || 'Could not send'), ok ? 's' : 'e');
      };
      try {
        if (typeof Friends !== 'undefined' && typeof Friends.sendRequest === 'function'){
          Promise.resolve(Friends.sendRequest(playerId)).then(() => done(true), () => done(false));
          return;
        }
      } catch(_){}
      S.socket.emit('friend:request', { targetId: playerId }, (res) => {
        if(res && res.success === false) return done(false, res.reason);
        done(true);
      });
    },

    _likePlayer(playerId, btn){
      if(!S.socket?.connected) return toast?.('Not connected', 'e');
      if(btn){ btn.disabled = true; btn.textContent = '❤️ Liked'; }
      // Best-effort — the server doesn't need to acknowledge for the UX
      // to feel responsive. Toast either way.
      try {
        S.socket.emit('user:like', { targetId: playerId }, (res) => {
          if(res?.success === false) toast?.(res.reason || 'Could not like', 'e');
        });
      } catch(_){}
      toast?.('Liked!', 's');
    },

    _viewFullProfile(playerId){
      // If a global profile viewer exists, hand off to it.
      if(typeof openProfile === 'function')      return openProfile(playerId);
      if(typeof showUserProfile === 'function')  return showUserProfile(playerId);
      if(typeof Profile !== 'undefined' && Profile.open) return Profile.open(playerId);
      toast?.('Full profile — coming soon', 'i');
    },

    /* ── Overlays ─────────────────────────────────────────────────── */
    _buildHelpOverlay(){
      document.getElementById('rHelpOv')?.remove();
      const ov = document.createElement('div');
      ov.id = 'rHelpOv';
      ov.className = 'r-overlay r-help';
      ov.innerHTML = `
        <div class="r-overlay-card r-help-card">
          <button class="r-overlay-x" onclick="document.getElementById('rHelpOv').remove()">×</button>
          <div class="r-help-eyebrow">RONDA — HOW TO PLAY</div>
          <div class="r-help-rules">
            <div class="r-rule"><span class="r-rule-num">1</span><div>4 players in two teams of two. Partners sit across.</div></div>
            <div class="r-rule"><span class="r-rule-num">2</span><div>40 Spanish cards · ranks 1-7 and 10-12 (no 8 or 9). 7 connects to 10.</div></div>
            <div class="r-rule"><span class="r-rule-num">3</span><div>Each round: 4 face-up cards on the table + 3 cards to each hand.</div></div>
            <div class="r-rule"><span class="r-rule-num">4</span><div>Tap a card to <b>select</b>, tap the table to <b>play</b>. If its rank matches a table card you <b>capture</b> both — plus consecutive higher ranks.</div></div>
            <div class="r-rule"><span class="r-rule-num">5</span><div><b>Ronda</b> (2 of a kind) team <b>+1</b>. <b>Tringa</b> (3 of a kind) team <b>+5</b>. Tringa beats opposing Ronda of same rank.</div></div>
            <div class="r-rule"><span class="r-rule-num">6</span><div><b>Mesa</b> = clear the whole table with a capture → team <b>+1</b>.</div></div>
            <div class="r-rule"><span class="r-rule-num">7</span><div>End of round: leftover cards to the last capturer. Each card over 20 captured by the team = <b>+1</b>.</div></div>
            <div class="r-rule"><span class="r-rule-num">8</span><div>Closing the round: finish with a <b>1 (Ace)</b> → opponents <b>+5</b>. Finish by capturing with a <b>12</b> → your team <b>+5</b>.</div></div>
            <div class="r-rule"><span class="r-rule-num">9</span><div>Play passes <b>to the right</b> (clockwise). First team to <b>41 points</b> wins.</div></div>
          </div>
          <button class="r-help-btn r-help-go" onclick="document.getElementById('rHelpOv').remove()">Got it</button>
        </div>`;
      // Tap anywhere on the backdrop (the sides, outside the card) to close
      // and go back to the game — not just the × / Got it buttons.
      ov.onclick = (e) => { if(e.target === ov) ov.remove(); };
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('show'));
    },

    _showRoundOver(d){
      // Spectators anchor on the bottom (seat-0) player's team; players
      // anchor on their own team.
      const anchorTeam = this.isSpectator
        ? ((this.state?.players || []).find(p => p.seat === 0)?.team ?? 0)
        : this.myTeam;
      const us  = d.teamResults?.find(t => t.team === anchorTeam);
      const opp = d.teamResults?.find(t => t.team !== anchorTeam);
      const usLbl  = this.isSpectator ? 'TEAM A' : 'YOUR TEAM';
      const oppLbl = this.isSpectator ? 'TEAM B' : 'OPPONENTS';
      const ov = document.createElement('div');
      ov.className = 'r-overlay';
      ov.innerHTML = `
        <div class="r-overlay-card">
          <div class="r-ro-eyebrow">ROUND ${d.round || '?'}</div>
          <div class="r-ro-row">
            <div><div class="r-ro-num">${us?.capturedCount || 0}</div><div class="r-ro-lbl">${usLbl}</div></div>
            <div><div class="r-ro-num">${opp?.capturedCount || 0}</div><div class="r-ro-lbl">${oppLbl}</div></div>
          </div>
          <div class="r-ro-row">
            <div><div class="r-ro-num" style="color:#FBBF24">+${us?.bonus || 0}</div><div class="r-ro-lbl">CARD BONUS</div></div>
            <div><div class="r-ro-num" style="color:#FBBF24">+${opp?.bonus || 0}</div><div class="r-ro-lbl">OPP BONUS</div></div>
          </div>
          <div class="r-ro-totals">
            Score: <b>${us?.totalScore || 0}</b> · <b>${opp?.totalScore || 0}</b>
          </div>
        </div>`;
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('show'));
      setTimeout(() => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 350); }, 3000);
    },

    _showMatchOver(d){
      const reasonLabel = d.reason === 'opponent_left' ? 'a team left the match' : 'first to 41';
      // RANKED → the premium, animated result screen (rank badge + RP bar +
      // breakdown + team score + rewards + ladder), matching the design mockup.
      if(!this.isSpectator){
        const myRanked = (d.rankedChanges || []).find(r => r.playerId === this.myId);
        if(myRanked && typeof window._rankedTierProgress === 'function'){
          return this._showRankedResultPremium(d, myRanked, reasonLabel);
        }
      }
      // The actual WINNING PLAYERS (avatar + name) — shown instead of a bare
      // "Team A / Team B" label so everyone sees WHO won.
      const winners = (this.state?.players || []).filter(p => p.team === d.winnerTeam);
      const winnersHTML = winners.length ? `
        <div class="r-mo-winners">
          ${winners.map(p => {
            const img  = p.avatar && /^(https?:|data:|\/)/.test(p.avatar);
            const face = img ? '' : esc((p.username || '?')[0]).toUpperCase();
            return `<div class="r-mo-winner">
              <div class="r-mo-winner-av${img ? '' : ' r-mo-winner-av-letter'}" style="${img ? `background-image:url('${esc(p.avatar)}')` : ''}">${face}</div>
              <div class="r-mo-winner-name">${esc(p.username || 'Player')}${verifiedBadgeHTML(p.username,{isBot:p.isBot,size:'sm'})}</div>
            </div>`;
          }).join('')}
        </div>` : '';
      const winScore  = d.finalTeamScores?.[d.winnerTeam] ?? 0;
      const loseScore = d.finalTeamScores?.[1 - d.winnerTeam] ?? 0;
      const ov = document.createElement('div');
      ov.className = 'r-overlay r-overlay-final';
      if(this.isSpectator){
        ov.innerHTML = `
          <div class="r-overlay-card">
            <div class="r-mo-eyebrow">🏆 MATCH OVER · WINNERS</div>
            ${winnersHTML}
            <div class="r-mo-sub">${esc(reasonLabel)}</div>
            <div class="r-mo-scores">
              <div>Winner: <b>${winScore}</b></div>
              <div>Other: <b>${loseScore}</b></div>
            </div>
            <button class="r-mo-btn" onclick="Ronda._leave()">Back to Lobby</button>
          </div>`;
      } else {
        const youWon = d.winnerTeam === this.myTeam;
        // RANKED RONDA → my rank-point change rides on d.rankedChanges[].
        const myRanked = (d.rankedChanges || []).find(r => r.playerId === this.myId);
        const rankHTML = myRanked ? `
            <div class="r-mo-rank ${myRanked.delta >= 0 ? 'up' : 'down'}">
              <span class="r-mo-rank-lbl">🏆 RANKED</span>
              <span class="r-mo-rank-delta">${myRanked.delta >= 0 ? '▲ +' : '▼ '}${myRanked.delta} RP</span>
              <span class="r-mo-rank-total">${(myRanked.after||0).toLocaleString()} RP${myRanked.isPlacement ? ` · ${myRanked.placementGamesPlayed}/5 placement` : ''}</span>
            </div>` : '';
        ov.innerHTML = `
          <div class="r-overlay-card">
            <div class="r-mo-eyebrow">${youWon ? '🏆 VICTORY' : '💀 DEFEAT'} · WINNERS</div>
            ${winnersHTML}
            <div class="r-mo-sub">${esc(reasonLabel)}</div>
            <div class="r-mo-scores">
              <div>Your team: <b>${d.finalTeamScores?.[this.myTeam] ?? 0}</b></div>
              <div>Opponents: <b>${d.finalTeamScores?.[1 - this.myTeam] ?? 0}</b></div>
            </div>
            ${rankHTML}
            <button class="r-mo-btn" onclick="Ronda._leave()">Back to Lobby</button>
          </div>`;
      }
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('show'));
    },

    _wrRow(ic, lbl, val, cls, delay){
      return `<div class="wr-row" style="animation-delay:${delay}s"><span class="wr-row-ic">${ic}</span><span class="wr-row-lbl">${lbl}</span><span class="wr-row-val ${cls}">${val}</span></div>`;
    },
    // Premium RANKED result screen (mockup-style). Reuses the global .wr-* CSS
    // + the ranked helpers exposed from 14-game.js, fed with RONDA's real data
    // (team scores to 41, RP delta, breakdown, tier, MVP).
    _showRankedResultPremium(d, my, reasonLabel){
      const won   = d.winnerTeam === this.myTeam;
      const delta = my.delta || 0;
      const newRP = (typeof my.newRank === 'number') ? my.newRank : (my.after || 0);
      const oldRP = (typeof my.oldRank === 'number') ? my.oldRank : (newRP - delta);
      const tp = window._rankedTierProgress, tiers = window._rankedTiers || [];
      const newProg = tp(newRP), oldProg = tp(oldRP);
      const newTier = my.rankedTier
        ? { name:(my.rankedTier.name||my.rankedTier.label||newProg.tier.name), badge:(my.rankedTier.badge||newProg.tier.badge), color:(my.rankedTier.color||newProg.tier.color) }
        : newProg.tier;
      const tc  = newTier.color || '#B9F2FF';
      const div = newProg.pct>=75?'I':newProg.pct>=50?'II':newProg.pct>=25?'III':'IV';
      const promoted = newProg.idx>oldProg.idx, demoted = newProg.idx<oldProg.idx;
      const sameTier = newProg.idx===oldProg.idx;
      const oldPct = sameTier?oldProg.pct:(promoted?0:100);
      const newPct = newProg.pct;
      const sgn  = v => (v>0?'+':'')+v;
      const clsf = v => v>0?'pos':v<0?'neg':'zero';
      const dColor  = delta>0?'#7ee787':delta<0?'#ff6b6b':'#cfd1d8';
      const myScore  = d.finalTeamScores?.[this.myTeam] ?? 0;
      const oppScore = d.finalTeamScores?.[1 - this.myTeam] ?? 0;

      // breakdown rows (real components: win / margin / streak / mvp)
      const bd = my.breakdown && typeof my.breakdown.win==='number' ? my.breakdown : null;
      let rows = '';
      if(bd){
        rows += this._wrRow(won?'🏆':'🎴', won?'Match Win':'Match Result', sgn(bd.win), clsf(bd.win), .95);
        if(bd.margin) rows += this._wrRow('🎯','Score Margin', sgn(bd.margin), clsf(bd.margin), 1.05);
        if(bd.streak) rows += this._wrRow('🔥','Win Streak',   sgn(bd.streak), clsf(bd.streak), 1.15);
        if(bd.mvp)    rows += this._wrRow('⭐','MVP Bonus',     sgn(bd.mvp), clsf(bd.mvp), 1.25);
      } else {
        rows += this._wrRow(won?'🏆':'🎴', won?'Match Win':'Match Result', sgn(delta), clsf(delta), .95);
      }
      rows += `<div class="wr-row wr-row-total" style="animation-delay:1.35s"><span class="wr-row-ic"></span><span class="wr-row-lbl">Total</span><span class="wr-row-val ${clsf(delta)}">${sgn(delta)} RP</span></div>`;

      const emb = (name,c) => (typeof window._rankEmblemHTML==='function') ? window._rankEmblemHTML(name,c)
                            : (typeof window._rankEmblemSVG==='function') ? window._rankEmblemSVG(c) : null;
      const ladder = tiers.map(t=>{
        const on = t.name === newTier.name;
        return `<div class="wr-tier ${on?'on':''}" style="--tc:${t.color}"><span class="wr-tier-badge">${emb(t.name,t.color)||t.badge}</span><span class="wr-tier-lbl">${t.name}</span><span class="wr-tier-pct">${on?newPct+'%':'0%'}</span></div>`;
      }).join('');

      const xpGain = won?220:90;
      // REAL winnings — the server pays the winning team's pot share via
      // match:payout (captured in S._lastPayout; may also land a beat later →
      // _onPayout fills the cell live).
      const paid = (S._lastPayout && (Date.now() - S._lastPayout.at) < 30000 && S._lastPayout.gained > 0)
        ? S._lastPayout.gained : 0;
      const rewardCells =
        (paid>0?`<div class="wr-rw" style="animation-delay:1.3s"><div class="wr-rw-ic">🪙</div><div class="wr-rw-val" id="rmoCoinsVal">+${paid.toLocaleString()}</div><div class="wr-rw-lbl">Coins Won</div></div>`:'')
        + `<div class="wr-rw" style="animation-delay:1.4s"><div class="wr-rw-ic">⭐</div><div class="wr-rw-val">+${xpGain}</div><div class="wr-rw-lbl">XP</div></div>`
        + (my.mvp?`<div class="wr-rw" style="animation-delay:1.6s"><div class="wr-rw-ic">🏅</div><div class="wr-rw-val">MVP</div><div class="wr-rw-lbl">Bonus</div></div>`:'');

      const u = S.user||{};
      const wins = u.rankedWins||0, losses = u.rankedLosses||0;
      const wrate = (wins+losses)>0?Math.round(wins/(wins+losses)*100):(won?100:0);
      const peak = my.peakRank || u.peakRankPoints || newRP;
      const statCells =
        `<div class="wr-stat"><div class="wr-stat-val" style="color:${won?'#7ee787':'#ff9b9b'}">${won?'WIN':'LOSS'}</div><div class="wr-stat-lbl">Result</div></div>`
        + `<div class="wr-stat"><div class="wr-stat-val">${(my.streak||0)}${(my.streak||0)>=2?' 🔥':''}</div><div class="wr-stat-lbl">Win Streak</div></div>`
        + `<div class="wr-stat"><div class="wr-stat-val">${wrate}%</div><div class="wr-stat-lbl">Win Rate</div></div>`
        + `<div class="wr-stat"><div class="wr-stat-val" style="color:${tc}">${Number(peak).toLocaleString()}</div><div class="wr-stat-lbl">Peak RP</div></div>`;

      const perfMsg = promoted?'🎉 Promoted! New tier unlocked — keep the momentum.'
        : demoted?'Demoted this time — regroup and climb right back.'
        : won?(delta>=20?'Dominant win! Keep climbing the ladder. 🚀':'Solid win — onward and upward.')
        : 'Tough one. Shake it off and run it back. 💪';
      const verdict = won?(oppScore<=15?'Dominant Victory':delta>=20?'Deserved Win':'Hard-Fought Win')
                         :(Math.abs(myScore-oppScore)<=4?'Narrow Defeat':'Tough Defeat');

      // Match duration (from enter() → now), shown in the header like the mockup.
      const durMs = this._matchT0 ? (Date.now() - this._matchT0) : 0;
      const durTxt = durMs > 0
        ? `${Math.floor(durMs/60000)}:${String(Math.floor((durMs%60000)/1000)).padStart(2,'0')}`
        : '';
      // Share payload for the top-right Share button + data for Match Details.
      this._lastRankedShare = `${won?'🏆 VICTORY':'💀 DEFEAT'} ${myScore}-${oppScore} · ${(newTier.name||'').toUpperCase()} ${div} · ${sgn(delta)} RP — Cardora Ranked`;
      this._lastOverData = { d, myScore, oppScore, durTxt };

      const ov = document.createElement('div');
      ov.className = 'r-overlay r-overlay-final rmo-premium';
      ov.innerHTML = `
        <div class="rmo-scroll">
          <div class="wr-header rmo-header"><div class="wr-header-badge" style="--tc:${tc}">${emb(newTier.name,tc)||newTier.badge||'🎖️'}</div><div><div class="wr-header-title">Ranked Match</div><div class="wr-header-sub" style="color:${tc}">${esc(newTier.name||'')} Division${durTxt?` · ⏱ ${durTxt}`:''}</div></div></div>
          <button class="rmo-share" onclick="Ronda._shareRanked()">📤 Share Result</button>
          <button class="rmo-report" title="Report a problem with this match" onclick="try{toast('✓ Report sent — our team will review this match','s')}catch(e){}">⚠</button>
          <div class="rmo-title ${won?'w':'l'}">${won?'VICTORY':'DEFEAT'}</div>
          <div class="rmo-sub">${won?'You won the match!':'Match lost'} · ${esc(reasonLabel)}</div>
          <div class="win-ranked" style="display:flex">
            <div class="wr-grid">
              <div class="wr-col">
                <div class="wr-card wr-card-teams">
                  <div class="wr-card-h">⚔️ Final Score</div>
                  <div class="wr-teams">
                    <div class="wr-team"><div class="wr-team-emblem wr-team-you">🛡️</div><div class="wr-team-lbl">Your Team</div></div>
                    <div class="wr-team-mid"><span class="wr-team-score" style="color:#5db8ff">${myScore}</span><span class="wr-vs">VS</span><span class="wr-team-score" style="color:#ff6b6b">${oppScore}</span></div>
                    <div class="wr-team"><div class="wr-team-emblem wr-team-opp">🐺</div><div class="wr-team-lbl">Opponent</div></div>
                  </div>
                  <div class="wr-verdict-strip">${verdict}</div>
                </div>
                <div class="wr-card wr-card-break"><div class="wr-card-h">📊 RP Breakdown</div><div class="wr-breakdown">${rows}</div></div>
              </div>
              <div class="wr-hero">
                <div class="wr-badge-wrap" style="--tc:${tc}"><div class="wr-badge-rings"></div><div class="wr-badge">${emb(newTier.name,tc)||newTier.badge||'🎖️'}</div></div>
                <div class="wr-tier-name" style="color:${tc}">${esc((newTier.name||'').toUpperCase())} ${div}</div>
                <div class="wr-prog-label">Rank Progress</div>
                <div class="wr-prog"><span class="wr-prog-old">${oldPct}%</span><div class="wr-bar"><div class="wr-bar-fill ${delta<0?'neg':''}"></div><div class="wr-bar-mark" style="left:${oldPct}%"></div></div><span class="wr-prog-new">${newPct}%</span></div>
                <div class="wr-delta" style="color:${dColor}">${sgn(delta)} RP</div>
                <div class="wr-prog-sub">Rank points ${delta>=0?'earned':'lost'}</div>
                <div class="wr-msg">${perfMsg}</div>
              </div>
              <div class="wr-col">
                <div class="wr-card"><div class="wr-card-h">🎁 Rewards</div><div class="wr-rewards">${rewardCells}</div></div>
                <div class="wr-card"><div class="wr-card-h">📈 Match Stats</div><div class="wr-stats">${statCells}${my.mvp?'<div class="wr-stat wr-stat-mvp">🏅 MVP<span>Best Player</span></div>':''}</div></div>
              </div>
            </div>
            <div class="wr-ladder-panel">
              <div class="wr-card-h">🏅 Rank Progress</div>
              <div class="wr-ladder">${ladder}</div>
            </div>
            <div class="wr-tip">💡 Tip: the bigger your winning score margin, the more RP you earn.</div>
          </div>
          <div class="rmo-actions">
            <button class="rmo-btn rmo-btn-secondary" onclick="Ronda._showMatchDetails()">Match Details</button>
            <button class="rmo-btn rmo-btn-primary rr-start" onclick="Ronda._leave()">▶ Continue</button>
            <button class="rmo-btn rmo-btn-blue" onclick="Ronda._leave(); if(typeof quickJoin==='function') setTimeout(function(){quickJoin('RANKED');},280)">🔄 Play Again</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      requestAnimationFrame(()=>ov.classList.add('show'));

      const box  = ov.querySelector('.win-ranked');
      const fill = ov.querySelector('.wr-bar-fill');
      if(fill){ fill.style.width = oldPct+'%'; requestAnimationFrame(()=>requestAnimationFrame(()=>{ fill.style.width = newPct+'%'; })); }
      const dEl = ov.querySelector('.wr-delta'); if(dEl && window._rankedCountUp) window._rankedCountUp(dEl, delta);
      try{ window._rankedFanfare && window._rankedFanfare(won?'win':'lose'); }catch(e){}
      if(won && window._rankedSparks) setTimeout(()=>window._rankedSparks(box), 500);
      if(promoted && window._rankedFanfare) setTimeout(()=>window._rankedFanfare('promo'), 1750);
    },

    // Live coin-payout hook — match:payout can land AFTER the result screen
    // rendered; update (or inject) the "Coins Won" cell so the winnings always
    // show, in real time.
    _onPayout(gained){
      if(!gained || gained <= 0) return;
      const ov = document.querySelector('.rmo-premium'); if(!ov) return;
      const val = ov.querySelector('#rmoCoinsVal');
      if(val){ val.textContent = '+' + gained.toLocaleString(); return; }
      const rw = ov.querySelector('.wr-rewards');
      if(rw) rw.insertAdjacentHTML('afterbegin',
        `<div class="wr-rw"><div class="wr-rw-ic">🪙</div><div class="wr-rw-val" id="rmoCoinsVal">+${gained.toLocaleString()}</div><div class="wr-rw-lbl">Coins Won</div></div>`);
    },

    // Match Details sheet (footer button on the result screen) — per-player
    // teams, RP deltas, final score + duration. Real data from the match-over.
    _showMatchDetails(){
      const ld = this._lastOverData; if(!ld) return;
      document.getElementById('rmoDetails')?.remove();
      const { d, myScore, oppScore, durTxt } = ld;
      const players = (this.state?.players || []);
      const rows = players.map(p=>{
        const rc = (d.rankedChanges||[]).find(r=>r.playerId===p.id);
        const winSide = p.team === d.winnerTeam;
        const deltaTxt = rc ? `${rc.delta>0?'+':''}${rc.delta} RP` : '—';
        const dColor = rc ? (rc.delta>0?'#7ee787':rc.delta<0?'#ff6b6b':'#cfd1d8') : 'rgba(255,255,255,.4)';
        return `<div class="rmo-det-row">
          <span class="rmo-det-team" style="color:${p.team===this.myTeam?'#5db8ff':'#ff6b6b'}">${p.team===this.myTeam?'🛡️':'🐺'}</span>
          <span class="rmo-det-name">${esc(p.username||'Player')}${p.id===this.myId?' <b style="color:#FBBF24">(YOU)</b>':''}${rc?.mvp?' 🏅':''}</span>
          <span class="rmo-det-res" style="color:${winSide?'#7ee787':'#ff9b9b'}">${winSide?'WIN':'LOSS'}</span>
          <span class="rmo-det-delta" style="color:${dColor}">${deltaTxt}</span>
        </div>`;
      }).join('');
      const sheet = document.createElement('div');
      sheet.id='rmoDetails'; sheet.className='rmo-details';
      sheet.innerHTML = `<div class="rmo-details-card">
        <div class="rmo-details-h">📋 Match Details</div>
        <div class="rmo-details-meta">Final score <b>${myScore} - ${oppScore}</b>${durTxt?` · Duration <b>${durTxt}</b>`:''} · First to 41</div>
        ${rows}
        <button class="rmo-btn rmo-btn-secondary" style="margin-top:13px;width:100%" onclick="document.getElementById('rmoDetails').remove()">Close</button>
      </div>`;
      sheet.addEventListener('click', e=>{ if(e.target===sheet) sheet.remove(); });
      document.body.appendChild(sheet);
    },

    // Share the ranked result (top-right button on the result screen) — native
    // share sheet where available, clipboard fallback everywhere else.
    _shareRanked(){
      const text = this._lastRankedShare || 'I just played a Cardora Ranked match!';
      if(navigator.share){
        navigator.share({ text }).catch(()=>{});
      } else if(navigator.clipboard?.writeText){
        navigator.clipboard.writeText(text).then(()=>{ try{ toast('📋 Result copied — paste it anywhere!','s'); }catch(e){} }).catch(()=>{});
      }
    },

    _leave(){
      const wasSpectator = this.isSpectator;
      const sock = S.socket;
      document.querySelectorAll('.r-overlay').forEach(o => o.remove());
      this.exit();
      if(wasSpectator && sock && S.roomId) sock.emit('room:spectate_leave', {}, () => {});
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
        body.ronda-active #game-screen > *:not(#ronda-root){ visibility:hidden !important; }
        .r-root{
          position:fixed; inset:0; z-index:50;
          font-family:'Outfit',sans-serif; color:#fff;
          overflow:hidden;
        }
        /* Casino-room backdrop — warm spot above the table, ambient dark room. */
        .r-bg{
          position:absolute; inset:0; z-index:0;
          background:
            radial-gradient(ellipse at 50% 28%, rgba(220, 38, 38, .22) 0%, rgba(0,0,0,0) 50%),
            radial-gradient(ellipse at 50% 90%, rgba(168, 85, 247, .15) 0%, rgba(0,0,0,0) 55%),
            linear-gradient(180deg, #1a0f1f 0%, #0a0710 100%);
        }
        .r-bg::after{
          content:''; position:absolute; inset:0;
          background:radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,.55) 100%);
        }

        /* ─ Corner chrome ─ */
        .r-corner{
          position:absolute; z-index:5;
          display:flex; gap:6px; align-items:center;
          padding:10px 12px;
        }
        .r-corner-tl{ top:0; left:0; }
        .r-corner-tr{ top:0; right:0; }
        /* Scoreboard — points + captured-card count per team. */
        .r-scoreboard{
          display:flex; flex-direction:column; gap:2px;
          padding:6px 10px;
          border-radius:12px;
          background:rgba(0,0,0,.65);
          border:1px solid rgba(255,255,255,.08);
          box-shadow:0 4px 14px rgba(0,0,0,.5);
          min-width:118px;
        }
        .r-sb-row{
          display:flex; align-items:center; gap:6px;
          font-size:13px; font-weight:900;
          color:#FFE9B0;
        }
        .r-sb-tag{
          font-size:9px; letter-spacing:1px;
          padding:1px 5px; border-radius:4px;
          font-weight:900;
        }
        .r-sb-us .r-sb-tag{ background:#22C55E; color:#06120A; }
        .r-sb-opp .r-sb-tag{ background:#F87171; color:#1A0507; }
        .r-sb-pts{
          font-size:17px; font-weight:900;
          min-width:22px; text-align:right;
          transition:transform .2s, text-shadow .2s;
          display:inline-block;
        }
        .r-sb-us  .r-sb-pts{ color:#86EFAC; }
        .r-sb-opp .r-sb-pts{ color:#FCA5A5; }
        /* While a score rolls up, give the number a brief pop + glow so the
           reveal reads as an event, not a silent flip. */
        .r-sb-bump{ animation:rSbBump .65s ease; }
        @keyframes rSbBump{
          0%{ transform:scale(1); }
          30%{ transform:scale(1.28); text-shadow:0 0 14px currentColor; }
          100%{ transform:scale(1); }
        }
        .r-sb-cards{
          display:inline-flex; align-items:center; gap:3px;
          margin-left:auto;
          font-size:11px; font-weight:800;
          opacity:.85;
        }
        .r-sb-card-ic{
          width:9px; height:13px; border-radius:1.5px;
          background:linear-gradient(135deg, #DC2626 0%, #DC2626 49%, #FBBF24 49%, #FBBF24 51%, #DC2626 51%);
          border:.5px solid rgba(0,0,0,.4);
          display:inline-block;
        }
        .r-sb-target{
          font-size:9px; letter-spacing:1.5px;
          opacity:.5; font-weight:700;
          text-align:right;
          margin-top:1px;
        }
        .r-corner-btn{
          width:34px; height:34px; border-radius:50%;
          background:rgba(0,0,0,.55);
          border:1px solid rgba(255,255,255,.08);
          color:#fff; font-size:14px; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:transform .15s, background .2s;
        }
        .r-corner-btn:hover{ background:rgba(255,255,255,.12); transform:scale(1.06); }
        .r-corner-leave{ background:rgba(232,50,74,.25); border-color:rgba(232,50,74,.5); font-size:20px; }

        /* ─ Felt table ─ */
        .r-felt-wrap{
          position:absolute; inset:0;
          display:flex; align-items:center; justify-content:center;
          z-index:2;
        }
        /* ── RANK ARENA MODE ── the equipped rank-table ARTWORK becomes the
           room: the art fills the screen and the CSS-drawn oval disappears so
           you're playing on the real table from the reward image. Cards, slots
           and seats float on top exactly as before. */
        /* WHOLE-TABLE GUARANTEE — contain on every screen so the table art is
           never cropped (user rule: the full table must always be visible).
           Each art's matching base colour fills the leftover bands. */
        body.ronda-felt-art .r-bg{
          background:var(--tf-art);
          background-size:contain !important;
          background-position:center 46% !important;
          background-repeat:no-repeat !important;
        }
        body.ronda-felt-art .r-felt{ background:none; box-shadow:none; }
        body.ronda-felt-art .r-felt::before{ display:none; }
        .r-felt{
          position:relative;
          width:min(99vw, 920px);
          height:min(82vh, 640px);
          margin-top:-24px;
          border-radius:50% / 50%;
          background:
            radial-gradient(ellipse at 50% 35%, #14532D 0%, #052E18 75%, #021A0E 100%);
          box-shadow:
            inset 0 0 0 8px rgba(0,0,0,.4),
            inset 0 0 0 10px rgba(255, 215, 130, .25),
            inset 0 0 60px rgba(0,0,0,.7),
            0 30px 80px rgba(0,0,0,.7);
        }
        .r-felt::before{
          content:''; position:absolute;
          inset:14px;
          border-radius:50% / 50%;
          border:1.5px dashed rgba(255, 215, 130, .15);
          pointer-events:none;
        }
        .r-felt-inner{
          position:absolute; inset:0;
        }

        /* ─ Seat bubbles (avatar + name + tiny card fan) ─ */
        .r-seat-pos{
          position:absolute;
          display:flex; flex-direction:column; align-items:center; gap:3px;
          z-index:3;
        }
        /* Partner sits ABOVE the felt. Keep the SAME order as every other
         * seat — avatar/name on top, card count BELOW — so all four players
         * read identically (no more "cards above the profile"). */
        .r-seat-top{
          top:-90px; left:50%; transform:translateX(-50%);
        }
        /* Partner panel reads top-down like every other seat: avatar + name on
         * top, card backs below. (The seat is pulled down enough that the
         * header no longer clips off the top of the screen.) */
        .r-seat-left{
          left:-56px; top:50%; transform:translateY(-50%);
        }
        .r-seat-right{
          right:-56px; top:50%; transform:translateY(-50%);
        }
        /* ─ ONE unified player panel ─
           Avatar + name + ▶ turn arrow + mic on TOP (header row), the card
           backs + "X cards" count BELOW. Every seat AND the spectator's
           bottom seat use this exact panel so all four players read the
           same — professional and consistent. */
        .r-pp{
          position:relative;
          display:flex; flex-direction:column; align-items:stretch; gap:5px;
          padding:7px 10px 6px;
          border-radius:16px;
          background:rgba(8, 6, 14, .86);
          border:1.5px solid rgba(255,255,255,.09);
          backdrop-filter:blur(7px);
          box-shadow:0 10px 30px rgba(0,0,0,.5);
          transition:border-color .25s, box-shadow .25s, transform .25s;
          min-width:142px; max-width:224px;
        }
        .r-pp.is-turn{
          border-color:transparent;
          box-shadow:0 0 26px rgba(251,191,36,.45), inset 0 0 14px rgba(251,191,36,.14);
          transform:scale(1.03);
        }
        /* TURN-TIMER frame on the active player — a SINGLE-colour gold line
           that fills around the panel over the turn window (var(--turn-dur),
           default 12s). When the line completes a full lap the turn is up and
           the engine auto-plays for them. The mask carves out the centre so
           only the 3px ring paints; --prog (a registered <angle>) is what the
           keyframe animates, and --turn-delay (negative) offsets the animation
           so it always reflects the REAL remaining time after a re-render. */
        @property --prog{ syntax:'<angle>'; initial-value:0deg; inherits:false; }
        .r-pp.is-turn::before{
          content:''; position:absolute; inset:-2px; border-radius:18px;
          padding:3px; pointer-events:none; z-index:2;
          background:conic-gradient(#FBBF24 var(--prog,0deg), rgba(255,255,255,.13) 0deg);
          -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite:xor;
                  mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
                  mask-composite:exclude;
          animation-name:rTurnProg;
          animation-duration:var(--turn-dur, 12s);
          animation-delay:var(--turn-delay, 0s);
          animation-timing-function:linear;
          animation-fill-mode:forwards;
          filter:drop-shadow(0 0 5px rgba(251,191,36,.5));
        }
        @keyframes rTurnProg{ from{ --prog:0deg; } to{ --prog:360deg; } }
        .r-pp.is-partner{ border-bottom:3px solid rgba(34, 197, 94, .6); }
        .r-pp:not(.is-partner):not(.is-turn){ border-bottom:3px solid rgba(232, 50, 74, .55); }

        /* Header row — avatar, name, turn arrow, dealer chip, mic */
        .r-pp-head{ display:flex; align-items:center; gap:7px; }
        .r-pp-av{
          width:58px; height:58px; border-radius:50%; flex:0 0 auto;
          background:linear-gradient(180deg, #7C3AED, #4C1D95);
          background-size:cover; background-position:center; background-repeat:no-repeat;
          border:2.5px solid rgba(255, 215, 130, .4);
          display:flex; align-items:center; justify-content:center;
          font-weight:900; font-size:22px; color:#fff;
          box-shadow:0 4px 14px rgba(0,0,0,.55);
        }
        .r-pp.is-turn .r-pp-av{
          border-color:#FBBF24;
          animation:rAvPulse 1.4s ease-in-out infinite;
        }
        @keyframes rAvPulse{ 50%{ box-shadow:0 4px 14px rgba(0,0,0,.55), 0 0 22px rgba(251,191,36,.7); } }
        .r-pp-name{
          flex:1 1 auto; min-width:0;
          font-size:12px; font-weight:900; letter-spacing:.3px;
          color:#FFE9B0;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          display:flex; align-items:center; gap:5px;
        }
        .r-pturn{
          color:#22C55E; font-size:12px; flex:0 0 auto;
          filter:drop-shadow(0 0 5px rgba(34,197,94,.85));
          animation:rTurnBlink 1.2s ease-in-out infinite;
        }
        @keyframes rTurnBlink{ 50%{ opacity:.35; } }
        .r-pa{
          background:#22C55E; color:#06120A;
          font-size:8px; font-weight:900; letter-spacing:1px;
          padding:1px 4px; border-radius:3px; flex:0 0 auto;
        }
        /* Verification seal in the seat name row — small inline X badge. */
        .r-pp-verified{ width:15px; height:15px; font-size:8px; flex:0 0 auto; }
        /* Dealer badge ("li kayfrra9") — a clear, glowing gold coin so it's
           obvious who's dealing this round. Sits in the header row. */
        .r-pp-dealer{
          flex:0 0 auto;
          width:24px; height:24px; border-radius:50%;
          background:radial-gradient(circle at 32% 28%, #FEF3C7, #FBBF24 55%, #B45309);
          color:#3a2150;
          font-size:13px; font-weight:900; line-height:1;
          display:flex; align-items:center; justify-content:center;
          border:1.5px solid #FFFBEB;
          box-shadow:0 2px 8px rgba(0,0,0,.5), 0 0 12px rgba(251,191,36,.6);
          animation:rDealerPulse 1.6s ease-in-out infinite;
        }
        @keyframes rDealerPulse{ 50%{ box-shadow:0 2px 8px rgba(0,0,0,.5), 0 0 18px rgba(251,191,36,.95); } }
        /* Inline mic — lives in the header, right on the player's picture row.
           Its own click stops propagation so it never opens the profile. */
        .r-pp-mic{
          flex:0 0 auto;
          width:26px; height:26px; border-radius:50%;
          border:1.5px solid rgba(34,197,94,.45);
          background:radial-gradient(circle at 30% 30%, #166534, #052E18);
          color:#FFFBEB; font-size:12px; line-height:1;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; padding:0;
          box-shadow:0 2px 8px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.18);
          transition:transform .18s, filter .18s, background .2s, border-color .2s;
        }
        .r-pp-mic:hover{ transform:scale(1.12); filter:brightness(1.12); }
        .r-pp-mic:active{ transform:scale(.95); }
        .r-pp-mic.is-muted{
          background:radial-gradient(circle at 30% 30%, #7F1D1D, #450A0A);
          border-color:rgba(232,50,74,.65); color:#FFE4E6;
        }

        /* Cards row — backs SEPARATED with a gap (no glued stack, no count
           text), sitting BELOW the profile. */
        .r-pp-cards{
          display:flex; align-items:center; justify-content:center;
          gap:5px;
          min-height:82px;
        }
        /* Bigger, clearer card backs, each standing on its own (gap, not
           overlap). Each shows the player's OWN equipped design when .has-cb
           (inline background from their cardBackId); else the default back. */
        .r-cardback{
          width:56px; height:78px; border-radius:7px; flex:0 0 auto;
          background:
            linear-gradient(135deg, #DC2626 0%, #DC2626 49%, #FBBF24 49%, #FBBF24 51%, #DC2626 51%, #DC2626 100%);
          background-size:cover; background-position:center; background-repeat:no-repeat;
          border:1.5px solid rgba(0,0,0,.55);
          box-shadow:0 2px 6px rgba(0,0,0,.5);
        }

        /* ─ Table (rank-sorted grid) + Deck ─ */
        .r-table{
          position:absolute; left:50%; top:50%;
          transform:translate(-50%, -50%);
          display:grid;
          grid-template-columns:repeat(5, auto);
          grid-template-rows:repeat(2, auto);
          gap:18px 22px;   /* generous breathing room between slots */
          padding:14px 18px;
          border-radius:18px;
          cursor:default;
          transition:background .2s, box-shadow .2s, transform .15s;
        }
        /* No visible hint on the table — only the cursor changes.
         * The user does not want any glow telling them where to drop. */
        .r-table.r-table-target{ cursor:pointer; }
        .r-table.r-table-target:active{ transform:translate(-50%, -50%) scale(.97); }
        /* Each rank gets its own slot — empty or stacked. */
        /* Smaller than hand cards so the player can instantly tell their
         * own cards apart from cards on the felt. */
        .r-tslot{
          position:relative;
          width:62px; height:96px;
          border-radius:7px;
          transition:background .25s, box-shadow .25s;
        }
        .r-tslot-empty{
          background:rgba(255,255,255,.025);
          border:1.5px dashed rgba(255,255,255,.06);
        }
        .r-tslot.is-target{
          box-shadow:0 0 0 2px rgba(251,191,36,.7), 0 0 18px rgba(251,191,36,.35);
        }
        .r-tslot.is-lp{
          box-shadow:0 0 0 2px rgba(251,191,36,.55), 0 0 14px rgba(251,191,36,.25);
        }
        /* Stack cards inside the slot with a small offset so you can
         * see the count without breaking the grid layout. Slow .55s
         * transitions so any reshuffle reads naturally. */
        .r-tcard{
          position:absolute;
          top:calc(var(--n, 0) * 5px);
          left:calc(var(--n, 0) * 5px);
          width:62px; height:96px;
          transition:transform .55s cubic-bezier(.18,.85,.32,1.05), opacity .55s, box-shadow .35s;
        }
        /* Deck pile — parked next to the CURRENT dealer's seat.
         * data-dealer attribute set by _renderDeckPosition (me/top/
         * left/right). Defaults to the right edge if no dealer yet. */
        /* Deck pile — parked next to whoever's dealing this round.
         * data-dealer attribute set by _renderDeckPosition (me/top/
         * left/right). Without a dealer set yet, the deck is hidden. */
        .r-deck{
          position:absolute;
          width:54px; height:78px; border-radius:7px;
          background:
            linear-gradient(135deg, #DC2626 0%, #DC2626 49%, #FBBF24 49%, #FBBF24 51%, #DC2626 51%, #DC2626 100%);
          border:2px solid rgba(0,0,0,.6);
          /* Stacked-paper edges → the deck reads as a real PILE of cards. The
           * thickness scales with --sd (set per-deal from deckRemaining), so
           * the pile visibly thins out as the cards get dealt. */
          box-shadow:
            calc(var(--sd, 8px) * .25) calc(var(--sd, 8px) * -.18) 0 -1px rgba(0,0,0,.5),
            calc(var(--sd, 8px) * .5)  calc(var(--sd, 8px) * -.36) 0 -2px rgba(0,0,0,.42),
            calc(var(--sd, 8px) * .75) calc(var(--sd, 8px) * -.54) 0 -3px rgba(0,0,0,.34),
            var(--sd, 8px)             calc(var(--sd, 8px) * -.72) 0 -4px rgba(0,0,0,.26),
            0 7px 18px rgba(0,0,0,.55);
          display:flex; align-items:center; justify-content:center;
          color:#fff; font-weight:900; font-size:15px;
          text-shadow:0 1px 2px rgba(0,0,0,.6);
          transition:top .35s cubic-bezier(.34,1.56,.64,1),
                     bottom .35s cubic-bezier(.34,1.56,.64,1),
                     left .35s cubic-bezier(.34,1.56,.64,1),
                     right .35s cubic-bezier(.34,1.56,.64,1),
                     box-shadow .45s ease;
        }
        /* Deck sits clearly BESIDE the dealer's panel (never overlapping it),
         * so it's obvious which player is dealing this round. For ME it parks
         * to the RIGHT, beside my hand — NOT under the cards I play with. */
        .r-deck[data-dealer="top"]   { top:-62px;    left:calc(50% + 112px); transform:none; }
        .r-deck[data-dealer="me"]    { bottom:6px;   right:18px; left:auto;  transform:none; }
        .r-deck[data-dealer="left"]  { left:6px;     top:calc(50% + 70px);   transform:none; }
        .r-deck[data-dealer="right"] { right:6px;    top:calc(50% + 70px);   transform:none; }
        .r-deck:not([data-dealer])   { display:none; }
        /* Deck count badge — a dark pill so the number stays readable on top
         * of any card-back design the dealer has equipped. */
        .r-deck > span{
          display:inline-flex; align-items:center; justify-content:center;
          min-width:22px; padding:2px 7px; border-radius:99px;
          background:rgba(0,0,0,.55);
          box-shadow:0 1px 3px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.14);
          font-size:13px; line-height:1;
        }

        /* ─ Capture flashes (on the table felt) ─ */
        .r-capture-flash-mine{
          box-shadow:0 0 0 3px rgba(34,197,94,.85), 0 0 40px rgba(34,197,94,.55) !important;
          background:rgba(34,197,94,.15) !important;
        }
        .r-capture-flash-opp{
          box-shadow:0 0 0 3px rgba(248,113,113,.85), 0 0 40px rgba(248,113,113,.55) !important;
          background:rgba(248,113,113,.15) !important;
        }

        /* ─ Derba pending pile ─
         * When a player captures the card that the previous player just
         * placed, the two cards stay STACKED on the felt as a pending
         * pile — visually marked with a soft gold halo so everyone at
         * the table sees "this pile is hot, waiting for the next play".
         * The pile only leaves the table when the chain settles. */
        .r-tcard-pending{
          z-index:6;
        }
        .r-tcard-pending .r-card{
          box-shadow:
            0 0 0 2px rgba(251,191,36,.75),
            0 0 18px rgba(251,191,36,.55),
            0 6px 14px rgba(0,0,0,.45);
          border-radius:7px;
          animation:rPendingBreathe 1.6s ease-in-out infinite;
        }
        @keyframes rPendingBreathe{
          50%{ box-shadow:
            0 0 0 2px rgba(251,191,36,.95),
            0 0 26px rgba(251,191,36,.80),
            0 6px 14px rgba(0,0,0,.45);
          }
        }
        .r-tslot.r-tslot-pending::before{
          content:''; position:absolute; inset:-6px;
          border-radius:12px;
          background:radial-gradient(circle at 50% 50%, rgba(251,191,36,.22) 0%, transparent 70%);
          pointer-events:none;
          z-index:0;
        }

        /* ─ Per-card capture animation (SLOW, realistic) ─ */
        /* Phase 2 — PULSE: target card lifts, scales, glows. Cubic out so
         * the "attack/highlight" feels deliberate, not snappy. */
        .r-tcard.r-card-capturing-mine .r-card,
        .r-tcard.r-card-capturing-opp .r-card{
          animation:rCardPulse .85s cubic-bezier(.34,1.56,.64,1) forwards;
        }
        .r-tcard.r-card-capturing-mine{
          box-shadow:0 0 0 3.5px #22C55E, 0 0 28px rgba(34,197,94,.75);
          border-radius:8px;
          z-index:5;
        }
        .r-tcard.r-card-capturing-opp{
          box-shadow:0 0 0 3.5px #F87171, 0 0 28px rgba(248,113,113,.75);
          border-radius:8px;
          z-index:5;
        }
        @keyframes rCardPulse{
          0%   { transform:scale(1); }
          40%  { transform:scale(1.22) translateY(-10px); }
          80%  { transform:scale(1.1)  translateY(-4px); }
          100% { transform:scale(1.06) translateY(-3px); }
        }
        /* Phase 3 — FLY OUT toward captor's side (slow, realistic).
         * 1.1 s of travel with curving cubic-bezier so it feels like the
         * cards are being dragged off the table, not snapped away. */
        .r-tcard.r-card-flyout-bottom{
          transform:translate(0, 90vh) rotate(12deg) scale(.65);
          opacity:0;
          transition:transform 1.1s cubic-bezier(.5,.05,.75,.15), opacity 1.1s ease-in;
        }
        .r-tcard.r-card-flyout-top{
          transform:translate(0, -90vh) rotate(-12deg) scale(.65);
          opacity:0;
          transition:transform 1.1s cubic-bezier(.5,.05,.75,.15), opacity 1.1s ease-in;
        }
        .r-tcard.r-card-flyout-left{
          transform:translate(-90vw, 0) rotate(-20deg) scale(.65);
          opacity:0;
          transition:transform 1.1s cubic-bezier(.5,.05,.75,.15), opacity 1.1s ease-in;
        }
        .r-tcard.r-card-flyout-right{
          transform:translate(90vw, 0) rotate(20deg) scale(.65);
          opacity:0;
          transition:transform 1.1s cubic-bezier(.5,.05,.75,.15), opacity 1.1s ease-in;
        }

        /* ─ Card LAND — slow, realistic, no yellow halo ─
         * The card travels from the player's side toward its rank slot.
         * Start position is per-card: CSS vars --sx/--sy/--srot are set
         * by the JS layer based on which player threw the card.
         *   ME      → from below the felt
         *   PARTNER → from above
         *   LEFT    → from the left
         *   RIGHT   → from the right
         * Travel time 1.4 s with a soft arc so the eye can follow.
         * NO yellow halo on the card — yellow is reserved for capture
         * (the "eat / hit" animation) only. */
        .r-tcard.r-card-just-played{
          animation:rCardLand 1.4s cubic-bezier(.22,.8,.32,1) backwards;
        }
        @keyframes rCardLand{
          0%   {
            transform:translate(var(--sx, 0), var(--sy, -220px))
                      rotate(var(--srot, -10deg))
                      scale(.55);
            opacity:0;
          }
          25%  { opacity:1; }
          85%  {
            transform:translate(0, 6px) rotate(2deg) scale(1.04);
            opacity:1;
          }
          100% {
            transform:translate(0, 0) rotate(0) scale(1);
            opacity:1;
          }
        }

        /* ─ Turn indicator — GREEN outline on active player's cards only.
         * No text banner. No "what to play" hint. The player whose turn
         * it is sees their cards glow green, that's the only signal. */
        /* Opponent seats: their visible card backs glow green. */
        .r-seat-pos.is-turn .r-cardback{
          border-color:#22C55E;
          box-shadow:0 0 10px rgba(34,197,94,.65), 0 1px 2px rgba(0,0,0,.4);
        }
        /* My hand: every card gets a green outline when it's MY turn. */
        .r-hand.is-turn .r-card{
          box-shadow:
            0 4px 10px rgba(0,0,0,.5),
            0 0 0 2.5px rgba(34,197,94,.7),
            0 0 14px rgba(34,197,94,.35);
        }
        /* The selected card still wins (gold) — once you pick, it lifts. */
        .r-hand.is-turn .r-card.selected{
          box-shadow:
            0 18px 30px rgba(0,0,0,.55),
            0 0 0 3.5px #FBBF24,
            0 0 32px rgba(251,191,36,.7);
        }

        /* ─ Bottom (only my hand — no self-profile, opponents see me) ─
         * Lifted up so the FULL height of the hand sits inside the
         * viewport. The hand is 140px tall and was previously clipping
         * ~30% off the screen bottom on phones; this adds breathing
         * room below the cards so they sit fully visible. */
        .r-bottom{
          position:absolute; left:0; right:0;
          bottom:calc(48px + env(safe-area-inset-bottom));
          z-index:4;
          padding:0 10px;
          display:flex; flex-direction:column; align-items:center; justify-content:flex-end;
        }
        .r-hand{
          display:flex; gap:6px; justify-content:center;
          padding:4px 6px 0;
          max-width:100%;
          flex-wrap:nowrap;
        }
        /* "YOUR TURN" cue — sits right above my hand, only when it's my move. */
        .r-turn-cue{
          opacity:0; transform:translateY(7px) scale(.9);
          pointer-events:none; margin-bottom:3px;
          padding:5px 16px; border-radius:999px;
          font-family:'Outfit',sans-serif; font-size:12px; font-weight:900;
          letter-spacing:2px; text-transform:uppercase; color:#06320F;
          background:linear-gradient(180deg,#86EFAC,#22C55E);
          border:1px solid rgba(255,255,255,.45);
          box-shadow:0 4px 14px rgba(34,197,94,.5), 0 0 18px rgba(74,222,128,.45), inset 0 1px 0 rgba(255,255,255,.5);
          text-shadow:0 1px 0 rgba(255,255,255,.3);
          transition:opacity .25s ease, transform .25s cubic-bezier(.2,.8,.3,1.2);
          white-space:nowrap;
        }
        .r-turn-cue.show{
          opacity:1; transform:translateY(0) scale(1);
          animation:rTurnCuePulse 1.5s ease-in-out infinite;
        }
        @keyframes rTurnCuePulse{
          0%,100%{ box-shadow:0 4px 14px rgba(34,197,94,.5), 0 0 18px rgba(74,222,128,.45), inset 0 1px 0 rgba(255,255,255,.5); }
          50%    { box-shadow:0 4px 20px rgba(34,197,94,.72), 0 0 30px rgba(74,222,128,.75), inset 0 1px 0 rgba(255,255,255,.5); }
        }
        /* Corner mic toggle — sits next to the ❓ help button. Reflects
         * voice state: blue=listening (tap to talk), green=live. */
        .r-corner-mic.listening{
          background:linear-gradient(135deg, #1E3A8A, #0C1E3E)!important;
          border-color:rgba(96,165,250,.6)!important;
          color:#BFDBFE!important;
          box-shadow:0 0 12px rgba(96,165,250,.4)!important;
        }
        .r-corner-mic.on{
          background:linear-gradient(135deg, #22C55E, #15803D)!important;
          border-color:rgba(34,197,94,.7)!important;
          color:#fff!important;
          box-shadow:0 0 14px rgba(34,197,94,.55)!important;
          animation:rCornerMicPulse 1.5s ease-in-out infinite;
        }
        @keyframes rCornerMicPulse{
          50%{ box-shadow:0 0 20px rgba(34,197,94,.8)!important; }
        }

        /* ── Spectator (watch-live) chrome ── */
        /* Moved to the bottom-LEFT corner so it never covers the partner
           seat at the top-centre of the table. */
        .r-spectator-badge{
          position:fixed; bottom:14px; left:14px;
          z-index:60;
          padding:5px 13px; border-radius:99px;
          background:linear-gradient(135deg, rgba(232,50,74,.92), rgba(155,27,46,.92));
          color:#fff; font-family:'Outfit',sans-serif;
          font-size:11px; font-weight:900; letter-spacing:1.8px;
          box-shadow:0 4px 14px rgba(0,0,0,.55), 0 0 16px rgba(232,50,74,.4);
          pointer-events:none;
          animation:rSpecPulse 2s ease-in-out infinite;
        }
        @keyframes rSpecPulse{ 50%{ opacity:.7; } }
        /* Spectator vote chip — sits inline in the panel header row. */
        .r-vote-btn{
          flex:0 0 auto; pointer-events:auto;
          padding:3px 8px; border-radius:99px; cursor:pointer;
          font-family:'Outfit',sans-serif; font-size:9px; font-weight:900; letter-spacing:.4px;
          background:rgba(124,58,237,.22); border:1px solid rgba(168,85,247,.5); color:#D8B4FE;
          transition:transform .12s, background .15s, color .15s;
        }
        .r-vote-btn:hover{ transform:translateY(-1px); background:rgba(124,58,237,.42); color:#fff; }
        .r-vote-btn.is-mine{ background:linear-gradient(135deg,#FBBF24,#D97706); border-color:transparent; color:#1a1a1a; }

        /* Whole panel is clickable → tap to view profile. */
        .r-seat-pos{ cursor:pointer; }
        .r-seat-pos:active .r-pp{ transform:scale(.96); }

        /* ─ Cards ─ */
        .r-card{
          width:104px; height:158px; border-radius:10px;
          background:#FFFBEB;
          border:2px solid rgba(0,0,0,.3);
          box-shadow:0 6px 14px rgba(0,0,0,.55);
          overflow:hidden; flex-shrink:0;
          transition:transform .35s cubic-bezier(.34,1.56,.64,1), box-shadow .3s;
        }
        .r-card img{ width:100%; height:100%; display:block; pointer-events:none; }
        .r-card.tappable{ cursor:pointer; }
        .r-card.tappable:hover{ transform:translateY(-14px); }
        .r-card.selected{
          transform:translateY(-32px) scale(1.08);
          box-shadow:0 18px 30px rgba(0,0,0,.55), 0 0 0 3.5px #FBBF24, 0 0 32px rgba(251,191,36,.7);
          border-color:#FBBF24;
          animation:rSelectBob 1.6s ease-in-out infinite alternate;
        }
        @keyframes rSelectBob{
          0%   { transform:translateY(-32px) scale(1.08); }
          100% { transform:translateY(-38px) scale(1.10); }
        }
        /* Cards on the table — fill their slot wrapper. */
        .r-card.r-card-table{
          width:100%; height:100%;
          box-shadow:0 5px 12px rgba(0,0,0,.6);
        }

        /* Dealing animation — slow casino stagger.
         *   .95s per card, 280ms gap between cards.
         *   Cards arrive from above-right (the deck pile area) with a
         *   visible arc rotation so the player can track where they
         *   came from. */
        .r-card.r-deal-in,
        .r-tcard.r-deal-in{
          animation:rDealIn .95s cubic-bezier(.18,.85,.32,1.05) backwards;
          animation-delay:calc(var(--i, 0) * 280ms);
        }
        @keyframes rDealIn{
          0%   { opacity:0; transform:translate(120px, -180px) rotate(-22deg) scale(.45); }
          50%  { opacity:1; }
          80%  { transform:translate(0, 8px) rotate(3deg) scale(1.04); }
          100% { opacity:1; transform:translate(0, 0) rotate(0) scale(1); }
        }

        /* ─ Declaration bar (RONDA / TRINGA buttons) ─
         * Anchored to the LEFT side, just above the player's hand, so the
         * RONDA button sits by the player rather than blocking the centre.
         * No countdown — it stays until the player plays one of the pair
         * cards, then disappears on its own. */
        .r-declare-bar{
          position:absolute;
          left:14px;
          /* Down at the player's card level, to the LEFT of the hand. */
          bottom:calc(56px + env(safe-area-inset-bottom));
          display:flex; flex-direction:column; align-items:flex-start; gap:8px;
          /* MUST sit above the hand (.r-bottom jumps to z-index:10 on
             small/short screens). At z-index:9 the hand cards covered the
             RONDA button and swallowed taps — bump well above it. */
          z-index:40;
          pointer-events:none;
        }
        .r-declare-bar:empty{ display:none; }
        .r-declare{
          position:relative; overflow:hidden;
          pointer-events:auto;
          display:inline-flex; align-items:center; gap:8px;
          padding:13px 26px 15px; border-radius:14px;
          min-height:52px;            /* big, easy tap target */
          font-family:'Outfit',sans-serif;
          font-weight:900; letter-spacing:1.4px;
          font-size:15px; color:#fff;
          border:none; cursor:pointer;
          -webkit-tap-highlight-color:transparent; touch-action:manipulation;
          box-shadow:0 8px 22px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.25);
          transition:transform .12s, box-shadow .2s, filter .15s;
          animation:rDeclarePulse 1.4s ease-in-out infinite;
        }
        .r-declare:hover{ filter:brightness(1.08); }
        .r-declare:active{ transform:scale(.96); }
        .r-declare small{ font-size:10px; opacity:.85; font-weight:800; }
        .r-declare-lbl{ font-size:17px; letter-spacing:1.8px; }
        .r-declare-cd{
          font-size:11px; font-weight:900;
          padding:1.5px 7px; border-radius:99px;
          background:rgba(0,0,0,.32); color:#fff;
          letter-spacing:.6px;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.18);
        }
        /* Countdown ring — thin bar at the bottom of the button that
         * shrinks left→right as the 10s window burns down. */
        .r-declare-ring{
          position:absolute; left:0; right:0; bottom:0;
          height:3px; pointer-events:none;
          background:rgba(0,0,0,.30);
        }
        .r-declare-ring-fill{
          display:block; height:100%;
          background:linear-gradient(90deg, #FFFBEB, rgba(255,255,255,.65));
          box-shadow:0 0 10px rgba(255,251,235,.5);
          transition:width .1s linear;
        }
        .r-declare-ronda{
          background:linear-gradient(135deg, #FBBF24, #D97706); color:#1A1A1A;
        }
        .r-declare-ronda .r-declare-cd{ background:rgba(60,30,0,.40); color:#FFF7D6; }
        .r-declare-rondax2{
          background:linear-gradient(135deg, #FB923C, #C2410C); color:#1A1A1A;
        }
        .r-declare-rondax2 .r-declare-cd{ background:rgba(60,20,0,.40); color:#FFE4D0; }
        .r-declare-tringa{
          background:linear-gradient(135deg, #A78BFA, #6D28D9);
        }
        .r-declare-tringa .r-declare-ring-fill{ background:linear-gradient(90deg, #FBBF24, #FCD34D); box-shadow:0 0 10px rgba(251,191,36,.6); }

        /* ── 5-second declaration broadcast banner ──
         * Big center-screen card that pops in when ANYONE at the table
         * declares RONDA / RONDA x2 / TRINGA. Visible to all players. */
        .r-declare-bcast{
          /* Pops in the bottom-LEFT corner (right by the player), NOT the
             centre — so the "RONDA!" call never covers the table. */
          position:absolute; left:16px; top:auto;
          bottom:calc(112px + env(safe-area-inset-bottom));
          transform-origin:left bottom;
          display:flex; align-items:center; gap:10px;
          padding:11px 18px 11px 11px; border-radius:15px;
          background:linear-gradient(180deg, rgba(16,12,30,.97) 0%, rgba(8,6,18,.97) 100%);
          border:2px solid rgba(255,255,255,.10);
          box-shadow:
            0 18px 50px rgba(0,0,0,.7),
            0 0 32px rgba(251,191,36,.30),
            inset 0 1px 0 rgba(255,255,255,.08);
          opacity:0;
          z-index:120;
          pointer-events:none;
          animation:rDeclareBcastIn .35s cubic-bezier(.2,.9,.3,1.4) forwards;
        }
        .r-declare-bcast.out{ animation:rDeclareBcastOut .3s ease forwards; }
        @keyframes rDeclareBcastIn{
          0%  { opacity:0; transform:translateY(10px) scale(.8); }
          70% { opacity:1; transform:translateY(0) scale(1.03); }
          100%{ opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes rDeclareBcastOut{
          to { opacity:0; transform:translateY(8px) scale(.9); }
        }
        .r-declare-bcast-tringa{ border-color:rgba(167,139,250,.85); box-shadow:0 30px 80px rgba(0,0,0,.7), 0 0 50px rgba(167,139,250,.55), inset 0 1px 0 rgba(255,255,255,.10); }
        .r-declare-bcast-ronda { border-color:rgba(251,191,36,.85); box-shadow:0 30px 80px rgba(0,0,0,.7), 0 0 50px rgba(251,191,36,.55),  inset 0 1px 0 rgba(255,255,255,.10); }
        .r-declare-bcast-av{
          flex:0 0 auto;
          width:46px; height:46px; border-radius:50%;
          background:linear-gradient(180deg, #7C3AED, #4C1D95);
          background-size:cover; background-position:center;
          border:3px solid rgba(255,215,130,.6);
          display:flex; align-items:center; justify-content:center;
          font-weight:900; font-size:22px; color:#fff;
          box-shadow:0 6px 18px rgba(0,0,0,.6);
        }
        .r-declare-bcast-txt{ display:flex; flex-direction:column; gap:2px; line-height:1; }
        .r-declare-bcast-who{
          font-family:'Outfit',sans-serif;
          font-size:13px; font-weight:900; letter-spacing:1.4px;
          color:rgba(255,255,255,.65);
          text-transform:uppercase;
        }
        .r-declare-bcast-kind{
          font-family:'Bangers','Outfit',sans-serif;
          font-size:30px; letter-spacing:2px;
          background:linear-gradient(180deg, #FFE9B0 0%, #FBBF24 50%, #D97706 100%);
          -webkit-background-clip:text; background-clip:text; color:transparent;
          filter:drop-shadow(0 2px 6px rgba(0,0,0,.5));
        }
        .r-declare-bcast-tringa .r-declare-bcast-kind{
          background:linear-gradient(180deg, #DDD6FE 0%, #A78BFA 50%, #6D28D9 100%);
          -webkit-background-clip:text; background-clip:text; color:transparent;
        }

        /* ── Seat-anchored declaration badge ──
         * Pops just above the declaring player's profile so the whole
         * table sees WHO called RONDA / TRINGA. */
        .r-seat-ronda{
          position:absolute;
          transform:translate(-50%, -100%) scale(1);
          transform-origin:center bottom;
          display:flex; flex-direction:column; align-items:center; gap:0;
          padding:5px 13px 6px; border-radius:12px;
          background:linear-gradient(180deg, rgba(16,12,30,.98) 0%, rgba(8,6,18,.98) 100%);
          border:2px solid rgba(251,191,36,.9);
          box-shadow:0 10px 26px rgba(0,0,0,.6), 0 0 22px rgba(251,191,36,.5), inset 0 1px 0 rgba(255,255,255,.10);
          z-index:170; pointer-events:none; white-space:nowrap;
          animation:rSeatRondaIn .32s cubic-bezier(.2,.9,.3,1.4) forwards;
        }
        .r-seat-ronda.out{ animation:rSeatRondaOut .3s ease forwards; }
        .r-seat-ronda-kind{
          font-family:'Bangers','Outfit',sans-serif;
          font-size:21px; letter-spacing:1.6px; line-height:1;
          background:linear-gradient(180deg, #FFE9B0 0%, #FBBF24 55%, #D97706 100%);
          -webkit-background-clip:text; background-clip:text; color:transparent;
          filter:drop-shadow(0 1px 3px rgba(0,0,0,.5));
        }
        .r-seat-ronda-who{
          font-family:'Outfit',sans-serif;
          font-size:9px; font-weight:900; letter-spacing:1px;
          color:rgba(255,255,255,.6); text-transform:uppercase; line-height:1.4;
        }
        .r-seat-ronda-tringa{
          border-color:rgba(167,139,250,.9);
          box-shadow:0 10px 26px rgba(0,0,0,.6), 0 0 22px rgba(167,139,250,.55), inset 0 1px 0 rgba(255,255,255,.10);
        }
        .r-seat-ronda-tringa .r-seat-ronda-kind{
          background:linear-gradient(180deg, #DDD6FE 0%, #A78BFA 55%, #6D28D9 100%);
          -webkit-background-clip:text; background-clip:text; color:transparent;
        }
        @keyframes rSeatRondaIn{
          0%  { opacity:0; transform:translate(-50%, -88%) scale(.65); }
          70% { opacity:1; transform:translate(-50%, -100%) scale(1.06); }
          100%{ opacity:1; transform:translate(-50%, -100%) scale(1); }
        }
        @keyframes rSeatRondaOut{
          to { opacity:0; transform:translate(-50%, -112%) scale(.85); }
        }
        /* Hand face-down (during deal ceremony) — each card appears one
         * at a time, perfectly synced with the flier that "lands" at
         * the player's hand position. After all cards arrive face-down
         * the hand re-renders face-up. The dealing stagger matches the
         * ceremony's per-card STAGGER (220ms × 4 players = 880ms gap
         * per round — but for ME specifically I see one card every
         * 220ms*4 cycle, so we use 880ms steps via --i). */
        .r-hand.is-dealing .r-card img{ visibility:hidden; }
        .r-hand.is-dealing .r-card{
          background:
            linear-gradient(135deg,
              #DC2626 0%, #DC2626 49%,
              #FBBF24 49%, #FBBF24 51%,
              #DC2626 51%, #DC2626 100%);
          opacity:0;
          transform:translateY(-6px) scale(.92);
          animation:rHandCardArrive .35s ease forwards;
          /* The cards arrive in deal-round order — my 1st card lands
           * after p0 (~880ms if I'm seat 0). Approximation: ~per-card
           * stagger of 220ms × number-of-players. */
          animation-delay:calc(var(--i, 0) * 880ms + 200ms);
        }
        @keyframes rHandCardArrive{
          0%   { opacity:0; transform:translateY(-12px) scale(.85); }
          70%  { opacity:1; transform:translateY(2px) scale(1.02); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes rDeclarePulse{
          0%, 100% { transform:translateY(0); }
          50%      { transform:translateY(-3px); }
        }
        @media (max-width:420px){
          .r-declare-bar{ bottom:calc(50px + env(safe-area-inset-bottom)); }
          .r-declare{ font-size:11px; padding:6px 12px; }
        }
        @media (max-height:640px){
          .r-declare-bar{ bottom:calc(46px + env(safe-area-inset-bottom)); }
        }

        /* ─ FX layer (floating texts, capture bursts) ─ */
        .r-fx{
          position:absolute; inset:0; pointer-events:none; z-index:160;
        }

        /* ─ Dealing ceremony — flying card backs from deck → seats ─
         *   Each .r-deal-flier is positioned at the deck's screen-space
         *   coords by JS. CSS vars --dx/--dy tell it how far to fly.
         *   Cards stagger via animation-delay so the player can SEE
         *   each card travel out from the dealer one-by-one. */
        .r-deal-flier{
          position:fixed;
          border-radius:7px;
          background:
            linear-gradient(135deg,
              #DC2626 0%, #DC2626 49%,
              #FBBF24 49%, #FBBF24 51%,
              #DC2626 51%, #DC2626 100%);
          border:1.5px solid rgba(0,0,0,.6);
          box-shadow:0 6px 16px rgba(0,0,0,.55);
          opacity:0;
          z-index:170;
          animation:rDealFly .6s cubic-bezier(.22,.85,.32,1.05) forwards;
        }
        @keyframes rDealFly{
          0%   { transform:translate(0,0)    rotate(0)  scale(1);  opacity:0; }
          8%   { opacity:1; }
          70%  { transform:translate(calc(var(--dx) * .95), calc(var(--dy) * .95)) rotate(8deg) scale(.92); opacity:1; }
          100% { transform:translate(var(--dx), var(--dy)) rotate(0) scale(.7); opacity:0; }
        }
        .r-float{
          position:absolute; left:50%; top:38%;
          transform:translate(-50%, 0);
          padding:11px 22px;
          border-radius:99px;
          font-family:'Outfit',sans-serif;
          font-weight:900; font-size:18px; letter-spacing:1.8px;
          box-shadow:0 16px 40px rgba(0,0,0,.6);
          animation:rFloat 1.7s cubic-bezier(.16,1,.3,1) forwards;
        }
        .r-float-win {
          background:linear-gradient(135deg, #FBBF24, #D97706);
          color:#1A1A1A;
          text-shadow:0 1px 0 rgba(255,255,255,.4);
        }
        .r-float-loss{
          background:linear-gradient(135deg, #FCA5A5, #B91C1C);
          color:#fff;
          text-shadow:0 1px 2px rgba(0,0,0,.5);
        }
        @keyframes rFloat{
          0%   { opacity:0; transform:translate(-50%, 50px) scale(.4); }
          20%  { opacity:1; transform:translate(-50%, 0)    scale(1.06); }
          40%  { opacity:1; transform:translate(-50%, -8px) scale(1); }
          100% { opacity:0; transform:translate(-50%, -90px) scale(.85); }
        }
        .r-burst{
          position:absolute; left:50%; top:50%;
          transform:translate(-50%, -50%) scale(.6);
          text-align:center;
          font-family:'Outfit',sans-serif;
          animation:rBurst 1.4s cubic-bezier(.16,1,.3,1);
        }
        .r-burst span{
          display:block; font-size:48px; font-weight:900; line-height:1;
          text-shadow:0 2px 8px rgba(0,0,0,.55);
        }
        .r-burst small{ font-size:11px; font-weight:800; letter-spacing:1.5px; opacity:.85; }
        .r-burst-mine span{ color:#FBBF24; text-shadow:0 0 18px rgba(251,191,36,.7); }
        .r-burst-opp  span{ color:#FCA5A5; text-shadow:0 0 18px rgba(248,113,113,.55); }
        @keyframes rBurst{
          0%   { transform:translate(-50%,-50%) scale(.5);  opacity:0; }
          25%  { transform:translate(-50%,-90%) scale(1.3); opacity:1; }
          100% { transform:translate(-50%,-160%) scale(.85); opacity:0; }
        }

        /* ─ OVERLAYS ─ */
        .r-overlay{
          position:fixed; inset:0; z-index:200;
          display:flex; align-items:center; justify-content:center;
          background:rgba(4,8,18,0); pointer-events:none;
          transition:background .35s;
        }
        .r-overlay.show{ background:rgba(4,8,18,.78); backdrop-filter:blur(10px); pointer-events:auto; }
        .r-overlay-card{
          padding:24px 22px; border-radius:18px;
          background:linear-gradient(180deg, #1A2236, #0E1525);
          border:1px solid rgba(255,255,255,.1);
          box-shadow:0 30px 80px rgba(0,0,0,.7);
          text-align:center; color:#fff;
          min-width:300px; max-width:90vw;
          /* Scroll the card itself when it's taller than the screen (long
             rules list on short phones) so nothing gets cut off and the
             player can move through it. */
          max-height:88vh; overflow-y:auto; -webkit-overflow-scrolling:touch;
          overscroll-behavior:contain;
          transform:scale(.85); opacity:0;
          transition:transform .35s cubic-bezier(.18,.89,.32,1.07), opacity .35s;
          position:relative;
        }
        .r-overlay.show .r-overlay-card{ transform:scale(1); opacity:1; }
        .r-overlay-x{
          position:absolute; top:10px; right:12px;
          background:none; border:none; color:rgba(255,255,255,.55);
          font-size:22px; cursor:pointer;
        }
        .r-ro-eyebrow{ font-size:10px; font-weight:900; letter-spacing:3px; color:#FBBF24; margin-bottom:14px; }
        .r-ro-row{ display:flex; gap:24px; justify-content:center; margin-bottom:10px; }
        .r-ro-num{
          font-family:'Outfit',sans-serif; font-weight:900;
          font-size:30px; color:#fff;
          text-shadow:0 1px 3px rgba(0,0,0,.5);
        }
        .r-ro-lbl{ font-size:9px; letter-spacing:1.5px; opacity:.6; }
        .r-ro-totals{ margin-top:8px; font-size:12px; opacity:.85; }
        .r-ro-totals b{ color:#FBBF24; font-size:14px; }

        .r-mo-eyebrow{ font-size:10px; font-weight:900; letter-spacing:3px; color:#FBBF24; margin-bottom:10px; }
        .r-mo-title{
          font-family:'Outfit',sans-serif; font-weight:900;
          font-size:24px; letter-spacing:.5px; margin-bottom:6px;
        }
        .r-mo-sub{ font-size:11px; opacity:.7; margin-bottom:14px; }
        /* Winning players' profiles on the match-over card. */
        .r-mo-winners{ display:flex; justify-content:center; gap:18px; margin:6px 0 12px; }
        .r-mo-winner{ display:flex; flex-direction:column; align-items:center; gap:6px; }
        .r-mo-winner-av{
          width:62px; height:62px; border-radius:50%;
          background-size:cover; background-position:center;
          border:3px solid #FBBF24;
          box-shadow:0 6px 18px rgba(0,0,0,.55), 0 0 18px rgba(251,191,36,.45);
        }
        .r-mo-winner-av-letter{
          display:flex; align-items:center; justify-content:center;
          background:linear-gradient(180deg,#7C3AED,#4C1D95);
          font-family:'Bangers',sans-serif; font-size:28px; color:#FFFBEB;
        }
        .r-mo-winner-name{ font-size:12px; font-weight:800; color:#FFE9B0; max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .r-mo-scores{ font-size:13px; margin-bottom:18px; line-height:1.8; }
        .r-mo-scores b{ color:#FBBF24; font-weight:900; }
        /* Ranked RONDA — rank-point change badge on the match-over card. */
        .r-mo-rank{
          display:flex; flex-direction:column; align-items:center; gap:2px;
          margin:0 auto 16px; padding:10px 18px; border-radius:14px; width:max-content;
          background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
          border:1px solid rgba(255,255,255,.12);
        }
        .r-mo-rank-lbl{ font-size:9px; font-weight:900; letter-spacing:2px; opacity:.75; }
        .r-mo-rank-delta{ font-family:'Bangers','Outfit',sans-serif; font-size:26px; letter-spacing:1px; line-height:1; }
        .r-mo-rank-total{ font-size:10.5px; font-weight:700; opacity:.7; }
        .r-mo-rank.up   { border-color:rgba(74,222,128,.5);  box-shadow:0 0 18px rgba(74,222,128,.25); }
        .r-mo-rank.up   .r-mo-rank-delta{ color:#86EFAC; text-shadow:0 0 12px rgba(74,222,128,.5); }
        .r-mo-rank.down { border-color:rgba(248,113,113,.5); box-shadow:0 0 18px rgba(248,113,113,.22); }
        .r-mo-rank.down .r-mo-rank-delta{ color:#FCA5A5; text-shadow:0 0 12px rgba(248,113,113,.45); }
        .r-mo-btn{
          padding:10px 22px; border-radius:10px; border:none;
          background:linear-gradient(135deg, #FBBF24, #D97706); color:#1A1A1A;
          font-weight:900; letter-spacing:1.5px; font-size:12px; cursor:pointer;
        }

        .r-help-card{ min-width:320px; max-width:440px; text-align:left; }
        .r-help-eyebrow{ font-size:10px; letter-spacing:3px; color:#FBBF24; font-weight:900; text-align:center; margin-bottom:14px; }
        .r-help-rules{ display:flex; flex-direction:column; gap:10px; }
        .r-rule{ display:flex; gap:10px; align-items:flex-start; }
        .r-rule div{ font-size:12px; line-height:1.45; opacity:.92; flex:1; }
        .r-rule b{ color:#FBBF24; }
        .r-rule-num{
          flex:0 0 22px; height:22px; border-radius:50%;
          background:linear-gradient(135deg, #FBBF24, #D97706); color:#1A1A1A;
          font-weight:900; font-size:11px;
          display:flex; align-items:center; justify-content:center;
        }
        .r-help-btn{
          margin-top:14px; width:100%; padding:12px;
          border:none; border-radius:10px; cursor:pointer;
          font-weight:900; font-size:12px; letter-spacing:1.5px;
        }
        .r-help-go{ background:linear-gradient(135deg, #FBBF24, #D97706); color:#1A1A1A; }

        /* ─ Profile mini-modal ─ */
        .r-prof-card{
          padding:22px 20px 18px; border-radius:18px;
          background:linear-gradient(180deg, #1A2236, #0E1525);
          border:1px solid rgba(255,255,255,.1);
          box-shadow:0 30px 80px rgba(0,0,0,.7);
          color:#fff; min-width:280px; max-width:340px;
          text-align:center;
          transform:scale(.85); opacity:0;
          transition:transform .3s cubic-bezier(.18,.89,.32,1.07), opacity .3s;
          position:relative;
        }
        .r-overlay.show .r-prof-card{ transform:scale(1); opacity:1; }
        .r-prof-av{
          width:84px; height:84px; border-radius:50%;
          background:linear-gradient(180deg, #7C3AED, #4C1D95);
          background-size:cover; background-position:center;
          border:3px solid rgba(255, 215, 130, .5);
          display:flex; align-items:center; justify-content:center;
          font-weight:900; font-size:30px; color:#fff;
          margin:0 auto 10px;
          box-shadow:0 8px 22px rgba(0,0,0,.55);
        }
        .r-prof-name{
          font-family:'Outfit',sans-serif;
          font-size:20px; font-weight:900;
          letter-spacing:.3px; color:#FFE9B0;
          margin-bottom:8px;
        }
        .r-prof-tags{
          display:flex; gap:6px; justify-content:center;
          margin-bottom:14px;
        }
        .r-prof-tag{
          font-size:9px; font-weight:900; letter-spacing:1.3px;
          padding:3px 8px; border-radius:99px;
        }
        .r-prof-tag-pt { background:rgba(34,197,94,.2);  color:#86EFAC; border:1px solid rgba(34,197,94,.4); }
        .r-prof-tag-opp{ background:rgba(232,50,74,.2);  color:#FCA5A5; border:1px solid rgba(232,50,74,.4); }
        .r-prof-tag-bot{ background:rgba(168,85,247,.2); color:#D8B4FE; border:1px solid rgba(168,85,247,.4); }
        .r-prof-stats{
          display:grid; grid-template-columns:repeat(3, 1fr);
          gap:6px; margin-bottom:16px;
          padding:10px 6px;
          background:rgba(255,255,255,.04);
          border-radius:10px;
        }
        .r-prof-stat-n{
          font-family:'Outfit',sans-serif;
          font-weight:900; font-size:18px;
          color:#FBBF24;
          line-height:1;
        }
        .r-prof-stat-l{
          font-size:9px; letter-spacing:1px;
          opacity:.6; font-weight:700;
          margin-top:3px;
        }
        .r-prof-actions{
          display:flex; flex-direction:column; gap:7px;
        }
        .r-prof-btn{
          padding:11px 14px; border-radius:10px;
          border:1px solid rgba(255,255,255,.1);
          background:rgba(255,255,255,.06); color:#fff;
          font-weight:900; font-size:12px; letter-spacing:.5px;
          cursor:pointer;
          transition:background .15s, transform .1s;
        }
        .r-prof-btn:hover:not(:disabled){ background:rgba(255,255,255,.12); }
        .r-prof-btn:active:not(:disabled){ transform:scale(.97); }
        .r-prof-btn:disabled{ opacity:.4; cursor:not-allowed; }
        .r-prof-btn-like{
          background:linear-gradient(135deg, #F472B6, #DB2777);
          border-color:transparent;
        }
        .r-prof-btn-friend{
          background:linear-gradient(135deg, #60A5FA, #2563EB);
          border-color:transparent;
        }
        .r-prof-btn-view{
          background:rgba(255,255,255,.08);
        }

        /* ─ MOBILE LAYOUT ─
         * Phones (especially landscape) have a tight vertical budget.
         * Strategy:
         *   1. Pull the felt higher up the screen + shrink it so the
         *      table sits in the top half.
         *   2. INTENTIONALLY clip ~30% of the hand cards off the bottom
         *      edge of the screen so they never overlap the table's
         *      lower row. Card rank lives in the top-left corner, so the
         *      visible 70% is still enough to identify + tap each card.
         *   3. Bump z-index so the hand stays above the felt visually. */
        @media (max-width:420px){
          .r-felt-wrap{ align-items:flex-start; padding-top:7vh; }
          .r-felt{ width:99vw; height:50vh; margin-top:0; }
          .r-card{ width:72px; height:112px; }
          .r-tslot, .r-tcard{ width:48px; height:74px; }
          .r-table{ padding:6px 8px; gap:10px 14px; }
          .r-deck{ width:52px; height:76px; font-size:13px; }
          /* Shrink the unified panel a touch on phones, but keep the avatar +
             cards big enough to read each player's design. */
          .r-pp{ min-width:116px; max-width:186px; padding:5px 8px 5px; gap:4px; }
          .r-pp-av{ width:38px; height:38px; font-size:15px; }
          .r-pp-name{ font-size:10px; }
          .r-pp-mic{ width:23px; height:23px; font-size:11px; }
          .r-pp-cards{ min-height:58px; gap:4px; }
          .r-cardback{ width:38px; height:54px; }
          /* Tuck the side profiles INSIDE the felt edge so they don't
           * spill off the screen on phones (where the felt fills nearly
           * the full viewport width). */
          .r-seat-left{ left:6px; }
          .r-seat-right{ right:6px; }
          /* Partner profile lifted further above the felt so the panel
           * + card fan no longer hover over the table's top row. */
          .r-seat-top{ top:-76px; }
          .r-scoreboard{ min-width:100px; padding:5px 8px; }
          .r-sb-row{ font-size:11.5px; }
          .r-sb-pts{ font-size:15px; }
          .r-turnbar{ font-size:11px; padding:7px 16px; letter-spacing:1.6px; }
          /* Clip the lower ~30% of the hand off the bottom of the screen
           * so the cards no longer cover the table's second row. */
          .r-bottom{
            bottom:calc(-34px + env(safe-area-inset-bottom));
            z-index:10;
          }
          /* Deck stays beside the dealer's panel, scaled for the smaller felt. */
          .r-deck{ width:40px; height:58px; font-size:13px; }
          .r-deck[data-dealer="top"]   { top:-48px;    left:calc(50% + 78px); }
          .r-deck[data-dealer="me"]    { bottom:-22px; right:8px; left:auto; }
          .r-deck[data-dealer="left"]  { left:6px;     top:calc(50% + 48px); }
          .r-deck[data-dealer="right"] { right:6px;    top:calc(50% + 48px); }
        }
        @media (max-width:360px){
          .r-felt-wrap{ padding-top:5vh; }
          .r-felt{ height:46vh; }
          .r-card{ width:64px; height:100px; }
          .r-tslot, .r-tcard{ width:42px; height:66px; }
          .r-deck{ width:44px; height:64px; font-size:12px; }
          .r-table{ gap:7px 10px; }
          .r-pp{ min-width:108px; max-width:166px; }
          .r-pp-av{ width:36px; height:36px; font-size:14px; }
          .r-pp-cards{ min-height:52px; }
          .r-cardback{ width:34px; height:48px; }
          .r-seat-top{ top:-70px; }
          .r-seat-left{ left:6px; }
          .r-seat-right{ right:6px; }
          .r-bottom{ bottom:calc(-30px + env(safe-area-inset-bottom)); }
        }
        /* Landscape phones — height is the binding constraint. Shrink
         * felt further and tuck the hand even lower so the table's
         * BOTH rows stay fully visible above the hand. */
        @media (max-height:640px){
          .r-felt-wrap{ padding-top:3vh; }
          .r-felt{ height:62vh; }
          .r-card{ height:104px; width:68px; }
          .r-bottom{
            bottom:calc(-32px + env(safe-area-inset-bottom));
            z-index:10;
          }
          /* Short landscape: keep the panel compact so it doesn't eat the
           * limited vertical space, and lift the partner clear of the table. */
          .r-pp{ min-width:96px; gap:3px; padding:4px 7px; }
          .r-pp-av{ width:36px; height:36px; font-size:14px; }
          .r-pp-cards{ min-height:42px; }
          .r-cardback{ width:30px; height:42px; }
          .r-seat-top{ top:-60px; }
          .r-seat-left{ left:8px; }
          .r-seat-right{ right:8px; }
        }
        @media (max-height:480px){
          .r-felt-wrap{ padding-top:2vh; }
          .r-felt{ height:68vh; }
          .r-card{ height:96px; width:62px; }
          .r-bottom{ bottom:calc(-30px + env(safe-area-inset-bottom)); }
          .r-pp{ min-width:90px; gap:3px; padding:4px 6px; }
          .r-pp-av{ width:32px; height:32px; font-size:13px; }
          .r-pp-cards{ min-height:38px; }
          .r-cardback{ width:27px; height:38px; }
          .r-seat-top{ top:-54px; }
          .r-seat-left{ left:6px; }
          .r-seat-right{ right:6px; }
        }
      `;
      document.head.appendChild(s);
    },
  };
  window.Ronda = Ronda;

  // Dev preview of the REAL ranked result screen (RONDA). In the console run
  // `_previewRankedRonda()` (win), `('loss')`, or `('promo')`.
  window._previewRankedRonda = function(mode){
    const me  = S.user?.id || 'me';
    const won = mode !== false && mode !== 'loss';
    const promo = mode === 'promo';
    const newRP = promo ? 3960 : won ? 4200 : 3760;
    const delta = promo ? 95 : won ? 28 : -22;
    Ronda.myId = me; Ronda.myTeam = 0; Ronda.isSpectator = false;
    Ronda.state = Ronda.state || {};
    Ronda.state.players = [{ id:me, team:0, username:S.user?.username||'You' }];
    const my = {
      playerId:me, delta, newRank:newRP, oldRank:newRP-delta, after:newRP, before:newRP-delta,
      rankedTier: (window._rankedTierForRP ? window._rankedTierForRP(newRP) : null),
      won, mvp:won, winStreak:won?3:0, streak:won?3:0, peakRank:newRP+220,
      breakdown: won ? { win:Math.round(delta*.62), margin:Math.round(delta*.22), streak:Math.round(delta*.12), mvp:delta-Math.round(delta*.62)-Math.round(delta*.22)-Math.round(delta*.12) }
                     : { win:Math.round(delta*.8), margin:delta-Math.round(delta*.8), streak:0, mvp:0 },
    };
    const d = { winnerTeam: won?0:1, finalTeamScores: won?[41,33]:[37,41], reason:'first to 41', rankedChanges:[my] };
    Ronda._showRankedResultPremium(d, my, 'first to 41');
  };
