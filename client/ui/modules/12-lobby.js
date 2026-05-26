  /* ═══ LOBBY ═══ */
  function goLobby(){
    // Reset spectator + clutch + league-game state when returning to lobby
    document.body.classList.remove('spectating','clutch','in-league-game');
    EVENT.exitRoomAmbiance();   // drop event-room vignette/particles
    document.getElementById('roundIntermission')?.classList.remove('show');
    S.isSpectator = false;
    S.g.spectatorHands = {};
    S.g.voteTally = {};
    S.g.myVote = null;
    Clutch.reset();
    const wt=document.getElementById('tabSpec'); if(wt) wt.style.display='none';
    const sm=document.getElementById('specMsgs'); if(sm) sm.innerHTML='';
    if(Chat.activeTab==='spec') switchChatTab('chat');
    showScreen('lobby-screen');
    buildLobby3D(); initLobbyFx();
    if(S.user){
      document.getElementById('huser').textContent=S.user.username;
      _animateCount('hcoins',S.user.coins||0);
      _animateCount('scoins',S.user.coins||0);
    }
    renderLobbyHero();
    playLobbyIntro();
    requestAnimationFrame(_initLnav);   // align the floating-dock pill with the active tab
    loadRooms();loadRailFriends();
    EVENT.load();   // refresh the seasonal event overlay (banner, props, intro)
    if(typeof RoomScene!=='undefined'){ RoomScene.boot(); RoomScene.start(); }   // hover-focused mini-scene
    // Atmospheric WebGL backdrop — boots after the lobby intro completes so
    // it doesn't compete with the GSAP entrance animation. Self-guarded
    // against the user navigating away within the delay window.
    setTimeout(()=>{
      if(!document.getElementById('lobby-screen')?.classList.contains('active')) return;
      if(typeof LobbyScene!=='undefined'){ LobbyScene.boot(); LobbyScene.start(); }
      if(typeof Parallax!=='undefined'){ Parallax.boot(); Parallax.start(); }      // layered depth response
    }, 1300);
    clearInterval(S.roomsTimer);S.roomsTimer=setInterval(loadRooms,5000);
    clearInterval(S.railTimer);S.railTimer=setInterval(loadRailFriends,20000);
  }
  function renderLobbyHero(){
    const u=S.user; if(!u) return;
    _renderAvatarInto(document.getElementById('heroAvatar'), u);
    const nm=document.getElementById('heroName'); if(nm) nm.textContent=u.username||'Player';
    const lg=u.league||{};
    const lgEl=document.getElementById('heroLeague'); if(lgEl) lgEl.textContent=`${lg.badge||'🎖️'} ${lg.name||'Bronze'}`;
    const gp=u.stats?.gamesPlayed||0, gw=u.stats?.gamesWon||0;
    _animateCount('heroCoins',u.coins||0);
    _animateCount('heroElo',u.elo??1000);
    _animateCount('heroWins',gw);
    const wrEl=document.getElementById('heroWinRate'); if(wrEl) wrEl.textContent=(gp?Math.round(gw/gp*100):0)+'%';
  }
  // Quick-join into a featured type. `type` is one of 'CLASSIC' / 'FUN' /
  // 'RANKED' / 'CHILL' / 'QUICK_MATCH'.
  //
  // Two-stage flow:
  //   1) HTTP POST seats the player server-side (works regardless of socket
  //      state). This is the authoritative "you're in the room" moment.
  //   2) Socket emit room:join wires the live socket to that room so the
  //      server can push game state. If the socket is mid-reconnect when
  //      stage 1 completes, we briefly wait for it before emitting.
  // Decoupling stages is critical on flaky transports (ngrok-free, mobile
  // networks): a transient socket drop should never block the POST.
  async function quickJoin(type){
    if(!type) return;
    console.log('[quickJoin]', type);
    try{
      // Stage 1: seat the player server-side.
      const res = await apiFetch('/api/rooms/quick-join', {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      if(!res?.roomId){
        return toast('Could not join — try again','e');
      }
      console.log('[quickJoin] seated in', res.roomId, '(roomType:', res.roomType + (res.created?', spawned':', existing')+')');

      // Stage 2: hand off to the socket flow. If socket is reconnecting,
      // wait up to ~3s for it to come back before failing.
      await _waitForSocket(3000);
      if(!S.socket?.connected){
        return toast('Socket reconnecting — try again in a moment','e');
      }
      _doJoinNow(res.roomId);
    }catch(e){
      console.error('[quickJoin] failed:', e);
      if(e?.status === 401) return;                        // auth-expiry handler already bounced to login
      const msg = e?.status === 402
        ? `Not enough coins (need ${e.payload?.need || ''} 🪙)`
        : e?.networkError
          ? 'Network error — try again'
          : (e?.message || 'Could not join');
      toast(msg, 'e');
    }
  }

  // Resolves when S.socket reports connected, or after `timeoutMs` regardless.
  // Cheap poll (every 80ms) — never throws.
  function _waitForSocket(timeoutMs){
    return new Promise(resolve=>{
      if(S.socket?.connected) return resolve(true);
      const start = Date.now();
      const tick = ()=>{
        if(S.socket?.connected) return resolve(true);
        if(Date.now() - start >= timeoutMs) return resolve(false);
        setTimeout(tick, 80);
      };
      tick();
    });
  }

  // ── Left-rail helpers (P2.3) ─────────────────────────────────────────
  // PLAY — focuses the 4-card lobby grid. No-op if already there.
  function doPlay(){
    const grid = document.getElementById('rgrid');
    if(grid) grid.scrollIntoView({ behavior:'smooth', block:'start' });
    try{ SFX.play('click'); }catch(e){}
  }

  // QUICK MATCH — cinematic radar transition (~800ms minimum showtime)
  // wraps the HTTP quick-join + socket handoff. The player FEELS the
  // game finding them a match, not a teleport. Reuses the existing
  // matchmaking overlay (the radar UI) which was previously bound to
  // the queue-based system.
  async function doQuickMatch(){
    console.log('[doQuickMatch] starting cinematic');
    try{ SFX.play('click'); }catch(e){}
    // Open the cinematic radar overlay first.
    if(typeof _openMatchmaking==='function') _openMatchmaking();
    const minShowtime = 800;
    const t0 = Date.now();
    try{
      const res = await apiFetch('/api/rooms/quick-join', {
        method: 'POST',
        body: JSON.stringify({ type:'QUICK_MATCH' }),
      });
      if(!res?.roomId){
        if(typeof _closeMatchmaking==='function') _closeMatchmaking();
        return toast('Could not find a match — try again','e');
      }
      console.log('[doQuickMatch] seated in', res.roomId, 'roomType:', res.roomType);
      // Hold the cinematic for at least minShowtime so it doesn't feel like a teleport.
      const elapsed = Date.now() - t0;
      if(elapsed < minShowtime) await new Promise(r=>setTimeout(r, minShowtime-elapsed));
      await _waitForSocket(3000);
      if(typeof _closeMatchmaking==='function') _closeMatchmaking();
      if(!S.socket?.connected) return toast('Socket reconnecting — try again','e');
      _doJoinNow(res.roomId);
    }catch(e){
      if(typeof _closeMatchmaking==='function') _closeMatchmaking();
      console.error('[doQuickMatch] failed:', e);
      if(e?.status===401) return;
      const msg = e?.status===402 ? `Not enough coins (need ${e.payload?.need||''} 🪙)`
                : e?.networkError ? 'Network error — try again'
                : (e?.message || 'Could not find a match');
      toast(msg, 'e');
    }
  }

  // PRACTICE — opens the Game Center directly to the Training view so
  // new players can learn vs bots without risking coins. The training
  // panel + bot-difficulty picker are inside showGameCenter; we just
  // jump straight to that nested view instead of the hub.
  function doPractice(){
    try{ SFX.play('click'); }catch(e){}
    if(typeof showGameCenter==='function') showGameCenter();
    // _gcNav('training') is defined inside 13-battlepass.js — defer a tick so
    // showGameCenter has time to mount the DOM before we navigate inside it.
    setTimeout(()=>{ if(typeof _gcNav==='function') _gcNav('training'); }, 30);
  }

  // SHOP — placeholder until P4 economy lands the real shop modal.
  // Surfacing as comingSoon honestly rather than misleading into the
  // existing coins-budget modal.
  function doShop(){
    if(typeof comingSoon==='function'){
      comingSoon('Shop','Buy coins, card backs & cosmetics — launching with the economy update.');
    } else {
      toast('Shop coming soon','i');
    }
  }

  // SCHEDULE (Competitions group) — same pattern as Practice, jumps directly
  // into the Game Center's schedule view.
  function doScheduleFromGC(){
    if(typeof showGameCenter==='function') showGameCenter();
    setTimeout(()=>{ if(typeof _gcNav==='function') _gcNav('schedule'); }, 30);
  }

  async function loadRooms(){
    try{
      // Two parallel fetches: /featured for the 4 cards, /rooms for the
      // live-games section (spectatable matches in progress). Either can
      // fail independently without breaking the other.
      const [featured, base] = await Promise.all([
        api('GET','/rooms/featured').catch(e=>{ console.warn('[loadRooms] /featured failed:', e); return null; }),
        api('GET','/rooms').catch(e=>{ console.warn('[loadRooms] /rooms failed:', e); return null; }),
      ]);

      // Clean up any legacy hero-stage div left by an older render path.
      document.getElementById('heroStage')?.remove();

      const g = document.getElementById('rgrid');
      if(!featured){
        document.getElementById('rinfo').textContent = 'Could not load rooms';
        return;
      }

      // Online count + summary line.
      const onlineCount = featured.onlineCount || 0;
      document.getElementById('rinfo').innerHTML =
        `${featured.rooms.length} rooms `+
        `<span class="online-pill"><span class="online-dot"></span>${onlineCount} online</span>`;

      // Render the 4 cards. Signature-cached: only re-render the grid when
      // the meaningful payload (hot type + per-card instance + occupancy)
      // actually changed, so the RoomScene canvas inside the HOT card
      // doesn't get reattached every 5s for nothing.
      const signature = [
        featured.hotType || '_',
        ...featured.rooms.map(c => `${c.type}:${c.instanceId||'_'}:${c.players}`),
      ].join('|');

      if(g.dataset.featuredSignature !== signature){
        g.className = 'rgrid rgrid--featured';
        g.innerHTML = featured.rooms.map(card =>
          _featuredCardHTML(card, card.type === featured.hotType)
        ).join('');
        g.dataset.featuredSignature = signature;
        // Re-anchor RoomScene to the (possibly new) HOT card so the
        // pulse-coupling + rim-light + halo + breath system carries over
        // from the old hero-stage approach. When no HOT exists (every
        // casual pool empty), default-focus on the CLASSIC card so the
        // canvas stays alive rather than orphaned.
        if(typeof RoomScene !== 'undefined' && RoomScene.setHero){
          const focusType = featured.hotType || 'CLASSIC';
          const focusEl = g.querySelector(`[data-room-type="${focusType}"]`);
          if(focusEl) requestAnimationFrame(()=> RoomScene.setHero(focusEl));
        }
        EVENT.decorateRooms();
      }

      // Live games section — preserved for spectating. Hidden when empty.
      const live = base?.liveGames || [];
      const liveSec = document.getElementById('liveSection');
      const liveGrid = document.getElementById('livegrid');
      const liveInfo = document.getElementById('liveinfo');
      if(liveSec && liveGrid){
        if(live.length){
          liveSec.style.display = '';
          liveInfo.textContent = `${live.length} live game${live.length===1?'':'s'} — watch in progress`;
          liveGrid.innerHTML = live.map(r => _roomTableHTML(r, true, null)).join('');
        } else {
          liveSec.style.display = 'none';
        }
      }
    }catch(e){
      console.error('[loadRooms]', e);
      document.getElementById('rinfo').textContent='Could not load rooms';
    }
  }
  // ── Bottom navigation — premium floating dock ──
  // Slide the glowing pill behind the active tab (measured, so it works
  // with both content-width desktop tabs and equal-flex mobile tabs).
  function _moveLnavPill(el){
    const pill=document.getElementById('lnavPill');
    if(!pill||!el||!el.offsetWidth) return;
    pill.style.width=el.offsetWidth+'px';
    pill.style.transform='translateX('+el.offsetLeft+'px)';
  }
  function _initLnav(){
    const pill=document.getElementById('lnavPill');
    const on=document.querySelector('.lnav-tab.on')||document.querySelector('.lnav-tab');
    if(!pill||!on) return;
    pill.style.transition='none';          // no slide on first paint / resize
    _moveLnavPill(on);
    void pill.offsetWidth;
    pill.style.transition='';
  }
  // Modal-backed tabs: the pill follows the tab while its overlay is open,
  // then glides back to Home once it closes — the pill must always show
  // "where the player IS". (A real full page would keep its tab active.)
  const _NAV_MODAL={
    missions:    ()=> !!document.getElementById('navModal'),
    collection:  ()=> !!document.getElementById('navModal'),
    leaderboard: ()=> !!document.getElementById('lbOv')?.classList.contains('show'),
    profile:     ()=> !!document.getElementById('profileOv')?.classList.contains('show'),
  };
  let _navWatch=null;
  function _snapNavHome(){
    const home=document.querySelector('.lnav-tab[data-tab="home"]');
    if(!home||home.classList.contains('on')) return;
    document.querySelectorAll('.lnav-tab').forEach(t=>t.classList.remove('on'));
    home.classList.add('on');
    _moveLnavPill(home);                 // CSS transition handles the glide
  }
  function _watchNavModalTab(tab){
    const isOpen=_NAV_MODAL[tab];
    if(!isOpen) return;
    if(_navWatch){ clearInterval(_navWatch); _navWatch=null; }
    let opened=isOpen(), tries=0;        // sync modals are already open here
    _navWatch=setInterval(()=>{
      if(!opened){                       // wait for an async modal to appear
        if(isOpen()) opened=true;
        else if(++tries>25){ clearInterval(_navWatch); _navWatch=null; _snapNavHome(); }
        return;
      }
      if(!isOpen()){ clearInterval(_navWatch); _navWatch=null; _snapNavHome(); }
    },120);
  }
  function navTab(tab, el){
    if(_navWatch){ clearInterval(_navWatch); _navWatch=null; }   // cancel any pending snap-back
    document.querySelectorAll('.lnav-tab').forEach(t=>t.classList.remove('on'));
    if(el){
      el.classList.add('on');
      _moveLnavPill(el);
      const ic=el.querySelector('.lnav-ic');
      if(ic){ ic.classList.remove('pop'); void ic.offsetWidth; ic.classList.add('pop'); }
    }
    try{ SFX.play('click'); }catch(e){}
    if(tab==='home'){
      document.querySelector('.lmain')?.scrollTo({top:0,behavior:'smooth'});
    }
    else if(tab==='missions'){ showMissions();    _watchNavModalTab('missions'); }
    else if(tab==='collection'){ showCollection(); _watchNavModalTab('collection'); }
    else if(tab==='leaderboard'){ showLeaderboard(); _watchNavModalTab('leaderboard'); }
    else if(tab==='profile'){ showProfile();      _watchNavModalTab('profile'); }
  }
  function _navModal(title, icon, bodyHTML, footHTML){
    const old=document.getElementById('navModal'); if(old) old.remove();
    const ov=document.createElement('div');
    ov.id='navModal';
    ov.style.cssText='position:fixed;inset:0;z-index:1000;background:rgba(4,6,14,.84);'+
      'backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);'+
      'display:flex;align-items:center;justify-content:center;padding:20px;animation:screenIn .25s ease';
    ov.innerHTML=`<div class="nm-panel">
      <div class="nm-head">
        <div class="nm-title">${icon} ${esc(title)}</div>
        <button class="nm-close" onclick="document.getElementById('navModal').remove()" aria-label="Close">×</button>
      </div>
      <div class="nm-body">${bodyHTML}${footHTML||''}</div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) ov.remove(); });
  }
  function showMissions(){
    const u=S.user||{};
    const gp=u.stats?.gamesPlayed||0, gw=u.stats?.gamesWon||0, coins=u.coins||0, elo=u.elo||1000;
    const M=[
      {ic:'🎮',n:'Warm Up',     d:'Play 5 games',         cur:gp,   tgt:5,    rw:200},
      {ic:'🏆',n:'First Blood', d:'Win 3 games',          cur:gw,   tgt:3,    rw:300},
      {ic:'⚔️',n:'Competitor',  d:'Play 25 games',        cur:gp,   tgt:25,   rw:600},
      {ic:'🔥',n:'Hot Streak',  d:'Win 15 games',         cur:gw,   tgt:15,   rw:1000},
      {ic:'🪙',n:'Treasurer',   d:'Hold 5,000 coins',     cur:coins,tgt:5000, rw:500},
      {ic:'⚡',n:'Rising Star', d:'Reach 1,200 rating',   cur:elo,  tgt:1200, rw:800},
    ];
    const done=M.filter(m=>m.cur>=m.tgt).length;
    const body=`<div class="nm-grid">${M.map((m,i)=>{
      const ok=m.cur>=m.tgt, pct=Math.min(100,Math.round(m.cur/m.tgt*100));
      return `<div class="nm-mission ${ok?'done':''}" style="animation-delay:${i*55}ms">
        <div class="nm-mission-ic">${ok?'✅':m.ic}</div>
        <div class="nm-mission-main">
          <div class="nm-mission-name">${m.n}</div>
          <div class="nm-mission-desc">${m.d} · ${Math.min(m.cur,m.tgt).toLocaleString()}/${m.tgt.toLocaleString()}</div>
          <div class="nm-bar"><div class="nm-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="nm-mission-rw">${ok?'✓ DONE':'🪙 '+m.rw}</div>
      </div>`;
    }).join('')}</div>`;
    const foot=`<div style="text-align:center;font-size:12px;color:rgba(255,255,255,.5);font-weight:700;margin-top:14px">${done}/${M.length} missions complete — keep playing!</div>`;
    _navModal('Missions','🎯',body,foot);
  }
  function showCollection(){
    const cur=S.user?.avatar;
    const owned=(typeof AVATARS!=='undefined')?AVATARS:[];
    const body=`<div class="nm-coll">${owned.map((a,i)=>`
      <div class="nm-coll-item ${a.e===cur?'on':''}" style="animation-delay:${i*22}ms">
        <div class="nm-coll-face">${a.e}</div>
        <div class="nm-coll-name">${esc(a.n)}</div>
      </div>`).join('')}</div>`;
    const foot=`<div style="text-align:center;font-size:11px;color:rgba(255,255,255,.45);font-weight:600;margin-top:14px">${owned.length} characters unlocked · open Profile to equip one</div>`;
    _navModal('Collection','🃏',body,foot);
  }

