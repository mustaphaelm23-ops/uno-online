  /* ═══════════════════════════════════════════
     LOBBY SCENE — abstract atmospheric WebGL background.

     Layer order:  bg-img → [WebGL canvas] → tint → lobby-3d (CSS cards)
                   → lobby-fx → weather → event-layer → UI.

     The canvas sits BEHIND the CSS layers, never in front of UI. No
     geometric shapes — just a soft far-background dome + 8 large
     additive light orbs + ~80 dust points + ambient fog. Colours
     are theme-driven (and event-overridden when an event is live);
     palette lerps over ~1.4s when it changes.

     Camera: fixed pose, very subtle idle drift + pointer parallax
     (~0.3 unit max). Reads as cinematic depth, not "follow the mouse."

     Boot is delayed until ~1300ms after goLobby so it doesn't fight
     the lobby intro. On first start the canvas fades from 0 → 0.85
     over 1500ms. Subsequent starts (returning from a game) resume
     instantly with the canvas already visible.

     Same discipline as 20-room-scene.js: lifecycle-paused, mobile-
     gated, single-revert, no drawImage(WebGL→2D), no main-thread stalls.
     ═══════════════════════════════════════════ */
  let _lsThreeLoading=null;
  function _lsLoadThree(){
    if(window.THREE) return Promise.resolve(true);
    if(_lsThreeLoading) return _lsThreeLoading;
    _lsThreeLoading=new Promise(resolve=>{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/three.min.js';
      s.async=true;
      s.onload=()=>resolve(true);
      s.onerror=()=>resolve(false);
      document.head.appendChild(s);
    });
    return _lsThreeLoading;
  }
  function _lsSupportsWebGL(){
    try{ const c=document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2')||c.getContext('webgl')));
    }catch(e){ return false; }
  }

  // Per-theme palettes. orb1/orb2 are the additive light orb colours;
  // bg1/bg2 are the dome gradient. dust = particle tint. fog = far-falloff.
  const _LS_PALETTES={
    neon:     { bg1:'#1a0b3d', bg2:'#3d1a5f', orb1:'#F59E0B', orb2:'#E8324A', dust:'#FFE5A8', fog:'#0a0716' },
    cyber:    { bg1:'#003a5c', bg2:'#5c004a', orb1:'#00DCFF', orb2:'#9628FF', dust:'#FFFFFF', fog:'#040a14' },
    winter:   { bg1:'#0a1a3a', bg2:'#1a3a5c', orb1:'#7DC1FF', orb2:'#FFFFFF', dust:'#E0F0FF', fog:'#06101e' },
    summer:   { bg1:'#3a0f1a', bg2:'#5c1a0f', orb1:'#FFB454', orb2:'#FF5577', dust:'#FFE3B0', fog:'#1a0a08' },
    halloween:{ bg1:'#1a0529', bg2:'#3d052f', orb1:'#FF7518', orb2:'#9628B8', dust:'#FFB454', fog:'#0a0214' },
    gold:     { bg1:'#2a1a05', bg2:'#5c3a05', orb1:'#FFD700', orb2:'#FFB454', dust:'#FFEFC8', fog:'#150a02' },
  };

  const LobbyScene={
    enabled:false, booted:false, booting:false, disabled:false,
    renderer:null, scene:null, camera:null, canvas:null,
    dome:null, domeMat:null, orbs:[], dust:null, fog:null,
    // venue shell (phase 1) — physical environment containing the abstract atmosphere
    floor:null, ceiling:null, ceilingStrip:null, columns:[], venueLights:[],
    // pointer parallax target / current (lerped)
    mx:0, my:0, cx:0, cy:0,
    // palette state — current colours are lerped toward target
    _paletteKey:null, _cur:null, _tgt:null,
    raf:null, t0:0, _faded:false, _resize:null, _pointer:null,

    /* ── lifecycle ── */
    async boot(){
      if(this.enabled||this.booting||this.disabled) return;
      if(matchMedia('(prefers-reduced-motion:reduce)').matches){ this.disabled=true; return; }
      if(!_lsSupportsWebGL()){ this.disabled=true; return; }
      if(matchMedia('(pointer:coarse)').matches && innerWidth<720){ this.disabled=true; return; }
      this.booting=true;
      const ok=await _lsLoadThree();
      if(!ok||!window.THREE){ this.booting=false; this.disabled=true; return; }
      this._injectStyles();
      this._build();
      this._attachListeners();
      this.enabled=true; this.booting=false;
      // Boot can resolve AFTER the user navigated away — only start if still on lobby.
      if(document.getElementById('lobby-screen')?.classList.contains('active')) this.start();
    },
    start(){
      if(!this.enabled||this.raf||this.disabled) return;
      if(!this._faded){
        // First start ever — gentle fade-in over 1.5s, paired with the dolly drift
        this.canvas.style.transition='opacity 1500ms ease';
        this.canvas.style.opacity='0';
        this._renderFrame(0);                                   // prime so first frame isn't blank
        requestAnimationFrame(()=>{ this.canvas.style.opacity='0.85'; });
        this._faded=true;
      }
      this.t0=performance.now();
      this._startLoop();
    },
    stop(){
      if(this.raf){ cancelAnimationFrame(this.raf); this.raf=null; }
      // Canvas opacity stays as-is: when returning to lobby the scene is
      // already visible and resumes instantly without a re-fade.
    },

    /* ── one-off CSS ── */
    _injectStyles(){
      if(document.getElementById('ls-scene-css')) return;
      const s=document.createElement('style');
      s.id='ls-scene-css';
      s.textContent=
        '.lobby-scene-canvas{position:absolute;inset:0;z-index:0;pointer-events:none;'+
          'display:block;width:100%;height:100%;opacity:0;}';
      document.head.appendChild(s);
    },

    /* ── scene construction ── */
    _build(){
      const T=window.THREE;
      const cv=document.createElement('canvas');
      cv.className='lobby-scene-canvas';
      cv.setAttribute('aria-hidden','true');
      this.canvas=cv;
      // Append to #lobby-screen as last child — z:0 + DOM-last keeps the
      // canvas above the bg-img (z:0, earlier in DOM) and below the tints
      // and CSS-cards (z:1, 2, 3 …) above it. UI panels (z:5+, 25, 30)
      // paint over everything.
      document.getElementById('lobby-screen')?.appendChild(cv);
      const renderer=new T.WebGLRenderer({canvas:cv,alpha:true,antialias:true,powerPreference:'high-performance'});
      renderer.setClearColor(0x000000,0);
      renderer.setPixelRatio(Math.min(devicePixelRatio||1, 1.5));
      this.renderer=renderer;
      const scene=new T.Scene();
      // Ambient lowered so the new venue shell (MeshStandardMaterial) has
      // real lighting contrast. Existing dome / orbs / dust use materials
      // that ignore lights, so they look identical at any ambient value.
      scene.add(new T.AmbientLight(0xffffff, 0.3));
      // fog gives distant elements a natural falloff into dark
      scene.fog=new T.Fog(0x0a0716, 12, 42);
      this.fog=scene.fog;
      this.scene=scene;
      const camera=new T.PerspectiveCamera(56, 1, 0.1, 80);
      camera.position.set(0,0,14);
      this.camera=camera;

      // far backdrop dome — inside-out sphere with gradient texture
      const domeGeo=new T.SphereGeometry(34, 24, 18);
      const domeTex=this._gradientTex();
      const domeMat=new T.MeshBasicMaterial({map:domeTex, side:T.BackSide, depthWrite:false, fog:false});
      this.domeMat=domeMat;
      this.domeTex=domeTex;
      this.dome=new T.Mesh(domeGeo, domeMat);
      scene.add(this.dome);

      // 8 large additive sprite orbs — the "lounge ambient lights"
      const orbTex=this._orbTexture();
      // Distribute orbs in a wide arc behind/around the camera, varied depths
      const placements=[
        {x:-12, y: 3.5, z: -8, s: 9.0},
        {x: 11, y:-2.4, z: -9, s: 8.5},
        {x: -4, y: 5.5, z:-14, s: 7.5},
        {x:  6, y: 4.0, z:-16, s: 7.0},
        {x:-10, y:-4.0, z:-12, s: 8.0},
        {x: 13, y: 6.0, z:-18, s: 6.5},
        {x: -2, y:-5.5, z:-10, s: 7.5},
        {x:  8, y:-1.0, z:-20, s: 6.0},
      ];
      this.orbs=placements.map((p,i)=>{
        const m=new T.SpriteMaterial({map:orbTex, color:0xFFFFFF,
          blending:T.AdditiveBlending, transparent:true, opacity:0.32, depthWrite:false});
        const s=new T.Sprite(m);
        s.position.set(p.x, p.y, p.z);
        s.scale.set(p.s, p.s, 1);
        s.userData={
          bx:p.x, by:p.y, bz:p.z, ampX:0.4+Math.random()*0.5, ampY:0.3+Math.random()*0.4,
          freq:0.05+Math.random()*0.04, phase:Math.random()*Math.PI*2,
          colorPick:i%2===0?'orb1':'orb2',
        };
        scene.add(s);
        return s;
      });

      // ~80 dust points drifting in 3D — volumetric depth signal
      const pN=matchMedia('(pointer:coarse)').matches?50:80;
      const pGeo=new T.BufferGeometry();
      const pos=new Float32Array(pN*3);
      const speeds=new Float32Array(pN);
      for(let i=0;i<pN;i++){
        pos[i*3]  =(Math.random()-0.5)*30;
        pos[i*3+1]=(Math.random()-0.5)*18;
        pos[i*3+2]=-2 - Math.random()*22;
        speeds[i]=0.08+Math.random()*0.18;
      }
      pGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pMat=new T.PointsMaterial({color:0xFFE5A8, size:0.06, sizeAttenuation:true,
        transparent:true, opacity:0.55, blending:T.AdditiveBlending, depthWrite:false});
      this.dust=new T.Points(pGeo, pMat);
      this.dust.userData={speeds};
      scene.add(this.dust);

      // initial palette
      this._cur=this._cloneColors(this._resolvePalette());
      this._tgt=this._cloneColors(this._cur);
      this._applyColors();

      // Phase-1 venue shell — physical room containing the abstract atmosphere.
      // Built AFTER the abstract layers so it sits at known z-ranges inside
      // the same scene. All elements are static; render loop untouched.
      this._buildVenue();

      this._onResize();

      cv.addEventListener('webglcontextlost', (e)=>{ e.preventDefault(); this.disabled=true; this.stop(); });
    },

    _buildVenue(){
      /* PHASE 1 venue shell — gives the lobby a physical "lounge" presence:
         glossy floor + dark ceiling with a warm light strip + 4 architectural
         columns + directional sun light + a single warm ceiling point light.
         No back wall, no reflections, no rail lights — those are phase-2 polish.

         Geometry kept inside the dome (radius 34) so the dome still backs the
         room through the gaps between venue elements (sky-beyond-the-venue feel).

         All venue meshes use MeshStandardMaterial so they react to the new
         lights. Existing dome / orbs / dust are unaffected (their materials
         ignore scene lights). */
      const T=window.THREE;

      // Floor — large dark glossy plane catching ambient + ceiling light.
      const floorGeo=new T.PlaneGeometry(30, 40);
      const floorMat=new T.MeshStandardMaterial({
        color:0x080510, roughness:0.42, metalness:0.55, side:T.DoubleSide,
      });
      this.floor=new T.Mesh(floorGeo, floorMat);
      this.floor.rotation.x=-Math.PI/2;
      this.floor.position.set(0, -5, -10);
      this.scene.add(this.floor);

      // Ceiling — dark plane above. Rougher than the floor (not polished).
      const ceilGeo=new T.PlaneGeometry(30, 40);
      const ceilMat=new T.MeshStandardMaterial({
        color:0x0a0815, roughness:0.85, metalness:0.10, side:T.DoubleSide,
      });
      this.ceiling=new T.Mesh(ceilGeo, ceilMat);
      this.ceiling.rotation.x=Math.PI/2;
      this.ceiling.position.set(0, 5, -10);
      this.scene.add(this.ceiling);

      // Ceiling light strip — emissive plane running down the centre line.
      // Uses MeshBasicMaterial so it always glows full-bright regardless of
      // surrounding lighting (it IS a light source visually).
      const stripGeo=new T.PlaneGeometry(1.0, 38);
      const stripMat=new T.MeshBasicMaterial({
        color:0xFFE5A8, transparent:true, opacity:0.85,
        side:T.DoubleSide, depthWrite:false,
      });
      this.ceilingStrip=new T.Mesh(stripGeo, stripMat);
      this.ceilingStrip.rotation.x=Math.PI/2;
      this.ceilingStrip.position.set(0, 4.96, -10);
      this.scene.add(this.ceilingStrip);

      // 4 architectural columns flanking the centre — dark cylinders that
      // frame the venue and pick up rim lighting from the directional sun.
      const colGeo=new T.CylinderGeometry(0.45, 0.45, 11, 12);
      const colMat=new T.MeshStandardMaterial({
        color:0x140820, roughness:0.55, metalness:0.30,
      });
      const colPositions=[
        {x:-7, z:-7},  {x: 7, z:-7},
        {x:-8, z:-18}, {x: 8, z:-18},
      ];
      for(const p of colPositions){
        const col=new T.Mesh(colGeo, colMat);
        col.position.set(p.x, 0, p.z);
        this.scene.add(col);
        this.columns.push(col);
      }

      // Venue lighting — warm directional sun from above-right (sells the
      // columns' rim light) + a warm point light at the ceiling strip
      // (sells the strip as a real light source casting on floor / columns).
      const sun=new T.DirectionalLight(0xfff0d0, 0.55);
      sun.position.set(3, 8, 4);
      this.scene.add(sun);
      this.venueLights.push(sun);

      const ceilLight=new T.PointLight(0xFFE5A8, 1.6, 38, 1.8);
      ceilLight.position.set(0, 4.5, -10);
      this.scene.add(ceilLight);
      this.venueLights.push(ceilLight);
    },
    _gradientTex(){
      const T=window.THREE, cv=document.createElement('canvas');
      cv.width=64; cv.height=256;
      const ctx=cv.getContext('2d');
      // bottom-to-top: dark base → mid bg2 → bg1 → soft top glow
      const g=ctx.createLinearGradient(0,0,0,256);
      g.addColorStop(0.00,'#1a0b3d');  // placeholder — recoloured per-frame via uniforms? no, via texture redraw
      g.addColorStop(0.55,'#3d1a5f');
      g.addColorStop(1.00,'#0a0716');
      ctx.fillStyle=g; ctx.fillRect(0,0,64,256);
      const tex=new T.CanvasTexture(cv);
      tex._ctx=ctx; tex._cv=cv;                                // stash for live recolouring
      return tex;
    },
    _redrawDome(){
      const T=window.THREE, tex=this.domeTex;
      if(!tex||!tex._ctx) return;
      const ctx=tex._ctx;
      const g=ctx.createLinearGradient(0,0,0,256);
      g.addColorStop(0.00, '#'+this._cur.bg1.getHexString());   // top of dome (looking up)
      g.addColorStop(0.55, '#'+this._cur.bg2.getHexString());
      g.addColorStop(1.00, '#'+this._cur.fog.getHexString());   // far horizon falls into fog colour
      ctx.fillStyle=g; ctx.fillRect(0,0,64,256);
      tex.needsUpdate=true;
    },
    _orbTexture(){
      const T=window.THREE, cv=document.createElement('canvas');
      cv.width=256; cv.height=256;
      const ctx=cv.getContext('2d');
      const g=ctx.createRadialGradient(128,128,0,128,128,128);
      g.addColorStop(0.00,'rgba(255,255,255,1)');
      g.addColorStop(0.22,'rgba(255,255,255,.42)');
      g.addColorStop(0.55,'rgba(255,255,255,.08)');
      g.addColorStop(1.00,'rgba(255,255,255,0)');
      ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
      return new T.CanvasTexture(cv);
    },

    /* ── palette / theme ── */
    _resolvePalette(){
      const themeName=(typeof Theme!=='undefined'&&Theme.current)?Theme.current:'neon';
      const base=_LS_PALETTES[themeName]||_LS_PALETTES.neon;
      const ev=(typeof EVENT!=='undefined'&&EVENT.data)?EVENT.data:null;
      this._paletteKey = ev ? ('ev:'+ev.id) : ('th:'+themeName);
      return ev
        ? Object.assign({}, base, { orb1:ev.color||base.orb1, orb2:ev.color2||base.orb2 })
        : base;
    },
    _cloneColors(p){
      const T=window.THREE;
      return {
        bg1:new T.Color(p.bg1), bg2:new T.Color(p.bg2),
        orb1:new T.Color(p.orb1), orb2:new T.Color(p.orb2),
        dust:new T.Color(p.dust), fog:new T.Color(p.fog),
      };
    },
    _applyColors(){
      // orbs alternate between orb1/orb2
      for(const s of this.orbs){
        const c = s.userData.colorPick==='orb1' ? this._cur.orb1 : this._cur.orb2;
        s.material.color.copy(c);
      }
      this.dust.material.color.copy(this._cur.dust);
      this.fog.color.copy(this._cur.fog);
      this._redrawDome();
    },
    _pollPalette(){
      // cheap — runs each frame. Returns early if the resolved key didn't change.
      const targetP=this._resolvePalette();
      if(this._paletteKey===this._lastKey) return;
      this._lastKey=this._paletteKey;
      const T=window.THREE;
      this._tgt={
        bg1:new T.Color(targetP.bg1), bg2:new T.Color(targetP.bg2),
        orb1:new T.Color(targetP.orb1), orb2:new T.Color(targetP.orb2),
        dust:new T.Color(targetP.dust), fog:new T.Color(targetP.fog),
      };
    },
    _lerpColors(rate){
      const c=this._cur, t=this._tgt;
      c.bg1.lerp(t.bg1, rate);  c.bg2.lerp(t.bg2, rate);
      c.orb1.lerp(t.orb1, rate); c.orb2.lerp(t.orb2, rate);
      c.dust.lerp(t.dust, rate); c.fog.lerp(t.fog, rate);
      this._applyColors();
    },

    /* ── pointer / resize ── */
    _attachListeners(){
      this._pointer=(e)=>{ this.mx=e.clientX/innerWidth-0.5; this.my=e.clientY/innerHeight-0.5; };
      document.getElementById('lobby-screen')?.addEventListener('pointermove', this._pointer, {passive:true});
      this._resize=()=>this._onResize();
      window.addEventListener('resize', this._resize, {passive:true});
    },
    _onResize(){
      if(!this.renderer||!this.canvas) return;
      const w=this.canvas.clientWidth||innerWidth, h=this.canvas.clientHeight||innerHeight;
      this.renderer.setSize(w,h,false);
      this.camera.aspect=w/h; this.camera.updateProjectionMatrix();
    },

    /* ── render loop ── */
    _startLoop(){
      const tick=(t)=>{
        this.raf=requestAnimationFrame(tick);
        this._renderFrame((t-this.t0)*0.001);
      };
      this.raf=requestAnimationFrame(tick);
    },
    _renderFrame(dt){
      // theme/event palette swap (smoothly lerped)
      this._pollPalette();
      const changing=
        this._cur.fog.r!==this._tgt.fog.r||this._cur.fog.g!==this._tgt.fog.g||this._cur.fog.b!==this._tgt.fog.b;
      if(changing) this._lerpColors(0.012);                  // ~1.4s to reach a new target at 60fps

      // pointer parallax — very gentle, max ~0.3 units
      this.cx += (this.mx-this.cx)*0.04;
      this.cy += (this.my-this.cy)*0.04;
      // camera: parallax + idle breathing
      this.camera.position.x =  this.cx*0.30 + Math.sin(dt*0.13)*0.15;
      this.camera.position.y = -this.cy*0.20 + Math.cos(dt*0.17)*0.10;
      this.camera.position.z = 14 + Math.sin(dt*0.09)*0.15;
      this.camera.lookAt(0,0,-3);

      // orbs: slow individual drift
      for(const s of this.orbs){
        const u=s.userData;
        s.position.x = u.bx + Math.sin(dt*u.freq + u.phase) * u.ampX;
        s.position.y = u.by + Math.cos(dt*u.freq*1.3 + u.phase) * u.ampY;
      }

      // dust: drift down-to-up, wrap around
      if(this.dust){
        const pa=this.dust.geometry.attributes.position, sp=this.dust.userData.speeds;
        for(let i=0;i<pa.count;i++){
          const yi=i*3+1;
          pa.array[yi]+=sp[i]*0.012;
          if(pa.array[yi]>9.5) pa.array[yi]=-9.5;
        }
        pa.needsUpdate=true;
      }

      this.renderer.render(this.scene, this.camera);
    },
  };
