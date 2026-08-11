  /* ═══════════════════════════════════════════
    SEASONAL EVENTS — temporary live overlay layered ABOVE the theme.
    Theme = atmosphere/foundation · Event = limited-time live layer.
    Server-driven via GET /api/event; everything here is presentation.
    ═══════════════════════════════════════════ */
  const EVENT={
    data:null,
    _cd:null, _ann:null, _annIdx:0,

    async load(){
      try{
        const d=await apiFetch('/api/event');
        this.data=(d&&d.active)?d:null;
      }catch(e){ this.data=null; }
      this.apply();
    },

    // Rebuild the whole event layer — safe to call on every goLobby().
    apply(){
      const scr=document.getElementById('lobby-screen');
      const layer=document.getElementById('eventLayer');
      const slot=document.getElementById('eventBannerSlot');
      if(this._cd){ clearInterval(this._cd); this._cd=null; }
      if(this._ann){ clearInterval(this._ann); this._ann=null; }
      if(scr){
        [...scr.classList].forEach(c=>{ if(c.indexOf('event-')===0) scr.classList.remove(c); });
        scr.style.removeProperty('--ev'); scr.style.removeProperty('--ev2');
      }
      if(layer) layer.innerHTML='';
      if(slot) slot.innerHTML='';
      const d=this.data;
      if(!d){                                            // no active event → plain lobby
        document.body.style.removeProperty('--ev');
        document.body.style.removeProperty('--ev2');
        return;
      }
      if(scr){
        scr.classList.add('event-active','event-'+d.id);
        scr.style.setProperty('--ev',d.color||'#FFD23F');
        scr.style.setProperty('--ev2',d.color2||'#FF8A00');
      }
      // also expose event colours globally so in-room ambiance can use them
      document.body.style.setProperty('--ev',d.color||'#FFD23F');
      document.body.style.setProperty('--ev2',d.color2||'#FF8A00');
      this._buildProps(d.prop);
      this._buildBanner(d);
      this._startCountdown(d);
      this._startAnnouncements(d);
      setTimeout(()=>this._maybeIntro(d),900);           // entry cinematic after lobby settles
    },

    /* ── temporary particles / floating lobby props ──
       Disabled per user request 2026-05-30 — the falling confetti /
       pumpkin / lantern / firework decorations were CPU-heavy on this
       user's machine and made the lobby feel sluggish. Killing the
       whole path is the cleanest fix; the event banner + intro + colour
       theming still run normally. To re-enable later, just remove this
       early return. */
    _buildProps(prop){
      return;
      /* eslint-disable no-unreachable */
      const host=document.getElementById('eventLayer');
      if(!host) return;
      if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
      const coarse=matchMedia('(pointer:coarse)').matches;
      if(prop==='confetti'){
        const cols=['#FFD23F','#FF8A00','#FFF1B8','#FFB454','#FF5577'];
        const n=coarse?22:40;
        for(let i=0;i<n;i++){
          const p=document.createElement('div');
          p.className='ev-confetti';
          const dur=5+Math.random()*6;
          p.style.cssText=`left:${(Math.random()*100).toFixed(1)}%;background:${cols[i%cols.length]};`+
            `width:${(5+Math.random()*5).toFixed(0)}px;height:${(8+Math.random()*8).toFixed(0)}px;`+
            `animation-duration:${dur.toFixed(1)}s;animation-delay:${(-Math.random()*dur).toFixed(1)}s;`+
            `--sway:${((Math.random()*2-1)*70).toFixed(0)}px;`;
          host.appendChild(p);
        }
      }else if(prop==='pumpkin'||prop==='lantern'){
        const emoji=prop==='pumpkin'?'🎃':'🏮';
        const n=coarse?8:14;
        for(let i=0;i<n;i++){
          const p=document.createElement('div');
          p.className='ev-prop '+(prop==='lantern'?'rise':'float');
          p.textContent=emoji;
          const dur=11+Math.random()*10;
          p.style.cssText=`left:${(Math.random()*96+2).toFixed(1)}%;font-size:${(20+Math.random()*22).toFixed(0)}px;`+
            `animation-duration:${dur.toFixed(1)}s;animation-delay:${(-Math.random()*dur).toFixed(1)}s;`+
            `--sway:${((Math.random()*2-1)*60).toFixed(0)}px;opacity:${(.5+Math.random()*.4).toFixed(2)};`;
          host.appendChild(p);
        }
      }else if(prop==='firework'){
        const n=coarse?4:7;
        for(let i=0;i<n;i++){
          const p=document.createElement('div');
          p.className='ev-fw';
          const dur=2.6+Math.random()*2.2;
          p.style.cssText=`left:${(Math.random()*84+8).toFixed(1)}%;top:${(Math.random()*46+8).toFixed(1)}%;`+
            `animation-duration:${dur.toFixed(1)}s;animation-delay:${(-Math.random()*dur).toFixed(1)}s;`;
          host.appendChild(p);
        }
      }
    },

    /* ── animated lobby banner (impossible to miss) ── */
    _buildBanner(d){
      const slot=document.getElementById('eventBannerSlot');
      if(!slot) return;
      const first=(d.announcements&&d.announcements[0])||d.tagline||'';
      slot.innerHTML=`
        <button class="ev-banner" onclick="EVENT.openMissions()" aria-label="${esc(d.name)} — open event">
          <div class="ev-banner-sheen"></div>
          <div class="ev-ribbon">LIVE EVENT</div>
          <div class="ev-banner-logo">${d.logo||d.icon||'🎉'}</div>
          <div class="ev-banner-mid">
            <div class="ev-banner-name">${esc(d.name)}</div>
            <div class="ev-banner-ann" id="evAnn">${esc(first)}</div>
          </div>
          <div class="ev-banner-right">
            <div class="ev-cd" id="evCd">—</div>
            <div class="ev-cd-lbl">⏳ ends in</div>
          </div>
          <div class="ev-banner-cta">🎯 Missions ›</div>
        </button>`;
    },

    _fmtLeft(ms){
      if(ms<=0) return 'Ended';
      const d=Math.floor(ms/86400000),h=Math.floor((ms%86400000)/3600000),m=Math.floor((ms%3600000)/60000);
      return d>0?`${d}d ${h}h`:h>0?`${h}h ${m}m`:`${m}m`;
    },
    _startCountdown(d){
      const tick=()=>{ const el=document.getElementById('evCd'); if(el) el.textContent=this._fmtLeft(d.endsAt-Date.now()); };
      tick();
      this._cd=setInterval(tick,30000);
    },
    _startAnnouncements(d){
      const list=(d.announcements&&d.announcements.length)?d.announcements:[d.tagline||''];
      if(list.length<2) return;
      this._annIdx=0;
      this._ann=setInterval(()=>{
        const el=document.getElementById('evAnn'); if(!el) return;
        this._annIdx=(this._annIdx+1)%list.length;
        el.classList.add('swap');
        setTimeout(()=>{ el.textContent=list[this._annIdx]; el.classList.remove('swap'); },260);
      },5200);
    },

    /* ── entry cinematic — plays once per event ── */
    _maybeIntro(d){
      let seen=false;
      try{ seen=localStorage.getItem('uno_event_seen_'+d.id)==='1'; }catch(e){}
      if(seen) return;
      if(!document.getElementById('lobby-screen')?.classList.contains('active')) return;
      this.playIntro(d);
      try{ localStorage.setItem('uno_event_seen_'+d.id,'1'); }catch(e){}
    },
    playIntro(d){
      const ov=document.createElement('div');
      ov.className='ev-intro';
      ov.style.setProperty('--ev',d.color||'#FFD23F');
      ov.style.setProperty('--ev2',d.color2||'#FF8A00');
      ov.innerHTML=`
        <div class="ev-intro-glow"></div>
        <div class="ev-intro-burst"></div>
        <div class="ev-intro-logo">${d.logo||d.icon||'🎉'}</div>
        <div class="ev-intro-kicker">LIMITED-TIME EVENT</div>
        <div class="ev-intro-name">${esc(d.name)}</div>
        <div class="ev-intro-tag">${esc(d.tagline||'')}</div>
        <div class="ev-intro-hint">tap to enter</div>`;
      document.body.appendChild(ov);
      try{ SFX&&SFX.play&&SFX.play('win'); }catch(e){}
      this._introBurst(ov);
      const rm=matchMedia('(prefers-reduced-motion:reduce)').matches;
      let closed=false;
      const close=()=>{ if(closed) return; closed=true; ov.classList.add('out'); setTimeout(()=>ov.remove(),420); };
      ov.addEventListener('click',close);
      setTimeout(()=>{ if(document.body.contains(ov)) close(); },rm?2400:4400);
    },
    _introBurst(host){
      if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
      const burst=host.querySelector('.ev-intro-burst');
      if(!burst) return;
      const cols=['#FFD23F','#FF8A00','#FFF1B8','#7DF9FF','#FF5577'];
      for(let i=0;i<30;i++){
        const s=document.createElement('div');
        s.className='ev-spark';
        const ang=Math.random()*Math.PI*2, dist=90+Math.random()*240;
        s.style.cssText=`background:${cols[i%cols.length]};`+
          `--tx:${(Math.cos(ang)*dist).toFixed(0)}px;--ty:${(Math.sin(ang)*dist).toFixed(0)}px;`+
          `animation-delay:${(Math.random()*.22).toFixed(2)}s;`;
        burst.appendChild(s);
      }
      setTimeout(()=>{ burst.innerHTML=''; },1900);
    },

    /* ── event missions panel ── */
    async openMissions(){
      const old=document.getElementById('evModal'); if(old) old.remove();
      const ov=document.createElement('div');
      ov.id='evModal';
      ov.innerHTML=`<div class="ev-modal"><div class="ev-modal-load"><div class="ev-spin"></div>Loading event…</div></div>`;
      document.body.appendChild(ov);
      ov.addEventListener('mousedown',e=>{ if(e.target===ov) EVENT._closeModal(); });
      try{
        this.data=await apiFetch('/api/event');
        if(!this.data||!this.data.active){ this._closeModal(); toast('No event running right now','i'); return; }
        this._renderModal();
      }catch(e){
        const p=ov.querySelector('.ev-modal');
        if(p) p.innerHTML=`<div class="ev-modal-load" style="color:#f87171">Could not load event</div>`;
      }
    },
    _closeModal(){
      const ov=document.getElementById('evModal'); if(!ov) return;
      ov.classList.add('out'); setTimeout(()=>ov.remove(),220);
    },
    _renderModal(){
      const d=this.data, ov=document.getElementById('evModal'); if(!d||!ov) return;
      const panel=ov.querySelector('.ev-modal');
      panel.style.setProperty('--ev',d.color||'#FFD23F');
      panel.style.setProperty('--ev2',d.color2||'#FF8A00');
      const done=d.missions.filter(m=>m.claimed).length;
      const f=d.featured||{};
      panel.innerHTML=`
        <div class="ev-m-hero">
          <button class="ev-m-close" onclick="EVENT._closeModal()" aria-label="Close">×</button>
          <div class="ev-m-logo">${d.logo||d.icon||'🎉'}</div>
          <div class="ev-m-title">${esc(d.name)}</div>
          <div class="ev-m-sub">${esc(d.tagline||'')}</div>
          <div class="ev-m-cd">⏳ ${this._fmtLeft(d.endsAt-Date.now())} left · ${done}/${d.missions.length} claimed</div>
        </div>
        <div class="ev-m-body">
          <div class="ev-m-featured rar-${esc(f.rarity||'epic')}">
            <div class="ev-m-feat-ic">${f.icon||'🎁'}</div>
            <div class="ev-m-feat-txt">
              <div class="ev-m-feat-lbl">FEATURED REWARD</div>
              <div class="ev-m-feat-name">${esc(f.name||'Mystery Reward')}</div>
              <div class="ev-m-feat-desc">${esc(f.desc||'')}</div>
            </div>
            <div class="ev-m-feat-rar">${esc(String(f.rarity||'epic').toUpperCase())}</div>
          </div>
          <div class="ev-m-list">
            ${d.missions.map((m,i)=>{
              const pct=Math.min(100,Math.round(m.current/m.target*100));
              const state=m.claimed?'claimed':m.complete?'ready':'';
              return `<div class="ev-mission ${state}" style="animation-delay:${i*60}ms">
                <div class="ev-mission-ic">${m.claimed?'✅':m.icon}</div>
                <div class="ev-mission-main">
                  <div class="ev-mission-name">${esc(m.name)}</div>
                  <div class="ev-mission-desc">${esc(m.desc)} · ${m.current}/${m.target}</div>
                  <div class="ev-mission-bar"><div class="ev-mission-fill" style="width:${pct}%"></div></div>
                </div>
                <button class="ev-claim ${state}" ${(m.claimed||!m.complete)?'disabled':''} onclick="EVENT.claim('${m.id}')">
                  ${m.claimed?'CLAIMED':m.complete?('CLAIM 🪙'+m.reward.toLocaleString()):('🪙 '+m.reward.toLocaleString())}
                </button>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    },
    async claim(mid){
      const icon=(this.data&&this.data.icon)||'🎉';
      try{
        const r=await apiFetch('/api/event/claim',{method:'POST',body:JSON.stringify({mission:mid})});
        if(S.user){ S.user.coins=r.coins; try{localStorage.setItem('uno_user',JSON.stringify(S.user));}catch(e){} }
        ['hcoins','scoins','heroCoins'].forEach(id=>{ if(document.getElementById(id)) _animateCount(id,r.coins); });
        try{ SFX&&SFX.play&&SFX.play('uno'); }catch(e){}
        toast(`${icon} +${r.reward.toLocaleString()} coins!`,'s');
        this._claimBurst();
        this.data=await apiFetch('/api/event');
        this._renderModal();
      }catch(e){ toast(e.message||'Could not claim','e'); }
    },
    _claimBurst(){
      const host=document.getElementById('eventLayer');
      if(!host||matchMedia('(prefers-reduced-motion:reduce)').matches) return;
      const cols=['#FFD23F','#FF8A00','#FFF1B8','#FFB454'];
      for(let i=0;i<24;i++){
        const p=document.createElement('div');
        p.className='ev-confetti burst';
        const dur=2+Math.random()*1.6;
        p.style.cssText=`left:${(40+Math.random()*20).toFixed(1)}%;top:36%;background:${cols[i%cols.length]};`+
          `width:7px;height:11px;animation-duration:${dur.toFixed(1)}s;`+
          `--sway:${((Math.random()*2-1)*170).toFixed(0)}px;`;
        host.appendChild(p);
        setTimeout(()=>p.remove(),dur*1000+250);
      }
    },

    /* ── event rooms ── */
    // The featured (spotlit) room rotates every 15s; loadRooms re-renders every 5s.
    pickFeatured(rooms){
      if(!this.data||!rooms||!rooms.length) return null;
      return rooms[Math.floor(Date.now()/15000)%rooms.length].id;
    },
    // Fill the featured room's particle host (one room only → cheap).
    decorateRooms(){
      if(!this.data||matchMedia('(prefers-reduced-motion:reduce)').matches) return;
      document.querySelectorAll('.rt-ev-fx[data-evfx]').forEach(host=>{
        host.removeAttribute('data-evfx');
        for(let i=0;i<7;i++){
          const s=document.createElement('div');
          s.className='rt-ev-spark';
          const dur=2.4+Math.random()*2;
          s.style.cssText=`left:${(8+Math.random()*84).toFixed(0)}%;`+
            `animation-duration:${dur.toFixed(1)}s;animation-delay:${(-Math.random()*dur).toFixed(1)}s;`+
            `--sd:${((Math.random()*2-1)*22).toFixed(0)}px;`;
          host.appendChild(s);
        }
      });
    },

    /* ── cinematic event-room entry ── */
    roomEnter(joinFn){
      const d=this.data;
      if(!d||matchMedia('(prefers-reduced-motion:reduce)').matches){ joinFn(); return; }
      const ov=document.createElement('div');
      ov.className='ev-room-wipe';
      ov.style.setProperty('--ev',d.color||'#FFD23F');
      ov.style.setProperty('--ev2',d.color2||'#FF8A00');
      ov.innerHTML=`<div class="ev-room-wipe-logo">${d.logo||d.icon||'🎉'}</div>`;
      document.body.appendChild(ov);
      try{ SFX&&SFX.play&&SFX.play('turn'); }catch(e){}
      setTimeout(joinFn,300);                                    // swap screens behind the wipe
      setTimeout(()=>{ ov.classList.add('out'); setTimeout(()=>ov.remove(),380); },780);
    },

    /* ── in-room event ambiance (event-tinted vignette + soft particles) ── */
    enterRoomAmbiance(){
      if(!this.data) return;
      document.body.classList.add('in-event-room');
      let amb=document.getElementById('eventRoomAmb');
      if(!amb){
        amb=document.createElement('div');
        amb.id='eventRoomAmb';
        amb.innerHTML='<div class="era-vignette"></div><div class="era-fx"></div>';
        document.body.appendChild(amb);
      }
      const fx=amb.querySelector('.era-fx');
      fx.innerHTML='';
      if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
      const n=matchMedia('(pointer:coarse)').matches?6:11;
      for(let i=0;i<n;i++){
        const p=document.createElement('div');
        p.className='era-p';
        const dur=9+Math.random()*9;
        p.style.cssText=`left:${(Math.random()*100).toFixed(1)}%;`+
          `width:${(3+Math.random()*4).toFixed(0)}px;height:${(3+Math.random()*4).toFixed(0)}px;`+
          `animation-duration:${dur.toFixed(1)}s;animation-delay:${(-Math.random()*dur).toFixed(1)}s;`+
          `--sd:${((Math.random()*2-1)*55).toFixed(0)}px;opacity:${(.25+Math.random()*.4).toFixed(2)};`;
        fx.appendChild(p);
      }
    },
    exitRoomAmbiance(){
      document.body.classList.remove('in-event-room');
      const amb=document.getElementById('eventRoomAmb');
      if(amb){ const fx=amb.querySelector('.era-fx'); if(fx) fx.innerHTML=''; }
    },
  };
  window.EVENT=EVENT;   // referenced from inline onclick handlers

