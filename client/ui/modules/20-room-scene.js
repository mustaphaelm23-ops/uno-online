  /* ═══════════════════════════════════════════
     ROOM SCENE — hover-focused mini-world (Three.js, hybrid).

     Idle = CSS card (the existing .rtable-stage). On hover-intent
     (>150ms over the same room) ONE shared canvas is moved into the
     focused .rtable-stage, the scene is reconfigured to the room's
     felt colour + phase, and the canvas fades in with a subtle
     camera dolly. On hover-leave (>150ms not over any rtable) the
     canvas fades out, the render loop pauses and the canvas is
     detached. Room A → Room B is a fast retarget (no fade-to-black).

     The CSS felt is the floor and is never removed — the canvas
     only ever sits *over* it. If anything fails (no WebGL,
     reduced-motion, touch, context loss, Three.js load failure),
     the system bails silently and the CSS card stays as today.

     Goal: subconscious depth perception. Not "wow, graphics."
     Self-contained. One revert removes 20-room-scene.js + 5 hook
     lines in 06-core / 12-lobby / app.js / index.html / sw.js.
     ═══════════════════════════════════════════ */
  let _rsThreeLoading=null;
  function _rsLoadThree(){
    if(window.THREE) return Promise.resolve(true);
    if(_rsThreeLoading) return _rsThreeLoading;
    _rsThreeLoading=new Promise(resolve=>{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/three.min.js';
      s.async=true;
      s.onload=()=>resolve(true);
      s.onerror=()=>resolve(false);
      document.head.appendChild(s);
    });
    return _rsThreeLoading;
  }
  function _rsSupportsWebGL(){
    try{ const c=document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2')||c.getContext('webgl')));
    }catch(e){ return false; }
  }

  const RoomScene={
    enabled:false, booted:false, booting:false, disabled:false,
    renderer:null, scene:null, camera:null, canvas:null,
    feltMat:null, feltRimMat:null, cardMesh:null, glowMat:null, particles:null,
    // hover state
    focusedEl:null, focusAt:0,
    pendingEnter:null, pendingLeave:null, lastHovered:null,
    raf:null, t0:0,
    _rooms:new WeakMap(),
    _bound:false,

    /* ── lifecycle ── */
    async boot(){
      if(this.enabled||this.booting||this.disabled) return;
      // gates — once any of these trips at boot, RoomScene stays disabled forever this session
      if(matchMedia('(prefers-reduced-motion:reduce)').matches){ this.disabled=true; return; }
      if(!matchMedia('(hover: hover)').matches){ this.disabled=true; return; }  // touch-only devices stay on CSS
      if(matchMedia('(pointer:coarse)').matches && innerWidth<720){ this.disabled=true; return; }
      if(!_rsSupportsWebGL()){ this.disabled=true; return; }
      this.booting=true;
      const ok=await _rsLoadThree();
      if(!ok||!window.THREE){ this.booting=false; this.disabled=true; return; }
      this._injectStyles();
      this._build();
      this._attachListeners();
      this.enabled=true; this.booting=false;
    },
    // Called from goLobby — RoomScene is alive during the lobby session.
    // Render loop only ticks when a room is focused; idle = 0 GPU.
    start(){ /* listeners stay attached; no-op for now */ },
    // Called from showScreen when leaving the lobby, and from visibilitychange.
    // Snaps the focus state away immediately so we don't leak GPU work.
    stop(){
      clearTimeout(this.pendingEnter); this.pendingEnter=null;
      clearTimeout(this.pendingLeave); this.pendingLeave=null;
      if(this.focusedEl){
        // hard cancel — no fade (we're leaving the lobby)
        if(this.canvas){
          this.canvas.style.transition='none';
          this.canvas.style.opacity='0';
          if(this.canvas.parentElement) this.canvas.parentElement.classList.remove('rt-scene-on');
          if(this.canvas.parentElement) this.canvas.remove();
        }
        this.focusedEl=null;
      }
      if(this.raf){ cancelAnimationFrame(this.raf); this.raf=null; }
    },

    /* ── one-off CSS the module needs ── */
    _injectStyles(){
      if(document.getElementById('rt-scene-css')) return;
      const s=document.createElement('style');
      s.id='rt-scene-css';
      s.textContent=
        '.rt-scene-canvas{position:absolute;inset:0;z-index:1;pointer-events:none;'+
          'display:block;width:100%;height:100%;opacity:0;}'+
        '.rtable.rt-scene-on .rtable-felt,'+
        '.rtable.rt-scene-on .rtable-felt::after{'+
          'opacity:0;transition:opacity 280ms ease;}';
      document.head.appendChild(s);
    },

    /* ── scene construction ── */
    _build(){
      const T=window.THREE;
      const cv=document.createElement('canvas');
      cv.className='rt-scene-canvas';
      cv.setAttribute('aria-hidden','true');
      this.canvas=cv;
      const renderer=new T.WebGLRenderer({canvas:cv,alpha:true,antialias:true,powerPreference:'high-performance'});
      renderer.setClearColor(0x000000,0);
      renderer.setPixelRatio(Math.min(devicePixelRatio||1, 1.5));
      this.renderer=renderer;
      const scene=new T.Scene();
      scene.fog=new T.Fog(0x0a0716, 6, 14);                    // subconscious depth — edges fall into dark
      this.scene=scene;
      const camera=new T.PerspectiveCamera(38, 1, 0.1, 50);
      this.camera=camera;

      // 3-light setup: warm key + cool rim + magenta back
      scene.add(new T.AmbientLight(0xffffff, 0.5));
      const key=new T.DirectionalLight(0xFFEFC8, 1.05);  key.position.set(2.5, 5.5, 3);  scene.add(key);
      const rim=new T.DirectionalLight(0x60A5FA, 0.45);  rim.position.set(-3, 1.5, -2); scene.add(rim);
      const bak=new T.DirectionalLight(0xA855F7, 0.35);  bak.position.set(0, -2, -3);   scene.add(bak);

      // low-poly felt disc
      const feltGeo=new T.CylinderGeometry(2.4, 2.45, 0.28, 32, 1, false);
      const feltMat=new T.MeshStandardMaterial({color:0x16A34A, roughness:0.92, metalness:0.05,
        emissive:new T.Color(0x16A34A).multiplyScalar(0.12)});
      this.feltMat=feltMat;
      const felt=new T.Mesh(feltGeo, feltMat);
      felt.position.y=-0.14;
      scene.add(felt);
      // metallic rim ring → reads as a real physical edge
      const rimGeo=new T.TorusGeometry(2.42, 0.09, 8, 36);
      const rimMat=new T.MeshStandardMaterial({color:0x0a3d1f, roughness:0.45, metalness:0.55});
      this.feltRimMat=rimMat;
      const feltRim=new T.Mesh(rimGeo, rimMat);
      feltRim.rotation.x=Math.PI/2;
      scene.add(feltRim);

      // floating centre card (canvas-baked texture)
      const cardGeo=new T.PlaneGeometry(1.05, 1.5);
      const cardTex=this._cardTexture();
      const cardMat=new T.MeshStandardMaterial({map:cardTex, transparent:true, side:T.DoubleSide,
        roughness:0.35, metalness:0.18, emissive:0xffffff, emissiveIntensity:0.08});
      const card=new T.Mesh(cardGeo, cardMat);
      card.position.set(0, 0.9, 0);
      card.rotation.x=-0.18;
      this.cardMesh=card;
      scene.add(card);

      // additive glow sprite above the card — fake bloom, very cheap
      const glowTex=this._orbTexture();
      const glowMat=new T.SpriteMaterial({map:glowTex, color:0xFFD23F,
        blending:T.AdditiveBlending, transparent:true, opacity:0.42, depthWrite:false});
      this.glowMat=glowMat;
      const glow=new T.Sprite(glowMat);
      glow.scale.set(3.4, 3.4, 1);
      glow.position.set(0, 0.85, 0.05);
      scene.add(glow);

      // 22 atmosphere particles drifting in a column around the table
      const pN=22;
      const pGeo=new T.BufferGeometry();
      const pos=new Float32Array(pN*3);
      for(let i=0;i<pN;i++){
        const a=Math.random()*Math.PI*2, r=1.2+Math.random()*1.6;
        pos[i*3]=Math.cos(a)*r;
        pos[i*3+1]=Math.random()*1.8;
        pos[i*3+2]=Math.sin(a)*r;
      }
      pGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pMat=new T.PointsMaterial({color:0xFFE5A8, size:0.08, sizeAttenuation:true,
        transparent:true, opacity:0.7, blending:T.AdditiveBlending, depthWrite:false});
      this.particles=new T.Points(pGeo, pMat);
      scene.add(this.particles);

      // graceful fail on GPU context loss — bail to CSS, don't try to recover
      cv.addEventListener('webglcontextlost', (e)=>{
        e.preventDefault();
        this.disabled=true;
        this.stop();
      });
    },
    _cardTexture(){
      const T=window.THREE, cv=document.createElement('canvas');
      cv.width=180; cv.height=256;
      const ctx=cv.getContext('2d'), r=24;
      ctx.beginPath();
      ctx.moveTo(r,0); ctx.lineTo(180-r,0); ctx.quadraticCurveTo(180,0,180,r);
      ctx.lineTo(180,256-r); ctx.quadraticCurveTo(180,256,180-r,256);
      ctx.lineTo(r,256); ctx.quadraticCurveTo(0,256,0,256-r);
      ctx.lineTo(0,r); ctx.quadraticCurveTo(0,0,r,0); ctx.closePath();
      const g=ctx.createLinearGradient(0,0,180,256);
      g.addColorStop(0,'#E8324A'); g.addColorStop(1,'#9B1B2E');
      ctx.fillStyle=g; ctx.fill();
      ctx.save(); ctx.translate(90,128); ctx.rotate(-.32);
      ctx.fillStyle='rgba(255,255,255,.96)';
      ctx.beginPath(); ctx.ellipse(0,0,68,94,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.fillStyle='#9B1B2E'; ctx.font='900 84px system-ui, sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('UNO', 90, 134);
      ctx.fillStyle='#fff'; ctx.font='900 20px system-ui, sans-serif';
      ctx.textAlign='left';  ctx.fillText('UNO', 12, 26);
      ctx.textAlign='right'; ctx.fillText('UNO', 168, 240);
      const tex=new T.CanvasTexture(cv);
      tex.anisotropy=4;
      return tex;
    },
    _orbTexture(){
      const T=window.THREE, cv=document.createElement('canvas');
      cv.width=128; cv.height=128;
      const ctx=cv.getContext('2d');
      const g=ctx.createRadialGradient(64,64,0,64,64,64);
      g.addColorStop(0,'rgba(255,255,255,1)');
      g.addColorStop(.25,'rgba(255,255,255,.55)');
      g.addColorStop(.6,'rgba(255,255,255,.14)');
      g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g; ctx.fillRect(0,0,128,128);
      return new T.CanvasTexture(cv);
    },
    _getRoomData(rtable){
      let d=this._rooms.get(rtable);
      if(!d){
        d={ phase:Math.random()*Math.PI*2,
            felt:(getComputedStyle(rtable).getPropertyValue('--felt').trim()||'#16A34A') };
        this._rooms.set(rtable, d);
      }
      return d;
    },

    /* ── hover state machine ──
       Document-level pointerover catches every cross-element move.
       Two timers: pendingEnter (150ms debounce) + pendingLeave (150ms grace). */
    _attachListeners(){
      if(this._bound) return;
      this._bound=true;
      document.addEventListener('pointerover', (e)=>this._onOver(e), true);
    },
    _onOver(e){
      if(this.disabled||!this.enabled) return;
      // only respond on the lobby
      if(!document.getElementById('lobby-screen')?.classList.contains('active')) return;
      const rtable=e.target.closest?.('.rtable');
      if(rtable===this.lastHovered) return;                          // moving within the same rtable
      this.lastHovered=rtable;
      if(rtable){
        // Hovering a (possibly new) rtable — schedule focus / retarget
        clearTimeout(this.pendingLeave); this.pendingLeave=null;
        clearTimeout(this.pendingEnter);
        this.pendingEnter=setTimeout(()=>{
          this.pendingEnter=null;
          // confirm: is this rtable still hovered?
          if(!rtable.matches(':hover')) return;
          if(this.focusedEl===rtable) return;
          if(this.focusedEl) this._retarget(rtable);
          else this._focus(rtable);
        }, 150);
      } else {
        // Off any rtable — schedule unfocus
        clearTimeout(this.pendingEnter); this.pendingEnter=null;
        if(!this.focusedEl||this.pendingLeave) return;
        this.pendingLeave=setTimeout(()=>{
          this.pendingLeave=null;
          if(this.focusedEl && !this.focusedEl.matches(':hover')) this._unfocus();
        }, 150);
      }
    },

    /* ── focus transitions ── */
    _configureScene(rtable){
      const rd=this._getRoomData(rtable);
      this.feltMat.color.set(rd.felt);
      this.feltMat.emissive.set(rd.felt).multiplyScalar(0.12);
      this.glowMat.color.set(rd.felt).lerp(new window.THREE.Color(0xFFD23F), 0.55);
    },
    _focus(rtable){
      const stage=rtable.querySelector('.rtable-stage'); if(!stage) return;
      this.focusedEl=rtable;
      this.focusAt=performance.now();
      // size renderer to stage rect
      const r=stage.getBoundingClientRect();
      this.renderer.setSize(Math.max(1,Math.round(r.width)), Math.max(1,Math.round(r.height)), false);
      this.camera.aspect=r.width/r.height; this.camera.updateProjectionMatrix();
      this._configureScene(rtable);
      // attach canvas into the stage so it inherits the card's pointer-tilt 3D transform
      stage.appendChild(this.canvas);
      rtable.classList.add('rt-scene-on');                                // CSS felt cross-fades out
      // prime one frame BEFORE the fade-in so the canvas is never blank
      this._renderOnce();
      // fade in 280ms ease
      this.canvas.style.transition='opacity 280ms ease';
      this.canvas.style.opacity='0';
      requestAnimationFrame(()=>{ this.canvas.style.opacity='1'; });
      // start the render loop
      if(!this.raf) this._startLoop();
    },
    _unfocus(){
      if(!this.focusedEl) return;
      const prev=this.focusedEl;
      this.focusedEl=null;
      this.canvas.style.transition='opacity 220ms ease';
      this.canvas.style.opacity='0';
      setTimeout(()=>{
        if(this.focusedEl) return;                                       // re-focused during fade
        if(this.raf){ cancelAnimationFrame(this.raf); this.raf=null; }
        if(this.canvas.parentElement) this.canvas.remove();
        prev.classList.remove('rt-scene-on');
      }, 230);
    },
    _retarget(rtable){
      // Fast hand-off: move the canvas to the new stage, reconfigure, brief opacity dip.
      const stage=rtable.querySelector('.rtable-stage'); if(!stage) return;
      const prev=this.focusedEl;
      if(prev) prev.classList.remove('rt-scene-on');
      this.focusedEl=rtable;
      this.focusAt=performance.now();
      const r=stage.getBoundingClientRect();
      this.renderer.setSize(Math.max(1,Math.round(r.width)), Math.max(1,Math.round(r.height)), false);
      this.camera.aspect=r.width/r.height; this.camera.updateProjectionMatrix();
      this._configureScene(rtable);
      stage.appendChild(this.canvas);
      rtable.classList.add('rt-scene-on');
      this._renderOnce();
      this.canvas.style.transition='opacity 180ms ease';
      this.canvas.style.opacity='0.6';
      requestAnimationFrame(()=>{ this.canvas.style.opacity='1'; });
    },

    /* ── render loop ── */
    _startLoop(){
      this.t0=performance.now();
      const tick=(t)=>{
        this.raf=requestAnimationFrame(tick);
        if(!this.focusedEl) return;     // safety — nothing to render
        this._renderFrame((t-this.t0)*0.001);
      };
      this.raf=requestAnimationFrame(tick);
    },
    _renderOnce(){ this._renderFrame(0); },
    _renderFrame(dt){
      const rd=this._getRoomData(this.focusedEl);
      // card slow bob + yaw — lights produce moving specular highlights
      this.cardMesh.position.y=0.9+Math.sin(dt*1.3+rd.phase)*0.08;
      this.cardMesh.rotation.y=dt*0.42+rd.phase;
      this.cardMesh.rotation.x=-0.18+Math.sin(dt*0.8+rd.phase)*0.05;
      // particles drift
      this.particles.rotation.y=dt*0.18+rd.phase*0.4;
      // camera cinematic dolly during the first 280ms of focus
      const dollyT=Math.min(1, (performance.now()-this.focusAt)/280);
      const eo=1-Math.pow(1-dollyT, 3);                       // ease-out cubic
      this.camera.position.set(0, 4.6-eo*0.25, 5.6-eo*0.35);
      this.camera.lookAt(0, 0.4, 0);
      this.renderer.render(this.scene, this.camera);
    },
  };
