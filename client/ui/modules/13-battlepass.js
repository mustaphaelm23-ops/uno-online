  /* ═══════════════ BATTLE PASS ═══════════════ */
  const BP={ data:null };

  // Hydrate the sidebar BP card with real progress data. Called on lobby
  // boot (silent fetch) and whenever the BP modal re-renders.
  function _renderBpSideCard(){
    const card  = document.getElementById('bpCard');
    if(!card) return;
    const seasonEl = document.getElementById('bpSeasonLbl');
    const fillEl   = document.getElementById('bpCardFill');
    const progEl   = document.getElementById('bpCardProg');
    const tierEl   = document.getElementById('bpCardTier');
    if(!BP.data){
      // Placeholder values until the API responds.
      if(seasonEl) seasonEl.textContent = 'SEASON 1';
      if(progEl)   progEl.textContent   = '0 / 1000';
      if(tierEl)   tierEl.textContent   = '1';
      if(fillEl)   fillEl.style.width   = '0%';
      return;
    }
    const d = BP.data;
    const maxT  = d.tiers?.length || 30;
    const lvl   = d.level || 0;
    const inLvl = lvl >= maxT ? d.xpPerTier : ((d.xp || 0) % d.xpPerTier);
    const pct   = lvl >= maxT ? 100 : Math.round(inLvl / d.xpPerTier * 100);
    if(seasonEl) seasonEl.textContent = (d.name || 'Season 1').toUpperCase();
    if(progEl)   progEl.textContent   = lvl >= maxT
      ? 'MAX TIER'
      : `${inLvl.toLocaleString()} / ${d.xpPerTier.toLocaleString()}`;
    if(tierEl)   tierEl.textContent   = String(Math.max(1, lvl || 1));
    if(fillEl)   requestAnimationFrame(()=>{ fillEl.style.width = pct + '%'; });
  }

  // Hydrate the big "Road to Champion" season hero in the lobby (under the
  // hero CTAs). Uses the SAME BP.data as the sidebar card — no extra request.
  function _renderSeasonHero(){
    const hero = document.getElementById('seasonHero');
    if(!hero) return;
    const d = BP.data;
    if(!d) return;   // keep the static placeholder until the API responds
    const seasonEl = document.getElementById('shSeason');
    const timerEl  = document.getElementById('shTimer');
    const tierEl   = document.getElementById('shTier');
    const fillEl   = document.getElementById('shFill');
    const xpEl     = document.getElementById('shXp');
    const nextEl   = document.getElementById('shNext');
    const maxT  = d.tiers?.length || 30;
    const lvl   = d.level || 0;
    const inLvl = lvl >= maxT ? d.xpPerTier : ((d.xp || 0) % d.xpPerTier);
    const pct   = lvl >= maxT ? 100 : Math.round(inLvl / d.xpPerTier * 100);
    if(seasonEl) seasonEl.textContent = (d.name || 'Season 1').toUpperCase();
    if(timerEl && d.endsAt) timerEl.textContent = '⏳ ' + _bpCountdown(d.endsAt);
    if(tierEl)   tierEl.textContent = String(Math.max(1, lvl || 1));
    if(xpEl)     xpEl.textContent = lvl >= maxT
      ? 'MAX TIER'
      : `${inLvl.toLocaleString()} / ${d.xpPerTier.toLocaleString()} XP`;
    if(nextEl){
      if(lvl >= maxT){ nextEl.innerHTML = '👑 <b>MAX TIER</b>'; }
      else {
        const nt = d.tiers[Math.min(lvl, maxT - 1)];
        const rw = nt && (nt.free || nt.prem);
        const ic = (rw && rw.icon) ? rw.icon : '🎁';
        const lb = (rw && rw.label != null) ? String(rw.label) : '';
        nextEl.innerHTML = 'NEXT ' + ic + (lb ? ' <b>' + esc(lb) + '</b>' : '');
      }
    }
    if(fillEl) requestAnimationFrame(()=>{ fillEl.style.width = pct + '%'; });
    hero.classList.add('ready');
  }

  // Lobby-boot hook: silently pull battlepass data so the sidebar card
  // shows real progress before the user opens the modal. Skips when no
  // user is logged in — calling /api/battlepass with no token used to
  // hit the 401 handler and bounce the user out of a half-filled
  // register form ("session expired" toast appearing while they typed).
  async function _hydrateBpSideCard(){
    if(!document.getElementById('bpCard')) return;
    if(!S.token) return;
    try{
      const d = await apiFetch('/api/battlepass');
      BP.data = d;
      _renderBpSideCard();
      _renderSeasonHero();
    }catch(e){ /* keep placeholder values; card is decorative until then */ }
  }
  // Tick the season-hero countdown each minute while the lobby is visible.
  setInterval(()=>{
    const t = document.getElementById('shTimer');
    if(t && BP.data && BP.data.endsAt && document.getElementById('lobby-screen')?.classList.contains('active')){
      t.textContent = '⏳ ' + _bpCountdown(BP.data.endsAt);
    }
  }, 60000);
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>setTimeout(_hydrateBpSideCard, 800), { once:true });
  } else {
    setTimeout(_hydrateBpSideCard, 800);
  }
  // Re-hydrate the BP card + season hero each time we (re)enter the lobby, so a
  // fresh login or a return from a match shows real progress immediately —
  // without waiting for the user to open the Battle Pass. Uses the goLobby
  // wrapper pattern established by 26-offers.js / 27-music.js.
  if(typeof window.goLobby === 'function'){
    const _bpOrigGoLobby = window.goLobby;
    window.goLobby = function(...a){
      const r = _bpOrigGoLobby.apply(this, a);
      setTimeout(_hydrateBpSideCard, 300);
      return r;
    };
  }

  async function showBattlePass(){
    const old=document.getElementById('bpModal'); if(old) old.remove();
    _ensureBPStyles();
    const ov=document.createElement('div');
    ov.id='bpModal';
    ov.innerHTML=`<div class="bp-panel"><div class="bp-loading"><div class="bp-spin"></div>Loading Battle Pass…</div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) _bpClose(); });
    try{
      BP.data=await apiFetch('/api/battlepass');
      _renderBattlePass();
      _renderBpSideCard();
      _renderSeasonHero();
    }catch(e){
      const p=ov.querySelector('.bp-panel');
      if(p) p.innerHTML=`<div class="bp-loading" style="color:#f87171">Could not load Battle Pass</div>`;
    }
  }
  function _bpClose(){
    const ov=document.getElementById('bpModal'); if(!ov) return;
    ov.classList.add('out'); setTimeout(()=>ov.remove(),220);
  }
  function _bpCountdown(endsAt){
    const ms=endsAt-Date.now();
    if(ms<=0) return 'Season ended';
    const d=Math.floor(ms/86400000), h=Math.floor((ms%86400000)/3600000), m=Math.floor((ms%3600000)/60000);
    return d>0?`${d}d ${h}h left`:h>0?`${h}h ${m}m left`:`${m}m left`;
  }
  function _renderBattlePass(){
    const d=BP.data; if(!d) return;
    const ov=document.getElementById('bpModal'); if(!ov) return;
    const maxT=d.tiers.length;
    const lvl=d.level;
    const inLvl=lvl>=maxT?d.xpPerTier:(d.xp%d.xpPerTier);
    const pct=lvl>=maxT?100:Math.round(inLvl/d.xpPerTier*100);
    const claimed=new Set(d.claimed);
    const card=(tr,track,tier)=>{
      const rw=tr[track], key=`${tier}:${track}`, isClaimed=claimed.has(key);
      const unlocked=lvl>=tier;
      const canClaim=unlocked && !isClaimed && (track==='free'||d.premium);
      const state=isClaimed?'claimed':canClaim?'claimable':'locked';
      const badge=isClaimed?'✓':canClaim?'CLAIM':(track==='prem'&&!d.premium?'👑':'🔒');
      return `<div class="bp-rw ${track} r-${rw.rarity} ${state}" data-key="${key}" `+
        `${canClaim?`onclick="claimBP(${tier},'${track}')"`:''}>
        <div class="bp-rw-shine"></div>
        <div class="bp-rw-icon">${rw.icon}</div>
        <div class="bp-rw-amt">🪙 ${esc(rw.label)}</div>
        <div class="bp-rw-badge">${badge}</div>
      </div>`;
    };
    const cols=d.tiers.map((tr,i)=>{
      const tier=i+1, unlocked=lvl>=tier, current=tier===lvl+1;
      return `<div class="bp-col ${unlocked?'on':''} ${current?'current':''}">
        ${card(tr,'prem',tier)}
        <div class="bp-tier ${unlocked?'on':''}">${tier}</div>
        ${card(tr,'free',tier)}
      </div>`;
    }).join('');
    ov.querySelector('.bp-panel').innerHTML=`
      <div class="bp-aura"></div>
      <div class="bp-head">
        <div class="bp-season">
          <div class="bp-season-name">${esc(d.name)}</div>
          <div class="bp-season-timer">⏳ ${_bpCountdown(d.endsAt)}</div>
        </div>
        <div class="bp-lvlwrap">
          <div class="bp-lvl">${lvl}</div>
          <div class="bp-xp">
            <div class="bp-xp-top"><span>LEVEL ${lvl}</span><span>${lvl>=maxT?'MAX':inLvl+' / '+d.xpPerTier+' XP'}</span></div>
            <div class="bp-xp-bar"><div class="bp-xp-fill" style="width:0%"></div></div>
          </div>
        </div>
        <button class="bp-close" onclick="_bpClose()" aria-label="Close">×</button>
      </div>
      ${d.premium
        ? `<div class="bp-prem-on">👑 PREMIUM PASS ACTIVE — every tier unlocked</div>`
        : `<div class="bp-prem-cta">
             <div class="bp-prem-cta-txt"><b>👑 Unlock Premium Pass</b><span>Unlock the gold track — exclusive rewards every tier</span></div>
             <button class="bp-prem-btn" onclick="unlockBPPremium()">${d.premiumPrice.toLocaleString()} 🪙</button>
           </div>`}
      <div class="bp-tracklabels">
        <div class="bp-tl prem">👑 PREMIUM</div>
        <div class="bp-tl free">FREE</div>
      </div>
      <div class="bp-track" id="bpTrack">${cols}</div>`;
    // animate XP bar + cinematic intro
    const g=window.gsap, fill=ov.querySelector('.bp-xp-fill');
    if(g && !matchMedia('(prefers-reduced-motion:reduce)').matches){
      g.fromTo('.bp-panel',{y:40,opacity:0,scale:.96},{y:0,opacity:1,scale:1,duration:.5,ease:'back.out(1.4)'});
      g.to(fill,{width:pct+'%',duration:1.1,ease:'power2.out',delay:.25});
      g.fromTo('.bp-col',{y:30,opacity:0},{y:0,opacity:1,duration:.45,stagger:.04,ease:'power3.out',delay:.15});
      // scroll the track to the current tier
      setTimeout(()=>{
        const cur=ov.querySelector('.bp-col.current');
        if(cur) cur.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
      },500);
    } else {
      if(fill) fill.style.width=pct+'%';
      const cur=ov.querySelector('.bp-col.current');
      if(cur) cur.scrollIntoView({inline:'center',block:'nearest'});
    }
  }
  async function claimBP(tier,track){
    try{
      const d=await apiFetch('/api/battlepass/claim',{method:'POST',body:JSON.stringify({tier,track})});
      BP.data.claimed=d.claimed;
      // GDD §6.2 — claim can now grant coins (with premium 2x) or diamonds.
      // Sync both currencies + animate both pills (server returns both balances).
      if(typeof d.coins==='number'){
        S.user.coins=d.coins;
        _animateCount('hcoins',d.coins);
        _animateCount('scoins',d.coins);
        _animateCount('heroCoins',d.coins);
      }
      if(typeof d.diamonds==='number'){
        S.user.diamonds=d.diamonds;
        _animateCount('hdiamonds',d.diamonds);
      }
      try{ localStorage.setItem('uno_user',JSON.stringify(S.user)); }catch(e){}
      // Premium 2x perk hint — quiet info toast so the player notices the bonus.
      if(d.granted?.multiplied){
        toast(`👑 Premium bonus: free reward 2×`,'s');
      }
      _renderBattlePass();
      _claimCinematic(d.reward||{}, track);
    }catch(e){ toast(e.message||'Could not claim','e'); }
  }
  // Rarity-scaled claim reveal — common = clean pop, legendary = big cinematic.
  function _claimCinematic(reward, track){
    const g=window.gsap;
    const rar=reward.rarity||'common';
    const R=({
      common:   {c:'#B6BDCC',name:'COMMON',   parts:9,  rays:0,flash:0,shake:0,  build:.05},
      rare:     {c:'#3B82F6',name:'RARE',     parts:18, rays:1,flash:0,shake:0,  build:.22},
      epic:     {c:'#A855F7',name:'EPIC',     parts:30, rays:1,flash:1,shake:5,  build:.4},
      legendary:{c:'#F59E0B',name:'LEGENDARY',parts:50, rays:1,flash:1,shake:11, build:.65},
    })[rar]||{c:'#B6BDCC',name:'COMMON',parts:9,rays:0,flash:0,shake:0,build:.05};
    _ensureBPStyles();
    const ov=document.createElement('div');
    ov.id='claimCine';
    ov.style.setProperty('--cc',R.c);
    ov.innerHTML=`
      ${R.rays?'<div class="cc-rays"></div>':''}
      ${R.flash?'<div class="cc-flash"></div>':''}
      <div class="cc-card r-${rar}">
        <div class="cc-card-shine"></div>
        <div class="cc-rarity">${R.name}</div>
        <div class="cc-icon">${reward.icon||'🪙'}</div>
        <div class="cc-amount">+${(reward.amount||0).toLocaleString()} 🪙</div>
        <div class="cc-trk">${track==='prem'?'👑 PREMIUM REWARD':'FREE REWARD'}</div>
      </div>
      <div class="cc-tap">Tap to continue</div>`;
    document.body.appendChild(ov);
    const card=ov.querySelector('.cc-card');
    const done=()=>{ if(ov._x)return; ov._x=1;
      if(g) g.to(ov,{opacity:0,duration:.25,onComplete:()=>ov.remove()}); else ov.remove(); };
    ov.addEventListener('click',done);
    const bigSound=rar==='legendary'||rar==='epic';
    if(!g || matchMedia('(prefers-reduced-motion:reduce)').matches){
      try{SFX.play(bigSound?'win':'uno');}catch(e){}
      setTimeout(done,1700); return;
    }
    const tl=g.timeline();
    tl.fromTo(ov,{opacity:0},{opacity:1,duration:.22});
    if(ov.querySelector('.cc-rays'))
      tl.fromTo('.cc-rays',{scale:.25,opacity:0,rotation:-70},{scale:1,opacity:1,rotation:0,duration:.55+R.build,ease:'power2.out'},0);
    if(R.build) tl.to({},{duration:R.build});                       // anticipation
    if(ov.querySelector('.cc-flash'))
      tl.fromTo('.cc-flash',{opacity:0},{opacity:.85,duration:.1,yoyo:true,repeat:1},'>-.04');
    tl.fromTo(card,{scale:.2,rotationY:-180,opacity:0},
      {scale:1,rotationY:0,opacity:1,duration:.62,ease:'back.out(1.8)'},'>-.06')
      .call(()=>{ try{SFX.play(bigSound?'win':'uno');}catch(e){} _ccParticles(card,R); });
    if(R.shake)
      tl.fromTo(ov,{x:-R.shake},{x:R.shake,duration:.05,repeat:5,yoyo:true,ease:'none',clearProps:'x'},'<');
    tl.fromTo('.cc-card-shine',{x:'-170%'},{x:'280%',duration:.75,ease:'power1.inOut'},'>-.15')
      .fromTo('.cc-tap',{opacity:0},{opacity:1,duration:.4},'>-.1')
      .to(card,{y:-9,duration:1.7,ease:'sine.inOut',yoyo:true,repeat:-1},'>');
    setTimeout(done, bigSound?(rar==='legendary'?5400:4400):3400);
  }
  function _ccParticles(originEl,R){
    const g=window.gsap; if(!g) return;
    const r=originEl.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    for(let i=0;i<R.parts;i++){
      const p=document.createElement('div');
      p.className='cc-particle';
      if(Math.random()<.5){ p.textContent='🪙'; }
      else { p.classList.add('dot'); p.style.background=R.c; p.style.boxShadow=`0 0 10px ${R.c}`; }
      p.style.left=cx+'px'; p.style.top=cy+'px';
      document.body.appendChild(p);
      const ang=Math.random()*Math.PI*2, dist=110+Math.random()*300;
      g.to(p,{x:Math.cos(ang)*dist,y:Math.sin(ang)*dist-Math.random()*110,
        rotation:(Math.random()-.5)*660,scale:.4+Math.random()*1.25,
        duration:.95+Math.random()*.6,ease:'power3.out'});
      g.to(p,{opacity:0,duration:.5,delay:.6+Math.random()*.4,onComplete:()=>p.remove()});
    }
  }
  async function unlockBPPremium(){
    if(!confirm(`Unlock the Premium Battle Pass for ${BP.data.premiumPrice.toLocaleString()} coins?`)) return;
    try{
      const d=await apiFetch('/api/battlepass/unlock',{method:'POST',body:JSON.stringify({})});
      BP.data.premium=true;
      if(typeof d.coins==='number'){
        S.user.coins=d.coins; localStorage.setItem('uno_user',JSON.stringify(S.user));
        _animateCount('hcoins',d.coins);
      }
      try{ SFX.play('win'); }catch(e){}
      _renderBattlePass();
      const ov=document.getElementById('bpModal');
      if(window.gsap&&ov) window.gsap.fromTo(ov.querySelectorAll('.bp-rw.prem'),
        {scale:.7,opacity:.3},{scale:1,opacity:1,duration:.5,stagger:.03,ease:'back.out(1.7)'});
      toast('👑 Premium Pass unlocked!','s');
    }catch(e){ toast(e.message||'Could not unlock','e'); }
  }
  function _ensureBPStyles(){
    if(document.getElementById('bp-styles')) return;
    const s=document.createElement('style'); s.id='bp-styles';
    s.textContent=`
      @keyframes bpIn{from{opacity:0}to{opacity:1}}
      @keyframes bpOut{to{opacity:0}}
      @keyframes bpSpin{to{transform:rotate(360deg)}}
      @keyframes bpClaimPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.55),0 8px 22px rgba(0,0,0,.5)}50%{box-shadow:0 0 0 7px rgba(245,158,11,0),0 8px 22px rgba(0,0,0,.5)}}
      @keyframes bpShine{0%,55%{transform:translateX(-160%) skewX(-20deg)}100%{transform:translateX(360%) skewX(-20deg)}}
      @keyframes bpAura{0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)}50%{opacity:.8;transform:translate(-50%,-50%) scale(1.12)}}
      #bpModal{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:18px;
        background:radial-gradient(ellipse at 50% 35%,rgba(60,30,8,.78),rgba(3,4,12,.98));
        backdrop-filter:blur(18px) saturate(1.25);-webkit-backdrop-filter:blur(18px) saturate(1.25);animation:bpIn .3s ease;}
      #bpModal.out{animation:bpOut .22s ease forwards;}
      .bp-panel{position:relative;width:min(940px,97vw);max-height:92vh;overflow:hidden;
        display:flex;flex-direction:column;
        background:
          linear-gradient(180deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,0) 14%),
          linear-gradient(180deg, rgba(36,30,58,.98) 0%, rgba(20,17,38,.98) 50%, rgba(12,10,24,.99) 100%);
        border:1px solid rgba(255,215,0,.22);border-radius:24px;
        box-shadow:
          0 50px 120px rgba(0,0,0,.8),
          0 0 80px rgba(245,158,11,.14),
          inset 0 1px 0 rgba(255,255,255,.08),
          inset 0 -2px 8px rgba(0,0,0,.35);}
      .bp-panel::before{content:"";position:absolute;left:34px;right:34px;top:0;height:1px;
        background:linear-gradient(90deg, transparent, #FFD700 25%, #E8324A 50%, #FFD700 75%, transparent);
        box-shadow:0 0 12px rgba(251,191,36,.6);pointer-events:none;z-index:2;}
      .bp-aura{position:absolute;left:50%;top:0;width:80%;height:340px;transform:translate(-50%,-50%);
        background:radial-gradient(ellipse,rgba(245,158,11,.38),rgba(232,50,74,.10) 50%,transparent 75%);filter:blur(50px);
        pointer-events:none;animation:bpAura 6s ease-in-out infinite;}
      .bp-loading{padding:70px;text-align:center;color:rgba(255,255,255,.6);font-weight:700;
        display:flex;flex-direction:column;align-items:center;gap:14px;}
      .bp-spin{width:36px;height:36px;border-radius:50%;border:3px solid rgba(255,255,255,.1);border-top-color:#F59E0B;animation:bpSpin .8s linear infinite;}
      .bp-head{position:relative;z-index:1;display:flex;align-items:center;gap:18px;padding:22px 26px 16px;flex-wrap:wrap;}
      .bp-season-name{font-family:'Bangers',cursive;font-size:30px;letter-spacing:2px;line-height:1.05;
        background:linear-gradient(180deg,#FFE9B0 0%, #FFD700 50%, #D97706 100%);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        filter:drop-shadow(0 2px 5px rgba(0,0,0,.5)) drop-shadow(0 0 12px rgba(251,191,36,.35));}
      .bp-season-timer{font-size:11px;font-weight:800;color:#FFB87A;letter-spacing:.6px;margin-top:3px;text-shadow:0 1px 2px rgba(0,0,0,.5);}
      .bp-lvlwrap{display:flex;align-items:center;gap:14px;margin-left:auto;}
      .bp-lvl{position:relative;width:58px;height:58px;flex-shrink:0;border-radius:15px;display:flex;align-items:center;justify-content:center;
        font-family:'Bangers',cursive;font-size:28px;color:#3B1A00;letter-spacing:.5px;
        background:
          radial-gradient(circle at 30% 28%, rgba(255,255,255,.6), rgba(255,255,255,0) 50%),
          linear-gradient(180deg, #FEF3C7 0%, #FBBF24 35%, #B45309 100%);
        box-shadow:
          0 6px 18px rgba(217,119,6,.6),
          0 0 14px rgba(251,191,36,.45),
          inset 0 1px 2px rgba(255,255,255,.6),
          inset 0 -3px 6px rgba(120,53,15,.45);
        text-shadow:0 1px 0 rgba(255,255,255,.4);}
      .bp-xp{width:230px;max-width:42vw;}
      .bp-xp-top{display:flex;justify-content:space-between;font-size:9.5px;font-weight:900;letter-spacing:.9px;color:rgba(255,255,255,.7);margin-bottom:6px;text-shadow:0 1px 2px rgba(0,0,0,.4);}
      .bp-xp-bar{height:11px;border-radius:8px;
        background:linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.35));
        overflow:hidden;border:1px solid rgba(255,255,255,.07);
        box-shadow:inset 0 1px 2px rgba(0,0,0,.45);}
      .bp-xp-fill{height:100%;border-radius:8px;
        background:linear-gradient(90deg,#E8324A 0%, #F59E0B 40%, #FFD700 100%);
        background-size:200% 100%;
        animation:profileBarShine 3s linear infinite;
        box-shadow:0 0 14px rgba(245,158,11,.7), inset 0 1px 0 rgba(255,255,255,.25);}
      .bp-close{width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:22px;line-height:1;
        background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03));
        border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.78);
        font-family:inherit;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.08);
        transition:transform .22s, background .2s, border-color .2s, color .2s, box-shadow .2s;}
      .bp-close:hover{background:linear-gradient(180deg, rgba(232,50,74,.35), rgba(232,50,74,.12));border-color:rgba(232,50,74,.6);color:#fff;transform:rotate(90deg);box-shadow:0 0 12px rgba(232,50,74,.4), inset 0 1px 0 rgba(255,255,255,.15);}
      .bp-prem-cta{position:relative;z-index:1;display:flex;align-items:center;gap:14px;margin:6px 24px 8px;
        padding:14px 18px;border-radius:14px;overflow:hidden;
        background:
          linear-gradient(180deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 40%),
          linear-gradient(135deg,rgba(245,158,11,.28) 0%, rgba(232,50,74,.16) 50%, rgba(124,58,237,.18) 100%);
        border:1px solid rgba(245,158,11,.5);
        box-shadow:0 8px 22px rgba(0,0,0,.4), 0 0 22px rgba(245,158,11,.18), inset 0 1px 0 rgba(255,255,255,.12);}
      .bp-prem-cta::before{content:"";position:absolute;left:14px;right:14px;top:0;height:1px;
        background:linear-gradient(90deg, transparent, rgba(255,235,150,.7), transparent);pointer-events:none;}
      .bp-prem-cta-txt{flex:1;display:flex;flex-direction:column;gap:2px;position:relative;z-index:1;}
      .bp-prem-cta-txt b{font-size:14px;color:#fff;letter-spacing:.3px;text-shadow:0 1px 2px rgba(0,0,0,.5);}
      .bp-prem-cta-txt span{font-size:11px;color:rgba(255,255,255,.7);font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.4);}
      .bp-prem-btn{position:relative;z-index:1;padding:12px 22px;border:none;border-radius:11px;cursor:pointer;
        background:
          radial-gradient(circle at 30% 28%, rgba(255,255,255,.55), rgba(255,255,255,0) 60%),
          linear-gradient(180deg, #FEF3C7 0%, #FBBF24 35%, #B45309 100%);
        color:#3B1A00;
        font-family:'Outfit',sans-serif;font-size:13px;font-weight:900;letter-spacing:.5px;
        text-shadow:0 1px 0 rgba(255,255,255,.4);
        box-shadow:
          0 6px 18px rgba(217,119,6,.55),
          0 0 0 1px rgba(120,53,15,.4),
          inset 0 1px 2px rgba(255,255,255,.55),
          inset 0 -3px 5px rgba(120,53,15,.4);
        transition:transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .25s, filter .2s;}
      .bp-prem-btn:hover{transform:translateY(-2px) scale(1.04);filter:brightness(1.08);
        box-shadow:
          0 10px 26px rgba(217,119,6,.7),
          0 0 18px rgba(251,191,36,.55),
          0 0 0 1px rgba(120,53,15,.4),
          inset 0 1px 2px rgba(255,255,255,.65),
          inset 0 -3px 5px rgba(120,53,15,.4);}
      .bp-prem-on{margin:6px 24px 8px;padding:12px;border-radius:12px;text-align:center;
        font-size:12px;font-weight:900;letter-spacing:.6px;color:#FFE9B0;
        background:linear-gradient(180deg, rgba(245,158,11,.18), rgba(245,158,11,.05));
        border:1px solid rgba(245,158,11,.45);
        box-shadow:0 0 18px rgba(245,158,11,.20), inset 0 1px 0 rgba(255,255,255,.12);
        text-shadow:0 1px 2px rgba(0,0,0,.5);}
      .bp-tracklabels{display:flex;flex-direction:column;gap:74px;position:absolute;left:8px;top:128px;z-index:2;pointer-events:none;}
      .bp-tl{font-size:8px;font-weight:900;letter-spacing:1px;writing-mode:vertical-rl;transform:rotate(180deg);
        color:rgba(255,255,255,.3);}
      .bp-tl.prem{color:rgba(245,158,11,.6);}
      .bp-track{display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;padding:14px 24px 22px;
        flex:0 0 auto;align-items:flex-start;
        scrollbar-width:thin;scrollbar-color:rgba(245,158,11,.4) transparent;}
      .bp-track::-webkit-scrollbar{height:7px;}
      .bp-track::-webkit-scrollbar-thumb{background:rgba(245,158,11,.4);border-radius:7px;}
      .bp-col{flex-shrink:0;width:94px;display:flex;flex-direction:column;align-items:center;gap:9px;}
      .bp-col.current .bp-tier{
        box-shadow:
          0 0 0 3px #FFD700,
          0 0 26px rgba(245,158,11,.8),
          inset 0 1px 2px rgba(255,255,255,.6),
          inset 0 -3px 5px rgba(120,53,15,.45);
        transform:scale(1.14);}
      .bp-tier{position:relative;width:38px;height:38px;border-radius:50%;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
        font-family:'Bangers',cursive;font-size:18px;color:rgba(255,255,255,.5);letter-spacing:.4px;
        background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02));
        border:2px solid rgba(255,255,255,.10);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.10);
        transition:transform .3s, box-shadow .3s, background .3s, color .3s, border-color .3s;}
      .bp-tier.on{color:#3B1A00;
        background:
          radial-gradient(circle at 30% 28%, rgba(255,255,255,.55), rgba(255,255,255,0) 50%),
          linear-gradient(180deg, #FEF3C7 0%, #FBBF24 35%, #B45309 100%);
        border-color:rgba(120,53,15,.5);
        text-shadow:0 1px 0 rgba(255,255,255,.4);
        box-shadow:
          0 4px 12px rgba(217,119,6,.5),
          inset 0 1px 2px rgba(255,255,255,.55),
          inset 0 -3px 5px rgba(120,53,15,.45);}
      .bp-tier::before{content:'';position:absolute;right:100%;width:14px;height:4px;border-radius:2px;
        background:rgba(255,255,255,.08);}
      .bp-tier.on::before{background:linear-gradient(90deg,#F59E0B,#FFD700);box-shadow:0 0 6px rgba(251,191,36,.6);}
      .bp-col:first-child .bp-tier::before{display:none;}
      .bp-rw{position:relative;width:88px;height:90px;flex-shrink:0;border-radius:13px;cursor:default;overflow:hidden;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
        background:
          linear-gradient(180deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,0) 35%),
          linear-gradient(165deg, rgba(255,255,255,.05), rgba(0,0,0,.30));
        border:1.5px solid var(--rc,rgba(255,255,255,.12));
        box-shadow:inset 0 1px 0 rgba(255,255,255,.10), 0 4px 10px rgba(0,0,0,.35);
        transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s, filter .2s;}
      .bp-rw:hover{filter:brightness(1.06);}
      .bp-rw.r-common{--rc:#9CA3AF;}
      .bp-rw.r-rare{--rc:#3B82F6;}
      .bp-rw.r-epic{--rc:#A855F7;}
      .bp-rw.r-legendary{--rc:#F59E0B;}
      .bp-rw.prem{
        background:
          linear-gradient(180deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 35%),
          linear-gradient(165deg, color-mix(in srgb,var(--rc) 28%,rgba(40,28,6,.65)), rgba(20,12,4,.75));}
      .bp-rw-shine{position:absolute;top:0;left:0;width:42%;height:100%;pointer-events:none;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);transform:translateX(-160%);}
      .bp-rw-icon{font-size:26px;line-height:1;filter:drop-shadow(0 3px 5px rgba(0,0,0,.5));}
      .bp-rw-amt{font-size:11px;font-weight:800;color:#fff;}
      .bp-rw-badge{font-size:9px;font-weight:900;letter-spacing:.6px;padding:2px 7px;border-radius:10px;
        background:rgba(0,0,0,.4);color:rgba(255,255,255,.55);}
      .bp-rw.locked{opacity:.5;}
      .bp-rw.claimed{opacity:.7;}
      .bp-rw.claimed{border-color:rgba(74,222,128,.5);}
      .bp-rw.claimed .bp-rw-badge{background:rgba(74,222,128,.2);color:#4ade80;}
      .bp-rw.claimable{cursor:pointer;border-color:var(--rc);
        box-shadow:0 0 18px color-mix(in srgb,var(--rc) 45%,transparent),0 8px 22px rgba(0,0,0,.5);
        animation:bpClaimPulse 1.8s ease-in-out infinite;}
      .bp-rw.claimable .bp-rw-badge{background:linear-gradient(135deg,#FFD700,#F59E0B);color:#1a0e04;}
      .bp-rw.claimable .bp-rw-shine{animation:bpShine 2.4s ease-in-out infinite;}
      .bp-rw.claimable:hover{transform:translateY(-5px) scale(1.06);}

      @media (max-width:560px){
        .bp-head{padding:16px 16px 10px;}.bp-xp{width:140px;}
        .bp-prem-cta,.bp-prem-on{margin-left:14px;margin-right:14px;}
        .bp-track{padding:14px 14px 20px;}.bp-tracklabels{display:none;}
      }
      /* ── Claim reward cinematic ── */
      @keyframes ccRaySpin{to{transform:translate(-50%,-50%) rotate(360deg)}}
      #claimCine{position:fixed;inset:0;z-index:1100;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:18px;cursor:pointer;perspective:1100px;
        background:radial-gradient(ellipse at 50% 45%,rgba(20,14,4,.72),rgba(2,3,8,.93));
        backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}
      .cc-rays{position:absolute;left:50%;top:48%;width:150vmax;height:150vmax;
        transform:translate(-50%,-50%);pointer-events:none;
        background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--cc) 38%,transparent) 0deg 9deg,transparent 9deg 22deg);
        -webkit-mask:radial-gradient(circle,#000 4%,transparent 52%);mask:radial-gradient(circle,#000 4%,transparent 52%);
        animation:ccRaySpin 14s linear infinite;}
      .cc-flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 46%,#fff,transparent 55%);pointer-events:none;}
      .cc-card{position:relative;width:230px;padding:26px 20px 20px;border-radius:22px;
        transform-style:preserve-3d;text-align:center;overflow:hidden;
        background:linear-gradient(170deg,color-mix(in srgb,var(--cc) 30%,rgba(22,18,30,.96)),rgba(12,10,20,.98));
        border:2px solid var(--cc);
        box-shadow:0 0 60px color-mix(in srgb,var(--cc) 55%,transparent),0 30px 70px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.14);}
      .cc-card-shine{position:absolute;top:0;left:0;width:46%;height:100%;pointer-events:none;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);transform:translateX(-170%) skewX(-18deg);}
      .cc-rarity{font-family:'Bangers',cursive;font-size:15px;letter-spacing:3px;color:var(--cc);
        text-shadow:0 0 16px color-mix(in srgb,var(--cc) 70%,transparent);margin-bottom:8px;}
      .cc-icon{font-size:74px;line-height:1;filter:drop-shadow(0 6px 14px rgba(0,0,0,.6));}
      .cc-amount{font-family:'Bangers',cursive;font-size:34px;letter-spacing:1px;margin-top:8px;
        background:linear-gradient(180deg,#FFF7E0,#F59E0B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
      .cc-trk{font-size:9.5px;font-weight:900;letter-spacing:1.4px;color:rgba(255,255,255,.6);margin-top:8px;}
      .cc-tap{font-size:11px;font-weight:800;letter-spacing:1.5px;color:rgba(255,255,255,.5);text-transform:uppercase;}
      .cc-particle{position:fixed;font-size:24px;pointer-events:none;z-index:1101;will-change:transform;}
      .cc-particle.dot{width:9px;height:9px;border-radius:50%;font-size:0;}
    `;
    document.head.appendChild(s);
  }

  // ── Right rail: Friends Online + World Chat ──
  async function loadRailFriends(){
    const box=document.getElementById('railFriends');
    if(!box) return;
    try{
      const d=await apiFetch('/api/friends');
      const friends=(d.friends||[]).slice().sort((a,b)=>(b.isOnline?1:0)-(a.isOnline?1:0));
      const online=friends.filter(f=>f.isOnline).length;
      const nEl=document.getElementById('railFriendsN'); if(nEl) nEl.textContent=online;
      if(!friends.length){
        box.innerHTML=`<div class="rail-empty">No friends yet.<br>Add some with the 👥 button.</div>`;
        return;
      }
      // Show online friends first; clip to a reasonable count so the rail
      // doesn't dwarf the chat below. The full list still lives in the
      // Friends panel (toggleFriendsPanel) for browsing 250 friends.
      const visible = friends.slice(0, 10);
      box.innerHTML=visible.map(f=>{
        const img=_isImgAvatar(f.avatar);
        const face=img?'':esc(f.avatar||(f.username||'?').charAt(0).toUpperCase());
        // Status text + colour class straight from server payload.
        const statusTxt =
          f.status === 'in_match' ? 'In Match' :
          f.status === 'in_lobby' ? 'In Lobby' :
          f.isOnline              ? 'Online'   : 'Offline';
        const statusCls =
          f.status === 'in_match' ? 'rfs-match' :
          f.status === 'in_lobby' ? 'rfs-lobby' :
          f.isOnline              ? 'rfs-on'    : 'rfs-off';
        // Action button — JOIN if friend is in a public waiting lobby,
        // INVITE if I'm hosting and they're free, otherwise nothing.
        let actionHTML = '';
        if(f.currentRoom?.id && f.currentRoom.status === 'lobby'){
          actionHTML = `<button class="rail-friend-act rfa-join"
            onclick="event.stopPropagation();doJoin('${esc(f.currentRoom.id)}')"
            title="Join their room">JOIN</button>`;
        } else if(S.roomId && f.isOnline && f.status !== 'in_match'){
          actionHTML = `<button class="rail-friend-act rfa-invite"
            onclick="event.stopPropagation();doInviteFriend('${esc(f.id)}')"
            title="Invite to your room">INVITE</button>`;
        }
        return `<div class="rail-friend" onclick="showOpponentProfile('${esc(f.id)}')" title="View profile" style="cursor:pointer">
          <div class="rail-friend-av ${f.isOnline?'':'off'}" style="${img?`background-image:url('${f.avatar}')`:''}">${face}</div>
          <div class="rail-friend-info">
            <div class="rail-friend-name">${esc(f.username)}${verifiedBadgeHTML(f.username,{size:'xs'})}</div>
            <div class="rail-friend-status ${statusCls}">${statusTxt}</div>
          </div>
          ${actionHTML}
        </div>`;
      }).join('');
    }catch(e){
      // 401 already bounced the user to auth via _handleAuthExpiry — don't paint over it.
      if(e?.status===401) return;
      const msg = e?.networkError
        ? `Can't reach the server.`
        : `Couldn't load friends${e?.status?` (${e.status})`:''}.`;
      box.innerHTML=`<div class="rail-empty">${msg}<br>`+
        `<a href="#" onclick="event.preventDefault();loadRailFriends();return false;" style="color:#60A5FA;text-decoration:underline">Retry</a></div>`;
    }
  }

  // ── Right rail: Public Rooms list ──
  // Replaces the old World Chat panel — every currently-open public room
  // (waiting status) is listed; anyone can tap JOIN to enter. Auto-polls
  // every 5s via the lobby's railPubRoomsTimer.
  // Short game-type badge for each public-room row — tells the player at a
  // glance WHAT they're joining (UNO / Ronda / Dama / Chess). Mirrors the
  // BrowseRooms palette but with rail-sized labels.
  function _railTypeInfo(t){
    const m = {
      CLASSIC:    { label:'Cardora',        icon:'🎴', cls:'cls'    },
      PRIVATE:    { label:'Cardora',        icon:'🎴', cls:'cls'    },
      FUN:        { label:'Cardora',        icon:'🎉', cls:'fun'    },
      CHILL:      { label:'Cardora',        icon:'😎', cls:'chill'  },
      RANKED:     { label:'Ranked',     icon:'🏆', cls:'ranked' },
      RONDA:      { label:'Ronda',      icon:'🃏', cls:'ronda'  },
      CHESS: { label:'Chess', icon:'♞', cls:'chess'   },
      DAMA:       { label:'Dama',       icon:'♟️', cls:'dama'   },
    };
    return m[t] || m.CLASSIC;
  }

  async function loadRailPublicRooms(manual){
    const box = document.getElementById('railPubRooms');
    if(!box) return;
    // Spin the refresh icon when the player taps it manually.
    const rbtn = document.getElementById('railPubRefresh');
    if(manual && rbtn){ rbtn.classList.add('spin'); setTimeout(()=>rbtn?.classList.remove('spin'), 700); }
    try{
      const d = await apiFetch('/api/rooms');
      const rooms = (d.rooms || [])
        .sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
      const nEl = document.getElementById('railPubRoomsN');
      if(nEl) nEl.textContent = rooms.length;
      if(!rooms.length){
        box.innerHTML = `<div class="rail-empty rail-empty-rooms">
          <div class="rail-empty-ic">🪑</div>
          <div class="rail-empty-t">No public rooms yet</div>
          <div class="rail-empty-s">Create one, or tap ↻ to refresh</div>
        </div>`;
        return;
      }
      const myCoins = S.user?.coins || 0;
      box.innerHTML = rooms.map(r => {
        const bet = r.bet || 0;
        const full = r.players >= r.maxPlayers;
        const tooBroke = bet > myCoins;
        const locked = full || tooBroke;
        const lockReason = full ? 'FULL' : tooBroke ? `Need ${bet.toLocaleString()} 🪙` : '';
        const ti = _railTypeInfo(r.roomType);
        const betChip = bet > 0
          ? `<span class="rail-room-bet">🪙 <b>${bet.toLocaleString()}</b></span>`
          : `<span class="rail-room-bet rail-room-bet-free">FREE</span>`;
        const joinBtn = locked
          ? `<button class="rail-room-join locked" disabled title="${esc(lockReason)}">${full ? 'FULL' : '🔒'}</button>`
          : `<button class="rail-room-join" onclick="doJoin('${esc(r.id)}')" title="Join ${esc(r.hostUsername || 'host')}'s room">JOIN</button>`;
        return `<div class="rail-room ${locked?'locked':''}">
            <div class="rail-room-info">
              <span class="rail-room-type rail-room-type-${ti.cls}">${ti.icon} ${esc(ti.label)}</span>
              <div class="rail-room-meta">
                <span class="rail-room-players">👥 ${r.players}/${r.maxPlayers}</span>
                ${betChip}
              </div>
            </div>
            ${joinBtn}
          </div>`;
      }).join('');
    }catch(e){
      if(e?.status === 401) return;
      const msg = e?.networkError ? `Can't reach the server.` : `Couldn't load rooms.`;
      box.innerHTML = `<div class="rail-empty">${msg}<br>` +
        `<a href="#" onclick="event.preventDefault();loadRailPublicRooms(true);return false;" style="color:#60A5FA;text-decoration:underline">Retry</a></div>`;
    }
  }
  window.loadRailPublicRooms = loadRailPublicRooms;

  function _worldMsgHTML(m){
    const me=m.userId===S.user?.id;
    return `<div class="rail-msg ${me?'me':''}"><span class="rail-msg-name">${esc(m.name||'?')}:</span> <span class="rail-msg-text">${esc(m.text||'')}</span></div>`;
  }
  function _appendWorldMsg(m){
    const box=document.getElementById('worldMsgs');
    if(!box) return;
    const atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<48;
    box.insertAdjacentHTML('beforeend',_worldMsgHTML(m));
    while(box.children.length>60) box.removeChild(box.firstChild);
    if(atBottom) box.scrollTop=box.scrollHeight;
  }
  function sendWorld(){
    const inp=document.getElementById('worldInput');
    if(!inp) return;
    const txt=(inp.value||'').trim();
    if(!txt) return;
    if(!S.socket?.connected) return toast('Not connected','e');
    S.socket.emit('world:send',{text:txt});
    inp.value='';
  }

  // Render one room as a premium 3D table with seated players.
  const _FELTS=[['#15803D','#08351b'],['#B91C1C','#4a0a0a'],['#1D4ED8','#0a1f52'],['#9333EA','#3b0f63']];

  // Featured card felt palette — per-type colours so the cards have visual
  // variety (Classic green, Ronda sunset amber, Ranked dark/amber, Chill blue).
  const _FEATURED_FELTS = {
    CLASSIC: ['#15803D', '#08351b'],
    RONDA:   ['#92400E', '#3d1c05'],
    RANKED:  ['#7c2d12', '#1a0a05'],
    CHILL:   ['#1D4ED8', '#0a1f52'],
  };

  // Per-type hero illustrations. RONDA uses the Spanish-deck + Moroccan
  // desert artwork; CLASSIC uses the UNO box shot. Types without an entry
  // fall back to the clean static gradient.
  const _FEATURED_HERO = {
    CLASSIC:    '/classic-bg.jpeg',
    RONDA:      '/ronda-bg.jpeg',
    CHESS: '/chess-bg.jpeg?v=2',
    DAMA:       '/dama-bg.jpeg',
  };
  // Per-type display name override for the featured-tile title. Lets us
  // show "UNO" on the CLASSIC tile without renaming the room type itself.
  const _FEATURED_TITLE = {
    CLASSIC:    'Cardora',
    CHESS: 'CHESS',
    DAMA:       'DAMA',
  };
  // Hero images that are PORTRAIT-oriented (taller than wide). The tile's
  // hero box is landscape, so portrait images need `contain` so the full
  // artwork stays visible — `cover` would crop the title + subtitle.
  // Keep all portrait artworks here so they share identical framing.
  const _FEATURED_HERO_PORTRAIT = new Set(['CLASSIC', 'RONDA', 'CHESS', 'DAMA']);

  // Render one featured-lobby card. Clean static layout — the previous
  // animated 3D table illustration (seats + energy particles + pulsing
  // felt) has been removed at the user's request. Each tile is now:
  //   [badge] [title + player count] [hero (image OR gradient)] [entry pill]
  // RANKED cards always render their fixed RANKED badge regardless of isHot.
  function _featuredCardHTML(card, isHot){
    const max = card.maxPlayers || 4;
    const f   = _FEATURED_FELTS[card.type] || ['#16A34A', '#0a3d1f'];
    const isRanked = card.badge === 'RANKED';
    let badgeHTML = '';
    if(isHot)    badgeHTML += `<div class="rt-feat-badge hot-badge">🔥 HOT</div>`;
    if(isRanked) badgeHTML += `<div class="rt-feat-badge ranked-badge">⭐ RANKED</div>`;
    const active = (card.players > 0) ? ' rt-active' : '';
    const hotCls = isHot ? ' rt-hot' : '';
    // Hero illustration. Image-typed heroes get their dedicated wrapper
    // class so CSS can target them. Gradient-typed heroes share a flat
    // class — no inner felt/seats/particles, no animations.
    const heroImg = _FEATURED_HERO[card.type];
    const heroPortrait = _FEATURED_HERO_PORTRAIT.has(card.type) ? ' rt-feat-hero-portrait' : '';
    const heroHTML = heroImg
      ? `<div class="rt-feat-hero rt-feat-hero-img${heroPortrait}" style="background-image:url('${heroImg}')"></div>`
      : `<div class="rt-feat-hero rt-feat-hero-gradient"></div>`;
    // Tapping a casual game tile opens the STAKE PICKER (choose how many coins
    // to play for). RANKED keeps its own tier-based entry, so it still joins
    // directly. The fixed ENTRY pill is gone — the stake is chosen in the sheet.
    const clickAction = isRanked ? `quickJoin('${card.type}')` : `openStakePicker('${card.type}')`;
    return `<div class="rtable rtable-featured rtable-static${active}${hotCls}" data-room-type="${card.type}" onclick="${clickAction}" style="--felt:${f[0]};--felt2:${f[1]}">
      ${badgeHTML}
      <div class="rtable-top rtable-top-stacked">
        <div class="rtable-name">${esc((_FEATURED_TITLE[card.type] || card.label || card.type).toUpperCase())}</div>
        <div class="rtable-sub">${card.players}/${max} Players</div>
      </div>
      ${heroHTML}
      <div class="rtable-foot rtable-foot-simple">
        <span class="rtable-entry rtable-play-pill">
          <span class="rtable-play-ic" aria-hidden="true">▸</span> PLAY
        </span>
      </div>
    </div>`;
  }
  function _roomTableHTML(r, live, featId, isHero){
    const max=r.maxPlayers||4;
    const seats=r.seats||[];
    const f=live?['#B91C1C','#4a0a0a']:_FELTS[((r.id.charCodeAt(0)||0)+(r.id.charCodeAt(2)||0))%_FELTS.length];
    let seatHTML='';
    for(let i=0;i<max;i++){
      // seats ride a foreshortened ellipse around the 3D table
      const ang=(-90+360/max*i)*Math.PI/180;
      const x=(50+Math.cos(ang)*45).toFixed(1);
      const y=(42+Math.sin(ang)*23).toFixed(1);
      const df=(Math.sin(ang)+1)/2;                 // 0 = back row, 1 = front
      const sc=(0.78+df*0.36).toFixed(3);           // front seats larger (depth)
      const sz=2+Math.round(df*10);                 // front seats overlap back
      const p=seats[i];
      const st=`left:${x}%;top:${y}%;--s:${sc};--sz:${sz}`;
      if(p){
        const img=_isImgAvatar(p.avatar);
        const face=img?'':esc(p.avatar||(p.name||'?').charAt(0).toUpperCase());
        seatHTML+=`<div class="rt-seat filled" style="${st}" title="${esc(p.name||'')}">`+
          `<div class="rt-av" style="${img?`background-image:url('${p.avatar}')`:''};animation-delay:${i*70}ms">${face}</div></div>`;
      }else{
        seatHTML+=`<div class="rt-seat empty" style="${st}"></div>`;
      }
    }
    const code=r.id.substr(0,6).toUpperCase();
    // Seasonal event rooms — every room transforms while an event is live;
    // one rotating room is the spotlit "featured" room.
    const ev=EVENT.data;
    const isFeat=!!(ev&&featId&&r.id===featId&&!live);
    const evDeco=ev?(
      `<div class="rt-frame${isFeat?' feat':''}" aria-hidden="true"></div>`+
      `<div class="rt-ribbon">${ev.icon||'🎉'} LIMITED</div>`+
      (isFeat?`<div class="rt-feat-badge">⭐ FEATURED</div><div class="rt-ev-fx" data-evfx="1" aria-hidden="true"></div>`:'')
    ):'';
    const evCls=ev?' rt-event':'';
    const stage=`<div class="rtable-stage">
        <div class="rtable-felt"><div class="rtable-center"><div class="rtable-unocard">Cardora</div></div></div>
        ${seatHTML}
        <div class="rt-energy" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      </div>`;
    const active=(r.players>0||(seats&&seats.length>0))?' rt-active':'';
    if(live){
      return `<div class="rtable rt-active${evCls}" onclick="doWatch('${r.id}')" style="--felt:${f[0]};--felt2:${f[1]}">
        <div class="rtable-glow"></div>
        ${evDeco}
        <div class="rtable-top"><span class="rtable-name">🔴 LIVE MATCH</span><span class="rtable-tag" style="color:#fca5a5">▶ WATCH</span></div>
        ${stage}
        <div class="rtable-foot">
          <span class="rtable-count"><b>${r.players}</b>/${max}</span>
          <span class="rtable-entry" style="color:#93C5FD;background:rgba(96,165,250,.1);border-color:rgba(96,165,250,.25)">👁️ ${r.spectators||0}</span>
          <span class="rtable-join" style="background:linear-gradient(135deg,#E8324A,#9B1B2E)">SPECTATE ▶</span>
        </div>
      </div>`;
    }
    const heroDeco=isHero?(
      `<div class="rt-hero-label">${isFeat?'⭐ FEATURED STAGE':'⭐ MAIN STAGE'}</div>`+
      `<div class="rt-hero-frame" aria-hidden="true"></div>`
    ):'';
    return `<div class="rtable${active}${evCls}${isFeat?' rt-featured':''}${isHero?' rtable-hero':''}" onclick="doJoin('${r.id}')" style="--felt:${f[0]};--felt2:${f[1]}">
      ${heroDeco}
      <div class="rtable-glow"></div>
      ${evDeco}
      <div class="rtable-top"><span class="rtable-name">ROOM #${code}</span><span class="rtable-tag">● OPEN</span></div>
      ${stage}
      <div class="rtable-foot">
        <span class="rtable-count"><b>${r.players}</b>/${max}</span>
        ${r.bet?`<span class="rtable-entry">🪙 ${r.bet.toLocaleString()}</span>`:'<span class="rtable-entry" style="color:rgba(255,255,255,.45);background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08)">Free</span>'}
        <span class="rtable-join">JOIN ▶</span>
      </div>
    </div>`;
  }

  // ── Create Room (modern bottom-sheet) ───────────────────────────────────
  // Replaces the old multi-section arena setup with a fast, premium flow:
  // bottom-sheet slides up with blur, horizontal entry-fee chips, segmented
  // public/private toggle, single CTA. Mirrors Clash Royale / Brawl Stars
  // pacing — done in under 5 seconds.
  // Returns: { bet, maxPlayers, isPrivate, invites } or null on cancel.
  function showArenaSetup(){
    return new Promise(resolve=>{
      const old=document.getElementById('cr-ov');if(old)old.remove();
      _ensureArenaStyles();

      // Default — UNO 4-player squad at 1000 coins, public.
      const cfg = {
        game:        'UNO',
        maxPlayers:  4,
        bet:         1000,
        isPrivate:   false,
        invites:     [],
        timeControl: 'RAPID_10',      // chess only — ignored by other games
      };
      // Chess time controls — mirrors TIME_CONTROLS in src/core/ChessManager.js.
      // Keep the ids in sync; the server rejects anything it doesn't know.
      const TIME_CONTROLS = [
        { id:'BULLET_1',     label:'1+0',   name:'Bullet',    cls:'bullet'  },
        { id:'BULLET_2_1',   label:'2+1',   name:'Bullet',    cls:'bullet'  },
        { id:'BLITZ_3',      label:'3+0',   name:'Blitz',     cls:'blitz'   },
        { id:'BLITZ_3_2',    label:'3+2',   name:'Blitz',     cls:'blitz'   },
        { id:'BLITZ_5',      label:'5+0',   name:'Blitz',     cls:'blitz'   },
        { id:'BLITZ_5_3',    label:'5+3',   name:'Blitz',     cls:'blitz'   },
        { id:'RAPID_10',     label:'10+0',  name:'Rapid',     cls:'rapid'   },
        { id:'RAPID_10_5',   label:'10+5',  name:'Rapid',     cls:'rapid'   },
        { id:'RAPID_15_10',  label:'15+10', name:'Rapid',     cls:'rapid'   },
        { id:'CLASSICAL_30', label:'30+0',  name:'Classical', cls:'classic' },
        { id:'UNLIMITED',    label:'∞',     name:'No clock',  cls:'none'    },
      ];
      const userCoins = S.user?.coins || 0;

      // Game catalog — drives the picker + the available "modes" each
      // game supports + which ones are actually playable today.
      const GAMES = [
        { id:'UNO',        label:'Cardora',        sub:'Card draw',     art:'/classic-bg.jpeg',    modes:[2,3,4], available:true  },
        { id:'DAMA',       label:'Dama',       sub:'Checkers 1v1',  art:'/dama-bg.jpeg',       modes:[2],     available:true  },
        { id:'RONDA',      label:'Ronda',      sub:'Spanish deck 2v2',art:'/ronda-bg.jpeg',    modes:[4],     available:true  },
        { id:'CHESS',      label:'Chess',      sub:'Classic 1v1',  art:'/chess-bg.jpeg?v=2',       modes:[2],     available:true  },
      ];

      // Stake tiers — the exact ladder the user listed.
      const TIERS = [200, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000, 500000];

      const modeLabel = (n) => n === 2 ? 'Duel · 1v1'
                            : n === 3 ? 'Trio'
                            : n === 4 ? 'Squad · 2v2'
                            : `${n} players`;
      const modeShort = (n) => n === 2 ? '1v1'
                            : n === 3 ? '3P'
                            : n === 4 ? '4P'
                            : `${n}P`;

      // Game picker tiles (uses the same artwork as the lobby tiles).
      const gameTiles = GAMES.map(g => `
        <button class="cr-game ${g.id===cfg.game?'on':''} ${!g.available?'soon':''}" data-game="${g.id}">
          <div class="cr-game-art" style="background-image:url('${g.art}')"></div>
          <div class="cr-game-shade"></div>
          <div class="cr-game-meta">
            <span class="cr-game-lbl">${esc(g.label)}</span>
            <span class="cr-game-sub">${esc(g.sub)}</span>
          </div>
          ${!g.available ? '<span class="cr-game-soon">SOON</span>' : ''}
          ${g.id===cfg.game ? '<span class="cr-game-check">✓</span>' : ''}
        </button>`).join('');

      // Mode buttons (rebuilt per game).
      const modesForGame = (gid) => {
        const g = GAMES.find(x=>x.id===gid);
        return (g && g.modes) || [4];
      };
      const buildModeButtons = (gid) => modesForGame(gid).map(n => `
        <button class="cr-seat ${n===cfg.maxPlayers?'on':''}" data-p="${n}">
          <span class="cr-seat-n">${n}</span>
          <span class="cr-seat-lbl">${modeLabel(n)}</span>
        </button>`).join('');

      const chips = TIERS.map(v=>{
        const locked = v > userCoins;
        const sel = v === cfg.bet;
        const label = v >= 1000 ? `${(v/1000)}K` : String(v);
        return `
          <button class="cr-chip ${sel?'on':''} ${locked?'locked':''}" data-bet="${v}">
            <span class="cr-chip-shine"></span>
            <span class="cr-chip-coin">🪙</span>
            <span class="cr-chip-val">${label}</span>
            ${locked?'<span class="cr-chip-lock">🔒</span>':''}
          </button>`;
      }).join('');

      const ov = document.createElement('div');
      ov.id = 'cr-ov';
      ov.className = 'cr-ov';
      ov.innerHTML = `
        <div class="cr-sheet" role="dialog" aria-label="Create Room">
          <div class="cr-grab"></div>
          <button class="cr-close" aria-label="Close">×</button>

          <div class="cr-head">
            <div class="cr-title">CREATE ROOM</div>
          </div>

          <!-- 1. GAME -->
          <div class="cr-step">
            <div class="cr-step-row">
              <span class="cr-step-num">1</span>
              <span class="cr-step-name">Game</span>
              <span class="cr-step-pick" id="crGamePick">${esc(GAMES.find(g=>g.id===cfg.game)?.label || 'Cardora')}</span>
            </div>
            <div class="cr-games-scroll">
              <div class="cr-games">${gameTiles}</div>
            </div>
          </div>

          <!-- 2. MODE -->
          <div class="cr-step">
            <div class="cr-step-row">
              <span class="cr-step-num">2</span>
              <span class="cr-step-name">Mode</span>
              <span class="cr-step-pick" id="crSeatPick">${modeShort(cfg.maxPlayers)}</span>
            </div>
            <div class="cr-seats" id="crSeats">
              ${buildModeButtons(cfg.game)}
            </div>
          </div>

          <!-- 2b. TIME CONTROL — chess only, hidden for every other game -->
          <div class="cr-step" id="crTcStep" style="display:${cfg.game==='CHESS'?'':'none'}">
            <div class="cr-step-row">
              <span class="cr-step-num">⏱</span>
              <span class="cr-step-name">Time</span>
              <span class="cr-step-pick" id="crTcPick">${(TIME_CONTROLS.find(t=>t.id===cfg.timeControl)||{}).name || ''} ${(TIME_CONTROLS.find(t=>t.id===cfg.timeControl)||{}).label || ''}</span>
            </div>
            <div class="cr-chips-scroll">
              <div class="cr-tcs" id="crTcs">
                ${TIME_CONTROLS.map(t => `
                  <button class="cr-tc cr-tc-${t.cls} ${t.id===cfg.timeControl?'on':''}" data-tc="${t.id}">
                    <span class="cr-tc-lbl">${t.label}</span>
                    <span class="cr-tc-name">${t.name}</span>
                  </button>`).join('')}
              </div>
            </div>
          </div>

          <!-- 3. ENTRY FEE -->
          <div class="cr-step">
            <div class="cr-step-row">
              <span class="cr-step-num">3</span>
              <span class="cr-step-name">Entry Fee</span>
              <span class="cr-step-pick" id="crBetPick">🪙 ${cfg.bet.toLocaleString()}</span>
            </div>
            <div class="cr-chips-scroll">
              <div class="cr-chips">${chips}</div>
            </div>
          </div>

          <!-- 4. PRIVACY -->
          <div class="cr-step">
            <div class="cr-step-row">
              <span class="cr-step-num">4</span>
              <span class="cr-step-name">Privacy</span>
              <span class="cr-step-pick" id="crPrivPick">🌍 Public</span>
            </div>
            <div class="cr-priv-seg" data-on="public">
              <div class="cr-priv-slider"></div>
              <button class="cr-priv on" data-priv="0">
                <span class="cr-priv-ic">🌍</span>
                <span class="cr-priv-txt">Public Room</span>
              </button>
              <button class="cr-priv" data-priv="1">
                <span class="cr-priv-ic">🔒</span>
                <span class="cr-priv-txt">Private Room</span>
              </button>
            </div>
            <div class="cr-priv-hint" id="crPrivHint">Anyone in the lobby can join your table</div>
          </div>

          <!-- ACTION -->
          <button class="cr-go" id="crGo">
            <span class="cr-go-bg"></span>
            <span class="cr-go-label">CREATE ROOM</span>
            <span class="cr-go-cost"><span class="cr-go-coin">🪙</span><b id="crGoCost">${cfg.bet.toLocaleString()}</b></span>
            <span class="cr-go-arrow">→</span>
          </button>
        </div>`;
      document.body.appendChild(ov);

      // Trigger slide-up on next frame so the transition runs.
      requestAnimationFrame(()=>ov.classList.add('show'));

      // ── Bindings ───────────────────────────────────────────────
      const gamePick = ov.querySelector('#crGamePick');
      const betPick  = ov.querySelector('#crBetPick');
      const seatPick = ov.querySelector('#crSeatPick');
      const seatsBox = ov.querySelector('#crSeats');
      const privPick = ov.querySelector('#crPrivPick');
      const privHint = ov.querySelector('#crPrivHint');
      const goBtn    = ov.querySelector('#crGo');
      const goCost   = ov.querySelector('#crGoCost');

      function syncCost(){
        const game = GAMES.find(g => g.id === cfg.game);
        const canAfford = cfg.bet <= userCoins;
        const ready     = canAfford && game?.available;
        goBtn.classList.toggle('disabled', !ready);
        goCost.textContent = cfg.bet.toLocaleString();
        let label;
        if(!game?.available){
          label = `${game?.label || 'GAME'} — COMING SOON`;
        } else if(!canAfford){
          label = 'NOT ENOUGH COINS';
        } else {
          label = cfg.isPrivate ? 'CREATE PRIVATE ROOM' : 'CREATE ROOM';
        }
        goBtn.querySelector('.cr-go-label').textContent = label;
      }

      function bindSeatBtns(){
        ov.querySelectorAll('.cr-seat').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            ov.querySelectorAll('.cr-seat').forEach(b=>b.classList.remove('on'));
            btn.classList.add('on');
            cfg.maxPlayers = parseInt(btn.dataset.p, 10);
            seatPick.textContent = modeShort(cfg.maxPlayers);
          });
        });
      }

      // Time-control chips (chess only).
      const tcPick = ov.querySelector('#crTcPick');
      ov.querySelectorAll('.cr-tc').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          ov.querySelectorAll('.cr-tc').forEach(b=>b.classList.remove('on'));
          btn.classList.add('on');
          cfg.timeControl = btn.dataset.tc;
          const t = TIME_CONTROLS.find(x=>x.id===cfg.timeControl);
          if(tcPick && t) tcPick.textContent = `${t.name} ${t.label}`;
        });
      });

      // Game tiles — pick game, regenerate the Mode buttons to the
      // ones supported by that game, snap maxPlayers to the first
      // supported mode.
      ov.querySelectorAll('.cr-game').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const gid = btn.dataset.game;
          ov.querySelectorAll('.cr-game').forEach(b=>{
            b.classList.remove('on');
            b.querySelector('.cr-game-check')?.remove();
          });
          btn.classList.add('on');
          if(!btn.querySelector('.cr-game-check')){
            const c = document.createElement('span');
            c.className = 'cr-game-check';
            c.textContent = '✓';
            btn.appendChild(c);
          }
          cfg.game = gid;
          const g = GAMES.find(x=>x.id===gid);
          gamePick.textContent = g?.label || gid;
          // Time control only applies to chess — reveal/hide that step.
          const tcStep = ov.querySelector('#crTcStep');
          if(tcStep) tcStep.style.display = (gid === 'CHESS') ? '' : 'none';
          // Snap mode to first supported.
          const modes = modesForGame(gid);
          if(!modes.includes(cfg.maxPlayers)) cfg.maxPlayers = modes[0];
          seatsBox.innerHTML = buildModeButtons(gid);
          seatPick.textContent = modeShort(cfg.maxPlayers);
          bindSeatBtns();
          syncCost();
        });
      });

      // Entry-fee chips
      ov.querySelectorAll('.cr-chip').forEach(chip=>{
        chip.addEventListener('click', ()=>{
          if(chip.classList.contains('locked')){
            chip.animate(
              [{transform:'translateX(0)'},{transform:'translateX(-5px)'},
               {transform:'translateX(5px)'},{transform:'translateX(0)'}],
              {duration:260}
            );
            return;
          }
          ov.querySelectorAll('.cr-chip').forEach(c=>c.classList.remove('on'));
          chip.classList.add('on');
          cfg.bet = parseInt(chip.dataset.bet, 10);
          betPick.textContent = `🪙 ${cfg.bet.toLocaleString()}`;
          syncCost();
          chip.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'});
        });
      });

      bindSeatBtns();

      // Privacy segmented toggle
      const seg = ov.querySelector('.cr-priv-seg');
      ov.querySelectorAll('.cr-priv').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          ov.querySelectorAll('.cr-priv').forEach(b=>b.classList.remove('on'));
          btn.classList.add('on');
          const isPriv = btn.dataset.priv === '1';
          cfg.isPrivate = isPriv;
          seg.dataset.on = isPriv ? 'private' : 'public';
          privPick.textContent = isPriv ? '🔒 Private' : '🌍 Public';
          privHint.textContent = isPriv
            ? 'Invite code is generated — only friends with the code can join'
            : 'Anyone in the lobby can join your table';
          syncCost();
        });
      });

      syncCost();

      // ── Close handlers ─────────────────────────────────────────
      function close(result){
        ov.classList.remove('show');
        ov.classList.add('out');
        document.removeEventListener('keydown', onKey);
        setTimeout(()=>{ ov.remove(); resolve(result); }, 260);
      }
      ov.querySelector('.cr-close').addEventListener('click', ()=>close(null));
      ov.addEventListener('mousedown', e=>{ if(e.target===ov) close(null); });
      goBtn.addEventListener('click', ()=>{
        if(goBtn.classList.contains('disabled')){
          const game = GAMES.find(g => g.id === cfg.game);
          if(!game?.available){
            toast(`${game?.label || 'This game'} — coming soon!`, 'i');
          } else {
            toast(`Not enough coins! You have ${userCoins.toLocaleString()} 🪙`, 'e');
          }
          return;
        }
        close({ ...cfg });
      });
      const onKey = (e)=>{ if(e.key==='Escape') close(null); };
      document.addEventListener('keydown', onKey);
    });
  }

  function _ensureArenaStyles(){
    if(document.getElementById('arena-setup-styles')) return;
    const s = document.createElement('style');
    s.id = 'arena-setup-styles';
    s.textContent = `
      @keyframes crFadeIn   { from{opacity:0} to{opacity:1} }
      @keyframes crFadeOut  { to{opacity:0} }
      @keyframes crSheetIn  {
        from{ transform:translateY(100%); opacity:.4 }
        to  { transform:translateY(0);    opacity:1 }
      }
      @keyframes crSheetOut {
        to  { transform:translateY(40%); opacity:0 }
      }
      @keyframes crPop {
        0%   { transform:translateY(0)    scale(1) }
        50%  { transform:translateY(-6px) scale(1.10) }
        100% { transform:translateY(-3px) scale(1.06) }
      }
      @keyframes crShineSweep {
        0%   { transform:translateX(-120%) skewX(-22deg) }
        100% { transform:translateX(220%)  skewX(-22deg) }
      }
      @keyframes crGoldRing {
        0%,100% { box-shadow:0 0 0 0 rgba(251,191,36,.55),
                            0 12px 30px rgba(251,191,36,.30),
                            inset 0 1px 0 rgba(255,255,255,.18) }
        50%     { box-shadow:0 0 0 6px rgba(251,191,36,0),
                            0 16px 38px rgba(251,191,36,.45),
                            inset 0 1px 0 rgba(255,255,255,.22) }
      }
      @keyframes crCtaBreath {
        0%,100% { box-shadow:0 12px 28px rgba(232,50,74,.40),
                            0 0 0 0 rgba(251,191,36,.0),
                            inset 0 1px 0 rgba(255,255,255,.22) }
        50%     { box-shadow:0 16px 34px rgba(232,50,74,.55),
                            0 0 0 0 rgba(251,191,36,.0),
                            inset 0 1px 0 rgba(255,255,255,.30) }
      }

      /* ── Overlay ───────────────────────────────────────────── */
      .cr-ov{
        position:fixed; inset:0; z-index:1000;
        display:flex; align-items:flex-end; justify-content:center;
        background:rgba(4,8,18,.0);
        backdrop-filter:blur(0px); -webkit-backdrop-filter:blur(0px);
        transition:background .28s ease, backdrop-filter .28s ease;
        pointer-events:auto;
      }
      .cr-ov.show{
        background:rgba(4,8,18,.62);
        backdrop-filter:blur(14px) saturate(140%);
        -webkit-backdrop-filter:blur(14px) saturate(140%);
      }
      .cr-ov.show .cr-sheet{
        transform:translateY(0); opacity:1;
      }
      .cr-ov.out{ animation:crFadeOut .26s ease forwards }
      .cr-ov.out .cr-sheet{ animation:crSheetOut .26s cubic-bezier(.5,.05,.7,.25) forwards }

      /* ── Sheet ─────────────────────────────────────────────── */
      .cr-sheet{
        position:relative;
        width:min(560px, 100%);
        max-height:92vh; overflow-y:auto;
        padding:6px 22px 24px;
        border-radius:28px 28px 0 0;
        background:
          radial-gradient(120% 60% at 50% 0%, rgba(251,191,36,.10) 0%, rgba(251,191,36,0) 60%),
          linear-gradient(180deg, #1A2236 0%, #0E1525 40%, #080D1A 100%);
        border-top:1px solid rgba(255,255,255,.08);
        box-shadow:
          0 -24px 60px rgba(0,0,0,.55),
          inset 0 1px 0 rgba(255,255,255,.06);
        color:#fff;
        transform:translateY(100%); opacity:.4;
        transition:transform .32s cubic-bezier(.18,.89,.32,1.07), opacity .32s ease;
        font-family:inherit;
        scrollbar-width:none;
      }
      .cr-sheet::-webkit-scrollbar{ display:none }

      /* Top gold accent line — matches your other modals */
      .cr-sheet::before{
        content:''; position:absolute; left:24px; right:24px; top:0; height:2px;
        background:linear-gradient(90deg,
          transparent 0%,
          rgba(251,191,36,.0) 4%,
          rgba(251,191,36,.85) 18%,
          rgba(232,50,74,.95) 50%,
          rgba(251,191,36,.85) 82%,
          rgba(251,191,36,.0) 96%,
          transparent 100%);
        border-radius:2px;
        filter:drop-shadow(0 0 6px rgba(251,191,36,.4));
      }

      /* Drag handle removed — it ate ~14px at the very top of the sheet for
         no functional gain (the sheet isn't drag-dismissable). */
      .cr-grab{ display:none; }
      .cr-close{
        position:absolute; top:10px; right:14px;
        width:34px; height:34px; border-radius:50%;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1);
        color:#fff; font-size:20px; font-weight:700; cursor:pointer; line-height:1;
        display:flex; align-items:center; justify-content:center;
        transition:all .18s ease;
      }
      .cr-close:hover{
        background:rgba(232,50,74,.18);
        border-color:rgba(232,50,74,.5);
        color:#fff; transform:rotate(90deg);
      }

      /* ── Header ────────────────────────────────────────────── */
      .cr-head{
        position:relative; text-align:center; padding:0 0 7px;
      }
      /* hairline rule under the header — gives the hero a defined edge */
      .cr-head::after{
        content:''; position:absolute; left:8%; right:8%; bottom:0; height:1px;
        background:linear-gradient(90deg, transparent, rgba(251,191,36,.32), transparent);
      }
      .cr-eyebrow{
        font-size:9px; font-weight:800; letter-spacing:2.6px;
        color:rgba(251,191,36,.85); text-transform:uppercase;
        margin-bottom:2px;
      }
      .cr-title{
        font-family:'Bangers', 'Outfit', system-ui, sans-serif;
        font-size:30px; font-weight:400; letter-spacing:2.8px; line-height:1;
        background:linear-gradient(180deg, #FDE68A 0%, #FBBF24 50%, #D97706 100%);
        -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        filter:drop-shadow(0 2px 0 rgba(0,0,0,.25));
      }
      .cr-coin-pill{
        display:inline-flex; align-items:center; gap:5px;
        margin-top:5px; padding:3px 10px 3px 8px;
        border-radius:99px;
        background:linear-gradient(180deg, rgba(251,191,36,.18), rgba(251,191,36,.06));
        border:1px solid rgba(251,191,36,.32);
        font-size:12px; font-weight:800;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.12), 0 0 18px rgba(251,191,36,.18);
      }
      .cr-coin-pill b{ color:#FDE68A; font-weight:900 }

      /* ── Step row ──────────────────────────────────────────── */
      .cr-step{ margin-top:9px }
      .cr-step-row{
        display:flex; align-items:center; gap:10px; margin-bottom:9px;
        padding:0 2px;
      }
      .cr-step-num{
        flex:none; width:24px; height:24px; border-radius:50%;
        background:linear-gradient(180deg, rgba(251,191,36,.18), rgba(251,191,36,.04));
        border:1px solid rgba(251,191,36,.38);
        color:#FDE68A; font-size:12px; font-weight:900;
        display:flex; align-items:center; justify-content:center;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.18);
      }
      .cr-step-name{
        font-size:12px; font-weight:800; letter-spacing:1.5px;
        text-transform:uppercase; color:rgba(255,255,255,.92);
      }
      .cr-step-pick{
        margin-left:auto;
        font-size:11px; font-weight:800;
        color:#FDE68A; opacity:.85;
        background:rgba(251,191,36,.08);
        padding:4px 9px; border-radius:99px;
        border:1px solid rgba(251,191,36,.18);
      }

      /* ── Entry-fee chips ───────────────────────────────────── */
      .cr-chips-scroll{
        overflow-x:auto; overflow-y:visible;
        margin:0 -22px; padding:14px 22px 18px;
        scrollbar-width:none;
        scroll-snap-type:x proximity;
      }
      .cr-chips-scroll::-webkit-scrollbar{ display:none }
      .cr-chips{
        display:flex; gap:10px; min-width:max-content;
      }

      /* ── Game picker — Step 1 ─────────────────────────────────── */
      .cr-games-scroll{
        overflow-x:auto; overflow-y:visible;
        margin:0 -22px; padding:14px 22px 16px;
        scrollbar-width:none;
        scroll-snap-type:x proximity;
      }
      .cr-games-scroll::-webkit-scrollbar{ display:none }
      .cr-games{
        display:flex; gap:12px; min-width:max-content;
      }
      .cr-game{
        position:relative;
        flex:0 0 auto;
        width:124px; height:154px;
        border-radius:14px;
        overflow:hidden;
        border:2px solid rgba(255,255,255,.08);
        background:#1A1A2E;
        cursor:pointer;
        transition:transform .2s cubic-bezier(.34,1.56,.64,1),
                   border-color .25s, box-shadow .25s;
        scroll-snap-align:start;
      }
      .cr-game:hover{ transform:translateY(-3px); }
      .cr-game-art{
        position:absolute; inset:0;
        background-color:#2A1810;
        background-repeat:no-repeat;
        background-position:center;
        background-size:contain;  /* portrait artworks — full frame visible */
      }
      .cr-game-shade{
        position:absolute; inset:0;
        background:linear-gradient(180deg,
          rgba(0,0,0,0) 40%,
          rgba(0,0,0,.55) 80%,
          rgba(0,0,0,.85) 100%);
      }
      .cr-game-meta{
        position:absolute; left:8px; right:8px; bottom:8px;
        display:flex; flex-direction:column; gap:1px;
        text-align:left;
      }
      .cr-game-lbl{
        font-family:'Bangers',sans-serif;
        font-size:15px; letter-spacing:1.5px;
        color:#fff;
        text-shadow:0 2px 4px rgba(0,0,0,.7);
        line-height:1;
      }
      .cr-game-sub{
        font-size:9px; letter-spacing:1px;
        color:rgba(255,255,255,.75);
        font-weight:700;
        text-transform:uppercase;
      }
      .cr-game.on{
        border-color:#FBBF24;
        box-shadow:0 0 0 2px rgba(251,191,36,.3),
                   0 12px 22px rgba(251,191,36,.25);
        transform:translateY(-2px);
      }
      .cr-game-check{
        position:absolute; top:6px; right:6px;
        width:24px; height:24px; border-radius:50%;
        background:linear-gradient(135deg, #FBBF24, #D97706);
        color:#1A1A1A; font-size:13px; font-weight:900;
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 4px 10px rgba(251,191,36,.5);
      }
      .cr-game.soon{
        filter:saturate(.5) brightness(.7);
      }
      .cr-game.soon:hover{ transform:translateY(-1px); }
      .cr-game-soon{
        position:absolute; top:6px; right:6px;
        padding:3px 7px;
        border-radius:99px;
        background:linear-gradient(135deg, #6B7280, #374151);
        color:#fff;
        font-size:8px; font-weight:900; letter-spacing:1.5px;
        box-shadow:0 3px 8px rgba(0,0,0,.5);
        font-family:'Outfit',sans-serif;
      }
      .cr-chip{
        position:relative; overflow:hidden;
        flex:none;
        min-width:88px; padding:14px 12px;
        border-radius:18px;
        background:
          radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.07) 0%, rgba(255,255,255,0) 60%),
          linear-gradient(180deg, #1F2A40 0%, #131B2D 100%);
        border:1.5px solid rgba(255,255,255,.08);
        color:#fff; font-family:inherit; cursor:pointer;
        display:flex; flex-direction:column; align-items:center; gap:6px;
        transition:transform .22s cubic-bezier(.2,.85,.3,1.1),
                   border-color .22s ease, box-shadow .22s ease,
                   background .22s ease;
        scroll-snap-align:center;
      }
      .cr-chip:hover:not(.locked):not(.on){
        transform:translateY(-2px);
        border-color:rgba(251,191,36,.3);
        background:linear-gradient(180deg, #243152 0%, #16203A 100%);
      }
      .cr-chip-coin{
        font-size:22px; line-height:1;
        filter:drop-shadow(0 2px 4px rgba(251,191,36,.4));
      }
      .cr-chip-val{
        font-family:'Bangers', 'Outfit', system-ui, sans-serif;
        font-size:20px; font-weight:400; letter-spacing:1px;
        line-height:1;
        background:linear-gradient(180deg, #FDE68A 0%, #FBBF24 100%);
        -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
      }
      .cr-chip-shine{
        position:absolute; inset:0; pointer-events:none;
        background:linear-gradient(110deg,
          transparent 35%, rgba(255,255,255,.4) 50%, transparent 65%);
        opacity:0; transition:opacity .2s ease;
      }
      .cr-chip.on{
        animation:crPop .35s cubic-bezier(.2,.85,.3,1.1) forwards,
                  crGoldRing 2s ease-in-out .35s infinite;
        border-color:#FBBF24;
        background:
          radial-gradient(120% 80% at 50% 0%, rgba(251,191,36,.30) 0%, rgba(251,191,36,0) 60%),
          linear-gradient(180deg, #2A3658 0%, #19223A 100%);
        z-index:2;
      }
      .cr-chip.on .cr-chip-shine{
        opacity:1; animation:crShineSweep 1.4s ease-in-out infinite;
      }
      .cr-chip.on .cr-chip-val{
        background:linear-gradient(180deg, #FFFBEB 0%, #FDE68A 50%, #FBBF24 100%);
        -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        filter:drop-shadow(0 0 6px rgba(251,191,36,.5));
      }
      .cr-chip.locked{
        opacity:.45; cursor:not-allowed; filter:grayscale(.4);
      }
      .cr-chip-lock{
        position:absolute; top:6px; right:7px;
        font-size:10px; opacity:.8;
      }

      /* ── Player seats ──────────────────────────────────────── */
      .cr-seats{
        display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;
      }
      .cr-seat{
        padding:14px 10px;
        border-radius:16px;
        background:linear-gradient(180deg, #1F2A40 0%, #131B2D 100%);
        border:1.5px solid rgba(255,255,255,.08);
        color:#fff; font-family:inherit; cursor:pointer;
        display:flex; flex-direction:column; align-items:center; gap:3px;
        transition:all .2s cubic-bezier(.2,.85,.3,1.1);
      }
      .cr-seat:hover:not(.on){
        transform:translateY(-2px);
        border-color:rgba(251,191,36,.3);
      }
      .cr-seat-n{
        font-family:'Bangers', 'Outfit', system-ui, sans-serif;
        font-size:26px; font-weight:400; letter-spacing:1px; line-height:1;
        color:rgba(255,255,255,.95);
      }
      .cr-seat-lbl{
        font-size:9px; font-weight:800; letter-spacing:1.5px;
        text-transform:uppercase; color:rgba(255,255,255,.5);
      }
      .cr-seat.on{
        border-color:#FBBF24;
        background:
          radial-gradient(120% 80% at 50% 0%, rgba(251,191,36,.22) 0%, rgba(251,191,36,0) 60%),
          linear-gradient(180deg, #2A3658 0%, #19223A 100%);
        box-shadow:0 8px 22px rgba(251,191,36,.18),
                   inset 0 1px 0 rgba(255,255,255,.18);
      }
      .cr-seat.on .cr-seat-n{
        background:linear-gradient(180deg, #FFFBEB 0%, #FBBF24 100%);
        -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        filter:drop-shadow(0 2px 0 rgba(0,0,0,.25));
      }
      .cr-seat.on .cr-seat-lbl{ color:rgba(253,230,138,.85) }

      /* ── Privacy segmented control ─────────────────────────── */
      .cr-priv-seg{
        position:relative;
        display:grid; grid-template-columns:1fr 1fr;
        padding:5px; border-radius:99px;
        background:rgba(255,255,255,.05);
        border:1px solid rgba(255,255,255,.08);
        overflow:hidden;
      }
      .cr-priv-slider{
        position:absolute; top:5px; bottom:5px; left:5px;
        width:calc(50% - 5px);
        border-radius:99px;
        background:linear-gradient(180deg, #FBBF24 0%, #D97706 100%);
        box-shadow:0 4px 14px rgba(251,191,36,.4),
                   inset 0 1px 0 rgba(255,255,255,.35);
        transition:transform .32s cubic-bezier(.2,.85,.3,1.1);
      }
      .cr-priv-seg[data-on="private"] .cr-priv-slider{
        transform:translateX(100%);
        background:linear-gradient(180deg, #E8324A 0%, #B91C2C 100%);
        box-shadow:0 4px 14px rgba(232,50,74,.45),
                   inset 0 1px 0 rgba(255,255,255,.35);
      }
      .cr-priv{
        position:relative; z-index:1;
        padding:11px 10px;
        background:transparent; border:none;
        color:rgba(255,255,255,.62); font-family:inherit; cursor:pointer;
        display:flex; align-items:center; justify-content:center; gap:6px;
        font-size:12px; font-weight:800; letter-spacing:1.2px;
        text-transform:uppercase;
        transition:color .25s ease;
      }
      .cr-priv-ic{ font-size:14px }
      .cr-priv.on{ color:#0F172A; text-shadow:0 1px 0 rgba(255,255,255,.2) }
      .cr-priv-hint{
        margin-top:8px; padding:0 4px;
        font-size:11px; font-weight:600;
        color:rgba(255,255,255,.5);
        text-align:center; line-height:1.4;
      }

      /* ── time-control chips (chess only) ── */
      .cr-tcs{ display:flex; gap:7px; padding:1px; }
      .cr-tc{ flex-shrink:0; min-width:56px; padding:8px 10px; border-radius:11px; cursor:pointer;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#fff;
        display:flex; flex-direction:column; align-items:center; gap:1px;
        font-family:'Outfit',sans-serif; transition:background .18s, border-color .18s, transform .12s; }
      .cr-tc:hover{ transform:translateY(-2px); }
      .cr-tc-lbl{ font-size:14px; font-weight:900; letter-spacing:.4px; }
      .cr-tc-name{ font-size:8.5px; font-weight:800; opacity:.6; text-transform:uppercase; letter-spacing:.6px; }
      .cr-tc.on{ background:rgba(251,191,36,.16); border-color:rgba(251,191,36,.55); box-shadow:0 0 14px rgba(251,191,36,.2); }
      .cr-tc-bullet.on { background:rgba(248,113,113,.16); border-color:rgba(248,113,113,.55); box-shadow:0 0 14px rgba(248,113,113,.2); }
      .cr-tc-rapid.on  { background:rgba(34,197,94,.16);   border-color:rgba(34,197,94,.55);  box-shadow:0 0 14px rgba(34,197,94,.2); }
      .cr-tc-classic.on{ background:rgba(96,165,250,.16);  border-color:rgba(96,165,250,.55); box-shadow:0 0 14px rgba(96,165,250,.2); }

      /* ── CTA button ────────────────────────────────────────── */
      .cr-go{
        position:relative; overflow:hidden;
        width:100%; margin-top:22px; padding:16px 18px;
        border-radius:18px;
        background:linear-gradient(180deg, #F43F5E 0%, #E8324A 55%, #B91C2C 100%);
        border:1px solid rgba(255,255,255,.18); color:#fff;
        font-family:'Bangers', 'Outfit', system-ui, sans-serif;
        font-size:22px; font-weight:400; letter-spacing:2.5px;
        cursor:pointer;
        display:flex; align-items:center; justify-content:center; gap:12px;
        animation:crCtaBreath 2.4s ease-in-out infinite;
        transition:transform .18s ease, filter .18s ease;
      }
      .cr-go::before{
        content:''; position:absolute; inset:0; pointer-events:none;
        background:linear-gradient(110deg,
          transparent 35%, rgba(255,255,255,.22) 50%, transparent 65%);
        transform:translateX(-120%) skewX(-22deg);
        animation:crShineSweep 3.4s ease-in-out infinite;
      }
      .cr-go:hover{ transform:translateY(-1px); filter:brightness(1.08) }
      .cr-go:active{ transform:translateY(1px) }
      .cr-go.disabled{
        animation:none;
        background:linear-gradient(180deg, #4B5563 0%, #1F2937 100%);
        box-shadow:none; cursor:not-allowed; filter:saturate(.5);
      }
      .cr-go.disabled::before{ display:none }
      .cr-go-label{ position:relative }
      .cr-go-cost{
        position:relative;
        display:inline-flex; align-items:center; gap:4px;
        padding:4px 10px;
        border-radius:99px;
        background:rgba(0,0,0,.28);
        font-family:'Outfit', system-ui, sans-serif;
        font-size:13px; font-weight:900; letter-spacing:.5px;
        border:1px solid rgba(255,255,255,.16);
      }
      .cr-go-coin{ font-size:14px }
      .cr-go-arrow{
        position:relative;
        font-size:22px; font-weight:900;
        transition:transform .25s ease;
      }
      .cr-go:hover .cr-go-arrow{ transform:translateX(3px) }

      /* ── Mobile tweaks ─────────────────────────────────────── */
      @media (max-width:480px){
        .cr-sheet{ padding:12px 18px 22px; border-radius:24px 24px 0 0 }
        .cr-title{ font-size:26px; letter-spacing:2.2px }
        .cr-chip{ min-width:78px; padding:12px 10px }
        .cr-chip-coin{ font-size:20px }
        .cr-chip-val{ font-size:18px }
        .cr-seat-n{ font-size:23px }
        .cr-go{ font-size:20px; letter-spacing:2px; padding:14px 16px }
      }
    `;
    document.head.appendChild(s);
  }

  async function doCreate(){
    const result = await showArenaSetup();
    if(!result) return;
    const { game='UNO', bet, maxPlayers, isPrivate, invites=[], timeControl } = result;
    if((S.user?.coins||0) < bet) return toast(`Not enough coins! You have ${S.user?.coins||0} 🪙`,'e');
    try{
      // Pass roomType so the server picks the right engine (Dama vs UNO).
      // timeControl only means anything to CHESS; harmless elsewhere.
      const settings = { maxPlayers, bet, isPrivate, roomType: game };
      if(game === 'CHESS' && timeControl) settings.timeControl = timeControl;
      const d = await api('POST','/rooms',{settings});
      S.roomId = d.roomId;
      S.currentRoomType = game;
      S.socket.emit('room:join',{roomId:d.roomId},(res)=>{
        if(!res.success) return toast(res.reason,'e');
        clearInterval(S.roomsTimer);
        if(document.getElementById('game-screen')?.classList.contains('active')) return;  // game already started
        showScreen('room-screen');
        const betLbl = bet ? ` | Entry: 🪙${bet.toLocaleString()}` : '';
        document.getElementById('ridlbl').textContent = `Room: ${d.roomId.substr(0,8).toUpperCase()}${betLbl}`;
        window.armRoomReSync?.(d.roomId);
        if(res.state?.players) renderWaiting(res.state.players);
        refreshRoom();
        if(d.code) showRoomCode(d.code);
        if(invites.length){
          Promise.allSettled(invites.map(fid =>
            api('POST','/friends/invite',{ friendId:fid, roomId:d.roomId })
          )).then(rs=>{
            const ok = rs.filter(r=>r.status==='fulfilled').length;
            if(ok) toast(`🎮 Invite sent to ${ok} friend${ok>1?'s':''}!`,'s');
          });
        }
      });
    }catch(e){ toast(e.message,'e'); }
  }

  // ════════════════════════════════════════════════════════════════
  //  GAME CENTER — hub for Training, Schedule, Trophies, Achievements
  // ════════════════════════════════════════════════════════════════
  const _gc = { difficulty:'medium', game:'UNO' };

  function showGameCenter(){
    const old=document.getElementById('gameCenter'); if(old) old.remove();
    _ensureGameCenterStyles();
    const ov=document.createElement('div');
    ov.id='gameCenter';
    // Game Center is now a Training-only panel: pick a game (UNO /
    // Ronda / Dama) and a difficulty, then start a solo match against
    // bots. No hub navigation, no schedule/trophies/achievements.
    ov.innerHTML=`
      <div class="gc-panel" role="dialog" aria-label="Training">
        <div class="gc-head">
          <div class="gc-head-titles">
            <div class="gc-title">TRAINING</div>
            <div class="gc-subtitle">Pick your game & jump in</div>
          </div>
          <button class="gc-close" id="gcClose" aria-label="Close">×</button>
        </div>
        <div class="gc-body" id="gcBody">${_gcTraining()}</div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#gcClose').addEventListener('click',_gcClose);
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) _gcClose(); });
  }
  function _gcClose(){
    const ov=document.getElementById('gameCenter');
    if(!ov) return;
    ov.classList.add('out');
    setTimeout(()=>ov.remove(),220);
  }
  function _gcNav(view){
    const body=document.getElementById('gcBody');
    const back=document.getElementById('gcBack');
    const title=document.getElementById('gcTitle');
    const sub=document.getElementById('gcSubtitle');
    if(!body) return;
    body.scrollTop=0;
    const meta={
      hub:         {t:t('g_hHub'),      s:t('g_everything')},
      training:    {t:t('g_hTraining'), s:t('g_hTrainingS')},
      schedule:    {t:t('g_hSchedule'), s:t('g_hScheduleS')},
      trophies:    {t:t('g_hTrophies'), s:t('g_hTrophiesS')},
      achievements:{t:t('g_hAch'),      s:t('g_hAchS')},
    }[view]||{t:t('g_hHub'),s:''};
    // Title/sub/back are absent in the Training-only rebuild — guard each.
    if(title) title.textContent=meta.t;
    if(sub)   sub.textContent=meta.s;
    if(back)  back.style.display = view==='hub' ? 'none' : '';
    body.style.animation='none'; void body.offsetWidth; body.style.animation='gcFade .3s ease';
    if(view==='hub')          body.innerHTML=_gcHub();
    else if(view==='training')body.innerHTML=_gcTraining();
    else if(view==='schedule'){ body.innerHTML=_gcLoading(t('g_loadFixtures')); _gcLoadSchedule(); }
    else if(view==='trophies'){ body.innerHTML=_gcLoading(t('g_openCabinet')); _gcLoadTrophies(); }
    else if(view==='achievements') body.innerHTML=_gcAchievements();
  }
  function _gcLoading(msg){
    return `<div class="gc-loading"><div class="gc-spinner"></div><div>${esc(msg)}</div></div>`;
  }

  // ── Hub ──────────────────────────────────────────────────────────
  function _gcHub(){
    const items=[
      {v:'training',    icon:'⚡', c:'#06B6D4', t:t('g_trainingT'), d:t('g_trainingD')},
      {v:'schedule',    icon:'📅', c:'#16A34A', t:t('g_scheduleT'), d:t('g_scheduleD')},
      {v:'trophies',    icon:'🏆', c:'#F59E0B', t:t('g_trophiesT'), d:t('g_trophiesD')},
      {v:'achievements',icon:'🏅', c:'#A855F7', t:t('g_achT'),      d:t('g_achD')},
    ];
    return `<div class="gc-hub">
      ${items.map(it=>`
        <button class="gc-card" data-view="${it.v}" onclick="_gcNav('${it.v}')" style="--gc-c:${it.c}">
          <div class="gc-card-glow"></div>
          <div class="gc-card-icon">${it.icon}</div>
          <div class="gc-card-text">
            <div class="gc-card-title">${it.t}</div>
            <div class="gc-card-desc">${it.d}</div>
          </div>
          <div class="gc-card-arrow">›</div>
        </button>`).join('')}
    </div>`;
  }

  // ── Training Ground ──────────────────────────────────────────────
  // Two-step pick: which GAME (UNO / Ronda / Dama) + which DIFFICULTY,
  // then a single "Start" button. Each game has its own start path:
  //   UNO   → practice:start (legacy fast path with a bot opponent)
  //   Ronda → POST /api/rooms with type RONDA, then game.bot-fill auto-
  //           tops the table up with 3 bots so the match can begin.
  //   Dama  → same shape as Ronda but type DAMA (1v1, 1 bot).
  function _gcTraining(){
    const games=[
      {id:'UNO',   icon:'🎴', name:'Cardora',   d:'Classic card draw'},
      {id:'RONDA', icon:'🃏', name:'Ronda', d:'Spanish deck 2v2'},
      {id:'DAMA',  icon:'⛂',  name:'Dama',  d:'Moroccan checkers'},
    ];
    const levels=[
      {id:'easy',   icon:'🟢', name:t('g_rookie'),  c:'#22C55E', tag:t('g_easy'),   d:t('g_rookieD')},
      {id:'medium', icon:'🟡', name:t('g_veteran'), c:'#F59E0B', tag:t('g_medium'), d:t('g_veteranD')},
      {id:'hard',   icon:'🔴', name:t('g_master'),  c:'#EF4444', tag:t('g_hard'),   d:t('g_masterD')},
    ];
    return `<div class="gc-train">
      <div class="gc-train-hint">Pick a game, then a difficulty.</div>

      <div class="gc-train-grouplbl">GAME</div>
      <div class="gc-games">
        ${games.map(g=>`
          <button class="gc-game ${g.id===_gc.game?'on':''}" data-game="${g.id}"
                  onclick="_gcPickGame('${g.id}')">
            <div class="gc-game-icon">${g.icon}</div>
            <div class="gc-game-name">${g.name}</div>
            <div class="gc-game-desc">${g.d}</div>
            <div class="gc-game-check">✓</div>
          </button>`).join('')}
      </div>

      <div class="gc-train-grouplbl">DIFFICULTY</div>
      <div class="gc-levels">
        ${levels.map(l=>`
          <button class="gc-level ${l.id===_gc.difficulty?'on':''}" data-diff="${l.id}"
            onclick="_gcPickDiff('${l.id}')" style="--lv-c:${l.c}">
            <div class="gc-level-icon">${l.icon}</div>
            <div class="gc-level-name">${l.name}</div>
            <div class="gc-level-tag">${l.tag}</div>
            <div class="gc-level-desc">${l.d}</div>
            <div class="gc-level-check">✓</div>
          </button>`).join('')}
      </div>

      <button class="gc-train-go" id="gcTrainGo" onclick="startTraining()">
        <span class="gc-go-shine"></span>${t('g_enterTraining')} →
      </button>
    </div>`;
  }
  function _gcPickDiff(id){
    _gc.difficulty=id;
    document.querySelectorAll('.gc-level').forEach(b=>b.classList.toggle('on',b.dataset.diff===id));
  }
  function _gcPickGame(id){
    _gc.game=id;
    document.querySelectorAll('.gc-game').forEach(b=>b.classList.toggle('on',b.dataset.game===id));
  }
  function startTraining(){
    if(!S.socket?.connected) return toast('Not connected','e');
    const btn=document.getElementById('gcTrainGo');
    const restoreBtn = () => {
      if(btn){ btn.disabled=false; btn.innerHTML='<span class="gc-go-shine"></span>'+t('g_enterTraining')+' →'; }
    };
    if(btn){ btn.disabled=true; btn.textContent=t('g_starting'); }

    const game = (_gc.game || 'UNO').toUpperCase();
    if (game === 'UNO'){
      // Legacy fast-path used by the existing UNO bot match.
      S.socket.emit('practice:start',{difficulty:_gc.difficulty},(res)=>{
        if(!res||!res.success){ restoreBtn(); return toast(res?.reason||'Could not start training','e'); }
        S.roomId=res.roomId;
        S.isSpectator=false;
        _gcClose();
        toast('⚙️ Match starting…','s');
      });
      return;
    }

    // Ronda / Dama path: create a private room of that type with no
    // entry fee, then immediately start. The room auto-fills with bots
    // (RondaManager.attachRondaListeners + Dama's equivalent already
    // schedule bot fills on host create).
    const maxPlayers = game === 'RONDA' ? 4 : 2;
    api('POST','/rooms',{settings:{ maxPlayers, bet:0, isPrivate:true, roomType: game }})
      .then(d => {
        S.roomId = d.roomId;
        S.currentRoomType = game;
        S.socket.emit('room:join',{roomId:d.roomId},(res)=>{
          if(!res?.success){ restoreBtn(); return toast(res?.reason||'Could not join training room','e'); }
          _gcClose();
          if(document.getElementById('game-screen')?.classList.contains('active')) return;  // game already started
          showScreen('room-screen');
          const betLbl = '';
          document.getElementById('ridlbl').textContent = `Room: ${d.roomId.substr(0,8).toUpperCase()}${betLbl}`;
          window.armRoomReSync?.(d.roomId);
          if(res.state?.players) renderWaiting(res.state.players);
          refreshRoom();
          toast(`⚙️ ${game} match starting…`,'s');
        });
      })
      .catch(e => { restoreBtn(); toast(e.message||'Could not create training room','e'); });
  }

  // ── Match Schedule ───────────────────────────────────────────────
  async function _gcLoadSchedule(){
    const body=document.getElementById('gcBody');
    if(!body) return;
    try{
      const d=await api('GET','/league/me');
      const matches=(d.myMatches||[]).slice().sort((a,b)=>a.scheduledAt-b.scheduledAt);
      if(!matches.length){
        body.innerHTML=`<div class="gc-empty"><div class="gc-empty-icon">📭</div>
          <div class="gc-empty-title">${t('g_noFixturesT')}</div>
          <div class="gc-empty-sub">${t('g_noFixturesS')}</div></div>`;
        return;
      }
      const now=d.serverNow||Date.now();
      const next=matches.find(m=>m.status==='scheduled');
      const rows=matches.map(m=>{
        const fin=m.status==='finished';
        const isNext=next&&m.id===next.id;
        const opp=m.opponent||{name:'TBD'};
        const res=m.result;
        const resCls=res==='W'?'win':res==='L'?'loss':res==='D'?'draw':'';
        const statusBadge = fin
          ? `<span class="gc-fix-res ${resCls}">${res||'-'} ${m.score||''}</span>`
          : m.playable
            ? `<span class="gc-fix-live">${t('g_liveNow')}</span>`
            : `<span class="gc-fix-soon">${_gcCountdown(m.scheduledAt-now)}</span>`;
        return `<div class="gc-fix ${isNext?'next':''} ${fin?'done':''}">
          ${isNext?`<div class="gc-fix-tag">${t('g_nextUp')}</div>`:''}
          <div class="gc-fix-date">
            <div class="gc-fix-day">${_gcDateParts(m.scheduledAt).day}</div>
            <div class="gc-fix-mon">${_gcDateParts(m.scheduledAt).mon}</div>
          </div>
          <div class="gc-fix-main">
            <div class="gc-fix-opp">${t('g_vs')} ${esc(opp.name)} ${opp.isBot?`<span class="gc-fix-bot">${t('g_bot')}</span>`:''}</div>
            <div class="gc-fix-when">${_gcDateParts(m.scheduledAt).full}</div>
          </div>
          <div class="gc-fix-status">${statusBadge}</div>
        </div>`;
      }).join('');
      body.innerHTML=`<div class="gc-sched">
        <div class="gc-sched-head">${t('g_season')} ${d.seasonNumber||1} · ${matches.length} ${t('g_fixtures')}</div>
        ${rows}
      </div>`;
    }catch(e){
      body.innerHTML=`<div class="gc-empty"><div class="gc-empty-icon">⚠️</div>
        <div class="gc-empty-title">${t('g_schedErr')}</div>
        <div class="gc-empty-sub">${esc(e.message||t('g_tryLater'))}</div></div>`;
    }
  }
  function _gcDateParts(ts){
    const dt=new Date(ts);
    const loc=I18N.current||'en';
    const hh=String(dt.getHours()).padStart(2,'0');
    const mm=String(dt.getMinutes()).padStart(2,'0');
    let mon, full;
    try{
      mon=dt.toLocaleDateString(loc,{month:'short'}).toUpperCase();
      full=`${dt.toLocaleDateString(loc,{weekday:'short',day:'numeric',month:'long',year:'numeric'})} · ${hh}:${mm}`;
    }catch(e){
      mon=dt.toLocaleDateString('en',{month:'short'}).toUpperCase();
      full=`${dt.toLocaleDateString('en',{weekday:'short',day:'numeric',month:'long',year:'numeric'})} · ${hh}:${mm}`;
    }
    return { day:String(dt.getDate()), mon, full };
  }
  function _gcCountdown(ms){
    if(ms<=0) return t('g_soon');
    const d=Math.floor(ms/86400000);
    const h=Math.floor((ms%86400000)/3600000);
    const m=Math.floor((ms%3600000)/60000);
    if(d>0) return `${d}d ${h}h`;
    if(h>0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  // ── Trophy Cabinet ───────────────────────────────────────────────
  async function _gcLoadTrophies(){
    const body=document.getElementById('gcBody');
    if(!body) return;
    try{
      const d=await api('GET','/rewards');
      const rewards=d.rewards||[];
      if(!rewards.length){
        body.innerHTML=`<div class="gc-empty"><div class="gc-empty-icon">🗄️</div>
          <div class="gc-empty-title">${t('g_emptyCabT')}</div>
          <div class="gc-empty-sub">${t('g_emptyCabS')}</div></div>`;
        return;
      }
      const rows=rewards.map(r=>`
        <div class="gc-trophy">
          <div class="gc-trophy-icon">${r.icon||'🪙'}</div>
          <div class="gc-trophy-main">
            <div class="gc-trophy-label">${esc(r.label||t('g_reward'))}</div>
            <div class="gc-trophy-date">${_gcDateParts(r.at).full}</div>
          </div>
          <div class="gc-trophy-amt">+${(r.amount||0).toLocaleString()} 🪙</div>
        </div>`).join('');
      body.innerHTML=`<div class="gc-trophies">
        <div class="gc-trophy-banner">
          <div class="gc-trophy-banner-icon">🏆</div>
          <div>
            <div class="gc-trophy-banner-val">${(d.totalWon||0).toLocaleString()} 🪙</div>
            <div class="gc-trophy-banner-lbl">${t('g_totalWon')} ${d.count||0} ${d.count===1?t('g_reward'):t('g_rewards')}</div>
          </div>
        </div>
        ${rows}
      </div>`;
    }catch(e){
      body.innerHTML=`<div class="gc-empty"><div class="gc-empty-icon">⚠️</div>
        <div class="gc-empty-title">${t('g_trophyErr')}</div>
        <div class="gc-empty-sub">${esc(e.message||t('g_tryLater'))}</div></div>`;
    }
  }

  // ── Achievements ─────────────────────────────────────────────────
  function _gcAchievements(){
    const u=S.user||{};
    const gp=u.stats?.gamesPlayed||0, gw=u.stats?.gamesWon||0;
    const coins=u.coins||0, elo=u.elo||1000, tw=u.tournamentWins||0;
    const defs=[
      {icon:'🎮', name:t('ach_firstSteps'), desc:t('ach_firstStepsD'), cur:gp,    tgt:1},
      {icon:'🃏', name:t('ach_warm'),       desc:t('ach_warmD'),       cur:gp,    tgt:10},
      {icon:'🎯', name:t('ach_seasoned'),   desc:t('ach_seasonedD'),   cur:gp,    tgt:50},
      {icon:'🏆', name:t('ach_firstWin'),   desc:t('ach_firstWinD'),   cur:gw,    tgt:1},
      {icon:'🔥', name:t('ach_habit'),      desc:t('ach_habitD'),      cur:gw,    tgt:10},
      {icon:'👑', name:t('ach_champion'),   desc:t('ach_championD'),   cur:gw,    tgt:50},
      {icon:'💰', name:t('ach_collector'),  desc:t('ach_collectorD'),  cur:coins, tgt:10000},
      {icon:'💎', name:t('ach_roller'),     desc:t('ach_rollerD'),     cur:coins, tgt:100000},
      {icon:'⚔️', name:t('ach_victor'),     desc:t('ach_victorD'),     cur:tw,    tgt:1},
      {icon:'📈', name:t('ach_skilled'),    desc:t('ach_skilledD'),    cur:elo,   tgt:1300},
      {icon:'⭐', name:t('ach_elite'),      desc:t('ach_eliteD'),      cur:elo,   tgt:1600},
    ];
    const unlocked=defs.filter(a=>a.cur>=a.tgt).length;
    const cards=defs.map(a=>{
      const done=a.cur>=a.tgt;
      const pct=Math.min(100,Math.round((a.cur/a.tgt)*100));
      return `<div class="gc-ach ${done?'on':''}">
        <div class="gc-ach-icon">${done?a.icon:'🔒'}</div>
        <div class="gc-ach-main">
          <div class="gc-ach-name">${a.name}${done?` <span class="gc-ach-done">${t('g_unlocked')}</span>`:''}</div>
          <div class="gc-ach-desc">${a.desc}</div>
          <div class="gc-ach-bar"><div class="gc-ach-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="gc-ach-prog">${Math.min(a.cur,a.tgt).toLocaleString()}/${a.tgt.toLocaleString()}</div>
      </div>`;
    }).join('');
    return `<div class="gc-achs">
      <div class="gc-ach-banner">
        <div class="gc-ach-banner-val">${unlocked}<span>/${defs.length}</span></div>
        <div class="gc-ach-banner-lbl">${t('g_badgesUnlocked')}</div>
      </div>
      ${cards}
    </div>`;
  }

  function _ensureGameCenterStyles(){
    if(document.getElementById('gc-styles')) return;
    const s=document.createElement('style'); s.id='gc-styles';
    s.textContent=`
      @keyframes gcIn{from{opacity:0}to{opacity:1}}
      @keyframes gcOut{to{opacity:0}}
      @keyframes gcPanelIn{from{transform:translateY(34px) scale(.96);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
      @keyframes gcFade{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
      @keyframes gcSpin{to{transform:rotate(360deg)}}
      @keyframes gcShine{0%{transform:translateX(-120%) skewX(-20deg)}100%{transform:translateX(320%) skewX(-20deg)}}
      @keyframes gcPulse{0%,100%{opacity:1}50%{opacity:.4}}
      #gameCenter{
        position:fixed;inset:0;z-index:1000;
        background:rgba(4,6,14,.82);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
        display:flex;align-items:center;justify-content:center;padding:20px;
        animation:gcIn .3s ease;
      }
      #gameCenter.out{animation:gcOut .2s ease forwards}
      .gc-panel{
        width:min(680px,96vw);max-height:90vh;display:flex;flex-direction:column;
        background:linear-gradient(180deg,rgba(28,32,57,.96),rgba(17,21,38,.98));
        border:1px solid rgba(255,255,255,.08);border-radius:22px;overflow:hidden;
        box-shadow:0 40px 100px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.05);
        animation:gcPanelIn .42s cubic-bezier(.2,.9,.3,1.2);
      }
      .gc-head{
        display:flex;align-items:center;gap:12px;padding:18px 20px;
        background:linear-gradient(135deg,rgba(6,182,212,.12),rgba(168,85,247,.08));
        border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;
      }
      .gc-back,.gc-close{
        width:36px;height:36px;flex-shrink:0;border-radius:50%;cursor:pointer;
        background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
        color:rgba(255,255,255,.8);font-size:22px;line-height:1;font-family:inherit;
        display:flex;align-items:center;justify-content:center;transition:all .2s;
      }
      .gc-back:hover{background:rgba(6,182,212,.2);border-color:rgba(6,182,212,.5);color:#fff}
      .gc-close:hover{background:rgba(232,50,74,.2);border-color:rgba(232,50,74,.5);color:#fff;transform:rotate(90deg)}
      .gc-head-titles{flex:1;min-width:0}
      .gc-title{font-family:'Bangers',cursive;font-size:24px;letter-spacing:2.5px;color:#fff;line-height:1}
      .gc-subtitle{font-size:11px;color:rgba(255,255,255,.5);font-weight:600;margin-top:3px}
      .gc-body{
        padding:20px;overflow-y:auto;overflow-x:hidden;
        scrollbar-width:thin;scrollbar-color:rgba(6,182,212,.3) transparent;
      }
      .gc-body::-webkit-scrollbar{width:5px}
      .gc-body::-webkit-scrollbar-thumb{background:rgba(6,182,212,.3);border-radius:5px}

      /* Hub */
      .gc-hub{display:flex;flex-direction:column;gap:12px}
      .gc-card{
        position:relative;display:flex;align-items:center;gap:16px;
        padding:18px;border-radius:16px;cursor:pointer;overflow:hidden;
        background:rgba(255,255,255,.025);border:1.5px solid rgba(255,255,255,.06);
        font-family:inherit;color:#fff;text-align:left;transition:all .25s ease;
      }
      .gc-card:hover{
        border-color:var(--gc-c);transform:translateX(4px);
        background:rgba(255,255,255,.05);
      }
      .gc-card-glow{
        position:absolute;left:-40px;top:50%;width:120px;height:120px;
        transform:translateY(-50%);border-radius:50%;
        background:var(--gc-c);opacity:.14;filter:blur(34px);pointer-events:none;
      }
      .gc-card-icon{
        font-size:32px;width:58px;height:58px;flex-shrink:0;border-radius:14px;
        display:flex;align-items:center;justify-content:center;
        background:color-mix(in srgb,var(--gc-c) 16%,transparent);
        border:1px solid color-mix(in srgb,var(--gc-c) 35%,transparent);
      }
      .gc-card-text{flex:1;min-width:0}
      .gc-card-title{font-weight:800;font-size:16px;color:#fff;margin-bottom:3px}
      .gc-card-desc{font-size:12px;color:rgba(255,255,255,.5);font-weight:600;line-height:1.4}
      .gc-card-arrow{font-size:26px;color:var(--gc-c);font-weight:700;flex-shrink:0}

      /* Loading / empty */
      .gc-loading{display:flex;flex-direction:column;align-items:center;gap:14px;padding:50px 20px;color:rgba(255,255,255,.55);font-weight:600;font-size:13px}
      .gc-spinner{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.1);border-top-color:#06B6D4;animation:gcSpin .8s linear infinite}
      .gc-empty{text-align:center;padding:46px 20px}
      .gc-empty-icon{font-size:48px;margin-bottom:12px;opacity:.7}
      .gc-empty-title{font-weight:800;font-size:16px;color:#fff;margin-bottom:6px}
      .gc-empty-sub{font-size:12px;color:rgba(255,255,255,.5);font-weight:600;max-width:340px;margin:0 auto;line-height:1.5}

      /* Training */
      .gc-train-hint{font-size:12px;color:rgba(255,255,255,.55);font-weight:600;text-align:center;margin-bottom:16px;line-height:1.5}
      .gc-train-grouplbl{
        font-size:10px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,.45);
        margin:4px 2px 8px;
      }
      .gc-games{
        display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;
      }
      .gc-game{
        position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;
        padding:14px 10px 12px;border-radius:14px;cursor:pointer;
        background:rgba(255,255,255,.025);border:1.5px solid rgba(255,255,255,.06);
        font-family:inherit;color:#fff;transition:all .22s ease;
      }
      .gc-game:hover{border-color:#A78BFA;background:rgba(255,255,255,.05)}
      .gc-game.on{
        border-color:#A78BFA;
        background:color-mix(in srgb,#A78BFA 12%,transparent);
        box-shadow:0 6px 22px color-mix(in srgb,#A78BFA 30%,transparent);
      }
      .gc-game-icon{font-size:24px;line-height:1}
      .gc-game-name{font-weight:900;font-size:13px;letter-spacing:.5px}
      .gc-game-desc{font-size:10px;color:rgba(255,255,255,.5);font-weight:600;text-align:center;line-height:1.3}
      .gc-game-check{
        position:absolute;top:8px;right:8px;width:18px;height:18px;border-radius:50%;
        background:#A78BFA;color:#0B0E18;font-weight:900;font-size:11px;
        display:none;align-items:center;justify-content:center;
      }
      .gc-game.on .gc-game-check{display:flex}
      .gc-levels{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
      .gc-level{
        position:relative;display:grid;grid-template-columns:auto auto 1fr;gap:4px 14px;
        align-items:center;padding:14px 16px;border-radius:14px;cursor:pointer;
        background:rgba(255,255,255,.025);border:1.5px solid rgba(255,255,255,.06);
        font-family:inherit;color:#fff;text-align:left;transition:all .22s ease;
      }
      .gc-level:hover{border-color:var(--lv-c);background:rgba(255,255,255,.05)}
      .gc-level.on{border-color:var(--lv-c);background:color-mix(in srgb,var(--lv-c) 11%,transparent);box-shadow:0 6px 20px color-mix(in srgb,var(--lv-c) 28%,transparent)}
      .gc-level-icon{font-size:24px;grid-row:1/3}
      .gc-level-name{font-weight:800;font-size:15px}
      .gc-level-tag{
        font-size:9px;font-weight:800;letter-spacing:1.5px;padding:3px 8px;border-radius:20px;
        background:color-mix(in srgb,var(--lv-c) 20%,transparent);color:var(--lv-c);justify-self:start;
      }
      .gc-level-desc{grid-column:2/4;font-size:11px;color:rgba(255,255,255,.5);font-weight:600;line-height:1.4}
      .gc-level-check{
        position:absolute;top:12px;right:14px;width:22px;height:22px;border-radius:50%;
        background:var(--lv-c);color:#0B0E18;font-weight:900;font-size:13px;
        display:none;align-items:center;justify-content:center;
      }
      .gc-level.on .gc-level-check{display:flex}
      .gc-train-go,.arena-go-clone{position:relative}
      .gc-train-go{
        width:100%;padding:16px;border:none;border-radius:14px;cursor:pointer;overflow:hidden;
        background:linear-gradient(135deg,#06B6D4,#7C3AED);color:#fff;
        font-family:'Bangers',cursive;font-size:20px;letter-spacing:2.5px;
        box-shadow:0 12px 30px rgba(6,182,212,.4);transition:all .2s;
      }
      .gc-train-go:hover{transform:translateY(-2px);box-shadow:0 16px 38px rgba(6,182,212,.55)}
      .gc-train-go:disabled{opacity:.6;cursor:default;transform:none}
      .gc-go-shine{
        position:absolute;top:0;left:0;width:40%;height:100%;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);
        animation:gcShine 2.6s ease-in-out infinite;
      }

      /* Schedule */
      .gc-sched{display:flex;flex-direction:column;gap:10px}
      .gc-sched-head{font-size:11px;font-weight:800;letter-spacing:1.5px;color:rgba(255,255,255,.45);text-transform:uppercase;margin-bottom:2px}
      .gc-fix{
        position:relative;display:flex;align-items:center;gap:14px;padding:13px 14px;
        border-radius:13px;background:rgba(255,255,255,.025);border:1.5px solid rgba(255,255,255,.06);
      }
      .gc-fix.next{border-color:rgba(6,182,212,.5);background:rgba(6,182,212,.07);padding-top:22px}
      .gc-fix.done{opacity:.72}
      .gc-fix-tag{
        position:absolute;top:7px;left:14px;font-size:8px;font-weight:800;letter-spacing:1.5px;
        color:#06B6D4;
      }
      .gc-fix-date{
        flex-shrink:0;width:48px;text-align:center;border-radius:10px;padding:6px 0;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);
      }
      .gc-fix-day{font-family:'Bangers',cursive;font-size:22px;line-height:1;color:#fff}
      .gc-fix-mon{font-size:9px;font-weight:800;letter-spacing:1px;color:rgba(255,255,255,.5)}
      .gc-fix-main{flex:1;min-width:0}
      .gc-fix-opp{font-weight:800;font-size:14px;color:#fff;display:flex;align-items:center;gap:6px}
      .gc-fix-bot{font-size:8px;font-weight:800;letter-spacing:1px;background:rgba(96,165,250,.18);color:#60a5fa;padding:2px 6px;border-radius:10px}
      .gc-fix-when{font-size:11px;color:rgba(255,255,255,.5);font-weight:600;margin-top:3px}
      .gc-fix-status{flex-shrink:0;text-align:right}
      .gc-fix-soon{font-size:11px;font-weight:800;color:rgba(255,255,255,.6)}
      .gc-fix-live{font-size:11px;font-weight:800;color:#22C55E;animation:gcPulse 1.4s ease-in-out infinite}
      .gc-fix-res{font-size:12px;font-weight:800;padding:4px 9px;border-radius:8px}
      .gc-fix-res.win{background:rgba(34,197,94,.18);color:#4ade80}
      .gc-fix-res.loss{background:rgba(239,68,68,.18);color:#f87171}
      .gc-fix-res.draw{background:rgba(245,158,11,.18);color:#fbbf24}

      /* Trophies */
      .gc-trophies{display:flex;flex-direction:column;gap:9px}
      .gc-trophy-banner{
        display:flex;align-items:center;gap:14px;padding:16px;border-radius:14px;margin-bottom:6px;
        background:linear-gradient(135deg,rgba(245,158,11,.14),rgba(232,50,74,.08));
        border:1px solid rgba(245,158,11,.25);
      }
      .gc-trophy-banner-icon{font-size:34px}
      .gc-trophy-banner-val{font-family:'Bangers',cursive;font-size:26px;letter-spacing:1px;color:#F59E0B}
      .gc-trophy-banner-lbl{font-size:11px;color:rgba(255,255,255,.55);font-weight:600;margin-top:2px}
      .gc-trophy{
        display:flex;align-items:center;gap:13px;padding:12px 14px;border-radius:12px;
        background:rgba(255,255,255,.025);border:1.5px solid rgba(255,255,255,.06);
      }
      .gc-trophy-icon{font-size:24px;flex-shrink:0;width:42px;height:42px;border-radius:11px;
        display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04)}
      .gc-trophy-main{flex:1;min-width:0}
      .gc-trophy-label{font-weight:800;font-size:13px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .gc-trophy-date{font-size:10px;color:rgba(255,255,255,.45);font-weight:600;margin-top:2px}
      .gc-trophy-amt{font-weight:800;font-size:13px;color:#4ade80;flex-shrink:0}

      /* Achievements */
      .gc-achs{display:flex;flex-direction:column;gap:9px}
      .gc-ach-banner{
        text-align:center;padding:18px;border-radius:14px;margin-bottom:6px;
        background:linear-gradient(135deg,rgba(168,85,247,.16),rgba(6,182,212,.08));
        border:1px solid rgba(168,85,247,.25);
      }
      .gc-ach-banner-val{font-family:'Bangers',cursive;font-size:38px;letter-spacing:1px;color:#A855F7;line-height:1}
      .gc-ach-banner-val span{font-size:22px;color:rgba(255,255,255,.4)}
      .gc-ach-banner-lbl{font-size:11px;color:rgba(255,255,255,.55);font-weight:600;margin-top:4px}
      .gc-ach{
        display:flex;align-items:center;gap:13px;padding:12px 14px;border-radius:12px;
        background:rgba(255,255,255,.02);border:1.5px solid rgba(255,255,255,.05);
      }
      .gc-ach.on{background:rgba(168,85,247,.07);border-color:rgba(168,85,247,.3)}
      .gc-ach-icon{
        font-size:22px;flex-shrink:0;width:44px;height:44px;border-radius:11px;
        display:flex;align-items:center;justify-content:center;
        background:rgba(255,255,255,.04);
      }
      .gc-ach.on .gc-ach-icon{background:rgba(168,85,247,.16);filter:drop-shadow(0 2px 8px rgba(168,85,247,.5))}
      .gc-ach-main{flex:1;min-width:0}
      .gc-ach-name{font-weight:800;font-size:13px;color:#fff;display:flex;align-items:center;gap:7px}
      .gc-ach-done{font-size:8px;font-weight:800;letter-spacing:1px;background:rgba(168,85,247,.22);color:#c084fc;padding:2px 6px;border-radius:10px}
      .gc-ach-desc{font-size:11px;color:rgba(255,255,255,.5);font-weight:600;margin:3px 0 6px}
      .gc-ach-bar{height:5px;border-radius:5px;background:rgba(255,255,255,.07);overflow:hidden}
      .gc-ach-fill{height:100%;border-radius:5px;background:linear-gradient(90deg,#A855F7,#06B6D4);transition:width .5s ease}
      .gc-ach-prog{font-size:10px;font-weight:800;color:rgba(255,255,255,.5);flex-shrink:0}

      @media (max-width:520px){
        .gc-title{font-size:20px}
        .gc-card-icon{width:48px;height:48px;font-size:26px}
        .gc-card-title{font-size:14px}
      }
    `;
    document.head.appendChild(s);
  }

  function doJoin(roomId){
    // Ambient (simulated) lobby rooms aren't real server rooms — their id is
    // `ambient_<TYPE>_<rand>`. Joining one drops the player into a fresh
    // quick-match of that game type (filled with opponents), so it plays out
    // exactly like joining a real room.
    if(/^ambient_/.test(String(roomId))){
      const parts  = String(roomId).split('_');     // ambient_<TYPE>_<SEATED>_<BET>_<rand>
      const type   = parts[1] || 'CLASSIC';
      const seated = parseInt(parts[2], 10) || 1;    // how many the card showed
      const bet    = parseInt(parts[3], 10) || 0;    // the stake the card showed (may be high)
      // Seat the FULL shown count as bots so you land NEXT TO them (you become
      // the next player): a "1/4" card → you + that 1 player = 2/4. The server
      // clamps to leave ≥1 open seat for the live fill. Passing the bet makes a
      // high-stakes card spawn a real high-stakes table (elite HARD opponents).
      if(typeof quickJoin === 'function'){ quickJoin(type, seated, undefined, bet); return; }
    }
    // Event rooms get a cinematic entry wipe before the screen swaps.
    EVENT.roomEnter(()=>_doJoinNow(roomId));
  }
  function _doJoinNow(roomId){
    S.roomId=roomId;
    S.socket.emit('room:join',{roomId},(res)=>{
      if(!res.success)return toast(res.reason,'e');
      clearInterval(S.roomsTimer);
      if(document.getElementById('game-screen')?.classList.contains('active')) return;  // game already started
      showScreen('room-screen');
      document.getElementById('ridlbl').textContent=`Room: ${roomId.substr(0,8).toUpperCase()}`;
      if(res.state?.players)renderWaiting(res.state.players);refreshRoom();
      window.armRoomReSync?.(roomId);
      EVENT.enterRoomAmbiance();
    });
  }
  function doWatch(roomId){
    if(!S.socket?.connected) return toast('Not connected','e');
    EVENT.roomEnter(()=>_doWatchNow(roomId));
  }
  function _doWatchNow(roomId){
    // Set spectator intent SYNCHRONOUSLY before emitting, so any state
    // event that races ahead of the ack is handled in spectator mode
    // (each game's _onState checks S.isSpectator) rather than trying to
    // enter the player as a seated participant.
    S.isSpectator = true;
    S.socket.emit('room:spectate',{roomId},(res)=>{
      if(!res.success){
        S.isSpectator = false;
        // You're ALREADY a player in this room → don't error, just rejoin your
        // own game (the LIVE button doubles as "back to my match").
        if(/already a player/i.test(res.reason || '')){
          S.roomId = roomId;
          S.socket.emit('room:join',{roomId},(jr)=>{
            if(jr && jr.success !== false){
              S.currentRoomType = jr.roomType || S.currentRoomType || null;
              clearInterval(S.roomsTimer);
              showScreen('game-screen');
              showChatFab(true);
              try{ EVENT.enterRoomAmbiance(); }catch(_){}
              toast('↩️ Back to your match','s');
            } else { S.roomId = null; toast(jr?.reason || 'Could not rejoin','e'); }
          });
          return;
        }
        return toast(res.reason||'Could not join as spectator','e');
      }
      S.roomId = roomId;
      S.currentRoomType = res.roomType || null;
      clearInterval(S.roomsTimer);
      showScreen('game-screen');
      showChatFab(true);
      EVENT.enterRoomAmbiance();
      toast('👁️ Watching live!','s');
      // The game-type state event (ronda:state / dama:state /
      // game:spectator_state) drives the actual read-only view via each
      // module's own handler.
    });
  }
  function doLeaveSpectate(){
    if(!S.socket || !S.roomId) return;
    S.socket.emit('room:spectate_leave',{},()=>{
      S.roomId = null;
      S.isSpectator = false;
      showChatFab(false);
      goLobby();
    });
  }
  function refreshRoom(){if(!S.roomId)return;api('GET',`/rooms/${S.roomId}`).then(d=>{if(d.settings?.maxPlayers)S.currentRoomMaxPl=d.settings.maxPlayers;if(d.players)renderWaiting(d.players);}).catch(()=>{});}

  // Host-only — remove a player from the waiting room before the game starts.
  // Confirms first so a fat-finger doesn't boot someone. Server validates
  // host identity + lobby phase as a safety net.
  function doKickPlayer(playerId, username){
    if(!playerId) return;
    const name = String(username || 'this player');
    if(!confirm(`Remove ${name} from the room?`)) return;
    if(!S.socket?.connected) return toast('Not connected', 'e');
    S.socket.emit('room:kick', { playerId }, (res)=>{
      if(!res?.success) return toast(res?.reason || 'Could not remove', 'e');
      toast(`👋 Removed ${name}`, 's');
      // The 'room:player_left' event auto-refreshes the list for us.
    });
  }
  window.doKickPlayer = doKickPlayer;
  // ── Ranked matchmaking search overlay ──
  // Mounts ONLY when waiting in a RANKED room with empty seats. Renders:
  //   • Animated radar pulse + scanning ring
  //   • Player's tier badge + RP (or 🎯 PLACEMENT)
  //   • Live "Searching ±N RP" window that widens every 15s (matches the
  //     server's rankedMmrWindow growth so the readout is honest)
  //   • Countdown to bot fill ("Bots join in 0:23"). Server fires the
  //     ranked:auto_start event when the timer expires.
  // Auto-tears down when room fills, when match starts, or when leaving
  // the room. Idempotent — safe to call on every renderWaiting tick.
  let _rankedSearchTimer = null;
  let _msRevealed = false;          // true once the "room filled" reveal has started
  let _msSeenIds  = new Set();      // player ids already shown seated (so reveal plays once each)
  function _stopRankedSearch(){
    if(_rankedSearchTimer){ clearInterval(_rankedSearchTimer); _rankedSearchTimer = null; }
    if(_msRevealTimer){ clearTimeout(_msRevealTimer); _msRevealTimer = null; }
    _msRevealed = false; _msSeenIds = new Set();
    const box = document.getElementById('rankedSearchBox');
    if(box){ box.innerHTML = ''; box.style.display = 'none'; }
  }
  let _msRevealTimer = null;
  function _ensureRankedSearchStyles(){
    if(document.getElementById('rankedSearchStyles')) return;
    const s = document.createElement('style');
    s.id = 'rankedSearchStyles';
    s.textContent = `
      .rs-box{
        position:relative;
        margin:0 0 22px 0;
        padding:32px 22px 22px;
        background:
          radial-gradient(ellipse at 50% 0%, rgba(255,107,107,.20) 0%, rgba(0,0,0,0) 60%),
          linear-gradient(180deg, rgba(28,8,38,.95), rgba(10,4,22,.98));
        border:1.5px solid rgba(255,107,107,.55);
        border-radius:18px;
        box-shadow:
          0 12px 40px rgba(0,0,0,.6),
          0 0 40px rgba(255,107,107,.18),
          inset 0 1px 0 rgba(255,255,255,.08);
        text-align:center;
      }
      .rs-radar{
        position:relative; overflow:hidden;
        margin:0 auto 18px;
        width:140px; height:140px; border-radius:50%;
        background:
          radial-gradient(circle, rgba(34,197,94,.10) 0%, transparent 62%),
          radial-gradient(circle at 50% 50%, rgba(10,4,22,.9), rgba(6,2,14,.96));
        border:3px solid rgba(251,191,36,.55);
        box-shadow:
          0 0 30px rgba(251,191,36,.30),
          inset 0 0 26px rgba(0,0,0,.6);
      }
      /* Concentric range rings + crosshair — the radar "screen". */
      .rs-radar-grid{
        position:absolute; inset:0; border-radius:50%; pointer-events:none;
        background:
          radial-gradient(circle, transparent 0 31%, rgba(34,197,94,.22) 31% 32%, transparent 32%),
          radial-gradient(circle, transparent 0 62%, rgba(34,197,94,.18) 62% 63%, transparent 63%),
          linear-gradient(0deg,  transparent 49.4%, rgba(34,197,94,.14) 49.4% 50.6%, transparent 50.6%),
          linear-gradient(90deg, transparent 49.4%, rgba(34,197,94,.14) 49.4% 50.6%, transparent 50.6%);
      }
      /* Rotating sonar cone — bright leading edge fading to a trail. Rotating
         the element (GPU transform) keeps it perfectly smooth. */
      .rs-radar-sweep{
        position:absolute; inset:0; border-radius:50%;
        background:conic-gradient(from 0deg,
          rgba(251,191,36,.55) 0deg,
          rgba(251,191,36,.22) 26deg,
          rgba(251,191,36,.04) 70deg,
          transparent 110deg, transparent 360deg);
        animation:rsSweep 2.4s linear infinite;
        will-change:transform;
      }
      @keyframes rsSweep{ from{transform:rotate(0)} to{transform:rotate(360deg)} }
      .rs-radar-dot{
        position:absolute; left:50%; top:50%;
        width:7px; height:7px; border-radius:50%;
        background:#FBBF24;
        box-shadow:0 0 12px #FBBF24, 0 0 4px #fff;
        transform:translate(-50%, -50%);
        z-index:2;
      }
      /* "Contact" blips — flash in as the sweep passes (sonar found someone). */
      .rs-blip{
        position:absolute; width:8px; height:8px; border-radius:50%;
        background:#4ADE80; box-shadow:0 0 10px #4ADE80;
        opacity:0; z-index:1;
        animation:rsBlip 2.4s ease-out infinite;
      }
      .rs-blip-1{ left:66%; top:33%; animation-delay:.45s; }
      .rs-blip-2{ left:36%; top:58%; animation-delay:1.25s; }
      .rs-blip-3{ left:60%; top:67%; animation-delay:1.95s; }
      @keyframes rsBlip{
        0%   { opacity:0; transform:translate(-50%,-50%) scale(.3); }
        8%   { opacity:1; transform:translate(-50%,-50%) scale(1); }
        55%  { opacity:.55; }
        100% { opacity:0; transform:translate(-50%,-50%) scale(1.6); }
      }
      .rs-content{
        display:flex; flex-direction:column; align-items:center; gap:6px;
      }
      .rs-eyebrow{
        font-size:12px; font-weight:900; letter-spacing:4px;
        color:#FF6B6B; text-transform:uppercase;
      }
      .rs-eyebrow .rs-dot{
        display:inline-block; width:6px; height:6px; border-radius:50%;
        background:#FF6B6B; margin-right:6px; vertical-align:middle;
        animation:rsBlink 1s ease-in-out infinite;
      }
      @keyframes rsBlink{ 0%,100%{opacity:.3} 50%{opacity:1} }
      .rs-title{
        font-family:'Bangers',sans-serif; font-size:34px; letter-spacing:3px;
        color:#FFFBEB;
        text-shadow:0 3px 10px rgba(0,0,0,.8), 0 0 22px rgba(255,107,107,.45);
        margin:4px 0 2px;
      }
      .rs-meta{
        font-size:13px; color:rgba(255,255,255,.78);
        letter-spacing:.6px;
      }
      .rs-meta b{ color:#FBBF24; font-weight:800; }
      .rs-meta .rs-rank{ color:var(--accent, #FBBF24); font-weight:800; }
      .rs-countdown{
        margin-top:14px; padding:10px 18px;
        border:1px solid rgba(255,255,255,.10);
        border-radius:99px;
        background:rgba(0,0,0,.35);
        display:inline-flex; align-items:center; gap:10px;
        font-size:12px; color:rgba(255,255,255,.78);
        letter-spacing:1px;
      }
      .rs-countdown b{
        color:#FF6B6B;
        font-family:'Bangers',sans-serif;
        letter-spacing:2px; font-size:20px;
      }
      /* ── Live seat slots — filled avatars + pulsing open seats ── */
      .rs-seats{ display:flex; justify-content:center; gap:11px; margin:16px 0 4px; }
      .rs-seat{
        width:46px; height:46px; border-radius:50%; flex:0 0 auto;
        display:flex; align-items:center; justify-content:center;
        font-family:'Bangers',sans-serif; font-size:19px; color:#FFFBEB;
        background-size:cover; background-position:center;
      }
      .rs-seat-on{
        border:2px solid #FBBF24; background-color:#3a2150;
        box-shadow:0 4px 12px rgba(0,0,0,.5), 0 0 14px rgba(251,191,36,.40);
        animation:rsSeatPop .32s cubic-bezier(.34,1.56,.64,1);
      }
      @keyframes rsSeatPop{ 0%{transform:scale(.5);opacity:0} 100%{transform:scale(1);opacity:1} }
      .rs-seat-empty{
        border:2px dashed rgba(255,255,255,.22);
        color:rgba(255,255,255,.4); background:rgba(255,255,255,.03);
        animation:rsSeatWait 1.7s ease-in-out infinite;
      }
      @keyframes rsSeatWait{ 0%,100%{opacity:.45; border-color:rgba(255,255,255,.18)} 50%{opacity:.9; border-color:rgba(251,191,36,.5)} }
      /* ── Rotating tip — entertain + teach while waiting ── */
      .rs-tip{
        margin:14px auto 2px; max-width:330px; min-height:42px;
        display:flex; align-items:center; gap:9px;
        padding:10px 14px; border-radius:13px;
        background:rgba(251,191,36,.08); border:1px solid rgba(251,191,36,.20);
        font-size:12.5px; line-height:1.45; color:rgba(255,255,255,.85); text-align:left;
      }
      .rs-tip-ic{ flex:0 0 auto; font-size:15px; }
      .rs-tip-txt{ transition:opacity .18s ease; }
      @media (max-width:520px){
        .rs-box{ padding:24px 16px 18px; }
        .rs-radar{ width:110px; height:110px; }
        .rs-title{ font-size:26px; }
        .rs-seat{ width:40px; height:40px; font-size:17px; }
      }
    `;
    document.head.appendChild(s);
  }

  // Clicking an empty "invite" seat opens the friends panel so the player can
  // pull friends straight into the match they're waiting in.
  function inviteToMatch(){
    if(typeof toggleFriendsPanel === 'function') toggleFriendsPanel();
    else if(typeof toast === 'function') toast('Open the 👥 Friends panel to invite friends', 'i');
  }
  window.inviteToMatch = inviteToMatch;

  // Professional, game-aware matchmaking screen: a branded emblem + title for
  // whichever game the player picked, live player seats (empty ones invite
  // friends), a rotating game-rule card, live stats and a cancel button.
  function _ensureMatchScreenStyles(){
    if(document.getElementById('matchScreenStyles')) return;
    const s = document.createElement('style'); s.id = 'matchScreenStyles';
    s.textContent = `
      .ms-box{
        position:relative; margin:0 0 22px; padding:30px 22px 22px; text-align:center; overflow:hidden;
        background:radial-gradient(ellipse at 50% -8%, color-mix(in srgb, var(--c2) 26%, transparent) 0%, transparent 55%),
                   linear-gradient(180deg, rgba(16,10,28,.96), rgba(8,5,18,.98));
        border:1.5px solid color-mix(in srgb, var(--c1) 45%, transparent); border-radius:22px;
        box-shadow:0 16px 48px rgba(0,0,0,.6), 0 0 50px color-mix(in srgb, var(--c2) 15%, transparent), inset 0 1px 0 rgba(255,255,255,.07);
      }
      .ms-glow{ position:absolute; top:-44%; left:50%; width:360px; height:360px; transform:translateX(-50%); pointer-events:none;
        background:radial-gradient(circle, color-mix(in srgb, var(--c1) 20%, transparent), transparent 60%); }
      .ms-emblem{ position:relative; width:112px; height:112px; margin:0 auto; display:flex; align-items:center; justify-content:center; }
      .ms-emblem::before{ content:''; position:absolute; inset:0; border-radius:50%;
        background:conic-gradient(from 0deg, var(--c1), var(--c2) 45%, transparent 62%, var(--c1));
        box-shadow:0 0 28px color-mix(in srgb, var(--c1) 40%, transparent); animation:msSpin 3.6s linear infinite; }
      @keyframes msSpin{ to{ transform:rotate(360deg); } }
      .ms-emblem-core{ position:relative; z-index:1; width:100px; height:100px; border-radius:50%; overflow:hidden;
        display:flex; align-items:center; justify-content:center; font-size:46px; line-height:1;
        background:radial-gradient(circle at 35% 28%, color-mix(in srgb, var(--c1) 26%, #1a1030), #0b0718);
        box-shadow:inset 0 4px 14px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.06); }
      /* Real game artwork fills the emblem (with a subtle dark vignette so the
         glowing ring still reads against it). */
      .ms-emblem-core.ms-emblem-img{
        background-size:cover; background-position:center; font-size:0;
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.12), inset 0 -18px 26px rgba(0,0,0,.45);
      }
      .ms-eyebrow{ font-size:11px; font-weight:900; letter-spacing:4px; color:var(--c2); text-transform:uppercase; margin-top:12px; }
      .ms-eyebrow .ms-dot{ display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--c2);
        margin-right:7px; vertical-align:middle; box-shadow:0 0 8px var(--c2); animation:msBlink 1s ease-in-out infinite; }
      @keyframes msBlink{ 0%,100%{ opacity:.3 } 50%{ opacity:1 } }
      .ms-title{ font-family:'Bangers',sans-serif; font-size:44px; letter-spacing:3px; line-height:1; margin:5px 0 4px;
        background:linear-gradient(180deg, #fff 0%, var(--c1) 70%, var(--c2));
        -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        filter:drop-shadow(0 3px 8px rgba(0,0,0,.55)); }
      .ms-sub{ font-size:13px; color:rgba(255,255,255,.72); }
      .ms-sub b{ color:var(--c1); font-weight:900; }
      .ms-seats{ display:flex; justify-content:center; gap:14px; margin:20px 0 4px; flex-wrap:wrap; }
      .ms-seat{ position:relative; display:flex; flex-direction:column; align-items:center; gap:6px; }
      .ms-seat-av{ width:62px; height:62px; border-radius:50%; display:flex; align-items:center; justify-content:center;
        background-size:cover; background-position:center; font-family:'Bangers',sans-serif; font-size:24px; color:#FFFBEB; }
      .ms-seat-on .ms-seat-av{ border:3px solid var(--c1); background-color:#2a1840;
        box-shadow:0 6px 16px rgba(0,0,0,.5), 0 0 16px color-mix(in srgb, var(--c1) 45%, transparent);
        animation:msPop .35s cubic-bezier(.34,1.56,.64,1); }
      @keyframes msPop{ 0%{ transform:scale(.4); opacity:0 } 100%{ transform:scale(1); opacity:1 } }
      /* Reveal — the reel "lands" on a real opponent: rolls in from above with
         motion-blur clearing + a gold flash, then settles. Higher specificity
         than .ms-seat-on so it overrides msPop. */
      .ms-seat-on.ms-seat-reveal .ms-seat-av{ animation:msReveal .66s cubic-bezier(.16,.84,.3,1) both; }
      @keyframes msReveal{
        0%   { opacity:0; transform:translateY(-30px) scale(1.06); filter:blur(6px) brightness(1.6);
               box-shadow:0 0 0 0 rgba(251,191,36,0); }
        50%  { opacity:1; transform:translateY(6px) scale(.97);   filter:blur(1.4px) brightness(1.2);
               box-shadow:0 0 26px 5px color-mix(in srgb, var(--c1) 70%, #fff); }
        76%  { transform:translateY(-3px) scale(1.015);            filter:blur(0) brightness(1.04); }
        100% { opacity:1; transform:translateY(0) scale(1);        filter:blur(0) brightness(1);
               box-shadow:0 6px 16px rgba(0,0,0,.5), 0 0 16px color-mix(in srgb, var(--c1) 45%, transparent); }
      }
      .ms-seat-reveal .ms-seat-lbl{ animation:msLblIn .5s .2s ease both; }
      @keyframes msLblIn{ from{ opacity:0; transform:translateY(5px) } to{ opacity:1; transform:translateY(0) } }
      .ms-seat-me .ms-seat-av{ border-color:#FBBF24; }
      .ms-seat-crown{ position:absolute; top:-15px; left:50%; transform:translateX(-50%) rotate(-12deg);
        font-size:18px; filter:drop-shadow(0 2px 3px rgba(0,0,0,.6)); z-index:2; }
      .ms-seat-lbl{ font-size:9px; font-weight:900; letter-spacing:.6px; color:rgba(255,255,255,.5); text-transform:uppercase; max-width:78px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      /* Revealed opponents get a brighter, slightly larger name so they read clearly */
      .ms-seat-reveal .ms-seat-lbl{ color:rgba(255,255,255,.92); font-size:9.5px; }
      .ms-seat-me .ms-seat-lbl{ color:#FBBF24; }
      .ms-seat-empty{ cursor:pointer; }
      .ms-seat-empty .ms-seat-av{ position:relative; overflow:hidden; padding:0;
        border:2.5px dashed color-mix(in srgb, var(--c1) 50%, rgba(255,255,255,.28));
        background:#0b0718; transition:transform .15s, border-color .2s;
        animation:msWait 1.8s ease-in-out infinite; }
      @keyframes msWait{ 0%,100%{ border-color:rgba(255,255,255,.18) } 50%{ border-color:color-mix(in srgb, var(--c1) 60%, transparent) } }
      /* ── Lottery reel — real avatars scroll past endlessly while we "search" ── */
      .ms-reel{ position:absolute; left:0; top:0; width:100%; display:flex; flex-direction:column;
        animation:msReel 3s linear infinite; will-change:transform; }
      @keyframes msReel{ from{ transform:translateY(0) } to{ transform:translateY(-50%) } }
      .ms-reel-img{ width:100%; height:62px; flex:0 0 62px; background-size:cover; background-position:center;
        filter:blur(.5px) saturate(.8) brightness(.72); transition:filter .2s; }
      /* dim vignette so the spinning faces read as "searching", not a seated player */
      .ms-seat-empty .ms-seat-av::after{ content:''; position:absolute; inset:0; border-radius:50%; z-index:2; pointer-events:none;
        background:radial-gradient(circle at 50% 50%, transparent 36%, rgba(8,5,18,.66) 100%);
        box-shadow:inset 0 0 14px rgba(0,0,0,.7); }
      /* a bright scan line sweeping top→bottom — the slot-machine "tell" */
      .ms-seat-empty .ms-seat-av::before{ content:''; position:absolute; left:0; right:0; top:-40%; height:40%; z-index:3; pointer-events:none;
        background:linear-gradient(180deg, transparent, color-mix(in srgb, var(--c1) 55%, #fff), transparent);
        opacity:0; animation:msScan 1.5s ease-in-out infinite; }
      @keyframes msScan{ 0%{ top:-40%; opacity:0 } 35%{ opacity:.85 } 65%{ opacity:.85 } 100%{ top:100%; opacity:0 } }
      .ms-seat-empty:hover .ms-seat-av{ transform:translateY(-3px) scale(1.07); border-color:var(--c1); animation:none; }
      .ms-seat-empty:hover .ms-reel-img{ filter:blur(0) saturate(1) brightness(.95); }
      .ms-seat-empty:hover .ms-seat-lbl{ color:var(--c1); }
      .ms-seat-lbl-search{ animation:msLblPulse 1.4s ease-in-out infinite; }
      @keyframes msLblPulse{ 0%,100%{ opacity:.5 } 50%{ opacity:1 } }
      .ms-rule{ margin:18px auto 0; max-width:380px; text-align:left; padding:11px 16px; border-radius:14px; min-height:56px;
        background:rgba(255,255,255,.04); border:1px solid color-mix(in srgb, var(--c1) 24%, transparent); }
      .ms-rule-tag{ display:block; font-size:9px; font-weight:900; letter-spacing:2px; color:var(--c1); margin-bottom:4px; }
      .ms-rule-txt{ font-size:12.5px; line-height:1.45; color:rgba(255,255,255,.85); transition:opacity .18s ease; }
      .ms-stats{ display:flex; gap:12px; margin:14px auto 0; max-width:380px; }
      .ms-stat{ flex:1; display:flex; align-items:center; gap:10px; padding:11px 14px; border-radius:13px;
        background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.07); }
      .ms-stat-ic{ font-size:20px; flex:0 0 auto; }
      .ms-stat-tx{ text-align:left; min-width:0; }
      .ms-stat-lbl{ font-size:8.5px; font-weight:900; letter-spacing:1px; color:rgba(255,255,255,.45); text-transform:uppercase; }
      .ms-stat-val{ font-family:'Bangers',sans-serif; font-size:20px; letter-spacing:1px; color:#fff; line-height:1.1; }
      .ms-cancel{ margin-top:16px; width:100%; max-width:380px; padding:13px; border-radius:13px; cursor:pointer;
        font-family:'Outfit',sans-serif; font-size:13px; font-weight:900; letter-spacing:1px; color:#FCA5A5;
        background:rgba(232,50,74,.10); border:1px solid rgba(232,50,74,.4); transition:background .15s, border-color .15s, color .15s; }
      .ms-cancel:hover{ background:rgba(232,50,74,.22); border-color:#E8324A; color:#fff; }
      @media (max-width:520px){
        .ms-box{ padding:24px 14px 18px; }
        .ms-title{ font-size:34px; } .ms-emblem{ width:94px; height:94px; } .ms-emblem-core{ width:82px; height:82px; font-size:38px; }
        .ms-seats{ gap:9px; } .ms-seat-av{ width:52px; height:52px; font-size:20px; }
      }
    `;
    document.head.appendChild(s);
  }
  function _renderRankedSearch(players){
    const box = document.getElementById('rankedSearchBox');
    if(!box) return;
    const maxPl    = S.currentRoomMaxPl || 4;
    const seatsOpen = Math.max(0, maxPl - players.length);
    // When the room FILLS, don't yank the screen away — let the opponents'
    // avatars settle into their seats (lottery-style reveal) for a beat, THEN
    // tear down. Render once, hold ~1.6s, stop. Re-entry while revealing is a
    // no-op so the reveal animation is never interrupted.
    const filling = (seatsOpen === 0);
    if(filling && _msRevealed) return;        // reveal already on screen — don't rebuild it
    if(!filling) _msRevealed = false;         // back to searching → allow a future reveal
    if(filling){
      _msRevealed = true;
      if(_msRevealTimer) clearTimeout(_msRevealTimer);
      _msRevealTimer = setTimeout(()=>{
        // Hide just the search box (KEEP _msRevealed so it won't re-pop), then
        // restore the normal pre-start lobby (plist / host Start button).
        const b = document.getElementById('rankedSearchBox');
        if(b){ b.innerHTML = ''; b.style.display = 'none'; }
        if(_rankedSearchTimer){ clearInterval(_rankedSearchTimer); _rankedSearchTimer = null; }
        try{ renderWaiting(players); }catch(e){}
      }, 2800);   // hold past the server's bot-fill reveal window so the game
                  // screen takes over before this tears down (no lobby flash)
    }
    _ensureMatchScreenStyles();

    const u           = S.user || {};
    const isRanked    = S.currentRoomType === 'RANKED';
    const inPlace     = isRanked && (u.placementGamesPlayed || 0) < 5;
    const roomLabels  = {
      UNO:        { badge:'🎴', name:'Cardora MATCH' },
      CLASSIC:    { badge:'🎴', name:'Cardora MATCH' },
      CHILL:      { badge:'🌿', name:'CHILL MATCH' },
      PRIVATE:    { badge:'🔒', name:'PRIVATE MATCH' },
      RONDA:      { badge:'🃏', name:'RONDA MATCH' },
      DAMA:       { badge:'⛂',  name:'DAMA MATCH' },
      CHESS: { badge:'♞', name:'CHESS MATCH' },
      RANKED:     { badge: inPlace ? '🎯' : (u.rankedTier?.badge || '🥉'),
                    name:  inPlace ? `PLACEMENT ${u.placementGamesPlayed || 0}/5`
                                   : (u.rankedTier?.label || u.rankedTier?.name || 'Bronze') },
    };
    const rt          = roomLabels[S.currentRoomType] || { badge:'🎮', name:'MATCH' };
    const tierBadge   = rt.badge;
    const tierLabel   = rt.name;
    const metaLine    = isRanked
      ? (inPlace
          ? 'Earning your rank — first 5 ranked matches'
          : `${u.rankPoints || 0} RP · Peak ${u.peakRankPoints || u.rankPoints || 0}`)
      : `Looking for ${seatsOpen} more player${seatsOpen>1?'s':''}`;
    const detailLine  = isRanked
      ? `MMR window: <b>±200 RP</b> · Looking for ${seatsOpen} more player${seatsOpen>1?'s':''}`
      : `Open seats: <b>${seatsOpen} / ${maxPl}</b>`;

    // Per-game theme (emblem icon + accent colours) so the screen brands itself
    // to whatever the player picked — RONDA / UNO / Dama / Chess / Ranked.
    const THEME = {
      UNO:{c1:'#FBBF24',c2:'#E8324A'},        CLASSIC:{c1:'#FBBF24',c2:'#E8324A'},
      RONDA:{c1:'#A855F7',c2:'#E8324A'},       DAMA:{c1:'#2DD4BF',c2:'#0EA5E9'},
      CHESS:{c1:'#A78BFA',c2:'#6D28D9'},  CHILL:{c1:'#34D399',c2:'#22D3EE'},
      RANKED:{c1:'#FBBF24',c2:'#A855F7'},
    };
    const th     = THEME[S.currentRoomType] || { c1:'#FBBF24', c2:'#A855F7' };
    const gTitle = String(tierLabel).replace(/\s*MATCH$/i, '').trim() || 'MATCH';
    // Real game artwork for the emblem (RANKED is RONDA-based → Ronda art).
    const EMBLEM_IMG = {
      CLASSIC:'/classic-bg.jpeg', UNO:'/classic-bg.jpeg',
      RONDA:'/ronda-bg.jpeg',     RANKED:'/ronda-bg.jpeg',
      DAMA:'/dama-bg.jpeg',       CHESS:'/chess-bg.jpeg?v=2',
    };
    const emblemImg = EMBLEM_IMG[S.currentRoomType] || '';

    // ── Live seat slots — filled avatars (YOU crowned), empty seats spin a
    //    lottery reel of real avatars ("searching for players") and invite a
    //    friend straight into the match on tap. ──
    // Lottery reel: a shuffled, duplicated strip of real avatars scrolling
    // endlessly behind a dim vignette. Each seat gets a different start
    // avatar + speed so the seats never look synced.
    const REEL_AV = ['av-m01','av-f02','av-m07','av-f05','av-m12','av-f09','av-m04',
                     'av-f14','av-m18','av-f01','av-m09','av-f11','av-m15','av-f07'];
    const _msReelHTML = (seed) => {
      const start = (seed * 5) % REEL_AV.length;
      const pick = [];
      for(let k=0;k<8;k++) pick.push(REEL_AV[(start + k*3) % REEL_AV.length]);
      const strip = pick.concat(pick)
        .map(a => `<div class="ms-reel-img" style="background-image:url('/avatars/${a}.webp')"></div>`).join('');
      const dur   = (2.6 + seed * 0.45).toFixed(2);
      const delay = (-(seed * 0.8) - 0.3).toFixed(2);
      return `<div class="ms-reel" style="animation-duration:${dur}s;animation-delay:${delay}s">${strip}</div>`;
    };
    const seatSlots = [
      ...players.map(p => {
        const isMe = p.id === S.user?.id;
        const img  = (typeof _isImgAvatar === 'function') && _isImgAvatar(p.avatar);
        const face = img ? '' : esc((p.username || '?')[0]).toUpperCase();
        // A seat the reel just "landed" on — play the lottery-stop reveal once.
        const isNew = !isMe && !_msSeenIds.has(p.id);
        return `<div class="ms-seat ms-seat-on${isMe ? ' ms-seat-me' : ''}${isNew ? ' ms-seat-reveal' : ''}">
            ${isMe ? '<span class="ms-seat-crown">👑</span>' : ''}
            <div class="ms-seat-av"${img ? ` style="background-image:url('${esc(p.avatar)}')"` : ''}>${face}</div>
            <div class="ms-seat-lbl">${isMe ? 'YOU' : esc((p.username || 'Player').slice(0, 14))}</div>
          </div>`;
      }),
      ...Array(Math.max(0, seatsOpen)).fill(0).map((_, i) => `
          <div class="ms-seat ms-seat-empty" onclick="inviteToMatch()" title="Tap to invite a friend">
            <div class="ms-seat-av">${_msReelHTML(i)}</div>
            <div class="ms-seat-lbl ms-seat-lbl-search">Searching</div>
          </div>`),
    ].join('');
    // Remember who's seated so the reveal animation plays exactly once per player.
    _msSeenIds = new Set(players.map(p => p.id));

    // ── Rotating tips — keep the waiting player entertained + learning.
    //    Game-aware, cycles every ~4s with a soft fade. ──
    const TIP_SETS = {
      RONDA: [
        'Capture a card by playing the SAME rank — then chain higher ranks for a Darba.',
        'Clear the whole table with a capture to score a Missa.',
        'Holding a pair? Tap RONDA to claim it before you play those cards.',
        'A Darba can be stolen — the points go to whoever ENDS the chain.',
        'Your partner sits across the table — your scores add up as a team.',
      ],
      UNO:     ['Save Wild cards for when you’re stuck on colour.', 'Down to one card? Hit Cardora before the table catches you!', 'Reverse + Skip can bounce the turn back to your partner.'],
      CLASSIC: ['Save Wild cards for when you’re stuck on colour.', 'Down to one card? Hit Cardora before the table catches you!'],
      DAMA:    ['A capture is mandatory — if you can jump, you must.', 'Reach the far row to crown a King that moves both ways.', 'Set up double-jumps to clear two pieces in one turn.'],
    };
    const tips = [
      ...(TIP_SETS[S.currentRoomType] || []),
      'Win matches to climb the leaderboard and stack coins.',
      'Dress up your table & card back in the Shop.',
      'Tap any player to see their profile and add them as a friend.',
    ];

    box.style.display = 'block';
    box.innerHTML = `
      <div class="ms-box" style="--c1:${th.c1};--c2:${th.c2}">
        <div class="ms-glow"></div>
        <div class="ms-emblem"><div class="ms-emblem-core${emblemImg ? ' ms-emblem-img' : ''}"${emblemImg ? ` style="background-image:url('${emblemImg}')"` : ''}>${emblemImg ? '' : tierBadge}</div></div>
        <div class="ms-eyebrow"><span class="ms-dot"></span>${filling ? 'MATCH READY' : 'SEARCHING FOR PLAYERS'}</div>
        <div class="ms-title">${esc(gTitle)}</div>
        <div class="ms-sub">${filling ? 'Players found — get ready!' : (isRanked ? metaLine : 'Matching you with players…')}</div>
        <div class="ms-seats">${seatSlots}</div>
        <div class="ms-rule"><span class="ms-rule-tag">💡 GAME RULE</span><span class="ms-rule-txt" id="msRuleText">${esc(tips[0] || '')}</span></div>
        <div class="ms-stats">
          <div class="ms-stat"><span class="ms-stat-ic">⏱️</span><div class="ms-stat-tx"><div class="ms-stat-lbl">Searching</div><div class="ms-stat-val" id="msWait">${filling ? 'Ready' : '0:00'}</div></div></div>
          <div class="ms-stat"><span class="ms-stat-ic">👥</span><div class="ms-stat-tx"><div class="ms-stat-lbl">Players online</div><div class="ms-stat-val">${(S.onlineCount||0).toLocaleString()}</div></div></div>
        </div>
        ${filling ? '' : '<button class="ms-cancel" onclick="doLeaveRoom()">✕ Cancel Search</button>'}
      </div>`;

    // Reveal beat has no countdown/tip rotation — it just holds the opponents
    // on screen, then the scheduled teardown restores the lobby.
    if(filling){ if(_rankedSearchTimer){ clearInterval(_rankedSearchTimer); _rankedSearchTimer = null; } return; }

    // Tick — count UP the elapsed search time (counts to a different total each
    // match since the server fills at a random ~10–20s) + rotate tips every ~4s.
    const startedAt = S.currentRoomCreated || Date.now();
    if(_rankedSearchTimer) clearInterval(_rankedSearchTimer);
    const tick = ()=>{
      const ageMs = Date.now() - startedAt;
      const cd = document.getElementById('msWait');
      if(cd){
        const s = Math.max(0, Math.floor(ageMs/1000));   // count UP: 0:00, 0:01, 0:02…
        cd.textContent = `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
      }
      // Rotate the game-rule card (soft fade) so the wait never feels static.
      if(tips.length > 1){
        const idx = Math.floor(ageMs/4000) % tips.length;
        const tx = document.getElementById('msRuleText');
        if(tx && tx.dataset.idx !== String(idx)){
          tx.dataset.idx = String(idx);
          tx.style.opacity = '0';
          setTimeout(()=>{ const t = document.getElementById('msRuleText'); if(t){ t.textContent = tips[idx]; t.style.opacity = '1'; } }, 180);
        }
      }
    };
    tick();
    _rankedSearchTimer = setInterval(tick, 500);
  }
  // Public hook so leave-room flow can tear the overlay down cleanly.
  window._stopRankedSearch = _stopRankedSearch;

  function renderWaiting(players){
    const list=document.getElementById('plist'),btn=document.getElementById('bstart');
    const host=players.find(p=>p.id===S.user?.id)?.isHost,ok=players.length>=2;
    S.roomPlayerCount = players.length;   // feeds the read-only room-info card
    // Ranked-only matchmaking search overlay — mounts when this is a
    // RANKED room with empty seats. The overlay shows the radar pulse,
    // the player's tier badge, the MMR-widening readout, and a live
    // countdown to the bot-fill auto-start (30s server-side). Auto-hides
    // when the lobby fills up or the match starts.
    _renderRankedSearch(players);
    // The new matchmaking screen already shows the seats + a Cancel button, so
    // while it's up we hide the old duplicate "Players" list + Back button.
    // (They come back once the room is full and the search screen tears down —
    //  that's the final pre-start lobby with the host's Start button.)
    const searching = document.getElementById('rankedSearchBox')?.style.display === 'block';
    ['plistLabel', 'plist', 'roomBackBtn'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = searching ? 'none' : '';
    });
    // Players shown as avatar CIRCLES (seated = gold ring, open seats = dashed
    // "?"). Tapping a seated player opens their full profile. Empty seats fill
    // up to the room's max.
    const hasImgOf = a => a && /^(https?:|data:|\/)/.test(a);
    const maxPl = Math.max(S.currentRoomMaxPl || 0, players.length, 2);
    const seats = players.map(p => {
      const avStyle = hasImgOf(p.avatar) ? `background-image:url('${esc(p.avatar)}')` : '';
      const initial = hasImgOf(p.avatar) ? '' : esc((p.avatar || p.username || '?')[0]).toUpperCase();
      const canKick = host && !p.isHost && p.id !== S.user?.id;
      const click   = p.isBot ? '' : ` onclick="showOpponentProfile('${esc(p.id)}')" style="cursor:pointer" title="View ${esc(p.username)}'s profile"`;
      return `
        <div class="pseat pseat-on${p.isHost ? ' is-host' : ''}"${click}>
          <div class="pseat-ring">
            <div class="pseat-av" style="${avStyle}">${initial}</div>
            ${p.isHost ? '<span class="pseat-crown" title="Host">👑</span>' : ''}
            ${canKick ? `<button class="pseat-kick" title="Remove ${esc(p.username)}" aria-label="Remove ${esc(p.username)}" onclick="event.stopPropagation();doKickPlayer('${esc(p.id)}','${esc(p.username)}')">×</button>` : ''}
          </div>
          <div class="pseat-name">${esc(p.username)}${verifiedBadgeHTML(p.username,{isBot:p.isBot,size:'sm'})}</div>
        </div>`;
    }).join('');
    const empties = Array.from({ length: Math.max(0, maxPl - players.length) }).map(() => `
        <div class="pseat pseat-empty" title="Waiting for a player…">
          <div class="pseat-ring"><div class="pseat-av"><span>?</span></div></div>
          <div class="pseat-name">Open</div>
        </div>`).join('');
    list.innerHTML = seats + empties;
    // Refresh the bet card (visibility + input bounds + pot total).
    if(typeof renderBetCard === 'function') renderBetCard();
    // Don't override the button while the host is mid-start — let doStart manage it
    if(btn?.dataset.starting==='1') return;
    if(host && ok){
      // Host with enough players → show the Start button.
      btn.style.display=''; btn.disabled=false; btn.textContent=`🎮 ${t('startGame')}`;
    } else {
      // Not startable yet (host waiting for players, or a non-host) → hide the
      // start button entirely instead of a greyed-out "Need X more". The
      // PLAYERS list + room-info card already show how many more are needed.
      btn.style.display='none';
    }
  }

  // Room info card — shown in the waiting room. Read-only: the entry price is
  // fixed by the room, so the player just sees what it costs to play and how
  // many players are seated. No per-player bet adjusting.
  function renderBetCard(){
    const card = document.getElementById('betCard'); if(!card) return;
    const bets = S.roomBets || {};
    const min  = S.roomMinBet || 0;
    const myBet = bets[S.user?.id];
    // Show only once we're seated and the room economy is known.
    if(typeof myBet !== 'number'){ card.style.display = 'none'; return; }
    card.style.display = 'flex';
    // Entry price = the room's fixed buy-in (what each player pays to sit).
    const priceEl = document.getElementById('betCardPrice');
    if(priceEl){
      priceEl.innerHTML = min > 0
        ? `${min.toLocaleString()} <span class="bet-info-coin">🪙</span>`
        : `<span class="bet-info-free">FREE</span>`;
    }
    // How many players are in this room.
    const count = S.roomPlayerCount || Object.keys(bets).length || 1;
    const max   = S.currentRoomMaxPl || count;
    const plEl = document.getElementById('betCardPlayers');
    if(plEl) plEl.textContent = `${count}/${max}`;
  }
  function doStart(){
    const btn=document.getElementById('bstart');
    if(btn?.dataset.starting==='1') return;
    if(btn){btn.dataset.starting='1';btn.disabled=true;btn.textContent='Starting...';}
    // DAMA / RONDA use their own isolated start handlers so they don't
    // trip UNO's bet preflight / state-push path. The dama:state /
    // ronda:state broadcasts handle the screen transition via the
    // dedicated client modules.
    const isDama  = S.currentRoomType === 'DAMA';
    const isRonda = S.currentRoomType === 'RONDA';
    const event   = isDama  ? 'dama:start_match'
                  : isRonda ? 'ronda:start_match'
                  : 'game:start';
    S.socket.emit(event,{},(res)=>{
      if(!res.success){
        // If the match ALREADY started (e.g. bot-fill auto-started it a
        // beat before the host tapped), don't show a scary error — just
        // slide into the running game. The state broadcast normally does
        // this, but this is a belt-and-suspenders for the host.
        const already = /already started/i.test(res.reason || '');
        if(already){
          if(typeof _stopRankedSearch === 'function') _stopRankedSearch();
          if(isRonda && typeof Ronda !== 'undefined'){
            if(typeof showScreen === 'function') showScreen('game-screen');
            Ronda.enter();
            if(typeof showChatFab === 'function') showChatFab(true);
          } else if(isDama && typeof Dama !== 'undefined'){
            if(typeof showScreen === 'function') showScreen('game-screen');
            Dama.enter();
            if(typeof showChatFab === 'function') showChatFab(true);
          }
          return;
        }
        if(btn){btn.dataset.starting='';btn.disabled=false;btn.textContent=`🎮 ${t('startGame')}`;}
        toast(res.reason,'e');
        return;
      }
      // Host fast-path: flip the host's screen immediately. Non-hosts
      // get there on the next state event.
      if(typeof _stopRankedSearch === 'function') _stopRankedSearch();   // never leave a waiting overlay up
      if(isDama && typeof Dama !== 'undefined'){
        if(typeof showScreen === 'function') showScreen('game-screen');
        Dama.enter();
        if(typeof showChatFab === 'function') showChatFab(true);
      } else if(isRonda && typeof Ronda !== 'undefined'){
        if(typeof showScreen === 'function') showScreen('game-screen');
        Ronda.enter();
        if(typeof showChatFab === 'function') showChatFab(true);
      } else {
        // UNO / Cardora — this branch was MISSING, so the host had no fast-path
        // and relied solely on the broadcast game:state. RESCUE: if game:state
        // didn't already flip us in (we're still off the game screen), apply the
        // host state from the ack and transition — so the host is never stranded
        // on the lobby. If game:state already entered us, do nothing (don't
        // disrupt its deal cinematic).
        const onGame = document.getElementById('game-screen')?.classList.contains('active');
        if(!onGame){
          if(res.state && typeof applyFullState === 'function') applyFullState(res.state);
          if(typeof showScreen === 'function') showScreen('game-screen');
          if(typeof showChatFab === 'function') showChatFab(true);
        }
      }
    });
  }
  function doLeaveRoom(){_stopRankedSearch();S.currentRoomType=null;S.socket.emit('room:leave',{},()=>{S.roomId=null;goLobby();});}
  // ════════════════════════════════════════════════════════════
  //  DAILY REWARDS — professional 7-day login calendar.
  //  Coins/diamonds are earned ONLY by pressing CLAIM here, and the
  //  server allows one claim per calendar day. Leaving / re-entering
  //  the game grants nothing, so it can't be farmed.
  // ════════════════════════════════════════════════════════════
  let _dailyCD = null;     // countdown interval handle
  let _dailyBp = null;     // last-fetched battle-pass data (for the strip)

  function _fmtDur(ms){
    ms = Math.max(0, ms);
    const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000), s = Math.floor((ms%60000)/1000);
    if(h > 0) return `${h}h ${m}m`;
    if(m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function _ensureDailyStyles(){
    if(document.getElementById('dailyStyles')) return;
    const s = document.createElement('style'); s.id = 'dailyStyles';
    s.textContent = `
      .drw-ov{ position:fixed; inset:0; z-index:4000; display:flex; align-items:center; justify-content:center;
        background:rgba(3,7,18,.78); backdrop-filter:blur(7px); -webkit-backdrop-filter:blur(7px);
        opacity:0; transition:opacity .2s ease; padding:14px; }
      .drw-ov.show{ opacity:1; }
      .drw-panel{ position:relative; width:100%; max-width:470px; max-height:94vh; max-height:94dvh; overflow-y:auto;
        background:linear-gradient(165deg,#0E1626 0%,#0A0F1C 60%,#0B1220 100%);
        border:1px solid rgba(251,191,36,.28); border-radius:24px; padding:20px 18px 18px;
        box-shadow:0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.03) inset, 0 0 60px rgba(251,191,36,.07);
        -webkit-overflow-scrolling:touch; overscroll-behavior:contain; transform:scale(.96); transition:transform .22s cubic-bezier(.2,1.1,.3,1); }
      .drw-ov.show .drw-panel{ transform:scale(1); }
      .drw-load{ padding:60px 20px; text-align:center; color:#94A3B8; font-weight:700; }
      .drw-top{ display:flex; align-items:center; gap:10px; margin-bottom:18px; }
      .drw-back{ width:38px; height:38px; flex:0 0 auto; border-radius:50%; border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.05); color:#E2E8F0; font-size:19px; cursor:pointer; transition:background .15s; }
      .drw-back:hover{ background:rgba(255,255,255,.12); }
      .drw-title{ flex:1 1 auto; text-align:center; font-size:18px; font-weight:900; letter-spacing:2px;
        background:linear-gradient(180deg,#FFF4D6,#FBBF24 70%,#E8A317); -webkit-background-clip:text; background-clip:text;
        -webkit-text-fill-color:transparent; }
      .drw-next{ flex:0 0 auto; text-align:right; min-width:78px; }
      .drw-next-lbl{ font-size:8px; font-weight:800; letter-spacing:1px; color:#64748B; }
      .drw-next-val{ font-size:12px; font-weight:900; color:#FBBF24; white-space:nowrap; }
      .drw-ready{ color:#34D399; }
      .drw-cal{ display:grid; grid-template-columns:repeat(7,1fr); gap:5px; }
      .drw-cell{ position:relative; display:flex; flex-direction:column; align-items:center; gap:5px;
        padding:9px 2px 8px; border-radius:13px; min-height:96px; justify-content:flex-start;
        background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); transition:transform .15s; }
      .drw-day{ font-size:8px; font-weight:800; letter-spacing:.4px; color:#7C8AA0; }
      .drw-icwrap{ position:relative; height:30px; display:flex; align-items:center; justify-content:center; }
      .drw-icimg{ width:27px; height:27px; object-fit:contain; filter:drop-shadow(0 2px 4px rgba(0,0,0,.4)); }
      .drw-emoji{ font-size:26px; line-height:1; }
      .drw-amt{ font-size:12px; font-weight:900; color:#FFE6A6; }
      .drw-sub{ font-size:9px; font-weight:800; color:#93C5FD; margin-top:-2px; }
      .drw-check{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
        font-size:15px; font-weight:900; color:#0A0F1C; background:radial-gradient(circle,#34D399 60%,transparent 62%);
        border-radius:50%; }
      .drw-cell.s-claimed{ opacity:.55; border-color:rgba(52,211,153,.3); }
      .drw-cell.s-claimed .drw-icimg, .drw-cell.s-claimed .drw-emoji{ opacity:.25; }
      .drw-cell.s-locked{ opacity:.78; }
      .drw-cell.s-ready{ border:2px solid #FBBF24; background:linear-gradient(180deg,rgba(251,191,36,.18),rgba(251,191,36,.04));
        box-shadow:0 0 0 3px rgba(251,191,36,.12), 0 8px 22px rgba(251,191,36,.18); animation:drwPulse 1.8s ease-in-out infinite; }
      .drw-cell-chest{ background:linear-gradient(180deg,rgba(251,191,36,.16),rgba(217,119,6,.06)); border-color:rgba(251,191,36,.4); }
      .drw-cell-chest .drw-day{ color:#FBBF24; }
      .drw-cell-chest.s-claimed{ opacity:.55; }
      @keyframes drwPulse{ 0%,100%{ box-shadow:0 0 0 3px rgba(251,191,36,.1), 0 6px 18px rgba(251,191,36,.14); }
        50%{ box-shadow:0 0 0 5px rgba(251,191,36,.22), 0 10px 26px rgba(251,191,36,.28); } }
      .drw-pass{ margin:16px 0 4px; padding:13px 14px; border-radius:15px; cursor:pointer;
        background:rgba(255,255,255,.03); border:1px solid rgba(251,191,36,.22); transition:border-color .15s, background .15s; }
      .drw-pass:hover{ border-color:rgba(251,191,36,.45); background:rgba(255,255,255,.05); }
      .drw-pass-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
      .drw-pass-ttl{ font-size:12px; font-weight:900; letter-spacing:1px; color:#FBBF24; }
      .drw-pass-cta{ font-size:11px; font-weight:800; color:#94A3B8; }
      .drw-pass-bar-row{ display:flex; align-items:center; gap:9px; }
      .drw-pass-lvl{ width:28px; height:28px; flex:0 0 auto; border-radius:50%; display:flex; align-items:center; justify-content:center;
        font-size:12px; font-weight:900; color:#0A0F1C; background:linear-gradient(180deg,#FDE68A,#FBBF24); border:1px solid rgba(255,255,255,.3); }
      .drw-pass-lvl.next{ background:rgba(255,255,255,.06); color:#94A3B8; }
      .drw-pass-bar{ position:relative; flex:1 1 auto; height:18px; border-radius:10px; background:rgba(0,0,0,.4);
        overflow:hidden; border:1px solid rgba(255,255,255,.08); }
      .drw-pass-fill{ position:absolute; inset:0 auto 0 0; border-radius:10px; background:linear-gradient(90deg,#FBBF24,#F59E0B); }
      .drw-pass-xp{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
        font-size:10px; font-weight:800; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.7); }
      .drw-foot{ margin-top:16px; }
      .drw-claim{ width:100%; padding:15px; border:none; border-radius:15px; cursor:pointer;
        font-size:15px; font-weight:900; letter-spacing:1.5px; color:#3A2606;
        background:linear-gradient(180deg,#FDE68A 0%,#FBBF24 50%,#E8A317 100%);
        box-shadow:0 10px 26px rgba(251,191,36,.32), 0 1px 0 rgba(255,255,255,.4) inset; transition:transform .12s, filter .12s; }
      .drw-claim:hover{ transform:translateY(-1px); filter:brightness(1.05); }
      .drw-claim:active{ transform:translateY(0); }
      .drw-claim.is-done{ background:rgba(255,255,255,.06); color:#94A3B8; box-shadow:none; cursor:default; letter-spacing:.5px; }
      .drw-claim.is-done b{ color:#FBBF24; }
      .drw-burst{ position:absolute; inset:0; pointer-events:none; overflow:hidden; border-radius:24px; }
      .drw-burst span{ position:absolute; top:42%; animation:drwFall 1.2s ease-in forwards; }
      @keyframes drwFall{ 0%{ transform:translateY(0) scale(.6); opacity:0; } 20%{ opacity:1; }
        100%{ transform:translateY(220px) scale(1.1) rotate(40deg); opacity:0; } }
    `;
    document.head.appendChild(s);
  }

  function _dailyCell(r){
    const isChest = r.kind === 'chest', isPack = r.kind === 'pack';
    const icon = isChest ? '<span class="drw-emoji">🎁</span>'
               : isPack  ? '<img src="/diamond.svg" class="drw-icimg" alt="">'
                         : '<img src="/coin.svg" class="drw-icimg" alt="">';
    const amt = isPack ? `${r.diamonds}` : `${(r.coins || 0).toLocaleString()}`;
    const sub = isChest ? `+${r.diamonds}💎` : '';
    const check = r.state === 'claimed' ? '<div class="drw-check">✓</div>' : '';
    return `<div class="drw-cell s-${r.state}${isChest ? ' drw-cell-chest' : ''}">
        <div class="drw-day">DAY ${r.day}</div>
        <div class="drw-icwrap">${icon}${check}</div>
        <div class="drw-amt">${amt}</div>
        ${sub ? `<div class="drw-sub">${sub}</div>` : ''}
      </div>`;
  }

  function _renderDaily(data, bp){
    const ov = document.getElementById('dailyModal'); if(!ov) return;
    const panel = ov.querySelector('.drw-panel'); if(!panel) return;
    if(bp !== undefined) _dailyBp = bp;        // keep last BP data across re-renders
    const cells = data.days.map(_dailyCell).join('');
    const ready = data.canClaim;
    const left  = data.nextClaimAt - Date.now();

    let passHTML = '';
    if(_dailyBp && typeof _dailyBp.level === 'number' && _dailyBp.xpPerTier){
      const maxT  = _dailyBp.tiers?.length || 30, lvl = _dailyBp.level;
      const inLvl = lvl >= maxT ? _dailyBp.xpPerTier : ((_dailyBp.xp || 0) % _dailyBp.xpPerTier);
      const pct   = lvl >= maxT ? 100 : Math.round(inLvl / _dailyBp.xpPerTier * 100);
      passHTML = `<div class="drw-pass" onclick="closeDailyRewards();showBattlePass()">
          <div class="drw-pass-head"><span class="drw-pass-ttl">🎟️ SEASON PASS</span><span class="drw-pass-cta">VIEW REWARDS ›</span></div>
          <div class="drw-pass-bar-row">
            <span class="drw-pass-lvl">${lvl}</span>
            <div class="drw-pass-bar"><div class="drw-pass-fill" style="width:${pct}%"></div>
              <span class="drw-pass-xp">${inLvl.toLocaleString()} / ${_dailyBp.xpPerTier.toLocaleString()}</span></div>
            <span class="drw-pass-lvl next">${Math.min(lvl + 1, maxT)}</span>
          </div>
        </div>`;
    }

    const btn = ready
      ? `<button class="drw-claim" onclick="claimDailyReward()">CLAIM DAY ${data.currentDay}</button>`
      : `<button class="drw-claim is-done" disabled>NEXT REWARD IN <b id="drwCd">${_fmtDur(left)}</b></button>`;

    panel.innerHTML = `
      <div class="drw-top">
        <button class="drw-back" onclick="closeDailyRewards()">←</button>
        <div class="drw-title">DAILY REWARDS</div>
        <div class="drw-next">
          <div class="drw-next-lbl">NEXT REWARD</div>
          <div class="drw-next-val">${ready ? '<span class="drw-ready">CLAIM NOW</span>' : '⏱ <span id="drwCd2">' + _fmtDur(left) + '</span>'}</div>
        </div>
      </div>
      <div class="drw-cal">${cells}</div>
      ${passHTML}
      <div class="drw-foot">${btn}</div>`;

    if(_dailyCD){ clearInterval(_dailyCD); _dailyCD = null; }
    if(!ready){
      _dailyCD = setInterval(() => {
        const ms = data.nextClaimAt - Date.now();
        if(ms <= 0){ clearInterval(_dailyCD); _dailyCD = null; openDailyRewards(); return; }
        const a = document.getElementById('drwCd'), b = document.getElementById('drwCd2');
        if(a) a.textContent = _fmtDur(ms);
        if(b) b.textContent = _fmtDur(ms);
      }, 1000);
    }
  }

  function _dailyBurst(){
    const panel = document.querySelector('#dailyModal .drw-panel'); if(!panel) return;
    const layer = document.createElement('div'); layer.className = 'drw-burst';
    for(let i = 0; i < 14; i++){
      const s = document.createElement('span');
      s.textContent = Math.random() < .5 ? '🪙' : '✨';
      s.style.left = (8 + Math.random() * 84) + '%';
      s.style.animationDelay = (Math.random() * .25) + 's';
      s.style.fontSize = (14 + Math.random() * 14) + 'px';
      layer.appendChild(s);
    }
    panel.appendChild(layer);
    setTimeout(() => layer.remove(), 1400);
  }

  async function openDailyRewards(){
    _ensureDailyStyles();
    const old = document.getElementById('dailyModal'); if(old) old.remove();
    const ov = document.createElement('div'); ov.id = 'dailyModal'; ov.className = 'drw-ov';
    ov.innerHTML = `<div class="drw-panel"><div class="drw-load">Loading…</div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    ov.addEventListener('mousedown', e => { if(e.target === ov) closeDailyRewards(); });
    let data;
    try{ data = await apiFetch('/api/rewards/daily'); }
    catch(e){
      const p = ov.querySelector('.drw-panel');
      if(p) p.innerHTML = `<div class="drw-load" style="color:#f87171">Couldn't load Daily Rewards.<br><span style="opacity:.7;font-size:12px">Make sure the server was restarted, then try again.</span></div>`;
      return;
    }
    let bp = null;
    try{ bp = await apiFetch('/api/battlepass'); }catch(e){}
    _renderDaily(data, bp);
  }

  function closeDailyRewards(){
    if(_dailyCD){ clearInterval(_dailyCD); _dailyCD = null; }
    const ov = document.getElementById('dailyModal'); if(!ov) return;
    ov.classList.remove('show'); setTimeout(() => ov.remove(), 200);
  }

  async function claimDailyReward(){
    const btn = document.querySelector('#dailyModal .drw-claim');
    if(btn){ btn.disabled = true; btn.textContent = 'CLAIMING…'; }
    try{
      const r = await apiFetch('/api/rewards/daily/claim', { method:'POST' });
      if(S.user){
        S.user.coins = r.coins; S.user.diamonds = r.diamonds;
        try{ localStorage.setItem('uno_user', JSON.stringify(S.user)); }catch(e){}
      }
      if(typeof _animateCount === 'function'){
        _animateCount('hcoins', r.coins); _animateCount('scoins', r.coins);
        _animateCount('heroCoins', r.coins); _animateCount('hdiamonds', r.diamonds);
      }
      const parts = [];
      if(r.earned.coins)    parts.push(`+${r.earned.coins.toLocaleString()} 🪙`);
      if(r.earned.diamonds) parts.push(`+${r.earned.diamonds} 💎`);
      toast(`🎁 Day ${r.day} claimed!  ${parts.join('   ')}`, 's');
      _dailyBurst();
      _renderDaily(r);     // re-render in the claimed state (keeps cached BP strip)
    }catch(e){
      toast(e?.message || 'Already claimed today', 'w');
      // Re-fetch to restore correct button state.
      try{ const d = await apiFetch('/api/rewards/daily'); _renderDaily(d); }catch(_){}
    }
  }

  // Old entry point (lobby "Claim Daily" button + coins modal) now opens the
  // full Daily Rewards calendar instead of silently granting coins.
  function doDaily(){ openDailyRewards(); }

  window.openDailyRewards  = openDailyRewards;
  window.closeDailyRewards = closeDailyRewards;
  window.claimDailyReward  = claimDailyReward;
  window.doDaily           = doDaily;
  async function showCoinsModal(){
    const modal = document.getElementById('coinsModal');
    const u = S.user || {};
    document.getElementById('coinsHeroVal').textContent = (u.coins||0).toLocaleString();
    document.getElementById('coinsELO').textContent = u.elo ?? '—';
    document.getElementById('coinsGames').textContent = u.stats?.gamesPlayed ?? 0;
    document.getElementById('coinsWins').textContent = u.stats?.gamesWon ?? 0;
    const elo = u.elo || 1000;
    const league = elo >= 2000 ? '💎 Diamond' : elo >= 1500 ? '🥇 Gold' : elo >= 1000 ? '🥈 Silver' : '🥉 Bronze';
    document.getElementById('coinsLeague').textContent = league;
    modal.classList.add('show');
    try{
      const d=await api('GET','/auth/me');
      if(d.user){
        S.user=d.user;localStorage.setItem('uno_user',JSON.stringify(d.user));
        document.getElementById('coinsHeroVal').textContent = (d.user.coins||0).toLocaleString();
        document.getElementById('coinsELO').textContent = d.user.elo ?? '—';
        document.getElementById('coinsGames').textContent = d.user.stats?.gamesPlayed ?? 0;
        document.getElementById('coinsWins').textContent = d.user.stats?.gamesWon ?? 0;
        const e2 = d.user.elo || 1000;
        document.getElementById('coinsLeague').textContent = e2 >= 2000 ? '💎 Diamond' : e2 >= 1500 ? '🥇 Gold' : e2 >= 1000 ? '🥈 Silver' : '🥉 Bronze';
        document.getElementById('hcoins').textContent = d.user.coins||0;
        document.getElementById('scoins').textContent = d.user.coins||0;
      }
    }catch(e){}
  }
  // Preset character avatars — players pick one; custom image uploads are off.
  // Framed portrait avatars (bundled under /avatars). Moroccan set first
  // (matches the game theme), then the fantasy champions set.
  const AVATARS=[
    {src:'/avatars/av-m01.webp',n:'Atlas Warrior'},{src:'/avatars/av-m02.webp',n:'Crimson Veil'},
    {src:'/avatars/av-m03.webp',n:'Old Sultan'},  {src:'/avatars/av-m04.webp',n:'Night Rogue'},
    {src:'/avatars/av-m05.webp',n:'Wildheart'},   {src:'/avatars/av-m06.webp',n:'Iron Guard'},
    {src:'/avatars/av-m07.webp',n:'Azure Veil'},  {src:'/avatars/av-m08.webp',n:'Emerald Sheikh'},
    {src:'/avatars/av-m09.webp',n:'Desert Scout'},{src:'/avatars/av-m10.webp',n:'White Sage'},
    {src:'/avatars/av-m11.webp',n:'Free Spirit'}, {src:'/avatars/av-m12.webp',n:'Amethyst Prince'},
    {src:'/avatars/av-m13.webp',n:'Marked One'},  {src:'/avatars/av-m14.webp',n:'Veiled Sorceress'},
    {src:'/avatars/av-m15.webp',n:'Corsair'},     {src:'/avatars/av-m16.webp',n:'Golden Mask'},
    {src:'/avatars/av-m17.webp',n:'War Queen'},   {src:'/avatars/av-m18.webp',n:'Sea Captain'},
    {src:'/avatars/av-m19.webp',n:'Shadow Blade'},{src:'/avatars/av-m20.webp',n:'Jeweled Lady'},
    {src:'/avatars/av-f01.webp',n:'Storm Knight'},{src:'/avatars/av-f02.webp',n:'Shadow King'},
    {src:'/avatars/av-f03.webp',n:'Frost Maiden'},{src:'/avatars/av-f04.webp',n:'Ember Dragon'},
    {src:'/avatars/av-f05.webp',n:'High King'},   {src:'/avatars/av-f06.webp',n:'Red Samurai'},
    {src:'/avatars/av-f07.webp',n:'Cyber Knight'},{src:'/avatars/av-f08.webp',n:'Golden Elf'},
    {src:'/avatars/av-f09.webp',n:'Blood Lord'},  {src:'/avatars/av-f10.webp',n:'Panda Monk'},
    {src:'/avatars/av-f11.webp',n:'Lava Golem'},  {src:'/avatars/av-f12.webp',n:'Dark Sorceress'},
    {src:'/avatars/av-f13.webp',n:'Gold Paladin'},{src:'/avatars/av-f14.webp',n:'Forest Ranger'},
    {src:'/avatars/av-f15.webp',n:'Night Demon'}, {src:'/avatars/av-f16.webp',n:'Sea Pirate'},
  ];
  function _avatarName(src){ const a=AVATARS.find(x=>x.src===src); return a?a.n:''; }
  function _isImgAvatar(a){ return typeof a==='string' && /^(data:|https?:|\/)/i.test(a); }
  function _renderAvatarInto(el, user){
    if(!el || !user) return;
    el.classList.remove('has-img');
    el.style.backgroundImage = '';
    if(_isImgAvatar(user.avatar)){
      el.classList.add('has-img');
      el.style.backgroundImage = `url('${user.avatar}')`;
      el.textContent = '';
    } else if(user.avatar){
      el.textContent = user.avatar; // preset emoji avatar
    } else {
      el.textContent = (user.username||'?').charAt(0).toUpperCase();
    }
  }
  // Apply an avatar instantly (optimistic) and persist in the background.
  async function _applyAvatar(av){
    const prev = S.user?.avatar;
    if(S.user){ S.user.avatar = av; localStorage.setItem('uno_user', JSON.stringify(S.user)); }
    _renderAvatarInto(document.getElementById('profileAvatar'), S.user);
    _renderAvatarInto(document.getElementById('heroAvatar'), S.user);
    try{
      await api('POST','/profile/avatar',{ avatar: av });
      toast('✅ '+t('avatarUpdated'),'s');
    }catch(e){
      // Roll back if the server rejected it
      if(S.user){ S.user.avatar = prev; localStorage.setItem('uno_user', JSON.stringify(S.user)); }
      _renderAvatarInto(document.getElementById('profileAvatar'), S.user);
      _renderAvatarInto(document.getElementById('heroAvatar'), S.user);
      toast(e.message||'Could not save avatar','e');
    }
  }
  // ── Avatar COLLECTION (replaces the old free-for-all picker) ──
  // Shows only the avatars you OWN, with All / ★ Favorites / 🕒 Recent tabs,
  // a rarity filter, a favourite toggle, an owned counter, and a jump to the
  // Shop for the ones you don't have yet. Buying happens in the Shop tab.
  const _colState = { tab:'all', rarity:'all' };
  function _recentAvatars(){
    try{ return JSON.parse(localStorage.getItem('av_recent')||'[]'); }catch(e){ return []; }
  }
  function _pushRecent(src){
    try{
      let r = _recentAvatars().filter(s => s !== src);
      r.unshift(src); r = r.slice(0,12);
      localStorage.setItem('av_recent', JSON.stringify(r));
    }catch(e){}
  }
  // Avatar management lives in the unified Vault now (Collection module in
  // 35-cosmetics.js). The profile "Change Avatar" button routes here; the
  // legacy in-place avatar grid below stays as a graceful fallback.
  function showAvatarPicker(){
    if(window.Collection && window.Collection.open){ window.Collection.open('avatars'); return; }
    _legacyAvatarPicker();
  }
  function _legacyAvatarPicker(){
    const old=document.getElementById('avatarPicker'); if(old) old.remove();
    _ensureAvatarStyles();
    const ov=document.createElement('div');
    ov.id='avatarPicker';
    ov.innerHTML=`<div class="av-panel avc-panel"><div class="av-title">MY COLLECTION</div><div class="avc-loading">Loading…</div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) ov.remove(); });
    const C=window.Cosmetics;
    Promise.resolve((C && (!C.avatars || !C.avatars.length)) ? C.load() : null).then(()=>_renderCollection());
  }
  function _renderCollection(){
    const ov=document.getElementById('avatarPicker'); if(!ov) return;
    const C=window.Cosmetics;
    const all=(C&&C.avatars)||[];
    const owned=all.filter(a=>a.owned);
    const cur=S.user?.avatar;
    const total=all.length;
    let list=owned;
    if(_colState.tab==='favorites') list=owned.filter(a=>a.favorite);
    else if(_colState.tab==='recent') list=_recentAvatars().map(src=>owned.find(a=>a.src===src)).filter(Boolean);
    if(_colState.rarity!=='all') list=list.filter(a=>(a.rarity||'common')===_colState.rarity);
    const curItem=all.find(a=>a.src===cur);
    const stageStyle=(cur&&_isImgAvatar(cur))?`background-image:url('${cur}');background-size:cover;background-position:center;`:'';
    const rarities=['all','common','rare','epic','legendary'];
    const tabBtn=(id,label)=>`<button class="avc-tab ${_colState.tab===id?'on':''}" data-tab="${id}">${label}</button>`;
    const rarBtn=(r)=>`<button class="avc-rar ${_colState.rarity===r?'on':''}" data-rar="${r}">${r==='all'?'All':r.charAt(0).toUpperCase()+r.slice(1)}</button>`;
    const tiles=list.length
      ? list.map((a,i)=>`
          <button class="av-tile av-tile-img ${a.src===cur?'on':''}" data-av="${a.src}" data-name="${esc(a.name)}" style="animation-delay:${i*12}ms">
            <span class="avc-fav ${a.favorite?'on':''}" data-fav="${a.id}">${a.favorite?'★':'☆'}</span>
            <span class="av-face" style="background-image:url('${a.src}')"></span>
            <span class="av-name">${esc(a.name)}</span>
          </button>`).join('')
      : `<div class="avc-empty">${_colState.tab==='favorites'?'No favorites yet — tap ☆ on any avatar.':_colState.tab==='recent'?'No recently used avatars yet.':'Nothing here — buy avatars in the Shop.'}</div>`;
    ov.innerHTML=`
      <div class="av-panel avc-panel">
        <div class="av-title">MY COLLECTION</div>
        <div class="avc-count">Owned <b>${owned.length}</b> / ${total}</div>
        <div class="av-stage">
          <div class="av-stage-face ${cur&&_isImgAvatar(cur)?'has-img':''}" style="${stageStyle}">${cur&&!_isImgAvatar(cur)?cur:(cur?'':'🎮')}</div>
        </div>
        <div class="av-stage-name">${esc(curItem?curItem.name:'')}</div>
        <div class="avc-tabs">${tabBtn('all','All')}${tabBtn('favorites','★ Favorites')}${tabBtn('recent','🕒 Recent')}</div>
        <div class="avc-rars">${rarities.map(rarBtn).join('')}</div>
        <div class="av-grid">${tiles}</div>
        <div class="avc-actions">
          <button class="avc-shop" id="avcShop">＋ Get more in Shop</button>
          <button class="av-done" id="avPickClose">${esc(t('close'))}</button>
        </div>
      </div>`;
    ov.querySelectorAll('.avc-tab').forEach(b=>b.addEventListener('click',()=>{ _colState.tab=b.dataset.tab; _renderCollection(); }));
    ov.querySelectorAll('.avc-rar').forEach(b=>b.addEventListener('click',()=>{ _colState.rarity=b.dataset.rar; _renderCollection(); }));
    ov.querySelectorAll('.avc-fav').forEach(b=>b.addEventListener('click',async e=>{
      e.stopPropagation();
      await window.Cosmetics?.toggleFavorite(b.dataset.fav);
      _renderCollection();
    }));
    ov.querySelectorAll('.av-tile').forEach(b=>{
      b.addEventListener('click',()=>{
        const av=b.dataset.av;
        _pushRecent(av);
        Promise.resolve(_applyAvatar(av)).then(()=>{
          (window.Cosmetics&&window.Cosmetics.avatars||[]).forEach(a=>{ a.equipped=(a.src===av); });
          _renderCollection();
        });
      });
    });
    const shopBtn=ov.querySelector('#avcShop');
    if(shopBtn) shopBtn.addEventListener('click',()=>{ ov.remove(); if(window.Shop&&Shop.open) Shop.open('avatars'); });
    const closeBtn=ov.querySelector('#avPickClose');
    if(closeBtn) closeBtn.addEventListener('click',()=>ov.remove());
  }
  function _ensureAvatarStyles(){
    if(document.getElementById('av-styles')) return;
    const s=document.createElement('style'); s.id='av-styles';
    s.textContent=`
      @keyframes avTileIn{from{opacity:0;transform:translateY(16px) rotateX(40deg)}to{opacity:1;transform:translateY(0) rotateX(0)}}
      @keyframes avFloat{0%,100%{transform:translateZ(26px) translateY(0)}50%{transform:translateZ(26px) translateY(-5px)}}
      @keyframes avRingSpin{to{transform:rotate(360deg)}}
      @keyframes avFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes avPanelIn{from{transform:translateY(40px) scale(.94);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
      #avatarPicker{
        position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;padding:20px;
        background:radial-gradient(ellipse at 50% 40%,rgba(40,20,8,.5),rgba(4,6,14,.92));
        backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);animation:avFadeIn .25s ease;
      }
      .av-panel{
        width:min(460px,95vw);max-height:92vh;display:flex;flex-direction:column;align-items:center;
        overflow:hidden;
        background:linear-gradient(180deg,rgba(30,34,60,.97),rgba(16,20,36,.99));
        border:1px solid rgba(255,255,255,.09);border-radius:24px;padding:22px;
        box-shadow:0 40px 100px rgba(0,0,0,.75);animation:avPanelIn .45s cubic-bezier(.2,.9,.3,1.2);
      }
      /* Short landscape phones — shrink the header so the avatar grid still
         gets real estate (fixes the "can't see my avatars" cramping). */
      @media (max-height:560px){
        .av-panel{ padding:14px 16px; max-height:96vh; }
        .av-title{ font-size:19px; }
        .av-sub{ display:none; }
        .av-stage{ width:64px;height:64px;margin:4px 0 2px; }
        .av-stage-face{ width:64px;height:64px;font-size:30px;border-width:2px; }
        .av-stage-name{ font-size:15px;min-height:16px;margin-bottom:6px; }
        .av-grid{ grid-template-columns:repeat(6,1fr); }
        .av-done{ margin-top:10px;padding:10px; }
      }
      .av-title{font-family:'Bangers',cursive;font-size:27px;letter-spacing:2px;color:#fff;text-align:center}
      .av-sub{font-size:11px;color:rgba(255,255,255,.5);text-align:center;margin-top:3px;font-weight:600}
      .av-stage{position:relative;width:104px;height:104px;margin:12px 0 4px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
      .av-stage-name{font-family:'Bangers',cursive;font-size:21px;letter-spacing:1.5px;color:#F59E0B;min-height:24px;margin-bottom:10px;text-shadow:0 2px 10px rgba(245,158,11,.4);flex:0 0 auto}
      /* Rainbow halo removed — clean neutral ring reads better, esp. on phones. */
      .av-stage-ring{ display:none; }
      .av-stage-face{
        position:relative;width:104px;height:104px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;font-size:52px;
        background:radial-gradient(circle at 38% 32%,#3a4170,#141826);
        background-size:cover;background-position:center;
        border:3px solid rgba(255,255,255,.14);
        box-shadow:inset 0 4px 14px rgba(0,0,0,.55),0 8px 20px rgba(0,0,0,.5);
        overflow:hidden;
      }
      .av-stage-face.has-img{ border-color:rgba(255,255,255,.22); }
      /* Scrollable grid: flex:1 + min-height:0 lets it take the leftover panel
         height and scroll INSIDE instead of overflowing under the Close button
         (the bug where only the top sliver of avatars showed on mobile). */
      .av-grid{
        display:grid;grid-template-columns:repeat(4,1fr);gap:10px;
        width:100%;flex:1 1 auto;min-height:0;overflow-y:auto;padding:6px;perspective:900px;
      }
      .av-grid::-webkit-scrollbar{width:5px}
      .av-grid::-webkit-scrollbar-thumb{background:rgba(245,158,11,.35);border-radius:5px}
      .av-tile{
        border:none;border-radius:15px;cursor:pointer;padding:11px 4px 8px;
        background:linear-gradient(160deg,#2c3258,#171b2d);
        display:flex;flex-direction:column;align-items:center;gap:5px;
        transform-style:preserve-3d;
        transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;
        box-shadow:0 6px 14px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08);
        animation:avTileIn .4s cubic-bezier(.16,1,.3,1) backwards;
      }
      .av-tile .av-face{
        font-size:32px;display:block;transform:translateZ(16px);line-height:1;
        filter:drop-shadow(0 5px 5px rgba(0,0,0,.55));transition:transform .2s;
      }
      /* Image-avatar tiles — circular portrait thumbnail. */
      .av-tile-img .av-face{
        width:54px;height:54px;border-radius:50%;
        background-size:cover;background-position:center;
        border:2px solid rgba(255,255,255,.14);
        box-shadow:0 4px 10px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.18);
      }
      .av-tile-img.on .av-face{ border-color:#F59E0B; }
      .av-tile .av-name{
        font-size:8.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;
        color:rgba(255,255,255,.55);transition:color .2s;
      }
      .av-tile:hover{box-shadow:0 16px 32px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.12)}
      .av-tile:hover .av-face{transform:translateZ(30px) scale(1.14)}
      .av-tile:active{transform:scale(.94)!important}
      .av-tile.on{
        background:linear-gradient(160deg,#6a4715,#2a1c08);
        box-shadow:0 0 0 2px #F59E0B,0 12px 28px rgba(245,158,11,.45),inset 0 1px 0 rgba(255,255,255,.15);
      }
      .av-tile.on .av-face{animation:avFloat 2.2s ease-in-out infinite}
      .av-tile.on .av-name{color:#F59E0B}
      .av-done{
        margin-top:16px;width:100%;padding:13px;border-radius:13px;cursor:pointer;
        background:transparent;border:1.5px solid rgba(255,255,255,.12);
        color:rgba(255,255,255,.7);font-family:inherit;font-weight:800;font-size:13px;
        transition:all .2s;
      }
      .av-done:hover{border-color:var(--accent);color:#fff;background:rgba(245,158,11,.08)}

      /* ── Collection extras ── */
      .avc-loading{padding:48px;text-align:center;color:rgba(255,255,255,.5);font-weight:700}
      .avc-count{font-size:11px;color:rgba(255,255,255,.55);text-align:center;font-weight:800;margin-top:2px;letter-spacing:.4px}
      .avc-count b{color:#F59E0B;font-size:13px}
      .avc-tabs{display:flex;gap:6px;width:100%;margin:8px 0 8px;flex:0 0 auto}
      .avc-tab{flex:1;padding:8px 6px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.7);font-family:inherit;font-weight:800;font-size:11px;cursor:pointer;letter-spacing:.3px;transition:all .15s}
      .avc-tab.on{background:linear-gradient(135deg,#FBBF24,#D97706);color:#1a1a1a;border-color:transparent}
      .avc-rars{display:flex;gap:5px;flex-wrap:wrap;width:100%;margin-bottom:8px;justify-content:center;flex:0 0 auto}
      .avc-rar{padding:4px 11px;border-radius:99px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.6);font-family:inherit;font-weight:700;font-size:10px;cursor:pointer;transition:all .15s}
      .avc-rar.on{background:rgba(245,158,11,.18);color:#FBBF24;border-color:rgba(245,158,11,.4)}
      .avc-fav{position:absolute;top:5px;right:6px;font-size:14px;color:rgba(255,255,255,.45);z-index:5;line-height:1;cursor:pointer;text-shadow:0 1px 3px rgba(0,0,0,.7);transition:transform .15s,color .15s}
      .avc-fav:hover{transform:scale(1.25)}
      .avc-fav.on{color:#FBBF24}
      .avc-empty{grid-column:1/-1;text-align:center;color:rgba(255,255,255,.45);padding:26px 12px;font-size:12px;font-weight:600}
      .avc-actions{display:flex;gap:8px;width:100%;margin-top:12px;flex:0 0 auto}
      .avc-actions .av-done{margin-top:0;flex:1}
      .avc-shop{flex:1;padding:13px;border-radius:13px;cursor:pointer;border:1.5px solid rgba(245,158,11,.4);background:rgba(245,158,11,.12);color:#FBBF24;font-family:inherit;font-weight:800;font-size:12px;transition:all .2s}
      .avc-shop:hover{background:rgba(245,158,11,.2);transform:translateY(-1px)}
      @media (max-height:560px){
        .avc-rars{display:none}
        .avc-tabs{margin:4px 0 6px}
      }
    `;
    document.head.appendChild(s);
  }
  function copyProfileId(){
    // Prefer the short 9-digit friend ID (what players share to add each
    // other); fall back to the full UUID for legacy users.
    const id = S.user?.shortId || S.user?.id || '';
    if(!id) return;
    navigator.clipboard?.writeText(id);
    toast('🆔 ID copied — share it!','s');
  }
  async function uploadAvatar(ev){
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if(!file) return;
    if(file.size > 3 * 1024 * 1024) return toast('Image too large (max 3MB)','e');
    if(!file.type.startsWith('image/')) return toast('Please pick an image','e');
    const reader = new FileReader();
    reader.onload = async () => {
      // Downscale to ~256px so we don't blow up storage
      const dataUrl = await _downscaleImage(reader.result, 256);
      try{
        const res = await api('POST','/profile/avatar',{ avatar: dataUrl });
        if(S.user){ S.user.avatar = res.avatar; localStorage.setItem('uno_user', JSON.stringify(S.user)); }
        _renderAvatarInto(document.getElementById('profileAvatar'), S.user);
        toast('Avatar updated! 📸','s');
      } catch(e){ toast(e.message || 'Upload failed','e'); }
    };
    reader.readAsDataURL(file);
  }
  function _downscaleImage(dataUrl, maxSize){
    return new Promise((resolve)=>{
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio), h = Math.round(img.height * ratio);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }
  function _animateCount(id, target){
    const el=document.getElementById(id); if(!el) return;
    const dur=900, start=performance.now();
    const fmt=v=>Math.round(v).toLocaleString();
    function tick(t){
      const p=Math.min(1,(t-start)/dur);
      const eased=1-Math.pow(1-p,3);
      el.textContent=fmt(target*eased);
      if(p<1) requestAnimationFrame(tick);
      else el.textContent=fmt(target);
    }
    requestAnimationFrame(tick);
  }
  // Multi-layer SVG tier emblem — 8-point starburst ring + shield-like
  // inner medal + bevel. Color palette swaps per tier. Greyscale + dim
  // when `locked` is true (used for the Dama "Unranked" placeholder).
  function _profileTierSVG(tier, locked){
    const PAL = {
      Silver:   { dark:'#52525B', mid:'#A1A1AA', light:'#F4F4F5', accent:'#FBBF24' },
      Gold:     { dark:'#92760E', mid:'#F59E0B', light:'#FEF3C7', accent:'#FFFBEB' },
      Platinum: { dark:'#0E7490', mid:'#22D3EE', light:'#CFFAFE', accent:'#FBBF24' },
      Diamond:  { dark:'#1E40AF', mid:'#60A5FA', light:'#DBEAFE', accent:'#FFFBEB' },
      Master:   { dark:'#7C2D12', mid:'#E8324A', light:'#FECDD3', accent:'#FBBF24' },
      Legend:   { dark:'#581C87', mid:'#A855F7', light:'#E9D5FF', accent:'#FBBF24' },
      Unranked: { dark:'#27272A', mid:'#52525B', light:'#71717A', accent:'#A1A1AA' },
    };
    const p = PAL[tier] || { dark:'#92400E', mid:'#FB7E1A', light:'#FED7AA', accent:'#FBBF24' }; // Bronze fallback
    const letter = (tier || '?')[0].toUpperCase();
    const opacity = locked ? '.55' : '1';
    const sat = locked ? 'filter:saturate(.3) brightness(.75);' : '';
    return `
      <svg viewBox="0 0 100 100" style="${sat}opacity:${opacity}">
        <defs>
          <radialGradient id="emb-shine-${letter}" cx="35%" cy="28%" r="80%">
            <stop offset="0%"  stop-color="${p.light}"/>
            <stop offset="55%" stop-color="${p.mid}"/>
            <stop offset="100%" stop-color="${p.dark}"/>
          </radialGradient>
          <linearGradient id="emb-rim-${letter}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="${p.mid}"/>
            <stop offset="100%" stop-color="${p.dark}"/>
          </linearGradient>
        </defs>
        <!-- 8-point ornate starburst ring -->
        <polygon points="50,4 58,30 84,16 70,42 96,50 70,58 84,84 58,70 50,96 42,70 16,84 30,58 4,50 30,42 16,16 42,30"
                 fill="url(#emb-rim-${letter})" stroke="${p.dark}" stroke-width="1.5"
                 stroke-linejoin="round"/>
        <!-- Inner medal disc -->
        <circle cx="50" cy="50" r="29" fill="url(#emb-shine-${letter})"
                stroke="${p.dark}" stroke-width="2"/>
        <!-- Inner decorative ring -->
        <circle cx="50" cy="50" r="24" fill="none"
                stroke="${p.accent}" stroke-width="0.7" opacity="0.65"/>
        <!-- Tier letter -->
        <text x="50" y="62" text-anchor="middle"
              fill="${p.dark}" font-size="32" font-weight="900"
              font-family="'Bangers','Outfit',sans-serif"
              style="text-shadow:0 1px 0 ${p.light}">${letter}</text>
        <!-- Top highlight ribbon -->
        <path d="M28 30 Q50 18 72 30" stroke="${p.accent}" stroke-width="1.2"
              fill="none" opacity="0.7" stroke-linecap="round"/>
      </svg>`;
  }

  async function showProfile(){
    const ov=document.getElementById('profileOv'); if(ov) ov.classList.add('show');
    // Reset XP bar so it animates from 0 every time the modal opens.
    const xpFill = document.getElementById('profileXpFill'); if(xpFill) xpFill.style.width='0%';
    let u=S.user;
    try{
      const d=await api('GET','/auth/me');
      u=d.user;
      S.user=u; localStorage.setItem('uno_user',JSON.stringify(u));
    }catch(e){ /* fall back to cached user */ }
    if(!u) return;

    // Name + ID
    document.getElementById('profileName').textContent = u.username || 'Player';
    const shortId = u.shortId || (u.id || '').slice(0, 9).toUpperCase();
    const idTxt = document.querySelector('#profileId .profile-v4-id-num');
    if(idTxt) idTxt.textContent = shortId;
    // Gold verification seal ONLY for the showcase/dev account; everyone else
    // keeps the standard blue seal.
    const vBadge = document.getElementById('profileVerified');
    if(vBadge){
      const isBest = String(u.shortId) === '951808283' || (u.username||'').toLowerCase() === 'mustapha';
      vBadge.classList.toggle('is-gold', isBest);
    }
    // Profile banner — the ornate frame plaque behind the header.
    _applyProfileBanner(u.profileBanner);
    _renderAvatarInto(document.getElementById('profileAvatar'), u);

    // Showcase — active Title badge under the name (click → Titles picker).
    _ensureTitleStyles();
    const titleBadge = document.getElementById('profileTitleBadge');
    if(titleBadge){
      const titles = u.titles || [];
      if(u.activeTitle){ titleBadge.textContent = '👑 ' + u.activeTitle; titleBadge.style.display=''; titleBadge.classList.remove('empty'); }
      else if(titles.length){ titleBadge.textContent = '＋ Choose a Title'; titleBadge.style.display=''; titleBadge.classList.add('empty'); }
      else { titleBadge.style.display='none'; }
    }

    // Level + XP bar
    const lvlNum = document.getElementById('profileLvl');
    const prog   = u.accountLevelProgress || { into:0, span:1000, pct:0 };
    if(lvlNum) lvlNum.textContent = u.accountLevel || 1;
    const xpText = document.getElementById('profileXpText');
    if(xpText) xpText.textContent = `${(prog.into||0).toLocaleString()} / ${(prog.span||1000).toLocaleString()}`;
    requestAnimationFrame(() => { if(xpFill) xpFill.style.width = (prog.pct || 0) + '%'; });

    // Rank — read the REAL ranked ladder (rankPoints + the server-computed
    // tier), NOT elo. This matches the Ranked Hub and the rest of the app, so
    // a Grandmaster shows Grandmaster here too. Placement shows until 5 games.
    const rp          = u.rankPoints ?? 1000;
    const rt          = u.rankedTier || null;      // server: getLeague(rankPoints), or null in placement
    const inPlacement = (u.placementGamesPlayed || 0) < 5;
    _animateCount('pRating', rp);
    const tierName  = rt ? (rt.name || 'Bronze') : 'Bronze';
    const tierLabel = inPlacement ? 'Placement' : (rt ? (rt.label || rt.name || 'Bronze') : 'Unranked');
    // Battle stats
    const played = u.stats?.gamesPlayed || 0;
    const won    = u.stats?.gamesWon    || 0;
    const rate   = played > 0 ? Math.round((won / played) * 100) : 0;
    _animateCount('pCoins',     u.coins     || 0);
    _animateCount('pWon',       won);
    _animateCount('pPlayed',    played);
    _animateCount('pStreak',    u.winStreak || 0);
    const winRateEl = document.getElementById('pWinRateStat');
    if(winRateEl) winRateEl.textContent = rate + '%';

    // Rank tier label + emblem (V4 card) — real rank badge artwork + real tier.
    const tierUno = document.getElementById('profileTierUno');
    if(tierUno) tierUno.textContent = tierLabel;
    const emblemUno = document.getElementById('profileEmblemUno');
    if(emblemUno) emblemUno.innerHTML = `<img class="profile-v4-rank-img" src="${_rankBadgeImg(tierName)}" alt="${esc(tierLabel)}" draggable="false">`;

    // Sidebar nav — every section is now wired. switchProfileSection
    // hides the overview block and renders the target section into
    // #profileSection. Re-clicking OVERVIEW swaps back.
    document.querySelectorAll('.profile-v4-nav').forEach(nav => {
      nav.onclick = () => switchProfileSection(nav.dataset.section);
    });
    // Reset to overview every time the profile opens.
    switchProfileSection('overview');
  }

  // ── Profile Banner ───────────────────────────────────────────────
  // Ornate frame plaques behind the profile header. They are RANKED REWARDS:
  // royal-gold is free for everyone, the rest unlock when your PEAK ranked
  // tier reaches the listed rank (RP thresholds mirror the ladder). Persists
  // per-account via /api/profile/banner (server re-checks the unlock).
  const PROFILE_BANNERS = [
    { id:'royal-gold',    name:'Royal Gold', minRP: 0,    rank:'Default',     color:'#FBBF24' },
    { id:'sapphire',      name:'Sapphire',   minRP: 2400, rank:'Platinum',    color:'#5AC8FA' },
    { id:'royal-crimson', name:'Crimson',    minRP: 3900, rank:'Diamond',     color:'#FF6B6B' },
    { id:'amethyst',      name:'Amethyst',   minRP: 6000, rank:'Master',      color:'#A855F7' },
    { id:'inferno',       name:'Inferno',    minRP: 9000, rank:'Grandmaster', color:'#FB923C' },
  ];
  const PROFILE_BANNER_IDS = PROFILE_BANNERS.map(b => b.id);
  const _bannerPeakRP = () => Math.max(S.user?.peakRankPoints || 0, S.user?.rankPoints || 0);
  const _bannerUnlocked = (b) => _bannerPeakRP() >= (b.minRP || 0);

  function _applyProfileBanner(id){
    const banner = PROFILE_BANNER_IDS.includes(id) ? id : 'royal-gold';
    const url = `url('/banners/${banner}.png')`;
    // Apply to BOTH the profile header card and the lobby chip nameplate so a
    // banner change reflects everywhere immediately. All banners are dark-filled
    // now, so light/dark text handling is no longer needed.
    [document.querySelector('#profileOverview .profile-v4-player'),
     document.getElementById('huserPill')].forEach(el => {
      if(!el) return;
      el.classList.add('has-banner');
      el.classList.remove('banner-light');
      el.style.setProperty('--profile-banner', url);
    });
  }

  function showBannerPicker(){
    _ensureBannerStyles();
    const cur = (S.user && PROFILE_BANNER_IDS.includes(S.user.profileBanner)) ? S.user.profileBanner : 'royal-gold';
    const old = document.getElementById('bannerPickerOv'); if(old) old.remove();
    const ov = document.createElement('div'); ov.id = 'bannerPickerOv'; ov.className = 'bnp-ov';
    ov.innerHTML = `
      <div class="bnp-box" role="dialog" aria-label="Choose profile banner">
        <button class="bnp-close" onclick="document.getElementById('bannerPickerOv')?.remove()" aria-label="Close">×</button>
        <div class="bnp-eyebrow">PROFILE BANNER</div>
        <div class="bnp-title">Ranked Rewards</div>
        <div class="bnp-sub">Unlock frames by climbing the ranked ladder</div>
        <div class="bnp-grid">
          ${PROFILE_BANNERS.map(b => {
            const unlocked = _bannerUnlocked(b);
            return `
            <button class="bnp-item ${b.id===cur?'is-active':''}${unlocked?'':' is-locked'}" data-id="${b.id}" onclick="setProfileBanner('${b.id}')" title="${esc(b.name)}">
              <img src="/banners/${b.id}.png" alt="${esc(b.name)}" loading="lazy" draggable="false">
              <span class="bnp-name">${esc(b.name)}</span>
              <span class="bnp-req">${b.minRP === 0 ? 'Everyone' : (unlocked ? '✓ '+esc(b.rank) : '🔒 '+esc(b.rank))}</span>
              <span class="bnp-check">✓</span>
            </button>`;
          }).join('')}
        </div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    ov.addEventListener('mousedown', e => { if(e.target === ov) ov.remove(); });
  }

  async function setProfileBanner(id){
    const meta = PROFILE_BANNERS.find(b => b.id === id);
    if(!meta) return;
    if(!_bannerUnlocked(meta)){
      // Tapping a banner you haven't earned takes you STRAIGHT to Ranked to go
      // win it — close the picker AND the profile overlay first so the Ranked
      // hub opens on top (not hidden behind the profile), then drop the player
      // straight into the arena.
      document.getElementById('bannerPickerOv')?.remove();
      document.getElementById('profileOv')?.classList.remove('show');
      if(typeof showRankedReady === 'function') showRankedReady();
      else if(typeof showRanked === 'function') showRanked();
      return;
    }
    // Optimistic — apply + mark selected instantly, then persist.
    if(S.user){ S.user.profileBanner = id; try{ localStorage.setItem('uno_user', JSON.stringify(S.user)); }catch(e){} }
    _applyProfileBanner(id);
    document.querySelectorAll('#bannerPickerOv .bnp-item').forEach(el => el.classList.toggle('is-active', el.dataset.id === id));
    try{ await api('POST', '/profile/banner', { banner:id }); toast('🖼️ Banner updated','s'); }
    catch(e){ toast(e?.message || 'Could not save banner','e'); }
  }

  function _ensureBannerStyles(){
    if(document.getElementById('bannerPickerStyles')) return;
    const s = document.createElement('style'); s.id = 'bannerPickerStyles';
    s.textContent = `
      .bnp-ov{ position:fixed; inset:0; z-index:4200; display:flex; align-items:center; justify-content:center;
        background:rgba(3,7,18,.78); backdrop-filter:blur(7px); -webkit-backdrop-filter:blur(7px);
        opacity:0; transition:opacity .2s ease; padding:16px; }
      .bnp-ov.show{ opacity:1; }
      .bnp-box{ position:relative; width:100%; max-width:560px; max-height:92vh; max-height:92dvh; overflow-y:auto;
        background:linear-gradient(165deg,#0E1626,#0A0F1C 70%); border:1px solid rgba(251,191,36,.28);
        border-radius:22px; padding:22px 20px 18px; box-shadow:0 30px 80px rgba(0,0,0,.6);
        transform:scale(.96); transition:transform .22s cubic-bezier(.2,1.1,.3,1); -webkit-overflow-scrolling:touch; }
      .bnp-ov.show .bnp-box{ transform:scale(1); }
      .bnp-close{ position:absolute; top:12px; right:14px; width:34px; height:34px; border-radius:50%;
        background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); color:#E2E8F0; font-size:18px; cursor:pointer; }
      .bnp-close:hover{ background:rgba(255,255,255,.13); }
      .bnp-eyebrow{ font-size:9px; font-weight:900; letter-spacing:2px; color:#64748B; text-align:center; }
      .bnp-title{ font-size:18px; font-weight:900; letter-spacing:1px; text-align:center;
        background:linear-gradient(180deg,#FFF4D6,#FBBF24 70%,#E8A317); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
      .bnp-sub{ font-size:11px; color:rgba(255,255,255,.5); text-align:center; margin-bottom:16px; font-weight:600; }
      .bnp-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
      .bnp-item{ position:relative; padding:8px 8px 7px; border-radius:13px; cursor:pointer;
        background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); transition:transform .12s, border-color .15s, background .15s; }
      .bnp-item:hover{ transform:translateY(-2px); background:rgba(255,255,255,.06); border-color:rgba(251,191,36,.4); }
      .bnp-item img{ width:100%; aspect-ratio:600/206; object-fit:fill; display:block; border-radius:8px; }
      .bnp-name{ display:block; text-align:center; font-size:11px; font-weight:800; letter-spacing:.4px; color:rgba(255,255,255,.7); margin-top:6px; }
      .bnp-req{ display:block; text-align:center; font-size:9px; font-weight:800; letter-spacing:.6px; color:#6EE7B7; margin-top:2px; text-transform:uppercase; }
      .bnp-item.is-locked .bnp-req{ color:#94A3B8; }
      .bnp-item.is-active{ border-color:#FBBF24; box-shadow:0 0 0 2px rgba(251,191,36,.3), 0 8px 22px rgba(251,191,36,.18); background:rgba(251,191,36,.08); }
      .bnp-item.is-active .bnp-name{ color:#FBBF24; }
      /* Locked reward — dimmed art + a 🔒, but still a call-to-action: tapping
         it jumps you to Ranked to go earn it, so it stays clearly clickable. */
      .bnp-item.is-locked{ cursor:pointer; }
      .bnp-item.is-locked img{ filter:grayscale(.85) brightness(.5); }
      .bnp-item.is-locked:hover{ transform:translateY(-2px); border-color:rgba(251,191,36,.45); background:rgba(255,255,255,.05); }
      .bnp-item.is-locked:hover img{ filter:grayscale(.5) brightness(.66); }
      .bnp-item.is-locked::after{ content:'🔒'; position:absolute; top:50%; left:50%; transform:translate(-50%,-90%);
        font-size:22px; filter:drop-shadow(0 2px 4px rgba(0,0,0,.6)); pointer-events:none; }
      .bnp-item.is-locked .bnp-req{ color:#FBBF24; }
      .bnp-check{ position:absolute; top:6px; right:6px; width:20px; height:20px; border-radius:50%;
        background:#FBBF24; color:#3A2606; font-size:12px; font-weight:900; display:none; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,.4); }
      .bnp-item.is-active .bnp-check{ display:flex; }
      @media(max-width:520px){ .bnp-grid{ grid-template-columns:repeat(2,1fr); } }
    `;
    document.head.appendChild(s);
  }

  window.showBannerPicker = showBannerPicker;
  window.setProfileBanner = setProfileBanner;

  // ── Profile Showcase: Titles & Badges ────────────────────────────
  function showTitles(){
    _ensureTitleStyles();
    const u=S.user||{};
    const titles=u.titles||[];
    const tWins=u.tournamentWins||0, best=u.winStreak||0, won=u.stats?.gamesWon||0;
    const old=document.getElementById('titlesOv'); if(old) old.remove();
    const ov=document.createElement('div'); ov.id='titlesOv'; ov.className='tt-ov';
    const list = titles.length
      ? titles.map(t=>`<button class="tt-item ${t===u.activeTitle?'on':''}" onclick="setTitle('${esc(t).replace(/'/g,"&#39;")}')">
           <span class="tt-crown">👑</span><span class="tt-name">${esc(t)}</span>${t===u.activeTitle?'<span class="tt-active">ACTIVE</span>':''}
         </button>`).join('')
      : `<div class="tt-empty">No titles yet 🏅<br><span style="opacity:.7">Finish a Season Contract (Missions → 📜 Contracts) to earn one: Gladiator · Curator · Socialite.</span></div>`;
    ov.innerHTML=`<div class="tt-panel">
      <button class="tt-x" onclick="document.getElementById('titlesOv').remove()" aria-label="Close">×</button>
      <div class="tt-eyebrow">🏅 SHOWCASE</div>
      <div class="tt-title">Titles &amp; Badges</div>
      <div class="tt-stats">
        <div class="tt-stat"><div class="tt-stat-n">${tWins}</div><div class="tt-stat-l">🏆 Tournaments</div></div>
        <div class="tt-stat"><div class="tt-stat-n">${best}</div><div class="tt-stat-l">🔥 Win Streak</div></div>
        <div class="tt-stat"><div class="tt-stat-n">${won.toLocaleString()}</div><div class="tt-stat-l">⚔️ Total Wins</div></div>
        <div class="tt-stat"><div class="tt-stat-n">${titles.length}</div><div class="tt-stat-l">🏅 Titles</div></div>
      </div>
      <div class="tt-sec">YOUR TITLES — tap to display</div>
      <div class="tt-list">${list}</div>
      ${u.activeTitle?`<button class="tt-clear" onclick="setTitle('')">Hide my title</button>`:''}
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) ov.remove(); });
  }
  async function setTitle(t){
    try{
      const r=await apiFetch('/api/profile/title',{method:'POST',body:JSON.stringify({title:t||null})});
      if(S.user){ S.user.activeTitle=r.activeTitle; try{localStorage.setItem('uno_user',JSON.stringify(S.user));}catch(e){} }
      const badge=document.getElementById('profileTitleBadge');
      if(badge){
        if(r.activeTitle){ badge.textContent='👑 '+r.activeTitle; badge.style.display=''; badge.classList.remove('empty'); }
        else { badge.textContent='＋ Choose a Title'; badge.classList.add('empty'); }
      }
      const ov=document.getElementById('titlesOv'); if(ov) ov.remove();
      toast(r.activeTitle?`👑 Title set: ${r.activeTitle}`:'Title hidden','s');
    }catch(e){ toast(e?.message||'Could not set title','e'); }
  }
  window.showTitles=showTitles; window.setTitle=setTitle;
  function _ensureTitleStyles(){
    if(document.getElementById('ttStyles')) return;
    const s=document.createElement('style'); s.id='ttStyles';
    s.textContent=`
      .profile-v4-title{ display:inline-flex; align-items:center; gap:5px; margin:4px 0 2px; padding:4px 12px; border-radius:99px; cursor:pointer;
        font-family:'Outfit',sans-serif; font-weight:800; font-size:12px; letter-spacing:.3px; color:#FFE9B0; align-self:flex-start;
        background:linear-gradient(135deg, rgba(251,191,36,.22), rgba(217,119,6,.18)); border:1px solid rgba(251,191,36,.45); transition:filter .15s; }
      .profile-v4-title:hover{ filter:brightness(1.12); }
      .profile-v4-title.empty{ color:rgba(255,255,255,.6); background:rgba(255,255,255,.05); border-color:rgba(255,255,255,.15); }
      .tt-ov{ position:fixed; inset:0; z-index:1400; display:flex; align-items:center; justify-content:center; padding:18px;
        background:radial-gradient(ellipse at 50% 35%, rgba(40,30,10,.55), rgba(4,6,14,.92)); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); animation:avFadeIn .25s ease; }
      .tt-panel{ width:min(440px,95vw); max-height:90vh; overflow-y:auto; position:relative; padding:22px; border-radius:22px; color:#fff; font-family:'Outfit',sans-serif;
        background:linear-gradient(180deg, rgba(30,34,60,.98), rgba(16,20,36,.99)); border:1px solid rgba(255,255,255,.09); box-shadow:0 40px 100px rgba(0,0,0,.75); }
      .tt-x{ position:absolute; top:14px; right:16px; width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); color:rgba(255,255,255,.7); font-size:20px; cursor:pointer; }
      .tt-eyebrow{ font-size:11px; font-weight:900; letter-spacing:2.6px; color:#FBBF24; }
      .tt-title{ font-family:'Bangers',cursive; font-size:28px; letter-spacing:2px; color:#FFE9B0; margin-bottom:14px; }
      .tt-stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:16px; }
      .tt-stat{ text-align:center; padding:10px 4px; border-radius:12px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); }
      .tt-stat-n{ font-family:'Bangers',cursive; font-size:20px; color:#FFE9B0; line-height:1; }
      .tt-stat-l{ font-size:9px; font-weight:700; color:rgba(255,255,255,.55); margin-top:4px; letter-spacing:.2px; }
      .tt-sec{ font-size:10.5px; font-weight:900; letter-spacing:1.6px; color:rgba(255,255,255,.5); margin:6px 0 10px; }
      .tt-list{ display:flex; flex-direction:column; gap:8px; }
      .tt-item{ display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:13px; cursor:pointer; width:100%; text-align:left;
        background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); color:#fff; font-family:inherit; transition:all .15s; }
      .tt-item:hover{ border-color:rgba(251,191,36,.4); transform:translateY(-1px); }
      .tt-item.on{ border-color:#FBBF24; background:rgba(251,191,36,.12); }
      .tt-crown{ font-size:18px; }
      .tt-name{ flex:1; font-weight:800; font-size:14px; letter-spacing:.3px; }
      .tt-active{ font-size:9px; font-weight:900; letter-spacing:1px; background:linear-gradient(135deg,#FBBF24,#D97706); color:#1a1a1a; padding:3px 8px; border-radius:99px; }
      .tt-empty{ text-align:center; color:rgba(255,255,255,.55); padding:26px 12px; font-size:13px; line-height:1.6; font-weight:600; }
      .tt-clear{ width:100%; margin-top:14px; padding:11px; border:1.5px solid rgba(255,255,255,.12); border-radius:11px; background:transparent; color:rgba(255,255,255,.7); font-family:inherit; font-weight:800; font-size:12px; cursor:pointer; }
      .tt-clear:hover{ border-color:rgba(232,50,74,.5); color:#fff; }
    `;
    document.head.appendChild(s);
  }

  // ── Profile section router ───────────────────────────────────────
  // Toggles the active nav button, swaps overview vs. section content,
  // and dispatches to the renderer for the selected section. All
  // rendered HTML goes through esc() so usernames + match data are
  // never injected raw (XSS hardening).
  async function switchProfileSection(name){
    const valid = ['overview','stats','history','ranked','friends','achievements','leaderboard'];
    if(!valid.includes(name)) name = 'overview';
    document.querySelectorAll('.profile-v4-nav').forEach(n => {
      n.classList.toggle('active', n.dataset.section === name);
    });
    const overview = document.getElementById('profileOverview');
    const section  = document.getElementById('profileSection');
    if(!section || !overview) return;
    if(name === 'overview'){
      overview.style.display = '';
      section.style.display = 'none';
      section.innerHTML = '';
      return;
    }
    overview.style.display = 'none';
    section.style.display = '';
    section.innerHTML = `<div class="psec-loading"><div class="psec-spin"></div>Loading…</div>`;
    try{
      if(name === 'stats')        await renderProfileStats(section);
      else if(name === 'history') await renderProfileHistory(section);
      else if(name === 'ranked')  await renderProfileRanked(section);
      else if(name === 'friends') await renderProfileFriends(section);
      else if(name === 'achievements') await renderProfileAchievements(section);
      else if(name === 'leaderboard')  await renderProfileLeaderboard(section);
    }catch(e){
      console.warn('[Profile] section', name, 'failed', e);
      section.innerHTML = `<div class="psec-err">Could not load this section. Try again later.</div>`;
    }
  }
  window.switchProfileSection = switchProfileSection;

  // ── STATS ── detailed lifetime totals + game-mode breakdown.
  async function renderProfileStats(host){
    const u = S.user || {};
    const stats = u.stats || {};
    const played = stats.gamesPlayed || 0;
    const won    = stats.gamesWon    || 0;
    const lost   = Math.max(0, played - won);
    const rate   = played > 0 ? Math.round(won/played*100) : 0;
    const streak = u.winStreak || 0;
    const bestStreak = u.bestWinStreak || streak;
    const totalCoinsEarned = stats.totalCoinsEarned || u.coins || 0;
    const rankedW = u.rankedWins || 0;
    const rankedL = u.rankedLosses || 0;
    const rankedRate = (rankedW + rankedL) > 0 ? Math.round(rankedW/(rankedW+rankedL)*100) : 0;
    const tournamentWins = u.tournamentWins || 0;
    const tile = (lbl, val, accent='#FBBF24') =>
      `<div class="psec-tile"><div class="psec-tile-val" style="color:${accent}">${esc(String(val))}</div><div class="psec-tile-lbl">${esc(lbl)}</div></div>`;
    host.innerHTML = `
      <div class="psec-head">
        <div class="psec-eyebrow">LIFETIME PERFORMANCE</div>
        <div class="psec-title">Stats</div>
      </div>
      <div class="psec-block">
        <div class="psec-block-title">Overall</div>
        <div class="psec-grid">
          ${tile('Matches Played',  played.toLocaleString())}
          ${tile('Wins',            won.toLocaleString(), '#22C55E')}
          ${tile('Losses',          lost.toLocaleString(), '#E8324A')}
          ${tile('Win Rate',        rate + '%')}
        </div>
      </div>
      <div class="psec-block">
        <div class="psec-block-title">Streaks &amp; Rewards</div>
        <div class="psec-grid">
          ${tile('Current Streak',  streak + (streak >= 2 ? ' 🔥' : ''))}
          ${tile('Best Streak',     bestStreak)}
          ${tile('Coins Earned',    totalCoinsEarned.toLocaleString())}
          ${tile('Tournaments Won', tournamentWins.toLocaleString(), '#A855F7')}
        </div>
      </div>
      <div class="psec-block">
        <div class="psec-block-title">Ranked</div>
        <div class="psec-grid">
          ${tile('Ranked Wins',     rankedW.toLocaleString(), '#22C55E')}
          ${tile('Ranked Losses',   rankedL.toLocaleString(), '#E8324A')}
          ${tile('Ranked Win Rate', rankedRate + '%')}
          ${tile('Rank Points',     (u.rankPoints || 0).toLocaleString(), '#FBBF24')}
        </div>
      </div>`;
  }

  // ── MATCH HISTORY ── pull recent matches from the leaderboard payload.
  async function renderProfileHistory(host){
    const d = await api('GET','/leaderboard');
    const hist = d?.matchHistory || S.user?.matchHistory || [];
    if(!hist.length){
      host.innerHTML = `
        <div class="psec-head">
          <div class="psec-eyebrow">RECENT MATCHES</div>
          <div class="psec-title">Match History</div>
        </div>
        <div class="psec-empty">No matches yet. Play your first game to start building history.</div>`;
      return;
    }
    const rows = hist.map(m => {
      const rpDelta = m.rpChange || 0;
      const won = !!m.won;
      const cls = won ? 'win' : (rpDelta < 0 ? 'loss' : 'draw');
      const sign = rpDelta > 0 ? '+' : '';
      const opps = (m.opponents || []).slice(0, 3).map(esc).join(', ') + ((m.opponents || []).length > 3 ? '…' : '');
      const room = esc(m.roomType || 'GAME');
      const when = m.at ? _profileAgo(m.at) : '';
      return `
        <div class="psec-match psec-match-${cls}">
          <div class="psec-match-tag">${won ? 'WIN' : 'LOSS'}</div>
          <div class="psec-match-mid">
            <div class="psec-match-room">${room}</div>
            <div class="psec-match-vs">vs ${opps || '?'}</div>
            <div class="psec-match-time">${esc(when)}</div>
          </div>
          <div class="psec-match-rp">${rpDelta ? sign + rpDelta + ' RP' : '—'}</div>
        </div>`;
    }).join('');
    host.innerHTML = `
      <div class="psec-head">
        <div class="psec-eyebrow">RECENT MATCHES</div>
        <div class="psec-title">Match History</div>
      </div>
      <div class="psec-history">${rows}</div>`;
  }

  // ── RANKED ── tier ladder + current standing + ranked deltas.
  // Premium "Rank Rewards" track — a compact horizontal row of 4 reward nodes
  // (rank emblem + banner preview + status) that all fit on screen at once. The
  // NEXT goal pulses with a live progress bar. Shared by profile + Ranked Hub.
  function renderRankRewards(peak){
    peak = Math.max(0, peak | 0);
    const rewards = [
      { rank:'Platinum',    rp:2400, banner:'sapphire',      emblem:'platinum',    color:'#5AC8FA' },
      { rank:'Diamond',     rp:3900, banner:'royal-crimson', emblem:'diamond',     color:'#FF6B6B' },
      { rank:'Master',      rp:6000, banner:'amethyst',      emblem:'master',      color:'#A855F7' },
      { rank:'Grandmaster', rp:9000, banner:'inferno',       emblem:'grandmaster', color:'#FB923C' },
    ];
    const nextIdx = rewards.findIndex(r => peak < r.rp);
    const earned  = rewards.filter(r => peak >= r.rp).length;
    const nodes = rewards.map((r, i) => {
      const unlocked = peak >= r.rp;
      const isNext   = i === nextIdx;
      const cls      = unlocked ? 'is-unlocked' : isNext ? 'is-next' : 'is-locked';
      const prevRp   = i > 0 ? rewards[i - 1].rp : 0;
      const pct      = Math.max(3, Math.min(100, Math.round((peak - prevRp) / (r.rp - prevRp) * 100)));
      const toGo     = Math.max(0, r.rp - peak);
      const status   = unlocked ? '✓ EARNED'
                      : isNext   ? `${toGo.toLocaleString()} RP`
                                 : `${r.rp.toLocaleString()} RP`;
      return `
        <div class="rkrw-node ${cls}" style="--rc:${r.color}">
          <div class="rkrw-node-art">
            <img src="/banners/${r.banner}.png" alt="${esc(r.rank)}" loading="lazy" draggable="false">
            ${(!unlocked && !isNext) ? '<span class="rkrw-node-lock">🔒</span>' : ''}
          </div>
          <img class="rkrw-node-emblem" src="/ranks/${r.emblem}.png" alt="" draggable="false">
          <div class="rkrw-node-rank" style="color:${r.color}">${esc(r.rank)}</div>
          <div class="rkrw-node-st">${status}</div>
          ${isNext ? `<div class="rkrw-node-bar"><div class="rkrw-node-bar-fill" style="width:${pct}%"></div></div>` : ''}
        </div>`;
    }).join('');
    const hint = nextIdx === -1
      ? `<div class="rkrw-hint rkrw-hint-done">🏆 All ranked banners earned — legendary.</div>`
      : `<div class="rkrw-hint">🎯 Next: <b style="color:${rewards[nextIdx].color}">${esc(rewards[nextIdx].rank)}</b> · ${Math.max(0, rewards[nextIdx].rp - peak).toLocaleString()} RP to go</div>`;
    return { html:`<div class="rkrw-track">${nodes}</div>${hint}`, earned, total: rewards.length };
  }
  window.renderRankRewards = renderRankRewards;

  async function renderProfileRanked(host){
    const u = S.user || {};
    const rp = u.rankPoints || 0;
    const peak = u.peakRankPoints || rp;
    const placed = u.placementGamesPlayed || 0;
    const inPlace = placed < 5;
    const tiers = (typeof RANKED_TIERS_CLIENT !== 'undefined') ? RANKED_TIERS_CLIENT : [];
    const curTier = (typeof rpTier === 'function') ? rpTier(rp) : null;
    const ladder = tiers.length ? [...tiers].reverse().map(t => {
      const isMine = !inPlace && curTier && curTier.name === t.name;
      const unlocked = !inPlace && rp >= t.min;
      const rpToGo = Math.max(0, t.min - rp);
      const state  = isMine ? 'is-mine' : unlocked ? 'is-done' : 'is-locked';
      const status = isMine ? '★ HERE' : unlocked ? '✓ DONE' : `${rpToGo.toLocaleString()} RP`;
      return `
        <div class="psec-ladder-row ${state}" style="--c:${t.color}">
          <div class="psec-ladder-badge">${t.img ? `<img class="psec-ladder-img" src="${esc(t.img)}" alt="${esc(t.name)}" loading="lazy" draggable="false">` : t.badge}</div>
          <div class="psec-ladder-name">${esc(t.name)}<span>${t.min.toLocaleString()} RP</span></div>
          <div class="psec-ladder-status">${status}</div>
        </div>`;
    }).join('') : '<div class="psec-empty">Ranked tiers loading…</div>';

    // ── RANK REWARDS showcase — premium banner reward track. ──
    const rw = renderRankRewards(peak);

    host.innerHTML = `
      <div class="psec-head">
        <div class="psec-eyebrow">${inPlace ? 'PLACEMENT' : 'COMPETITIVE LADDER'}</div>
        <div class="psec-title">Ranked</div>
      </div>
      <div class="psec-rank-head">
        <div class="psec-rank-hero" style="color:${curTier?.color || '#FBBF24'}">${(!inPlace && curTier?.img) ? `<img class="psec-rank-img" src="${esc(curTier.img)}" alt="${esc(curTier.name)}" draggable="false">` : (inPlace ? '🎯' : (curTier?.badge || '🥉'))}</div>
        <div class="psec-rank-info">
          <div class="psec-rank-tier" style="color:${curTier?.color || '#FBBF24'}">${inPlace ? 'PLACEMENT' : esc((curTier?.name || 'Bronze').toUpperCase())}</div>
          <div class="psec-rank-rp">${rp.toLocaleString()} RP · Peak ${peak.toLocaleString()}</div>
          <div class="psec-rank-sub">${(u.rankedWins||0)}W · ${(u.rankedLosses||0)}L · 🔥${u.winStreak||0}</div>
        </div>
      </div>
      <div class="psec-block rkrw-block">
        <div class="psec-block-title">🎁 Rank Rewards · Exclusive Banners <span class="rkrw-count">${rw.earned}/${rw.total}</span></div>
        ${rw.html}
      </div>
      <div class="psec-block">
        <div class="psec-block-title">Climb Path</div>
        <div class="psec-ladder">${ladder}</div>
      </div>`;
  }

  // ── FRIENDS ── snapshot of the friends list.
  async function renderProfileFriends(host){
    let list = [];
    try{ const d = await api('GET','/friends'); list = d?.friends || []; }catch(e){}
    if(!list.length){
      host.innerHTML = `
        <div class="psec-head">
          <div class="psec-eyebrow">YOUR CIRCLE</div>
          <div class="psec-title">Friends</div>
        </div>
        <div class="psec-empty">No friends added yet. Open the 👥 panel from the header to send your first request.</div>`;
      return;
    }
    const rows = list.map(f => {
      const initial = esc((f.username || '?')[0].toUpperCase());
      const img = (f.avatar && /^(https?:|data:|\/)/.test(f.avatar))
        ? `style="background-image:url('${esc(f.avatar)}');background-size:cover"`
        : '';
      const dot = f.isOnline ? 'psec-friend-on' : 'psec-friend-off';
      const status = f.isOnline ? 'Online' : (f.lastSeen ? _profileAgo(f.lastSeen) : 'Offline');
      return `
        <div class="psec-friend" onclick="showOpponentProfile('${esc(f.id)}')" title="View ${esc(f.username||'player')}'s profile" style="cursor:pointer">
          <div class="psec-friend-av" ${img}>${img ? '' : initial}</div>
          <div class="psec-friend-text">
            <div class="psec-friend-name">${esc(f.username || 'Player')}${verifiedBadgeHTML(f.username,{size:'xs'})}</div>
            <div class="psec-friend-status ${dot}">● ${esc(status)}</div>
          </div>
          <div class="psec-friend-arrow">›</div>
        </div>`;
    }).join('');
    host.innerHTML = `
      <div class="psec-head">
        <div class="psec-eyebrow">YOUR CIRCLE · ${list.length}</div>
        <div class="psec-title">Friends</div>
      </div>
      <div class="psec-friends">${rows}</div>`;
  }

  // ── ACHIEVEMENTS ── list every achievement with progress bar + claim btn.
  async function renderProfileAchievements(host){
    let data = { achievements:[], total:0, earned:0 };
    try{ data = await api('GET','/achievements') || data; }catch(e){}
    const items = data.achievements || [];
    if(!items.length){
      host.innerHTML = `
        <div class="psec-head">
          <div class="psec-eyebrow">MILESTONES</div>
          <div class="psec-title">Achievements</div>
        </div>
        <div class="psec-empty">No achievements available yet.</div>`;
      return;
    }
    const rows = items.map(a => {
      const pct = Math.min(100, Math.round(((a.current||0) / (a.target||1)) * 100));
      const state = a.claimed ? 'claimed' : a.complete ? 'ready' : 'locked';
      const action = a.claimed
        ? `<span class="psec-ach-pill psec-ach-claimed">✓ CLAIMED</span>`
        : a.complete
          ? `<button class="psec-ach-pill psec-ach-claim" onclick="claimAchievement('${esc(a.id)}', this)">CLAIM +${a.reward.toLocaleString()}🪙</button>`
          : `<span class="psec-ach-pill psec-ach-progress">${a.current.toLocaleString()} / ${a.target.toLocaleString()}</span>`;
      return `
        <div class="psec-ach psec-ach-${state}">
          <div class="psec-ach-icon">${a.icon}</div>
          <div class="psec-ach-body">
            <div class="psec-ach-name">${esc(a.name)}</div>
            <div class="psec-ach-desc">${esc(a.desc)}</div>
            <div class="psec-ach-bar"><div class="psec-ach-bar-fill" style="width:${pct}%"></div></div>
          </div>
          ${action}
        </div>`;
    }).join('');
    host.innerHTML = `
      <div class="psec-head">
        <div class="psec-eyebrow">MILESTONES · ${data.earned}/${data.total} EARNED</div>
        <div class="psec-title">Achievements</div>
      </div>
      <div class="psec-achs">${rows}</div>`;
  }

  // Claim an achievement reward — server validates state + credits coins.
  window.claimAchievement = async function(id, btn){
    if(btn){ btn.disabled = true; btn.textContent = 'CLAIMING…'; }
    try{
      const r = await api('POST','/achievements/claim',{ id });
      if(r?.success){
        if(typeof r.coins === 'number'){ S.user.coins = r.coins; localStorage.setItem('uno_user', JSON.stringify(S.user)); }
        toast(`🏆 Claimed +${(r.reward||0).toLocaleString()} 🪙`, 's');
        // Re-render achievements + the lobby coin display.
        const host = document.getElementById('profileSection');
        if(host) renderProfileAchievements(host);
        if(typeof _animateCount === 'function' && S.user?.coins != null){
          _animateCount('hcoins', S.user.coins);
          _animateCount('scoins', S.user.coins);
        }
      } else {
        toast(r?.error || 'Could not claim', 'e');
        if(btn){ btn.disabled = false; btn.textContent = 'CLAIM'; }
      }
    }catch(e){
      toast(e?.message || 'Could not claim', 'e');
      if(btn){ btn.disabled = false; btn.textContent = 'CLAIM'; }
    }
  };

  // Tiny relative-time formatter used across the profile sections.
  function _profileAgo(ts){
    if(!ts) return '';
    const diff = Date.now() - ts;
    if(diff < 60_000)        return 'just now';
    if(diff < 3_600_000)     return Math.floor(diff/60_000) + 'm ago';
    if(diff < 86_400_000)    return Math.floor(diff/3_600_000) + 'h ago';
    if(diff < 7*86_400_000)  return Math.floor(diff/86_400_000) + 'd ago';
    try{ return new Date(ts).toLocaleDateString(); }catch(e){ return ''; }
  }

  // Simple diamond/medal emblem SVG used by the V4 rank card. Color
  // palette swaps per tier — purple for Silver, gold for Gold/Master,
  // blue for Diamond, etc.
  // Map a tier label (ELO bracket OR ranked tier) to its real badge artwork
  // under /ranks/. 'Legend' maps to the top Grandmaster badge.
  function _rankBadgeImg(label){
    const map = { bronze:'bronze', silver:'silver', gold:'gold', platinum:'platinum',
      diamond:'diamond', master:'master', legend:'grandmaster', grandmaster:'grandmaster' };
    const key = map[String(label || '').toLowerCase()] || 'bronze';
    return `/ranks/${key}.png`;
  }

  function _profileV4EmblemSVG(tier){
    const PAL = {
      Silver:   { c1:'#A1A1AA', c2:'#52525B', accent:'#FBBF24' },
      Gold:     { c1:'#FCD34D', c2:'#92760E', accent:'#FFFBEB' },
      Platinum: { c1:'#22D3EE', c2:'#0E7490', accent:'#FCD34D' },
      Diamond:  { c1:'#60A5FA', c2:'#1E40AF', accent:'#FFFBEB' },
      Master:   { c1:'#E8324A', c2:'#7C2D12', accent:'#FCD34D' },
      Legend:   { c1:'#A855F7', c2:'#581C87', accent:'#FCD34D' },
    };
    const p = PAL[tier] || { c1:'#FB7E1A', c2:'#92400E', accent:'#FED7AA' };
    return `
      <svg viewBox="0 0 64 64">
        <defs>
          <linearGradient id="v4em-${tier}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stop-color="${p.c1}"/>
            <stop offset="100%" stop-color="${p.c2}"/>
          </linearGradient>
        </defs>
        <!-- Diamond/medal shape -->
        <path d="M32 4 L56 28 L32 60 L8 28 Z" fill="url(#v4em-${tier})"
              stroke="${p.c2}" stroke-width="1.5" stroke-linejoin="round"/>
        <!-- Top facet -->
        <path d="M32 4 L8 28 L20 28 Z"   fill="rgba(255,255,255,.25)"/>
        <path d="M32 4 L56 28 L44 28 Z"  fill="rgba(0,0,0,.18)"/>
        <!-- Inner band -->
        <path d="M8 28 L56 28" stroke="${p.c2}" stroke-width="1"/>
        <!-- Bottom point highlight -->
        <path d="M20 28 L32 60 L26 28 Z" fill="rgba(255,255,255,.18)"/>
        <!-- Accent shine -->
        <path d="M14 18 Q22 12 30 14" fill="none" stroke="${p.accent}"
              stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
      </svg>`;
  }
  async function showAdminPanel(){
    // Client-side check is purely cosmetic — the server enforces this
    // via authMiddleware + isAdminRequest() on every admin endpoint.
    if(!S.user?.isAdmin) return toast('Admin only','e');
    document.getElementById('adminOv').classList.add('show');
    // Refresh the 2FA status pill every time the panel opens so the
    // admin sees whether their session is fully cleared or not.
    admin2faRefreshStatus();
  }

  // ── 2FA STATUS / SETUP / VERIFY / DISABLE ────────────────────────
  async function admin2faRefreshStatus(){
    const el = document.getElementById('admin2faStatus');
    const btn = document.getElementById('admin2faSetupBtn');
    if(!el) return;
    try{
      const d = await api('GET','/admin/2fa/status');
      let line, color;
      if(d.enabled && d.sessionCleared){
        line = `✅ 2FA enabled · session verified${d.backupCodesRemaining < 3 ? ` · ⚠️ only ${d.backupCodesRemaining} backup codes left` : ''}`;
        color = '#4ade80';
        if(btn) btn.textContent = '🔐 Disable 2FA';
      } else if(d.enabled){
        line = '⚠️ 2FA enabled but session not verified — log out and back in.';
        color = '#FBBF24';
        if(btn) btn.textContent = '🔐 Re-verify 2FA';
      } else {
        line = '🔓 2FA not enabled — set it up to lock this account down.';
        color = '#FCA5A5';
        if(btn) btn.textContent = '🔐 Set up 2FA';
      }
      el.textContent = line; el.style.color = color;
      el.dataset.state = d.enabled ? (d.sessionCleared ? 'on' : 'unverified') : 'off';
    }catch(e){
      el.textContent = 'Could not load 2FA status.';
      el.style.color = '#FCA5A5';
    }
  }

  async function admin2faOpenSetup(){
    const statusEl = document.getElementById('admin2faStatus');
    const state = statusEl?.dataset.state;
    if(state === 'on'){ return admin2faOpenDisable(); }
    const ov = document.getElementById('admin2faOv');
    const body = document.getElementById('admin2faBody');
    if(!ov || !body) return;
    body.innerHTML = `<div style="padding:30px 12px;color:rgba(255,255,255,.6);font-size:13px">Generating secret…</div>`;
    ov.classList.add('show');
    try{
      const d = await api('POST','/admin/2fa/setup',{});
      body.innerHTML = `
        <div style="font-size:12px;color:rgba(255,255,255,.7);margin-bottom:12px;line-height:1.55">
          Scan this QR with <b>Google Authenticator</b>, <b>Authy</b>, or any TOTP app, then enter the 6-digit code below to confirm.
        </div>
        <div style="display:flex;justify-content:center;margin:12px 0">
          <div id="admin2faQR" style="background:#fff;padding:10px;border-radius:10px"></div>
        </div>
        <div style="font-size:10.5px;color:rgba(255,255,255,.45);font-weight:700;margin:8px 0 4px;letter-spacing:1.2px;text-transform:uppercase">Or enter manually</div>
        <div style="font-family:monospace;font-size:11px;color:#FFE9B0;background:rgba(0,0,0,.45);padding:8px 10px;border-radius:8px;letter-spacing:1px;word-break:break-all;margin-bottom:14px">${esc(d.secret)}</div>
        <input id="admin2faCode" inputmode="numeric" maxlength="6" placeholder="123456"
               style="width:100%;padding:13px 14px;background:rgba(0,0,0,.45);border:1.5px solid rgba(251,191,36,.3);border-radius:10px;color:#FFE9B0;font-family:'Outfit',sans-serif;font-size:20px;font-weight:900;letter-spacing:5px;text-align:center;outline:none;margin-bottom:10px"/>
        <div id="admin2faErr" style="min-height:18px;font-size:11.5px;font-weight:800;color:#FCA5A5;margin-bottom:8px"></div>
        <button class="btnP" onclick="admin2faVerify()" style="width:100%">✅ Confirm</button>
      `;
      _admin2faRenderQR(d.otpauthUri);
      setTimeout(()=>document.getElementById('admin2faCode')?.focus(), 100);
    }catch(e){
      body.innerHTML = `<div style="padding:30px 12px;color:#FCA5A5;font-size:13px">${esc(e?.message || 'Could not start 2FA setup')}</div>`;
    }
  }

  // ── Admin Analytics Dashboard ────────────────────────────────────
  async function showAnalytics(){
    _ensureTitleStyles();
    const old=document.getElementById('anaOv'); if(old) old.remove();
    const ov=document.createElement('div'); ov.id='anaOv'; ov.className='tt-ov';
    ov.innerHTML=`<div class="tt-panel"><button class="tt-x" onclick="document.getElementById('anaOv').remove()">×</button>
      <div class="tt-eyebrow">📊 ADMIN</div><div class="tt-title">Analytics</div>
      <div id="anaBody" class="tt-empty">Loading…</div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) ov.remove(); });
    try{
      const d=await apiFetch('/api/admin/analytics');
      const card=(n,l)=>`<div class="tt-stat"><div class="tt-stat-n">${(typeof n==='number'?n.toLocaleString():n)}</div><div class="tt-stat-l">${l}</div></div>`;
      const grid=(items)=>`<div class="tt-stats" style="grid-template-columns:repeat(2,1fr)">${items.join('')}</div>`;
      document.getElementById('anaBody').outerHTML=`<div id="anaBody">
        <div class="tt-sec">👥 PLAYERS</div>
        ${grid([card(d.users.total,'Total'),card(d.users.online,'🟢 Online now'),card(d.users.registered,'Registered'),card(d.users.guests,'Guests'),card(d.users.newToday,'🆕 New today'),card(d.games.liveRooms,'🏠 Live rooms')])}
        <div class="tt-sec">📈 ACTIVE USERS</div>
        ${grid([card(d.activity.dau,'DAU (24h)'),card(d.activity.wau,'WAU (7d)'),card(d.activity.mau,'MAU (30d)'),card(d.activity.stickiness+'%','Stickiness')])}
        <div class="tt-sec">🎮 GAMES</div>
        ${grid([card(d.games.playerGames,'Player-games'),card(d.games.wins,'Total wins')])}
        <div class="tt-sec">💰 ECONOMY</div>
        ${grid([card(d.economy.coinsInCirculation,'🪙 Coins'),card(d.economy.diamondsInCirculation,'💎 Diamonds'),card(d.economy.premiumPasses,'👑 Premium passes'),card(d.economy.titlesEarned,'🏅 Titles earned')])}
        <div style="text-align:center;font-size:10px;color:rgba(255,255,255,.4);margin-top:14px">Snapshot · ${new Date(d.generatedAt).toLocaleString()}<br>True retention/revenue need MongoDB time-series (connection pending).</div>
      </div>`;
    }catch(e){
      const b=document.getElementById('anaBody'); if(b) b.innerHTML='<div class="tt-empty">Could not load (admin only). Restart the server?</div>';
    }
  }
  window.showAnalytics=showAnalytics;

  // Render the QR client-side via the well-known qrcode-generator
  // library from cdn.jsdelivr.net (allowlisted in our CSP). Loaded
  // once and cached; falls back to a "scan the secret manually" hint
  // if the CDN is blocked.
  function _admin2faRenderQR(uri){
    const host = document.getElementById('admin2faQR');
    if(!host) return;
    const renderInto = () => {
      try{
        const qr = window.qrcode(0, 'M');
        qr.addData(uri);
        qr.make();
        host.innerHTML = qr.createImgTag(4, 4);
      }catch(e){
        host.innerHTML = '<div style="color:#000;font-size:11px;padding:8px">Use the secret below instead</div>';
      }
    };
    if(window.qrcode){ renderInto(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
    s.async = true;
    s.onload = renderInto;
    s.onerror = () => {
      host.innerHTML = '<div style="color:#000;font-size:11px;padding:8px">QR script blocked — use the secret below.</div>';
    };
    document.head.appendChild(s);
  }

  async function admin2faVerify(){
    const code = document.getElementById('admin2faCode')?.value.trim();
    const errEl = document.getElementById('admin2faErr');
    if(!code){ if(errEl) errEl.textContent = 'Enter the 6-digit code.'; return; }
    try{
      const d = await api('POST','/admin/2fa/verify',{ code });
      if(d?.success){
        const body = document.getElementById('admin2faBody');
        body.innerHTML = `
          <div style="font-size:22px;color:#4ade80;margin-bottom:8px;font-family:'Bangers',cursive;letter-spacing:1.5px">✅ 2FA ENABLED</div>
          <div style="font-size:12.5px;color:rgba(255,255,255,.75);line-height:1.55;margin-bottom:14px">
            <b style="color:#FBBF24">Save these backup codes</b> somewhere safe. Each one works <b>once</b> in place of your authenticator app — use them if you lose your phone.
            <br><br>You will <b>NOT</b> see them again.
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;font-family:monospace;font-size:13px;background:rgba(0,0,0,.45);padding:12px;border-radius:10px;color:#FFE9B0;letter-spacing:1.5px;margin-bottom:14px">
            ${(d.backupCodes||[]).map(c=>`<div>${esc(c)}</div>`).join('')}
          </div>
          <button class="btnP" onclick="admin2faClose()" style="width:100%">I've saved them — close</button>
        `;
        // Logout-to-relogin nudge — the current JWT doesn't carry the
        // adm2fa claim yet (since 2FA was just turned ON). Show a banner
        // explaining the admin needs to log out and back in.
        toast('🔐 2FA enabled. Log out + back in to refresh your session.','s');
      }
    }catch(e){
      if(errEl) errEl.textContent = e?.message || 'Verification failed';
    }
  }

  function admin2faClose(){
    document.getElementById('admin2faOv')?.classList.remove('show');
    admin2faRefreshStatus();
  }

  async function admin2faOpenDisable(){
    const ov = document.getElementById('admin2faOv');
    const body = document.getElementById('admin2faBody');
    if(!ov || !body) return;
    body.innerHTML = `
      <div style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.55;margin-bottom:14px">
        Disabling 2FA requires <b>both</b> your password and a current authenticator code. This prevents anyone with a stolen session from turning off the second factor.
      </div>
      <input id="admin2faDisPwd" type="password" placeholder="Your password"
             style="width:100%;padding:12px 14px;background:rgba(0,0,0,.45);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-family:'Outfit',sans-serif;font-size:14px;outline:none;margin-bottom:8px"/>
      <input id="admin2faDisCode" inputmode="numeric" maxlength="6" placeholder="6-digit code"
             style="width:100%;padding:12px 14px;background:rgba(0,0,0,.45);border:1.5px solid rgba(251,191,36,.3);border-radius:10px;color:#FFE9B0;font-family:'Outfit',sans-serif;font-size:18px;font-weight:900;letter-spacing:4px;text-align:center;outline:none;margin-bottom:10px"/>
      <div id="admin2faErr" style="min-height:18px;font-size:11.5px;font-weight:800;color:#FCA5A5;margin-bottom:8px"></div>
      <button class="btnP" onclick="admin2faConfirmDisable()" style="width:100%;background:linear-gradient(135deg,#E8324A,#991B1B)">⚠️ Disable 2FA</button>
    `;
    ov.classList.add('show');
  }

  async function admin2faConfirmDisable(){
    const password = document.getElementById('admin2faDisPwd')?.value;
    const code = document.getElementById('admin2faDisCode')?.value.trim();
    const errEl = document.getElementById('admin2faErr');
    if(!password || !code){ if(errEl) errEl.textContent = 'Both password and code are required.'; return; }
    try{
      const d = await api('POST','/admin/2fa/disable',{ password, code });
      if(d?.success){
        toast('🔓 2FA disabled', 'i');
        admin2faClose();
      }
    }catch(e){
      if(errEl) errEl.textContent = e?.message || 'Could not disable';
    }
  }

  // ── Audit log viewer ─────────────────────────────────────────────
  async function adminOpenAuditLog(){
    const ov = document.getElementById('adminAuditOv');
    const body = document.getElementById('adminAuditBody');
    if(!ov || !body) return;
    body.innerHTML = `<div style="padding:20px;color:rgba(255,255,255,.5)">Loading…</div>`;
    ov.classList.add('show');
    try{
      const d = await api('GET','/admin/audit?limit=200');
      if(!d?.audit?.length){
        body.innerHTML = `<div style="padding:30px 12px;text-align:center;color:rgba(255,255,255,.55)">No audit entries yet.</div>`;
        return;
      }
      const ago = (ts) => {
        const diff = Date.now() - ts;
        if(diff < 60_000) return 'just now';
        if(diff < 3_600_000) return Math.floor(diff/60_000)+'m ago';
        if(diff < 86_400_000) return Math.floor(diff/3_600_000)+'h ago';
        return Math.floor(diff/86_400_000)+'d ago';
      };
      const isDenied = (action) => /\.denied$/.test(action);
      body.innerHTML = `
        <div style="font-size:10px;font-weight:800;letter-spacing:1.2px;color:rgba(255,255,255,.45);text-transform:uppercase;margin-bottom:6px">Source: ${esc(d.source||'?')} · ${d.audit.length} of ${d.total}</div>
        ${d.audit.map(e => `
          <div style="display:flex;gap:10px;padding:9px 10px;background:rgba(255,255,255,.03);border:1px solid ${isDenied(e.action) ? 'rgba(232,50,74,.35)' : 'rgba(255,255,255,.05)'};border-radius:8px;margin-bottom:5px">
            <div style="flex:0 0 76px;font-size:10px;color:rgba(255,255,255,.45);line-height:1.3">${esc(ago(e.at))}<br/><span style="opacity:.5">${esc(new Date(e.at).toLocaleString())}</span></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:900;color:${isDenied(e.action) ? '#FCA5A5' : '#FBBF24'};letter-spacing:.3px">${esc(e.action)}</div>
              <div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:2px">by <b>${esc(e.actorName || e.actor || 'anonymous')}</b> · ${esc(e.ip || '-')}</div>
              ${e.details && Object.keys(e.details).length ? `<div style="font-family:monospace;font-size:10.5px;color:rgba(255,255,255,.55);margin-top:4px;white-space:pre-wrap;word-break:break-all">${esc(JSON.stringify(e.details))}</div>` : ''}
            </div>
          </div>
        `).join('')}
      `;
    }catch(e){
      body.innerHTML = `<div style="padding:30px 12px;color:#FCA5A5">${esc(e?.message || 'Could not load audit log')}</div>`;
    }
  }

  // Expose for inline onclick handlers.
  window.admin2faOpenSetup     = admin2faOpenSetup;
  window.admin2faVerify        = admin2faVerify;
  window.admin2faClose         = admin2faClose;
  window.admin2faConfirmDisable= admin2faConfirmDisable;
  window.adminOpenAuditLog     = adminOpenAuditLog;

  // Admin endpoints — auth via the regular JWT bearer token. The server
  // checks user.isAdmin on the authenticated user, so there is no client-
  // side secret to leak. The previous "secret" parameter has been
  // removed entirely.
  async function adminCreateTournament(){
    const name = document.getElementById('adminTName').value.trim() || 'Cardora Championship';
    const maxPlayers = parseInt(document.getElementById('adminTMax').value) || 8;
    const prizeCoins = parseInt(document.getElementById('adminTPrize').value) || 5000;
    try{
      const d = await apiFetch('/api/tournament/create', {
        method:'POST',
        body: JSON.stringify({ name, maxPlayers, prizeCoins })
      });
      if(d?.error) return toast(d.error,'e');
      toast(`Tournament "${d.tournament.name}" created! 🏆`,'s');
      document.getElementById('adminOv').classList.remove('show');
    } catch(e){ toast(e?.message || 'Error creating tournament','e'); }
  }

  async function adminStartTournament(){
    const id = document.getElementById('adminTId').value.trim();
    if(!id) return toast('Enter tournament ID','e');
    try{
      const d = await apiFetch(`/api/tournaments/${id}/start`, {
        method:'POST',
        body: JSON.stringify({})
      }).catch(err=>({error:err.message}));
      if(d?.error) return toast(d.error,'e');
      toast('Tournament started! ⚔️','s');
    } catch(e){ toast('Error','e'); }
  }

  // Multi-board leaderboard: Global · Morocco · Weekly · Monthly · All-Time.
  // ── Leaderboard AS A PROFILE SECTION ────────────────────────────
  // Same boards + row markup as the standalone modal (reuses the .lb-*
  // styles) but with its own element refs so the two can never fight over
  // duplicate ids. Board choice is remembered per profile visit.
  let _plbBoard = 'global';
  async function renderProfileLeaderboard(section){
    _ensureLbStyles();
    const boards = [['global','🌍 Global'],['morocco','🇲🇦 Morocco'],['weekly','📅 Weekly'],['monthly','🗓️ Monthly'],['alltime','♾️ All-Time']];
    section.innerHTML = `
      <div class="psec-head">
        <div class="psec-eyebrow">TOP PLAYERS</div>
        <div class="psec-title">Leaderboard</div>
      </div>
      <div class="lb-tabs" id="plbTabs">
        ${boards.map(([id,lbl])=>`<button class="lb-tab ${id===_plbBoard?'on':''}" data-board="${id}">${lbl}</button>`).join('')}
      </div>
      <div id="plbList"><div class="lb-load">Loading…</div></div>`;
    section.querySelectorAll('#plbTabs .lb-tab').forEach(btn => {
      btn.onclick = () => {
        _plbBoard = btn.dataset.board;
        section.querySelectorAll('#plbTabs .lb-tab').forEach(b => b.classList.toggle('on', b.dataset.board === _plbBoard));
        _loadProfileBoard();
      };
    });
    await _loadProfileBoard();
  }

  async function _loadProfileBoard(){
    const list = document.getElementById('plbList');
    if(!list) return;
    list.innerHTML = '<div class="lb-load">Loading…</div>';
    try{
      const d = await apiFetch('/api/leaderboard/board?type=' + _plbBoard, { timeout: 8000 });
      const unit = d.metric === 'wins' ? 'W' : 'pts';
      if(!d.entries?.length){
        list.innerHTML = '<div class="lb-empty">No players ranked here yet — play to climb! 🚀</div>';
        return;
      }
      list.innerHTML = d.entries.map(p => {
        const rc = p.rank===1?'gold':p.rank===2?'silver':p.rank===3?'bronze':'normal';
        const medal = p.rank===1?'👑':p.rank===2?'🥈':p.rank===3?'🥉':'';
        const isImg = p.avatar && /^(\/|data:|https?:)/.test(p.avatar);
        const av = isImg ? `<span class="lb-av" style="background-image:url('${p.avatar}')"></span>`
                         : `<span class="lb-av lb-av-txt">${esc((p.username||'?').charAt(0).toUpperCase())}</span>`;
        const tier = p.tier ? `<div class="lb-tier" style="color:${p.tier.color}">${p.tier.badge} ${esc(p.tier.name)}</div>` : '';
        const click = p.id ? ` onclick="showOpponentProfile('${esc(p.id)}')" style="cursor:pointer" title="View ${esc(p.username)}'s profile"` : '';
        return `<div class="lb-row ${p.isMe?'lb-me':''}"${click}>
          <div class="lb-rank ${rc}">${medal||p.rank}</div>
          ${av}
          <div class="lb-name">${esc(p.username)}${verifiedBadgeHTML(p.username,{isBot:p.isBot,size:'xs'})}${p.isMe?' <span class="lb-you">(YOU)</span>':''}${tier}</div>
          <div class="lb-val">${(p.value||0).toLocaleString()} ${unit}</div>
        </div>`;
      }).join('');
      if(d.me && d.me.rank && d.me.rank > 50){
        list.innerHTML += `<div class="lb-row lb-me lb-me-sticky">
          <div class="lb-rank normal">${d.me.rank}</div>
          <span class="lb-av lb-av-txt">${esc((S.user?.username||'?').charAt(0).toUpperCase())}</span>
          <div class="lb-name">You <span class="lb-you">(YOU)</span></div>
          <div class="lb-val">${(d.me.value||0).toLocaleString()} ${unit}</div>
        </div>`;
      }
    }catch(e){
      list.innerHTML = '<div class="lb-empty">Could not load the leaderboard — check your connection and retry.</div>';
    }
  }

  let _lbBoard='global';
  async function showLeaderboard(){
    _ensureLbTabs();
    document.getElementById('lbOv').classList.add('show');
    _loadBoard();
  }
  function _ensureLbTabs(){
    const box=document.querySelector('#lbOv .lb-box'); if(!box) return;
    _ensureLbStyles();
    if(document.getElementById('lbTabs')) return;
    const list=document.getElementById('lbList');
    const tabs=document.createElement('div'); tabs.id='lbTabs'; tabs.className='lb-tabs';
    const boards=[['global','🌍 Global'],['morocco','🇲🇦 Morocco'],['weekly','📅 Weekly'],['monthly','🗓️ Monthly'],['alltime','♾️ All-Time']];
    tabs.innerHTML=boards.map(([id,lbl])=>`<button class="lb-tab ${id===_lbBoard?'on':''}" data-board="${id}" onclick="switchLbBoard('${id}')">${lbl}</button>`).join('');
    box.insertBefore(tabs, list);
  }
  function switchLbBoard(b){
    _lbBoard=b;
    document.querySelectorAll('#lbTabs .lb-tab').forEach(x=>x.classList.toggle('on', x.dataset.board===b));
    _loadBoard();
  }
  async function _loadBoard(){
    const list=document.getElementById('lbList'); if(!list) return;
    list.innerHTML='<div class="lb-load">Loading…</div>';
    try{
      const d=await apiFetch('/api/leaderboard/board?type='+_lbBoard);
      const unit=d.metric==='wins'?'W':'pts';
      if(!d.entries.length){ list.innerHTML='<div class="lb-empty">No players ranked here yet — play to climb! 🚀</div>'; return; }
      list.innerHTML=d.entries.map(p=>{
        const rc=p.rank===1?'gold':p.rank===2?'silver':p.rank===3?'bronze':'normal';
        const medal=p.rank===1?'👑':p.rank===2?'🥈':p.rank===3?'🥉':'';
        const isImg=p.avatar&&/^(\/|data:|https?:)/.test(p.avatar);
        const av=isImg?`<span class="lb-av" style="background-image:url('${p.avatar}')"></span>`
                      :`<span class="lb-av lb-av-txt">${esc((p.username||'?').charAt(0).toUpperCase())}</span>`;
        const tier=p.tier?`<div class="lb-tier" style="color:${p.tier.color}">${p.tier.badge} ${esc(p.tier.name)}</div>`:'';
        const clickAttr = p.id ? ` onclick="showOpponentProfile('${esc(p.id)}')" style="cursor:pointer" title="View ${esc(p.username)}'s profile"` : '';
        return `<div class="lb-row ${p.isMe?'lb-me':''}"${clickAttr}>
          <div class="lb-rank ${rc}">${medal||p.rank}</div>
          ${av}
          <div class="lb-name">${esc(p.username)}${verifiedBadgeHTML(p.username,{isBot:p.isBot,size:'xs'})}${p.isMe?' <span class="lb-you">(YOU)</span>':''}${tier}</div>
          <div class="lb-val">${(p.value||0).toLocaleString()} ${unit}</div>
        </div>`;
      }).join('');
      if(d.me && d.me.rank && d.me.rank>50){
        list.innerHTML+=`<div class="lb-row lb-me lb-me-sticky">
          <div class="lb-rank normal">${d.me.rank}</div>
          <span class="lb-av lb-av-txt">${esc((S.user?.username||'?').charAt(0).toUpperCase())}</span>
          <div class="lb-name">You <span class="lb-you">(YOU)</span></div>
          <div class="lb-val">${(d.me.value||0).toLocaleString()} ${unit}</div>
        </div>`;
      }
    }catch(e){ list.innerHTML='<div class="lb-empty">Could not load — restart the server, then retry.</div>'; }
  }
  window.switchLbBoard=switchLbBoard;
  function _ensureLbStyles(){
    if(document.getElementById('lbTabsStyles')) return;
    const s=document.createElement('style'); s.id='lbTabsStyles';
    s.textContent=`
      .lb-tabs{ display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin:4px 0 10px; }
      .lb-tab{ padding:7px 12px; border-radius:99px; cursor:pointer; font-family:inherit; font-weight:800; font-size:11px;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:rgba(255,255,255,.65); transition:all .15s; }
      .lb-tab.on{ background:linear-gradient(135deg,#FBBF24,#D97706); color:#1a1a1a; border-color:transparent; }
      .lb-online{ text-align:center; font-size:11px; font-weight:700; color:rgba(255,255,255,.55); margin-bottom:8px; }
      .lb-online b{ color:#22C55E; }
      .lb-av{ width:32px; height:32px; border-radius:50%; flex:0 0 auto; background-size:cover; background-position:center;
        display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.15); box-shadow:0 2px 6px rgba(0,0,0,.4); }
      .lb-av-txt{ font-family:'Bangers',cursive; font-weight:900; color:#FFE9B0; font-size:14px; background:linear-gradient(135deg,#3a4170,#141826); }
      .lb-tier{ font-size:9.5px; font-weight:700; margin-top:1px; letter-spacing:.3px; }
      .lb-val{ font-family:'Bangers',cursive; font-weight:900; color:#FFE9B0; font-size:15px; letter-spacing:.5px; text-align:right; white-space:nowrap;
        text-shadow:0 1px 3px rgba(180,83,9,.6), 0 0 10px rgba(251,191,36,.3); }
      .lb-me{ background:rgba(251,191,36,.12) !important; border:1px solid rgba(251,191,36,.4) !important; }
      .lb-you{ color:#FBBF24; font-size:9px; font-weight:900; }
      .lb-load,.lb-empty{ text-align:center; color:rgba(255,255,255,.5); padding:30px 16px; font-weight:600; line-height:1.5; }
      .lb-me-sticky{ margin-top:10px; position:sticky; bottom:0; }
    `;
    document.head.appendChild(s);
  }
  async function doInsta(){
    window.open('https://www.instagram.com/mustapha_elmway?igsh=MWM3b2VlZzRlY2R0aw%3D%3D&utm_source=qr','_blank');
    setTimeout(async()=>{
      try{const d=await api('POST','/coins/insta-reward');S.user.coins=d.coins;localStorage.setItem('uno_user',JSON.stringify(S.user));goLobby();toast(`📸 +${d.earned} coins! Thanks for following!`,'s');}
      catch(e){toast(e.message,'w');}
    },3000);
  }
  function doMM(){
    S.socket.emit('matchmaking:join',{},(res)=>{
      if(res.success){
        document.getElementById('mmcnt').textContent=`${res.queueSize} ${t('inQueue')}`;
        _openMatchmaking();
      }
    });
  }
  function _mmReduced(){ return matchMedia('(prefers-reduced-motion:reduce)').matches; }
  function _openMatchmaking(){
    const ov=document.getElementById('mmov'); if(!ov) return;
    ov.classList.add('show');
    const g=window.gsap;
    if(g && !_mmReduced()){
      // Cinematic camera push — the lobby drops back into depth
      g.to('#lobby-screen',{scale:1.12,opacity:.35,duration:.75,ease:'power2.in',transformOrigin:'50% 44%'});
      g.fromTo(ov,{opacity:0},{opacity:1,duration:.3,ease:'power1.out'});
      g.fromTo('.mm-radar',{scale:.45,opacity:0},{scale:1,opacity:1,duration:.7,ease:'back.out(1.7)',delay:.12});
      g.fromTo(['.mm-title','.mm-sub','.mm-hint','.mm-cancel'],
        {y:26,opacity:0},{y:0,opacity:1,duration:.5,stagger:.08,ease:'power3.out',delay:.22});
    }
  }
  function _resetLobbyCamera(){
    const g=window.gsap;
    if(g) g.set('#lobby-screen',{clearProps:'transform,opacity'});
    else { const ls=document.getElementById('lobby-screen'); if(ls){ls.style.transform='';ls.style.opacity='';} }
  }
  function _closeMatchmaking(){
    const ov=document.getElementById('mmov'); if(!ov) return;
    const g=window.gsap;
    if(g && !_mmReduced()){
      g.to('#lobby-screen',{scale:1,opacity:1,duration:.5,ease:'power2.out',clearProps:'transform,opacity'});
      g.to(ov,{opacity:0,duration:.3,ease:'power1.in',onComplete:()=>{ov.classList.remove('show');g.set(ov,{clearProps:'opacity'});}});
    } else {
      ov.classList.remove('show'); _resetLobbyCamera();
    }
  }
  function doLeaveMM(){ S.socket.emit('matchmaking:leave',{}); _closeMatchmaking(); }

