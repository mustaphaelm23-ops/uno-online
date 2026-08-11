  /* ═══════════════ BROWSE ALL ROOMS ═══════════════
     A premium full-list view of every open PUBLIC room on the server.
     Players can scan the list, see host + player count + entry fee + age,
     and join any room they can afford. Rooms above the player's coin
     balance show a locked state with a "Need X coins" tooltip — server
     also enforces the gate on the room:join socket call. */

  const BrowseRooms = {
    rooms: [],
    open: false,
    refreshTimer: null,
    filter: 'all', // 'all' | 'affordable'
    search: '',

    /* ───── lifecycle ───── */
    async show(){
      _ensureBrowseRoomsStyles();
      this._ensureNode();
      this.open = true;
      const ov = document.getElementById('brOv');
      requestAnimationFrame(()=>ov.classList.add('show'));
      await this.refresh();
      // Live-poll every 4s while the panel is open so newly-created rooms
      // surface without the player having to tap refresh.
      clearInterval(this.refreshTimer);
      this.refreshTimer = setInterval(()=>this.open && this.refresh(true), 4000);
    },
    close(){
      const ov = document.getElementById('brOv');
      if(!ov) return;
      ov.classList.remove('show');
      ov.classList.add('out');
      this.open = false;
      clearInterval(this.refreshTimer);
      setTimeout(()=>ov.remove(), 260);
    },

    async refresh(quiet){
      const btn = document.getElementById('brRefreshBtn');
      if(btn && !quiet){ btn.classList.add('spin'); setTimeout(()=>btn?.classList.remove('spin'), 700); }
      try{
        const d = await apiFetch('/api/rooms');
        this.rooms = (d.rooms || []);
        this._render();
      }catch(e){
        if(!quiet) toast('Could not load rooms', 'e');
      }
    },

    _ensureNode(){
      const old = document.getElementById('brOv'); if(old) old.remove();
      const ov = document.createElement('div');
      ov.id = 'brOv';
      ov.className = 'br-ov';
      ov.innerHTML = `
        <div class="br-panel" role="dialog" aria-label="Browse all rooms">
          <button class="br-close" onclick="BrowseRooms.close()" aria-label="Close">×</button>
          <div class="br-head">
            <div class="br-eyebrow">📋 EVERY OPEN ROOM</div>
            <div class="br-title">BROWSE ALL</div>
          </div>
          <div class="br-toolbar">
            <div class="br-search-wrap">
              <span class="br-search-ic">🔎</span>
              <input class="br-search" id="brSearch" placeholder="Search by host name…" maxlength="30">
            </div>
            <div class="br-filter">
              <button class="br-filter-opt on" data-filter="all">All</button>
              <button class="br-filter-opt" data-filter="affordable">Can Afford</button>
            </div>
            <button class="br-refresh" id="brRefreshBtn" onclick="BrowseRooms.refresh()" title="Refresh">
              <span class="br-refresh-ic">↻</span>
            </button>
          </div>
          <div class="br-meta">
            <span class="br-meta-coins">🪙 Your wallet: <b id="brWallet">0</b></span>
            <span class="br-meta-sep"></span>
            <span class="br-meta-count" id="brCount">0 rooms</span>
          </div>
          <div class="br-list" id="brList"></div>
        </div>`;
      document.body.appendChild(ov);

      // Wire toolbar
      const sInp = ov.querySelector('#brSearch');
      sInp.addEventListener('input', ()=>{
        this.search = (sInp.value || '').trim().toLowerCase();
        this._render();
      });
      ov.querySelectorAll('.br-filter-opt').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          ov.querySelectorAll('.br-filter-opt').forEach(b=>b.classList.remove('on'));
          btn.classList.add('on');
          this.filter = btn.dataset.filter;
          this._render();
        });
      });

      // Click outside the panel = close
      ov.addEventListener('mousedown', e=>{ if(e.target === ov) this.close(); });
      const onKey = (e)=>{ if(e.key === 'Escape'){ this.close(); document.removeEventListener('keydown', onKey); } };
      document.addEventListener('keydown', onKey);
    },

    /* ───── render ───── */
    _ageLabel(sec){
      if(sec < 60)   return `${sec}s ago`;
      if(sec < 3600) return `${Math.floor(sec/60)}m ago`;
      return `${Math.floor(sec/3600)}h ago`;
    },

    _avatarHTML(name, avatar){
      if(typeof _isImgAvatar === 'function' && _isImgAvatar(avatar)){
        return `<div class="br-row-av" style="background-image:url('${esc(avatar)}')"></div>`;
      }
      const face = esc(avatar || (name || '?')[0]).toUpperCase();
      return `<div class="br-row-av br-row-av-letter">${face}</div>`;
    },

    // Friendly game-type chip (label + icon + colour) for each room card.
    _typeInfo(t){
      const m = {
        CLASSIC:    { label:'Cardora',        icon:'🎴', cls:'cls'    },
        FUN:        { label:'Cardora · Fun',  icon:'🎉', cls:'fun'    },
        CHILL:      { label:'Cardora · Chill',icon:'😎', cls:'chill'  },
        RANKED:     { label:'Ranked',     icon:'🏆', cls:'ranked' },
        RONDA:      { label:'Ronda',      icon:'🃏', cls:'ronda'  },
        CHESS: { label:'Chess', icon:'♞', cls:'chess'   },
        DAMA:       { label:'Dama',       icon:'♟️', cls:'dama'   },
      };
      return m[t] || m.CLASSIC;
    },

    _render(){
      const list   = document.getElementById('brList');
      const cntEl  = document.getElementById('brCount');
      const wallet = document.getElementById('brWallet');
      if(!list) return;
      const coins = (S.user?.coins) || 0;
      if(wallet) wallet.textContent = coins.toLocaleString();

      // Filter
      let rooms = this.rooms.slice();
      if(this.search){
        rooms = rooms.filter(r => (r.hostUsername || '').toLowerCase().includes(this.search));
      }
      if(this.filter === 'affordable'){
        rooms = rooms.filter(r => (r.bet || 0) <= coins);
      }
      if(cntEl) cntEl.textContent = `${rooms.length} room${rooms.length === 1 ? '' : 's'}`;

      if(!rooms.length){
        list.innerHTML = `
          <div class="br-empty">
            <div class="br-empty-ic">🪑</div>
            <div class="br-empty-title">No rooms ${this.filter === 'affordable' ? 'you can afford' : 'open right now'}</div>
            <div class="br-empty-sub">${this.filter === 'affordable' ? 'Try the All filter, or top up your wallet.' : 'Create one yourself, or check back in a few seconds.'}</div>
          </div>`;
        return;
      }
      list.innerHTML = rooms.map(r => {
        const bet  = r.bet || 0;
        const full = r.players >= r.maxPlayers;
        const tooBroke = bet > coins;
        const locked   = full || tooBroke;
        const lockTxt = full ? 'FULL' :
                        tooBroke ? `Need ${bet.toLocaleString()} 🪙` : '';
        const playersLine = `${r.players}/${r.maxPlayers} players`;
        const ageLine = this._ageLabel(r.ageSec || 0);
        const betChip = bet > 0
          ? `<span class="br-row-bet"><span class="br-row-bet-lbl">ENTRY</span> 🪙 <b>${bet.toLocaleString()}</b></span>`
          : `<span class="br-row-bet br-row-bet-free">FREE</span>`;
        const ti = this._typeInfo(r.roomType);
        return `<div class="br-row ${locked?'locked':''}" data-id="${esc(r.id)}">
          ${this._avatarHTML(r.hostUsername, r.hostAvatar)}
          <div class="br-row-text">
            <div class="br-row-name">
              <span class="br-row-type br-row-type-${ti.cls}">${ti.icon} ${esc(ti.label)}</span>
              <span class="br-row-host">${esc(r.hostUsername || 'Host')}</span>
            </div>
            <div class="br-row-meta">
              <span class="br-row-players">${playersLine}</span>
              <span class="br-row-dot"></span>
              <span class="br-row-age">${ageLine}</span>
            </div>
          </div>
          ${betChip}
          <button class="br-row-join ${locked?'locked':''}"
                  ${locked ? `title="${lockTxt}" disabled` : ''}
                  onclick="BrowseRooms.join('${esc(r.id)}', ${bet})">
            ${full ? 'FULL' : tooBroke ? '🔒' : 'JOIN'}
          </button>
        </div>`;
      }).join('');
    },

    /* ───── actions ───── */
    join(roomId, bet){
      const coins = (S.user?.coins) || 0;
      if(bet > coins){
        toast(`Need ${bet.toLocaleString()} 🪙 to join (you have ${coins.toLocaleString()})`, 'e');
        return;
      }
      this.close();
      // doJoin is the existing global handler — it dispatches the
      // room:join socket call, which the server gates with the same
      // coin check as a safety net.
      if(typeof doJoin === 'function') doJoin(roomId);
    },
  };

  window.BrowseRooms = BrowseRooms;
  // Public entry point used by the lobby header button.
  function showBrowseRooms(){ BrowseRooms.show(); }
  window.showBrowseRooms = showBrowseRooms;

  function _ensureBrowseRoomsStyles(){
    if(document.getElementById('browseRoomsStyles')) return;
    const s = document.createElement('style');
    s.id = 'browseRoomsStyles';
    s.textContent = `
      .br-ov{
        position:fixed; inset:0; z-index:1100;
        display:flex; align-items:center; justify-content:center; padding:20px;
        background:rgba(4,8,18,.0);
        backdrop-filter:blur(0px); -webkit-backdrop-filter:blur(0px);
        transition:background .25s ease, backdrop-filter .25s ease;
      }
      .br-ov.show{
        background:rgba(4,8,18,.65);
        backdrop-filter:blur(14px) saturate(140%);
        -webkit-backdrop-filter:blur(14px) saturate(140%);
      }
      .br-ov.show .br-panel{ transform:translateY(0) scale(1); opacity:1; }
      .br-ov.out .br-panel{
        transform:translateY(14px) scale(.97); opacity:0;
        transition:transform .22s ease, opacity .22s ease;
      }
      .br-panel{
        position:relative; overflow:hidden;
        width:min(620px, 95vw); max-height:88vh;
        display:flex; flex-direction:column;
        border-radius:24px;
        background:
          radial-gradient(120% 60% at 50% 0%, rgba(251,191,36,.08) 0%, rgba(251,191,36,0) 60%),
          linear-gradient(180deg, #1A2236 0%, #0E1525 50%, #080D1A 100%);
        border:1px solid rgba(255,255,255,.08);
        box-shadow:
          0 40px 100px rgba(0,0,0,.75),
          0 0 50px rgba(251,191,36,.06),
          inset 0 1px 0 rgba(255,255,255,.06);
        color:#fff; font-family:'Outfit',sans-serif;
        transform:translateY(20px) scale(.95); opacity:0;
        transition:transform .32s cubic-bezier(.18,.89,.32,1.07), opacity .32s ease;
      }
      .br-panel::before{
        content:""; position:absolute; left:30px; right:30px; top:0; height:2px;
        background:linear-gradient(90deg, transparent 0%, rgba(251,191,36,.85) 18%, rgba(232,50,74,.95) 50%, rgba(251,191,36,.85) 82%, transparent 100%);
        border-radius:2px; filter:drop-shadow(0 0 6px rgba(251,191,36,.4));
        pointer-events:none;
      }
      .br-close{
        position:absolute; top:14px; right:16px;
        width:34px; height:34px; border-radius:50%; cursor:pointer;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10);
        color:rgba(255,255,255,.85); font-size:18px; font-weight:700; line-height:1;
        display:flex; align-items:center; justify-content:center;
        transition:transform .22s, background .2s, border-color .2s, color .2s;
        z-index:5;
      }
      .br-close:hover{background:rgba(232,50,74,.20); border-color:rgba(232,50,74,.55); color:#fff; transform:rotate(90deg);}

      .br-head{ text-align:center; padding:22px 22px 12px; flex-shrink:0; }
      .br-eyebrow{
        font-size:10px; font-weight:900; letter-spacing:2.8px;
        color:#FBBF24; text-transform:uppercase; margin-bottom:4px;
        text-shadow:0 1px 2px rgba(0,0,0,.5);
      }
      .br-title{
        font-family:'Bangers','Outfit',sans-serif;
        font-size:30px; letter-spacing:2.5px; line-height:1; font-weight:400;
        background:linear-gradient(180deg, #FDE68A 0%, #FBBF24 50%, #D97706 100%);
        -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        filter:drop-shadow(0 2px 0 rgba(0,0,0,.35));
        text-transform:uppercase;
      }

      /* Toolbar — search + filter pills + refresh */
      .br-toolbar{
        display:flex; align-items:center; gap:8px;
        padding:8px 22px 4px; flex-shrink:0;
      }
      .br-search-wrap{ position:relative; flex:1; min-width:0; }
      .br-search{
        width:100%; padding:9px 14px 9px 32px;
        background:rgba(0,0,0,.32);
        border:1px solid rgba(255,255,255,.08); border-radius:99px;
        color:#fff; font-family:'Outfit',sans-serif; font-size:12.5px; font-weight:600;
        outline:none; box-shadow:inset 0 1px 2px rgba(0,0,0,.35);
        transition:border-color .2s, box-shadow .2s;
      }
      .br-search::placeholder{ color:rgba(255,255,255,.4); font-weight:500; }
      .br-search:focus{
        border-color:rgba(251,191,36,.5);
        box-shadow:inset 0 1px 2px rgba(0,0,0,.35), 0 0 0 3px rgba(251,191,36,.15);
      }
      .br-search-ic{
        position:absolute; left:11px; top:50%; transform:translateY(-50%);
        font-size:13px; opacity:.55; pointer-events:none;
      }
      .br-filter{
        display:inline-flex; padding:3px; border-radius:99px;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08);
        flex-shrink:0;
      }
      .br-filter-opt{
        padding:6px 12px; border:none; border-radius:99px; cursor:pointer;
        background:transparent; color:rgba(255,255,255,.62);
        font-family:'Outfit',sans-serif; font-size:11px; font-weight:900;
        letter-spacing:.8px; text-transform:uppercase;
        transition:background .2s, color .2s;
      }
      .br-filter-opt:hover{ color:#fff; }
      .br-filter-opt.on{
        background:linear-gradient(180deg, #FBBF24, #D97706);
        color:#3D2308; text-shadow:0 1px 0 rgba(255,255,255,.2);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.35), 0 3px 6px rgba(251,191,36,.4);
      }
      .br-refresh{
        flex-shrink:0;
        width:34px; height:34px; border-radius:50%;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10);
        color:rgba(255,255,255,.85); cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        transition:background .2s, border-color .2s;
      }
      .br-refresh:hover{ background:rgba(251,191,36,.15); border-color:rgba(251,191,36,.4); }
      .br-refresh-ic{
        font-size:15px; font-weight:900; line-height:1; color:#FBBF24;
        transition:transform .6s cubic-bezier(.4,0,.2,1);
      }
      .br-refresh.spin .br-refresh-ic{ transform:rotate(720deg); }

      /* Meta strip — wallet + room count */
      .br-meta{
        display:flex; align-items:center; gap:10px;
        padding:10px 22px 12px; flex-shrink:0;
        font-size:11.5px; font-weight:700; color:rgba(255,255,255,.7);
        border-bottom:1px solid rgba(255,255,255,.05);
      }
      .br-meta b{ color:#FDE68A; font-weight:900; }
      .br-meta-sep{ width:1px; height:12px; background:rgba(255,255,255,.18); }
      .br-meta-count{ margin-left:auto; color:rgba(255,255,255,.55); }

      /* List */
      .br-list{
        flex:1; overflow-y:auto; padding:10px 14px 14px;
        display:flex; flex-direction:column; gap:7px;
        scrollbar-width:thin; scrollbar-color:rgba(251,191,36,.45) transparent;
      }
      .br-list::-webkit-scrollbar{ width:5px; }
      .br-list::-webkit-scrollbar-thumb{
        background:linear-gradient(180deg, rgba(251,191,36,.5), rgba(251,191,36,.18));
        border-radius:5px;
      }

      .br-row{
        display:flex; align-items:center; gap:12px;
        padding:11px 12px; border-radius:14px;
        background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.015));
        border:1px solid rgba(255,255,255,.07);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
        transition:transform .18s cubic-bezier(.2,.7,.3,1.4),
                   background .2s, border-color .2s, box-shadow .2s;
      }
      .br-row:hover:not(.locked){
        transform:translateX(-2px);
        background:linear-gradient(180deg, rgba(251,191,36,.10), rgba(251,191,36,.02));
        border-color:rgba(251,191,36,.30);
        box-shadow:0 4px 14px rgba(0,0,0,.35), 0 0 14px rgba(251,191,36,.22);
      }
      .br-row.locked{ opacity:.55; filter:saturate(.6); }

      .br-row-av{
        flex:0 0 42px; width:42px; height:42px; border-radius:50%;
        background-size:cover; background-position:center;
        background:linear-gradient(180deg, #312E81 0%, #1E1B4B 100%);
        border:1.5px solid rgba(167,139,250,.4);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.15), 0 2px 6px rgba(0,0,0,.4);
        display:flex; align-items:center; justify-content:center;
        font-family:'Bangers','Outfit',sans-serif;
        font-size:18px; letter-spacing:.5px; color:#EDE9FE;
        text-shadow:0 1px 2px rgba(0,0,0,.5);
      }
      .br-row-av-letter{ background:linear-gradient(180deg, #7C3AED 0%, #4C1D95 100%); }

      .br-row-text{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
      .br-row-name{
        font-weight:800; font-size:13.5px; color:#fff;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        letter-spacing:.2px;
        display:flex; align-items:center; gap:7px;
      }
      .br-row-host{ color:rgba(255,255,255,.78); font-weight:700; font-size:12.5px; overflow:hidden; text-overflow:ellipsis; }
      /* Game-type chip — instantly tells the player WHAT they're joining. */
      .br-row-type{
        flex-shrink:0; display:inline-flex; align-items:center; gap:4px;
        padding:3px 9px; border-radius:99px;
        font-size:10.5px; font-weight:900; letter-spacing:.4px;
        border:1px solid transparent;
      }
      .br-row-type-cls    { background:rgba(232,50,74,.16);  border-color:rgba(232,50,74,.40);  color:#FCA5A5; }
      .br-row-type-fun    { background:rgba(249,115,22,.16); border-color:rgba(249,115,22,.40); color:#FDBA74; }
      .br-row-type-chill  { background:rgba(6,182,212,.16);  border-color:rgba(6,182,212,.40);  color:#67E8F9; }
      .br-row-type-ranked { background:linear-gradient(180deg,rgba(251,191,36,.22),rgba(251,191,36,.06)); border-color:rgba(251,191,36,.55); color:#FCD34D; }
      .br-row-type-ronda  { background:rgba(34,197,94,.16);  border-color:rgba(34,197,94,.40);  color:#86EFAC; }
      .br-row-type-tba9   { background:rgba(168,85,247,.16); border-color:rgba(168,85,247,.40); color:#D8B4FE; }
      .br-row-type-dama   { background:rgba(180,131,9,.18);  border-color:rgba(180,131,9,.45);  color:#E5C07B; }
      .br-row-meta{
        display:flex; align-items:center; gap:7px;
        font-size:11px; font-weight:600; color:rgba(255,255,255,.5);
      }
      .br-row-dot{ width:3px; height:3px; border-radius:50%; background:rgba(255,255,255,.3); }
      .br-row-players{ color:#86EFAC; font-weight:700; }

      .br-row-bet{
        flex-shrink:0;
        display:inline-flex; align-items:center; gap:5px;
        padding:5px 10px; border-radius:99px;
        background:linear-gradient(180deg, rgba(251,191,36,.18), rgba(251,191,36,.04));
        border:1px solid rgba(251,191,36,.30);
        font-size:11px; font-weight:800; color:#FDE68A;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.12);
      }
      .br-row-bet b{
        font-family:'Bangers','Outfit',sans-serif;
        font-size:14px; font-weight:400; letter-spacing:.4px;
        background:linear-gradient(180deg, #FFFBEB 0%, #FBBF24 100%);
        -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
      }
      .br-row-bet-lbl{
        font-size:9px; font-weight:900; letter-spacing:1.2px;
        color:rgba(253,230,138,.7); text-transform:uppercase;
      }
      .br-row-bet-free{
        color:#86EFAC; border-color:rgba(74,222,128,.35);
        background:linear-gradient(180deg, rgba(74,222,128,.18), rgba(74,222,128,.04));
        font-weight:900; letter-spacing:1px;
      }

      .br-row-join{
        flex-shrink:0;
        padding:8px 16px; border-radius:10px; border:1px solid rgba(255,255,255,.18);
        background:
          linear-gradient(180deg, rgba(255,255,255,.20) 0%, rgba(255,255,255,0) 60%),
          linear-gradient(180deg, #F43F5E 0%, #B91C2C 100%);
        color:#fff; font-family:'Outfit',sans-serif;
        font-size:11.5px; font-weight:900; letter-spacing:1.2px;
        cursor:pointer;
        box-shadow:0 4px 10px rgba(232,50,74,.45),
                   inset 0 1px 0 rgba(255,255,255,.35);
        transition:transform .18s, filter .15s, box-shadow .2s;
      }
      .br-row-join:hover:not(:disabled){
        transform:translateY(-1px); filter:brightness(1.08);
        box-shadow:0 6px 14px rgba(232,50,74,.55),
                   0 0 12px rgba(244,63,94,.4),
                   inset 0 1px 0 rgba(255,255,255,.4);
      }
      .br-row-join:active{ transform:scale(.96); }
      .br-row-join.locked, .br-row-join:disabled{
        background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.2));
        color:rgba(255,255,255,.55);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.08);
        cursor:not-allowed;
      }

      /* Empty state */
      .br-empty{
        text-align:center; padding:42px 24px 28px;
        color:rgba(255,255,255,.55);
      }
      .br-empty-ic{ font-size:46px; margin-bottom:10px; opacity:.7; filter:drop-shadow(0 2px 6px rgba(0,0,0,.4)); }
      .br-empty-title{ font-size:14px; font-weight:800; color:rgba(255,255,255,.78); margin-bottom:4px; }
      .br-empty-sub{ font-size:11.5px; font-weight:600; line-height:1.45; color:rgba(255,255,255,.45); }

      @media (max-width:520px){
        .br-toolbar{ flex-wrap:wrap; }
        .br-search-wrap{ flex:1 1 100%; order:0; }
        .br-filter{ order:1; }
        .br-refresh{ order:2; margin-left:auto; }
        .br-row{ padding:10px; gap:10px; }
        .br-row-av{ flex:0 0 36px; width:36px; height:36px; font-size:15px; }
        .br-row-bet{ padding:4px 8px; font-size:10px; }
        .br-row-bet b{ font-size:13px; }
        .br-row-join{ padding:7px 12px; font-size:10.5px; }
      }
    `;
    document.head.appendChild(s);
  }
