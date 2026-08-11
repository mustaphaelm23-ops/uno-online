  /* ═══════════════ MOBILE — AUTO LANDSCAPE (Free-Fire style) ═══════════════
     Goal: on a phone the game always shows in a wide landscape layout, at full
     readable size (NO shrink-to-fit — that made everything tiny).

     Two mechanisms, best-effort:
       1. NATIVE rotation — like Free Fire / PES. On the first tap we request
          fullscreen + screen.orientation.lock('landscape'). On Android Chrome
          (and installed PWAs, via manifest "orientation":"landscape") the phone
          physically rotates and the game renders at native size. iOS Safari does
          not support this, so it silently no-ops and we use #2.
       2. CSS fallback — when the device is still held in PORTRAIT we rotate the
          whole app 90° at FULL device size (no scaling) so it reads as landscape.
          When already in LANDSCAPE we don't rotate; we only keep the desktop
          lobby layout overrides so it looks the same either way.

     We never touch <meta viewport> (that broke detection / oscillated). Detection
     uses window.inner*, accurate because the meta is untouched. Auth screen stays
     upright in portrait so sign-in is easy. */

  const MobileRotate = {
    _installed: false,
    _state:     'off',     // 'off' | 'rotate' | 'native'
    _locked:    false,

    isSmall(){ return Math.min(innerWidth, innerHeight) < 820; },   // phone / narrow window
    isPortrait(){ return innerHeight > innerWidth; },

    init(){
      if(this._installed) return;
      this._installed = true;
      _ensureRotateStyles();

      const refresh = () => this.refresh();
      window.addEventListener('resize', refresh);
      window.addEventListener('orientationchange', refresh);
      screen?.orientation?.addEventListener?.('change', refresh);

      // Free-Fire-style native flip: needs a user gesture, so try on each tap
      // until the OS grants the lock (then stop trying).
      const tryLock = () => this.lockLandscape();
      window.addEventListener('pointerdown', tryLock, true);
      window.addEventListener('touchend', tryLock, true);

      try{
        const obs = new MutationObserver(refresh);
        document.querySelectorAll('.screen').forEach(s =>
          obs.observe(s, { attributes:true, attributeFilter:['class'] }));
        this._obs = obs;
      }catch(e){}
      requestAnimationFrame(refresh);
      setTimeout(refresh, 300);
      setTimeout(refresh, 900);
    },

    // Ask the OS to physically rotate to landscape (Android / supported
    // browsers) — the FIFA/PUBG-style hard lock. Re-attempts if the lock was
    // ever released (e.g. leaving fullscreen), so the game stays landscape.
    async lockLandscape(){
      if(!this.isSmall()) return;
      const o = screen.orientation;
      const reallyLocked = this._locked && o && /landscape/.test(o.type || '');
      if(reallyLocked) return;
      try{
        const el = document.documentElement;
        if(!document.fullscreenElement && el.requestFullscreen){
          await el.requestFullscreen({ navigationUI:'hide' }).catch(()=>{});
        }
        if(o && o.lock){
          await o.lock('landscape').then(()=>{ this._locked = true; }).catch(()=>{});
        }
      }catch(e){ /* iOS Safari: unsupported → CSS fallback handles it */ }
    },

    // Release any OS landscape lock so the phone can rotate to portrait
    // (used when entering chess). Best-effort; iOS Safari no-ops.
    unlockOrientation(){
      try{
        const o = screen.orientation;
        if(o && o.unlock){ o.unlock(); this._locked = false; }
      }catch(e){}
    },

    refresh(){
      const authActive = document.getElementById('auth-screen')?.classList.contains('active');
      // The whole app is LANDSCAPE-LOCKED on a phone (FIFA / PUBG style): if the
      // device is portrait we CSS-rotate the app to landscape; if it's already
      // landscape we render native. Either way the player always sees a fixed
      // landscape screen — flipping the phone never reshapes anything.
      let want = 'off';
      if(!authActive && this.isSmall()){
        want = this.isPortrait() ? 'rotate' : 'native';
      }
      this._apply(want);
    },

    _apply(state){
      const html = document.documentElement;
      const body = document.body;
      const w = window.innerWidth, h = window.innerHeight;

      if(state === 'rotate'){
        // Full size, no scaling — body becomes a landscape box of the device's
        // own pixels, rotated to fill the upright (portrait) viewport.
        html.classList.add('force-landscape', 'force-rotate');
        body.style.width     = h + 'px';
        body.style.height    = w + 'px';
        body.style.transform = 'translateY(' + h + 'px) rotate(-90deg)';
      } else if(state === 'native'){
        // Already landscape (native flip succeeded, or held sideways) — keep the
        // desktop lobby overrides but no rotation.
        html.classList.add('force-landscape');
        html.classList.remove('force-rotate');
        body.style.width = ''; body.style.height = ''; body.style.transform = '';
      } else {
        html.classList.remove('force-landscape', 'force-rotate');
        body.style.width = ''; body.style.height = ''; body.style.transform = '';
      }
      this._state = state;
    },
  };
  window.MobileRotate = MobileRotate;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>MobileRotate.init(), { once:true });
  } else {
    MobileRotate.init();
  }

  function _ensureRotateStyles(){
    if(document.getElementById('mobileRotateStyles')) return;
    const s = document.createElement('style');
    s.id = 'mobileRotateStyles';
    s.textContent = `
      /* ── Rotation (portrait fallback), full device size ── */
      html.force-rotate{ overflow:hidden; }
      html.force-rotate body{
        position:fixed; top:0; left:0;
        transform-origin:top left;
        overflow:hidden; margin:0;
        /* width / height / transform set inline by JS */
      }
      html.force-rotate .gwrap,
      html.force-rotate .profile-fullscreen{
        width:100% !important; height:100% !important;
        max-width:100% !important; max-height:100% !important; min-height:100% !important;
      }
      /* vh-sized fullscreen overlays (Ranked ready/result use min-height:100vh)
         must size against the ROTATED body, not the physical portrait viewport —
         otherwise the screen visibly reshapes when the phone is turned. */
      html.force-rotate .rmo-premium{ height:100% !important; }
      html.force-rotate .rmo-premium .rmo-scroll{ min-height:100% !important; }

      /* ── Desktop lobby layout (applied in BOTH rotated + native landscape) ──
         The @media(max-width:768) rules collapse the lobby into the cramped
         mobile column; these restore the sidebar | rooms | friends layout with
         all four game cards in one row. Compact widths so they fit at full size
         on a ~930px-wide phone screen. */
      html.force-landscape #lobby-screen{ overflow:hidden !important; }
      html.force-landscape #lobby-screen .lbody{
        flex-direction:row !important; height:100% !important;
        overflow:hidden !important; flex:1 1 auto !important;
      }
      html.force-landscape #lobby-screen .lside{
        width:200px !important; flex:0 0 200px !important;
        flex-direction:column !important; flex-wrap:nowrap !important;
        border-right:1px solid var(--border) !important; border-bottom:none !important;
        overflow-y:auto !important; max-height:none !important;
        padding:13px 11px !important;
      }
      html.force-landscape #lobby-screen .lside-section{
        display:flex !important; flex-direction:column !important;
        gap:8px !important; width:auto !important; margin-bottom:13px !important;
      }
      html.force-landscape #lobby-screen .lside .lbtn.lbtn-main{
        padding:10px 12px !important; border-radius:12px !important; margin-bottom:0 !important;
      }
      html.force-landscape #lobby-screen .lside .lbtn-main .lbtn-sub{ display:block !important; }
      html.force-landscape #lobby-screen .lside .lbtn-main .lbtn-chev{ display:flex !important; }
      html.force-landscape #lobby-screen .lside .lbtn-main .lbtn-icon{ width:36px !important; height:36px !important; font-size:18px !important; }
      html.force-landscape #lobby-screen .lside .stitle{ width:auto !important; }
      html.force-landscape #lobby-screen .lmain{
        flex:1 1 auto !important; overflow-y:auto !important; padding:14px !important;
      }
      html.force-landscape #lobby-screen .lrail{ display:flex !important; width:200px !important; flex:0 0 200px !important; }
      html.force-landscape #lobby-screen .rgrid{
        grid-template-columns:repeat(4, 1fr) !important; gap:12px !important;
      }
      /* Compact the featured tiles in landscape-phone mode. At the desktop
         172px hero height the 4 tiles + the CREATE/JOIN banners overflowed the
         short viewport, so the row got clipped mid-artwork. These sizes let a
         whole tile — art, title and entry pill — sit on screen at once. */
      html.force-landscape #lobby-screen .rt-feat-hero{ height:118px !important; margin-top:4px !important; }
      html.force-landscape #lobby-screen .rtable-featured{ padding:8px !important; }
      html.force-landscape #lobby-screen .rtable-name{ font-size:12px !important; letter-spacing:.6px !important; }
      html.force-landscape #lobby-screen .rtable-sub{ font-size:9.5px !important; }
      html.force-landscape #lobby-screen .rtable-foot{ margin-top:6px !important; }
      html.force-landscape #lobby-screen .rtable-entry-pill{ font-size:10.5px !important; padding:4px 10px !important; }
      html.force-landscape #lobby-screen .ctaPair{ gap:12px !important; margin-top:12px !important; }
      /* keep the fixed aspect-ratio (both tiles identical); just trim padding */
      html.force-landscape #lobby-screen .ctaTile{ padding:8px 12px !important; }
    `;
    document.head.appendChild(s);
  }

  /* ═══ ROTATED-MODE SCROLL FIX ═══
     Under html.force-rotate the whole body is CSS-rotated -90° so the phone
     (still physically portrait) displays landscape. Touch events (clientX/Y)
     are always reported in PHYSICAL screen space — untouched by the CSS
     transform — so native overflow-y scrolling ends up dragging on the wrong
     axis / backwards. That's exactly what read as "scroll comes out mirrored".

     Fix: while rotated, take scrolling over ourselves — track the raw touch
     delta in physical space and drive scrollTop/scrollLeft from it directly
     (scrollTop += ΔclientX, scrollLeft -= ΔclientY). The exact sign was
     confirmed by hand on-device (2026-07-20): the corner-geometry derivation
     from the `translateY(h) rotate(-90deg)` transform gave the OPPOSITE sign
     of what actually felt right, so trust this tested mapping over re-deriving
     it from the transform math. */
  let _rsTrack = null, _rsRaf = null;
  function _rsFindScrollable(node){
    while(node && node !== document.body){
      if(node.nodeType === 1){
        const cs = getComputedStyle(node);
        const canY = /(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 1;
        const canX = /(auto|scroll)/.test(cs.overflowX) && node.scrollWidth  > node.clientWidth  + 1;
        if(canY || canX) return node;
      }
      node = node.parentNode;
    }
    return null;
  }
  // A tap must NEVER be stolen by the scroll handler. We only start driving
  // scroll (and calling preventDefault, which suppresses the browser's click)
  // AFTER the finger has travelled past this slop radius. Below it the gesture
  // is treated as a tap and passes straight through to buttons — this is the
  // fix for "sometimes the × / a button doesn't respond": a tap with a few px
  // of jitter over a scrollable panel used to get its click eaten.
  const _RS_SLOP = 10;   // px
  function _rsOnStart(e){
    if(!document.documentElement.classList.contains('force-rotate')) return;
    const t = e.touches && e.touches[0]; if(!t) return;
    const el = _rsFindScrollable(e.target);
    if(!el) return;
    if(_rsRaf){ cancelAnimationFrame(_rsRaf); _rsRaf = null; }
    _rsTrack = { el, startX:t.clientX, startY:t.clientY, lastX:t.clientX, lastY:t.clientY,
                 vx:0, vy:0, lastT:performance.now(), engaged:false };
  }
  function _rsOnMove(e){
    if(!_rsTrack) return;
    const t = e.touches && e.touches[0]; if(!t) return;
    // Until the finger clears the slop radius, do nothing — let the tap through
    // so its click reaches the button underneath.
    if(!_rsTrack.engaged){
      if(Math.hypot(t.clientX - _rsTrack.startX, t.clientY - _rsTrack.startY) < _RS_SLOP) return;
      _rsTrack.engaged = true;                 // real drag → we take over scrolling
      _rsTrack.lastX = t.clientX; _rsTrack.lastY = t.clientY; _rsTrack.lastT = performance.now();
    }
    const now = performance.now();
    const dx = t.clientX - _rsTrack.lastX;
    const dy = t.clientY - _rsTrack.lastY;
    const dt = Math.max(1, now - _rsTrack.lastT);
    // Signs flipped from the first pass (2026-07-20) — measured wrong-direction
    // in hand, the corner-derivation had a sign error. This is the verified
    // direction: matches a normal "drag content up to scroll down" feel.
    _rsTrack.el.scrollTop  += dx;
    _rsTrack.el.scrollLeft -= dy;
    _rsTrack.vx = dx / dt; _rsTrack.vy = dy / dt;
    _rsTrack.lastX = t.clientX; _rsTrack.lastY = t.clientY; _rsTrack.lastT = now;
    e.preventDefault();             // stop the browser's own (wrong-axis) scroll attempt
  }
  function _rsOnEnd(){
    if(!_rsTrack) return;
    const track = _rsTrack; _rsTrack = null;
    if(!track.engaged) return;                          // was a tap, not a drag — nothing to fling
    let vx = track.vx * 16, vy = track.vy * 16;         // px/frame at release
    if(Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) return;
    const step = () => {
      vx *= 0.92; vy *= 0.92;
      track.el.scrollTop  += vx;
      track.el.scrollLeft -= vy;
      if(Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) _rsRaf = requestAnimationFrame(step);
      else _rsRaf = null;
    };
    _rsRaf = requestAnimationFrame(step);
  }
  document.addEventListener('touchstart',  _rsOnStart, { passive:true  });
  document.addEventListener('touchmove',   _rsOnMove,  { passive:false });
  document.addEventListener('touchend',    _rsOnEnd,   { passive:true  });
  document.addEventListener('touchcancel', _rsOnEnd,   { passive:true  });
