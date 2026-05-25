  /* ═══════════════ BATTLE PASS ═══════════════ */
  const BP={ data:null };
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
      if(typeof d.coins==='number'){
        S.user.coins=d.coins; localStorage.setItem('uno_user',JSON.stringify(S.user));
        _animateCount('hcoins',d.coins);
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
        background:radial-gradient(ellipse at 50% 35%,rgba(40,22,8,.7),rgba(3,4,12,.97));
        backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);animation:bpIn .3s ease;}
      #bpModal.out{animation:bpOut .22s ease forwards;}
      .bp-panel{position:relative;width:min(940px,97vw);max-height:92vh;overflow:hidden;
        display:flex;flex-direction:column;
        background:linear-gradient(180deg,rgba(30,26,48,.98),rgba(14,12,26,.99));
        border:1px solid rgba(255,215,0,.18);border-radius:24px;
        box-shadow:0 50px 120px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.06);}
      .bp-aura{position:absolute;left:50%;top:0;width:80%;height:300px;transform:translate(-50%,-50%);
        background:radial-gradient(ellipse,rgba(245,158,11,.3),transparent 70%);filter:blur(40px);
        pointer-events:none;animation:bpAura 6s ease-in-out infinite;}
      .bp-loading{padding:70px;text-align:center;color:rgba(255,255,255,.6);font-weight:700;
        display:flex;flex-direction:column;align-items:center;gap:14px;}
      .bp-spin{width:36px;height:36px;border-radius:50%;border:3px solid rgba(255,255,255,.1);border-top-color:#F59E0B;animation:bpSpin .8s linear infinite;}
      .bp-head{position:relative;z-index:1;display:flex;align-items:center;gap:18px;padding:20px 24px 14px;flex-wrap:wrap;}
      .bp-season-name{font-family:'Bangers',cursive;font-size:26px;letter-spacing:1.5px;
        background:linear-gradient(180deg,#FFF7E0,#F59E0B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
      .bp-season-timer{font-size:11px;font-weight:800;color:#FFB87A;letter-spacing:.5px;margin-top:2px;}
      .bp-lvlwrap{display:flex;align-items:center;gap:12px;margin-left:auto;}
      .bp-lvl{width:54px;height:54px;flex-shrink:0;border-radius:14px;display:flex;align-items:center;justify-content:center;
        font-family:'Bangers',cursive;font-size:26px;color:#1a0e04;
        background:linear-gradient(135deg,#FFD700,#F59E0B);box-shadow:0 6px 18px rgba(245,158,11,.5),inset 0 1px 0 rgba(255,255,255,.5);}
      .bp-xp{width:210px;max-width:42vw;}
      .bp-xp-top{display:flex;justify-content:space-between;font-size:9.5px;font-weight:800;letter-spacing:.8px;color:rgba(255,255,255,.6);margin-bottom:5px;}
      .bp-xp-bar{height:10px;border-radius:8px;background:rgba(0,0,0,.4);overflow:hidden;border:1px solid rgba(255,255,255,.07);}
      .bp-xp-fill{height:100%;border-radius:8px;background:linear-gradient(90deg,#F59E0B,#FFD700);box-shadow:0 0 12px rgba(245,158,11,.6);}
      .bp-close{width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:22px;line-height:1;
        background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.75);
        font-family:inherit;transition:all .2s;}
      .bp-close:hover{background:rgba(232,50,74,.22);border-color:rgba(232,50,74,.5);color:#fff;transform:rotate(90deg);}
      .bp-prem-cta{position:relative;z-index:1;display:flex;align-items:center;gap:14px;margin:4px 24px 6px;
        padding:12px 16px;border-radius:14px;
        background:linear-gradient(135deg,rgba(245,158,11,.2),rgba(124,58,237,.12));
        border:1px solid rgba(245,158,11,.4);}
      .bp-prem-cta-txt{flex:1;display:flex;flex-direction:column;gap:2px;}
      .bp-prem-cta-txt b{font-size:14px;color:#fff;}
      .bp-prem-cta-txt span{font-size:11px;color:rgba(255,255,255,.6);font-weight:600;}
      .bp-prem-btn{padding:11px 20px;border:none;border-radius:11px;cursor:pointer;
        background:linear-gradient(135deg,#FFD700,#F59E0B);color:#1a0e04;
        font-family:'Outfit',sans-serif;font-size:13px;font-weight:900;letter-spacing:.5px;
        box-shadow:0 6px 18px rgba(245,158,11,.45);transition:all .2s cubic-bezier(.34,1.56,.64,1);}
      .bp-prem-btn:hover{transform:translateY(-2px) scale(1.04);filter:brightness(1.08);}
      .bp-prem-on{margin:4px 24px 6px;padding:10px;border-radius:12px;text-align:center;
        font-size:12px;font-weight:800;letter-spacing:.5px;color:#FFD700;
        background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);}
      .bp-tracklabels{display:flex;flex-direction:column;gap:74px;position:absolute;left:8px;top:128px;z-index:2;pointer-events:none;}
      .bp-tl{font-size:8px;font-weight:900;letter-spacing:1px;writing-mode:vertical-rl;transform:rotate(180deg);
        color:rgba(255,255,255,.3);}
      .bp-tl.prem{color:rgba(245,158,11,.6);}
      .bp-track{display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;padding:14px 24px 22px;
        scrollbar-width:thin;scrollbar-color:rgba(245,158,11,.4) transparent;}
      .bp-track::-webkit-scrollbar{height:7px;}
      .bp-track::-webkit-scrollbar-thumb{background:rgba(245,158,11,.4);border-radius:7px;}
      .bp-col{flex-shrink:0;width:94px;display:flex;flex-direction:column;align-items:center;gap:9px;}
      .bp-col.current .bp-tier{box-shadow:0 0 0 3px #FFD700,0 0 22px rgba(245,158,11,.7);transform:scale(1.12);}
      .bp-tier{position:relative;width:36px;height:36px;border-radius:50%;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
        font-family:'Bangers',cursive;font-size:18px;color:rgba(255,255,255,.5);
        background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.1);transition:all .3s;}
      .bp-tier.on{color:#1a0e04;background:linear-gradient(135deg,#FFD700,#F59E0B);border-color:transparent;}
      .bp-tier::before{content:'';position:absolute;right:100%;width:14px;height:4px;background:rgba(255,255,255,.08);}
      .bp-tier.on::before{background:linear-gradient(90deg,#F59E0B,#FFD700);}
      .bp-col:first-child .bp-tier::before{display:none;}
      .bp-rw{position:relative;width:88px;height:90px;border-radius:13px;cursor:default;overflow:hidden;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
        background:linear-gradient(165deg,rgba(255,255,255,.06),rgba(0,0,0,.25));
        border:1.5px solid var(--rc,rgba(255,255,255,.12));
        transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;}
      .bp-rw.r-common{--rc:#9CA3AF;}
      .bp-rw.r-rare{--rc:#3B82F6;}
      .bp-rw.r-epic{--rc:#A855F7;}
      .bp-rw.r-legendary{--rc:#F59E0B;}
      .bp-rw.prem{background:linear-gradient(165deg,color-mix(in srgb,var(--rc) 24%,rgba(40,28,6,.6)),rgba(20,12,4,.7));}
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
      box.innerHTML=friends.map(f=>{
        const img=_isImgAvatar(f.avatar);
        const face=img?'':esc(f.avatar||(f.username||'?').charAt(0).toUpperCase());
        return `<div class="rail-friend">
          <div class="rail-friend-av ${f.isOnline?'':'off'}" style="${img?`background-image:url('${f.avatar}')`:''}">${face}</div>
          <div class="rail-friend-info">
            <div class="rail-friend-name">${esc(f.username)}</div>
            <div class="rail-friend-status ${f.isOnline?'':'off'}">${f.isOnline?'● Online':'Offline'}</div>
          </div>
        </div>`;
      }).join('');
    }catch(e){
      box.innerHTML=`<div class="rail-empty">Couldn't load friends</div>`;
    }
  }
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
        <div class="rtable-felt"><div class="rtable-center"><div class="rtable-unocard">UNO</div></div></div>
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

  // ── Cinematic Arena Setup ───────────────────────────────────────────────
  // Replaces the old bet picker with a full-screen "forge your arena" flow.
  // Returns: { bet, maxPlayers, isPrivate } or null on cancel.
  function showArenaSetup(){
    return new Promise(resolve=>{
      const old=document.getElementById('arena-setup');if(old)old.remove();
      _ensureArenaStyles();

      const cfg = { maxPlayers:4, bet:1000, isPrivate:false, invites:[] };
      const userCoins = S.user?.coins || 0;

      // Stake tiers — rarity tiers like a card game
      const tiers = [
        {val:100,    name:'STARTER', rarity:'a_rCommon',    color:'#9CA3AF', glow:'rgba(156,163,175,.55)',  icon:'🪙'},
        {val:500,    name:'BRONZE',  rarity:'a_rCommon',    color:'#D97706', glow:'rgba(217,119,6,.55)',    icon:'🥉'},
        {val:2000,   name:'SILVER',  rarity:'a_rRare',      color:'#D1D5DB', glow:'rgba(209,213,219,.6)',   icon:'🥈'},
        {val:8000,   name:'GOLD',    rarity:'a_rEpic',      color:'#FBBF24', glow:'rgba(251,191,36,.7)',    icon:'🥇'},
        {val:25000,  name:'DIAMOND', rarity:'a_rLegendary', color:'#67E8F9', glow:'rgba(103,232,249,.75)',  icon:'💎'},
        {val:100000, name:'MYTHIC',  rarity:'a_rMythic',    color:'#F472B6', glow:'rgba(244,114,182,.85)',  icon:'👑'}
      ];

      // Floating decorative cards in background
      const deco = ['#E8324A','#F59E0B','#16A34A','#2563EB','#9333EA','#E8324A','#F59E0B'].map((c,i)=>`
        <div class="arena-deco-card" style="
          --c:${c};
          left:${[8,18,72,82,15,68,40][i]}%;
          top:${[12,68,18,72,42,38,8][i]}%;
          animation-delay:${i*-2.3}s;
          animation-duration:${14+i*1.7}s;
          transform:rotate(${[-12,18,-25,14,-8,22,-30][i]}deg);
        "></div>
      `).join('');

      const ov = document.createElement('div');
      ov.id = 'arena-setup';
      ov.innerHTML = `
        <div class="arena-bg">${deco}<div class="arena-vignette"></div></div>
        <div class="arena-panel" role="dialog" aria-label="Create Room">
          <button class="arena-close" aria-label="Close">×</button>

          <div class="arena-header">
            <div class="arena-eyebrow">⚔️  ${t('a_eyebrow')}  ⚔️</div>
            <div class="arena-title">${t('a_title')}</div>
            <div class="arena-sub">${t('a_sub')}</div>
          </div>

          <div class="arena-coins">
            <span class="arena-coin-icon">🪙</span>
            <span class="arena-coin-val">${userCoins.toLocaleString()}</span>
            <span class="arena-coin-lbl">${t('a_vault')}</span>
          </div>

          <!-- PLAYERS -->
          <div class="arena-section">
            <div class="arena-section-head">
              <div class="arena-section-num">01</div>
              <div>
                <div class="arena-section-title">${t('a_fighters')}</div>
                <div class="arena-section-sub">${t('a_fightersSub')}</div>
              </div>
            </div>
            <div class="arena-players-grid">
              ${[2,3,4].map(n=>`
                <button class="arena-pcard ${n===4?'on':''}" data-players="${n}">
                  <div class="arena-pcard-slots">
                    ${Array.from({length:n}).map((_,i)=>`<div class="arena-pslot" style="--i:${i}"></div>`).join('')}
                  </div>
                  <div class="arena-pcard-num">${n}</div>
                  <div class="arena-pcard-lbl">${n===2?t('a_duel'):n===3?t('a_triple'):t('a_squad')}</div>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- STAKE -->
          <div class="arena-section">
            <div class="arena-section-head">
              <div class="arena-section-num">02</div>
              <div>
                <div class="arena-section-title">${t('a_stake')}</div>
                <div class="arena-section-sub">${t('a_stakeSub')}</div>
              </div>
            </div>
            <div class="arena-tiers">
              ${tiers.map((t2,i)=>{
                const tooExpensive = t2.val > userCoins;
                const selected = t2.val === cfg.bet;
                return `
                <button class="arena-tier ${selected?'on':''} ${tooExpensive?'locked':''}"
                  data-bet="${t2.val}"
                  style="--tier-color:${t2.color};--tier-glow:${t2.glow}">
                  <div class="arena-tier-shine"></div>
                  <div class="arena-tier-icon">${t2.icon}</div>
                  <div class="arena-tier-name">${t2.name}</div>
                  <div class="arena-tier-rarity">${t(t2.rarity)}</div>
                  <div class="arena-tier-val">${t2.val.toLocaleString()}</div>
                  ${tooExpensive?'<div class="arena-tier-lock">🔒</div>':''}
                </button>`;
              }).join('')}
            </div>
          </div>

          <!-- PRIVACY -->
          <div class="arena-section">
            <div class="arena-section-head">
              <div class="arena-section-num">03</div>
              <div>
                <div class="arena-section-title">${t('a_access')}</div>
                <div class="arena-section-sub">${t('a_accessSub')}</div>
              </div>
            </div>
            <div class="arena-privacy">
              <button class="arena-priv on" data-priv="0">
                <div class="arena-priv-icon">🌐</div>
                <div>
                  <div class="arena-priv-title">${t('a_public')}</div>
                  <div class="arena-priv-sub">${t('a_publicSub')}</div>
                </div>
              </button>
              <button class="arena-priv" data-priv="1">
                <div class="arena-priv-icon">🔐</div>
                <div>
                  <div class="arena-priv-title">${t('a_private')}</div>
                  <div class="arena-priv-sub">${t('a_privateSub')}</div>
                </div>
              </button>
            </div>
          </div>

          <!-- SQUAD -->
          <div class="arena-section">
            <div class="arena-section-head">
              <div class="arena-section-num">04</div>
              <div>
                <div class="arena-section-title">${t('a_squadTitle')}</div>
                <div class="arena-section-sub">${t('a_squadSub')}</div>
              </div>
            </div>
            <div class="arena-friends" id="arenaFriends">
              <div class="arena-friends-msg">${t('a_loadingFriends')}</div>
            </div>
          </div>

          <!-- ACTIONS -->
          <div class="arena-actions">
            <button class="arena-cancel">${t('cancel')}</button>
            <button class="arena-go">
              <span class="arena-go-shine"></span>
              <span class="arena-go-label">${t('a_enterArena')}</span>
              <span class="arena-go-arrow">→</span>
            </button>
          </div>
          <div class="arena-go-foot" id="arenaGoFoot">
            ${t('a_stake')}: <b id="arenaSummary">🪙 ${cfg.bet.toLocaleString()}</b>
            · <b id="arenaSummary2">${cfg.maxPlayers} ${t('a_players')}</b>
            · <b id="arenaSummary3">${t('a_public')}</b>
            · <b id="arenaSummary4">${t('a_random')}</b>
          </div>
        </div>
      `;
      document.body.appendChild(ov);

      // ── Wire interactions ──────────────────────────────────────
      const summary  = ov.querySelector('#arenaSummary');
      const summary2 = ov.querySelector('#arenaSummary2');
      const summary3 = ov.querySelector('#arenaSummary3');
      const summary4 = ov.querySelector('#arenaSummary4');
      const goBtn    = ov.querySelector('.arena-go');

      function syncSummary(){
        const tier = tiers.find(tt=>tt.val===cfg.bet);
        summary.textContent  = `${tier?tier.icon:'🪙'} ${cfg.bet.toLocaleString()}`;
        summary2.textContent = `${cfg.maxPlayers} ${cfg.maxPlayers>1?t('a_players'):t('a_player')}`;
        summary3.textContent = cfg.isPrivate ? t('a_private') : t('a_public');
        summary4.textContent = cfg.invites.length
          ? `${cfg.invites.length} ${cfg.invites.length>1?t('a_friendsInvited'):t('a_friendInvited')}`
          : t('a_random');
        const canAfford = cfg.bet <= userCoins;
        goBtn.classList.toggle('disabled', !canAfford);
        goBtn.querySelector('.arena-go-label').textContent = canAfford ? t('a_enterArena') : t('a_notEnough');
      }
      syncSummary();

      // ── Friends to invite (loaded async) ───────────────────────
      (async ()=>{
        const box = ov.querySelector('#arenaFriends');
        if(!box) return;
        try{
          const d = await api('GET','/friends');
          const friends = (d.friends||[]).slice()
            .sort((a,b)=>(b.isOnline?1:0)-(a.isOnline?1:0));
          if(!friends.length){
            box.innerHTML = `<div class="arena-friends-msg">${t('a_noFriends')}</div>`;
            return;
          }
          box.innerHTML = friends.map(f=>`
            <button class="arena-friend ${f.isOnline?'':'off'}" data-fid="${f.id}" ${f.isOnline?'':'disabled'}>
              <span class="arena-friend-dot ${f.isOnline?'on':''}"></span>
              <span class="arena-friend-name">${esc(f.username)}</span>
              <span class="arena-friend-state">${f.isOnline?t('a_online'):t('a_offline')}</span>
              <span class="arena-friend-check">✓</span>
            </button>`).join('');
          box.querySelectorAll('.arena-friend:not(.off)').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const fid = btn.dataset.fid;
              const i = cfg.invites.indexOf(fid);
              if(i>=0){ cfg.invites.splice(i,1); btn.classList.remove('on'); }
              else { cfg.invites.push(fid); btn.classList.add('on'); }
              syncSummary();
            });
          });
        }catch(e){
          box.innerHTML = `<div class="arena-friends-msg">${t('a_friendsErr')}</div>`;
        }
      })();

      // Player count
      ov.querySelectorAll('.arena-pcard').forEach(btn=>{
        btn.addEventListener('click',()=>{
          ov.querySelectorAll('.arena-pcard').forEach(b=>b.classList.remove('on'));
          btn.classList.add('on');
          cfg.maxPlayers = parseInt(btn.dataset.players,10);
          syncSummary();
        });
      });

      // Stake tier
      ov.querySelectorAll('.arena-tier').forEach(btn=>{
        btn.addEventListener('click',()=>{
          if(btn.classList.contains('locked')) {
            btn.animate(
              [{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],
              {duration:300}
            );
            return;
          }
          ov.querySelectorAll('.arena-tier').forEach(b=>b.classList.remove('on'));
          btn.classList.add('on');
          cfg.bet = parseInt(btn.dataset.bet,10);
          syncSummary();
        });
      });

      // Privacy
      ov.querySelectorAll('.arena-priv').forEach(btn=>{
        btn.addEventListener('click',()=>{
          ov.querySelectorAll('.arena-priv').forEach(b=>b.classList.remove('on'));
          btn.classList.add('on');
          cfg.isPrivate = btn.dataset.priv === '1';
          syncSummary();
        });
      });

      // Close handlers
      function close(result){
        ov.classList.add('out');
        setTimeout(()=>{ ov.remove(); resolve(result); }, 250);
      }
      ov.querySelector('.arena-close').addEventListener('click',()=>close(null));
      ov.querySelector('.arena-cancel').addEventListener('click',()=>close(null));
      goBtn.addEventListener('click',()=>{
        if(goBtn.classList.contains('disabled')){
          toast(`Not enough coins! You have ${userCoins.toLocaleString()} 🪙`,'e');
          return;
        }
        close({ ...cfg });
      });
      // Escape closes
      const onKey = (e)=>{ if(e.key==='Escape'){ close(null); document.removeEventListener('keydown',onKey); } };
      document.addEventListener('keydown', onKey);
    });
  }

  function _ensureArenaStyles(){
    if(document.getElementById('arena-setup-styles')) return;
    const s = document.createElement('style');
    s.id = 'arena-setup-styles';
    s.textContent = `
      @keyframes arenaIn{from{opacity:0}to{opacity:1}}
      @keyframes arenaPanelIn{from{transform:translateY(40px) scale(.94);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
      @keyframes arenaOut{to{opacity:0;transform:scale(.96)}}
      @keyframes arenaFloat{
        0%,100%{transform:translateY(0) rotate(var(--rot,0deg))}
        50%{transform:translateY(-22px) rotate(calc(var(--rot,0deg) + 6deg))}
      }
      @keyframes arenaDecoDrift{
        0%{transform:translate(0,0) rotate(var(--rot,0deg));opacity:.0}
        15%{opacity:.18}
        50%{transform:translate(20px,-30px) rotate(calc(var(--rot,0deg) + 10deg));opacity:.22}
        85%{opacity:.16}
        100%{transform:translate(0,0) rotate(var(--rot,0deg));opacity:0}
      }
      @keyframes arenaSlotPulse{
        0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}
        50%{box-shadow:0 0 0 6px rgba(245,158,11,.18)}
      }
      @keyframes arenaShine{
        0%{transform:translateX(-120%) skewX(-20deg)}
        100%{transform:translateX(250%) skewX(-20deg)}
      }
      @keyframes arenaTierPop{
        0%{transform:translateY(0) scale(1)}
        50%{transform:translateY(-8px) scale(1.05)}
        100%{transform:translateY(-4px) scale(1.02)}
      }

      #arena-setup{
        position:fixed;inset:0;z-index:1000;
        background:radial-gradient(ellipse at center, rgba(40,18,8,.55) 0%, rgba(0,0,0,.92) 70%);
        backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
        display:flex;align-items:center;justify-content:center;
        animation:arenaIn .35s ease-out;
        overflow:hidden;padding:20px;
      }
      #arena-setup.out{animation:arenaOut .25s ease-out forwards}

      .arena-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none}
      .arena-deco-card{
        position:absolute;width:90px;height:130px;border-radius:14px;
        background:radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--c) 80%, white 0%), color-mix(in srgb, var(--c) 60%, black 40%));
        box-shadow:0 12px 40px rgba(0,0,0,.5), inset 0 0 0 2px rgba(255,255,255,.08);
        opacity:.18;
        animation:arenaDecoDrift 16s ease-in-out infinite;
      }
      .arena-deco-card::after{
        content:'';position:absolute;inset:18%;border-radius:50%;
        background:rgba(255,255,255,.08);
      }
      .arena-vignette{
        position:absolute;inset:0;
        background:radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.5) 100%);
      }

      .arena-panel{
        position:relative;z-index:2;
        width:min(720px, 95vw);max-height:92vh;overflow-y:auto;overflow-x:hidden;
        background:linear-gradient(180deg, rgba(28,32,57,.85), rgba(19,23,41,.95));
        border:1px solid rgba(255,255,255,.08);border-radius:24px;
        padding:30px 32px 26px;
        box-shadow:0 40px 100px rgba(0,0,0,.7), 0 0 0 1px rgba(245,158,11,.05), inset 0 1px 0 rgba(255,255,255,.06);
        animation:arenaPanelIn .5s cubic-bezier(.2,.9,.3,1.2);
        scrollbar-width:thin;scrollbar-color:rgba(245,158,11,.3) transparent;
      }
      .arena-panel::-webkit-scrollbar{width:5px}
      .arena-panel::-webkit-scrollbar-thumb{background:rgba(245,158,11,.3);border-radius:5px}

      .arena-close{
        position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;
        background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
        color:rgba(255,255,255,.7);font-size:22px;line-height:1;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        transition:all .2s;font-family:inherit;
      }
      .arena-close:hover{background:rgba(232,50,74,.2);border-color:rgba(232,50,74,.5);color:#fff;transform:rotate(90deg)}

      .arena-header{text-align:center;margin-bottom:6px;padding-top:4px}
      .arena-eyebrow{
        font-size:10px;font-weight:800;letter-spacing:4px;color:#F59E0B;
        margin-bottom:8px;opacity:.85;
      }
      .arena-title{
        font-family:'Bangers', cursive;font-size:42px;letter-spacing:4px;
        background:linear-gradient(180deg, #FEF3C7 0%, #F59E0B 60%, #C2410C 100%);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        text-shadow:0 2px 30px rgba(245,158,11,.4);
        line-height:1.05;margin-bottom:6px;
      }
      .arena-sub{font-size:12px;color:rgba(255,255,255,.55);font-weight:600;letter-spacing:.5px}

      .arena-coins{
        margin:14px auto 4px;display:inline-flex;align-items:center;gap:8px;
        padding:8px 16px;border-radius:30px;
        background:linear-gradient(135deg, rgba(245,158,11,.12), rgba(232,50,74,.08));
        border:1px solid rgba(245,158,11,.25);
        font-weight:800;font-size:13px;
        position:relative;left:50%;transform:translateX(-50%);
      }
      .arena-coin-icon{font-size:16px}
      .arena-coin-val{color:#F59E0B}
      .arena-coin-lbl{color:rgba(255,255,255,.5);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:1px}

      .arena-section{margin-top:24px}
      .arena-section-head{display:flex;align-items:center;gap:14px;margin-bottom:14px}
      .arena-section-num{
        width:36px;height:36px;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
        background:linear-gradient(135deg, #F59E0B, #C2410C);
        border-radius:9px;font-family:'Bangers',cursive;
        font-size:18px;color:#1A0E04;
        box-shadow:0 4px 16px rgba(245,158,11,.35);
      }
      .arena-section-title{font-weight:800;font-size:16px;letter-spacing:.5px;color:#fff}
      .arena-section-sub{font-size:11px;color:rgba(255,255,255,.45);margin-top:2px;font-weight:600}

      /* Players */
      .arena-players-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .arena-pcard{
        position:relative;padding:18px 12px 14px;border-radius:14px;
        background:rgba(255,255,255,.02);border:1.5px solid rgba(255,255,255,.06);
        cursor:pointer;transition:all .25s ease;text-align:center;
        font-family:inherit;color:#fff;overflow:hidden;
      }
      .arena-pcard:hover{border-color:rgba(245,158,11,.3);transform:translateY(-2px);background:rgba(255,255,255,.04)}
      .arena-pcard.on{
        border-color:#F59E0B;background:rgba(245,158,11,.08);
        box-shadow:0 8px 24px rgba(245,158,11,.25), inset 0 1px 0 rgba(245,158,11,.2);
        transform:translateY(-3px);
      }
      .arena-pcard-slots{display:flex;justify-content:center;gap:5px;margin-bottom:8px;min-height:14px}
      .arena-pslot{
        width:14px;height:14px;border-radius:50%;
        background:linear-gradient(135deg, #E8324A, #F59E0B);
        opacity:.4;transition:all .2s;
      }
      .arena-pcard.on .arena-pslot{opacity:1;animation:arenaSlotPulse 1.6s ease-in-out infinite;animation-delay:calc(var(--i) * .12s)}
      .arena-pcard-num{font-family:'Bangers',cursive;font-size:36px;letter-spacing:2px;line-height:1}
      .arena-pcard-lbl{font-size:10px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,.55);margin-top:4px;text-transform:uppercase}
      .arena-pcard.on .arena-pcard-lbl{color:#F59E0B}

      /* Tiers */
      .arena-tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      @media (min-width:560px){.arena-tiers{grid-template-columns:repeat(6,1fr)}}
      .arena-tier{
        position:relative;padding:14px 8px 12px;border-radius:13px;
        background:linear-gradient(180deg, rgba(255,255,255,.025), rgba(0,0,0,.15));
        border:1.5px solid rgba(255,255,255,.07);
        cursor:pointer;transition:all .25s ease;text-align:center;
        font-family:inherit;color:#fff;overflow:hidden;
      }
      .arena-tier:hover:not(.locked){
        border-color:var(--tier-color);transform:translateY(-3px);
        box-shadow:0 10px 24px var(--tier-glow);
      }
      .arena-tier.on{
        border-color:var(--tier-color);
        background:linear-gradient(180deg, color-mix(in srgb, var(--tier-color) 12%, transparent), rgba(0,0,0,.1));
        box-shadow:0 12px 30px var(--tier-glow), inset 0 1px 0 color-mix(in srgb, var(--tier-color) 30%, transparent);
        animation:arenaTierPop .35s ease-out forwards;
      }
      .arena-tier.locked{opacity:.4;cursor:not-allowed}
      .arena-tier-shine{
        position:absolute;top:0;left:0;width:50%;height:100%;
        background:linear-gradient(90deg, transparent, rgba(255,255,255,.15), transparent);
        opacity:0;pointer-events:none;
      }
      .arena-tier.on .arena-tier-shine{opacity:1;animation:arenaShine 1.8s ease-in-out infinite}
      .arena-tier-icon{font-size:24px;line-height:1;margin-bottom:6px;filter:drop-shadow(0 2px 6px var(--tier-glow))}
      .arena-tier-name{font-family:'Bangers',cursive;font-size:14px;letter-spacing:1.5px;color:var(--tier-color);line-height:1}
      .arena-tier-rarity{font-size:8px;font-weight:800;letter-spacing:1.5px;color:rgba(255,255,255,.4);text-transform:uppercase;margin-top:3px}
      .arena-tier-val{font-size:12px;font-weight:800;margin-top:5px;color:rgba(255,255,255,.85)}
      .arena-tier-lock{position:absolute;top:6px;right:6px;font-size:11px;opacity:.7}

      /* Privacy */
      .arena-privacy{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .arena-priv{
        display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:13px;
        background:rgba(255,255,255,.02);border:1.5px solid rgba(255,255,255,.06);
        cursor:pointer;transition:all .25s ease;text-align:left;
        font-family:inherit;color:#fff;
      }
      .arena-priv:hover{border-color:rgba(245,158,11,.3);background:rgba(255,255,255,.04)}
      .arena-priv.on{
        border-color:#F59E0B;background:rgba(245,158,11,.06);
        box-shadow:0 4px 16px rgba(245,158,11,.15);
      }
      .arena-priv-icon{font-size:22px;flex-shrink:0}
      .arena-priv-title{font-weight:800;font-size:13px;line-height:1}
      .arena-priv-sub{font-size:10px;color:rgba(255,255,255,.5);margin-top:3px;font-weight:600}

      /* Actions */
      .arena-actions{display:flex;gap:10px;margin-top:28px;align-items:stretch}
      .arena-cancel{
        flex:0 0 auto;padding:0 22px;
        background:transparent;border:1.5px solid rgba(255,255,255,.1);border-radius:13px;
        color:rgba(255,255,255,.65);font-family:inherit;font-size:13px;font-weight:700;
        cursor:pointer;transition:all .2s;
      }
      .arena-cancel:hover{border-color:rgba(255,255,255,.2);color:#fff}
      .arena-go{
        position:relative;flex:1;padding:18px 24px;
        background:linear-gradient(135deg, #E8324A 0%, #F59E0B 100%);
        border:none;border-radius:13px;
        color:#fff;font-family:'Bangers',cursive;font-size:22px;letter-spacing:3px;
        cursor:pointer;transition:all .25s;overflow:hidden;
        box-shadow:0 12px 30px rgba(232,50,74,.4), 0 0 0 1px rgba(255,255,255,.08) inset;
        display:flex;align-items:center;justify-content:center;gap:12px;
      }
      .arena-go:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(232,50,74,.55)}
      .arena-go:active{transform:translateY(0)}
      .arena-go.disabled{
        background:rgba(255,255,255,.05);color:rgba(255,255,255,.4);
        box-shadow:none;cursor:not-allowed;
      }
      .arena-go.disabled:hover{transform:none}
      .arena-go-shine{
        position:absolute;top:0;left:0;width:40%;height:100%;
        background:linear-gradient(90deg, transparent, rgba(255,255,255,.3), transparent);
        animation:arenaShine 2.6s ease-in-out infinite;
      }
      .arena-go.disabled .arena-go-shine{display:none}
      .arena-go-arrow{font-size:24px;line-height:1}
      .arena-go-foot{
        text-align:center;font-size:11px;color:rgba(255,255,255,.45);
        margin-top:10px;font-weight:600;letter-spacing:.5px;
      }
      .arena-go-foot b{color:rgba(255,255,255,.8);font-weight:800}

      .arena-friends{display:flex;flex-wrap:wrap;gap:8px}
      .arena-friends-msg{font-size:12px;color:rgba(255,255,255,.45);font-weight:600;line-height:1.5;padding:4px 2px}
      .arena-friend{
        display:flex;align-items:center;gap:8px;padding:9px 13px;border-radius:11px;
        background:rgba(255,255,255,.025);border:1.5px solid rgba(255,255,255,.07);
        cursor:pointer;transition:all .2s ease;font-family:inherit;color:#fff;
      }
      .arena-friend:hover:not(.off){border-color:rgba(245,158,11,.35);background:rgba(255,255,255,.05)}
      .arena-friend.on{border-color:#F59E0B;background:rgba(245,158,11,.1);box-shadow:0 4px 14px rgba(245,158,11,.2)}
      .arena-friend.off{opacity:.4;cursor:not-allowed}
      .arena-friend-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.25);flex-shrink:0}
      .arena-friend-dot.on{background:#4ade80;box-shadow:0 0 6px rgba(74,222,128,.6)}
      .arena-friend-name{font-weight:800;font-size:13px}
      .arena-friend-state{font-size:9px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px}
      .arena-friend-check{
        font-size:11px;font-weight:900;color:#F59E0B;width:0;overflow:hidden;
        transition:width .2s ease;
      }
      .arena-friend.on .arena-friend-check{width:13px}

      @media (max-width:520px){
        .arena-panel{padding:24px 18px 20px;border-radius:20px}
        .arena-title{font-size:32px;letter-spacing:3px}
        .arena-section-num{width:30px;height:30px;font-size:15px}
        .arena-pcard-num{font-size:30px}
        .arena-tiers{grid-template-columns:repeat(2,1fr)}
        .arena-go{font-size:18px;letter-spacing:2px;padding:15px 18px}
      }
    `;
    document.head.appendChild(s);
  }

  async function doCreate(){
    const result = await showArenaSetup();
    if(!result) return;
    const { bet, maxPlayers, isPrivate, invites=[] } = result;
    if((S.user?.coins||0) < bet) return toast(`Not enough coins! You have ${S.user?.coins||0} 🪙`,'e');
    try{
      const d = await api('POST','/rooms',{settings:{ maxPlayers, bet, isPrivate }});
      S.roomId = d.roomId;
      S.socket.emit('room:join',{roomId:d.roomId},(res)=>{
        if(!res.success) return toast(res.reason,'e');
        clearInterval(S.roomsTimer); showScreen('room-screen');
        const betLbl = bet ? ` | Bet: 🪙${bet.toLocaleString()}` : '';
        document.getElementById('ridlbl').textContent = `Room: ${d.roomId.substr(0,8).toUpperCase()}${betLbl}`;
        if(res.state?.players) renderWaiting(res.state.players);
        refreshRoom();
        if(d.code) showRoomCode(d.code);
        // Fire off invites to the friends picked in the Arena Setup
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
  const _gc = { difficulty:'medium' };

  function showGameCenter(){
    const old=document.getElementById('gameCenter'); if(old) old.remove();
    _ensureGameCenterStyles();
    const ov=document.createElement('div');
    ov.id='gameCenter';
    ov.innerHTML=`
      <div class="gc-panel" role="dialog" aria-label="Game Center">
        <div class="gc-head">
          <button class="gc-back" id="gcBack" style="display:none">‹</button>
          <div class="gc-head-titles">
            <div class="gc-title" id="gcTitle">GAME CENTER</div>
            <div class="gc-subtitle" id="gcSubtitle">Everything in one place</div>
          </div>
          <button class="gc-close" id="gcClose" aria-label="Close">×</button>
        </div>
        <div class="gc-body" id="gcBody"></div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#gcClose').addEventListener('click',_gcClose);
    ov.querySelector('#gcBack').addEventListener('click',()=>_gcNav('hub'));
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) _gcClose(); });
    _gcNav('hub');
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
    title.textContent=meta.t; sub.textContent=meta.s;
    back.style.display = view==='hub' ? 'none' : '';
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
      {v:'training',    icon:'🤖', c:'#06B6D4', t:t('g_trainingT'), d:t('g_trainingD')},
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
  function _gcTraining(){
    const levels=[
      {id:'easy',   icon:'🟢', name:t('g_rookie'),  c:'#22C55E', tag:t('g_easy'),   d:t('g_rookieD')},
      {id:'medium', icon:'🟡', name:t('g_veteran'), c:'#F59E0B', tag:t('g_medium'), d:t('g_veteranD')},
      {id:'hard',   icon:'🔴', name:t('g_master'),  c:'#EF4444', tag:t('g_hard'),   d:t('g_masterD')},
    ];
    return `<div class="gc-train">
      <div class="gc-train-hint">${t('g_trainHint')}</div>
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
  function startTraining(){
    if(!S.socket?.connected) return toast('Not connected','e');
    const btn=document.getElementById('gcTrainGo');
    if(btn){ btn.disabled=true; btn.textContent=t('g_starting'); }
    S.socket.emit('practice:start',{difficulty:_gc.difficulty},(res)=>{
      if(!res||!res.success){
        if(btn){ btn.disabled=false; btn.innerHTML='<span class="gc-go-shine"></span>'+t('g_enterTraining')+' →'; }
        return toast(res?.reason||'Could not start training','e');
      }
      S.roomId=res.roomId;
      S.isSpectator=false;
      _gcClose();
      toast('🤖 Training match starting…','s');
      // server auto-starts and emits game:state which switches the screen
    });
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
    // Event rooms get a cinematic entry wipe before the screen swaps.
    EVENT.roomEnter(()=>_doJoinNow(roomId));
  }
  function _doJoinNow(roomId){
    S.roomId=roomId;
    S.socket.emit('room:join',{roomId},(res)=>{
      if(!res.success)return toast(res.reason,'e');
      clearInterval(S.roomsTimer);showScreen('room-screen');
      document.getElementById('ridlbl').textContent=`Room: ${roomId.substr(0,8).toUpperCase()}`;
      if(res.state?.players)renderWaiting(res.state.players);refreshRoom();
      EVENT.enterRoomAmbiance();
    });
  }
  function doWatch(roomId){
    if(!S.socket?.connected) return toast('Not connected','e');
    EVENT.roomEnter(()=>_doWatchNow(roomId));
  }
  function _doWatchNow(roomId){
    S.socket.emit('room:spectate',{roomId},(res)=>{
      if(!res.success) return toast(res.reason||'Could not join as spectator','e');
      S.roomId = roomId;
      S.isSpectator = true;
      clearInterval(S.roomsTimer);
      showScreen('game-screen');
      showChatFab(true);
      EVENT.enterRoomAmbiance();
      toast('👁️ Watching live!','s');
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
  function refreshRoom(){if(!S.roomId)return;api('GET',`/rooms/${S.roomId}`).then(d=>{if(d.players)renderWaiting(d.players);}).catch(()=>{});}
  function renderWaiting(players){
    const list=document.getElementById('plist'),btn=document.getElementById('bstart');
    const host=players.find(p=>p.id===S.user?.id)?.isHost,ok=players.length>=2;
    list.innerHTML=players.map(p=>{
      const tag = p.isBot ? '<span style="margin-left:auto;font-size:10px;color:#60a5fa;font-weight:800">🤖 BOT</span>'
                : p.isHost ? '<span style="margin-left:auto;font-size:10px;color:var(--accent);font-weight:800">HOST</span>'
                : '';
      return `
      <div class="prow">
        <div class="pdot"></div><span>${esc(p.username)}</span>
        ${tag}
      </div>`;
    }).join('');
    // Don't override the button while the host is mid-start — let doStart manage it
    if(btn?.dataset.starting==='1') return;
    if(host){btn.disabled=!ok;btn.textContent=ok?`🎮 ${t('startGame')}`:`Need ${2-players.length} more`;}
    else{btn.disabled=true;btn.textContent=t('waitingHost');}
  }
  function doStart(){
    const btn=document.getElementById('bstart');
    if(btn?.dataset.starting==='1') return;
    if(btn){btn.dataset.starting='1';btn.disabled=true;btn.textContent='Starting...';}
    S.socket.emit('game:start',{},(res)=>{
      if(!res.success){
        if(btn){btn.dataset.starting='';btn.disabled=false;btn.textContent=`🎮 ${t('startGame')}`;}
        toast(res.reason,'e');
      }
    });
  }
  function doLeaveRoom(){S.socket.emit('room:leave',{},()=>{S.roomId=null;goLobby();});}
  async function doDaily(){
    try{const d=await api('POST','/coins/claim-daily');S.user.coins=d.coins;localStorage.setItem('uno_user',JSON.stringify(S.user));goLobby();toast(`🎁 +${d.earned} coins!`,'s');}
    catch(e){toast(e.message,'w');}
  }
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
  const AVATARS=[
    {e:'🥷',n:'Ninja'},{e:'🕵️',n:'Spy'},{e:'🦸',n:'Superhero'},{e:'🦹',n:'Villain'},
    {e:'🧙',n:'Wizard'},{e:'🧛',n:'Vampire'},{e:'🧟',n:'Zombie'},{e:'🧞',n:'Genie'},
    {e:'🧜',n:'Merman'},{e:'🧚',n:'Fairy'},{e:'🧝',n:'Elf'},{e:'🦾',n:'Iron Man'},
    {e:'🤖',n:'Robot'},{e:'👽',n:'Alien'},{e:'👾',n:'Invader'},{e:'👻',n:'Ghost'},
    {e:'🤡',n:'Joker'},{e:'👹',n:'Ogre'},{e:'👺',n:'Goblin'},{e:'☠️',n:'Pirate'},
    {e:'🤠',n:'Cowboy'},{e:'🤴',n:'King'},{e:'👸',n:'Queen'},{e:'👮',n:'Officer'},
    {e:'💂',n:'Guard'},{e:'🧑‍🚀',n:'Astronaut'},{e:'🧑‍🚒',n:'Firefighter'},{e:'🎅',n:'Santa'},
    {e:'⛄',n:'Iceman'},{e:'🔥',n:'Blaze'},{e:'⚡',n:'Bolt'},{e:'🐲',n:'Dragon'},
    {e:'🦁',n:'Lion'},{e:'🐺',n:'Wolf'},{e:'🦅',n:'Eagle'},{e:'🦈',n:'Shark'},
    {e:'🦄',n:'Unicorn'},{e:'🐯',n:'Tiger'},{e:'🦊',n:'Fox'},{e:'🐉',n:'Serpent'},
  ];
  function _avatarName(e){ const a=AVATARS.find(x=>x.e===e); return a?a.n:''; }
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
  function showAvatarPicker(){
    const old=document.getElementById('avatarPicker'); if(old) old.remove();
    _ensureAvatarStyles();
    const cur=S.user?.avatar;
    const ov=document.createElement('div');
    ov.id='avatarPicker';
    ov.innerHTML=`
      <div class="av-panel">
        <div class="av-title">${esc(t('chooseAvatar'))}</div>
        <div class="av-sub">${esc(t('chooseAvatarSub'))}</div>
        <div class="av-stage">
          <div class="av-stage-ring"></div>
          <div class="av-stage-face" id="avStageFace">${cur&&!_isImgAvatar(cur)?cur:'🎮'}</div>
        </div>
        <div class="av-stage-name" id="avStageName">${esc(_avatarName(cur)||'')}</div>
        <div class="av-grid">
          ${AVATARS.map((a,i)=>`
            <button class="av-tile ${a.e===cur?'on':''}" data-av="${a.e}" data-name="${esc(a.n)}" style="animation-delay:${i*20}ms">
              <span class="av-face">${a.e}</span>
              <span class="av-name">${esc(a.n)}</span>
            </button>`).join('')}
        </div>
        <button class="av-done" id="avPickClose">${esc(t('close'))}</button>
      </div>`;
    document.body.appendChild(ov);
    const stage=ov.querySelector('#avStageFace');
    const stageName=ov.querySelector('#avStageName');
    ov.querySelectorAll('.av-tile').forEach(b=>{
      b.addEventListener('click',()=>{
        const av=b.dataset.av;
        ov.querySelectorAll('.av-tile').forEach(x=>x.classList.remove('on'));
        b.classList.add('on');
        // confirm pop + preview on the stage
        b.animate([{transform:'scale(1)'},{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:320,easing:'cubic-bezier(.34,1.56,.64,1)'});
        if(stage){ stage.textContent=av; stage.animate([{transform:'rotateY(90deg) scale(.6)'},{transform:'rotateY(0) scale(1)'}],{duration:380,easing:'cubic-bezier(.2,.9,.3,1.2)'}); }
        if(stageName) stageName.textContent=b.dataset.name||'';
        _applyAvatar(av);
      });
      // pointer-tracking 3D tilt
      b.addEventListener('pointermove',e=>{
        const r=b.getBoundingClientRect();
        const px=(e.clientX-r.left)/r.width-.5, py=(e.clientY-r.top)/r.height-.5;
        b.style.transform=`translateY(-6px) rotateX(${-py*22}deg) rotateY(${px*22}deg) scale(1.08)`;
      });
      b.addEventListener('pointerleave',()=>{ b.style.transform=''; });
    });
    ov.querySelector('#avPickClose').addEventListener('click',()=>ov.remove());
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) ov.remove(); });
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
        width:min(460px,95vw);max-height:90vh;display:flex;flex-direction:column;align-items:center;
        background:linear-gradient(180deg,rgba(30,34,60,.97),rgba(16,20,36,.99));
        border:1px solid rgba(255,255,255,.09);border-radius:24px;padding:24px;
        box-shadow:0 40px 100px rgba(0,0,0,.75);animation:avPanelIn .45s cubic-bezier(.2,.9,.3,1.2);
      }
      .av-title{font-family:'Bangers',cursive;font-size:27px;letter-spacing:2px;color:#fff;text-align:center}
      .av-sub{font-size:11px;color:rgba(255,255,255,.5);text-align:center;margin-top:3px;font-weight:600}
      .av-stage{position:relative;width:108px;height:108px;margin:14px 0 4px;display:flex;align-items:center;justify-content:center}
      .av-stage-name{font-family:'Bangers',cursive;font-size:21px;letter-spacing:1.5px;color:#F59E0B;min-height:24px;margin-bottom:12px;text-shadow:0 2px 10px rgba(245,158,11,.4)}
      .av-stage-ring{
        position:absolute;inset:-6px;border-radius:50%;
        background:conic-gradient(from 0deg,#F59E0B,#E8324A,#7C3AED,#06B6D4,#F59E0B);
        animation:avRingSpin 4s linear infinite;filter:blur(3px);opacity:.85;
      }
      .av-stage-face{
        position:relative;width:100px;height:100px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;font-size:52px;
        background:radial-gradient(circle at 38% 32%,#3a4170,#141826);
        box-shadow:inset 0 4px 14px rgba(0,0,0,.55),0 8px 20px rgba(0,0,0,.5);
        filter:drop-shadow(0 4px 8px rgba(0,0,0,.5));
      }
      .av-grid{
        display:grid;grid-template-columns:repeat(4,1fr);gap:10px;
        width:100%;overflow-y:auto;padding:6px;perspective:900px;
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
    `;
    document.head.appendChild(s);
  }
  function copyProfileId(){
    const id = S.user?.id || '';
    if(!id) return;
    navigator.clipboard?.writeText(id);
    toast('🆔 ID copied to clipboard','s');
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
  async function showProfile(){
    // Open the modal immediately so the entrance animation isn't gated on the API.
    const ov=document.getElementById('profileOv'); if(ov) ov.classList.add('show');
    // Reset the bar so it animates from 0 every time the modal opens.
    const bar=document.getElementById('pWinBar'); if(bar) bar.style.width='0%';
    let u=S.user;
    try{
      const d=await api('GET','/auth/me');
      u=d.user;
      S.user=u; localStorage.setItem('uno_user',JSON.stringify(u));
    }catch(e){ /* fall back to cached user */ }
    if(!u) return;
    document.getElementById('profileName').textContent=u.username||'Player';
    const lg=u.league||{};
    const lgEl=document.getElementById('profileLeague');
    if(lgEl) lgEl.textContent=`${lg.badge||'🎖️'} ${lg.name||'Bronze'} League`;
    document.getElementById('profileId').textContent='ID '+(u.id||'').slice(0,8).toUpperCase();
    _renderAvatarInto(document.getElementById('profileAvatar'), u);
    document.getElementById('profileJoined').textContent='Joined '+(u.createdAt?new Date(u.createdAt).toLocaleDateString(I18N.current||'en'):'—');
    const played=u.stats?.gamesPlayed||0;
    const won=u.stats?.gamesWon||0;
    const rate=played>0?Math.round((won/played)*100):0;
    _animateCount('pCoins',  u.coins||0);
    _animateCount('pRating', u.elo??1000);
    _animateCount('pWon',    won);
    _animateCount('pPlayed', played);
    document.getElementById('pWinRate').textContent=rate+'%';
    requestAnimationFrame(()=>{ if(bar) bar.style.width=rate+'%'; });
  }
  async function showAdminPanel(){
    if(!S.user?.username?.toLowerCase().includes('mustapha')) return toast('Admin only','e');
    document.getElementById('adminOv').classList.add('show');
  }

  async function adminCreateTournament(){
    const name = document.getElementById('adminTName').value.trim() || 'UNO Championship';
    const maxPlayers = parseInt(document.getElementById('adminTMax').value) || 8;
    const prizeCoins = parseInt(document.getElementById('adminTPrize').value) || 5000;
    try{
      const res = await fetch('/api/tournament/create', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, maxPlayers, prizeCoins, secret:'uno_admin_2024' })
      });
      const d = await res.json();
      if(d.error) return toast(d.error,'e');
      toast(`Tournament "${d.tournament.name}" created! 🏆`,'s');
      document.getElementById('adminOv').classList.remove('show');
    } catch(e){ toast('Error creating tournament','e'); }
  }

  async function adminStartTournament(){
    const id = document.getElementById('adminTId').value.trim();
    if(!id) return toast('Enter tournament ID','e');
    try{
      const d = await apiFetch(`/api/tournaments/${id}/start`, {
        method:'POST',
        body: JSON.stringify({ secret:'uno_admin_2024' })
      }).catch(err=>({error:err.message}));
      if(d?.error) return toast(d.error,'e');
      toast('Tournament started! ⚔️','s');
    } catch(e){ toast('Error','e'); }
  }

  async function showLeaderboard(){
    try{
      const d=await api('GET','/leaderboard');
      const list=document.getElementById('lbList');
      list.innerHTML=d.leaderboard.map((p,i)=>{
        const rankClass=i===0?'gold':i===1?'silver':i===2?'bronze':'normal';
        const medal=i===0?'👑':i===1?'🥈':i===2?'🥉':'';
        return`<div class="lb-row">
          <div class="lb-rank ${rankClass}">${medal||p.rank}</div>
          <div class="lb-name">${p.username}</div>
          <div style="text-align:right">
            <div class="lb-coins">🪙 ${p.coins.toLocaleString()}</div>
            <div class="lb-wins">${p.gamesWon}W / ${p.gamesPlayed}P</div>
          </div>
        </div>`;
      }).join('');
      if(!d.leaderboard.length)list.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px">No players yet</div>';
      document.getElementById('lbOv').classList.add('show');
    }catch(e){toast('Could not load leaderboard','e');}
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

