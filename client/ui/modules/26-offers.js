  /* ═══════════════ SPECIAL OFFERS (GDD §3.3.I) ═══════════════
     Floating bottom-right banner. On goLobby it fetches /api/offers/current
     and renders the banner if there's an active, unclaimed, unexpired offer.
     Counts down to endsAt via a 1s interval and auto-hides at expiry. Click
     "VIEW OFFER" opens a small claim modal (demo mode — claim grants coins
     + diamonds instantly, same parallel as /api/shop/purchase). Dismiss
     hides the banner for the current session (localStorage). */

  const Offers = {
    current:        null,    // last fetched offer payload
    endsAt:         null,
    alreadyClaimed: false,
    _tickTimer:     null,
    _sessionKey:    'uno_offer_dismissed_session',

    async refresh(){
      try{
        const d = await apiFetch('/api/offers/current');
        this.current        = d.offer || null;
        this.endsAt         = d.endsAt || null;
        this.alreadyClaimed = !!d.alreadyClaimed;
        this._render();
      }catch(e){
        // Silent — offers are a marketing surface, not a critical path.
        console.warn('[Offers] refresh failed:', e?.message || e);
      }
    },

    _render(){
      const el = document.getElementById('offerBanner');
      if(!el) return;
      const dismissed = this._sessionDismissed();
      const expired   = this.endsAt && this.endsAt <= Date.now();
      const should    = !!this.current && !this.alreadyClaimed && !expired && !dismissed;
      if(!should){
        el.style.display = 'none';
        this._stopTick();
        return;
      }
      const o = this.current;
      document.getElementById('offerBadge').textContent    = o.badge || '🎁';
      document.getElementById('offerTitle').textContent    = o.title || 'SPECIAL OFFER!';
      document.getElementById('offerHeadline').textContent = o.headline || '';
      document.getElementById('offerSub').textContent      = o.sub || '';
      this._updateTimerText();
      el.style.display = '';
      // Stagger a small entry animation by re-triggering the keyframe.
      el.classList.remove('show');
      // eslint-disable-next-line no-unused-expressions
      void el.offsetWidth;
      el.classList.add('show');
      this._startTick();
    },

    _startTick(){
      if(this._tickTimer) return;
      this._tickTimer = setInterval(()=>this._updateTimerText(), 1000);
    },
    _stopTick(){
      if(this._tickTimer){ clearInterval(this._tickTimer); this._tickTimer = null; }
    },

    _updateTimerText(){
      const tEl = document.getElementById('offerTimer');
      if(!tEl) return;
      if(!this.endsAt) { tEl.textContent = '—'; return; }
      const remaining = this.endsAt - Date.now();
      if(remaining <= 0){
        tEl.textContent = 'Expired';
        this._stopTick();
        this._render();                                  // hide via the should-not branch
        return;
      }
      tEl.textContent = this._fmtRemaining(remaining);
    },

    _fmtRemaining(ms){
      const total = Math.floor(ms / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
    },

    dismiss(){
      try{ sessionStorage.setItem(this._sessionKey, '1'); }catch(e){}
      const el = document.getElementById('offerBanner');
      if(el) el.style.display = 'none';
      this._stopTick();
    },
    _sessionDismissed(){
      try{ return sessionStorage.getItem(this._sessionKey) === '1'; }catch(e){ return false; }
    },

    // VIEW OFFER opens a small confirm modal so the claim isn't a single-click
    // accident. Reuses the toast + apiFetch infrastructure; on success, the
    // banner re-renders into the "already claimed" hidden state.
    view(){
      if(!this.current) return;
      const o = this.current;
      const old = document.getElementById('offerModal'); if(old) old.remove();
      const ov = document.createElement('div');
      ov.id = 'offerModal';
      ov.className = 'offer-modal';
      ov.innerHTML = `
        <div class="offer-modal-panel">
          <button class="offer-modal-close" onclick="Offers._closeModal()" aria-label="Close">×</button>
          <div class="offer-modal-badge">${esc(o.badge || '🎁')}</div>
          <div class="offer-modal-title">${esc(o.title || 'Special Offer')}</div>
          <div class="offer-modal-headline">${esc(o.headline || '')}</div>
          <div class="offer-modal-sub">${esc(o.sub || '')}</div>
          <div class="offer-modal-rewards">
            <div class="offer-modal-reward"><div class="omr-ic">🪙</div><div class="omr-val">+${(o.coins||0).toLocaleString()}</div></div>
            <div class="offer-modal-reward"><div class="omr-ic">💎</div><div class="omr-val">+${(o.diamonds||0).toLocaleString()}</div></div>
          </div>
          <div class="offer-modal-demo">🧪 DEMO MODE — no real money charged.</div>
          <button class="offer-modal-claim" onclick="Offers.claim()">Claim now</button>
        </div>`;
      document.body.appendChild(ov);
      ov.addEventListener('mousedown', e => { if(e.target === ov) this._closeModal(); });
      requestAnimationFrame(()=> ov.classList.add('show'));
    },

    _closeModal(){
      const ov = document.getElementById('offerModal');
      if(!ov) return;
      ov.classList.add('out');
      setTimeout(()=> ov.remove(), 200);
    },

    async claim(){
      if(!this.current) return;
      const id = this.current.id;
      try{
        const d = await apiFetch(`/api/offers/claim/${encodeURIComponent(id)}`, { method: 'POST' });
        // Sync the new balances + animate the header pills via the canonical helper.
        if(typeof _syncUserCurrencies === 'function') _syncUserCurrencies(d.user);
        const tag = d.simulated ? ' (demo)' : '';
        toast(`✓ Claimed${tag} — +${(d.offer?.coins||0).toLocaleString()} 🪙 +${(d.offer?.diamonds||0).toLocaleString()} 💎`, 's');
        this.alreadyClaimed = true;
        this._closeModal();
        this._render();
      }catch(e){
        console.error('[Offers] claim failed:', e);
        const msg = e?.status === 409 ? 'Already claimed'
                  : e?.status === 410 ? 'Offer expired'
                  : (e?.message || 'Claim failed');
        toast(msg, 'e');
      }
    },
  };

  // Hook into goLobby — called for every lobby entry. We attach by wrapping
  // the existing goLobby so we don't have to edit 12-lobby.js. Idempotent.
  (function _hookOffersIntoLobby(){
    const origGoLobby = window.goLobby;
    if(typeof origGoLobby !== 'function') return;
    if(origGoLobby._offersHooked) return;
    function goLobbyWithOffers(...args){
      const out = origGoLobby.apply(this, args);
      // Defer briefly so the lobby DOM is mounted + banner element exists.
      setTimeout(()=>Offers.refresh(), 50);
      return out;
    }
    goLobbyWithOffers._offersHooked = true;
    window.goLobby = goLobbyWithOffers;
  })();
