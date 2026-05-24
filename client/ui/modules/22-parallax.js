  /* ═══════════════════════════════════════════
     PARALLAX — unified layered depth response for the lobby (CSS only).

     The WebGL atmosphere (LobbyScene) already parallaxes its camera at
     the deepest layer. The CSS .lobby-3d cards already parallax via
     initLobbyFx at mid-depth. This module fills the gap: it ties the
     remaining DOM layers (vignette / particles / room grid / hero /
     header / side panels) into the SAME camera space with depth-
     weighted strengths.

     Strongest response: atmospheric overlays (.lobby-fx, weather).
     Medium response   : .rgrid / .livegrid / .lobby-hero.
     Very subtle       : .lhdr / .lside / .lrail — almost imperceptible
                         but keeps the UI feeling like part of the same
                         physical space, not a flat layer pasted on top.

     Pointer is smoothed via a lerp so the response feels cinematic,
     never twitchy. Compositor-only transforms (translate3d) — zero
     layout, zero paint, zero stalls.

     Same lifecycle discipline as RoomScene / LobbyScene:
     boot on goLobby (1300ms after intro), stop on showScreen-off-lobby,
     stop on tab hidden. Reduced-motion + touch-only devices stay
     disabled forever — UI never moves on them.
     ═══════════════════════════════════════════ */
  const Parallax={
    enabled:false, disabled:false, raf:null,
    mx:0, my:0, cx:0, cy:0,
    layers:[],
    _pointer:null,

    /* ── lifecycle ── */
    boot(){
      if(this.enabled||this.disabled) return;
      if(matchMedia('(prefers-reduced-motion:reduce)').matches){ this.disabled=true; return; }
      if(!matchMedia('(hover: hover)').matches){ this.disabled=true; return; }   // touch-only devices stay flat
      if(matchMedia('(pointer:coarse)').matches && innerWidth<720){ this.disabled=true; return; }
      this._collectLayers();
      if(!this.layers.length){ this.disabled=true; return; }
      this._attachPointer();
      this.enabled=true;
    },
    start(){
      if(!this.enabled||this.raf||this.disabled) return;
      this._startLoop();
    },
    stop(){
      if(this.raf){ cancelAnimationFrame(this.raf); this.raf=null; }
      this._reset();
    },

    _collectLayers(){
      // [selector, max-X-translation-px, max-Y-translation-px]
      // Strength tiers (strongest → subtlest):
      const TIERS=[
        // MID — atmospheric overlays
        ['.lobby-fx',       8, 8],
        ['.lobby-weather',  4, 4],
        ['.event-layer',    3, 3],
        // NEAR — content blocks
        ['#rgrid',          6, 6],
        ['#livegrid',       6, 6],
        ['.lobby-hero',     3, 3],
        // TOP — UI (very subtle — keeps the panels in the same camera space)
        ['.lhdr',           2, 0],
        ['.lside',          1.5, 0],
        ['.lrail',          1.5, 0],
      ];
      this.layers=[];
      for(const [sel, sx, sy] of TIERS){
        const el=document.querySelector(sel);
        if(el) this.layers.push({ el, sx, sy });
      }
    },

    _attachPointer(){
      this._pointer=(e)=>{
        this.mx=e.clientX/innerWidth-0.5;
        this.my=e.clientY/innerHeight-0.5;
      };
      // Listen on the lobby itself so pointermove outside it doesn't fire (off-lobby cost = 0).
      document.getElementById('lobby-screen')?.addEventListener('pointermove', this._pointer, {passive:true});
    },

    _startLoop(){
      const tick=()=>{
        this.raf=requestAnimationFrame(tick);
        // Lerp smoothing — 0.05/frame ≈ ~330ms half-life at 60fps.
        // Reads as cinematic 'breathing,' never as 'follow the mouse.'
        this.cx += (this.mx-this.cx)*0.05;
        this.cy += (this.my-this.cy)*0.05;
        // Skip writing transforms when the lerped position is essentially settled —
        // avoids sub-pixel paint thrash during idle moments.
        const dx=Math.abs(this.mx-this.cx), dy=Math.abs(this.my-this.cy);
        if(dx<0.0008 && dy<0.0008) return;
        for(const L of this.layers){
          const tx = L.sx ? (-this.cx*L.sx).toFixed(2) : 0;
          const ty = L.sy ? (-this.cy*L.sy).toFixed(2) : 0;
          L.el.style.transform = `translate3d(${tx}px,${ty}px,0)`;
        }
      };
      this.raf=requestAnimationFrame(tick);
    },

    _reset(){
      // Clear every inline transform we set so layers return to their natural position
      // when the lobby is not active. (Other CSS transforms in stylesheets are unaffected
      // since we only touch inline style.transform.)
      for(const L of this.layers){
        if(L.el) L.el.style.transform = '';
      }
    },
  };
