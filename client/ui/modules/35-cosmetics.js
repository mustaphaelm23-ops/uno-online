  /* ═══════════════ COSMETICS — card backs + table felts ═══════════════
     Lightweight client controller for the cosmetics shop. Three jobs:
       1. Apply the equipped card back / felt as CSS variables on <body>
          so the render layer (opponent stacks, deck, ucard.cardback,
          game-screen bg) reads them from one place.
       2. Build + manage the cosmetics modal (browse, equip, buy).
       3. Listen for `cosmetics:unlocked` socket events and pop a toast
          when a new card back / felt drops (tier-cross, achievement).
     ═══════════════════════════════════════════════════════════════════ */

  const Cosmetics = {
    cardBacks:  [],                          // catalog from /api/cosmetics
    tableFelts: [],
    damaBoards: [],
    avatars:    [],                          // premium shop avatars
    currency:   { coins: 0, diamonds: 0 },
    activeTab:  'cardBacks',                 // 'cardBacks' | 'tableFelts' | 'damaBoards'

    /* ── apply current equip to <body> as CSS vars ── */
    apply(user){
      if(!user) return;
      const cb = this.cardBacks.find(c => c.id === user.equippedCardBack);
      const tf = this.tableFelts.find(c => c.id === user.equippedTableFelt);
      const db = this.damaBoards.find(c => c.id === user.equippedDamaBoard);
      // Use locally-known art if the catalog is cached; otherwise the
      // user record itself doesn't carry the art string, so we just set
      // fallback flat colors and hydrate properly after /api/cosmetics.
      if(cb?.art) document.body.style.setProperty('--cb-art', cb.art);
      if(tf?.art) document.body.style.setProperty('--tf-art', tf.art);
      if(db?.art) document.body.style.setProperty('--db-art', db.art);
      if(cb?.accent) document.body.style.setProperty('--cb-accent', cb.accent);
      if(tf?.accent) document.body.style.setProperty('--tf-accent', tf.accent);
      if(db?.accent) document.body.style.setProperty('--db-accent', db.accent);
    },

    // Apply a SPECIFIC table felt by id (used by spectators so the table they
    // watch is the WATCHED player's felt, not the spectator's own).
    applyFeltId(feltId){
      if(!feltId) return false;
      const tf = (this.tableFelts || []).find(c => c.id === feltId);
      if(!tf?.art) return false;
      document.body.style.setProperty('--tf-art', tf.art);
      if(tf.accent) document.body.style.setProperty('--tf-accent', tf.accent);
      return true;
    },

    /* ── fetch catalog + owned + currency ── */
    async load(){
      try{
        const d = await apiFetch('/api/cosmetics');
        console.log('[Cosmetics] loaded', {
          cardBacks:  d.cardBacks?.length || 0,
          tableFelts: d.tableFelts?.length || 0,
          damaBoards: d.damaBoards?.length || 0,
        });
        this.cardBacks  = d.cardBacks  || [];
        this.tableFelts = d.tableFelts || [];
        this.damaBoards = d.damaBoards || [];
        this.avatars    = d.avatars    || [];
        this.currency   = d.currency   || { coins:0, diamonds:0 };
        this.lastError  = null;
        this.apply(S.user);                  // re-apply with full art now
        return d;
      }catch(e){
        // Most common cause: node server hasn't been restarted since the
        // /api/cosmetics endpoint shipped. Surface that as a friendly
        // banner instead of leaving the user staring at "no items".
        console.warn('[Cosmetics] load failed', e);
        this.lastError = e?.status === 404
          ? 'Server out of date — please restart node (cosmetics endpoint missing).'
          : (e?.message || 'Could not reach the cosmetics server.');
        return null;
      }
    },

    /* ── modal entry — now routes through the Shop modal so Cosmetics
       live alongside Coins / Diamonds / Convert under one roof. ── */
    open(initialTab){
      _ensureCosmeticsStyles();
      const allowed = new Set(['cardBacks','tableFelts','damaBoards']);
      const tab = allowed.has(initialTab) ? initialTab : 'cardBacks';
      if(typeof Shop !== 'undefined' && Shop?.open){
        Shop.open(tab);
      }
    },
    _ensureStyles(){ _ensureCosmeticsStyles(); },
    close(){
      if(typeof Shop !== 'undefined' && Shop?.close) Shop.close();
    },
    switchTab(tab){
      if(typeof Shop !== 'undefined' && Shop?.switchTab) Shop.switchTab(tab);
    },

    async equip(type, id){
      try{
        const r = await apiFetch('/api/cosmetics/equip', {
          method:'POST',
          body: JSON.stringify({ type, id }),
        });
        if(r?.success && S.user){
          if(type === 'cardBack')  S.user.equippedCardBack  = r.equippedCardBack;
          if(type === 'tableFelt') S.user.equippedTableFelt = r.equippedTableFelt;
          if(type === 'damaBoard') S.user.equippedDamaBoard = r.equippedDamaBoard;
          try{ localStorage.setItem('uno_user', JSON.stringify(S.user)); }catch(e){}
          // Mark items in our local catalog for instant re-render.
          const list = type === 'cardBack' ? this.cardBacks
                     : type === 'tableFelt' ? this.tableFelts
                     : this.damaBoards;
          list.forEach(i => { i.equipped = (i.id === id); });
          this.apply(S.user);
          this._render();
          toast('✓ Equipped','s');
        }
      }catch(e){ toast(e?.message || 'Could not equip','e'); }
    },

    /* ── equip a premium avatar (sets user.avatar by image src) ── */
    async equipAvatar(src){
      const prev = S.user?.avatar;
      if(S.user){ S.user.avatar = src; try{ localStorage.setItem('uno_user', JSON.stringify(S.user)); }catch(e){} }
      this._refreshAvatarUI();
      try{
        await apiFetch('/api/profile/avatar', { method:'POST', body: JSON.stringify({ avatar: src }) });
        this.avatars.forEach(a => { a.equipped = (a.src === src); });
        if(typeof Shop !== 'undefined' && Shop.activeTab === 'avatars') Shop._renderBody();
        toast('✓ Avatar equipped','s');
      }catch(e){
        if(S.user){ S.user.avatar = prev; try{ localStorage.setItem('uno_user', JSON.stringify(S.user)); }catch(_){} }
        this._refreshAvatarUI();
        toast(e?.message || 'Could not equip avatar','e');
      }
    },

    /* ── toggle an avatar Collection favourite (⭐) ── */
    async toggleFavorite(id){
      const av = this.avatars.find(a => a.id === id);
      if(!av) return;
      const on = !av.favorite;
      av.favorite = on;                       // optimistic
      try{
        await apiFetch('/api/avatars/favorite', { method:'POST', body: JSON.stringify({ id, on }) });
      }catch(e){
        av.favorite = !on;                    // roll back
        toast(e?.message || 'Could not update favorite','e');
      }
    },

    /* ── toggle a card-back / felt / board favourite (⭐) ── */
    async toggleCosmeticFavorite(type, id){
      const list = type === 'cardBack' ? this.cardBacks
                 : type === 'tableFelt' ? this.tableFelts
                 : this.damaBoards;
      const item = list.find(i => i.id === id);
      if(!item) return;
      const on = !item.favorite;
      item.favorite = on;                     // optimistic
      try{
        await apiFetch('/api/cosmetics/favorite', { method:'POST', body: JSON.stringify({ type, id, on }) });
      }catch(e){
        item.favorite = !on;                  // roll back
        toast(e?.message || 'Could not update favorite','e');
      }
    },

    // Repaint the topbar + hero avatar chips with the current S.user.avatar.
    _refreshAvatarUI(){
      const src = S.user?.avatar;
      ['profileAvatar','heroAvatar'].forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        if(typeof src === 'string' && /^(\/|data:|https?:)/i.test(src)){
          el.classList.add('has-img');
          el.style.backgroundImage = `url('${src}')`;
          el.textContent = '';
        } else if(src){
          el.classList.remove('has-img');
          el.style.backgroundImage = '';
          el.textContent = src;
        }
      });
    },

    async buy(id){
      try{
        const r = await apiFetch('/api/cosmetics/buy', {
          method:'POST',
          body: JSON.stringify({ id }),
        });
        if(r?.success && S.user){
          S.user.coins    = r.coins    ?? S.user.coins;
          S.user.diamonds = r.diamonds ?? S.user.diamonds;
          this.currency = { coins: r.coins, diamonds: r.diamonds };
          // Refresh currency chips everywhere — header pills AND the shop's
          // own live balance bar — so the spend shows up the instant you buy.
          if(typeof _animateCount === 'function'){
            _animateCount('hcoins',  S.user.coins);
            _animateCount('scoins',  S.user.coins);
            _animateCount('heroCoins', S.user.coins);
            _animateCount('hdiamonds', S.user.diamonds);
            _animateCount('shopBalCoins',    S.user.coins);
            _animateCount('shopBalDiamonds', S.user.diamonds);
          }
          // ── Avatars: owned by id, equipped by src (own equip path) ──
          if(r.type === 'avatar'){
            S.user.ownedAvatars = r.owned;
            const av = this.avatars.find(i => i.id === id);
            if(av) av.owned = true;
            try{ localStorage.setItem('uno_user', JSON.stringify(S.user)); }catch(e){}
            this.equipAvatar(r.src);   // auto-equip the freshly bought avatar
            return;
          }
          if(r.type === 'cardBack')  S.user.ownedCardBacks  = r.owned;
          if(r.type === 'tableFelt') S.user.ownedTableFelts = r.owned;
          if(r.type === 'damaBoard') S.user.ownedDamaBoards = r.owned;
          try{ localStorage.setItem('uno_user', JSON.stringify(S.user)); }catch(e){}
          // Update local catalog so the row flips from "Buy" to "Equip".
          const list = r.type === 'cardBack' ? this.cardBacks
                     : r.type === 'tableFelt' ? this.tableFelts
                     : this.damaBoards;
          const item = list.find(i => i.id === id);
          if(item) item.owned = true;
          // Auto-equip the freshly purchased item.
          this.equip(r.type, id);
        }
      }catch(e){
        const need = e?.payload?.need;
        const have = e?.payload?.have;
        toast(e?.message + (need ? ` (have ${have})` : ''), 'e');
      }
    },

    /* ── socket: server pushed a drop after a tier/achievement ── */
    bindSocketEvents(sk){
      if(!sk) return;
      sk.on('cosmetics:unlocked', ({ items } = {}) => {
        (items || []).forEach(it => {
          // Refresh local owned list so the modal renders it as owned.
          if(it.type === 'cardBack' && S.user){
            S.user.ownedCardBacks = [...new Set([...(S.user.ownedCardBacks||[]), it.id])];
          } else if(it.type === 'tableFelt' && S.user){
            S.user.ownedTableFelts = [...new Set([...(S.user.ownedTableFelts||[]), it.id])];
          } else if(it.type === 'damaBoard' && S.user){
            S.user.ownedDamaBoards = [...new Set([...(S.user.ownedDamaBoards||[]), it.id])];
          }
          try{ localStorage.setItem('uno_user', JSON.stringify(S.user||{})); }catch(e){}
          // TABLE rewards get the full celebration popup (queued, one at a
          // time — a placement finish can drop several tiers at once).
          // Other cosmetic types keep the light toast.
          if(it.type === 'tableFelt' && (it.unlock||{}).kind === 'tier'){
            this._rewardQueue.push(it);
            this._showNextReward();
          } else {
            const kind = it.type === 'cardBack' ? 'card back' : it.type === 'tableFelt' ? 'table felt' : 'dama board';
            toast(`${it.type === 'damaBoard' ? '⛂' : '🎴'} New ${kind} unlocked: ${it.name}`,'s');
          }
        });
      });
    },

    /* ── RANK-REWARD claim popup ── the big-game moment: you reached a tier,
       a table drops, a full celebration screen shows it and lets you equip it
       on the spot. Queued so multiple simultaneous drops show one by one. */
    _rewardQueue: [],
    _rewardShowing: false,
    _showNextReward(){
      if(this._rewardShowing) return;
      const it = this._rewardQueue.shift();
      if(!it) return;
      this._rewardShowing = true;
      this._ensureRewardStyles();
      document.getElementById('rankRewardOv')?.remove();
      const tierName = (it.unlock && it.unlock.tier) || '';
      const ov = document.createElement('div');
      ov.id = 'rankRewardOv'; ov.className = 'rrw-ov';
      ov.innerHTML = `
        <div class="rrw-card" style="--ac:${it.accent||'#FBBF24'}">
          <div class="rrw-eyebrow">🏆 RANK REWARD UNLOCKED</div>
          <div class="rrw-table" style="background:${(it.art||'').replace(/"/g,'&quot;')}"></div>
          <div class="rrw-name">${esc(it.name||'New Table')}</div>
          <div class="rrw-sub">You reached <b style="color:${it.accent||'#FBBF24'}">${esc(tierName)}</b> — this table is yours forever. 🎉</div>
          <div class="rrw-actions">
            <button class="rrw-btn rrw-btn-later" onclick="Cosmetics._closeReward()">Later</button>
            <button class="rrw-btn rrw-btn-equip" onclick="Cosmetics._equipReward('${esc(it.id)}')">🪑 EQUIP NOW</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      requestAnimationFrame(()=>ov.classList.add('show'));
      try{ if(typeof confetti==='function') confetti(); }catch(e){}
      try{ window._rankedFanfare && window._rankedFanfare('promo'); }catch(e){}
    },
    _closeReward(){
      const ov = document.getElementById('rankRewardOv');
      if(ov){ ov.classList.remove('show'); setTimeout(()=>ov.remove(), 250); }
      this._rewardShowing = false;
      setTimeout(()=>this._showNextReward(), 350);      // next drop in the queue
    },
    async _equipReward(id){
      try{
        await apiFetch('/api/cosmetics/equip', { method:'POST', body: JSON.stringify({ type:'tableFelt', id }), timeout: 8000 });
        if(S.user){ S.user.equippedTableFelt = id; try{ localStorage.setItem('uno_user', JSON.stringify(S.user)); }catch(e){} }
        toast('🪑 Table equipped — see you at your new arena!','s');
      }catch(e){ toast(e?.message || 'Could not equip','e'); }
      this._closeReward();
    },
    _ensureRewardStyles(){
      if(document.getElementById('rrwStyles')) return;
      const s = document.createElement('style'); s.id = 'rrwStyles';
      s.textContent = `
        .rrw-ov{ position:fixed; inset:0; z-index:9700; display:flex; align-items:center; justify-content:center;
          background:radial-gradient(ellipse at 50% 35%, rgba(72,36,108,.55), rgba(6,4,14,.94) 65%);
          backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); opacity:0; transition:opacity .3s ease; padding:16px; }
        .rrw-ov.show{ opacity:1; }
        .rrw-card{ width:min(430px,94vw); text-align:center; padding:22px 20px 18px; border-radius:22px; position:relative; overflow:hidden;
          background:linear-gradient(175deg, rgba(32,24,58,.98), rgba(13,10,24,.99));
          border:1px solid color-mix(in srgb, var(--ac) 55%, transparent);
          box-shadow:0 30px 90px rgba(0,0,0,.65), 0 0 44px color-mix(in srgb, var(--ac) 30%, transparent);
          transform:scale(.9) translateY(14px); transition:transform .35s cubic-bezier(.18,1.3,.4,1); }
        .rrw-ov.show .rrw-card{ transform:scale(1) translateY(0); }
        .rrw-eyebrow{ font-family:'Outfit',sans-serif; font-weight:900; font-size:11px; letter-spacing:2.4px; color:#FBBF24; margin-bottom:13px; }
        .rrw-table{ width:100%; aspect-ratio:16/9; border-radius:15px; border:1.5px solid color-mix(in srgb, var(--ac) 60%, transparent);
          box-shadow:0 12px 30px rgba(0,0,0,.55), 0 0 26px color-mix(in srgb, var(--ac) 25%, transparent);
          animation:rrwFloat 3.2s ease-in-out infinite; }
        @keyframes rrwFloat{ 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-6px) } }
        .rrw-name{ font-family:'Outfit',sans-serif; font-weight:900; font-size:23px; color:#fff; margin-top:14px; letter-spacing:.3px; }
        .rrw-sub{ font-size:12.5px; font-weight:600; color:rgba(255,255,255,.68); margin-top:5px; line-height:1.5; }
        .rrw-actions{ display:flex; gap:10px; justify-content:center; margin-top:17px; }
        .rrw-btn{ padding:13px 26px; border:none; border-radius:12px; cursor:pointer; font-family:'Outfit',sans-serif; font-weight:900; font-size:13.5px; letter-spacing:.6px; transition:transform .15s, box-shadow .2s; }
        .rrw-btn-equip{ color:#3A2606; background:linear-gradient(135deg,#FCD34D,#F59E0B); box-shadow:0 8px 22px rgba(245,158,11,.45); }
        .rrw-btn-equip:hover{ transform:translateY(-2px); box-shadow:0 11px 26px rgba(245,158,11,.55); }
        .rrw-btn-later{ color:#cbd5e1; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.15); }
        .rrw-btn-later:hover{ transform:translateY(-2px); background:rgba(255,255,255,.12); }
      `;
      document.head.appendChild(s);
    },

    /* ── render ── */
    _render(){
      const body = document.getElementById('cosmeticsBody');
      if(!body) return;
      const isCB = this.activeTab === 'cardBacks';
      const list = isCB ? this.cardBacks : this.tableFelts;
      const tabs = `
        <div class="csm-tabs">
          <button class="csm-tab ${isCB?'on':''}" onclick="Cosmetics.switchTab('cardBacks')">🎴 Card Backs</button>
          <button class="csm-tab ${!isCB?'on':''}" onclick="Cosmetics.switchTab('tableFelts')">🟩 Table Felts</button>
        </div>`;
      const currency = `
        <div class="csm-currency">
          <span>🪙 ${(this.currency.coins||0).toLocaleString()}</span>
          <span>💎 ${(this.currency.diamonds||0).toLocaleString()}</span>
        </div>`;
      const items = list.length
        ? list.map(item => this._renderItem(item, isCB ? 'cardBack' : 'tableFelt')).join('')
        : `<div class="csm-empty">Loading…</div>`;
      body.innerHTML = `${tabs}${currency}<div class="csm-grid">${items}</div>`;
    },

    _renderItem(item, type){
      const locked   = !item.owned;
      const equipped = !!item.equipped;
      const u        = item.unlock || {};
      // Status label + action button
      let statusLabel = '';
      let actionBtn   = '';
      if(equipped){
        statusLabel = `<span class="csm-status csm-status-on">✓ Equipped</span>`;
      } else if(item.owned){
        statusLabel = `<span class="csm-status">Owned</span>`;
        actionBtn   = `<button class="csm-btn csm-btn-equip" onclick="Cosmetics.equip('${type}','${item.id}')">Equip</button>`;
      } else if(u.kind === 'shop'){
        const cur = u.currency === 'diamonds' ? '💎' : '🪙';
        statusLabel = `<span class="csm-status csm-status-shop">${cur} ${u.price.toLocaleString()}</span>`;
        actionBtn   = `<button class="csm-btn csm-btn-buy" onclick="Cosmetics.buy('${item.id}')">Buy</button>`;
      } else if(u.kind === 'tier'){
        statusLabel = `<span class="csm-status csm-status-lock">🔒 Reach ${u.tier}</span>`;
      } else if(u.kind === 'achievement'){
        statusLabel = `<span class="csm-status csm-status-lock">🔒 Achievement</span>`;
      } else if(u.kind === 'season'){
        statusLabel = `<span class="csm-status csm-status-event">🎉 Event: ${u.event}</span>`;
      }
      const rarityCls = `csm-rarity-${item.rarity || 'common'}`;
      const thumbStyle = type === 'cardBack'
        ? `background:${item.art};`
        : `background:${item.art}; border-radius:14px;`;
      return `
        <div class="csm-card ${rarityCls} ${locked?'csm-locked':''} ${equipped?'csm-equipped':''}">
          <div class="csm-thumb ${type === 'cardBack' ? 'csm-thumb-cb' : 'csm-thumb-tf'}" style="${thumbStyle}"></div>
          <div class="csm-name">${esc(item.name)}</div>
          <div class="csm-status-row">${statusLabel}</div>
          ${actionBtn}
        </div>`;
    },
  };
  window.Cosmetics = Cosmetics;
  // Dev preview — run `_previewRankReward()` (or ('Diamond') etc.) in the
  // console to see the rank-table claim popup without ranking up.
  window._previewRankReward = function(tier){
    const t = tier || 'Gold';
    const felt = (Cosmetics.tableFelts || []).find(f => (f.unlock||{}).kind==='tier' && f.unlock.tier===t)
      || { id:'tf_rank_gold', name:t+' Arena', accent:'#FFD700', unlock:{kind:'tier',tier:t}, art:"linear-gradient(160deg,#3a2b09,#141005)" };
    Cosmetics._rewardQueue.push(felt);
    Cosmetics._showNextReward();
  };

  /* ═══════════════ THE VAULT — unified Collection ═══════════════
     One tidy home for everything the player owns or can earn, split by
     category (Avatars · Cards · Tables · Boards), each with Owned /
     ★ Favorites / 🔒 Locked tabs. Reads the already-loaded Cosmetics data,
     equips/buys/favourites through the existing Cosmetics methods. Nothing
     is mixed — every category and state has its own view. */
  const Collection = {
    cat: 'avatars',    // avatars | cardBacks | tableFelts | damaBoards
    sub: 'owned',      // owned | favorites | locked

    _cats(){
      return [
        { id:'avatars',    label:'Avatars', icon:'🧑', data:Cosmetics.avatars||[],    type:'avatar' },
        { id:'cardBacks',  label:'Cards',   icon:'🎴', data:Cosmetics.cardBacks||[],  type:'cardBack' },
        { id:'tableFelts', label:'Tables',  icon:'🟩', data:Cosmetics.tableFelts||[], type:'tableFelt' },
        { id:'damaBoards', label:'Boards',  icon:'⛂', data:Cosmetics.damaBoards||[], type:'damaBoard' },
      ];
    },

    async open(cat){
      _ensureCollectionStyles();
      this.cat = cat || 'avatars';
      this.sub = 'owned';
      let ov = document.getElementById('collectionOv');
      if(ov) ov.remove();
      ov = document.createElement('div');
      ov.id = 'collectionOv';
      ov.className = 'col-ov';
      ov.innerHTML = `<div class="col-panel"><div class="col-loading">Loading your vault…</div></div>`;
      document.body.appendChild(ov);
      requestAnimationFrame(()=> ov.classList.add('show'));
      // Hydrate the catalog if the modal is opened before background load.
      if(!(Cosmetics.avatars||[]).length || !(Cosmetics.cardBacks||[]).length){
        await Cosmetics.load();
      }
      this._render();
    },
    close(){
      this._stopSparks();
      const ov = document.getElementById('collectionOv');
      if(!ov) return;
      ov.classList.remove('show');
      setTimeout(()=> ov.remove(), 200);
    },
    setCat(c){ this.cat = c; this.sub = 'owned'; this._render(); },
    setSub(s){ this.sub = s; this._render(); },

    _render(){
      const ov = document.getElementById('collectionOv'); if(!ov) return;
      const cats = this._cats();
      const active = cats.find(c => c.id === this.cat) || cats[0];
      const data = active.data || [];
      const owned  = data.filter(i => i.owned);
      const fav    = owned.filter(i => i.favorite);
      const locked = data.filter(i => !i.owned);
      const list = this.sub === 'favorites' ? fav : this.sub === 'locked' ? locked : owned;

      const catTabs = cats.map(c => {
        const n = (c.data||[]).filter(i => i.owned).length;
        return `<button class="col-cat ${c.id===this.cat?'on':''}" data-cat="${c.id}">
          <span class="col-cat-ic">${c.icon}</span><span class="col-cat-lb">${c.label}</span><span class="col-cat-n">${n}</span>
        </button>`;
      }).join('');
      const subBtn = (id,label,n) => `<button class="col-sub ${this.sub===id?'on':''}" data-sub="${id}">${label} <b>${n}</b></button>`;
      const subTabs = subBtn('owned','Owned',owned.length) + subBtn('favorites','★ Favorites',fav.length) + subBtn('locked','🔒 Locked',locked.length);

      const tiles = list.length
        ? list.map(it => this._tile(active, it)).join('')
        : `<div class="col-empty">${this.sub==='favorites'
            ? 'No favorites here yet — tap ☆ on an item to pin it.'
            : this.sub==='locked'
              ? 'You own everything in this category! 🎉'
              : 'Nothing owned here yet — check Locked or the Shop.'}</div>`;

      ov.innerHTML = `
        <div class="col-panel">
          <div class="col-fx" aria-hidden="true"><div class="col-fx-aura"></div><div class="col-fx-sparks" id="colSparks"></div></div>
          <button class="col-x" aria-label="Close">×</button>
          <div class="col-cats">${catTabs}</div>
          <div class="col-subs">${subTabs}</div>
          <div class="col-grid col-grid-${active.type}">${tiles}</div>
        </div>`;

      ov.querySelector('.col-x').addEventListener('click', ()=> this.close());
      ov.addEventListener('mousedown', e=>{ if(e.target===ov) this.close(); });
      ov.querySelectorAll('.col-cat').forEach(b => b.addEventListener('click', ()=> this.setCat(b.dataset.cat)));
      ov.querySelectorAll('.col-sub').forEach(b => b.addEventListener('click', ()=> this.setSub(b.dataset.sub)));
      ov.querySelectorAll('.col-fav').forEach(b => b.addEventListener('click', async e=>{
        e.stopPropagation();
        await this._toggleFav(active.type, b.dataset.id);
        this._render();
      }));
      ov.querySelectorAll('.col-card').forEach(b => b.addEventListener('click', ()=> this._onCardClick(active, b.dataset.id)));
      this._startSparks();
    },

    // Rising treasure-sparkle layer — makes the vault feel alive + exciting.
    _startSparks(){
      this._stopSparks();
      if(document.body.classList.contains('mobile-lite')) return;
      if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
      this._sparkTimer = setInterval(()=>{
        const host = document.getElementById('colSparks'); if(!host) return;
        if(host.childElementCount > 22) return;
        const e = document.createElement('div');
        e.className = 'col-spark';
        const dur = 3.5 + Math.random()*2.6, sz = 3 + Math.random()*4;
        e.style.left = (Math.random()*100)+'%';
        e.style.width = e.style.height = sz+'px';
        e.style.setProperty('--sx', (Math.random()*54-27)+'px');
        e.style.animationDuration = dur+'s';
        host.appendChild(e);
        setTimeout(()=>{ try{ e.remove(); }catch(_){} }, dur*1000+250);
      }, 300);
    },
    _stopSparks(){
      if(this._sparkTimer){ clearInterval(this._sparkTimer); this._sparkTimer = null; }
      const h = document.getElementById('colSparks'); if(h) h.innerHTML = '';
    },

    _tile(cat, item){
      const u = item.unlock || {};
      let thumb;
      if(cat.type === 'avatar'){
        // Use a real <img> (not a background-image div) — on iOS Safari a div
        // with a background-image + fixed px height collapsed to a sliver.
        thumb = `<img class="col-thumb col-thumb-av" src="${item.src}" alt="" loading="lazy" width="96" height="96">`;
      } else if(cat.type === 'damaBoard'){
        thumb = `<div class="col-thumb col-thumb-db"><div class="col-thumb-db-in" style="background:${item.art}"></div></div>`;
      } else {
        thumb = `<div class="col-thumb col-thumb-${cat.type==='cardBack'?'cb':'tf'}" style="background:${item.art}"></div>`;
      }
      let status;
      if(item.equipped)             status = `<span class="col-status on">✓ Equipped</span>`;
      else if(item.owned)           status = `<span class="col-status">Tap to equip</span>`;
      else if(u.kind === 'shop'){ const cur = u.currency==='diamonds'?'💎':'🪙'; status = `<span class="col-status buy">${cur} ${(u.price||0).toLocaleString()}</span>`; }
      else if(u.kind === 'tier')        status = `<span class="col-status lock">🔒 ${esc(u.tier)}</span>`;
      else if(u.kind === 'achievement') status = `<span class="col-status lock">🔒 Achievement</span>`;
      else if(u.kind === 'season')      status = `<span class="col-status lock">🎉 ${esc(u.event||'Event')}</span>`;
      else                              status = `<span class="col-status lock">🔒 Locked</span>`;
      const star = item.owned ? `<span class="col-fav ${item.favorite?'on':''}" data-id="${item.id}">${item.favorite?'★':'☆'}</span>` : '';
      const rarity = item.rarity || 'common';
      return `
        <div class="col-card rar-${rarity} ${item.owned?'':'locked'} ${item.equipped?'equipped':''}" data-id="${item.id}">
          ${star}
          ${thumb}
          <div class="col-name">${esc(item.name)}</div>
          <div class="col-status-row">${status}</div>
        </div>`;
    },

    async _onCardClick(cat, id){
      const item = (cat.data||[]).find(i => i.id === id); if(!item) return;
      if(item.owned){
        if(cat.type === 'avatar') await Cosmetics.equipAvatar(item.src);
        else                      await Cosmetics.equip(cat.type, id);
        (cat.data||[]).forEach(i => { i.equipped = (i.id === id); });
        this._render();
      } else if((item.unlock||{}).kind === 'shop'){
        await Cosmetics.buy(id);     // buy → auto-equips → owned
        this._render();
      } else {
        toast('🔒 Earn this through ranked play or achievements','i');
      }
    },

    async _toggleFav(type, id){
      if(type === 'avatar') await Cosmetics.toggleFavorite(id);
      else                  await Cosmetics.toggleCosmeticFavorite(type, id);
    },
  };
  window.Collection = Collection;
  function showCollection(cat){ Collection.open(cat); }
  window.showCollection = showCollection;

  function _ensureCollectionStyles(){
    if(document.getElementById('collectionStyles')) return;
    const s = document.createElement('style');
    s.id = 'collectionStyles';
    s.textContent = `
      .col-ov{
        position:fixed; inset:0; z-index:1300; display:flex; align-items:center; justify-content:center;
        padding:18px; opacity:0; transition:opacity .2s;
        background:radial-gradient(ellipse at 50% 35%, rgba(30,20,50,.55), rgba(4,6,14,.92));
        backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
      }
      .col-ov.show{ opacity:1; }
      .col-panel{
        width:min(760px,96vw); max-height:92vh; display:flex; flex-direction:column;
        padding:22px; border-radius:22px; position:relative; overflow:hidden;
        background:linear-gradient(180deg, rgba(28,32,56,.98), rgba(14,18,32,.99));
        border:1px solid rgba(255,255,255,.09);
        box-shadow:0 40px 100px rgba(0,0,0,.75); color:#fff; font-family:'Outfit',sans-serif;
      }
      .col-x{
        position:absolute; top:14px; right:16px; width:34px; height:34px; border-radius:50%;
        background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12);
        color:rgba(255,255,255,.7); font-size:20px; cursor:pointer; line-height:1; z-index:3;
      }
      .col-x:hover{ background:rgba(232,50,74,.25); color:#fff; }
      .col-eyebrow{ font-size:11px; font-weight:900; letter-spacing:2.6px; color:#A78BFA; }
      .col-title{ font-family:'Bangers',cursive; font-size:30px; letter-spacing:2px; color:#FFE9B0; line-height:1.05; margin-bottom:12px; }
      .col-cats{ display:flex; gap:8px; flex-wrap:wrap; flex:0 0 auto; padding-right:42px; }
      .col-cat{
        flex:1 1 0; min-width:120px; display:flex; align-items:center; gap:8px;
        padding:10px 12px; border-radius:13px; cursor:pointer; font-family:inherit;
        background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); color:rgba(255,255,255,.8);
        transition:all .18s;
      }
      .col-cat.on{ background:linear-gradient(135deg,#7C3AED,#4F46E5); border-color:transparent; color:#fff; box-shadow:0 8px 22px rgba(99,102,241,.4); }
      .col-cat-ic{ font-size:18px; }
      .col-cat-lb{ font-weight:800; font-size:13px; letter-spacing:.4px; }
      .col-cat-n{ margin-left:auto; font-size:11px; font-weight:900; opacity:.7; background:rgba(0,0,0,.25); padding:1px 8px; border-radius:99px; }
      .col-subs{ display:flex; gap:6px; margin:14px 0 12px; flex:0 0 auto; }
      .col-sub{
        flex:1; padding:9px; border-radius:11px; cursor:pointer; font-family:inherit;
        background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); color:rgba(255,255,255,.7);
        font-weight:800; font-size:12px; letter-spacing:.3px;
      }
      .col-sub b{ opacity:.6; }
      .col-sub.on{ background:linear-gradient(135deg,#FBBF24,#D97706); color:#1a1a1a; border-color:transparent; }
      .col-sub.on b{ opacity:.85; }
      .col-grid{
        display:grid; gap:14px; overflow-y:auto; flex:1 1 auto; min-height:0; padding:4px 2px 2px;
        grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));
        /* Force tall-enough rows so a card never clips its thumbnail.
           (Auto rows were collapsing and cropping avatars to half-circles.) */
        grid-auto-rows:minmax(168px, auto);
        align-items:stretch;
      }
      .col-grid::-webkit-scrollbar{ width:6px; }
      .col-grid::-webkit-scrollbar-thumb{ background:rgba(124,58,237,.4); border-radius:6px; }
      .col-card{
        position:relative; padding:12px 12px 10px; border-radius:16px; text-align:center; cursor:pointer;
        display:flex; flex-direction:column; align-items:center; justify-content:flex-start;
        background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
        border:1.5px solid rgba(255,255,255,.08); transition:transform .18s, border-color .18s, box-shadow .18s;
      }
      /* Rarity colour stripes removed per user request — cleaner, calmer look. */
      .col-card:hover{ transform:translateY(-3px); border-color:rgba(255,255,255,.2); box-shadow:0 14px 30px rgba(0,0,0,.5); }
      .col-card.equipped{ border-color:#22C55E; box-shadow:0 0 0 1px #22C55E, 0 10px 24px rgba(34,197,94,.25); }
      .col-card.locked{ opacity:.82; }
      .col-card.locked .col-thumb{ filter:saturate(.45) brightness(.8); }
      .col-fav{ position:absolute; top:7px; right:9px; z-index:4; font-size:15px; color:rgba(255,255,255,.5); cursor:pointer; text-shadow:0 1px 3px rgba(0,0,0,.7); transition:transform .15s, color .15s; }
      .col-fav:hover{ transform:scale(1.25); }
      .col-fav.on{ color:#FBBF24; }
      /* Explicit thumb sizes (aspect-ratio proved unreliable here and collapsed
         the avatars into slivers). Fixed width+height = always fully visible. */
      .col-thumb{ margin:0 auto 9px; background-size:cover; background-position:center; flex:0 0 auto; }
      .col-thumb-av{ width:96px; height:96px; object-fit:cover; display:block; border-radius:50%;
        border:none; box-shadow:0 6px 16px rgba(0,0,0,.5); }
      .col-thumb-cb{ width:80px; height:112px; border-radius:10px; border:2px solid rgba(0,0,0,.6);
        box-shadow:0 6px 16px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.35); }
      .col-thumb-tf{ width:128px; height:80px; border-radius:12px; border:2px solid rgba(0,0,0,.55);
        box-shadow:0 6px 16px rgba(0,0,0,.5), inset 0 0 0 5px rgba(255,215,130,.15); }
      .col-thumb-db{ width:96px; height:96px; border-radius:9px; padding:7px; position:relative;
        background:linear-gradient(160deg,#5B3014,#2E1505); box-shadow:0 6px 16px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,200,140,.2); }
      .col-thumb-db-in{ position:absolute; inset:7px; border-radius:4px; box-shadow:inset 0 0 14px rgba(0,0,0,.5); }
      .col-name{ font-weight:800; font-size:13px; color:#FFE9B0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:5px; }
      .col-status-row{ min-height:20px; }
      .col-status{ display:inline-block; padding:3px 10px; border-radius:99px; font-size:10.5px; font-weight:900; letter-spacing:.4px;
        background:rgba(255,255,255,.06); color:rgba(255,255,255,.7); }
      .col-status.on{ background:linear-gradient(135deg,#22C55E,#15803D); color:#fff; }
      .col-status.buy{ background:rgba(251,191,36,.18); color:#FBBF24; border:1px solid rgba(251,191,36,.4); }
      .col-status.lock{ background:rgba(255,255,255,.04); color:rgba(255,255,255,.5); }
      .col-empty{ grid-column:1/-1; text-align:center; color:rgba(255,255,255,.5); padding:40px 16px; font-size:13px; }
      .col-loading{ padding:60px; text-align:center; color:rgba(255,255,255,.5); font-weight:700; }

      /* ════════════ THE VAULT — WOW FX ════════════ */
      .col-fx{ position:absolute; inset:0; overflow:hidden; pointer-events:none; z-index:0; border-radius:22px; }
      .col-fx-aura{ position:absolute; left:50%; top:-12%; width:92%; height:360px; transform:translateX(-50%);
        background:radial-gradient(ellipse, rgba(245,158,11,.22), rgba(168,85,247,.10) 48%, transparent 72%);
        filter:blur(48px); animation:colAura 7s ease-in-out infinite; }
      @keyframes colAura{ 0%,100%{ opacity:.6; transform:translateX(-50%) scale(1); } 50%{ opacity:1; transform:translateX(-50%) scale(1.07); } }
      .col-fx-sparks{ position:absolute; inset:0; }
      .col-spark{ position:absolute; bottom:-12px; border-radius:50%;
        background:radial-gradient(circle at 40% 35%, #FFF6DC, #FBBF24 58%, rgba(251,191,36,0));
        box-shadow:0 0 9px rgba(251,191,36,.9); will-change:transform,opacity;
        animation:colSparkRise linear forwards; }
      @keyframes colSparkRise{ 0%{ transform:translate(0,0) scale(0); opacity:0 } 14%{ opacity:1; transform:scale(1) } 100%{ transform:translate(var(--sx,0),-400px) scale(.2); opacity:0 } }
      /* keep content above the fx */
      .col-cats, .col-subs, .col-grid{ position:relative; z-index:1; }
      /* Rarity GLOWS — rare blue, epic purple, legendary gold (legendary breathes). */
      .col-card.rar-rare{ border-color:rgba(59,130,246,.45); box-shadow:0 0 14px rgba(59,130,246,.2), 0 8px 20px rgba(0,0,0,.4); }
      .col-card.rar-epic{ border-color:rgba(168,85,247,.5); box-shadow:0 0 16px rgba(168,85,247,.26), 0 8px 20px rgba(0,0,0,.4); }
      .col-card.rar-legendary{ border-color:rgba(245,158,11,.55); animation:colLegPulse 2.6s ease-in-out infinite; }
      @keyframes colLegPulse{ 0%,100%{ box-shadow:0 0 14px rgba(245,158,11,.24), 0 8px 20px rgba(0,0,0,.4) } 50%{ box-shadow:0 0 28px rgba(245,158,11,.5), 0 8px 20px rgba(0,0,0,.4) } }
      .col-card:hover{ transform:translateY(-5px) scale(1.02); }
      /* equipped tile pulses a green aura. */
      .col-card.equipped{ animation:colEquipPulse 2s ease-in-out infinite; }
      @keyframes colEquipPulse{ 0%,100%{ box-shadow:0 0 0 1px #22C55E, 0 0 14px rgba(34,197,94,.3) } 50%{ box-shadow:0 0 0 1px #22C55E, 0 0 28px rgba(34,197,94,.55) } }

      @media (max-height:560px){
        .col-panel{ padding:14px; }
        .col-title{ font-size:22px; margin-bottom:8px; }
        .col-cat{ padding:8px 10px; min-width:96px; }
        .col-subs{ margin:8px 0; }
      }
      @media (max-width:520px){
        .col-cat{ min-width:0; flex-basis:46%; }
        .col-cat-n{ display:none; }
      }
    `;
    document.head.appendChild(s);
  }

  function _ensureCosmeticsStyles(){
    if(document.getElementById('cosmeticsStyles')) return;
    const s = document.createElement('style');
    s.id = 'cosmeticsStyles';
    s.textContent = `
      .csm-ov{
        position:fixed; inset:0; z-index:1200;
        display:none; align-items:center; justify-content:center;
        background:rgba(4,8,18,.7); backdrop-filter:blur(10px);
      }
      .csm-ov.show{ display:flex; }
      .csm-box{
        width:min(720px, 94vw); max-height:88vh; overflow-y:auto;
        padding:24px; border-radius:20px;
        background:linear-gradient(180deg, #1A2236 0%, #0E1525 100%);
        border:1px solid rgba(255,255,255,.08);
        box-shadow:0 30px 80px rgba(0,0,0,.7);
        color:#fff; font-family:'Outfit',sans-serif;
        position:relative;
      }
      .csm-x{
        position:absolute; top:14px; right:18px;
        background:none; border:none; color:rgba(255,255,255,.6);
        font-size:24px; cursor:pointer; line-height:1;
      }
      .csm-header{
        font-family:'Bangers',cursive; font-size:28px; letter-spacing:2.5px;
        margin-bottom:6px;
      }
      .csm-sub{ font-size:12px; color:rgba(255,255,255,.6); margin-bottom:14px; }
      .csm-tabs{ display:flex; gap:6px; margin-bottom:10px; }
      .csm-tab{
        flex:1; padding:10px; border-radius:10px;
        background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
        color:#fff; font-weight:700; cursor:pointer; font-size:12px;
        letter-spacing:1px;
      }
      .csm-tab.on{
        background:linear-gradient(135deg,#FBBF24,#D97706); color:#1A1A1A;
      }
      .csm-currency{
        display:flex; gap:14px; justify-content:flex-end;
        font-weight:800; font-size:13px; margin-bottom:14px;
        padding:8px 14px; border-radius:99px;
        background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06);
      }
      .csm-grid{
        display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr));
        gap:12px;
      }
      .csm-card{
        background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08);
        border-radius:14px; padding:12px; text-align:center;
        position:relative; transition:transform .15s, border-color .15s;
      }
      .csm-card:hover{ transform:translateY(-2px); border-color:rgba(251,191,36,.4); }
      .csm-card.csm-equipped{ border-color:#5dd75d; box-shadow:0 0 20px rgba(93,215,93,.3); }
      .csm-card.csm-locked .csm-thumb{ opacity:.45; filter:saturate(.5); }
      .csm-thumb{
        width:100%; aspect-ratio:5/7; border-radius:10px; margin-bottom:8px;
        border:2px solid rgba(255,255,255,.1);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.15);
      }
      .csm-thumb-tf{ aspect-ratio:5/3; }
      /* DAMA board thumbnail — square so the 8×8 checker pattern reads.
       * background-size is already set by the inline style's tiled gradient,
       * we just give it a square aspect + a subtle wooden frame. */
      .csm-thumb-db{
        aspect-ratio:1/1; border-radius:8px;
        border:3px solid #3F2410;
        box-shadow:inset 0 0 0 1px rgba(251,191,36,.25),
                   inset 0 0 14px rgba(0,0,0,.35),
                   0 4px 12px rgba(0,0,0,.45);
      }
      .csm-name{
        font-weight:800; font-size:13px; margin-bottom:5px;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .csm-status-row{ margin-bottom:8px; min-height:18px; }
      .csm-status{
        display:inline-block; padding:2px 8px; border-radius:99px;
        font-size:10px; font-weight:800; letter-spacing:.5px;
        background:rgba(255,255,255,.06); color:rgba(255,255,255,.65);
      }
      .csm-status-on{ background:rgba(93,215,93,.15); color:#5dd75d; }
      .csm-status-shop{ background:rgba(251,191,36,.12); color:#FBBF24; }
      .csm-status-lock{ background:rgba(255,255,255,.04); color:rgba(255,255,255,.45); }
      .csm-status-event{ background:rgba(244,114,182,.15); color:#F472B6; }
      .csm-btn{
        width:100%; padding:7px; border-radius:8px; border:none; cursor:pointer;
        font-weight:800; font-size:11px; letter-spacing:.8px;
      }
      .csm-btn-equip{ background:linear-gradient(135deg,#FBBF24,#D97706); color:#1A1A1A; }
      .csm-btn-buy{   background:linear-gradient(135deg,#5dd75d,#22C55E); color:#fff; }
      .csm-empty{ text-align:center; color:rgba(255,255,255,.5); padding:30px; }

      /* Rarity color stripe on top of card */
      .csm-rarity-common::before    { background:#6B7280; }
      .csm-rarity-rare::before      { background:#3B82F6; }
      .csm-rarity-epic::before      { background:#A855F7; }
      .csm-rarity-legendary::before { background:linear-gradient(90deg,#FBBF24,#F59E0B); }
      .csm-rarity-seasonal::before  { background:linear-gradient(90deg,#F472B6,#9F70FD); }
      .csm-card::before{
        content:''; position:absolute; left:14px; right:14px; top:0; height:2px;
        border-radius:0 0 2px 2px;
      }
    `;
    document.head.appendChild(s);
  }

  /* ── ALWAYS-ON in-game art styles ──────────────────────────────────────
     These paint the equipped table felt + card backs DURING a match. They
     MUST be injected at boot (not gated behind opening the shop), otherwise
     a player who rejoins a game without opening the shop sees the old
     hardcoded green table. Idempotent + injected immediately below. */
  function _ensureGameArtStyles(){
    if(document.getElementById('gameArtStyles')) return;
    const s = document.createElement('style');
    s.id = 'gameArtStyles';
    s.textContent = `
      /* My OWN chosen card back — shows on the shared deck / draw pile so I
         always see the design I bought while playing. */
      .ucard.cardback{
        background: var(--cb-art, linear-gradient(145deg,#E8324A 50%,#1A1D2E 50%)) !important;
        background-size: cover !important;
        background-position: center !important;
      }
      /* Kill the legacy red-oval + corner-dot overlay — it sat ON TOP of the
         actual card-back art. Now the deck shows the clean design only. */
      .ucard.cardback::before,
      .ucard.cardback::after{ display: none !important; }
      .opp-card-back{
        background: var(--cb-art, linear-gradient(145deg,#E8324A 50%,#1A1D2E 50%)) !important;
        background-size: cover !important;
      }
      #drawpile.with-cb{ background-image: var(--cb-art) !important; }

      /* ── The chosen TABLE becomes the central play surface ──
         The big felt in the middle of the screen is .gwrap::before. We paint
         the equipped table art straight onto it (rounded-rectangle, like a
         real table) so the table I picked is ALWAYS visible, dead-center,
         and never changes mid-game. No dependency on the felt-active class:
         the pseudo only renders while #game-screen is the active screen, so
         targeting it directly is enough. Local CSS var → each player only
         ever sees THEIR OWN table. */
      #game-screen .gwrap::before{
        /* ONLY paint the chosen table art — the OVAL shape, gold rim and
           dashed inner ring come from the base .gwrap::before/::after (which
           already match RONDA's .r-felt). We deliberately do NOT override the
           border-radius/box-shadow here, so the UNO felt reads identically to
           the RONDA table (an ellipse with a gold ornate rim). */
        background: var(--tf-art, radial-gradient(ellipse at 50% 35%, #14532D 0%, #052E18 75%, #021A0E 100%)) !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
      }
      body.felt-active #game-screen{
        background:
          radial-gradient(ellipse at 50% 24%, rgba(220,38,38,.16) 0%, transparent 55%),
          radial-gradient(ellipse at 50% 96%, rgba(168,85,247,.12) 0%, transparent 60%),
          linear-gradient(180deg,#160b1a 0%,#070410 100%) !important;
      }
      /* Each opponent's seat tile shows THAT opponent's own card back
         (set inline by renderOpps from the broadcast cardBackId). */
      .opp-sq-card.has-cb{
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
      }

      /* ── RONDA uses its OWN central felt (.r-felt) — apply the same chosen
         table there so the cosmetic works across UNO / Chess / Ronda. */
      #ronda-root .r-felt{
        background: var(--tf-art, radial-gradient(ellipse at 50% 35%, #14532D 0%, #052E18 75%, #021A0E 100%)) !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
      }
    `;
    document.head.appendChild(s);
  }
  // Inject immediately so the table/card art is live from the first render,
  // whether or not the player ever opens the shop this session.
  if(typeof document !== 'undefined'){
    if(document.head) _ensureGameArtStyles();
    else document.addEventListener('DOMContentLoaded', _ensureGameArtStyles, { once:true });
  }

  function _ensureCosmeticsModal(){
    let ov = document.getElementById('cosmeticsOv');
    if(ov) return ov;
    ov = document.createElement('div');
    ov.id = 'cosmeticsOv';
    ov.className = 'csm-ov';
    ov.innerHTML = `
      <div class="csm-box">
        <button class="csm-x" onclick="Cosmetics.close()">×</button>
        <div class="csm-header">🎴 COSMETICS</div>
        <div class="csm-sub">Customize your card back &amp; table felt</div>
        <div id="cosmeticsBody"></div>
      </div>`;
    ov.addEventListener('mousedown', (e)=>{ if(e.target === ov) Cosmetics.close(); });
    document.body.appendChild(ov);
    return ov;
  }

  // ── Boot integration ────────────────────────────────────────────────
  // Apply the user's equipped cosmetics on auth and on every screen
  // change. felt-active class on body controls when the felt is applied
  // (only on game-screen / room-screen — keep lobby on its own tint).
  function _applyFeltVisibility(){
    const inGame = document.getElementById('game-screen')?.classList.contains('active')
                || document.getElementById('room-screen')?.classList.contains('active');
    document.body.classList.toggle('felt-active', !!inGame);
    // Re-assert the equipped art every time we (re)enter a game/room so the
    // --tf-art / --cb-art vars are guaranteed set on <body> before the table
    // + deck paint — even if the catalog finished loading after first boot.
    // Spectators keep the WATCHED player's felt (set by the Ronda module) —
    // don't clobber it with the spectator's own.
    if(inGame && !S.isSpectator){ _ensureGameArtStyles(); try{ Cosmetics.apply(S.user); }catch(_){} }
    else if(inGame){ _ensureGameArtStyles(); }
  }
  // Listen for screen changes via MutationObserver on body class.
  if(typeof document !== 'undefined'){
    const mo = new MutationObserver(_applyFeltVisibility);
    document.addEventListener('DOMContentLoaded', ()=>{
      mo.observe(document.body, { attributes:true, attributeFilter:['class'] });
      // also when individual screens get .active class
      ['auth-screen','lobby-screen','room-screen','game-screen'].forEach(id => {
        const el = document.getElementById(id);
        if(el) mo.observe(el, { attributes:true, attributeFilter:['class'] });
      });
      _applyFeltVisibility();
    }, { once:true });
  }

  // Hook into auth + socket once both are available.
  (function _wireCosmetics(){
    function tryWire(){
      // Apply equipped art whenever the user object lands.
      if(S.user){
        Cosmetics.apply(S.user);
        Cosmetics.load();                    // hydrate catalog in background
      }
      if(S.socket) Cosmetics.bindSocketEvents(S.socket);
    }
    // Try now; re-try whenever auth completes.
    tryWire();
    const _origInitSock = window.initSock;
    if(typeof _origInitSock === 'function' && !_origInitSock._cosmeticHooked){
      window.initSock = function(...a){
        const out = _origInitSock.apply(this, a);
        setTimeout(tryWire, 50);
        return out;
      };
      window.initSock._cosmeticHooked = true;
    }
  })();
