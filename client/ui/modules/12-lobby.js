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
  async function loadRooms(){
    try{
      const d=await api('GET','/rooms'),g=document.getElementById('rgrid');
      {
        const on=d.onlineCount||0;
        document.getElementById('rinfo').innerHTML=
          `${d.rooms.length} room${d.rooms.length===1?'':'s'} available `+
          `<span class="online-pill"><span class="online-dot"></span>${on} online</span>`;
      }
      // Render live games (spectatable)
      const live = d.liveGames || [];
      const liveSec = document.getElementById('liveSection');
      const liveGrid = document.getElementById('livegrid');
      const liveInfo = document.getElementById('liveinfo');
      if(liveSec && liveGrid){
        if(live.length){
          liveSec.style.display='';
          liveInfo.textContent = `${live.length} live game${live.length===1?'':'s'} — watch in progress`;
          liveGrid.innerHTML = live.map(r => _roomTableHTML(r, true, null)).join('');
        } else {
          liveSec.style.display='none';
        }
      }
      if(!d.rooms.length){g.innerHTML=`<div class="rooms-empty">
        <div class="rooms-empty-cards">
          <div class="ec red"><span>1</span></div>
          <div class="ec yellow"><span>+2</span></div>
          <div class="ec blue"><span>↺</span></div>
        </div>
        <div class="rooms-empty-title">No rooms yet</div>
        <div class="rooms-empty-sub">Create your own room or jump into a quick match — let's play! 🎮</div>
        <div class="rooms-empty-actions">
          <button class="ec-btn create" onclick="doCreate()">➕ Create Room</button>
          <button class="ec-btn match" onclick="doMM()">🎯 Quick Match</button>
        </div>
      </div>`;return;}
      const featId=EVENT.pickFeatured(d.rooms);
      g.innerHTML=d.rooms.map(r=>_roomTableHTML(r,false,featId)).join('');
      EVENT.decorateRooms();
    }catch(e){document.getElementById('rinfo').textContent='Could not load rooms';}
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

