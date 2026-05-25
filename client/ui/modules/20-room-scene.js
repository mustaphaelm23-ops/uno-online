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
    // v2 social presence — seats around the table + reflection plane
    seats:[], reflMat:null, _rimActive:false,
    // hover state
    focusedEl:null, focusAt:0,
    pendingEnter:null, pendingLeave:null, lastHovered:null,
    raf:null, t0:0,
    _rooms:new WeakMap(),
    _bound:false,
    // hero mode — when set, the canvas is anchored to this element and
    // automatically returns there whenever the user stops hovering a secondary.
    heroEl:null, _pendingHero:null,

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
      // If lobby called setHero() before Three.js finished loading, apply it now.
      if(this._pendingHero){ const h=this._pendingHero; this._pendingHero=null; this.setHero(h); }
    },
    // Pin the scene to a "hero" rtable. The canvas attaches there immediately
    // and returns there whenever the user stops hovering any secondary room.
    // Safe to call repeatedly — no-ops when the hero hasn't changed.
    setHero(rtable){
      if(this.disabled) return;
      if(!rtable) return;
      if(!this.enabled){ this._pendingHero=rtable; return; }
      if(this.heroEl===rtable && this.heroEl.isConnected) return;
      const oldHero=this.heroEl;
      this.heroEl=rtable;
      // If we were focused on the previous hero (or it was detached), move to the new hero.
      // If focused on a secondary, leave it — pendingLeave will return to the new hero.
      if(this.focusedEl===oldHero || (this.focusedEl && !this.focusedEl.isConnected)){
        this.focusedEl=null;
        this._focus(rtable);
      } else if(!this.focusedEl){
        this._focus(rtable);
      }
    },
    // Called from goLobby — RoomScene is alive during the lobby session.
    // Render loop only ticks when a room is focused; idle = 0 GPU.
    start(){ /* listeners stay attached; no-op for now */ },
    // Called from showScreen when leaving the lobby, and from visibilitychange.
    // Snaps the focus state away immediately so we don't leak GPU work.
    stop(){
      clearTimeout(this.pendingEnter); this.pendingEnter=null;
      clearTimeout(this.pendingLeave); this.pendingLeave=null;
      // Drop the hero anchor — when the user re-enters the lobby, loadRooms()
      // will call setHero() again with a fresh element reference.
      this.heroEl=null; this._pendingHero=null;
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

      // soft reflection plane just under the card — additive radial gradient
      // gives the card a "glossy table" presence without expensive mirror shaders
      const reflTex=this._reflTexture();
      const reflMat=new T.MeshBasicMaterial({map:reflTex, transparent:true, opacity:0.32,
        blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide});
      this.reflMat=reflMat;
      const refl=new T.Mesh(new T.PlaneGeometry(2.2, 2.2), reflMat);
      refl.rotation.x=-Math.PI/2;
      refl.position.y=0.005;                                  // just above felt to avoid z-fighting
      scene.add(refl);

      // 6 seat billboards around the felt — populated per-room in _configureScene
      const seatTex0=this._seatTexture(false,null,'#16A34A');
      for(let i=0;i<6;i++){
        const m=new T.SpriteMaterial({map:seatTex0, transparent:true, opacity:0,
          depthWrite:false});
        const sp=new T.Sprite(m);
        sp.scale.set(0.65, 0.65, 1);
        sp.position.set(0, -0.02, 0);
        sp.visible=false;
        sp.userData={ phase:Math.random()*Math.PI*2, baseY:-0.02, filled:false };
        scene.add(sp);
        this.seats.push(sp);
      }

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
    _reflTexture(){
      const T=window.THREE, cv=document.createElement('canvas');
      cv.width=256; cv.height=256;
      const ctx=cv.getContext('2d');
      const g=ctx.createRadialGradient(128,128,4,128,128,128);
      g.addColorStop(0,'rgba(255,255,255,.85)');
      g.addColorStop(.35,'rgba(255,255,255,.18)');
      g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
      return new T.CanvasTexture(cv);
    },
    _seatTexture(filled, avatarChar, feltColor){
      const T=window.THREE, cv=document.createElement('canvas');
      cv.width=128; cv.height=128;
      const ctx=cv.getContext('2d');
      // disc base — felt-tinted so seat reads as belonging to this room
      const r=46;
      ctx.beginPath(); ctx.arc(64,64,r,0,Math.PI*2);
      if(filled){
        const g=ctx.createRadialGradient(64,52,4,64,64,r);
        g.addColorStop(0,'rgba(255,255,255,.18)');
        g.addColorStop(1, feltColor||'#16A34A');
        ctx.fillStyle=g; ctx.fill();
        // white border ring
        ctx.lineWidth=4; ctx.strokeStyle='rgba(255,255,255,.92)'; ctx.stroke();
        // avatar character
        ctx.fillStyle='#fff'; ctx.font='800 44px system-ui, sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText((avatarChar||'?').toString().slice(0,1).toUpperCase(), 64, 66);
        // online green dot bottom-right
        ctx.beginPath(); ctx.arc(96, 96, 9, 0, Math.PI*2);
        ctx.fillStyle='#22C55E'; ctx.fill();
        ctx.lineWidth=3; ctx.strokeStyle='#fff'; ctx.stroke();
      } else {
        // empty seat — dashed ring, faint inner glow
        ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fill();
        ctx.setLineDash([6,5]); ctx.lineWidth=3;
        ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.stroke();
        ctx.setLineDash([]);
      }
      const tex=new T.CanvasTexture(cv);
      tex.anisotropy=4;
      return tex;
    },
    _parseRoomSeats(rtable){
      // Read the .rt-seat children that the lobby renders for each room.
      // Each seat exposes data on its element; we extract: filled? + display char.
      const out=[];
      const seatEls=rtable.querySelectorAll('.rt-seat');
      seatEls.forEach((el)=>{
        const filled=!el.classList.contains('empty');
        let ch='?';
        if(filled){
          const txt=(el.textContent||'').trim();
          ch=txt ? txt[0] : (el.getAttribute('data-name')?.[0] || '?');
        }
        out.push({filled, ch});
      });
      return out;
    },
    _seatLayout(count, radius){
      // Evenly spaced angles around the table, starting at the front (-π/2).
      const pts=[];
      const start=-Math.PI/2;
      for(let i=0;i<count;i++){
        const a=start + (i/Math.max(1,count))*Math.PI*2;
        pts.push({x:Math.cos(a)*radius, z:Math.sin(a)*radius, a});
      }
      return pts;
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
        // Off any rtable — schedule return-to-hero (or unfocus if no hero).
        clearTimeout(this.pendingEnter); this.pendingEnter=null;
        if(!this.focusedEl||this.pendingLeave) return;
        this.pendingLeave=setTimeout(()=>{
          this.pendingLeave=null;
          if(!this.focusedEl) return;
          if(this.focusedEl.matches(':hover')) return;
          if(this.heroEl && this.heroEl.isConnected && this.focusedEl!==this.heroEl){
            this._retarget(this.heroEl);             // hero is always-on — return there
          } else if(!this.heroEl){
            this._unfocus();                          // no hero anchor — fade out as before
          }
          // else: already on hero, stay focused
        }, 150);
      }
    },

    /* ── focus transitions ── */
    _configureScene(rtable){
      const T=window.THREE;
      const rd=this._getRoomData(rtable);
      this.feltMat.color.set(rd.felt);
      this.feltMat.emissive.set(rd.felt).multiplyScalar(0.12);
      this.glowMat.color.set(rd.felt).lerp(new T.Color(0xFFD23F), 0.55);
      // reflection picks up felt colour, kept faint
      if(this.reflMat) this.reflMat.color.set(rd.felt).lerp(new T.Color(0xffffff), 0.55);
      // active-room rim flag — pulse in render loop
      this._rimActive = rtable.classList.contains('rt-active');
      // seats — read from DOM, generate textures, position around the table
      const parsed=this._parseRoomSeats(rtable);
      const layout=this._seatLayout(Math.max(parsed.length, 1), 1.95);
      for(let i=0;i<this.seats.length;i++){
        const sp=this.seats[i];
        if(i<parsed.length){
          const p=parsed[i], pos=layout[i];
          const tex=this._seatTexture(p.filled, p.ch, rd.felt);
          // free previous texture map to avoid GPU leak across hovers
          if(sp.material.map) sp.material.map.dispose();
          sp.material.map=tex;
          sp.material.opacity=p.filled?0.95:0.55;
          sp.material.needsUpdate=true;
          sp.position.set(pos.x, -0.02, pos.z);
          sp.userData.filled=p.filled;
          sp.userData.baseY=-0.02;
          sp.visible=true;
        } else {
          sp.visible=false;
        }
      }
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
      const cardY=0.9+Math.sin(dt*1.3+rd.phase)*0.08;
      this.cardMesh.position.y=cardY;
      this.cardMesh.rotation.y=dt*0.42+rd.phase;
      this.cardMesh.rotation.x=-0.18+Math.sin(dt*0.8+rd.phase)*0.05;
      // particles drift
      this.particles.rotation.y=dt*0.18+rd.phase*0.4;
      // reflection breathes inversely with card height — higher card = fainter reflection
      if(this.reflMat){
        const breathe=0.28 + (1-(cardY-0.82)/0.16)*0.10;
        this.reflMat.opacity=Math.max(0.18, Math.min(0.42, breathe));
      }
      // active-room rim pulse — subtle emissive glow on the metallic ring
      if(this.feltRimMat){
        const pulse=this._rimActive ? (0.18 + Math.sin(dt*2.4)*0.10) : 0;
        if(pulse>0){
          this.feltRimMat.emissive ||= new window.THREE.Color(0x000000);
          this.feltRimMat.emissive.set(rd.felt).multiplyScalar(pulse);
        } else if(this.feltRimMat.emissive){
          this.feltRimMat.emissive.setHex(0x000000);
        }
      }
      // seats — gentle individual bob so filled seats feel alive (not just stickers)
      for(let i=0;i<this.seats.length;i++){
        const sp=this.seats[i];
        if(!sp.visible) continue;
        if(sp.userData.filled){
          sp.position.y = sp.userData.baseY + Math.sin(dt*1.1 + sp.userData.phase)*0.04;
        } else {
          sp.position.y = sp.userData.baseY;
        }
      }
      // camera cinematic dolly during the first 280ms of focus
      // pulled back to (0, 4.8, 6.6) so the whole table reads, seats included
      const dollyT=Math.min(1, (performance.now()-this.focusAt)/280);
      const eo=1-Math.pow(1-dollyT, 3);                       // ease-out cubic
      this.camera.position.set(0, 4.8-eo*0.25, 6.6-eo*0.4);
      this.camera.lookAt(0, 0.4, 0);
      this.renderer.render(this.scene, this.camera);
    },
  };
