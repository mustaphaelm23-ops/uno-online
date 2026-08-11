  /* ═══ RECONNECT GRACE COUNTDOWN ═══
     The server gives a dropped player GRACE_MS (30s) to reconnect; if they
     don't, their SIDE forfeits (markAbandoned → the opposing player/team wins;
     team-aware for RONDA 2v2). This is the VISIBLE 30s timer so everyone sees
     the window tick down — and the dropped player sees "reconnecting you…". */
  const Grace = {
    _timer:null, _endsAt:0, _total:30000,
    _ensure(){
      let el = document.getElementById('graceBanner');
      if(el) return el;
      if(!document.getElementById('graceStyles')){
        const st = document.createElement('style'); st.id = 'graceStyles';
        st.textContent = `
          .grace-banner{position:fixed;left:10px;top:54px;transform:translateY(-12px);z-index:1400;
            display:none;align-items:center;gap:9px;max-width:min(290px,70vw);
            padding:8px 12px 10px;border-radius:12px;font-family:'Outfit',sans-serif;color:#fff;
            background:linear-gradient(180deg,rgba(40,22,22,.95),rgba(24,12,12,.96));
            border:1px solid rgba(232,50,74,.5);box-shadow:0 10px 28px rgba(0,0,0,.55),0 0 18px rgba(232,50,74,.24);
            opacity:0;transition:opacity .25s,transform .25s;}
          .grace-banner.show{display:flex;opacity:.96;transform:translateY(0);}
          .grace-banner.self{border-color:rgba(251,191,36,.55);
            background:linear-gradient(180deg,rgba(40,30,12,.97),rgba(22,16,6,.98));
            box-shadow:0 14px 40px rgba(0,0,0,.6),0 0 26px rgba(251,191,36,.3);}
          .grace-ic{font-size:18px;line-height:1;flex-shrink:0;}
          .grace-txt{flex:1;min-width:0;font-size:11.5px;font-weight:700;line-height:1.2;}
          .grace-txt b{color:#FCA5A5;}
          .grace-banner.self .grace-txt b{color:#FDE68A;}
          .grace-time{flex-shrink:0;font-family:'Bangers',cursive;font-size:20px;letter-spacing:.5px;
            color:#FCA5A5;min-width:28px;text-align:center;}
          .grace-banner.self .grace-time{color:#FDE68A;}
          .grace-bar{position:absolute;left:0;right:0;bottom:0;height:3px;border-radius:0 0 14px 14px;overflow:hidden;background:rgba(0,0,0,.4);}
          .grace-fill{height:100%;width:100%;background:linear-gradient(90deg,#E8324A,#FBBF24);transition:width .25s linear;}
          .grace-banner.self .grace-fill{background:linear-gradient(90deg,#FBBF24,#34D399);}`;
        document.head.appendChild(st);
      }
      el = document.createElement('div');
      el.className = 'grace-banner'; el.id = 'graceBanner';
      el.innerHTML = `<div class="grace-ic" id="graceIc">⏳</div>
        <div class="grace-txt"><b id="graceName"></b> <span id="graceMsg"></span></div>
        <div class="grace-time" id="graceTime">30</div>
        <div class="grace-bar"><div class="grace-fill" id="graceFill"></div></div>`;
      document.body.appendChild(el);
      return el;
    },
    _start(total, isSelf, ic, name, msg){
      this._total = total || 30000; this._endsAt = Date.now() + this._total;
      const el = this._ensure();
      el.classList.toggle('self', !!isSelf);
      document.getElementById('graceIc').textContent = ic;
      document.getElementById('graceName').textContent = name;
      document.getElementById('graceMsg').textContent = msg;
      el.classList.add('show');
      clearInterval(this._timer); this._tick(); this._timer = setInterval(()=>this._tick(), 250);
    },
    startOpponent(username, graceMs){ this._start(graceMs, false, '⏳', (username||'Player'), 'left — reconnect or they forfeit'); },
    startSelf(graceMs){ this._start(graceMs, true, '📡', 'Connection lost', '— reconnecting you…'); },
    _tick(){
      const remain = Math.max(0, this._endsAt - Date.now());
      const t = document.getElementById('graceTime'); if(t) t.textContent = Math.ceil(remain/1000);
      const f = document.getElementById('graceFill'); if(f) f.style.width = (remain/this._total*100)+'%';
      if(remain <= 0) this.stop();
    },
    stop(){ clearInterval(this._timer); this._timer = null;
      const el = document.getElementById('graceBanner'); if(el) el.classList.remove('show'); },
  };
  window.Grace = Grace;

  // ═══ WAITING-ROOM RE-SYNC WATCHDOG ═══
  // After a quit, the NEXT match's game-start push can be missed, leaving the
  // player stuck on the "Game Room" waiting screen until a manual refresh. If
  // we're still on room-screen shortly after joining, re-emit room:join to
  // re-fetch the live state (exactly what a refresh does) — the game:state /
  // ronda:state / dama:state that comes back drives the transition smoothly.
  let _roomReSyncT = null;
  function armRoomReSync(roomId, tries){
    clearTimeout(_roomReSyncT);
    _roomReSyncT = setTimeout(()=>{
      const onRoom = document.getElementById('room-screen')?.classList.contains('active');
      const inGame = document.getElementById('game-screen')?.classList.contains('active');
      if(inGame || !onRoom || S.roomId !== roomId || !S.socket?.connected) return;  // resolved / left
      try{ S.socket.emit('room:join', { roomId }); }catch(_){}                       // re-fetch state
      if((tries || 0) < 4) armRoomReSync(roomId, (tries || 0) + 1);                  // keep trying while stuck
    }, 1700);
  }
  function clearRoomReSync(){ clearTimeout(_roomReSyncT); _roomReSyncT = null; }
  window.armRoomReSync = armRoomReSync;
  window.clearRoomReSync = clearRoomReSync;

  /* ═══ SOCKET ═══ */
  function initSock(){
    if(S.socket?.connected)return;
    S.socket=io(SOCK,{auth:{token:S.token},reconnectionAttempts:10,reconnectionDelay:1500});
    const sk=S.socket;

    sk.on('connect',()=>{document.getElementById('dbar').classList.remove('show');Grace.stop();if(S.roomId)sk.emit('room:join',{roomId:S.roomId});});
    sk.on('disconnect',()=>{document.getElementById('dbar').classList.add('show');if(S.roomId)Grace.startSelf(30000);});
    // Account security — the server revoked this session ("log out everywhere",
    // password reset, or a stolen-token kill). Bounce straight to login.
    sk.on('session:revoked',()=>{
      try{ if(typeof toast==='function') toast('🔒 Session ended — please log in again','i'); }catch(_){}
      if(typeof _handleAuthExpiry==='function') _handleAuthExpiry();
      else if(typeof doLogout==='function') doLogout();
    });
    // Live online-players counter (broadcast on every connect/disconnect).
    sk.on('online:count',({count})=>{ if(typeof setOnlineCount==='function') setOnlineCount(count); });
    initChatListeners(sk);
    // Dama / Ronda use dedicated dama:* / ronda:* events. Wire here so
    // listeners always sit on the CURRENT socket (re-login / reconnect
    // doesn't strand them on a dead ref). Idempotent via _wired guard.
    if(typeof Dama !== 'undefined'){
      Dama._wired = false;
      Dama.bindEvents(sk);
    }
    if(typeof Chess !== 'undefined'){
      Chess._wired = false;
      Chess.bindEvents(sk);
    }
    if(typeof Ronda !== 'undefined'){
      Ronda._wired = false;
      Ronda.bindEvents(sk);
    }

    sk.on('game:spectator_state',(state)=>{
      S.isSpectator = true;
      document.body.classList.add('spectating');
      Clutch.reset();
      // Reveal Watchers tab for spectators (and players-with-toggle)
      const wt=document.getElementById('tabSpec'); if(wt) wt.style.display='';
      applySpectatorState(state);
      if(state.players) Clutch.check(state.players);
      showScreen('game-screen');
      addActivityMsg('👁️ You are spectating','game');
    });
    sk.on('game:spectator_state_update',(state)=>{
      if(!S.isSpectator) return;
      applySpectatorState(state);
      if(state.players) Clutch.check(state.players);
    });
    sk.on('league:round_ended', ({ round, winnerSlotId, nextRoundIn })=>{
      const ov = document.getElementById('roundIntermission');
      if (!ov) return;
      const title = document.getElementById('riTitle');
      const score = document.getElementById('riScore');
      const nextEl = document.getElementById('riNext');
      if (title) title.textContent = `ROUND ${round} DONE`;
      // Try to label the round-1 winner so it doesn't feel ambiguous
      const myName = S.user?.username || 'You';
      if (score) {
        const players = S.g?.players || [];
        const winnerPlayer = players.find(p => p.id === winnerSlotId) || null;
        if (winnerSlotId === 'draw') score.textContent = '🤝 Round drawn';
        else if (winnerPlayer) score.textContent = `🏁 ${winnerPlayer.username || 'Unknown'} won round ${round}`;
        else score.textContent = `🏁 Round ${round} done`;
      }
      const secs = Math.max(1, Math.round((nextRoundIn || 4500) / 1000));
      if (nextEl) nextEl.textContent = `Round 2 starting in ${secs}s…`;
      ov.classList.add('show');
      // Live countdown
      let left = secs;
      const t = setInterval(() => {
        left--;
        if (left <= 0) { clearInterval(t); return; }
        if (nextEl) nextEl.textContent = `Round 2 starting in ${left}s…`;
      }, 1000);
    });
    sk.on('league:round_started', ({ round })=>{
      const ov = document.getElementById('roundIntermission');
      if (ov) ov.classList.remove('show');
      const badge = document.getElementById('roundBadge');
      if (badge) badge.textContent = `ROUND ${round} / 2`;
      toast(`🔔 Round ${round} started`, 'i');
    });

    sk.on('vote:tally',({tally,my})=>{
      S.g.voteTally = tally || {};
      if(my !== undefined) S.g.myVote = my;
      if(S.isSpectator && S.g.players?.length) renderSpectatorOpps(S.g.players);
    });
    sk.on('chat:spectator_history',({messages})=>{
      const box=document.getElementById('specMsgs');
      if(box){box.innerHTML=''; (messages||[]).forEach(m=>addSpectatorMsg(m));}
    });
    sk.on('chat:spectator_message',(msg)=>{
      addSpectatorMsg(msg);
      // For non-spectator players, surface the watchers tab so they can peek
      const wt=document.getElementById('tabSpec'); if(wt) wt.style.display='';
    });
    sk.on('room:spectator_joined',({username,count})=>{
      addActivityMsg(`👁️ ${esc(username||'A watcher')} is now watching (${count} total)`,'join');
    });
    sk.on('room:spectator_left',({count})=>{
      addActivityMsg(`👁️ A watcher left (${count} watching)`,'leave');
    });

    sk.on('game:state',(state)=>{
      clearRoomReSync();   // we're in-game now — stop the waiting-room watchdog
      // Reset start-button guard so future restarts work
      const startBtn=document.getElementById('bstart');
      if(startBtn){startBtn.dataset.starting='';startBtn.disabled=true;startBtn.textContent='Waiting for players...';}
      // Kill the ranked-search radar overlay (if any) — we're transitioning
      // from the waiting room to the live game; the search is over.
      if(typeof _stopRankedSearch === 'function') _stopRankedSearch();
      S.isSpectator=false;
      document.body.classList.remove('spectating');
      Clutch.reset();
      S.calledUNO=false;
      applyFullState(state);showScreen('game-screen');
      // Hide my hand until the deal animation has actually dealt the cards —
      // the player shouldn't see their hand before it's been "dealt out".
      const _myHand0 = document.getElementById('myhand');
      if(_myHand0){ _myHand0.style.transition='none'; _myHand0.style.opacity='0'; }
      // Likewise hide the starting (top) card — it must be FLIPPED onto the
      // table AFTER the hands are dealt, never before the deal.
      const _top0 = document.getElementById('topcard');
      if(_top0){ _top0.style.transition='none'; _top0.style.opacity='0'; _top0.style.transform='scale(.55)'; }
      // Fresh game → clear any discard pile left over from the previous round.
      document.getElementById('discardStack')?.remove();
      showChatFab(true);addActivityMsg('🎮 Game has started!','game');
      // Auto-listen to voice chat the moment the game opens. The player
      // doesn't need to turn on their own mic to HEAR others — that
      // only matters when they want to talk back.
      try{ VoiceChat?.listen?.(); }catch(e){}
      initGameParticles();
      // ── Match-start cinematic ──
      // Plays a 3-2-1-GO countdown over the freshly-rendered game screen.
      // Card deal kicks off near the end of the countdown so the cards
      // are mid-flight as the overlay fades, landing perfectly when the
      // player gets full control. Reduced-motion: MatchIntro.play() is a
      // no-op, so the deal runs straight away (200ms delay like before).
      const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
      const dealDelay = reduced ? 200 : 2300; // start mid-cinematic
      if(typeof MatchIntro !== 'undefined') MatchIntro.play(state);
      else toast('Game started! 🎮','s');
      SFX.play('turn');
      // Deal animation: cards fly from center to each player
      setTimeout(()=>{
        const handSize = state.myHand?.length || 7;
        const handEl = document.getElementById('myhand');
        const deckEl = document.getElementById('drawpile');
        if(handEl) AnimLayer.deal(handSize, handEl);
        // Reveal the real hand ONLY once the dealt cards have flown in.
        const revealMs = reduced ? 300 : (Math.min(handSize,12)-1)*130 + 620;
        setTimeout(()=>{ if(handEl){ handEl.style.transition='opacity .45s ease'; handEl.style.opacity='1'; } }, revealMs);
        // Opponents
        (state.players||[]).forEach((p,idx)=>{
          if(p.id===S.user?.id) return;
          setTimeout(()=>{
            const panel = document.querySelector(`.opanel[data-pid="${p.id}"]`);
            if(panel && deckEl) AnimLayer.drawMany(p.handSize||7, deckEl, panel, {stagger:105,duration:560,playerId:p.id});
          }, idx*200);
        });
        // FIRST CARD — flipped onto the table only AFTER the hands are dealt.
        // A back card flies off the deck, then the real top card pops in.
        const firstCardMs = revealMs + 200;
        setTimeout(()=>{
          const topEl = document.getElementById('topcard');
          if(!topEl) return;
          if(!reduced && deckEl){ try{ AnimLayer.drawMany(1, deckEl, topEl, {duration:560}); }catch(e){} }
          setTimeout(()=>{
            topEl.style.transition='opacity .28s ease, transform .4s cubic-bezier(.34,1.56,.64,1)';
            topEl.style.opacity='1'; topEl.style.transform='scale(1)';
            try{ SFX.play('play'); }catch(e){}
            // restore natural styles so mid-game plays animate normally
            setTimeout(()=>{ topEl.style.transition=''; topEl.style.transform=''; }, 520);
          }, reduced ? 0 : 410);
        }, firstCardMs);
      }, dealDelay);
    });
    sk.on('game:state_update',(state)=>{if(!S.roomId)return;applyFullState(state);});
    sk.on('practice:error',({reason}={})=>{
      S.roomId=null;
      if(!document.getElementById('game-screen').classList.contains('active')){
        toast('⚠️ '+(reason||'Training could not start — try again'),'e');
      }
    });
    sk.on('world:history',(msgs)=>{
      const box=document.getElementById('worldMsgs');
      if(!box) return;
      if(!msgs || !msgs.length){
        box.innerHTML=`<div class="rail-empty">No messages yet — be the first to say hi 👋</div>`;
      } else {
        box.innerHTML=msgs.map(_worldMsgHTML).join('');
        box.scrollTop=box.scrollHeight;
      }
    });
    sk.on('world:msg',(m)=>{
      // Wipe the empty-state placeholder before appending the first real message.
      const box=document.getElementById('worldMsgs');
      if(box && box.querySelector('.rail-empty')) box.innerHTML='';
      _appendWorldMsg(m);
    });
    // Server tells us we were throttled (1.2s between messages). Quiet hint;
    // ignored silently if toast() isn't available.
    sk.on('world:throttled',()=>{ try{ toast('Slow down — one message at a time','i'); }catch(e){} });

    // ── P4 economy events ────────────────────────────────────────────
    // match:debited fires per-socket right after game:start succeeds and
    // the server has taken the entry fee out of S.user.coins. We mirror
    // the new balance locally + animate every coin pill that's visible
    // (header, sidebar, hero-banner). Toast tells the player why their
    // balance dropped — explicit beats silent.
    sk.on('match:debited',({entryFee,coins})=>{
      if(typeof coins==='number'){
        S.user.coins=coins;
        try{ localStorage.setItem('uno_user',JSON.stringify(S.user)); }catch(e){}
        if(typeof _animateCount==='function'){
          _animateCount('hcoins',coins);
          _animateCount('scoins',coins);
          _animateCount('heroCoins',coins);
        }
      }
      toast(`−${entryFee} 🪙 entry fee`,'i');
    });

    // match:payout fires per-socket at game-end for the winner (or for each
    // remaining human if a bot won — they get an equal share). Single source
    // of truth for the post-match balance; showWin reads data.payout from
    // the game:over broadcast for the DISPLAY but no longer mirrors coins
    // locally (server is authoritative).
    // P4-NEW.1a — opponent disconnect / abandon / reconnect events. Light
    // toasts so the room reads the right state at a glance; deeper UI
    // polish (greyed-out avatar, grace-bar countdown) is a follow-up.
    sk.on('player:disconnected',({username,voluntary,graceMs})=>{
      if(voluntary){ toast(`⚠️ ${username} left the match`,'w'); }
      else { Grace.startOpponent(username, graceMs||30000); }   // visible 30s countdown
    });
    sk.on('player:abandoned',({username})=>{
      Grace.stop();
      toast(`💀 ${username} forfeited — match over`,'w');
    });
    sk.on('player:reconnected',({username,abandoned})=>{
      Grace.stop();
      toast(`✓ ${username} reconnected${abandoned?' (forfeit still applies)':''}`,'s');
    });
    // GDD §7.5 — quick-chat incoming + throttle feedback.
    sk.on('chat:quick',(data)=>{
      if(typeof QuickChat !== 'undefined') QuickChat.onIncoming(data);
    });
    sk.on('chat:quick_throttled',()=>{ try{ toast('Quick chat throttled — wait 2s','i'); }catch(e){} });

    // GDD §7.5 B — private DM incoming + read-receipt + post-connect badge refresh.
    sk.on('dm:incoming',(msg)=>{ if(typeof DM !== 'undefined') DM.onIncoming(msg); });
    sk.on('dm:read_by',(_d)=>{ /* read-receipt; future UI hook */ });
    if(typeof DM !== 'undefined') setTimeout(()=>DM.refreshUnread(), 600);

    // GDD §7.2 — account level-up. Server has already granted the rewards
    // (coins + occasional diamonds); we just sync the new XP/level + toast.
    sk.on('account:levelup',(data)=>{
      if(!data || !S.user) return;
      if(typeof data.accountXP === 'number') S.user.accountXP = data.accountXP;
      if(typeof data.newLevel  === 'number') S.user.accountLevel = data.newLevel;
      try{ localStorage.setItem('uno_user',JSON.stringify(S.user)); }catch(e){}
      // Update the lobby hero pill if visible.
      const el=document.getElementById('heroLevel');
      if(el){
        el.textContent=`Lv ${data.newLevel}`;
        el.classList.remove('level-up'); void el.offsetWidth; el.classList.add('level-up');
      }
      const r=data.rewards||{};
      const parts=[];
      if(r.coins)    parts.push(`+${r.coins.toLocaleString()} 🪙`);
      if(r.diamonds) parts.push(`+${r.diamonds.toLocaleString()} 💎`);
      const tail = parts.length ? ` (${parts.join(', ')})` : '';
      toast(`🌟 Level up! Lv ${data.oldLevel} → Lv ${data.newLevel}${tail}`,'s');
    });

    // P4-NEW.1b — ranked abandon penalty hit on me. Persist the lockout to
    // S.user so the lobby UI can dim the RANKED card or show a tooltip.
    sk.on('ranked:penalty',({elo,rankPoints,bannedUntil,offenseCount,reason})=>{
      if(typeof bannedUntil==='number' && S.user){
        S.user.rankedBanUntil = bannedUntil;
      }
      if(typeof offenseCount==='number' && S.user){
        S.user.rankedAbandonCount  = offenseCount;
        S.user.rankedLastAbandonAt = Date.now();
      }
      try{ localStorage.setItem('uno_user',JSON.stringify(S.user||{})); }catch(e){}
      const mins = Math.max(1, Math.ceil(((bannedUntil||0) - Date.now())/60000));
      const rpPart = (typeof rankPoints==='number' && rankPoints!==0) ? ` / ${rankPoints} RP` : '';
      toast(`⚠ Ranked penalty: ${elo} ELO${rpPart} + ${mins}min queue ban`,'e');
    });

    // Ranked rating update after a ranked match. Server applies the delta
    // server-side; this just keeps the client S.user in sync so the Ranked
    // Hub shows the fresh rankPoints / placement count immediately, and the
    // localStorage cache survives a refresh.
    sk.on('ranked:rating_update',({delta,newRank,peakRank,placement,isPlacement,placementGamesPlayed,rankedTier})=>{
      if(!S.user) return;
      if(typeof newRank==='number')              S.user.rankPoints           = newRank;
      if(typeof peakRank==='number')             S.user.peakRankPoints       = peakRank;
      if(typeof placementGamesPlayed==='number') S.user.placementGamesPlayed = placementGamesPlayed;
      if(rankedTier)                             S.user.rankedTier           = rankedTier;
      if(placement === 1) S.user.rankedWins  = (S.user.rankedWins  || 0) + 1;
      else                S.user.rankedLosses = (S.user.rankedLosses || 0) + 1;
      if(placement === 1) S.user.winStreak = (S.user.winStreak || 0) + 1;
      else                S.user.winStreak = 0;
      try{ localStorage.setItem('uno_user',JSON.stringify(S.user)); }catch(e){}
      // Re-render any open chip / hub so the new RP / placement counter is visible.
      try{ typeof refreshHeaderPill === 'function' && refreshHeaderPill(); }catch(e){}
    });

    // Ranked auto-start (bot fill). Just informational so the player knows
    // matchmaking gave up waiting for humans and seated bots instead.
    sk.on('ranked:auto_start',({botCount})=>{
      // Neutral message — never reveal that the room was filled with bots.
      if(botCount > 0){ toast('⚙️ Match starting…', 'i'); }
    });

    // Season rollover broadcast. Reload S.user from server so the player
    // sees their season rewards + the soft-reset rankPoints next render.
    sk.on('ranked:season_rollover',({newSeasonId})=>{
      toast(`🏆 Ranked Season ${newSeasonId} has begun! Placement reset.`, 's');
      // Force-refresh user from server next tick so the hub shows the new state.
      try{
        apiFetch('/api/auth/me').then(d => {
          if(d?.user){ S.user = d.user; try{ localStorage.setItem('uno_user', JSON.stringify(d.user)); }catch(e){} }
        }).catch(()=>{});
      }catch(e){}
    });

    sk.on('match:payout',({coins,gained,reason})=>{
      // Remember the REAL winnings so the ranked result screen can show them
      // (it may render a beat before/after this event lands).
      S._lastPayout = { gained: gained||0, reason: reason||'', at: Date.now() };
      try{ if(window.Ronda?._entered && typeof Ronda._onPayout==='function') Ronda._onPayout(gained||0); }catch(e){}
      if(typeof coins==='number'){
        S.user.coins=coins;
        try{ localStorage.setItem('uno_user',JSON.stringify(S.user)); }catch(e){}
        if(typeof _animateCount==='function'){
          _animateCount('hcoins',coins);
          _animateCount('scoins',coins);
          _animateCount('heroCoins',coins);
        }
      }
      // No toast — the win modal that's about to render shows the gain.
    });

    sk.on('game:card_played',(data)=>{
      if(!S.roomId)return; // Ignore stale events after leaving the game
      // P3.4 — kick off the fly-to-discard overlay FIRST so we capture
      // rects from the current DOM (sender's seat + current topcard) before
      // any re-render mutates them. The overlay lives at z-index 9000 so it
      // visibly covers the (already-updated) topcard until it lands.
      // RONDA-style: the discard card ITSELF flies in from the player who threw
      // it (single CSS animation — works on mobile too, no GSAP/overlay).
      if(data.topCard)renderTop(data.topCard, data.playerId);
      if(data.players){
        if(S.isSpectator) renderSpectatorOpps(data.players);
        else renderOpps(data.players);
        Clutch.check(data.players);
      }
      SFX.play('play');
      // SKIP cue — stamp the player who just got jumped, so it's obvious WHY the
      // turn skipped over them and who actually plays next.
      try{
        if(data.topCard && data.topCard.value==='skip' && typeof _flashSkip==='function'){
          const players = data.players || S.g.players || [];
          const dir = (S.g.direction||1) >= 0 ? 1 : -1;
          const pi = players.findIndex(p=>p.id===data.playerId);
          if(pi>=0 && players.length>1){
            const skipped = players[(pi + dir + players.length) % players.length];
            if(skipped && skipped.id!==data.playerId) _flashSkip(skipped.id);
          }
        }
      }catch(e){}
      if(data.players){const p=data.players.find(p=>p.id===data.playerId&&!isMe(p.id));if(p&&p.handSize===1&&!p.saidUno)showCatchButton(p.id);}
    });

    sk.on('game:auto_played',(data)=>{
      if(!S.roomId)return;
      if(data.players){
        if(S.isSpectator) renderSpectatorOpps(data.players);
        else renderOpps(data.players);
        Clutch.check(data.players);
      }
      const who=(data.players||[]).find(p=>p.id===data.playerId);
      const name=who?.username||'?';
      if(data.action==='played' && data.card){
        if(data.topCard)renderTop(data.topCard, data.playerId);   // RONDA-style land from the player
        SFX.play('play');
      } else if(data.action==='drew'){
        SFX.play('draw');
        Voice.sayDraw(1);
        // Auto-draw toast removed.
        if(data.playerId !== S.user?.id){
          const panel=document.querySelector(`.opanel[data-pid="${data.playerId}"]`);
          const deck=document.getElementById('drawpile');
          if(panel) AnimLayer.drawMany(1, deck, panel, {stagger:0,duration:1050,playerId:data.playerId});
        }
      } else if(data.action==='stack_taken'){
        SFX.play('draw');
        Voice.sayDraw(data.count||2);
        toast(`${name} took ${data.count} stack cards`,'i');
        const target = data.playerId === S.user?.id
          ? document.getElementById('myhand')
          : document.querySelector(`.opanel[data-pid="${data.playerId}"]`);
        const deck = document.getElementById('drawpile');
        if(target) AnimLayer.drawMany(data.count||2, deck, target, {stagger:200,duration:900,playerId:data.playerId});
      }
    });

    sk.on('turn:changed',(data)=>{
      if(!S.roomId)return;
      S.g.currentTurn=data.currentPlayerId;S.g.direction=data.direction;
      S.g.drawPileSize=data.drawPileSize;S.g.turnPhase=data.turnPhase||'must_play';
      S.g.drawnCardId=data.drawnCardId||null;S.g.stackDraw=data.stackDraw||0;
      if(data.topCard)renderTop(data.topCard);
      document.getElementById('dcnt').textContent=data.drawPileSize;
      document.getElementById('cancelArea').style.display='none';
      if(data.currentPlayerId===S.user?.id)SFX.play('turn');
      updateTurnUI();
    });

    sk.on('game:drew_card',({card,cards,canPlay,wasStack})=>{
      if(!S.roomId)return;
      SFX.play('draw');
      S._skipNextSync=true;
      setTimeout(()=>{S._skipNextSync=false;},2400);
      const _deck=document.getElementById('drawpile'), _hand=document.getElementById('myhand');
      const hasAnim = !!(_deck && _hand && typeof AnimLayer!=='undefined');
      // REVEAL the drawn card(s) in the hand — called only AFTER the fly lands,
      // so the card visibly travels from the deck FIRST, then appears in the
      // hand (no more instant pop-in while a card is still flying).
      const reveal = ()=>{
        if(wasStack && Array.isArray(cards) && cards.length){
          for(const c of cards){ if(!S.g.myHand.find(x=>x.id===c.id)) S.g.myHand.push(c); }
          S.g.drawnCardId=null;
        } else if(card){
          S.g.drawnCardId=card.id;
          if(!S.g.myHand.find(c=>c.id===card.id)){
            S.g.myHand.push(card);
            if(canPlay)S.g.myPlayable=[...new Set([...S.g.myPlayable,card.id])];
          }
        }
        S.g.turnPhase=canPlay?'drew_card':'waiting';
        renderHand();updateTurnUI();
        document.getElementById('cancelArea').style.display = canPlay?'block':'none';
      };
      if(hasAnim && wasStack && Array.isArray(cards) && cards.length){
        Voice.sayDraw(cards.length);
        AnimLayer.drawMany(cards.length, _deck, _hand, {stagger:190,duration:900,playerId:S.user?.id});
        setTimeout(reveal, 900 + (Math.min(cards.length,12)-1)*190 - 130);   // after the last lands
      } else if(hasAnim && card){
        Voice.sayDraw(1);
        AnimLayer.drawMany(1, _deck, _hand, {duration:1150,playerId:S.user?.id});
        setTimeout(reveal, 1000);                                            // as the fly settles
      } else {
        if(wasStack && Array.isArray(cards)) Voice.sayDraw(cards.length); else if(card) Voice.sayDraw(1);
        reveal();                                                            // no anim → reveal now
      }
    });

    sk.on('game:player_drew',({playerId,count})=>{
      if(!S.roomId)return;
      const p=S.g.players.find(p=>p.id===playerId);
      Voice.sayDraw(count||1);
      if(p&&!isMe(p.id)){
        const panel=document.querySelector(`.opanel[data-pid="${playerId}"]`);
        const deck=document.getElementById('drawpile');
        if(panel){
          AnimLayer.drawMany(count||1, deck, panel, {stagger:190,duration:880,playerId});
          if((count||1) > 1){
            const fx=document.createElement('div');
            fx.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:24px;font-weight:900;color:#FFD700;text-shadow:0 2px 8px rgba(0,0,0,.6);pointer-events:none;animation:popIn .4s ease forwards;z-index:20;';
            fx.textContent=`+${count}`;
            panel.appendChild(fx);
            setTimeout(()=>fx.remove(),1800);
          }
        }
      }
    });
    sk.on('game:color_chosen',({playerId,color})=>{document.getElementById('cmodal').classList.remove('show');const p=S.g.players.find(p=>p.id===playerId);toast(`${p?.username||'?'} chose ${color.toUpperCase()}!`,'i');const tc=document.getElementById('topcard');if(tc)tc.className=`ucard nohov ${color}`;});
    sk.on('game:direction_changed',({direction})=>{S.g.direction=direction;document.getElementById('hdir').textContent=direction===1?'↻ Clockwise':'↺ Counter-CW';});
    sk.on('game:uno_caught',({targetId,penaltyCards})=>{const p=S.g.players.find(p=>p.id===targetId);toast(`😱 ${p?.username||'?'} caught! +${penaltyCards} cards`,'e');removeCatch();});
    sk.on('game:player_won',(data)=>{showWin(data);SFX.play(data.winnerId===S.user?.id?'win':'error');});
    // game:over arrives AFTER game:player_won and carries the ranked
    // deltas (rankedChanges + rankedTier). Wires the cinematic + rewards
    // refresh — without this the new RP progress bar, flying RP delta,
    // and promotion banner all silently no-op because the showWin payload
    // had no rankedChanges yet.
    sk.on('game:over',(data)=>{
      if(typeof window._showRankedDramaFromGameOver === 'function'){
        window._showRankedDramaFromGameOver(data);
      }
    });

    sk.on('matchmaking:matched',({roomId,players})=>{
      S.roomId=roomId;
      // Cinematic "match found" flash on the radar core, then enter the room
      const g=window.gsap, ov=document.getElementById('mmov');
      const finish=()=>{
        ov.classList.remove('show');
        if(g) g.set(ov,{clearProps:'opacity'});
        _resetLobbyCamera();
        toast('Match found!','s'); SFX.play('uno');
        // Only land on the waiting room if the game hasn't ALREADY started — a
        // fast (bot-filled) rematch can push game:state DURING this match-found
        // animation, and showing room-screen here would override the live game
        // → "stuck on Game Room until refresh". Skip if we're already in-game.
        if(document.getElementById('game-screen')?.classList.contains('active') || S.g?.phase==='playing'){
          return;
        }
        showScreen('room-screen');
        if(players)renderWaiting(players);
        document.getElementById('ridlbl').textContent=`Room: ${roomId.substr(0,8).toUpperCase()}`;
        armRoomReSync(roomId);   // auto-recover if the game-start push is missed
      };
      if(g && ov.classList.contains('show') && !_mmReduced()){
        const core=ov.querySelector('.mm-core');
        if(core) g.fromTo(core,{scale:1},{scale:1.5,duration:.32,ease:'back.out(2)',yoyo:true,repeat:1});
        g.to(ov,{opacity:0,duration:.4,delay:.5,ease:'power2.in',onComplete:finish});
      } else { finish(); }
    });
  }

