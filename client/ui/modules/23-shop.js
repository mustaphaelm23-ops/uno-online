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
      await this._ensurePackages();
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
      this.activeTab = tab;
      document.querySelectorAll('#shopModal .shop-tab').forEach(t => {
        t.classList.toggle('on', t.dataset.tab === tab);
      });
      this._renderBody();
    },

    async _ensurePackages(){
      if(this.packages) return;
      try{
        const d = await apiFetch('/api/shop/packages');
        this.packages = d.packages || [];
        this.demoMode = !!d.demo_mode;
        this.rate     = d.diamond_to_coin_rate || 100;
        // Demo banner visibility tracks the server flag.
        const banner = document.querySelector('#shopModal .shop-demo');
        if(banner) banner.style.display = this.demoMode ? '' : 'none';
      }catch(e){
        console.error('[Shop] load packages failed:', e);
        const body = document.getElementById('shopBody');
        if(body) body.innerHTML = `<div class="shop-err">Could not load shop. <a href="#" onclick="event.preventDefault();Shop._ensurePackages().then(()=>Shop._renderBody())">Retry</a></div>`;
      }
    },

    _shellHTML(){
      // Top-level structure. Body content is filled by _renderBody() per tab.
      return `
        <div class="shop-panel" role="dialog" aria-label="Shop">
          <button class="shop-close" onclick="Shop.close()" aria-label="Close">×</button>
          <div class="shop-head">
            <div class="shop-title">🛍️ SHOP</div>
            <div class="shop-sub">Premium currency &amp; conversions</div>
          </div>
          <div class="shop-demo">🧪 DEMO MODE — no real money charged. Purchases are simulated for testing.</div>
          <div class="shop-tabs">
            <button class="shop-tab ${this.activeTab==='coins'?'on':''}" data-tab="coins" onclick="Shop.switchTab('coins')">🪙 Coins</button>
            <button class="shop-tab ${this.activeTab==='diamonds'?'on':''}" data-tab="diamonds" onclick="Shop.switchTab('diamonds')">💎 Diamonds</button>
            <button class="shop-tab ${this.activeTab==='convert'?'on':''}" data-tab="convert" onclick="Shop.switchTab('convert')">⇄ Convert</button>
          </div>
          <div class="shop-body" id="shopBody">
            <div class="shop-loading"><div class="shop-spin"></div>Loading packages…</div>
          </div>
        </div>`;
    },

    _renderBody(){
      const body = document.getElementById('shopBody');
      if(!body) return;
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
      const primaryIcon       = isPrimaryCoins ? '🪙' : '💎';
      const secondaryVal      = isPrimaryCoins ? p.diamonds : p.coins;
      const secondaryIcon     = isPrimaryCoins ? '💎' : '🪙';
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
            <div class="shop-confirm-q">Convert ${amount} 💎 to ${coins.toLocaleString()} 🪙?</div>
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
          <div class="shop-convert-rate">Rate: 1 💎 = ${this.rate.toLocaleString()} 🪙 · Non-refundable</div>
          <div class="shop-convert-have">You have <b>${have.toLocaleString()}</b> 💎</div>
          <div class="shop-convert-presets">
            ${presetBtns}
            <button class="shop-preset ${amount===have && have>0?'on':''}" ${maxDisabled?'disabled':''} onclick="Shop.setConvertAmount(${have})">MAX</button>
          </div>
          <div class="shop-convert-line">
            <span class="shop-convert-amt">${amount} 💎</span>
            <span class="shop-convert-arrow">→</span>
            <span class="shop-convert-out">${coins.toLocaleString()} 🪙</span>
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
      this._renderBody();
    },

    // Server sends back the full updated user — sync into S.user + animate
    // every header display that shows coins/diamonds so the new balances
    // are visible everywhere immediately.
    _applyUserUpdate(user){
      if(!user) return;
      S.user.coins    = user.coins;
      S.user.diamonds = user.diamonds;
      if(typeof _animateCount === 'function'){
        _animateCount('hcoins',    user.coins);
        _animateCount('scoins',    user.coins);
        _animateCount('heroCoins', user.coins);
        _animateCount('hdiamonds', user.diamonds);
      }
    },
  };

  function showShop(initialTab){ Shop.open(initialTab); }
  function _ensureShopStyles(){ /* shop CSS lives in main.css — kept here as a hook for future inline injection if needed */ }
