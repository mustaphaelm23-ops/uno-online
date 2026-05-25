  /* ═══════════════════════════════════════════
     ATMOSPHERE — shared environmental wash across every screen.

     ONE fixed-position body-level element. Soft edge vignette (centre
     stays clear so UI text reads normally) + a faint top/bottom light
     wash. Opacity gently breathes over 18s. Because it lives on <body>,
     every screen (Lobby / Room / Game / Battle Pass / Auth) sits inside
     the same atmospheric layer.

     Palette source priority:
       1. Active EVENT (--ev / --ev2 set on <body> by 03-events.js)
       2. Active THEME (per-theme palette set as --atmo-c1/--atmo-c2 here)
       3. Default amber / purple CSS fallback

     Discipline:
       - pointer-events: none — physically cannot intercept clicks.
       - z-index 60 → above screens, below modals (1000+) and pickers (1200+).
       - centre of viewport is transparent → UI / cards stay readable.
       - prefers-reduced-motion → disabled forever (no overlay built).
       - visibility hidden → animation paused via body class.
     ═══════════════════════════════════════════ */
  const _ATMO_PALETTE={
    neon:     { c1:'#F59E0B', c2:'#A855F7' },
    cyber:    { c1:'#00DCFF', c2:'#9628FF' },
    winter:   { c1:'#7DC1FF', c2:'#FFFFFF' },
    summer:   { c1:'#FFB454', c2:'#FF5577' },
    halloween:{ c1:'#FF7518', c2:'#9628B8' },
    gold:     { c1:'#FFD700', c2:'#FFB454' },
  };

  const Atmosphere={
    enabled:false, disabled:false,
    layer:null, _obs:null, _lastTheme:null,

    boot(){
      if(this.enabled||this.disabled) return;
      if(matchMedia('(prefers-reduced-motion:reduce)').matches){ this.disabled=true; return; }
      this._injectStyles();
      this._buildLayer();
      this._applyPalette(this._detectTheme());
      this._observeTheme();
      this._attachVisibility();
      this.enabled=true;
    },

    _injectStyles(){
      if(document.getElementById('atmosphere-css')) return;
      const s=document.createElement('style');
      s.id='atmosphere-css';
      s.textContent =
        '#atmosphere{position:fixed;inset:0;z-index:60;pointer-events:none;'+
          'will-change:opacity;'+
          // Centre stays mostly transparent (UI / cards / text untouched).
          'background:'+
            'radial-gradient(ellipse 92% 78% at 50% 50%,'+
              'transparent 48%,'+
              'color-mix(in srgb,var(--ev,var(--atmo-c1,#F59E0B)) 28%,transparent) 100%),'+
            'linear-gradient(180deg,'+
              'color-mix(in srgb,var(--ev,var(--atmo-c1,#F59E0B)) 10%,transparent),'+
              'transparent 22%),'+
            'linear-gradient(0deg,'+
              'color-mix(in srgb,var(--ev2,var(--atmo-c2,#A855F7)) 8%,transparent),'+
              'transparent 25%);'+
          'transition:background 1500ms ease;'+
          'animation:atmoBreath 18s ease-in-out infinite;}'+
        '@keyframes atmoBreath{'+
          '0%,100%{opacity:.48}'+
          '50%{opacity:.78}'+
        '}'+
        'body.atmo-paused #atmosphere{animation-play-state:paused;}';
      document.head.appendChild(s);
    },

    _buildLayer(){
      if(document.getElementById('atmosphere')){ this.layer=document.getElementById('atmosphere'); return; }
      const l=document.createElement('div');
      l.id='atmosphere';
      l.setAttribute('aria-hidden','true');
      document.body.appendChild(l);
      this.layer=l;
    },

    _detectTheme(){
      const scr=document.getElementById('lobby-screen');
      if(!scr) return 'neon';
      for(const c of scr.classList){
        if(c.indexOf('theme-')===0) return c.slice(6);
      }
      return 'neon';
    },
    _applyPalette(themeName){
      if(themeName===this._lastTheme) return;
      this._lastTheme=themeName;
      const p=_ATMO_PALETTE[themeName]||_ATMO_PALETTE.neon;
      if(this.layer){
        this.layer.style.setProperty('--atmo-c1', p.c1);
        this.layer.style.setProperty('--atmo-c2', p.c2);
      }
    },
    _observeTheme(){
      const scr=document.getElementById('lobby-screen');
      if(!scr||this._obs) return;
      this._obs=new MutationObserver(()=>this._applyPalette(this._detectTheme()));
      this._obs.observe(scr, { attributes:true, attributeFilter:['class'] });
    },

    _attachVisibility(){
      document.addEventListener('visibilitychange', ()=>{
        document.body.classList.toggle('atmo-paused', document.hidden);
      });
    },
  };
