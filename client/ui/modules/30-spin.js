  /* ═══════════════ DAILY SPIN WHEEL ═══════════════
     Once-per-24h prize wheel. Server picks the winning segment; the
     client just animates the wheel to stop on it. After the reveal,
     coins/diamonds pills tick up and the banner flips into cooldown
     mode (countdown timer). */
  const SpinWheel = {
    rewards: null,
    ready: false,
    nextSpinAt: 0,
    spinning: false,
    _tickTimer: null,

    async refresh(){
      try{
        const d = await apiFetch('/api/spin/status');
        this.rewards    = d.rewards || [];
        this.ready      = !!d.ready;
        this.nextSpinAt = d.nextSpinAt || 0;
        this._renderBanner();
        this._startTick();
        // Push the bell badge so "Daily Spin is ready" surfaces in the
        // Notifications panel — that's the only entry point now that
        // the lobby spin tile is hidden.
        try{ Notifs?.refreshBadge?.(); }catch(e){}
      }catch(e){ /* silent — banner stays in its default state */ }
    },

    open(){
      if(this.spinning) return;
      this._ensureStyles();
      // If we haven't loaded the reward table yet, pull it before opening.
      if(!this.rewards) this.refresh();
      const old = document.getElementById('spinModal'); if(old) old.remove();
      const ov = document.createElement('div');
      ov.id = 'spinModal';
      ov.innerHTML = this._shellHTML();
      document.body.appendChild(ov);
      ov.addEventListener('mousedown', e => { if(e.target === ov && !this.spinning) this.close(); });
      requestAnimationFrame(()=> ov.classList.add('show'));
      try{ SFX.play('open'); }catch(e){}
      this._renderWheel();
      this._renderState();
    },
    close(){
      const ov = document.getElementById('spinModal'); if(!ov) return;
      ov.classList.add('out');
      setTimeout(()=> ov.remove(), 220);
    },

    async spin(){
      if(this.spinning) return;
      if(!this.ready)   return toast('Spin not ready yet','w');
      this.spinning = true;
      const btn = document.getElementById('spinGo');
      if(btn){ btn.disabled = true; btn.classList.add('disabled'); btn.textContent = 'SPINNING...'; }
      const wheel = document.querySelector('.spin-wheel');
      // Anticipation wobble — small back-and-forth jitter before the launch.
      if(wheel){
        wheel.style.transition = 'transform .14s ease-out';
        wheel.style.transform  = 'rotate(-12deg)';
        await new Promise(r => setTimeout(r, 140));
        wheel.style.transform  = 'rotate(6deg)';
        await new Promise(r => setTimeout(r, 110));
      }
      try{
        const d = await apiFetch('/api/spin/wheel', { method:'POST' });
        const idx = d.rewardIndex|0;
        const n = (this.rewards||[]).length || 8;
        const segDeg = 360 / n;
        // Spin 5-7 full turns, then land in the middle of the target segment.
        // The pointer is at the TOP (12 o'clock). Segment 0 is centered at
        // 12 o'clock, so target rotation = -idx*segDeg (negative because
        // we want segment[idx] to rotate UP under the pointer).
        const fullSpins = 5 + Math.floor(Math.random() * 3);
        const target    = fullSpins * 360 - idx * segDeg;
        try{ SFX.play('uno'); }catch(e){}
        if(wheel){
          wheel.style.transition = 'transform 4.4s cubic-bezier(.16,.85,.25,1.02)';
          wheel.style.transform  = `rotate(${target}deg)`;
        }
        // Schedule tick sounds with decreasing frequency as the wheel slows.
        // The cubic-bezier(.16,.85,.25,1.02) easing front-loads the motion,
        // so most segment crossings happen in the first ~2.5s; we space
        // ticks more densely early, then thin them out in the final stretch
        // for that classic "tick... tick.... tick....." carnival cadence.
        this._scheduleTicks(4400);
        // Hold the full ride, then reveal.
        setTimeout(()=>{
          if(S.user){
            if(typeof d.coins    === 'number') S.user.coins    = d.coins;
            if(typeof d.diamonds === 'number') S.user.diamonds = d.diamonds;
            try{ localStorage.setItem('uno_user', JSON.stringify(S.user)); }catch(e){}
            _animateCount?.('hcoins',    S.user.coins    || 0);
            _animateCount?.('hdiamonds', S.user.diamonds || 0);
          }
          this.ready = false;
          this.nextSpinAt = d.nextSpinAt || (Date.now() + 86400000);
          try{ SFX.play('win'); }catch(e){}
          this._showReward(d.reward);
          this._renderBanner();
        }, 4500);
      }catch(e){
        const msg = e?.message || 'Could not spin';
        toast(msg, 'e');
        if(btn){ btn.disabled = false; btn.classList.remove('disabled'); btn.textContent = 'SPIN'; }
        this.spinning = false;
      }
    },

    // Distribute click ticks unevenly across the spin duration: ~24 ticks,
    // dense at the start, sparse at the end (matches the cubic-bezier
    // deceleration curve so each tick feels tied to a segment passing).
    _scheduleTicks(totalMs){
      const ticks = 24;
      for(let i = 0; i < ticks; i++){
        // Quadratic ease-out spacing — fraction = sqrt(i/(ticks-1))
        const frac = Math.sqrt(i / (ticks - 1));
        const at   = Math.floor(frac * totalMs);
        setTimeout(()=>{ try{ SFX.play('click'); }catch(e){} }, at);
      }
    },

    /* ────── HTML / CSS ────── */
    _shellHTML(){
      return `
        <div class="spin-panel" role="dialog" aria-label="Daily Spin">
          <button class="spin-close" onclick="SpinWheel.close()" aria-label="Close">×</button>
          <div class="spin-head">
            <div class="spin-eyebrow">DAILY REWARD</div>
            <div class="spin-title">LUCKY SPIN</div>
            <div class="spin-sub">Free once every 24 hours — guaranteed reward.</div>
          </div>
          <div class="spin-stage">
            <div class="spin-pointer" aria-hidden="true"></div>
            <div class="spin-wheel-wrap">
              <svg class="spin-wheel" viewBox="-100 -100 200 200" aria-hidden="true">
                <defs>
                  <!-- Top-left glossy highlight overlay sweeping across the wheel.
                       Pinned to the OUTER svg (not inside .spin-wheel) would be
                       ideal, but keeping it inside is simpler and we tolerate
                       the highlight rotating with the wheel — it reads as a
                       light source moving with it. -->
                  <radialGradient id="spinGloss" cx="32%" cy="28%" r="78%">
                    <stop offset="0%"   stop-color="#ffffff" stop-opacity=".55"/>
                    <stop offset="40%"  stop-color="#ffffff" stop-opacity=".15"/>
                    <stop offset="70%"  stop-color="#ffffff" stop-opacity="0"/>
                  </radialGradient>
                  <radialGradient id="spinHubGloss" cx="35%" cy="30%" r="70%">
                    <stop offset="0%"   stop-color="#FFF7E0"/>
                    <stop offset="45%"  stop-color="#FBBF24"/>
                    <stop offset="100%" stop-color="#B45309"/>
                  </radialGradient>
                </defs>
                <g class="spin-segs"></g>
                <!-- Glossy highlight overlay -->
                <circle r="100" fill="url(#spinGloss)" pointer-events="none"></circle>
                <g class="spin-labels"></g>
                <!-- Edge tick marks between segments -->
                <g class="spin-ticks"></g>
                <!-- Center hub with UNO wordmark -->
                <g class="spin-hub-g">
                  <circle r="26" fill="url(#spinHubGloss)" stroke="#3B1A00" stroke-width="2"/>
                  <text y="4" text-anchor="middle" font-family="Bangers,cursive"
                        font-size="10" font-weight="900" letter-spacing="0"
                        fill="#3B1A00">Cardora</text>
                </g>
              </svg>
            </div>
          </div>
          <div class="spin-status" id="spinStatus"></div>
          <button class="spin-go" id="spinGo" onclick="SpinWheel.spin()">SPIN</button>
        </div>`;
    },

    _renderWheel(){
      if(!this.rewards) return;
      const segs   = document.querySelector('#spinModal .spin-segs');
      const lbls   = document.querySelector('#spinModal .spin-labels');
      const ticks  = document.querySelector('#spinModal .spin-ticks');
      if(!segs || !lbls || !ticks) return;
      const n = this.rewards.length;
      const segDeg = 360 / n;
      const r = 100;          // SVG viewBox radius
      let segHTML = '', lblHTML = '', tickHTML = '', defsHTML = '';
      for(let i = 0; i < n; i++){
        // Each segment spans from (i*segDeg - segDeg/2) to (i*segDeg + segDeg/2),
        // so segment 0 is centered at 0° (top, where the pointer is).
        const start = (i * segDeg - segDeg/2 - 90) * Math.PI / 180;
        const end   = (i * segDeg + segDeg/2 - 90) * Math.PI / 180;
        const x1 = (Math.cos(start) * r).toFixed(2);
        const y1 = (Math.sin(start) * r).toFixed(2);
        const x2 = (Math.cos(end)   * r).toFixed(2);
        const y2 = (Math.sin(end)   * r).toFixed(2);
        const large = segDeg > 180 ? 1 : 0;
        const path = `M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
        const tint = this.rewards[i].color || '#A78BFA';
        // Per-segment radial gradient: bright at the outer edge, deeper
        // at the hub, giving each wedge a glossy 3D feel instead of flat.
        const dark = this._darken(tint, 0.35);
        const id = `segGrad${i}`;
        defsHTML += `<radialGradient id="${id}" cx="50%" cy="50%" r="100%">
          <stop offset="0%"  stop-color="${dark}"/>
          <stop offset="60%" stop-color="${tint}"/>
          <stop offset="100%" stop-color="${this._lighten(tint, 0.2)}"/>
        </radialGradient>`;
        segHTML += `<path d="${path}" fill="url(#${id})" stroke="#0b0f1e" stroke-width="1.2"></path>`;
        // Label sits 64% out from the center along the bisector.
        const midRad = (i * segDeg - 90) * Math.PI / 180;
        const lx = (Math.cos(midRad) * r * 0.62).toFixed(2);
        const ly = (Math.sin(midRad) * r * 0.62).toFixed(2);
        const rot = (i * segDeg);
        lblHTML += `<text x="${lx}" y="${ly}" transform="rotate(${rot} ${lx} ${ly})"
          text-anchor="middle" dominant-baseline="middle"
          font-family="Bangers,cursive" font-size="14" font-weight="900"
          fill="#fff" stroke="#0b0f1e" stroke-width=".8" paint-order="stroke"
          >${this._escSvg(this.rewards[i].label)}</text>`;
        // Tick mark right on the segment boundary (just inside the rim).
        const tickAng = (i * segDeg + segDeg/2 - 90) * Math.PI / 180;
        const tx = (Math.cos(tickAng) * 92).toFixed(2);
        const ty = (Math.sin(tickAng) * 92).toFixed(2);
        tickHTML += `<circle cx="${tx}" cy="${ty}" r="2.2" fill="#FBBF24" stroke="#3B1A00" stroke-width=".8"/>`;
      }
      // Inject the per-segment gradient defs into the existing <defs>.
      const defs = document.querySelector('#spinModal .spin-wheel defs');
      if(defs){
        // Wipe any prior per-segment grads (idempotent re-render) before re-inserting.
        defs.querySelectorAll('[id^="segGrad"]').forEach(el => el.remove());
        defs.insertAdjacentHTML('beforeend', defsHTML);
      }
      segs.innerHTML  = segHTML;
      lbls.innerHTML  = lblHTML;
      ticks.innerHTML = tickHTML;
    },

    // Tiny color helpers — input is a hex like #FBBF24; output is a hex.
    _hexToRgb(hex){
      const m = String(hex||'').replace('#','');
      const v = m.length===3 ? m.split('').map(c=>c+c).join('') : m;
      const n = parseInt(v, 16);
      return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
    },
    _rgbToHex({r,g,b}){
      const h = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2,'0');
      return '#' + h(r) + h(g) + h(b);
    },
    _darken(hex, amt){
      const { r,g,b } = this._hexToRgb(hex);
      return this._rgbToHex({ r:r*(1-amt), g:g*(1-amt), b:b*(1-amt) });
    },
    _lighten(hex, amt){
      const { r,g,b } = this._hexToRgb(hex);
      return this._rgbToHex({ r:r+(255-r)*amt, g:g+(255-g)*amt, b:b+(255-b)*amt });
    },
    _escSvg(s){ return String(s||'').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); },

    _renderState(){
      const status = document.getElementById('spinStatus');
      const go = document.getElementById('spinGo');
      if(!status || !go) return;
      if(this.ready){
        status.innerHTML = `<span class="spin-status-dot"></span>Spin available now`;
        go.textContent   = 'SPIN';
        go.disabled      = false;
        go.classList.remove('disabled');
      } else {
        const ms = Math.max(0, this.nextSpinAt - Date.now());
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        status.innerHTML = `<span class="spin-status-dot off"></span>Next spin in ${h}h ${m}m`;
        go.textContent   = 'COME BACK SOON';
        go.disabled      = true;
        go.classList.add('disabled');
      }
    },

    _showReward(reward){
      // Inline burst inside the modal — no extra overlay.
      const stage = document.querySelector('#spinModal .spin-stage');
      if(!stage) return;
      const burst = document.createElement('div');
      const isJackpot = reward?.type === 'jackpot';
      burst.className = 'spin-reward' + (isJackpot ? ' jackpot' : '');
      burst.innerHTML = `
        <div class="spin-reward-eyebrow">${isJackpot ? '🎉 JACKPOT!' : 'YOU WON'}</div>
        <div class="spin-reward-amount">${this._escSvg(reward?.label || '')}</div>
        <div class="spin-reward-sub">${reward?.type === 'diamonds' ? 'Diamonds added' : (isJackpot ? '5,000 coins added' : 'Coins added')}</div>
        <button class="spin-reward-close" onclick="SpinWheel.close()">SWEET</button>
      `;
      stage.appendChild(burst);
      requestAnimationFrame(()=> burst.classList.add('on'));
      // Confetti burst behind it (modal-local).
      this._sparkBurst();
      // Jackpot adds a fullscreen confetti rain that goes for ~3s.
      if(isJackpot) this._confettiRain();
      this.spinning = false;
      this._renderState();
    },

    _sparkBurst(){
      const host = document.querySelector('#spinModal .spin-panel');
      if(!host) return;
      const N = 42;
      for(let i = 0; i < N; i++){
        const s = document.createElement('span');
        s.className = 'spin-spark';
        const ang = (Math.random() * 360) * Math.PI / 180;
        const dist = 140 + Math.random() * 160;
        const dx = Math.cos(ang) * dist;
        const dy = Math.sin(ang) * dist;
        const hue = 30 + Math.random() * 60;
        s.style.cssText = `--dx:${dx.toFixed(0)}px;--dy:${dy.toFixed(0)}px;--hue:${hue};animation-delay:${(Math.random()*180).toFixed(0)}ms;`;
        host.appendChild(s);
        setTimeout(()=> s.remove(), 1700);
      }
    },

    // Full-screen confetti rain (jackpot only). Spawned outside the modal
    // so the falling pieces cross the whole viewport.
    _confettiRain(){
      const host = document.createElement('div');
      host.className = 'spin-confetti-host';
      document.body.appendChild(host);
      const N = 90;
      for(let i = 0; i < N; i++){
        const c = document.createElement('span');
        c.className = 'spin-confetti';
        const startX = Math.random() * 100;
        const fall   = 2200 + Math.random() * 1600;
        const drift  = (Math.random() * 80 - 40);
        const rot    = (Math.random() * 720 - 360);
        const hue    = Math.floor(Math.random() * 360);
        const w = 6 + Math.random() * 6;
        const h = 8 + Math.random() * 10;
        c.style.cssText = `
          left:${startX}vw;
          width:${w.toFixed(0)}px;height:${h.toFixed(0)}px;
          background:hsl(${hue}, 92%, 60%);
          --drift:${drift.toFixed(0)}px;
          --rot:${rot.toFixed(0)}deg;
          animation-duration:${fall.toFixed(0)}ms;
          animation-delay:${(Math.random()*900).toFixed(0)}ms;
        `;
        host.appendChild(c);
      }
      setTimeout(()=> host.remove(), 4500);
    },

    /* ────── Banner state on the left rail ────── */
    _renderBanner(){
      const banner = document.getElementById('spinBanner');
      const sub    = document.getElementById('spinBannerSub');
      if(!banner || !sub) return;
      if(this.ready){
        banner.classList.add('ready');
        banner.classList.remove('cooldown');
        sub.textContent = 'Free reward · Tap to spin';
      } else {
        banner.classList.add('cooldown');
        banner.classList.remove('ready');
        const ms = Math.max(0, this.nextSpinAt - Date.now());
        const h  = Math.floor(ms / 3600000);
        const m  = Math.floor((ms % 3600000) / 60000);
        sub.textContent = ms <= 0 ? 'Ready to spin' : `Next spin in ${h}h ${m}m`;
        if(ms <= 0){ this.ready = true; banner.classList.add('ready'); banner.classList.remove('cooldown'); sub.textContent = 'Free reward · Tap to spin'; }
      }
    },
    _startTick(){
      clearInterval(this._tickTimer);
      this._tickTimer = setInterval(()=>{
        this._renderBanner();
        if(document.getElementById('spinModal')) this._renderState();
      }, 30_000);
    },

    _ensureStyles(){ /* spin CSS lives in main.css */ },
  };

  // Expose on window so inline onclick handlers (Notifs item callback,
  // legacy lobby tile references) can call SpinWheel.open() from any
  // event-attribute scope.
  window.SpinWheel = SpinWheel;

  // Auto-refresh shortly after the lobby loads so the banner shows
  // the correct ready/cooldown state without an explicit call.
  document.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(()=>{ if(S.token) SpinWheel.refresh(); }, 1500);
  });
