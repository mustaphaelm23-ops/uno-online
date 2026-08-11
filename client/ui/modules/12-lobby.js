  /* ═══ LOBBY ═══ */
  function goLobby(){
    // Tear down any active RONDA/Dama game module so the NEXT game enters
    // cleanly. A stale _entered / body.ronda-active / #ronda-root used to leave
    // the next match stuck on the empty "Game Room" header until a manual
    // refresh — clearing them here fixes "joined a new game, nothing loads".
    try{ if(typeof Ronda !== 'undefined' && Ronda.exit) Ronda.exit(); }catch(_){}
    try{ if(typeof Dama  !== 'undefined' && Dama.exit)  Dama.exit();  }catch(_){}
    try{ if(typeof Chess !== 'undefined' && Chess.exit) Chess.exit(); }catch(_){}
    document.body.classList.remove('ronda-active','dama-active','chess-active');
    document.getElementById('ronda-root')?.remove();
    document.getElementById('dama-root')?.remove();
    document.getElementById('chess-root')?.remove();
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
      _renderAvatarInto(document.getElementById('huserAvatar'), S.user);
      // Profile banner as the chip nameplate frame (matches the profile header).
      const _pill = document.getElementById('huserPill');
      if(_pill){
        const _bids = ['royal-gold','sapphire','royal-crimson','amethyst','inferno'];
        const _bn = _bids.includes(S.user.profileBanner) ? S.user.profileBanner : 'royal-gold';
        _pill.classList.add('has-banner');
        _pill.classList.remove('banner-light');
        _pill.style.setProperty('--profile-banner', `url('/banners/${_bn}.png')`);
      }
      const lvl = S.user.accountLevel || 1;
      // Level now shows on the chip's bottom line (★ Lv N) — hide the small
      // duplicate badge on the avatar so the level isn't shown twice.
      const lvlPill=document.getElementById('huserLvl');
      if(lvlPill) lvlPill.style.display = 'none';
      // Bottom line of the profile chip → account level.
      const trophiesEl = document.getElementById('huserTrophies');
      if(trophiesEl){
        trophiesEl.textContent = 'Lv ' + lvl;
      }
      // Rank emblem on the right of the chip — the player's tier badge, visible
      // straight from the lobby. Hidden while still in placement.
      const rankEl = document.getElementById('huserRank');
      const chevEl = document.querySelector('#huserPill .huPill-chev');
      if(rankEl){
        const tier = S.user.rankedTier;
        const placement = (S.user.placementGamesPlayed || 0) < 5;
        if(tier && tier.name && !placement){
          const _rk = { bronze:'bronze', silver:'silver', gold:'gold', platinum:'platinum',
            diamond:'diamond', master:'master', legend:'grandmaster', grandmaster:'grandmaster' };
          const key = _rk[String(tier.name).toLowerCase()] || 'bronze';
          rankEl.src = `/ranks/${key}.png`;
          rankEl.title = tier.name;
          rankEl.style.display = '';
          if(chevEl) chevEl.style.display = 'none';   // emblem takes the arrow's spot
        } else {
          rankEl.style.display = 'none';
          if(chevEl) chevEl.style.display = '';        // no rank yet → keep the arrow
        }
      }
      // VIP badge — only shown when the account has a VIP tier set.
      const vipEl = document.getElementById('huserVip');
      if(vipEl){
        const vipLevel = S.user.vipLevel || S.user.vip || 0;
        if(vipLevel > 0){
          vipEl.textContent = `VIP ${vipLevel}`;
          vipEl.style.display = '';
        } else {
          vipEl.style.display = 'none';
        }
      }
      _animateCount('hcoins',S.user.coins||0);
      _animateCount('scoins',S.user.coins||0);
      _animateCount('hdiamonds',S.user.diamonds||0);          // P4-D.3 — premium currency display
    }
    renderLobbyHero();
    playLobbyIntro();
    requestAnimationFrame(_initLnav);   // align the floating-dock pill with the active tab
    loadRooms();loadRailFriends();loadRailPublicRooms();
    // (Auto-opening the Missions panel on lobby entry was removed 2026-07-22
    //  per user request — it's now reached only from the header 🎯 button.)
    EVENT.load();   // refresh the seasonal event overlay (banner, props, intro)
    // Mobile detection — skips heavy GPU work and stretches polling intervals
    // 3-4× so the game stops choking battery and thermals. Triggered by the
    // same coarse-pointer rule the MobileRotate overlay uses for consistency.
    const isMobile = matchMedia('(pointer:coarse)').matches &&
                     (innerWidth < 1024 || innerHeight < 1024);
    if(isMobile){ document.body.classList.add('mobile-lite'); }
    // Polling cadence — slow it WAY down on mobile so the radio stays asleep
    // longer between refreshes. Desktop keeps the snappy original timing.
    const roomsMs = isMobile ? 20000 : 5000;
    const railMs  = isMobile ? 60000 : 20000;
    const pubMs   = isMobile ? 15000 : 5000;
    clearInterval(S.roomsTimer);S.roomsTimer=setInterval(loadRooms,roomsMs);
    clearInterval(S.railTimer);S.railTimer=setInterval(loadRailFriends,railMs);
    clearInterval(S.railPubRoomsTimer);S.railPubRoomsTimer=setInterval(loadRailPublicRooms,pubMs);
  }
  function renderLobbyHero(){
    const u=S.user; if(!u) return;
    _renderAvatarInto(document.getElementById('heroAvatar'), u);
    const nm=document.getElementById('heroName'); if(nm) nm.textContent=u.username||'Player';
    const lg=u.league||{};
    // GDD §7.1 — prefer the full label "Silver II" when the server supplies it;
    // fall back to bare tier name for older payloads.
    const lgEl=document.getElementById('heroLeague'); if(lgEl) lgEl.textContent=`${lg.badge||'🎖️'} ${lg.label||lg.name||'Bronze'}`;
    // GDD §7.2 — account level pill next to username + title progress %.
    const lvlEl=document.getElementById('heroLevel');
    if(lvlEl){
      const level=u.accountLevel||1;
      const prog=u.accountLevelProgress||{pct:0,into:0,span:1000};
      lvlEl.textContent=`Lv ${level}`;
      lvlEl.title=`Level ${level} — ${prog.into||0}/${prog.span||1000} XP (${prog.pct||0}%)`;
    }
    const gp=u.stats?.gamesPlayed||0, gw=u.stats?.gamesWon||0;
    _animateCount('heroCoins',u.coins||0);
    _animateCount('heroElo',u.elo??1000);
    _animateCount('heroWins',gw);
    const wrEl=document.getElementById('heroWinRate'); if(wrEl) wrEl.textContent=(gp?Math.round(gw/gp*100):0)+'%';
  }

  // Quick-join into a featured type. `type` is one of 'CLASSIC' /
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
  async function quickJoin(type, preseat, mode, bet){
    if(!type) return;
    // RANKED is the full RONDA game with rank points (server makes a ranked
    // RONDA room). UNO / DAMA / CHESS / RONDA all use this same flow.
    console.log('[quickJoin]', type);
    try{
      // Stage 1: seat the player server-side.
      const body = { type };
      if(Number(preseat) > 0) body.preseat = Math.min(3, Math.floor(Number(preseat)));
      if(mode) body.mode = String(mode).slice(0, 8);          // 1v1 / 2v2 / ffa (Cardora only)
      if(Number(bet) > 0) body.bet = Math.floor(Number(bet));  // ambient high-stakes tables carry their stake
      const res = await apiFetch('/api/rooms/quick-join', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if(!res?.roomId){
        return toast('Could not join — try again','e');
      }
      // Track the room type so the match-intro cinematic and in-game
      // opponent panels can switch to their RANKED theme without a
      // round-trip back to the server.
      S.currentRoomType    = res.roomType || null;
      S.currentRoomMaxPl   = res.maxPlayers || 4;
      S.currentRoomCreated = res.roomCreatedAt || Date.now();
      S.currentRoomBotMs   = res.botFillMs || null;
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
      let msg;
      if(e?.status === 402){
        msg = `Not enough coins (need ${e.payload?.need || ''} 🪙)`;
      } else if(e?.status === 403 && e?.payload?.bannedUntil){
        // P4-NEW.1b — ranked queue ban after abandon. Show minutes remaining.
        const mins = Math.max(1, Math.ceil((e.payload.remainingMs || 0) / 60000));
        msg = `Ranked locked — try again in ${mins}m (abandon penalty)`;
      } else if(e?.networkError){
        msg = 'Network error — try again';
      } else {
        msg = e?.message || 'Could not join';
      }
      toast(msg, 'e');
    }
  }

  // ═══ GAME PICKER — tapping a game tile opens a premium sheet where the player
  //     picks the game-specific option (CARDORA → play mode, CHESS → time
  //     control) AND the stake. Stakes mirror the server's whitelisted bet set;
  //     the chosen stake rides quickJoin's `bet`, the mode rides `mode`, and the
  //     chess time control is applied via chess:set_time_control after join
  //     (while the room is still in lobby). Unaffordable tiers lock. ═══
  let _pickerState = { type:'CLASSIC', mode:'1v1', tc:'RAPID_10' };
  const _STAKE_TIERS = [
    { amt:100,    label:'Rookie',      r:'bronze'    },
    { amt:500,    label:'Casual',      r:'bronze'    },
    { amt:1000,   label:'Amateur',     r:'silver'    },
    { amt:5000,   label:'Pro',         r:'silver'    },
    { amt:10000,  label:'Elite',       r:'gold'      },
    { amt:25000,  label:'Master',      r:'gold'      },
    { amt:50000,  label:'High Roller', r:'amethyst'  },
    { amt:100000, label:'VIP',         r:'legendary' },
  ];
  const _STAKE_GAMES = {
    CLASSIC:{ name:'CARDORA', icon:'🎴' },
    RONDA:  { name:'RONDA',   icon:'🃏' },
    CHESS:  { name:'CHESS',   icon:'♟️' },
    DAMA:   { name:'DAMA',    icon:'⛀' },
  };
  const _CARDORA_MODES = [
    { v:'1v1', t:'1 vs 1',    s:'Duel'         },
    { v:'2v2', t:'2 vs 2',    s:'Team'         },
    { v:'ffa', t:'4 Players', s:'Every one solo' },
  ];
  const _CHESS_TIMES = [
    { v:'BULLET_1',     t:'Bullet',    s:'1+0'   },
    { v:'BLITZ_3_2',    t:'Blitz',     s:'3+2'   },
    { v:'BLITZ_5',      t:'Blitz',     s:'5+0'   },
    { v:'RAPID_10',     t:'Rapid',     s:'10+0'  },
    { v:'RAPID_15_10',  t:'Rapid',     s:'15+10' },
    { v:'CLASSICAL_30', t:'Classical', s:'30+0'  },
    { v:'UNLIMITED',    t:'No clock',  s:'∞'     },
  ];
  function _optChipsHTML(kind, list, selVal){
    return `<div class="stake-chips">` + list.map(o =>
      `<button class="stake-chip${o.v===selVal?' sel':''}" data-opt="${kind}" data-val="${o.v}" onclick="setStakeOpt('${kind}','${o.v}')">
        <span class="stake-chip-t">${o.t}</span><span class="stake-chip-s">${o.s}</span>
      </button>`).join('') + `</div>`;
  }
  function openStakePicker(type){
    type = type || 'CLASSIC';
    const g   = _STAKE_GAMES[type] || { name:String(type), icon:'🎮' };
    const bal = (S.user && S.user.coins) || 0;
    _pickerState = { type, mode:'1v1', tc:'RAPID_10' };
    let optsHTML = '';
    if(type === 'CLASSIC'){
      optsHTML = `<div class="stake-opts"><div class="stake-opts-lbl">Players</div>${_optChipsHTML('mode', _CARDORA_MODES, '1v1')}</div>`;
    } else if(type === 'CHESS'){
      optsHTML = `<div class="stake-opts"><div class="stake-opts-lbl">Time control</div>${_optChipsHTML('tc', _CHESS_TIMES, 'RAPID_10')}</div>`;
    }
    document.getElementById('stakeOv')?.remove();
    const ov = document.createElement('div');
    ov.id = 'stakeOv'; ov.className = 'stake-ov';
    ov.innerHTML =
      `<div class="stake-modal" role="dialog" aria-label="Choose game settings">
        <button class="stake-close" onclick="closeStakePicker()" aria-label="Close">×</button>
        <div class="stake-head">
          <div class="stake-game-ic">${g.icon}</div>
          <div class="stake-head-txt">
            <div class="stake-eyebrow">${esc(g.name)}</div>
            <div class="stake-title">${type==='CHESS' ? 'PICK TIME &amp; STAKE' : type==='CLASSIC' ? 'PICK MODE &amp; STAKE' : 'CHOOSE YOUR STAKE'}</div>
          </div>
        </div>
        ${optsHTML}
        <div class="stake-sub">${type==='CHESS' ? 'How much time — and how much to play for?' : type==='CLASSIC' ? 'How many players — and how much to play for?' : 'How much do you want to play for?'}</div>
        <div class="stake-bal">Your balance <b>🪙 ${bal.toLocaleString()}</b></div>
        <div class="stake-grid">
          ${_STAKE_TIERS.map(t => {
            const afford = bal >= t.amt;
            const act = afford ? `pickStake('${type}',${t.amt})` : `stakeTooPoor(${t.amt})`;
            return `<button class="stake-card r-${t.r}${afford?'':' locked'}" onclick="${act}">
              <span class="stake-card-glow" aria-hidden="true"></span>
              <span class="stake-tier">${t.label}</span>
              <span class="stake-amt"><span class="stake-coin">🪙</span>${t.amt.toLocaleString()}</span>
              ${afford ? '<span class="stake-go">PLAY ▸</span>' : '<span class="stake-lock">🔒</span>'}
            </button>`;
          }).join('')}
        </div>
      </div>`;
    ov.addEventListener('mousedown', e => { if(e.target === ov) closeStakePicker(); });
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
  }
  function setStakeOpt(kind, val){
    if(_pickerState) _pickerState[kind] = val;
    document.querySelectorAll(`#stakeOv .stake-chip[data-opt="${kind}"]`).forEach(el => {
      el.classList.toggle('sel', el.getAttribute('data-val') === val);
    });
  }
  function closeStakePicker(){
    const ov = document.getElementById('stakeOv');
    if(!ov) return;
    ov.classList.remove('show');
    setTimeout(() => ov.remove(), 200);
  }
  function pickStake(type, amt){
    const st = _pickerState || {};
    closeStakePicker();
    if(typeof quickJoin !== 'function') return;
    if(type === 'CLASSIC'){
      quickJoin(type, undefined, st.mode || 'ffa', amt);
    } else if(type === 'CHESS'){
      quickJoin(type, undefined, undefined, amt);
      _applyChessTimeControl(st.tc || 'RAPID_10');
    } else {
      quickJoin(type, undefined, undefined, amt);
    }
  }
  // Set the chosen chess time control once we've joined the freshly-spawned
  // room (host) and it's still in 'lobby' — retried a few times to ride out the
  // socket-join lag before the bot fills and the match auto-starts. No server
  // change needed: the chess:set_time_control handler already exists.
  function _applyChessTimeControl(id){
    let tries = 0;
    const tick = () => {
      if(tries++ > 12) return;
      if(!(S.socket && S.socket.connected)) return setTimeout(tick, 250);
      S.socket.emit('chess:set_time_control', { id }, (res) => {
        if(res && res.success) return;                             // applied
        if(res && res.reason === 'Match already started') return;  // too late — keep default
        setTimeout(tick, 300);                                     // not in room / not host yet → retry
      });
    };
    setTimeout(tick, 350);
  }
  function stakeTooPoor(amt){
    toast(`Need 🪙 ${Number(amt).toLocaleString()} for this stake — win more or visit the Shop`, 'i');
  }
  window.openStakePicker  = openStakePicker;
  window.closeStakePicker = closeStakePicker;
  window.pickStake        = pickStake;
  window.setStakeOpt      = setStakeOpt;
  window.stakeTooPoor     = stakeTooPoor;

  // 2v2 TEAM MODE trigger. The user-facing mode picker is pending the user's UI
  // design (the old one was reverted), so for now run `_testTeamMode()` in the
  // console to start a real 2v2 Cardora game: you + 3 bots, partners sit across,
  // SHARE their hands (a face-up strip up top), and WIN together.
  window._testTeamMode = function(type){
    if(typeof quickJoin==='function') quickJoin(type || 'CLASSIC', undefined, '2v2');
  };

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

  // SHOP — opens the real shop modal (P4-D.4). Header "+" buttons + the
  // left-rail SHOP item + future entry points all funnel through this
  // single dispatcher so the open path stays one-call.
  function doShop(initialTab){
    if(typeof showShop === 'function'){
      showShop(initialTab);
    } else if(typeof comingSoon === 'function'){
      comingSoon('Shop','Shop module failed to load — refresh.');
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

  // Live "players online" pill in the lobby header. Updated by the
  // online:count socket broadcast + an initial fetch on lobby load.
  function setOnlineCount(n){
    S.onlineCount = n || 0;   // shared so the matchmaking screen can show it
    if(!document.getElementById('onlinePillStyle')){
      const s=document.createElement('style'); s.id='onlinePillStyle';
      s.textContent='.public-hd{display:flex;align-items:center;justify-content:space-between;gap:12px}'
        +'.online-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:99px;font-size:12px;font-weight:800;'
        +'color:rgba(255,255,255,.7);background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);white-space:nowrap}'
        +'.online-pill b{color:#22C55E;font-size:13px}';
      document.head.appendChild(s);
    }
    const el=document.getElementById('onlineNum'); if(el) el.textContent=(n||0).toLocaleString();
    const pill=document.getElementById('onlinePill'); if(pill) pill.style.display='';
  }
  window.setOnlineCount=setOnlineCount;

  // Built-in featured tiles — mirrors the server's FEATURED_TYPE_ORDER so the
  // 4 game tiles still render if /rooms/featured is unreachable (old server
  // process / transient error). Keeps the lobby from ever showing an empty
  // grid with the CREATE/QUICK tiles stranded under the title.
  const _FEATURED_FALLBACK = [
    { type:'CLASSIC',    label:'Classic Room', maxPlayers:4, entryFee:100, badge:null, ranked:false, players:0, instanceId:null, seats:[] },
    { type:'RONDA',      label:'Ronda',        maxPlayers:4, entryFee:200, badge:null, ranked:false, players:0, instanceId:null, seats:[] },
    { type:'CHESS', label:'Chess',   maxPlayers:2, entryFee:200, badge:null, ranked:false, players:0, instanceId:null, seats:[] },
    { type:'DAMA',       label:'Dama',         maxPlayers:2, entryFee:200, badge:null, ranked:false, players:0, instanceId:null, seats:[] },
  ];
  function _renderFeaturedFallback(g){
    if(!g || typeof _featuredCardHTML !== 'function') return;
    g.className = 'rgrid rgrid--featured';
    g.innerHTML = _FEATURED_FALLBACK.map(c => _featuredCardHTML(c, false)).join('');
    try{ EVENT.decorateRooms(); }catch(e){}
  }

  async function loadRooms(){
    // Light-touch: refresh the Missions badge + online count when the lobby reloads.
    try{ if(typeof refreshDailyBadge==='function') refreshDailyBadge(); }catch(e){}
    try{ apiFetch('/api/online').then(d=>setOnlineCount(d.count)).catch(()=>{}); }catch(e){}
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
      if(!featured || !Array.isArray(featured.rooms) || !featured.rooms.length){
        // /rooms/featured didn't answer (a stale/old server process, or a
        // transient error). DON'T leave the grid empty — that's exactly what
        // pushed the CREATE/QUICK tiles up under the title and looked broken.
        // Render the 4 game tiles from a built-in fallback so the lobby always
        // looks right and quick-join still works. Only fill when the grid is
        // empty, so a real render from a prior good fetch is never clobbered.
        if(g && !g.children.length) _renderFeaturedFallback(g);
        const ri0 = document.getElementById('rinfo');
        if(ri0) ri0.textContent = 'Could not load rooms';
        return;
      }

      // Stale-server detector — if the running Node process is older than
      // the build the SW just pulled, the lobby will show wrong tiles
      // (e.g. RANKED in slot 3 instead of TBA9_ZROUT). One toast is
      // enough; the dataset flag dedupes so it doesn't spam every 5s.
      const EXPECTED_BUILD = 292;
      const g_root = document.getElementById('rgrid');
      if(featured.buildNum && featured.buildNum < EXPECTED_BUILD &&
         g_root?.dataset.staleWarned !== '1'){
        g_root.dataset.staleWarned = '1';
        const have = featured.buildNum;
        toast(`⚠️ Server is stale (build ${have} — need ${EXPECTED_BUILD}). Run restart-server.bat`, 'w');
        console.warn('[lobby] STALE SERVER — got buildNum', have, 'expected', EXPECTED_BUILD);
      } else if(featured.buildNum >= EXPECTED_BUILD){
        if(g_root) g_root.dataset.staleWarned = '';
      }

      // `rinfo` badge was removed from the lobby header — skip writing it.
      const ri = document.getElementById('rinfo');
      if(ri){
        const onlineCount = featured.onlineCount || 0;
        ri.innerHTML =
          `${featured.rooms.length} rooms `+
          `<span class="online-pill"><span class="online-dot"></span>${onlineCount} online</span>`;
      }

      // Render the 4 cards. Signature-cached: only re-render when the
      // payload meaningfully changes (no needless DOM thrash every 5s).
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
      // Never leave the grid empty on an error — show the fallback tiles.
      const g = document.getElementById('rgrid');
      if(g && !g.children.length) _renderFeaturedFallback(g);
      const ri = document.getElementById('rinfo');
      if(ri) ri.textContent='Could not load rooms';
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
    // Eyebrow + Bangers title pattern matching the new design system.
    const tUpper = (title||'').toUpperCase();
    ov.innerHTML=`<div class="nm-panel">
      <div class="nm-head">
        <div class="nm-head-titles">
          <div class="nm-eyebrow">${esc(icon||'')} ${tUpper === 'MISSIONS' ? 'DAILY PROGRESS' : tUpper === 'COLLECTION' ? 'YOUR ROSTER' : 'NAVIGATE'}</div>
          <div class="nm-title">${esc(tUpper)}</div>
        </div>
        <button class="nm-close" onclick="document.getElementById('navModal').remove()" aria-label="Close">×</button>
      </div>
      <div class="nm-body">${bodyHTML}${footHTML||''}</div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) ov.remove(); });
  }
  // Daily Quests + Streak hub. Live data from /api/daily — 3 quests refresh
  // every day, each grants coins + Battle Pass XP; a consecutive-day streak
  // pays milestone bonuses. Part of the "Road to Champion" loop.
  let _missionsTab='daily';
  async function showMissions(){
    _ensureDailyStyles();
    _navModal('Missions','🎯',
      `<div class="mm-tabs">
        <button class="mm-tab ${_missionsTab==='daily'?'on':''}" data-tab="daily" onclick="switchMissionsTab('daily')">🎯 Daily</button>
        <button class="mm-tab ${_missionsTab==='contracts'?'on':''}" data-tab="contracts" onclick="switchMissionsTab('contracts')">📜 Contracts</button>
      </div><div id="mmContent"><div class="dq-load">Loading…</div></div>`,'');
    _loadMissionsTab();
  }
  function switchMissionsTab(t){
    _missionsTab=t;
    document.querySelectorAll('#navModal .mm-tab').forEach(b=>b.classList.toggle('on', b.dataset.tab===t));
    _loadMissionsTab();
  }
  // Loading + error states use INLINE styles so they're visible no matter what
  // (independent of the injected dqStyles sheet, which can be stale from cache).
  function _mmLoading(){
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:54px 20px;">
      <div style="width:38px;height:38px;border-radius:50%;border:3px solid rgba(255,255,255,.14);border-top-color:#FBBF24;animation:dqSpin .8s linear infinite;"></div>
      <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:.4px;">Loading missions…</div>
    </div>`;
  }
  function _mmError(msg, tab){
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:13px;padding:42px 20px;text-align:center;">
      <div style="font-size:38px;line-height:1;">📡</div>
      <div style="font-size:13.5px;font-weight:700;color:rgba(255,255,255,.78);max-width:320px;line-height:1.5;">${msg}</div>
      <button onclick="switchMissionsTab('${tab}')" style="margin-top:2px;padding:10px 24px;border:none;border-radius:11px;cursor:pointer;font-family:inherit;background:linear-gradient(135deg,#7C3AED,#4F46E5);color:#fff;font-weight:900;font-size:13px;letter-spacing:.5px;box-shadow:0 6px 18px rgba(99,102,241,.45);">↻ Try again</button>
    </div>`;
  }
  // ── ABSOLUTE FAILSAFE WATCHDOG ───────────────────────────────────────────
  // Independent of the fetch/retry logic: if the modal is STILL showing the
  // spinner after the deadline (any hung/stale code path), force the error +
  // Try-again UI so it can NEVER spin forever. This is the last line of defence.
  let _mmWatchdog=null;
  function _clearMissionsWatchdog(){ if(_mmWatchdog){ clearTimeout(_mmWatchdog); _mmWatchdog=null; } }
  function _armMissionsWatchdog(tab){
    _clearMissionsWatchdog();
    _mmWatchdog=setTimeout(()=>{
      const c=document.getElementById('mmContent');
      if(!c || _missionsTab!==tab) return;
      if(/Loading missions|dqSpin|dq-load/.test(c.innerHTML)){   // still spinning?
        c.innerHTML=_mmError('Couldn’t load missions — the server didn’t respond in time.<br><span style="opacity:.65;font-weight:600">Hard-refresh (Ctrl+Shift+R), make sure the server is running, then Try again.</span>', tab);
      }
    }, 14000);
  }
  async function _loadMissionsTab(){
    const c=document.getElementById('mmContent'); if(!c) return;
    const tab=_missionsTab;                 // snapshot — guards against fast tab switches
    // INSTANT OPEN (cache-then-network): render the last-known payload
    // immediately — the modal NEVER sits on a spinner if you've opened it
    // before. The fresh fetch below silently replaces it when it lands.
    let hadCache=false;
    try{
      const raw=localStorage.getItem('mm_cache_'+tab);
      if(raw){
        const cached=JSON.parse(raw);
        if(cached && cached.d){
          hadCache=true;
          if(tab==='contracts'){ _renderContracts(cached.d); }
          else { _renderDaily(cached.d); try{ refreshDailyBadge(cached.d); }catch(_){} }
        }
      }
    }catch(_){}
    if(!hadCache) c.innerHTML=_mmLoading();
    if(!hadCache) _armMissionsWatchdog(tab);   // failsafe — only needed when a spinner is up
    const path = tab==='contracts' ? '/api/contracts' : '/api/daily';
    // HARD timeout that does NOT depend on apiFetch honouring opts.timeout — if
    // a stale cached apiFetch ever ignores its own AbortController, this still
    // rejects so the modal can never spin forever.
    const fetchOnce = () => Promise.race([
      apiFetch(path, { timeout: 6000 }),
      new Promise((_, rej) => setTimeout(() => { const e = new Error('timeout'); e.timedOut = true; rej(e); }, 7000)),
    ]);
    let lastErr = null;
    for(let attempt=0; attempt<2; attempt++){          // 1 retry for a transient blip
      try{
        const d = await fetchOnce();
        if(_missionsTab!==tab || !document.getElementById('mmContent')) return;   // tab switched / modal closed
        if(!d || typeof d!=='object') throw new Error('Empty response');
        if(tab==='contracts'){ _renderContracts(d); }
        else { _renderDaily(d); try{ refreshDailyBadge(d); }catch(_){} }   // badge is a side-effect — never let it wipe a good render
        try{ localStorage.setItem('mm_cache_'+tab, JSON.stringify({ at:Date.now(), d })); }catch(_){}
        _clearMissionsWatchdog();
        return;                                          // ✓ loaded (fresh)
      }catch(e){
        lastErr = e;
        if(_missionsTab!==tab || !document.getElementById('mmContent')) return;
        // Auto-retry ONCE on a transient timeout/network error (keeps the
        // loader up); never retry a 401/404/500 — those won't fix themselves.
        if(attempt===0 && (e?.timedOut || e?.networkError)){ c.innerHTML=_mmLoading(); continue; }
        break;
      }
    }
    const cc=document.getElementById('mmContent'); if(!cc || _missionsTab!==tab) return;
    // Fetch failed but we're showing the saved missions → keep them (they're
    // still useful) and pin a slim note instead of nuking the content.
    if(hadCache){
      _clearMissionsWatchdog();
      if(!cc.querySelector('.mm-stale-note')){
        cc.insertAdjacentHTML('afterbegin',
          `<div class="mm-stale-note" style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px 12px;border-radius:10px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);font-size:11px;font-weight:700;color:#FDE68A;">
            📡 Showing saved missions — reconnecting…
            <button onclick="switchMissionsTab('${tab}')" style="margin-left:auto;padding:4px 10px;border:none;border-radius:8px;cursor:pointer;font-family:inherit;background:rgba(251,191,36,.2);color:#FDE68A;font-weight:900;font-size:10px;">↻ Retry</button>
          </div>`);
      }
      return;
    }
    const e = lastErr || {};
    const reason = e?.timedOut     ? 'the server didn’t respond (timed out)'
                 : e?.status===401 ? 'your session expired'
                 : e?.status===404 ? 'this endpoint is missing on the server'
                 : e?.status>0     ? `the server returned an error (${e.status})`
                 : e?.networkError ? 'the server can’t be reached'
                 :                   (e?.message || 'an unknown error');
    const hint = (e?.timedOut || e?.networkError || e?.status===404)
      ? '<br><span style="opacity:.65;font-weight:600">Hard-refresh (Ctrl+Shift+R) — and check the server is running — then Try again.</span>'
      : (e?.status===401 ? '<br><span style="opacity:.65;font-weight:600">Log out and back in.</span>' : '');
    cc.innerHTML=_mmError(`Couldn’t load missions — ${reason}.${hint}`, tab);
    _clearMissionsWatchdog();
    console.warn('[missions] load failed:', { status:e?.status, timedOut:e?.timedOut, network:e?.networkError, msg:e?.message });
  }
  window.switchMissionsTab=switchMissionsTab;
  function _renderDaily(d){
    const body=document.getElementById('mmContent');
    if(!body) return;
    const streak=d.streak||0;
    const ms=Math.max(0,(d.nextResetAt||0)-Date.now());
    const hrs=Math.floor(ms/3600000), mins=Math.floor((ms%3600000)/60000);
    const bpPct=d.xpPerTier?Math.min(100,Math.round(((d.bpXp%d.xpPerTier)/d.xpPerTier)*100)):0;
    const quests=(d.quests||[]).map(q=>{
      const pct=Math.min(100,Math.round(q.current/q.target*100));
      let action;
      if(q.claimed)        action=`<div class="dq-rw done">✓ CLAIMED</div>`;
      else if(q.complete)  action=`<button class="dq-claim" onclick="claimDailyQuest('${q.id}')">CLAIM</button>`;
      else                 action=`<div class="dq-rw">🪙 ${q.coins}<br><span class="dq-xp">⚡ ${q.xp} XP</span></div>`;
      return `<div class="dq-q ${q.complete?'done':''}">
        <div class="dq-q-ic">${q.complete&&!q.claimed?'✅':q.icon}</div>
        <div class="dq-q-main">
          <div class="dq-q-name">${esc(q.name)}</div>
          <div class="dq-q-desc">${esc(q.desc)} · ${q.current}/${q.target}</div>
          <div class="dq-bar"><div class="dq-bar-fill" style="width:${pct}%"></div></div>
        </div>
        ${action}
      </div>`;
    }).join('');
    const miles=(d.milestones||[]).map(m=>{
      const cls=m.claimed?'claimed':m.reached?'ready':'locked';
      const click=(m.reached&&!m.claimed)?`onclick="claimDailyStreak(${m.day})"`:'';
      return `<div class="dq-ms ${cls}" ${click}>
        <div class="dq-ms-ic">${m.icon}</div>
        <div class="dq-ms-day">Day ${m.day}</div>
        <div class="dq-ms-rw">🪙${m.coins.toLocaleString()}${m.diamonds?` · 💎${m.diamonds}`:''}</div>
        <div class="dq-ms-state">${m.claimed?'✓ CLAIMED':m.reached?'CLAIM':'🔒'}</div>
      </div>`;
    }).join('');
    // Daily completion pulse — how far through today's quests you are, plus a
    // celebration banner once everything is claimed.
    const qs = d.quests || [];
    const doneN = qs.filter(q=>q.complete).length;
    const allClaimed = qs.length > 0 && qs.every(q=>q.claimed);
    body.innerHTML=`
      <div class="dq-streak">
        <div class="dq-streak-flame">🔥</div>
        <div class="dq-streak-main">
          <div class="dq-streak-n">${streak}-Day Streak</div>
          <div class="dq-streak-sub">Resets in ${hrs}h ${mins}m · play daily to keep it</div>
        </div>
        <div class="dq-today ${doneN===qs.length&&qs.length?'all':''}">🎯 ${doneN}/${qs.length||3}<span>today</span></div>
        <div class="dq-bp">
          <div class="dq-bp-lvl">PASS&nbsp;Lv&nbsp;${d.bpLevel||0}</div>
          <div class="dq-bp-bar"><div class="dq-bp-fill" style="width:${bpPct}%"></div></div>
        </div>
      </div>
      ${allClaimed?`<div class="dq-perfect">🌟 Perfect day — every mission complete! Come back tomorrow for fresh ones.</div>`:''}
      <div class="dq-sec">🎯 TODAY'S QUESTS</div>
      <div class="dq-quests">${quests}</div>
      <div class="dq-sec">🔥 STREAK REWARDS</div>
      <div class="dq-ms-row">${miles}</div>`;
  }
  async function claimDailyQuest(id){
    try{
      const r=await apiFetch('/api/daily/claim',{method:'POST',body:JSON.stringify({quest:id})});
      if(S.user){ S.user.coins=r.coins; try{localStorage.setItem('uno_user',JSON.stringify(S.user));}catch(e){} }
      if(typeof _animateCount==='function'){ _animateCount('hcoins',r.coins); _animateCount('heroCoins',r.coins); }
      toast(`✓ Quest claimed! +${r.xpGained} Pass XP`,'s');
      try{ if(typeof confetti==='function') confetti(); }catch(e){}     // claim = a little party
      const d=await apiFetch('/api/daily'); _renderDaily(d); refreshDailyBadge(d);
      try{ localStorage.setItem('mm_cache_daily', JSON.stringify({ at:Date.now(), d })); }catch(_){}
    }catch(e){ toast(e?.message||'Could not claim','e'); }
  }
  async function claimDailyStreak(day){
    try{
      const r=await apiFetch('/api/daily/claim-streak',{method:'POST',body:JSON.stringify({milestone:day})});
      if(S.user){ S.user.coins=r.coins; S.user.diamonds=r.diamonds; try{localStorage.setItem('uno_user',JSON.stringify(S.user));}catch(e){} }
      if(typeof _animateCount==='function'){ _animateCount('hcoins',r.coins); _animateCount('heroCoins',r.coins); _animateCount('hdiamonds',r.diamonds); }
      toast(`🔥 ${day}-day streak reward claimed!`,'s');
      try{ if(typeof confetti==='function') confetti(); }catch(e){}
      const d=await apiFetch('/api/daily'); _renderDaily(d); refreshDailyBadge(d);
      try{ localStorage.setItem('mm_cache_daily', JSON.stringify({ at:Date.now(), d })); }catch(_){}
    }catch(e){ toast(e?.message||'Could not claim','e'); }
  }
  // Red badge on the lobby Missions button = how many things are claimable now.
  function refreshDailyBadge(d){
    const el=document.getElementById('bstripMissionsNotif'); if(!el) return;
    const apply=(data)=>{
      const n=(data.quests||[]).filter(q=>q.complete&&!q.claimed).length
            +(data.milestones||[]).filter(m=>m.reached&&!m.claimed).length;
      el.textContent=n; el.style.display=n>0?'':'none';
    };
    if(d) apply(d);
    else apiFetch('/api/daily').then(apply).catch(()=>{});
  }
  window.claimDailyQuest=claimDailyQuest;
  window.claimDailyStreak=claimDailyStreak;
  window.refreshDailyBadge=refreshDailyBadge;

  // ── Season Contracts ──
  function _renderContracts(d){
    const c=document.getElementById('mmContent'); if(!c) return;
    const titleBar = d.activeTitle ? `<div class="ct-title">👑 Active Title: <b>${esc(d.activeTitle)}</b></div>` : '';
    const hint = d.active ? '' : `<div class="ct-hint">Pick ONE path for the season — switch anytime (count-based progress restarts).</div>`;
    const cards=(d.contracts||[]).map(ct=>{
      const objs=ct.objectives.map(o=>{
        const pct=ct.selected?Math.min(100,Math.round(o.current/o.target*100)):0;
        let act;
        if(!ct.selected)       act='';
        else if(o.claimed)     act=`<span class="ct-o-st done">✓</span>`;
        else if(o.complete)    act=`<button class="ct-claim" onclick="claimContractObjective('${o.id}')">CLAIM</button>`;
        else                   act=`<span class="ct-o-st">🪙${o.coins}·⚡${o.xp}</span>`;
        return `<div class="ct-o ${o.complete?'done':''}">
          <div class="ct-o-main">
            <div class="ct-o-desc">${esc(o.desc)} <span class="ct-o-prog">${o.current}/${o.target}</span></div>
            <div class="ct-bar"><div class="ct-bar-fill" style="width:${pct}%;background:${ct.color}"></div></div>
          </div>${act}
        </div>`;
      }).join('');
      let footer;
      if(!ct.selected)            footer=`<button class="ct-select" style="background:${ct.color}" onclick="selectContract('${ct.id}')">CHOOSE THIS PATH</button>`;
      else if(ct.rewardClaimed)   footer=`<div class="ct-complete">👑 Completed — "${esc(ct.title)}" earned</div>`;
      else if(ct.allDone)         footer=`<button class="ct-claim-big" onclick="claimContractReward()">CLAIM 👑 ${esc(ct.title)} + 🪙${ct.reward.coins.toLocaleString()}${ct.reward.diamonds?` + 💎${ct.reward.diamonds}`:''}</button>`;
      else                        footer=`<div class="ct-reward">Finish all 3 → 👑 "${esc(ct.title)}" + 🪙${ct.reward.coins.toLocaleString()}${ct.reward.diamonds?` + 💎${ct.reward.diamonds}`:''}</div>`;
      return `<div class="ct-card ${ct.selected?'on':''}" style="--cc:${ct.color}">
        <div class="ct-head"><span class="ct-ic">${ct.icon}</span>
          <div class="ct-head-txt"><div class="ct-name">${esc(ct.name)}${ct.selected?' <span class="ct-active">ACTIVE</span>':''}</div>
          <div class="ct-tag">${esc(ct.tagline)}</div></div></div>
        <div class="ct-objs">${objs}</div>
        ${footer}
      </div>`;
    }).join('');
    c.innerHTML=`${titleBar}${hint}<div class="ct-list">${cards}</div>`;
  }
  async function selectContract(id){
    try{ await apiFetch('/api/contracts/select',{method:'POST',body:JSON.stringify({id})}); _loadMissionsTab(); }
    catch(e){ toast(e?.message||'Could not select','e'); }
  }
  async function claimContractObjective(objId){
    try{
      const r=await apiFetch('/api/contracts/claim',{method:'POST',body:JSON.stringify({objective:objId})});
      if(S.user){ S.user.coins=r.coins; try{localStorage.setItem('uno_user',JSON.stringify(S.user));}catch(e){} }
      if(typeof _animateCount==='function'){ _animateCount('hcoins',r.coins); _animateCount('heroCoins',r.coins); }
      toast(`✓ Objective claimed! +${r.xpGained} Pass XP`,'s');
      _loadMissionsTab();
    }catch(e){ toast(e?.message||'Could not claim','e'); }
  }
  async function claimContractReward(){
    try{
      const r=await apiFetch('/api/contracts/claim-reward',{method:'POST',body:JSON.stringify({})});
      if(S.user){ S.user.coins=r.coins; S.user.diamonds=r.diamonds; try{localStorage.setItem('uno_user',JSON.stringify(S.user));}catch(e){} }
      if(typeof _animateCount==='function'){ _animateCount('hcoins',r.coins); _animateCount('heroCoins',r.coins); _animateCount('hdiamonds',r.diamonds); }
      toast(`👑 Title earned: "${r.title}"!`,'s');
      _loadMissionsTab();
    }catch(e){ toast(e?.message||'Could not claim','e'); }
  }
  window.selectContract=selectContract;
  window.claimContractObjective=claimContractObjective;
  window.claimContractReward=claimContractReward;

  function _ensureDailyStyles(){
    if(document.getElementById('dqStyles2')) return;
    document.getElementById('dqStyles')?.remove();   // drop any stale older sheet
    const s=document.createElement('style'); s.id='dqStyles2';
    s.textContent=`
      .dq-load,.dq-empty{ text-align:center; padding:42px 16px; color:rgba(255,255,255,.6); font-weight:700; line-height:1.6; }
      @keyframes dqSpin{ to{ transform:rotate(360deg) } }
      @keyframes dqPulse{ 0%,100%{transform:scale(1)} 50%{transform:scale(1.035)} }
      /* ── Streak header ── refined premium banner */
      .dq-streak{ display:flex; align-items:center; gap:14px; padding:15px 17px; border-radius:16px; margin-bottom:4px;
        background:linear-gradient(135deg, rgba(245,158,11,.15), rgba(124,58,237,.10)); border:1px solid rgba(245,158,11,.22);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.06); }
      .dq-streak-flame{ font-size:28px; filter:drop-shadow(0 3px 8px rgba(245,158,11,.5)); }
      .dq-streak-main{ flex:1; min-width:0; }
      .dq-streak-n{ font-family:'Outfit',sans-serif; font-weight:900; font-size:18px; letter-spacing:.2px; color:#FFE7B3; line-height:1.15; }
      .dq-streak-sub{ font-size:10.5px; color:rgba(255,255,255,.55); font-weight:600; margin-top:3px; }
      .dq-today{ display:flex; flex-direction:column; align-items:center; justify-content:center; min-width:58px; padding:7px 10px;
        border-radius:12px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09);
        font-family:'Outfit',sans-serif; font-weight:900; font-size:15px; color:#fff; line-height:1.1; }
      .dq-today span{ font-size:8px; letter-spacing:.8px; text-transform:uppercase; color:rgba(255,255,255,.45); font-weight:800; }
      .dq-today.all{ background:rgba(34,197,94,.14); border-color:rgba(34,197,94,.4); color:#86EFAC; }
      .dq-perfect{ margin:10px 0 2px; padding:11px 14px; border-radius:13px; text-align:center;
        font-size:12px; font-weight:800; color:#FFE7B3;
        background:linear-gradient(135deg, rgba(245,158,11,.16), rgba(34,197,94,.10));
        border:1px solid rgba(245,158,11,.35); animation:dqPerfectIn .5s cubic-bezier(.18,1.3,.4,1) both; }
      @keyframes dqPerfectIn{ from{ opacity:0; transform:scale(.92); } to{ opacity:1; transform:scale(1); } }
      .dq-bp{ text-align:right; min-width:104px; }
      .dq-bp-lvl{ font-size:9.5px; font-weight:900; letter-spacing:.9px; color:#C4B5FD; margin-bottom:5px; text-transform:uppercase; }
      .dq-bp-bar{ height:6px; border-radius:99px; background:rgba(255,255,255,.1); overflow:hidden; }
      .dq-bp-fill{ height:100%; background:linear-gradient(90deg,#7C3AED,#A78BFA); border-radius:99px; transition:width .5s; }
      /* ── Section header ── label + hairline */
      .dq-sec{ display:flex; align-items:center; gap:9px; font-size:10.5px; font-weight:900; letter-spacing:1.6px;
        color:rgba(255,255,255,.5); margin:20px 2px 11px; text-transform:uppercase; }
      .dq-sec::after{ content:''; flex:1; height:1px; background:linear-gradient(90deg, rgba(255,255,255,.13), transparent); }
      /* ── Quests ── */
      .dq-quests{ display:flex; flex-direction:column; gap:8px; }
      .dq-q{ display:flex; align-items:center; gap:13px; padding:12px 14px; border-radius:14px;
        background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.06); transition:border-color .2s, background .2s; }
      .dq-q.done{ border-color:rgba(34,197,94,.3); background:rgba(34,197,94,.06); }
      .dq-q-ic{ font-size:19px; width:34px; height:34px; display:flex; align-items:center; justify-content:center; flex:0 0 auto;
        border-radius:11px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.05); }
      .dq-q.done .dq-q-ic{ background:rgba(34,197,94,.14); border-color:rgba(34,197,94,.2); }
      .dq-q-main{ flex:1; min-width:0; }
      .dq-q-name{ font-weight:800; font-size:13.5px; color:#fff; letter-spacing:.1px; }
      .dq-q-desc{ font-size:10.5px; color:rgba(255,255,255,.5); font-weight:600; margin:3px 0 7px; }
      .dq-bar{ height:5px; border-radius:99px; background:rgba(255,255,255,.09); overflow:hidden; }
      .dq-bar-fill{ height:100%; background:linear-gradient(90deg,#F59E0B,#FBBF24); border-radius:99px; transition:width .5s; }
      .dq-rw{ flex:0 0 auto; text-align:right; font-size:12px; font-weight:900; color:#FBBF24; line-height:1.35; min-width:52px; }
      .dq-rw.done{ color:#22C55E; }
      .dq-xp{ font-size:9.5px; color:#A78BFA; }
      .dq-claim{ flex:0 0 auto; padding:9px 17px; border:none; border-radius:11px; cursor:pointer;
        background:linear-gradient(135deg,#FCD34D,#F59E0B); color:#3A2606; font-family:inherit; font-weight:900; font-size:11.5px; letter-spacing:.8px;
        box-shadow:0 5px 14px rgba(245,158,11,.38); transition:transform .15s, box-shadow .2s; }
      .dq-claim:hover{ transform:translateY(-1px); box-shadow:0 7px 18px rgba(245,158,11,.5); }
      .dq-claim:active{ transform:scale(.96); }
      /* ── Milestones grid ── */
      .dq-ms-row{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
      .dq-ms{ text-align:center; padding:12px 6px 10px; border-radius:14px; background:rgba(255,255,255,.035);
        border:1px solid rgba(255,255,255,.06); transition:transform .15s, border-color .2s; }
      .dq-ms.locked{ opacity:.42; }
      .dq-ms.ready{ border-color:rgba(251,191,36,.5); background:rgba(251,191,36,.09); cursor:pointer; animation:dqPulse 1.8s ease-in-out infinite; }
      .dq-ms.ready:hover{ transform:translateY(-2px); }
      .dq-ms.claimed{ border-color:rgba(34,197,94,.3); background:rgba(34,197,94,.06); }
      .dq-ms-ic{ font-size:19px; }
      .dq-ms-day{ font-weight:900; font-size:11px; color:#fff; margin:5px 0 2px; letter-spacing:.2px; }
      .dq-ms-rw{ font-size:9px; color:rgba(255,255,255,.55); font-weight:700; }
      .dq-ms-state{ font-size:8.5px; font-weight:900; letter-spacing:.6px; margin-top:6px; color:rgba(255,255,255,.4); }
      .dq-ms.ready .dq-ms-state{ color:#FBBF24; }
      .dq-ms.claimed .dq-ms-state{ color:#22C55E; }
      @media (max-width:480px){ .dq-ms-row{ grid-template-columns:repeat(2,1fr); } }

      /* ── Missions tabs ── segmented control */
      .mm-tabs{ display:flex; gap:4px; margin-bottom:16px; padding:4px; border-radius:13px;
        background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.05); }
      .mm-tab{ flex:1; padding:9px; border-radius:10px; cursor:pointer; font-family:inherit;
        background:transparent; border:none; color:rgba(255,255,255,.6);
        font-weight:800; font-size:12.5px; letter-spacing:.3px; transition:all .18s; }
      .mm-tab:hover{ color:rgba(255,255,255,.85); }
      .mm-tab.on{ background:linear-gradient(135deg,#7C3AED,#5B4BE5); color:#fff; box-shadow:0 5px 14px rgba(99,102,241,.36); }

      /* ── Contracts ── */
      .ct-title{ text-align:center; font-size:11.5px; font-weight:800; color:#FFE7B3; margin-bottom:11px;
        padding:9px; border-radius:12px; background:rgba(251,191,36,.09); border:1px solid rgba(251,191,36,.22); }
      .ct-hint{ font-size:11px; color:rgba(255,255,255,.5); text-align:center; margin-bottom:13px; font-weight:600; line-height:1.55; }
      .ct-list{ display:flex; flex-direction:column; gap:11px; }
      .ct-card{ padding:15px; border-radius:16px; background:rgba(255,255,255,.028); border:1px solid rgba(255,255,255,.07);
        transition:border-color .2s, box-shadow .25s; }
      .ct-card.on{ border-color:var(--cc); box-shadow:0 0 0 1px var(--cc), 0 12px 28px rgba(0,0,0,.38);
        background:linear-gradient(180deg, color-mix(in srgb, var(--cc) 9%, transparent), rgba(255,255,255,.015)); }
      .ct-head{ display:flex; align-items:center; gap:13px; margin-bottom:13px; }
      .ct-ic{ font-size:22px; width:42px; height:42px; flex:0 0 auto; display:flex; align-items:center; justify-content:center;
        border-radius:13px; background:color-mix(in srgb, var(--cc) 16%, rgba(255,255,255,.04)); border:1px solid color-mix(in srgb, var(--cc) 30%, transparent); }
      .ct-head-txt{ flex:1; min-width:0; }
      .ct-name{ font-family:'Outfit',sans-serif; font-weight:900; font-size:16px; letter-spacing:.2px; color:#fff; line-height:1.15; }
      .ct-active{ font-family:'Outfit',sans-serif; font-size:8.5px; font-weight:900; letter-spacing:1px; background:var(--cc); color:#fff; padding:2px 8px; border-radius:99px; vertical-align:middle; margin-left:7px; }
      .ct-tag{ font-size:11px; color:rgba(255,255,255,.52); font-weight:600; margin-top:3px; }
      .ct-objs{ display:flex; flex-direction:column; gap:10px; }
      .ct-o{ display:flex; align-items:center; gap:11px; }
      .ct-o-main{ flex:1; min-width:0; }
      .ct-o-desc{ font-size:12px; font-weight:700; color:rgba(255,255,255,.82); margin-bottom:6px; }
      .ct-o-prog{ font-size:10.5px; color:rgba(255,255,255,.42); font-weight:800; }
      .ct-o.done .ct-o-desc{ color:#fff; }
      .ct-bar{ height:5px; border-radius:99px; background:rgba(255,255,255,.09); overflow:hidden; }
      .ct-bar-fill{ height:100%; border-radius:99px; transition:width .5s; }
      .ct-o-st{ flex:0 0 auto; font-size:10px; font-weight:900; color:rgba(255,255,255,.48); min-width:70px; text-align:right; }
      .ct-o-st.done{ color:#22C55E; font-size:15px; }
      .ct-claim{ flex:0 0 auto; padding:8px 14px; border:none; border-radius:10px; cursor:pointer;
        background:linear-gradient(135deg,#FCD34D,#F59E0B); color:#3A2606; font-family:inherit; font-weight:900; font-size:10.5px; letter-spacing:.6px;
        box-shadow:0 4px 12px rgba(245,158,11,.36); transition:transform .15s; }
      .ct-claim:hover{ transform:translateY(-1px); }
      .ct-claim:active{ transform:scale(.95); }
      .ct-select{ width:100%; margin-top:13px; padding:12px; border:none; border-radius:12px; cursor:pointer;
        color:#fff; font-family:inherit; font-weight:900; font-size:12.5px; letter-spacing:.8px; box-shadow:0 6px 18px rgba(0,0,0,.35); transition:filter .2s, transform .15s; }
      .ct-select:hover{ filter:brightness(1.08); transform:translateY(-1px); }
      .ct-reward{ margin-top:13px; text-align:center; font-size:11px; font-weight:700; color:rgba(255,255,255,.58);
        padding:10px; border-radius:11px; background:rgba(255,255,255,.035); border:1px dashed rgba(255,255,255,.12); }
      .ct-claim-big{ width:100%; margin-top:13px; padding:13px; border:none; border-radius:12px; cursor:pointer;
        background:linear-gradient(135deg,#FCD34D,#F59E0B,#D97706); color:#3A2606; font-family:inherit; font-weight:900; font-size:12px; letter-spacing:.4px;
        box-shadow:0 8px 22px rgba(245,158,11,.45); animation:dqPulse 1.8s ease-in-out infinite; }
      .ct-complete{ margin-top:13px; text-align:center; font-size:12px; font-weight:900; color:#22C55E;
        padding:11px; border-radius:12px; background:rgba(34,197,94,.09); border:1px solid rgba(34,197,94,.32); }
    `;
    document.head.appendChild(s);
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

  // Lobby bottom-strip shortcuts. These piggyback on Game Center's existing
  // sub-views so the new tiles don't duplicate logic — they just deep-link.
  function showAchievements(){
    if(typeof showGameCenter === 'function'){
      showGameCenter();
      setTimeout(()=>{ if(typeof _gcNav === 'function') _gcNav('achievements'); }, 30);
    } else if(typeof showMissions === 'function'){
      showMissions();
    }
  }
  function showEmotes(){
    // Route Emotes to the in-game quickchat picker if available, otherwise
    // fall back to the emoji picker so the button always *does* something.
    if(typeof showQuickChat === 'function')   return showQuickChat();
    if(typeof toggleEmojiPicker === 'function') return toggleEmojiPicker();
    if(typeof showCollection === 'function')  return showCollection();
  }

