  /* ═══════════════ SHOP (P4-D.4) ═══════════════
     Modal shop screen backing the header "+" buttons and the SHOP rail item.
     Three tabs:
       - Coins:    5 IAP packages (loaded from /api/shop/packages)
       - Diamonds: same 5 packages (every package grants both currencies)
       - Convert:  diamonds -> coins at server-side DIAMOND_TO_COIN_RATE
     All purchases are SIMULATED server-side (P4-D.2); the DEMO MODE banner
     surfaces that to the user. When real payment provider lands, server
     flips demo_mode:false in /api/shop/packages and this banner auto-hides.
     Convert is irreversible — a confirm dialog gates execution (locked in
     per the user direction "not with a mis-click"). */

  /* Real currency icons — crisp coin + diamond art (matches the header
     pills) instead of the 🪙/💎 emoji. Exposed globally so other modules
     can reuse the exact same artwork. */
  const COIN_IC = '<img src="/coin.svg" class="cur-ic" alt="coins" draggable="false">';
  const GEM_IC  = '<img src="/diamond.svg" class="cur-ic" alt="diamonds" draggable="false">';
  const curIc   = (currency) => currency === 'diamonds' ? GEM_IC : COIN_IC;
  if(typeof window !== 'undefined'){ window.COIN_IC = COIN_IC; window.GEM_IC = GEM_IC; window.curIc = curIc; }

  const Shop = {
    packages: null,             // cached from /api/shop/packages
    demoMode: true,
    rate: 100,                  // diamond_to_coin_rate from server
    activeTab: 'coins',
    convertAmount: 0,           // current value of the convert slider
    confirming: false,          // true while the convert-confirm dialog is visible

    async open(initialTab){
      if(initialTab) this.activeTab = initialTab;
      _ensureShopStyles();
      const old = document.getElementById('shopModal');
      if(old) old.remove();
      const ov = document.createElement('div');
      ov.id = 'shopModal';
      ov.innerHTML = this._shellHTML();
      document.body.appendChild(ov);
      // Outside-click closes (but not when the convert-confirm dialog is up,
      // so a mistap on the dimmer doesn't dismiss an important decision).
      ov.addEventListener('mousedown', e => { if(e.target === ov && !this.confirming) this.close(); });
      requestAnimationFrame(()=> ov.classList.add('show'));
      // Only fetch IAP packages when the user lands on Coins / Diamonds /
      // Convert. Cosmetic tabs hit /api/cosmetics on demand from
      // _renderCosmetics() so we don't make two unrelated round trips.
      if(this.activeTab !== 'cardBacks' && this.activeTab !== 'tableFelts' && this.activeTab !== 'damaBoards' && this.activeTab !== 'avatars'){
        await this._ensurePackages();
      }
      this._renderBody();
    },

    close(){
      const ov = document.getElementById('shopModal');
      if(!ov) return;
      ov.classList.add('out');
      setTimeout(()=> ov.remove(), 220);
      this.confirming = false;
    },

    switchTab(tab){
      if(this.confirming) return;             // mid-convert — don't lose the dialog
      if(this.activeTab === tab) return;      // already here — no flicker
      this.activeTab = tab;
      document.querySelectorAll('#shopModal .shop-tab').forEach(t => {
        const on = t.dataset.tab === tab;
        t.classList.toggle('on', on);
        // Keep the active tab in view when the strip scrolls horizontally.
        if(on && t.scrollIntoView) t.scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' });
      });
      // Smooth cross-fade: dim + drop the body, swap content, fade it back.
      const body = document.getElementById('shopBody');
      if(body){
        body.classList.add('shop-body-swap');
        setTimeout(() => {
          this._renderBody();
          requestAnimationFrame(() => body.classList.remove('shop-body-swap'));
        }, 130);
      } else {
        this._renderBody();
      }
    },

    async _ensurePackages(){
      if(this.packages) return;
      try{
        const d = await apiFetch('/api/shop/packages');
        this.packages = d.packages || [];
        this.demoMode = !!d.demo_mode;
        this.rate     = d.diamond_to_coin_rate || 100;
        // (DEMO banner was removed from the shop — nothing to toggle here.)
      }catch(e){
        console.error('[Shop] load packages failed:', e);
        const body = document.getElementById('shopBody');
        if(body) body.innerHTML = `<div class="shop-err">Could not load shop. <a href="#" onclick="event.preventDefault();Shop._ensurePackages().then(()=>Shop._renderBody())">Retry</a></div>`;
      }
    },

    _shellHTML(){
      // Top-level structure. Body content is filled by _renderBody() per tab.
      // Eyebrow + Bangers title matches the new design system (Notifs / DM /
      // Friends / Leaderboard / Theme & Lang pickers all use this pattern).
      return `
        <div class="shop-panel" role="dialog" aria-label="Shop">
          <!-- Tabs + close share ONE row — no separate top bar at all, so the
               products get essentially the whole panel. -->
          <div class="shop-tabbar">
            <div class="shop-tabs">
              <button class="shop-tab ${this.activeTab==='coins'?'on':''}" data-tab="coins" onclick="Shop.switchTab('coins')">${COIN_IC} Coins</button>
              <button class="shop-tab ${this.activeTab==='diamonds'?'on':''}" data-tab="diamonds" onclick="Shop.switchTab('diamonds')">${GEM_IC} Diamonds</button>
              <button class="shop-tab ${this.activeTab==='convert'?'on':''}" data-tab="convert" onclick="Shop.switchTab('convert')">⇄ Convert</button>
              <button class="shop-tab ${this.activeTab==='avatars'?'on':''}" data-tab="avatars" onclick="Shop.switchTab('avatars')">🧑 Avatars</button>
              <button class="shop-tab ${this.activeTab==='cardBacks'?'on':''}" data-tab="cardBacks" onclick="Shop.switchTab('cardBacks')">🎴 Cards</button>
              <button class="shop-tab ${this.activeTab==='tableFelts'?'on':''}" data-tab="tableFelts" onclick="Shop.switchTab('tableFelts')">🟩 Felts</button>
              <button class="shop-tab ${this.activeTab==='damaBoards'?'on':''}" data-tab="damaBoards" onclick="Shop.switchTab('damaBoards')">⛂ Boards</button>
            </div>
            <button class="shop-close" onclick="Shop.close()" aria-label="Close">×</button>
          </div>
          <div class="shop-body" id="shopBody">
            <div class="shop-loading"><div class="shop-spin"></div>Loading packages…</div>
          </div>
        </div>`;
    },

    _renderBody(){
      const body = document.getElementById('shopBody');
      if(!body) return;
      // Cosmetic tabs go through Cosmetics module (catalog + state lives there).
      // We just borrow the Shop's modal chrome — no separate overlay.
      if(this.activeTab === 'cardBacks' || this.activeTab === 'tableFelts' || this.activeTab === 'damaBoards'){
        this._renderCosmetics(body);
        return;
      }
      if(this.activeTab === 'avatars'){
        this._renderAvatars(body);
        return;
      }
      if(!this.packages){
        body.innerHTML = `<div class="shop-loading"><div class="shop-spin"></div>Loading packages…</div>`;
        return;
      }
      if(this.activeTab === 'convert'){
        body.innerHTML = this._renderConvert();
      } else {
        body.innerHTML = this._renderPackages();
      }
    },

    // Render cosmetics grid inside the Shop body. Hydrates the catalog
    // on first open via Cosmetics.load(), then re-renders. Reuses
    // Cosmetics.equip / Cosmetics.buy for the heavy lifting.
    async _renderCosmetics(body){
      const tab  = this.activeTab;                // cardBacks | tableFelts | damaBoards
      const C = window.Cosmetics;
      if(!C){
        body.innerHTML = '<div class="shop-err">Cosmetics module not loaded.</div>';
        return;
      }
      // The csm-* styles live in 35-cosmetics.js — make sure they're
      // injected even when the standalone Cosmetics modal is never opened.
      if(typeof C._ensureStyles === 'function') C._ensureStyles();
      const list = tab === 'cardBacks'  ? C.cardBacks
                 : tab === 'tableFelts' ? C.tableFelts
                 : C.damaBoards;
      // First load? Hit the server.
      if(!list || !list.length){
        body.innerHTML = this._cosmeticsHero(tab) + this._cosmeticsSkeleton();
        await C.load();
      }
      const items = tab === 'cardBacks'  ? C.cardBacks
                  : tab === 'tableFelts' ? C.tableFelts
                  : C.damaBoards;
      const type  = tab === 'cardBacks'  ? 'cardBack'
                  : tab === 'tableFelts' ? 'tableFelt'
                  : 'damaBoard';
      // Distinguish "load failed" vs "load succeeded with 0 items" so the
      // user knows whether to restart the server or wait for content.
      if(C.lastError){
        body.innerHTML = `
          ${this._cosmeticsHero(tab)}
          <div class="csm-empty">
            <div class="csm-empty-icon">⚠️</div>
            <div class="csm-empty-title">Could not load</div>
            <div class="csm-empty-sub">${esc(C.lastError)}</div>
            <button class="csm-empty-btn" onclick="Shop._renderCosmetics(document.getElementById('shopBody'))">Retry</button>
          </div>`;
        return;
      }
      // Shop = store: only show what you DON'T own yet. Once bought, an item
      // leaves the shop and lives in the Collection (the Vault).
      const unowned = (items || []).filter(it => !it.owned);
      const cards = unowned.map(item => this._cosmeticCard(item, type)).join('');
      const wasLoaded = (items || []).length > 0;
      const grid = cards
        ? `<div class="csm-grid">${cards}</div>`
        : (wasLoaded ? this._cosmeticsAllOwned(tab) : this._cosmeticsEmpty(tab));
      body.innerHTML = `${this._cosmeticsHero(tab)}${grid}`;
    },

    // Every item in this category is already owned → point to the Collection.
    _cosmeticsAllOwned(tab){
      const kind = tab === 'cardBacks' ? 'card backs' : tab === 'tableFelts' ? 'table felts' : 'boards';
      const cat  = tab === 'cardBacks' ? 'cardBacks'  : tab === 'tableFelts' ? 'tableFelts'  : 'damaBoards';
      return `
        <div class="csm-empty">
          <div class="csm-empty-icon">🏆</div>
          <div class="csm-empty-title">You own all ${kind}!</div>
          <div class="csm-empty-sub">Switch between them anytime in your Collection.</div>
          <button class="csm-empty-btn" onclick="Shop.close(); if(window.showCollection) showCollection('${cat}');">Open Collection</button>
        </div>`;
    },

    // Tab-specific hero strip — eyebrow + bold title + one-line subtitle.
    // Way more presence than the old single-line ".shop-headline".
    // Hero banner removed per user request — the selected tab already says
    // which collection you're in, so the products get all the room.
    _cosmeticsHero(){ return ''; },

    // Empty-grid state — clear "this needs the server to restart" message
    // rather than the generic "no items" line.
    _cosmeticsEmpty(tab){
      const kind = tab === 'cardBacks' ? 'card backs'
                 : tab === 'tableFelts' ? 'table felts'
                 : 'DAMA boards';
      const icon = tab === 'damaBoards' ? '⛂' : tab === 'tableFelts' ? '🟩' : '🎴';
      return `
        <div class="csm-empty">
          <div class="csm-empty-icon">${icon}</div>
          <div class="csm-empty-title">Catalog not loaded</div>
          <div class="csm-empty-sub">
            The server hasn't shipped any ${kind} on this build yet.<br>
            Restart Node and re-open the shop to see the full collection.
          </div>
          <button class="csm-empty-btn" onclick="Shop._renderCosmetics(document.getElementById('shopBody'))">Try again</button>
        </div>`;
    },

    // Skeleton placeholders while the catalog is in flight — keeps the
    // grid from looking broken during the 100-300ms round trip.
    _cosmeticsSkeleton(){
      const cell = `<div class="csm-skel"><div class="csm-skel-thumb"></div><div class="csm-skel-line"></div><div class="csm-skel-line csm-skel-line-sm"></div></div>`;
      return `<div class="csm-grid">${cell.repeat(6)}</div>`;
    },

    _cosmeticCard(item, type){
      const u = item.unlock || {};
      const rarity = item.rarity || 'common';
      let statusLabel = '';
      let actionBtn   = '';
      if(item.equipped){
        statusLabel = `<span class="csm-status csm-status-on">✓ EQUIPPED</span>`;
      } else if(item.owned){
        statusLabel = `<span class="csm-status">OWNED</span>`;
        actionBtn   = `<button class="csm-btn csm-btn-equip" onclick="Shop._equipCosmetic('${type}','${item.id}')">EQUIP</button>`;
      } else if(u.kind === 'shop'){
        const cur = curIc(u.currency);
        statusLabel = `<span class="csm-status csm-status-shop">${cur} ${(u.price||0).toLocaleString()}</span>`;
        actionBtn   = `<button class="csm-btn csm-btn-buy" onclick="Shop._buyCosmetic('${item.id}')">BUY</button>`;
      } else if(u.kind === 'tier'){
        statusLabel = `<span class="csm-status csm-status-lock">🔒 ${esc(u.tier)}</span>`;
      } else if(u.kind === 'achievement'){
        statusLabel = `<span class="csm-status csm-status-lock">🔒 Achievement</span>`;
      } else if(u.kind === 'season'){
        statusLabel = `<span class="csm-status csm-status-event">🎉 ${esc(u.event)}</span>`;
      }
      const rarityCls = `csm-rarity-${rarity}`;
      const lockedCls = !item.owned && !item.equipped ? 'csm-locked' : '';
      const equippedCls = item.equipped ? 'csm-equipped' : '';
      // DAMA boards need an extra inner element so the wooden frame
      // (outer div) and the 8×8 checker pattern (inner div) can be
      // styled independently — inline `background` on the outer would
      // override the frame.
      let thumbHtml;
      if(type === 'damaBoard'){
        thumbHtml = `<div class="csm-thumb csm-thumb-db">
          <div class="csm-thumb-db-inner" style="background:${item.art}"></div>
        </div>`;
      } else {
        const thumbCls = type === 'cardBack' ? 'csm-thumb csm-thumb-cb' : 'csm-thumb csm-thumb-tf';
        thumbHtml = `<div class="${thumbCls}" style="background:${item.art}"></div>`;
      }
      return `
        <div class="csm-card ${rarityCls} ${lockedCls} ${equippedCls}">
          ${thumbHtml}
          <div class="csm-name">${esc(item.name)}</div>
          <div class="csm-status-row">${statusLabel}</div>
          ${actionBtn}
        </div>`;
    },

    async _equipCosmetic(type, id){
      await window.Cosmetics.equip(type, id);
      this._renderBody();
    },
    async _buyCosmetic(id){
      await window.Cosmetics.buy(id);
      this._renderBody();
    },

    // ── Avatars tab ──────────────────────────────────────────────────
    // Premium portraits bought from /api/cosmetics (avatars[]) and equipped
    // via /api/profile/avatar. Reuses the cosmetics card chrome with a round
    // photo thumb instead of a CSS-gradient tile.
    async _renderAvatars(body){
      const C = window.Cosmetics;
      if(!C){ body.innerHTML = '<div class="shop-err">Cosmetics module not loaded.</div>'; return; }
      if(typeof C._ensureStyles === 'function') C._ensureStyles();
      if(!C.avatars || !C.avatars.length){
        body.innerHTML = this._avatarsHero() + this._cosmeticsSkeleton();
        await C.load();
      }
      if(C.lastError){
        body.innerHTML = `
          ${this._avatarsHero()}
          <div class="csm-empty">
            <div class="csm-empty-icon">⚠️</div>
            <div class="csm-empty-title">Could not load</div>
            <div class="csm-empty-sub">${esc(C.lastError)}</div>
            <button class="csm-empty-btn" onclick="Shop._renderAvatars(document.getElementById('shopBody'))">Retry</button>
          </div>`;
        return;
      }
      // Shop shows only what you DON'T own yet — owned avatars live in the
      // profile Collection. Sorted cheapest-first within each currency.
      const items = (C.avatars || []).filter(a => !a.owned);
      const cards = items.map(it => this._avatarCard(it)).join('');
      const grid = cards
        ? `<div class="csm-grid csm-grid-av">${cards}</div>`
        : this._avatarsAllOwned();
      body.innerHTML = `${this._avatarsHero()}${grid}`;
    },

    // Hero banner removed per user request — products get all the room.
    _avatarsHero(){ return ''; },

    _avatarsEmpty(){
      return `
        <div class="csm-empty">
          <div class="csm-empty-icon">🧑</div>
          <div class="csm-empty-title">Catalog not loaded</div>
          <div class="csm-empty-sub">
            The server hasn't shipped any avatars on this build yet.<br>
            Restart Node and re-open the shop to see the full collection.
          </div>
          <button class="csm-empty-btn" onclick="Shop._renderAvatars(document.getElementById('shopBody'))">Try again</button>
        </div>`;
    },

    // Shown when the player already owns every avatar in the shop.
    _avatarsAllOwned(){
      return `
        <div class="csm-empty">
          <div class="csm-empty-icon">🏆</div>
          <div class="csm-empty-title">You own them all!</div>
          <div class="csm-empty-sub">
            Every avatar is in your collection. Open your profile → Change Avatar
            to switch between them.
          </div>
          <button class="csm-empty-btn" onclick="Shop.close(); if(window.showAvatarPicker) showAvatarPicker();">Open Collection</button>
        </div>`;
    },

    _avatarCard(item){
      const rarity = item.rarity || 'common';
      const u = item.unlock || {};
      let statusLabel = '';
      let actionBtn   = '';
      if(item.equipped){
        statusLabel = `<span class="csm-status csm-status-on">✓ EQUIPPED</span>`;
      } else if(item.owned){
        statusLabel = `<span class="csm-status">OWNED</span>`;
        actionBtn   = `<button class="csm-btn csm-btn-equip" onclick="Shop._equipAvatar('${item.id}')">EQUIP</button>`;
      } else {
        const cur = curIc(u.currency);
        statusLabel = `<span class="csm-status csm-status-shop">${cur} ${(u.price||0).toLocaleString()}</span>`;
        actionBtn   = `<button class="csm-btn csm-btn-buy" onclick="Shop._buyAvatar('${item.id}')">BUY</button>`;
      }
      const rarityCls   = `csm-rarity-${rarity}`;
      const lockedCls   = (!item.owned && !item.equipped) ? 'csm-locked' : '';
      const equippedCls = item.equipped ? 'csm-equipped' : '';
      return `
        <div class="csm-card csm-card-av ${rarityCls} ${lockedCls} ${equippedCls}">
          <img class="csm-thumb-av" src="${item.src}" alt="" loading="lazy" width="118" height="118">
          <div class="csm-name">${esc(item.name)}</div>
          <div class="csm-status-row">${statusLabel}</div>
          ${actionBtn}
        </div>`;
    },

    async _buyAvatar(id){
      await window.Cosmetics.buy(id);
      this._renderBody();
    },
    async _equipAvatar(id){
      const av = (window.Cosmetics.avatars || []).find(a => a.id === id);
      if(av) await window.Cosmetics.equipAvatar(av.src);
      this._renderBody();
    },

    _renderPackages(){
      // Same 5 packages on both Coins and Diamonds tabs. The label headline
      // shifts by tab so each tab feels "about" its primary currency.
      const headline = this.activeTab === 'diamonds'
        ? 'Buy diamonds — bonus coins included'
        : 'Buy coins — bonus diamonds included';
      const cards = this.packages.map(p => this._packageCard(p)).join('');
      return `
        <div class="shop-headline">${esc(headline)}</div>
        <div class="shop-grid">${cards}</div>`;
    },

    _packageCard(p){
      const price = '$' + (p.usd_cents/100).toFixed(2);
      const bonus = p.bonus_pct > 0 ? `<div class="shop-card-bonus">+${p.bonus_pct}% BONUS</div>` : '';
      const isPrimaryCoins    = this.activeTab === 'coins';
      const primaryVal        = isPrimaryCoins ? p.coins : p.diamonds;
      const primaryIcon       = isPrimaryCoins ? COIN_IC : GEM_IC;
      const secondaryVal      = isPrimaryCoins ? p.diamonds : p.coins;
      const secondaryIcon     = isPrimaryCoins ? GEM_IC : COIN_IC;
      return `
        <div class="shop-card shop-card-${p.id}" data-pkg="${p.id}">
          ${bonus}
          <div class="shop-card-label">${esc(p.label.toUpperCase())}</div>
          <div class="shop-card-primary">${primaryIcon} ${primaryVal.toLocaleString()}</div>
          <div class="shop-card-secondary">+ ${secondaryIcon} ${secondaryVal.toLocaleString()}</div>
          <button class="shop-card-buy" onclick="Shop.purchase('${p.id}')">${price}</button>
        </div>`;
    },

    _renderConvert(){
      // Convert tab: shows current balance, preset amount buttons, live
      // calculation of coins-you-get, primary action. Irreversibility is
      // gated by the confirm step — primary button doesn't immediately fire
      // the API call; it opens the confirm dialog instead.
      const have = S.user?.diamonds || 0;
      const amount = Math.max(0, Math.min(this.convertAmount, have));
      const coins  = amount * this.rate;
      const presets = [10, 50, 100, 500];
      const presetBtns = presets.map(n => {
        const disabled = n > have;
        return `<button class="shop-preset ${amount===n?'on':''}" ${disabled?'disabled':''} onclick="Shop.setConvertAmount(${n})">${n}</button>`;
      }).join('');
      const maxDisabled = have <= 0;
      if(this.confirming){
        return `
          <div class="shop-convert-confirm">
            <div class="shop-confirm-q">Convert ${amount} ${GEM_IC} to ${coins.toLocaleString()} ${COIN_IC}?</div>
            <div class="shop-confirm-warn">This can't be undone.</div>
            <div class="shop-confirm-actions">
              <button class="shop-confirm-cancel" onclick="Shop.cancelConvert()">Cancel</button>
              <button class="shop-confirm-go" onclick="Shop.executeConvert()">Confirm convert</button>
            </div>
          </div>`;
      }
      return `
        <div class="shop-convert">
          <div class="shop-headline">Convert diamonds to coins</div>
          <div class="shop-convert-rate">Rate: 1 ${GEM_IC} = ${this.rate.toLocaleString()} ${COIN_IC} · Non-refundable</div>
          <div class="shop-convert-have">You have <b>${have.toLocaleString()}</b> ${GEM_IC}</div>
          <div class="shop-convert-presets">
            ${presetBtns}
            <button class="shop-preset ${amount===have && have>0?'on':''}" ${maxDisabled?'disabled':''} onclick="Shop.setConvertAmount(${have})">MAX</button>
          </div>
          <div class="shop-convert-line">
            <span class="shop-convert-amt">${amount} ${GEM_IC}</span>
            <span class="shop-convert-arrow">→</span>
            <span class="shop-convert-out">${coins.toLocaleString()} ${COIN_IC}</span>
          </div>
          <button class="shop-convert-go" ${amount<=0?'disabled':''} onclick="Shop.requestConvert()">
            ${amount <= 0 ? 'Pick an amount' : 'Convert →'}
          </button>
        </div>`;
    },

    setConvertAmount(n){
      this.convertAmount = Math.max(0, Math.min(n, S.user?.diamonds || 0));
      this._renderBody();
    },

    // User clicked the primary Convert button — opens the confirm dialog.
    requestConvert(){
      const have = S.user?.diamonds || 0;
      if(this.convertAmount <= 0 || this.convertAmount > have) return;
      this.confirming = true;
      this._renderBody();
    },

    cancelConvert(){
      this.confirming = false;
      this._renderBody();
    },

    // Confirmed — actually fires the API call.
    async executeConvert(){
      const amount = this.convertAmount;
      this.confirming = false;
      try{
        const d = await apiFetch('/api/shop/convert-diamonds', {
          method: 'POST',
          body: JSON.stringify({ amount }),
        });
        this._applyUserUpdate(d.user);
        this.convertAmount = 0;
        toast(`✓ Converted ${amount} 💎 → ${(d.converted?.coins || 0).toLocaleString()} 🪙`, 's');
      }catch(e){
        console.error('[Shop] convert failed:', e);
        const msg = e?.status === 402
          ? `Not enough diamonds (have ${e.payload?.have ?? '?'})`
          : (e?.message || 'Conversion failed');
        toast(msg, 'e');
      }
      this._renderBody();
    },

    async purchase(packageId){
      const pkg = this.packages?.find(p => p.id === packageId);
      if(!pkg) return;
      try{
        const d = await apiFetch('/api/shop/purchase', {
          method: 'POST',
          body: JSON.stringify({ packageId }),
        });
        this._applyUserUpdate(d.user);
        const tag = d.simulated ? ' (demo)' : '';
        toast(`✓ Purchased ${esc(pkg.label)}${tag} — +${pkg.coins.toLocaleString()} 🪙 +${pkg.diamonds.toLocaleString()} 💎`, 's');
      }catch(e){
        console.error('[Shop] purchase failed:', e);
        toast(e?.message || 'Purchase failed', 'e');
      }
      // No body re-render here: the coin/diamond packages don't change on
      // purchase, and re-rendering would re-trigger the entrance stagger (a
      // flash). The live balance bar + toast already confirm the buy.
    },

    // Server sends back the full updated user — sync into S.user + animate
    // every header display that shows coins/diamonds so the new balances
    // are visible everywhere immediately.
    _applyUserUpdate(user){
      if(!user) return;
      S.user.coins    = user.coins;
      S.user.diamonds = user.diamonds;
      if(typeof _animateCount === 'function'){
        // Topbar + lobby pills.
        _animateCount('hcoins',    user.coins);
        _animateCount('scoins',    user.coins);
        _animateCount('heroCoins', user.coins);
        _animateCount('hdiamonds', user.diamonds);
        // The shop's OWN live balance bar (visible while the modal is open).
        _animateCount('shopBalCoins',    user.coins);
        _animateCount('shopBalDiamonds', user.diamonds);
      }
      try{ localStorage.setItem('uno_user', JSON.stringify(S.user)); }catch(e){}
    },
  };

  function showShop(initialTab){ Shop.open(initialTab); }
  function _ensureShopStyles(){
    if(document.getElementById('shopPremiumStyles')) return;
    const s = document.createElement('style');
    s.id = 'shopPremiumStyles';
    s.textContent = `
      /* ═══════════════════════════════════════════════════════
       *  SHOP — premium cosmetics layout (v4)
       *  Cards + felts get a gallery treatment: large preview tiles,
       *  rarity glow on hover, animated shine across legendaries,
       *  tier/season badges, and a clean owned/equipped/price chip.
       * ═══════════════════════════════════════════════════════ */
      /* Real coin / diamond icon — sized to the line it sits on. */
      .cur-ic{
        width:1.15em; height:1.15em;
        vertical-align:-0.22em; display:inline-block;
        margin:0 .06em; object-fit:contain;
        filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45));
        user-select:none; pointer-events:none;
      }
      #shopModal .shop-card-primary .cur-ic{ width:1.05em; height:1.05em; vertical-align:-0.16em; }
      #shopModal .shop-tab .cur-ic{ width:1.1em; height:1.1em; }
      /* (Removed: .shop-balance / .shop-bal-pill — the in-shop balance bar was taken out.) */
      #shopModal .shop-headline{
        font-family:'Outfit',sans-serif;
        font-size:13px; font-weight:900; letter-spacing:2.5px;
        color:rgba(255,255,255,.62);
        text-transform:uppercase;
        margin:0 0 18px;
        padding-bottom:12px;
        border-bottom:1px solid rgba(255,255,255,.06);
      }

      /* Gallery grid */
      #shopModal .csm-grid{
        display:grid;
        grid-template-columns:repeat(auto-fill, minmax(190px, 1fr));
        gap:11px;
      }
      @media (max-width:680px){
        #shopModal .csm-grid{
          grid-template-columns:repeat(auto-fill, minmax(150px, 1fr));
          gap:7px;
        }
        /* On phones, make the frame almost disappear so the card art fills
           the tile edge-to-edge. */
        #shopModal .csm-card{ padding:2px 2px 6px; border-width:1px; border-radius:12px; }
        #shopModal .csm-thumb-cb{ border:none; margin-bottom:6px; border-radius:9px; }
        #shopModal .csm-thumb-tf{ margin-bottom:6px; }
      }

      /* Premium tile — glassy panel with rarity-tinted top accent.
         Very tight padding so the card art nearly fills the tile (minimal frame). */
      #shopModal .csm-card{
        position:relative;
        padding:2px 2px 7px;
        border-radius:13px;
        background:
          radial-gradient(140% 70% at 50% 0%, rgba(255,255,255,.13) 0%, rgba(255,255,255,0) 60%),
          linear-gradient(180deg, rgba(36,42,70,.92) 0%, rgba(22,26,48,.92) 100%);
        border:1.5px solid rgba(255,255,255,.12);
        backdrop-filter:blur(10px);
        text-align:center;
        overflow:hidden;
        transition:transform .25s cubic-bezier(.34,1.56,.64,1),
                   border-color .25s, box-shadow .25s;
      }
      #shopModal .csm-card::before{
        /* Rarity stripe at the very top — coloured per rarity class. */
        content:''; position:absolute; left:3px; right:3px; top:0; height:3px;
        border-radius:0 0 3px 3px;
        opacity:.9;
      }
      #shopModal .csm-card:hover{
        transform:translateY(-4px) scale(1.02);
        border-color:rgba(255,255,255,.18);
        box-shadow:0 16px 36px rgba(0,0,0,.55),
                   0 0 22px rgba(251,191,36,.18),
                   inset 0 1px 0 rgba(255,255,255,.10);
      }
      #shopModal .csm-card.csm-equipped{
        border-color:#22C55E;
        box-shadow:0 0 0 1px #22C55E,
                   0 12px 28px rgba(0,0,0,.55),
                   0 0 30px rgba(34,197,94,.30);
      }
      /* Items for sale (not yet owned) stay FULLY visible + bright so the
         player can see exactly what they're buying — only a tiny lock badge
         marks them. (Was previously dimmed + desaturated, which made the whole
         shop look dark.) */
      #shopModal .csm-card.csm-locked{ opacity:1; }
      #shopModal .csm-card.csm-locked .csm-thumb{
        filter:none;
      }
      #shopModal .csm-card.csm-locked::after{
        content:'🔒'; position:absolute; top:10px; right:10px;
        font-size:13px; opacity:.6;
      }

      /* Rarity colours */
      #shopModal .csm-rarity-common::before    { background:#6B7280; }
      #shopModal .csm-rarity-rare::before      { background:linear-gradient(90deg,#3B82F6,#60A5FA); }
      #shopModal .csm-rarity-epic::before      { background:linear-gradient(90deg,#A855F7,#D946EF); }
      #shopModal .csm-rarity-legendary::before {
        background:linear-gradient(90deg,#FBBF24,#F59E0B,#FBBF24);
        background-size:200% 100%;
        animation:csmShimmer 2.6s ease-in-out infinite;
      }
      #shopModal .csm-rarity-seasonal::before  {
        background:linear-gradient(90deg,#F472B6,#9F70FD,#F472B6);
        background-size:200% 100%;
        animation:csmShimmer 2.6s ease-in-out infinite;
      }
      @keyframes csmShimmer{
        0%, 100%{ background-position:0% 50%; }
        50%     { background-position:100% 50%; }
      }

      /* Card-back preview — fake playing-card aspect with realistic
       * border + corner radius + faint inner highlight. */
      #shopModal .csm-thumb-cb{
        width:100%; aspect-ratio:5/7;
        border-radius:9px;
        border:1px solid rgba(0,0,0,.4);
        box-shadow:0 6px 16px rgba(0,0,0,.45);
        margin-bottom:7px;
        background-size:cover;
        background-position:center;
        position:relative;
      }
      /* Legendary / seasonal previews get an animated shine sweep. */
      #shopModal .csm-rarity-legendary .csm-thumb-cb::after,
      #shopModal .csm-rarity-seasonal  .csm-thumb-cb::after{
        content:''; position:absolute; inset:0;
        border-radius:10px;
        background:linear-gradient(115deg,
          transparent 35%,
          rgba(255,255,255,.32) 50%,
          transparent 65%);
        animation:csmShine 3.4s ease-in-out infinite;
      }
      @keyframes csmShine{
        0%, 100%{ transform:translateX(-100%); }
        50%     { transform:translateX(100%); }
      }

      /* Avatar preview — round photo portrait with rarity-tinted frame. */
      #shopModal .csm-grid-av{
        grid-template-columns:repeat(auto-fill, minmax(150px, 1fr));
      }
      #shopModal .csm-thumb-av{
        width:118px; height:118px; object-fit:cover; display:block;
        margin:0 auto 12px; border-radius:50%;
        border:2px solid rgba(255,255,255,.14);
        box-shadow:
          0 10px 26px rgba(0,0,0,.55),
          inset 0 1px 0 rgba(255,255,255,.18);
        position:relative;
      }
      #shopModal .csm-rarity-rare      .csm-thumb-av{ border-color:rgba(96,165,250,.55); }
      #shopModal .csm-rarity-epic      .csm-thumb-av{ border-color:rgba(216,180,254,.6); box-shadow:0 10px 26px rgba(0,0,0,.55), 0 0 18px rgba(168,85,247,.35), inset 0 1px 0 rgba(255,255,255,.18); }
      #shopModal .csm-rarity-legendary .csm-thumb-av{ border-color:rgba(252,211,77,.7);  box-shadow:0 10px 26px rgba(0,0,0,.55), 0 0 22px rgba(251,191,36,.45), inset 0 1px 0 rgba(255,255,255,.18); }
      /* Epic + legendary avatars get the same shine sweep as legendary cards. */
      #shopModal .csm-rarity-epic      .csm-thumb-av::after,
      #shopModal .csm-rarity-legendary .csm-thumb-av::after{
        content:''; position:absolute; inset:0; border-radius:50%;
        background:linear-gradient(115deg, transparent 38%, rgba(255,255,255,.28) 50%, transparent 62%);
        animation:csmShine 3.4s ease-in-out infinite;
        pointer-events:none;
      }

      /* DAMA board preview — square 8×8 checker behind a thick
       * mahogany frame. The outer .csm-thumb-db is the wooden frame
       * (pure CSS); the inner .csm-thumb-db-inner gets the catalog's
       * tiled checker via inline background. Corner studs + edge
       * highlights make it feel like a physical board, not a flat
       * gradient tile. */
      #shopModal .csm-thumb-db{
        width:100%; aspect-ratio:1/1;
        position:relative;
        border-radius:10px;
        padding:10px;
        background:
          linear-gradient(160deg, rgba(255,200,140,.20) 0%, rgba(0,0,0,0) 55%),
          linear-gradient(160deg, #5B3014 0%, #2E1505 100%);
        box-shadow:
          0 10px 26px rgba(0,0,0,.55),
          inset 0 0 0 1px rgba(255,200,140,.22),
          inset 0 -4px 10px rgba(0,0,0,.5),
          inset 0 2px 6px rgba(255,200,140,.18);
        margin-bottom:12px;
        overflow:hidden;
      }
      /* The checker tile — inline background paints the
       * conic-gradient pattern over a tight inner rectangle. */
      #shopModal .csm-thumb-db-inner{
        position:absolute; inset:10px;
        border-radius:4px;
        box-shadow:
          inset 0 0 18px rgba(0,0,0,.55),
          inset 0 0 0 1.5px rgba(0,0,0,.4),
          0 1px 0 rgba(255,200,140,.12);
      }
      /* Tiny corner studs — sells the "real board" feeling. */
      #shopModal .csm-thumb-db::after{
        content:'';
        position:absolute; inset:0;
        pointer-events:none;
        background:
          radial-gradient(circle at  5px  5px, rgba(255,215,130,.65) 0 1.6px, transparent 2.4px),
          radial-gradient(circle at calc(100% - 5px)  5px, rgba(255,215,130,.65) 0 1.6px, transparent 2.4px),
          radial-gradient(circle at  5px calc(100% - 5px), rgba(255,215,130,.65) 0 1.6px, transparent 2.4px),
          radial-gradient(circle at calc(100% - 5px) calc(100% - 5px), rgba(255,215,130,.65) 0 1.6px, transparent 2.4px);
      }
      /* Legendary boards get an animated shine sweep across the checker. */
      #shopModal .csm-rarity-legendary .csm-thumb-db-inner::after,
      #shopModal .csm-rarity-seasonal  .csm-thumb-db-inner::after{
        content:''; position:absolute; inset:0;
        border-radius:4px;
        background:linear-gradient(115deg,
          transparent 35%,
          rgba(255,255,255,.28) 50%,
          transparent 65%);
        animation:csmShine 3.4s ease-in-out infinite;
        pointer-events:none;
      }
      #shopModal .csm-thumb-db-inner{ overflow:hidden; }

      /* Empty / restart-needed state — replaces the bare "No items" line. */
      #shopModal .csm-empty{
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        text-align:center;
        padding:48px 24px 36px;
        border-radius:18px;
        background:
          radial-gradient(120% 80% at 50% 0%, rgba(251,191,36,.08) 0%, rgba(0,0,0,0) 60%),
          linear-gradient(180deg, rgba(22,26,46,.5) 0%, rgba(12,14,28,.5) 100%);
        border:1.5px dashed rgba(251,191,36,.22);
      }
      #shopModal .csm-empty-icon{
        font-size:42px; line-height:1; margin-bottom:10px;
        filter:drop-shadow(0 4px 10px rgba(251,191,36,.35));
        opacity:.85;
      }
      #shopModal .csm-empty-title{
        font-family:'Outfit',sans-serif;
        font-size:18px; font-weight:900; letter-spacing:.4px;
        color:#FFE9B0; margin-bottom:8px;
      }
      #shopModal .csm-empty-sub{
        font-size:12.5px; line-height:1.55;
        color:rgba(255,255,255,.6);
        max-width:380px; margin:0 auto 18px;
      }
      #shopModal .csm-empty-btn{
        border:none; cursor:pointer;
        padding:10px 22px; border-radius:11px;
        font-family:'Outfit',sans-serif; font-weight:900;
        font-size:12.5px; letter-spacing:1.4px;
        background:linear-gradient(135deg, #FBBF24, #D97706);
        color:#1A1A1A;
        box-shadow:0 6px 16px rgba(251,191,36,.4);
        transition:transform .12s, filter .12s;
      }
      #shopModal .csm-empty-btn:hover{ filter:brightness(1.08); transform:translateY(-1px); }

      /* Skeleton row while items load */
      #shopModal .csm-skel{
        padding:14px;
        border-radius:18px;
        background:linear-gradient(180deg, rgba(22,26,46,.45) 0%, rgba(12,14,28,.45) 100%);
        border:1.5px solid rgba(255,255,255,.04);
      }
      #shopModal .csm-skel-thumb{
        width:100%; aspect-ratio:1/1; border-radius:10px; margin-bottom:12px;
        background:linear-gradient(110deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,.12) 50%, rgba(255,255,255,.06) 100%);
        background-size:200% 100%;
        animation:csmSkel 1.4s ease-in-out infinite;
      }
      #shopModal .csm-skel-line{
        height:10px; border-radius:5px; margin:6px auto;
        width:60%;
        background:linear-gradient(110deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,.12) 50%, rgba(255,255,255,.06) 100%);
        background-size:200% 100%;
        animation:csmSkel 1.4s ease-in-out infinite;
      }
      #shopModal .csm-skel-line-sm{ width:40%; height:8px; }
      @keyframes csmSkel{
        0%{ background-position:200% 0; }
        100%{ background-position:-200% 0; }
      }

      /* (Removed: .csm-hero* — the per-tab collection hero banners were taken out.) */

      /* Table-felt preview — landscape oval-ish ratio + glow */
      #shopModal .csm-thumb-tf{
        width:100%; aspect-ratio:16/10;
        border-radius:14px;
        border:1.5px solid rgba(255,255,255,.12);
        /* Clean drop shadow only — the table art already has its own ornate
           frame, so no heavy inner vignette / gold ring darkening it. */
        box-shadow:0 6px 16px rgba(0,0,0,.4);
        margin-bottom:12px;
        background-size:cover;
        background-position:center;
        position:relative;
      }

      /* Name + meta + status */
      #shopModal .csm-name{
        font-family:'Outfit',sans-serif;
        font-size:14px; font-weight:900;
        letter-spacing:.3px;
        color:#FFE9B0;
        margin-bottom:4px;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      /* (Removed: .csm-rarity-tag* — the RARE/EPIC text tags were taken off the tiles.) */

      #shopModal .csm-status-row{ margin-bottom:10px; min-height:22px; }
      #shopModal .csm-status{
        display:inline-flex; align-items:center; gap:4px;
        padding:3px 10px; border-radius:99px;
        font-size:11px; font-weight:900; letter-spacing:.4px;
        background:rgba(255,255,255,.06); color:rgba(255,255,255,.7);
      }
      #shopModal .csm-status-on{
        background:linear-gradient(135deg,#22C55E,#15803D); color:#fff;
        box-shadow:0 4px 12px rgba(34,197,94,.4);
      }
      #shopModal .csm-status-shop{
        background:linear-gradient(135deg, rgba(251,191,36,.22), rgba(217,119,6,.22));
        color:#FBBF24;
        border:1px solid rgba(251,191,36,.4);
      }
      #shopModal .csm-status-lock{
        background:rgba(255,255,255,.04); color:rgba(255,255,255,.5);
      }
      #shopModal .csm-status-event{
        background:linear-gradient(135deg, rgba(244,114,182,.20), rgba(159,112,253,.20));
        color:#F472B6; border:1px solid rgba(244,114,182,.4);
      }

      /* CTA buttons */
      #shopModal .csm-btn{
        width:100%; padding:9px;
        border:none; border-radius:11px; cursor:pointer;
        font-family:'Outfit',sans-serif;
        font-weight:900; font-size:12px; letter-spacing:1.4px;
        transition:transform .12s, filter .12s, box-shadow .2s;
      }
      #shopModal .csm-btn:hover{ filter:brightness(1.08); transform:translateY(-1px); }
      #shopModal .csm-btn:active{ transform:translateY(0) scale(.97); }
      #shopModal .csm-btn-equip{
        background:linear-gradient(135deg, #FBBF24, #D97706);
        color:#1A1A1A;
        box-shadow:0 6px 16px rgba(251,191,36,.35);
      }
      #shopModal .csm-btn-buy{
        background:linear-gradient(135deg, #22C55E, #15803D);
        color:#fff;
        box-shadow:0 6px 16px rgba(34,197,94,.35);
      }
    `;
    document.head.appendChild(s);
  }
